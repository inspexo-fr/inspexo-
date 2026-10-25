import React from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

const FONT = "'Plus Jakarta Sans', sans-serif"
const FONT_TITRE = "'Syne', sans-serif"

// Renseigner l'URL du Chrome Web Store après validation de la soumission.
const STORE_URL = null

const etapes = [
  { titre: 'Ouvrez une annonce', texte: 'Sur Leboncoin, La Centrale ou AutoScout24, affichez la page d\'une voiture d\'occasion.' },
  { titre: 'Cliquez sur le bouton', texte: '« Analyser avec Inspexo » apparaît en bas de page. Un clic suffit : titre, prix, kilométrage, description et jusqu\'à 6 photos sont envoyés pour analyse.' },
  { titre: 'Lisez le verdict', texte: 'Rappels constructeur, airbags Takata, pannes connues du moteur, incohérences et questions à poser au vendeur — en moins d\'une minute.' },
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
      <main style={{ background: '#F8F9FA', minHeight: '100vh' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '110px 20px 64px' }}>
          <div style={{ fontFamily: FONT, fontSize: '0.8125rem', fontWeight: 600, color: '#FF4D00', letterSpacing: '0.08em', marginBottom: 14 }}>
            {'// Extension Chrome'}
          </div>
          <h1 style={{ fontFamily: FONT_TITRE, fontWeight: 800, fontSize: 'clamp(1.8rem, 5vw, 2.6rem)', color: '#0F1B2D', margin: '0 0 14px', lineHeight: 1.15 }}>
            Analysez une annonce sans la copier-coller
          </h1>
          <p style={{ fontFamily: FONT, fontWeight: 300, fontSize: '1.0625rem', color: '#6B7280', lineHeight: 1.65, margin: '0 0 28px' }}>
            Un bouton « Analyser avec Inspexo » directement sur Leboncoin, La Centrale
            et AutoScout24. Même analyse gratuite que sur le site, photos comprises.
          </p>

          {STORE_URL ? (
            <a href={STORE_URL} target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-block', background: '#FF4D00', color: '#fff', borderRadius: 10,
              padding: '14px 28px', textDecoration: 'none', fontFamily: FONT, fontWeight: 700, fontSize: '0.9375rem',
            }}>
              Installer depuis le Chrome Web Store
            </a>
          ) : (
            <div style={{
              display: 'inline-block', background: '#0F1B2D', color: '#fff', borderRadius: 10,
              padding: '14px 28px', fontFamily: FONT, fontWeight: 700, fontSize: '0.9375rem',
            }}>
              Bientôt sur le Chrome Web Store
            </div>
          )}

          <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 16, padding: '26px 24px', margin: '36px 0 20px' }}>
            {etapes.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, padding: '14px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
                <div style={{
                  fontFamily: FONT_TITRE, fontWeight: 800, color: '#FF4D00',
                  fontSize: '1.125rem', flexShrink: 0, width: 28,
                }}>
                  {`0${i + 1}`}
                </div>
                <div>
                  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: '0.9375rem', color: '#0F1B2D', marginBottom: 4 }}>{e.titre}</div>
                  <div style={{ fontFamily: FONT, fontWeight: 300, fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.6 }}>{e.texte}</div>
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontFamily: FONT, fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.6 }}>
            Aucune collecte, aucun suivi : l'extension ne lit la page qu'au moment où
            vous cliquez, n'envoie les données qu'à inspexo.io, et les photos — EXIF
            supprimé — ne sont jamais conservées.{' '}
            <Link to="/extension/confidentialite" style={{ color: '#1E4D8C' }}>Politique de confidentialité de l'extension</Link>.
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
