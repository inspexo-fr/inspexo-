# Fiches de store et déclarations de confidentialité — à relire avant de figer

Sprint 18. **Rien n'est soumis.** Ce document est dérivé du CODE, pas de la
page de confidentialité : quand les deux divergent, c'est le code qui dit la
vérité, et c'est la page qu'il faut corriger. Les divergences trouvées sont
listées en fin de document.

---

## 1. Identité

| | |
|---|---|
| Identifiant | `io.inspexo.app` |
| Nom affiché | **Inspexo** |
| Éditeur | DUPLEX SAS — SIREN 941 962 060 |
| Catégorie | iOS : Utilitaires · Android : Auto et véhicules |
| Classification | 4+ / PEGI 3 (aucun contenu sensible) |
| Langue | Français (France) |
| Politique de confidentialité | https://www.inspexo.io/politique-de-confidentialite |
| Assistance | contact@inspexo.io |

---

## 2. Textes de fiche

### Nom (30 car. max)
`Inspexo`

### Sous-titre iOS (30 car. max)
`L'annonce ne dit pas tout`  *(26)*

### Description courte Google Play (80 car. max)
`Analysez une annonce auto : pannes connues, rappels, airbags Takata. Gratuit.`  *(77)*

### Description longue

> **Avant d'acheter une voiture d'occasion, lisez ce que l'annonce ne dit pas.**
>
> Collez le texte d'une annonce — ou partagez-la depuis Leboncoin, La Centrale
> ou AutoScout24 — et obtenez en une minute :
>
> • les **pannes connues** de ce moteur, chacune avec sa source consultable ;
> • les **rappels constructeur** publiés sur ce modèle (base officielle
>   RappelConso) ;
> • la vérification **airbags Takata** sur la liste du ministère ;
> • le **statut réel du vendeur** et ce qu'il change à vos droits ;
> • les **questions précises** à poser, et quoi vérifier sur place.
>
> **Chaque affirmation renvoie à sa source.** Ce qui n'est pas prouvé n'est pas
> affiché : nous préférons une ligne en moins à une ligne inventée.
>
> **Nous ne sommes jamais payés par le vendeur.** Aucune commission sur la
> vente, aucun lien avec un marchand. L'analyse est gratuite et sans
> inscription.
>
> Inspexo ne remplace pas l'examen du véhicule : c'est une analyse automatique
> du texte de l'annonce, faite pour vous dire quoi regarder et quoi demander.

⚠️ **Interdits de vocabulaire, vérifiés** : jamais « expertise », « expert »,
« estimation », « cote » ni « valeur » appliqués à notre analyse
(art. L326-4 et L326-8 du code de la route). Jamais « certifié ». Aucun chiffre
d'économies promis.

### Mots-clés iOS (100 car.)
`occasion,annonce,voiture,auto,rappel,takata,panne,moteur,achat,leboncoin,vérification,vo`

---

## 3. Déclaration Apple — App Privacy

Dérivée du code. Apple définit « collecte » comme : transmettre hors de
l'appareil et y accéder **au-delà du temps nécessaire au traitement en temps
réel de la requête**. Ce critère change la réponse pour les photos.

