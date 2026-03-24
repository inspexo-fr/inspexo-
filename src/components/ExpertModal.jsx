import React from 'react'
import useScrollLock from '../hooks/useScrollLock'

const MOCK_REVIEWS = [
  { author: 'Sébastien M.', date: 'Jan 2025', rating: 5, comment: 'Expert très précis, a identifié un problème de boîte de vitesses que le vendeur cachait. Mission top !' },
  { author: 'Claire D.', date: 'Fév 2025', rating: 5, comment: 'Accompagnement au top pendant la visite. Je n\'aurais pas acheté sans lui.' },
  { author: 'Antoine P.', date: 'Mar 2025', rating: 4, comment: 'Très professionnel, rapport détaillé reçu dans les 24h.' },
]

function Stars({ note }) {
  const n = parseFloat(note)
  return (
    <span style={{ color: '#FF4D00', fontSize: '1rem', letterSpacing: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ opacity: i <= Math.round(n) ? 1 : 0.25 }}>★</span>
      ))}
    </span>
  )
}

export default function ExpertModal({ expert, onClose, onReserve }) {
  useScrollLock()

  return (
    <>
      <style>{`
        .expert-modal-overlay {
          position: fixed; inset: 0; z-index: 10000;
          background: rgba(8,14,24,0.85);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
        }
        .expert-modal-box {
          background: #fff; border-radius: 20px;
          width: 100%; max-width: 520px;
          max-height: 90vh; overflow-y: auto; overflow-x: hidden;
          overscroll-behavior: contain;
        }
        @media (max-width: 540px) {
          .expert-modal-overlay { align-items: flex-end; padding: 0; }
          .expert-modal-box {
            border-radius: 20px 20px 0 0;
            max-height: 92vh;
          }
        }
      `}</style>

      <div className="expert-modal-overlay" onClick={onClose}>
        <div className="expert-modal-box" onClick={e => e.stopPropagation()}>

          {/* Header — bleu nuit */}
          <div style={{ background: '#0F1B2D', padding: '28px 28px 24px', borderRadius: '20px 20px 0 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: '50%',
                  background: expert.gradient,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Syne, sans-serif', fontWeight: 800,
                  fontSize: '1.25rem', color: '#fff', flexShrink: 0,
                  overflow: 'hidden',
                }}>
                  {expert.avatar_url
                    ? <img src={expert.avatar_url} alt={expert.nom} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : expert.initials}
                </div>
                <div>
                  <div style={{
                    fontFamily: 'Syne, sans-serif', fontWeight: 800,
                    fontSize: '1.25rem', color: '#fff', marginBottom: 4,
                  }}>
                    {expert.nom}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Stars note={expert.note} />
                    <span style={{
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)',
                    }}>
                      {expert.note} · {expert.missions} missions
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.6)', fontSize: '1rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '28px 28px 32px' }}>

            {/* Marque */}
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.75rem', fontWeight: 700,
                color: '#9CA3AF', textTransform: 'uppercase',
                letterSpacing: '0.1em', marginBottom: 8,
              }}>
                Marque couverte
              </div>
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                background: 'rgba(255,77,0,0.08)',
                border: '1px solid rgba(255,77,0,0.2)',
                borderRadius: 100, padding: '5px 14px',
                fontSize: '0.875rem', fontWeight: 700,
                color: '#FF4D00',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
              }}>
                {expert.marque}
              </span>
            </div>

            {/* Bio */}
            {expert.bio && (
              <div style={{ marginBottom: 20 }}>
                <p style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.9375rem', fontWeight: 400,
                  color: '#374151', lineHeight: 1.65,
                  fontStyle: 'italic',
                  borderLeft: '3px solid #FF4D00',
                  paddingLeft: 14,
                }}>
                  "{expert.bio}"
                </p>
              </div>
            )}

            {/* Spécialité */}
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.75rem', fontWeight: 700,
                color: '#9CA3AF', textTransform: 'uppercase',
                letterSpacing: '0.1em', marginBottom: 8,
              }}>
                Spécialité
              </div>
              <p style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.9375rem', fontWeight: 400,
                color: '#374151', lineHeight: 1.55,
              }}>
                {expert.specialite}
              </p>
            </div>

            {/* Stats */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
              gap: 12, marginBottom: 28,
            }}>
              {[
                { label: 'Expérience', value: expert.exp },
                { label: 'Missions', value: expert.missions },
                { label: 'Note', value: `${expert.note} / 5` },
              ].map((s, i) => (
                <div key={i} style={{
                  background: '#F8F9FA', borderRadius: 12,
                  padding: '14px 12px', textAlign: 'center',
                }}>
                  <div style={{
                    fontFamily: 'Syne, sans-serif', fontWeight: 800,
                    fontSize: '1.125rem', color: '#0F1B2D', marginBottom: 2,
                  }}>
                    {s.value}
                  </div>
                  <div style={{
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 500,
                  }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Avis clients */}
            <div style={{ marginBottom: 28 }}>
              <div style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.75rem', fontWeight: 700,
                color: '#9CA3AF', textTransform: 'uppercase',
                letterSpacing: '0.1em', marginBottom: 12,
              }}>
                Avis clients
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {MOCK_REVIEWS.map((r, i) => (
                  <div key={i} style={{
                    background: '#F8F9FA', borderRadius: 12,
                    padding: '14px 16px',
                  }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 6,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontFamily: 'Plus Jakarta Sans, sans-serif',
                          fontSize: '0.875rem', fontWeight: 700, color: '#0F1B2D',
                        }}>
                          {r.author}
                        </span>
                        <Stars note={r.rating} />
                      </div>
                      <span style={{
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        fontSize: '0.75rem', color: '#9CA3AF',
                      }}>
                        {r.date}
                      </span>
                    </div>
                    <p style={{
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: '0.875rem', color: '#6B7280',
                      lineHeight: 1.55,
                    }}>
                      {r.comment}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTAs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => onReserve('visio')}
                style={{
                  width: '100%', background: '#FF4D00', color: '#fff',
                  border: 'none', borderRadius: 12, padding: '15px',
                  fontFamily: 'Syne, sans-serif', fontWeight: 700,
                  fontSize: '1rem', cursor: 'pointer', transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.88' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
              >
                📹 Réserver une Visio — 59€
              </button>
              <button
                onClick={() => onReserve('inspection')}
                style={{
                  width: '100%', background: 'transparent', color: '#0F1B2D',
                  border: '1.5px solid rgba(15,27,45,0.2)', borderRadius: 12, padding: '13px',
                  fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600,
                  fontSize: '0.9375rem', cursor: 'pointer', transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(15,27,45,0.5)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(15,27,45,0.2)' }}
              >
                🔧 Réserver une Inspection — 249€
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
