import React from 'react'

const steps = [
  {
    num: '01',
    icon: '🔍',
    title: 'Choisissez votre niveau',
    desc: 'Analyse IA, visio avec un expert, ou inspection physique. Sélectionnez selon votre budget et votre niveau de risque.',
  },
  {
    num: '02',
    icon: '👨‍🔧',
    title: 'Réservez votre expert',
    desc: 'Parcourez les experts qualifiés filtrés par marque. Chaque profil affiche ses spécialités et sa disponibilité.',
  },
  {
    num: '03',
    icon: '📋',
    title: 'Recevez votre rapport',
    desc: 'Compte-rendu détaillé, points de vigilance identifiés, et recommandation claire : acheter, négocier ou passer.',
  },
]

export default function HowItWorks() {
  return (
    <>
      <style>{`
        .step-card {
          background: #F8F9FA;
          border-radius: 16px;
          padding: 36px 28px;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .step-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(15,27,45,0.1); }
        @media (max-width: 768px) {
          .steps-grid { grid-template-columns: 1fr !important; }
          .section-label { font-size: 0.75rem !important; }
        }
      `}</style>

      <section id="how-it-works" style={{ background: '#fff', padding: '96px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          {/* Section label */}
          <div style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: '0.8125rem', fontWeight: 600,
            color: '#FF4D00', letterSpacing: '0.12em',
            textTransform: 'uppercase', marginBottom: 20,
          }}>
            {'// 01 — Comment ça marche'}
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-end', marginBottom: 56, gap: 24, flexWrap: 'wrap',
          }}>
            <h2 style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 800,
              fontSize: 'clamp(2rem, 4vw, 2.75rem)',
              color: '#0F1B2D', lineHeight: 1.1, maxWidth: 480,
            }}>
              En 3 étapes,<br />achetez en confiance.
            </h2>
            <p style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '1rem', fontWeight: 300,
              color: '#6B7280', maxWidth: 360, lineHeight: 1.7,
            }}>
              Un processus simple, transparent, et entièrement pensé pour l'acheteur.
            </p>
          </div>

          <div className="steps-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24,
          }}>
            {steps.map((s, i) => (
              <div key={i} className="step-card">
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: '#FFF0EA',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem', marginBottom: 24,
                }}>
                  {s.icon}
                </div>
                <div style={{
                  fontFamily: 'Syne, sans-serif', fontWeight: 800,
                  fontSize: '0.75rem', color: '#FF4D00',
                  letterSpacing: '0.1em', marginBottom: 12,
                  textTransform: 'uppercase',
                }}>
                  Étape {s.num}
                </div>
                <h3 style={{
                  fontFamily: 'Syne, sans-serif', fontWeight: 800,
                  fontSize: '1.125rem', color: '#0F1B2D', marginBottom: 12,
                }}>
                  {s.title}
                </h3>
                <p style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.9375rem', fontWeight: 300,
                  color: '#6B7280', lineHeight: 1.65,
                }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