| Donnée | Collectée | Liée à l'identité | Suivi publicitaire | Usage | Où dans le code |
|---|---|---|---|---|---|
| **Adresse email** | Oui, **si l'utilisateur la donne** | Oui | Non | Fonctionnement de l'app | `leads`, `submit_lead`, lien magique |
| **Identifiant utilisateur** | Oui, **si compte créé** | Oui | Non | Fonctionnement de l'app | `auth.users`, dossier d'achat |
| **Historique d'achat** | Oui, si achat | Oui | Non | Fonctionnement de l'app | `passes`, `inspections` (Stripe) |
| **Autre contenu utilisateur** (texte de l'annonce) | **Oui** | Non | Non | Fonctionnement de l'app | `analyses.input_text` |
| **Photos** | **Oui** | Non | Non | Fonctionnement de l'app | transmises au modèle ; nous n'en gardons aucune, Anthropic jusqu'à 30 jours |
| **Interactions produit** | Oui | **Non** | Non | Fonctionnement + Analytics | `events`, reliés à `analysis_id` |
| **Données de diagnostic / plantage** | **NON** | — | — | — | aucun SDK de télémétrie dans le projet |
| **Localisation** | **NON** | — | — | — | jamais demandée |
| **Contacts, santé, finances, historique de navigation** | **NON** | — | — | — | — |

**Suivi (App Tracking Transparency) : NON.** Aucune donnée n'est partagée à des
fins publicitaires ni croisée avec des données tierces. Pas de SDK publicitaire,
pas d'IDFA : l'app n'aura pas à afficher l'invite ATT.

⚠️ **LES PHOTOS SONT DÉCLARÉES COLLECTÉES, ET C'EST UN CHOIX.**

Le critère d'Apple est « transmettre hors de l'appareil **et y accéder
au-delà du temps nécessaire au traitement en temps réel** ». Nous n'en
conservons aucune — seul le NOMBRE de photos persiste. Mais elles transitent
par **Anthropic**, qui **supprime automatiquement les entrées et les sorties
de son API sous 30 jours** et peut les conserver **jusqu'à 2 ans** si un
contenu est signalé comme contraire à sa politique d'usage — vérifié le
5 novembre 2026 sur `privacy.claude.com/en/articles/7996866`.

**Trente jours, ce n'est pas du temps réel.** En cas de doute on déclare
plus, jamais moins : une déclaration trop large ne coûte rien, une
déclaration trop étroite est un motif de rejet et, surtout, une affirmation
fausse faite à l'utilisateur.

Elles portent **exactement les mêmes réglages que le texte de l'annonce** :
fonctionnement de l'app, **non liées à l'identité**, **aucun suivi**.

ℹ️ Les photos d'une inspection payée sont, elles, bien conservées (2 ans) —
mais elles sont prises par l'inspecteur, et ce parcours n'existe pas encore
dans l'app.

### Permissions système demandées
| Permission | Demandée ? | Texte d'usage |
|---|---|---|
| Appareil photo | Oui, **à l'usage seulement** (ajout de photos à une analyse) | « Pour joindre des photos du véhicule à votre analyse. Elles sont envoyées pour être lues, puis oubliées : aucune photo n'est conservée. » |
| Photothèque | Oui, à l'usage | même texte |
| Localisation, micro, contacts, notifications | **Non** | — |

---

## 4. Déclaration Google Play — Data safety

| Type | Collectée | Partagée | Obligatoire | Finalité |
|---|---|---|---|---|
| Adresse email | Oui | Non | **Facultatif** | Fonctionnalités de l'app, service client |
| Identifiants utilisateur | Oui | Non | Facultatif | Fonctionnalités de l'app |
| Informations de paiement | **Non** (traitées par Stripe, jamais vues par nous) | — | — | — |
| Historique d'achat | Oui | Non | Facultatif | Fonctionnalités de l'app |
| Photos et vidéos | **Oui** | Non | **Facultatif** | Fonctionnalités de l'app |
| Autres actions dans l'app | Oui | Non | Obligatoire | Analyses, fonctionnalités de l'app |
| Autre contenu généré (texte de l'annonce) | Oui | Non | Obligatoire | Fonctionnalités de l'app |
| Fichiers, contacts, position, santé, SMS, agenda | **Non** | — | — | — |

**Pratiques de sécurité à déclarer :**
- Les données sont **chiffrées en transit** : oui (HTTPS partout).
- L'utilisateur peut **demander la suppression** : oui —
  contact@inspexo.io, et suppression du compte depuis `/dossier`.
- L'app respecte la **politique Familles** : sans objet (pas destinée aux
  enfants).
- **Aucune donnée n'est partagée avec des tiers** au sens de Google (« partage »
  = transfert à une autre entreprise qui l'utilise pour son compte). Nos
  sous-traitants agissent sur instruction et ne traitent rien pour leur compte.

### Sous-traitants (à citer dans la politique, pas dans le formulaire)
Anthropic (analyse — **hors UE**), Supabase (hébergement base et fonctions),
Vercel (hébergement du site), Stripe (paiements), Resend (emails),
Whereby (visio).

---

## 5. Écarts de la politique — corrigés

1. ✅ **Vercel ajouté** aux sous-traitants (hébergement du site et des
   fonctions `/api`).
2. ✅ **Cal.com retiré** : il y figurait alors que rien ne lui est envoyé.
   Citer un prestataire qui ne reçoit rien est aussi inexact qu'en oublier
   un — et c'est le même défaut que l'omission de Vercel, dans l'autre sens.
3. ✅ **Section « Application mobile » ajoutée** : annonce lue par
   l'appareil, aucune requête de nos serveurs vers le site d'annonces,
   photos réduites à 1 600 px et ré-encodées (EXIF supprimé), aucune
   permission superflue, aucun traceur.
4. ✅ **Durée de conservation chez Anthropic publiée** : 30 jours, jusqu'à
   2 ans si signalé. Ce n'est pas notre durée, mais c'est celle qui
   s'applique réellement une fois les données transmises.
5. ⬜ **Cloudflare (Turnstile)** : câblé mais dormant. À ajouter **le jour
   où les clés sont posées**, pas avant — le citer aujourd'hui laisserait
   croire qu'il voit déjà passer du trafic.

## 6. ⚠️ La promesse technique de l'app, et comment la prouver

> **Aucune requête de nos serveurs vers Leboncoin, La Centrale ou AutoScout24.**

Ce que fait l'app : le partage transmet une **URL**. L'app ouvre cette URL dans
une **WebView visible**, sur l'appareil, avec la session de l'utilisateur.
L'extraction est un script injecté dans cette page. Les photos sont
téléchargées **par le téléphone**, redimensionnées à 1 600 px et ré-encodées
(EXIF supprimé). Seul le résultat — texte et photos — part vers nos serveurs.

Si une vérification anti-robot s'affiche, **c'est l'utilisateur qui la passe**,
dans la WebView. Rien ne la contourne.

⚠️ **À vérifier avant soumission, et je ne l'ai pas encore fait** : observer le
trafic sortant de nos fonctions pendant un partage réel, pour prouver qu'aucune
requête ne part vers le site d'annonces. Le code ne contient aucun appel de ce
genre (vérifié par lecture), mais une lecture n'est pas une mesure.

---

## 7. Captures pour les stores

Produites par `node scripts/captures-stores.mjs`, sur l'**application
réellement installée** et un **vrai dossier** (IX-2026-00621, Peugeot 308,
PRUDENCE 55/100) — pas sur une maquette.

| Fichier | Taille | Plateforme |
|---|---|---|
| `ios-1320x2868-1-accueil.png` | 1320×2868 | iPhone 6,9″ — **format exigé** |
| `ios-1290x2796-1-accueil.png` | 1290×2796 | second format accepté |
| `android-1-accueil.png` | 1080×2400 | ≥ 1080×1920 exigé |
| `android-2-dossier.png` | 1080×2400 | le dossier, avec le tampon |
| `android-3-takata.png` | 1080×2400 | recherche Takata |
| `google-banniere-1024x500.png` | 1024×500 | image mise en avant |

⚠️ **Sur iOS, seul l'accueil est capturé, et c'est une limite de l'outillage,
pas un oubli.** iOS 27 affiche systématiquement « Ouvrir dans « Inspexo » ? »
quand un lien profond vient de l'extérieur — application fermée comprise — et
la boîte de dialogue se retrouve sur l'image. Aucun moyen de toucher l'écran
du simulateur n'est disponible ici : AppleScript est bloqué par les
autorisations d'accessibilité, `simctl` n'a pas de commande de tap, `idb`
n'est pas installé.

Les deux écrans manquants se prennent en **trente secondes** dans Xcode, à la
main : lancer le simulateur, toucher l'écran, ⌘S. À faire au moment où vous
ouvrirez Xcode pour créer la Share Extension. Apple accepte une seule capture
pour soumettre — ce n'est donc pas bloquant.

⚠️ **Une capture ratée a failli partir** : la première série ouvrait les pages
avec une URL `https://`, ce que `simctl openurl` transmet à **Safari**. Les
images montraient le site dans un navigateur, barre d'adresse comprise, et
non l'application. Corrigé par un lien profond `inspexo://aller?p=/chemin`
ajouté à l'app — qui a par ailleurs son utilité propre.

## 8. Ce qu'il reste à faire, et qui demande vos comptes

| | |
|---|---|
| Compte développeur Apple | 99 $/an |
| Compte développeur Google Play | 25 $ une fois |
| Target **Share Extension** iOS | à créer dans Xcode (5 min, procédure dans `docs/mobile-faisabilite.md`) — demande une équipe de signature |
| Certificats, profils, signature | après création des comptes |
| Captures aux formats de vente | après décision sur iPad |
| Corrections de la politique (§5) | **indépendant des comptes, à faire avant** |
