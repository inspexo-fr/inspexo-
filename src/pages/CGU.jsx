import React from 'react'

export default function CGU() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Syne:wght@700;800&display=swap');
        .legal-h2 { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.125rem; color: #0F1B2D; margin: 36px 0 12px; }
        .legal-p  { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.9375rem; color: #333; line-height: 1.75; margin: 0 0 12px; }
        .legal-a  { color: #FF4D00; text-decoration: none; }
        .legal-a:hover { text-decoration: underline; }
      `}</style>

      <div style={{ background: '#fff', minHeight: '100vh', padding: '60px 24px 80px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#FF4D00', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none', marginBottom: 40 }}>
            ← Retour à l'accueil
          </a>

          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 'clamp(1.75rem, 4vw, 2.25rem)', color: '#0F1B2D', marginBottom: 8 }}>
            Conditions Générales d'Utilisation
          </h1>
          <p className="legal-p" style={{ color: '#9CA3AF', marginBottom: 40 }}>À venir — Session 12</p>

          <div style={{ background: '#F8F9FA', borderRadius: 16, padding: '32px', border: '1px solid rgba(0,0,0,0.06)' }}>
            <p className="legal-p" style={{ textAlign: 'center', color: '#6B7280' }}>
              Les Conditions Générales d'Utilisation sont en cours de rédaction et seront publiées prochainement.<br /><br />
              Pour toute question : <a href="mailto:contact@inspexo.io" className="legal-a">contact@inspexo.io</a>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
