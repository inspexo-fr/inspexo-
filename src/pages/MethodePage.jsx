import React from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import FilAriane from '../components/FilAriane'

// SPRINT 24 (SEO, confiance) — « Méthode ». Uniquement des règles DÉJÀ
// publiées sur le site et appliquées par le code : la règle des sources de
// l'accueil, la méthode de vérification de /fiabilite, la mention obligatoire
// sous chaque résultat, et les deux règles de ce sprint (points signalés par
// des propriétaires, versions de moteur). Rien n'est affirmé ici que le code
// ne tienne pas.
export default function MethodePage() {
  return (
    <>
      <Helmet>
        <title>Méthode : d'où viennent les pannes | Inspexo</title>
        <meta name="description" content="D'où viennent les pannes affichées par Inspexo, quelles sources les portent, comment chaque affirmation est vérifiée contre sa source, et ce que l'analyse ne fait pas." />
        <link rel="canonical" href="https://www.inspexo.io/methode" />
      </Helmet>
      <FilAriane items={[{ nom: 'Méthode', url: '/methode' }]} />
      <Navbar />
      <main>
        <section className="sec" style={{ borderTop: 'none' }}>
          <div className="wrap-doc">
            <h1 className="legal-h1">Méthode</h1>

            <h2 className="legal-h2">D'où viennent les pannes</h2>
            <p className="legal-p">
              Chaque panne affichée vient d'une fiche par famille moteur, construite à partir de sources
              nommées et consultables, listées sous la panne. Une panne sans source n'est pas publiée, et
              une source qui parle d'un autre moteur est écartée.
            </p>

            <h2 className="legal-h2">La règle des sources</h2>
            <p className="legal-p">
              Une panne n'est affirmée que si une source indépendante la confirme (constructeur, rappel,
              presse). Les autres signalements vous sont présentés comme des questions à poser au vendeur.
            </p>
            <p className="legal-p">
              Un défaut que seuls des forums ou des garages rapportent apparaît comme un point à contrôler,
              « signalé par des propriétaires, non confirmé par une source indépendante », seulement s'il est
              cité par au moins trois sites différents. Il ne change jamais la note.
            </p>
            <p className="legal-p">
              Une panne qui ne concerne qu'une autre version du moteur (autre cylindrée, autre puissance)
              n'est pas retenue pour votre véhicule.
            </p>

            <h2 className="legal-h2">Comment nous vérifions</h2>
            <p className="legal-p">
              Chaque affirmation est relue contre la page qu'elle cite, par un second passage qui reçoit
              l'affirmation, l'identité du véhicule et le texte de la page, sans voir ni le score, ni le
              verdict, ni le raisonnement qui a produit l'affirmation. Trois réponses sont possibles :
              soutenue, non soutenue, ou mauvais moteur. En cas de doute, l'affirmation est comptée contre
              nous. Le résultat est publié sur la page <Link to="/fiabilite" className="legal-a">Fiabilité</Link>.
            </p>

            <h2 className="legal-h2">Les limites</h2>
            <p className="legal-p">
              Analyse automatique à partir du texte de l'annonce. Ne remplace pas un examen du véhicule.
            </p>
            <p className="legal-p">
              Ce qui n'est pas vérifiable est dit comme tel : ce qui ne cite aucune page publique est compté
              à part, jamais mélangé au taux d'erreur.
            </p>

            <p className="legal-p">
              Voir aussi : <Link to="/moteur" className="legal-a">pannes par moteur</Link> ·{' '}
              <Link to="/modele" className="legal-a">pannes par modèle</Link> ·{' '}
              <Link to="/qui-sommes-nous" className="legal-a">qui sommes-nous</Link>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
