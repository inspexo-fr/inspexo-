import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import ChatIA from '../components/ChatIA'
import CalBooking from '../components/CalBooking'
import ReviewModal from '../components/ReviewModal'

const TIER_LABELS = {
  ia_free:          { label: 'Analyse IA gratuite',    emoji: '💬' },
  ia:               { label: 'Analyse IA complète',    emoji: '💬' },
  visio:            { label: 'Visio Test Drive',        emoji: '📹' },
  inspection:       { label: 'Inspection Physique',     emoji: '🔧' },
  inspection_nego:  { label: 'Inspection + Négociation', emoji: '🔧' },
}

function getTierMeta(tier) {
  return TIER_LABELS[tier] || { label: tier || '—', emoji: '📋' }
}

const STATUS_CONFIG = {
  pending_payment: { label: 'En attente de paiement', bg: '#F3F4F6', color: '#6B7280',  dot: '#9CA3AF' },
  paid:            { label: 'Payé',                   bg: '#FFF4EE', color: '#FF4D00',  dot: '#FF4D00' },
  expert_assigned: { label: 'Expert assigné',         bg: '#EFF6FF', color: '#3B82F6',  dot: '#3B82F6' },
  in_progress:     { label: 'En cours',               bg: '#EFF6FF', color: '#1D4ED8',  dot: '#1D4ED8' },
  completed:       { label: 'Terminé',                bg: '#F0FDF4', color: '#16A34A',  dot: '#22C55E' },
  cancelled:       { label: 'Annulé',                 bg: '#FEF2F2', color: '#DC2626',  dot: '#EF4444' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending_payment
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: cfg.bg, color: cfg.color,
      padding: '4px 12px', borderRadius: 100,
      fontSize: '0.75rem', fontWeight: 600,
      fontFamily: 'Plus Jakarta Sans, sans-serif',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: cfg.dot, flexShrink: 0,
      }} />
      {cfg.label}
    </span>
  )
}

