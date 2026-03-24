import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import useScrollLock from '../hooks/useScrollLock'

const ADMIN_EMAILS = ['contact@inspexo.io']

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL
const ANON_KEY     = process.env.REACT_APP_SUPABASE_ANON_KEY

const STATUS_LABELS = {
  pending_payment: 'En attente paiement',
  paid:            'Payé',
  expert_assigned: 'Expert assigné',
  in_progress:     'En cours',
  completed:       'Terminé',
  cancelled:       'Annulé',
}
const STATUS_COLORS = {
  pending_payment: '#9CA3AF',
  paid:            '#FF4D00',
  expert_assigned: '#3B82F6',
  in_progress:     '#1D4ED8',
  completed:       '#16A34A',
  cancelled:       '#DC2626',
}
const TIER_LABELS = { ia: 'IA 💬', visio: 'Visio 📹', inspection: 'Inspection 🔧' }
const APP_STATUS_LABELS = { pending: 'En attente', approved: 'Approuvée', rejected: 'Rejetée' }
const APP_STATUS_COLORS = { pending: '#FF4D00', approved: '#16A34A', rejected: '#DC2626' }

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function shortId(id) {
  return id ? id.slice(0, 8).toUpperCase() : '—'
}

async function adminFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
      'apikey':        ANON_KEY,
      ...(options.headers || {}),
    },
  })
  return res.json()
}

// ─── Onglet Missions ──────────────────────────────────────────────────────────

