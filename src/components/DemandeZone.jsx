import React, { useState } from 'react'
import { CONSENT_TEXT } from './EmailCapture'
import { submitDemandeZone } from '../lib/scoreApi'

// SPRINT 10 — Liste d'attente d'inspection AVEC code postal.
//
// L'email seul ne dit pas où recruter. Le code postal, oui : c'est la carte
// de la demande, et c'est elle qui décide du prochain département ouvert.
// Il désigne une commune, pas une personne — et la page de confidentialité
// le dit explicitement.
export default function DemandeZone({ title, analysisId = null, codePostalInitial = '' }) {
  const [email, setEmail] = useState('')
  const [cp, setCp] = useState(codePostalInitial)
  const [etat, setEtat] = useState('idle')

  const envoyer = async (e) => {
    e.preventDefault()
    if (etat === 'envoi') return
    if (!/^[0-9]{5}$/.test(cp)) { setEtat('cp'); return }
    setEtat('envoi')
    try {
      await submitDemandeZone(email, cp, analysisId)
      setEtat('fait')
    } catch (_) {
      setEtat('erreur')
    }
  }

  if (etat === 'fait') {
    return (
      <div className="c-vert" style={{ fontSize: 14, fontWeight: 600, padding: '10px 0' }}>
        C'est noté pour le {cp}. Nous vous écrirons dès qu'un inspecteur couvre ce secteur.
      </div>
    )
  }

  return (
    <form onSubmit={envoyer}>
      {title && <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{title}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          className="input" inputMode="numeric" maxLength={5} required
          placeholder="Code postal" value={cp}
          onChange={e => setCp(e.target.value.replace(/\D/g, '').slice(0, 5))}
          aria-label="Code postal où se trouve le véhicule"
          style={{ flex: '0 1 140px', width: 'auto' }}
        />
        <input
          type="email" required placeholder="votre@email.com" className="input"
          value={email} onChange={e => setEmail(e.target.value)}
          aria-label="Votre email"
          style={{ flex: '1 1 180px', width: 'auto' }}
        />
        <button type="submit" className="btn-ghost btn-sm btn-auto" disabled={etat === 'envoi'}>
          {etat === 'envoi' ? '…' : 'Être prévenu'}
        </button>
      </div>
      {etat === 'cp' && (
        <div className="c-rouge" style={{ fontSize: 13, marginTop: 6 }}>
          Indiquez un code postal à 5 chiffres.
        </div>
      )}
      {etat === 'erreur' && (
        <div className="c-rouge" style={{ fontSize: 13, marginTop: 6 }}>
          Email invalide ou erreur réseau — réessayez.
        </div>
      )}
      <div className="mono c-graphite" style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
        {CONSENT_TEXT} Le code postal sert uniquement à savoir où ouvrir le service.
      </div>
    </form>
  )
}
