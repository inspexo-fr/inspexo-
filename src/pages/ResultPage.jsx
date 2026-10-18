import React, { useEffect, useState } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { getPublicAnalysis, fetchRappels, submitLead, trackEvent } from '../lib/scoreApi'

const VERDICT_STYLE = {
  vert:   { color: '#16A34A', bg: '#F0FDF4', border: 'rgba(22,163,74,0.3)',  emoji: '🟢', label: 'Feu vert' },
  orange: { color: '#D97706', bg: '#FFFBEB', border: 'rgba(217,119,6,0.3)',  emoji: '🟠', label: 'Prudence' },
  rouge:  { color: '#DC2626', bg: '#FEF2F2', border: 'rgba(220,38,38,0.3)',  emoji: '🔴', label: 'Signaux rouges' },
}

const GRAVITE_STYLE = {
  securite: { label: 'Sécurité',  color: '#DC2626', bg: '#FEF2F2' },
  majeure:  { label: 'Majeure',   color: '#D97706', bg: '#FFFBEB' },
  mineure:  { label: 'Mineure',   color: '#6B7280', bg: '#F0F2F5' },
}

const CONFIANCE_LABEL = { haute: 'confiance haute', moyenne: 'confiance moyenne', basse: 'confiance basse' }

const CONSENT_TEXT = 'En laissant votre email, vous acceptez d\'être recontacté par Inspexo à ce sujet. Lien de désinscription dans chaque email.'

function EmailCapture({ title, buttonLabel, source, analysisId }) {
  const [email, setEmail]   = useState('')
  const [state, setState]   = useState('idle') // idle | sending | done | error

  const submit = async (e) => {
    e.preventDefault()
    if (!email || state === 'sending') return
    setState('sending')
    try {
      await submitLead(email, source, analysisId)
      setState('done')
    } catch (_) {
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div style={{
        fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.875rem',
        fontWeight: 600, color: '#16A34A', padding: '10px 0',
      }}>
        ✓ C'est noté ! Vous recevrez un email à cette adresse.
      </div>
    )
  }

  return (
    <form onSubmit={submit}>
      <div style={{
        fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.875rem',
        fontWeight: 600, color: '#0F1B2D', marginBottom: 8,
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="email" required placeholder="votre@email.com"
          value={email} onChange={e => setEmail(e.target.value)}
          style={{
            flex: '1 1 180px', boxSizing: 'border-box',
            border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 8,
            padding: '11px 14px', fontSize: 16,
            fontFamily: 'Plus Jakarta Sans, sans-serif', outline: 'none',
          }}
        />
        <button type="submit" disabled={state === 'sending'} style={{
          background: '#0F1B2D', color: '#fff', border: 'none',
          borderRadius: 8, padding: '11px 18px', cursor: 'pointer',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: '0.875rem', fontWeight: 700, whiteSpace: 'nowrap',
          opacity: state === 'sending' ? 0.6 : 1,
        }}>
          {state === 'sending' ? '…' : buttonLabel}
        </button>
      </div>
      {state === 'error' && (
        <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.8125rem', color: '#DC2626', marginTop: 6 }}>
          Email invalide ou erreur réseau — réessayez.
        </div>
      )}
      <div style={{
        marginTop: 8, fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: '0.6875rem', color: '#9CA3AF', lineHeight: 1.5,
      }}>
        {CONSENT_TEXT}
      </div>
    </form>
  )
}

function SectionTitle({ children }) {
  return (
    <h2 style={{
      fontFamily: 'Syne, sans-serif', fontWeight: 800,
      fontSize: '1.125rem', color: '#0F1B2D', margin: '0 0 14px',
    }}>
      {children}
    </h2>
  )
}

function Card({ children, style }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      border: '1.5px solid rgba(0,0,0,0.07)',
      padding: '22px 20px', marginBottom: 16,
      ...style,
    }}>
      {children}
    </div>
  )
}

