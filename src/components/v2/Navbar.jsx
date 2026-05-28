import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import AuthModal from '../AuthModal'
import ClientDashboard from '../../pages/ClientDashboard'
import Button from '../ui/Button'

/* ────────────────────────────────────────────────────────────
   NAVBAR — Section 01
   - Fixed top, glass effect (blur + rgba)
   - 72px desktop / 60px mobile
   - Logo INSPEXO (Geist 500)
   - Liens : Services / Experts / Defect Atlas / FAQ
   - Hover : ligne ember 1px scale-X 0→1 left-to-right 300ms
   - CTA droite : "Commencer" (ember)
   - Préserve toute la logique auth Supabase
   ──────────────────────────────────────────────────────────── */

function truncateEmail(email) {
  if (!email) return ''
  const at = email.indexOf('@')
  if (at <= 4) return email
  return email.slice(0, 3) + '…' + email.slice(at)
}

const NAV_LINKS = [
  { label: 'Services',     href: '#services'      },
  { label: 'Experts',      href: '#experts'       },
  { label: 'Defect Atlas', href: '#defect-atlas'  },
  { label: 'FAQ',          href: '#faq'           },
]

export default function Navbar({ onPrimaryCta }) {
  const [user, setUser]                   = useState(null)
  const [menuOpen, setMenuOpen]           = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [dashboardOpen, setDashboardOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen]   = useState(false)
  const dropdownRef = useRef(null)

  // Auth state — préservé
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Outside-click sur le dropdown
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

  const handleStart = () => {
    if (onPrimaryCta) onPrimaryCta()
    else document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <style>{`
        .nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: var(--z-nav);
          height: var(--nav-h-desktop);
          background: rgba(10, 10, 11, 0.72);
          backdrop-filter: blur(20px) saturate(140%);
          -webkit-backdrop-filter: blur(20px) saturate(140%);
          border-bottom: 1px solid rgba(250, 250, 248, 0.06);
        }
        .nav__inner {
          height: 100%;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 32px;
          padding: 0 clamp(20px, 4vw, 48px);
          max-width: 1600px;
          margin: 0 auto;
        }

        /* Logo */
        .nav__logo {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-family: var(--font-display);
          font-weight: 500;
          font-size: 18px;
          letter-spacing: -0.02em;
          color: var(--white);
          transition: opacity 200ms var(--ease-out);
        }
        .nav__logo:hover { opacity: 0.85; }
        .nav__logo-mark {
          width: 10px; height: 10px;
          background: var(--ember);
          border-radius: 2px;
        }

        /* Liens centre */
        .nav__links {
          display: flex;
          align-items: center;
          gap: 32px;
          justify-content: center;
        }
        .nav__link {
          position: relative;
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 500;
          letter-spacing: -0.005em;
          color: var(--on-ink-70);
          padding: 6px 2px;
          transition: color 200ms var(--ease-out);
        }
        .nav__link::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 1px;
          background: var(--ember);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 300ms var(--ease-out);
        }
        .nav__link:hover,
        .nav__link:focus-visible {
          color: var(--white);
        }
        .nav__link:hover::after,
        .nav__link:focus-visible::after { transform: scaleX(1); }

        /* Actions droite */
        .nav__actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .nav__signin {
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 500;
          color: var(--on-ink-70);
          padding: 6px 10px;
          transition: color 200ms var(--ease-out);
        }
        .nav__signin:hover { color: var(--white); }

        /* User dropdown */
        .nav__user {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          font-family: var(--font-mono);
          font-size: 12px;
          letter-spacing: 0.04em;
          color: var(--white);
          background: rgba(250, 250, 248, 0.06);
          border: 1px solid rgba(250, 250, 248, 0.10);
          border-radius: var(--radius-sm);
          transition: background 200ms var(--ease-out), border-color 200ms var(--ease-out);
        }
        .nav__user:hover {
          background: rgba(250, 250, 248, 0.10);
          border-color: rgba(250, 250, 248, 0.18);
        }
        .nav__user-caret {
          transition: transform 200ms var(--ease-out);
          font-size: 9px;
          opacity: 0.6;
        }
        .nav__user[aria-expanded="true"] .nav__user-caret { transform: rotate(180deg); }

        .nav__dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 220px;
          background: var(--paper);
          border: 1px solid var(--mist);
          border-radius: var(--radius);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
          padding: 6px;
          overflow: hidden;
        }
        .nav__dropdown-email {
          padding: 10px 12px 8px;
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.08em;
          color: var(--steel);
          border-bottom: 1px solid var(--mist);
          margin-bottom: 6px;
          word-break: break-all;
        }
        .nav__dropdown-item {
          width: 100%;
          text-align: left;
          padding: 10px 12px;
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 500;
          color: var(--ink);
          border-radius: var(--radius-sm);
          transition: background 150ms var(--ease-out), color 150ms var(--ease-out);
        }
        .nav__dropdown-item:hover { background: var(--ember-soft); }
        .nav__dropdown-item.danger { color: var(--alert); }
        .nav__dropdown-item.danger:hover { background: rgba(230, 57, 70, 0.08); }

        /* Hamburger */
        .nav__hamburger {
          display: none;
          flex-direction: column;
          gap: 5px;
          padding: 8px;
          background: none;
          border: none;
        }
        .nav__hamburger span {
          display: block;
          width: 22px;
          height: 1.5px;
          background: var(--white);
          transition: transform 250ms var(--ease-out), opacity 200ms var(--ease-out);
          transform-origin: center;
        }

        /* Mobile menu */
        .nav__mobile {
          position: fixed;
          top: var(--nav-h-mobile);
          left: 0; right: 0;
          background: var(--ink);
          border-bottom: 1px solid rgba(250, 250, 248, 0.06);
          padding: 24px clamp(20px, 4vw, 32px) 32px;
        }
        .nav__mobile-link {
          display: block;
          padding: 14px 0;
          font-family: var(--font-display);
          font-weight: 500;
          font-size: 22px;
          letter-spacing: -0.02em;
          color: var(--white);
          border-bottom: 1px solid rgba(250, 250, 248, 0.06);
        }
        .nav__mobile-link:last-child { border-bottom: none; }
        .nav__mobile-cta { margin-top: 24px; }

        /* Responsive */
        @media (max-width: 900px) {
          .nav { height: var(--nav-h-mobile); }
          .nav__links { display: none; }
          .nav__actions .nav__signin,
          .nav__actions .nav__user { display: none; }
          .nav__hamburger { display: flex; }
          .nav__cta-desktop { display: none; }
        }
        @media (min-width: 901px) {
          .nav__mobile { display: none !important; }
          .nav__cta-mobile { display: none; }
        }
      `}</style>

      <nav className="nav" aria-label="Navigation principale">
        <div className="nav__inner">

          {/* Logo */}
          <a href="/" className="nav__logo" aria-label="Inspexo">
            <span className="nav__logo-mark" aria-hidden />
            INSPEXO
          </a>

          {/* Liens centre — desktop */}
          <div className="nav__links">
            {NAV_LINKS.map(link => (
              <a key={link.label} href={link.href} className="nav__link">
                {link.label}
              </a>
            ))}
          </div>

          {/* Actions droite */}
          <div className="nav__actions">
            {user ? (
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <button
                  className="nav__user"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="menu"
                  onClick={() => setDropdownOpen(o => !o)}
                >
                  <span>{truncateEmail(user.email)}</span>
                  <span className="nav__user-caret" aria-hidden>▼</span>
                </button>
                {dropdownOpen && (
                  <div className="nav__dropdown" role="menu">
                    <div className="nav__dropdown-email">{user.email}</div>
                    <button className="nav__dropdown-item" onClick={openDashboard} role="menuitem">
                      Mes missions
                    </button>
                    <button className="nav__dropdown-item danger" onClick={handleSignOut} role="menuitem">
                      Déconnexion
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className="nav__signin" onClick={() => setAuthModalOpen(true)}>
                Se connecter
              </button>
            )}

            <span className="nav__cta-desktop">
              <Button variant="primary" size="md" onClick={handleStart}>
                Commencer
              </Button>
            </span>

            <button
              className="nav__hamburger"
              aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(o => !o)}
            >
              <span style={{ transform: menuOpen ? 'translateY(6.5px) rotate(45deg)'  : 'none' }} />
              <span style={{ opacity: menuOpen ? 0 : 1 }} />
              <span style={{ transform: menuOpen ? 'translateY(-6.5px) rotate(-45deg)' : 'none' }} />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="nav__mobile">
            {NAV_LINKS.map(link => (
              <a
                key={link.label}
                href={link.href}
                className="nav__mobile-link"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="nav__mobile-cta">
              {user ? (
                <>
                  <Button variant="secondary" size="md" onSurface="dark" onClick={openDashboard} style={{ width: '100%', marginBottom: 12 }}>
                    Mes missions
                  </Button>
                  <Button variant="primary" size="md" onClick={() => { handleStart(); setMenuOpen(false) }} style={{ width: '100%' }}>
                    Commencer
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" size="md" onSurface="dark" onClick={() => { setAuthModalOpen(true); setMenuOpen(false) }} style={{ width: '100%', marginBottom: 12 }}>
                    Se connecter
                  </Button>
                  <Button variant="primary" size="md" onClick={() => { handleStart(); setMenuOpen(false) }} style={{ width: '100%' }}>
                    Commencer
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
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
