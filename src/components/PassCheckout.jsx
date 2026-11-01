import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EmailCapture from './EmailCapture'
import { creerPassCheckout, getPassConfig } from '../lib/scoreApi'
import { supabase } from '../lib/supabaseClient'

// SPRINT 7 — Achat du Pass (Stripe Checkout, page hébergée Stripe).
// La vente n'est OUVERTE que si le serveur le dit (MEDIATEUR_NOM + clé
// Stripe posés) : sinon ce composant retombe sur le capteur « Être prévenu »
// (pass_waitlist), comme avant. Les CGV (/cgv-pass) s'acceptent par une case
// dédiée AVANT paiement ; la renonciation au délai de rétractation est une
// seconde case, distincte et facultative (usage immédiat).

export default function PassCheckout({ analysisId = null }) {
  const [config, setConfig] = useState(undefined) // undefined = chargement
  const [email, setEmail] = useState('')
  const [cgv, setCgv] = useState(false)
  const [renonce, setRenonce] = useState(true)
  const [etat, setEtat] = useState('idle') // idle | envoi | erreur
  const [message, setMessage] = useState(null)

  useEffect(() => {
    let cancelled = false
    getPassConfig().then(c => { if (!cancelled) setConfig(c) }).catch(() => { if (!cancelled) setConfig(null) })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && session?.user?.email) setEmail(prev => prev || session.user.email)
    })
    return () => { cancelled = true }
  }, [])

  // Vente pas (encore) ouverte : capteur email, comportement d'avant.
  if (config === undefined) return null
  if (!config?.actif) {
    return <ApercuWaitlist analysisId={analysisId} />
  }

  const prixEur = (config.prix_cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0 })
  const precommande = config.mode === 'precommande'

  const payer = async (e) => {
    e.preventDefault()
    if (etat === 'envoi') return
    if (!cgv) { setMessage('Acceptez les CGV du Pass pour continuer.'); return }
    setEtat('envoi')
    setMessage(null)
    try {
      const { url } = await creerPassCheckout(email.trim(), {
        renonceRetractation: renonce,
        analysisId,
      })
      window.location.assign(url) // page de paiement hébergée Stripe
    } catch (err) {
      setEtat('erreur')
      setMessage(err?.message || 'Paiement indisponible. Réessayez.')
    }
  }

  return (
    <form onSubmit={payer}>
      <input
        type="email" required placeholder="votre@email.com" value={email}
        onChange={e => setEmail(e.target.value)} className="input"
        aria-label="Email du Pass (compte et reçu)" autoComplete="email"
      />
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, cursor: 'pointer', fontSize: 13, lineHeight: 1.5 }}>
        <input type="checkbox" checked={cgv} onChange={() => setCgv(v => !v)} style={{ marginTop: 2, width: 16, height: 16 }} required />
        <span>J'accepte les <Link to="/cgv-pass" target="_blank">CGV du Pass achat</Link>.</span>
      </label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 8, cursor: 'pointer', fontSize: 13, lineHeight: 1.5 }}>
        <input type="checkbox" checked={renonce} onChange={() => setRenonce(v => !v)} style={{ marginTop: 2, width: 16, height: 16 }} />
        <span>
          Je demande l'exécution immédiate du service et je reconnais perdre mon droit de
          rétractation une fois le service pleinement exécuté (sans cette case, l'accès ouvre
          après le délai légal de 14 jours).
        </span>
      </label>
      <button type="submit" className="btn" style={{ marginTop: 12 }} disabled={etat === 'envoi'}>
        {etat === 'envoi' ? 'Redirection vers le paiement…' : `Prendre le Pass — ${prixEur} €${precommande ? ' (précommande)' : ''}`}
      </button>
      {message && <div className="c-rouge" style={{ fontSize: 13, marginTop: 8 }}>{message}</div>}
      <p className="pass-note">
        Paiement sécurisé Stripe · 30 jours, annonces illimitées · Remboursé sans condition
        pendant 14 jours · Aucune reconduction automatique.
      </p>
    </form>
  )
}

function ApercuWaitlist({ analysisId }) {
  const [capture, setCapture] = useState(false)
  return capture ? (
    <EmailCapture
      title="Le Pass achat arrive — être prévenu du lancement ?"
      buttonLabel="Être prévenu"
      source="pass_waitlist"
      analysisId={analysisId}
    />
  ) : (
    <>
      <button type="button" className="btn" onClick={() => setCapture(true)}>Être prévenu du lancement</button>
      <p className="pass-note">Sortie prévue en décembre 2026. Remboursé sans condition pendant 14 jours. Aucune reconduction automatique.</p>
    </>
  )
}
