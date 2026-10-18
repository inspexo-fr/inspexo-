import React, { useState } from 'react'
import { submitLead } from '../lib/scoreApi'

const CONSENT_TEXT = 'En laissant votre email, vous acceptez d\'être recontacté par Inspexo à ce sujet. Lien de désinscription dans chaque email.'

/**
 * Formulaire email → lead Supabase (RPC submit_lead) + mention de consentement.
 * variant: 'dark' (fond bleu nuit) | 'light' (fond clair)
 */
export default function LeadEmailForm({ source, analysisId = null, buttonLabel = 'Me prévenir', variant = 'dark', successMessage = '✓ Enregistré ! On vous prévient par email.' }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState('idle') // idle | sending | done | error

  const dark = variant === 'dark'

  const submit = async (e) => {
    e.preventDefault()
    if (!email || state === 'sending') return
    setState('sending')
    try {
      await submitLead(email, source, analysisId)
      setState('done')
    } catch (_) {
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div style={{
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: '0.9375rem', fontWeight: 600, color: '#22C55E',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {successMessage}
      </div>
    )
  }

  return (
    <form onSubmit={submit}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          type="email" required placeholder="votre@email.com"
          value={email} onChange={e => setEmail(e.target.value)}
          style={{
            flex: '1 1 180px', boxSizing: 'border-box',
            background: dark ? 'rgba(255,255,255,0.07)' : '#fff',
            border: dark ? '1px solid rgba(255,255,255,0.12)' : '1.5px solid rgba(0,0,0,0.12)',
            borderRadius: 8, padding: '11px 16px',
            color: dark ? '#fff' : '#0F1B2D',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 16, outline: 'none',
          }}
        />
        <button type="submit" disabled={state === 'sending'} style={{
          background: '#FF4D00', color: '#fff',
          padding: '11px 24px', borderRadius: 8,
          fontWeight: 700, fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: '0.875rem', border: 'none', cursor: 'pointer',
          whiteSpace: 'nowrap', opacity: state === 'sending' ? 0.6 : 1,
        }}>
          {state === 'sending' ? '…' : buttonLabel}
        </button>
      </div>
      {state === 'error' && (
        <div style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.8125rem',
          color: '#F87171', marginTop: 6,
        }}>
          Email invalide ou erreur réseau — réessayez.
        </div>
      )}
      <div style={{
        marginTop: 8, fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: '0.6875rem', lineHeight: 1.5,
        color: dark ? 'rgba(255,255,255,0.35)' : '#9CA3AF',
      }}>
        {CONSENT_TEXT}
      </div>
    </form>
  )
}
