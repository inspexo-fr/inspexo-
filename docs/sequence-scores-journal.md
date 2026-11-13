# Séquence des scores — journal (sprint 23, nov. 2026)

Décision d'Utku du 11 nov. 2026 : (b) → (c) → (c2) → (d), un seul changement
à la fois, chacun suivi des 4 références × 3 (`--plafond-session 7`).
Arrêt si une couleur change, si un score bouge de plus de 3 points hors écart
annoncé, ou si le cumul de tests atteint 7 €. Arrêt obligatoire avant (e) et (f).
Chaque déploiement est annoncé ICI avant d'être fait.

Point de départ (après a2, 11 nov.) : S7 rouge 39/35/39 · 308 orange 55 ·
Mercedes vert 71 · Clio II orange 51 · cumul tests 3,00 €.

## (b) merge de sprint22c — 11 nov. 2026
- Écart annoncé : **aucun** (sprint22c ne touche pas `score`).
- Déploiement annoncé : **aucun**. `admin-defect-sheets` tourne déjà en version
  22c. `sheet-builder` tourne en 22c + juge corrigé du sprint 23 : le
  redéployer depuis main ramènerait l'ancien juge (défaut des silences), il
  n'est donc PAS redéployé.
- Outillage : `--plafond-session` reporté de sprint23 dans `scripts/eval.mjs`.
- Résultat (b) : S7 rouge 39/39/39 · 308 orange 55/55/55 · Mercedes vert
  71/71/71 · Clio II orange 51/51/51 — inchangés. 1,046 € · cumul 4,04 €.

## (c) sprint22d, signaux d'entretien déterministes — 11 nov. 2026
- Écart annoncé (barème rejoué hors ligne sur les faits des dossiers de (b),
  signaux remplacés par ceux des motifs fixes) : S7 39 · 308 55 ·
  **Mercedes 71 → 73** (aucun signal écrit, garantie exclue ⇒ axe entretien
  non évalué) · Clio II 51.
