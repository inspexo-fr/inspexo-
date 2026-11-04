# Conditions générales de vente — clients professionnels — BROUILLON v0

> ⚠️ **BROUILLON — NON PUBLIÉ.** Annexe aux conditions d'utilisation de l'API
> (`docs/cua-api-v0.md`). Rédigé par un non-juriste.
>
> ⚠️ **À FAIRE RELIRE PAR UN AVOCAT AVANT LE PREMIER CONTRAT.** Les articles
> sur le prix, les délais de paiement et les pénalités sont encadrés par des
> dispositions d'ordre public (titre IV du livre IV du code de commerce) : une
> clause non conforme n'est pas seulement inopposable, elle est **sanctionnée**.

**Version** : 0 (brouillon du 3 novembre 2026)
**Vendeur** : DUPLEX SAS (Inspexo), SIREN 941 962 060 — contact@inspexo.io
**Objet** : vente de l'accès à l'API de scoring Inspexo à un client
professionnel agissant pour les besoins de son activité.

---

## 1. Champ d'application

1.1. Les présentes conditions s'appliquent à toute vente d'accès à l'API
Inspexo à un **professionnel**. Elles complètent les conditions d'utilisation
de l'API, qui régissent l'usage du service ; en cas de contradiction sur un
point d'usage, les conditions d'utilisation prévalent, et sur un point
commercial, les présentes.

1.2. Elles ne s'appliquent pas aux consommateurs. Le Pass achat vendu aux
particuliers relève des CGV publiées sur `/cgv-pass`.

1.3. La signature du devis vaut acceptation sans réserve des présentes. Les
conditions d'achat du client ne sont opposables à Inspexo que si Inspexo les a
acceptées par écrit.

## 2. Prix — sur devis

2.1. **Le prix est fixé sur devis**, en fonction du volume mensuel d'appels
souhaité, de la durée de l'engagement et du périmètre d'usage. Aucun tarif
public n'est affiché, et aucun tarif n'est dû avant acceptation d'un devis.

