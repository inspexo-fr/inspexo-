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
