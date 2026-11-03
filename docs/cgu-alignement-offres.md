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

## 5. ÉCARTS ENTRE LE CODE ET LE TEXTE — à combler avant d'ouvrir la vente

> Le texte des CGV de l'inspection décrit les décisions prises. **Quatre d'entre
> elles ne sont pas implémentées.** Le service est aujourd'hui **fermé**
> (`MEDIATEUR_NOM` non posé ⇒ `ouvert: false`, aucune commande possible), donc
> aucun acheteur n'est exposé. Mais il ne doit pas s'ouvrir avant que les quatre
> premiers points soient faits.

### 🔒 Bloquants

**1. Le paiement est ENCAISSÉ à la commande, pas autorisé.**
`inspection-checkout` crée la session Stripe **sans `capture_method: "manual"`**
(vérifié : `payment_intent_data` ne porte que `description` et `transfer_group`).
L'argent part donc au moment du paiement, et non à la confirmation de
l'inspecteur — l'inverse de ce que dit l'article 5.
⚠️ C'est une décision **déjà actée** dans `CLAUDE.md` (« Autorisation Stripe
avant confirmation expert (éviter chargebacks) ») qui n'a jamais été appliquée à
l'inspection.
*Correctif* : `capture_method: "manual"`, capture au moment de
`inspection_accepter`, et gestion de l'échec de capture.

**2. Rien n'expire si aucun inspecteur ne confirme.**
Aucune logique de délai : une inspection reste `a_attribuer` indéfiniment, avec
l'argent déjà encaissé. L'article 5 promet l'annulation de l'autorisation.
*Correctif* : échéance (créneau dépassé + marge), passage en `annulee` et
`paymentIntents.cancel` depuis le cron `alertes`.

**3. Aucune annulation n'existe, ni côté acheteur ni pour l'absence du vendeur.**
Les seules RPC sont `inspection_accepter`, `inspection_refuser`,
`inspection_consentement_photos`, `inspection_photos_liste`, `inspection_zone`.
Donc : pas de règle des 24 h, pas de retenue de 40 €, pas de constat d'absence.
Le statut `annulee` n'est posé que par `charge.refunded`, c'est-à-dire par un
remboursement déclenché à la main.
*Correctif* : RPC `inspection_annuler` (acheteur, transition atomique) et
`inspection_constat_absence` (inspecteur), plus un **transfert partiel de 40 €**
— chemin qui n'existe pas aujourd'hui : `inspection-rapport` ne sait transférer
que `part_inspecteur_cents` à la remise du rapport.

**4. Pas de demande expresse d'exécution immédiate.**
La commande n'envoie que `accepte_cgv: true`. Le Pass a `retractation_renoncee` ;
l'inspection n'a ni case, ni colonne.
⚠️ **Conséquence si on ouvre en l'état** : l'acheteur conserve ses 14 jours de
rétractation **même après l'inspection réalisée**. On aurait payé l'inspecteur et
on devrait rembourser l'acheteur.
*Correctif* : case dédiée, colonne `inspections.execution_immediate_demandee`,
et refus serveur quand le créneau tombe dans les 14 jours sans cette demande.

### À régler, non bloquants

**5. Le délai de remise du rapport n'existe pas dans le code.** Les 48 heures
portent sur le **créneau** (`validerCreneau`, fenêtre [+2 h, +48 h]), pas sur le
rapport. L'article 4 annonce « au plus tard 24 heures après l'inspection » : à
mesurer et relancer, ou à retirer du texte. Ne pas laisser une promesse que rien
ne surveille.

**6. La durée de conservation des photos n'est écrite nulle part** — ni dans le
code, ni dans les CGV, ni dans la politique de confidentialité, qui **ne
mentionne pas du tout les photos d'inspection**. L'article 8 y renvoie : il faut
donc l'y écrire. Durée à décider.

**7. `CGV_VERSION` vaut `"2026-11-01"`** dans `inspection-checkout`, alors que le
texte est daté du **3 novembre 2026**. À aligner, sinon chaque commande
estampille une version qui ne correspond à aucun document.

**8. Politique de confidentialité** : ajouter les photos d'inspection (base
légale, durée, destinataires) et les coordonnées du vendeur transmises par
l'acheteur.
