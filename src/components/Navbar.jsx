import React, { useState, useEffect } from 'react'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { label: 'Comment ça marche', href: '#how-it-works' },
    { label: 'Nos services', href: '#services' },
    { label: 'Nos experts', href: '#experts' },
    { label: 'Devenir expert', href: '#devenir-expert' },
  ]

  return (
    <>
      <style>{`
        .nav-link {
          color: rgba(255,255,255,0.65);
          font-size: 0.875rem;
          font-weight: 500;
          font-family: 'Plus Jakarta Sans', sans-serif;
          text-decoration: none;
          transition: color 0.2s;
          white-space: nowrap;
        }
        .nav-link:hover { color: #fff; }
        .nav-cta {
          background: #FF4D00;
          color: #fff;
          padding: 10px 22px;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 700;
          font-family: 'Plus Jakarta Sans', sans-serif;
          text-decoration: none;
          transition: opacity 0.2s;
          white-space: nowrap;
        }
        .nav-cta:hover { opacity: 0.85; }
        .hamburger-line {
          display: block;
          width: 22px;
          height: 2px;
          background: #fff;
          transition: all 0.2s;
          transform-origin: center;
        }
        .mobile-menu-link {
          display: block;
          padding: 14px 0;
          color: rgba(255,255,255,0.75);
          font-size: 1rem;
          font-weight: 500;
          font-family: 'Plus Jakarta Sans', sans-serif;
          text-decoration: none;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          transition: color 0.2s;
        }
        .mobile-menu-link:hover { color: #fff; }
        @media (max-width: 768px) {
          .nav-links-desktop { display: none !important; }
          .nav-hamburger { display: flex !important; }
        }
        @media (min-width: 769px) {
          .nav-hamburger { display: none !important; }
          .mobile-menu { display: none !important; }
        }
      `}</style>

      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: '#0F1B2D',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        boxShadow: scrolled ? '0 2px 24px rgba(0,0,0,0.35)' : 'none',
        transition: 'box-shadow 0.3s',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '0 24px',
          height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Logo */}
          <a href="/" style={{ textDecoration: 'none' }}>
            <span style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.25rem',
              color: '#fff', letterSpacing: '3px', textTransform: 'uppercase',
            }}>
              INSP<span style={{ color: '#FF4D00' }}>E</span>XO
            </span>
          </a>

          {/* Desktop links */}
          <div className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            {links.map(l => (
              <a key={l.label} href={l.href} className="nav-link">{l.label}</a>
            ))}
            <a href="#services" className="nav-cta">Trouver mon expert</a>
          </div>

          {/* Hamburger */}
          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              display: 'flex', flexDirection: 'column', gap: 5,
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            }}
          >
            <span className="hamburger-line" style={{ transform: menuOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
            <span className="hamburger-line" style={{ opacity: menuOpen ? 0 : 1 }} />
            <span className="hamburger-line" style={{ transform: menuOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none' }} />
          </button>
        </div>

        {/* Mobile menu */}
        <div className="mobile-menu" style={{
          display: menuOpen ? 'block' : 'none',
          background: '#0F1B2D',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          padding: '8px 24px 24px',
        }}>
          {links.map(l => (
            <a key={l.label} href={l.href} className="mobile-menu-link" onClick={() => setMenuOpen(false)}>{l.label}</a>
          ))}
          <a href="#services" className="nav-cta" style={{ display: 'inline-block', marginTop: 16 }} onClick={() => setMenuOpen(false)}>
            Trouver mon expert
          </a>
        </div>
      </nav>
    </>
  )
}
