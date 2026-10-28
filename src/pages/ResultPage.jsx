import React, { useEffect, useState } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { supabase } from '../lib/supabaseClient'
import Turnstile from '../components/Turnstile'
import Doc, { formatRef, formatDateDossier } from '../components/Doc'
import Stamp from '../components/Stamp'
import Footnotes, { Ref, creerRegistreSources } from '../components/Footnotes'
import EmailCapture, { CONSENT_TEXT } from '../components/EmailCapture'
import { libelleSource } from '../components/DossierApercu'
import {
  getPublicAnalysis, getAnalysisEtape, fetchRappels, getDefectSheet,
  trackEvent, dossierAdd, envoyerLienMagique,
} from '../lib/scoreApi'

const VERDICT_LABELS = { vert: 'Feu vert', orange: 'Prudence', rouge: 'Signaux rouges' }

const GRAVITE_LABELS = {
  securite: { label: 'Sécurité', classe: 'rouge' },
  casse: { label: 'Casse moteur/boîte', classe: 'rouge' },
  majeure: { label: 'Majeure', classe: 'ambre' },
  mineure: { label: 'Mineure', classe: 'muted' },
}

const AXE_LABELS = {
  prix: 'Prix',
  kilometrage_age: 'Kilométrage et âge',
  historique_entretien: 'Historique et entretien',
  risques_mecaniques: 'Risques mécaniques',
  vendeur_cadre: 'Vendeur et cadre juridique',
}
// Ordre des critères de la maquette.
const ORDRE_AXES = ['prix', 'vendeur_cadre', 'kilometrage_age', 'risques_mecaniques', 'historique_entretien']

const STATUT_VENDEUR_LABELS = {
  particulier: 'Particulier',
  pro: 'Professionnel',
  intermediaire_pour_particulier: 'Agence, pour le compte d\'un particulier',
  pro_deguise_probable: 'Professionnel déguisé probable',
}

/* ---------- Adaptateur schéma v1 → forme affichable ---------- */
function adaptResult(raw) {
  if (!raw) return null
  if (raw.schema_version === 2) return raw
  // Anciennes analyses (sprint 1) : adaptation minimale
  return {
    schema_version: 1,
    type: 'vehicule',
    vehicule: raw.vehicule || {},
    statut_vendeur: null,
    verdict: raw.verdict,
    score: raw.score,
    score_detail: null,
    raisons_principales: raw.raisons || [],
    cadre_juridique: null,
    message_vendeur: null,
    questions_vendeur: raw.questions_au_vendeur || [],
    checklist_sur_place: [],
    pannes_connues: (raw.pannes_connues || []).map(p => ({
      titre: p.titre,
      organe: null,
      symptome: p.symptome,
      pertinence: null,
      verification_sur_place: p.verification_sur_place,
      gravite: p.gravite,
      source_statut: p.confiance === 'haute' ? 'base_inspexo' : 'en_ligne',
      urls: [],
      cout_min_eur: null,
      cout_max_eur: null,
    })),
    incoherences: raw.incoherences_annonce || [],
    budget_12_mois: [],
    prix: raw.prix || { commentaire: null, mediane_comparables: null },
    analyse_limitee: null,
    avertissement: raw.avertissement ||
      'Analyse automatique à partir du texte de l\'annonce. Ne remplace pas un examen du véhicule.',
  }
}

/* ---------- Petits composants ---------- */
function CopyButton({ text, label = 'Copier' }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="btn-ghost btn-sm btn-auto"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 2000)
        } catch (_) { /* clipboard indisponible */ }
      }}
    >
      {done ? 'Copié' : label}
    </button>
  )
}

function euros1(n) { return n != null ? `${Number(n).toLocaleString('fr-FR')} €` : '' }
function euros(min, max) {
  if (min != null && max != null && min !== max) return `${Number(min).toLocaleString('fr-FR')} – ${Number(max).toLocaleString('fr-FR')} €`
  const seul = min ?? max
  return seul != null ? euros1(seul) : ''
}

/** Texte d'un claim écarté : on retire les marqueurs internes de la critique. */
function cleanClaimText(t) {
  return String(t || '')
    .split(/ — (?:pertinence|à vérifier|sources) :/)[0]
    .replace(/\s*\[(?:base Inspexo|en ligne)\]/g, '')
    .trim()
}

/** Raison d'écartement en langage acheteur : mapping fixe, jamais la
 *  justification brute de la critique, jamais d'appel IA. */
function publicReason(justification) {
  const j = String(justification || '').toLowerCase()
  if (/dit vrai|exact|v[ée]ridique|pas une incoh[ée]rence|constat/.test(j)) {
    return "L'annonce dit vrai sur ce point : ce n'était pas une incohérence."
  }
  if (/autre (famille|moteur|v[ée]hicule|mod[èe]le)|famille diff[ée]rente|ea\d{3}|cayenne|porsche/.test(j)) {
    return 'Cette panne concerne un autre moteur que celui de ce véhicule.'
  }
  if (/mill[ée]sime|ann[ée]e|g[ée]n[ée]ration|p[ée]riode de production|ne concerne pas ce/.test(j)) {
    return "Ce point concerne d'autres années ou une autre génération que ce véhicule."
  }
  if (/photo|visible|visuel|estimation de valeur|cote/.test(j)) {
    return "Ce constat n'était pas vérifiable sur la photo."
  }
  return "Non prouvé par l'annonce ni par la fiche moteur."
}

/* ---------- Verdict progressif : indicateur d'étapes ---------- */
const ETAPES_PIPELINE = [
  { cle: 'identification', label: 'Véhicule identifié' },
  { cle: 'photos_fiche', label: 'Photos et fiche moteur' },
  { cle: 'analyse', label: 'Analyse de l\'annonce' },
  { cle: 'verification', label: 'Vérification de chaque affirmation' },
]

function EtapesProgress({ etape }) {
  const idx = Math.max(1, ETAPES_PIPELINE.findIndex(e => e.cle === etape))
  return (
    <div style={{ marginTop: 18 }}>
      {ETAPES_PIPELINE.map((e, i) => (
        <div
          key={e.cle}
          className={`mono ${i < idx ? 'c-vert' : i === idx ? '' : 'c-graphite'}`}
          style={{
            display: 'flex', gap: 10, alignItems: 'baseline', padding: '9px 0',
            borderTop: i > 0 ? '1px solid var(--rule)' : 'none',
            fontSize: 12, letterSpacing: '.04em',
            fontWeight: i === idx ? 600 : 400,
          }}
        >
          <span style={{ width: 16, textAlign: 'center' }} aria-hidden="true">
            {i < idx ? '×' : i === idx ? '→' : '·'}
          </span>
          {e.label}
        </div>
      ))}
      <p className="mono c-graphite" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.6 }}>
        Le score final s'affiche une fois chaque affirmation vérifiée — en attendant,
        les contrôles officiels et le cadre juridique ci-dessous sont déjà exploitables.
      </p>
    </div>
  )
}

