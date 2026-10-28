import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { getPublicAnalysis, visitePhoto, visiteTerminer } from '../lib/scoreApi'
import { resizeImageToDataUrl } from '../lib/imageUtils'

// Mode visite — plein écran mobile, un point par écran. Habillage calqué sur
// la maquette téléphone de la section « De l'annonce à la poignée de main »
// (docs/design/maquette-v1.html) : barre mono, fil de progression, réponses
// Oui / Doute / Non en tricolonne, photo en cadre tireté.

const VERDICT_LABELS = { vert: 'FEU VERT', orange: 'PRUDENCE', rouge: 'SIGNAUX ROUGES' }
const DECISION_LABELS = {
  acheter: { label: 'Acheter', classe: 'vert' },
  negocier: { label: 'Négocier', classe: 'ambre' },
  ne_pas_acheter: { label: 'Ne pas acheter', classe: 'rouge' },
}

// Les points où une photo est particulièrement utile (analyse vision).
const PHOTO_SUGGEREE_RE = /compteur|pneu|contr[ôo]le technique|\bct\b|carnet|document|carrosserie|peinture/i

/** Points ajoutés en tête si la checklist de l'analyse ne les couvre pas :
 *  ce sont les photos que l'appel vision sait exploiter (compteur, PV de CT). */
function etapesPhoto(checklist) {
  const texte = JSON.stringify(checklist).toLowerCase()
  const etapes = []
  if (!/compteur/.test(texte)) {
    etapes.push({
      quoi: 'Compteur kilométrique',
      comment: 'Contact mis, photographiez le compteur : le kilométrage lu est comparé automatiquement à celui de l\'annonce.',
      signal_rouge: 'Kilométrage différent de celui annoncé.',
      photo: true,
    })
  }
  if (!/contrôle technique|controle technique|proces-verbal|procès-verbal/.test(texte)) {
    etapes.push({
      quoi: 'PV de contrôle technique et carnet d\'entretien',
      comment: 'Demandez les documents et photographiez le procès-verbal du CT : les défaillances listées sont lues automatiquement.',
      signal_rouge: 'Documents refusés, CT absent (véhicule de plus de 4 ans), défaillances majeures listées.',
      photo: true,
    })
  }
  return etapes
}

