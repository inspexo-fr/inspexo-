import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import MissionChat from '../components/MissionChat'

const STATUS_CONFIG = {
  paid:            { label: 'Payé',           bg: '#FFF4EE', color: '#FF4D00',  dot: '#FF4D00' },
  expert_assigned: { label: 'Assignée',       bg: '#EFF6FF', color: '#3B82F6',  dot: '#3B82F6' },
  in_progress:     { label: 'En cours',       bg: '#EFF6FF', color: '#1D4ED8',  dot: '#1D4ED8' },
  completed:       { label: 'Terminée',       bg: '#F0FDF4', color: '#16A34A',  dot: '#22C55E' },
  cancelled:       { label: 'Annulée',        bg: '#FEF2F2', color: '#DC2626',  dot: '#EF4444' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.paid
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: cfg.bg, color: cfg.color,
      padding: '4px 12px', borderRadius: 100,
      fontSize: '0.75rem', fontWeight: 600,
      fontFamily: 'Plus Jakarta Sans, sans-serif',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const TIER_LABELS = {
  visio:      { label: 'Visio Test Drive',    emoji: '📹' },
  inspection: { label: 'Inspection Physique', emoji: '🔧' },
}

export default function ExpertDashboard() {
  const [expert, setExpert]           = useState(null)
  const [missions, setMissions]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [authLoading, setAuthLoading] = useState(true)
  const [error, setError]             = useState(null)
  const [chatMission, setChatMission] = useState(null)
  const [clientEmails, setClientEmails] = useState({}) // missionId → email

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setAuthLoading(false)
        return
      }
      // Fetch expert profile
      const { data } = await supabase
        .from('experts')
        .select('*')
        .eq('email', session.user.email)
        .maybeSingle()
      setExpert(data || null)
      setAuthLoading(false)
    })
  }, [])

  const fetchMissions = useCallback(async () => {
    if (!expert) return
    setLoading(true); setError(null)
    const { data, error: err } = await supabase
      .from('missions')
      .select('*')
      .eq('expert_id', expert.id)
      .order('created_at', { ascending: false })
    if (err) {
      setError('Impossible de charger les missions.')
    } else {
      setMissions(data || [])
      // Fetch client emails
      const userIds = [...new Set((data || []).map(m => m.user_id).filter(Boolean))]
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', userIds)
        if (profiles) {
          const map = {}
          profiles.forEach(p => { map[p.id] = p.email })
          // Build missionId → email
          const missionEmailMap = {}
          ;(data || []).forEach(m => {
            if (m.user_id && map[m.user_id]) {
              missionEmailMap[m.id] = map[m.user_id]
            }
          })
          setClientEmails(missionEmailMap)
        }
      }
    }
    setLoading(false)
  }, [expert])

  useEffect(() => {
    if (expert) fetchMissions()
  }, [expert, fetchMissions])

  // ── Auth loading ──────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0F1B2D',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 36, height: 36,
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#FF4D00',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Not logged in ─────────────────────────────────────────────────────────
  if (!expert) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0F1B2D',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{
          background: '#fff', borderRadius: 20, padding: '48px 40px',
          maxWidth: 440, width: '100%', textAlign: 'center',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔒</div>
          <div style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 800,
            fontSize: '1.5rem', color: '#0F1B2D', marginBottom: 12,
          }}>
            Accès réservé aux experts
          </div>
          <p style={{ color: '#6B7280', fontSize: '0.9375rem', lineHeight: 1.65, marginBottom: 28 }}>
            Connectez-vous avec votre compte expert Inspexo pour accéder à votre espace.
          </p>
          <button
            onClick={async () => {
              const email = prompt('Votre email expert :')
              if (!email) return
              const password = prompt('Votre mot de passe :')
              if (!password) return
              const { error } = await supabase.auth.signInWithPassword({ email, password })
              if (error) alert('Erreur : ' + error.message)
              else window.location.reload()
            }}
            style={{
              background: '#FF4D00', color: '#fff',
              border: 'none', borderRadius: 10,
              padding: '12px 28px', cursor: 'pointer',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '0.9375rem', fontWeight: 700,
            }}
          >
            Se connecter
          </button>
        </div>
      </div>
    )
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  const active    = missions.filter(m => ['paid','expert_assigned','in_progress'].includes(m.status))
  const completed = missions.filter(m => m.status === 'completed')

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F8F9FA; }
        .expert-card {
          background: #fff;
          border: 1.5px solid rgba(0,0,0,0.07);
          border-radius: 16px; padding: 24px 28px;
          transition: box-shadow 0.2s, transform 0.2s;
          cursor: pointer;
        }
        .expert-card:hover { box-shadow: 0 8px 32px rgba(15,27,45,0.1); transform: translateY(-2px); }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .exp-header { padding: 24px 20px 20px !important; }
          .exp-body   { padding: 20px !important; }
          .exp-meta   { flex-direction: column !important; gap: 8px !important; }
          .exp-row    { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
        }
      `}</style>

      {/* Header */}
      <div className="exp-header" style={{
        background: '#0F1B2D', padding: '32px 36px 28px',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <a href="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            color: 'rgba(255,255,255,0.45)',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: '0.8125rem', textDecoration: 'none',
            marginBottom: 20,
          }}>
            ← Retour au site
          </a>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.8125rem', fontWeight: 600,
                color: 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
              }}>
                Espace Expert
              </div>
              <div style={{
                fontFamily: 'Syne, sans-serif', fontWeight: 800,
                fontSize: '1.75rem', color: '#fff', marginBottom: 4,
              }}>
                {expert.full_name || expert.email}
              </div>
              <div style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.875rem', fontWeight: 300,
                color: 'rgba(255,255,255,0.45)',
              }}>
                {Array.isArray(expert.brands) ? expert.brands.join(', ') : expert.brands || ''}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 24 }}>
              {[
                { label: 'Total', value: missions.length },
                { label: 'En cours', value: active.length },
                { label: 'Terminées', value: completed.length },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{
                    fontFamily: 'Syne, sans-serif', fontWeight: 800,
                    fontSize: '1.5rem', color: '#fff', lineHeight: 1,
                  }}>
                    {s.value}
                  </div>
                  <div style={{
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: 4,
                  }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="exp-body" style={{ maxWidth: 800, margin: '0 auto', padding: '32px 36px' }}>

        {loading && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div style={{
              width: 36, height: 36,
              border: '3px solid rgba(15,27,45,0.1)',
              borderTopColor: '#FF4D00',
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
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

        {!loading && !error && missions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>📋</div>
            <div style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 800,
              fontSize: '1.25rem', color: '#0F1B2D', marginBottom: 10,
            }}>
              Aucune mission pour l'instant
            </div>
            <div style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '0.9375rem', fontWeight: 300,
              color: '#6B7280', lineHeight: 1.65,
            }}>
              Vos missions apparaîtront ici dès qu'un acheteur vous sera assigné.
            </div>
          </div>
        )}

        {!loading && !error && missions.length > 0 && (
          <>
            {/* Active missions */}
            {active.length > 0 && (
              <div style={{ marginBottom: 40 }}>
                <div style={{
                  fontFamily: 'Syne, sans-serif', fontWeight: 800,
                  fontSize: '1.125rem', color: '#0F1B2D', marginBottom: 16,
                }}>
                  Missions en cours ({active.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {active.map(m => <MissionCard key={m.id} mission={m} clientEmail={clientEmails[m.id]} onChat={setChatMission} />)}
                </div>
              </div>
            )}

            {/* Completed missions */}
            {completed.length > 0 && (
              <div>
                <div style={{
                  fontFamily: 'Syne, sans-serif', fontWeight: 800,
                  fontSize: '1.125rem', color: '#0F1B2D', marginBottom: 16,
                }}>
                  Missions terminées ({completed.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {completed.map(m => <MissionCard key={m.id} mission={m} clientEmail={clientEmails[m.id]} onChat={setChatMission} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Chat */}
      {chatMission && (
        <MissionChat
          mission={chatMission}
          currentUser={expert}
          senderRole="expert"
          recipientEmail={clientEmails[chatMission.id] || null}
          recipientName="le client"
          onClose={() => setChatMission(null)}
        />
      )}
    </>
  )
}

function MissionCard({ mission, clientEmail, onChat }) {
  const tier = TIER_LABELS[mission.tier] || { label: mission.tier || '—', emoji: '📋' }
  const vehicle = [mission.vehicle_brand, mission.vehicle_model, mission.vehicle_year].filter(Boolean).join(' ')

  return (
    <div className="expert-card" onClick={() => onChat(mission)}>
      <div className="exp-row" style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.5rem' }}>{tier.emoji}</span>
          <div>
            <div style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 800,
              fontSize: '1rem', color: '#0F1B2D',
            }}>
              {vehicle || tier.label}
            </div>
            <div style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '0.8125rem', color: '#9CA3AF', fontWeight: 300,
            }}>
              {tier.label} · {formatDate(mission.created_at)}
            </div>
          </div>
        </div>
        <StatusBadge status={mission.status} />
      </div>

      <div className="exp-meta" style={{
        display: 'flex', gap: 20, flexWrap: 'wrap',
        padding: '12px 14px',
        background: '#F8F9FA', borderRadius: 10,
        marginBottom: 14,
      }}>
        {[
          { label: 'Véhicule', value: vehicle || '—' },
          { label: 'Client',   value: clientEmail || '—' },
        ].map((item, i) => (
          <div key={i}>
            <div style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '0.6875rem', fontWeight: 600,
              color: '#9CA3AF', textTransform: 'uppercase',
              letterSpacing: '0.08em', marginBottom: 2,
            }}>
              {item.label}
            </div>
            <div style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '0.875rem', fontWeight: 600, color: '#0F1B2D',
            }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: '#FFF4EE', color: '#FF4D00',
        border: '1px solid rgba(255,77,0,0.2)',
        padding: '7px 14px', borderRadius: 8,
        fontSize: '0.8125rem', fontWeight: 700,
        fontFamily: 'Plus Jakarta Sans, sans-serif',
      }}>
        💬 Ouvrir le chat
      </div>
    </div>
  )
}
