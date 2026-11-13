# Conditions d'utilisation de l'API Inspexo — BROUILLON v0

> ⚠️ **BROUILLON — NON PUBLIÉ.** Les cinq points en suspens ont été tranchés
> par Utku le 3 novembre 2026. Les compléments du 3 novembre (restitution à un
> tiers, conservation de la preuve, conditions de publication des prix,
> responsabilité) sont intégrés ci-dessous. Le document reste non publié, de
> même que ses deux annexes.
>
> ⚠️ **À FAIRE RELIRE PAR UN AVOCAT AVANT LE PREMIER CONTRAT.** Ce texte est
> rédigé par un non-juriste ; l'article 7 (responsabilité) en particulier
> engage la société et doit être validé.
>
> 🔒 **BLOQUANT.** Le plancher de responsabilité de l'article 7.5 est un
> `[MONTANT À FIXER]` : il doit être arrêté avec l'avocat **et** l'assureur RC
> pro. Aucun contrat ne peut être signé tant qu'il ne l'est pas.

**Version** : 0 (brouillon du 3 novembre 2026, compléments intégrés)
**Éditeur** : DUPLEX SAS (Inspexo), SIREN 941 962 060 — contact@inspexo.io

---

## 1. Objet

Les présentes conditions régissent l'accès à l'API de scoring d'Inspexo, qui
rend un verdict motivé sur une annonce de véhicule d'occasion à partir de son
texte. L'accès est nominatif, soumis à une clé, et suppose un contrat signé
fixant le volume et le tarif.

## 2. Nature du service — ce que le verdict est, et n'est pas

2.1. Le verdict est une **analyse automatique du texte d'une annonce**. Il ne
constitue ni une expertise, ni un contrôle technique, ni un diagnostic du
véhicule, ni un conseil à l'achat ou à la vente.

2.2. Il **ne remplace pas un examen du véhicule**. Cette mention accompagne
chaque réponse de l'API et doit être conservée dans toute restitution à un
utilisateur final.

2.3. Inspexo s'engage à ne publier aucune affirmation technique sans source
consultable. Les champs `points` portent leurs URL : elles font partie du
résultat, pas de la décoration.

## 3. Intégrité du verdict — obligations du client

3.1. **Interdiction de modifier le verdict.** Le client ne peut ni altérer, ni
recalculer, ni réinterpréter le `verdict`, le `score` ou les notes par critère
avant de les présenter comme venant d'Inspexo. Afficher un score Inspexo
différent de celui rendu par l'API est une violation substantielle.

3.2. **Interdiction du tri intéressé.** Le client ne peut pas masquer
sélectivement les verdicts défavorables de ses propres annonces tout en
affichant ceux de tiers, ni n'afficher le résultat que lorsqu'il lui est
favorable.

3.3. **Attribution.** Toute restitution publique du résultat mentionne
« Analyse Inspexo » et la version du barème (`bareme_version`).

3.4. Le client peut librement **ne pas afficher** un résultat. Il ne peut pas
l'afficher déformé.

## 4. Restitution du résultat

4.1. Le client ne peut pas revendre, redistribuer ni mettre à disposition d'un
tiers les réponses de l'API en tant que telles, ni constituer à partir d'elles
une base de données proposée à des tiers.

4.2. L'usage autorisé est **l'usage interne** et **la restitution à ses propres
utilisateurs finaux** dans le cadre de son propre service.

4.3. L'extraction systématique du catalogue de défauts, des fiches moteur ou
du relevé de prix par appels répétés est interdite.

4.4. **Restitution à un tiers : le verdict COMPLET, ou rien.** Dès lors que le
résultat est montré à une personne autre que le client lui-même — utilisateur
final, prospect, partenaire —, la restitution porte, ensemble et de façon
lisible :

| Élément | Champ de la réponse |
|---|---|
| le verdict et le score | `verdict`, `score` |
| la **date de l'analyse** | `date_analyse` |
| la version du barème | `bareme_version` |
| la mention « Analyse automatisée de l'annonce, sans examen du véhicule. » | `restitution.mention` |
| un lien cliquable vers le dossier | `restitution.lien` (`https://www.inspexo.io/a/…`) |
| l'attribution « Analyse Inspexo » | `restitution.attribution` |