/** CTA Pass achat : la précommande n'est pas en ligne → capteur « Être prévenu ». */
function PassCTA({ analysisId }) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button type="button" className="btn-ghost btn-sm btn-auto" onClick={() => setOpen(true)}>
        Être prévenu du lancement
      </button>
    )
  }
  return (
    <div style={{ width: '100%', maxWidth: 420, background: 'var(--paper)', border: '1px solid var(--rule-strong)', padding: '12px 14px', textAlign: 'left' }}>
      <EmailCapture
        title="Le Pass achat arrive — être prévenu du lancement ?"
        buttonLabel="Être prévenu"
        source="pass_waitlist"
        analysisId={analysisId}
      />
    </div>
  )
}

/* ---------- Suivre dans mon dossier ---------- */
function DossierButton({ analysisId }) {
  const [etat, setEtat] = useState('idle') // idle | email | sending | lien_envoye | ajout | fait | erreur
  const [email, setEmail] = useState('')
  const [captcha, setCaptcha] = useState(null)

  const ajouter = async () => {
    setEtat('ajout')
    try {
      await dossierAdd(analysisId)
      setEtat('fait')
    } catch (_) {
      setEtat('erreur')
    }
  }

  useEffect(() => {
    // Retour de lien magique avec ?dossier=1 : l'ajout n'a lieu QUE si une
    // intention a été posée par l'utilisateur sur cet appareil (clic sur
    // « Suivre dans mon dossier » < 15 min) — le paramètre d'URL seul ne
    // prouve rien : une page /a/:id circule, un lien forgé ne doit pas
    // modifier le dossier d'un visiteur connecté (audit sécurité sprint 3).
    const params = new URLSearchParams(window.location.search)
    if (params.get('dossier') !== '1') return
    window.history.replaceState({}, '', window.location.pathname)
    let intention = null
    try {
      intention = JSON.parse(localStorage.getItem('inspexo_dossier_intent') || 'null')
    } catch (_) { /* intention illisible = absente */ }
    if (!intention || intention.analysisId !== analysisId || intention.exp < Date.now()) return
    try { localStorage.removeItem('inspexo_dossier_intent') } catch (_) { /* best effort */ }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) ajouter()
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const clic = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) return ajouter()
    setEtat('email')
  }

  const envoyerLien = async (e) => {
    e.preventDefault()
    if (!email || etat === 'sending') return
    setEtat('sending')
    try {
      // Intention d'ajout posée AVANT l'envoi du lien (consommée au retour).
      try {
        localStorage.setItem('inspexo_dossier_intent', JSON.stringify({
          analysisId, exp: Date.now() + 15 * 60 * 1000,
        }))
      } catch (_) { /* stockage indisponible : l'ajout restera manuel */ }
      await envoyerLienMagique(email, `/a/${analysisId}?dossier=1`, captcha)
      setEtat('lien_envoye')
    } catch (_) {
      setEtat('erreur')
    }
  }

  if (etat === 'fait') {
    return (
      <div className="c-vert" style={{ fontSize: 14, fontWeight: 600 }}>
        Ajouté à votre dossier — <Link to="/dossier">voir mon dossier d'achat</Link>
      </div>
    )
  }
  if (etat === 'lien_envoye') {
    return (
      <div className="c-vert" style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>
        Lien de connexion envoyé — ouvrez l'email sur cet appareil, l'analyse sera ajoutée à votre dossier.
      </div>
    )
  }
  if (etat === 'email' || etat === 'sending') {
    return (
      <form onSubmit={envoyerLien} style={{ width: '100%' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="email" required placeholder="votre@email.com" value={email}
            onChange={e => setEmail(e.target.value)}
            className="input" style={{ flex: '1 1 180px', width: 'auto' }}
            aria-label="Votre email"
          />
          <button type="submit" className="btn-ghost btn-sm btn-auto" disabled={etat === 'sending'}>
            {etat === 'sending' ? '…' : 'Recevoir le lien'}
          </button>
        </div>
        <Turnstile onToken={setCaptcha} action="lien-magique" />
        <div className="mono c-graphite" style={{ marginTop: 6, fontSize: 11, lineHeight: 1.6 }}>
          Connexion par lien magique, sans mot de passe. {CONSENT_TEXT}
        </div>
      </form>
    )
  }
  return (
    <button type="button" className="btn-ghost" style={{ flex: '1 1 140px', width: 'auto' }} onClick={clic}>
      {etat === 'erreur' ? 'Réessayer l\'ajout au dossier' : etat === 'ajout' ? '…' : 'Suivre dans mon dossier'}
    </button>
  )
}

/* ---------- Synthèse du mode visite ---------- */
const DECISION_LABELS = {
  acheter: { label: 'Acheter', classe: 'vert' },
  negocier: { label: 'Négocier', classe: 'ambre' },
  ne_pas_acheter: { label: 'Ne pas acheter', classe: 'rouge' },
}

function SyntheseVisite({ synthese }) {
  if (!synthese) return null
  const s = DECISION_LABELS[synthese.decision] || DECISION_LABELS.negocier
  return (
    <div className={`alert alert-${s.classe}`}>
      {synthese.incomplete && (
        <div className="c-ambre" style={{ fontWeight: 700, marginBottom: 6 }}>
          Visite incomplète : {synthese.non_verifies} point{synthese.non_verifies > 1 ? 's' : ''} non vérifié{synthese.non_verifies > 1 ? 's' : ''}.
        </div>
      )}
      <div style={{ fontWeight: 800, marginBottom: 6 }}>
        Synthèse de votre visite : {synthese.sur_points_verifies ? 'sur les points vérifiés, ' : ''}{s.label}
      </div>
      {(synthese.points || []).map((p, i) => (
        <div key={i} className="c-ink2" style={{ fontSize: 13, lineHeight: 1.6 }}>
          – {p}
        </div>
      ))}
    </div>
  )
}

function VerdictFeedback({ analysisId }) {
  const [sent, setSent] = useState(false)
  if (sent) {
    return (
      <div className="c-vert" style={{ fontSize: 14, fontWeight: 600, textAlign: 'center' }}>
        Merci pour votre retour.
      </div>
    )
  }
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
        Ce verdict vous a aidé ?
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button type="button" className="btn-ghost btn-sm btn-auto" style={{ minWidth: 90 }} onClick={() => { trackEvent('verdict_feedback', analysisId, { helpful: true }); setSent(true) }}>Oui</button>
        <button type="button" className="btn-ghost btn-sm btn-auto" style={{ minWidth: 90 }} onClick={() => { trackEvent('verdict_feedback', analysisId, { helpful: false }); setSent(true) }}>Non</button>
      </div>
    </div>
  )
}

/** Rattache un texte aux sources des pannes qu'il mentionne (≥ 2 mots
 *  significatifs communs) — pas de recouvrement, pas d'appel de note. */
function refsPourTexte(texte, pannes, registrePanne) {
  const mots = String(texte).toLowerCase().match(/[a-zà-ü0-9]{4,}/g) || []
  const nums = []
  pannes.forEach((p, i) => {
    const titre = String(p.titre || '').toLowerCase()
    if (mots.filter(m => titre.includes(m)).length >= 2) {
      nums.push(...registrePanne(i))
    }
  })
  return [...new Set(nums)]
}