2.2. Le devis précise : le quota mensuel d'appels, le prix, la durée, le
régime de partage des prix (art. 6.3 des conditions d'utilisation), et la
date de début d'accès. Il est valable **trente jours**.

2.3. Les prix sont exprimés **hors taxes**. La TVA applicable s'ajoute au taux
en vigueur à la date de facturation.

2.4. **Dépassement de quota.** Un appel au-delà du quota mensuel est refusé par
une réponse HTTP 429 : il n'est jamais facturé en supplément sans accord
préalable. Un relèvement de quota fait l'objet d'un avenant au devis.

2.5. Les prix peuvent être révisés à l'échéance de chaque période
d'engagement, avec un préavis de **trente jours**.

## 3. Facturation et paiement

3.1. La facturation est **mensuelle, à terme échu**, sur la base du quota
souscrit et des éventuels avenants.

3.2. **Délai de paiement : trente jours** à compter de la date d'émission de la
facture.

Ce délai peut être porté par le devis à **quarante-cinq jours fin de mois ou
soixante jours** à compter de l'émission de la facture, **sans jamais pouvoir
les dépasser** : c'est le plafond impératif de l'article **L441-10 du code de
commerce**, et aucune négociation ne peut aller au-delà.

3.3. Le paiement s'effectue par virement ou par prélèvement, sur les
coordonnées portées sur la facture.

3.4. **Aucun escompte** n'est accordé pour paiement anticipé, sauf mention
contraire au devis.

## 4. Retard de paiement

4.1. **Pénalités de retard.** Toute somme non payée à l'échéance porte intérêt,
de plein droit et sans mise en demeure préalable, au taux d'intérêt appliqué
par la Banque centrale européenne à son opération de refinancement la plus
récente, **majoré de dix points de pourcentage** (art. L441-10, II C. com.).

Les pénalités courent du jour suivant la date d'échéance jusqu'au paiement
intégral.

4.2. **Indemnité forfaitaire pour frais de recouvrement : 40 €.** Tout retard
de paiement rend exigible, de plein droit et en sus des pénalités, une
indemnité forfaitaire de **quarante euros** (art. L441-10, II C. com. et
art. D441-5 C. com.).

Cette indemnité est due **par facture** en retard. Lorsque les frais de
recouvrement exposés dépassent ce montant, Inspexo peut demander une
indemnisation complémentaire sur justificatifs.

4.3. **Mentions obligatoires.** Les conditions de règlement, le taux des
pénalités et l'indemnité forfaitaire sont rappelés sur chaque facture
(art. L441-9 C. com.).

4.4. **Suspension.** En cas de retard de paiement supérieur à **quinze jours**
après mise en demeure restée sans effet, Inspexo peut suspendre l'accès à
l'API. La suspension ne suspend pas l'obligation de payer les sommes dues, ni
les pénalités.

4.5. **Déchéance du terme.** Le non-paiement d'une seule échéance rend
immédiatement exigible le solde de toutes les sommes dues.

## 5. Durée, résiliation

5.1. La durée d'engagement est celle portée au devis. À défaut de mention, le
contrat est conclu pour **douze mois**, renouvelable par tacite reconduction
par périodes de douze mois.

5.2. Chaque partie peut y mettre fin à l'échéance avec un préavis de
**trente jours**.

5.3. Inspexo peut résilier de plein droit, après mise en demeure restée sans
effet pendant quinze jours, en cas de manquement du client aux articles 3 ou 4
des conditions d'utilisation (intégrité du verdict, restitution) ou de
non-paiement.

5.4. **Fin d'accès.** À la fin du contrat, la clé est révoquée. Les obligations
de l'article 4 des conditions d'utilisation (restitution, attribution,
interdiction de revente) **survivent** à la fin du contrat pour les résultats
déjà obtenus.

5.5. Le traitement des données à l'issue du contrat est régi par l'accord de
traitement des données (`docs/dpa-api-v0.md`).

## 6. Responsabilité

6.1. La responsabilité d'Inspexo est régie par l'**article 7 des conditions
d'utilisation de l'API** : obligation de moyens, plafond, exclusion des
dommages indirects.

6.2. Le client est seul responsable de l'usage du verdict auprès de ses
propres clients et garantit Inspexo dans les conditions de l'article 7.4 des
conditions d'utilisation.

## 7. Confidentialité

7.1. Chaque partie garde confidentielles les informations techniques et
commerciales de l'autre portées à sa connaissance à l'occasion du contrat,
pendant le contrat et **trois ans** après sa fin.

7.2. La clé d'API est une information confidentielle au premier chef (art. 5.1
des conditions d'utilisation).

## 8. Référencement commercial

8.1. Inspexo ne cite le nom ou la marque du client comme référence **qu'avec
son accord écrit préalable**. Un accord donné est révocable à tout moment.

## 9. Droit applicable, litiges

9.1. Droit français.

9.2. Les parties cherchent d'abord une résolution amiable. À défaut, les
tribunaux de **Toulouse** sont seuls compétents, y compris en cas de pluralité
de défendeurs ou d'appel en garantie.

---

### Reste à faire avant le premier contrat
- [ ] **Relecture par un avocat.** Les articles 3 et 4 reprennent des
      dispositions d'ordre public : à vérifier mot pour mot, taux et plafonds
      compris.
- [ ] Vérifier le taux BCE de refinancement en vigueur à la date de
      publication, et la façon de le rappeler sur les factures.
- [ ] Décider si le délai de paiement par défaut reste **trente jours** ou est
      porté à quarante-cinq ou soixante jours au devis. Le plafond légal est
      une limite, pas un objectif : un délai long est un crédit consenti au
      client, et une trésorerie en moins pour nous.
- [ ] Mettre en place le rappel des mentions de l'art. L441-9 sur le gabarit
      de facture avant la première facturation.
