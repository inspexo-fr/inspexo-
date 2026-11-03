# Accord de traitement des données — API Inspexo — BROUILLON v0

> ⚠️ **BROUILLON — NON PUBLIÉ.** Annexe aux conditions d'utilisation de l'API
> (`docs/cua-api-v0.md`). Rédigé par un non-juriste.
>
> ⚠️ **À FAIRE RELIRE PAR UN AVOCAT AVANT LE PREMIER CONTRAT.** L'article 28
> du RGPD impose un contenu MINIMAL à cet acte : s'il manque une des mentions
> du 28.3, l'acte ne remplit pas son office et le manquement est imputable aux
> **deux** parties.

**Version** : 0 (brouillon du 3 novembre 2026)
**Sous-traitant** : DUPLEX SAS (Inspexo), SIREN 941 962 060 — contact@inspexo.io
**Responsable du traitement** : le client professionnel désigné au devis

---

## 1. Objet et qualification des parties

1.1. Le présent acte est conclu en application de l'**article 28.3 du RGPD**
(règlement UE 2016/679). Il encadre les traitements de données à caractère
personnel réalisés par Inspexo **pour le compte du client** à l'occasion de
l'usage de l'API de scoring.

1.2. **Le client est responsable du traitement.** C'est lui qui décide des
finalités et des moyens : il choisit quelles annonces envoyer, à quelle fin, et
ce qu'il fait du résultat.

1.3. **Inspexo est sous-traitant.** Il traite les données sur instruction du
client et ne poursuit, pour ce traitement, aucune finalité propre.

