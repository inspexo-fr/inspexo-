import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Doc, { formatRef, formatDateDossier } from './Doc'
import Stamp from './Stamp'
import Leaders from './Leaders'
import Footnotes, { Ref, creerRegistreSources } from './Footnotes'
import { getPublicAnalysis, fetchRappels } from '../lib/scoreApi'

// « Un dossier réel » : la VRAIE analyse Audi S7 lue depuis la base (jamais un
// texte en dur). Lecture non trackée (p_track=false) : l'aperçu de l'accueil
// n'incrémente ni share_views ni result_viewed.
export const DOSSIER_EXEMPLE_ID = '9a1c8c4d-0273-453e-a744-f0b2da0d69be'

const STATUT_VENDEUR = {
  particulier: 'Particulier',
  pro: 'Professionnel',
  intermediaire_pour_particulier: 'Agence, pour le compte d\'un particulier',
  pro_deguise_probable: 'Professionnel déguisé probable',
}

const ORDRE_CRITERES = [
  ['prix', 'Prix'],
  ['vendeur_cadre', 'Vendeur et cadre juridique'],
  ['kilometrage_age', 'Kilométrage et âge'],
  ['risques_mecaniques', 'Risques mécaniques'],
  ['historique_entretien', 'Historique et entretien'],
]

const NOMBRES = ['Aucun', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq']

function ligneVerdict(verdict, nbMotifs) {
  const n = NOMBRES[Math.min(nbMotifs, 5)] || String(nbMotifs)
  if (verdict === 'rouge') return `${n} point${nbMotifs > 1 ? 's' : ''} bloquant${nbMotifs > 1 ? 's' : ''} tant qu'ils ne sont pas levés par écrit.`
  if (verdict === 'orange') return `${n} point${nbMotifs > 1 ? 's' : ''} à vérifier avant d'avancer.`
  return 'Rien de bloquant relevé dans l\'annonce.'
}

export function libelleSource(url, title = null) {
  try {
    const u = new URL(url)
    const domaine = u.hostname.replace(/^www\./, '')
    if (title) return `${domaine} — ${title.length > 80 ? `${title.slice(0, 77)}…` : title}`
    const segment = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '')
      .replace(/\.(html?|php|pdf|aspx?|jsp)$/i, '')
      .replace(/[-_+]+/g, ' ')
      .trim()
    if (!segment || /^(index|default)$/i.test(segment)) return domaine
    return `${domaine} — ${segment.length > 60 ? `${segment.slice(0, 57)}…` : segment}`
  } catch (_) { return url }
}

// Rattache une raison aux sources des pannes qu'elle mentionne (recouvrement
// de mots significatifs) — jamais de source inventée : pas de recouvrement,
// pas d'appel de note.
function refsPourRaison(raison, pannes, registre) {
  const mots = String(raison).toLowerCase().match(/[a-zà-ü0-9]{4,}/g) || []
  const nums = []
  for (const p of pannes) {
    const titre = String(p.titre || '').toLowerCase()
    const commun = mots.filter(m => titre.includes(m))
    if (commun.length >= 2) {
      for (const u of (p.urls || []).slice(0, 2)) {
        const title = (p.sources || []).find(s => s && s.url === u)?.title || null
        nums.push(registre.register(u, libelleSource(u, title), u))
      }
    }
  }
  return [...new Set(nums)]
}

