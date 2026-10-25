import React from 'react'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

const FONT = "'Plus Jakarta Sans', sans-serif"
const FONT_TITRE = "'Syne', sans-serif"

const sections = [
  {
    titre: 'Aucune collecte, aucun suivi',
    texte: "L'extension ne contient aucun traceur, aucune statistique d'usage, aucun cookie. Elle n'enregistre rien sur votre navigation et ne lit le contenu d'une page qu'au moment précis où vous cliquez sur le bouton « Analyser avec Inspexo ».",
  },
  {
    titre: 'Ce qui est envoyé, et à qui',
    texte: "Au clic, l'extension extrait de la page d'annonce : titre, prix, année, kilométrage, carburant, boîte, description, type de vendeur affiché par le site, URL de l'annonce et jusqu'à 6 photos. Ces données sont envoyées exclusivement à inspexo.io pour produire l'analyse. Aucune requête n'est faite vers un autre service.",
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
    texte: "activeTab et scripting : afficher le bouton et lire la page d'annonce au clic. Accès limité à leboncoin.fr, lacentrale.fr et autoscout24.fr : le bouton n'existe que sur ces trois sites, l'extension est inerte partout ailleurs.",
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
        <meta name="description" content="Politique de confidentialité de l'extension Chrome Inspexo : aucune collecte, aucun tracking, photos jamais stockées, données envoyées uniquement à inspexo.io." />
        <link rel="canonical" href="https://www.inspexo.io/extension/confidentialite" />
      </Helmet>
      <Navbar />
      <main style={{ background: '#F8F9FA', minHeight: '100vh' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '110px 20px 64px' }}>
          <h1 style={{ fontFamily: FONT_TITRE, fontWeight: 800, fontSize: 'clamp(1.6rem, 4.5vw, 2.2rem)', color: '#0F1B2D', margin: '0 0 8px', lineHeight: 1.2 }}>
            Confidentialité de l'extension Chrome
          </h1>
          <p style={{ fontFamily: FONT, fontSize: '0.8125rem', color: '#9CA3AF', margin: '0 0 28px' }}>
            Dernière mise à jour : 26 octobre 2026 — s'applique à l'extension « Inspexo — Analyser une annonce auto ».
          </p>
          {sections.map((s, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14, padding: '20px 22px', marginBottom: 12 }}>
              <h2 style={{ fontFamily: FONT, fontWeight: 700, fontSize: '1rem', color: '#0F1B2D', margin: '0 0 8px' }}>{s.titre}</h2>
              <p style={{ fontFamily: FONT, fontWeight: 300, fontSize: '0.9063rem', color: '#374151', lineHeight: 1.65, margin: 0 }}>{s.texte}</p>
            </div>
          ))}
          <p style={{ fontFamily: FONT, fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.6 }}>
            Éditeur : Inspexo — contact@inspexo.io. Voir aussi la{' '}
            <a href="/politique-de-confidentialite" style={{ color: '#1E4D8C' }}>politique de confidentialité générale du site</a>.
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
