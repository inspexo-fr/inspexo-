import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { analyzeListing } from '../lib/scoreApi'
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

export default function ScorePage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [text, setText]               = useState(() => {
    // Fallback de l'extension Chrome : /score?texte=<annonce encodée>
    try {
      const t = new URLSearchParams(window.location.search).get('texte')
      return t ? t.slice(0, 6000) : ''
    } catch (_) { return '' }
  })
  const [images, setImages]           = useState([]) // data URLs
  const [comparables, setComparables] = useState([])
  const [showComparables, setShowComparables] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError]             = useState(null)

  useEffect(() => { window.scrollTo(0, 0) }, [])

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
      }
      const { id, result } = await analyzeListing(payload)
      navigate(`/a/${id}`, { state: { result } })
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const charCount = text.length
  const overLimit = charCount > MAX_TEXT

  return (
    <>
      <Helmet>
        <title>Analysez une annonce de voiture d'occasion gratuitement | Inspexo</title>
        <meta name="description" content="Collez le texte d'une annonce de véhicule d'occasion et recevez en 20 secondes un verdict vert / orange / rouge : défauts connus du modèle, rappels constructeur, questions à poser au vendeur. Gratuit, sans inscription." />
        <link rel="canonical" href="https://www.inspexo.io/score" />
      </Helmet>

      <style>{`
        .score-textarea {
          width: 100%; box-sizing: border-box;
          background: #fff; border: 1.5px solid rgba(0,0,0,0.12);
          border-radius: 14px; padding: 16px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 16px; color: #0F1B2D; line-height: 1.6;
          min-height: 220px; resize: vertical;
          outline: none; transition: border-color 0.2s;
        }
        .score-textarea:focus { border-color: #FF4D00; }
        .score-textarea::placeholder { color: #9CA3AF; }
        .score-submit {
          width: 100%; background: #FF4D00; color: #fff;
          border: none; border-radius: 12px; padding: 17px 24px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 1.0625rem; font-weight: 700; cursor: pointer;
          transition: opacity 0.2s, transform 0.2s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .score-submit:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .score-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .score-secondary-btn {
          background: #fff; color: #0F1B2D;
          border: 1.5px solid rgba(0,0,0,0.12); border-radius: 10px;
          padding: 11px 18px; font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 0.875rem; font-weight: 600; cursor: pointer;
          transition: border-color 0.2s;
        }
        .score-secondary-btn:hover { border-color: rgba(0,0,0,0.3); }
        .score-comparable-input {
          width: 100%; box-sizing: border-box;
          background: #fff; border: 1.5px solid rgba(0,0,0,0.1);
          border-radius: 10px; padding: 12px 14px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 0.875rem; color: #0F1B2D; min-height: 70px;
          resize: vertical; outline: none;
        }
        .score-comparable-input:focus { border-color: #FF4D00; }
        @media (min-width: 720px) {
          .score-wrap { padding: 120px 24px 80px !important; }
        }
      `}</style>

      <Navbar />

      <main style={{ background: '#F8F9FA', minHeight: '100vh' }}>
        <div className="score-wrap" style={{ maxWidth: 680, margin: '0 auto', padding: '96px 18px 64px' }}>

          {/* En-tête */}
          <div style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: '0.8125rem', fontWeight: 600,
            color: '#FF4D00', letterSpacing: '0.12em',
            textTransform: 'uppercase', marginBottom: 14,
          }}>
            Score d'annonce gratuit
          </div>
          <h1 style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 800,
            fontSize: 'clamp(1.75rem, 6vw, 2.5rem)', color: '#0F1B2D',
            lineHeight: 1.12, marginBottom: 12, letterSpacing: '-0.5px',
          }}>
            Cette annonce cache-t-elle<br />un problème ?
          </h1>
          <p style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: '0.9375rem', fontWeight: 300, color: '#6B7280',
            lineHeight: 1.65, marginBottom: 28,
          }}>
            Collez le texte de l'annonce. En 1 à 2 minutes : verdict
            vert / orange / rouge noté sur 5 axes, pannes connues sourcées, rappels
            constructeur (dont airbags Takata), message prêt à envoyer au vendeur
            et checklist d'inspection. Gratuit, sans inscription.
          </p>

          {loading ? (
            /* ---------------- Écran de chargement ---------------- */
            <div style={{
              background: '#fff', borderRadius: 16, padding: '36px 28px',
              border: '1.5px solid rgba(0,0,0,0.07)',
            }}>
              <div style={{
                fontFamily: 'Syne, sans-serif', fontWeight: 800,
                fontSize: '1.125rem', color: '#0F1B2D', marginBottom: 6,
              }}>
                Analyse en cours…
              </div>
              <div style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.8125rem', color: '#9CA3AF', marginBottom: 20,
              }}>
                Analyse approfondie en 3 passes — comptez 1 à 2 minutes.
              </div>
              {LOADING_STEPS.map(({ label: step }, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.9375rem',
                  color: i < loadingStep ? '#16A34A' : i === loadingStep ? '#0F1B2D' : '#C3C9D2',
                  fontWeight: i === loadingStep ? 600 : 400,
                  transition: 'color 0.3s',
                }}>
                  <span style={{ width: 20, textAlign: 'center' }}>
                    {i < loadingStep ? '✓' : i === loadingStep ? (
                      <span style={{
                        display: 'inline-block', width: 12, height: 12,
                        border: '2px solid #FF4D00', borderTopColor: 'transparent',
                        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                      }} />
                    ) : '·'}
                  </span>
                  {step}
                </div>
              ))}
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            /* ---------------- Formulaire ---------------- */
            <form onSubmit={handleSubmit}>
              <textarea
                className="score-textarea"
                placeholder={'Collez le texte de l\'annonce ici — titre, description, prix, kilométrage, année…\n\n(Nous ne récupérons pas les liens : copiez le texte de l\'annonce, pas son URL.)'}
                value={text}
                onChange={e => setText(e.target.value)}
                maxLength={MAX_TEXT + 500}
              />
              <div style={{
                display: 'flex', justifyContent: 'flex-end', marginTop: 6, marginBottom: 16,
                fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.75rem',
                color: overLimit ? '#DC2626' : '#9CA3AF',
              }}>
                {charCount} / {MAX_TEXT}
              </div>

              {/* Captures */}
              <div style={{ marginBottom: 18 }}>
                <input
                  ref={fileInputRef}
                  type="file" accept="image/*" multiple hidden
                  onChange={e => { handleAddImages(e.target.files); e.target.value = '' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button" className="score-secondary-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={images.length >= MAX_IMAGES}
                    style={images.length >= MAX_IMAGES ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                  >
                    📷 Ajouter des captures ({images.length}/{MAX_IMAGES})
                  </button>
                  <span style={{
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: '0.75rem', color: '#9CA3AF',
                  }}>
                    Captures de l'annonce ou photos du véhicule — jamais stockées.
                  </span>
                </div>
                {images.length > 0 && (
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    {images.map((src, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={src} alt={`Capture ${i + 1}`} style={{
                          width: 76, height: 76, objectFit: 'cover',
                          borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)',
                        }} />
                        <button
                          type="button"
                          onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                          aria-label="Retirer cette capture"
                          style={{
                            position: 'absolute', top: -7, right: -7,
                            width: 22, height: 22, borderRadius: '50%',
                            background: '#0F1B2D', color: '#fff', border: 'none',
                            fontSize: '0.7rem', cursor: 'pointer', lineHeight: 1,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Comparables (optionnel) */}
              <div style={{ marginBottom: 22 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowComparables(v => !v)
                    if (!showComparables && comparables.length === 0) setComparables([''])
                  }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: '0.875rem', fontWeight: 600, color: '#1E4D8C',
                  }}
                >
                  {showComparables ? '▾' : '▸'} Annonces comparables (optionnel) — affine l'avis sur le prix
                </button>
                {showComparables && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {comparables.map((c, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <textarea
                          className="score-comparable-input"
                          placeholder={`Texte de l'annonce comparable ${i + 1} (même modèle, année proche)`}
                          value={c}
                          onChange={e => setComparables(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                        />
                        <button
                          type="button"
                          onClick={() => setComparables(prev => prev.filter((_, j) => j !== i))}
                          aria-label="Retirer cette annonce comparable"
                          style={{
                            position: 'absolute', top: 8, right: 8,
                            background: 'none', border: 'none', color: '#9CA3AF',
                            cursor: 'pointer', fontSize: '0.8rem',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {comparables.length < MAX_COMPARABLES && (
                      <button
                        type="button" className="score-secondary-btn"
                        style={{ alignSelf: 'flex-start' }}
                        onClick={() => setComparables(prev => [...prev, ''])}
                      >
                        + Ajouter une annonce comparable ({comparables.length}/{MAX_COMPARABLES})
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Erreur */}
              {error && (
                <div style={{
                  background: '#FEF2F2', border: '1px solid rgba(220,38,38,0.25)',
                  borderRadius: 10, padding: '12px 16px', marginBottom: 16,
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.875rem', color: '#B91C1C', lineHeight: 1.5,
                }}>
                  {error}
                </div>
              )}

              <button type="submit" className="score-submit" disabled={!text.trim() || overLimit}>
                🔍 Analyser gratuitement
                <span style={{ fontSize: '1.1rem' }}>→</span>
              </button>

              <div style={{
                marginTop: 12, textAlign: 'center',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.75rem', color: '#9CA3AF', lineHeight: 1.6,
              }}>
                Gratuit · Sans inscription · 5 analyses par jour<br />
                Analyse automatique à partir du texte de l'annonce. Ne remplace pas un examen du véhicule.
              </div>
            </form>
          )}

          {!loading && (
            <div style={{
              marginTop: 20, textAlign: 'center',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '0.875rem', fontWeight: 600, color: '#0F1B2D', lineHeight: 2,
            }}>
              <div>Analyse en 60 s</div>
              <div>Sources affichées</div>
              <div>Aucun lien avec les vendeurs</div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  )
}
