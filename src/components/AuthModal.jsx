import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const SUPABASE_URL  = process.env.REACT_APP_SUPABASE_URL
const ANON_KEY      = process.env.REACT_APP_SUPABASE_ANON_KEY

async function sendWelcomeEmail(email) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
      },
      body: JSON.stringify({ to: email, template: 'welcome', data: {} }),
    })
  } catch (err) {
    console.error('Welcome email error:', err)
  }
}

export default function AuthModal({ isOpen, onClose, onSuccess }) {
  const [tab, setTab] = useState('login')         // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('idle')    // 'idle' | 'loading' | 'error' | 'check_email'
  const [errorMsg, setErrorMsg] = useState('')

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setTab('login'); setEmail(''); setPassword('')
      setStatus('idle'); setErrorMsg('')
    }
  }, [isOpen])

  // Scroll lock
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Escape
  const handleKeyDown = useCallback(e => { if (e.key === 'Escape') onClose() }, [onClose])
  useEffect(() => {
    if (isOpen) window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleKeyDown])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('loading'); setErrorMsg('')

    if (tab === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setErrorMsg(error.message === 'Invalid login credentials'
          ? 'Email ou mot de passe incorrect.'
          : error.message)
        setStatus('error')
      } else {
        setStatus('idle')
        onSuccess?.()
        onClose()
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setErrorMsg(error.message === 'User already registered'
          ? 'Un compte existe déjà avec cet email. Connectez-vous.'
          : error.message)
        setStatus('error')
      } else {
        sendWelcomeEmail(email)
        setStatus('check_email')
      }
    }
  }

  if (!isOpen) return null

  return (
    <>
      <style>{`
        .auth-input {
          width: 100%; padding: 11px 14px; border-radius: 10px;
          border: 1.5px solid rgba(0,0,0,0.1);
          font-size: 0.9375rem; font-family: 'Plus Jakarta Sans', sans-serif;
          color: #0F1B2D; outline: none; box-sizing: border-box; background: #fff;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .auth-input:focus { border-color: #FF4D00; box-shadow: 0 0 0 3px rgba(255,77,0,0.08); }
        .auth-input::placeholder { color: #9CA3AF; }
        .auth-tab {
          flex: 1; padding: 10px; border: none; cursor: pointer;
          font-size: 0.875rem; font-weight: 600;
          font-family: 'Plus Jakarta Sans', sans-serif;
          transition: all 0.2s; border-radius: 8px; background: transparent;
        }
        .auth-tab.active { background: #fff; color: #0F1B2D; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
        .auth-tab:not(.active) { color: #9CA3AF; }
        .auth-btn {
          width: 100%; background: #FF4D00; color: #fff;
          padding: 14px 24px; border-radius: 12px;
          font-size: 1rem; font-weight: 700;
          font-family: 'Plus Jakarta Sans', sans-serif;
          border: none; cursor: pointer; transition: opacity 0.2s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .auth-btn:hover:not(:disabled) { opacity: 0.88; }
        .auth-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        @keyframes auth-spin { to { transform: rotate(360deg); } }
        .auth-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #fff; border-radius: 50%;
          display: inline-block; animation: auth-spin 0.7s linear infinite;
        }
        .auth-google-btn {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
          background: #fff; border: 1.5px solid rgba(0,0,0,0.12); border-radius: 12px;
          padding: 13px 20px; cursor: pointer;
          font-size: 0.9375rem; font-weight: 600;
          font-family: 'Plus Jakarta Sans', sans-serif; color: #0F1B2D;
          transition: background 0.2s, border-color 0.2s;
        }
        .auth-google-btn:hover { background: #F8F9FA; border-color: rgba(0,0,0,0.2); }
        .auth-separator {
          display: flex; align-items: center; gap: 12px;
          margin: 20px 0;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 0.8125rem; color: #9CA3AF; font-weight: 500;
        }
        .auth-separator::before, .auth-separator::after {
          content: ''; flex: 1; height: 1px; background: rgba(0,0,0,0.08);
        }
        @keyframes auth-overlay-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes auth-modal-in {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>

      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(8,14,24,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16, animation: 'auth-overlay-in 0.2s ease',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: '#fff', borderRadius: 20,
            width: '100%', maxWidth: 420,
            boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
            animation: 'auth-modal-in 0.25s ease',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            background: '#0F1B2D', padding: '28px 28px 24px',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              marginBottom: 20,
            }}>
              <div>
                <div style={{
                  fontFamily: 'Syne, sans-serif', fontWeight: 800,
                  fontSize: '1.375rem', color: '#fff', marginBottom: 4,
                }}>
                  {tab === 'login' ? 'Bon retour 👋' : 'Créer un compte'}
                </div>
                <div style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.875rem', fontWeight: 300,
                  color: 'rgba(255,255,255,0.5)',
                }}>
                  {tab === 'login' ? 'Accédez à vos missions.' : 'Commencez à utiliser Inspexo.'}
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)',
                  fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div style={{
              display: 'flex', background: 'rgba(255,255,255,0.07)',
              borderRadius: 10, padding: 4, gap: 4,
            }}>
              <button className={`auth-tab${tab === 'login' ? ' active' : ''}`} onClick={() => { setTab('login'); setErrorMsg(''); setStatus('idle') }}>
                Connexion
              </button>
              <button className={`auth-tab${tab === 'signup' ? ' active' : ''}`} onClick={() => { setTab('signup'); setErrorMsg(''); setStatus('idle') }}>
                Inscription
              </button>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '28px 28px 32px' }}>

            {/* Google OAuth */}
            {status !== 'check_email' && (
              <>
                <button
                  type="button"
                  className="auth-google-btn"
                  onClick={() => supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: window.location.origin },
                  })}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                  Continuer avec Google
                </button>
                <div className="auth-separator">ou</div>
              </>
            )}

            {/* Check email state (après signup) */}
            {status === 'check_email' ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📧</div>
                <div style={{
                  fontFamily: 'Syne, sans-serif', fontWeight: 800,
                  fontSize: '1.125rem', color: '#0F1B2D', marginBottom: 8,
                }}>
                  Confirmez votre email
                </div>
                <div style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.9375rem', fontWeight: 300,
                  color: '#6B7280', lineHeight: 1.65, marginBottom: 24,
                }}>
                  Un lien de confirmation a été envoyé à <strong>{email}</strong>. Cliquez dessus pour activer votre compte.
                </div>
                <button
                  onClick={onClose}
                  style={{
                    background: '#0F1B2D', color: '#fff',
                    padding: '11px 28px', borderRadius: 10,
                    fontSize: '0.9375rem', fontWeight: 700,
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  Fermer
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{
                    display: 'block', fontSize: '0.875rem', fontWeight: 600,
                    color: '#0F1B2D', marginBottom: 6,
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                  }}>
                    Email
                  </label>
                  <input
                    className="auth-input" type="email"
                    placeholder="vous@exemple.com" required
                    value={email} onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={{
                    display: 'block', fontSize: '0.875rem', fontWeight: 600,
                    color: '#0F1B2D', marginBottom: 6,
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                  }}>
                    Mot de passe
                    {tab === 'signup' && (
                      <span style={{ color: '#9CA3AF', fontWeight: 400, marginLeft: 8 }}>
                        (8 caractères min.)
                      </span>
                    )}
                  </label>
                  <input
                    className="auth-input" type="password"
                    placeholder="••••••••" required
                    minLength={tab === 'signup' ? 8 : undefined}
                    value={password} onChange={e => setPassword(e.target.value)}
                    autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  />
                </div>

                {/* Error */}
                {errorMsg && (
                  <div style={{
                    background: '#FEF2F2', border: '1px solid #FECACA',
                    borderRadius: 10, padding: '11px 14px', marginBottom: 16,
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: '0.875rem', color: '#DC2626',
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                  }}>
                    <span>⚠️</span> {errorMsg}
                  </div>
                )}

                <button type="submit" className="auth-btn" disabled={status === 'loading'}>
                  {status === 'loading'
                    ? <><span className="auth-spinner" /> Chargement...</>
                    : tab === 'login' ? 'Se connecter →' : 'Créer mon compte →'
                  }
                </button>

                {tab === 'login' && (
                  <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <button
                      type="button"
                      onClick={() => { setTab('signup'); setErrorMsg(''); setStatus('idle') }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        fontSize: '0.875rem', color: '#6B7280',
                      }}
                    >
                      Pas encore de compte ?{' '}
                      <span style={{ color: '#FF4D00', fontWeight: 600 }}>S'inscrire</span>
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
