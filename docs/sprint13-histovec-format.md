# HistoVec — note de format (lecture du code source officiel)

**Source** : `github.com/histovec/histovec-beta`, cloné hors du dépôt Inspexo.
**Dernier commit de `main` : `4b5e237`, le 5 octobre 2023** — « feat: maj du logo
du ministere (#1526) ».

> ⚠️ **Le code public a plus de trois ans.** Le service tourne en production
> depuis, et rien ne garantit que le rendu actuel corresponde. Tout ce qui suit
> doit être **confirmé sur un rapport réel récent** avant mise en ligne — ce qui
> est déjà la condition posée (drapeau éteint par défaut). Le dépôt porte aussi
> le nom « beta » : il peut exister un dépôt successeur non public.

---

## 1. LE POINT CENTRAL : deux artefacts différents, et un seul est un PDF

Le bouton que voit le vendeur s'appelle **« Imprimer le CSA »**, pas « imprimer
le rapport ». Il appelle `generateCsa()` et produit un PDF dont le titre interne
est **« Certificat de situation administrative détaillé »**.

Le **rapport HistoVec** proprement dit est une **page web à onglets**
(`RapportPage.vue`), partagée par un **lien** (bouton « Envoyer le rapport ») :

| Onglet | Toujours présent ? |
|---|---|
| Synthèse, Véhicule, Titulaire et Titre, Situation administrative, Historique | oui |
| **Contrôles techniques** | **non** — seulement si `donnee_disponible` ET historique non vide |
| **Kilométrage** | **non** — même condition |

Et il n'existe **aucune feuille de style `@media print`** dans tout le dépôt :
une impression navigateur du rapport ne rendrait que l'onglet actif, sans mise
en page d'impression.

### Conséquence : le PDF ne contient PAS le kilométrage

Contenu **exhaustif** du PDF CSA, vérifié dans `csaAsPdf/content.js` et dans
l'appel de `RapportPage.vue` :

- **Identification du véhicule** — `immatriculation du véhicule :`,
  `Date de première immatriculation du véhicule :`,
  `Numéro VIN du véhicule (ou numéro de série) :`, `Marque :`
- **Historique du véhicule** — des lignes `JJ/MM/AAAA <CODE>` construites par
  `historique.map(item => \`${item.date} ${item.nature}\`)` : ce sont les
  **opérations d'immatriculation**, pas les contrôles techniques
- **Situation administrative du véhicule** — voir § 2
- date des données, date de validité, QR code, logos

**Absents du PDF** : contrôles techniques, kilométrage, nombre de titulaires,
**modèle** (`nom_commercial`) et **énergie**. Ces champs existent dans l'API et
s'affichent sur la page web, mais ne sont pas écrits dans le CSA.

---

## 2. Libellés littéraux du CSA (pour les règles fixes)

Section administrative, chaque entrée précédée d'une puce de titre :

```
Procédure de réparation contrôlée        → « oui » / « non »
Opposition véhicule économiquement irréparable   → « - Date de l'opposition :  JJ/MM/AAAA » ou ''
Opposition véhicule endommagé                    → idem
Opposition au transfert du certificat
  d'immatriculation (OTCI)                       → « - Date de l'opposition :  JJ/MM/AAAA » ou « Aucune »
Déclaration valant saisie                        → « - Nom de l'autorité… » + date, ou « Aucune »
Gage                                             → « - Nom du créancier :  X » + « Date du gage :  JJ/MM/AAAA », ou « Aucun »
```

Plus : vol du véhicule, vol du titre, perte, duplicata, suspensions
(« Non » si aucune), et `Le certificat demandé a été annulé.` si le CI est
annulé — dans ce cas **toute la section détaillée disparaît**.

Conventions à respecter dans l'extraction :

- **oui / non en minuscules** (`booleanLabel(..., { upperCase: false })`).
- Valeur inconnue : la chaîne littérale **`non disponible`** (`MISSING_VALUE`).
- Négatifs : **`Aucune`** (féminin) pour oppositions et saisies, **`Aucun`**
  (masculin) pour le gage, **`Non`** pour les suspensions. Trois formes
  différentes — une seule regex ne les attrapera pas.
- Dates : `toLocaleDateString('fr-FR')` → **`JJ/MM/AAAA`**, sans zéro garanti
  sur un chiffre selon la plateforme. Séparateur après le libellé : **deux
  espaces**.
- Mise en page **deux colonnes** (x = 45 et x = 295) : l'ordre d'extraction du
  texte suit l'ordre de dessin, pas la lecture visuelle. À vérifier sur un PDF
  réellement généré avant d'écrire des règles qui dépendent de l'ordre.

### ⚠️ Un piège documenté dans leur propre code

Pour une OVE, **le CSA écrit « Véhicule endommagé » là où le rapport web écrit
« Procédure de réparation contrôlée »**. Le commentaire du code dit que la DSR
a sciemment accepté cette divergence. Il faut donc reconnaître **les deux
formulations** pour le même fait, selon la provenance.

---

## 3. Modèle de données (fixtures anonymisées fournies)

`frontend/cypress/fixtures/*.json` — trois jeux, **déjà anonymisés**
(`numero_immatriculation_anonymisee: "CY-9**-RX"`, `vin_anonymise: "WVGZ********64552"`).

```
vehicule.certificat_immatriculation.date_premiere_immatriculation  "2009-05-13"
vehicule.certificat_immatriculation.caracteristiques_techniques.marque / nom_commercial / energie ("ES","GO"…)
vehicule.certificat_immatriculation.titulaire.particulier{nom_anonymise,…}   ← ou personne_morale
vehicule.etat.nombre_de_titulaires            1
vehicule.etat.vole                            false
vehicule.etat.procedures_ve{procedure_ve_en_cours, apte_a_circuler, nombre_de_procedures_ve, date_derniere_procedure_ve}
vehicule.historique[]{date, type}
vehicule.situation_administrative{declarations_valant_saisie, gages, opposition{oves,oveis,otcis,otcis_pv}, suspensions}
controles_techniques{donnee_disponible, historique[]{date, nature, nature_libelle, resultat, resultat_libelle, km}}
```

Contrôles techniques : `resultat: "A"` → `resultat_libelle: "Favorable"` ;
`nature: "VTP"` → libellé **variable d'un enregistrement à l'autre** dans la
même fixture (« Visite Technique Périodique » puis « Contrôle Technique
Périodique ») : s'appuyer sur le **code**, pas sur le libellé.

Opérations d'historique (`backend/src/constant/historique.js`) :
`IMMAT_NORMALE`, `IMMAT_NORMALE_PREM_VO`, **`CHANG_LOC`**, `CHANG_LOC_CVN`,
`CHANG_TIT_NORMAL`, `CHANG_TIT_NORMAL_CVN` — et, vus dans un échantillon :
`REIMMAT_ETRANGER`, `DECLARATION_CESSION`, `DECLARATION_ACHAT`, `DEC_VE`,
`PREM_RAP_VE`.

---

## 4. Faisabilité, règle par règle, depuis le PDF CSA seul

| Règle | Depuis le CSA ? |
|---|---|
| **0 — concordance** marque, date 1ʳᵉ immat, VIN, plaque | ✅ les quatre y sont |
| 0 — concordance **modèle et énergie** | ❌ absents du CSA |
| **1 — km incohérent** (CT) | ❌ **aucun kilométrage dans le CSA** |
| **2 — vol, gage, opposition** | ✅ complet |
| **3 — véhicule gravement endommagé** | ✅ « Procédure de réparation contrôlée » + OVE/OVEI ; « levée » se lit à l'absence d'opposition en cours |
| **4 — « première main » fausse** | ✅ **indirectement** : compter les opérations `CHANG_TIT_NORMAL*` et `IMMAT_NORMALE*` de l'historique (`TITULAIRE_CHANGE_OPERATIONS`) |
| **5 — ex-location / société** | ✅ **partiellement** : `CHANG_LOC` dans l'historique signale une location. Le caractère « personne morale » du titulaire, lui, n'est pas dans le CSA |
| **6 — rapport > 15 jours** | ✅ via la date de validité. ⚠️ la *date des données* est derrière un drapeau (`flags.showDataDate`) et peut être absente |

**Donc : une seule règle est réellement hors d'atteinte du PDF — celle du
kilométrage.** C'est aussi la plus utile des six.

---

## 5. Ce que je propose

**Fabriquer des PDF d'exemple avec le générateur officiel.** `csaAsPdf` est du
JavaScript pur reposant sur `pdf-lib@^1.17.1`, et les fixtures anonymisées sont
là : on peut produire des CSA **fidèles à l'octet** plutôt que de les imiter.
C'est le seul moyen d'écrire les règles sur du vrai, sans rapport réel. Les
sorties iraient dans `tests/histovec-fixtures/` (anonymisées par construction).

**Pour le kilométrage, trois voies, et il faut en choisir une :**

1. **Demander au vendeur le lien du rapport** en plus du CSA, et lire la page —
   mais cela voudrait dire récupérer une URL, ce que le projet s'interdit
   (« jamais de récupération automatique d'URL »).
2. **Demander une capture ou une impression de l'onglet « Kilométrage »**, lue
   par la voie IA prévue au point 2 de votre message, avec le contrôle
   « chaque valeur doit figurer littéralement dans le texte extrait ».
3. **Renoncer à la règle du kilométrage par HistoVec** et la laisser à la
   lecture du PV de contrôle technique (`lecture-ct`), qui la couvre déjà et
   pose le même plafond rouge via `compteur_contredit`.

Ma préférence : **3 pour commencer, 2 ensuite** si l'usage montre que les
vendeurs envoient volontiers la page. L'option 3 ne perd presque rien
(`lecture-ct` fait déjà ce travail) et évite d'introduire une lecture d'image
pour la règle la plus lourde de conséquences.

---

## 6. À confirmer sur un rapport réel récent

- Le vendeur envoie-t-il le **CSA PDF**, un **lien**, ou une impression ?
- Le CSA 2026 porte-t-il les mêmes libellés qu'en 2023 ?
- L'ordre d'extraction du texte dans la mise en page à deux colonnes.
- La date des données est-elle affichée (drapeau `showDataDate`) ?

---

## 7. Ce que l'extraction rend RÉELLEMENT (mesuré sur les fixtures générées)

Sept CSA produits avec le générateur officiel, puis extraits par `unpdf`
(1 page, 1 000 à 1 700 caractères, ~45 lignes). Quatre constats changent la
conception de l'analyseur — aucun n'était devinable depuis le code source seul.

**1. Dans l'identification, les libellés et les valeurs sont SÉPARÉS.** La mise
en page à deux colonnes donne les quatre libellés d'affilée, PUIS les quatre
valeurs dans le même ordre :

```
Numéro d'immatriculation du véhicule :
Date de première immatriculation du véhicule :
Numéro VIN du véhicule (ou numéro de série) :
Marque :
BB-456-BB
05/09/2018
VF1YYYYYYYYYYYYYY
RENAULT
```

Une règle « libellé : valeur sur la même ligne » ne trouverait **rien**.
L'appariement doit être **positionnel** : n libellés reconnus, puis n valeurs.

**2. Dans la section administrative, libellé et valeur alternent** — mais un
libellé peut **se replier sur deux lignes**, et une valeur aussi :

```
- Opposition au transfert du certificat
d'immatriculation (OTCI)
PV(s) en attente
- Date du PV : 22/01/2025
...
- Gage
- Nom du créancier : ORGANISME DE CREDIT
FIXTURE
```

**3. Les espaces doubles du code source n'arrivent PAS à l'extraction.**
`- Date du PV :  22/01/2025` (deux espaces à l'écriture) ressort avec **une
seule** espace. Toute comparaison doit normaliser les blancs — le § 2 de cette
note était trompeur sur ce point, il est corrigé ici.

**4. Six libellés de plus que ceux trouvés dans les littéraux de `content.js`** :
`- Immatriculation suspendue`, `- Immatriculation annulée`, `- Véhicule volé`,
`- Certificat d'immatriculation volé`, `- Certificat d'immatriculation perdu`,
`- Certificat d'immatriculation duplicata`. Et `- Immatriculation annulée` peut
n'avoir **aucune valeur** derrière lui. La liste des marqueurs attendus doit
donc venir des fixtures, pas d'une lecture du source.

Autre détail : la **date de validité ressort au format ISO** (`2026-11-16`) dans
le paragraphe d'en-tête, alors que la date des données est en français long
(« dimanche 1 novembre 2026 »). Deux formats dans le même document.
