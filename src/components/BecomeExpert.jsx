import React, { useState } from 'react'
import ExpertApplicationModal from './ExpertApplicationModal'

export default function BecomeExpert() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <style>{`
        .become-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 72px; align-items: center;
        }
        .revenue-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
        }
        .revenue-card {
          background: #fff; border-radius: 14px; padding: 24px 20px;
          box-shadow: 0 2px 16px rgba(15,27,45,0.08);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .revenue-card:hover { transform: translateY(-3px); box-shadow: 0 8px 32px rgba(15,27,45,0.14); }
        .form-field { margin-bottom: 14px; }
        .form-label {
          display: block; font-size: 0.875rem; font-weight: 600;
          color: #0F1B2D; margin-bottom: 6px;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .form-input {
          width: 100%; padding: 11px 14px; border-radius: 10px;
          border: 1.5px solid rgba(0,0,0,0.1); font-size: 0.9375rem;
          font-family: 'Plus Jakarta Sans', sans-serif; color: #0F1B2D;
          outline: none; transition: border-color 0.2s; box-sizing: border-box;
          background: #fff;
        }
        .form-input:focus { border-color: #FF4D00; }
        .form-submit {
          width: 100%; background: #0F1B2D; color: #fff;
          padding: 14px 24px; border-radius: 10px;
          font-size: 1rem; font-weight: 700;
          font-family: 'Plus Jakarta Sans', sans-serif;
          border: none; cursor: pointer; margin-top: 6px;
          transition: opacity 0.2s;
        }
        .form-submit:hover { opacity: 0.85; }
        @media (max-width: 900px) {
          .become-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
        }
        @media (max-width: 640px) {
          .revenue-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <section id="devenir-expert" style={{ background: '#FFF0EA', padding: '96px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          <div className="become-grid">
            {/* Left */}
            <div>
              {/* Label */}
              <div style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.8125rem', fontWeight: 600,
                color: '#FF4D00', letterSpacing: '0.12em',
                textTransform: 'uppercase', marginBottom: 20,
              }}>
                {'// 04 — Devenir expert'}
              </div>

              <h2 style={{
                fontFamily: 'Syne, sans-serif', fontWeight: 800,
                fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
                color: '#0F1B2D', lineHeight: 1.1, marginBottom: 20,
              }}>
                Monétisez votre expertise.<br />À votre rythme.
              </h2>

              <p style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '1rem', fontWeight: 300,
                color: '#4B5563', lineHeight: 1.7, marginBottom: 36,
              }}>
                Vous avez une expertise mécanique sur une ou plusieurs marques ?
                Rejoignez Inspexo et aidez des acheteurs à éviter les mauvaises surprises — tout en générant un revenu flexible.
              </p>

              {/* Revenue grid */}
              <div style={{ marginBottom: 36 }}>
                <div style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.8125rem', fontWeight: 600,
                  color: '#6B7280', textTransform: 'uppercase',
                  letterSpacing: '0.08em', marginBottom: 16,
                }}>
                  Vos revenus par mission
                </div>
                <div className="revenue-grid">
                  {[
                    { label: 'Visio Test Drive', amount: '40€', detail: 'par mission / ~45 min', icon: '📹' },
                    { label: 'Inspection Physique', amount: '170€', detail: 'par mission + déplacement remboursé', icon: '🔧' },
                  ].map((r, i) => (
                    <div key={i} className="revenue-card">
                      <div style={{ fontSize: '1.5rem', marginBottom: 10 }}>{r.icon}</div>
                      <div style={{
                        fontFamily: 'Syne, sans-serif', fontWeight: 800,
                        fontSize: '1.75rem', color: '#FF4D00', marginBottom: 4,
                        letterSpacing: '-0.5px',
                      }}>
                        {r.amount}
                      </div>
                      <div style={{
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        fontSize: '0.875rem', fontWeight: 600,
                        color: '#0F1B2D', marginBottom: 4,
                      }}>
                        {r.label}
                      </div>
                      <div style={{
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 400,
                      }}>
                        {r.detail}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Avantages */}
              <ul style={{ listStyle: 'none' }}>
                {[
                  'Missions flexibles, à votre rythme',
                  'Aucun lien avec les vendeurs — indépendance totale',
                  'Accès à notre plateforme de gestion de missions',
                  'Versement sous 48h via Stripe Connect',
                ].map((b, i) => (
                  <li key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    marginBottom: 10,
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: '0.9375rem', fontWeight: 400, color: '#374151',
                  }}>
                    <span style={{ color: '#FF4D00', fontWeight: 700, flexShrink: 0 }}>→</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — CTA card */}
            <div style={{
              background: '#fff', borderRadius: 20, padding: '40px 36px',
              boxShadow: '0 4px 40px rgba(15,27,45,0.1)',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              <div style={{
                fontFamily: 'Syne, sans-serif', fontWeight: 800,
                fontSize: '1.375rem', color: '#0F1B2D', marginBottom: 10,
              }}>
                Postuler en 5 minutes
              </div>
              <p style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.9375rem', fontWeight: 300,
                color: '#6B7280', lineHeight: 1.65, marginBottom: 32,
              }}>
                Remplissez le formulaire ci-dessous. On vérifie votre profil et on vous recontacte sous 48h pour discuter des premières missions disponibles.
              </p>

              {/* Steps */}
              <div style={{ marginBottom: 36 }}>
                {[
                  { step: '1', label: 'Remplissez le formulaire', sub: '5 minutes max' },
                  { step: '2', label: 'Validation du profil', sub: 'Réponse sous 48h' },
                  { step: '3', label: 'Premières missions', sub: 'Dès votre onboarding' },
                ].map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 14, marginBottom: i < 2 ? 16 : 0,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: '#FFF0EA', border: '1.5px solid rgba(255,77,0,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'Syne, sans-serif', fontWeight: 800,
                      fontSize: '0.8125rem', color: '#FF4D00', flexShrink: 0,
                    }}>
                      {s.step}
                    </div>
                    <div>
                      <div style={{
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        fontSize: '0.9375rem', fontWeight: 600, color: '#0F1B2D',
                      }}>
                        {s.label}
                      </div>
                      <div style={{
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        fontSize: '0.8125rem', fontWeight: 300, color: '#9CA3AF',
                      }}>
                        {s.sub}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setModalOpen(true)}
                style={{
                  background: '#FF4D00', color: '#fff',
                  padding: '16px 24px', borderRadius: 12,
                  fontSize: '1rem', fontWeight: 700,
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  border: 'none', cursor: 'pointer',
                  transition: 'opacity 0.2s, transform 0.2s',
                  width: '100%', textAlign: 'center',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none' }}
              >
                Rejoindre le réseau Inspexo →
              </button>
            </div>
          </div>
        </div>
      </section>

      <ExpertApplicationModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
