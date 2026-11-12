import React, { useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { alerteModeleConfirmer } from '../lib/scoreApi'

// SPRINT 23, LOT 3 — Confirmation du double opt-in. La confirmation passe par
// un BOUTON (POST) : un scanner de messagerie qui précharge le lien de l'e-mail
// ne confirme rien.
export default function AlerteConfirmerPage() {
  const q = new URLSearchParams(useLocation().search)
  const id = q.get('i') || ''
  const jeton = q.get('t') || ''
  const [etat, setEtat] = useState('idle') // idle | envoi | ok | erreur
  const [message, setMessage] = useState(null)

  const confirmer = async () => {
    setEtat('envoi'); setMessage(null)
    try {
      const r = await alerteModeleConfirmer(id, jeton)
      setEtat('ok')
      setMessage(`Alerte confirmée${r?.vehicule ? ` pour ${r.vehicule}` : ''}. Vous serez prévenu si un nouveau rappel constructeur est publié dans RappelConso.`)
    } catch (e) {
      setEtat('erreur'); setMessage(e?.message || 'Confirmation impossible.')
    }
  }

  return (
    <>
      <Helmet><title>Confirmer l'alerte rappel — Inspexo</title><meta name="robots" content="noindex" /></Helmet>
      <Navbar />
      <main>
        <section className="sec" style={{ borderTop: 'none' }}>
        <div className="wrap-doc">
        <p className="eyebrow">Alerte rappel</p>
        <h1 style={{ fontSize: 28, marginTop: 10 }}>Confirmer l'alerte</h1>
        {etat === 'ok' ? (
          <p className="c-vert" style={{ fontSize: 16, lineHeight: 1.6, marginTop: 14 }}>{message}</p>
        ) : (
          <>
            <p style={{ fontSize: 15, lineHeight: 1.6, marginTop: 14 }}>
              Confirmez pour recevoir un e-mail si un nouveau rappel constructeur est publié pour ce modèle.
              Chaque e-mail contient un lien de désinscription en un clic.
            </p>
            <button type="button" className="btn" style={{ marginTop: 16 }} disabled={etat === 'envoi' || !id || !jeton} onClick={confirmer}>
              {etat === 'envoi' ? 'Confirmation…' : 'Confirmer l\'alerte'}
            </button>
            {etat === 'erreur' && <p className="c-rouge" style={{ fontSize: 14, marginTop: 10 }}>{message}</p>}
          </>
        )}
        <p style={{ fontSize: 14, marginTop: 24 }}><Link to="/">Retour à l'accueil</Link></p>
        </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
