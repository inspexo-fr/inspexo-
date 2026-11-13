import React from 'react'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { IDENTITE } from '../data/identite'
import FilAriane from '../components/FilAriane'

export default function CGU() {
  return (
    <>
      <Helmet>
        <title>Conditions Générales d'Utilisation et de Vente | Inspexo</title>
        <meta name="description" content="CGU et CGV d'Inspexo — conditions d'utilisation de la plateforme et de vente des services d'inspection automobile." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://www.inspexo.io/cgu" />
      </Helmet>
      <FilAriane items={[{ nom: 'Conditions d’utilisation', url: '/cgu' }]} />
      <Navbar />
      <div className="legal-container">
        <div className="wrap-doc">

          <a href="/" className="legal-retour">← Retour à l'accueil</a>

          <h1 className="legal-h1">
            Conditions Générales d'Utilisation et de Vente
          </h1>
          <p className="legal-p" style={{ color: 'var(--graphite)', marginBottom: 40 }}>Dernière mise à jour : mars 2026</p>

          <p className="legal-p">
            Les présentes Conditions Générales d'Utilisation et de Vente (ci-après "CGU/CGV") régissent l'utilisation du site inspexo.io (ci-après "le Site") et des services proposés par DUPLEX SAS (ci-après "Inspexo").
          </p>
          <p className="legal-p">
            En utilisant le Site ou en souscrivant à un service, vous acceptez sans réserve les présentes CGU/CGV.
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 1 — Définitions</h2>
          <p className="legal-p">
            <strong>"Inspexo"</strong> ou <strong>"la Plateforme"</strong> : le site inspexo.io, édité par DUPLEX SAS.<br />
            <strong>"Utilisateur"</strong> ou <strong>"Client"</strong> : toute personne physique ou morale utilisant le Site ou souscrivant à un service.<br />
            <strong>"Inspecteur"</strong> : professionnel automobile indépendant, qualifié et référencé sur la Plateforme.<br />
            <strong>"Mission"</strong> : prestation commandée par un Client sur la Plateforme (score d'annonce, Pass achat, visio guidée, inspection).<br />
            <strong>"Rapport"</strong> : document de synthèse produit à l'issue d'une mission (par l'analyse IA ou par un inspecteur).
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 2 — Objet</h2>
          <p className="legal-p">
            Inspexo est une plateforme de mise en relation entre des acheteurs de véhicules d'occasion et des inspecteurs indépendants. Inspexo propose également un service d'analyse automatique d'annonces.
          </p>
          <p className="legal-p">
            Inspexo agit en qualité d'intermédiaire. L'inspection est payée exclusivement par l'acheteur&nbsp;: l'inspecteur est un professionnel indépendant qui ne reçoit aucune somme du vendeur, ni d'un garage, ni d'un concessionnaire. Il signe une charte d'indépendance en ce sens.
          </p>
          <p className="legal-p">
            Cette règle vaut pour les prestations d'inspection. Les conditions de référencement des partenaires assurance et financement, et la question de leur rémunération éventuelle, sont décrites à l'article&nbsp;3&nbsp;bis.
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 3 — Services et tarifs</h2>

          <h3 className="legal-h3">3.1 Score d'annonce — gratuit</h3>
          <p className="legal-p">
            Analyse automatique du texte d'une annonce et des photos que le Client fournit : verdict, score,
            motifs, pannes connues sourcées, rappels constructeur, incohérences.<br />
            <strong>5 analyses par période de 24 heures</strong>, décomptées par adresse IP.<br />
            <strong>Sans création de compte.</strong> Les photos transmises ne sont jamais conservées.<br />
            Sans engagement. Ce service ne remplace pas un examen du véhicule.
          </p>

          <h3 className="legal-h3">3.2 Pass achat — 29,00 € TTC</h3>
          <p className="legal-p">
            Accès pendant 30 jours aux fonctions d'accompagnement : analyses sans limitation de nombre, mode
            visite, détail de la marge de négociation, lecture du procès-verbal de contrôle technique, kit
            signature.<br />
            Ce service est régi par ses propres conditions de vente :{' '}
            <a href="/cgv-pass" className="legal-a">CGV du Pass achat</a>, qui prévalent sur les présentes pour
            tout ce qui le concerne.
          </p>

          <h3 className="legal-h3">3.3 Inspection à la demande — 179,00 € TTC</h3>
          <p className="legal-p">
            Inspection sur place par un inspecteur indépendant, dans la zone affichée au moment de la commande,
            sur un créneau choisi par le Client. Rapport photo déposé dans son dossier.<br />
            Ce service est régi par ses propres conditions de vente :{' '}
            <a href="/cgv-inspection" className="legal-a">CGV de l'inspection à la demande</a>, qui prévalent sur
            les présentes pour tout ce qui le concerne.
          </p>

          <h3 className="legal-h3">3.4 Visio guidée — 59,00 € TTC</h3>
          <p className="legal-p">
            Accompagnement à distance, en direct : le Client est devant le véhicule avec son téléphone, un
            inspecteur indépendant le guide par appel vidéo sur la checklist établie pour ce véhicule. Appel de
            30 à 40 minutes, compte rendu écrit déposé dans son dossier sous 2 heures.<br />
            <strong>France entière</strong> — aucun déplacement n'étant nécessaire.<br />
            L'appel n'est <strong>jamais enregistré</strong>. Le compte rendu porte la liste explicite des
            points qui n'ont pas pu être vérifiés à distance.<br />
            Ce service est régi par ses propres conditions de vente :{' '}
            <a href="/cgv-visio" className="legal-a">CGV de la visio guidée</a>, qui prévalent sur les présentes
            pour tout ce qui le concerne.
          </p>

          <h3 className="legal-h3">3.5 Services en préparation</h3>
          <p className="legal-p">
            L'inspection à distance sans accompagnement est en préparation et{' '}
            <strong>n'est pas commercialisée</strong>. Elle ne peut pas être commandée et aucun prix n'est
            proposé pour elle. Le Site permet seulement de s'inscrire sur une liste d'attente.
          </p>

          <p className="legal-p">
            Les prix sont indiqués en euros TTC. Inspexo se réserve le droit de modifier ses tarifs à tout
            moment. Les tarifs applicables sont ceux en vigueur au moment de la commande.
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 3 bis — Partenaires assurance et financement</h2>

          <h3 className="legal-h3">3 bis.1 Ce qu'Inspexo fait, et ne fait pas</h3>
          <p className="legal-p">
            Sous certains résultats d'analyse, Inspexo peut indiquer un partenaire proposant une
            garantie mécanique ou un financement. Inspexo n'est <strong>ni assureur, ni
            intermédiaire en assurance, ni établissement de crédit, ni intermédiaire en opérations
            de banque</strong>, et n'est immatriculé à aucun de ces titres. Son rôle se limite à
            celui d'indicateur&nbsp;: vous signaler l'existence d'un partenaire, puis vous laisser
            traiter directement avec lui.
          </p>
          <p className="legal-p">
            En conséquence, Inspexo ne décrit aucun contrat, ne compare aucune offre, n'affiche ni
            prix, ni taux, ni mensualité, ne propose aucun simulateur et n'indique jamais qu'une
            panne détectée par une analyse serait couverte par une garantie. Le texte affiché est
            celui que le partenaire a lui-même rédigé et validé par écrit, à la date indiquée dans
            notre système.
          </p>

          <h3 className="legal-h3">3 bis.2 Conditions de référencement</h3>
          <p className="legal-p">Un partenaire n'apparaît que si toutes ces conditions sont réunies&nbsp;:</p>
          <ul className="legal-ul">
            <li>il a fourni un texte de présentation et l'a validé par écrit&nbsp;;</li>
            <li>ce texte a passé le contrôle automatique qui écarte tout contenu de contrat, tout
            chiffre commercial et, pour un financement, tout argument de facilité ou de rapidité&nbsp;;</li>
            <li>un texte de financement porte la mention légale obligatoire de l'article L.&nbsp;312-5
            du code de la consommation&nbsp;;</li>
            <li>il a été activé manuellement&nbsp;: aucun partenaire n'est actif par défaut, et toute
            modification de son texte le désactive jusqu'à réactivation&nbsp;;</li>
            <li>le verdict de l'analyse est vert ou orange. <strong>Aucun partenaire n'est affiché
            sous un verdict rouge</strong>, quelles que soient les circonstances.</li>
          </ul>

          <h3 className="legal-h3">3 bis.3 Rémunération</h3>
          <p className="legal-p">
            L'existence ou non d'une rémunération versée à Inspexo par un partenaire est
            <strong> déclarée pour chaque partenaire</strong> et affichée à l'écran, juste au-dessus
            du lien, dans l'une de ces deux formulations&nbsp;:
          </p>
          <ul className="legal-ul">
            <li>«&nbsp;Inspexo perçoit une commission de ces partenaires si vous souscrivez via ce
            lien. Elle n'a aucune influence sur le score ni sur le verdict.&nbsp;»&nbsp;;</li>
            <li>«&nbsp;Inspexo ne perçoit aucune rémunération de ces partenaires.&nbsp;»</li>
          </ul>
          <p className="legal-p">
            Dans tous les cas, <strong>le score, les notes par critère et la couleur du verdict sont
            calculés sans aucune information liée à ces partenaires</strong>. Un contrôle automatique
            vérifie, à chaque mise à jour du site, qu'aucun fichier participant au calcul du verdict
            ne lit ces données. Une rémunération ne peut donc ni améliorer ni dégrader un résultat.
          </p>

          <h3 className="legal-h3">3 bis.4 Ce qui est transmis</h3>
          <p className="legal-p">
            Aucune donnée personnelle n'est transmise à un partenaire. En cliquant, vous arrivez
            simplement sur son site&nbsp;; l'adresse de votre dossier d'analyse ne lui est pas
            communiquée, et aucun traceur tiers n'est installé sur nos pages. Le détail figure dans
            notre <a href="/politique-de-confidentialite">politique de confidentialité</a>.
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 4 — Inscription et compte</h2>
          <p className="legal-p">
            L'inscription sur la Plateforme est gratuite et nécessite une adresse email valide. L'Utilisateur s'engage à fournir des informations exactes et à maintenir la confidentialité de ses identifiants de connexion. L'Utilisateur est responsable de toute activité effectuée depuis son compte. Inspexo se réserve le droit de suspendre ou supprimer tout compte en cas de violation des présentes CGU/CGV.
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 5 — Commande et paiement</h2>
          <p className="legal-p">
            La commande est effectuée sur le Site en sélectionnant un service et en procédant au paiement. Le paiement est sécurisé par Stripe. Inspexo ne stocke aucune donnée bancaire. La commande est confirmée dès la validation du paiement. Un email de confirmation est envoyé au Client.
          </p>
          <p className="legal-p">
            Pour l'inspection à la demande, le Client choisit son créneau au moment de la commande&nbsp;: le paiement n'est
            encaissé qu'une fois un inspecteur confirmé, selon les modalités des{' '}
            <a href="/cgv-inspection" className="legal-a">CGV de l'inspection</a>. Les inspecteurs sont rémunérés
            via Stripe Connect. Aucun paiement direct entre le Client et l'inspecteur n'est autorisé.
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 6 — Déroulement des missions</h2>

          <h3 className="legal-h3">6.1 Score d'annonce</h3>
          <p className="legal-p">
            L'analyse est produite automatiquement dès l'envoi du texte de l'annonce, sans intervention humaine.
            Le résultat est accessible par un lien partageable. Aucune commande, aucun paiement.
          </p>

          <h3 className="legal-h3">6.2 Pass achat</h3>
          <p className="legal-p">
            Les fonctions du Pass sont ouvertes dès l'encaissement du paiement, pour 30 jours. Le détail figure
            dans les <a href="/cgv-pass" className="legal-a">CGV du Pass achat</a>.
          </p>

          <h3 className="legal-h3">6.3 Inspection à la demande</h3>
          <p className="legal-p">
            Le Client commande en indiquant le créneau souhaité et les coordonnées du vendeur. Un inspecteur de
            la zone confirme la mission, se déplace, puis dépose son rapport photo dans le dossier du Client. Le
            déroulement complet figure dans les{' '}
            <a href="/cgv-inspection" className="legal-a">CGV de l'inspection à la demande</a>.
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 7 — Remboursement&nbsp;: une règle par offre</h2>
          <p className="legal-p">
            Chaque offre a sa propre règle de remboursement, et une seule. Aucune demande n'est examinée
            «&nbsp;au cas par cas&nbsp;»&nbsp;: le Client sait à l'avance ce à quoi il a droit.
          </p>
          <p className="legal-p">
            <strong>Score d'annonce</strong>&nbsp;: service gratuit, sans paiement, donc sans remboursement.<br />
            <strong>Pass achat</strong>&nbsp;: <strong>remboursé sans condition dans les 14 jours</strong> suivant
            l'achat, sur simple demande à <a href="mailto:contact@inspexo.io" className="legal-a">contact@inspexo.io</a>,
            sans justification à fournir (<a href="/cgv-pass" className="legal-a">CGV du Pass achat</a>).<br />
            <strong>Inspection à la demande</strong>&nbsp;: barème d'annulation et de remboursement fixé par les{' '}
            <a href="/cgv-inspection" className="legal-a">CGV de l'inspection à la demande</a>.
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 8 — Annulation</h2>
          <p className="legal-p">
            <strong>Score d'annonce</strong>&nbsp;: rien à annuler, le service est gratuit et immédiat.<br />
            <strong>Pass achat</strong>&nbsp;: voir l'article 7 et les{' '}
            <a href="/cgv-pass" className="legal-a">CGV du Pass achat</a>.<br />
            <strong>Inspection à la demande</strong>&nbsp;: les conditions d'annulation, par le Client comme par
            l'inspecteur, ainsi que le sort du paiement, figurent aux{' '}
            <a href="/cgv-inspection" className="legal-a">CGV de l'inspection à la demande</a>.
          </p>
          <p className="legal-p">
            Les remboursements sont effectués sur le moyen de paiement utilisé lors de la commande.
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 9 — Obligations de l'utilisateur</h2>
          <p className="legal-p">
            L'Utilisateur s'engage à utiliser le Site conformément à sa destination, à fournir des informations exactes sur le véhicule analysé, à ne pas utiliser le service d'analyse IA à des fins frauduleuses, à ne pas tenter de contourner les limitations du service gratuit, à respecter les inspecteurs et adopter un comportement courtois, et à ne pas solliciter directement un inspecteur en dehors de la Plateforme pour une mission initiée sur Inspexo.
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 10 — Responsabilité d'Inspexo</h2>
          <p className="legal-p">
            Inspexo agit en qualité d'intermédiaire de mise en relation. Inspexo n'est pas un centre de contrôle technique, un garage, un expert automobile agréé, ni un conseiller financier.
          </p>
          <p className="legal-p">
            Les analyses fournies par Inspexo sont données à titre informatif et reposent sur les connaissances disponibles. Elles ne se substituent pas à un diagnostic professionnel réalisé en personne.
          </p>
          <p className="legal-p">
            Les inspecteurs référencés sur la Plateforme sont des professionnels indépendants. Inspexo vérifie leurs qualifications mais ne se substitue pas à leur responsabilité professionnelle.
          </p>
          <p className="legal-p">
            L'objet de nos prestations est celui décrit à l'article 3. L'analyse d'annonce porte sur le texte et les documents fournis, l'inspection sur ce qui est observable sur place sans démontage&nbsp;: elles ne portent donc pas sur les défauts qui ne sont pas décelables dans ces conditions, ne garantissent pas l'exactitude absolue des fourchettes de coûts, ni la disponibilité permanente du service. La décision d'acheter ou non appartient au Client seul. Pour l'inspection à la demande, Inspexo est responsable de plein droit de la bonne exécution de la prestation (article L221-15 du Code de la consommation)&nbsp;: voir les <a href="/cgv-inspection" className="legal-a">CGV de l'inspection</a>.
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 11 — Qualification des inspecteurs</h2>
          <p className="legal-p">
            Les inspecteurs référencés sur Inspexo sont des professionnels qualifiés, dont les <strong>compétences ont été vérifiées par Inspexo</strong>. Avant tout référencement, Inspexo exige et contrôle&nbsp;: un numéro SIRET valide, une attestation d'assurance de responsabilité civile professionnelle en cours de validité, et la signature de la charte d'indépendance. Le terme "qualifié" ne désigne pas une certification officielle délivrée par un organisme agréé. Inspexo se réserve le droit de suspendre ou retirer un inspecteur de la Plateforme à tout moment.
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 12 — Propriété intellectuelle</h2>
          <p className="legal-p">
            Les rapports générés par l'IA Inspexo et les rapports d'inspection sont la propriété du Client qui les a commandés. Le Client autorise Inspexo à utiliser les données anonymisées issues des conversations et rapports pour améliorer ses services, conformément à la Politique de Confidentialité. L'ensemble du Site (code, design, marque, logo) est la propriété exclusive de DUPLEX SAS.
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 13 — Données personnelles</h2>
          <p className="legal-p">
            Le traitement des données personnelles est décrit dans la{' '}
            <a href="/politique-de-confidentialite" className="legal-a">Politique de Confidentialité</a>{' '}
            accessible à inspexo.io/politique-de-confidentialite.
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 14 — Droit de rétractation</h2>
          <p className="legal-p">
            Conformément à l'article L221-28, 1° du Code de la consommation, le droit de rétractation ne peut être exercé pour les contrats de prestation de services pleinement exécutés avant la fin du délai de rétractation et dont l'exécution a commencé <strong>après accord préalable exprès du consommateur et renoncement exprès à son droit de rétractation</strong>.
          </p>
          <p className="legal-p">
            Le <strong>Pass achat</strong> et l'<strong>inspection à la demande</strong> sont tous deux soumis au
            droit de rétractation de 14 jours de l'article L221-18 du Code de la consommation. Chacun prévoit, dans
            ses propres conditions de vente, la façon dont le Client peut demander une exécution immédiate et ce
            que cette demande implique&nbsp;: voir les{' '}
            <a href="/cgv-pass" className="legal-a">CGV du Pass achat</a> et les{' '}
            <a href="/cgv-inspection" className="legal-a">CGV de l'inspection à la demande</a>.
          </p>
          <p className="legal-p">
            Le <strong>score d'annonce</strong> étant gratuit, il n'ouvre aucun droit de rétractation&nbsp;: celui-ci
            ne s'applique qu'aux contrats à titre onéreux.
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 15 — Modification des CGU/CGV</h2>
          <p className="legal-p">
            Inspexo se réserve le droit de modifier les présentes CGU/CGV à tout moment. Les modifications entrent en vigueur dès leur publication sur le Site. L'utilisation du Site après la publication des modifications vaut acceptation des nouvelles CGU/CGV.
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 16 — Droit applicable et litiges</h2>
          <p className="legal-p">
            Les présentes CGU/CGV sont régies par le droit français.
          </p>
          <p className="legal-p">
            En cas de litige, le Client peut recourir gratuitement au service de médiation :{' '}
            Le médiateur de la consommation compétent sera communiqué prochainement. En attendant, pour toute réclamation, contactez-nous à contact@inspexo.io. Nous nous engageons à traiter votre demande sous 30 jours.
          </p>
          <p className="legal-p">
            À défaut de résolution amiable, le litige relève des juridictions désignées par les règles légales de compétence. Le Client consommateur peut saisir, à son choix, la juridiction du lieu où il demeurait lors de la conclusion du contrat ou de la survenance du fait dommageable, ou celle du lieu où demeure DUPLEX SAS (article R631-3 du Code de la consommation).
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 17 — Contact</h2>
          <p className="legal-p">
            Pour toute question relative aux présentes CGU/CGV :<br /><br />
            <strong>{IDENTITE.raison_sociale}</strong> — {IDENTITE.forme_juridique} au capital de {IDENTITE.capital}<br />
            {IDENTITE.adresse}<br />
            SIREN : {IDENTITE.siren} — SIRET (siège) : {IDENTITE.siret}<br />
            {IDENTITE.rcs} — TVA intracommunautaire : {IDENTITE.tva}<br />
            <a href={`mailto:${IDENTITE.email}`} className="legal-a">{IDENTITE.email}</a><br />
            <a href={IDENTITE.site} className="legal-a">{IDENTITE.site}</a>
          </p>

        </div>
      </div>
      <Footer />
    </>
  )
}
