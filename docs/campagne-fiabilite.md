# Campagne de fiabilité — ce qu'il faut collecter, et pourquoi

État au 5 novembre 2026. Décision d'Utku : **option C, mur à 7,00 €.**

## Pourquoi une collecte est nécessaire

`/fiabilite` ne publie rien sous **30 analyses vérifiées**. La base n'en contient
pas de quoi y arriver :

| | nombre |
|---|---|
| analyses en base | 655 |
| dont `is_eval = true` (éval et tests) | 639 |
| dont réelles | **16** |
| véhicules distincts parmi les réelles | **13** |
| … dont annonces devenues des fixtures d'éval | **4** |
| **annonces réelles ni éval ni doublon** | **9** |

⚠️ Le chiffre de « 505 analyses » qui circule dans le CLAUDE.md était le **total
du dump du 4 novembre, évals comprises**. Il n'a jamais désigné 505 annonces
réelles. C'est ce malentendu qui faisait croire la campagne possible à coût nul.

### Les 9 annonces réelles déjà en base

| # | véhicule | famille | énergie | photos |
|---|---|---|---|---|
| 1 | BMW 320d F30 2012 · 142 000 km · 11 900 € | N47 | diesel | 3, perdues |
| 2 | Audi S7 2015 · 89 000 km · 34 900 € dépôt-vente | EA824 | essence | — |
| 3 | Peugeot 308 PureTech 130 2017 | EB2DT | essence | — |
| 4 | Renault Clio IV dCi 90 Intens 2016 | K9K | diesel | — |
| 5 | Peugeot 308 PureTech 110 · 9 000 € | EB2 | essence | 3, perdues |
| 6 | Renault Clio IV dCi 90 2016 · 121 000 km · 8 990 € | K9K | diesel | — |
| 7 | Renault Clio IV dCi 90 Business 2017 · 9 490 € | K9K | diesel | — |
| 8 | Peugeot 308 PureTech 130 2020 · 78 500 km | EB2DT | essence | — |
| 9 | Peugeot 3008 Hybrid 136 e-DCS6 GT 2025 | aucune fiche | hybride | 6, perdues |

Les 4 annonces devenues fixtures (S7 159 000 km, A3 Sline+ 19 000 €, Classe C
41 490 €, 308 PureTech 110 2016) sont rejouées **en plus** : elles sont réelles,
et ce sont les textes des cas d'éval, donc leur résultat sert deux fois.

⚠️ **Les photos ne sont pas conservées** — c'est la règle du projet, pas un
oubli. Trois annonces seront donc rejouées en texte seul : le résultat sera
différent de celui d'origine, et il faut le dire au lieu de comparer les deux
comme si c'était la même analyse.

## Ce qui manque, et de quel type

**17 annonces** pour atteindre 30. Le manque n'est pas qu'un compte — la base ne
couvre que 4 marques, 5 familles moteur, et il n'y a **aucun électrique, aucun
GPL, rien avant 2012, rien entre 2021 et 2024**.

### ⚠️ La règle qui décide du coût : une fiche est indexée marque + famille

44 fiches moteur sont déjà en cache (campagne du sprint 6, valides 90 jours
depuis fin octobre). Une annonce qui tombe sur l'une d'elles **ne coûte aucune
génération**. Mais le cache est indexé par **marque ET famille** : les écritures
d'une même marque sont fusionnées (`expandBrand` : VW/Volkswagen,
Mercedes/Mercedes-Benz, Citroen/Citroën), **jamais deux marques différentes**.
Une Citroën C3 1.2 PureTech cherche « Citroën + EB2DT » et ne trouve rien, même
si « Peugeot + EB2DT » est en cache : **+ 0,30 €**. Même chose pour Skoda, Seat,
Opel, DS, Kia.

→ **Rester sur ces 14 marques garde la collecte à coût de fiche nul** : Audi,
BMW, Dacia, Fiat, Ford, Hyundai, Mercedes, Mini, Nissan, Peugeot, Renault,
Toyota, Volkswagen, Volvo.

### Le panier proposé — 17 annonces, fiches déjà en cache

Chaque ligne nomme des modèles dont la famille est **déjà en base**. Prends ce
qui se présente sur Leboncoin / La Centrale, l'ordre n'a pas d'importance.

