# CGU/CGV — alignement sur les offres réellement vendues — PROPOSITION

> ⚠️ **RIEN N'EST APPLIQUÉ.** La page `/cgu` est inchangée, à l'exception du
> remplacement « expert » → « inspecteur » (titre protégé, L326-8 C. route).
> Ce document est une proposition à valider avant toute modification.
>
> ⚠️ **À FAIRE RELIRE PAR UN AVOCAT.** Les articles 7, 8 et 14 portent sur le
> remboursement et la rétractation d'un consommateur.

État au 3 novembre 2026.

---

## 1. Ce que les CGU/CGV décrivent, face à ce qui est vendu

| Offre décrite | Où | Prix annoncé | Réalité aujourd'hui |
|---|---|---|---|
| 3.1 Analyse IA gratuite — « 10 échanges », « 3 analyses par compte » | CGU art. 3.1 | gratuit | ❌ **Faux.** Le score est de **5 analyses / 24 h / IP, sans compte**. Ni échanges, ni quota par compte. |
| 3.2 Analyse IA complète | CGU art. 3.2 | 9,90 € | ❌ **Produit mort.** La fonction `ai-chat` répond **410** depuis le sprint 8 ; `ChatIA` et `FreeAnalysisModal` sont supprimés. Invendable, et pourtant décrit comme vendu. |
| 3.3 Visio Test Drive | CGU art. 3.3 | 59 € (part 40/19) | ⏸ **Liste d'attente.** Aucun parcours d'achat, aucune intégration Cal.com, `/expert` démonté. |
| 3.4 Inspection Physique | CGU art. 3.4 | 249 € (part 170/79) | ⏸ **Remplacée** par l'inspection à la demande du sprint 8, à un autre prix et un autre partage. |
| Pass achat | **CGV séparées** (`/cgv-pass`) | 29 € (19 € en précommande) | ✅ Vendu — mais **absent des CGU**, qui s'intitulent pourtant « CGU **et CGV** ». |
| Inspection à la demande | **nulle part** | 179 € (part inspecteur 107,40 €, 60 %) | ✅ Vendable — et **aucune condition de vente ne la couvre**. |

### Les deux écarts qui comptent

**L'inspection à 179 € se vend sans conditions de vente.** C'est le seul
service humain réellement commandable, celui qui engage un déplacement, un
tiers indépendant et un transfert d'argent — et le document censé en fixer les
termes décrit une « Inspection Physique » à 249 € avec un partage 170/79 et une
réservation de créneau qui n'existent pas. Manquent : la zone (Toulouse et
dép. 31), le créneau (sous 48 h), le délai de remise du rapport, les conditions
d'annulation, la part de l'inspecteur, et surtout **le consentement à la
conservation des photos** — l'exception assumée au principe « photos jamais
stockées », qui n'est écrite que dans la politique de confidentialité.

**Deux prix affichés pour des offres fermées.** 59 € et 249 € sont annoncés
dans un document contractuel alors qu'aucun des deux ne peut être acheté. Un
prix dans des CGV n'est pas une indication, c'est une offre.

---

## 2. Corrections proposées, article par article