function MissionsTab() {
  const [missions, setMissions] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [updating, setUpdating] = useState(null)

  const fetchMissions = useCallback(async () => {
    setLoading(true); setError(null)
    const data = await adminFetch('admin-missions')
    if (data.error) { setError(data.error); setLoading(false); return }
    setMissions(data.missions || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchMissions() }, [fetchMissions])

  const updateStatus = async (id, status) => {
    setUpdating(id)
    const data = await adminFetch('admin-missions', {
      method: 'PATCH',
      body: JSON.stringify({ id, status }),
    })
    if (!data.error) {
      setMissions(prev => prev.map(m => m.id === id ? { ...m, status } : m))
    }
    setUpdating(null)
  }

  if (loading) return <Spinner label="Chargement des missions..." />
  if (error)   return <ErrorBox msg={error} />

  const totalCA = missions.reduce((sum, m) => sum + (m.price_platform || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <div style={styles.pageTitle}>Missions</div>
          <div style={styles.pageSub}>{missions.length} mission{missions.length !== 1 ? 's' : ''} — CA plateforme : <strong>{totalCA.toFixed(2)}€</strong></div>
        </div>
        <button onClick={fetchMissions} style={styles.refreshBtn}>↻ Actualiser</button>
      </div>

      {missions.length === 0 ? (
        <EmptyState icon="📋" title="Aucune mission" sub="Les missions apparaîtront ici après le premier paiement." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                {['ID', 'Client', 'Palier', 'Véhicule', 'Prix', 'Statut', 'Date', 'Actions'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {missions.map((m, i) => (
                <tr key={m.id} style={{ ...styles.tr, background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                  <td style={styles.td}>
                    <span style={styles.idBadge}>{shortId(m.id)}</span>
                  </td>
                  <td style={styles.td}>
                    <div style={{ fontSize: '0.875rem', color: '#0F1B2D', fontWeight: 500 }}>
                      {m.profiles?.email || m.user_id?.slice(0, 8) + '...'}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                      {TIER_LABELS[m.tier] || m.tier}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                      {[m.vehicle_brand, m.vehicle_model, m.vehicle_year].filter(Boolean).join(' ') || '—'}
                    </div>
                    {m.vehicle_url && (
                      <a href={m.vehicle_url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: '0.75rem', color: '#FF4D00', textDecoration: 'none' }}>
                        🔗 annonce
                      </a>
                    )}
                  </td>
                  <td style={styles.td}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F1B2D' }}>
                      {m.price_total ? `${m.price_total}€` : '—'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                      plat. {m.price_platform ?? '?'}€
                    </div>
                  </td>
                  <td style={styles.td}>
                    <select
                      value={m.status}
                      disabled={updating === m.id}
                      onChange={e => updateStatus(m.id, e.target.value)}
                      style={{
                        ...styles.select,
                        color: STATUS_COLORS[m.status] || '#6B7280',
                        opacity: updating === m.id ? 0.6 : 1,
                      }}
                    >
                      {Object.entries(STATUS_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td style={styles.td}>
                    <div style={{ fontSize: '0.8125rem', color: '#6B7280', whiteSpace: 'nowrap' }}>
                      {formatDate(m.created_at)}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <button
                      style={styles.actionBtn}
                      onClick={() => {
                        const expertId = prompt('UUID de l\'expert à assigner :')
                        if (expertId) adminFetch('admin-missions', {
                          method: 'PATCH',
                          body: JSON.stringify({ id: m.id, expert_id: expertId, status: 'expert_assigned' }),
                        }).then(() => fetchMissions())
                      }}
                    >
                      👤 Assigner
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Modale Stripe Connect ────────────────────────────────────────────────────

function StripeConnectModal({ url, accountId, expertEmail, onClose }) {
  useScrollLock()
  const [copied, setCopied]       = useState(false)
  const [sending, setSending]     = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState('')

  const handleCopy = () => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSendEmail = async () => {
    setSending(true); setEmailError('')
    const data = await adminFetch('send-email', {
      method: 'POST',
      body: JSON.stringify({
        to: expertEmail,
        template: 'expert_stripe_onboarding',
        data: { onboarding_url: url, expert_email: expertEmail },
      }),
    })
    setSending(false)
    if (data.error) setEmailError(data.error)
    else setEmailSent(true)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(15,27,45,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 20, padding: '36px 32px',
          maxWidth: 520, width: '100%',
          maxHeight: '90vh', overflowX: 'hidden', overflowY: 'auto',
          overscrollBehavior: 'contain',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.25rem', color: '#0F1B2D', marginBottom: 6 }}>
          🔗 Lien Stripe Connect généré
        </div>
        <div style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: 24 }}>
          Compte : <code style={{ background: '#F0F2F5', padding: '2px 6px', borderRadius: 4, fontSize: '0.8125rem' }}>{accountId}</code>
          {expertEmail && <span style={{ marginLeft: 8 }}>· {expertEmail}</span>}
        </div>

        {/* URL */}
        <div style={{
          background: '#F8F9FA', border: '1.5px solid rgba(0,0,0,0.08)',
          borderRadius: 10, padding: '12px 14px', marginBottom: 20,
          fontSize: '0.8125rem', color: '#374151', wordBreak: 'break-all',
          lineHeight: 1.5,
        }}>
          {url}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <button
            onClick={handleCopy}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 10,
              background: copied ? '#F0FDF4' : '#0F1B2D',
              color: copied ? '#16A34A' : '#fff',
              border: copied ? '1px solid #BBF7D0' : 'none',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700,
              fontSize: '0.9rem', cursor: 'pointer',
            }}
          >
            {copied ? '✓ Copié !' : '📋 Copier le lien'}
          </button>
          <button
            onClick={handleSendEmail}
            disabled={sending || emailSent || !expertEmail}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 10,
              background: emailSent ? '#F0FDF4' : '#FF4D00',
              color: emailSent ? '#16A34A' : '#fff',
              border: emailSent ? '1px solid #BBF7D0' : 'none',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700,
              fontSize: '0.9rem', cursor: sending || emailSent || !expertEmail ? 'not-allowed' : 'pointer',
              opacity: sending ? 0.7 : 1,
            }}
          >
            {emailSent ? '✓ Email envoyé' : sending ? 'Envoi...' : '📧 Envoyer par email'}
          </button>
        </div>

        {!expertEmail && (
          <div style={{ fontSize: '0.8125rem', color: '#F59E0B', marginBottom: 12 }}>
            ⚠️ Pas d'email associé — envoi impossible
          </div>
        )}
        {emailError && (
          <div style={{ fontSize: '0.8125rem', color: '#DC2626', marginBottom: 12 }}>
            ⚠️ {emailError}
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '10px', borderRadius: 10, border: 'none',
            background: 'transparent', color: 'rgba(0,0,0,0.3)',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.875rem', cursor: 'pointer',
          }}
        >
          Fermer
        </button>
      </div>
    </div>
  )
}

// ─── Onglet Candidatures ──────────────────────────────────────────────────────

function ApplicationsTab() {
  const [apps, setApps]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [updating, setUpdating]     = useState(null)
  const [generating, setGenerating] = useState(null)
  const [stripeModal, setStripeModal] = useState(null) // { url, account_id, email }

  const fetchApps = useCallback(async () => {
    setLoading(true); setError(null)
    const data = await adminFetch('admin-applications')
    if (data.error) { setError(data.error); setLoading(false); return }
    setApps(data.applications || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchApps() }, [fetchApps])

  const updateStatus = async (id, status) => {
    setUpdating(id)
    await adminFetch('admin-applications', {
      method: 'PATCH',
      body: JSON.stringify({ id, status }),
    })
    setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    setUpdating(null)
  }

  const generateStripeLink = async (a) => {
    setGenerating(a.id)
    const data = await adminFetch('create-connect-account', {
      method: 'POST',
      body: JSON.stringify({ expert_id: a.expert_id || a.id }),
    })
    setGenerating(null)
    if (data.error) {
      alert(`Erreur Stripe Connect : ${data.error}`)
      return
    }
    setStripeModal({ url: data.url, account_id: data.account_id, email: a.email })
  }

  if (loading) return <Spinner label="Chargement des candidatures..." />
  if (error)   return <ErrorBox msg={error} />

  const pending = apps.filter(a => a.status === 'pending').length

  return (
    <div>
      {stripeModal && (
        <StripeConnectModal
          url={stripeModal.url}
          accountId={stripeModal.account_id}
          expertEmail={stripeModal.email}
          onClose={() => setStripeModal(null)}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <div style={styles.pageTitle}>Candidatures experts</div>
          <div style={styles.pageSub}>{apps.length} candidature{apps.length !== 1 ? 's' : ''} — {pending} en attente</div>
        </div>
        <button onClick={fetchApps} style={styles.refreshBtn}>↻ Actualiser</button>
      </div>

      {apps.length === 0 ? (
        <EmptyState icon="🧑‍🔧" title="Aucune candidature" sub="Les candidatures experts apparaîtront ici." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                {['Candidat', 'Email', 'Marques', 'Expérience', 'Ville', 'Statut', 'Date', 'Actions'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {apps.map((a, i) => (
                <tr key={a.id} style={{ ...styles.tr, background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                  <td style={styles.td}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0F1B2D' }}>
                      {a.first_name} {a.last_name}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={{ fontSize: '0.8125rem', color: '#374151' }}>{a.email}</div>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 200 }}>
                      {(Array.isArray(a.brands) ? a.brands : []).slice(0, 4).map(b => (
                        <span key={b} style={styles.brandPill}>{b}</span>
                      ))}
                      {(a.brands?.length || 0) > 4 && (
                        <span style={{ ...styles.brandPill, background: '#F0F2F5' }}>+{a.brands.length - 4}</span>
                      )}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                      {a.experience_years ? `${a.experience_years} ans` : '—'}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={{ fontSize: '0.875rem', color: '#374151' }}>{a.city || '—'}</div>
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: APP_STATUS_COLORS[a.status] + '15',
                      color: APP_STATUS_COLORS[a.status] || '#6B7280',
                      padding: '4px 10px', borderRadius: 100,
                      fontSize: '0.75rem', fontWeight: 600,
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                    }}>
                      <span style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: APP_STATUS_COLORS[a.status] || '#9CA3AF',
                      }} />
                      {APP_STATUS_LABELS[a.status] || a.status}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={{ fontSize: '0.8125rem', color: '#6B7280', whiteSpace: 'nowrap' }}>
                      {formatDate(a.created_at)}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {a.status !== 'approved' && (
                        <button
                          disabled={updating === a.id}
                          onClick={() => updateStatus(a.id, 'approved')}
                          style={{ ...styles.actionBtn, background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}
                        >
                          ✓ Approuver
                        </button>
                      )}
                      {a.status !== 'rejected' && (
                        <button
                          disabled={updating === a.id}
                          onClick={() => updateStatus(a.id, 'rejected')}
                          style={{ ...styles.actionBtn, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
                        >
                          ✗ Rejeter
                        </button>
                      )}
                      {a.status === 'approved' && (
                        <button
                          disabled={generating === a.id}
                          onClick={() => generateStripeLink(a)}
                          style={{
                            ...styles.actionBtn,
                            background: generating === a.id ? '#F0F2F5' : '#EEF2FF',
                            color: '#4F46E5',
                            border: '1px solid #C7D2FE',
                            opacity: generating === a.id ? 0.7 : 1,
                          }}
                        >
                          {generating === a.id ? '⏳ Génération...' : '🔗 Stripe Connect'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Onglet Stats ─────────────────────────────────────────────────────────────

function StatsTab({ missions, applications }) {
  const total     = missions.length
  const ca        = missions.reduce((s, m) => s + (m.price_platform || 0), 0)
  const byTier    = { ia: 0, visio: 0, inspection: 0 }
  missions.forEach(m => { if (byTier[m.tier] !== undefined) byTier[m.tier]++ })
  const pending   = applications.filter(a => a.status === 'pending').length
  const completed = missions.filter(m => m.status === 'completed').length

  const cards = [
    { label: 'Missions totales',       value: total,              icon: '📋', color: '#FF4D00' },
    { label: 'CA plateforme',          value: `${ca.toFixed(0)}€`, icon: '💶', color: '#16A34A' },
    { label: 'Missions terminées',     value: completed,          icon: '✅', color: '#3B82F6' },
    { label: 'Candidatures en attente', value: pending,           icon: '🧑‍🔧', color: '#F59E0B' },
  ]

  return (
    <div>
      <div style={styles.pageTitle}>Statistiques</div>
      <div style={{ ...styles.pageSub, marginBottom: 36 }}>Vue d'ensemble du MVP</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 40 }}>
        {cards.map((c, i) => (
          <div key={i} style={{
            background: '#fff', borderRadius: 16, padding: '24px 20px',
            border: '1.5px solid rgba(0,0,0,0.07)',
            boxShadow: '0 2px 12px rgba(15,27,45,0.04)',
          }}>
            <div style={{ fontSize: '1.75rem', marginBottom: 12 }}>{c.icon}</div>
            <div style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 800,
              fontSize: '2rem', color: c.color, lineHeight: 1, marginBottom: 8,
            }}>
              {c.value}
            </div>
            <div style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '0.8125rem', color: '#6B7280', fontWeight: 500,
            }}>
              {c.label}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        background: '#fff', borderRadius: 16, padding: '24px 28px',
        border: '1.5px solid rgba(0,0,0,0.07)',
      }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1rem', color: '#0F1B2D', marginBottom: 20 }}>
          Missions par palier
        </div>
        {[
          { tier: 'ia',         label: 'IA Spécialisée',     emoji: '💬', price: '9,90€' },
          { tier: 'visio',      label: 'Visio Test Drive',    emoji: '📹', price: '59€' },
          { tier: 'inspection', label: 'Inspection Physique', emoji: '🔧', price: '249€' },
        ].map(t => {
          const count = byTier[t.tier]
          const pct   = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <div key={t.tier} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.875rem', fontWeight: 600, color: '#0F1B2D' }}>
                  {t.emoji} {t.label} <span style={{ color: '#9CA3AF', fontWeight: 400 }}>· {t.price}</span>
                </span>
                <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.875rem', color: '#6B7280' }}>
                  {count} ({pct}%)
                </span>
              </div>
              <div style={{ height: 6, background: '#F0F2F5', borderRadius: 100, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: '#FF4D00', borderRadius: 100, transition: 'width 0.6s ease' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Composants utilitaires ───────────────────────────────────────────────────

function Spinner({ label }) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 0' }}>
      <div style={{
        width: 32, height: 32, border: '3px solid rgba(15,27,45,0.08)',
        borderTopColor: '#FF4D00', borderRadius: '50%',
        animation: 'admin-spin 0.7s linear infinite', margin: '0 auto 16px',
      }} />
      <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.9375rem', color: '#6B7280' }}>{label}</div>
    </div>
  )
}

function ErrorBox({ msg }) {
  return (
    <div style={{
      background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '20px 24px',
      fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.9375rem', color: '#DC2626',
    }}>
      ⚠️ {msg}
    </div>
  )
}

function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 24px' }}>
      <div style={{ fontSize: '3rem', marginBottom: 12 }}>{icon}</div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.125rem', color: '#0F1B2D', marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.9375rem', color: '#6B7280' }}>{sub}</div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [user, setUser]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]     = useState('missions')

  // Pour passer missions/applications aux stats sans refetch
  const [missions, setMissions]         = useState([])
  const [applications, setApplications] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
  }, [])

  // Précharge pour les stats
  useEffect(() => {
    if (!user || !ADMIN_EMAILS.includes(user.email)) return
    adminFetch('admin-missions').then(d => { if (!d.error) setMissions(d.missions || []) })
    adminFetch('admin-applications').then(d => { if (!d.error) setApplications(d.applications || []) })
  }, [user])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner label="Vérification des accès..." />
      </div>
    )
  }

  // Accès refusé
  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0F1B2D',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔒</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: '#fff', marginBottom: 10 }}>
            Accès refusé
          </div>
          <div style={{ fontSize: '0.9375rem', color: 'rgba(255,255,255,0.5)', marginBottom: 28, fontWeight: 300 }}>
            {user ? `${user.email} n'est pas administrateur.` : 'Vous devez être connecté.'}
          </div>
          <a href="/" style={{
            display: 'inline-block', background: '#FF4D00', color: '#fff',
            padding: '12px 28px', borderRadius: 10, textDecoration: 'none',
            fontWeight: 700, fontSize: '0.9375rem',
          }}>
            ← Retour à l'accueil
          </a>
        </div>
      </div>
    )
  }

  const navItems = [
    { key: 'missions',     icon: '📋', label: 'Missions' },
    { key: 'applications', icon: '🧑‍🔧', label: 'Candidatures' },
    { key: 'stats',        icon: '📊', label: 'Statistiques' },
  ]

  return (
    <>
      <style>{`
        @keyframes admin-spin { to { transform: rotate(360deg); } }
        body { margin: 0; }
        .admin-nav-item:hover { background: rgba(255,255,255,0.06) !important; }
        .admin-table tr:hover td { background: #F0F4FF !important; }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>

        {/* ── Sidebar ── */}
        <aside style={{
          width: 240, flexShrink: 0,
          background: '#0F1B2D',
          display: 'flex', flexDirection: 'column',
          position: 'sticky', top: 0, height: '100vh',
        }}>
          {/* Logo */}
          <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <a href="/" style={{ textDecoration: 'none' }}>
              <span style={{
                fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.125rem',
                color: '#fff', letterSpacing: '3px', textTransform: 'uppercase',
              }}>
                INSP<span style={{ color: '#FF4D00' }}>E</span>XO
              </span>
            </a>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'rgba(255,77,0,0.15)', border: '1px solid rgba(255,77,0,0.3)',
              borderRadius: 100, padding: '2px 8px', marginTop: 8,
              fontSize: '0.6875rem', fontWeight: 700, color: '#FF4D00',
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              Admin
            </div>
          </div>

          {/* Nav */}
          <nav style={{ padding: '16px 12px', flexGrow: 1 }}>
            {navItems.map(item => (
              <button
                key={item.key}
                className="admin-nav-item"
                onClick={() => setTab(item.key)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.9375rem', fontWeight: 600,
                  textAlign: 'left', marginBottom: 2,
                  background: tab === item.key ? 'rgba(255,77,0,0.15)' : 'transparent',
                  color:      tab === item.key ? '#FF4D00' : 'rgba(255,255,255,0.55)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* User */}
          <div style={{
            padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.07)',
          }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Connecté en tant que</div>
            <div style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.7)', wordBreak: 'break-all' }}>{user.email}</div>
            <button
              onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')}
              style={{
                marginTop: 12, width: '100%', padding: '8px 0',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8, color: '#EF4444', fontSize: '0.8125rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif',
              }}
            >
              Déconnexion
            </button>
          </div>
        </aside>

        {/* ── Contenu principal ── */}
        <main style={{ flexGrow: 1, background: '#F8F9FA', minHeight: '100vh', overflowY: 'auto' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px' }}>
            {tab === 'missions'     && <MissionsTab />}
            {tab === 'applications' && <ApplicationsTab />}
            {tab === 'stats'        && <StatsTab missions={missions} applications={applications} />}
          </div>
        </main>
      </div>
    </>
  )
}

// ─── Styles partagés ──────────────────────────────────────────────────────────

const styles = {
  pageTitle: {
    fontFamily: 'Syne, sans-serif', fontWeight: 800,
    fontSize: '1.5rem', color: '#0F1B2D', marginBottom: 4,
  },
  pageSub: {
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    fontSize: '0.9375rem', color: '#6B7280', fontWeight: 400,
  },
  refreshBtn: {
    background: '#fff', border: '1.5px solid rgba(0,0,0,0.1)',
    borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
    fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.875rem', fontWeight: 600,
    color: '#374151', transition: 'background 0.15s',
  },
  table: {
    width: '100%', borderCollapse: 'collapse',
    background: '#fff', borderRadius: 16, overflow: 'hidden',
    border: '1.5px solid rgba(0,0,0,0.07)',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    boxShadow: '0 2px 12px rgba(15,27,45,0.04)',
  },
  thead: {
    background: '#0F1B2D',
  },
  th: {
    padding: '12px 16px', textAlign: 'left',
    fontSize: '0.6875rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
  },
  tr: { transition: 'background 0.15s' },
  td: {
    padding: '12px 16px', verticalAlign: 'middle',
    borderBottom: '1px solid rgba(0,0,0,0.05)',
  },
  idBadge: {
    display: 'inline-block', background: '#F0F2F5',
    borderRadius: 6, padding: '3px 8px',
    fontSize: '0.75rem', fontWeight: 700, color: '#6B7280',
    letterSpacing: '0.05em', fontFamily: 'monospace',
  },
  select: {
    padding: '6px 10px', borderRadius: 8,
    border: '1.5px solid rgba(0,0,0,0.1)',
    fontSize: '0.8125rem', fontWeight: 600,
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    background: '#fff', cursor: 'pointer', outline: 'none',
  },
  actionBtn: {
    padding: '6px 12px', borderRadius: 8,
    border: '1px solid rgba(0,0,0,0.1)',
    background: '#F8F9FA', color: '#374151',
    fontSize: '0.8125rem', fontWeight: 600,
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  brandPill: {
    display: 'inline-block', background: 'rgba(255,77,0,0.08)',
    color: '#FF4D00', borderRadius: 100, padding: '2px 8px',
    fontSize: '0.6875rem', fontWeight: 600,
  },
}
