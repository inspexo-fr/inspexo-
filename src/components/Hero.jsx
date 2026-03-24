import React from 'react'

export default function Hero({ onFreeAnalysis }) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400&family=Syne:wght@700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #0F1B2D; }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        .hero-pulse { animation: pulse-dot 1.8s ease-in-out infinite; }

        .hero-btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          background: #FF4D00; color: #fff;
          padding: 16px 36px; border-radius: 10px;
          font-size: 1rem; font-weight: 700;
          font-family: 'Plus Jakarta Sans', sans-serif;
          text-decoration: none; transition: opacity 0.2s, transform 0.2s;
          border: none; cursor: pointer;
        }
        .hero-btn-primary:hover { opacity: 0.88; transform: translateY(-2px); }

        .hero-btn-outline {
          display: inline-flex; align-items: center; gap: 8px;
          background: transparent; color: rgba(255,255,255,0.85);
          padding: 15px 36px; border-radius: 10px;
          font-size: 1rem; font-weight: 600;
          font-family: 'Plus Jakarta Sans', sans-serif;
          text-decoration: none; border: 1.5px solid rgba(255,255,255,0.2);
          transition: border-color 0.2s, color 0.2s;
          cursor: pointer;
        }
        .hero-btn-outline:hover { border-color: rgba(255,255,255,0.6); color: #fff; }

        .hero-outline-text {
          -webkit-text-stroke: 1.5px rgba(255,255,255,0.35);
          color: transparent;
        }

        @media (max-width: 768px) {
          .hero-title { font-size: clamp(2.5rem, 10vw, 3.5rem) !important; }
          .hero-ctas { flex-direction: column !important; align-items: stretch !important; }
          .hero-trust-badges { flex-wrap: wrap !important; justify-content: center !important; }
        }
      `}</style>

      <section style={{
        background: '#0F1B2D',
        minHeight: '100vh',
        display: 'flex', alignItems: 'center',
        paddingTop: 100, paddingBottom: 80,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', width: '100%' }}>
          <div style={{ maxWidth: 820 }}>

            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: 'rgba(255,77,0,0.1)',
              border: '1px solid rgba(255,77,0,0.25)',
              borderRadius: 100, padding: '8px 18px',
              marginBottom: 36,
            }}>
              <span className="hero-pulse" style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#FF4D00', flexShrink: 0,
              }} />
              <span style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.875rem', fontWeight: 600,
                color: 'rgba(255,255,255,0.85)',
              }}>
                Un expert par marque — votre seul allié face au vendeur
              </span>
            </div>

            {/* Headline */}
            <h1 className="hero-title" style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 800,
              fontSize: 'clamp(3rem, 7vw, 68px)',
              lineHeight: 1.08, marginBottom: 28,
              letterSpacing: '-1px',
            }}>
              <span style={{ color: '#fff', display: 'block' }}>Achetez</span>
              <span className="hero-outline-text" style={{ display: 'block' }}>votre véhicule</span>
              <span style={{ color: '#FF4D00', display: 'block' }}>sans surprise.</span>
            </h1>

            {/* Subtitle */}
            <p style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '1.125rem', fontWeight: 300,
              fontStyle: 'italic',
              color: 'rgba(255,255,255,0.55)',
              marginBottom: 44, lineHeight: 1.7,
              maxWidth: 560,
            }}>
              Des experts automobiles qualifiés, spécialisés par marque, payés uniquement par vous.
              Zéro conflit d'intérêt.
            </p>

            {/* CTAs */}
            <div className="hero-ctas" style={{ display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
              <button onClick={onFreeAnalysis} className="hero-btn-primary">
                🔍 Analyser gratuitement
                <span style={{ fontSize: '1.1rem' }}>→</span>
              </button>
              <a href="#services" className="hero-btn-outline">
                Voir tous les services
              </a>
            </div>

            {/* Reassurance */}
            <div style={{
              marginBottom: 40,
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '0.8125rem', fontWeight: 500,
              color: 'rgba(255,255,255,0.35)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              ✅ 100% gratuit · 10 échanges avec l'expert IA · Sans engagement
            </div>

            {/* Trust badges */}
            <div className="hero-trust-badges" style={{
              display: 'flex', gap: 24, flexWrap: 'wrap',
            }}>
              {[
                { icon: '🔒', label: 'Paiement sécurisé Stripe' },
                { icon: '✓', label: 'Experts qualifiés vérifiés' },
                { icon: '⚡', label: 'Dès 9,90€' },
                { icon: '📍', label: 'Toulouse & Haute-Garonne' },
              ].map((b, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.8125rem', fontWeight: 500,
                  color: 'rgba(255,255,255,0.4)',
                }}>
                  <span style={{ fontSize: '0.9rem' }}>{b.icon}</span>
                  {b.label}
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>
    </>
  )
}
