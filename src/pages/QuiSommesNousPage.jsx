import React from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import FilAriane from '../components/FilAriane'
import { IDENTITE } from '../data/identite'

// SPRINT 24 (SEO, confiance) — « Qui sommes-nous ». Décision d'Utku : EXACTEMENT
// les informations déjà publiées dans les mentions légales, rien de plus. Elles
// sont lues dans la même source (`src/data/identite.js`), jamais recopiées.
export default function QuiSommesNousPage() {
  return (
    <>
      <Helmet>
        <title>Qui sommes-nous | Inspexo</title>
        <meta name="description" content={`Inspexo est édité par ${IDENTITE.raison_sociale}, ${IDENTITE.forme_juridique.toLowerCase()} immatriculée au ${IDENTITE.rcs}, à ${IDENTITE.ville}.`} />
        <link rel="canonical" href="https://www.inspexo.io/qui-sommes-nous" />
      </Helmet>
      <FilAriane items={[{ nom: 'Qui sommes-nous', url: '/qui-sommes-nous' }]} />
      <Navbar />
      <main>
        <section className="sec" style={{ borderTop: 'none' }}>
          <div className="wrap-doc">
            <h1 className="legal-h1">Qui sommes-nous</h1>
            <p className="legal-p">Le site inspexo.io est édité par :</p>
            <p className="legal-p">
              <strong>{IDENTITE.raison_sociale}</strong><br />
              {IDENTITE.forme_juridique} au capital de {IDENTITE.capital}<br />
              Siège social : {IDENTITE.adresse}<br />
              SIREN : {IDENTITE.siren}<br />
              SIRET (siège) : {IDENTITE.siret}<br />
              {IDENTITE.rcs}<br />
              N° TVA intracommunautaire : {IDENTITE.tva}<br />
              Président : {IDENTITE.president}<br />
              Email : <a href={`mailto:${IDENTITE.email}`} className="legal-a">{IDENTITE.email}</a><br />
              Site web : <a href={IDENTITE.site} className="legal-a">{IDENTITE.site}</a>
            </p>
            <p className="legal-p">Nom commercial : <strong>{IDENTITE.nom_commercial}</strong></p>
            <p className="legal-p">
              Voir aussi : <Link to="/methode" className="legal-a">notre méthode</Link> ·{' '}
              <Link to="/mentions-legales" className="legal-a">mentions légales</Link>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