1.4. **Périmètre — ce qui n'est PAS couvert par cet acte.** Inspexo agit comme
**responsable du traitement pour son propre compte**, et non comme
sous-traitant, pour :

  - la gestion de la relation commerciale et de la facturation (identité du
    contact, clé, volumes d'appels) ;
  - le relevé de prix agrégé, lorsque le contrat prévoit le partage des prix
    (art. 6.3 des conditions d'utilisation). Ce relevé ne contient aucune
    donnée personnelle : seuls des histogrammes par segment, au mois et à la
    région.

Ces traitements relèvent de la politique de confidentialité d'Inspexo, pas du
présent acte.

## 2. Nature du traitement

2.1. **Opérations réalisées** : réception d'un texte d'annonce, analyse
automatisée, production d'un verdict, conservation selon l'article 6 ci-après,
restitution au client.

2.2. **Finalité** : produire, pour le compte du client, une analyse de
l'annonce qu'il transmet.

2.3. **Catégories de personnes concernées** : les personnes susceptibles
d'être identifiées, même indirectement, par le contenu d'un texte d'annonce —
principalement le vendeur du véhicule.

2.4. **Catégories de données.** Le texte d'annonce transmis par le client,
tel qu'il est transmis. Inspexo **ne demande, ne requiert et n'exploite
aucune donnée personnelle** pour produire son analyse : ni nom, ni téléphone,
ni adresse, ni immatriculation, ni VIN.

2.5. **Aucune catégorie particulière.** Le client s'interdit de transmettre
des données visées aux **articles 9 et 10 du RGPD** (données sensibles,
infractions). Le service n'est ni conçu ni autorisé pour en traiter.

2.6. **Minimisation à la charge du client.** Le client s'engage à **expurger**
les textes qu'il transmet des données personnelles non nécessaires à l'analyse
(art. 6.2 des conditions d'utilisation). C'est à lui que revient cette
minimisation : il est seul à voir la donnée avant l'envoi.

2.7. **Aucune décision automatisée au sens de l'art. 22.** Le verdict porte sur
une **annonce** et sur un **modèle de véhicule**, jamais sur une personne. Il
ne produit aucun effet juridique à l'égard de qui que ce soit et n'est pas
destiné à fonder une décision individuelle automatisée. Si le client en fait
néanmoins l'un des éléments d'une telle décision, il lui appartient d'en
assurer la conformité, y compris l'intervention humaine.

## 3. Obligations d'Inspexo (art. 28.3 RGPD)

3.1. **Agir sur instruction documentée.** Inspexo ne traite les données que sur
instruction du client. Les présentes, les conditions d'utilisation et le devis
**constituent ces instructions documentées**. Toute instruction nouvelle doit
être écrite.

3.2. **Alerte sur une instruction illicite.** Si Inspexo estime qu'une
instruction du client enfreint le RGPD ou une autre disposition relative à la
protection des données, il en informe le client sans délai et peut suspendre
son exécution jusqu'à clarification.

3.3. **Pas de transfert hors UE sans base.** Voir l'article 5.

3.4. **Confidentialité.** Inspexo garantit que les personnes autorisées à
traiter les données sont tenues à la confidentialité. L'accès est limité aux
personnes qui en ont besoin, et la société n'emploie, à la date du présent
acte, aucun personnel hors de son dirigeant.

3.5. **Sécurité (art. 32).** Voir l'article 4.

3.6. **Assistance.** Inspexo assiste le client, dans la mesure du possible et
à ses frais raisonnables, pour : répondre aux demandes d'exercice de droits,
réaliser une analyse d'impact, consulter l'autorité de contrôle, et notifier
une violation.

3.7. **Violation de données.** Inspexo notifie au client toute violation de
données à caractère personnel **sans délai injustifié et au plus tard
48 heures** après en avoir pris connaissance, avec les éléments connus : nature
de la violation, catégories et volume approximatifs, conséquences probables,
mesures prises. La notification à l'autorité et aux personnes concernées
relève du client, qui est le responsable du traitement.

3.8. **Registre.** Inspexo tient à disposition du client la description des
traitements réalisés pour son compte.

3.9. **Audit.** Inspexo met à disposition du client les informations
nécessaires pour démontrer le respect du présent acte et se soumet à un audit,
une fois par an au plus, sur préavis de trente jours, aux frais du client et
dans des conditions préservant la confidentialité de ses autres clients.

## 4. Sécurité (art. 32 RGPD)

4.1. Mesures en place :

  - **chiffrement en transit** (HTTPS/TLS) sur toute la chaîne ;
  - **chiffrement au repos** de la base de données ;
  - **cloisonnement des accès** : aucune table du service n'est accessible
    directement ; tout accès passe par des fonctions au périmètre défini, et
    la base refuse les accès directs anonymes ;
  - **authentification par clé** dont seule une **empreinte salée** est
    conservée : Inspexo ne peut pas restituer une clé, même sous contrainte ;
  - **journalisation** des appels (date, clé, volume) sans le texte ;
  - **effacement programmé** du texte à trente jours (art. 6).

4.2. Ces mesures peuvent évoluer. Elles ne peuvent pas être dégradées sans
information préalable du client.

4.3. **Limite assumée, et déclarée comme telle** : le service repose sur des
sous-traitants ultérieurs (art. 5), dont les garanties de sécurité sont celles
de leurs propres engagements. Inspexo ne garantit pas au-delà.

## 5. Sous-traitants ultérieurs (art. 28.2 et 28.4)

5.1. Le client **autorise** le recours aux sous-traitants ultérieurs suivants,
chacun lié par des obligations équivalentes aux présentes :

| Sous-traitant | Rôle | Localisation du traitement |
|---|---|---|
| Supabase | base de données et exécution des fonctions | Union européenne |
| Vercel | hébergement de la couche d'entrée HTTP | Union européenne |
| Anthropic | analyse du texte par modèle de langage | **Hors UE (États-Unis)** |

5.2. **Transfert hors UE.** L'analyse du texte implique un transfert vers
Anthropic aux États-Unis, encadré par les **clauses contractuelles types** de
la Commission européenne. Le client en est informé et l'accepte : ce transfert
est **inhérent au service**, il n'est pas optionnel.

5.3. Anthropic n'utilise pas les contenus transmis par l'API pour entraîner
ses modèles.

5.4. **Changement de sous-traitant.** Inspexo informe le client de tout ajout
ou remplacement **trente jours** à l'avance. Le client peut s'y opposer pour
un motif tenant à la protection des données ; à défaut d'accord, il peut
résilier sans pénalité.

## 6. Durée de conservation et sort des données

6.1. **Texte d'annonce : trente jours**, puis effacement automatique.

6.2. **Résultat et empreinte SHA-256 du texte : cinq ans** à compter de la
réception, **sans le texte** (art. 6.4 des conditions d'utilisation). Finalité
exclusive : établir, en cas de litige, quel verdict a été rendu sur quel
texte. Durée alignée sur la prescription de l'art. L110-4 du code de commerce.

6.3. **Données d'usage** (date, clé, nombre d'appels, sans le texte ni le
résultat) : durée légale applicable aux pièces comptables.

6.4. **Fin de contrat — effacement.** À l'issue du contrat, Inspexo
**efface** les données traitées pour le compte du client, ou les lui renvoie
sur sa demande écrite formulée dans les trente jours.

6.5. **Ce qui subsiste, et pourquoi.** Échappent à l'effacement de l'art. 6.4,
et seulement eux :

  - la **preuve** de l'art. 6.2, jusqu'au terme des cinq ans ;
  - les **pièces comptables** de l'art. 6.3.

L'article 28.3 g) du RGPD réserve le cas où le droit de l'Union ou d'un État
membre exige la conservation : c'est ce cas. Conserver la preuve d'un litige
possible pendant que le délai pour l'intenter court n'est pas une rétention
abusive — l'effacer le serait, au détriment des deux parties.

6.6. Sur demande écrite, Inspexo atteste de l'effacement réalisé.

## 7. Responsabilité et durée

7.1. Chaque partie répond du manquement qui lui est propre. Le client répond
notamment de la licéité de la collecte initiale, de l'information des
personnes concernées et de la minimisation de l'art. 2.6.

7.2. Le présent acte entre en vigueur à la date du devis et prend fin avec le
contrat, à l'exception des articles 6.2, 6.3, 6.5 et 7, qui survivent le temps
nécessaire.

7.3. Droit français. L'autorité de contrôle d'Inspexo est la **CNIL**.

---

### Reste à faire avant le premier contrat
- [ ] **Relecture par un avocat**, en vérifiant point par point la présence
      des huit mentions de l'**art. 28.3** (a à h).
- [ ] Confirmer la **région de traitement** effective de chaque sous-traitant
      (Supabase et Vercel) et la documenter, plutôt que de la supposer.
- [ ] Récupérer et archiver les engagements de sous-traitance ultérieure des
      trois sous-traitants (DPA Supabase, Vercel, Anthropic) : l'art. 28.4
      exige des obligations **équivalentes**, ce qui se prouve sur pièces.
- [ ] Vérifier la base du transfert hors UE pour Anthropic à la date de
      signature (clauses contractuelles types en vigueur, et le cas échéant
      adhésion au cadre de protection des données UE–États-Unis).
- [ ] Trancher si le délai de notification de violation reste à **48 heures**
      ou passe à 24 : un délai court est un engagement fort, et il doit être
      tenable par une société d'une personne.
- [ ] Rédiger la **description des traitements** de l'art. 3.8, à joindre.
