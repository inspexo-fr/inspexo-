# Sprint 16 (préparé, NON lancé) — sourcer le Defect Atlas

État au 4 novembre 2026. Rien n'est lancé, rien n'est dépensé.

## Ce qu'il y a à sourcer : 30 entrées, 6 marques

| Marque | Entrées | Critiques | Majeures | Mineures |
|---|---:|---:|---:|---:|
| BMW | 5 | 2 | 3 | 0 |
| Audi | 5 | 3 | 2 | 0 |
| Mercedes-Benz | 5 | 2 | 3 | 0 |
| Peugeot | 5 | 1 | 3 | 1 |
| Renault | 5 | 2 | 2 | 1 |
| Volkswagen | 5 | 3 | 1 | 1 |
| **Total** | **30** | **13** | **14** | **3** |

**Zéro URL** dans tout le fichier. En revanche les 30 entrées portent toutes un
champ `models` et un champ `years` : la cible de chaque entrée est explicite,
ce qui rend la recherche de source nettement plus facile que pour une fiche
moteur générée de zéro.

L'en-tête du fichier dit que les défauts ont été « vérifiés auprès de
mécaniciens spécialistes et de forums techniques de référence », et une ligne
de commentaire annonce déjà : « Source à compléter si on veut ajouter une
référence forum/TSB ». La dette était donc connue dès l'écriture — elle n'a
jamais été payée.

## Avant de sourcer, une question à trancher : faut-il garder l'atlas ?

Les 6 marques de l'atlas sont **déjà couvertes par 29 des 48 familles moteur**
de `famillesMoteur.js`, et les fiches moteur sont sourcées **par construction**
(`sheet-builder` rejette toute panne sans URL).

Le cas de la courroie de la 308 est instructif : elle existe **dans les deux**
catalogues. La fiche EB2 la porte avec quatre pages ; l'atlas la porte sans
aucune, avec une gravité plus sévère. La déduplication amont garde la gravité
de l'atlas et les URLs de la fiche. Autrement dit, **l'apport réel de l'atlas
sur cette entrée était un jugement de gravité, pas une connaissance**.

Deux options :

**A. Sourcer les 30 entrées** (ci-dessous). On garde une couche « connaissance
de marque » qui dépasse la famille moteur : corrosion de caisse, équipement
(suspension pneumatique), électronique de génération — des choses qu'une fiche
indexée par moteur ne couvre pas.

**B. Retirer l'atlas et ne garder que les fiches.** Moins de code, plus aucune
affirmation non sourcée possible, zéro euro. On perd les défauts non liés au
moteur, qui sont précisément ceux qu'une fiche ne dira jamais.

Recommandation : **A, mais entrée par entrée**, avec retrait par défaut. Une
entrée qu'on ne sait pas sourcer n'avait pas sa place dès le départ.

## Méthode proposée

Réemploi de la machinerie de `sheet-builder`, qui fait déjà exactement ce
travail pour les familles moteur.

**Sources acceptables**, par ordre de force :
1. document officiel du constructeur ou base de rappels publique
   (RappelConso, NHTSA, RAPEX, note technique constructeur) ;
2. presse automobile reconnue ayant traité le défaut nommément ;
3. forum technique de la marque, **uniquement en appui** d'une des deux
   premières — jamais seul pour porter une entrée (même règle que le seuil
   qualité des fiches : une source générique ne porte jamais une panne seule) ;
4. référence de coût publiée (Vroomly, iDGarages) — **pour le coût seulement**,
   jamais pour attester l'existence du défaut.

**Règles, reprises de ce qui existe déjà et a déjà mordu :**
- **au moins une URL par entrée**, et le montant ou le code éventuel doit
  figurer **littéralement** sur la page citée (`montantPresent`,
  `verifierCodesRappel`) ;
- au moins une source **nommant le moteur, la caisse ou la génération** visée —
  sinon l'entrée tombe sous la règle « mauvais moteur » dès la première
  vérification ;
- **gravité jugée sur le REMÈDE** (`graviteRemede.ts`), jamais sur la
  conséquence redoutée. Les 13 entrées « CRITIQUE » de l'atlas sont à rejuger :
  le vocabulaire actuel (CRITIQUE / MAJEUR / MINEUR) n'est pas celui du
  barème (`securite` / `casse` / `majeure` / `mineure`) ;
- **aucune source trouvée ⇒ entrée RETIRÉE**, et c'est le défaut, pas l'échec.
  Une entrée retirée disparaît ; elle ne redevient pas une « question ».

**Vérification de la vérification** : chaque entrée nouvellement sourcée passe
par le dispositif du sprint 15 (`verification`) — le passage qui n'a pas vu la
génération. Une entrée dont la source est jugée `non_soutenue` ou
`mauvais_moteur` par ce second regard est retirée, sans discussion. C'est le
seul moyen d'éviter de refaire la même faute : se citer soi-même.

## Coût estimé

Référence mesurée : la campagne de couverture moteur a coûté **13,21 €** pour
~44 fiches, soit **≈ 0,30 € par fiche**. Une fiche porte plusieurs pannes et
déclenche jusqu'à trois recherches web ; une entrée d'atlas est **une seule
affirmation**, avec sa cible déjà écrite.

| Poste | Hypothèse | Coût |
|---|---|---:|
| Recherche et rédaction, 30 entrées | ≈ 0,20 €/entrée | **6,00 €** |
| Second passage sur les entrées sans résultat | ≈ 1/3 des entrées | **2,00 €** |
| Vérification indépendante des entrées sourcées | 0,029 €/analyse-équivalent | **≈ 0,50 €** |
| **Total** | | **≈ 8,50 €** |

Plafond à poser dans le script : **10 €**, compteur dédié, arrêt automatique —
même dispositif que `.eval-cout.json` et `.couverture-cout.json`.

## Ce que ça change à l'écran

Aujourd'hui, une entrée d'atlas n'apparaît plus comme une panne : elle devient
une question au vendeur et ne pèse pas sur le score (sprint 15.1). Après
sourcing, les entrées retenues **redeviennent des pannes affichées et
comptées** — mais seulement celles qui ont survécu. Le nombre d'affirmations
sans source publique, aujourd'hui de 55 %, devrait baisser mécaniquement ; il
sera lisible sur `/fiabilite` avant et après, ce qui donne une mesure du gain
plutôt qu'une impression.

## À décider par Utku avant lancement

1. Option A (sourcer) ou B (retirer l'atlas) ?
2. Plafond de dépense : 10 € proposé.
3. Les forums de marque restent-ils acceptables **en appui** ? (Ils sont la
   provenance revendiquée de l'atlas actuel.)
4. Que fait-on d'une entrée sourcée mais dont la gravité rejugée sur le remède
   descend de « critique » à « mineure » ? (Proposition : on la garde, avec sa
   nouvelle gravité — c'est l'information juste.)