### Article 1 — Définitions
- « **Mission** : prestation commandée (analyse IA, visio, inspection) » →
  retirer **visio**. Proposer : « (analyse d'annonce, Pass achat, inspection) ».
- Conserver la définition **« Inspecteur »** (déjà corrigée).

### Article 3 — Services et tarifs → à refaire
Proposition de structure, alignée sur ce qui est vendu :

- **3.1 Score d'annonce — gratuit.** 5 analyses par 24 h et par adresse IP,
  **sans compte**. Analyse automatique du texte de l'annonce et des photos
  fournies. Photos **jamais conservées**. Ne remplace pas un examen du
  véhicule.
- **3.2 Pass achat — 29 € TTC, 30 jours.** Renvoi **explicite** aux CGV du Pass
  (`/cgv-pass`), qui restent le document de référence pour ce produit. Dire
  lequel des deux prime en cas de divergence.
- **3.3 Inspection à la demande — 179 € TTC.** Zone de couverture (Toulouse et
  Haute-Garonne, dép. 31), créneau entre 2 et 48 h, inspection sur place par un
  inspecteur indépendant, rapport photo déposé dans le dossier de l'acheteur.
  **Part inspecteur : 107,40 € (60 %) / part plateforme : 71,60 €.**
  Hors zone ou service fermé : liste d'attente, **aucune commande possible**.
- **3.4 Offres en préparation — non commercialisées.** Visio et inspection
  distancielle : mention qu'elles sont en liste d'attente, **sans prix**. Un
  prix réintroduit le jour de l'ouverture.
- **Supprimer** l'actuel 3.2 (9,90 €) : le produit n'existe plus.

### Article 3 bis — Partenaires
✅ À jour (sprint 10). Rien à changer.

### Article 4 — Inscription et compte
Décrit un compte avec mot de passe. Il n'y en a aucun. Proposer trois régimes :
- score : **sans compte** ;
- Pass : compte **créé par le paiement**, accès par lien magique ;
- dossier d'achat : **lien magique** uniquement.
Retirer « maintenir la confidentialité de ses **identifiants de connexion** » —
il n'existe pas de mot de passe à protéger.

### Article 5 — Commande et paiement
- Retirer « le paiement doit être effectué avant la **réservation du créneau** »
  : ce parcours n'existe pas.
- Décrire le parcours réel de l'inspection : paiement → **acceptation par un
  inspecteur** → coordonnées du vendeur révélées à l'inspecteur → inspection →
  rapport → versement automatique à la remise du rapport.
- Conserver « aucun paiement direct entre le Client et l'inspecteur ».

### Article 6 — Déroulement des missions
- **6.1** score (automatique, immédiat) ; **6.2** Pass (fonctions ouvertes
  30 jours) ; **6.3** inspection (acceptation, déplacement, rapport).
- **Supprimer 6.2 Visio** (Google Meet non opérationnel).
- Ajouter dans 6.3 la **conservation des photos du rapport** et le
  **consentement horodaté** exigé avant tout dépôt.

### Article 7 — Garantie satisfaction 30 jours
- Rattachée nommément à « Visio Test Drive et Inspection Physique ». À
  rattacher à l'**inspection à la demande**.
- ⚠️ **Risque de contradiction** : les CGV du Pass promettent « remboursé sans
  condition sous 14 jours ». Dire lequel s'applique au Pass, une fois pour
  toutes — ici une garantie examinée « au cas par cas », là un remboursement
  « sans condition ». Les deux ne peuvent pas être vraies.

### Article 8 — Annulation et remboursement
- **8.1 (9,90 €)** : supprimer.
- **8.2 (59 €) / 8.3 (249 €)** : supprimer les prix morts.
- Écrire à la place : annulation de l'inspection **avant acceptation** par un
  inspecteur (remboursement intégral, rien n'est engagé) et **après
  acceptation** (un déplacement est réservé — barème à fixer).
- **8.4 Non-présentation de l'inspecteur** : conserver.
- Ajouter le cas **remboursement partiel** : le code distingue déjà
  `charge.refunded` d'un remboursement partiel ; les CGV doivent dire ce qu'un
  remboursement partiel change pour le rapport déjà remis.

### Article 10 — Responsabilité
- « limitée au montant de la prestation commandée » : pour le score **gratuit**,
  ce plafond vaut **zéro**. À confirmer — c'est peut-être voulu, mais il faut
  que ce soit un choix, pas un effet de bord d'une formule écrite pour des
  prestations payantes.

### Article 11 — Qualification des inspecteurs
- « Inspexo vérifie leurs qualifications » est vague. Dire ce qui est
  **réellement** vérifié (sprint 8) : SIRET, attestation **RC pro**, **charte
  d'indépendance signée**, compte Stripe Connect actif — et validation manuelle
  par Inspexo.
- Conserver « qualifié » et jamais « certifié ».

### Article 14 — Droit de rétractation
- « Pour les services Visio et Inspection, le droit de rétractation s'applique
  tant que le **créneau n'a pas été réservé** » : à réécrire sur le parcours
  réel (avant/après acceptation par un inspecteur).
- Aligner le Pass sur ses propres CGV : **L221-18** (14 jours) + **case de
  renonciation** L221-25/28 pour usage immédiat. L'article 14 actuel fait
  renoncer le Client par la seule validation de commande, ce qui est **plus
  faible** qu'une case dédiée et contredit `/cgv-pass`.

### Métadonnées de la page
- La description `<meta>` annonce « conditions de vente des services
  d'inspection automobile » : à élargir au Pass et au score.

---

## 3. Ordre de traitement suggéré

1. **Inspection 179 € (art. 3.3, 5, 6.3, 8, 14)** — c'est le seul service
   vendable sans conditions. Priorité.
2. **Retirer 9,90 € / 59 € / 249 €** — des prix affichés pour des offres
   fermées. Rapide, et c'est le risque le plus visible.
3. **Score : corriger le quota** (5/24 h/IP sans compte).
4. **Articuler CGU ↔ CGV du Pass** (art. 7 et 14, contradiction à trancher).
5. **Articles 4, 10, 11** — exactitude.

---

## 4. Décisions appliquées le 3 novembre 2026

Appliqué dans `src/pages/CGU.jsx` : articles 3.2/3.3/3.4 historiques **supprimés**
(9,90 € / 59 € / 249 €), 3.1 corrigé (**5 analyses / 24 h, sans compte**), Pass
et inspection renvoyés à leurs CGV propres, et l'article 7 réécrit en **une
règle par offre** — le « cas par cas » a disparu, le Pass garde son
« remboursé sans condition sous 14 jours ».

Au-delà de la liste explicite, j'ai dû toucher les articles **1, 5, 6, 8 et 14** :
ils ne décrivaient que les offres supprimées (art. 6.2 Visio, art. 8.1 à 8.3 qui
portaient les trois prix morts, art. 14 fondé sur une « réservation de créneau »
inexistante). Les laisser aurait rendu le document incohérent — pire que périmé.

Nouvelle page : **`/cgv-inspection`** (`src/pages/CGVInspection.jsx`), sur le
modèle de `/cgv-pass`. Une offre payante, un document — et c'est ce texte que
`inspection-checkout` estampillait déjà par `CGV_VERSION` sans qu'il existe.
Prix, zone, délai et médiateur sont **lus dans la configuration serveur**, jamais
recopiés : un prix en dur dans un contrat devient faux en silence.

---

## 5. ÉCARTS CODE ↔ TEXTE — COMBLÉS le 3 novembre 2026

Les quatre écarts bloquants du relevé précédent sont **implémentés**
(migration `20261109120000_sprint12_inspection_paiement.sql`). Le service
reste **fermé** (`MEDIATEUR_NOM` non posé) : rien n'est exposé avant les tests
Stripe en mode test.

| Écart | État | Où |
|---|---|---|
| Paiement encaissé à la commande | ✅ **Autorisation puis capture** | `capture_method: "manual"` dans `inspection-checkout` ; capture dans `inspecteur-mission` à la confirmation ; webhook adapté |
| Rien n'expirait | ✅ **48 h puis relâche** | `inspections_a_expirer` / `inspection_expirer` + passe 5 du cron `alertes` + `emailAutorisationExpiree` |
| Aucune annulation | ✅ **Barème complet** | `decisionAnnulation` (pur) ; RPC `inspection_annuler`, `inspection_constat_absence`, `inspection_arbitrer` ; fonction `inspection-annuler` ; `_shared/inspectionArgent.ts` |
| Pas de demande d'exécution | ✅ **Case obligatoire, horodatée** | `execution_immediate` exigé serveur ; `execution_immediate_le` + `cgv_version` en base ; texte exact vérifié par le test |
| Rapport non remis sous 24 h | ✅ **Alerte exploitant** | `inspections_rapport_en_retard` + passe 6 du cron, une alerte par inspection |
| `CGV_VERSION` périmée | ✅ **2026-11-03** | `inspection-checkout` |
| Durée de conservation des photos | ✅ **2 ans / 5 ans / 3 mois** | CGV art. 8, politique § 5 et § 6 ter bis, et **appliqué** par la passe 7 du cron |

### Décisions de conception à connaître

- **48 h et pas plus.** Une autorisation de carte en ligne ne tient que
  **7 jours**. La fenêtre de confirmation garde donc un facteur deux de marge,
  et le test `tests/inspection.test.mjs` **interdit** qu'elle s'en approche :
  une autorisation expirée chez Stripe rendrait une mission confirmable mais
  impayable, après qu'un inspecteur s'est engagé.
- **Le transfert part AVANT le remboursement** dans le cas « retenue ». Les
  fonds de la charge sont encore entiers, donc `source_transaction` ne peut pas
  manquer de disponible ; et un remboursement manqué est rattrapable depuis nos
  colonnes, alors qu'un transfert manqué laisse l'inspecteur impayé pour un
  déplacement réellement fait.
- **La photo de constat est déposée AVANT la transition d'état**, à l'inverse
  de la règle habituelle du projet. C'est délibéré : la preuve conditionne une
  somme prélevée sur l'acheteur. Un fichier orphelin en cas de conflit est le
  moindre mal face à une retenue sans justification.
- **Le webhook ne défait pas le barème.** Nos quatre chemins d'annulation
  passent la ligne en `annulee` avant d'appeler Stripe, et
  `remboursement_pilote` est le filet. Sans cette garde, un remboursement de
  139 € reprendrait une part des 40 € accordés à l'inspecteur.
- **Si la capture échoue après acceptation**, la mission retourne à
  l'attribution (`inspection_capture_echouee`) et l'exploitant est alerté :
  une mission ne peut pas rester « confirmée » sans argent encaissé.
- **Compte Connect incomplet au moment d'une retenue** : l'acheteur est
  remboursé **intégralement** et l'indemnité se régularise à la main. Mieux
  vaut une indemnité en retard qu'un acheteur bloqué.

### ⚠️ Bug trouvé par les tests, et corrigé

L'invariant monétaire sur 20 000 annulations a échoué sur **661 cas** : avec un
prix inférieur à 40 €, le remboursement devenait **négatif** — on aurait
redemandé de l'argent à l'acheteur pour avoir annulé. À 179 € le cas
n'arrivait pas, mais le prix est un paramètre. La retenue est désormais bornée
par le montant encaissé, **côté TypeScript et dans les deux RPC SQL**.

Autre défaut du même passage : le contrôle `if (ko > 0) process.exit(1)` de
`tests/inspection.test.mjs` se trouvait **avant** les nouveaux blocs, donc
leurs échecs n'auraient jamais fait échouer la suite. Déplacé en fin de
fichier, et vérifié qu'il mord.

### Reste à faire
- [ ] **Tests Stripe en mode test** (`sk_test`) : parcours complet
      autorisation → confirmation → capture, expiration à 48 h, les trois cas
      d'annulation, et l'arbitrage. Rien de cela n'est vérifiable hors ligne.
- [ ] Désigner le médiateur, poser `MEDIATEUR_NOM` — c'est lui qui ouvre la
      vente.
- [ ] Faire re-signer la charte (version **2026-11-03**) aux inspecteurs. Il
      n'y en a aucun aujourd'hui, donc aucun impact pour l'instant.
- [ ] Relecture avocat des CGV de l'inspection, en particulier les articles 6
      (barème) et 7 (rétractation).

---

## 6. Relecture juridique consommateur — 3 novembre 2026

Onze corrections demandées après relecture. Ce qui change dans le **code** est
dans la migration `20261110120000_sprint12_cgv_consommateur.sql`.

### Clauses retirées parce qu'abusives

- **Plafond de responsabilité** « limitée au prix payé » / « limitée au montant
  de la prestation commandée » : **clause noire** (art. **R212-1 6°** C. conso),
  irréfragablement abusive face à un consommateur. Retirée des **CGV de
  l'inspection (art. 10)** et des **CGU (art. 10)**. Les CGV du Pass n'en
  contenaient pas.
  - Ce qui reste : l'**obligation de moyens** et la **description de l'objet**
    (inspection visuelle et fonctionnelle, sans démontage, à un instant donné).
    Elles définissent l'étendue de l'obligation, elles ne la limitent pas.
- **Compétence « les tribunaux de Toulouse seuls compétents »** : renvoyée aux
  règles légales (art. **R631-3** C. conso) dans les CGV de l'inspection
  (art. 12) **et dans les CGU (art. 16)** — même clause, même défaut.
- **« Les conditions de l'article 6 ne lui sont pas opposables »** (rétractation)
  supprimée : elle créait deux régimes concurrents. Une seule règle désormais, et
  la retenue est présentée pour ce qu'elle est — le **montant proportionné au
  service déjà fourni** au sens de l'art. **L221-25**, pas une pénalité.

### Qualité d'Inspexo

Inspexo est le **vendeur** (art. 1) : il est donc **responsable de plein droit de
la bonne exécution** de l'inspection (art. **L221-15** C. conso), qu'elle soit
faite par lui ou par l'inspecteur qu'il missionne, **sans préjudice de son
recours** contre celui-ci. La mention « intermédiaire de mise en relation » est
retirée des CGV de l'inspection — elle contredisait l'article 1.

### Trois corrections qui touchent au code

1. **Heure de grâce** (`DELAI_GRACE_CONFIRMATION_HEURES`) — l'acheteur annule
   sans frais dans l'heure suivant la confirmation, quel que soit le créneau.
   ⚠️ Sans elle, un créneau choisi à +3 h rendait l'annulation payante **avant
   que l'acheteur ait pu lire l'email de confirmation**.
2. **Échéance de confirmation à DEUX bornes** (`echeanceConfirmation`) — 2 h
   avant le créneau **ou** 48 h après l'autorisation, le premier des deux.
   ⚠️ Avant correction, une mission restait confirmable **après l'heure du
   rendez-vous** : le créneau peut être à 2 h de la commande quand la
   confirmation a 48 h pour arriver.
3. **`confirmee_le`** : nouvelle colonne. `creneau_confirme` est le
   **rendez-vous**, pas l'instant de la confirmation — les confondre faisait
   démarrer la grâce au mauvais moment.

### Une promesse qui était fausse

Les CGV et la politique affirmaient que les photos du rapport étaient « la
**seule** situation » où Inspexo conserve des photographies. **Faux** : la photo
de constat d'absence est conservée aussi. Elle est désormais annoncée
(**1 an**, pour les litiges et contestations de paiement), purgée par le cron
(`inspections_preuves_a_purger`), et soumise à la même règle « aucune personne
reconnaissable ».

### Coordonnées du vendeur — base légale et art. 14 RGPD

Base légale déclarée : **intérêt légitime** (art. 6.1.f) — exécuter la
prestation commandée par l'acheteur. Comme ces données ne viennent **pas de la
personne concernée**, l'art. **14** impose de l'informer : l'inspecteur le fait
dès son premier contact et indique la politique de confidentialité. Nouvel
engagement **8** de la charte (texte identique client/serveur, vérifié par le
test).

### Promesses vérifiées dans le code (item 9)

| Promesse | Verdict |
|---|---|
| Pass : « analyses sans limitation de nombre » | ✅ **Vrai.** Le bloc de plafond ET le captcha sont dans `if (!isEval && !passActif && !isApi)` : un Pass n'a **aucun** plafond, pas même anti-abus |
| Pass : « kit signature » | ✅ RPC `get_kit_signature` + `KitSignaturePage` |
| Pass : « détail de la marge de négociation » | ✅ `negociationPublique` / `_negociation_publique` démasquent avec Pass |
| « Inspexo vérifie l'attestation RC pro avant de référencer » | ✅ **Vrai.** `admin-inspecteurs` refuse la validation sans attestation déposée ni échéance future. Reformulé en « exige et contrôle » |
| CGU art. 11 : « spécialisation sur des marques spécifiques » | ❌ **FAUX** — la table `inspecteurs` n'a **aucun champ marque**, seulement `departements`. Remplacé par « compétences vérifiées par Inspexo », avec la liste de ce qui est réellement contrôlé |
| CGU art. 2 : « inspecteurs spécialisés par marque » | ❌ **FAUX**, même cause. Corrigé en « inspecteurs indépendants » — l'item 9 ne visait que l'art. 11, mais la même affirmation s'y trouvait |

### Autres

- **Plateforme européenne de RLL supprimée** (règlement UE **2024/3228**) des
  CGV de l'inspection **et des CGV du Pass** — elle y figurait aussi.
- **Usage du rapport** (art. 2) : « destiné au seul Client, ni revendu ni
  publié, le Client reste libre de s'en servir pour négocier ».
- **CGU art. 14** aligné sur le texte actuel de **L221-28 1°** : « après accord
  préalable exprès du consommateur et renoncement exprès à son droit de
  rétractation ».
