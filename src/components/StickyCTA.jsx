import React, { useState, useEffect } from 'react'

export default function StickyCTA({ onClick, isVisible }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 500)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!scrolled || !isVisible || window.innerWidth > 768) return null

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      padding: '12px 16px',
      background: '#0F1B2D',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      zIndex: 9990,
      boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
    }}>
      <button
        onClick={onClick}
        style={{
          width: '100%',
          background: '#FF4D00', color: '#fff',
          border: 'none', borderRadius: 12,
          padding: 14,
          fontFamily: 'Syne, sans-serif', fontWeight: 700,
          fontSize: '0.9375rem', cursor: 'pointer',
        }}
      >
        🔍 Analyser mon véhicule gratuitement
      </button>
    </div>
  )
}
