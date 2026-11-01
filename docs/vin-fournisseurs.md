# Fournisseurs d'API de décodage VIN détaillé — véhicules européens (marché France)

> Recherche documentaire menée le 29/10/2026 (aucune inscription, aucun appel d'API, rien de payant activé — décision d'abonnement : Utku).
> Objectif : à partir d'un VIN, obtenir le **code moteur constructeur** (EA824, OM654, EB2…), la **finition** et les **équipements d'origine** pour des véhicules du marché français. Le décodage normatif gratuit (WMI, pays, année) est déjà couvert par `src/lib/vin.js` — seul le décodage détaillé payant est évalué ici.

## Verdict en une ligne

Trois finalistes : **Vincario (vindecoder.eu)** à tester en premier (code moteur constructeur confirmé, tarifs publiés en euros, 20 VIN d'essai gratuits), **DAT France (SilverDAT / VIN-Abfrage)** pour les équipements d'origine exacts issus des bases constructeur (le seul des trois qui les fournit), **CarsXE** en appoint bas coût mais **sans code moteur constructeur**.

---

## Tableau comparatif des 3 finalistes

| Critère | **Vincario** (vindecoder.eu) | **DAT France** (SilverDAT VIN-Abfrage) | **CarsXE** (International VIN Decoder) |
|---|---|---|---|
| Couverture France (Peugeot/Renault/Citroën) | Oui — couverture « 110 pays, 2 400+ marques », compatible véhicules européens | **Oui, via les bases des constructeurs** : Citroën, Peugeot, Renault, Dacia, DS, Alpine listés nommément ; > 95 % du parc français < 15 ans (chiffre DAT) | Revendique « 99,31 % de couverture Europe », 50+ pays — chiffre marketing, non détaillé par marque |
| Marques allemandes (VW/BMW/Mercedes/Audi) | Oui | Oui (bases constructeur, re-imports signalés) | Oui (exemple documenté : Ford Galaxy allemand) |
| **Code moteur constructeur** | **OUI — champ `Engine Code` dédié** (exemple documenté : « D4HA » sur un Hyundai Tucson 2.0 CRDi) | **OUI, de fait** : motorisation exacte + codes d'organes constructeur (ex. ligne « 4 Zyl. Dieselmotor 2,0L Aggr. 04L » dans les équipements VAG) — c'est la donnée de fabrication d'origine | **NON** : champ `engine` générique type « 3.0L L6 DOHC 24V », pas de code constructeur |
| Finition (trim) | Partielle : champs `Series` / « Vehicle Specification » (ex. « Tucson 2.0 CRDI ») | **Oui** : sous-type / ligne d'équipement exacte (ex. « Passat Variant Alltrack 4Motion BMT ») | Marque/modèle/année + « trims » annoncés, absents de l'exemple de réponse publié |
| **Équipements d'origine** | Non dans le décodage standard (la page API dit explicitement ne pas décoder les « equipment features ») ; produit séparé **« OEM VIN Lookup »** (base constructeur : équipements usine, codes couleur, prix catalogue) sur devis | **OUI — liste complète série + options ex-usine avec code constructeur par option** (ex. codes Mercedes 03O, 202B, 255B…) : c'est le cœur du produit | Non sur l'endpoint international |
| Prix (100 décodages/mois) | **0,49 €/VIN** (palier 100) → ~49 €/mois ; dégressif jusqu'à 0,22 €/VIN à 5 000 | **1,85 € HT/VIN réussi** → 185 €/mois + accès SilverDAT (en Allemagne : 49 €/mois de base + 300 € d'activation ; tarif France sur devis) | Pay-as-you-go dès **0,10 $/appel** (~10 $/mois) ; abonnements Starter 40,83 $/mois, Pro 207,50 $/mois (facturation annuelle) |
| Essai gratuit | **20 lookups API gratuits** + 3 rapports web/mois | Non (démo commerciale sur demande) | **Sandbox gratuite, 100 appels** (à vie) |
| Engagement / conditions | Contrat minimum 1 mois ; VIN invalides non facturés | Contrat B2B (« Freischaltungsvereinbarung ») ; la fonction VIN elle-même est sans minimum, mais suppose l'accès SilverDAT/API DAT | Sans engagement en PAYG ; « no data, no charge » (facturation sur 200 OK uniquement) |
| Format API | REST JSON, ~50 champs | API DAT (webservices SilverDAT, XML/REST selon interface) — pensé pour intégrateurs, pas self-service | REST JSON, clé API simple, ~40 attributs |
| RGPD / localisation | Vincario s.r.o., **République tchèque (UE)**, se déclare conforme RGPD | **Allemagne/France (UE)** — Deutsche Automobil Treuhand, filiale DAT France à Paris (SIREN 488 966 920) ; données sous contrats OEM, conformité RGPD mise en avant | Société **américaine** — prévoir DPA/clauses de transfert |

