import React from 'react'

const FONT = "'Plus Jakarta Sans', sans-serif"
const FONT_TITRE = "'Syne', sans-serif"

const piliers = [
  {
    titre: 'Chaque panne a sa source',
    texte: 'Lien cliquable vers l\'origine de chaque affirmation.',
  },
  {
    titre: 'Rappels officiels',
    texte: 'RappelConso et codes constructeur (ex. Audi 21H7), pas des on-dit.',
  },
  {
    titre: 'Airbags Takata vérifiés',
    texte: 'Liste officielle du ministère, mise à jour à chaque analyse.',
  },
  {
    titre: 'Le cadre juridique du vendeur',
    texte: 'Pro, particulier ou intermédiaire : ce que ça change pour votre garantie.',
  },
]

export default function WhyInspexo() {
  return (
    <>
      <style>{`
        .why-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 32px;
        }
        @media (max-width: 900px) {
          .why-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 28px 20px !important; }
        }
        @media (max-width: 480px) {
          .why-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <section style={{ background: '#fff', padding: '72px 20px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            fontFamily: FONT, fontSize: '0.8125rem', fontWeight: 600,
            color: '#FF4D00', letterSpacing: '0.08em', marginBottom: 36,
          }}>
            {'// Pourquoi Inspexo'}
          </div>

          <div className="why-grid">
            {piliers.map((p, i) => (
              <div key={i}>
                <div style={{ width: 28, height: 3, background: '#FF4D00', marginBottom: 14 }} />
                <h3 style={{
                  fontFamily: FONT_TITRE, fontWeight: 700, fontSize: '1.0625rem',
                  color: '#0F1B2D', margin: '0 0 10px', lineHeight: 1.3,
                }}>
                  {p.titre}
                </h3>
                <p style={{
                  fontFamily: FONT, fontWeight: 300, fontSize: '0.9375rem',
                  color: '#6B7280', lineHeight: 1.6, margin: 0,
                }}>
                  {p.texte}
                </p>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 48, paddingTop: 28, borderTop: '1px solid rgba(0,0,0,0.07)',
            fontFamily: FONT_TITRE, fontWeight: 700, fontSize: 'clamp(1.125rem, 3vw, 1.375rem)',
            color: '#0F1B2D', textAlign: 'center',
          }}>
            Ce qui n'est pas prouvé n'apparaît pas.
          </div>
        </div>
      </section>
    </>
  )
}
