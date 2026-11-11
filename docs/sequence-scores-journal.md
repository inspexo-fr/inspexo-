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
