import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { getInspectionConfig } from '../lib/inspectionApi'
import { IDENTITE } from '../data/identite'
import FilAriane from '../components/FilAriane'

// SPRINT 12 — CGV de l'inspection à la demande (/cgv-inspection).
//
// Document distinct des CGV du Pass, comme le Pass a les siennes : une offre
// payante, un document. `inspection-checkout` estampille déjà la version des
// CGV acceptées sur la commande (CGV_VERSION) — c'est CE texte qu'elle datait,
// et il n'existait pas.
//
// La zone, le prix, le délai et le médiateur sont LUS DANS LA CONFIGURATION
// SERVEUR, jamais recopiés : un prix en dur dans un document contractuel
// devient faux le jour où le prix change, sans que personne ne s'en aperçoive.

const euros = (cents) =>
  `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`

export default function CGVInspection() {
  const [config, setConfig] = useState(null)

  useEffect(() => {
    let annule = false
    getInspectionConfig()
      .then(c => { if (!annule) setConfig(c) })
      .catch(() => { if (!annule) setConfig(null) })
    return () => { annule = true }
  }, [])

  const prix = config?.prix_cents ? `${euros(config.prix_cents)} TTC` : '179,00 € TTC'
  const zone = config?.zone_libelle || 'Toulouse et la Haute-Garonne'
  const delai = config?.delai_heures || 48
  const partInspecteur = config?.prix_cents
    ? euros(Math.round(config.prix_cents * 0.6))
    : '107,40 €'

  return (
    <>
      <Helmet>
        <title>CGV de l'inspection à la demande — Inspexo</title>
        <meta name="description" content="Conditions générales de vente de l'inspection à la demande Inspexo : prix, zone, créneau, annulation, droit de rétractation, conservation des photos du rapport, indépendance de l'inspecteur." />
        <link rel="canonical" href="https://www.inspexo.io/cgv-inspection" />
      </Helmet>
      <FilAriane items={[{ nom: 'CGV de l’inspection', url: '/cgv-inspection' }]} />
      <Navbar />
      <div className="legal-container">
        <div className="wrap-doc">
          <a href="/score" className="legal-retour">← Retour</a>

          <h1 className="legal-h1">Conditions Générales de Vente — Inspection à la demande</h1>
          <p className="legal-p" style={{ color: 'var(--graphite)', marginBottom: 40 }}>Version du 3 novembre 2026</p>

          <h2 className="legal-h2">1. Vendeur</h2>
          <p className="legal-p">
            <strong>{IDENTITE.raison_sociale}</strong>, {IDENTITE.forme_juridique.toLowerCase()} au capital de {IDENTITE.capital}<br />
            Siège social : {IDENTITE.adresse}<br />
            SIREN : {IDENTITE.siren} — SIRET (siège) : {IDENTITE.siret}<br />
            {IDENTITE.rcs} — TVA intracommunautaire : {IDENTITE.tva}<br />
            Email : <a href={`mailto:${IDENTITE.email}`} className="legal-a">{IDENTITE.email}</a> — nom commercial : {IDENTITE.nom_commercial}.
          </p>

          <h2 className="legal-h2">2. Objet et nature de la prestation</h2>
          <p className="legal-p">
            L'inspection à la demande est une <strong>inspection visuelle et fonctionnelle d'un véhicule
            d'occasion, réalisée sur place, sans démontage</strong>, par un inspecteur professionnel indépendant
            référencé par Inspexo. Elle est commandée par l'acheteur potentiel du véhicule.
          </p>
          <p className="legal-p">
            L'inspecteur contrôle ce qui est observable et essayable sans intervention mécanique : état visible
            de la carrosserie, des pneumatiques et de l'habitacle, démarrage, fonctionnement des organes
            accessibles, documents présentés, points de la checklist établie pour ce véhicule. Il ne démonte
            rien, ne met pas le véhicule sur pont et n'ouvre aucun organe mécanique.
          </p>
          <p className="legal-p">
            Inspexo et l'inspecteur sont tenus d'une <strong>obligation de moyens</strong>, et non de résultat.
            L'inspection ne peut pas révéler un défaut qui n'est ni visible, ni audible, ni décelable à l'essai
            au moment où elle a lieu.
          </p>
          <p className="legal-p">
            <strong>Le rapport est destiné au seul Client.</strong> Il ne peut être ni revendu ni publié. Le
            Client reste libre de s'en servir pour négocier.
          </p>
          <p className="legal-p">
            <strong>L'inspection ne constitue pas une expertise au sens de l'article L326-4 du Code de la
            route.</strong> L'inspecteur n'est pas un expert en automobile inscrit sur la liste nationale, et
            l'inspection <strong>ne détermine pas la valeur du véhicule</strong>. Le rapport décrit un état
            constaté ; il ne chiffre aucune valeur vénale et ne vaut ni rapport d'expertise, ni contrôle
            technique, ni garantie sur l'état du véhicule.
          </p>

          <h2 className="legal-h2">3. Zone couverte</h2>
          <p className="legal-p">
            Le service est ouvert sur <strong>{zone}</strong>, et plus généralement{' '}
            <strong>dans les zones affichées au moment de la commande</strong>. La disponibilité dépend de la
            présence effective d'un inspecteur validé pouvant intervenir dans le département concerné : elle est
            vérifiée à chaque commande, et c'est l'affichage au moment de la commande qui fait foi.
          </p>
          <p className="legal-p">
            Hors zone, aucune commande n'est possible. Le Client peut laisser son adresse email et son code
            postal pour être prévenu de l'ouverture de sa zone.
          </p>

          <h2 className="legal-h2">4. Créneau, déroulement et remise du rapport</h2>
          <p className="legal-p">
            Le Client choisit, à la commande, un créneau situé entre <strong>2 et {delai} heures</strong> après
            celle-ci, et communique les coordonnées du vendeur ainsi que l'adresse où se trouve le véhicule.
          </p>
          <p className="legal-p">
            Les coordonnées du vendeur ne sont transmises à un inspecteur <strong>qu'une fois la mission
            confirmée par lui</strong>. Tant qu'aucun inspecteur n'a confirmé, elles ne sont visibles de
            personne d'autre qu'Inspexo.
          </p>
          <p className="legal-p">
            Le Client prévient le vendeur de la venue de l'inspecteur et s'assure que le véhicule sera
            accessible au créneau convenu.
          </p>
          <p className="legal-p">
            Le rapport, accompagné des photos prises pendant l'inspection, est déposé dans le dossier du Client
            <strong> au plus tard 24 heures après l'inspection</strong>. Le Client en est prévenu par email.
          </p>

          <h2 className="legal-h2">5. Prix et paiement</h2>
          <p className="legal-p">
            Le prix de l'inspection est de <strong>{prix}</strong>, tout compris, déplacement de l'inspecteur
            inclus. Aucun frais ne s'ajoute.
          </p>
          <p className="legal-p">
            <strong>À la commande, le paiement est seulement autorisé, pas encaissé.</strong> Le montant est
            bloqué sur le moyen de paiement du Client et n'est <strong>débité qu'au moment où un inspecteur
            confirme la mission</strong>.
          </p>
          <p className="legal-p">
            <strong>Si aucun inspecteur ne confirme la mission, l'autorisation est annulée et rien n'est
            débité.</strong> La confirmation doit intervenir <strong>au plus tard 2 heures avant le créneau
            choisi</strong>, et <strong>dans tous les cas sous {delai} heures</strong> à compter de la
            commande&nbsp;: c'est le premier de ces deux termes qui s'applique. Un créneau proche raccourcit
            donc le délai de confirmation. Le Client est informé par email et n'a aucune démarche à faire. Selon
            sa banque, l'empreinte de l'autorisation peut rester visible un à deux jours avant de disparaître.
          </p>
          <p className="legal-p">
            Le paiement est traité par Stripe. Inspexo ne stocke aucune donnée bancaire. Les paiements par carte
            seuls sont acceptés.
          </p>

          <h2 className="legal-h2">6. Annulation</h2>
          <p className="legal-p">
            <strong>Avant la confirmation par un inspecteur</strong> : annulation gratuite, l'autorisation de
            paiement est levée et <strong>rien n'est débité</strong>.
          </p>
          <p className="legal-p">
            <strong>Après la confirmation, à plus de 24 heures du créneau, ou dans l'heure qui suit la
            confirmation</strong> : <strong>remboursement intégral</strong>. Rien n'est retenu. L'heure qui suit
            la confirmation est acquise au Client même si le créneau est proche&nbsp;: il doit pouvoir revenir
            sur sa commande après avoir reçu la confirmation.
          </p>
          <p className="legal-p">
            <strong>Dans les autres cas</strong> — annulation à moins de 24 heures du créneau et passé l'heure
            qui suit la confirmation, ou <strong>vendeur absent ou véhicule indisponible constaté sur place par
            l'inspecteur</strong> — <strong>40,00 € sont retenus</strong> et le solde est remboursé au Client.
            Ce montant correspond au <strong>service déjà fourni</strong> au sens de l'article{' '}
            <strong>L221-25</strong> du Code de la consommation&nbsp;: organisation du rendez-vous et
            déplacement réservé ou effectué. Il est versé à l'inspecteur et ne revient pas à Inspexo.
          </p>
          <p className="legal-p">
            <strong>Si l'inspecteur ne se présente pas ou annule</strong> : le Client est remboursé
            intégralement, sans retenue, sous 5 jours ouvrés.
          </p>
          <p className="legal-p">
            Les remboursements sont effectués sur le moyen de paiement utilisé lors de la commande.
          </p>

          <h2 className="legal-h2">7. Droit de rétractation</h2>
          <p className="legal-p">
            Le Client consommateur dispose d'un <strong>délai de 14 jours</strong> pour se rétracter sans motif
            ni pénalité, conformément à l'article <strong>L221-18</strong> du Code de la consommation.
          </p>
          <p className="legal-p">
            L'inspection étant par nature exécutée à bref délai, le Client{' '}
            <strong>demande expressément, par une case dédiée à la commande, non pré-cochée et obligatoire</strong>,
            que la prestation soit exécutée avant la fin du délai de rétractation. Le texte de cette case est le
            suivant : «&nbsp;<em>Je demande que l'inspection soit réalisée avant la fin du délai de rétractation
            de 14 jours et je reconnais perdre ce droit une fois l'inspection entièrement réalisée.</em>&nbsp;»
            Elle est distincte de l'acceptation des présentes conditions, horodatée et conservée avec la version
            des conditions acceptées. Sans elle, la commande n'est pas possible.
          </p>
          <p className="legal-p">
            <strong>Une fois l'inspection entièrement réalisée, le droit de rétractation ne peut plus être
            exercé</strong>, la prestation étant pleinement exécutée après accord préalable exprès du Client et
            renoncement exprès à son droit de rétractation (article <strong>L221-28, 1°</strong> du Code de la
            consommation).
          </p>
          <p className="legal-p">
            Avant la réalisation de l'inspection, le Client exerce son droit de rétractation à tout moment. Les
            conséquences financières sont celles de l'article 6&nbsp;: elles ne sont pas une pénalité, mais le
            montant proportionné au service déjà fourni que l'article <strong>L221-25</strong> autorise à
            retenir lorsque l'exécution a commencé à la demande du Client.
          </p>

          <h2 className="legal-h2">8. Photos du rapport et données personnelles</h2>
          <p className="legal-p">
            <strong>Les photos prises par l'inspecteur pendant l'inspection sont conservées</strong> : elles
            constituent le rapport que le Client a acheté. Les photos que le Client transmet lui-même — pour une
            analyse d'annonce, en mode visite ou pour la lecture d'un procès-verbal de contrôle technique — ne
            sont, elles, <strong>jamais stockées</strong>.
          </p>
          <p className="legal-p">
            Elles sont déposées dans un espace privé et ne sont accessibles qu'au Client, à l'inspecteur qui les
            a prises et à Inspexo. L'inspecteur donne un consentement horodaté avant tout dépôt et s'engage à ne
            photographier ni la plaque d'immatriculation, ni un document d'identité, ni la carte grise en
            entier, ni une personne, ni l'intérieur d'un domicile.
          </p>
          <p className="legal-p">
            Les coordonnées du vendeur transmises par le Client servent uniquement à permettre à l'inspecteur de
            convenir du rendez-vous. Elles ne sont utilisées à aucune autre fin.
          </p>
          <p className="legal-p">
            <strong>Durées de conservation.</strong> Les photos du rapport restent accessibles au Client et sont
            conservées <strong>deux ans à compter de l'inspection</strong>, puis supprimées. Cette durée est
            celle du délai d'action en garantie des vices cachés (article <strong>1648 du Code civil</strong>) :
            c'est la période pendant laquelle les photos peuvent servir au Client. Les{' '}
            <strong>constatations écrites du rapport, sans les photos, sont conservées cinq ans</strong>.
          </p>
          <p className="legal-p">
            <strong>Photo de constat.</strong> Lorsque l'inspecteur constate sur place que le véhicule ne lui
            est pas présenté, il prend une <strong>photo horodatée</strong> qui justifie la retenue de
            l'article 6. Cette photo est également conservée, <strong>un an</strong>, le temps d'une
            contestation ou d'un litige de paiement, puis supprimée. Sans elle, aucune retenue n'est possible.
          </p>
          <p className="legal-p">
            Sur l'ensemble de ces photos, l'inspecteur s'engage au titre de sa charte d'indépendance à ne faire
            figurer <strong>aucune personne reconnaissable</strong>.
          </p>
          <p className="legal-p">
            Les modalités d'exercice des droits figurent dans la{' '}
            <a href="/politique-de-confidentialite" className="legal-a">politique de confidentialité</a>.
          </p>

          <h2 className="legal-h2">9. Indépendance de l'inspecteur</h2>
          <p className="legal-p">
            <strong>L'inspection est payée exclusivement par l'acheteur.</strong> L'inspecteur est un
            professionnel indépendant qui <strong>ne reçoit aucune somme du vendeur</strong>, ni d'un garage, ni
            d'un concessionnaire, ni d'un intermédiaire, à aucun titre et sous aucune forme. Il signe une charte
            d'indépendance en ce sens, dont le non-respect entraîne son retrait de la Plateforme.
          </p>
          <p className="legal-p">
            Sur le prix de {prix}, <strong>{partInspecteur} reviennent à l'inspecteur</strong> et le solde à
            Inspexo au titre de la mise en relation, de l'outillage de l'inspection et du traitement du
            paiement. L'inspecteur est réglé par Stripe Connect à la remise du rapport ; aucun paiement direct
            entre le Client et l'inspecteur n'est autorisé.
          </p>
          <p className="legal-p">
            L'inspecteur ne négocie pas pour le compte du Client et n'intervient pas dans la transaction. Le
            rapport donne au Client les éléments pour décider et, s'il le souhaite, pour négocier lui-même.
          </p>

          <h2 className="legal-h2">10. Responsabilité</h2>
          <p className="legal-p">
            <strong>Inspexo est responsable de plein droit envers le Client de la bonne exécution de
            l'inspection</strong>, conformément à l'article <strong>L221-15</strong> du Code de la consommation,
            qu'elle soit réalisée par elle-même ou par l'inspecteur indépendant qu'elle a missionné. Le Client
            n'a qu'un seul interlocuteur&nbsp;: {IDENTITE.raison_sociale}.
          </p>
          <p className="legal-p">
            Cette responsabilité s'exerce sans préjudice du recours d'Inspexo contre l'inspecteur. L'inspecteur
            exerce sous son propre numéro SIRET et doit justifier d'une assurance de responsabilité civile
            professionnelle en cours de validité&nbsp;: Inspexo exige son attestation et en contrôle la validité
            avant tout référencement.
          </p>
          <p className="legal-p">
            L'objet de la prestation est celui décrit à l'article 2&nbsp;: une inspection visuelle et
            fonctionnelle, sans démontage, à un instant donné. Elle ne porte donc pas sur les défauts qui ne
            sont ni visibles, ni audibles, ni décelables à l'essai dans ces conditions, et ne vaut ni contrôle
            technique ni garantie sur l'état du véhicule. La décision d'acheter ou non appartient au Client
            seul.
          </p>

          <h2 className="legal-h2">11. Réclamation et médiation de la consommation</h2>
          <p className="legal-p">
            Toute réclamation est adressée à{' '}
            <a href={`mailto:${IDENTITE.email}`} className="legal-a">{IDENTITE.email}</a>. Inspexo répond sous
            14 jours.
          </p>
          <p className="legal-p">
            Après une réclamation écrite restée insatisfaite, le Client consommateur peut saisir gratuitement le
            médiateur de la consommation dont relève {IDENTITE.raison_sociale} :{' '}
            <strong>
              {config?.mediateur
                || "en cours de désignation — la vente de l'inspection n'est ouverte qu'une fois le médiateur désigné"}
            </strong>.
            La saisine du médiateur est gratuite pour le consommateur et n'empêche pas d'agir en justice.
          </p>

          <h2 className="legal-h2">12. Droit applicable</h2>
          <p className="legal-p">
            Droit français. À défaut de résolution amiable, le litige relève des juridictions désignées par les
            règles légales de compétence. Le Client consommateur peut saisir, à son choix, la juridiction du
            lieu où il demeurait lors de la conclusion du contrat ou de la survenance du fait dommageable, ou
            celle du lieu où demeure {IDENTITE.raison_sociale} (article <strong>R631-3</strong> du Code de la
            consommation).
          </p>
          <p className="legal-p">
            Les présentes conditions complètent les{' '}
            <a href="/cgu" className="legal-a">conditions générales d'utilisation et de vente</a> du Site. En cas
            de divergence sur l'inspection à la demande, les présentes prévalent.
          </p>
        </div>
      </div>
      <Footer />
    </>
  )
}
