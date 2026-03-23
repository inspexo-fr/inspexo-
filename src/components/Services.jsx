import React, { useState } from 'react'
import CheckoutModal from './CheckoutModal'

const services = [
  {
    tier: 'ia',
    emoji: '💬',
    name: 'IA Spécialisée',
    price: '9,90€',
    badge: 'Éclairez votre décision',
    badgeStyle: 'default',
    featured: false,
    description: 'Découvrez les points de défaillance connus de ce modèle — et décidez si vous avez besoin d\'un expert sur place.',
    features: [
      { label: 'Défauts connus du modèle', status: 'green' },
      { label: 'Script de questions au vendeur', status: 'green' },
      { label: 'Estimation juste prix marché', status: 'green' },
      { label: 'Signaux d\'alerte à surveiller', status: 'green' },
      { label: 'Rapport détaillé PDF', status: 'green' },
      { label: 'Disponible 48h après achat', status: 'muted' },
    ],
    cta: 'Lancer l\'analyse',
  },
  {
    tier: 'visio',
    emoji: '📹',
    name: 'Visio Test Drive',
    price: '59€',
    badge: '⭐ Recommandé',
    badgeStyle: 'featured',
    featured: true,
    description: 'Un expert qualifié vous guide en visio pendant votre visite chez le vendeur pour sécuriser votre achat.',
    features: [
      { label: 'Expert qualifié sur votre marque', status: 'green' },
      { label: 'En direct pendant votre visite', status: 'green' },
      { label: 'Guidage pendant l\'essai routier', status: 'green' },
      { label: 'Vérification identité véhicule *', status: 'green' },
      { label: 'Historique administratif', status: 'green' },
      { label: 'Compte-rendu détaillé sous 24h', status: 'green' },
    ],
    cta: 'Réserver une visio',
    limitations: ['Documents & état visuel vérifiables', 'Mécanique sous capot non inspectable'],
  },
  {
    tier: 'inspection',
    emoji: '🔧',
    name: 'Inspection Physique',
    price: '249€',
    badge: 'Rien au hasard',
    badgeStyle: 'default',
    featured: false,
    description: 'L\'expert se déplace chez le vendeur pour une inspection 360° complète, mécanique et carrosserie.',
    features: [
      { label: 'Tout le palier Visio inclus', status: 'green' },
      { label: 'Déplacement de l\'expert sur place *', status: 'green' },
      { label: 'Inspection compartiment moteur', status: 'green' },
      { label: 'Frappe à froid & détection zones repeintes', status: 'green' },
      { label: 'Essai statique et routier complet', status: 'green' },
      { label: 'Rapport photo complet sous 24h **', status: 'green' },
    ],
    cta: 'Réserver une inspection',
  },
]