La réponse de l'API porte ces éléments dans un objet `restitution` :
l'obligation est donnée au client sous forme de données, pas seulement de
prose contractuelle.

La **date** n'est pas une formalité. Un verdict porte sur l'annonce telle
qu'elle était à l'instant de l'analyse ; un résultat servi par le cache peut
avoir jusqu'à sept jours (art. 5.5). Sans sa date affichée, un verdict qui a
vieilli se lit comme un verdict du jour.

4.5. **Ni extrait, ni modifié.** Le client ne peut présenter ni un extrait du
verdict, ni une version modifiée. Sont notamment interdits : afficher le score
sans la mention ou sans la date, ne retenir qu'une partie des motifs ou des
points sourcés, reformuler un motif, ou agréger le verdict dans une note
maison présentée comme venant d'Inspexo. Le client reste libre de **ne pas
afficher** un résultat (art. 3.4) : ce qu'il ne peut pas, c'est l'afficher
incomplet.

4.6. **Interdit au vendeur du véhicule concerné.** Le résultat ne peut pas être
restitué à la personne qui met en vente le véhicule analysé, ni utilisé dans
un support destiné à promouvoir cette vente. L'analyse est faite pour
l'acheteur ; mise dans les mains du vendeur, elle devient un argument de
vente, ce qu'elle n'est pas et ne doit pas devenir.

4.7. En **usage strictement interne**, les obligations de forme des articles
4.4 et 4.5 ne s'appliquent pas.

## 5. Clés et quotas

5.1. La clé est **personnelle et confidentielle**. Elle n'est affichée qu'à sa
création ; Inspexo n'en conserve qu'une empreinte et ne peut pas la restituer.

5.2. Le client signale sans délai toute compromission. Inspexo peut révoquer
une clé immédiatement en cas d'usage contraire aux présentes.

5.3. Deux plafonds s'appliquent : un **quota mensuel** contractuel par client,
et un **plafond journalier global** protégeant le service. Leur dépassement
donne lieu à une réponse HTTP 429 explicite, jamais à une coupure silencieuse.

5.4. Un appel qui n'aboutit pas à une analyse (indisponibilité du fournisseur
d'IA) n'est pas décompté.

5.5. **Cache et facturation.** Une annonce déjà analysée dans les sept jours
renvoie le résultat en cache, marqué `"cache": true`. Lorsque **le même client
redemande la même annonce** dans ce délai, l'appel **n'est pas refacturé** : le
champ `quota.facture` vaut alors `false` et le crédit lui est rendu. Toute
autre requête est facturée, y compris la même annonce demandée par un autre
client, et la même annonce redemandée au-delà de sept jours.

## 6. Données transmises par le client

6.1. Le client garantit disposer du droit de nous transmettre les textes
d'annonces qu'il envoie.

