import React, { useEffect, useState } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { supabase } from '../lib/supabaseClient'
import {
  getPublicAnalysis, getAnalysisEtape, fetchRappels, getDefectSheet,
  submitLead, trackEvent, dossierAdd, envoyerLienMagique,
} from '../lib/scoreApi'

const VERDICT_STYLE = {
  vert:   { color: '#16A34A', bg: '#F0FDF4', border: 'rgba(22,163,74,0.3)',  label: 'Feu vert' },
  orange: { color: '#D97706', bg: '#FFFBEB', border: 'rgba(217,119,6,0.3)',  label: 'Prudence' },
  rouge:  { color: '#DC2626', bg: '#FEF2F2', border: 'rgba(220,38,38,0.3)',  label: 'Signaux rouges' },
}

const GRAVITE_STYLE = {
  securite: { label: 'Sécurité', color: '#DC2626', bg: '#FEF2F2' },
  casse:    { label: 'Casse moteur/boîte', color: '#B91C1C', bg: '#FEF2F2' },
  majeure:  { label: 'Majeure',  color: '#D97706', bg: '#FFFBEB' },
  mineure:  { label: 'Mineure',  color: '#6B7280', bg: '#F0F2F5' },
}

const AXE_LABELS = {
  prix: 'Prix',
  kilometrage_age: 'Kilométrage et âge',
  historique_entretien: 'Historique et entretien',
  risques_mecaniques: 'Risques mécaniques connus',
  vendeur_cadre: 'Vendeur et cadre juridique',
}

const STATUT_VENDEUR_LABELS = {
  particulier: 'Particulier',
  pro: 'Professionnel',
  intermediaire_pour_particulier: 'Intermédiaire pour particulier',
  pro_deguise_probable: 'Professionnel déguisé probable',
}

const CONSENT_TEXT = 'En laissant votre email, vous acceptez d\'être recontacté par Inspexo à ce sujet. Lien de désinscription dans chaque email.'

const FONT = 'Plus Jakarta Sans, sans-serif'
const FONT_TITRE = 'Syne, sans-serif'

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
function CopyButton({ text, label = 'Copier', style }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 2000)
        } catch (_) { /* clipboard indisponible */ }
      }}
      style={{
        background: '#0F1B2D', color: '#fff', border: 'none', borderRadius: 8,
        padding: '9px 16px', fontFamily: FONT, fontSize: '0.8125rem',
        fontWeight: 700, cursor: 'pointer', ...style,
      }}
    >
      {done ? 'Copié' : label}
    </button>
  )
}

/** Libellé lisible d'une URL source : domaine + titre dérivé du chemin.
 *  Rien n'est inventé : tout provient de l'URL elle-même. */
function sourceLinkLabel(u) {
  try {
    const url = new URL(u)
    const domain = url.hostname.replace(/^www\./, '')
    const segment = decodeURIComponent(
      (url.pathname.split('/').filter(Boolean).pop() || ''),
    )
      .replace(/\.(html?|php|pdf|aspx?|jsp)$/i, '')
      .replace(/[-_+]+/g, ' ')
      .trim()
    if (!segment || /^(index|default)$/i.test(segment)) return domain
    const title = segment.length > 60 ? `${segment.slice(0, 57)}…` : segment
    return `${domain} — ${title}`
  } catch (_) {
    return u
  }
}

function SourceLabel({ statut, urls, sources }) {
  if (statut === 'base_inspexo') {
    return (
      <span style={{
        fontFamily: FONT, fontSize: '0.6875rem', fontWeight: 600,
        color: '#1E4D8C', background: 'rgba(30,77,140,0.08)',
        borderRadius: 100, padding: '2px 10px',
      }}>
        source : base Inspexo
      </span>
    )
  }
  // Titre HTML réel quand il est stocké ; sinon libellé dérivé de l'URL.
  const titleByUrl = new Map((sources || []).filter(s => s && s.url).map(s => [s.url, s.title]))
  const label = (u) => {
    const title = titleByUrl.get(u)
    if (!title) return sourceLinkLabel(u)
    try {
      const domain = new URL(u).hostname.replace(/^www\./, '')
      const t = title.length > 90 ? `${title.slice(0, 87)}…` : title
      return `${domain} — ${t}`
    } catch (_) { return sourceLinkLabel(u) }
  }
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
      <span style={{
        fontFamily: FONT, fontSize: '0.6875rem', fontWeight: 600,
        color: '#6B7280', background: '#F0F2F5', borderRadius: 100, padding: '2px 10px',
      }}>
        sources en ligne, à confirmer sur place
      </span>
      {(urls || []).slice(0, 3).map((u, i) => (
        <a key={i} href={u} target="_blank" rel="noopener noreferrer" style={{
          fontFamily: FONT, fontSize: '0.75rem', color: '#1E4D8C',
          wordBreak: 'break-word', lineHeight: 1.4,
        }}>
          {label(u)}
        </a>
      ))}
    </span>
  )
}

/** Texte d'un claim écarté : on retire les marqueurs internes de la critique
 *  ("[en ligne]", "— pertinence : …", "— sources : …") pour l'affichage. */
function cleanClaimText(t) {
  return String(t || '')
    .split(/ — (?:pertinence|à vérifier|sources) :/)[0]
    .replace(/\s*\[(?:base Inspexo|en ligne)\]/g, '')
    .trim()
}

/** Raison d'écartement en langage acheteur : mapping fixe par type de raison,
 *  jamais la justification brute de la critique, jamais d'appel IA. */
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