---

## Détail par fournisseur

### 1. Vincario (moteur du site vindecoder.eu) — le finaliste à tester en premier

- **Qui** : Vincario s.r.o., société tchèque (UE) ; opère l'API derrière vindecoder.eu. Fondateur Martin Vlcko. Conformité RGPD/CPRA revendiquée.
- **Couverture** : décodage mondial « 110 pays, 2 400+ marques », explicitement compatible véhicules européens ; ~40-50 champs retournés sur le marché européen.
- **Code moteur** : champ **`Engine Code`** documenté dans la réponse (exemple public : « D4HA »), accompagné de `Engine Displacement`, `Engine Power (kW)`, `Engine Manufacturer`, `Engine Type`, `Fuel Type`, `Number of Gears`. **C'est le seul des trois à exposer un champ « code moteur » nommé dans un décodage self-service.** Reste à vérifier son taux de remplissage sur les marques françaises (voir « points à vérifier »).
- **Équipements** : la page API précise que le décodage standard **ne couvre pas** la couleur ni les équipements. Le produit séparé **OEM VIN Lookup** interroge la base du constructeur (équipements montés en usine, codes couleur intérieur/extérieur, numéro KBA, prix catalogue d'origine) — tarification sur devis uniquement.
- **Prix publiés (EUR)** : VIN decode 0,49 € (palier 100) / 0,298 € (500) / 0,249 € (1 000) / 0,22 € (5 000) ; market value et stolen check 1,99 → 0,90 € ; **20 lookups d'essai gratuits** ; contrat minimum 1 mois ; VIN invalides non facturés.
- **API** : REST JSON, authentification par clé, intégration annoncée « < 5 minutes », SLA 99,9 % d'uptime et 99,8 % d'exactitude revendiqués.
- **Limites connues** : la précision « 99,8 % » est une revendication marketing ; le décodage standard reste un décodage par bases croisées (pas une requête constructeur temps réel) — la finition exacte et les options ne sont pas garanties ; l'offre OEM, elle, est sans prix public.
- **Sources** : [vindecoder.eu/api](https://vindecoder.eu/api/) · [Tarifs Vincario](https://vincario.com/blog/vin-decoder-api-pricing/) · [Champs retournés dont Engine Code (listing Apify officiel Vincario)](https://apify.com/vincario/vincario-vin-decoder-api-services) · [Présentation Vincario + OEM Lookup](https://vincario.com/blog/what-is-vincario/) · [OEM VIN Lookup (équipements usine, couleurs, KBA)](https://vincario.com/blog/best-oem-software/) · [Politique de confidentialité](https://vindecoder.eu/privacy-policy)

### 2. DAT France (Deutsche Automobil Treuhand — SilverDAT VIN-Abfrage) — la référence « données constructeur »

- **Qui** : groupe allemand DAT (90+ ans, 23 pays), **filiale française à Paris** (DAT France, 9 rue du Bouloi, 75001, SIREN 488 966 920). Les données sont fournies **par les constructeurs eux-mêmes** sous contrat (la requête remonte la configuration d'origine du véhicule dans la base du constructeur).
- **Couverture** : liste officielle des constructeurs interrogeables en direct : Abarth, Alfa Romeo, **Alpine**, **Audi**, **BMW**, Cadillac, Chevrolet, Chrysler, **Citroën**, Cupra, **Dacia**, **DS**, Dodge, Fiat, Ford, Hyundai, Iveco, Jeep, Kia, Lancia, Lexus, MAN, Mazda, MINI, **Mercedes-Benz**, Nissan, Opel, **Peugeot**, Porsche, **Renault**, Seat, Škoda, Subaru, Smart, Toyota, **Volkswagen**, Volvo (+ Jaguar/Land Rover ajoutés récemment). DAT annonce **> 95 % du parc français de moins de 15 ans** couvert par la recherche VIN.
- **Données retournées** : identification exacte (série, carrosserie, **motorisation précise** — ex. « Motor 2,0 Ltr. – 110 kW TDI » —, codes d'organes constructeur dans les lignes d'équipement, ex. VAG « Aggr. 04L »), et surtout **la liste complète des équipements série + options ex-usine, chaque option avec son code constructeur** (ex. Mercedes « 255B – MB-MOBILO ») et son prix neuf. Les re-imports (specs divergentes) sont signalés. C'est exactement la donnée « équipements d'origine » qu'aucun décodeur self-service ne fournit.
- **Prix** : **à partir de 1,85 € HT par transmission réussie d'un dossier véhicule, quel que soit le constructeur ; sans frais de base ni volume minimum pour la fonction** (flyer officiel). L'accès à l'écosystème se contracte toutefois : en Allemagne, le tarif d'entrée SilverDAT relevé par un intégrateur est de 49 €/mois + 300 € d'activation. Tarif France : sur devis auprès de DAT France. Pas d'essai gratuit self-service.
- **API** : DAT expose ses données « en logiciel métier **ou via API** » (webservices SilverDAT utilisés par des intégrateurs tiers : identification VIN, codification des équipements, valorisation) ; échanges XML/REST selon interface. Ce n'est **pas** du self-service : contrat B2B et mise en route commerciale.
- **Limites connues** : pas de prix public France, pas de sandbox ; une « transmission réussie » est facturée même si on n'exploite qu'une partie des données ; l'usage des données constructeur est encadré par les droits que DAT détient (publication/réaffichage à négocier au contrat) ; lourdeur d'intégration disproportionnée tant que le volume d'Inspexo est faible.
- **Sources** : [Flyer officiel VIN-Abfrage (PDF, prix 1,85 €, équipements ex-usine)](https://www.dat.de/fileadmin/de/download/flyer-dat-vin-abfrage.pdf) · [Liste des constructeurs couverts (PDF DAT Austria 09/2024)](https://www.datgroup.com/fileadmin/at/VIN_Abfrage_Infos/Anleitung-VIN-Abfrage-Oesterreich_09-2024.pdf) · [DAT France (API, > 95 % du parc < 15 ans)](https://www.datgroup.com/fr-fr/) · [DAT France — identification VIN à la cote VO](https://www.silverdat.online/actualites/solutions-donnees-uniques-marche-vo/) · [Tarifs SilverDAT relevés (autoiXpert)](https://www.autoixpert.de/dat-preisrechner) · [SilverDAT Connect (contrats OEM, RGPD)](https://www.datgroup.com/products/silverdat-connect/)

### 3. CarsXE (International VIN Decoder) — l'appoint bas coût, sans code moteur

- **Qui** : société américaine, API self-service grand public développeurs (« 8 000+ clients »).
- **Couverture** : endpoint dédié `/v1/international-vin-decoder` pour les VIN non-US (UE, JDM, LATAM), « 50+ pays », revendication de **99,31 % de couverture Europe** (chiffre issu de leur propre blog, sans détail par marque). Exemple documenté sur un VIN allemand (Ford Galaxy 2008) : ~40 attributs.
- **Champs retournés** : make, model, year, body, fuel_type, gears, plant_country, dimensions (mm), vitesse max… Le champ moteur est **générique** (« 3.0L L6 DOHC 24V ») : **pas de code moteur constructeur, pas d'équipements, trim non présent dans l'exemple de réponse publié**. Tous les champs sont optionnels (absents si la source ne les connaît pas).
- **Prix** : Sandbox gratuite (100 appels à vie) ; pay-as-you-go dès 0,10 $/appel ; Starter 40,83 $/mois et Pro 207,50 $/mois (facturation annuelle) avec quotas par produit et dépassement facturé. Principe « no data, no charge » (seules les réponses 200 OK sont facturées).
- **Limites connues** : profondeur réelle sur les marques françaises invérifiable sans test ; champ moteur insuffisant pour relier une analyse à une famille moteur Inspexo sans table de correspondance maison ; société US (transferts de données à cadrer RGPD).
- **Sources** : [carsxe.com/international-vin-decoder](https://carsxe.com/international-vin-decoder) · [carsxe.com/pricing](https://carsxe.com/pricing) · [Blog CarsXE — EU VIN decoding (99,31 %, sandbox)](https://carsxe.com/blog/top-apis-for-eu-vin-decoding) · [Docs CarsXE](https://docs.carsxe.com/docs/get-started)

---

## Candidats écartés (et pourquoi)

| Candidat | Raison de l'écart | Source |
|---|---|---|
| **NHTSA vPIC** (gratuit) | Référence de ce qui **ne marche pas** pour l'Europe : base limitée aux véhicules destinés au marché US ; la précision s'effondre sur les VIN européens non homologués US. Les données d'homologation UE équivalentes (WVTA) ne sont pas publiques. | [vpic.nhtsa.dot.gov](https://vpic.nhtsa.dot.gov/) · [Analyse Auto.dev](https://www.auto.dev/blog/nhtsa-vin-decoder-vpic) |
| **Auto-Data.net** | Excellente base de specs par modèle, mais **pas d'API VIN officielle** : les « API auto-data » trouvées sont des passerelles tierces (scraping) sans décodage VIN. Inutilisable comme décodeur. | [parse.bot (passerelle non officielle)](https://parse.bot/marketplace/4b8f1db6-d3f1-42fe-b6f1-1329071a2735/auto-data-net-api) |
| **VinAudit** | Données US uniquement (NMVTIS) ; pas de couverture Europe. | [vinaudit.com/international-vin-decoder](https://www.vinaudit.com/international-vin-decoder) |
| **carVertical** | Produit = **rapport d'historique** (dommages, compteur, vol), pas un décodeur de specs ; B2B dès 119,90 € les 10 rapports — hors sujet et hors budget pour du décodage. | [carvertical.com/en/business/api](https://www.carvertical.com/en/business/api) |
| **AutoDNA** | Rapports d'historique grand public ; WebAPI partenaires non documentée publiquement, pas de self-service développeur. | [autodna.com/decoder-vin-checker](https://www.autodna.com/decoder-vin-checker) |
| **EpicVIN** | US/NMVTIS, même limite que VinAudit. | — |
| **TecAlliance (TecDoc)** | Sérieux et le VIN→véhicule TecDoc **donne bien le code moteur** (le référentiel KType est structuré par codes moteur), mais l'offre est pensée pour le commerce de pièces : licence commerciale B2B sans prix public API, sur-dimensionnée pour ce besoin. À garder en tête si Inspexo veut un jour relier pannes → pièces. | [Vehicle search avec filtre engine code](https://developer.tecalliance.cn/en/tecdoc-api/use-case/vehicle-search-with-engine-code-filter/index.html) · [TecDoc solutions](https://www.tecalliance.net/solutions/tecdoc) |

---

## Recommandation

**Tester Vincario en premier.** C'est le seul candidat qui cumule : un champ `Engine Code` constructeur documenté, des tarifs publics en euros sans engagement au-delà d'un mois, 20 VIN d'essai gratuits immédiats, une société UE (RGPD simple), et une API REST JSON triviale à appeler depuis une edge function. Le test coûte 0 € et peut se faire en une heure sur un panel de VIN représentatifs du besoin Inspexo : 308 1.2 PureTech (EB2 attendu), Audi S7 (EA824/CEUC), Mercedes Classe C (OM654), Renault/Dacia récents, et un Peugeot pré-2010. **Le critère de réussite est binaire : le champ `Engine Code` est-il rempli et juste sur les marques françaises ?** (C'est la donnée que les décodeurs structurels ratent le plus souvent sur PSA/Renault, dont les positions 4-8 du VIN sont moins parlantes que chez VAG.)

**En parallèle, demander un devis à DAT France** (contact via datgroup.com/fr-fr). DAT est le seul des trois à fournir les **équipements d'origine exacts, option par option, avec les codes constructeur**, directement depuis les bases des constructeurs — y compris Peugeot, Renault, Citroën, Dacia, DS, Alpine. C'est la donnée qui transformerait le Pass achat (vérifier qu'une annonce « toit pano, cuir » correspond à la configuration d'usine réelle). Mais c'est un contrat B2B sans self-service : à engager seulement quand le Pass achat le justifie, pas pour le score gratuit.

**CarsXE en solution de repli** si Vincario déçoit sur certains VIN : sandbox gratuite de 100 appels pour vérifier sans frais, et 0,10 $/appel ensuite. Son champ moteur générique (« 1.2L I3 ») suffirait tout juste à confirmer une famille moteur déjà déduite par l'IA, pas à la déterminer.

### Coût estimé pour 100 décodages/mois

| Scénario | Coût mensuel |
|---|---|
| Vincario, palier 100 lookups | **~49 €** (0,49 €/VIN ; VIN non reconnus non facturés) |
| DAT France, 100 VIN | **~235 € HT estimés** (100 × 1,85 € + base d'accès type 49 €/mois, hors activation ~300 € une fois — tarif France exact sur devis) |
| CarsXE pay-as-you-go | **~10 $** (≈ 9 €) — mais sans code moteur |

À l'échelle actuelle d'Inspexo (score gratuit ~0,028 $/analyse), Vincario ajouterait ~0,49 € par analyse avec VIN : soutenable seulement si le décodage est réservé au Pass achat 29 € ou déclenché sur demande explicite de l'utilisateur, pas systématique sur le score gratuit.

### Points à vérifier avant tout abonnement

1. **Taux de remplissage du champ `Engine Code` sur un panel de 15-20 VIN français réels** (PSA/Renault anciens et récents, hybrides, utilitaires) — c'est LE critère ; un champ présent dans le schéma mais vide sur les marques françaises disqualifie l'offre.
2. **Droit d'affichage** : les CGU autorisent-elles la restitution des données décodées dans un rapport public partageable (`/a/:id`) ? Y a-t-il une clause d'interdiction de revente/redistribution ou une attribution obligatoire ? (Non trouvé dans les pages publiques Vincario — à demander par écrit.)
3. **Facturation des échecs** : Vincario ne facture pas les VIN invalides, CarsXE ne facture que les 200 OK — obtenir la même garantie par écrit chez DAT (« transmission réussie » : que se passe-t-il si le constructeur renvoie un dossier partiel ?).
4. **Latence réelle** en appel depuis une edge function Supabase (aucun des trois ne publie de latence chiffrée) — le budget d'Inspexo est serré (premier contenu < 7 s).
5. **RGPD** : le VIN d'un véhicule d'occasion peut être une donnée personnelle indirecte ; exiger un DPA (Vincario : UE, simple ; CarsXE : US, clauses de transfert ; DAT : contrats OEM, cadre déjà RGPD).
6. **Pour DAT spécifiquement** : l'API d'identification VIN est-elle contractable seule (sans licence logiciel SilverDAT complète), à quel prix français, avec quel engagement minimum, et avec quel droit de réaffichage des libellés d'équipements constructeur dans un produit grand public ?
7. **Pour Vincario** : obtenir le devis du produit **OEM VIN Lookup** (équipements usine) — s'il est nettement moins cher que DAT, il pourrait couvrir le besoin « équipements » sans contrat B2B lourd.
