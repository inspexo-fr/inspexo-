import React from 'react'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { PlansPass } from './HomePage'

// /pass — le Pass achat (produit principal à 29 €, précommande à venir).
// Même contenu que la section Pass de l'accueil, dans la même DA.
export default function PassPage() {
  return (
    <>
      <Helmet>
        <title>Pass achat Inspexo — jusqu'à la signature | 29 €</title>
        <meta name="description" content="Visite guidée devant la voiture, marge de négociation sourcée, lecture du PV de contrôle technique, dossier d'achat et kit signature. 29 € pour 30 jours, annonces illimitées." />
        <link rel="canonical" href="https://www.inspexo.io/pass" />
      </Helmet>
      <Navbar />
      <main>
        <section className="sec" style={{ borderTop: 'none' }}>
          <div className="wrap">
            <div className="sec-head">
              <h1>Le Pass achat : jusqu'à la signature.</h1>
              <p>Le vendeur ne nous paie jamais. Quand l'achat devient sérieux, c'est vous qui décidez de payer, une fois, pour trente jours.</p>
            </div>
            <PlansPass />
          </div>
        </section>
        <section className="sec">
          <div className="wrap">
            <div className="sec-head">
              <h2>De l'annonce à la poignée de main.</h2>
              <p>Quatre temps. Les deux premiers sont gratuits. Les deux suivants arrivent avec le Pass achat.</p>
            </div>
            <div className="steps">
              <div className="step"><span className="n">1</span><div><h3>Collez l'annonce</h3><p>Le texte, et si vous voulez les photos. Depuis l'ordinateur, le bouton de l'extension le fait pour vous.</p><span className="tag">Gratuit</span></div></div>
              <div className="step"><span className="n">2</span><div><h3>Lisez le dossier</h3><p>Verdict, motifs, contrôles officiels, message au vendeur prêt à envoyer. Une minute après.</p><span className="tag">Gratuit</span></div></div>
              <div className="step"><span className="n">3</span><div><h3>Visitez, guidé</h3><p>Devant la voiture, point par point : démarrage à froid, compteur, pneus, PV de contrôle technique. Vos photos mettent le verdict à jour.</p><span className="tag">Pass achat</span></div></div>
              <div className="step"><span className="n">4</span><div><h3>Négociez, chiffré</h3><p>Chaque défaut constaté et chaque entretien en retard devient un montant sourcé, avec l'argumentaire à dire au vendeur.</p><span className="tag">Pass achat</span></div></div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
