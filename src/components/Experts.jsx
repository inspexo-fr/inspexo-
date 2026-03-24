import React, { useState } from 'react'
import ExpertModal from './ExpertModal'

const experts = [
  {
    nom: 'Thomas R.', marque: 'BMW', specialite: 'Série 3, M3 — moteurs N52 et S55',
    bio: "Ancien technicien BMW Série 3 et Série 5 pendant 8 ans. Je connais chaque point faible des moteurs N47, N52 et S55. Mon objectif : que vous sachiez exactement ce que vous achetez.",
    exp: '12 ans', missions: 847, note: '4.9', gradient: 'linear-gradient(135deg, #1a3a5c, #2563eb)', initials: 'TR',
  },
  {
    nom: 'Marc D.', marque: 'Mercedes', specialite: 'Classe C, E — moteurs OM651 et M276',
    bio: "Spécialiste Mercedes depuis 12 ans, des Classe A aux Classe E. Moteurs OM651, OM654, M276 — je sais où chercher les problèmes que le vendeur ne vous montrera pas.",
    exp: '9 ans', missions: 634, note: '4.8', gradient: 'linear-gradient(135deg, #1c1c1c, #374151)', initials: 'MD',
  },
  {
    nom: 'Sophie L.', marque: 'Porsche', specialite: '911, Cayenne — moteurs MA1 et M48',
    bio: "7 ans chez un préparateur Porsche officiel. 911, Cayenne, Macan — je connais chaque point de vigilance, du moteur à plat 6 aux transferts de couple PDK. Aucune surprise cachée.",
    exp: '7 ans', missions: 312, note: '5.0', gradient: 'linear-gradient(135deg, #7c3aed, #a855f7)', initials: 'SL',
  },
  {
    nom: 'Kevin M.', marque: 'Audi', specialite: 'A4, RS4 — moteurs CDNC et CGWB',
    bio: "Passionné et technicien VW/Audi depuis 9 ans. Golf, Tiguan, Passat — moteurs TSI, TDI, DSG, je vous dis tout ce qu'il faut vérifier avant de signer.",
    exp: '11 ans', missions: 521, note: '4.9', gradient: 'linear-gradient(135deg, #991b1b, #dc2626)', initials: 'KM',
  },
  {
    nom: 'Laura M.', marque: 'Ferrari', specialite: '488, F8 — moteurs V8 biturbo',
    bio: "8 ans en atelier spécialisé Ferrari Italie. 488, F8, Roma — chaque Ferrari a ses points critiques. Je vous évite une mauvaise surprise à 6 chiffres.",
    exp: '8 ans', missions: 89, note: '5.0', gradient: 'linear-gradient(135deg, #b91c1c, #ff4d00)', initials: 'LM',
  },
  {
    nom: 'Pierre V.', marque: 'Land Rover', specialite: 'Defender, Discovery — châssis 4x4',
    bio: "14 ans de terrain sur Defender, Discovery et Range Rover. Châssis 4x4, transferts, suspensions pneumatiques — je sais exactement ce qui cède en premier et comment le détecter.",
    exp: '14 ans', missions: 198, note: '5.0', gradient: 'linear-gradient(135deg, #064e3b, #059669)', initials: 'PV',
  },
  {
    nom: 'Nicolas F.', marque: 'Volkswagen', specialite: 'Golf, Passat — boîtes DSG et moteurs TSI',
    bio: "10 ans en atelier indépendant spécialisé groupe VAG. Golf, Passat, Tiguan — boîtes DSG, moteurs TSI et TDI, je vous dis tout ce qu'il faut vérifier avant de signer.",
    exp: '10 ans', missions: 398, note: '4.9', gradient: 'linear-gradient(135deg, #1e3a5f, #1d4ed8)', initials: 'NF',
  },
  {
    nom: 'Antoine B.', marque: 'Renault', specialite: 'Mégane, Clio — moteurs K9K et H4M',
    bio: "Ancien mécanicien Renault, 7 ans d'expérience sur Clio, Mégane, Captur. Je repère en 30 minutes ce qu'un non-initié ne verrait jamais.",
    exp: '8 ans', missions: 445, note: '4.8', gradient: 'linear-gradient(135deg, #7c2d12, #ff4d00)', initials: 'AB',
  },
  {
    nom: 'Sarah C.', marque: 'Maserati', specialite: 'Ghibli, Quattroporte — V6 biturbo',
    bio: "9 ans de passion et de rigueur sur les Maserati. Ghibli, Quattroporte, Levante — moteurs V6 biturbo, boîtes ZF, je connais les faiblesses que les vendeurs taisent.",
    exp: '9 ans', missions: 112, note: '4.8', gradient: 'linear-gradient(135deg, #312e81, #6366f1)', initials: 'SC',
  },
  {
    nom: 'Paul T.', marque: 'Alfa Romeo', specialite: 'Giulia, Stelvio — moteurs GME',
    bio: "11 ans spécialisé sur les Alfa Romeo modernes. Giulia, Stelvio, moteurs GME 2.0 et V6 — les faiblesses sont connues, je vous les explique avant que vous signiez.",
    exp: '11 ans', missions: 203, note: '4.9', gradient: 'linear-gradient(135deg, #881337, #e11d48)', initials: 'PT',
  },
]

