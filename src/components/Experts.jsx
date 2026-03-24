import React, { useState } from 'react'

const experts = [
  { nom: 'Thomas R.', marque: 'BMW', specialite: 'Série 3, M3 — moteurs N52 et S55', exp: '12 ans', missions: 847, note: '4.9', gradient: 'linear-gradient(135deg, #1a3a5c, #2563eb)', initials: 'TR' },
  { nom: 'Marc D.', marque: 'Mercedes', specialite: 'Classe C, E — moteurs OM651 et M276', exp: '9 ans', missions: 634, note: '4.8', gradient: 'linear-gradient(135deg, #1c1c1c, #374151)', initials: 'MD' },
  { nom: 'Sophie L.', marque: 'Porsche', specialite: '911, Cayenne — moteurs MA1 et M48', exp: '7 ans', missions: 312, note: '5.0', gradient: 'linear-gradient(135deg, #7c3aed, #a855f7)', initials: 'SL' },
  { nom: 'Kevin M.', marque: 'Audi', specialite: 'A4, RS4 — moteurs CDNC et CGWB', exp: '11 ans', missions: 521, note: '4.9', gradient: 'linear-gradient(135deg, #991b1b, #dc2626)', initials: 'KM' },
  { nom: 'Laura M.', marque: 'Ferrari', specialite: '488, F8 — moteurs V8 biturbo', exp: '8 ans', missions: 89, note: '5.0', gradient: 'linear-gradient(135deg, #b91c1c, #ff4d00)', initials: 'LM' },
  { nom: 'Pierre V.', marque: 'Land Rover', specialite: 'Defender, Discovery — châssis 4x4', exp: '14 ans', missions: 198, note: '5.0', gradient: 'linear-gradient(135deg, #064e3b, #059669)', initials: 'PV' },
  { nom: 'Nicolas F.', marque: 'Volkswagen', specialite: 'Golf, Passat — boîtes DSG et moteurs TSI', exp: '10 ans', missions: 398, note: '4.9', gradient: 'linear-gradient(135deg, #1e3a5f, #1d4ed8)', initials: 'NF' },
  { nom: 'Antoine B.', marque: 'Renault', specialite: 'Mégane, Clio — moteurs K9K et H4M', exp: '8 ans', missions: 445, note: '4.8', gradient: 'linear-gradient(135deg, #7c2d12, #ff4d00)', initials: 'AB' },
  { nom: 'Sarah C.', marque: 'Maserati', specialite: 'Ghibli, Quattroporte — V6 biturbo', exp: '9 ans', missions: 112, note: '4.8', gradient: 'linear-gradient(135deg, #312e81, #6366f1)', initials: 'SC' },
  { nom: 'Paul T.', marque: 'Alfa Romeo', specialite: 'Giulia, Stelvio — moteurs GME', exp: '11 ans', missions: 203, note: '4.9', gradient: 'linear-gradient(135deg, #881337, #e11d48)', initials: 'PT' },
]

const generalistes = ['Renault', 'Peugeot', 'Citroën', 'Volkswagen', 'Toyota', 'Dacia', 'Ford', 'Opel', 'Nissan', 'Hyundai', 'Kia', 'Fiat', 'Skoda', 'Seat', 'Mazda', 'Subaru', 'Mitsubishi', 'Honda', 'Mini', 'Jeep']
const premium = ['BMW', 'Mercedes', 'Audi', 'Volvo', 'Land Rover', 'Jaguar', 'Lexus', 'Genesis', 'Cadillac', 'Tesla', 'Porsche', 'Maserati', 'Ferrari', 'Lamborghini', 'Alfa Romeo', 'Lotus', 'Aston Martin', 'McLaren', 'Bentley', 'Rolls-Royce', 'Dodge', 'Chevrolet']