function formatDate(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export default function ClientDashboard({ isOpen, onClose, user }) {
  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeChatMission, setActiveChatMission]       = useState(null)
  const [activeBookingMission, setActiveBookingMission] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm]       = useState(false)
  const [reviewMission, setReviewMission]               = useState(null)

  const fetchMissions = useCallback(() => {
    if (!user) return
    setLoading(true); setError(null)
    supabase
      .from('missions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          console.error('missions fetch error:', err)
          setError('Impossible de charger vos missions.')
        } else {
          setMissions(data || [])
        }
        setLoading(false)
      })
  }, [user])

  // Fetch missions on open
  useEffect(() => {
    if (!isOpen || !user) return
    fetchMissions()
  }, [isOpen, user, fetchMissions])

  // Scroll lock
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Escape
  const handleKeyDown = useCallback(e => { if (e.key === 'Escape') onClose() }, [onClose])
  useEffect(() => {
    if (isOpen) window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <>
      <style>{`
        .mission-card {
          background: #fff;
          border: 1.5px solid rgba(0,0,0,0.07);
          border-radius: 16px; padding: 24px 28px;
          transition: box-shadow 0.2s, transform 0.2s;
        }
        .mission-card:hover { box-shadow: 0 8px 32px rgba(15,27,45,0.08); transform: translateY(-2px); }
        .dashboard-scroll::-webkit-scrollbar { width: 5px; }
        .dashboard-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 10px; }
        .report-btn {
          display: inline-flex; align-items: center; gap: 6px;
          background: #0F1B2D; color: #fff;
          padding: 8px 18px; border-radius: 8px;
          font-size: 0.8125rem; font-weight: 700;
          font-family: 'Plus Jakarta Sans', sans-serif;
          text-decoration: none; border: none; cursor: pointer;
          transition: opacity 0.2s;
        }
        .report-btn:hover { opacity: 0.85; }
        @keyframes db-overlay-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes db-slide-in {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @media (max-width: 640px) {
          .mission-meta-grid { flex-direction: column !important; gap: 8px !important; }
          .mission-header-row { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
          .dashboard-panel { max-width: 100% !important; }
          .dashboard-header { padding: 24px 20px 20px !important; }
          .dashboard-body { padding: 20px !important; }
          .report-btn { width: 100% !important; justify-content: center !important; }
        }
      `}</style>

      {/* Full-page overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 250,
        background: 'rgba(8,14,24,0.6)',
        display: 'flex', justifyContent: 'flex-end',
        animation: 'db-overlay-in 0.2s ease',
      }}
        onClick={onClose}
      >
        {/* Panel */}
        <div
          onClick={e => e.stopPropagation()}
          className="dashboard-scroll dashboard-panel"
          style={{
            width: '100%', maxWidth: 720,
            height: '100%', overflowY: 'auto',
            background: '#F8F9FA',
            boxShadow: '-8px 0 48px rgba(0,0,0,0.2)',
            display: 'flex', flexDirection: 'column',
            animation: 'db-slide-in 0.3s ease',
          }}
        >
          {/* Header */}
          <div className="dashboard-header" style={{
            background: '#0F1B2D',
            padding: '32px 36px 28px',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.8125rem', fontWeight: 600,
                  color: 'rgba(255,255,255,0.4)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  marginBottom: 8,
                }}>
                  Espace client
                </div>
                <div style={{
                  fontFamily: 'Syne, sans-serif', fontWeight: 800,
                  fontSize: '1.75rem', color: '#fff', marginBottom: 6,
                }}>
                  Mes missions
                </div>
                <div style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.875rem', fontWeight: 300,
                  color: 'rgba(255,255,255,0.45)',
                }}>
                  {user?.email}
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '1rem', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s',
                }}
              >
                ✕
              </button>
            </div>

            {/* Stats summary */}
            {!loading && missions.length > 0 && (
              <div style={{
                display: 'flex', gap: 24, marginTop: 24, flexWrap: 'wrap',
              }}>
                {[
                  { label: 'Total', value: missions.length },
                  { label: 'En cours', value: missions.filter(m => ['paid','expert_assigned','in_progress'].includes(m.status)).length },
                  { label: 'Terminées', value: missions.filter(m => m.status === 'completed').length },
                ].map((s, i) => (
                  <div key={i}>
                    <div style={{
                      fontFamily: 'Syne, sans-serif', fontWeight: 800,
                      fontSize: '1.5rem', color: '#fff', lineHeight: 1,
                    }}>
                      {s.value}
                    </div>
                    <div style={{
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)',
                      marginTop: 4,
                    }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Body */}
          <div className="dashboard-body" style={{ padding: '32px 36px', flexGrow: 1 }}>

            {/* Loading */}
            {loading && (
              <div style={{ textAlign: 'center', padding: '64px 0' }}>
                <div style={{
                  width: 36, height: 36,
                  border: '3px solid rgba(15,27,45,0.1)',
                  borderTopColor: '#FF4D00',
                  borderRadius: '50%',
                  animation: 'auth-spin 0.7s linear infinite',
                  margin: '0 auto 16px',
                }} />
                <div style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.9375rem', color: '#6B7280',
                }}>
                  Chargement de vos missions...
                </div>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: 12, padding: '20px 24px',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.9375rem', color: '#DC2626',
              }}>
                ⚠️ {error}
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && missions.length === 0 && (
              <div style={{ textAlign: 'center', padding: '64px 24px' }}>
                <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔍</div>
                <div style={{
                  fontFamily: 'Syne, sans-serif', fontWeight: 800,
                  fontSize: '1.25rem', color: '#0F1B2D', marginBottom: 10,
                }}>
                  Aucune mission pour l'instant
                </div>
                <div style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.9375rem', fontWeight: 300,
                  color: '#6B7280', lineHeight: 1.65, marginBottom: 28,
                }}>
                  Vous n'avez pas encore de mission. Faites inspecter votre premier véhicule !
                </div>
                <button
                  onClick={onClose}
                  style={{
                    background: '#FF4D00', color: '#fff',
                    padding: '12px 28px', borderRadius: 10,
                    fontSize: '0.9375rem', fontWeight: 700,
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  Voir les services →
                </button>
              </div>
            )}

            {/* Mission list */}
            {!loading && !error && missions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {missions.map((mission) => {
                  const tier = getTierMeta(mission.tier)
                  const isIaTier = mission.tier === 'ia' || mission.tier === 'ia_free'
                  return (
                    <div key={mission.id} className="mission-card">
                      {/* Top row */}
                      <div className="mission-header-row" style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', marginBottom: 16,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: '1.5rem' }}>{tier.emoji}</span>
                          <div>
                            <div style={{
                              fontFamily: 'Syne, sans-serif', fontWeight: 800,
                              fontSize: '1rem', color: '#0F1B2D',
                            }}>
                              {tier.label}
                            </div>
                            <div style={{
                              fontFamily: 'Plus Jakarta Sans, sans-serif',
                              fontSize: '0.8125rem', color: '#9CA3AF',
                              fontWeight: 300,
                            }}>
                              {formatDate(mission.created_at)}
                            </div>
                          </div>
                        </div>
                        <StatusBadge status={mission.status} />
                      </div>

                      {/* Vehicle details */}
                      <div className="mission-meta-grid" style={{
                        display: 'flex', gap: 20, flexWrap: 'wrap',
                        padding: '14px 16px',
                        background: '#F8F9FA', borderRadius: 10,
                        marginBottom: 16,
                      }}>
                        {[
                          { label: 'Véhicule', value: `${mission.vehicle_brand || ''} ${mission.vehicle_model || ''}`.trim() || '—' },
                          { label: 'Année',    value: mission.vehicle_year || '—' },
                          { label: 'Prix',     value: mission.is_free ? 'Gratuit' : (mission.price_total ? `${mission.price_total}€` : '—') },
                        ].map((item, i) => (
                          <div key={i}>
                            <div style={{
                              fontFamily: 'Plus Jakarta Sans, sans-serif',
                              fontSize: '0.6875rem', fontWeight: 600,
                              color: '#9CA3AF', textTransform: 'uppercase',
                              letterSpacing: '0.08em', marginBottom: 3,
                            }}>
                              {item.label}
                            </div>
                            <div style={{
                              fontFamily: 'Plus Jakarta Sans, sans-serif',
                              fontSize: '0.9375rem', fontWeight: 600,
                              color: '#0F1B2D',
                            }}>
                              {item.value}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Annonce link */}
                      {mission.vehicle_url && (
                        <div style={{ marginBottom: 12 }}>
                          <a
                            href={mission.vehicle_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontFamily: 'Plus Jakarta Sans, sans-serif',
                              fontSize: '0.8125rem', fontWeight: 500,
                              color: '#FF4D00', textDecoration: 'none',
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            🔗 Voir l'annonce
                          </a>
                        </div>
                      )}

                      {/* Bouton réserver créneau — visio/inspection payés */}
                      {(mission.tier === 'visio' || mission.tier === 'inspection') && mission.status === 'paid' && (
                        <div style={{ marginTop: mission.vehicle_url ? 0 : 4 }}>
                          <button
                            onClick={() => setActiveBookingMission(mission)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 7,
                              background: '#FFF4EE',
                              color: '#FF4D00',
                              border: '1px solid rgba(255,77,0,0.25)',
                              padding: '8px 18px', borderRadius: 8,
                              fontSize: '0.8125rem', fontWeight: 700,
                              fontFamily: 'Plus Jakarta Sans, sans-serif',
                              cursor: 'pointer', transition: 'opacity 0.2s',
                            }}
                          >
                            📅 Réserver mon créneau
                          </button>
                        </div>
                      )}

                      {/* Bouton chat IA */}
                      {isIaTier && (
                        <div style={{ marginTop: mission.vehicle_url ? 0 : 4 }}>
                          <button
                            onClick={() => setActiveChatMission(mission)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 7,
                              background: mission.status === 'completed'
                                ? '#F0FDF4' : '#FFF4EE',
                              color: mission.status === 'completed'
                                ? '#16A34A' : '#FF4D00',
                              border: `1px solid ${mission.status === 'completed' ? '#BBF7D0' : 'rgba(255,77,0,0.25)'}`,
                              padding: '8px 18px', borderRadius: 8,
                              fontSize: '0.8125rem', fontWeight: 700,
                              fontFamily: 'Plus Jakarta Sans, sans-serif',
                              cursor: 'pointer', transition: 'opacity 0.2s',
                            }}
                          >
                            {mission.status === 'completed' ? '📋 Voir le rapport' : '💬 Ouvrir le chat IA'}
                          </button>
                        </div>
                      )}

                      {/* Report (palier visio/inspection) */}
                      {mission.tier !== 'ia' && mission.report_url && (
                        <a
                          href={mission.report_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="report-btn"
                        >
                          📄 Voir le rapport
                        </a>
                      )}

                      {/* Bouton avis — visio/inspection terminées avec expert */}
                      {mission.status === 'completed' && mission.expert_id && (
                        mission.review_submitted ? (
                          <div style={{
                            marginTop: 10,
                            fontFamily: 'Plus Jakarta Sans, sans-serif',
                            fontSize: '0.8125rem', color: '#9CA3AF',
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                          }}>
                            ✅ Avis envoyé
                          </div>
                        ) : (
                          <div style={{ marginTop: 10 }}>
                            <button
                              onClick={() => setReviewMission(mission)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                background: '#FFFBEB',
                                color: '#92400E',
                                border: '1px solid rgba(251,191,36,0.3)',
                                padding: '8px 18px', borderRadius: 8,
                                fontSize: '0.8125rem', fontWeight: 700,
                                fontFamily: 'Plus Jakarta Sans, sans-serif',
                                cursor: 'pointer', transition: 'opacity 0.2s',
                              }}
                            >
                              ⭐ Laisser un avis
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Suppression de compte */}
          <div style={{ marginTop: 48, paddingTop: 28, borderTop: '1px solid rgba(0,0,0,0.07)', textAlign: 'center' }}>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                background: 'none', border: 'none',
                color: '#9CA3AF', cursor: 'pointer',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.8125rem', fontWeight: 500,
                textDecoration: 'underline', padding: 0,
              }}
            >
              Supprimer mon compte
            </button>
          </div>
        </div>
      </div>

      {/* Modale confirmation suppression */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, padding: '36px 32px',
            maxWidth: 420, width: '100%', textAlign: 'center',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>🗑️</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.25rem', color: '#0F1B2D', marginBottom: 10 }}>
              Supprimer mon compte
            </div>
            <p style={{ fontSize: '0.9rem', color: '#6B7280', lineHeight: 1.65, marginBottom: 24 }}>
              Pour supprimer votre compte et toutes vos données, envoyez une demande à{' '}
              <a href={`mailto:contact@inspexo.io?subject=Demande%20de%20suppression%20de%20compte&body=Bonjour%2C%0A%0AJe%20souhaite%20supprimer%20mon%20compte%20Inspexo%20associ%C3%A9%20%C3%A0%20l%27adresse%20${encodeURIComponent(user?.email || '')}.%0A%0AMerci.`}
                style={{ color: '#FF4D00', fontWeight: 600 }}>
                contact@inspexo.io
              </a>
              . Nous traiterons votre demande sous 30 jours.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  background: '#F3F4F6', color: '#0F1B2D',
                  border: 'none', borderRadius: 10,
                  padding: '10px 24px', cursor: 'pointer',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.875rem', fontWeight: 600,
                }}
              >
                Annuler
              </button>
              <a
                href={`mailto:contact@inspexo.io?subject=Demande%20de%20suppression%20de%20compte&body=Bonjour%2C%0A%0AJe%20souhaite%20supprimer%20mon%20compte%20Inspexo%20associ%C3%A9%20%C3%A0%20l%27adresse%20${encodeURIComponent(user?.email || '')}.%0A%0AMerci.`}
                style={{
                  background: '#DC2626', color: '#fff',
                  border: 'none', borderRadius: 10,
                  padding: '10px 24px', cursor: 'pointer',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.875rem', fontWeight: 700,
                  textDecoration: 'none', display: 'inline-block',
                }}
              >
                Envoyer la demande
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Cal.com réservation */}
      {activeBookingMission && (
        <CalBooking
          tier={activeBookingMission.tier}
          onClose={() => setActiveBookingMission(null)}
        />
      )}

      {/* Chat IA plein écran */}
      {activeChatMission && (
        <ChatIA
          mission={activeChatMission}
          onClose={() => setActiveChatMission(null)}
          onMissionUpdate={() => {
            fetchMissions()
            setActiveChatMission(prev => prev
              ? { ...prev, status: 'completed' }
              : null
            )
          }}
        />
      )}

      {/* Modale avis */}
      {reviewMission && (
        <ReviewModal
          mission={reviewMission}
          onClose={() => setReviewMission(null)}
          onSubmitted={() => {
            setReviewMission(null)
            fetchMissions()
          }}
        />
      )}
    </>
  )
}
