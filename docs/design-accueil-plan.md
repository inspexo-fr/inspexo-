# Chantier design — Accueil et lisibilité (plan, nov. 2026)

Branche `design-accueil`. **Aucun code de score ou d'analyse touché, aucune
dépendance nouvelle, aucune dépense.** On garde l'identité (papier, filets,
étiquettes, tampon) : on corrige, on ne refait pas. Pas de merge sans le feu
vert d'Utku. Captures « avant » : `captures-design/avant/` (gitignoré).

## a. Le bouton principal ne s'éteint jamais
- **Mesuré** (WCAG, texte `--on-signal` #0F1B2D sur `--signal`) :
  bouton actif **5,20:1** (clair, #FF4D00) et **5,53:1** (sombre, #FF5A14) —
  objectif 4,5:1 tenu, pour `.btn` (« Lancer l'analyse ») comme pour
  `.nav-cta` (« Analyser »), qui ont les mêmes couleurs. **Désactivé**
  (`opacity:.5`, champ vide) : **2,79:1** (clair) et **1,60:1** (sombre) —
  c'est lui qui a « l'air éteint ».
- Correctif : `AnalyseForm.jsx` ne pose plus `disabled` sur champ vide ;
  au clic, `preventDefault`, focus sur le champ et message sous le champ
  « Collez d'abord le texte de l'annonce » (`role="alert"`, lié par
  `aria-describedby`). Le dépassement de 6 000 caractères garde son propre
  message. `.btn:disabled` reste pour l'envoi en cours, avec un libellé
  « Analyse en cours… » plutôt qu'une opacité.

## b. L'extrait du dossier réel dès le premier écran
- **Même source de données** que la section « Un dossier réel »
  (`DossierApercu`, analyse épinglée `DOSSIER_EXEMPLE_ID`, `get_public_analysis`
  avec `p_track=false`) : le chargement est factorisé dans un hook partagé,
  l'extrait n'affiche que ce que la page du dossier affiche (ligne véhicule,
  tampon, deux motifs avec leur appel de note et la note de source). Rien en
  dur ; tout est cliquable vers `/#dossier`.
- Ordinateur 1440×900 : titre ramené de 4 à 3 lignes (taille réduite d'un cran),
  extrait sous le sous-titre, les quatre lignes Prix / Durée / Sources / Lien
  avec les vendeurs sous l'extrait. **Deux mises en page en capture** :
  - **A — « fiche »** : extrait compact (ligne véhicule et tampon côte à côte,
    deux motifs en liste numérotée, notes de source en bas en petit) ;
  - **B — « coin de dossier »** : l'en-tête « Dossier n° IX-… » et le tampon
    en surimpression, comme une feuille posée, deux motifs en dessous.
- ⚠️ **À trancher avant** : le dossier épinglé (S7 du 28 oct.) cite encore
  **autodoc.co.uk et le forum rs246** en notes [1] et [2] — l'analyse a été
  produite avant la fusion (f), qui ne réécrit pas les analyses passées. Les
  mettre en avant sur le premier écran contredirait la règle « une panne n'est
  affirmée que si une source indépendante la porte ». Proposition : épingler
  une S7 rejouée après (f) (source auto-motor-und-sport, 21H7 en campagne
  mondiale), par exemple `13391145-c15c-4308-b0b5-a750255528d9`.
- Retirer de l'accueil l'emplacement vide « Photo à venir · shooting
  atelier » (aucune image de banque ni générée) : remplacé par un élément du
  produit ou supprimé.

## c. Téléphone 390×844 : le champ visible sans défiler
Ordre : étiquette, titre, sous-titre **réduit à une phrase** (la version longue
reste sur ordinateur, par une classe responsive, pas deux textes divergents),
formulaire, extrait du dossier, puis les quatre lignes. Aujourd'hui le
formulaire commence sous les quatre lignes et le bandeau cookies le cache.

## d. Capitales à chasse fixe — audit (fait, rien corrigé)
`scripts/audit-chasse-fixe.mjs` sur le build local : **61 pages, 888
occurrences, 653 textes distincts** de plus de 28 caractères en Martian Mono.
Détail complet : `docs/design-audit-chasse-fixe.json`. Par motif :

| Motif | Textes | Pages | Proposition |
|---|---|---|---|
| Sources numérotées `[n] hôte — titre` | 321 | 45 | police de texte, taille réduite ; l'appel `[n]` et l'hôte restent en chasse fixe |
| Titres de pannes `01 · …` (dt, MAJ) | 164 | 41 | numéro `01` en chasse fixe, titre en police de texte |
| Notes et mentions en phrase (`p.mono`, formnote, doc-foot…) | ~75 | 50 | police de texte, minuscules |
| Durées / kilométrages (`span.tag`, MAJ) | 47 | 31 | police de texte ; étiquette ≤ 3 mots seulement si courte |
| Sur-titres (`eyebrow`, MAJ) de plus de 3 mots | 7 | 6 | raccourcir à ≤ 3 mots, ou police de texte |
| Étiquettes de champ (`lbl`, MAJ) — dont « Annonces comparables · facultatif — affine l'avis sur le prix » | 2 | 2 | étiquette « Annonces comparables » en capitales, le reste en police de texte |
| Pied de page global (2 phrases) | 2 | 61 | police de texte |
| Prix, état, liens isolés (`price`, `state`, `a`) | 4 | 4 | au cas par cas |
| Blocs de code `pre` et listes `dt` d'erreurs (/pro/api) | 8 | 1 | **exception** : du code et des codes d'erreur restent en chasse fixe |

Correction **par classe CSS** (une règle corrige toutes les pages), pas page par page.

## e. Bandeau cookies
Bandeau compact : une ligne sur ordinateur, **deux au plus** sur téléphone
(bouton à droite du texte), et une **marge réservée en bas de page**
(`padding-bottom` du `body` égale à la hauteur du bandeau tant qu'il est
affiché) pour qu'aucun bouton ni champ ne passe dessous. Texte légal inchangé.

## f. Diagnostic sans JavaScript (rapport, rien corrigé)
Relevé sur la production le 11 nov. 2026, navigateur, Googlebot,
facebookexternalhit et WhatsApp : **même réponse de 6 185 octets**.
- `<title>` présent (« Inspexo — L'annonce dit ce que le vendeur veut. On lit le reste. »).
- **Aucun `h1`, aucun lien, aucun texte** hors « Vous devez activer JavaScript
  pour utiliser Inspexo. » (52 caractères).
- **Aucune** `meta description`, **aucun** `og:title` / `og:description` /
  `og:image`, aucune `link rel="canonical"` (seuls `og:locale`,
  `og:site_name`, `twitter:card`).
- Cause : l'accueil n'est **volontairement pas pré-rendu** (sprint 6 : le FCP
  passait de 1,4 s à 3,2 s), et `index.html` n'a pas de métadonnées propres.
- Effets : **Google** rend le JavaScript, donc indexe le contenu, mais n'a pas
  de description à afficher (il en fabriquera une) ; **les aperçus de partage**
  (Facebook, WhatsApp, LinkedIn, iMessage n'exécutent pas le JavaScript)
  n'affichent qu'un titre, **sans image ni description** ; un lecteur sans
  JavaScript ne reçoit rien.
- Pistes (à décider, non faites) : métadonnées statiques dans
  `public/index.html` (description, og:*, image statique existante, canonical)
  — sans effet sur le FCP ; contenu `noscript` minimal (h1, sous-titre, liens
  vers /score, /moteur, /airbags-takata) ; pré-rendu de l'accueil réévalué
  séparément.

## Livrable et vérifications
Captures avant/après 1440×900 et 390×844 (accueil, dossier réel) ;
`npm run eval` hors ligne et build verts ; pré-rendu intact (57 pages) ;
`ios/` et `android/` inchangés (`git diff --stat` vide sur ces dossiers) ;
contrastes recalculés ; audit de la chasse fixe rejoué après correction.
