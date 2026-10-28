import React, { useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import AnalyseForm from '../components/AnalyseForm'

// /score — le même formulaire que le hero de l'accueil (composant partagé),
// présenté seul, en colonne de lecture.
export default function ScorePage() {
  useEffect(() => { window.scrollTo(0, 0) }, [])

  return (
    <>
      <Helmet>
        <title>Analysez une annonce de voiture d'occasion gratuitement | Inspexo</title>
        <meta name="description" content="Collez le texte d'une annonce de véhicule d'occasion et recevez en une minute un verdict vert / orange / rouge : défauts connus du modèle, rappels constructeur, questions à poser au vendeur. Gratuit, sans inscription." />
        <link rel="canonical" href="https://www.inspexo.io/score" />
      </Helmet>

      <Navbar />

      <main>
        <section className="sec" style={{ borderTop: 'none' }}>
          <div className="wrap-doc">
            <p className="eyebrow">Analyse d'annonce · gratuit, sans inscription</p>
            <h1 style={{ fontSize: 'clamp(30px,6vw,46px)', marginTop: 14 }}>
              Cette annonce cache-t-elle un problème ?
            </h1>
            <p className="lead" style={{ marginTop: 16, marginBottom: 28 }}>
              Collez le texte de l'annonce. En une minute : verdict vert / orange / rouge
              noté sur 5 critères, pannes connues sourcées, rappels constructeur (dont
              airbags Takata), message prêt à envoyer au vendeur et liste de contrôle.
            </p>

            <AnalyseForm idPrefix="score" />

            <div className="hero-facts" style={{ marginTop: 28 }}>
              <div><span>Durée</span><span>Environ 1 minute</span></div>
              <div><span>Sources</span><span>Affichées, une par une</span></div>
              <div><span>Photos</span><span>Jamais conservées</span></div>
              <div><span>Lien avec les vendeurs</span><span>Aucun</span></div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
