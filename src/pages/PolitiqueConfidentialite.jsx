import React from 'react'
import { Helmet } from 'react-helmet-async'

export default function PolitiqueConfidentialite() {
  return (
    <>
      <Helmet>
        <title>Politique de confidentialité | Inspexo</title>
        <meta name="description" content="Politique de confidentialité d'Inspexo — collecte, traitement et protection de vos données personnelles conformément au RGPD." />
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href="https://www.inspexo.io/politique-de-confidentialite" />
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Syne:wght@700;800&display=swap');
        .legal-h2 { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.125rem; color: #0F1B2D; margin: 36px 0 12px; }
        .legal-h3 { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 0.9375rem; color: #0F1B2D; margin: 20px 0 8px; }
        .legal-p  { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.9375rem; color: #333; line-height: 1.75; margin: 0 0 12px; }
        .legal-ul { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.9375rem; color: #333; line-height: 1.75; margin: 0 0 16px; padding-left: 20px; }
        .legal-ul li { margin-bottom: 4px; }
        .legal-a  { color: #FF4D00; text-decoration: none; }
        .legal-a:hover { text-decoration: underline; }
        @media (max-width: 640px) {
          .legal-container { padding: 40px 16px 60px !important; }
          .legal-p, .legal-ul { font-size: 0.875rem !important; }
        }
      `}</style>

      <div className="legal-container" style={{ background: '#fff', minHeight: '100vh', padding: '60px 24px 80px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          {/* Retour */}
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#FF4D00', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none', marginBottom: 40 }}>
            ← Retour à l'accueil
          </a>

          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 'clamp(1.75rem, 4vw, 2.25rem)', color: '#0F1B2D', marginBottom: 8 }}>
            Politique de confidentialité
          </h1>
          <p className="legal-p" style={{ color: '#9CA3AF', marginBottom: 12 }}>Dernière mise à jour : mars 2026</p>
          <p className="legal-p" style={{ marginBottom: 40 }}>
            DUPLEX SAS ("Inspexo", "nous", "notre") s'engage à protéger la vie privée des utilisateurs de son site inspexo.io ("le Site") et de ses services.
          </p>

          <h2 className="legal-h2">1. Responsable du traitement</h2>
          <p className="legal-p">
            DUPLEX SAS<br />
            17 rue Pierre Deldi, 31100 Toulouse, France<br />
            Email : <a href="mailto:contact@inspexo.io" className="legal-a">contact@inspexo.io</a>
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
            DUPLEX SAS — 17 rue Pierre Deldi, 31100 Toulouse<br />
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
    </>
  )
}
