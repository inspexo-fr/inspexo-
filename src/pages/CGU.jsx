import React from 'react'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { IDENTITE } from '../data/identite'

export default function CGU() {
  return (
    <>
      <Helmet>
        <title>Conditions Générales d'Utilisation et de Vente | Inspexo</title>
        <meta name="description" content="CGU et CGV d'Inspexo — conditions d'utilisation de la plateforme et de vente des services d'inspection automobile." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://www.inspexo.io/cgu" />
      </Helmet>
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
            <strong>"Expert"</strong> : professionnel automobile indépendant, qualifié et référencé sur la Plateforme.<br />
            <strong>"Mission"</strong> : prestation commandée par un Client sur la Plateforme (analyse IA, visio, inspection).<br />
            <strong>"Rapport"</strong> : document de synthèse produit à l'issue d'une mission (par l'IA ou par un expert).
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 2 — Objet</h2>
          <p className="legal-p">
            Inspexo est une plateforme de mise en relation entre des acheteurs de véhicules d'occasion et des experts automobiles spécialisés par marque. Inspexo propose également un service d'analyse par intelligence artificielle.
          </p>
          <p className="legal-p">
            Inspexo agit en qualité d'intermédiaire. L'inspection est payée exclusivement par l'acheteur&nbsp;: l'inspecteur est un professionnel indépendant qui ne reçoit aucune somme du vendeur, ni d'un garage, ni d'un concessionnaire. Il signe une charte d'indépendance en ce sens.
          </p>
          <p className="legal-p">
            Cette règle vaut pour les prestations d'inspection. Les conditions de référencement des partenaires assurance et financement, et la question de leur rémunération éventuelle, sont décrites à l'article&nbsp;3&nbsp;bis.
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 3 — Services et tarifs</h2>

          <h3 className="legal-h3">3.1 Analyse IA gratuite</h3>
          <p className="legal-p">
            10 échanges gratuits avec l'expert IA spécialisé.<br />
            Rapport partiel automatique (scores et défaillances sans coûts détaillés).<br />
            Limité à 3 analyses gratuites par compte.<br />
            Sans engagement.
          </p>

          <h3 className="legal-h3">3.2 Analyse IA complète — 9,90€</h3>
          <p className="legal-p">
            Conversation illimitée avec l'expert IA spécialisé.<br />
            Rapport complet avec coûts détaillés et arguments de négociation.<br />
            Accès immédiat après paiement.
          </p>

          <h3 className="legal-h3">3.3 Visio Test Drive — 59€ (prix de lancement)</h3>
          <p className="legal-p">
            Session visio de 30 minutes avec un expert qualifié spécialisé par marque.<br />
            L'expert guide le client en direct pendant la visite du véhicule via Google Meet.<br />
            Part expert : 40€ / Part plateforme : 19€.
          </p>

          <h3 className="legal-h3">3.4 Inspection Physique — 249€ (prix de lancement)</h3>
          <p className="legal-p">
            Inspection complète sur place par un expert qualifié spécialisé par marque.<br />
            Durée : environ 60 minutes. Rapport détaillé inclus.<br />
            Part expert : 170€ / Part plateforme : 79€.
          </p>

          <p className="legal-p">
            Les prix sont indiqués en euros TTC. Inspexo se réserve le droit de modifier ses tarifs à tout moment. Les tarifs applicables sont ceux en vigueur au moment de la commande. La mention "prix de lancement" indique que ces tarifs sont susceptibles d'évoluer à la hausse.
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
            Pour les services Visio et Inspection, le paiement doit être effectué avant la réservation du créneau avec l'expert. Les experts sont rémunérés via Stripe Connect. Aucun paiement direct entre le Client et l'expert n'est autorisé.
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 6 — Déroulement des missions</h2>

          <h3 className="legal-h3">6.1 Analyse IA</h3>
          <p className="legal-p">
            La conversation avec l'expert IA est accessible immédiatement après paiement (ou gratuitement pour les 10 premiers échanges). Le Client peut clôturer la conversation à tout moment pour générer son rapport. La clôture est irréversible.
          </p>

          <h3 className="legal-h3">6.2 Visio Test Drive</h3>
          <p className="legal-p">
            Après paiement, le Client réserve un créneau via le système de réservation. L'expert rejoint la visio au créneau prévu. Si l'expert est indisponible ou ne se présente pas, le Client est remboursé intégralement.
          </p>

          <h3 className="legal-h3">6.3 Inspection Physique</h3>
          <p className="legal-p">
            Après paiement, le Client réserve un créneau et communique l'adresse du véhicule. L'expert se déplace sur place. Le rapport est remis au Client sous 24 heures suivant l'inspection.
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 7 — Garantie satisfaction 30 jours</h2>
          <p className="legal-p">
            Pour les services Visio Test Drive et Inspection Physique, Inspexo offre une garantie satisfaction de 30 jours à compter de la date de réalisation de la mission. Si le Client estime que la prestation n'a pas été conforme à ce qui était annoncé, il peut demander un remboursement en contactant <a href="mailto:contact@inspexo.io" className="legal-a">contact@inspexo.io</a> dans un délai de 30 jours.
          </p>
          <p className="legal-p">
            La demande de remboursement sera examinée au cas par cas. Le remboursement pourra être total ou partiel selon les circonstances.
          </p>
          <p className="legal-p">
            Cette garantie ne s'applique pas si le Client a fourni des informations erronées sur le véhicule, s'il ne s'est pas présenté au rendez-vous, s'il a annulé moins de 24 heures avant le rendez-vous, ni au service d'analyse IA (rapport généré = service rendu).
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 8 — Annulation et remboursement</h2>

          <h3 className="legal-h3">8.1 Analyse IA (9,90€)</h3>
          <p className="legal-p">
            Aucun remboursement une fois la conversation commencée. Si aucune conversation n'a eu lieu dans les 7 jours suivant le paiement, remboursement automatique.
          </p>

          <h3 className="legal-h3">8.2 Visio Test Drive (59€)</h3>
          <p className="legal-p">
            Annulation gratuite jusqu'à 24 heures avant le créneau réservé → remboursement intégral.<br />
            Annulation moins de 24 heures avant → remboursement de 50% (part expert retenue).<br />
            Non-présentation du Client → aucun remboursement.
          </p>

          <h3 className="legal-h3">8.3 Inspection Physique (249€)</h3>
          <p className="legal-p">
            Annulation gratuite jusqu'à 48 heures avant le créneau réservé → remboursement intégral.<br />
            Annulation entre 48 et 24 heures → remboursement de 70%.<br />
            Annulation moins de 24 heures → remboursement de 50%.<br />
            Non-présentation du Client → aucun remboursement.
          </p>

          <h3 className="legal-h3">8.4 Non-présentation de l'expert</h3>
          <p className="legal-p">
            Si l'expert ne se présente pas ou annule, le Client est remboursé intégralement sous 5 jours ouvrés.
          </p>

          <p className="legal-p">
            Les remboursements sont effectués sur le moyen de paiement utilisé lors de la commande.
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 9 — Obligations de l'utilisateur</h2>
          <p className="legal-p">
            L'Utilisateur s'engage à utiliser le Site conformément à sa destination, à fournir des informations exactes sur le véhicule analysé, à ne pas utiliser le service d'analyse IA à des fins frauduleuses, à ne pas tenter de contourner les limitations du service gratuit, à respecter les experts et adopter un comportement courtois, et à ne pas solliciter directement un expert en dehors de la Plateforme pour une mission initiée sur Inspexo.
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 10 — Responsabilité d'Inspexo</h2>
          <p className="legal-p">
            Inspexo agit en qualité d'intermédiaire de mise en relation. Inspexo n'est pas un centre de contrôle technique, un garage, un expert automobile agréé, ni un conseiller financier.
          </p>
          <p className="legal-p">
            Les analyses fournies par l'expert IA sont données à titre informatif et reposent sur les connaissances disponibles. Elles ne se substituent pas à un diagnostic professionnel réalisé en personne.
          </p>
          <p className="legal-p">
            Les experts référencés sur la Plateforme sont des professionnels indépendants. Inspexo vérifie leurs qualifications mais ne se substitue pas à leur responsabilité professionnelle.
          </p>
          <p className="legal-p">
            Inspexo ne garantit pas l'absence de défauts non détectables lors d'une inspection visuelle, l'exactitude absolue des estimations de coûts fournies par l'IA, la disponibilité permanente du service, ni les décisions d'achat prises par le Client sur la base des informations fournies. La responsabilité d'Inspexo est limitée au montant de la prestation commandée.
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 11 — Qualification des experts</h2>
          <p className="legal-p">
            Les experts référencés sur Inspexo sont des professionnels qualifiés, sélectionnés pour leur expertise sur des marques spécifiques. Le terme "qualifié" désigne un professionnel dont les compétences ont été vérifiées par Inspexo. Il ne s'agit pas d'une certification officielle délivrée par un organisme agréé. Inspexo se réserve le droit de suspendre ou retirer un expert de la Plateforme à tout moment.
          </p>

          <hr className="legal-sep" />

          <h2 className="legal-h2">Article 12 — Propriété intellectuelle</h2>
          <p className="legal-p">
            Les rapports générés par l'IA Inspexo et les rapports d'experts sont la propriété du Client qui les a commandés. Le Client autorise Inspexo à utiliser les données anonymisées issues des conversations et rapports pour améliorer ses services, conformément à la Politique de Confidentialité. L'ensemble du Site (code, design, marque, logo) est la propriété exclusive de DUPLEX SAS.
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
            Conformément à l'article L221-28 du Code de la consommation, le droit de rétractation ne s'applique pas aux services pleinement exécutés avant la fin du délai de rétractation et dont l'exécution a commencé avec l'accord du consommateur.
          </p>
          <p className="legal-p">
            En validant sa commande pour le service d'analyse IA, le Client reconnaît que l'exécution du service commence immédiatement et renonce expressément à son droit de rétractation.
          </p>
          <p className="legal-p">
            Pour les services Visio et Inspection, le droit de rétractation s'applique tant que le créneau n'a pas été réservé. Une fois le créneau réservé, les conditions d'annulation de l'Article 8 s'appliquent.
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
            À défaut de résolution amiable, les tribunaux de Toulouse seront seuls compétents.
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