export default function DossierApercu() {
  const [row, setRow] = useState(undefined) // undefined = chargement, null = indisponible
  const [rappels, setRappels] = useState(undefined)

  useEffect(() => {
    let cancelled = false
    getPublicAnalysis(DOSSIER_EXEMPLE_ID, false)
      .then(r => { if (!cancelled) setRow(r || null) })
      .catch(() => { if (!cancelled) setRow(null) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!row) return
    let cancelled = false
    fetchRappels({
      marque: row.marque,
      modele: row.modele,
      annee: row.annee,
      carburant: row.result_json?.vehicule?.carburant ?? null,
      motorisation: row.result_json?.vehicule?.motorisation ?? null,
      generation: row.result_json?.vehicule?.generation ?? null,
      analysis_id: row.id,
    })
      .then(d => { if (!cancelled) setRappels(d) })
      .catch(() => { if (!cancelled) setRappels(null) })
    return () => { cancelled = true }
  }, [row])

  if (row === undefined) {
    return (
      <div className="doc" aria-busy="true">
        <div className="doc-head"><span>Dossier Inspexo</span><span>chargement…</span></div>
        <div className="doc-body"><p className="eyebrow">Lecture du dossier depuis la base…</p></div>
      </div>
    )
  }
  if (row === null) {
    return (
      <div className="doc">
        <div className="doc-head"><span>Dossier Inspexo</span><span>—</span></div>
        <div className="doc-body">
          <p className="eyebrow">Dossier d'exemple momentanément indisponible</p>
          <p style={{ marginTop: 10, fontSize: 15 }} className="c-ink2">
            Lancez votre propre analyse : le dossier s'affiche en une minute.
          </p>
          <Link className="btn-ghost" style={{ marginTop: 16 }} to="/score">Analyser une annonce</Link>
        </div>
      </div>
    )
  }

  const r = row.result_json || {}
  const vh = r.vehicule || {}
  const motifs = (r.raisons_principales || []).slice(0, 3)
  const pannes = r.pannes_connues || []
  const registre = creerRegistreSources()
  const refsParMotif = motifs.map(m => refsPourRaison(m, pannes, registre))

  // Contrôles officiels — chaque ligne porte son appel de note.
  const takata = rappels?.takata
  let refTakata = null
  if (takata?.source) {
    refTakata = registre.register(
      takata.source,
      `Ministère de la Transition écologique, liste Takata${takata.liste_date ? ` du ${takata.liste_date}` : ''}.`,
      takata.source,
    )
  }
  let refRappelConso = null
  if (rappels && rappels.rappels !== null && rappels !== null) {
    refRappelConso = registre.register(
      'rappelconso',
      `RappelConso, data.economie.gouv.fr${rappels.fetched_at ? `, vérifié le ${new Date(rappels.fetched_at).toLocaleDateString('fr-FR')}` : ''}.`,
      'https://rappel.conso.gouv.fr',
    )
  }
  const campagnes = pannes.filter(p => p.rappel_officiel)
  const refsCampagnes = campagnes.map(p => {
    const u = (p.urls || [])[0]
    if (!u) return null
    const title = (p.sources || []).find(s => s && s.url === u)?.title || null
    return registre.register(u, libelleSource(u, title), u)
  })

  const criteres = ORDRE_CRITERES
    .filter(([k]) => r.score_detail && r.score_detail[k])
    .map(([k, libelle]) => ({ libelle, note: r.score_detail[k].note ?? null }))

  const numero = formatRef(row.ref_num, row.created_at)

  return (
    <Doc
      numero={numero ? `Dossier n° ${numero}` : 'Dossier Inspexo'}
      date={formatDateDossier(row.created_at)}
      ariaLabel={`Dossier Inspexo, ${[row.marque, row.modele].filter(Boolean).join(' ')}`}
    >
      <p className="eyebrow">Véhicule analysé</p>
      <h3 style={{ marginTop: 10 }}>{[row.marque, row.modele].filter(Boolean).join(' ')}</h3>
      {(vh.motorisation || vh.boite) && (
        <p className="sub">{[vh.motorisation, vh.boite].filter(Boolean).join(' · ')}</p>
      )}
      <dl className="specs">
        {row.annee != null && <div><dt>Année</dt><dd className="num">{row.annee}</dd></div>}
        {vh.kilometrage != null && <div><dt>Kilométrage</dt><dd className="num">{Number(vh.kilometrage).toLocaleString('fr-FR')} km</dd></div>}
        {vh.prix_affiche != null && <div><dt>Prix affiché</dt><dd className="num">{Number(vh.prix_affiche).toLocaleString('fr-FR')} €</dd></div>}
        {vh.prix_reel != null && vh.prix_reel !== vh.prix_affiche && (
          <div><dt>Prix réel</dt><dd className="num">{Number(vh.prix_reel).toLocaleString('fr-FR')} €</dd></div>
        )}
        {r.statut_vendeur && (
          <div className="wide"><dt>Vendeur</dt><dd>{STATUT_VENDEUR[r.statut_vendeur] || r.statut_vendeur}</dd></div>
        )}
      </dl>

      <p className="eyebrow" style={{ marginTop: 26 }}>Verdict</p>
      <Stamp verdict={r.verdict} score={r.score} />
      <p className="verdict-line">{ligneVerdict(r.verdict, motifs.length)}</p>

      {criteres.length > 0 && <Leaders items={criteres} />}

      {motifs.length > 0 && (
        <div className="doc-sec">
          <p className="eyebrow">Motifs principaux</p>
          {motifs.map((m, i) => (
            <div className="motif" key={i}>
              <span className={`n ${r.verdict === 'vert' ? 'vert' : r.verdict === 'orange' ? 'ambre' : ''}`}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <p>{m}<Ref nums={refsParMotif[i]} /></p>
            </div>
          ))}
        </div>
      )}

      {rappels !== undefined && rappels !== null && (
        <div className="doc-sec">
          <p className="eyebrow">Contrôles officiels</p>
          {takata && (
            <div className="ctrl">
              <span>Airbags Takata<Ref nums={refTakata} /></span>
              <span className={`val ${takata.concerne ? 'bad' : 'ok'}`}>
                {takata.concerne ? 'CONCERNÉ — VÉRIFIER LE VIN' : 'NON CONCERNÉ'}
              </span>
            </div>
          )}
          {rappels.rappels !== null ? (
            <div className="ctrl">
              <span>Rappels RappelConso<Ref nums={refRappelConso} /></span>
              <span className={`val ${(rappels.rappels || []).length > 0 ? 'bad' : ''}`}>
                {(rappels.rappels || []).length === 0 ? 'AUCUN' : `${rappels.rappels.length} RAPPEL${rappels.rappels.length > 1 ? 'S' : ''}`}
              </span>
            </div>
          ) : (
            <div className="ctrl">
              <span>Rappels RappelConso</span>
              <span className="val na c-graphite">NON VÉRIFIÉ</span>
            </div>
          )}
          {campagnes.map((p, i) => (
            <div className="ctrl" key={i}>
              <span>{p.rappel_officiel}<Ref nums={refsCampagnes[i]} /></span>
              <span className="val bad">À CONFIRMER</span>
            </div>
          ))}
        </div>
      )}

      {r.message_vendeur && (
        <div className="doc-sec">
          <p className="eyebrow">Message au vendeur</p>
          <MessageVendeur texte={r.message_vendeur} />
        </div>
      )}

      <Footnotes sources={registre.liste} />

      <div className="doc-foot">
        {row.claims_dropped_count != null && (
          row.claims_dropped_count === 0
            ? 'Toutes les affirmations sont sourcées. '
            : `${row.claims_dropped_count} affirmation${row.claims_dropped_count > 1 ? 's' : ''} écartée${row.claims_dropped_count > 1 ? 's' : ''} faute de source. `
        )}
        Analyse automatique : ne remplace pas l'examen du véhicule par un professionnel.
      </div>
    </Doc>
  )
}

function MessageVendeur({ texte }) {
  const [copie, setCopie] = useState(false)
  return (
    <>
      <div className="msg">{texte}</div>
      <button
        type="button"
        className="btn-ghost copy"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(texte)
            setCopie(true)
            setTimeout(() => setCopie(false), 2200)
          } catch (_) { /* presse-papiers indisponible */ }
        }}
      >
        {copie ? 'Message copié' : 'Copier le message'}
      </button>
    </>
  )
}