export default function Services() {
  const [modalTier, setModalTier] = useState(null)

  return (
    <>
      <style>{`
        .service-card {
          background: #fff;
          border: 1.5px solid rgba(0,0,0,0.07);
          border-radius: 20px;
          padding: 36px 28px;
          display: flex; flex-direction: column;
          transition: transform 0.2s, box-shadow 0.2s;
          position: relative; overflow: hidden;
        }
        .service-card:hover { transform: translateY(-4px); box-shadow: 0 16px 48px rgba(15,27,45,0.12); }
        .service-card.featured {
          background: #0F1B2D;
          border-color: #0F1B2D;
          box-shadow: 0 20px 60px rgba(15,27,45,0.35);
          transform: translateY(-8px);
        }
        .service-card.featured:hover { transform: translateY(-12px); box-shadow: 0 28px 72px rgba(15,27,45,0.45); }
        .service-cta {
          padding: 13px 20px; border-radius: 10px;
          font-size: 0.9375rem; font-weight: 700;
          font-family: 'Plus Jakarta Sans', sans-serif;
          border: none; cursor: pointer; width: 100%;
          transition: opacity 0.2s, transform 0.2s;
          text-align: center;
        }
        .service-cta:hover { opacity: 0.88; transform: translateY(-1px); }
        .feature-item {
          display: flex; align-items: flex-start; gap: 10;
          padding: 7px 0;
          border-bottom: 1px solid rgba(0,0,0,0.05);
          font-size: 0.875rem;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .feature-item:last-child { border-bottom: none; }
        @media (max-width: 900px) {
          .services-grid { grid-template-columns: 1fr !important; }
          .service-card.featured { transform: none !important; }
        }
        @media (max-width: 768px) {
          .services-section { padding: 72px 24px !important; }
        }
      `}</style>

      <section id="services" className="services-section" style={{ background: '#F8F9FA', padding: '96px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          {/* Label */}
          <div style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: '0.8125rem', fontWeight: 600,
            color: '#FF4D00', letterSpacing: '0.12em',
            textTransform: 'uppercase', marginBottom: 20,
          }}>
            {'// 02 — Nos services'}
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-end', marginBottom: 56, gap: 24, flexWrap: 'wrap',
          }}>
            <h2 style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 800,
              fontSize: 'clamp(2rem, 4vw, 2.75rem)',
              color: '#0F1B2D', lineHeight: 1.1,
            }}>
              3 niveaux d'expertise.<br />Un seul objectif.
            </h2>
            <div style={{ textAlign: 'right' }}>
              <span style={{
                display: 'inline-block',
                background: 'rgba(255,77,0,0.08)',
                border: '1px solid rgba(255,77,0,0.2)',
                borderRadius: 100, padding: '6px 16px',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.8125rem', fontWeight: 600,
                color: '#FF4D00',
              }}>
                Prix de lancement
              </span>
            </div>
          </div>

          <div className="services-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 24, alignItems: 'start',
          }}>
            {services.map((s, i) => (
              <div key={i} className={`service-card${s.featured ? ' featured' : ''}`}>

                {/* Badge */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center',
                  background: s.featured ? 'rgba(255,77,0,0.15)' : '#F0F2F5',
                  color: s.featured ? '#FF4D00' : '#6B7280',
                  borderRadius: 100, padding: '4px 12px',
                  fontSize: '0.75rem', fontWeight: 600,
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  marginBottom: 20, alignSelf: 'flex-start',
                  border: s.featured ? '1px solid rgba(255,77,0,0.25)' : 'none',
                }}>
                  {s.badge}
                </div>

                {/* Emoji + price */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ fontSize: '2rem' }}>{s.emoji}</span>
                  <span style={{
                    fontFamily: 'Syne, sans-serif', fontWeight: 800,
                    fontSize: '2rem', color: s.featured ? '#fff' : '#0F1B2D',
                    letterSpacing: '-1px',
                  }}>
                    {s.price}
                  </span>
                </div>

                <h3 style={{
                  fontFamily: 'Syne, sans-serif', fontWeight: 800,
                  fontSize: '1.25rem', marginBottom: 12,
                  color: s.featured ? '#fff' : '#0F1B2D',
                }}>
                  {s.name}
                </h3>

                <p style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.875rem', fontWeight: 300,
                  color: s.featured ? 'rgba(255,255,255,0.6)' : '#6B7280',
                  lineHeight: 1.65, marginBottom: 24,
                }}>
                  {s.description}
                </p>

                {/* Features */}
                <div style={{ flexGrow: 1, marginBottom: 28 }}>
                  {s.features.map((f, j) => (
                    <div key={j} className="feature-item" style={{
                      borderBottomColor: s.featured ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                    }}>
                      <span style={{
                        color: f.status === 'green' ? '#22C55E' : '#9CA3AF',
                        fontWeight: 700, flexShrink: 0, marginTop: 1,
                      }}>
                        {f.status === 'green' ? '✓' : '·'}
                      </span>
                      <span style={{ color: s.featured ? 'rgba(255,255,255,0.75)' : '#374151', fontWeight: 400 }}>
                        {f.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Limitations (Visio) */}
                {s.limitations && (
                  <div style={{
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: 8, padding: '12px 14px',
                    marginBottom: 20,
                  }}>
                    <div style={{
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: '0.75rem', fontWeight: 600,
                      color: 'rgba(255,255,255,0.4)',
                      marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      Ce que la visio peut / ne peut pas vérifier
                    </div>
                    {s.limitations.map((l, j) => (
                      <div key={j} style={{
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        fontSize: '0.8125rem', color: 'rgba(255,255,255,0.5)',
                        padding: '3px 0',
                      }}>
                        {j === 0 ? '✓ ' : '✗ '}{l}
                      </div>
                    ))}
                  </div>
                )}

                {/* CTA */}
                <button
                  className="service-cta"
                  style={{ background: s.featured ? '#FF4D00' : '#0F1B2D', color: '#fff' }}
                  onClick={() => setModalTier(s.tier)}
                >
                  {s.cta}
                </button>
              </div>
            ))}
          </div>

          {/* Garantie */}
          <div style={{
            marginTop: 40, background: '#fff',
            border: '1.5px solid rgba(0,0,0,0.07)',
            borderRadius: 12, padding: '20px 28px',
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: '1.25rem' }}>🛡️</span>
            <div>
              <div style={{
                fontFamily: 'Syne, sans-serif', fontWeight: 800,
                fontSize: '0.9375rem', color: '#0F1B2D', marginBottom: 2,
              }}>
                Paiement sécurisé par Stripe
              </div>
              <div style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.8125rem', fontWeight: 400,
                color: '#6B7280',
              }}>
                Votre carte est autorisée à la réservation et débitée uniquement après confirmation de l'expert. Aucun virement manuel.
              </div>
            </div>
          </div>
        </div>
      </section>

      <CheckoutModal
        isOpen={modalTier !== null}
        onClose={() => setModalTier(null)}
        tier={modalTier}
      />
    </>
  )
}
