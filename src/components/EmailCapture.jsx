import React, { useState } from 'react'
import { submitLead } from '../lib/scoreApi'

export const CONSENT_TEXT = 'En laissant votre email, vous acceptez d\'être recontacté par Inspexo à ce sujet. Lien de désinscription dans chaque email.'

// Capteur d'email (leads) — DA sprint 5 : champ + bouton ghost, consentement
// d'une ligne en mono. source ∈ pass_waitlist | expert_waitlist | rapport.
export default function EmailCapture({ title, buttonLabel, source, analysisId = null }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState('idle')
  const submit = async (e) => {
    e.preventDefault()
    if (!email || state === 'sending') return
    setState('sending')
    try { await submitLead(email, source, analysisId); setState('done') } catch (_) { setState('error') }
  }
  if (state === 'done') {
    return (
      <div className="c-vert" style={{ fontSize: 14, fontWeight: 600, padding: '10px 0' }}>
        C'est noté. Vous recevrez un email à cette adresse.
      </div>
    )
  }
  return (
    <form onSubmit={submit}>
      {title && <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{title}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="email" required placeholder="votre@email.com" className="input"
          style={{ flex: '1 1 180px', width: 'auto' }}
          value={email} onChange={e => setEmail(e.target.value)}
          aria-label="Votre email"
        />
        <button type="submit" className="btn-ghost btn-sm btn-auto" disabled={state === 'sending'}>
          {state === 'sending' ? '…' : buttonLabel}
        </button>
      </div>
      {state === 'error' && (
        <div className="c-rouge" style={{ fontSize: 13, marginTop: 6 }}>
          Email invalide ou erreur réseau — réessayez.
        </div>
      )}
      <div className="mono c-graphite" style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
        {CONSENT_TEXT}
      </div>
    </form>
  )
}
