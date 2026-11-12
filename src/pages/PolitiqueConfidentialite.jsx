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
            <li>Messages échangés avec l'analyse IA</li>
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
          <h3 className="legal-h3">f) Demande de contact professionnel</h3>
          <ul className="legal-ul">
            <li>Adresse email professionnelle (obligatoire)</li>
            <li>Société, volume estimé et description du besoin (facultatifs)</li>
          </ul>
          <p className="legal-p">
            Ces informations, saisies dans le formulaire de la page <a href="/pro">/pro</a>, ne
            servent qu'à vous répondre et à établir une proposition. Voir la section 6 octies.
          </p>

          <h3 className="legal-h3">f bis) Liste d'attente « Abonnement pro »</h3>
          <ul className="legal-ul">
            <li>Adresse email professionnelle (obligatoire)</li>
            <li>Nature de votre activité, choisie dans une liste (obligatoire)</li>
            <li>Tranche d'annonces analysées par mois, choisie dans une liste (obligatoire)</li>
          </ul>
          <p className="legal-p">
            Ce second formulaire de la page <a href="/pro">/pro</a> sert à savoir si une formule
            d'abonnement professionnel a sa place, et laquelle. Aucun champ libre n'y figure :
            l'activité et le volume sont des tranches, jamais une description de votre entreprise.
            Voir la section 6 octies.
          </p>

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
            Les données de prix collectées (devis, factures, fourchettes de réparation) sont anonymisées avant stockage dans notre base de données de référence. Aucune donnée permettant d'identifier l'utilisateur n'est conservée dans cette base. Les données anonymisées sont utilisées pour améliorer la précision des fourchettes de coûts fournies par notre service.
          </p>

          <h2 className="legal-h2">5. Durée de conservation</h2>
          <ul className="legal-ul">
            <li>Données de compte : conservées tant que le compte est actif, puis 3 ans après la dernière connexion</li>
            <li>Données de conversation IA : 2 ans après la dernière interaction</li>
            <li>
              <strong>Chez Anthropic</strong>, qui lit pour nous le texte de l'annonce et les
              photos jointes : <strong>suppression automatique sous 30 jours</strong>, et
              jusqu'à 2 ans si un contenu est signalé comme contraire à sa politique d'usage.
              Cette durée n'est pas la nôtre : nous la publions parce que c'est celle qui
              s'applique réellement à ces données une fois transmises.
            </li>
            <li>Données de paiement : durée légale de conservation des documents comptables (10 ans)</li>
            <li>Données anonymisées de prix : conservées indéfiniment (aucun lien avec l'utilisateur)</li>
            <li>Logs techniques : 12 mois</li>
            <li>
              Faits tirés d'un certificat de situation administrative : même durée que l'analyse
              rattachée. <strong>Le PDF lui-même n'est jamais conservé</strong>
            </li>
            <li>
              Empreinte salée du numéro de châssis écrit dans l'annonce : même durée que l'analyse
              rattachée. <strong>Le numéro lui-même n'est jamais conservé</strong> (section 6 undecies)
            </li>
            <li>
              <strong>Photos d'un rapport d'inspection : 2 ans</strong> à compter de l'inspection, puis
              suppression
            </li>
            <li>
              <strong>Constatations écrites d'un rapport d'inspection, sans les photos : 5 ans</strong>
            </li>
            <li>
              Coordonnées du vendeur transmises pour une inspection : supprimées 3 mois après l'inspection
            </li>
            <li>
              <strong>Photo de constat d'absence de véhicule : 1 an</strong>, puis suppression
            </li>
            <li>
              <strong>Captures d'écran d'une visio guidée : 2 ans</strong> à compter de l'appel, puis
              suppression. <strong>L'appel lui-même n'est jamais enregistré</strong>
            </li>
          </ul>

          <h2 className="legal-h2">6. Partage des données</h2>
          <p className="legal-p">Vos données sont partagées avec :</p>
          <ul className="legal-ul">
            <li><strong>Supabase</strong> — hébergement de la base de données et des fonctions serveur (UE)</li>
            <li><strong>Vercel</strong> — hébergement du site et des fonctions <code>/api</code></li>
            <li><strong>Stripe</strong> — paiement (certifié PCI-DSS)</li>
            <li>
              <strong>Anthropic</strong> — analyse par intelligence artificielle. Le texte de
              l'annonce et, le cas échéant, les photos que vous joignez lui sont transmis pour
              être lus. <strong>Anthropic supprime automatiquement les entrées et les sorties
              de son API sous 30 jours</strong>, et les conserve jusqu'à 2 ans si un contenu est
              signalé comme contraire à sa politique d'usage. Les serveurs d'Anthropic sont
              situés <strong>hors de l'Union européenne</strong>.
            </li>
            <li><strong>Resend</strong> — envoi des emails transactionnels</li>
            <li><strong>Whereby</strong> — visioconférence, pour la visio guidée uniquement</li>
          </ul>
          <p className="legal-p">
            Chacun agit comme sous-traitant, sur nos instructions et pour notre compte
            uniquement. <strong>Cal.com ne figure plus dans cette liste</strong> : l'outil n'est
            pas utilisé et ne reçoit aucune donnée. Nous n'annonçons que des destinataires
            réels — citer un prestataire qui ne reçoit rien est aussi inexact qu'en oublier un.
          </p>
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

          <h2 className="legal-h2">6 ter bis. Photos d'un rapport d'inspection, et coordonnées du vendeur</h2>
          <p className="legal-p">
            <strong>Les photos prises par l'inspecteur pendant une inspection payée sont conservées.</strong>
            Les photos que vous nous envoyez vous-même — pour une analyse d'annonce, en mode visite, ou pour lire
            un procès-verbal de contrôle technique — ne sont, elles, <strong>jamais stockées</strong>&nbsp;:
            elles sont analysées puis oubliées. Les photos d'une inspection{' '}
            <strong>sont le rapport que vous avez acheté</strong>&nbsp;: les supprimer reviendrait à vous retirer
            le produit.
          </p>
          <p className="legal-p">
            Elles sont déposées dans un espace privé, accessibles à vous seul, à l'inspecteur qui les a prises et
            à Inspexo. Elles sont conservées <strong>deux ans à compter de l'inspection</strong>, puis
            supprimées&nbsp;: c'est la durée du délai d'action en garantie des vices cachés (article 1648 du Code
            civil), donc la période pendant laquelle elles peuvent vous servir. Les{' '}
            <strong>constatations écrites du rapport, sans les photos, sont conservées cinq ans</strong>.
          </p>
          <p className="legal-p">
            <strong>Photo de constat d'absence.</strong> Si le véhicule n'est pas présenté à l'inspecteur, il
            prend une photo horodatée sur place&nbsp;: c'est elle qui justifie la retenue prévue par les
            conditions de vente. Elle est conservée <strong>un an</strong> — le temps d'une contestation ou d'un
            litige de paiement — puis supprimée.
          </p>
          <p className="legal-p">
            L'inspecteur donne un consentement horodaté avant tout dépôt et s'engage, par sa charte
            d'indépendance, à ne photographier ni plaque d'immatriculation, ni document d'identité, ni{' '}
            <strong>aucune personne reconnaissable</strong>, sur aucune de ces photos.
          </p>
          <p className="legal-p">
            <strong>Coordonnées du vendeur.</strong> Pour commander une inspection, vous nous indiquez le nom, le
            téléphone et l'adresse où se trouve le véhicule. Ces données servent uniquement à permettre à
            l'inspecteur de se rendre sur place&nbsp;: elles ne lui sont transmises{' '}
            <strong>qu'après qu'il a confirmé la mission</strong>, ne sont utilisées à aucune autre fin, ne
            servent à aucune prospection, et sont supprimées trois mois après l'inspection.
          </p>
          <p className="legal-p">
            <strong>Base légale&nbsp;: l'intérêt légitime</strong> (article 6.1.f du RGPD) — exécuter
            l'inspection commandée par l'acheteur, ce qui suppose de pouvoir joindre la personne qui détient le
            véhicule et de s'y rendre. Ces données ne nous sont pas fournies par le vendeur lui-même&nbsp;:
            elles nous sont transmises par l'acheteur.
          </p>
          <p className="legal-p">
            <strong>Information du vendeur</strong> (article 14 du RGPD). Parce que nous ne recueillons pas ces
            données auprès de la personne concernée, l'inspecteur <strong>informe le vendeur dès son premier
            contact</strong>&nbsp;: il lui indique que l'acheteur a commandé une inspection, que ses
            coordonnées ont été transmises pour ce seul rendez-vous, et où lire la présente politique. Cet
            engagement figure dans la <strong>charte d'indépendance</strong> que chaque inspecteur signe.
          </p>
          <p className="legal-p">
            Un vendeur qui le souhaite peut demander l'accès, la rectification ou la suppression de ses
            coordonnées, et s'opposer à ce traitement, en écrivant à{' '}
            <a href="mailto:contact@inspexo.io" className="legal-a">contact@inspexo.io</a> (section 7).
          </p>

          <h2 className="legal-h2">6 ter bis bis. Visio guidée : aucun enregistrement</h2>
          <p className="legal-p">
            Pendant une visio guidée, <strong>l'appel n'est jamais enregistré</strong> — ni l'image, ni le son.
            La fonction d'enregistrement n'est pas activée chez notre prestataire vidéo, et aucun flux n'est
            conservé. Il n'existe donc aucune vidéo de votre voiture, ni de vous.
          </p>
          <p className="legal-p">
            <strong>Prestataire vidéo : Whereby AS</strong> (Norvège, Espace économique européen), en qualité de
            sous-traitant. Il achemine les flux sans les stocker&nbsp;: «&nbsp;<em>Media sent between
            participants in a room will not be stored</em>&nbsp;», et les utilisateurs européens sont connectés
            à un centre de données situé dans l'EEE. L'accord de traitement est publié à{' '}
            <a href="https://whereby.com/information/dpa/" target="_blank" rel="noopener noreferrer" className="legal-a">
              whereby.com/information/dpa
            </a>.
          </p>
          <p className="legal-p">
            <strong>Captures d'écran.</strong> L'inspecteur peut avoir besoin de figer une image — un compteur,
            une plaque de défaut, un carnet d'entretien. Il ne le fait <strong>qu'avec votre accord</strong>,
            demandé pendant l'appel et horodaté. Ces captures suivent les règles des photos d'inspection&nbsp;:
            espace privé, <strong>aucune personne reconnaissable</strong>, conservation <strong>deux
            ans</strong>, puis suppression. Sans votre accord, aucune capture n'est acceptée.
          </p>
          <p className="legal-p">
            Le lien de l'appel est unique par mission et n'est actif qu'autour du créneau (15 minutes avant,
            90 minutes après). En dehors de cette fenêtre, il ne donne accès à rien.
          </p>

          <h2 className="legal-h2">6 ter ter. Certificat de situation administrative (HistoVec)</h2>
          <p className="legal-p">
            Vous pouvez déposer le <strong>certificat de situation administrative</strong> que le vendeur a
            produit sur histovec.interieur.gouv.fr. <strong>Le PDF n'est jamais conservé</strong>&nbsp;: son
            texte est extrait en mémoire, les faits utiles en sont tirés par des règles fixes, et le fichier
            est oublié. Aucune intelligence artificielle n'intervient sur ce document.
          </p>
          <p className="legal-p">
            Ce qui est conservé avec votre analyse&nbsp;: les <strong>faits administratifs</strong> (gage,
            opposition, saisie, vol, procédure pour véhicule endommagé, suspension, certificat annulé), le
            nombre de détenteurs successifs déduit des opérations d'immatriculation, le passage éventuel en
            location, la date de première immatriculation, la marque et la date de validité du certificat.
          </p>
          <p className="legal-p">
            Ce qui n'est <strong>jamais</strong> conservé&nbsp;: le <strong>numéro de série (VIN)</strong> et
            l'<strong>immatriculation</strong> figurant sur le certificat. Ils sont lus en mémoire le temps de
            vérifier que le certificat décrit bien le véhicule de l'annonce, puis retirés avant tout
            enregistrement. Le nom, l'adresse et le code postal du titulaire ne sont ni lus ni conservés.
            Le numéro de châssis écrit dans l'<strong>annonce</strong>, lui, laisse une empreinte&nbsp;:
            voir la section 6 undecies.
          </p>
          <p className="legal-p">
            Ces faits suivent la durée de conservation de l'analyse à laquelle ils sont rattachés (section 5).
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

          <h2 className="legal-h2">6 quinquies. Mesure d'audience — sans cookie ni traceur</h2>
          <p className="legal-p">
            Nous mesurons le parcours sur le site pour savoir ce qui fonctionne. Cette mesure
            n'utilise <strong>aucun cookie, aucun traceur tiers et aucun identifiant de
            navigateur</strong>. Elle ne requiert donc pas votre consentement, au titre de
            l'exemption prévue pour la mesure d'audience.
          </p>
          <ul className="legal-ul">
            <li>
              <strong>Ce qui est enregistré :</strong> des étapes, côté serveur, rattachées au
              dossier d'analyse concerné — analyse lancée, verdict affiché, clic sur le Pass,
              paiement ouvert, paiement réussi, clic sur l'inspection, inscription en liste
              d'attente, clic vers un partenaire, demande du rapport par email, retour après achat.
              Aucune de ces étapes ne porte d'identifiant vous concernant.
            </li>
            <li>
              <strong>Adresse IP :</strong> elle n'est jamais conservée en clair. Pour les seuls
              besoins de limitation d'abus, nous en gardons une empreinte calculée avec un
              <strong> sel aléatoire renouvelé chaque jour</strong>, et les sels de plus de deux
              jours sont détruits. Passé ce délai, une empreinte ne peut plus être rattachée à une
              adresse, y compris par nous. Les empreintes antérieures à cette mesure, calculées
              sans sel, ont été effacées.
            </li>
            <li>
              <strong>Aucun recoupement :</strong> ces mesures ne sont jamais croisées avec
              d'autres traitements, ni avec des données d'autres sites, ni transmises à un tiers.
            </li>
          </ul>

          <h2 className="legal-h2">6 sexies. Étiquette de campagne (?src=)</h2>
          <p className="legal-p">
            Certains de nos liens (une vidéo, un article) portent un paramètre <code>?src=</code>
            {' '}suivi d'une étiquette, par exemple <code>tiktok-03</code>. Elle nous permet de
            savoir quel contenu amène du monde.
          </p>
          <ul className="legal-ul">
            <li>
              Cette étiquette est conservée dans le <strong>stockage de session</strong> de votre
              navigateur — une seule entrée, dont la valeur est l'étiquette et rien d'autre. Elle
              disparaît à la fermeture de l'onglet.
            </li>
            <li>
              Elle est <strong>effacée dès qu'elle a été rattachée à une analyse</strong> : elle a
              alors joué son rôle.
            </li>
            <li>
              Ce n'est pas un identifiant : elle désigne un lien, pas une personne, et elle
              n'apparaît que sous forme de statistiques agrégées — <strong>jamais à côté d'une
              adresse email</strong> ni dans un export nominatif.
            </li>
          </ul>

          <h2 className="legal-h2">6 septies. API destinée aux professionnels</h2>
          <p className="legal-p">
            Les professionnels disposant d'une clé peuvent nous envoyer des annonces par API. Les
            textes transmis servent à produire l'analyse demandée et suivent le même traitement
            que ceux du site public. Nous conservons, pour la facturation, le nombre d'appels par
            client et par mois — jamais le contenu des requêtes rattaché à une personne physique.
            Les clés sont stockées sous forme d'empreinte salée, jamais en clair.
          </p>

          <h2 className="legal-h2">6 octies. Formulaires professionnels</h2>
          <p className="legal-p">
            La page <a href="/pro">/pro</a> porte deux formulaires distincts, enregistrés dans la
            même table avec une mention de leur origine.
          </p>
          <p className="legal-p">
            Le <strong>formulaire de devis</strong> enregistre l'adresse email que vous indiquez
            et, s'ils sont renseignés, le nom de votre société, le volume que vous estimez et le
            message libre décrivant votre besoin.
          </p>
          <p className="legal-p">
            La <strong>liste d'attente « Abonnement pro »</strong> enregistre votre adresse email,
            la nature de votre activité et la tranche d'annonces que vous analysez par mois.
            S'y inscrire ne réserve rien et ne vous engage à rien. Dans l'écran d'administration,
            ces réponses ne sont affichées qu'en nombre — jamais à côté d'une adresse email.
          </p>
          <ul className="legal-ul">
            <li>
              <strong>Finalité unique :</strong> vous recontacter, établir une proposition
              commerciale ou vous prévenir de l'ouverture de l'abonnement. Ces données ne servent
              à rien d'autre, ne sont pas transmises à un tiers et ne nourrissent aucune mesure
              d'audience.
            </li>
            <li>
              <strong>Base légale :</strong> mesures précontractuelles prises à votre demande.
            </li>
            <li>
              <strong>Conservation :</strong> trois ans à compter du dernier contact, puis
              suppression. Vous pouvez demander la suppression immédiate à tout moment
              (section 7).
            </li>
            <li>
              Le formulaire porte la même mention de consentement que nos autres champs email, et
              chaque message que nous vous enverrons comportera un lien de désinscription.
            </li>
          </ul>

          <h2 className="legal-h2">6 nonies. Application mobile</h2>
          <p className="legal-p">
            L'application Inspexo (iOS et Android) affiche le même service que le site. Elle
            ajoute un seul chemin : partager une annonce depuis Leboncoin, La Centrale ou
            AutoScout24 vers Inspexo.
          </p>
          <ul className="legal-ul">
            <li>
              <strong>L'annonce est lue par votre appareil, jamais par nos serveurs.</strong>
              Le partage nous transmet une adresse ; l'application ouvre cette page dans une
              fenêtre visible, sur votre téléphone, avec votre propre session. Un script y lit
              le texte et la liste des photos. <strong>Aucune requête ne part de nos serveurs
              vers le site d'annonces</strong> — nous ne recevons que le résultat de cette
              lecture.
            </li>
            <li>
              Si le site d'annonces affiche une vérification anti-robot, <strong>c'est vous qui
              la passez</strong>, dans cette fenêtre. Rien ne la contourne.
            </li>
            <li>
              <strong>Les photos sont réduites à 1 600 pixels et ré-encodées sur l'appareil
              avant tout envoi</strong>, ce qui supprime les métadonnées EXIF — donc la date de
              prise de vue et les coordonnées GPS éventuelles. Elles sont ensuite transmises à
              Anthropic pour être lues (voir la section 6), puis oubliées : <strong>nous n'en
              conservons aucune</strong>, seul leur nombre est enregistré.
            </li>
            <li>
              L'application ne demande ni votre position, ni vos contacts, ni de notifications.
              L'accès à l'appareil photo et à la photothèque n'est demandé qu'au moment où vous
              choisissez d'ajouter une photo.
            </li>
            <li>
              Aucun outil de mesure d'audience, aucun traceur publicitaire, aucun identifiant
              publicitaire n'est présent dans l'application.
            </li>
          </ul>

          <h2 className="legal-h2">6 decies. Mode revendeur : profil et cibles</h2>
          <p className="legal-p">
            Le mode revendeur, réservé au Pass achat, calcule trois chiffres à partir des annonces
            comparables que <strong>vous</strong> avez relevées et de vos paramètres. Deux
            informations sont conservées pour ne pas vous les redemander à chaque annonce.
          </p>
          <p className="legal-p">
            Votre <strong>profil</strong> : la région et la puissance fiscale qui servent à
            chiffrer la carte grise, la ville où vous comptez revendre (uniquement pour savoir si
            sa zone à faibles émissions interdit le véhicule), votre marge visée et votre taux
            d'imprévus. Sans compte, ces réglages restent dans votre navigateur et ne nous sont
            jamais envoyés. Avec un compte, ils suivent votre compte d'un appareil à l'autre.
          </p>
          <p className="legal-p">
            Vos <strong>cibles</strong> : pour chaque modèle sur lequel vous avez assez de relevés,
            nous conservons un <strong>histogramme de prix</strong> — le nombre d'annonces par
            tranche de 250 €, l'année et le kilométrage médians. Aucun titre d'annonce, aucune
            adresse web, aucun lien vers une analyse : cet histogramme ne permet de retrouver
            aucune annonce particulière.
          </p>
          <ul className="legal-ul">
            <li>
              <strong>Finalité unique :</strong> vous montrer, d'une session à l'autre, les
              modèles où vos relevés sont assez nombreux et la marge que vos paramètres y
              laissent. Ces données ne servent à rien d'autre.
            </li>
            <li>
              <strong>Elles ne rejoignent jamais le relevé de prix public</strong> décrit à la
              section 4. Celui-ci est collectif et sans attribution ; votre carnet est privé
              et attaché à votre compte. Les mélanger reviendrait à attribuer le relevé public à
              des personnes.
            </li>
            <li>
              <strong>Base légale :</strong> l'exécution du contrat (le Pass achat).
            </li>
            <li>
              <strong>Conservation :</strong> tant que votre compte existe. Vous pouvez retirer
              une cible depuis la page « Mes cibles », et demander la suppression de l'ensemble
              à tout moment (section 7).
            </li>
            <li>
              <strong>Aucune requête vers un site d'annonces.</strong> La recherche à sauvegarder
              est composée par nos soins : nous vous donnons les filtres à régler, nous n'allons
              pas les appliquer à votre place.
            </li>
          </ul>

          <h2 className="legal-h2">6 undecies. Numéro de châssis (VIN) écrit dans l'annonce</h2>
          <p className="legal-p">
            Quand une annonce contient un <strong>numéro de châssis</strong> (VIN), notre serveur le
            repère par une règle d'écriture fixe — jamais par une intelligence artificielle, qui
            pourrait en inventer un plausible — et en déduit le constructeur, le pays de fabrication
            et l'année-modèle probable, afin de vérifier que ces éléments concordent avec ce que
            l'annonce affirme. Une discordance de constructeur est signalée dans le dossier.
          </p>
          <ul className="legal-ul">
            <li>
              <strong>Le numéro n'est jamais conservé</strong>, et il n'apparaît sur aucune page&nbsp;:
              ni dans votre dossier, ni dans le lien que vous pourriez partager. Seuls les éléments
              déduits ci-dessus y figurent.
            </li>
            <li>
              Nous en conservons une <strong>empreinte salée</strong> (une suite de caractères
              calculée à partir du numéro et d'un secret connu de nous seuls). Elle ne permet pas de
              retrouver le numéro.
            </li>
            <li>
              <strong>Finalité unique :</strong> vérifier qu'un rapport HistoVec que vous déposez
              décrit bien le véhicule de l'annonce. Comparer deux empreintes évite de conserver les
              deux numéros. Elle ne sert à rien d'autre&nbsp;: ni à vous reconnaître, ni à rapprocher
              deux dossiers, ni à aucune mesure.
            </li>
            <li>
              <strong>Conservation :</strong> celle du dossier auquel elle est rattachée
              (section 5). Le dossier supprimé, l'empreinte disparaît avec lui.
            </li>
            <li>
              <strong>Base légale :</strong> l'exécution du service d'analyse que vous demandez.
            </li>
          </ul>

          <h2 className="legal-h2">6 duodecies. Vignette Crit'Air et zones à faibles émissions</h2>
          <p className="legal-p">
            Chaque analyse indique la <strong>vignette Crit'Air</strong> du véhicule. Elle est
            déduite de son énergie et de sa date de première immatriculation par la table de
            l'arrêté du 21 juin 2016&nbsp;: c'est un calcul réglementaire, pas une estimation, et
            rien n'est transmis à un tiers pour l'obtenir. Faute de date de première
            immatriculation dans l'annonce, le dossier le dit et renvoie à la carte grise.
          </p>
          <ul className="legal-ul">
            <li>
              <strong>La commune indiquée dans l'annonce</strong> est lue par notre serveur pour
              savoir si une zone à faibles émissions y est répertoriée. Elle est lue
              <strong> en mémoire</strong> et n'est pas enregistrée&nbsp;: seul le nom de la zone
              concernée, tel qu'il figure dans notre liste publique, est conservé avec l'analyse.
              Si aucune zone n'est répertoriée, rien n'est conservé.
            </li>
            <li>
              <strong>La ville où vous comptez rouler</strong> est facultative et reste
              <strong> dans votre navigateur</strong> (stockage local). Elle n'est jamais envoyée à
              nos serveurs&nbsp;: le calcul se fait sur votre appareil. Vous l'effacez en vidant le
              champ, ou en effaçant les données du site.
            </li>
            <li>
              La liste des zones et sa <strong>date de relevé</strong> sont affichées sous le
              résultat. Elle évolue par arrêté local&nbsp;: nous invitons à vérifier auprès de la
              métropole concernée.
            </li>
            <li>
              Cette information <strong>ne pèse pas sur le verdict</strong>&nbsp;: une vignette est
              une contrainte d'usage, pas un défaut du véhicule.
            </li>
          </ul>

          <h2 className="legal-h2">6 terdecies. Coût réel sur 3 ans et comparaison de dossiers</h2>
          <ul className="legal-ul">
            <li>
              Pour calculer le <strong>coût sur 3 ans</strong>, votre navigateur envoie à notre
              serveur le <strong>kilométrage annuel</strong> que vous indiquez, et, si vous les avez
              renseignées, votre <strong>région</strong> et la <strong>puissance fiscale</strong>.
              Elles servent au seul calcul de la réponse et <strong>ne sont pas enregistrées</strong>.
              Elles restent mémorisées dans votre navigateur (stockage local) pour ne pas vous être
              redemandées.
            </li>
            <li>
              La <strong>comparaison de dossiers</strong> ne porte que sur les analyses que vous
              suivez dans votre dossier. Elle ne crée aucune donnée nouvelle&nbsp;: elle relit des
              analyses déjà produites, et sa recommandation est calculée par des règles fixes, sans
              appel à un modèle d'intelligence artificielle.
            </li>
            <li>
              Le prix du contrôle technique provient du relevé public des tarifs des centres
              (DGCCRF, data.gouv.fr)&nbsp;: aucune donnée vous concernant n'y est transmise.
            </li>
          </ul>

          <h2 className="legal-h2">6 quaterdecies. Réponses et justificatifs du vendeur</h2>
          <p className="legal-p">
            Avec le Pass, vous pouvez coller la réponse d'un vendeur ou photographier une pièce qu'il
            vous a remise (facture, attestation de rappel).
          </p>
          <ul className="legal-ul">
            <li>
              <strong>La réponse collée</strong> est relue par notre serveur avec des règles fixes,
              sans intelligence artificielle. Seuls les faits relevés, avec un extrait de quinze mots
              au plus, sans numéro de téléphone ni adresse électronique, sont conservés avec le dossier
              si vous le suivez dans votre espace.
            </li>
            <li>
              <strong>La photo de la pièce</strong> est transmise à Anthropic pour être lue (voir la
              section 6), puis oubliée&nbsp;: <strong>nous ne la conservons pas</strong>. Sont conservés
              la date, le kilométrage, les opérations et, le cas échéant, le code de la campagne de rappel.
            </li>
            <li>
              <strong>Le numéro de série (VIN) et l'immatriculation</strong> lus sur la pièce servent
              uniquement à vérifier qu'elle concerne le véhicule de l'annonce. La comparaison se fait
              <strong> en mémoire</strong>, le VIN par une empreinte salée (section 6 undecies)&nbsp;:
              ni l'un ni l'autre n'est enregistré, renvoyé à votre navigateur ou journalisé.
            </li>
            <li>
              Sans dossier suivi, le résultat vous est seulement affiché&nbsp;: rien n'est enregistré
              avec l'analyse.
            </li>
          </ul>

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
