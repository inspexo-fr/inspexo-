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
            <li>Données de paiement : durée légale de conservation des documents comptables (10 ans)</li>
            <li>Données anonymisées de prix : conservées indéfiniment (aucun lien avec l'utilisateur)</li>
            <li>Logs techniques : 12 mois</li>
            <li>
              Faits tirés d'un certificat de situation administrative : même durée que l'analyse
              rattachée. <strong>Le PDF lui-même n'est jamais conservé</strong>
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
            l'<strong>immatriculation</strong>. Ils sont lus en mémoire le temps de vérifier que le certificat
            décrit bien le véhicule de l'annonce, puis retirés avant tout enregistrement. Le nom, l'adresse et
            le code postal du titulaire ne sont ni lus ni conservés.
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

          <h2 className="legal-h2">6 octies. Formulaire de contact professionnel</h2>
          <p className="legal-p">
            Le formulaire de la page <a href="/pro">/pro</a> enregistre l'adresse email que vous
            indiquez et, s'ils sont renseignés, le nom de votre société, le volume que vous
            estimez et le message libre décrivant votre besoin.
          </p>
          <ul className="legal-ul">
            <li>
              <strong>Finalité unique :</strong> vous recontacter et établir une proposition
              commerciale. Ces données ne servent à rien d'autre, ne sont pas transmises à un
              tiers et ne nourrissent aucune mesure d'audience.
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
