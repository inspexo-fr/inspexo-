import React from 'react'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

export default function MentionsLegales() {
  return (
    <>
      <Helmet>
        <title>Mentions légales | Inspexo</title>
        <meta name="description" content="Mentions légales d'Inspexo — informations sur l'éditeur, l'hébergement et les conditions d'utilisation du site inspexo.io." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://www.inspexo.io/mentions-legales" />
      </Helmet>
      <Navbar />
      <div className="legal-container">
        <div className="wrap-doc">

          {/* Retour */}
          <a href="/" className="legal-retour">← Retour à l'accueil</a>

          <h1 className="legal-h1">
            Mentions légales
          </h1>
          <p className="legal-p" style={{ color: 'var(--graphite)', marginBottom: 40 }}>Dernière mise à jour : mars 2026</p>

          <h2 className="legal-h2">1. Éditeur du site</h2>
          <p className="legal-p">Le site inspexo.io est édité par :</p>
          <p className="legal-p">
            <strong>DUPLEX SAS</strong><br />
            Société par actions simplifiée au capital de 30 000,00€<br />
            Siège social : 17 rue Pierre Deldi, 31100 Toulouse, France<br />
            SIREN : 941 962 060<br />
            SIRET : 941 962 060 00013<br />
            RCS Toulouse : 941 962 060<br />
            N° TVA intracommunautaire : FR33941962060<br />
            Président : Boy Utku<br />
            Email : <a href="mailto:contact@inspexo.io" className="legal-a">contact@inspexo.io</a><br />
            Site web : <a href="https://inspexo.io" className="legal-a">https://inspexo.io</a>
          </p>
          <p className="legal-p">Nom commercial : <strong>Inspexo</strong></p>

          <h2 className="legal-h2">2. Hébergement</h2>
          <p className="legal-p">
            Le site est hébergé par :<br />
            <strong>Vercel Inc.</strong><br />
            440 N Barranca Ave #4133, Covina, CA 91723, États-Unis<br />
            <a href="https://vercel.com" className="legal-a">https://vercel.com</a>
          </p>
          <p className="legal-p">
            Les données sont hébergées par :<br />
            <strong>Supabase Inc.</strong><br />
            970 Toa Payoh North #07-04, Singapore 318992<br />
            <a href="https://supabase.com" className="legal-a">https://supabase.com</a><br />
            Données stockées dans la région EU (Francfort, Allemagne)
          </p>

          <h2 className="legal-h2">3. Propriété intellectuelle</h2>
          <p className="legal-p">
            L'ensemble du contenu du site inspexo.io (textes, images, graphismes, logo, icônes, logiciels, base de données) est la propriété exclusive de DUPLEX SAS ou de ses partenaires et est protégé par les lois françaises et internationales relatives à la propriété intellectuelle.
          </p>
          <p className="legal-p">
            Toute reproduction, représentation, modification, publication, transmission, ou dénaturation, totale ou partielle, du site ou de son contenu, par quelque procédé que ce soit, et sur quelque support que ce soit, est interdite sans l'autorisation écrite préalable de DUPLEX SAS.
          </p>

          <h2 className="legal-h2">4. Responsabilité</h2>
          <p className="legal-p">
            Les informations fournies par l'expert IA Inspexo sont données à titre indicatif et ne constituent pas un diagnostic professionnel certifié. DUPLEX SAS ne saurait être tenue responsable des décisions prises sur la base de ces informations.
          </p>
          <p className="legal-p">
            Les experts référencés sur la plateforme sont des professionnels indépendants. DUPLEX SAS agit en qualité d'intermédiaire de mise en relation et ne se substitue pas à la responsabilité des experts dans l'exercice de leurs missions.
          </p>

          <h2 className="legal-h2">5. Données personnelles</h2>
          <p className="legal-p">
            Le traitement des données personnelles est décrit dans notre{' '}
            <a href="/politique-de-confidentialite" className="legal-a">Politique de Confidentialité</a>.
          </p>

          <h2 className="legal-h2">6. Cookies</h2>
          <p className="legal-p">
            Le site utilise des cookies essentiels au fonctionnement du service (authentification, paiement). La politique cookies est détaillée dans notre{' '}
            <a href="/politique-de-confidentialite" className="legal-a">Politique de Confidentialité</a>.
          </p>

          <h2 className="legal-h2">7. Droit applicable</h2>
          <p className="legal-p">
            Les présentes mentions légales sont régies par le droit français. En cas de litige, les tribunaux de Toulouse seront seuls compétents.
          </p>
        </div>
      </div>
      <Footer />
    </>
  )
}
