import React from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

// Renseigner l'URL du Chrome Web Store après validation de la soumission.
const STORE_URL = null

const etapesExtension = [
  { titre: 'Ouvrez une annonce', texte: 'Sur Leboncoin, La Centrale ou AutoScout24, affichez la page d\'une voiture d\'occasion.' },
  { titre: 'Cliquez sur le bouton', texte: '« Analyser avec Inspexo » apparaît en bas de page. Un clic suffit : titre, prix, kilométrage, description et jusqu\'à 6 photos sont envoyés pour analyse.' },
  { titre: 'Lisez le dossier', texte: 'Rappels constructeur, airbags Takata, pannes connues du moteur, incohérences et questions à poser au vendeur — en moins d\'une minute.' },
]

const etapesAppli = [
  { titre: 'Ouvrez l\'annonce dans Leboncoin', texte: 'Dans l\'appli Leboncoin ou La Centrale, sur la page de l\'annonce.' },
  { titre: 'Partager, puis Inspexo', texte: 'Le menu Partager du téléphone propose Inspexo. L\'annonce est lue sur votre téléphone, jamais par nos serveurs.' },
  { titre: 'Le dossier s\'ouvre', texte: 'Même analyse gratuite que sur le site, photos comprises.' },
]

export default function ExtensionPage() {
  return (
    <>
      <Helmet>
        <title>Extension Chrome Inspexo — analysez une annonce en un clic</title>
        <meta name="description" content="L'extension Chrome Inspexo ajoute un bouton « Analyser avec Inspexo » sur Leboncoin, La Centrale et AutoScout24. Verdict gratuit en un clic, photos comprises." />
        <link rel="canonical" href="https://www.inspexo.io/extension" />
      </Helmet>
      <Navbar />
      <main>
        <section className="sec" style={{ borderTop: 'none' }}>
          <div className="wrap">
            <div className="sec-head">
              <h1 style={{ fontSize: 'clamp(30px,3.6vw,46px)' }}>Là où vous cherchez déjà.</h1>
              <p>Un bouton « Analyser avec Inspexo » directement sur Leboncoin, La Centrale
              et AutoScout24. Même analyse gratuite que sur le site, photos comprises.</p>
            </div>

            <div className="channels">
              <div className="channel">
                <h3>Extension Chrome</h3>
                <p>Un clic sur la page de l'annonce : texte et photos partent tout seuls.</p>
                <ol>
                  {etapesExtension.map((e, i) => (
                    <li key={i}><span>{i + 1}</span><span><b>{e.titre}.</b> {e.texte}</span></li>
                  ))}
                </ol>
                {STORE_URL ? (
                  <a href={STORE_URL} target="_blank" rel="noopener noreferrer" className="btn" style={{ marginTop: 18, width: 'auto', display: 'inline-flex' }}>
                    Installer depuis le Chrome Web Store
                  </a>
                ) : (
                  <span className="state">Bientôt sur le Chrome Web Store</span>
                )}
              </div>
              <div className="channel">
                <h3>Appli iPhone et Android</h3>
                <p>Depuis l'appli Leboncoin, touchez Partager puis Inspexo.</p>
                <ol>
                  {etapesAppli.map((e, i) => (
                    <li key={i}><span>{i + 1}</span><span><b>{e.titre}.</b> {e.texte}</span></li>
                  ))}
                </ol>
                <span className="state">En préparation</span>
              </div>
              <div className="channel">
                <h3>Sur le site</h3>
                <p>Collez le texte de l'annonce, ajoutez les photos si vous voulez. Marche partout, sans rien installer.</p>
                <ol>
                  <li><span>1</span>Copiez l'annonce</li>
                  <li><span>2</span>Collez-la sur la page d'analyse</li>
                  <li><span>3</span>Lisez le dossier</li>
                </ol>
                <Link to="/score" className="btn-ghost" style={{ marginTop: 18, width: 'auto', display: 'inline-flex' }}>
                  Analyser une annonce
                </Link>
              </div>
            </div>

            <p className="mono c-graphite" style={{ marginTop: 36, fontSize: 11, lineHeight: 1.7, maxWidth: '60em' }}>
              Aucune collecte, aucun suivi : l'extension ne lit la page qu'au moment où
              vous cliquez, n'envoie les données qu'à inspexo.io, et les photos — EXIF
              supprimé — ne sont jamais conservées.{' '}
              <Link to="/extension/confidentialite">Politique de confidentialité de l'extension</Link>.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