/* ================================================================== */
export default function ResultPage() {
  const { id } = useParams()
  const location = useLocation()

  const [analysis, setAnalysis]   = useState(null)
  const [notFound, setNotFound]   = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [rappels, setRappels]     = useState(undefined)
  const [ficheLive, setFicheLive] = useState(null)
  const [ficheInfo, setFicheInfo] = useState(null)
  const [shareDone, setShareDone] = useState(false)
  const [etapeLive, setEtapeLive] = useState(null) // étape du verdict progressif

  useEffect(() => {
    window.scrollTo(0, 0)
    let cancelled = false
    async function load() {
      if (location.state?.result) {
        const r = adaptResult(location.state.result)
        setAnalysis({
          id,
          result: r,
          marque: r.vehicule?.marque ?? null,
          modele: r.vehicule?.modele ?? null,
          annee: r.vehicule?.annee ?? null,
          refNum: null,
          createdAt: null,
          // Arrivée directe depuis /score : les events claim_dropped ne sont
          // pas encore relus ; on retombe sur le compteur du résultat.
          claimsDroppedCount: r.critique?.supprimees ?? null,
          claimsDropped: [],
        })
        return
      }
      try {
        const row = await getPublicAnalysis(id)
        if (cancelled) return
        if (!row) { setNotFound(true); return }
        setAnalysis({
          id: row.id,
          result: adaptResult(row.result_json),
          marque: row.marque,
          modele: row.modele,
          annee: row.annee,
          refNum: row.ref_num ?? null,
          createdAt: row.created_at ?? null,
          claimsDroppedCount: row.claims_dropped_count ?? null,
          claimsDropped: Array.isArray(row.claims_dropped) ? row.claims_dropped : [],
        })
      } catch (_) {
        if (!cancelled) setLoadError(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Verdict progressif : la ligne est encore « en_cours » → polling 2 s de
  // l'étape, puis rechargement complet dès que la critique est terminée.
  useEffect(() => {
    const r = analysis?.result
    if (!r || r.statut_analyse !== 'en_cours') return
    let cancelled = false
    let tries = 0
    const interval = setInterval(async () => {
      tries += 1
      if (tries > 120) { clearInterval(interval); if (!cancelled) setEtapeLive('timeout'); return } // ~4 min
      try {
        const e = await getAnalysisEtape(id)
        if (cancelled || !e) return
        if (e.pret) {
          clearInterval(interval)
          const row = await getPublicAnalysis(id)
          if (!cancelled && row) {
            setAnalysis({
              id: row.id,
              result: adaptResult(row.result_json),
              marque: row.marque,
              modele: row.modele,
              annee: row.annee,
              refNum: row.ref_num ?? null,
              createdAt: row.created_at ?? null,
              claimsDroppedCount: row.claims_dropped_count ?? null,
              claimsDropped: Array.isArray(row.claims_dropped) ? row.claims_dropped : [],
            })
            setEtapeLive(null)
          }
        } else if (e.etape) {
          setEtapeLive(e.etape)
        }
      } catch (_) { /* on retentera au tick suivant */ }
    }, 2000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [analysis?.result?.statut_analyse, id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!analysis) return
    let cancelled = false
    async function loadRappels() {
      if (!analysis.marque || !analysis.modele) { setRappels(null); return }
      try {
        const data = await fetchRappels({
          marque: analysis.marque,
          modele: analysis.modele,
          annee: analysis.annee,
          carburant: analysis.result?.vehicule?.carburant ?? null,
          motorisation: analysis.result?.vehicule?.motorisation ?? null,
          generation: analysis.result?.vehicule?.generation ?? null,
          analysis_id: analysis.id,
        })
        if (!cancelled) setRappels(data)
      } catch (_) {
        if (!cancelled) setRappels(null)
      }
    }
    loadRappels()
    return () => { cancelled = true }
  }, [analysis])

  // Fiche moteur générée en arrière-plan : polling léger jusqu'à son arrivée,
  // puis injection des pannes + points de checklist sans recharger la page.
  useEffect(() => {
    const res = analysis?.result
    if (!res || res.fiche?.cache !== 'pending') return
    const famille = res.vehicule?.famille_moteur
    const marque = res.vehicule?.marque
    if (!famille || !marque) return
    let cancelled = false
    let tries = 0
    const interval = setInterval(async () => {
      tries += 1
      if (tries > 15) { clearInterval(interval); return } // ~2 min max
      try {
        const sheet = await getDefectSheet(marque, famille)
        if (!cancelled && sheet?.pannes?.length > 0) {
          setFicheLive(sheet)
          setFicheInfo(sheet)
          clearInterval(interval)
        }
      } catch (_) { /* on retentera au tick suivant */ }
    }, 8000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [analysis])

  // Pied du bloc pannes : métadonnées de la fiche (nb de sources, date,
  // statut), chargées une fois même quand la fiche était déjà prête.
  useEffect(() => {
    const res = analysis?.result
    const famille = res?.vehicule?.famille_moteur
    const marque = res?.vehicule?.marque
    if (!famille || !marque || res.fiche?.cache === 'pending') return
    let cancelled = false
    getDefectSheet(marque, famille)
      .then(sheet => { if (!cancelled && sheet) setFicheInfo(sheet) })
      .catch(() => { /* pied de bloc simplement absent */ })
    return () => { cancelled = true }
  }, [analysis])

  const handleShare = async () => {
    const url = `${window.location.origin}/a/${id}`
    trackEvent('share_clicked', id)
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Dossier Inspexo', url })
      } else {
        await navigator.clipboard.writeText(url)
        setShareDone(true)
        setTimeout(() => setShareDone(false), 2500)
      }
    } catch (_) { /* partage annulé */ }
  }

  /* ---------- États intermédiaires ---------- */
  if (notFound || loadError) {
    return (
      <>
        <Navbar />
        <main>
          <section className="sec" style={{ borderTop: 'none', minHeight: '60vh' }}>
            <div className="wrap-doc" style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: 30 }}>
                {notFound ? 'Dossier introuvable' : 'Erreur de chargement'}
              </h1>
              <p className="c-ink2" style={{ margin: '14px 0 24px' }}>
                {notFound
                  ? 'Ce lien ne correspond à aucune analyse. Il a peut-être été mal copié.'
                  : 'Impossible de charger cette analyse. Vérifiez votre connexion et réessayez.'}
              </p>
              <Link to="/score" className="btn btn-auto" style={{ width: 'auto', display: 'inline-flex' }}>
                Analyser une annonce
              </Link>
            </div>
          </section>
        </main>
        <Footer />
      </>
    )
  }

  if (!analysis) {
    return (
      <>
        <Navbar />
        <main>
          <section className="sec" style={{ borderTop: 'none', minHeight: '60vh' }}>
            <div className="wrap-doc">
              <p className="eyebrow" aria-busy="true">Lecture du dossier…</p>
            </div>
          </section>
        </main>
      </>
    )
  }

  /* ---------- Rendu principal ---------- */
  const r = analysis.result
  const enErreur = r.etape === 'erreur'
  const enCours = r.statut_analyse === 'en_cours' && !enErreur
  const vh = r.vehicule || {}
  const vehiculeLabel = [analysis.marque, analysis.modele].filter(Boolean).join(' ') || 'Véhicule non identifié'
  const ogTitle = `Verdict Inspexo : ${r.verdict} — ${vehiculeLabel}`
  const pageUrl = `https://www.inspexo.io/a/${id}`
  const takata = rappels?.takata
  const axes = r.score_detail
    ? ORDRE_AXES.filter(k => r.score_detail[k]).map(k => [k, r.score_detail[k]])
        .concat(Object.entries(r.score_detail).filter(([k]) => !ORDRE_AXES.includes(k)))
    : []

  // Fiche arrivée après coup (génération en arrière-plan) : fusion à l'affichage
  const lower = (x) => String(x || '').toLowerCase()
  const fichePending = r.fiche?.cache === 'pending' && !ficheLive
  const extraPannes = (ficheLive?.pannes || [])
    .filter(p => !(r.pannes_connues || []).some(x => lower(x.titre) === lower(p.titre)))
    .map(p => ({
      titre: p.titre,
      organe: p.organe ?? null,
      symptome: p.symptomes,
      pertinence: null,
      verification_sur_place: null,
      gravite: p.gravite,
      source_statut: ficheLive?.statut === 'validee' ? 'base_inspexo' : 'en_ligne',
      urls: p.url_source || [],
      sources: p.sources || null,
      cout_min_eur: p.cout_indicatif_eur_min ?? null,
      cout_max_eur: p.cout_indicatif_eur_max ?? null,
    }))
  const pannesAffichees = [...(r.pannes_connues || []), ...extraPannes]
  const checklistAffichee = [
    ...(r.checklist_sur_place || []),
    ...extraPannes.map(p => ({
      quoi: `Écoutez et observez : ${p.titre}`,
      comment: 'Sur place : démarrage à froid puis essai routier — guettez ce symptôme ; demandez la facture si l\'organe a déjà été remplacé.',
      signal_rouge: String(p.symptome || '').slice(0, 180),
    })),
  ]

  const checklistText = checklistAffichee
    .map((c, i) => `${i + 1}. ${c.quoi}\n   Comment : ${c.comment}\n   Signal rouge : ${c.signal_rouge}`)
    .join('\n')

  /* ----- Registre des sources numérotées (ordre d'apparition) ----- */
  const registre = creerRegistreSources()
  const numsBaseInspexo = () => [registre.register(
    'base-inspexo',
    'Base Inspexo — fiche moteur relue avant publication.',
  )]
  const numsPourPanne = (p) => {
    if (p.source_statut === 'base_inspexo') return numsBaseInspexo()
    const nums = []
    for (const u of (p.urls || []).slice(0, 3)) {
      const title = (p.sources || []).find(s => s && s.url === u)?.title || null
      nums.push(registre.register(u, libelleSource(u, title), u))
    }
    return nums
  }
  // Pré-enregistrement dans l'ordre du dossier : motifs (via pannes), puis le
  // reste au fil du rendu. registrePanneParIndex garde la correspondance.
  const numsPanneParIndex = pannesAffichees.map(() => null)
  const registrePanne = (i) => {
    if (!numsPanneParIndex[i]) numsPanneParIndex[i] = numsPourPanne(pannesAffichees[i])
    return numsPanneParIndex[i]
  }
  const refsMotifs = (r.raisons_principales || []).map(m => refsPourTexte(m, pannesAffichees, registrePanne))

  let refTakata = null
  if (takata?.source) {
    refTakata = registre.register(
      takata.source,
      `Ministère de la Transition écologique, liste Takata${takata.liste_date ? ` du ${takata.liste_date}` : ''}.`,
      takata.source,
    )
  }
  let refRappelConso = null
  if (rappels && rappels.rappels !== null) {
    refRappelConso = registre.register(
      'rappelconso',
      `RappelConso, data.economie.gouv.fr${rappels.fetched_at ? `, vérifié le ${new Date(rappels.fetched_at).toLocaleDateString('fr-FR')}` : ''}. Couvre les rappels publiés depuis avril 2021.`,
      'https://rappel.conso.gouv.fr',
    )
  }
  const refsRappels = (rappels?.rappels || []).map(rap =>
    rap.lien ? registre.register(rap.lien, `RappelConso, fiche ${rap.titre ? `« ${rap.titre} »` : 'officielle'}${rap.date ? `, ${new Date(rap.date).toLocaleDateString('fr-FR')}` : ''}.`, rap.lien) : null,
  )
  let refHistovec = null
  if (r.cadre_juridique) {
    refHistovec = registre.register(
      'histovec',
      'HistoVec, ministère de l\'Intérieur — historique officiel du véhicule.',
      r.cadre_juridique.histovec_url || 'https://histovec.interieur.gouv.fr',
    )
  }

  const numero = formatRef(analysis.refNum, analysis.createdAt)
  const nbEcartees = analysis.claimsDroppedCount

  return (
    <>
      <Helmet>
        <title>{ogTitle}</title>
        <meta name="robots" content="noindex" />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={(r.raisons_principales || []).join(' · ')} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content="https://www.inspexo.io/og-image.png" />
        <meta name="twitter:card" content="summary" />
      </Helmet>

      <Navbar />

      <main>
        <div className="wrap-doc" style={{ padding: '28px 16px 64px' }}>

          {/* Annonce modifiée depuis la dernière analyse */}
          {r.analyse_precedente && (
            <div className="alert">
              <strong>Annonce modifiée depuis la dernière analyse.</strong>{' '}
              Score précédent {r.analyse_precedente.score}/100 ({VERDICT_LABELS[r.analyse_precedente.verdict] ?? r.analyse_precedente.verdict})
              {' '}le {new Date(r.analyse_precedente.date).toLocaleDateString('fr-FR')} → nouveau score {r.score}/100.
              {(r.analyse_precedente.changements || []).length > 0 && (
                <div className="c-ink2" style={{ marginTop: 4 }}>
                  Changements : {r.analyse_precedente.changements.join(' · ')}
                </div>
              )}
            </div>
          )}

          {/* Bandeau analyse limitée */}
          {r.analyse_limitee?.actif && (
            <div className="alert alert-ambre" style={{ fontWeight: 600 }}>
              {r.analyse_limitee.message}
            </div>
          )}

          {/* Synthèse d'une visite déjà faite */}
          {!enCours && <SyntheseVisite synthese={r.visite?.synthese} />}

          {/* ================= LE DOSSIER ================= */}
          <Doc
            numero={numero ? `Dossier n° ${numero}` : 'Dossier Inspexo'}
            date={formatDateDossier(analysis.createdAt)}
            ariaLabel={`Dossier Inspexo, ${vehiculeLabel}`}
          >
            {/* Fiche véhicule */}
            <p className="eyebrow">Véhicule analysé</p>
            <h1 style={{ marginTop: 10, fontSize: 30, letterSpacing: '-0.025em' }}>{vehiculeLabel}</h1>
            {(vh.motorisation || vh.boite) && (
              <p className="sub">{[vh.motorisation, vh.boite].filter(Boolean).join(' · ')}</p>
            )}
            <dl className="specs">
              {analysis.annee != null && <div><dt>Année</dt><dd className="num">{analysis.annee}</dd></div>}
              {vh.kilometrage != null && <div><dt>Kilométrage</dt><dd className="num">{Number(vh.kilometrage).toLocaleString('fr-FR')} km</dd></div>}
              {vh.prix_affiche != null && <div><dt>Prix affiché</dt><dd className="num">{euros1(vh.prix_affiche)}</dd></div>}
              {r.prix?.mediane_comparables != null && (
                <div><dt>Médiane comparables</dt><dd className="num">{euros1(r.prix.mediane_comparables)}</dd></div>
              )}
              {r.statut_vendeur && (
                <div className="wide"><dt>Vendeur</dt><dd>{STATUT_VENDEUR_LABELS[r.statut_vendeur] || r.statut_vendeur}</dd></div>
              )}
            </dl>

            {/* Verdict */}
            <p className="eyebrow" style={{ marginTop: 26 }}>Verdict</p>
            {enCours ? (
              etapeLive === 'timeout' ? (
                <p className="c-ambre" style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6 }}>
                  L'analyse prend plus de temps que prévu. Elle continue en arrière-plan :
                  rechargez cette page dans une minute.
                </p>
              ) : (
                <EtapesProgress etape={etapeLive || r.etape || 'photos_fiche'} />
              )
            ) : enErreur ? (
              <p className="c-rouge" style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6 }}>
                {r.erreur || 'L\'analyse n\'a pas pu aboutir.'}{' '}
                <Link to="/score">Relancer une analyse</Link>
              </p>
            ) : (
              <>
                <Stamp verdict={r.verdict} score={r.score} />
                {r.plafond_raison && (
                  <p className="verdict-line">{r.plafond_raison}</p>
                )}
                {r.verdict_conditionnel && (
                  <p className="mono c-graphite" style={{ marginTop: 12, fontSize: 11, lineHeight: 1.6 }}>
                    Verdict si {r.verdict_conditionnel.condition} :{' '}
                    <strong className={r.verdict_conditionnel.verdict === 'vert' ? 'c-vert' : r.verdict_conditionnel.verdict === 'rouge' ? 'c-rouge' : 'c-ambre'}>
                      {VERDICT_LABELS[r.verdict_conditionnel.verdict] ?? r.verdict_conditionnel.verdict}
                      {' '}{r.verdict_conditionnel.score}/100
                    </strong>
                  </p>
                )}
                {r.verdict_initial && r.verdict_initial.score !== r.score && (
                  <p className="mono c-graphite" style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
                    Verdict recalculé après une visite sur place — verdict initial de l'analyse :{' '}
                    {VERDICT_LABELS[r.verdict_initial.verdict] ?? r.verdict_initial.verdict}{' '}
                    {r.verdict_initial.score}/100 le {new Date(r.verdict_initial.date).toLocaleDateString('fr-FR')}.
                  </p>
                )}
              </>
            )}

            {/* Critères à pointillés (commentaire au déplié) */}
            {axes.length > 0 && (
              <div className="crit" aria-label="Notation par critère">
                {axes.map(([key, axe]) => (
                  <details key={key}>
                    <summary>
                      <span>{AXE_LABELS[key] || key}</span>
                      <span className="leader" aria-hidden="true"></span>
                      {axe.note == null ? (
                        <span className="val na">non évalué</span>
                      ) : (
                        <span className={`val num ${axe.note >= 14 ? 'ok' : axe.note >= 8 ? 'mid' : 'bad'}`}>
                          {String(axe.note).padStart(2, '0')}/20
                        </span>
                      )}
                    </summary>
                    {axe.commentaire && <div className="a">{axe.commentaire}</div>}
                  </details>
                ))}
              </div>
            )}

            {/* Motifs principaux + points rassurants */}
            {(r.raisons_principales || []).length > 0 && (
              <div className="doc-sec">
                <p className="eyebrow">Motifs principaux</p>
                {r.raisons_principales.map((raison, i) => (
                  <div className="motif" key={i}>
                    <span className={`n ${r.verdict === 'vert' ? 'vert' : r.verdict === 'orange' ? 'ambre' : ''}`}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p>{raison}<Ref nums={refsMotifs[i]} /></p>
                  </div>
                ))}
                {(r.points_rassurants || []).length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <p className="eyebrow c-vert" style={{ color: 'var(--vert)' }}>Points rassurants</p>
                    {r.points_rassurants.map((x, i) => (
                      <div className="motif" key={i}>
                        <span className="n vert">+</span>
                        <p className="c-ink2">{x}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Contrôles officiels : Takata, RappelConso, campagnes citées */}
            <div className="doc-sec">
              <p className="eyebrow">Contrôles officiels</p>
              {takata ? (
                <div className="ctrl">
                  <span>Airbags Takata<Ref nums={refTakata} /></span>
                  <span className={`val ${takata.concerne ? 'bad' : 'ok'}`}>
                    {takata.concerne ? 'CONCERNÉ — VÉRIFIER LE VIN' : 'NON CONCERNÉ'}
                  </span>
                </div>
              ) : (
                <div className="ctrl">
                  <span>Airbags Takata</span>
                  <span className="val na c-graphite">{rappels === undefined ? 'VÉRIFICATION…' : 'INDISPONIBLE'}</span>
                </div>
              )}
              {rappels === undefined ? (
                <div className="ctrl">
                  <span>Rappels RappelConso</span>
                  <span className="val na c-graphite">VÉRIFICATION…</span>
                </div>
              ) : rappels === null || rappels.rappels === null ? (
                <div className="ctrl">
                  <span>Rappels RappelConso</span>
                  <span className="val na c-graphite">{analysis.marque && analysis.modele ? 'BASE INDISPONIBLE' : 'VÉHICULE NON IDENTIFIÉ'}</span>
                </div>
              ) : (
                <div className="ctrl">
                  <span>Rappels RappelConso<Ref nums={refRappelConso} /></span>
                  <span className={`val ${rappels.rappels.length > 0 ? 'bad' : ''}`}>
                    {rappels.rappels.length === 0 ? 'AUCUN' : `${rappels.rappels.length} RAPPEL${rappels.rappels.length > 1 ? 'S' : ''}`}
                  </span>
                </div>
              )}
              {takata?.concerne && (
                <p className="c-rouge" style={{ fontSize: 14, lineHeight: 1.6, padding: '10px 0 0' }}>
                  {takata.message}
                  {takata.modele_takata && (
                    <span className="mono c-graphite" style={{ display: 'block', fontSize: 11, marginTop: 4 }}>
                      Modèle listé : {takata.modele_takata} ({takata.periode}){takata.liste_date ? ` · liste du ${takata.liste_date}` : ''}
                    </span>
                  )}
                </p>
              )}
              {takata && !takata.concerne && takata.message && (
                <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.6, padding: '10px 0 0' }}>
                  {takata.message}
                </p>
              )}
              {(rappels?.rappels || []).map((rap, i) => (
                <div className="motif" key={i}>
                  <span className="n ambre">{String(i + 1).padStart(2, '0')}</span>
                  <p>
                    <strong style={{ textTransform: 'capitalize' }}>{rap.titre}</strong>
                    {rap.motif ? ` — ${String(rap.motif).slice(0, 220)}${String(rap.motif).length > 220 ? '…' : ''}` : ''}
                    {rap.risques ? <span className="c-ambre"> {rap.risques.replace(/\|/g, ', ')}.</span> : ''}
                    {rap.date ? <span className="mono c-graphite" style={{ fontSize: 11 }}> {new Date(rap.date).toLocaleDateString('fr-FR')}</span> : ''}
                    <Ref nums={refsRappels[i]} />
                  </p>
                </div>
              ))}
              {(rappels?.autres_rappels || []).length > 0 && (
                <details className="fold">
                  <summary>
                    <span className="pm" aria-hidden="true">+</span>
                    Autres rappels de la gamme ({rappels.autres_rappels.length}) — générations possiblement différentes
                  </summary>
                  <div className="a">
                    {rappels.autres_rappels.map((rap, i) => (
                      <div key={i} style={{ padding: '6px 0' }}>
                        <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{rap.titre}</span>
                        {rap.periode_production ? <span className="c-graphite"> — production {rap.periode_production}</span> : null}
                        {rap.date ? <span className="mono c-graphite" style={{ fontSize: 11 }}> · {new Date(rap.date).toLocaleDateString('fr-FR')}</span> : null}
                        {rap.lien && (
                          <>
                            {' · '}
                            <a href={rap.lien} target="_blank" rel="noopener noreferrer">Fiche officielle</a>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>

            {/* Entretien */}
            {(r.entretien && ((r.entretien.du || []).length > 0 || (r.entretien.prouve || []).length > 0 || (r.entretien.a_exiger || []).length > 0)) && (
              <div className="doc-sec">
                <p className="eyebrow">Entretien</p>
                {(r.entretien.du || []).length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <p className="mono c-graphite" style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', padding: '8px 0 4px' }}>Doit déjà avoir été fait</p>
                    {r.entretien.du.map((op, i) => (
                      <div key={i} className="ctrl">
                        <span>{op.operation}{op.echeance ? ` (dès ${op.echeance})` : ''}</span>
                        {op.critique && <span className="val bad">CRITIQUE</span>}
                      </div>
                    ))}
                  </div>
                )}
                {(r.entretien.prouve || []).length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <p className="mono" style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--vert)', padding: '8px 0 4px' }}>Prouvé ou annoncé dans l'annonce</p>
                    {r.entretien.prouve.map((x, i) => (
                      <div key={i} className="ctrl"><span>{x}</span><span className="val ok">×</span></div>
                    ))}
                  </div>
                )}
                {(r.entretien.a_exiger || []).length > 0 && (
                  <div>
                    <p className="mono" style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ambre)', padding: '8px 0 4px' }}>À exiger avant d'acheter</p>
                    {r.entretien.a_exiger.map((op, i) => (
                      <div key={i} className="motif">
                        <span className="n ambre">{String(i + 1).padStart(2, '0')}</span>
                        <p>
                          <strong>{op.operation}</strong> : {op.demande}
                          {(op.cout_min_eur != null || op.cout_max_eur != null) && (
                            <span className="c-graphite"> (coût indicatif si non fait : {euros(op.cout_min_eur, op.cout_max_eur)})</span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Cadre juridique + HistoVec */}
            {r.cadre_juridique && (
              <div className="doc-sec">
                <p className="eyebrow">Cadre juridique</p>
                <p style={{ fontSize: 15, lineHeight: 1.6, marginTop: 6 }} className="c-ink2">
                  {r.cadre_juridique.texte}
                </p>
                <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 10 }}>
                  {r.cadre_juridique.histovec_conseil || 'Demandez au vendeur le rapport HistoVec gratuit (historique, sinistres, gages).'}{' '}
                  <a href={r.cadre_juridique.histovec_url || 'https://histovec.interieur.gouv.fr'} target="_blank" rel="noopener noreferrer">
                    histovec.interieur.gouv.fr
                  </a>
                  <Ref nums={refHistovec} />
                </p>
              </div>
            )}

            {/* Message vendeur */}
            {r.message_vendeur && (
              <div className="doc-sec">
                <p className="eyebrow">Message au vendeur</p>
                <div className="msg">{r.message_vendeur}</div>
                <CopyButton text={r.message_vendeur} label="Copier le message" />
              </div>
            )}

            {/* Checklist sur place */}
            {checklistAffichee.length > 0 && (
              <div className="doc-sec">
                <p className="eyebrow">Liste de contrôle sur place</p>
                {checklistAffichee.map((c, i) => (
                  <div className="motif" key={i}>
                    <span className="n" style={{ color: 'var(--graphite)' }}>{String(i + 1).padStart(2, '0')}</span>
                    <p>
                      <strong>{c.quoi}</strong>
                      <span className="c-ink2" style={{ display: 'block', fontSize: 14, marginTop: 2 }}>{c.comment}</span>
                      <span className="c-rouge" style={{ display: 'block', fontSize: 14, marginTop: 2 }}>Signal rouge : {c.signal_rouge}</span>
                    </p>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <CopyButton text={`Checklist Inspexo — ${vehiculeLabel}\n\n${checklistText}`} label="Copier la liste" />
                  <button
                    type="button"
                    className="btn-ghost btn-sm btn-auto"
                    onClick={() => {
                      const text = `Checklist Inspexo — ${vehiculeLabel}\n\n${checklistText}`
                      if (navigator.share) navigator.share({ title: 'Checklist Inspexo', text }).catch(() => {})
                      else navigator.clipboard.writeText(text).catch(() => {})
                    }}
                  >
                    Partager la liste
                  </button>
                </div>
              </div>
            )}

            {/* Pannes connues */}
            {(pannesAffichees.length > 0 || fichePending) && (
              <div className="doc-sec">
                <p className="eyebrow">Points de défaillance connus</p>
                {fichePending && (
                  <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.6, padding: '8px 0' }} aria-busy="true">
                    Fiche moteur en préparation (environ 1 minute) — les défauts connus
                    sourcés s'ajouteront ici automatiquement.
                  </p>
                )}
                {pannesAffichees.map((p, i) => {
                  const g = GRAVITE_LABELS[p.gravite] || GRAVITE_LABELS.mineure
                  return (
                    <div key={i} style={{ padding: '14px 0', borderTop: '1px solid var(--rule)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>
                          {p.titre}
                          <Ref nums={registrePanne(i)} />
                        </span>
                        <span className={`tag ${g.classe}`}>{g.label}</span>
                        {p.usure_lointaine && <span className="tag muted">au-delà d'une détention moyenne</span>}
                        {p.rappel_officiel && <span className="tag ambre">{p.rappel_officiel}</span>}
                      </div>
                      {p.usure_lointaine && (
                        <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.6, marginBottom: 6 }}>
                          Usure documentée bien au-delà du kilométrage actuel (plus de 60 000 km de
                          marge) : affichée pour information, sans effet sur la note.
                        </p>
                      )}
                      <p className="c-ink2" style={{ fontSize: 14, lineHeight: 1.6 }}>{p.symptome}</p>
                      {p.pertinence && (
                        <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 6 }}>
                          <strong>Pour ce véhicule :</strong> <span className="c-ink2">{p.pertinence}</span>
                        </p>
                      )}
                      {p.verification_sur_place && (
                        <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 6 }}>
                          <strong>À vérifier sur place :</strong> <span className="c-ink2">{p.verification_sur_place}</span>
                        </p>
                      )}
                      {(p.cout_min_eur != null || p.cout_max_eur != null) && (
                        <p style={{ fontSize: 14, marginTop: 6 }}>
                          <strong>Coût indicatif :</strong> <span className="num">{euros(p.cout_min_eur, p.cout_max_eur)}</span>
                        </p>
                      )}
                      <p className="mono c-graphite" style={{ fontSize: 11, marginTop: 6 }}>
                        {p.source_statut === 'base_inspexo' ? 'source : base Inspexo' : 'sources en ligne, à confirmer sur place'}
                      </p>
                    </div>
                  )
                })}
                {ficheInfo && r.fiche?.famille && (() => {
                  const urlsFiche = new Set()
                  for (const p of (ficheInfo.pannes || [])) {
                    for (const u of (p.url_source || [])) urlsFiche.add(u)
                  }
                  const dateFiche = ficheInfo.updated_at
                    ? new Date(ficheInfo.updated_at).toLocaleDateString('fr-FR')
                    : null
                  if (urlsFiche.size === 0) return null
                  const nAtlas = pannesAffichees.filter(x => x.source_statut === 'base_inspexo').length
                  const nLigne = pannesAffichees.filter(x => x.source_statut !== 'base_inspexo').length
                  const mix = [
                    nAtlas > 0 ? `${nAtlas} panne${nAtlas > 1 ? 's' : ''} base Inspexo` : null,
                    nLigne > 0 ? `${nLigne} panne${nLigne > 1 ? 's' : ''} sources en ligne` : null,
                  ].filter(Boolean).join(', ')
                  return (
                    <p data-testid="fiche-footer" className="mono c-graphite" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--rule)', fontSize: 11, lineHeight: 1.6 }}>
                      Fiche moteur {r.fiche.famille} : {urlsFiche.size} source{urlsFiche.size > 1 ? 's' : ''} vérifiée{urlsFiche.size > 1 ? 's' : ''}
                      {dateFiche ? ` le ${dateFiche}` : ''}{mix ? ` — ${mix}` : ''}
                    </p>
                  )
                })()}
              </div>
            )}

            {/* Marge de négociation */}
            {!enCours && r.negociation && ((r.negociation.postes || []).length > 0 || (r.negociation.arguments_sans_montant || []).length > 0) && (() => {
              const negociation = r.negociation
              const postes = negociation.postes || []
              const sansMontant = negociation.arguments_sans_montant || []
              const visibles = postes.slice(0, 2)
              const masques = postes.length - visibles.length
              const aDetail = masques > 0 || sansMontant.length > 0 || negociation.argumentaire
              return (
                <div className="doc-sec">
                  <p className="eyebrow">Marge de négociation</p>
                  {negociation.total_min_eur != null && (
                    <div style={{ margin: '8px 0 4px' }}>
                      <p className="mono c-graphite" style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                        Arguments chiffrés relevés ({negociation.nb_postes_chiffres} postes)
                      </p>
                      <p className="mono num" style={{ fontSize: 28, fontWeight: 600, marginTop: 2 }}>
                        {euros(negociation.total_min_eur, negociation.total_max_eur)}
                      </p>
                    </div>
                  )}
                  {visibles.map((p, i) => {
                    const numsPoste = (p.urls || []).slice(0, 2).map(u => registre.register(u, libelleSource(u), u))
                    return (
                      <div className="ctrl" key={i} style={{ alignItems: 'baseline' }}>
                        <span>
                          {p.argument}
                          <Ref nums={numsPoste} />
                          <span className="mono c-graphite" style={{ display: 'block', fontSize: 11, marginTop: 2 }}>
                            {p.source_statut === 'valide_devis' ? 'Fourchette confirmée par un devis vérifié'
                              : p.source_statut === 'fiche' ? 'Coût publié pour ce moteur'
                              : 'Fourchette publiée'}
                          </span>
                        </span>
                        <span className="val num">{euros(p.cout_min_eur, p.cout_max_eur)}</span>
                      </div>
                    )
                  })}
                  {postes.length === 0 && sansMontant.slice(0, 2).map((p, i) => (
                    <div className="ctrl" key={i}>
                      <span>{p.argument} <span className="c-graphite">(à faire chiffrer par un garage)</span></span>
                    </div>
                  ))}
                  {aDetail && (
                    <div style={{ position: 'relative', marginTop: 12, overflow: 'hidden', border: '1px solid var(--rule)' }}>
                      <div aria-hidden="true" style={{ filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none', padding: '14px 16px', minHeight: 120 }}>
                        {postes.slice(2).map((p, i) => (
                          <div key={i} className="c-ink2" style={{ fontSize: 14, padding: '6px 0' }}>
                            {p.argument} — {euros(p.cout_min_eur, p.cout_max_eur)}
                          </div>
                        ))}
                        {sansMontant.map((p, i) => (
                          <div key={`s${i}`} className="c-ink2" style={{ fontSize: 14, padding: '6px 0' }}>{p.argument}</div>
                        ))}
                        <div className="c-ink2" style={{ fontSize: 14, padding: '6px 0', whiteSpace: 'pre-wrap' }}>
                          {negociation.argumentaire}
                        </div>
                      </div>
                      <div style={{
                        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px 16px', textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 14, fontWeight: 700, background: 'var(--paper)', border: '1px solid var(--rule-strong)', padding: '8px 12px' }}>
                          {masques + sansMontant.length > 0
                            ? `${masques + sansMontant.length} argument${masques + sansMontant.length > 1 ? 's' : ''} de plus, les sources et l'argumentaire prêt à dire au vendeur : réservés au Pass achat (29 €)`
                            : 'Les sources et l\'argumentaire prêt à dire au vendeur : réservés au Pass achat (29 €)'}
                        </div>
                        <PassCTA analysisId={id} />
                      </div>
                    </div>
                  )}
                  <p className="mono c-graphite" style={{ marginTop: 12, fontSize: 11, lineHeight: 1.6 }}>
                    {negociation.mention}
                  </p>
                </div>
              )
            })()}

            {/* Incohérences */}
            {(r.incoherences || []).length > 0 && (
              <div className="doc-sec">
                <p className="eyebrow" style={{ color: 'var(--ambre)' }}>Incohérences relevées dans l'annonce</p>
                {r.incoherences.map((inc, i) => (
                  <div className="motif" key={i}>
                    <span className="n ambre">{String(i + 1).padStart(2, '0')}</span>
                    <p>{inc}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Ce que montrent les photos */}
            {(r.constats_photo || []).length > 0 && (
              <div className="doc-sec">
                <p className="eyebrow">Ce que montrent les photos</p>
                {r.constats_photo.map((c, i) => (
                  <div className="ctrl" key={i} style={{ alignItems: 'baseline' }}>
                    <span>
                      {c.constat}
                      <span className="mono c-graphite" style={{ fontSize: 11 }}> — photo n°{c.photo_index}</span>
                    </span>
                    <span className={`val ${c.signal === 'rouge' ? 'bad' : c.signal === 'attention' ? 'mid' : 'ok'}`}>
                      {c.signal === 'rouge' ? 'ROUGE' : c.signal === 'attention' ? 'ATTENTION' : 'OK'}
                    </span>
                  </div>
                ))}
                <p className="mono c-graphite" style={{ marginTop: 10, fontSize: 11, lineHeight: 1.6 }}>
                  Constats automatiques sur les photos jointes à l'analyse. Les photos ne sont jamais conservées.
                </p>
              </div>
            )}

            {/* Prix */}
            {!enCours && (
              <div className="doc-sec">
                <p className="eyebrow">Prix</p>
                {r.prix?.fourchette ? (
                  <>
                    <dl className="specs">
                      {vh.prix_affiche != null && <div><dt>Prix affiché</dt><dd className="num">{euros1(vh.prix_affiche)}</dd></div>}
                      <div><dt>P25</dt><dd className="num">{euros1(r.prix.fourchette.p25)}</dd></div>
                      <div><dt>Médiane</dt><dd className="num">{euros1(r.prix.fourchette.mediane)}</dd></div>
                      <div><dt>P75</dt><dd className="num">{euros1(r.prix.fourchette.p75)}</dd></div>
                    </dl>
                    <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.6, marginTop: 10 }}>
                      {r.prix.fourchette.libelle}
                      <br />Provenance : {r.prix.fourchette.provenance}.
                    </p>
                  </>
                ) : vh.prix_affiche != null || r.prix?.mediane_comparables != null ? (
                  <dl className="specs">
                    {vh.prix_affiche != null && <div><dt>Prix affiché</dt><dd className="num">{euros1(vh.prix_affiche)}</dd></div>}
                    {r.prix?.mediane_comparables != null && <div><dt>Médiane comparables</dt><dd className="num">{euros1(r.prix.mediane_comparables)}</dd></div>}
                  </dl>
                ) : null}
                {r.prix?.commentaire ? (
                  <p className="c-ink2" style={{ fontSize: 14, lineHeight: 1.6, marginTop: 10 }}>{r.prix.commentaire}</p>
                ) : !r.prix?.fourchette ? (
                  <p className="c-ink2" style={{ fontSize: 14, lineHeight: 1.6, marginTop: 10 }}>
                    Collez 3 annonces comparables (même modèle, année proche) lors de l'analyse pour situer le prix.
                    Sans comparables, aucune estimation n'est avancée.
                  </p>
                ) : null}
              </div>
            )}

            {/* Budget 12 mois */}
            {(r.budget_12_mois || []).length > 0 && (
              <div className="doc-sec">
                <p className="eyebrow">Budget prévisible sur 12 mois</p>
                {r.budget_12_mois.map((b, i) => (
                  <div className="ctrl" key={i}>
                    <span>{b.poste}</span>
                    <span className="val num">{euros(b.cout_min_eur, b.cout_max_eur)}</span>
                  </div>
                ))}
                <p className="mono c-graphite" style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
                  Uniquement des coûts chiffrés par les sources (base Inspexo ou sources en ligne). Fourchettes indicatives, hors entretien courant.
                </p>
              </div>
            )}

            {/* Sources numérotées */}
            <Footnotes sources={registre.liste} />

            {/* Pied de dossier : affirmations écartées + avertissement */}
            <div className="doc-foot" data-testid="rigor-banner">
              {!enCours && !enErreur && nbEcartees != null && (
                nbEcartees === 0 ? (
                  <span>Toutes les affirmations sont sourcées. </span>
                ) : (
                  <span>{nbEcartees} affirmation{nbEcartees > 1 ? 's' : ''} écartée{nbEcartees > 1 ? 's' : ''} faute de source. </span>
                )
              )}
              {r.avertissement}
              {!enCours && !enErreur && nbEcartees > 0 && (analysis.claimsDropped || []).length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer', listStyle: 'none', minHeight: 24 }}>
                    Voir ce qui a été écarté +
                  </summary>
                  {analysis.claimsDropped.map((c, i) => (
                    <div key={i} style={{ padding: '8px 0', borderTop: '1px solid var(--rule)' }}>
                      <div style={{ color: 'var(--ink)', fontWeight: 600 }}>{cleanClaimText(c.texte)}</div>
                      <div style={{ marginTop: 2 }}>{publicReason(c.justification)}</div>
                    </div>
                  ))}
                </details>
              )}
            </div>
          </Doc>

          {/* ================= ACTIONS ================= */}
          {!enCours && !enErreur && r.type === 'vehicule' && (
            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'stretch' }}>
                <Link
                  to={`/a/${id}/visite`}
                  onClick={() => trackEvent('visite_started', id)}
                  className="btn"
                  style={{ flex: '1 1 200px', width: 'auto' }}
                >
                  Je suis devant la voiture
                </Link>
                <DossierButton analysisId={id} />
              </div>
              <p className="mono c-graphite" style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
                Mode visite guidé (liste de contrôle pas à pas, photos analysées sur place) — fonction du
                Pass achat, en démo libre pendant le lancement. Les photos ne sont jamais conservées.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button type="button" onClick={handleShare} className="btn-ghost" style={{ flex: '1 1 140px', width: 'auto' }}>
              {shareDone ? 'Lien copié' : 'Partager'}
            </button>
            <Link to="/score" className="btn-ghost" style={{ flex: '1 1 140px', width: 'auto' }}>
              Analyser une autre annonce
            </Link>
          </div>

          {/* Feedback + emails */}
          {!enCours && (
            <>
              <div style={{ borderTop: '1px solid var(--rule-strong)', marginTop: 28, paddingTop: 22 }}>
                <VerdictFeedback analysisId={id} />
              </div>
              <div style={{ borderTop: '1px solid var(--rule)', marginTop: 22, paddingTop: 18 }}>
                <EmailCapture
                  title="Recevoir ce rapport par email"
                  buttonLabel="Recevoir"
                  source="rapport"
                  analysisId={id}
                />
              </div>
              <div style={{ borderTop: '1px solid var(--rule)', marginTop: 18, paddingTop: 18 }}>
                <EmailCapture
                  title="Le Pass achat arrive : accompagnement complet jusqu'à la signature. Être prévenu du lancement ?"
                  buttonLabel="Être prévenu"
                  source="pass_waitlist"
                  analysisId={id}
                />
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </>
  )
}
