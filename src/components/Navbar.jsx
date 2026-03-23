import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import AuthModal from './AuthModal'
import ClientDashboard from '../pages/ClientDashboard'

// Tronque "prenom.nom@gmail.com" → "pre...@gmail.com"
function truncateEmail(email) {
  if (!email) return ''
  const at = email.indexOf('@')
  if (at <= 4) return email
  return email.slice(0, 3) + '…' + email.slice(at)
}

export default function Navbar() {
  const [scrolled, setScrolled]         = useState(false)
  const [menuOpen, setMenuOpen]         = useState(false)
  const [user, setUser]                 = useState(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [dashboardOpen, setDashboardOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Scroll shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setDropdownOpen(false)
    setDashboardOpen(false)
    setMenuOpen(false)
  }

  const openDashboard = () => {
    setDropdownOpen(false)
    setMenuOpen(false)
    setDashboardOpen(true)
  }

  const links = [
    { label: 'Comment ça marche', href: '#how-it-works' },
    { label: 'Nos services',      href: '#services' },
    { label: 'Nos experts',       href: '#experts' },
    { label: 'Devenir expert',    href: '#devenir-expert' },
  ]

  return (
    <>
      <style>{`
        .nav-link {
          color: rgba(255,255,255,0.65);
          font-size: 0.875rem; font-weight: 500;
          font-family: 'Plus Jakarta Sans', sans-serif;
          text-decoration: none; transition: color 0.2s; white-space: nowrap;
        }
        .nav-link:hover { color: #fff; }

        /* Bouton "Se connecter" — texte seul, très visible */
        .nav-signin-btn {
          display: flex; align-items: center; gap: 6px;
          background: none; border: none; cursor: pointer;
          color: #fff; font-size: 0.875rem; font-weight: 600;
          font-family: 'Plus Jakarta Sans', sans-serif;
          padding: 8px 4px; white-space: nowrap;
          transition: opacity 0.2s;
        }
        .nav-signin-btn:hover { opacity: 0.75; }

        /* Bouton user connecté */
        .nav-user-btn {
          display: flex; align-items: center; gap: 7px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 8px; cursor: pointer;
          color: #fff; font-size: 0.8125rem; font-weight: 600;
          font-family: 'Plus Jakarta Sans', sans-serif;
          padding: 8px 14px; white-space: nowrap;
          transition: background 0.2s;
        }
        .nav-user-btn:hover { background: rgba(255,255,255,0.14); }

        /* Dropdown */
        .nav-dropdown {
          position: absolute; top: calc(100% + 8px); right: 0;
          background: #fff; border-radius: 12px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.2);
          overflow: hidden; min-width: 180px;
          animation: dropdown-in 0.15s ease;
          z-index: 10;
        }
        @keyframes dropdown-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .nav-dropdown-item {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 18px; font-size: 0.875rem; font-weight: 600;
          font-family: 'Plus Jakarta Sans', sans-serif;
          color: #0F1B2D; cursor: pointer; border: none;
          background: none; width: 100%; text-align: left;
          transition: background 0.15s;
        }
        .nav-dropdown-item:hover { background: #F8F9FA; }
        .nav-dropdown-item.danger { color: #DC2626; }
        .nav-dropdown-item.danger:hover { background: #FEF2F2; }
        .nav-dropdown-divider {
          height: 1px; background: rgba(0,0,0,0.06); margin: 4px 0;
        }

        /* CTA orange */
        .nav-cta {
          background: #FF4D00; color: #fff;
          padding: 10px 20px; border-radius: 8px;
          font-size: 0.875rem; font-weight: 700;
          font-family: 'Plus Jakarta Sans', sans-serif;
          text-decoration: none; transition: opacity 0.2s; white-space: nowrap;
          border: none; cursor: pointer;
        }
        .nav-cta:hover { opacity: 0.85; }

        /* Hamburger */
        .hamburger-line {
          display: block; width: 22px; height: 2px;
          background: #fff; transition: all 0.2s; transform-origin: center;
        }

        /* Mobile menu */
        .mobile-menu-link {
          display: block; padding: 14px 0;
          color: rgba(255,255,255,0.8); font-size: 0.9375rem; font-weight: 500;
          font-family: 'Plus Jakarta Sans', sans-serif;
          text-decoration: none; border-bottom: 1px solid rgba(255,255,255,0.07);
          transition: color 0.2s;
        }
        .mobile-menu-link:hover { color: #fff; }
        .mobile-action-btn {
          display: flex; align-items: center; gap: 8px;
          width: 100%; padding: 13px 0; background: none; border: none;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          color: rgba(255,255,255,0.8); font-size: 0.9375rem; font-weight: 600;
          font-family: 'Plus Jakarta Sans', sans-serif;
          cursor: pointer; text-align: left; transition: color 0.2s;
        }
        .mobile-action-btn:hover { color: #fff; }
        .mobile-action-btn.danger { color: rgba(239,68,68,0.85); }
        .mobile-action-btn.danger:hover { color: #EF4444; }

        @media (max-width: 768px) {
          .nav-desktop-only { display: none !important; }
          .nav-hamburger    { display: flex !important; }
        }
        @media (min-width: 769px) {
          .nav-hamburger { display: none !important; }
          .nav-mobile-menu { display: none !important; }
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
          gap: 16,
        }}>

          {/* Logo */}
          <a href="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <span style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.25rem',
              color: '#fff', letterSpacing: '3px', textTransform: 'uppercase',
            }}>
              INSP<span style={{ color: '#FF4D00' }}>E</span>XO
            </span>
          </a>

          {/* Desktop — nav links (centre) */}
          <div className="nav-desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 28, flexGrow: 1, justifyContent: 'center' }}>
            {links.map(l => (
              <a key={l.label} href={l.href} className="nav-link">{l.label}</a>
            ))}
          </div>

          {/* Desktop — actions droite */}
          <div className="nav-desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            {user ? (
              /* ── Connecté : bouton email + dropdown ── */
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <button
                  className="nav-user-btn"
                  onClick={() => setDropdownOpen(o => !o)}
                >
                  <span style={{ fontSize: '0.9rem' }}>👤</span>
                  {truncateEmail(user.email)}
                  <span style={{
                    fontSize: '0.6rem', opacity: 0.5,
                    transform: dropdownOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s', display: 'inline-block',
                  }}>▼</span>
                </button>

                {dropdownOpen && (
                  <div className="nav-dropdown">
                    <div style={{
                      padding: '10px 18px 8px',
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 400,
                    }}>
                      {user.email}
                    </div>
                    <div className="nav-dropdown-divider" />
                    <button className="nav-dropdown-item" onClick={openDashboard}>
                      📋 Mes missions
                    </button>
                    <div className="nav-dropdown-divider" />
                    <button className="nav-dropdown-item danger" onClick={handleSignOut}>
                      Déconnexion
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* ── Non connecté : texte blanc + icône ── */
              <button className="nav-signin-btn" onClick={() => setAuthModalOpen(true)}>
                👤 Se connecter
              </button>
            )}

            <a href="#services" className="nav-cta">Trouver mon expert</a>
          </div>

          {/* Hamburger */}
          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen(o => !o)}
            style={{
              display: 'flex', flexDirection: 'column', gap: 5,
              background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0,
            }}
          >
            <span className="hamburger-line" style={{ transform: menuOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
            <span className="hamburger-line" style={{ opacity: menuOpen ? 0 : 1 }} />
            <span className="hamburger-line" style={{ transform: menuOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none' }} />
          </button>
        </div>

        {/* ── Mobile menu ── */}
        <div className="nav-mobile-menu" style={{
          display: menuOpen ? 'block' : 'none',
          background: '#0F1B2D',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          padding: '4px 24px 20px',
        }}>
          {links.map(l => (
            <a key={l.label} href={l.href} className="mobile-menu-link" onClick={() => setMenuOpen(false)}>
              {l.label}
            </a>
          ))}

          {/* Séparateur */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '8px 0' }} />

          {user ? (
            <>
              <div style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.8125rem', color: 'rgba(255,255,255,0.35)',
                padding: '10px 0 6px',
              }}>
                👤 {user.email}
              </div>
              <button className="mobile-action-btn" onClick={openDashboard}>
                📋 Mes missions
              </button>
              <button className="mobile-action-btn danger" onClick={handleSignOut}>
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <button className="mobile-action-btn" onClick={() => { setAuthModalOpen(true); setMenuOpen(false) }}>
                👤 Se connecter
              </button>
              <div style={{ marginTop: 12 }}>
                <a href="#services" className="nav-cta" style={{ display: 'block', textAlign: 'center' }}
                  onClick={() => setMenuOpen(false)}>
                  Trouver mon expert
                </a>
              </div>
            </>
          )}
        </div>
      </nav>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => setAuthModalOpen(false)}
      />

      <ClientDashboard
        isOpen={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
        user={user}
      />
    </>
  )
}
