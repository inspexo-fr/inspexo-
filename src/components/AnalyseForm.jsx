import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Turnstile from './Turnstile'
import { analyzeListing, submitPendingAnalysis } from '../lib/scoreApi'
import { resizeImageToDataUrl } from '../lib/imageUtils'

const MAX_TEXT = 6000
const MAX_IMAGES = 6
const MAX_COMPARABLES = 5

// Les 4 étapes réelles du pipeline, avec leur seuil de temps typique (s).
const LOADING_STEPS = [
  { label: 'Identification du véhicule…', at: 0 },
  { label: 'Fiche moteur — défauts connus sourcés…', at: 9 },
  { label: 'Analyse de l\'annonce…', at: 52 },
  { label: 'Vérification de chaque affirmation…', at: 78 },
]

// Le vrai formulaire de /score — MÊME composant sur l'accueil (hero) et sur
// /score : texte, photos (jamais conservées), usage, comparables, captcha
// au-delà du quota, file d'attente si le service IA est indisponible.
export default function AnalyseForm({ idPrefix = 'analyse' }) {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [text, setText] = useState(() => {
    // Fallback de l'extension Chrome : /score?texte=<annonce encodée>
    try {
      const t = new URLSearchParams(window.location.search).get('texte')
      return t ? t.slice(0, 6000) : ''
    } catch (_) { return '' }
  })
  const [images, setImages] = useState([]) // data URLs
  const [comparables, setComparables] = useState([])
  const [showComparables, setShowComparables] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState(null)
  const [usage, setUsage] = useState(null) // ville | mixte | route | null
  const [indispo, setIndispo] = useState(null) // message si service IA indisponible
  const [waitEmail, setWaitEmail] = useState('')
  const [waitState, setWaitState] = useState('idle') // idle | sending | done | error
  const [captchaRequis, setCaptchaRequis] = useState(false) // au-delà de 2 analyses/jour
  const [captchaToken, setCaptchaToken] = useState(null)

  // Avancement des étapes indexé sur le temps écoulé (seuils réels du pipeline)
  useEffect(() => {
    if (!loading) return
    setLoadingStep(0)
    const t0 = Date.now()
    const interval = setInterval(() => {
      const elapsed = (Date.now() - t0) / 1000
      let idx = 0
      LOADING_STEPS.forEach((st, i) => { if (elapsed >= st.at) idx = i })
      setLoadingStep(idx)
    }, 1000)
    return () => clearInterval(interval)
  }, [loading])

  const handleAddImages = async (fileList) => {
    setError(null)
    const files = Array.from(fileList || []).slice(0, MAX_IMAGES - images.length)
    for (const file of files) {
      try {
        const dataUrl = await resizeImageToDataUrl(file)
        setImages(prev => prev.length < MAX_IMAGES ? [...prev, dataUrl] : prev)
      } catch (e) {
        setError('Une image n\'a pas pu être lue. Formats acceptés : JPG, PNG, WebP.')
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!text.trim() || loading) return
    setError(null)
    setLoading(true)
    try {
      const payload = {
        text: text.trim(),
        images,
        comparables: comparables.map(c => c.trim()).filter(Boolean),
        ...(usage ? { usage } : {}),
        ...(captchaToken ? { captcha_token: captchaToken } : {}),
        // Verdict progressif : la page de résultat s'ouvre dès l'identification,
        // le reste de l'analyse arrive en direct (polling côté /a/:id).
        progressive: true,
      }
      const { id, result, partial } = await analyzeListing(payload)
      navigate(`/a/${id}`, { state: { result, partial: partial === true } })
    } catch (err) {
      // Service IA indisponible : on propose la file d'attente plutôt qu'un échec sec.
      if (err.code === 'service_unavailable' || err.status === 503) {
        setIndispo(err.message)
      } else if (err.code === 'captcha_required') {
        // Au-delà de 2 analyses/jour : vérification anti-robots puis relance.
        setCaptchaRequis(true)
        setError(err.message)
      } else {
        setError(err.message)
      }
      setLoading(false)
    }
  }

  const handleWaitSubmit = async (e) => {
    e.preventDefault()
    if (!waitEmail || waitState === 'sending') return
    setWaitState('sending')
    try {
      await submitPendingAnalysis(waitEmail, text.trim(), usage)
      setWaitState('done')
    } catch (_) {
      setWaitState('error')
    }
  }

  const charCount = text.length
  const overLimit = charCount > MAX_TEXT

  if (loading) {
    return (
      <div className="formcard" aria-labelledby={`${idPrefix}-form-title`}>
        <div className="formcard-head">
          <span id={`${idPrefix}-form-title`}>Analyse en cours</span>
          <span>Gratuit</span>
        </div>
        <div style={{ padding: '20px 18px 18px' }}>
          <p style={{ fontSize: 14, lineHeight: 1.5 }} className="c-ink2">
            La page de résultat s'ouvre dès que le véhicule est identifié
            (quelques secondes) — l'analyse complète s'y affiche en direct.
          </p>
          <div style={{ marginTop: 10 }}>
            {LOADING_STEPS.map(({ label }, i) => (
              <div
                key={i}
                className={`mono ${i < loadingStep ? 'c-vert' : i === loadingStep ? '' : 'c-graphite'}`}
                style={{
                  display: 'flex', gap: 10, alignItems: 'baseline',
                  padding: '9px 0', borderTop: i > 0 ? '1px solid var(--rule)' : 'none',
                  fontSize: 12, letterSpacing: '.04em',
                  fontWeight: i === loadingStep ? 600 : 400,
                }}
              >
                <span style={{ width: 16, textAlign: 'center' }} aria-hidden="true">
                  {i < loadingStep ? '×' : i === loadingStep ? '→' : '·'}
                </span>
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="formcard" aria-labelledby={`${idPrefix}-form-title`}>
      <div className="formcard-head">
        <span id={`${idPrefix}-form-title`}>Nouvelle analyse</span>
        <span>Gratuit</span>
      </div>
      <form onSubmit={handleSubmit} noValidate>
        <div>
          <label className="lbl" htmlFor={`${idPrefix}-annonce`}>Texte de l'annonce</label>
          <textarea
            id={`${idPrefix}-annonce`}
            className="textarea"
            name="annonce"
            placeholder="Collez ici tout le texte : titre, prix, kilométrage, description, équipements."
            value={text}
            onChange={e => setText(e.target.value)}
            maxLength={MAX_TEXT + 500}
          />
          <div
            className="mono"
            style={{
              display: 'flex', justifyContent: 'flex-end', marginTop: 6,
              fontSize: 11, color: overLimit ? 'var(--rouge)' : 'var(--graphite)',
            }}
          >
            {charCount} / {MAX_TEXT}
          </div>
        </div>

        <div>
          <span className="lbl" id={`${idPrefix}-photos-lbl`}>Photos de l'annonce · facultatif</span>
          <label className="photo" htmlFor={`${idPrefix}-photos`} aria-labelledby={`${idPrefix}-photos-lbl`}>
            <span>Ajouter jusqu'à 6 photos{images.length > 0 ? ` (${images.length}/${MAX_IMAGES})` : ''}</span>
            <span className="mono">JAMAIS CONSERVÉES</span>
            <input
              id={`${idPrefix}-photos`}
              ref={fileInputRef}
              type="file" accept="image/*" multiple
              onChange={e => { handleAddImages(e.target.files); e.target.value = '' }}
            />
          </label>
          {images.length > 0 && (
            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              {images.map((src, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img
                    src={src} alt={`Pièce jointe ${i + 1}`}
                    style={{ width: 72, height: 72, objectFit: 'cover', border: '1px solid var(--rule-strong)', display: 'block' }}
                  />
                  <button
                    type="button"
                    onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                    aria-label={`Retirer la photo ${i + 1}`}
                    style={{
                      position: 'absolute', top: 0, right: 0, width: 24, height: 24,
                      background: 'var(--ink)', color: 'var(--paper)', border: 'none',
                      font: '600 12px var(--mono)', cursor: 'pointer', lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <fieldset>
          <legend>Votre usage · facultatif</legend>
          <div className="seg">
            {[['ville', 'Surtout ville'], ['mixte', 'Mixte'], ['route', 'Surtout route']].map(([val, label]) => (
              <label key={val} className={usage === val ? 'coche' : ''} style={usage === val ? { background: 'var(--ink)', color: 'var(--paper)' } : undefined}>
                <input
                  type="checkbox"
                  checked={usage === val}
                  onChange={() => setUsage(usage === val ? null : val)}
                  aria-label={label}
                />
                <span style={usage === val ? { fontWeight: 700 } : undefined}>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Comparables (facultatif) */}
        <details open={showComparables} onToggle={e => setShowComparables(e.currentTarget.open)}>
          <summary className="lbl" style={{ cursor: 'pointer', listStyle: 'none', minHeight: 24 }}>
            Annonces comparables · facultatif — affine l'avis sur le prix {showComparables ? '−' : '+'}
          </summary>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(comparables.length === 0 ? [''] : comparables).map((c, i) => (
              <textarea
                key={i}
                className="textarea"
                style={{ minHeight: 70, marginTop: 0 }}
                placeholder={`Texte de l'annonce comparable ${i + 1} (même modèle, année proche)`}
                value={c}
                onChange={e => {
                  setComparables(prev => {
                    const base = prev.length === 0 ? [''] : [...prev]
                    base[i] = e.target.value
                    return base
                  })
                }}
              />
            ))}
            {comparables.length > 0 && comparables.length < MAX_COMPARABLES && (
              <button type="button" className="btn-ghost btn-sm btn-auto" onClick={() => setComparables(prev => [...prev, ''])}>
                Ajouter une annonce ({comparables.length}/{MAX_COMPARABLES})
              </button>
            )}
          </div>
        </details>

        {/* Service IA indisponible : file d'attente + email */}
        {indispo && (
          <div className="alert alert-ambre" style={{ margin: 0 }}>
            <div style={{ fontWeight: 700 }}>{indispo}</div>
            {waitState === 'done' ? (
              <div className="c-vert" style={{ marginTop: 6, fontWeight: 600 }}>
                C'est noté. Votre analyse sera lancée dès le rétablissement du service et le verdict
                vous sera envoyé à cette adresse.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  <input
                    type="email" required placeholder="votre@email.com" className="input"
                    style={{ flex: '1 1 200px', width: 'auto' }}
                    value={waitEmail} onChange={e => setWaitEmail(e.target.value)}
                  />
                  <button type="button" className="btn-ghost btn-sm btn-auto" onClick={handleWaitSubmit} disabled={waitState === 'sending'}>
                    {waitState === 'sending' ? 'Envoi…' : 'Me prévenir'}
                  </button>
                </div>
                <div className="mono c-graphite" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.6 }}>
                  En laissant votre email, vous acceptez d'être recontacté par Inspexo à ce sujet.
                  Lien de désinscription dans chaque email.
                </div>
                {waitState === 'error' && (
                  <div className="c-rouge" style={{ fontSize: 13, marginTop: 6 }}>
                    Enregistrement impossible (adresse invalide ou limite atteinte). Réessayez plus tard.
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div className="alert alert-rouge" role="alert" style={{ margin: 0 }}>{error}</div>
        )}

        {captchaRequis && <Turnstile onToken={setCaptchaToken} action="score" />}

        <button className="btn" type="submit" disabled={!text.trim() || overLimit}>Lancer l'analyse</button>
        <p className="formnote">
          Gratuit · Sans inscription · 5 analyses par jour<br />
          Ne remplace pas l'examen du véhicule par un professionnel.
        </p>
      </form>
    </div>
  )
}