- `BAREME_VERSION` : 22d portait « 11.10 », déjà pris par (a2) et servi depuis
  ce matin. Renuméroté **11.11** (11.10-22d n'a jamais été servi).
- Déploiement annoncé : `score` + fonctions qui importent `bareme.ts`
  (`api-analyses`, `lecture-ct`, `lecture-histovec`, `visite`), liste à
  confirmer par `scripts/fonctions-a-redeployer.mjs`.
- Résultat (c) : S7 39/39/39 · 308 55/55/55 · **Mercedes 73/73/73** (écart
  annoncé, tenu) · Clio II 51/51/51. 1,005 € · cumul 5,05 €.

## (c2) une opération n'est « non faite » que si l'annonce l'écrit — 11 nov. 2026
- Règle : `operations_non_faites` ne vient plus que du filet déterministe
  (`detecterEntretienDeclare`). Ce que le modèle y ajoute devient une question
  au vendeur, sans effet sur la note. `BAREME_VERSION` → 11.12.
- Écart annoncé (filet rejoué sur les 4 textes) : aucun. S7 0 opération (le
  « 35 » occasionnel, venu d'une absence d'information rangée par le modèle
  en opération non faite, disparaît) · 308 1 (« Distribution jamais faite ») ·
  Mercedes 0 · Clio II 1 (distribution). Attendu : 39 · 55 · 73 · 51.
- Déploiement annoncé : `score` + `api-analyses`, `lecture-ct`,
  `lecture-histovec`, `visite` (version du barème).
- ⚠️ Budget : après (c2) le cumul sera ≈ 6,10 €. Un run de (d) (≈ 1,05 €)
  dépasserait 7 € : arrêt prévu AVANT l'éval de (d).
- Résultat (c2) : S7 39/39/39 · 308 55/55/55 · Mercedes 73/73/73 · Clio II
  51/51/51 — conformes. 1,012 € · cumul 6,06 €.

## ARRÊT avant (d) — 11 nov. 2026
Un run de (d) (≈ 1,05 €) porterait le cumul à ≈ 7,10 €, au-delà du plafond de
7 €. Rien n'a été codé ni déployé pour (d). Décision d'Utku attendue.

## (d) nouveaux hôtes dans `rangSource` — 11 nov. 2026
Plafond de tests porté à 10 € pour toute la séquence (décision d'Utku).
- Règles : ~40 hôtes de `docs/sources-moteurs-2026-11.json` déclarés —
  presse (6), consommateurs au rang presse (3 nouveaux), officiel (13),
  constructeurs d'un autre pays (15) en « officiel » mais repérés par
  `estConstructeurEtranger` : information de contexte, jamais une couverture
  (la couverture ne lit aucune source — verrouillé par test).
  `BAREME_VERSION` → 11.13.
- Effet mesuré hors ligne (export lecture seule de `defect_sheets`, 44 fiches) :
  **0 panne de fiche ne change** (54/219 portées avant et après) — les hôtes
  ajoutés n'y sont pas encore cités, ils viennent avec la fusion (f).
  Atlas : **1 entrée** devient portée (Renault 1.2 TCe H5Ft, question écrite
  de l'Assemblée nationale) — aucune référence concernée.
- Écart annoncé : **aucun** sur les 4 références (39 · 55 · 73 · 51).
- Déploiement annoncé : `score`, `alertes`, `comparer`, `cout-3ans`,
  `admin-defect-sheets` (importent `atlasSource.ts`) + `api-analyses`,
  `lecture-ct`, `lecture-histovec`, `visite` (version du barème).
  ⚠️ PAS `sheet-builder` ni `atlas-builder` : ils tournent avec le juge corrigé
  du sprint 23 ; les redéployer depuis main le ramènerait en arrière. Ils
  gardent l'ancienne liste d'hôtes (plus conservatrice) jusqu'au merge de
  sprint23.
- Résultat (d) : S7 39/39/39 · 308 55/55/55 · Mercedes 73/73/73 · Clio II
  51/51/51 — conformes (aucun écart). 1,017 € · cumul 7,08 € / 10 €.

## ARRÊT OBLIGATOIRE avant (e) — 11 nov. 2026
Rapport complet remis à Utku ; (e) et (f) attendent sa validation.

## (e) préparation — 11 nov. 2026
- Merge de `sprint23` dans main (juge corrigé, outillage, journaux ; aucun
  fichier du chemin de notation). Chaîne hors ligne verte.
- Déploiement annoncé : **`sheet-builder` et `atlas-builder`** depuis main
  (nouvelle liste d'hôtes + juge corrigé). Rien d'autre.
- Fait : `sheet-builder` et `atlas-builder` déployés depuis main, **identiques
  à main** après téléchargement et comparaison. Écarts restants, sans effet :
  `score`/`alertes` (libellé `silences_juge` ajouté à `alerting.ts`, jamais
  émis par elles), `verification` (`jugeStable.ts` @874761f, aucune partie
  modifiée atteinte).
- Proposition des couvertures : `scripts/proposer-couvertures.mjs` →
  `docs/couvertures-proposees.md` (32 entrées sur 6 fiches, 37 écartées),
  envoyée à Utku pour relecture. RIEN n'est écrit avant son accord.
- Merge de `sprint23-multimarques` (le lien `node_modules` commité par erreur
  sur la branche a été retiré avant ; le premier essai de merge avait vidé une
  partie de `node_modules`, reconstruit par `npm ci`, exclusion iCloud
  intacte). Chaîne hors ligne verte, essai local 83/83 avec la migration.
- Annoncé : **dump prod** hors dépôt, puis **`db push`** de
  `20261126120000_sprint23_couverture` (colonne `couverture` = `[]` par
  défaut : aucun score ne change), puis déploiement de `score`,
  `admin-defect-sheets`, `sheet-builder` (code de couverture, INERTE tant
  qu'aucune couverture n'est écrite).
- Fait : dump prod (`~/inspexo-backups/*-avant-couverture-20261111-1952.sql`),
  migration `20261126120000` appliquée (1 seule en attente), `score`,
  `admin-defect-sheets`, `sheet-builder` déployés. Contrôle : 308 en un
  passage → **orange 55** (0,12 €, cumul 7,20 €).
- Session (e) prête : `scripts/session-jeton-e.sh` (écriture des couvertures
  relues, puis 4 références × 3). **Écart annoncé : aucun** — les couvertures
  n'étendent que des fiches Hyundai, Peugeot DV5/DV6, Renault H5FT et VW
  EA189 à d'autres marques ; aucune référence (Audi EA824, Peugeot EB2DTS,
  Mercedes OM654, Renault K9K) n'est concernée.
- (f) n'est PAS prêt : pas de script de fusion, l'API admin ne sait
  qu'ajouter des sources à des pannes existantes, bloc « prises en charge »
  non construit.

## (e) session de jeton — 11 nov. 2026
- Couvertures relues et validées par Utku (51 entrées, fenêtres de rappel
  comprises) écrites sur 10 fiches ; état d'avant dans
  `docs/couvertures-ecrites-journal.json` (`--restaurer`).
- Résultat : S7 39/39/39 · 308 55/55/55 · Mercedes 73/73/73 · Clio II
  51/51/51 — conformes à l'annonce (aucun écart). 1,040 € · cumul 8,24 € / 10 €.
- Jeton retiré de `.env.local` à la fin de la session.

## (f) préparé — 11 nov. 2026 (rien d'écrit, rien de déployé)
- `scripts/fusionner-sources.mjs` + règles pures `scripts/fusion-regles.mjs`
  (même organe principal ET même défaut ; douteux ⇒ nouvelle panne ; gravité
  établie par la source, jamais « casse » sans montant ; pas de panne bornée).
  Proposition : `docs/fusion-proposee.md` — 23 ajouts de sources, 2 nouvelles
  pannes, 116 prises en charge, 3 opérations d'entretien.
- **Écart annoncé sur les 4 références : aucun.** Hors références, 13 pannes
  deviennent portées et 2 entrent (moteurs DV5, DV6, DW10, EP6, EA189, H5FT,
  D4204T, N13, FOX) ⇒ `BAREME_VERSION` 11.14 à l'écriture.
- Code prêt, non déployé : `ajouter_pannes`, `ajouter_prises_en_charge`
  (admin-defect-sheets), colonne `prises_en_charge` (migration
  `20261127120000`, rejouée en local 83/83), bloc d'affichage sur `/a/:id`,
  test d'indépendance (section 5), tests `fusion-regles` et `prises-en-charge`.
- Session prête : `scripts/session-jeton-f.sh` (préalables listés en tête).

## (f) relecture d'Utku appliquée et préalables — 11 nov. 2026
- Décisions dans `docs/fusion-decisions.json` (lues par le script) : 3 lignes
  retirées (Mazda 1.4 = DV4 ; « usure de l'embrayage » ≠ bimasse ; Volvo
  « quelques diesels ») ; contrôle ajouté : une partie ou un extrait qui nomme
  une cylindrée absente de la fiche n'appuie pas cette fiche ; famille de
  `A-NISSAN-HR12DDT-01` corrigée en H5Ft ; AdBlue DV5 rattaché à la panne
  existante (pas de nouvelle panne).
- Rappel 21H7 : page auto-motor-und-sport (campagne mondiale, 76 098
  véhicules, production 2012-2017, KBA 011729, « 21H7 » écrit) soumise au
  juge : panne **soutenue 2/2**, campagne **soutenue 2/2** (0,047 €, budget du
  juge). RappelConso : aucune campagne française. La page remplace autodoc,
  le forum et la NHTSA ; libellé « campagne constructeur mondiale 21H7
  (production 2012–2017), éligibilité à vérifier par le VIN » ; poids
  inchangé. Action admin ciblée `modifier_rappel` (code vérifié littéralement
  sur la page).
- Proposition finale : 22 ajouts, 1 nouvelle panne (AdBlue DV6), 116 prises
  en charge, 3 opérations d'entretien, 1 rappel réécrit. **Écart annoncé sur
  les 4 références : aucun.**
- **Préalables annoncés (sans jeton)** : dump prod hors dépôt ; migration
  `20261127120000` (colonne `prises_en_charge`, `[]`) ; `BAREME_VERSION`
  11.14 ; déploiement de `admin-defect-sheets`, `score`, `sheet-builder`,
  `api-analyses`, `lecture-ct`, `lecture-histovec`, `visite`. Aucune donnée
  de fiche n'est écrite avant la session (f).
- Préalables FAITS : dump (`~/inspexo-backups/*-avant-fusion-20261111-2229.sql`),
  migration `20261127120000` appliquée (seule en attente), 7 fonctions
  déployées, `main` poussé. Contrôle : S7 un passage → **rouge 39** (0,147 €,
  cumul 8,38 € / 10 €). Session (f) : `bash scripts/session-jeton-f.sh`.

## (f) session de jeton — 11 nov. 2026
- Écrit : 18 sources distinctes sur 10 fiches (les 22 lignes proposées en
  comptaient 4 en double entre parties d'une même affirmation), 1 nouvelle
  panne (AdBlue DV6), 116 prises en charge sur 20 fiches, 3 opérations
  d'entretien (FOX, D4204T, K7M), rappel 21H7 réécrit sur l'EA824. État
  d'avant : `docs/fusion-ecrite-journal.json`.
- Résultat : S7 39/39/39 · 308 55/55/55 · Mercedes 73/73/73 · Clio II
  51/51/51 — conformes à l'annonce (aucun écart). La S7 affiche « campagne
  constructeur mondiale 21H7 (production 2012–2017), éligibilité à vérifier
  par le VIN », source unique auto-motor-und-sport, plafond conservé.
  1,010 € · cumul **9,39 € / 10 €**. Jeton retiré.
- Reste : étape atlas (condenseur 308 I, suspension BMW), séparée.

## Point 3 — rappels étrangers et hors période (12 nov. 2026)
Décision d'Utku, règle générale. Module PUR `_shared/rappelsApplicables.ts`,
appliqué au catalogue dans `score` AVANT le prompt et le barème :
1. rappel dont TOUTES les sources sont d'un pays connu autre que la France
   (hors campagne `mondiale` confirmée) ⇒ information de contexte : champs de
   rappel vidés, jamais `rappel_officiel`, jamais de poids, jamais dans les
   raisons ; un titre « Rappel officiel : … » perd ce préfixe. Pays inconnu ⇒
   pas de requalification ;
2. millésimes ou période ÉCRITS excluant l'année du véhicule ⇒ rappel non
   affiché (champs de la fiche : début strict, fin + 1 ; millésimes écrits
   dans le texte : bornes strictes).
- `BAREME_VERSION` **11.15**, ligne CUA, `tests/rappels-applicables.test.mjs`
  (43 contrôles, chaîné dans `npm run eval`).
- Inventaire des 8 rappels de fiche : 21H7 (EA824, DE, mondiale) reste ;
  **20U6/L8** (EA824, Consumer Reports US, millésimes 2013-2014) ⇒ masqué sur
  la S7 2015 ; **61DT02** (G3LC, enginescope.gr) ⇒ contexte ; KGH (EB2,
  production 2017-2018) ⇒ masqué sur la 308 2016 (il ne pesait déjà pas) ;
  MXX, 0D9F, NSC (B47 : une source .fr), JMK (DV6 : peugeotforums.com, pays
  inconnu) ⇒ inchangés.
- **Écart annoncé : aucun changement de score.** S7 rouge 39 (20U6/L8 ne
  pesait pas au-delà du plafond, rejoué hors ligne), 308 orange 55, Mercedes
  vert 73, Clio II orange 51. Ce qui change à l'écran : 20U6/L8 disparaît du
  dossier S7, KGH du dossier 308.
- **Déploiement annoncé** (avant d'être fait) : `score`, `admin-defect-sheets`
  (action `qualifier_rappel`), `sheet-builder` (`rappel_portee` « etranger »
  conservé), `api-analyses`, `lecture-ct`, `lecture-histovec`, `visite`
  (numéro de barème) ; puis `main` poussé (affichage `/a/:id` et `/moteur`).
- Session de jeton : `bash scripts/session-jeton-rappels.sh` — qualification
  « etranger » de 20U6/L8 et 61DT02 (la fonction re-vérifie la règle ; liste
  différente de celle relue ⇒ arrêt), puis 4 références × 3, plafond 12,50 €.

### Point 3 bis — seules les sources portantes décident (12 nov. 2026)
Décision d'Utku : un vendeur de pièces, un forum ou une compilation ne
compte pas dans le test du pays. Appliquée à la lettre, elle change le
traitement prévu pour deux rappels, et ce changement vient des données :
- **NSC R/2018/151 (B47)** : AUCUNE de ses 4 sources n'est portante
  (bimmergarage = vendeur, euroracingparts.fr et bimmer.ai = inconnus). Et
  « Royaume-Uni seulement » serait faux : le rappel EGR BMW de 2018 était
  européen (motor1 fr : ~23 500 voitures en France).
- **61DT02 (i20)** : seule source enginescope.gr (compilation) ; le rappel a
  touché la France (~8 000 selon letribunaldunet.fr, rang inconnu).
- **JMK (DV6)** : forum seul. Recherche faite : aucune page portante
  (caradisiac, quechoisir, fiches-auto) ne porte le code ni ne nomme ce
  rappel ⇒ rien à soumettre au juge (0 €).
- **0D9F (H4BT)** : carverif.fr seul (rang vendeur) — trouvé par la règle.
⇒ Règle 3 ajoutée à `_shared/rappelsApplicables.ts` : aucune source portante
⇒ pas un rappel affiché, question « Les rappels constructeur ont-ils été
faits ? À vérifier avec le numéro de série (VIN) ». Session : 20U6/L8 →
contexte ; JMK, NSC, 61DT02, 0D9F → champs de rappel retirés (action
`retirer_rappel`, qui refuse si la panne cite une source portante).
- **Écart annoncé inchangé** : aucun score ne bouge sur les 4 références
  (21H7, 20U6/L8 et KGH ont des sources portantes ; OM654 et K9K n'ont aucun
  rappel). Une question au vendeur ne pèse jamais sur la note.
- **Déploiement annoncé** : `score`, `admin-defect-sheets` ; `main` poussé.

## Point 3 — session de jeton (12 nov. 2026)
- Juge (avant la session, 0,056 €) : fr.motor1.com (NSC) **non soutenue** —
  page illisible pour le lecteur ; autohaus.de (61DT02) **non soutenue** —
  confirme le rappel i20 2015-2020 mais une durite mal posée, pas fissurée,
  sans nommer le G3LC (et rang inconnu). Les deux restent en question VIN.
- Écrit : 20U6/L8 → contexte (US) ; 0D9F, JMK, 61DT02, NSC R/2018/151 →
  champs de rappel retirés. État d'avant : `docs/rappels-qualifies-journal.json`.
- Résultat : S7 39/39/39 · 308 55/55/55 · Mercedes 73/73/73 · Clio II
  51/51/51 — conformes à l'annonce (aucun écart). 1,002 € · cumul **10,40 € /
  12,50 €** (+ 0,056 € de juge hors compteur d'éval). Jeton retiré.
- S7 de la session `54e2dc3c` (rouge 39) : 20U6/L8 absent, KGH absent, 21H7
  en campagne mondiale, sources toutes de rang presse ⇒ **épinglée sur
  l'accueil**, aperçu de partage régénéré (`apercus/54e2dc3c….png`).

## Sprint 23, lot 2 — sécurité de la transaction et pièces du vendeur (12 nov. 2026)
- **Signaux d'arnaque** (`_shared/securiteTransaction.ts`) : motifs fixes,
  chacun cité, **sans effet sur le score** (décision d'Utku). Blocs gratuits
  « Le jour J » et « Comment payer » : liste de documents commune avec le kit
  (`src/data/jourJ.js`) ; paiement sourcé — entre particuliers pas de plafond
  d'espèces (art. L112-6 CMF) mais un écrit au-delà de 1 500 € (art. 1359
  C. civ., décret n° 80-533) ; 1 000 € face à un professionnel (L112-6,
  D112-3 CMF) ; service-public F10999 vérifié le 26/06/2026, F2403.
- **Pièces du vendeur** (`_shared/faitsVendeur.ts`, fonction `reponse-vendeur`,
  Pass) : justifiée seulement si même VIN (empreinte salée) ou même plaque,
  date passée et ≥ 1re immatriculation, km ≤ annonce, opération
  correspondante ; une incohérence ⇒ rien levé, signalée. Plafonds levables :
  48, 55, 65 — rien d'autre. **`BAREME_VERSION` 11.16** (calcul inchangé).
- **Écart annoncé : aucun** sur les 4 références (39 / 55 / 73 / 51) : sans
  pièce, les faits sont strictement identiques (prouvé hors ligne).
- **Déploiement annoncé** : `score`, `reponse-vendeur` (nouvelle),
  `api-analyses`, `lecture-ct`, `lecture-histovec`, `visite` (importent le
  barème). Aucune migration.
- **Dépense annoncée : 0,60 €, mur dur** — références ×1 (≈ 0,36 €, mur
  0,40 €) puis éval des pièces sur une facture fabriquée (≈ 0,15 €, mur 0,20 €).
- **Résultat (12 nov.)** : références ×1 **S7 rouge 39 · 308 orange 55 ·
  Mercedes vert 73 · Clio II orange 51** — aucun écart, conforme à l'annonce
  (0,370 € ; cumul compteur d'éval 10,77 € / 12,50 €). Pièces du vendeur
  (`tests/eval-facture/`, Clio IV fabriquée, 0,090 € hors compteur d'éval) :
  facture d'un autre véhicule ⇒ déclarée, incohérence signalée, rien levé ;
  réponse collée ⇒ 2 faits déclarés, score inchangé ; facture conforme ⇒
  justifiée par l'immatriculation, **plafond 55 levé, orange 55 → 60**.
  Dépense du lot : **0,460 € / 0,60 €**. Branche `sprint23-lot2`, non mergée.

## Sprint 23, lot 3 — mise en service annoncée (12 nov. 2026)
- **Aucune modification du score** (barème 11.16 inchangé, `score` redéployé
  seulement parce qu'il importe `notify.ts`) ⇒ **aucune éval payante prévue,
  0 € sur les 0,60 € autorisés.** Références attendues inchangées.
- **Migration** `20261128120000_sprint23_alertes_modele` (table
  `alertes_modele`, RLS sans policy, aucun droit public) — essai local :
  38 migrations depuis une base vide, 83/83.
- **Fonctions** : `alerte-modele`, `modele-public`, `prelecture` (nouvelles),
  `alertes` (dossiers « achetés », passage des alertes sans compte,
  RappelConso indisponible ≠ zéro rappel), et 15 fonctions qui importent
  `notify.ts` (dont `desinscription`, `pass-webhook`, `inspection-webhook`
  en `--no-verify-jwt`).
- Dump prod hors dépôt avant `db push`. Merge de `sprint23-lot3` : en attente
  du feu vert d'Utku.
- **Fait (12 nov., 23:40)** : dumps `~/inspexo-backups/*-avant-sprint23-lot3-20261112-233428.sql`,
  migration appliquée (seule en attente), 19 fonctions déployées
  (`verify_jwt` des trois sensibles conservé, vérifié). Surface : pré-lecture
  403 sans secret, alerte-modele 400 sur confirmation forgée, table
  `alertes_modele` 401 à anon, 48 pages modèle. Build : 107 pages
  pré-rendues. **Dépense : 0 €.** Merge en attente.

## Sprint 24 — compteurs remis à zéro (13 nov. 2026, décision d'Utku)
- Total de sprint tenu face à **25 €**. Cumuls avant remise à zéro :
  éval 10,77 € · couverture 13,21 € · plans 1,39 €.
- **Lot 1 annoncé** : 6 fiches (H5HT, K4M, SDE, FIREFLY, M282, D4FB) ≈ 1,80 €,
  mur 2,40 € ; plans EA824/EB2DTS/OM654 ≈ 1,26 €, mur 1,50 €, arrêt si aucun
  des 3 ne sort avec une échéance établie ; juge batterie BMW/MINI/Mercedes
  ≈ 0,15 €, mur 0,30 € ; 4 références × 1 ≈ 0,37 €, mur 0,45 €.
  **Total ≈ 3,60 €, mur 4,65 €.** Écart sur les références donné AVANT toute
  écriture de plan.
- **Lot 1, étape 1 (13 nov.)** : 6 familles tentées, **1 fiche créée (Fiat
  FIREFLY, 3 pannes, 1 entretien)**, 5 sous le seuil qualité de `sheet-builder`
  (H5HT, K4M, SDE, M282, D4FB : moins de 4 sources distinctes dont 2 nommant le
  moteur, ou aucune panne retenue — non enregistrées). **1,98 € / 2,40 €.**
- **Étape 3 (gratuite, pré-contrôle)** : pages officielles BMW (certificat PDF,
  page technologie) et Mercedes (certificat EQS, page utilitaires)
  INJOIGNABLES depuis nos fonctions ; pages MINI joignables mais sans la durée
  ni le kilométrage dans le texte lisible ⇒ rien à soumettre au juge, 0 €.
- **Lot 1, étape 2 (plans)** : 0 moteur sur 3 avec une échéance établie —
  RÈGLE D'ARRÊT (EB2DTS : PDF hébergé sur un forum ; OM654 : vendeurs et sites
  non identifiés ; EA824 : aucune proposition). Rien d'écrit. **0,762 €.**
  Références non rejouées (rien d'écrit ne les touche ; décision d'Utku).

## Sprint 24 — barème 11.17 : pannes d'une autre version (13 nov. 2026)
- Règle d'Utku : une panne qui nomme une cylindrée ou une puissance différente
  de celle du véhicule ne s'applique ni au score, ni au dossier, ni à la page
  modèle ; version inconnue ⇒ question au vendeur (`_shared/variantes.ts`).
- **Écart annoncé : aucun** sur les 4 références (mesuré sur leurs fiches et
  l'atlas : seules 4 entrées d'atlas sont touchées, déjà écartées par leur
  code moteur). Attendu S7 39, 308 55, Mercedes 73, Clio II 51.
- Pages Fiat 500 Hybrid et Panda Hybrid : retombent sous le seuil (2 pannes
  FIREFLY sur 3 d'une autre version) ⇒ non publiées.
- **Déploiement annoncé** : fonctions important `bareme.ts`, `variantes.ts`
  ou `modeles.ts`. **4 références × 1 : ≈ 0,37 €, mur 0,45 €.**
- **Fait** : 7 fonctions déployées ; **références S7 39 · 308 55 · Mercedes 73
  · Clio II 51, conformes à l'annonce (0,360 €)**. Pages Fiat 500 Hybrid et
  Panda Hybrid : 404 (sous le seuil). Total sprint : **3,10 € / 25 €**.
- **Essai plans « domaines constructeur » (décision d'Utku)** : EB2DTS seul,
  recherche limitée à peugeot.fr, citroen.fr, opel.fr (les seuls domaines
  Stellantis déjà classés « officiel » ; peugeot.com, stellantis.com,
  dsautomobiles.fr ne le sont pas). Déploiement annoncé : `sheet-builder`.
  **Mur 0,40 €.** Rien ne donne ⇒ arrêt des plans pour ce sprint.
- **Essai EB2DTS non joué, 0 €** : le mur RÉSERVE l'estimation prudente d'un
  moteur (0,42 €) > 0,40 € accordés. Décision demandée à Utku (mur 0,45 € ?).

## Sprint 24, lot 2 — facture à prévoir (13 nov. 2026)
- `_shared/factureAPrevoir.ts` (pur, hors score) branché sur `cout-3ans` :
  entretien dû (distribution d'abord), défauts portés dont le kilométrage
  tombe dans les 12 mois, prises en charge valables/expirées/à vérifier ;
  montant seulement si une source portante le cite ; phrase vendeur et
  justificatif par ligne. **Gratuite** (sort aussi sans Pass).
- Prises en charge du dossier filtrées (autre version, autre véhicule nommé) :
  affichage seul (cas réel : campagne « Qashqai 1 1.5 dCi 110 » sur la Clio II
  1.5 dCi 65).
- Alertes de fin de prise en charge (dossiers achetés) : table
  `alertes_fin_prise` (migration `20261129120000`, essai local 83/83),
  palier réservé avant envoi.
- **Dépense : 0 €** (aucun changement de score). Déploiement annoncé : migration,
  `cout-3ans`, `alertes`, `score` et les fonctions qui importent `notify.ts`.
- **Essai EB2DTS, domaines constructeur (mur 0,45 €)** : 0 échéance établie,
  0,212 € (catalogue PDF peugeot.fr illisible ; page courroie sans intervalle).
  **Plans d'entretien arrêtés pour le sprint.** Total sprint : 3,31 € / 85 €.

## Sprint 24 — Points signalés par des propriétaires (13 nov. 2026)
- Panne non portée citée par ≥ 3 SITES distincts (forums, garages ; sous-domaines
  confondus) ⇒ point « à contrôler » (quoi, quand, signe, nombre de sources),
  sans « panne connue » ni montant, mention fixe ; il remplace sa question.
- Mesuré sur les fiches en base : 153 non portées, 109 citent forums/garages,
  **10 passent le seuil de 3**.
- **Hors note** : `pannes_non_verifiables` inchangé (plafond identique). Écart
  annoncé : aucun. Déploiement : `score` (+ importeurs). **4 références × 1,
  ≈ 0,36 €, mur 0,45 €.**
- **Fait** : `score` déployé ; références S7 39 · 308 55 · Mercedes 73 ·
  Clio II 51, inchangées (0,366 €). Total sprint : **3,68 € / 85 €**.

## Sprint 24 — chantier SEO (13 nov. 2026, sans dépense IA)
- Seuil d'indexation (`_shared/indexation.ts`) : pannes portées + prises en
  charge datées propres ≥ 3, dont ≥ 1 panne portée ; sinon noindex et hors
  sitemap, page accessible. Règle des versions appliquée aux pages /moteur
  (FIREFLY). Vrai doublon EA288 Audi ⇒ canonique vers Volkswagen.
- Anti-doublon au pré-rendu (`scripts/seo.mjs`) : paires de pages modèle ≥ 0,80
  ⇒ noindex de la moins présente dans le parc, SANS canonique ; rang sourcé
  seulement (top 30 L'Argus 2023 : 8 rangs publiés), sinon contenu propre le
  plus riche.
- Pages /methode et /qui-sommes-nous ; BreadcrumbList partout ; FAQPage retiré
  des pages moteur ; build en échec si titre ou description en double.
- **Déploiement annoncé** : `moteur-public` (nouvelle), `modele-public`.
  Fenêtre avant merge : pages modèle sous le seuil accessibles sans noindex
  côté site en ligne, liées par aucune page et hors sitemap.
- **Fait (build local)** : 172 pages pré-rendues ; **indexables 73** (avant :
  108, toutes) ; 99 en noindex ou canonisées : sous le seuil, trop proches
  (anti-doublon), 1 vrai doublon (EA288 Audi). Aucun titre ni description en
  double. Sitemap : 73 URL. Rapport : `docs/seo-rapport-2026-11-13.json`.
- Core Web Vitals : mesure locale (serveur sans CDN) et références de prod ;
  la mesure fiable se fera en production après merge.
- **Merge `sprint24-suite` (d0cd47b), main = production vérifié.** CWV en
  production (téléphone simulé, médiane de 3) : accueil LCP 656 ms CLS 0,002 ;
  /moteur/renault-1-5-dci LCP 1 696 ms CLS 0 ; /methode LCP 516 ms ;
  /moteur LCP 588 ms ; **/modele/renault/clio-iv CLS 0,156 (régression :
  0,055 avant)** — long paragraphe d'en-tête qui perd une ligne au chargement
  de la police. Corrigé sur `sprint24-modeles` (en-tête court).

## Sprint 24 — pages modèle rendues propres au modèle (13 nov. 2026)
- Décision d'Utku : avant tout noindex, données propres au modèle, sans IA :
  moteurs montés et années, Crit'Air par plage d'années et ZFE qui
  l'interdisent, rappels RappelConso du modèle, prix observés du segment
  (`_shared/donneesModele.ts`, servis par `modele-public`).
- Paire encore ≥ 0,80 : la génération la plus récente reste indexée (année
  du moteur le plus récent) ; à année égale ou inconnue, les deux restent et
  la paire est signalée. Plus de classement par le parc.
- Déploiement annoncé : `modele-public`. Coût : 0 €.
- **Fait (build local)** : après enrichissement, paires ≥ 0,80 : **49 → 4**.
  508 I / 508 II : même modèle, la II reste indexée. Non départagées (modèles
  différents, mêmes moteurs, même année) : Sprinter/Vito, Classe C W204 /
  Classe E W212, Série 1 F20 / Série 3 F30 — laissées indexées et signalées.
  **Indexables : 101** (73 au premier passage, 108 avant le chantier).
  CLS /modele/renault/clio-iv : 0,156 → **0,017** (local, mêmes conditions).
  Rappels d'une autre génération écartés (« clio 5 » sur la page Clio IV).
- **Déploiement Vercel de 9c5ced6 en échec** (13 nov., 11:09 UTC) : pré-rendu
  de l'accueil en délai dépassé (20 s, première page après le démarrage du
  navigateur) ; garde-fou du build ⇒ arrêt, production restée sur d0cd47b.
  Relance du même commit annoncée.
- **Relance réussie** (Ready en 7 min) : l'échec était passager. En production :
  CLS /modele/renault/clio-iv **0,017** (médiane de 3 ; 0,156 avant), LCP 608 ms ;
  sitemap 101 URL.

## Sprint 24, chantier A — fiches depuis les parties confirmées (13 nov. 2026)
- Méthode validée : aucune recherche web ; le modèle ne reçoit que les parties
  déclarées « soutenue » par le juge sur une source portante (officiel, presse,
  éditorial), avec leurs extraits mot pour mot, et ne peut citer QUE ces URL
  (`restreindreSources`, appliquée avant le seuil de qualité). Plan et
  programmes vides. Une fiche existante n'est jamais remplacée.
- Lot 1 (7 moteurs) : Renault R9M, Fiat SDE, VW EA188, VW EA888, VW EA211
  (1.5 TSI seul), Renault K4M, Renault H5HT. Toyota 1AD/2AD écarté (pas de
  code de famille sûr pour la recherche par préfixe). H5HT n'a que 3 URL : le
  seuil de 4 sources le fera probablement échouer.
- Règle d'arrêt : moins de 5 fiches utiles (publiées ET indexables) sur le lot.
- Déploiement annoncé : `sheet-builder` (mode « parties », réservé au secret
  d'éval). Les autres fonctions qui importent `defectSheets.ts` (ajouts sans
  effet sur leur comportement) seront redéployées au merge.
- Budget du run : **0,60 €** (estimation 0,56 €), mur du chantier 45 €.
- **Résultat du lot 1** : 3 fiches utiles sur 7 (R9M 6 pannes portées,
  SDE 3, EA888 5 ; toutes publiées et indexables), 0,38 € / 0,60 €.
  EA188, EA211, K4M, H5HT : échec au seuil de qualité (4 sources distinctes
  dont 2 propres au moteur). **Règle d'arrêt atteinte (< 5) : le chantier A
  s'arrête.** R9M et EA888 ajoutées à la table (code attesté :
  en.wikipedia Renault R-Type, de.wikipedia VW EA888) ; SDE y était déjà.
- 4 références × 1 annoncées : mur **0,45 €**.
- **Références inchangées** : S7 rouge 39, 308 orange 55, Mercedes vert 73,
  Clio II orange 51 (0,357 €). Total du sprint : ≈ 4,42 € / 85 €.

## Sprint 24 — Toyota 1AD/2AD (13 nov. 2026, décision d'Utku)
- Codes complets déclarés dans la table : famille « AD », `codes`
  1AD-FTV / 2AD-FTV / 2AD-FHV (attestés : en.wikipedia « Toyota AD engine »).
  Le résolveur ramène un code proposé (ou son début, ≥ 3 caractères) à « AD »,
  pour Toyota seulement. Effet sur le score : seulement pour une Toyota dont
  l'identification lit l'un de ces codes (elle trouvera la fiche AD).
- Fiche par le mode « parties » (6 parties, 4 URL), même règle d'arrêt.
  Budget **0,10 €**. `sheet-builder` déjà en place ; `score` (résolveur) et
  les fonctions qui lisent la table seront redéployées au merge, puis 4
  références × 1 (mur 0,45 €).
- **Résultat AD** : fiche refusée au seuil de qualité (4 sources dont 2
  propres au moteur), 0,039 €. Règle d'arrêt : on s'arrête.
- ⚠️ **Entrée AD RETIRÉE de la table** : une famille identifiée SANS fiche
  sort l'axe risques du score (« non évalué ») au lieu du plafond 55 d'un
  moteur non identifié — une Avensis diesel sans code dans l'annonce aurait
  vu son score MONTER. Le mécanisme des codes déclarés (`codes`, résolveur)
  reste en place, testé sur une table d'essai ; l'entrée reviendra avec une
  fiche. Aucun effet sur le score tant qu'aucune entrée ne porte `codes`.

## Sprint 24 — session de jeton préparée (13 nov. 2026)
- FIREFLY : nom de table « 1.0 FireFly 70 » (70 ch lus sur la page source :
  500, Panda, Ypsilon hybrides) ; sans la puissance, la panne « T3 120 ch »
  restait une question et ne pouvait pas être retirée. Adresse
  /moteur/fiat-1-0-firefly → /moteur/fiat-1-0-firefly-70 (301).
  Nouvelle opération admin `retirer_autre_version` : le serveur désigne les
  pannes « exclue », simulation, `titres_attendus` exact sinon 409, pannes
  retirées rendues pour le retour arrière.
- 2ZR-FXE : source Caradisiac Auris 2 ajoutée à la consommation d'huile ;
  panne nouvelle « onduleur du système hybride (Prius 3) », 2 500-3 200 €
  (page relue en session). Les 3 rappels confirmés (faisceau C-HR/Prius 4,
  pompe Corolla 12, Lexus CT) visent des MODÈLES : pas de filtre par modèle
  dans une fiche moteur, ils pèseraient sur toute Toyota 1.8 hybride
  (plafond 48). Non rattachés.
- Déploiement annoncé : `admin-defect-sheets` (opération ajoutée). Script :
  `scripts/session-jeton-sprint24.mjs` (simulation par défaut, `--ecrire`).
  Après écriture : 4 références × 1, mur 0,45 €.
- Merge de `sprint24-toyota-ad` (feu vert d'Utku) : redéploiement annoncé de
  `admin-defect-sheets`, `cout-3ans`, `modele-public`, `moteur-public`,
  `score` (table à 50 familles, FIREFLY 70, résolveur avec codes déclarés,
  sans effet sur le score). Puis panne onduleur soumise au juge avant écriture.
- Fait : merge b45546a, 5 fonctions déployées, main = production (aucun écart).
- Panne onduleur soumise au juge (`sources-externes`, mode « juger », même
  juge que /fiabilite) avec sa page Prius 3 : mur **0,10 €**. Non confirmée ⇒
  non écrite.
- **Juge** : onduleur Prius 3 « soutenue » 2 voix sur 2 (0,031 €).
- **Session de jeton faite** (sauvegarde `~/inspexo-backups/fiches-session-sprint24-2026-11-13T17-50-04-554Z.json`) :
  FIREFLY — 2 pannes retirées (1.0 T3 120 ch, 1.3 T4 150 ch), 1 restante ;
  la fiche n'a plus les 3 pannes exigées pour une page : /moteur FIREFLY
  n'est plus publiée (elle était déjà hors index). 2ZR-FXE — source Auris 2
  ajoutée, panne onduleur ajoutée : 7 pannes, 2 portées, toujours non
  indexable (seuil 3). Jeton retiré de `.env.local`.
- **Références inchangées** : S7 rouge 39, 308 orange 55, Mercedes vert 73,
  Clio II orange 51 (0,366 €). Sprint ≈ 4,86 € / 85 €.
- **Redirection FIREFLY corrigée** (décision d'Utku) : /moteur/fiat-1-0-firefly
  → **/moteur** (301), jamais une page absente. Garde-fou au build :
  `redirectionsVersAbsentes` (scripts/seo.mjs) — le pré-rendu ARRÊTE le build
  si une redirection interne de vercel.json mène vers une page qu'il n'a pas
  produite. Build local : 2 redirections vérifiées, 181 pages, sitemap 111 ;
  contre-épreuve : l'ancienne destination est bien refusée. Coût : 0 €.

## Sprint 24 — audit de cohérence (13 nov. 2026, branche `sprint24-audit`, NON déployée)
Règle vérifiée : une panne n'est affirmée que si une source portante la
confirme ; sinon question au vendeur ou point signalé par des propriétaires.
Écarts trouvés et corrigés sur la branche :
- **Raisons du dossier (et donc `motifs` de l'API)** : le modèle voyait les
  pannes non confirmées sans distinction ; 2 dossiers de référence sur 4 les
  affirmaient (Mercedes : injecteurs ; 308 : surconsommation d'huile).
  Correctif : entrées marquées dans le catalogue du modèle + retrait
  déterministe des raisons qui les affirment (`_shared/raisonsPortees.ts`).
- **Budget 12 mois** : poste 308 « surconsommation d'huile » (200-300 €) sur
  une panne non confirmée. Correctif : filtre par référence.
- **Pages /moteur** : toutes les pannes de la fiche présentées comme « pannes
  connues ». Correctif : `moteur-public` ne renvoie en `pannes` que les
  confirmées ; les autres en points des propriétaires (≥ 3 sites) ou en
  questions. Question « VIN pour consulter HistoVec » remplacée (un acheteur
  ne le peut pas).
- `api/og.js` : code mort qui aurait recopié les raisons dans l'aperçu, retiré.
Sans écart : /modele, API (`points`), négociation, message vendeur, visite et
checklist (contrôles formulés comme gestes), facture à prévoir, e-mails,
image de partage, pré-lecture, revendeur ; règle des versions et rappels
étrangers appliqués là où des pannes ou rappels sont affichés.
Effet sur le score : aucun sur le barème (raisons et budget n'y entrent pas) ;
la consigne ajoutée au modèle peut faire varier ses sorties ⇒ 4 références × 1
après déploiement (mur 0,45 €). Déploiement à annoncer avec le merge :
`score`, `moteur-public`.
- Feu vert d'Utku : merge de `sprint24-audit`, déploiement de `score` et
  `moteur-public`, main = production (statut Vercel compris), puis 4
  références × 1 (mur 0,45 €).
