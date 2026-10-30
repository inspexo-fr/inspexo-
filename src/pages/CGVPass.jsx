import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { getPassConfig } from '../lib/scoreApi'

// SPRINT 7 — CGV du Pass achat (/cgv-pass). Présentées AVANT paiement : la
// page /pass exige une case d'acceptation dédiée. Le médiateur de la
// consommation vient de la configuration serveur (MEDIATEUR_NOM) — tant qu'il
// n'est pas désigné, la vente n'est pas ouverte.

export default function CGVPass() {
  const [config, setConfig] = useState(null)

  useEffect(() => {
    getPassConfig().then(setConfig).catch(() => setConfig(null))
  }, [])

  const prix = config?.actif && config?.mode === 'precommande' ? '19,00 € TTC (prix de précommande)' : '29,00 € TTC'

  return (
    <>
      <Helmet>
        <title>CGV du Pass achat — Inspexo</title>
        <meta name="description" content="Conditions générales de vente du Pass achat Inspexo : objet, prix, durée de 30 jours, droit de rétractation, médiation de la consommation." />
        <link rel="canonical" href="https://www.inspexo.io/cgv-pass" />
      </Helmet>
      <Navbar />
      <div className="legal-container">
        <div className="wrap-doc">
          <a href="/pass" className="legal-retour">← Retour au Pass achat</a>

          <h1 className="legal-h1">Conditions Générales de Vente — Pass achat</h1>
          <p className="legal-p" style={{ color: 'var(--graphite)', marginBottom: 40 }}>Version du 30 octobre 2026</p>

          <h2 className="legal-h2">1. Vendeur</h2>
          <p className="legal-p">
            <strong>DUPLEX SAS</strong>, société par actions simplifiée au capital de 30 000,00 €<br />
            Siège social : 17 rue Pierre Deldi, 31100 Toulouse, France<br />
            SIREN : 941 962 060 — RCS Toulouse — TVA intracommunautaire : FR33941962060<br />
            Email : <a href="mailto:contact@inspexo.io" className="legal-a">contact@inspexo.io</a> — nom commercial : Inspexo.
          </p>

          <h2 className="legal-h2">2. Objet</h2>
          <p className="legal-p">
            Le Pass achat est un service numérique d'aide à l'achat d'un véhicule d'occasion. Pendant sa durée
            de validité, il donne accès, sur le site inspexo.io et après connexion avec l'adresse email
            utilisée au paiement : aux analyses d'annonces sans limitation de nombre, au mode visite complet
            (photos analysées sur place, verdict mis à jour), au détail complet de la marge de négociation
            (postes, sources, argumentaire), à la lecture du procès-verbal de contrôle technique, et au kit
            signature (checklist des documents, contrat de cession pré-rempli, démarches).
          </p>
          <p className="legal-p">
            Le Pass achat fournit une aide documentaire et automatisée : il ne constitue ni une expertise
            automobile au sens réglementaire, ni un diagnostic mécanique, ni un conseil juridique. Les analyses
            sont produites à partir du texte et des documents fournis par l'utilisateur et ne remplacent pas un
            examen du véhicule.
          </p>

          <h2 className="legal-h2">3. Prix et paiement</h2>
          <p className="legal-p">
            Le prix du Pass achat est de <strong>{prix}</strong>, payable en une fois par carte bancaire via
            Stripe. Aucun abonnement : <strong>aucune reconduction, tacite ou non</strong> — le Pass s'arrête
            de lui-même à son terme. Le prix applicable est celui affiché au moment du paiement.
          </p>

          <h2 className="legal-h2">4. Durée et activation</h2>
          <p className="legal-p">
            Le Pass est activé immédiatement après confirmation du paiement, pour une durée de
            <strong> 30 jours calendaires</strong>. L'accès est lié au compte associé à l'adresse email du
            paiement (connexion par lien magique, sans mot de passe). Un email de confirmation est envoyé à
            l'activation.
          </p>

          <h2 className="legal-h2">5. Droit de rétractation</h2>
          <p className="legal-p">
            Conformément aux articles L221-18 et suivants du Code de la consommation, vous disposez d'un délai
            de <strong>14 jours</strong> à compter de la souscription pour vous rétracter, sans motif, par
            email à contact@inspexo.io ou par tout autre moyen exprimant votre volonté.
          </p>
          <p className="legal-p">
            <strong>Utilisation immédiate :</strong> si vous souhaitez utiliser le Pass sans attendre la fin de
            ce délai, une case dédiée au moment du paiement vous permet de demander expressément l'exécution
            immédiate du service et de reconnaître que votre droit de rétractation sera perdu une fois le
            service pleinement exécuté, et qu'en cas de rétractation avant complète exécution, le montant
            remboursé pourra être proportionné au service déjà fourni (articles L221-25 et L221-28 du Code de
            la consommation). Si vous ne cochez pas cette case, l'accès au Pass ouvre à l'issue du délai de
            rétractation de 14 jours.
          </p>
          <p className="legal-p">
            <strong>Garantie Inspexo, plus favorable :</strong> indépendamment de ce qui précède, tout Pass est
            remboursé intégralement, sans condition ni justification, sur simple demande à
            contact@inspexo.io dans les 14 jours suivant le paiement — même si vous avez utilisé le service.
          </p>

          <h2 className="legal-h2">6. Médiation de la consommation</h2>
          <p className="legal-p">
            Après une réclamation écrite restée insatisfaite auprès de contact@inspexo.io, vous pouvez saisir
            gratuitement le médiateur de la consommation dont relève DUPLEX SAS :{' '}
            <strong>{config?.mediateur || 'en cours de désignation — la vente du Pass n\'est ouverte qu\'une fois le médiateur désigné'}</strong>.
            Vous pouvez également utiliser la plateforme européenne de règlement en ligne des litiges.
          </p>

          <h2 className="legal-h2">7. Données personnelles</h2>
          <p className="legal-p">
            L'adresse email du paiement sert à l'activation du Pass, au reçu et aux emails strictement liés au
            service. Les photos envoyées (annonce, visite, procès-verbal de contrôle technique) sont analysées
            puis immédiatement oubliées — jamais stockées. Détails et droits :{' '}
            <a href="/politique-de-confidentialite" className="legal-a">politique de confidentialité</a>.
          </p>

          <h2 className="legal-h2">8. Divers</h2>
          <p className="legal-p">
            Les présentes CGV complètent les <a href="/cgu" className="legal-a">CGU/CGV générales du site</a>.
            En cas de contradiction, les présentes prévalent pour le Pass achat. Droit français applicable.
          </p>
        </div>
      </div>
      <Footer />
    </>
  )
}
