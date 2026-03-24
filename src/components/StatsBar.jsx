import React, { useEffect, useRef, useState } from 'react'

const stats = [
  { value: '5,5M', label: 'Transactions VO/an' },
  { value: '30+', label: 'Marques couvertes' },
  { value: '9,90€', label: 'Pour commencer' },
  { value: '100%', label: 'Côté acheteur' },
]

export default function StatsBar() {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <style>{`
        @media (max-width: 640px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 32px 16px !important;
            padding: 0 4px !important;
          }
          .stat-label {
            font-size: 0.75rem !important;
            letter-spacing: 0.03em !important;
          }
        }
        .stat-item {
          position: relative;
          opacity: 0; transform: translateY(12px);
          transition: opacity 0.4s ease, transform 0.4s ease;
        }
        .stat-item.visible { opacity: 1; transform: translateY(0); }
        .stat-item:nth-child(1) { transition-delay: 0s; }
        .stat-item:nth-child(2) { transition-delay: 0.08s; }
        .stat-item:nth-child(3) { transition-delay: 0.16s; }
        .stat-item:nth-child(4) { transition-delay: 0.24s; }
      `}</style>

      <section ref={ref} style={{ background: '#FF4D00', padding: '52px 20px', overflowX: 'hidden' }}>
        <div
          className="stats-grid"
          style={{
            maxWidth: 1200, margin: '0 auto',
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 0, textAlign: 'center',
          }}
        >
          {stats.map((s, i) => (
            <div key={i} className={`stat-item${visible ? ' visible' : ''}`}>
              <div style={{
                fontFamily: 'Syne, sans-serif', fontWeight: 800,
                fontSize: 'clamp(1.75rem, 4.5vw, 3.25rem)',
                color: '#fff', lineHeight: 1, marginBottom: 8,
                letterSpacing: '-1px',
              }}>
                {s.value}
              </div>
              <div className="stat-label" style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.875rem', fontWeight: 500,
                color: 'rgba(255,255,255,0.75)',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {s.label}
              </div>
              {i < stats.length - 1 && (
                <div style={{
                  position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
                  width: 1, height: 40, background: 'rgba(255,255,255,0.2)',
                }} />
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
