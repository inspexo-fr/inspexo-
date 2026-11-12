import React, { useState } from 'react'
import { alerteModeleInscrire } from '../lib/scoreApi'

// SPRINT 23, LOT 3 (point 3) — « Être prévenu d'un rappel sur ce modèle ».
// Sans compte, en double opt-in : rien n'est envoyé avant que le lien reçu
// par e-mail ait été confirmé. La réponse du serveur est la même quelle que
// soit l'adresse (on ne révèle pas si elle est connue).
export default function AlerteModeleBloc({ analysisId, vehicule }) {
  const [email, setEmail] = useState('')
  const [etat, setEtat] = useState('idle') // idle | envoi | ok | erreur
  const [message, setMessage] = useState(null)

  const envoyer = async (e) => {
    e.preventDefault()
    if (etat === 'envoi') return
    setEtat('envoi'); setMessage(null)
    try {
      const r = await alerteModeleInscrire(email.trim(), analysisId)
      setEtat('ok'); setMessage(r?.message || 'Un lien de confirmation vient de vous être envoyé.')
    } catch (err) {
      setEtat('erreur'); setMessage(err?.message || 'Inscription impossible. Réessayez.')
    }
  }

  return (
    <div className="doc-sec" id="alerte-rappel">
      <p className="eyebrow">Alerte rappel</p>
      <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 6 }}>
        Être prévenu par e-mail si un nouveau rappel constructeur est publié pour {vehicule || 'ce modèle'} dans
        la base officielle RappelConso. Sans compte ; vous confirmez d'abord votre adresse.
      </p>
      {etat === 'ok' ? (
        <p className="c-vert" style={{ fontSize: 14, marginTop: 8 }}>{message}</p>
      ) : (
        <form onSubmit={envoyer} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <input
            className="input" type="email" required value={email} autoComplete="email"
            onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.fr"
            aria-label="Votre adresse e-mail" style={{ flex: '1 1 220px', fontSize: 16 }}
          />
          <button type="submit" className="btn-ghost btn-auto" disabled={etat === 'envoi'}>
            {etat === 'envoi' ? 'Envoi…' : 'Me prévenir'}
          </button>
        </form>
      )}
      {etat === 'erreur' && message && <p className="c-rouge" style={{ fontSize: 13, marginTop: 6 }}>{message}</p>}
      <p className="c-graphite" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 6 }}>
        Votre adresse ne sert qu'à cette alerte. Lien de désinscription dans chaque e-mail ; sans confirmation, elle est effacée sous 7 jours.
      </p>
    </div>
  )
}
