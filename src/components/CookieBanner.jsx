import React, { useState, useEffect } from 'react'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('inspexo_cookies_accepted')) {
      setVisible(true)
    }
  }, [])

  const accept = () => {
    localStorage.setItem('inspexo_cookies_accepted', 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#0F1B2D',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      padding: '14px 24px',
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 16,
      zIndex: 9998, flexWrap: 'wrap',
    }}>
      <p style={{
        color: 'rgba(255,255,255,0.65)',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: '0.8125rem', margin: 0, lineHeight: 1.6,
        flex: 1, minWidth: 250,
      }}>
        Ce site utilise des cookies essentiels pour l'authentification et le paiement sécurisé.{' '}
        <a href="/politique-de-confidentialite" style={{ color: '#FF4D00', textDecoration: 'none' }}>
          En savoir plus
        </a>
      </p>
      <button
        onClick={accept}
        style={{
          background: '#FF4D00', color: '#fff',
          border: 'none', borderRadius: 8,
          padding: '9px 22px',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontWeight: 600, fontSize: '0.8125rem',
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        J'ai compris
      </button>
    </div>
  )
}
