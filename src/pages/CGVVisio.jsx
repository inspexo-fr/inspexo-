import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { getVisioConfig } from '../lib/inspectionApi'
import { IDENTITE } from '../data/identite'
import FilAriane from '../components/FilAriane'

// SPRINT 14 — CGV de la visio guidée (/cgv-visio).
//
// Même structure que les CGV de l'inspection APRÈS correction consommateur :
// responsabilité de plein droit (L221-15), AUCUN plafond face au
// consommateur (R212-1 6° en fait une clause noire), rétractation L221-28 1°,
// médiation sans la plateforme européenne (supprimée par le règlement UE
// 2024/3228), compétence R631-3.
//
// Prix, part de l'inspecteur, durée et médiateur sont LUS dans la
// configuration serveur : un montant en dur dans un contrat devient faux en
// silence le jour où il change.

const euros = (c) => `${(c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`

export default function CGVVisio() {
  const [config, setConfig] = useState(null)
  useEffect(() => {
    let annule = false
    getVisioConfig().then(c => { if (!annule) setConfig(c) }).catch(() => { if (!annule) setConfig(null) })
    return () => { annule = true }
  }, [])

  const prix = config?.prix_cents ? `${euros(config.prix_cents)} TTC` : '59,00 € TTC'
  const partInsp = config?.part_inspecteur_cents ? euros(config.part_inspecteur_cents) : '40,00 €'
  const retenue = config?.retenue_cents ? euros(config.retenue_cents) : '20,00 €'
  const attente = config?.attente_absence_minutes ?? 15
  const rapportH = config?.rapport_heures ?? 2

  return (
    <>
      <Helmet>
        <title>CGV de la visio guidée — Inspexo</title>
        <meta name="description" content="Conditions générales de vente de la visio guidée Inspexo : prix, déroulement de l'appel, ce qui ne se vérifie pas à distance, annulation, droit de rétractation, aucun enregistrement." />
        <link rel="canonical" href="https://www.inspexo.io/cgv-visio" />
      </Helmet>
      <FilAriane items={[{ nom: 'CGV de la visio', url: '/cgv-visio' }]} />
      <Navbar />
      <div className="legal-container">
        <div className="wrap-doc">
          <a href="/score" className="legal-retour">← Retour</a>

          <h1 className="legal-h1">Conditions Générales de Vente — Visio guidée</h1>
          <p className="legal-p" style={{ color: 'var(--graphite)', marginBottom: 40 }}>Version du 4 novembre 2026</p>

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
            La visio guidée est un <strong>accompagnement à distance, en direct</strong>. Le Client se trouve
            devant le véhicule avec son téléphone ; un inspecteur professionnel indépendant le guide par appel
            vidéo, point par point, sur la checklist établie pour ce véhicule précis.
          </p>
          <p className="legal-p">
            <strong>C'est le Client qui agit.</strong> Il ouvre le capot, démarre le moteur, montre les pneus,
            le compteur, les documents. L'inspecteur regarde, demande, explique et consigne. L'inspecteur
            n'intervient à aucun moment sur le véhicule.
          </p>
          <p className="legal-p">
            Durée de l'appel : <strong>30 à 40 minutes</strong>. Compte rendu écrit déposé dans le dossier du
            Client <strong>sous {rapportH} heures</strong>.
          </p>
          <p className="legal-p">
            Inspexo et l'inspecteur sont tenus d'une <strong>obligation de moyens</strong>, et non de résultat.
          </p>
          <p className="legal-p">
            <strong>Ce que la visio ne peut pas faire.</strong> Elle ne permet ni de passer sous le véhicule
            (pont ou fosse), ni de démonter un organe, ni de brancher un outil de diagnostic, ni de conduire la
            voiture. <strong>Le compte rendu porte la liste explicite des points qui sont restés hors de portée
            pour ces raisons</strong>, et conseille le cas échéant une inspection sur place. Un acheteur qui
            croirait avoir fait vérifier ce qui n'a pas pu l'être serait moins bien informé qu'avant l'appel :
            c'est pourquoi cette liste figure au compte rendu et non en petits caractères.
          </p>
          <p className="legal-p">
            <strong>La visio ne constitue pas une expertise au sens de l'article L326-4 du Code de la
            route.</strong> L'inspecteur n'est pas un expert en automobile inscrit sur la liste nationale, et la
            prestation <strong>ne détermine pas la valeur du véhicule</strong>. Elle ne vaut ni contrôle
            technique, ni diagnostic mécanique, ni garantie sur l'état du véhicule.
          </p>

          <h2 className="legal-h2">3. Zone couverte</h2>
          <p className="legal-p">
            <strong>La France entière.</strong> Aucun déplacement n'étant nécessaire, la visio n'a pas de zone :
            seule compte la disponibilité d'un inspecteur ayant activé cette prestation.
          </p>

          <h2 className="legal-h2">4. Appel vidéo, et absence d'enregistrement</h2>
          <p className="legal-p">
            Le Client rejoint l'appel <strong>depuis le navigateur de son téléphone, sans installer
            d'application</strong> (Safari sur iPhone, Chrome sur Android). La caméra arrière est utilisée par
            défaut. L'inspecteur se connecte depuis un ordinateur.
          </p>
          <p className="legal-p">
            Un <strong>lien unique</strong> est créé pour chaque mission, et il n'est actif
            qu'<strong>autour du créneau</strong> : 15 minutes avant, 90 minutes après. En dehors de cette
            fenêtre, le lien ne donne accès à rien, même s'il a été recopié ailleurs.
          </p>
          <p className="legal-p">
            <strong>L'appel n'est JAMAIS enregistré</strong> — ni l'image, ni le son. La fonction
            d'enregistrement n'est pas activée chez notre prestataire vidéo, et aucun flux n'est conservé.
          </p>
          <p className="legal-p">
            <strong>Captures d'écran.</strong> L'inspecteur peut avoir besoin de figer une image (un compteur,
            une plaque de défaut, un carnet). Il ne le fait <strong>qu'avec l'accord du Client</strong>, demandé
            dans l'appel. Ces captures suivent les règles des photos d'inspection : <strong>aucune personne
            reconnaissable</strong>, conservation <strong>deux ans</strong>, puis suppression.
          </p>

          <h2 className="legal-h2">5. Prix et paiement</h2>
          <p className="legal-p">
            Le prix de la visio guidée est de <strong>{prix}</strong>, tout compris.
          </p>
          <p className="legal-p">
            <strong>À la commande, le paiement est seulement autorisé, pas encaissé.</strong> Il n'est
            <strong> débité qu'au moment où un inspecteur confirme</strong> le créneau. Si aucun inspecteur ne
            confirme — au plus tard 2 heures avant le créneau, et dans tous les cas sous 48 heures —
            <strong> l'autorisation est annulée et rien n'est débité</strong>.
          </p>
          <p className="legal-p">
            Sur ce prix, <strong>{partInsp} reviennent à l'inspecteur</strong>. Il est réglé par Stripe Connect à
            la remise du compte rendu ; aucun paiement direct entre le Client et l'inspecteur n'est autorisé.
          </p>

          <h2 className="legal-h2">6. Annulation</h2>
          <p className="legal-p">
            <strong>Annulation par le Client : gratuite à tout moment avant le créneau.</strong> Remboursement
            intégral, rien n'est retenu. Aucun déplacement n'étant engagé, il n'y a rien à indemniser.
          </p>
          <p className="legal-p">
            <strong>Client absent.</strong> Si le Client ne rejoint pas l'appel dans
            les <strong>{attente} minutes</strong> suivant l'heure du rendez-vous,
            <strong> {retenue} sont retenus</strong> et le solde est remboursé. Ce montant correspond au
            <strong> service déjà fourni</strong> au sens de l'article <strong>L221-25</strong> du Code de la
            consommation : le créneau a été réservé et n'a pas pu être réemployé. Il est versé à l'inspecteur et
            ne revient pas à Inspexo. Ce n'est pas une pénalité d'annulation — une annulation, elle, reste
            gratuite.
          </p>
          <p className="legal-p">
            <strong>Inspecteur absent</strong> ou appel impossible de son fait : le Client est remboursé
            <strong> intégralement</strong>, sans retenue.
          </p>
          <p className="legal-p">
            Les remboursements sont effectués sur le moyen de paiement utilisé lors de la commande.
          </p>

          <h2 className="legal-h2">7. Droit de rétractation</h2>
          <p className="legal-p">
            Le Client consommateur dispose d'un <strong>délai de 14 jours</strong> pour se rétracter sans motif
            ni pénalité (article <strong>L221-18</strong> du Code de la consommation).
          </p>
          <p className="legal-p">
            La visio étant exécutée à bref délai, le Client <strong>demande expressément, par une case dédiée à
            la commande, non pré-cochée et obligatoire</strong>, que la prestation soit exécutée avant la fin du
            délai de rétractation. Le texte de cette case est le suivant : «&nbsp;<em>Je demande que la visio
            soit réalisée avant la fin du délai de rétractation de 14 jours et je reconnais perdre ce droit une
            fois l'appel entièrement réalisé.</em>&nbsp;» Elle est distincte de l'acceptation des présentes,
            horodatée et conservée avec la version des conditions acceptées.
          </p>
          <p className="legal-p">
            <strong>Une fois l'appel entièrement réalisé, le droit de rétractation ne peut plus être
            exercé</strong>, la prestation étant pleinement exécutée après accord préalable exprès du Client et
            renoncement exprès à son droit (article <strong>L221-28, 1°</strong>).
          </p>
          <p className="legal-p">
            Avant l'appel, le Client exerce son droit à tout moment et <strong>sans aucune retenue</strong> —
            l'annulation étant elle-même gratuite (article 6).
          </p>

          <h2 className="legal-h2">8. Données personnelles</h2>
          <p className="legal-p">
            L'appel n'est pas enregistré. Le prestataire vidéo achemine les flux sans les stocker, et les
            utilisateurs européens sont connectés à un centre de données situé dans l'Espace économique
            européen. Les captures éventuelles sont conservées deux ans (article 4).
          </p>
          <p className="legal-p">
            Le détail figure dans la{' '}
            <a href="/politique-de-confidentialite" className="legal-a">politique de confidentialité</a>.
          </p>

          <h2 className="legal-h2">9. Indépendance de l'inspecteur</h2>
          <p className="legal-p">
            <strong>La visio est payée exclusivement par l'acheteur.</strong> L'inspecteur est un professionnel
            indépendant qui <strong>ne reçoit aucune somme du vendeur</strong>, ni d'un garage, ni d'un
            intermédiaire. Il signe une charte d'indépendance en ce sens. Il ne négocie pas pour le compte du
            Client et n'intervient pas dans la transaction.
          </p>

          <h2 className="legal-h2">10. Responsabilité</h2>
          <p className="legal-p">
            <strong>Inspexo est responsable de plein droit envers le Client de la bonne exécution de la
            prestation</strong>, conformément à l'article <strong>L221-15</strong> du Code de la consommation,
            qu'elle soit réalisée par elle-même ou par l'inspecteur qu'elle a missionné, sans préjudice de son
            recours contre celui-ci. Le Client n'a qu'un seul interlocuteur : {IDENTITE.raison_sociale}.
          </p>
          <p className="legal-p">
            L'objet de la prestation est celui décrit à l'article 2 : un accompagnement à distance, par caméra,
            à un instant donné. Elle ne porte pas sur ce qui n'est ni visible ni audible dans ces conditions, et
            le compte rendu le dit explicitement. La décision d'acheter ou non appartient au Client seul.
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
                || "en cours de désignation — la vente de la visio n'est ouverte qu'une fois le médiateur désigné"}
            </strong>.
            La saisine du médiateur est gratuite et n'empêche pas d'agir en justice.
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
            Les présentes complètent les{' '}
            <a href="/cgu" className="legal-a">conditions générales d'utilisation et de vente</a>. En cas de
            divergence sur la visio guidée, les présentes prévalent.
          </p>
        </div>
      </div>
      <Footer />
    </>
  )
}
