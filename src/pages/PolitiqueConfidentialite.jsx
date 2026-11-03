import React from 'react'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { IDENTITE } from '../data/identite'

export default function PolitiqueConfidentialite() {
  return (
    <>
      <Helmet>
        <title>Politique de confidentialité | Inspexo</title>
        <meta name="description" content="Politique de confidentialité d'Inspexo — collecte, traitement et protection de vos données personnelles conformément au RGPD." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://www.inspexo.io/politique-de-confidentialite" />
      </Helmet>
      <Navbar />
      <div className="legal-container">
        <div className="wrap-doc">

          {/* Retour */}
          <a href="/" className="legal-retour">← Retour à l'accueil</a>

          <h1 className="legal-h1">
            Politique de confidentialité
          </h1>
          <p className="legal-p" style={{ color: 'var(--graphite)', marginBottom: 12 }}>Dernière mise à jour : mars 2026</p>
          <p className="legal-p" style={{ marginBottom: 40 }}>
            DUPLEX SAS ("Inspexo", "nous", "notre") s'engage à protéger la vie privée des utilisateurs de son site inspexo.io ("le Site") et de ses services.
          </p>

          <h2 className="legal-h2">1. Responsable du traitement</h2>
          <p className="legal-p">
            {IDENTITE.raison_sociale} — SIREN {IDENTITE.siren}<br />
            {IDENTITE.adresse}<br />
            Email : <a href={`mailto:${IDENTITE.email}`} className="legal-a">{IDENTITE.email}</a>
          </p>

          <h2 className="legal-h2">2. Données collectées</h2>
          <p className="legal-p">Nous collectons les données suivantes :</p>
          <h3 className="legal-h3">a) Données d'inscription</h3>
          <ul className="legal-ul">
            <li>Adresse email</li>
            <li>Nom (si fourni)</li>
          </ul>
          <h3 className="legal-h3">b) Données de véhicule (fournies volontairement)</h3>
          <ul className="legal-ul">
            <li>Marque, modèle, année, kilométrage du véhicule analysé</li>
            <li>Prix demandé par le vendeur</li>
          </ul>
          <h3 className="legal-h3">c) Données de conversation IA</h3>
          <ul className="legal-ul">
            <li>Messages échangés avec l'expert IA</li>
            <li>Fichiers uploadés (devis, factures) — anonymisés après traitement</li>
          </ul>
          <h3 className="legal-h3">d) Données de paiement</h3>
          <p className="legal-p">
            Les paiements sont traités par Stripe. Nous ne stockons pas les numéros de carte bancaire. Stripe est certifié PCI-DSS niveau 1.
          </p>
          <h3 className="legal-h3">e) Données techniques</h3>
          <ul className="legal-ul">
            <li>Adresse IP (logs serveur)</li>
            <li>Type de navigateur et appareil</li>
          </ul>

          <h2 className="legal-h2">3. Finalités du traitement</h2>
          <ul className="legal-ul">
            <li>Fournir le service d'analyse de véhicules <em>(base légale : exécution du contrat)</em></li>
            <li>Gérer votre compte utilisateur <em>(base légale : exécution du contrat)</em></li>
            <li>Traiter les paiements <em>(base légale : exécution du contrat)</em></li>
            <li>Envoyer des emails de service : confirmations, rapports, notifications <em>(base légale : intérêt légitime)</em></li>
            <li>Améliorer notre base de données de prix automobiles à partir de données anonymisées <em>(base légale : intérêt légitime)</em></li>
            <li>Répondre à vos demandes de support <em>(base légale : intérêt légitime)</em></li>
          </ul>

          <h2 className="legal-h2">4. Anonymisation des données prix</h2>
          <p className="legal-p">
            Les données de prix collectées (devis, factures, estimations) sont anonymisées avant stockage dans notre base de données de référence. Aucune donnée permettant d'identifier l'utilisateur n'est conservée dans cette base. Les données anonymisées sont utilisées pour améliorer la précision des estimations de coûts fournies par notre service.
          </p>

          <h2 className="legal-h2">5. Durée de conservation</h2>
          <ul className="legal-ul">
            <li>Données de compte : conservées tant que le compte est actif, puis 3 ans après la dernière connexion</li>
            <li>Données de conversation IA : 2 ans après la dernière interaction</li>
            <li>Données de paiement : durée légale de conservation des documents comptables (10 ans)</li>
            <li>Données anonymisées de prix : conservées indéfiniment (aucun lien avec l'utilisateur)</li>
            <li>Logs techniques : 12 mois</li>
          </ul>

          <h2 className="legal-h2">6. Partage des données</h2>
          <p className="legal-p">Vos données sont partagées avec :</p>
          <ul className="legal-ul">
            <li><strong>Supabase</strong> — hébergement base de données (UE)</li>
            <li><strong>Stripe</strong> — paiement (certifié PCI-DSS)</li>
            <li><strong>Anthropic</strong> — API IA (les conversations sont envoyées pour traitement, politique de confidentialité Anthropic applicable)</li>
            <li><strong>Resend</strong> — envoi d'emails transactionnels</li>
            <li><strong>Cal.com</strong> — réservation de créneaux</li>
          </ul>
          <p className="legal-p">Nous ne vendons jamais vos données personnelles à des tiers.</p>

          <h2 className="legal-h2">6 bis. Liens vers des partenaires (assurance, financement)</h2>
          <p className="legal-p">
            Sous certains résultats d'analyse, nous pouvons indiquer un partenaire proposant une
            garantie mécanique ou un financement. Inspexo n'est ni assureur, ni organisme de
            crédit, ni intermédiaire immatriculé&nbsp;: nous nous limitons à vous indiquer ces
            partenaires, et vous traitez ensuite directement avec eux.
          </p>
          <ul className="legal-ul">
            <li>
              <strong>Aucune donnée personnelle ne leur est transmise.</strong> Il n'existe aucun
              envoi de vos coordonnées&nbsp;: en cliquant, vous arrivez simplement sur leur site,
              comme sur n'importe quel lien.
            </li>
            <li>
              <strong>Aucun traceur tiers n'est installé sur nos pages.</strong> Le lien passe par
              notre propre serveur (<code>/go/…</code>), qui enregistre uniquement le partenaire
              concerné, le dossier d'analyse d'origine, la date et une empreinte technique de votre
              adresse IP — jamais l'adresse elle-même, jamais votre identité.
            </li>
            <li>
              <strong>Le partenaire ne sait pas quelle page vous lisiez.</strong> L'adresse de votre
              dossier d'analyse ne lui est pas transmise (en-tête <em>referrer</em> supprimé).
            </li>
            <li>
              <strong>Le verdict n'en dépend jamais.</strong> Le score, les critères et la couleur
              du verdict sont calculés sans aucune information liée à ces partenaires, et aucun
              partenaire n'apparaît sous un verdict rouge.
            </li>
          </ul>

          <h2 className="legal-h2">6 ter. Code postal de la liste d'attente inspection</h2>
          <p className="legal-p">
            Si l'inspection sur place n'est pas encore disponible près du véhicule, vous pouvez
            laisser votre email accompagné d'un code postal. Celui-ci sert uniquement à savoir dans
            quels départements ouvrir le service&nbsp;: il désigne une commune, jamais une adresse.
            Vous pouvez demander sa suppression comme toute autre donnée (section 7).
          </p>

          <h2 className="legal-h2">6 quater. Retour après achat</h2>
          <p className="legal-p">
            Environ trois semaines après une analyse, si vous nous avez laissé une adresse email
            (Pass achat, inspection, ou demande d'envoi du rapport), nous vous écrivons une fois
            pour vous demander ce que l'achat a donné. Le lien de réponse est signé et ne nécessite
            aucun compte. <strong>Une seule invitation est envoyée par dossier et par adresse, et
            il n'existe aucune relance.</strong> Chaque email contient un lien de désinscription en
            un clic, qui vaut pour tous nos envois. Vos réponses ne sont jamais publiées
            individuellement&nbsp;: seules des statistiques agrégées le sont, sur notre page
            fiabilité.
          </p>

          <h2 className="legal-h2">7. Vos droits</h2>
          <p className="legal-p">Conformément au RGPD, vous disposez des droits suivants :</p>
          <ul className="legal-ul">
            <li><strong>Droit d'accès</strong> : obtenir une copie de vos données</li>
            <li><strong>Droit de rectification</strong> : corriger vos données inexactes</li>
            <li><strong>Droit à l'effacement</strong> : demander la suppression de vos données</li>
            <li><strong>Droit à la portabilité</strong> : recevoir vos données dans un format structuré</li>
            <li><strong>Droit d'opposition</strong> : vous opposer au traitement de vos données</li>
            <li><strong>Droit à la limitation</strong> : limiter le traitement de vos données</li>
          </ul>
          <p className="legal-p">
            Pour exercer ces droits, contactez-nous à : <a href="mailto:contact@inspexo.io" className="legal-a">contact@inspexo.io</a><br />
            Nous répondrons dans un délai de 30 jours.
          </p>

          <h2 className="legal-h2">8. Cookies</h2>
          <p className="legal-p">Le site utilise uniquement des cookies essentiels :</p>
          <ul className="legal-ul">
            <li>Cookie d'authentification Supabase (nécessaire pour la connexion)</li>
            <li>Cookie Stripe (nécessaire pour le paiement sécurisé)</li>
          </ul>
          <p className="legal-p">
            Ces cookies sont strictement nécessaires au fonctionnement du site et ne requièrent pas de consentement selon la directive ePrivacy.
          </p>
          <p className="legal-p">Nous n'utilisons pas de cookies de tracking, publicitaires, ou d'analyse.</p>

          <h2 className="legal-h2">9. Sécurité</h2>
          <p className="legal-p">Nous mettons en œuvre des mesures techniques et organisationnelles pour protéger vos données :</p>
          <ul className="legal-ul">
            <li>Chiffrement des données en transit (HTTPS/TLS)</li>
            <li>Chiffrement des données au repos (Supabase)</li>
            <li>Authentification sécurisée (Supabase Auth)</li>
            <li>Paiements sécurisés (Stripe PCI-DSS)</li>
            <li>Accès restreint aux données (Row Level Security)</li>
          </ul>

          <h2 className="legal-h2">10. Modifications</h2>
          <p className="legal-p">
            Nous nous réservons le droit de modifier cette politique. En cas de modification substantielle, nous vous informerons par email.
          </p>

          <h2 className="legal-h2">11. Contact</h2>
          <p className="legal-p">
            Pour toute question relative à la protection de vos données :<br />
            {IDENTITE.raison_sociale} — SIREN {IDENTITE.siren} — {IDENTITE.adresse}<br />
            <a href="mailto:contact@inspexo.io" className="legal-a">contact@inspexo.io</a>
          </p>

          <h2 className="legal-h2">12. Réclamation</h2>
          <p className="legal-p">
            Vous pouvez introduire une réclamation auprès de la CNIL :<br />
            Commission Nationale de l'Informatique et des Libertés<br />
            3 Place de Fontenoy, TSA 80715, 75334 Paris Cedex 07<br />
            <a href="https://www.cnil.fr" className="legal-a">www.cnil.fr</a>
          </p>
        </div>
      </div>
      <Footer />
    </>
  )
}
