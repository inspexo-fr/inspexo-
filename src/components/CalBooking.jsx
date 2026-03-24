import { useEffect } from 'react'

export default function CalBooking({ tier, onClose }) {
  const calLink = tier === 'visio'
    ? 'cal.eu-inspexo/visio-test-drive'
    : 'cal.eu-inspexo/inspection-physique'

  useEffect(() => {
    if (!window.Cal) return

    window.Cal('init', { origin: 'https://app.cal.eu' })
    window.Cal('inline', {
      elementOrSelector: '#cal-embed',
      calLink,
      config: {
        layout: 'month_view',
        theme: 'dark',
      },
    })
  }, [calLink])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(15,27,45,0.97)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px', background: '#0F1B2D',
        borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            background: '#FF4D00', color: '#fff',
            padding: '4px 12px', borderRadius: 100,
            fontSize: '0.75rem', fontWeight: 600,
          }}>
            {tier === 'visio' ? '📹 Visio Test Drive' : '🔧 Inspection Physique'}
          </span>
          <span style={{
            color: '#fff', fontFamily: 'Syne, sans-serif',
            fontWeight: 800, fontSize: '1rem',
          }}>
            Réserver un créneau
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff', padding: '7px 16px', borderRadius: 8,
            cursor: 'pointer', fontSize: '0.875rem',
          }}
        >
          Fermer
        </button>
      </div>

      {/* Cal.com embed */}
      <div id="cal-embed" style={{ flex: 1, overflow: 'auto' }} />
    </div>
  )
}