/** Bandeau de rigueur : affirmations écartées par l'appel critique. */
function RigorBanner({ count, items }) {
  if (count == null) return null
  const base = {
    borderRadius: 12, padding: '12px 16px', marginBottom: 14,
    fontFamily: FONT, fontSize: '0.875rem',
  }
  if (count === 0) {
    return (
      <div data-testid="rigor-banner" style={{
        ...base, background: 'rgba(30,77,140,0.06)',
        border: '1.5px solid rgba(30,77,140,0.2)', color: '#1E4D8C', fontWeight: 600,
      }}>
        Toutes les affirmations sont sourcées
      </div>
    )
  }
  const label = count === 1
    ? '1 affirmation écartée faute de source'
    : `${count} affirmations écartées faute de source`
  return (
    <details data-testid="rigor-banner" style={{
      ...base, background: 'rgba(30,77,140,0.06)',
      border: '1.5px solid rgba(30,77,140,0.2)', color: '#1E4D8C',
    }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600, listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="rigor-chevron" style={{ fontSize: '0.65rem', transition: 'transform 0.15s', display: 'inline-block' }}>▸</span>
        {label}
      </summary>
      {items.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          {items.map((c, i) => (
            <div key={i} style={{
              padding: '8px 0', borderTop: '1px solid rgba(30,77,140,0.12)',
              fontSize: '0.8125rem', lineHeight: 1.5,
            }}>
              <div style={{ color: '#0F1B2D', fontWeight: 600 }}>{cleanClaimText(c.texte)}</div>
              <div style={{ color: '#6B7280', marginTop: 2 }}>{publicReason(c.justification)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 10, fontSize: '0.8125rem', color: '#6B7280' }}>
          Le détail de ces affirmations n'est pas disponible sur cette page.
        </div>
      )}
    </details>
  )
}

function EmailCapture({ title, buttonLabel, source, analysisId }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState('idle')
  const submit = async (e) => {
    e.preventDefault()
    if (!email || state === 'sending') return
    setState('sending')
    try { await submitLead(email, source, analysisId); setState('done') } catch (_) { setState('error') }
  }
  if (state === 'done') {
    return (
      <div style={{ fontFamily: FONT, fontSize: '0.875rem', fontWeight: 600, color: '#16A34A', padding: '10px 0' }}>
        C'est noté. Vous recevrez un email à cette adresse.
      </div>
    )
  }
  return (
    <form onSubmit={submit}>
      <div style={{ fontFamily: FONT, fontSize: '0.875rem', fontWeight: 600, color: '#0F1B2D', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="email" required placeholder="votre@email.com"
          value={email} onChange={e => setEmail(e.target.value)}
          style={{
            flex: '1 1 180px', boxSizing: 'border-box',
            border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 8,
            padding: '11px 14px', fontSize: 16, fontFamily: FONT, outline: 'none',
          }}
        />
        <button type="submit" disabled={state === 'sending'} style={{
          background: '#0F1B2D', color: '#fff', border: 'none',
          borderRadius: 8, padding: '11px 18px', cursor: 'pointer',
          fontFamily: FONT, fontSize: '0.875rem', fontWeight: 700, whiteSpace: 'nowrap',
          opacity: state === 'sending' ? 0.6 : 1,
        }}>
          {state === 'sending' ? '…' : buttonLabel}
        </button>
      </div>
      {state === 'error' && (
        <div style={{ fontFamily: FONT, fontSize: '0.8125rem', color: '#DC2626', marginTop: 6 }}>
          Email invalide ou erreur réseau — réessayez.
        </div>
      )}
      <div style={{ marginTop: 8, fontFamily: FONT, fontSize: '0.6875rem', color: '#9CA3AF', lineHeight: 1.5 }}>
        {CONSENT_TEXT}
      </div>
    </form>
  )
}

function SectionTitle({ children }) {
  return (
    <h2 style={{ fontFamily: FONT_TITRE, fontWeight: 800, fontSize: '1.0625rem', color: '#0F1B2D', margin: '0 0 14px' }}>
      {children}
    </h2>
  )
}

function Card({ children, style }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      border: '1.5px solid rgba(0,0,0,0.07)',
      padding: '22px 20px', marginBottom: 14,
      ...style,
    }}>
      {children}
    </div>
  )
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
    <div style={{ marginTop: 14 }}>
      {ETAPES_PIPELINE.map((e, i) => (
        <div key={e.cle} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0',
          fontFamily: FONT, fontSize: '0.875rem',
          color: i < idx ? '#16A34A' : i === idx ? '#0F1B2D' : '#C3C9D2',
          fontWeight: i === idx ? 600 : 400,
        }}>
          <span style={{ width: 18, textAlign: 'center' }}>
            {i < idx ? '✓' : i === idx ? (
              <span style={{
                display: 'inline-block', width: 11, height: 11,
                border: '2px solid #FF4D00', borderTopColor: 'transparent',
                borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              }} />
            ) : '·'}
          </span>
          {e.label}
        </div>
      ))}
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      <div style={{ fontFamily: FONT, fontSize: '0.75rem', color: '#9CA3AF', marginTop: 8, lineHeight: 1.5 }}>
        Le score final s'affiche une fois chaque affirmation vérifiée — en attendant,
        les rappels, le bloc Takata et le cadre juridique ci-dessous sont déjà exploitables.
      </div>
    </div>
  )
}

/* ---------- Marge de négociation ---------- */
function euros(min, max) {
  const fr = (n) => Number(n).toLocaleString('fr-FR')
  if (min != null && max != null && min !== max) return `${fr(min)} – ${fr(max)} €`
  const seul = min ?? max
  return seul != null ? `${fr(seul)} €` : ''
}

function NegotiationCard({ negociation, analysisId }) {
  if (!negociation) return null
  const postes = negociation.postes || []
  const sansMontant = negociation.arguments_sans_montant || []
  if (postes.length === 0 && sansMontant.length === 0) return null
  const visibles = postes.slice(0, 2)
  const masques = postes.length - visibles.length
  const aDetail = masques > 0 || sansMontant.length > 0 || negociation.argumentaire

  return (
    <Card style={{ borderColor: 'rgba(30,77,140,0.35)' }}>
      <SectionTitle>Marge de négociation</SectionTitle>
      {negociation.total_min_eur != null && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: FONT, fontSize: '0.6875rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' }}>
            Arguments chiffrés relevés ({negociation.nb_postes_chiffres} postes)
          </div>
          <div style={{ fontFamily: FONT_TITRE, fontWeight: 800, fontSize: '1.625rem', color: '#1E4D8C' }}>
            {euros(negociation.total_min_eur, negociation.total_max_eur)}
          </div>
        </div>
      )}
      {visibles.map((p, i) => (
        <div key={i} style={{ padding: '9px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', gap: 12,
            fontFamily: FONT, fontSize: '0.875rem', color: '#374151', lineHeight: 1.5,
          }}>
            <span>{p.argument}</span>
            <span style={{ fontWeight: 700, whiteSpace: 'nowrap', color: '#1E4D8C' }}>{euros(p.cout_min_eur, p.cout_max_eur)}</span>
          </div>
          <div style={{ marginTop: 3, fontFamily: FONT, fontSize: '0.6875rem', color: '#9CA3AF', lineHeight: 1.5 }}>
            {p.source_statut === 'valide_devis' ? 'Fourchette confirmée par un devis vérifié'
              : p.source_statut === 'fiche' ? 'Coût publié pour ce moteur'
              : 'Fourchette publiée'}
            {(p.urls || []).slice(0, 2).map((u, j) => (
              <span key={j}>
                {' · '}
                <a href={u} target="_blank" rel="noopener noreferrer" style={{ color: '#1E4D8C' }}>
                  {sourceLinkLabel(u)}
                </a>
              </span>
            ))}
          </div>
        </div>
      ))}
      {postes.length === 0 && sansMontant.slice(0, 2).map((p, i) => (
        <div key={i} style={{
          padding: '9px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none',
          fontFamily: FONT, fontSize: '0.875rem', color: '#374151', lineHeight: 1.5,
        }}>
          {p.argument} <span style={{ color: '#9CA3AF' }}>(à faire chiffrer par un garage)</span>
        </div>
      ))}

      {aDetail && (
        <div style={{ position: 'relative', marginTop: 12, borderRadius: 12, overflow: 'hidden' }}>
          <div aria-hidden="true" style={{
            filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none',
            padding: '14px 16px', background: '#F8F9FA', minHeight: 120,
          }}>
            {postes.slice(2).map((p, i) => (
              <div key={i} style={{ fontFamily: FONT, fontSize: '0.875rem', color: '#374151', padding: '6px 0' }}>
                {p.argument} — {euros(p.cout_min_eur, p.cout_max_eur)}
              </div>
            ))}
            {sansMontant.map((p, i) => (
              <div key={`s${i}`} style={{ fontFamily: FONT, fontSize: '0.875rem', color: '#374151', padding: '6px 0' }}>
                {p.argument}
              </div>
            ))}
            <div style={{ fontFamily: FONT, fontSize: '0.875rem', color: '#374151', padding: '6px 0', whiteSpace: 'pre-wrap' }}>
              {negociation.argumentaire}
            </div>
          </div>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'rgba(255,255,255,0.55)', padding: '14px 16px', textAlign: 'center',
          }}>
            <div style={{ fontFamily: FONT, fontSize: '0.875rem', fontWeight: 700, color: '#0F1B2D' }}>
              {masques + sansMontant.length > 0
                ? `${masques + sansMontant.length} argument${masques + sansMontant.length > 1 ? 's' : ''} de plus, les sources et l'argumentaire prêt à dire au vendeur : réservés au Pass achat (29 €)`
                : 'Les sources et l\'argumentaire prêt à dire au vendeur : réservés au Pass achat (29 €)'}
            </div>
            <PassCTA analysisId={analysisId} />
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, fontFamily: FONT, fontSize: '0.75rem', color: '#92400E', lineHeight: 1.5 }}>
        {negociation.mention}
      </div>
    </Card>
  )
}