export default function VisitePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [analysis, setAnalysis] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [idx, setIdx] = useState(-1) // -1 = intro, items.length = écran final
  const [reponses, setReponses] = useState({}) // idx -> 'oui'|'non'|'doute'
  const [photoEtat, setPhotoEtat] = useState('idle') // idle | analyse | erreur
  const [constatsItem, setConstatsItem] = useState({}) // idx -> [constats]
  const [constatsVisite, setConstatsVisite] = useState([]) // session cumulée (mode éphémère)
  const [verdictLive, setVerdictLive] = useState(null) // {verdict, score} après recalcul
  const [persiste, setPersiste] = useState(null) // true si l'analyse est suivie dans le dossier
  const [synthese, setSynthese] = useState(null)
  const [finEnCours, setFinEnCours] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
    let cancelled = false
    getPublicAnalysis(id)
      .then(row => {
        if (cancelled) return
        if (!row || row.result_json?.type !== 'vehicule') { setErreur('Analyse introuvable.'); return }
        if (row.result_json?.statut_analyse === 'en_cours') {
          setErreur('L\'analyse est encore en cours — attendez le verdict final avant la visite.')
          return
        }
        setAnalysis({ id: row.id, result: row.result_json, marque: row.marque, modele: row.modele, annee: row.annee })
        setVerdictLive({ verdict: row.result_json.verdict, score: row.result_json.score })
      })
      .catch(() => { if (!cancelled) setErreur('Impossible de charger cette analyse.') })
    return () => { cancelled = true }
  }, [id])

  const items = useMemo(() => {
    const base = analysis?.result?.checklist_sur_place || []
    return [
      ...etapesPhoto(base),
      ...base.map(c => ({ ...c, photo: PHOTO_SUGGEREE_RE.test(`${c.quoi} ${c.comment}`) })),
    ]
  }, [analysis])

  const repondre = (etat) => {
    setReponses(prev => ({ ...prev, [idx]: etat }))
    setPhotoEtat('idle')
    setIdx(i => Math.min(items.length, i + 1))
  }

  const prendrePhoto = async (fileList) => {
    const file = fileList?.[0]
    if (!file) return
    setPhotoEtat('analyse')
    try {
      const dataUrl = await resizeImageToDataUrl(file)
      const itemAuMomentDeLaPhoto = idx
      const { result, constats_nouveaux, persiste: p } = await visitePhoto(id, [dataUrl], constatsVisite)
      setConstatsItem(prev => ({
        ...prev,
        [itemAuMomentDeLaPhoto]: [...(prev[itemAuMomentDeLaPhoto] || []), ...(constats_nouveaux || [])],
      }))
      setConstatsVisite(prev => [...prev, ...(constats_nouveaux || [])].slice(0, 24))
      setPersiste(p === true)
      if (result?.verdict) setVerdictLive({ verdict: result.verdict, score: result.score })
      setPhotoEtat('idle')
    } catch (_) {
      setPhotoEtat('erreur')
    }
  }

  const terminer = async () => {
    if (finEnCours) return
    setFinEnCours(true)
    try {
      const reponsesListe = items
        .map((it, i) => ({ quoi: it.quoi, etat: reponses[i] }))
        .filter(r => r.etat)
      // Points restés sans réponse : sous 70 % de couverture, la synthèse se
      // déclare incomplète et ne peut pas conclure « Acheter ».
      const nonVerifies = items.filter((_, i) => !reponses[i]).map(it => it.quoi)
      const { synthese: s, result, persiste: p } = await visiteTerminer(id, reponsesListe, nonVerifies, constatsVisite)
      setSynthese(s)
      setPersiste(p === true)
      if (result?.verdict) setVerdictLive({ verdict: result.verdict, score: result.score })
    } catch (_) {
      setSynthese({ decision: 'negocier', points: ['Synthèse indisponible — appuyez-vous sur le verdict de l\'analyse.'] })
    }
    setFinEnCours(false)
  }

  const vehiculeLabel = analysis
    ? [analysis.marque, analysis.modele, analysis.annee].filter(Boolean).join(' ')
    : ''

  const boutonsReponse = (
    <div className="tri" style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', border: '1px solid var(--rule-strong)' }}>
      {[['oui', 'Oui', 'c-vert'], ['doute', 'Doute', 'c-ambre'], ['non', 'Non', 'c-rouge']].map(([etat, label, classe], i) => (
        <button
          key={etat}
          type="button"
          onClick={() => repondre(etat)}
          className={classe}
          style={{
            height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, background: 'transparent', cursor: 'pointer',
            border: 'none', borderRight: i < 2 ? '1px solid var(--rule-strong)' : 'none',
            fontFamily: 'var(--sans)',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )

  /* ---------- Habillage plein écran mobile ---------- */
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--paper)' }}>
      <Helmet>
        <title>Mode visite — Inspexo</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      {/* Barre haute (comme la maquette téléphone) */}
      <div
        className="mono"
        style={{
          position: 'sticky', top: 0, zIndex: 10, background: 'var(--nav-bg)', color: 'var(--nav-fg)',
          minHeight: 48, padding: '0 14px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 10, fontSize: 11, letterSpacing: '.08em',
        }}
      >
        <Link to={`/a/${id}`} style={{ color: 'var(--nav-fg)', textDecoration: 'none', padding: '14px 0' }}>
          ← DOSSIER
        </Link>
        <span>
          VISITE{idx >= 0 && idx < items.length ? ` · ${idx + 1}/${items.length}` : ''}
        </span>
      </div>

      {/* Ligne véhicule + verdict vivant */}
      {verdictLive && idx >= 0 && (
        <div
          className="mono"
          style={{
            display: 'flex', justifyContent: 'space-between', gap: 8, padding: '10px 14px',
            borderBottom: '1px solid var(--rule-strong)', fontSize: 10, letterSpacing: '.04em',
            color: 'var(--graphite)',
          }}
        >
          <span>{vehiculeLabel}</span>
          <b className={verdictLive.verdict === 'vert' ? 'c-vert' : verdictLive.verdict === 'rouge' ? 'c-rouge' : 'c-ambre'} style={{ fontWeight: 600 }}>
            {VERDICT_LABELS[verdictLive.verdict] || verdictLive.verdict} · {verdictLive.score}/100
          </b>
        </div>
      )}

      <div style={{ flex: 1, maxWidth: 560, width: '100%', margin: '0 auto', padding: '20px 16px 24px', display: 'flex', flexDirection: 'column' }}>
        {erreur ? (
          <div className="c-rouge" style={{ padding: '40px 0', textAlign: 'center' }}>
            {erreur}
            <div style={{ marginTop: 16 }}>
              <Link to={`/a/${id}`}>Retour au dossier</Link>
            </div>
          </div>
        ) : !analysis ? (
          <p className="eyebrow" style={{ textAlign: 'center', padding: '60px 0' }} aria-busy="true">
            Lecture du dossier…
          </p>
        ) : synthese ? (
          /* ---------- Synthèse finale ---------- */
          (() => {
            const d = DECISION_LABELS[synthese.decision] || DECISION_LABELS.negocier
            const nego = analysis.result?.negociation
            return (
              <div>
                {synthese.incomplete && (
                  <div className="alert alert-ambre">
                    <strong>Visite incomplète : {synthese.non_verifies} point{synthese.non_verifies > 1 ? 's' : ''} non vérifié{synthese.non_verifies > 1 ? 's' : ''}.</strong>
                    {(synthese.points_critiques_non_verifies || []).length > 0 && (
                      <div style={{ fontWeight: 400, marginTop: 6 }}>
                        Points critiques à vérifier avant de décider :
                        {synthese.points_critiques_non_verifies.map((q, i) => (
                          <div key={i}>– {q}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ border: '1px solid var(--rule-strong)', padding: '24px 18px', marginBottom: 16 }}>
                  <p className="eyebrow">Synthèse de visite — {vehiculeLabel}</p>
                  {synthese.sur_points_verifies && (
                    <p className="mono c-graphite" style={{ fontSize: 11, marginTop: 10 }}>Sur les points vérifiés :</p>
                  )}
                  <div
                    className={`stamp ${d.classe}`}
                    role="img"
                    aria-label={`Décision : ${d.label}`}
                    style={{ marginTop: 14 }}
                  >
                    <span className="lab">{d.label.toUpperCase()}</span>
                  </div>
                  {verdictLive && (
                    <p style={{ fontSize: 14, marginTop: 14 }} className="c-ink2">
                      Verdict actualisé : {VERDICT_LABELS[verdictLive.verdict]} · {verdictLive.score}/100
                    </p>
                  )}
                </div>
                <div style={{ borderTop: '1px solid var(--rule-strong)', paddingTop: 12, marginBottom: 14 }}>
                  <p className="eyebrow">Les points qui ont pesé</p>
                  {(synthese.points || []).map((p, i) => (
                    <div key={i} style={{ fontSize: 14, lineHeight: 1.6, padding: '6px 0', borderBottom: '1px solid var(--rule)' }}>
                      – {p}
                    </div>
                  ))}
                </div>
                {synthese.decision === 'negocier' && nego?.total_min_eur != null && (
                  <div style={{ borderTop: '1px solid var(--rule-strong)', paddingTop: 12, marginBottom: 14 }}>
                    <p className="eyebrow">Marge de négociation chiffrée</p>
                    <p className="mono num" style={{ fontSize: 24, fontWeight: 600, marginTop: 6 }}>
                      {Number(nego.total_min_eur).toLocaleString('fr-FR')} – {Number(nego.total_max_eur).toLocaleString('fr-FR')} €
                    </p>
                    <p className="mono c-graphite" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.6 }}>{nego.mention}</p>
                  </div>
                )}
                {persiste === false && (
                  <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.6, marginBottom: 12, textAlign: 'center' }}>
                    Mode démo : cette visite reste sur cet écran et ne modifie pas la page
                    publique de l'analyse. Pour la conserver, suivez d'abord l'analyse dans
                    votre dossier d'achat (connexion par lien magique).
                  </p>
                )}
                <button type="button" className="btn-ghost" onClick={() => navigate(`/a/${id}`)}>
                  Revoir le dossier complet
                </button>
              </div>
            )
          })()
        ) : idx === -1 ? (
          /* ---------- Intro ---------- */
          <div>
            <p className="tag ambre" style={{ marginBottom: 18 }}>
              Fonction du Pass achat — en démo libre pendant le lancement
            </p>
            <h1 style={{ fontSize: 26 }}>Vous êtes devant la voiture ?</h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, margin: '10px 0' }} className="c-ink2">
              {vehiculeLabel} — {items.length} points à vérifier, un par un. Répondez
              « Oui / Non / Doute » ; photographiez le compteur, les pneus, le PV de contrôle
              technique ou le carnet quand c'est proposé : chaque photo est analysée sur-le-champ
              et le verdict se met à jour.
            </p>
            <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.6, marginBottom: 22 }}>
              Les photos sont analysées puis oubliées : jamais stockées. À la fin : synthèse
              « acheter / négocier / ne pas acheter » avec les points qui ont pesé.
            </p>
            <button type="button" className="btn" onClick={() => setIdx(0)}>
              Commencer la visite
            </button>
          </div>
        ) : idx >= items.length ? (
          /* ---------- Écran avant synthèse ---------- */
          <div style={{ textAlign: 'center', paddingTop: 20 }}>
            <h2 style={{ fontSize: 24 }}>Visite terminée</h2>
            <p style={{ fontSize: 15, lineHeight: 1.6, marginTop: 10 }} className="c-ink2">
              {Object.values(reponses).filter(x => x === 'non').length} « non » ·{' '}
              {Object.values(reponses).filter(x => x === 'doute').length} doute(s) sur{' '}
              {Object.keys(reponses).length} points vérifiés.
            </p>
            <button type="button" className="btn" style={{ marginTop: 16 }} onClick={terminer} disabled={finEnCours}>
              {finEnCours ? 'Synthèse en cours…' : 'Obtenir la synthèse'}
            </button>
            <button
              type="button"
              onClick={() => setIdx(0)}
              className="mono c-graphite"
              style={{
                marginTop: 14, background: 'none', border: 'none', fontSize: 12,
                cursor: 'pointer', textDecoration: 'underline', minHeight: 44,
              }}
            >
              Revoir les points
            </button>
          </div>
        ) : (
          /* ---------- Un point de checklist ---------- */
          (() => {
            const it = items[idx]
            const constats = constatsItem[idx] || []
            return (
              <div className="visite-corps">
                <div className="visite-haut">
                <div className="pbar" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={idx} aria-label="Avancement de la visite">
                  <i style={{ width: `${Math.round((idx / items.length) * 100)}%` }} />
                </div>
                <h2 style={{ fontSize: 24, margin: '18px 0 0', lineHeight: 1.1 }}>{it.quoi}</h2>
                <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5 }} className="c-ink2">{it.comment}</p>
                <p className="c-rouge" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.45 }}>
                  Signal rouge : {it.signal_rouge}
                </p>
                {constats.map((c, i) => (
                  <div key={i} className="ctrl" style={{ alignItems: 'baseline', fontSize: 14 }}>
                    <span>{c.constat}</span>
                    <span className={`val ${c.signal === 'rouge' ? 'bad' : c.signal === 'attention' ? 'mid' : 'ok'}`}>
                      {c.signal === 'rouge' ? 'ROUGE' : c.signal === 'attention' ? 'ATTENTION' : 'OK'}
                    </span>
                  </div>
                ))}
                </div>

                {/* Gestes : photo, réponse, passer — ancrés dans la zone du pouce */}
                <div className="visite-actions">
                <input
                  ref={fileInputRef} type="file" accept="image/*" capture="environment" hidden
                  onChange={e => { prendrePhoto(e.target.files); e.target.value = '' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photoEtat === 'analyse'}
                  className={`mono ${it.photo ? '' : 'c-graphite'}`}
                  style={{
                    marginTop: 14, width: '100%', minHeight: 48,
                    border: `1px dashed ${it.photo ? 'var(--signal)' : 'var(--rule-strong)'}`,
                    color: it.photo ? 'var(--signal)' : undefined,
                    background: 'transparent', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 10, letterSpacing: '.08em',
                    cursor: 'pointer', textTransform: 'uppercase',
                  }}
                >
                  {photoEtat === 'analyse'
                    ? 'ANALYSE DE LA PHOTO EN COURS…'
                    : it.photo
                    ? 'PHOTOGRAPHIER · ANALYSÉ SUR PLACE'
                    : 'AJOUTER UNE PHOTO · FACULTATIF'}
                </button>
                {photoEtat === 'erreur' && (
                  <p className="c-rouge" style={{ fontSize: 13, marginTop: 8 }}>
                    Photo non analysée (limite atteinte ou réseau) — continuez la visite.
                  </p>
                )}
                {boutonsReponse}
                <button
                  type="button"
                  onClick={() => setIdx(i => Math.min(items.length, i + 1))}
                  className="mono c-graphite"
                  style={{
                    marginTop: 10, width: '100%', background: 'none', border: 'none',
                    fontSize: 12, cursor: 'pointer', textDecoration: 'underline', minHeight: 44,
                  }}
                >
                  Passer ce point
                </button>
                </div>
              </div>
            )
          })()
        )}
      </div>
    </main>
  )
}
