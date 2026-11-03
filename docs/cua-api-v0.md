# Conditions d'utilisation de l'API Inspexo — BROUILLON v0

> ⚠️ **BROUILLON — NON PUBLIÉ.** À relire et à valider par Utku avant toute
> mise en ligne et avant la remise d'une première clé. Les points marqués
> « à trancher » appellent une décision, pas une rédaction.

**Version** : 0 (brouillon du 3 novembre 2026)
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

## 4. Interdiction de revente des données brutes

4.1. Le client ne peut pas revendre, redistribuer ni mettre à disposition d'un
tiers les réponses de l'API en tant que telles, ni constituer à partir d'elles
une base de données proposée à des tiers.

4.2. L'usage autorisé est **l'usage interne** et **la restitution à ses propres
utilisateurs finaux** dans le cadre de son propre service.

4.3. L'extraction systématique du catalogue de défauts, des fiches moteur ou
du relevé de prix par appels répétés est interdite.

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

5.5. Une annonce déjà analysée dans les sept jours renvoie le résultat en
cache, marqué comme tel. **Il est décompté comme un appel** — à trancher si
nous voulons l'offrir.

## 6. Données transmises par le client

6.1. Le client garantit disposer du droit de nous transmettre les textes
d'annonces qu'il envoie.

6.2. Le client s'interdit d'envoyer des données personnelles non nécessaires
(nom, téléphone, adresse d'un vendeur). Inspexo ne les demande pas et ne les
exploite pas.

6.3. Les prix transmis alimentent un relevé de marché **strictement agrégé**,
jamais republié annonce par annonce. — *à trancher : faut-il permettre au
client de s'y opposer ?*

## 7. Disponibilité, responsabilité

7.1. L'API est fournie sans engagement de disponibilité en version 0. Une
analyse complète prend typiquement 40 à 90 secondes.

7.2. Inspexo ne répond pas des décisions d'achat, de vente, de tarification ou
d'octroi prises par le client ou ses utilisateurs sur la base d'un verdict.

7.3. La responsabilité d'Inspexo est, en tout état de cause, plafonnée au
montant payé par le client au titre des douze derniers mois. — *à trancher
avec un conseil : plafond et exclusions.*

## 8. Durée, résiliation

8.1. L'accès court pour la durée prévue au contrat. Chaque partie peut résilier
avec un préavis de trente jours.

8.2. Inspexo peut suspendre l'accès sans préavis en cas de violation des
articles 3 ou 4, après notification écrite.

## 9. Évolutions

9.1. Le barème évolue. Sa version est publiée dans chaque réponse
(`bareme_version`) et change dès qu'un score changerait à faits identiques.

9.2. Toute modification des présentes est notifiée trente jours à l'avance.

## 10. Droit applicable

Droit français. À défaut de résolution amiable, les tribunaux de Toulouse sont
compétents.

---

### Points à trancher avant publication
1. Le résultat servi depuis le cache est-il facturé ? (art. 5.5)
2. Le client peut-il s'opposer à l'usage des prix dans le relevé agrégé ? (art. 6.3)
3. Plafond de responsabilité et exclusions — à valider avec un conseil. (art. 7.3)
4. Faut-il exiger un lien visible vers `/a/:id` lors d'une restitution publique ?
5. Durée de conservation des textes d'annonces reçus par API.
