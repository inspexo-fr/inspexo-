# Conditions d'utilisation de l'API Inspexo — BROUILLON v0

> ⚠️ **BROUILLON — NON PUBLIÉ.** Les cinq points en suspens ont été tranchés
> par Utku le 3 novembre 2026 et sont intégrés ci-dessous. Le document reste
> non publié.
>
> ⚠️ **À FAIRE RELIRE PAR UN AVOCAT AVANT LE PREMIER CONTRAT.** Ce texte est
> rédigé par un non-juriste ; l'article 7 (responsabilité) en particulier
> engage la société et doit être validé.

**Version** : 0 (brouillon du 3 novembre 2026, décisions intégrées)
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

4.4. **Attribution lors d'une restitution à un tiers.** Dès lors que le verdict
est montré à une personne autre que le client lui-même — utilisateur final,
prospect, partenaire —, la restitution porte la mention « Analyse Inspexo » et
un lien cliquable vers le dossier correspondant (`https://www.inspexo.io/a/…`,
rendu par le champ `url` de la réponse). En **usage strictement interne**, cette
mention est libre.

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

6.4. **Conservation.** Le **texte des annonces reçues par API est effacé
automatiquement au bout de trente jours**. Les données d'usage nécessaires à la
comptabilité — date, clé utilisée, nombre d'appels, **sans le texte** — sont
conservées pendant la durée légale applicable aux pièces comptables.

## 7. Disponibilité, responsabilité

7.1. L'API est fournie sans engagement de disponibilité en version 0. Une
analyse complète prend typiquement 40 à 90 secondes.

7.2. **Le verdict est une aide à la décision, pas une expertise.** Il est
produit automatiquement à partir du seul texte d'une annonce, sans examen du
véhicule. Inspexo ne répond pas des décisions d'achat, de vente, de
tarification ou d'octroi prises par le client ou ses utilisateurs sur la base
d'un verdict.

7.3. **Plafond.** La responsabilité d'Inspexo est, en tout état de cause,
plafonnée au montant effectivement payé par le client au titre des **douze
derniers mois**.

7.4. **Dommages indirects exclus.** Sont exclus de toute indemnisation les
dommages indirects, notamment la perte de chiffre d'affaires, la perte de
marge, la perte de clientèle, l'atteinte à l'image et la perte de données.

7.5. Les plafonds et exclusions des articles 7.3 et 7.4 ne s'appliquent pas en
cas de faute lourde ou dolosive, ni dans les cas où la loi les écarte.

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

### Décisions prises le 3 novembre 2026 — et où elles vivent dans le code

Une règle écrite ici mais non appliquée par le code serait un engagement faux.
Les trois décisions qui touchent au comportement sont donc implémentées :

| Décision | Article | Implémentation |
|---|---|---|
| Pas de refacturation du cache pour le même client sous 7 jours | 5.5 | `api_deja_facture` / `api_noter_appel` + remboursement dans `api-analyses` ; réponse `quota.facture` |
| Prix reçus par API exclus du relevé agrégé par défaut | 6.3 | `api_clients.prix_partages` (défaut **false**) → `partager_prix` transmis à `score` |
| Texte des annonces effacé à 30 jours, usage conservé | 6.4 | `analyses.via_api` + `purger_textes_api()`, appelée chaque jour par le cron `alertes` |
| Attribution « Analyse Inspexo » + lien `/a/:id` dès restitution à un tiers | 4.4 | contractuel — le champ `url` de la réponse fournit le lien |
| Responsabilité plafonnée 12 mois, indirects exclus, aide à la décision | 7.2 à 7.5 | contractuel |

### Reste à faire avant le premier contrat
- [ ] **Relecture par un avocat**, en particulier les articles 4, 7 et 8.
- [ ] Vérifier l'articulation avec les CGU du site (`/cgu`) pour éviter toute
      contradiction entre les deux textes.
- [ ] Décider du canal de remise de la clé (l'admin l'affiche une seule fois).