| # | à chercher | famille en cache | ce que ça comble |
|---|---|---|---|
| 1 | Toyota Yaris ou Auris 1.33 essence (2007-2019) | 2ZR-FE | marque, essence atmosphérique, avant 2012 |
| 2 | Toyota Prius ou Auris HSD (2009-2022) | 2ZR-FXE | hybride avec fiche (le 3008 n'en a pas) |
| 3 | Dacia Sandero ou Logan 1.6 8V (2004-2014) | K7M | marque, avant 2012, bas de marché |
| 4 | Fiat 500 ou Panda 0.9 TwinAir (2010-2022) | TWINAIR | marque, petit essence turbo |
| 5 | Ford Fiesta ou Focus 1.0 EcoBoost (2017-2024) | DRAGON | marque, **2021-2024** |
| 6 | Ford Fiesta 1.6 Ti-VCT (2010-2017) | SIGMA | avant 2012 |
| 7 | Hyundai i10 1.0 (2015-2020) | G3LC | marque, citadine |
| 8 | Hyundai i30, Tucson ou Kona 1.4 T-GDI (2015-2023) | G4LD | **2021-2024** |
| 9 | Nissan Qashqai ou X-Trail 2.0 essence | MR20DE | marque, SUV essence |
| 10 | Nissan Juke 1.6 DIG-T (2010-2019) | MR16DDT | essence turbo |
| 11 | Volvo V40, V60 ou XC60 2.0 D (2012+) | D4204T | marque, premium diesel |
| 12 | Mini Cooper S R56 (2010-2016) | N18 | marque, avant 2012 |
| 13 | Mercedes Classe A ou B 180 CDI (2012-2018) | OM607 | diesel d'entrée de gamme |
| 14 | BMW 116i ou 316i 1.6 essence (2011-2015) | N13 | BMW **essence** (on n'a que du diesel) |
| 15 | BMW 320d ou 520d (2014-2021) | B47 | diesel récent |
| 16 | VW Golf VI 1.6 TDI (2008-2015) | EA189 | avant 2012, séquelles Dieselgate |
| 17 | Peugeot 208 ou 308 1.6 HDi (2004-2018) | DV6 | diesel le plus répandu du parc |

**Électrique : à ajouter, mais hors des 17.** Aucune famille électrique n'a de
fiche et l'atlas n'en porte aucune : une Zoe ou une e-208 produirait **0 panne,
donc 0 affirmation vérifiable**, et ne compterait pas dans les 30. C'est un
excellent test de robustesse (que fait l'analyse d'un véhicule dont elle ne sait
rien ?), ce n'est pas une mesure de fiabilité. Même remarque pour le
3008 Hybrid déjà en base : il a rendu 0 panne.

## Comment déposer les annonces

Un fichier `.txt` par annonce dans **`tests/fiabilite/annonces/`** (dossier
**gitignoré** — une annonce réelle porte parfois un numéro de téléphone, et le
projet ne versionne jamais ce genre de pièce : même règle que `tests/histovec/`
et les PV réels).

Deux façons, au choix :
- **l'extension ou l'appli** sur la page d'annonce, puis copier le texte importé
  depuis `/score` ;
- **copier-coller** le texte de l'annonce dans un fichier.

Nomme les fichiers librement (`01-toyota-yaris.txt`…) : le nom ne sert qu'aux
journaux.

## Le jeton admin — sans lui, la campagne ne compte pour rien

⚠️ `score` pose `is_eval = true` **dès que l'en-tête `x-eval-secret` est
présent**, et `get_fiabilite` joint sur `is_eval = false`. Une campagne lancée
par le chemin de l'éval dépenserait et **n'apparaîtrait jamais sur
`/fiabilite`**. Le chemin propre est celui du sprint 15 : `adminIllimite`, qui
lève le plafond de 5 analyses/24 h **sans** flaguer l'analyse.

1. va sur `/admin`, connecte-toi par lien magique (contact@inspexo.io) ;
2. console du navigateur :
   ```js
   JSON.parse(localStorage[Object.keys(localStorage).find(k => k.includes('auth-token'))]).access_token
   ```
3. colle la valeur dans `.env.local` sous `ADMIN_ACCESS_TOKEN=` (jamais commité).

Le jeton expire en une heure : si la campagne s'arrête sur un 401, il suffit de
le reprendre et de relancer — les analyses déjà faites ne sont pas refaites.

## Budget

Coûts **mesurés**, pas supposés (moyenne sur les analyses réelles de la base,
tarifs Sonnet 5 : 3 $/M entrée, 15 $/M sortie, 0,30 $/M lecture de cache) :

| poste | unité | nombre | total |
|---|---|---|---|
| analyse (texte seul) | 0,106 € | 30 | 3,18 € |
| vérification (1 appel par page citée, 1,3 à 4 pages) | ≈ 0,05 € | 30 | 1,50 € |
| fiches moteur à générer | 0,30 € | 0 attendu, 4 provisionnés | 1,20 € |
| **total attendu** | | | **≈ 5,9 €** |
| **mur du run** | | | **7,00 €** |

⚠️ Le **0,029 €/analyse** inscrit dans `scripts/verifier-analyses.mjs` est
**périmé depuis le sprint 16** : il avait été mesuré quand 55 % des affirmations
ne citaient aucune page. Le sourcing de l'atlas a fait passer les pages à lire
de 1,62 à 2-4 par analyse, donc le coût de vérification à ≈ 0,05 €. Le script
est corrigé en même temps que cette campagne.

## Ce qu'il faut savoir avant de lancer

- **Le mur réserve le coût du cas suivant** (`scripts/budget.mjs`) : il s'arrête
  avant de dépasser, pas après. À 7,00 €, s'arrêter veut dire « il reste N
  annonces non jouées », et c'est dit à l'écran.
- **Les deux analyses de moins de 7 jours** (308 du 4/11, 3008 du 5/11) seront
  resservies par le cache : coût nul, et c'est correct — elles ont déjà été
  produites par la version actuelle. Le script le signale (`cache: true`).
- **Effet de bord assumé** : une analyse `is_eval = false` alimente le relevé de
  prix agrégé comme n'importe quelle analyse d'un vrai acheteur. 30 prix réels
  entreront dans `marche_agregats`. C'est le comportement normal, pas une
  exception ouverte pour la campagne.
- **Le résultat peut être mauvais.** C'est le but : la page publie un taux
  d'erreur, pas un argument de vente. Un taux élevé se publie quand même, avec
  son intervalle de Wilson.