/** CTA Pass achat : la précommande n'est pas en ligne → capteur « Être prévenu ». */
function PassCTA({ analysisId }) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        background: '#FF4D00', color: '#fff', border: 'none', borderRadius: 10,
        padding: '11px 20px', fontFamily: FONT, fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
      }}>
        Être prévenu du lancement
      </button>
    )
  }
  return (
    <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 12, padding: '12px 14px', border: '1.5px solid rgba(0,0,0,0.08)', textAlign: 'left' }}>
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
      await envoyerLienMagique(email, `/a/${analysisId}?dossier=1`)
      setEtat('lien_envoye')
    } catch (_) {
      setEtat('erreur')
    }
  }

  if (etat === 'fait') {
    return (
      <div style={{ fontFamily: FONT, fontSize: '0.875rem', fontWeight: 600, color: '#16A34A' }}>
        Ajouté à votre dossier — <Link to="/dossier" style={{ color: '#1E4D8C' }}>voir mon dossier d'achat</Link>
      </div>
    )
  }
  if (etat === 'lien_envoye') {
    return (
      <div style={{ fontFamily: FONT, fontSize: '0.875rem', color: '#16A34A', fontWeight: 600, lineHeight: 1.5 }}>
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
            style={{
              flex: '1 1 180px', boxSizing: 'border-box', border: '1.5px solid rgba(0,0,0,0.12)',
              borderRadius: 8, padding: '11px 14px', fontSize: 16, fontFamily: FONT, outline: 'none',
            }}
          />
          <button type="submit" disabled={etat === 'sending'} style={{
            background: '#0F1B2D', color: '#fff', border: 'none', borderRadius: 8,
            padding: '11px 16px', fontFamily: FONT, fontSize: '0.875rem', fontWeight: 700,
            cursor: 'pointer', opacity: etat === 'sending' ? 0.6 : 1,
          }}>
            {etat === 'sending' ? '…' : 'Recevoir le lien'}
          </button>
        </div>
        <div style={{ marginTop: 6, fontFamily: FONT, fontSize: '0.6875rem', color: '#9CA3AF', lineHeight: 1.5 }}>
          Connexion par lien magique, sans mot de passe. {CONSENT_TEXT}
        </div>
      </form>
    )
  }
  return (
    <button onClick={clic} style={{
      flex: '1 1 140px', background: 'transparent', color: '#0F1B2D',
      border: '1.5px solid rgba(15,27,45,0.25)', borderRadius: 10, padding: '12px 16px',
      fontFamily: FONT, fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
    }}>
      {etat === 'erreur' ? 'Réessayer l\'ajout au dossier' : etat === 'ajout' ? '…' : 'Suivre dans mon dossier'}
    </button>
  )
}

/* ---------- Synthèse du mode visite ---------- */
const DECISION_STYLE = {
  acheter: { label: 'Acheter', color: '#16A34A', bg: '#F0FDF4' },
  negocier: { label: 'Négocier', color: '#D97706', bg: '#FFFBEB' },
  ne_pas_acheter: { label: 'Ne pas acheter', color: '#DC2626', bg: '#FEF2F2' },
}