6.2. Le client s'interdit d'envoyer des données personnelles non nécessaires
(nom, téléphone, adresse d'un vendeur). Inspexo ne les demande pas et ne les
exploite pas.

6.3. **Prix transmis — exclus par défaut.** Les prix contenus dans les annonces
que vous nous envoyez par API **n'alimentent pas** notre relevé de marché. Ils
ne sont intégrés que si votre contrat le prévoit expressément ; le défaut est
l'exclusion, sans démarche de votre part.

Lorsque le contrat prévoit ce partage, trois conditions s'appliquent, toutes
les trois :

  a. **Annonces publiques uniquement.** Seuls entrent dans le relevé les prix
     d'annonces diffusées publiquement. Aucun prix de transaction, de reprise,
     de stock, de grille interne ou de devis n'y a sa place.

  b. **Quinze relevés au minimum.** Aucun segment n'est publié en dessous de
     quinze relevés comparables sur trois mois.

  c. **Aucune source dominante : 20 % au plus par client.** Un segment n'est
     pas publié si un seul client d'API y pèse plus d'un cinquième des
     relevés. Un relevé dominé par une source n'est plus une observation du
     marché : c'est le reflet de cette source, et nous le publierions sous
     l'étiquette « prix observés ».

Ce qui est publié reste **agrégé** : des histogrammes par segment, au mois et
à la région. Aucune annonce, aucune URL, aucun identifiant de client n'est
publié, et rien ne permet de remonter du relevé à l'un de vos envois.

6.4. **Conservation.** Le **texte des annonces reçues par API est effacé
automatiquement au bout de trente jours**.

Avant cet effacement, et pour **cinq ans** à compter de la réception, Inspexo
conserve **sans le texte** :

  - le **résultat** de l'analyse (verdict, score, motifs, points sourcés) ;
  - une **empreinte SHA-256 du texte reçu**.

Cette conservation a une seule raison : pouvoir établir, en cas de litige,
quel verdict a été rendu sur quel texte. L'empreinte suffit à cela — vous
présentez le texte que vous nous avez envoyé, nous recalculons l'empreinte, et
la concordance fait la preuve. Durée alignée sur la prescription quinquennale
de l'article **L110-4 du code de commerce**.

L'empreinte est un SHA-256 **non salé**, à dessein : c'est ce qui vous permet
de la recalculer vous-même. Une empreinte salée ne prouverait rien à personne.

Passé les cinq ans, le résultat et l'empreinte sont effacés à leur tour. Les
seules données d'usage nécessaires à la comptabilité — date, clé utilisée,
nombre d'appels, **sans le texte ni le résultat** — sont conservées pendant la
durée légale applicable aux pièces comptables.

## 7. Disponibilité, responsabilité

7.1. L'API est fournie sans engagement de disponibilité en version 0. Une
analyse complète prend typiquement 40 à 90 secondes.

7.2. **Obligation de moyens.** Inspexo s'engage à mettre en œuvre les moyens
raisonnables pour produire une analyse exacte, sourcée et conforme au barème
publié. Il ne souscrit **aucune obligation de résultat**. Le verdict est
produit automatiquement à partir du seul texte d'une annonce, sans examen du
véhicule : il ne peut garantir ni l'état réel du véhicule, ni la sincérité des
déclarations du vendeur, ni l'exhaustivité des défauts d'un modèle.

7.3. **Le verdict est une aide à la décision, pas une expertise.** Inspexo ne
répond pas des décisions d'achat, de vente, de tarification ou d'octroi prises
par le client ou ses utilisateurs sur la base d'un verdict.

7.4. **Usage du verdict auprès des clients du client.** Le client répond
**seul** de l'usage qu'il fait du verdict auprès de ses propres clients : du
choix de l'afficher, de la manière dont il le présente, et des conclusions
qu'il en tire.

Il **garantit Inspexo** contre toute réclamation, action, condamnation ou
sanction résultant d'un usage trompeur du verdict, et prend en charge les
frais de défense correspondants. Sont notamment visés : un affichage partiel
ou modifié (art. 4.5), une présentation du verdict comme un examen du véhicule
ou une expertise, une restitution au vendeur du véhicule analysé (art. 4.6), et
l'emploi du verdict à l'appui d'une allégation commerciale qu'Inspexo n'a pas
émise.

7.5. **Plafond.** La responsabilité d'Inspexo est, en tout état de cause,
plafonnée au **plus élevé** des deux montants suivants :

  - les sommes effectivement payées par le client au titre des **douze mois**
    précédant le fait générateur ;
  - un **plancher de [MONTANT À FIXER AVEC L'AVOCAT ET L'ASSUREUR RC PRO]**.

> ⚠️ **Le plancher reste à arrêter, et il ne peut pas l'être par nous seuls.**
> Il doit être fixé avec l'avocat **et** l'assureur RC pro, dans cet ordre de
> contrainte : un plancher supérieur à la garantie réellement souscrite serait
> un engagement que la police ne couvre pas — c'est-à-dire un engagement pris
> sur les fonds propres de la société sans le savoir. Tant que ce montant
> n'est pas arrêté, **aucun contrat ne peut être signé sur la base de cet
> article.**

7.6. **Dommages indirects exclus.** Sont exclus de toute indemnisation les
dommages indirects, notamment la perte de chiffre d'affaires, la perte de
marge, la perte de clientèle, l'atteinte à l'image et la perte de données.

7.7. Les plafonds et exclusions des articles 7.5 et 7.6 ne s'appliquent pas en
cas de faute lourde ou dolosive, ni dans les cas où la loi les écarte.

## 8. Durée, résiliation

8.1. L'accès court pour la durée prévue au contrat. Chaque partie peut résilier
avec un préavis de trente jours.

8.2. Inspexo peut suspendre l'accès sans préavis en cas de violation des
articles 3 ou 4, après notification écrite.

## 9. Évolutions

9.1. Le barème évolue. Sa version est publiée dans chaque réponse
(`bareme_version`) et change dès qu'un score changerait à faits identiques.

9.3. **Versions publiées à ce jour.**

| Version | Ce qui change | Effet sur un score rendu par l'API |
|---|---|---|
| `11.0` | version initiale de l'API | — |
| `11.1` | deux faits issus du certificat de situation administrative HistoVec (opposition, procédure pour véhicule gravement endommagé non levée) | **aucun.** Ces faits n'existent qu'au dépôt d'un certificat par un acheteur ; l'API ne reçoit que du texte d'annonce |
| `11.3` | la **liste des défauts qui pèsent** sur le score est décidée par des règles serveur, non plus par le choix du modèle | **oui, les scores peuvent changer** à texte identique |
| `11.10` | le **statut du vendeur** est décidé par des règles serveur : intermédiaire dès que l'annonce le déclare (agence, dépôt-vente, mandataire), « professionnel déguisé probable » seulement sur des indices nommés, restitués dans `indices_statut` | **oui, les statuts et les scores peuvent changer** à texte identique |
| `11.11` | les **signaux d'entretien** sont relevés dans le texte de l'annonce par des motifs fixes, non plus par le modèle ; une **garantie** n'est jamais une preuve d'entretien | **oui, les scores peuvent changer** à texte identique — une annonce qui ne mentionne que sa garantie n'a plus d'axe entretien évalué |
| `11.12` | une **opération d'entretien « non faite »** n'est retenue que si l'annonce l'écrit, relevée par des motifs fixes ; ce que le modèle signale en plus devient une question au vendeur | **oui, les scores peuvent changer** à texte identique — une absence d'information n'est plus comptée comme un manquement |
| `11.13` | une quarantaine de **sources** supplémentaires sont reconnues comme indépendantes (presse, associations de consommateurs, sites constructeurs et autorités) ; une page constructeur d'un autre pays reste une information de contexte, jamais une couverture | **oui, les scores peuvent changer** à texte identique — un défaut jusque-là présenté comme question peut désormais peser |
| `11.14` | des **sources confirmées par vérification indépendante** sont versées dans les fiches moteur (sources ajoutées à des défauts connus, défauts nouveaux dont la gravité est établie par la source) ; une campagne publiée pour tout le marché est présentée comme telle, éligibilité à vérifier par le VIN | **oui, les scores peuvent changer** à texte identique pour les moteurs concernés |
| `11.15` | un **rappel dont toutes les sources sont d'un autre pays** devient une information de contexte (jamais rappel officiel, jamais de poids sur le score) ; un **rappel dont les millésimes ou la période publiés excluent l'année du véhicule** n'est plus restitué | **oui, les scores peuvent changer** à texte identique pour les véhicules concernés |
| `11.16` | une **pièce fournie par le vendeur** (facture, attestation de rappel) **justifiée** — même VIN ou immatriculation que l'annonce, date et kilométrage cohérents, aucune incohérence — peut lever trois plafonds : rappel à confirmer (48), opération critique déclarée non faite (55), aucune information d'entretien (65). Une simple déclaration ne lève rien | **non à texte identique** : seul un dossier où une pièce a été déposée peut changer |
| `11.17` | une **panne qui nomme une cylindrée ou une puissance différente** de celle du véhicule n'est plus retenue (ni score, ni dossier) ; si la version du véhicule est inconnue, elle devient une question au vendeur | **oui, les scores peuvent changer** à texte identique pour les véhicules concernés |


La version `11.2` a existé brièvement et n'a jamais été servie à un client.

**Ce que change `11.3`, et pourquoi.** Les défauts connus d'un modèle viennent
de deux sources : une **fiche moteur** (indexée par marque, famille moteur et
plage d'années) et un **atlas de marque** (qui couvre toute la gamme). Jusqu'en
`11.2`, c'est le modèle qui décidait lesquels retenir, et ce choix variait d'un
appel à l'autre : le même texte pouvait rendre deux scores différents.

Désormais : les entrées de **fiche** sont toujours retenues, puisqu'elles sont
propres au moteur du véhicule ; les entrées d'**atlas** ne pèsent sur le score
que si le texte de l'annonce **mentionne explicitement** l'équipement, la
génération ou le code qu'elles visent. Sinon elles restent **affichées** et
deviennent une **question au vendeur**, sans effet sur la note. Un danger pour
les occupants et un rappel officiel applicable, eux, pèsent toujours.

**Conséquence pour vous : à texte identique, le score est désormais stable** —
mesuré trois fois de suite sur un même cas, avec un résultat identique. C'est
l'intérêt de cette version, et la raison du changement de numéro.

9.2. Toute modification des présentes est notifiée trente jours à l'avance.

## 10. Droit applicable

Droit français. À défaut de résolution amiable, les tribunaux de Toulouse sont
compétents.

---

### Décisions — et où elles vivent dans le code

Une règle écrite ici mais non appliquée par le code serait un engagement faux.
Toutes les décisions qui touchent au comportement sont donc implémentées :

| Décision | Article | Implémentation |
|---|---|---|
| Pas de refacturation du cache pour le même client sous 7 jours | 5.5 | `api_deja_facture` / `api_noter_appel` + remboursement dans `api-analyses` ; réponse `quota.facture` |
| Prix reçus par API exclus du relevé agrégé par défaut | 6.3 | `api_clients.prix_partages` (défaut **false**) → `partager_prix` transmis à `score` |
| Segment publié à partir de 15 relevés seulement | 6.3 b | `SEUIL_FOURCHETTE` dans `_shared/marche.ts` + seuil appliqué dans `get_prix_segments` |
| **Aucun client d'API au-delà de 20 % d'un segment** | 6.3 c | `marche_agregats.parts_api` (ventilation) + `PART_API_MAX` / `partApiAcceptable` dans `_shared/marche.ts` + `part_api_max()` et `get_prix_segments` côté base ; `agreger_marche` n'existe plus **sans** attribution |
| Texte des annonces effacé à 30 jours, usage conservé | 6.4 | `analyses.via_api` + `purger_textes_api()`, appelée chaque jour par le cron `alertes` |
| **Résultat + empreinte SHA-256 conservés 5 ans, sans le texte** | 6.4 | `analyses.texte_sha256` posée **avant** tout effacement (passe 1 de `purger_textes_api`), expiration par `purger_preuves_api()` |
| **Date de l'analyse rendue par l'API** | 4.4 | champ `date_analyse` d'`api-analyses` (lu sur `analyses.created_at`, donc date de l'analyse d'origine sur un résultat en cache) |
| **Verdict complet obligatoire en restitution à un tiers** | 4.4, 4.5 | objet `restitution` de la réponse (attribution, mention, lien, champs obligatoires) — l'obligation est rendue comme donnée ; le respect, lui, est contractuel |
| Interdiction de restituer au vendeur du véhicule | 4.6 | contractuel |
| Obligation de moyens, garantie du client, plafond, indirects exclus | 7.2 à 7.7 | contractuel |

Garanties vérifiées hors ligne par `tests/purge-api.test.mjs` (chaîné dans
`npm run eval`) : l'empreinte est posée **avant** l'effacement et l'effacement
l'exige ; le seuil des 20 % est le même en SQL et en TypeScript ; la signature
d'`agreger_marche` sans client est bien supprimée. Le verrou des 20 % lui-même
est testé dans `tests/marche.test.mjs`, y compris son interaction avec la
préférence régionale et avec les comparables fournis en mémoire.

### Annexes — brouillons joints, NON PUBLIÉS

| Document | Objet |
|---|---|
| `docs/cgv-pro-v0.md` | Conditions générales de vente entre professionnels : tarifs sur devis, paiement à 60 jours au plus, pénalités de retard, indemnité forfaitaire de 40 € (art. L441-1 et L441-10 C. com.) |
| `docs/dpa-api-v0.md` | Accord de traitement des données : Inspexo sous-traitant au sens de l'**art. 28 RGPD** |

### Reste à faire avant le premier contrat
- [ ] **Relecture par un avocat**, en particulier les articles 4, 6.4, 7 et 8,
      et les deux annexes.
- [ ] **Arrêter le plancher de responsabilité de l'art. 7.5** avec l'avocat
      ET l'assureur RC pro. Bloquant : aucun contrat ne peut être signé avant.
- [ ] Vérifier l'articulation avec les CGU du site (`/cgu`) pour éviter toute
      contradiction entre les deux textes.
- [ ] Décider du canal de remise de la clé (l'admin l'affiche une seule fois).