const generalistes = ['Renault', 'Peugeot', 'Citroën', 'Volkswagen', 'Toyota', 'Dacia', 'Ford', 'Opel', 'Nissan', 'Hyundai', 'Kia', 'Fiat', 'Skoda', 'Seat', 'Mazda', 'Subaru', 'Mitsubishi', 'Honda', 'Mini', 'Jeep']
const premium = ['BMW', 'Mercedes', 'Audi', 'Volvo', 'Land Rover', 'Jaguar', 'Lexus', 'Genesis', 'Cadillac', 'Tesla', 'Porsche', 'Maserati', 'Ferrari', 'Lamborghini', 'Alfa Romeo', 'Lotus', 'Aston Martin', 'McLaren', 'Bentley', 'Rolls-Royce', 'Dodge', 'Chevrolet']

const INITIAL_LIMIT = 4

export default function Experts({ onReserve }) {
  const [activeFilter, setActiveFilter]   = useState('Tous')
  const [searchQuery, setSearchQuery]     = useState('')
  const [showAll, setShowAll]             = useState(false)
  const [selectedExpert, setSelectedExpert] = useState(null)
  const [email, setEmail]                 = useState('')
  const [submitted, setSubmitted]         = useState(false)

  const searchLower = searchQuery.trim().toLowerCase()

  const filtered = searchLower
    ? experts.filter(e => e.marque.toLowerCase().includes(searchLower))
    : activeFilter === 'Tous'
      ? experts
      : experts.filter(e => e.marque === activeFilter)

  const displayedExperts = showAll ? filtered : filtered.slice(0, INITIAL_LIMIT)
  const hasMore = filtered.length > INITIAL_LIMIT

  const visibleGeneralistes = searchLower
    ? generalistes.filter(b => b.toLowerCase().includes(searchLower))
    : generalistes
  const visiblePremium = searchLower
    ? premium.filter(b => b.toLowerCase().includes(searchLower))
    : premium

  const handlePillClick = (brand) => {
    setActiveFilter(brand)
    setSearchQuery('')
    setShowAll(false)
  }

  const handleSearch = (q) => {
    setSearchQuery(q)
    if (q) setActiveFilter('Tous')
    setShowAll(false)
  }

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
          border: 1px solid rgba(255,255,255,0.1);
          background: transparent;
          color: rgba(255,255,255,0.45);
          flex-shrink: 0;
          white-space: nowrap;
        }
        .brand-pill:hover { color: rgba(255,255,255,0.8); border-color: rgba(255,255,255,0.25); }
        .brand-pill.active { background: #FF4D00; color: #fff; border-color: #FF4D00; }
        .brand-pills-row {
          display: flex; flex-wrap: wrap; gap: 6px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none; -ms-overflow-style: none;
        }
        .brand-pills-row::-webkit-scrollbar { display: none; }
        .experts-search-input {
          width: 100%; box-sizing: border-box;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px; padding: 11px 16px 11px 42px;
          color: #fff; font-size: 16px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          outline: none; transition: border-color 0.2s;
        }
        .experts-search-input::placeholder { color: rgba(255,255,255,0.3); }
        .experts-search-input:focus { border-color: rgba(255,255,255,0.3); }
        .notif-input {
          flex: 1; background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px; padding: 11px 16px;
          color: #fff; font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 16px; outline: none; transition: border-color 0.2s;
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
        @media (max-width: 900px) {
          .experts-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .experts-grid { grid-template-columns: 1fr !important; }
          .experts-header { flex-direction: column !important; align-items: flex-start !important; gap: 16px !important; margin-bottom: 32px !important; }
          .experts-section { padding: 64px 20px !important; }
          .experts-title { font-size: 1.625rem !important; line-height: 1.2 !important; }
          .brand-pills-row { overflow-x: auto !important; flex-wrap: nowrap !important; padding-bottom: 6px !important; padding-left: 2px !important; }
          .experts-notify { padding: 24px 20px !important; }
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

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 24 }}>
            <svg
              style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                color: 'rgba(255,255,255,0.3)', pointerEvents: 'none',
              }}
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="experts-search-input"
              type="search"
              placeholder="Rechercher une marque..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>

          {/* Filters */}
          <div style={{ marginBottom: 36 }}>
            {/* All */}
            {!searchLower && (
              <button
                className={`brand-pill${activeFilter === 'Tous' ? ' active' : ''}`}
                onClick={() => { setActiveFilter('Tous'); setShowAll(false) }}
                style={{ marginBottom: 12, marginRight: 6 }}
              >
                Tous
              </button>
            )}

            {/* Généralistes */}
            {visibleGeneralistes.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {!searchLower && (
                  <span style={{
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: '0.75rem', fontWeight: 600,
                    color: 'rgba(255,255,255,0.3)',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    display: 'block', marginBottom: 8,
                  }}>
                    🚗 Généralistes
                  </span>
                )}
                <div className="brand-pills-row">
                  {visibleGeneralistes.map(b => (
                    <button
                      key={b}
                      className={`brand-pill${activeFilter === b && !searchLower ? ' active' : ''}`}
                      onClick={() => handlePillClick(b)}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Premium */}
            {visiblePremium.length > 0 && (
              <div>
                {!searchLower && (
                  <span style={{
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: '0.75rem', fontWeight: 600,
                    color: 'rgba(255,255,255,0.3)',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    display: 'block', marginBottom: 8,
                  }}>
                    💎 Premium & Sportives
                  </span>
                )}
                <div className="brand-pills-row">
                  {visiblePremium.map(b => (
                    <button
                      key={b}
                      className={`brand-pill${activeFilter === b && !searchLower ? ' active' : ''}`}
                      onClick={() => handlePillClick(b)}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Expert grid */}
          {filtered.length > 0 ? (
            <>
              <div className="experts-grid" style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24,
              }}>
                {displayedExperts.map((e, i) => (
                  <div key={i} className="expert-card" onClick={() => setSelectedExpert(e)} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%',
                        background: e.gradient,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'Syne, sans-serif', fontWeight: 800,
                        fontSize: '1rem', color: '#fff', flexShrink: 0,
                        overflow: 'hidden',
                      }}>
                        {e.avatar_url
                          ? <img src={e.avatar_url} alt={e.nom} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : e.initials}
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
                      lineHeight: 1.55, marginBottom: 8,
                    }}>
                      {e.specialite}
                    </p>
                    <p style={{
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: '0.8125rem', fontWeight: 400,
                      color: 'rgba(255,255,255,0.35)',
                      lineHeight: 1.5, marginBottom: 16,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {e.bio}
                    </p>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
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

              {(hasMore || showAll) && (
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                  <button
                    onClick={() => setShowAll(v => !v)}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 10, padding: '11px 28px',
                      color: 'rgba(255,255,255,0.7)',
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: '0.875rem', fontWeight: 600,
                      cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; e.currentTarget.style.color = '#fff' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
                  >
                    {showAll
                      ? 'Voir moins'
                      : `Voir plus d'experts (${filtered.length - INITIAL_LIMIT} de plus)`}
                  </button>
                </div>
              )}
            </>
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
                Aucun expert trouvé
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

      {selectedExpert && (
        <ExpertModal
          expert={selectedExpert}
          onClose={() => setSelectedExpert(null)}
          onReserve={(tier) => {
            setSelectedExpert(null)
            onReserve?.(selectedExpert, tier)
          }}
        />
      )}
    </>
  )
}