function SyntheseVisite({ synthese }) {
  if (!synthese) return null
  const s = DECISION_STYLE[synthese.decision] || DECISION_STYLE.negocier
  return (
    <div style={{
      background: s.bg, border: `1.5px solid ${s.color}44`, borderRadius: 14,
      padding: '16px 18px', marginBottom: 14,
    }}>
      {synthese.incomplete && (
        <div style={{ fontFamily: FONT, fontSize: '0.8125rem', fontWeight: 700, color: '#92400E', marginBottom: 6 }}>
          Visite incomplète : {synthese.non_verifies} point{synthese.non_verifies > 1 ? 's' : ''} non vérifié{synthese.non_verifies > 1 ? 's' : ''}.
        </div>
      )}
      <div style={{ fontFamily: FONT_TITRE, fontWeight: 800, fontSize: '0.9375rem', color: s.color, marginBottom: 6 }}>
        Synthèse de votre visite : {synthese.sur_points_verifies ? 'sur les points vérifiés, ' : ''}{s.label}
      </div>
      {(synthese.points || []).map((p, i) => (
        <div key={i} style={{ fontFamily: FONT, fontSize: '0.8125rem', color: '#374151', lineHeight: 1.6 }}>
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
      <div style={{ fontFamily: FONT, fontSize: '0.875rem', color: '#16A34A', fontWeight: 600, textAlign: 'center' }}>
        Merci pour votre retour.
      </div>
    )
  }
  const btn = {
    background: '#fff', color: '#0F1B2D', border: '1.5px solid rgba(0,0,0,0.15)',
    borderRadius: 8, padding: '10px 26px', fontFamily: FONT,
    fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
  }
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: FONT, fontSize: '0.9375rem', fontWeight: 600, color: '#0F1B2D', marginBottom: 12 }}>
        Ce verdict vous a aidé ?
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button style={btn} onClick={() => { trackEvent('verdict_feedback', analysisId, { helpful: true }); setSent(true) }}>Oui</button>
        <button style={btn} onClick={() => { trackEvent('verdict_feedback', analysisId, { helpful: false }); setSent(true) }}>Non</button>
      </div>
    </div>
  )
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
        await navigator.share({ title: 'Verdict Inspexo', url })
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
        <main style={{ background: '#F8F9FA', minHeight: '100vh', padding: '140px 24px' }}>
          <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
            <h1 style={{ fontFamily: FONT_TITRE, fontWeight: 800, fontSize: '1.5rem', color: '#0F1B2D', marginBottom: 12 }}>
              {notFound ? 'Analyse introuvable' : 'Erreur de chargement'}
            </h1>
            <p style={{ fontFamily: FONT, color: '#6B7280', marginBottom: 24 }}>
              {notFound
                ? 'Ce lien ne correspond à aucune analyse. Il a peut-être été mal copié.'
                : 'Impossible de charger cette analyse. Vérifiez votre connexion et réessayez.'}
            </p>
            <Link to="/score" style={{
              display: 'inline-block', background: '#FF4D00', color: '#fff',
              borderRadius: 10, padding: '13px 26px', textDecoration: 'none',
              fontFamily: FONT, fontWeight: 700, fontSize: '0.9375rem',
            }}>
              Analyser une annonce
            </Link>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  if (!analysis) {
    return (
      <>
        <Navbar />
        <main style={{ background: '#F8F9FA', minHeight: '100vh', padding: '160px 24px', textAlign: 'center' }}>
          <div style={{
            display: 'inline-block', width: 28, height: 28,
            border: '3px solid #FF4D00', borderTopColor: 'transparent',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
          }} />
          <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
        </main>
      </>
    )
  }

  /* ---------- Rendu principal ---------- */
  const r = analysis.result
  const enErreur = r.etape === 'erreur'
  const enCours = r.statut_analyse === 'en_cours' && !enErreur
  const vs = enCours
    ? { color: '#1E4D8C', bg: '#fff', border: 'rgba(0,0,0,0.08)', label: 'Analyse en cours' }
    : enErreur
    ? { color: '#DC2626', bg: '#fff', border: 'rgba(220,38,38,0.25)', label: 'Analyse interrompue' }
    : (VERDICT_STYLE[r.verdict] || VERDICT_STYLE.orange)
  const vh = r.vehicule || {}
  const vehiculeLabel = [analysis.marque, analysis.modele].filter(Boolean).join(' ') || 'Véhicule non identifié'
  const ogTitle = `Verdict Inspexo : ${r.verdict} — ${vehiculeLabel}`
  const pageUrl = `https://www.inspexo.io/a/${id}`
  const takata = rappels?.takata
  const axes = r.score_detail ? Object.entries(r.score_detail) : []

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

      <style>{`
        details.axe-detail summary { cursor: pointer; list-style: none; }
        details.axe-detail summary::-webkit-details-marker { display: none; }
        details.axe-detail[open] .axe-chevron { transform: rotate(90deg); }
        details[data-testid="rigor-banner"] summary::-webkit-details-marker { display: none; }
        details[data-testid="rigor-banner"][open] .rigor-chevron { transform: rotate(90deg); }
      `}</style>

      <Navbar />

      <main style={{ background: '#F8F9FA', minHeight: '100vh' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '92px 16px 64px' }}>

          {/* ========== 1. VERDICT + 5 AXES ========== */}
          <div style={{
            background: vs.bg, border: `1.5px solid ${vs.border}`,
            borderRadius: 18, padding: '26px 22px', marginBottom: 14,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap',
            }}>
              <div>
                <div style={{
                  fontFamily: FONT, fontSize: '0.75rem', fontWeight: 600, color: '#6B7280',
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
                }}>
                  Verdict Inspexo
                </div>
                <h1 style={{
                  fontFamily: FONT_TITRE, fontWeight: 800,
                  fontSize: 'clamp(1.5rem, 5.5vw, 2rem)', color: vs.color,
                  margin: 0, lineHeight: 1.1, display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  {!enCours && (
                    <span style={{
                      width: 16, height: 16, borderRadius: '50%',
                      background: vs.color, display: 'inline-block', flexShrink: 0,
                    }} />
                  )}
                  {vs.label}
                </h1>
                <div style={{ fontFamily: FONT, fontSize: '0.9375rem', fontWeight: 600, color: '#0F1B2D', marginTop: 8 }}>
                  {vehiculeLabel}
                  {vh.motorisation ? ` · ${vh.motorisation}` : ''}
                  {analysis.annee ? ` · ${analysis.annee}` : ''}
                  {vh.kilometrage ? ` · ${vh.kilometrage.toLocaleString('fr-FR')} km` : ''}
                </div>
                {r.statut_vendeur && (
                  <div style={{ fontFamily: FONT, fontSize: '0.8125rem', color: '#6B7280', marginTop: 4 }}>
                    Vendeur : {STATUT_VENDEUR_LABELS[r.statut_vendeur] || r.statut_vendeur}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                {enCours ? (
                  <div style={{
                    width: 28, height: 28, border: '3px solid #FF4D00',
                    borderTopColor: 'transparent', borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite', marginTop: 6,
                  }} />
                ) : enErreur ? null : (
                  <>
                    <div style={{ fontFamily: FONT_TITRE, fontWeight: 800, fontSize: '2.5rem', color: vs.color, lineHeight: 1 }}>
                      {r.score}
                    </div>
                    <div style={{ fontFamily: FONT, fontSize: '0.6875rem', color: '#9CA3AF', fontWeight: 600 }}>
                      / 100
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Verdict progressif : étapes restantes */}
            {enCours && (
              etapeLive === 'timeout' ? (
                <div style={{ fontFamily: FONT, fontSize: '0.875rem', color: '#92400E', lineHeight: 1.6, marginTop: 12 }}>
                  L'analyse prend plus de temps que prévu. Elle continue en arrière-plan :
                  rechargez cette page dans une minute.
                </div>
              ) : (
                <EtapesProgress etape={etapeLive || r.etape || 'photos_fiche'} />
              )
            )}

            {/* Analyse interrompue (erreur en arrière-plan) */}
            {enErreur && (
              <div style={{ fontFamily: FONT, fontSize: '0.875rem', color: '#B91C1C', lineHeight: 1.6, marginTop: 12 }}>
                {r.erreur || 'L\'analyse n\'a pas pu aboutir.'}{' '}
                <Link to="/score" style={{ color: '#1E4D8C', fontWeight: 600 }}>Relancer une analyse</Link>
              </div>
            )}

            {/* 5 axes dépliables */}
            {axes.length > 0 && (
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', paddingTop: 6 }}>
                {axes.map(([key, axe]) => (
                  <details key={key} className="axe-detail" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <summary style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
                      fontFamily: FONT, fontSize: '0.875rem', color: '#0F1B2D',
                    }}>
                      <span className="axe-chevron" style={{
                        fontSize: '0.65rem', color: '#9CA3AF', transition: 'transform 0.15s',
                        display: 'inline-block', width: 10,
                      }}>
                        ▸
                      </span>
                      <span style={{ flexGrow: 1, fontWeight: 600 }}>{AXE_LABELS[key] || key}</span>
                      {axe.note == null ? (
                        <span style={{ fontFamily: FONT, fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600 }}>
                          non évalué
                        </span>
                      ) : (
                        <span style={{
                          fontFamily: FONT_TITRE, fontWeight: 800,
                          color: axe.note >= 14 ? '#16A34A' : axe.note >= 8 ? '#D97706' : '#DC2626',
                        }}>
                          {axe.note}<span style={{ fontSize: '0.6875rem', color: '#9CA3AF', fontWeight: 600 }}>/20</span>
                        </span>
                      )}
                    </summary>
                    <div style={{
                      fontFamily: FONT, fontSize: '0.8125rem', color: '#6B7280',
                      lineHeight: 1.6, padding: '0 0 10px 20px',
                    }}>
                      {axe.commentaire}
                    </div>
                  </details>
                ))}
              </div>
            )}

            {/* Verdict conditionnel : ce que changerait la couverture de garantie */}
            {r.verdict_conditionnel && (
              <div style={{
                marginTop: 12, padding: '10px 14px', borderRadius: 10,
                background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)',
                fontFamily: FONT, fontSize: '0.8125rem', color: '#166534', lineHeight: 1.55,
              }}>
                Verdict si {r.verdict_conditionnel.condition} :{' '}
                <strong>
                  {VERDICT_STYLE[r.verdict_conditionnel.verdict]?.label ?? r.verdict_conditionnel.verdict}
                  {' '}{r.verdict_conditionnel.score}/100
                </strong>
              </div>
            )}

            {/* Verdict recalculé après une visite (le verdict initial reste tracé) */}
            {!enCours && r.verdict_initial && r.verdict_initial.score !== r.score && (
              <div style={{
                marginTop: 10, fontFamily: FONT, fontSize: '0.75rem',
                color: '#6B7280', lineHeight: 1.5,
              }}>
                Verdict recalculé après une visite sur place — verdict initial de l'analyse :{' '}
                {VERDICT_STYLE[r.verdict_initial.verdict]?.label ?? r.verdict_initial.verdict}{' '}
                {r.verdict_initial.score}/100 le {new Date(r.verdict_initial.date).toLocaleDateString('fr-FR')}.
              </div>
            )}

            {/* Pourquoi le score est plafonné */}
            {r.plafond_raison && (
              <div style={{
                marginTop: 8, fontFamily: FONT, fontSize: '0.75rem',
                color: '#92400E', lineHeight: 1.5,
              }}>
                {r.plafond_raison}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button onClick={handleShare} style={{
                flex: '1 1 140px', background: '#0F1B2D', color: '#fff',
                border: 'none', borderRadius: 10, padding: '13px 16px',
                fontFamily: FONT, fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
              }}>
                {shareDone ? 'Lien copié' : 'Partager'}
              </button>
              <Link to="/score" style={{
                flex: '1 1 140px', textAlign: 'center',
                background: 'transparent', color: '#0F1B2D',
                border: '1.5px solid rgba(15,27,45,0.25)', borderRadius: 10,
                padding: '12px 16px', textDecoration: 'none',
                fontFamily: FONT, fontSize: '0.875rem', fontWeight: 700,
              }}>
                Analyser une autre annonce
              </Link>
            </div>
          </div>

          {/* Synthèse d'une visite déjà faite */}
          {!enCours && <SyntheseVisite synthese={r.visite?.synthese} />}

          {/* Mode visite + suivi dossier */}
          {!enCours && !enErreur && r.type === 'vehicule' && (
            <div style={{
              background: '#fff', border: '1.5px solid rgba(0,0,0,0.07)',
              borderRadius: 16, padding: '16px 18px', marginBottom: 14,
            }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <Link
                  to={`/a/${id}/visite`}
                  onClick={() => trackEvent('visite_started', id)}
                  style={{
                    flex: '1 1 200px', textAlign: 'center', background: '#FF4D00', color: '#fff',
                    borderRadius: 10, padding: '13px 16px', textDecoration: 'none',
                    fontFamily: FONT, fontSize: '0.9375rem', fontWeight: 700,
                  }}
                >
                  Je suis devant la voiture →
                </Link>
                <DossierButton analysisId={id} />
              </div>
              <div style={{ marginTop: 8, fontFamily: FONT, fontSize: '0.6875rem', color: '#9CA3AF', lineHeight: 1.5 }}>
                Mode visite guidé (checklist pas à pas, photos analysées sur place) — fonction du
                Pass achat, en démo libre pendant le lancement. Les photos ne sont jamais conservées.
              </div>
            </div>
          )}

          {/* Annonce modifiée depuis la dernière analyse */}
          {r.analyse_precedente && (
            <div style={{
              background: '#EFF6FF', border: '1.5px solid rgba(30,77,140,0.3)',
              borderRadius: 12, padding: '12px 16px', marginBottom: 14,
              fontFamily: FONT, fontSize: '0.875rem', color: '#1E4D8C', lineHeight: 1.6,
            }}>
              <strong>Annonce modifiée depuis la dernière analyse.</strong>{' '}
              Score précédent {r.analyse_precedente.score}/100 ({VERDICT_STYLE[r.analyse_precedente.verdict]?.label ?? r.analyse_precedente.verdict})
              {' '}le {new Date(r.analyse_precedente.date).toLocaleDateString('fr-FR')} → nouveau score {r.score}/100.
              {(r.analyse_precedente.changements || []).length > 0 && (
                <div style={{ marginTop: 4, color: '#374151' }}>
                  Changements : {r.analyse_precedente.changements.join(' · ')}
                </div>
              )}
            </div>
          )}

          {/* Bandeau de rigueur : affirmations écartées par la critique */}
          {!enCours && !enErreur && (
            <RigorBanner count={analysis.claimsDroppedCount} items={analysis.claimsDropped || []} />
          )}

          {/* Bandeau analyse limitée */}
          {r.analyse_limitee?.actif && (
            <div style={{
              background: '#FFFBEB', border: '1.5px solid rgba(217,119,6,0.35)',
              borderRadius: 12, padding: '12px 16px', marginBottom: 14,
              fontFamily: FONT, fontSize: '0.875rem', color: '#92400E', fontWeight: 600,
            }}>
              {r.analyse_limitee.message}
            </div>
          )}

          {/* ========== 2. RAISONS ========== */}
          {(r.raisons_principales || []).length > 0 && (
            <Card>
              <SectionTitle>Raisons principales</SectionTitle>
              {r.raisons_principales.map((raison, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 10, padding: '8px 0',
                  fontFamily: FONT, fontSize: '0.9375rem', color: '#0F1B2D', lineHeight: 1.55,
                  borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                }}>
                  <span style={{ color: vs.color, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                  {raison}
                </div>
              ))}
              {(r.points_rassurants || []).length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                  <div style={{
                    fontFamily: FONT, fontSize: '0.75rem', fontWeight: 700, color: '#16A34A',
                    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
                  }}>
                    Points rassurants
                  </div>
                  {r.points_rassurants.map((x, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 10, padding: '5px 0',
                      fontFamily: FONT, fontSize: '0.875rem', color: '#166534', lineHeight: 1.5,
                    }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', background: '#16A34A',
                        flexShrink: 0, marginTop: 7,
                      }} />
                      {x}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* ========== 2ter. MARGE DE NÉGOCIATION ========== */}
          {!enCours && <NegotiationCard negociation={r.negociation} analysisId={id} />}

          {/* ========== 2bis. ENTRETIEN : CE QUI AURAIT DÛ ÊTRE FAIT ========== */}
          {(r.entretien && ((r.entretien.du || []).length > 0 || (r.entretien.prouve || []).length > 0 || (r.entretien.a_exiger || []).length > 0)) && (
            <Card>
              <SectionTitle>Entretien : ce qui aurait dû être fait</SectionTitle>
              {(r.entretien.du || []).length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontFamily: FONT, fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                    Doit déjà avoir été fait
                  </div>
                  {r.entretien.du.map((op, i) => (
                    <div key={i} style={{ fontFamily: FONT, fontSize: '0.875rem', color: '#0F1B2D', lineHeight: 1.6, padding: '3px 0' }}>
                      – {op.operation}{op.echeance ? ` (dès ${op.echeance})` : ''}
                      {op.critique && (
                        <span style={{
                          marginLeft: 8, fontSize: '0.6875rem', fontWeight: 700, color: '#C2410C',
                          background: '#FFF0EA', borderRadius: 100, padding: '1px 8px',
                        }}>
                          critique
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {(r.entretien.prouve || []).length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontFamily: FONT, fontSize: '0.75rem', fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                    Prouvé ou annoncé dans l'annonce
                  </div>
                  {r.entretien.prouve.map((x, i) => (
                    <div key={i} style={{ fontFamily: FONT, fontSize: '0.875rem', color: '#166534', lineHeight: 1.6, padding: '3px 0' }}>
                      – {x}
                    </div>
                  ))}
                </div>
              )}
              {(r.entretien.a_exiger || []).length > 0 && (
                <div>
                  <div style={{ fontFamily: FONT, fontSize: '0.75rem', fontWeight: 700, color: '#C2410C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                    À exiger avant d'acheter
                  </div>
                  {r.entretien.a_exiger.map((op, i) => (
                    <div key={i} style={{ fontFamily: FONT, fontSize: '0.875rem', color: '#374151', lineHeight: 1.6, padding: '3px 0' }}>
                      – <strong>{op.operation}</strong> : {op.demande}
                      {(op.cout_min_eur != null || op.cout_max_eur != null) && (
                        <span style={{ color: '#6B7280' }}>
                          {' '}(coût indicatif si non fait : {op.cout_min_eur != null ? `${op.cout_min_eur.toLocaleString('fr-FR')} €` : ''}{op.cout_min_eur != null && op.cout_max_eur != null ? ' – ' : ''}{op.cout_max_eur != null ? `${op.cout_max_eur.toLocaleString('fr-FR')} €` : ''})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* ========== 3. CADRE JURIDIQUE + HISTOVEC ========== */}
          {r.cadre_juridique && (
            <Card>
              <SectionTitle>Cadre juridique</SectionTitle>
              <p style={{ fontFamily: FONT, fontSize: '0.875rem', color: '#374151', lineHeight: 1.65, margin: '0 0 12px' }}>
                {r.cadre_juridique.texte}
              </p>
              <div style={{
                background: '#F0F2F5', borderRadius: 10, padding: '12px 14px',
                fontFamily: FONT, fontSize: '0.8125rem', color: '#374151', lineHeight: 1.6,
              }}>
                {r.cadre_juridique.histovec_conseil || 'Demandez au vendeur le rapport HistoVec gratuit (historique, sinistres, gages).'}{' '}
                <a href={r.cadre_juridique.histovec_url || 'https://histovec.interieur.gouv.fr'} target="_blank" rel="noopener noreferrer" style={{ color: '#1E4D8C', fontWeight: 600 }}>
                  histovec.interieur.gouv.fr
                </a>
              </div>
            </Card>
          )}

          {/* ========== 4. MESSAGE VENDEUR ========== */}
          {r.message_vendeur && (
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <SectionTitle>Message prêt à envoyer au vendeur</SectionTitle>
                <CopyButton text={r.message_vendeur} />
              </div>
              <pre style={{
                fontFamily: FONT, fontSize: '0.8125rem', color: '#374151',
                lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0,
                background: '#F8F9FA', borderRadius: 10, padding: '14px 16px',
              }}>
                {r.message_vendeur}
              </pre>
            </Card>
          )}

          {/* ========== 5. CHECKLIST SUR PLACE ========== */}
          {checklistAffichee.length > 0 && (
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <SectionTitle>Checklist sur place</SectionTitle>
                <div style={{ display: 'flex', gap: 8 }}>
                  <CopyButton text={`Checklist Inspexo — ${vehiculeLabel}\n\n${checklistText}`} />
                  <button
                    onClick={() => {
                      const text = `Checklist Inspexo — ${vehiculeLabel}\n\n${checklistText}`
                      if (navigator.share) navigator.share({ title: 'Checklist Inspexo', text }).catch(() => {})
                      else navigator.clipboard.writeText(text).catch(() => {})
                    }}
                    style={{
                      background: '#fff', color: '#0F1B2D', border: '1.5px solid rgba(0,0,0,0.15)',
                      borderRadius: 8, padding: '9px 16px', fontFamily: FONT,
                      fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Partager
                  </button>
                </div>
              </div>
              {checklistAffichee.map((c, i) => (
                <div key={i} style={{ padding: '10px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <div style={{ fontFamily: FONT, fontSize: '0.875rem', fontWeight: 700, color: '#0F1B2D', marginBottom: 3 }}>
                    {i + 1}. {c.quoi}
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.55 }}>
                    {c.comment}
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: '0.8125rem', color: '#B91C1C', lineHeight: 1.55, marginTop: 2 }}>
                    Signal rouge : {c.signal_rouge}
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* ========== 6. PANNES CONNUES ========== */}
          {(pannesAffichees.length > 0 || fichePending) && (
            <Card>
              <SectionTitle>Points de défaillance connus</SectionTitle>
              {fichePending && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: '#F0F2F5', borderRadius: 10, padding: '12px 14px',
                  marginBottom: pannesAffichees.length > 0 ? 12 : 0,
                  fontFamily: FONT, fontSize: '0.8125rem', color: '#374151',
                }}>
                  <span style={{
                    display: 'inline-block', width: 12, height: 12, flexShrink: 0,
                    border: '2px solid #FF4D00', borderTopColor: 'transparent',
                    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                  }} />
                  Fiche moteur en préparation (environ 1 minute) — les défauts connus
                  sourcés s'ajouteront ici automatiquement.
                  <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
                </div>
              )}
              {pannesAffichees.map((p, i) => {
                const g = GRAVITE_STYLE[p.gravite] || GRAVITE_STYLE.mineure
                return (
                  <div key={i} style={{ padding: '14px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{ fontFamily: FONT, fontSize: '0.9375rem', fontWeight: 700, color: '#0F1B2D' }}>
                        {p.titre}
                      </span>
                      <span style={{
                        background: g.bg, color: g.color, borderRadius: 100, padding: '2px 10px',
                        fontSize: '0.6875rem', fontWeight: 700, fontFamily: FONT,
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>
                        {g.label}
                      </span>
                      {p.usure_lointaine && (
                        <span style={{
                          background: '#F0F2F5', color: '#6B7280', borderRadius: 100, padding: '2px 10px',
                          fontSize: '0.6875rem', fontWeight: 600, fontFamily: FONT,
                        }}>
                          au-delà d'une détention moyenne
                        </span>
                      )}
                    </div>
                    {p.usure_lointaine && (
                      <div style={{ fontFamily: FONT, fontSize: '0.75rem', color: '#9CA3AF', lineHeight: 1.5, marginBottom: 6 }}>
                        Usure documentée bien au-delà du kilométrage actuel (plus de 60 000 km de
                        marge) : affichée pour information, sans effet sur la note.
                      </div>
                    )}
                    {p.rappel_officiel && (
                      <div style={{
                        display: 'inline-block', fontFamily: FONT, fontSize: '0.75rem',
                        fontWeight: 700, color: '#C2410C', background: '#FFF0EA',
                        border: '1px solid rgba(255,77,0,0.4)', borderRadius: 8,
                        padding: '4px 10px', marginBottom: 8,
                      }}>
                        {p.rappel_officiel}
                      </div>
                    )}
                    <div style={{ fontFamily: FONT, fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.6, marginBottom: 6 }}>
                      {p.symptome}
                    </div>
                    {p.pertinence && (
                      <div style={{ fontFamily: FONT, fontSize: '0.8125rem', color: '#374151', lineHeight: 1.6, marginBottom: 6 }}>
                        <strong>Pour ce véhicule :</strong> {p.pertinence}
                      </div>
                    )}
                    {p.verification_sur_place && (
                      <div style={{ fontFamily: FONT, fontSize: '0.8125rem', color: '#374151', lineHeight: 1.6, marginBottom: 8 }}>
                        <strong>À vérifier sur place :</strong> {p.verification_sur_place}
                      </div>
                    )}
                    {(p.cout_min_eur != null || p.cout_max_eur != null) && (
                      <div style={{ fontFamily: FONT, fontSize: '0.8125rem', color: '#374151', marginBottom: 8 }}>
                        <strong>Coût indicatif :</strong>{' '}
                        {p.cout_min_eur != null ? `${p.cout_min_eur.toLocaleString('fr-FR')} €` : ''}
                        {p.cout_min_eur != null && p.cout_max_eur != null ? ' – ' : ''}
                        {p.cout_max_eur != null ? `${p.cout_max_eur.toLocaleString('fr-FR')} €` : ''}
                      </div>
                    )}
                    <SourceLabel statut={p.source_statut} urls={p.urls} sources={p.sources} />
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
                  <div data-testid="fiche-footer" style={{
                    marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.07)',
                    fontFamily: FONT, fontSize: '0.75rem', color: '#6B7280', lineHeight: 1.5,
                  }}>
                    Fiche moteur {r.fiche.famille} : {urlsFiche.size} source{urlsFiche.size > 1 ? 's' : ''} vérifiée{urlsFiche.size > 1 ? 's' : ''}
                    {dateFiche ? ` le ${dateFiche}` : ''}{mix ? ` — ${mix}` : ''}
                  </div>
                )
              })()}
            </Card>
          )}

          {/* ========== 7. RAPPELS ========== */}
          <Card>
            <SectionTitle>Rappels constructeur</SectionTitle>
            {rappels === undefined ? (
              <div style={{ fontFamily: FONT, fontSize: '0.875rem', color: '#9CA3AF' }}>
                Vérification des rappels en cours…
              </div>
            ) : rappels === null || rappels.rappels === null ? (
              <div style={{ fontFamily: FONT, fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.6 }}>
                {analysis.marque && analysis.modele
                  ? 'La base RappelConso est momentanément indisponible. Vérifiez directement sur rappel.conso.gouv.fr.'
                  : 'Véhicule non identifié dans l\'annonce — impossible de vérifier les rappels.'}
              </div>
            ) : rappels.rappels.length === 0 ? (
              <div style={{ fontFamily: FONT, fontSize: '0.875rem', color: '#16A34A', fontWeight: 600 }}>
                Aucun rappel trouvé pour ce modèle dans RappelConso
                {rappels.fetched_at ? ` (vérifié le ${new Date(rappels.fetched_at).toLocaleDateString('fr-FR')})` : ''}.
                <div style={{ color: '#9CA3AF', fontWeight: 400, marginTop: 4, fontSize: '0.75rem' }}>
                  Base officielle data.economie.gouv.fr — couvre les rappels publiés depuis avril 2021.
                </div>
              </div>
            ) : (
              <>
                {rappels.rappels.map((rap, i) => (
                  <div key={i} style={{ padding: '12px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
                    <div style={{
                      fontFamily: FONT, fontSize: '0.875rem', fontWeight: 700, color: '#0F1B2D',
                      marginBottom: 4, textTransform: 'capitalize',
                    }}>
                      {rap.titre}
                    </div>
                    {rap.motif && (
                      <div style={{
                        fontFamily: FONT, fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.55,
                        marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {rap.motif}
                      </div>
                    )}
                    <div style={{
                      fontFamily: FONT, fontSize: '0.75rem', color: '#9CA3AF',
                      display: 'flex', gap: 12, flexWrap: 'wrap',
                    }}>
                      {rap.date && <span>{new Date(rap.date).toLocaleDateString('fr-FR')}</span>}
                      {rap.risques && <span style={{ color: '#D97706' }}>{rap.risques.replace(/\|/g, ', ')}</span>}
                      {rap.lien && (
                        <a href={rap.lien} target="_blank" rel="noopener noreferrer" style={{ color: '#1E4D8C' }}>
                          Fiche officielle
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 10, fontFamily: FONT, fontSize: '0.6875rem', color: '#9CA3AF' }}>
                  Source : RappelConso (data.economie.gouv.fr)
                  {rappels.fetched_at ? ` — vérifié le ${new Date(rappels.fetched_at).toLocaleDateString('fr-FR')}` : ''} —
                  confirmez toujours avec le VIN auprès du constructeur.
                </div>
              </>
            )}
            {(rappels?.autres_rappels || []).length > 0 && (
              <details style={{ marginTop: 14, borderTop: '1px solid rgba(0,0,0,0.07)', paddingTop: 10 }}>
                <summary style={{
                  cursor: 'pointer', fontFamily: FONT, fontSize: '0.8125rem',
                  fontWeight: 600, color: '#6B7280',
                }}>
                  Autres rappels de la gamme ({rappels.autres_rappels.length}) — générations possiblement différentes
                </summary>
                {rappels.autres_rappels.map((rap, i) => (
                  <div key={i} style={{ padding: '10px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                    <div style={{ fontFamily: FONT, fontSize: '0.8125rem', fontWeight: 700, color: '#374151', textTransform: 'capitalize' }}>
                      {rap.titre}
                      {rap.periode_production ? (
                        <span style={{ fontWeight: 400, color: '#9CA3AF' }}> — production {rap.periode_production}</span>
                      ) : null}
                    </div>
                    <div style={{
                      fontFamily: FONT, fontSize: '0.75rem', color: '#9CA3AF', marginTop: 2,
                      display: 'flex', gap: 10, flexWrap: 'wrap',
                    }}>
                      {rap.date && <span>{new Date(rap.date).toLocaleDateString('fr-FR')}</span>}
                      {rap.lien && (
                        <a href={rap.lien} target="_blank" rel="noopener noreferrer" style={{ color: '#1E4D8C' }}>
                          Fiche officielle
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </details>
            )}
          </Card>

          {/* ========== 8. TAKATA (toujours affiché) ========== */}
          {takata && (takata.concerne ? (
            <div style={{
              background: '#7F1D1D', borderRadius: 14,
              padding: '18px 20px', marginBottom: 14,
            }}>
              <div style={{ fontFamily: FONT_TITRE, fontWeight: 800, fontSize: '0.9375rem', color: '#fff', marginBottom: 6 }}>
                Airbags Takata
              </div>
              <div style={{ fontFamily: FONT, fontSize: '0.875rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.6 }}>
                {takata.message}
              </div>
              <div style={{ marginTop: 8, fontFamily: FONT, fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)' }}>
                Modèle listé : {takata.modele_takata} ({takata.periode})
                {takata.liste_date ? ` · liste du ${takata.liste_date}` : ''} ·{' '}
                <a href={takata.source} target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  Liste officielle du ministère
                </a>
              </div>
            </div>
          ) : (
            <Card>
              <SectionTitle>Airbags Takata</SectionTitle>
              <div style={{ fontFamily: FONT, fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 }}>
                {takata.message || `Airbags Takata : modèle non listé dans la campagne officielle${takata.liste_date ? ` (liste du ${takata.liste_date})` : ''}.`}
              </div>
              <div style={{ marginTop: 6, fontFamily: FONT, fontSize: '0.6875rem', color: '#9CA3AF' }}>
                <a href={takata.source} target="_blank" rel="noopener noreferrer" style={{ color: '#1E4D8C' }}>
                  Liste officielle du ministère
                </a>
              </div>
            </Card>
          ))}

          {/* ========== 9. INCOHÉRENCES ========== */}
          {(r.incoherences || []).length > 0 && (
            <Card style={{ borderColor: 'rgba(217,119,6,0.3)', background: '#FFFBEB' }}>
              <SectionTitle>Incohérences relevées dans l'annonce</SectionTitle>
              {r.incoherences.map((inc, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 10, padding: '6px 0',
                  fontFamily: FONT, fontSize: '0.875rem', color: '#78350F', lineHeight: 1.55,
                }}>
                  <span style={{ flexShrink: 0 }}>–</span>
                  {inc}
                </div>
              ))}
            </Card>
          )}

          {/* ========== 8bis. CE QUE MONTRENT LES PHOTOS ========== */}
          {(r.constats_photo || []).length > 0 && (
            <Card>
              <SectionTitle>Ce que montrent les photos</SectionTitle>
              {r.constats_photo.map((c, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 0',
                  borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                  fontFamily: FONT, fontSize: '0.875rem', color: '#0F1B2D', lineHeight: 1.55,
                }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 6,
                    background: c.signal === 'rouge' ? '#DC2626' : c.signal === 'attention' ? '#D97706' : '#16A34A',
                  }} />
                  <span>
                    {c.constat}
                    <span style={{ color: '#9CA3AF', fontSize: '0.75rem' }}> — photo n°{c.photo_index}</span>
                  </span>
                </div>
              ))}
              <div style={{
                marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.07)',
                fontFamily: FONT, fontSize: '0.75rem', color: '#9CA3AF', lineHeight: 1.5,
              }}>
                Constats automatiques sur les photos jointes à l'analyse. Les photos ne sont jamais conservées.
              </div>
            </Card>
          )}

          {/* ========== 10. PRIX ========== */}
          {!enCours && <Card>
            <SectionTitle>Prix</SectionTitle>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 10 }}>
              {vh.prix_affiche != null && (
                <div>
                  <div style={{ fontFamily: FONT, fontSize: '0.6875rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' }}>
                    Prix affiché
                  </div>
                  <div style={{ fontFamily: FONT_TITRE, fontWeight: 800, fontSize: '1.25rem', color: '#0F1B2D' }}>
                    {vh.prix_affiche.toLocaleString('fr-FR')} €
                  </div>
                </div>
              )}
              {r.prix?.mediane_comparables != null && (
                <div>
                  <div style={{ fontFamily: FONT, fontSize: '0.6875rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' }}>
                    Médiane des comparables
                  </div>
                  <div style={{ fontFamily: FONT_TITRE, fontWeight: 800, fontSize: '1.25rem', color: '#1E4D8C' }}>
                    {r.prix.mediane_comparables.toLocaleString('fr-FR')} €
                  </div>
                </div>
              )}
            </div>
            {r.prix?.fourchette && (
              <div style={{
                background: '#F0F2F5', borderRadius: 10, padding: '12px 14px', marginBottom: 10,
              }}>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 6 }}>
                  {[['P25', r.prix.fourchette.p25], ['Médiane', r.prix.fourchette.mediane], ['P75', r.prix.fourchette.p75]].map(([lbl, val]) => (
                    <div key={lbl}>
                      <div style={{ fontFamily: FONT, fontSize: '0.6875rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' }}>{lbl}</div>
                      <div style={{ fontFamily: FONT_TITRE, fontWeight: 800, fontSize: '1.125rem', color: '#1E4D8C' }}>
                        {Number(val).toLocaleString('fr-FR')} €
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: FONT, fontSize: '0.75rem', color: '#6B7280', lineHeight: 1.5 }}>
                  {r.prix.fourchette.libelle}
                  <br />Provenance : {r.prix.fourchette.provenance}.
                </div>
              </div>
            )}
            {r.prix?.commentaire ? (
              <div style={{ fontFamily: FONT, fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.65 }}>
                {r.prix.commentaire}
              </div>
            ) : (
              <div style={{ fontFamily: FONT, fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.65 }}>
                Collez 3 annonces comparables (même modèle, année proche) lors de l'analyse pour situer le prix.
                Sans comparables, aucune estimation n'est avancée.
              </div>
            )}
          </Card>}

          {/* ========== 11. BUDGET 12 MOIS (si présent) ========== */}
          {(r.budget_12_mois || []).length > 0 && (
            <Card>
              <SectionTitle>Budget prévisible sur 12 mois</SectionTitle>
              {r.budget_12_mois.map((b, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', gap: 12,
                  padding: '9px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                  fontFamily: FONT, fontSize: '0.875rem', color: '#374151',
                }}>
                  <span>{b.poste}</span>
                  <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {b.cout_min_eur != null ? `${b.cout_min_eur.toLocaleString('fr-FR')} €` : ''}
                    {b.cout_min_eur != null && b.cout_max_eur != null ? ' – ' : ''}
                    {b.cout_max_eur != null ? `${b.cout_max_eur.toLocaleString('fr-FR')} €` : ''}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: 8, fontFamily: FONT, fontSize: '0.6875rem', color: '#9CA3AF' }}>
                Uniquement des coûts chiffrés par les sources (base Inspexo ou sources en ligne). Fourchettes indicatives, hors entretien courant.
              </div>
            </Card>
          )}

          {/* ========== 12. FEEDBACK ========== */}
          {!enCours && (
            <Card>
              <VerdictFeedback analysisId={id} />
            </Card>
          )}

          {/* ========== 13. EMAILS ========== */}
          {!enCours && (
            <>
              <Card>
                <EmailCapture
                  title="Recevoir ce rapport par email"
                  buttonLabel="Recevoir"
                  source="rapport"
                  analysisId={id}
                />
              </Card>
              <Card style={{ background: '#FFF0EA', borderColor: 'rgba(255,77,0,0.25)' }}>
                <EmailCapture
                  title="Le Pass achat arrive : accompagnement complet jusqu'à la signature. Être prévenu du lancement ?"
                  buttonLabel="Être prévenu"
                  source="pass_waitlist"
                  analysisId={id}
                />
              </Card>
            </>
          )}

          {/* ========== Avertissement (complet, non tronqué) ========== */}
          <div style={{
            textAlign: 'center', padding: '18px 16px 0',
            fontFamily: FONT, fontSize: '0.75rem', color: '#9CA3AF', lineHeight: 1.6,
          }}>
            {r.avertissement}
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