export default function ResultPage() {
  const { id } = useParams()
  const location = useLocation()

  const [analysis, setAnalysis]   = useState(null) // { result, marque, modele, annee, ... }
  const [notFound, setNotFound]   = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [rappels, setRappels]     = useState(undefined) // undefined = chargement
  const [shareDone, setShareDone] = useState(false)

  // Chargement de l'analyse (state de navigation ou RPC publique)
  useEffect(() => {
    window.scrollTo(0, 0)
    let cancelled = false
    async function load() {
      if (location.state?.result) {
        const r = location.state.result
        setAnalysis({
          id,
          result: r,
          marque: r.vehicule?.marque ?? null,
          modele: r.vehicule?.modele ?? null,
          annee: r.vehicule?.annee ?? null,
        })
        return
      }
      try {
        const row = await getPublicAnalysis(id)
        if (cancelled) return
        if (!row) { setNotFound(true); return }
        setAnalysis({
          id: row.id,
          result: row.result_json,
          marque: row.marque,
          modele: row.modele,
          annee: row.annee,
        })
      } catch (_) {
        if (!cancelled) setLoadError(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Rappels constructeur + Takata
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

  // ---------------- États intermédiaires ----------------
  if (notFound || loadError) {
    return (
      <>
        <Navbar />
        <main style={{ background: '#F8F9FA', minHeight: '100vh', padding: '140px 24px' }}>
          <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>🔍</div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: '#0F1B2D', marginBottom: 12 }}>
              {notFound ? 'Analyse introuvable' : 'Erreur de chargement'}
            </h1>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#6B7280', marginBottom: 24 }}>
              {notFound
                ? 'Ce lien ne correspond à aucune analyse. Il a peut-être été mal copié.'
                : 'Impossible de charger cette analyse. Vérifiez votre connexion et réessayez.'}
            </p>
            <Link to="/score" style={{
              display: 'inline-block', background: '#FF4D00', color: '#fff',
              borderRadius: 10, padding: '13px 26px', textDecoration: 'none',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: '0.9375rem',
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
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </main>
      </>
    )
  }

  // ---------------- Rendu principal ----------------
  const r = analysis.result
  const vs = VERDICT_STYLE[r.verdict] || VERDICT_STYLE.orange
  const vehiculeLabel = [analysis.marque, analysis.modele].filter(Boolean).join(' ') || 'Véhicule non identifié'
  const ogTitle = `Verdict Inspexo : ${r.verdict} — ${vehiculeLabel}`
  const pageUrl = `https://www.inspexo.io/a/${id}`
  const takata = rappels?.takata

  return (
    <>
      <Helmet>
        <title>{ogTitle}</title>
        <meta name="robots" content="noindex" />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={(r.raisons || []).join(' · ')} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content="https://www.inspexo.io/og-image.png" />
        <meta name="twitter:card" content="summary" />
      </Helmet>

      <Navbar />

      <main style={{ background: '#F8F9FA', minHeight: '100vh' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '92px 16px 64px' }}>

          {/* ---------- Carte verdict ---------- */}
          <div style={{
            background: vs.bg, border: `1.5px solid ${vs.border}`,
            borderRadius: 18, padding: '26px 22px', marginBottom: 16,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap',
            }}>
              <div>
                <div style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.75rem', fontWeight: 600, color: '#6B7280',
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
                }}>
                  Verdict Inspexo
                </div>
                <h1 style={{
                  fontFamily: 'Syne, sans-serif', fontWeight: 800,
                  fontSize: 'clamp(1.5rem, 5.5vw, 2rem)', color: vs.color,
                  margin: 0, lineHeight: 1.1,
                }}>
                  {vs.emoji} {vs.label}
                </h1>
                <div style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.9375rem', fontWeight: 600, color: '#0F1B2D', marginTop: 8,
                }}>
                  {vehiculeLabel}
                  {r.vehicule?.motorisation ? ` · ${r.vehicule.motorisation}` : ''}
                  {analysis.annee ? ` · ${analysis.annee}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{
                  fontFamily: 'Syne, sans-serif', fontWeight: 800,
                  fontSize: '2.5rem', color: vs.color, lineHeight: 1,
                }}>
                  {r.score}
                </div>
                <div style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.6875rem', color: '#9CA3AF', fontWeight: 600,
                }}>
                  / 100
                </div>
              </div>
            </div>

            {(r.raisons || []).map((raison, i) => (
              <div key={i} style={{
                display: 'flex', gap: 10, padding: '7px 0',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.9375rem', color: '#0F1B2D', lineHeight: 1.55,
                borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none',
              }}>
                <span style={{ color: vs.color, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                {raison}
              </div>
            ))}

            {/* Boutons d'action */}
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <button onClick={handleShare} style={{
                flex: '1 1 140px', background: '#0F1B2D', color: '#fff',
                border: 'none', borderRadius: 10, padding: '13px 16px',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
              }}>
                {shareDone ? '✓ Lien copié !' : '🔗 Partager'}
              </button>
              <Link to="/score" style={{
                flex: '1 1 140px', textAlign: 'center',
                background: 'transparent', color: '#0F1B2D',
                border: '1.5px solid rgba(15,27,45,0.25)', borderRadius: 10,
                padding: '12px 16px', textDecoration: 'none',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.875rem', fontWeight: 700,
              }}>
                Analyser une autre annonce
              </Link>
            </div>
          </div>

          {/* ---------- Bandeau Takata ---------- */}
          {takata?.concerne && (
            <div style={{
              background: '#7F1D1D', borderRadius: 14,
              padding: '18px 20px', marginBottom: 16,
            }}>
              <div style={{
                fontFamily: 'Syne, sans-serif', fontWeight: 800,
                fontSize: '0.9375rem', color: '#fff', marginBottom: 6,
              }}>
                ⚠️ Airbags Takata
              </div>
              <div style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.875rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.6,
              }}>
                {takata.message}
              </div>
              <div style={{
                marginTop: 8, fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)',
              }}>
                Modèle listé : {takata.modele_takata} ({takata.periode}) ·{' '}
                <a href={takata.source} target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  Liste officielle du ministère
                </a>
              </div>
            </div>
          )}

          {/* ---------- Rappels constructeur ---------- */}
          <Card>
            <SectionTitle>📋 Rappels constructeur</SectionTitle>
            {rappels === undefined ? (
              <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.875rem', color: '#9CA3AF' }}>
                Vérification des rappels en cours…
              </div>
            ) : rappels === null || rappels.rappels === null ? (
              <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.6 }}>
                {analysis.marque && analysis.modele
                  ? 'La base RappelConso est momentanément indisponible. Vérifiez directement sur rappel.conso.gouv.fr.'
                  : 'Véhicule non identifié dans l\'annonce — impossible de vérifier les rappels.'}
              </div>
            ) : rappels.rappels.length === 0 ? (
              <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.875rem', color: '#16A34A', fontWeight: 600 }}>
                ✓ Aucun rappel trouvé pour {vehiculeLabel} dans la base RappelConso.
                <div style={{ color: '#9CA3AF', fontWeight: 400, marginTop: 4, fontSize: '0.75rem' }}>
                  Base officielle data.economie.gouv.fr — couvre les rappels publiés depuis avril 2021.
                </div>
              </div>
            ) : (
              <>
                {rappels.rappels.map((rap, i) => (
                  <div key={i} style={{
                    padding: '12px 0',
                    borderTop: i > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                  }}>
                    <div style={{
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: '0.875rem', fontWeight: 700, color: '#0F1B2D',
                      marginBottom: 4, textTransform: 'capitalize',
                    }}>
                      {rap.titre}
                    </div>
                    {rap.motif && (
                      <div style={{
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.55,
                        marginBottom: 6,
                        display: '-webkit-box', WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {rap.motif}
                      </div>
                    )}
                    <div style={{
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: '0.75rem', color: '#9CA3AF',
                      display: 'flex', gap: 12, flexWrap: 'wrap',
                    }}>
                      {rap.date && <span>{new Date(rap.date).toLocaleDateString('fr-FR')}</span>}
                      {rap.risques && <span style={{ color: '#D97706' }}>{rap.risques.replace(/\|/g, ', ')}</span>}
                      {rap.lien && (
                        <a href={rap.lien} target="_blank" rel="noopener noreferrer" style={{ color: '#1E4D8C' }}>
                          Fiche officielle →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                <div style={{
                  marginTop: 10, fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.6875rem', color: '#9CA3AF',
                }}>
                  Source : RappelConso (data.economie.gouv.fr) — vérifiez toujours avec le VIN auprès du constructeur.
                </div>
              </>
            )}
          </Card>

          {/* ---------- Pannes connues ---------- */}
          {(r.pannes_connues || []).length > 0 && (
            <Card>
              <SectionTitle>🔧 Points de défaillance connus</SectionTitle>
              {r.pannes_connues.map((p, i) => {
                const g = GRAVITE_STYLE[p.gravite] || GRAVITE_STYLE.mineure
                return (
                  <div key={i} style={{
                    padding: '14px 0',
                    borderTop: i > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        fontSize: '0.9375rem', fontWeight: 700, color: '#0F1B2D',
                      }}>
                        {p.titre}
                      </span>
                      <span style={{
                        background: g.bg, color: g.color,
                        borderRadius: 100, padding: '2px 10px',
                        fontSize: '0.6875rem', fontWeight: 700,
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>
                        {g.label}
                      </span>
                      <span style={{
                        background: '#F0F2F5', color: '#6B7280',
                        borderRadius: 100, padding: '2px 10px',
                        fontSize: '0.6875rem', fontWeight: 600,
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                      }}>
                        {CONFIANCE_LABEL[p.confiance] || p.confiance}
                      </span>
                    </div>
                    <div style={{
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.6, marginBottom: 6,
                    }}>
                      <strong style={{ color: '#374151' }}>Symptôme :</strong> {p.symptome}
                    </div>
                    <div style={{
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.6,
                    }}>
                      <strong style={{ color: '#374151' }}>À vérifier sur place :</strong> {p.verification_sur_place}
                    </div>
                  </div>
                )
              })}
            </Card>
          )}

          {/* ---------- Incohérences ---------- */}
          {(r.incoherences_annonce || []).length > 0 && (
            <Card style={{ borderColor: 'rgba(217,119,6,0.3)', background: '#FFFBEB' }}>
              <SectionTitle>⚠️ Incohérences relevées dans l'annonce</SectionTitle>
              {r.incoherences_annonce.map((inc, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 10, padding: '6px 0',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.875rem', color: '#78350F', lineHeight: 1.55,
                }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  {inc}
                </div>
              ))}
            </Card>
          )}

          {/* ---------- Questions au vendeur ---------- */}
          {(r.questions_au_vendeur || []).length > 0 && (
            <Card>
              <SectionTitle>💬 Questions à poser au vendeur</SectionTitle>
              {r.questions_au_vendeur.map((q, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 10, padding: '8px 0',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.875rem', color: '#374151', lineHeight: 1.55,
                  borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                }}>
                  <span style={{ color: '#FF4D00', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                  {q}
                </div>
              ))}
            </Card>
          )}

          {/* ---------- Prix ---------- */}
          {(r.prix?.commentaire || r.vehicule?.prix_affiche) && (
            <Card>
              <SectionTitle>💶 Prix</SectionTitle>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: r.prix?.commentaire ? 12 : 0 }}>
                {r.vehicule?.prix_affiche != null && (
                  <div>
                    <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.6875rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' }}>
                      Prix affiché
                    </div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.25rem', color: '#0F1B2D' }}>
                      {r.vehicule.prix_affiche.toLocaleString('fr-FR')} €
                    </div>
                  </div>
                )}
                {r.prix?.mediane_comparables != null && (
                  <div>
                    <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.6875rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' }}>
                      Médiane des comparables
                    </div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.25rem', color: '#1E4D8C' }}>
                      {r.prix.mediane_comparables.toLocaleString('fr-FR')} €
                    </div>
                  </div>
                )}
              </div>
              {r.prix?.commentaire && (
                <div style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.65,
                }}>
                  {r.prix.commentaire}
                </div>
              )}
            </Card>
          )}

          {/* ---------- Leads ---------- */}
          <Card>
            <EmailCapture
              title="📩 Recevoir ce rapport par email"
              buttonLabel="Recevoir"
              source="rapport"
              analysisId={id}
            />
          </Card>

          <Card style={{ background: '#FFF0EA', borderColor: 'rgba(255,77,0,0.25)' }}>
            <EmailCapture
              title="🚀 Le Pass achat arrive : accompagnement complet jusqu'à la signature. Être prévenu du lancement ?"
              buttonLabel="Être prévenu"
              source="pass_waitlist"
              analysisId={id}
            />
          </Card>

          {/* ---------- Mention ---------- */}
          <div style={{
            textAlign: 'center', padding: '18px 16px 0',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: '0.75rem', color: '#9CA3AF', lineHeight: 1.6,
          }}>
            Analyse automatique à partir du texte de l'annonce. Ne remplace pas un examen du véhicule.
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