export default function Experts() {
  const [activeFilter, setActiveFilter] = useState('Tous')
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const filtered = activeFilter === 'Tous'
    ? experts
    : experts.filter(e => e.marque === activeFilter)

  return (
    <>
      <style>{`
        .expert-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px; padding: 24px;
          transition: background 0.2s, border-color 0.2s, transform 0.2s;
        }
        .expert-card:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.15);
          transform: translateY(-3px);
        }
        .brand-pill {
          padding: 5px 14px; border-radius: 100px;
          font-size: 0.75rem; font-weight: 600;
          font-family: 'Plus Jakarta Sans', sans-serif;
          cursor: pointer; transition: all 0.15s;
          border: 1px solid transparent;
          background: transparent;
          color: rgba(255,255,255,0.45);
          border-color: rgba(255,255,255,0.1);
        }
        .brand-pill:hover {
          color: rgba(255,255,255,0.8);
          border-color: rgba(255,255,255,0.25);
        }
        .brand-pill.active {
          background: #FF4D00;
          color: #fff;
          border-color: #FF4D00;
        }
        .brand-pills-row {
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .brand-pills-row::-webkit-scrollbar { display: none; }
        .notif-input {
          flex: 1; background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px; padding: 11px 16px;
          color: #fff; font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 0.9375rem; outline: none;
          transition: border-color 0.2s;
        }
        .notif-input::placeholder { color: rgba(255,255,255,0.3); }
        .notif-input:focus { border-color: rgba(255,255,255,0.3); }
        .notif-btn {
          background: #FF4D00; color: #fff;
          padding: 11px 24px; border-radius: 8px;
          font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 0.875rem; border: none; cursor: pointer;
          transition: opacity 0.2s; white-space: nowrap;
        }
        .notif-btn:hover { opacity: 0.88; }
        @media (max-width: 768px) {
          .experts-grid { grid-template-columns: 1fr !important; }
          .experts-header { flex-direction: column !important; align-items: flex-start !important; gap: 16px !important; margin-bottom: 32px !important; }
          .experts-section { padding: 64px 20px !important; }
          .experts-title { font-size: 1.625rem !important; line-height: 1.2 !important; }
          .brand-pills-row { overflow-x: auto !important; flex-wrap: nowrap !important; padding-bottom: 6px !important; }
          .experts-notify { padding: 24px 20px !important; }
        }
        @media (max-width: 900px) {
          .experts-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <section id="experts" className="experts-section" style={{ background: '#0F1B2D', padding: '96px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          {/* Label */}
          <div style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: '0.8125rem', fontWeight: 600,
            color: '#FF4D00', letterSpacing: '0.12em',
            textTransform: 'uppercase', marginBottom: 20,
          }}>
            {'// 03 — Nos experts'}
          </div>

          <div className="experts-header" style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-end', marginBottom: 48, gap: 24,
          }}>
            <h2 className="experts-title" style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 800,
              fontSize: 'clamp(2rem, 4vw, 2.75rem)',
              color: '#fff', lineHeight: 1.1,
            }}>
              Spécialisés par marque.<br />Indépendants.
            </h2>
            <p style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '0.9375rem', fontWeight: 300,
              color: 'rgba(255,255,255,0.45)', maxWidth: 340, lineHeight: 1.65,
            }}>
              Payés exclusivement par l'acheteur. Jamais par le vendeur, jamais par le garage.
            </p>
          </div>

          {/* Filters */}
          <div style={{ marginBottom: 36 }}>
            {/* All */}
            <button
              className={`brand-pill${activeFilter === 'Tous' ? ' active' : ''}`}
              onClick={() => setActiveFilter('Tous')}
              style={{ marginBottom: 12, marginRight: 6 }}
            >
              Tous
            </button>

            {/* Généralistes */}
            <div style={{ marginBottom: 12 }}>
              <span style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.75rem', fontWeight: 600,
                color: 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                marginRight: 12, display: 'inline-block', marginBottom: 8,
              }}>
                🚗 Généralistes
              </span>
              <div className="brand-pills-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {generalistes.map(b => (
                  <button
                    key={b}
                    className={`brand-pill${activeFilter === b ? ' active' : ''}`}
                    onClick={() => setActiveFilter(b)}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Premium */}
            <div>
              <span style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.75rem', fontWeight: 600,
                color: 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                marginRight: 12, display: 'inline-block', marginBottom: 8,
              }}>
                💎 Premium & Sportives
              </span>
              <div className="brand-pills-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {premium.map(b => (
                  <button
                    key={b}
                    className={`brand-pill${activeFilter === b ? ' active' : ''}`}
                    onClick={() => setActiveFilter(b)}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Expert grid */}
          {filtered.length > 0 ? (
            <div className="experts-grid" style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 40,
            }}>
              {filtered.map((e, i) => (
                <div key={i} className="expert-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%',
                      background: e.gradient,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'Syne, sans-serif', fontWeight: 800,
                      fontSize: '1rem', color: '#fff', flexShrink: 0,
                    }}>
                      {e.initials}
                    </div>
                    <div>
                      <div style={{
                        fontFamily: 'Syne, sans-serif', fontWeight: 800,
                        fontSize: '1rem', color: '#fff', marginBottom: 2,
                      }}>
                        {e.nom}
                      </div>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center',
                        background: 'rgba(255,77,0,0.12)',
                        border: '1px solid rgba(255,77,0,0.2)',
                        borderRadius: 100, padding: '2px 10px',
                        fontSize: '0.75rem', fontWeight: 600,
                        color: '#FF4D00',
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                      }}>
                        {e.marque}
                      </div>
                    </div>
                  </div>

                  <p style={{
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: '0.8125rem', fontWeight: 300,
                    color: 'rgba(255,255,255,0.45)',
                    lineHeight: 1.55, marginBottom: 16,
                  }}>
                    {e.specialite}
                  </p>

                  <div style={{
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    paddingTop: 12,
                  }}>
                    <div style={{
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)',
                    }}>
                      {e.exp} d'expérience · {e.missions} missions
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              textAlign: 'center', padding: '60px 24px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 16, marginBottom: 40,
            }}>
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔔</div>
              <div style={{
                fontFamily: 'Syne, sans-serif', fontWeight: 800,
                fontSize: '1.125rem', color: '#fff', marginBottom: 8,
              }}>
                Pas encore disponible dans votre ville
              </div>
              <div style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.9375rem', fontWeight: 300,
                color: 'rgba(255,255,255,0.45)', marginBottom: 24,
              }}>
                Disponibilité sur demande — laissez votre email pour être notifié.
              </div>
            </div>
          )}

          {/* Notification zone */}
          <div className="experts-notify" style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, padding: '28px 32px',
          }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontFamily: 'Syne, sans-serif', fontWeight: 800,
                fontSize: '1rem', color: '#fff', marginBottom: 6,
              }}>
                Votre ville n'est pas encore couverte ?
              </div>
              <div style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.875rem', fontWeight: 300,
                color: 'rgba(255,255,255,0.45)',
              }}>
                On s'étend bientôt. Laissez votre email pour être le premier informé.
              </div>
            </div>
            {submitted ? (
              <div style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.9375rem', fontWeight: 600,
                color: '#22C55E', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                ✓ Enregistré ! On vous prévient dès qu'un expert est disponible.
              </div>
            ) : (
              <form
                onSubmit={e => { e.preventDefault(); if (email) setSubmitted(true) }}
                style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}
              >
                <input
                  className="notif-input"
                  type="email" placeholder="votre@email.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  required
                />
                <button type="submit" className="notif-btn">Me notifier</button>
              </form>
            )}
          </div>

        </div>
      </section>
    </>
  )
}
