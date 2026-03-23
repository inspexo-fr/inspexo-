import React from 'react'

export default function Footer() {
  return (
    <>
      <style>{`
        .footer-link {
          display: block; font-size: 0.875rem; font-weight: 400;
          color: rgba(255,255,255,0.4);
          font-family: 'Plus Jakarta Sans', sans-serif;
          text-decoration: none; margin-bottom: 10px;
          transition: color 0.2s;
        }
        .footer-link:hover { color: rgba(255,255,255,0.8); }
        @media (max-width: 768px) {
          .footer-top { grid-template-columns: 1fr !important; gap: 40px !important; }
          .footer-bottom { flex-direction: column !important; text-align: center !important; gap: 12px !important; }
        }
      `}</style>

      <footer style={{ background: '#0F1B2D', padding: '72px 24px 48px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          {/* Logo centré atténué */}
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <span style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 800,
              fontSize: '2.5rem', color: 'rgba(255,255,255,0.08)',
              letterSpacing: '6px', textTransform: 'uppercase',
            }}>
              INSPEXO
            </span>
          </div>

          {/* Grid 3 colonnes */}
          <div className="footer-top" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 48, marginBottom: 56,
          }}>
            {/* Navigation */}
            <div>
              <div style={{
                fontFamily: 'Syne, sans-serif', fontWeight: 800,
                fontSize: '0.8125rem', color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 20,
              }}>
                Navigation
              </div>
              <a href="#how-it-works" className="footer-link">Comment ça marche</a>
              <a href="#services" className="footer-link">Nos services</a>
              <a href="#experts" className="footer-link">Nos experts</a>
              <a href="#devenir-expert" className="footer-link">Devenir expert</a>
              <a href="#faq" className="footer-link">FAQ</a>
            </div>

            {/* Contact */}
            <div>
              <div style={{
                fontFamily: 'Syne, sans-serif', fontWeight: 800,
                fontSize: '0.8125rem', color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 20,
              }}>
                Contact
              </div>
              <a href="mailto:contact@inspexo.io" className="footer-link">contact@inspexo.io</a>
              <span className="footer-link" style={{ cursor: 'default' }}>Toulouse & Haute-Garonne</span>
              <span className="footer-link" style={{ cursor: 'pointer' }}>LinkedIn</span>
              <span className="footer-link" style={{ cursor: 'pointer' }}>Instagram</span>
            </div>

            {/* Légal */}
            <div>
              <div style={{
                fontFamily: 'Syne, sans-serif', fontWeight: 800,
                fontSize: '0.8125rem', color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 20,
              }}>
                Légal
              </div>
              <span className="footer-link" style={{ cursor: 'pointer' }}>Mentions légales</span>
              <span className="footer-link" style={{ cursor: 'pointer' }}>CGU / CGV</span>
              <span className="footer-link" style={{ cursor: 'pointer' }}>Politique de confidentialité</span>
              <span className="footer-link" style={{ cursor: 'pointer' }}>Gestion des cookies</span>
            </div>
          </div>

          {/* Bottom */}
          <div className="footer-bottom" style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingTop: 28, display: 'flex',
            justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
          }}>
            <span style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '0.8125rem', color: 'rgba(255,255,255,0.25)',
            }}>
              © 2025 Inspexo — Tous droits réservés.
            </span>
            <span style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '0.8125rem', color: 'rgba(255,255,255,0.2)',
              fontStyle: 'italic',
            }}>
              Indépendant. Transparent. Côté acheteur.
            </span>
          </div>
        </div>
      </footer>
    </>
  )
}
