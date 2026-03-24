import React from 'react'

export default function NotFound() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Syne:wght@700;800&display=swap');
      `}</style>
      <div style={{
        background: '#0F1B2D', minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', textAlign: 'center',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
      }}>
        <div style={{
          fontFamily: 'Syne, sans-serif', fontWeight: 800,
          fontSize: 'clamp(5rem, 20vw, 9rem)',
          color: 'rgba(255,255,255,0.06)', lineHeight: 1, marginBottom: 24,
          letterSpacing: '-4px',
        }}>
          404
        </div>
        <h1 style={{
          fontFamily: 'Syne, sans-serif', fontWeight: 800,
          fontSize: 'clamp(1.5rem, 4vw, 2rem)',
          color: '#fff', marginBottom: 12,
        }}>
          Page introuvable
        </h1>
        <p style={{
          fontSize: '1rem', fontWeight: 300,
          color: 'rgba(255,255,255,0.45)',
          marginBottom: 36, lineHeight: 1.65,
          maxWidth: 340,
        }}>
          La page que tu cherches n'existe pas ou a été déplacée.
        </p>
        <a
          href="/"
          style={{
            background: '#FF4D00', color: '#fff',
            padding: '13px 32px', borderRadius: 10,
            fontFamily: 'Syne, sans-serif', fontWeight: 700,
            fontSize: '0.9375rem', textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          ← Retour à l'accueil
        </a>
      </div>
    </>
  )
}
