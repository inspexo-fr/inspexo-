import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { CONSENT_TEXT } from '../components/EmailCapture'
import { submitLeadPro } from '../lib/scoreApi'

// SPRINT 11 — /pro : ce qu'Inspexo peut faire pour un professionnel.
// AUCUN PRIX N'EST AFFICHÉ : tarif sur devis, et aucune facturation
// automatique n'existe tant qu'aucun contrat n'est signé.

const USAGES = [
  {
    titre: 'Marchands et mandataires',
    texte: "Passer un lot d'annonces au crible avant de les reprendre : pannes connues du moteur, " +
      'rappels constructeur en cours, incohérences du texte. Le même verdict que celui que verra ' +
      "l'acheteur en face de vous.",
  },
  {
    titre: 'Places de marché et comparateurs',
    texte: 'Afficher un indicateur de risque sur une fiche, ou prioriser une modération. ' +
      'Chaque point remonté porte sa source : vous pouvez le montrer, pas seulement le croire.',
  },
  {
    titre: 'Assureurs et financeurs',
    texte: "Objectiver un dossier à l'instruction, à partir de l'annonce elle-même. " +
      "Inspexo ne vend ni assurance ni crédit : nous n'avons aucun intérêt dans votre décision.",
  },
]

function FormulaireContact() {
  const [email, setEmail] = useState('')
  const [societe, setSociete] = useState('')
  const [volume, setVolume] = useState('')
  const [message, setMessage] = useState('')
  const [etat, setEtat] = useState('idle')

  const envoyer = async (e) => {
    e.preventDefault()
    if (etat === 'envoi') return
    setEtat('envoi')
    try {
      await submitLeadPro({ email, societe, volume, message })
      setEtat('fait')
    } catch (_) {
      setEtat('erreur')
    }
  }

  if (etat === 'fait') {
    return (
      <p className="c-vert" style={{ fontSize: 15, fontWeight: 600, padding: '12px 0' }}>
        C'est noté. Nous revenons vers vous sous deux jours ouvrés.
      </p>
    )
  }

  return (
    <form onSubmit={envoyer} id="contact">
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        <input className="input" type="email" required placeholder="votre@email.pro" value={email}
          onChange={e => setEmail(e.target.value)} aria-label="Votre email professionnel" />
        <input className="input" placeholder="Société" value={societe} maxLength={120}
          onChange={e => setSociete(e.target.value)} aria-label="Société" />
        <input className="input" placeholder="Volume estimé (ex. 500 / mois)" value={volume} maxLength={60}
          onChange={e => setVolume(e.target.value)} aria-label="Volume estimé" />
      </div>
      <textarea className="input" rows={3} maxLength={2000} value={message}
        onChange={e => setMessage(e.target.value)} placeholder="Votre besoin en deux lignes"
        aria-label="Votre besoin" style={{ marginTop: 10, width: '100%' }} />
      <button type="submit" className="btn btn-auto" style={{ marginTop: 12, display: 'inline-flex' }}
        disabled={etat === 'envoi'}>
        {etat === 'envoi' ? 'Envoi…' : 'Demander un devis'}
      </button>
      {etat === 'erreur' && (
        <p className="c-rouge" style={{ fontSize: 14, marginTop: 8 }}>
          Email invalide ou erreur réseau — réessayez.
        </p>
      )}
      <p className="mono c-graphite" style={{ marginTop: 10, fontSize: 11, lineHeight: 1.6 }}>
        {CONSENT_TEXT}
      </p>
    </form>
  )
}

export default function ProPage() {
  return (
    <>
      <Helmet>
        <title>Inspexo pour les professionnels — analyse d'annonces auto à la demande</title>
        <meta name="description" content="Analyse automatique d'annonces de voitures d'occasion pour les professionnels : pannes connues sourcées, rappels constructeur, incohérences. API de scoring, tarif sur devis." />
        <link rel="canonical" href="https://www.inspexo.io/pro" />
      </Helmet>
      <Navbar />
      <main>
        <section className="sec" style={{ borderTop: 'none' }}>
          <div className="wrap">
            <div className="sec-head">
              <h1 style={{ fontSize: 'clamp(30px,3.6vw,46px)' }}>Le même verdict, dans vos outils.</h1>
              <p>
                Inspexo analyse une annonce de voiture d'occasion et rend un verdict motivé, où
                chaque affirmation porte sa source. La même analyse que celle que nous servons au
                grand public est accessible par API — <strong>sans traitement de faveur</strong> :
                un véhicule mal en point le reste, qui que soit le demandeur.
              </p>
            </div>

            <div className="channels">
              {USAGES.map((u) => (
                <div className="channel" key={u.titre}>
                  <h2>{u.titre}</h2>
                  <p>{u.texte}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="wrap">
            <div className="sec-head">
              <h2>Ce que nous ne ferons pas</h2>
              <p>
                C'est sans doute plus utile à savoir que la liste des fonctions.
              </p>
            </div>
            <div className="rows">
              <div className="row">
                <h3>Modifier un verdict à la demande</h3>
                <p>Le score est calculé par un barème déterministe, versionné, identique pour tous.
                Aucun client ne peut le faire pencher, ni pour ses annonces, ni contre celles d'un
                concurrent.</p>
              </div>
              <div className="row">
                <h3>Inventer une panne, un prix ou un coût</h3>
                <p>Une affirmation sans source consultable est supprimée avant publication. Nos
                réponses contiennent des points sourcés, ou rien.</p>
              </div>
              <div className="row">
                <h3>Revendre vos requêtes</h3>
                <p>Les annonces que vous nous envoyez servent à produire votre analyse. Les prix
                alimentent un relevé de marché strictement agrégé, jamais republié annonce par annonce.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="wrap">
            <div className="sec-head">
              <h2>API de scoring</h2>
              <p>
                Un appel, une analyse complète en JSON : verdict, score, notes par critère, points
                sourcés et version du barème. <Link to="/pro/api">Voir la documentation et un
                exemple de réponse</Link>.
              </p>
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="wrap-doc">
            <p className="eyebrow">Tarif sur devis</p>
            <h2 style={{ fontSize: 'clamp(24px,3vw,34px)', marginTop: 10 }}>
              Parlons volume et usage.
            </h2>
            <p className="lead" style={{ marginTop: 12 }}>
              Nous n'affichons pas de grille : le prix dépend du volume mensuel et de ce que vous
              faites du résultat. Décrivez votre besoin, nous revenons vers vous avec une
              proposition et un accès de test.
            </p>
            <div style={{ marginTop: 20 }}><FormulaireContact /></div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
