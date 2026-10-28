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
      background: 'var(--nav-bg)', color: 'var(--nav-fg)',
      borderTop: '1px solid var(--nav-line)',
      padding: '12px 20px',
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 16,
      zIndex: 9998, flexWrap: 'wrap',
    }}>
      <p style={{ fontSize: 13, margin: 0, lineHeight: 1.6, flex: 1, minWidth: 250, opacity: 0.85 }}>
        Ce site utilise des cookies essentiels pour l'authentification et le paiement sécurisé.{' '}
        <a href="/politique-de-confidentialite" style={{ color: 'var(--nav-fg)', textUnderlineOffset: 3 }}>
          En savoir plus
        </a>
      </p>
      <button
        type="button"
        onClick={accept}
        className="mono"
        style={{
          background: 'transparent', color: 'var(--nav-fg)',
          border: '1px solid var(--nav-line)',
          minHeight: 44, padding: '0 20px',
          fontWeight: 600, fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase',
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        J'ai compris
      </button>
    </div>
  )
}
