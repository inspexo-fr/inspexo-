import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import { IconeAppareilPhoto, IconeLoupe } from '../components/Icones'
import Turnstile from '../components/Turnstile'
import Footer from '../components/Footer'
import { analyzeListing, submitPendingAnalysis, extraireTexteCaptures } from '../lib/scoreApi'
import { resizeImageToDataUrl } from '../lib/imageUtils'
import { extraireImagesVideo } from '../lib/videoUtils'
import { IconeVideo } from '../components/Icones'

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
  const videoInputRef = useRef(null)

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
  const [usage, setUsage]             = useState(null) // ville | mixte | route | null
  const [indispo, setIndispo]         = useState(null) // message si service IA indisponible
  const [waitEmail, setWaitEmail]     = useState('')
  const [waitState, setWaitState]     = useState('idle') // idle | sending | done | error
  const [captchaRequis, setCaptchaRequis] = useState(false) // au-delà de 2 analyses/jour
  const [captchaToken, setCaptchaToken]   = useState(null)
  // Mode enregistrement d'écran : la vidéo est lue SUR l'appareil (jamais envoyée),
  // les images extraites partent dans le pipeline captures.
  const [modeVideo, setModeVideo]         = useState('idle') // idle | tuto | lecture | ocr | captcha | relecture
  const [videoProgress, setVideoProgress] = useState(null)   // { fait, total, gardees }
  const [videoErreur, setVideoErreur]     = useState(null)   // message de repli vers les captures
  const [framesExtraites, setFramesExtraites] = useState(null) // reprise après captcha sans relire la vidéo

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

  const lancerOcr = async (frames, jeton) => {
    setModeVideo('ocr')
    setVideoErreur(null)
    try {
      const res = await extraireTexteCaptures(frames, jeton || captchaToken)
      const indices = new Set(res.images_vehicule || [])
      // Seules les captures montrant le VÉHICULE repartent dans l'analyse
      // (le texte, lui, est extrait ci-dessous) — maîtrise du coût.
      setImages(frames.filter((_, i) => indices.has(i + 1)).slice(0, MAX_IMAGES))
      setText((res.texte || '').slice(0, MAX_TEXT))
      setModeVideo('relecture')
      if (res.est_annonce_vehicule === false) {
        setVideoErreur('Ces captures ne ressemblent pas à une annonce de véhicule — vérifiez le texte extrait avant d\'analyser.')
      }
    } catch (err) {
      if (err.code === 'captcha_required') {
        setCaptchaRequis(true)
        setModeVideo('captcha')
        setVideoErreur(err.message)
      } else {
        setModeVideo('idle')
        setVideoErreur(err.message || 'La lecture des captures a échoué — réessayez ou collez le texte de l\'annonce.')
      }
    }
  }

  const handleVideo = async (fileList) => {
    const file = fileList?.[0]
    if (!file) return
    setError(null)
    setVideoErreur(null)
    setVideoProgress(null)
    setModeVideo('lecture')
    let frames
    try {
      frames = await extraireImagesVideo(file, (fait, total, gardees) =>
        setVideoProgress({ fait, total, gardees }))
    } catch (err) {
      setModeVideo('idle')
      setVideoErreur(err.code === 'decode'
        ? 'Votre navigateur ne sait pas lire cette vidéo (format non décodable sur cet appareil). Second choix : prenez des captures d\'écran de l\'annonce et ajoutez-les ci-dessous — le résultat est identique.'
        : (err.message || 'Vidéo illisible — essayez plutôt les captures d\'écran.'))
      return
    }
    setFramesExtraites(frames)
    await lancerOcr(frames)
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
            Filmez l'annonce (10 s) ou collez son texte. En 1 à 2 minutes : verdict
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
                La page de résultat s'ouvre dès que le véhicule est identifié
                (quelques secondes) — l'analyse complète s'y affiche en direct.
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
              {/* ===== Mode enregistrement d'écran (priorité mobile) ===== */}
              <div style={{
                background: '#fff', border: '1.5px solid rgba(255,77,0,0.35)',
                borderRadius: 14, padding: '16px', marginBottom: 18,
              }}>
                <input
                  ref={videoInputRef} type="file" accept="video/*" hidden
                  onChange={e => { handleVideo(e.target.files); e.target.value = '' }}
                />
                {(modeVideo === 'idle' || modeVideo === 'tuto') && (
                  <>
                    <button
                      type="button" className="score-submit"
                      style={{ padding: '15px 20px' }}
                      onClick={() => setModeVideo(modeVideo === 'tuto' ? 'idle' : 'tuto')}
                    >
                      <IconeVideo size={18} /> Filmez l'annonce (10 s)
                    </button>
                    {modeVideo === 'tuto' && (
                      <div style={{ marginTop: 14, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                        {[
                          ['1', 'Lancez l\'enregistrement d\'écran de votre téléphone (Centre de contrôle sur iPhone, raccourcis sur Android).'],
                          ['2', 'Ouvrez l\'annonce et faites-la défiler lentement de haut en bas — 10 secondes suffisent.'],
                          ['3', 'Arrêtez l\'enregistrement et envoyez la vidéo ici.'],
                        ].map(([n, t]) => (
                          <div key={n} style={{ display: 'flex', gap: 10, padding: '6px 0', fontSize: '0.875rem', color: '#374151', lineHeight: 1.55 }}>
                            <span style={{
                              flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                              background: '#FFF0EA', color: '#C2410C', fontWeight: 700,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem',
                            }}>{n}</span>
                            {t}
                          </div>
                        ))}
                        <button
                          type="button" className="score-submit"
                          style={{ marginTop: 10, background: '#0F1B2D' }}
                          onClick={() => videoInputRef.current?.click()}
                        >
                          J'ai ma vidéo — l'envoyer
                        </button>
                      </div>
                    )}
                  </>
                )}
                {modeVideo === 'lecture' && (
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.875rem', color: '#0F1B2D' }}>
                    <span style={{
                      display: 'inline-block', width: 12, height: 12, marginRight: 8,
                      border: '2px solid #FF4D00', borderTopColor: 'transparent',
                      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                    }} />
                    Extraction des images sur votre appareil…
                    {videoProgress ? ` ${videoProgress.fait}/${videoProgress.total} analysées · ${videoProgress.gardees} retenues` : ''}
                    <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: 6 }}>
                      La vidéo est lue localement : elle ne quitte jamais votre téléphone.
                    </div>
                    <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
                  </div>
                )}
                {modeVideo === 'ocr' && (
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.875rem', color: '#0F1B2D' }}>
                    <span style={{
                      display: 'inline-block', width: 12, height: 12, marginRight: 8,
                      border: '2px solid #FF4D00', borderTopColor: 'transparent',
                      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                    }} />
                    Lecture du texte de l'annonce sur les captures…
                    <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
                  </div>
                )}
                {modeVideo === 'captcha' && (
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.875rem', color: '#0F1B2D' }}>
                    <Turnstile onToken={setCaptchaToken} action="extraction" />
                    <button
                      type="button" className="score-secondary-btn" style={{ marginTop: 8 }}
                      disabled={!framesExtraites}
                      onClick={() => lancerOcr(framesExtraites, captchaToken)}
                    >
                      Renvoyer la vidéo
                    </button>
                  </div>
                )}
                {modeVideo === 'relecture' && (
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.875rem', color: '#166534', lineHeight: 1.55 }}>
                    <strong>Texte extrait de la vidéo.</strong> Vérifiez-le ci-dessous — corrigez
                    si besoin — puis lancez l'analyse.
                    {images.length > 0 ? ` ${images.length} photo${images.length > 1 ? 's' : ''} du véhicule jointe${images.length > 1 ? 's' : ''}.` : ''}
                    <div>
                      <button
                        type="button"
                        onClick={() => { setModeVideo('idle'); setFramesExtraites(null) }}
                        style={{
                          background: 'none', border: 'none', padding: 0, marginTop: 6,
                          color: '#1E4D8C', fontSize: '0.8125rem', cursor: 'pointer',
                          fontFamily: 'Plus Jakarta Sans, sans-serif', textDecoration: 'underline',
                        }}
                      >
                        Recommencer avec une autre vidéo
                      </button>
                    </div>
                  </div>
                )}
                {videoErreur && (
                  <div style={{
                    marginTop: 10, fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: '0.8125rem', color: '#92400E', lineHeight: 1.55,
                  }}>
                    {videoErreur}
                  </div>
                )}
                {(modeVideo === 'idle' || modeVideo === 'tuto') && (
                  <div style={{
                    marginTop: 10, fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: '0.6875rem', color: '#9CA3AF', lineHeight: 1.5,
                  }}>
                    La vidéo est lue sur votre téléphone, jamais envoyée ni stockée.
                    Second choix : collez le texte ou ajoutez des captures d'écran ci-dessous.
                  </div>
                )}
              </div>

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
                    <IconeAppareilPhoto /> Ajouter des captures ({images.length}/{MAX_IMAGES})
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

              {/* Service IA indisponible : file d'attente + email */}
              {indispo && (
                <div style={{
                  background: '#FFFBEB', border: '1.5px solid rgba(217,119,6,0.35)',
                  borderRadius: 12, padding: '16px 18px', marginBottom: 16,
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                }}>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#92400E', marginBottom: 6 }}>
                    {indispo}
                  </div>
                  {waitState === 'done' ? (
                    <div style={{ fontSize: '0.875rem', color: '#166534', fontWeight: 600 }}>
                      C'est noté. Votre analyse sera lancée dès le rétablissement du service et le verdict
                      vous sera envoyé à cette adresse.
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                        <input
                          type="email" required placeholder="votre@email.com"
                          value={waitEmail} onChange={e => setWaitEmail(e.target.value)}
                          style={{
                            flex: '1 1 200px', boxSizing: 'border-box', background: '#fff',
                            border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 10,
                            padding: '11px 14px', fontFamily: 'Plus Jakarta Sans, sans-serif',
                            fontSize: '0.9375rem', color: '#0F1B2D', outline: 'none',
                          }}
                        />
                        <button
                          type="button" onClick={handleWaitSubmit} disabled={waitState === 'sending'}
                          style={{
                            background: '#0F1B2D', color: '#fff', border: 'none', borderRadius: 10,
                            padding: '11px 20px', fontFamily: 'Plus Jakarta Sans, sans-serif',
                            fontSize: '0.875rem', fontWeight: 700,
                            cursor: waitState === 'sending' ? 'wait' : 'pointer',
                          }}
                        >
                          {waitState === 'sending' ? 'Envoi…' : 'Me prévenir'}
                        </button>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#92400E', marginTop: 6, lineHeight: 1.5 }}>
                        En laissant votre email, vous acceptez d'être recontacté par Inspexo à ce sujet.
                        Lien de désinscription dans chaque email.
                      </div>
                      {waitState === 'error' && (
                        <div style={{ fontSize: '0.8125rem', color: '#B91C1C', marginTop: 6 }}>
                          Enregistrement impossible (adresse invalide ou limite atteinte). Réessayez plus tard.
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

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

              {/* Usage (facultatif) : affine la vigilance FAP/EGR sur les diesels */}
              <div style={{ margin: '0 0 16px' }}>
                <div style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.8125rem',
                  fontWeight: 600, color: '#374151', marginBottom: 8,
                }}>
                  Votre usage (facultatif)
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[['ville', 'Surtout ville'], ['mixte', 'Mixte'], ['route', 'Surtout route']].map(([val, label]) => (
                    <button
                      key={val} type="button"
                      onClick={() => setUsage(usage === val ? null : val)}
                      style={{
                        fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.8125rem',
                        fontWeight: 600, cursor: 'pointer', borderRadius: 100, padding: '8px 16px',
                        border: usage === val ? '1.5px solid #FF4D00' : '1.5px solid rgba(0,0,0,0.12)',
                        background: usage === val ? '#FFF0EA' : '#fff',
                        color: usage === val ? '#C2410C' : '#374151',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {captchaRequis && (
                <div style={{ marginBottom: 12 }}>
                  <Turnstile onToken={setCaptchaToken} action="score" />
                </div>
              )}
              <button type="submit" className="score-submit" disabled={!text.trim() || overLimit}>
                <IconeLoupe size={18} /> Analyser gratuitement
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
