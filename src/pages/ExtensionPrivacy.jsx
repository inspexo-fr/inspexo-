import React from 'react'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Rows from '../components/Rows'

const sections = [
  {
    titre: 'Aucune collecte sans votre action',
    texte: "L'extension ne contient aucun traceur, aucune statistique d'usage, aucun cookie, et n'enregistre rien sur votre navigation. Elle ne lit le contenu d'une page qu'au moment précis où vous cliquez : sur « Analyser avec Inspexo » pour une annonce, ou sur « Ajouter ces annonces comme comparables » sur une page de résultats. Rien ne part jamais en tâche de fond.",
  },
  {
    titre: 'Ce qui est envoyé pour une analyse, et à qui',
    texte: "Au clic sur « Analyser avec Inspexo », l'extension extrait de la page d'annonce : titre, prix, année, kilométrage, carburant, boîte, description, type de vendeur affiché par le site, URL de l'annonce et jusqu'à 6 photos. Ces données sont envoyées exclusivement à inspexo.io pour produire l'analyse. Aucune requête n'est faite vers un autre service.",
  },
  {
    titre: 'Contribuer aux prix de marché : sur demande seulement',
    texte: "Sur une page de résultats, le bouton « Ajouter ces annonces comme comparables » joint les annonces affichées à votre prochaine analyse. Une case « Contribuer anonymement aux prix de marché », DÉCOCHÉE par défaut, permet en plus d'alimenter notre relevé de prix : si vous la cochez, le même clic envoie le titre, l'année, le kilométrage, le prix, le carburant, la boîte et le code postal des annonces affichées. Votre choix est mémorisé et se décoche à tout moment. Sans cette case, aucune donnée ne part vers le relevé de prix.",
  },
  {
    titre: 'Le relevé de prix ne garde que des moyennes',
    texte: "Une contribution n'est jamais conservée annonce par annonce. Chaque prix est immédiatement fondu dans un comptage par segment — marque, modèle, motorisation, boîte, tranche d'année, tranche de kilométrage, région et mois — qui ne permet de retrouver ni une annonce, ni un vendeur, ni vous. Le titre et le code postal servent uniquement, en mémoire, à déterminer le modèle et la région, puis sont oubliés : aucune URL, aucun titre, aucun code postal n'est enregistré, et la date la plus précise conservée est le mois. Rien n'est republié annonce par annonce. Le nombre de contributions est plafonné par jour et par utilisateur.",
  },
  {
    titre: 'Photos : jamais stockées',
    texte: "Les photos sont téléchargées et redimensionnées dans votre navigateur (1 600 px maximum) ; le ré-encodage supprime les métadonnées EXIF (dont la localisation GPS). Elles servent uniquement à l'analyse automatique puis sont oubliées : Inspexo ne conserve que leur nombre.",
  },
  {
    titre: 'Ce qui est conservé',
    texte: "Seul le résultat d'analyse (verdict, score, constats) est conservé pour alimenter la page de résultat partageable. Le texte de l'annonce analysée est conservé à des fins de fonctionnement du service. Aucune donnée d'identité n'est demandée : l'extension fonctionne sans compte.",
  },
  {
    titre: 'Permissions demandées',
    texte: "activeTab et scripting : afficher le bouton et lire la page au clic. storage : retenir les annonces comparables (24 h maximum) et votre choix sur la case de contribution. Accès limité à leboncoin.fr, lacentrale.fr et autoscout24.fr : les boutons n'existent que sur ces trois sites, l'extension est inerte partout ailleurs.",
  },
  {
    titre: 'Vos droits',
    texte: "Conformément au RGPD, vous pouvez demander la suppression d'une analyse en écrivant à contact@inspexo.io. L'adresse IP est utilisée uniquement sous forme hachée pour limiter le nombre d'analyses gratuites (5 par 24 heures).",
  },
]

export default function ExtensionPrivacy() {
  return (
    <>
      <Helmet>
        <title>Confidentialité de l'extension Chrome — Inspexo</title>
        <meta name="description" content="Politique de confidentialité de l'extension Chrome Inspexo : aucune collecte sans votre action, contribution aux prix de marché sur demande et en agrégats, photos jamais stockées, données envoyées uniquement à inspexo.io." />
        <link rel="canonical" href="https://www.inspexo.io/extension/confidentialite" />
      </Helmet>
      <Navbar />
      <main>
        <section className="sec" style={{ borderTop: 'none' }}>
          <div className="wrap-doc">
            <h1 className="legal-h1">Confidentialité de l'extension Chrome</h1>
            <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.6, margin: '0 0 28px' }}>
              Dernière mise à jour : 26 octobre 2026 — s'applique à l'extension « Inspexo — Analyser une annonce auto ».
            </p>
            <Rows items={sections.map((s, i) => ({
              dt: String(i + 1).padStart(2, '0'),
              titre: s.titre,
              texte: s.texte,
            }))} />
            <p className="legal-p" style={{ marginTop: 24 }}>
              Éditeur : Inspexo — contact@inspexo.io. Voir aussi la{' '}
              <a href="/politique-de-confidentialite" className="legal-a">politique de confidentialité générale du site</a>.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
