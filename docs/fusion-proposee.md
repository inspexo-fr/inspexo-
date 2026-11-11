# Fusion des sources confirmées — proposition à relire avant toute écriture

Généré le 2026-11-11 par `scripts/fusionner-sources.mjs` (simulation : rien n’est écrit). Fiches lues dans un export en lecture seule de `defect_sheets`.

**Règles** (décisions du 11 nov. 2026) : seules les URL que le juge a déclarées « soutenue » ET de rang portant · une source n’est **ajoutée à une panne existante** que si l’affirmation désigne le **même organe ET le même défaut**, et une seule panne de la fiche ; tout cas douteux devient une **nouvelle panne proposée** · une nouvelle panne n’est écrite que si **la source établit sa gravité** (montant publié ou danger écrit dans un extrait d’une page confirmée), jamais promue en « casse » sans montant · aucune affirmation à **période bornante** n’est écrite (champ d’années à venir) · les **prises en charge** sont affichées seulement · les moteurs sans fiche restent de côté.

**Totaux** : 22 ajouts de sources à des pannes existantes · 1 nouvelles pannes · 116 prises en charge (94 avec source française) · 3 opérations d’entretien · 833 parties non écrites.

## 1. Sources ajoutées à des pannes EXISTANTES

| Fiche | Panne existante | Affirmation (partie confirmée) | Rapprochement | URL ajoutées | Portée avant |
|---|---|---|---|---|---|
| Renault H5FT | Surconsommation d'huile liée à la segmentation des pistons, pouvant conduire à la casse moteur | Surconsommation d'huile pouvant aller jusqu'à la casse moteur (même défaut de segmentation / pression collecteur que le 1.2 TCe) (A-NISSAN-HR12DDT-01 — famille corrigée : l'article parle du 1.2 DIG-T, c'est-à-dire le H5Ft, pas du HR12DDT) | même organe principal (consommation_huile) et même défaut (rupture, consommation) | https://www.largus.fr/actualite-automobile/renault-12-tce-et-nissan-12-dig-t-des-moteurs-gourmands-en-huile-8196384.html | oui |
| Peugeot EB2 | Courroie de distribution en bain d'huile (wet belt) qui se désagrège | Dégradation prématurée de la courroie de distribution immergée dans l'huile (débris vers pompe à vide et circuit d'huile) (B-PSA-EB2-01) | même organe principal (courroie_distribution) et même défaut (usure) | https://www.largus.fr/actualite-automobile/moteur-12-puretech-psa-quand-remplacer-la-courroie-de-distribution-10590390.html | oui |
| BMW N47 | Usure et rupture de la chaîne de distribution arrière | Chaîne de distribution N47: le défaut est repris modèle par modèle dans les fiches fiabilité Caradisiac (tendeur ou guide de chaîne usé, chaîne qui s'allonge, se décale ou casse) (E-BMW-N47-10) | même organe principal (chaine_distribution) et même défaut (rupture, usure) | https://www.caradisiac.com/fiabilite-de-la-bmw-serie-3-f30-la-maxi-fiche-occasion-de-caradisiac-172002.htm | oui |
| Peugeot DV6 | Défaillance / fuite des injecteurs | Injecteurs: fonctionnement irrégulier, grippages, à-coups et pertes de puissance; fuites aux joints d'injecteurs (D-FORD-1.5-1.6-TDCI-01) | même organe principal (injecteurs) et même défaut (fuite) | https://www.caradisiac.com/que-vaut-le-ford-c-max-2-en-occasion-la-fiche-fiabilite-express-de-caradisiac-222571.htm | **non → portée** |
| Peugeot DV6 | Usure prématurée du volant moteur bi-masse | Volant moteur bimasse bruyant ou usé et butée d'embrayage détruite (1.6 HDi) (B-PSA-DV6-13) | même organe principal (embrayage) et même défaut (usure) | https://www.largus.fr/actualite-automobile/voiture-d-occasion-quel-citroen-c4-picasso-acheter-2530370_p_2.html | **non → portée** |
| Peugeot DW10 | Casse de l'axe de la pompe haute pression | 2.0 BlueHDi: calage en roulant par casse de l'axe de la pompe haute pression (B-PSA-DW10-11) | même organe principal (pompe_hp) et même défaut (rupture) | https://www.largus.fr/guide-achat-occasion/peugeot/3008/avis-fiabilite-peugeot-3008-ii-30039638.html | **non → portée** |
| Renault H5FT | Usure prématurée de la chaîne de distribution, tendeur et déphaseurs d'arbre à cames | Chaîne de distribution: allongement (A-RENAULT-H5FT-03#1) | même organe principal (chaine_distribution) et même défaut (usure) | https://www.largus.fr/actualite-automobile/consommation-anormale-dhuile-la-liste-des-moteurs-a-risque-8672389.html | **non → portée** |
| Renault H5FT | Usure prématurée de la chaîne de distribution, tendeur et déphaseurs d'arbre à cames | Chaîne de distribution: rupture liée au manque d'huile (A-RENAULT-H5FT-03#4) | même organe principal (chaine_distribution) et même défaut (rupture) | https://www.largus.fr/actualite-automobile/consommation-anormale-dhuile-la-liste-des-moteurs-a-risque-8672389.html | **non → portée** |
| Peugeot EP6 | Allongement puis casse de la chaîne de distribution | Chaîne de distribution: tous les moteurs essence de la Mini II connaissent le problème (tendeur qui ne compense pas l'allongement, chaînes allongées) (E-BMW-N12-N16-01) | même organe principal (chaine_distribution) et même défaut (usure) | https://www.caradisiac.com/maxi-fiche-fiabilite-mini-ii-fruits-a-pepins-203638.htm | **non → portée** |
| Peugeot EP6 | Consommation d'huile excessive | Consommation d'huile (toutes les Mini essence) et fuites récurrentes de pompe à eau, en particulier sur la Cooper 120/122 ch (E-BMW-N12-N16-02) | même organe principal (consommation_huile) et même défaut (consommation) | https://www.caradisiac.com/maxi-fiche-fiabilite-mini-ii-fruits-a-pepins-203638.htm | **non → portée** |
| Peugeot DV5 | Casse de la chaîne interne d'entraînement des arbres à cames | Usure prématurée puis rupture de la chaîne d'arbres à cames (chaîne de 7 mm), jusqu'à la casse moteur (B-PSA-DV5-01) | même organe principal (chaine_distribution) et même défaut (rupture) | https://www.quechoisir.org/actualite-moteur-diesel-1-5-bluehdi-de-stellantis-la-grogne-monte-n132914/ | oui |
| Peugeot DV5 | Pannes du système de dépollution AdBlue (SCR) : cristallisation d'urée, réservoir/injecteur à remplacer | Défaillance du réservoir d'AdBlue (module pompe/jauge d'urée oxydé ou grippé): « Défaut antipollution (B-PSA-DV5-08#1) | rattachement décidé à la relecture : la panne existante couvre déjà le réservoir : ajout de source, pas une nouvelle panne | https://www.largus.fr/actualite-automobile/fiabilite-bluehdi-occasion-tout-savoir-sur-les-defauts-du-reservoir-d-uree-30028913.html | oui |
| Peugeot DV5 | Pannes du système de dépollution AdBlue (SCR) : cristallisation d'urée, réservoir/injecteur à remplacer | Défaillance du réservoir d'AdBlue (module pompe/jauge d'urée oxydé ou grippé): démarrage interdit dans XXXX km » (B-PSA-DV5-08#2) | rattachement décidé à la relecture : la panne existante couvre déjà le réservoir : ajout de source, pas une nouvelle panne | https://www.largus.fr/actualite-automobile/fiabilite-bluehdi-occasion-tout-savoir-sur-les-defauts-du-reservoir-d-uree-30028913.html | oui |
| Volkswagen EA189 | Vanne EGR encrassée ou défaillante | Vanne EGR et radiateur EGR: encrassement (pertes de puissance, fumées noires, à-coups) (C-VAG-EA189-1.6-2.0TDI-06#1) | même organe principal (egr) et même défaut (encrassement) | https://www.largus.fr/actualite-automobile/fiabilite-volkswagen-les-problemes-du-moteur-diesel-16-tdi-6411386.html | oui |
| Volkswagen EA189 | Pompe à eau prématurément défaillante | Pompe à eau: fuite et perte de liquide de refroidissement (son remplacement impose celui de la courroie de distribution) (C-VAG-EA189-1.6-2.0TDI-07) | même organe principal (pompe_eau) et même défaut (fuite) | https://www.caradisiac.com/fiabilite-de-la-volkswagen-passat-7-la-maxi-fiche-occasion-de-caradisiac-163107.htm | **non → portée** |
| Volkswagen EA189 | Volant moteur bi-masse défaillant | Volant moteur bimasse: casse ou usure prématurée (parfois avant 55 000-70 000 km) (C-VAG-EA189-1.6-2.0TDI-08#1) | même organe principal (embrayage) et même défaut (usure) | https://www.caradisiac.com/fiabilite-du-volkswagen-touran-2-la-maxi-fiche-occasion-de-caradisiac-167738.htm | **non → portée** |
| BMW N13 | Usure prématurée de la chaîne de distribution | Tendeur de chaîne de distribution: la chaîne saute et pistons et soupapes se rencontrent (casse moteur) (E-BMW-N13-01#2) | même organe principal (chaine_distribution) et même défaut (rupture) | https://www.autobild.de/artikel/bmw-1er-gebrauchtwagen-test-14695647.html | **non → portée** |
| BMW N13 | Défaillances du circuit de refroidissement (pompe à eau, thermostat, raccords plastiques) | Fuites de liquide de refroidissement très fréquentes sur les quatre-cylindres essence, venant le plus souvent de la pompe à eau additionnelle (E-BMW-N13-04) | même organe principal (refroidissement) et même défaut (fuite) | https://www.caradisiac.com/fiabilite-de-la-bmw-serie-1-f20-f21-2011-la-maxi-fiche-occasion-de-caradisiac-184091.htm | **non → portée** |
| Ford FOX | Courroie de distribution humide (wet belt) qui se désagrège et bouche la crépine d'huile | Dégradation de la courroie de distribution humide (baignant dans l'huile): débris obstruant la crépine/pompe à huile (D-FORD-1.0-ECOBOOST-01#1) | même organe principal (courroie_distribution) et même défaut (usure, encrassement) | https://www.caradisiac.com/que-vaut-le-ford-c-max-2-en-occasion-la-fiche-fiabilite-express-de-caradisiac-222571.htm | **non → portée** |
| Ford FOX | Courroie de distribution humide (wet belt) qui se désagrège et bouche la crépine d'huile | Dégradation de la courroie de distribution humide (baignant dans l'huile): perte de pression d'huile (D-FORD-1.0-ECOBOOST-01#2) | même organe principal (courroie_distribution) et même défaut (usure) | https://www.caradisiac.com/que-vaut-le-ford-c-max-2-en-occasion-la-fiche-fiabilite-express-de-caradisiac-222571.htm | **non → portée** |
| Ford FOX | Courroie de distribution humide (wet belt) qui se désagrège et bouche la crépine d'huile | Dégradation de la courroie de distribution humide (baignant dans l'huile): casse moteur (D-FORD-1.0-ECOBOOST-01#3) | même organe principal (courroie_distribution) et même défaut (usure) | https://www.caradisiac.com/que-vaut-le-ford-c-max-2-en-occasion-la-fiche-fiabilite-express-de-caradisiac-222571.htm | **non → portée** |
| Ford FOX | Durite de dégazage / circuit de refroidissement fragile (millésimes 2012-2014) | Durites/flexibles de refroidissement fragiles (flexible de purge turbo–vase d'expansion): surchauffe (D-FORD-1.0-ECOBOOST-04#2) | même organe principal (refroidissement) et même défaut (surchauffe) | https://www.caradisiac.com/maxi-fiche-fiabilite-que-vaut-la-ford-focus-3-en-occasion-106907.htm | **non → portée** |

## 1 bis. Rappels réécrits (décision de relecture)

| Fiche | Panne | Rappel | Libellé affiché | Source | Juge | RappelConso |
|---|---|---|---|---|---|---|
| Audi EA824 | Défaillance des turbocompresseurs par colmatage de la crépine d'huile | 21H7, production 2012-2017 | « campagne constructeur mondiale 21H7 (production 2012–2017), éligibilité à vérifier par le VIN » | https://www.auto-motor-und-sport.de/verkehr/rueckruf-audi-verstopfte-turbos/ (remplace autodoc, forum rs246, NHTSA) | panne soutenue (2 voix sur 2) · campagne soutenue (2 voix sur 2) | aucune campagne française trouvée (recherche A6, S6, A7, S7, A8, RS7 ; turbo, huile, crépine) le 11 nov. 2026 |

## 2. NOUVELLES pannes proposées

| Fiche | Titre (une panne = un défaut) | Organe · défaut | Gravité | Établie par | Pourquoi pas un ajout | Panne voisine déjà en fiche | URL |
|---|---|---|---|---|---|---|---|
| Peugeot DV6 | Défaillance du réservoir d'AdBlue (module pompe/jauge d'urée oxydé ou grippé) (B-PSA-DV6-09#1, B-PSA-DV6-09#2) | adblue · grippage | **majeure** (750-1200 €) | montant publié : 750-1200 € | aucune panne de la fiche sur cet organe | — | https://www.largus.fr/actualite-automobile/fiabilite-bluehdi-occasion-tout-savoir-sur-les-defauts-du-reservoir-d-uree-30028913.html |

## 3. Prises en charge (affichage seulement, aucun effet sur la note)

| Fiche | Type | Texte | Période | Pays | URL |
|---|---|---|---|---|---|
| Renault H5FT | campagne | Pas de rappel imposé: reprogrammation Nissan du module de gestion moteur (réponses ministérielles, Que Choisir) | 2020-2021 | FR | https://www.assemblee-nationale.fr/dyn/15/questions/QANR5L15QE26444.pdf |
| Renault H5FT | campagne | Pas de rappel imposé: prise en charge financière au cas par cas (réponses ministérielles, Que Choisir) | 2020-2021 | FR | https://www.assemblee-nationale.fr/dyn/15/questions/QANR5L15QE26444.pdf |
| Peugeot EB2 | garantie | Extension de garantie Stellantis 10 ans / 175 000 km (courroie de distribution et surconsommation d'huile), en place | depuis mars 2024 | BE/FR/UK | https://www.caradisiac.com/le-moteur-puretech-profite-d-une-extension-de-garantie-208069.htm |
| Peugeot EB2 | campagne | Plate-forme d'indemnisation rétroactive Stellantis (stellantis-support.com), ouverte | le 16 janvier 2025 | BE/FR/UK | https://www.largus.fr/actualite-automobile/moteur-1-2-puretech-stellantis-lancera-bientot-une-plate-forme-d-indemnisation-30037499.html |
| Peugeot EB2 | rappel | Rappels courroie de distribution / pompe à vide (perte d'assistance de freinage): campagnes | de novembre 2020, août 2021, décembre 2022 et décembre 2023 | FR | https://www.largus.fr/actualite-automobile/moteur-12-puretech-psa-quand-remplacer-la-courroie-de-distribution-10590390.html |
| Peugeot EB2 | rappel | Rappel gicleurs de refroidissement par jet d'huile (1.2 PureTech 82 ch): véhicules en France | — | FR | https://journalauto.com/constructeurs/puretech-stellantis-doit-rappeler-68-000-voitures/ |
| Peugeot EB2 | rappel | Rappel gicleurs de refroidissement par jet d'huile (1.2 PureTech 82 ch): risque de départ de feu | — | FR | https://journalauto.com/constructeurs/puretech-stellantis-doit-rappeler-68-000-voitures/ |
| Peugeot EB2 | campagne | Actions judiciaires PureTech: action collective et plaintes pénales (UFC-Que Choisir) | — | FR | https://journalauto.com/constructeurs/moteurs-1-2-puretech-pres-de-900-automobilistes-portent-plainte-contre-stellantis/ |
| Renault K9K | campagne | Actions en atelier Renault/Dacia/Nissan sur la courroie de distribution 1.5 dCi — non assimilées à un rappel | décembre 2011 | FR | https://www.largus.fr/actualite-automobile/courroie-de-distribution-des-ennuis-a-la-chaine-3823379_p_2.html |
| Renault K9K | campagne | Campagne de service Nissan (reprogrammation) sur Qashqai 1 1.5 dCi 110 contre la surchauffe du FAP | — | FR | https://www.largus.fr/actualite-automobile/nissan-qashqai-1-2007-2014-ca-sent-le-roussi-pour-le-fap-8310384.html |
| Renault K9K | rappel | Rappel: tous les Kadjar 1.5 dCi — reprogrammation de la gestion antipollution (et remplacement du piège à NOx) | octobre 2016 | FR | https://www.caradisiac.com/fiabilite-du-renault-kadjar-la-maxi-fiche-occasion-de-caradisiac-186486.htm |
| Renault K9K | rappel | Rappel (Dacia diesel): blocage de la clé de contact dans le barillet pouvant endommager le démarreur | janvier 2021 | FR | https://www.caradisiac.com/fiabilite-du-dacia-duster-2-la-maxi-fiche-occasion-de-caradisiac-195834.htm |
| Renault K9K | garantie | Prise en charge constructeur à 100 % (pièces et main-d'œuvre) de la pompe à urée AdBlue — véhicules de moins de 5 ans et de moins de 200 000 km | — | FR | https://www.largus.fr/actualite-automobile/renault-blue-dci-prise-en-charge-de-la-defaillance-du-reservoir-d-adblue-30029363.html |
| Renault K9K | rappel | Rappel (Captur): diesels Euro 6b — filtre à particules (avec piège à NOx) remplacé et pilotage reprogrammé | octobre 2016 | DE/FR | https://www.caradisiac.com/fiabilite-du-renault-captur-la-maxi-fiche-occasion-de-caradisiac-166405.htm |
| Renault K9K | garantie | Non-démarrage par givre du refroidisseur d'air (1.5 dCi / 1.6 dCi): réparations prises en charge par Renault hors garantie sur les véhicules de moins de 5 ans ou de moins de 150 000 km | — | FR | https://www.largus.fr/actualite-automobile/renault-15-dci-et-16-dci-probleme-de-demarrage-sur-les-diesels-9932390.html |
| Renault K9K | rappel | Rappel (Allemagne, relevé par l'ADAC) Nissan Juke 1.5 dCi: poulie de la pompe haute pression mal alignée — la courroie de distribution travaille de travers (calage moteur) | — | DE/FR | https://assets.adac.de/Autodatenbank/GWInfo/gw0420-nissan-juke-2010-2019-bericht.pdf |
| Renault K9K | rappel | Rappel (Allemagne, relevé par l'ADAC) Nissan Juke 1.5 dCi: s'use prématurément et peut casser (calage moteur) | — | DE/FR | https://assets.adac.de/Autodatenbank/GWInfo/gw0420-nissan-juke-2010-2019-bericht.pdf |
| Renault K9K | rappel | Rappel (Allemagne, relevé par l'ADAC) Nissan Juke turbo-diesel: support du capteur de pression de suralimentation mal laminé — fuite | — | DE (**contexte**) | https://assets.adac.de/Autodatenbank/GWInfo/gw0420-nissan-juke-2010-2019-bericht.pdf |
| Renault K9K | rappel | Rappel (Allemagne, relevé par l'ADAC) Nissan Juke turbo-diesel: signal faux | — | DE (**contexte**) | https://assets.adac.de/Autodatenbank/GWInfo/gw0420-nissan-juke-2010-2019-bericht.pdf |
| Renault K9K | rappel | Rappel (Allemagne, relevé par l'ADAC) Nissan Juke turbo-diesel: démarrage difficile et calage | — | DE (**contexte**) | https://assets.adac.de/Autodatenbank/GWInfo/gw0420-nissan-juke-2010-2019-bericht.pdf |
| Renault K9K | garantie | Consommation d'huile du 1.5 Blue dCi (K9K Gen8): remplacement du moteur selon une grille de prise en charge constructeur (« plan satisfaction client ») | 01/05/2018 – 14/03/2020 | FR | https://www.largus.fr/guide-achat-occasion/dacia/duster/avis-fiabilite-dacia-duster-ii-hjd-30038702.html |
| Peugeot EB2 | rappel | Hybride 48V: rappel pour risque d'incendie (filtre à particules essence trop proche du démarreur 48V) | mars 2026 | FR | https://www.quechoisir.org/actualite-stellantis-des-dizaines-de-milliers-de-voitures-concernees-par-plusieurs-rappels-n175390/ |
| Peugeot EB2 | rappel | Hybride 48V: véhicules en France | mars 2026 | FR | https://www.quechoisir.org/actualite-stellantis-des-dizaines-de-milliers-de-voitures-concernees-par-plusieurs-rappels-n175390/ |
| BMW N47 | campagne | Action technique BMW officieuse (sans courrier aux propriétaires): tendeur remplacé systématiquement | 2015 | FR | https://www.quechoisir.org/actualite-moteurs-diesel-bmw-toujours-aussi-fragiles-n7927/ |
| BMW N47 | campagne | Action technique BMW officieuse (sans courrier aux propriétaires): contrôle de l'allongement de la chaîne au-delà de 75 000 km et remplacement des chaînes si nécessaire — uniquement lors d'un passage dans le réseau | 2015 | FR | https://www.largus.fr/actualite-automobile/fiabilite-bmw-problemes-de-chaine-de-distribution-sur-le-20-diesel-6313385_p_2.html |
| BMW N47 | garantie | Prise en charge hors garantie de la chaîne de distribution: BMW dit prendre « généralement » les frais à sa charge si l'entretien a été scrupuleusement suivi | — | DE/FR | https://www.quechoisir.org/actualite-moteur-diesel-bmw-chaine-de-distribution-fragile-n11281/ |
| BMW N47 | garantie | Prise en charge hors garantie de la chaîne de distribution: mais participations variables (0 à 100 %) et refus fréquents | — | DE/FR | https://www.quechoisir.org/actualite-moteurs-diesel-bmw-la-galere-des-frais-de-reparation-n46060/ |
| BMW N47 | rappel | Rappels du réchauffeur de gazole / de filtre à carburant: chauffage permanent | — | DE (**contexte**) | https://www.adac.de/rund-ums-fahrzeug/auto-kaufen-verkaufen/gebrauchtwagenkauf/gebrauchtwageninfos/bmw-1er-reihe-31/ |
| BMW N47 | rappel | Rappels du réchauffeur de gazole / de filtre à carburant: batterie déchargée | — | DE (**contexte**) | https://www.adac.de/rund-ums-fahrzeug/auto-kaufen-verkaufen/gebrauchtwagenkauf/gebrauchtwageninfos/bmw-1er-reihe-31/ |
| BMW N47 | rappel | Rappels du réchauffeur de gazole / de filtre à carburant: échauffement du connecteur | — | DE (**contexte**) | https://www.adac.de/rund-ums-fahrzeug/auto-kaufen-verkaufen/gebrauchtwagenkauf/gebrauchtwageninfos/bmw-1er-reihe-31/ |
| BMW N47 | rappel | Rappel du refroidisseur EGR (fuite interne de liquide de refroidissement → dépôts inflammables, dégâts au collecteur d'admission, risque d'incendie) — moteur N47T nommé par le bulletin BMW déposé à la NHTSA (rappel 18V-755) | — | CA/UK/US (**contexte**) | https://static.nhtsa.gov/odi/rcl/2018/RCRIT-18V755-0780.pdf |
| BMW N47 | rappel | Rappels: défaut au niveau de l'arbre à cames privant la pompe à vide de lubrification → perte possible de l'assistance au freinage | de septembre 2013 et octobre 2014 | FR | https://www.caradisiac.com/bmw-x1-e84-2009-2015-la-fiche-fiabilite-express-de-caradisiac-195148.htm |
| BMW N47 | rappel | Rappels: pose d'un anneau de verrouillage | de septembre 2013 et octobre 2014 | FR | https://www.caradisiac.com/bmw-x1-e84-2009-2015-la-fiche-fiabilite-express-de-caradisiac-195148.htm |
| Peugeot DV6 | campagne | Rappels Fiesta 1.6 TDCi: remplacement du FAP non conforme | 9 avril–12 mai 2010 | FR | https://www.caradisiac.com/Maxi-fiche-fiabilite-que-vaut-la-Ford-Fiesta-5-en-occasion-95446.htm |
| Peugeot DV6 | campagne | Rappels Fiesta 1.6 TDCi: canalisation de gazole | 9 avril–12 mai 2010 | FR | https://www.caradisiac.com/Maxi-fiche-fiabilite-que-vaut-la-Ford-Fiesta-5-en-occasion-95446.htm |
| Peugeot DV6 | campagne | Rappels Fiesta 1.6 TDCi: goujons de support moteur | 9 avril–12 mai 2010 | FR | https://www.caradisiac.com/Maxi-fiche-fiabilite-que-vaut-la-Ford-Fiesta-5-en-occasion-95446.htm |
| Peugeot DV6 | garantie | Prise en charge Stellantis du réservoir d'AdBlue: 100 % des pièces avant 5 ans ou 150 000 km | depuis janvier 2025 | FR | https://www.largus.fr/guide-achat-occasion/peugeot/2008/avis-fiabilite-peugeot-2008-i-30038970.html |
| Peugeot DV6 | garantie | Prise en charge Stellantis du réservoir d'AdBlue: dégressive de 5 à 8 ans jusqu'à 210 000 km | depuis janvier 2025 | FR | https://www.largus.fr/guide-achat-occasion/peugeot/2008/avis-fiabilite-peugeot-2008-i-30038970.html |
| Peugeot DV6 | rappel | C4 Cactus diesel: rappel d' pour risque de fuite d'huile du turbo sur des pièces chaudes | avril 2016 | FR | https://www.caradisiac.com/fiabilite-de-la-citroen-c4-cactus-la-maxi-fiche-occasion-de-caradisiac-191983.htm |
| Peugeot DV6 | rappel | Rappels 1.6 HDi: capteur de régime et gestion moteur du 110 ch (207) (307 1.6 HDi 110, rappel d') | juillet 2007 | FR | https://www.caradisiac.com/Peugeot-40287.htm |
| Peugeot DV6 | rappel | Rappels 1.6 HDi: gestion électronique de la vanne EGR (207 et 307) (307 1.6 HDi 110, rappel d') | juillet 2007 | FR | https://www.caradisiac.com/Peugeot-40133.htm |
| Peugeot DW10 | campagne | Rappel: reprogrammation et élargissement des tolérances du module de gestion moteur (2.0 TDCi) | octobre 2014 | FR | https://www.caradisiac.com/fiabilite-du-ford-kuga-2-la-maxi-fiche-occasion-de-caradisiac-112283.htm |
| Peugeot DW10 | garantie | Prise en charge Stellantis du réservoir d'AdBlue: 100 % des pièces avant 5 ans ou 150 000 km | depuis janvier 2025 | FR | https://www.largus.fr/guide-achat-occasion/citroen/c5-aircross/avis-fiabilite-citroen-c5-aircross-i-30038717.html |
| Peugeot DW10 | garantie | Prise en charge Stellantis du réservoir d'AdBlue: dégressive de 5 à 8 ans jusqu'à 210 000 km | depuis janvier 2025 | FR | https://www.largus.fr/guide-achat-occasion/citroen/c5-aircross/avis-fiabilite-citroen-c5-aircross-i-30038717.html |
| Peugeot DW10 | rappel | 2.0 BlueHDi: risque de fissuration du filtre à particules — rappel devéhicules en France | mars 2023 | FR | https://www.largus.fr/actualite-automobile/moteur-2-0-bluehdi-des-fap-a-remplacer-chez-citroen-ds-opel-peugeot-30025875.html |
| Peugeot DW10 | rappel | 2.0 HDi 163: autres rappels 2.0 HDi sur 308 (pompe à vide, tuyau de carburant) | de décembre 2012 | FR | https://www.largus.fr/actualite-automobile/voiture-d-occasion-quelle-peugeot-308-acheter-2360367.html |
| Peugeot DW10 | rappel | Rappel (307 2.0 HDi 90/110): Xsara Picasso 2.0 HDi 90: défaut du réservoir de carburant | jusqu'en juin 2001 | FR | https://www.caradisiac.com/Fiabilite-45721.htm |
| Renault H5FT | rappel | Rappel: reprogrammation des calculateurs d'injection et UPC (risque de dépression insuffisante au collecteur) sur Mégane 3 / Scénic 3 TCe 115 | septembre 2012 | DE/FR | https://www.caradisiac.com/Maxi-fiche-fiabilite-que-vaut-la-Renault-Megane-3-en-occasion-105588.htm |
| Renault H5FT | campagne | Pas de rappel officiel: nouvelle calibration | juin 2015 | FR | https://www.assemblee-nationale.fr/dyn/15/questions/QANR5L15QE26444.pdf |
| Renault H5FT | campagne | Contentieux collectif « Motorgate »: action collective | 2022 | FR | https://www.largus.fr/actualite-automobile/fiabilite-1-2-tce-et-1-2-puretech-les-associations-de-victimes-interpellent-emmanuel-macron-30031466.html |
| Renault H5FT | campagne | Contentieux collectif « Motorgate »: référé ordonnant la communication de documents internes (appel Renault) | 2022 | FR | https://www.largus.fr/actualite-automobile/fiabilite-1-2-tce-et-1-2-puretech-les-associations-de-victimes-interpellent-emmanuel-macron-30031466.html |
| Renault H5FT | campagne | Contentieux collectif « Motorgate »: plainte pénale à Nanterre | 2022 | FR | https://www.largus.fr/actualite-automobile/fiabilite-1-2-tce-et-1-2-puretech-les-associations-de-victimes-interpellent-emmanuel-macron-30031466.html |
| Renault H5FT | garantie | OTS Renault/Dacia: remplacement du moteur si consommation > 0,5 l/1 000 km (au premier terme échu) | octobre 2018 | FR | https://www.largus.fr/actualite-automobile/consommation-dhuile-nissanrenault-12-tce-creation-dun-collectif-9704390.html |
| Renault H5FT | garantie | OTS Renault/Dacia: pour les véhicules de moins de 10 ans ou de 100 000 km (au premier terme échu) | octobre 2018 | FR | https://www.largus.fr/actualite-automobile/consommation-dhuile-nissanrenault-12-tce-creation-dun-collectif-9704390.html |
| Mini N18 | rappel | Rappel: la pompe à eau auxiliaire (refroidissement du turbo) peut surchauffer — risque d'incendie du circuit électrique | de janvier 2012 | DE/FR/UK | https://assets.adac.de/Autodatenbank/GWInfo/gw0162-mini-mini-2006-2015-bericht.pdf |
| Mini N18 | rappel | Rappel: environ Cooper S et JCW en France | de janvier 2012 | DE/FR/UK | https://www.caradisiac.com/maxi-fiche-fiabilite-mini-ii-fruits-a-pepins-203638.htm |
| Mini N18 | rappel | Rappel d': souci de sonde de température du liquide de refroidissement (pouvant générer des particules métalliques) | août 2012 | FR | https://www.caradisiac.com/maxi-fiche-fiabilite-mini-ii-fruits-a-pepins-203638.htm |
| Mini N18 | rappel | Rappel d': remplacement du tuyau de refroidissement par un modèle à sonde intégrée — Mini essence selon Caradisiac | août 2012 | FR | https://www.caradisiac.com/maxi-fiche-fiabilite-mini-ii-fruits-a-pepins-203638.htm |
| Mini N18 | rappel | Rappel d': le boîtier de la pompe à eau auxiliaire peut se fissurer | avril 2012 | FR | https://www.caradisiac.com/mini-clubman-2007-2014-la-fiche-fiabilite-express-de-caradisiac-194613.htm |
| Mini N18 | rappel | Rappel d': remplacement du boîtier | avril 2012 | FR | https://www.caradisiac.com/mini-clubman-2007-2014-la-fiche-fiabilite-express-de-caradisiac-194613.htm |
| Peugeot DV5 | garantie | Couverture spéciale chaîne 1.5 BlueHDi: 5 ans/150 000 km | 2022 | FR | https://www.largus.fr/actualite-automobile/1-5-bluehdi-stellantis-rappelle-630-000-vehicules-et-etend-la-couverture-a-10-ans-30041132.html |
| Peugeot DV5 | garantie | Couverture spéciale chaîne 1.5 BlueHDi: 7 ans/180 000 km | 2022 | FR | https://www.largus.fr/actualite-automobile/1-5-bluehdi-stellantis-rappelle-630-000-vehicules-et-etend-la-couverture-a-10-ans-30041132.html |
| Peugeot DV5 | garantie | Couverture spéciale chaîne 1.5 BlueHDi: puis 10 ans/240 000 km | 2022 | FR | https://www.largus.fr/actualite-automobile/1-5-bluehdi-stellantis-rappelle-630-000-vehicules-et-etend-la-couverture-a-10-ans-30041132.html |
| Peugeot DV5 | rappel | Campagnes chaîne 1.5 BlueHDi: « mise à jour préventive » (plus de 760 000 courriers) | de septembre 2024 | FR | https://www.largus.fr/actualite-automobile/casse-chaine-1-5-bluehdi-pas-de-plate-forme-d-indemnisation-pour-le-moment-30038450.html |
| Peugeot DV5 | rappel | Campagnes chaîne 1.5 BlueHDi: puis rappel avec diagnostic audio | de septembre 2024 | FR | https://www.largus.fr/actualite-automobile/1-5-bluehdi-stellantis-rappelle-630-000-vehicules-et-etend-la-couverture-a-10-ans-30041132.html |
| Peugeot DV5 | rappel | Rappel pompe à eau (poulie pouvant glisser sur son axe et désaligner la courroie de distribution): véhicules en France | — | FR | https://www.largus.fr/actualite-automobile/rappel-stellantis-plus-de-13-000-vehicules-1-5-bluehdi-concernes-par-un-probleme-de-pompe-a-eau-30046287.html |
| Peugeot DV5 | rappel | Rappel rampe d'injection commune (risque de fuite de gazole): véhicules en France | — | FR | https://www.largus.fr/actualite-automobile/1-5-bluehdi-stellantis-rappelle-plusieurs-milliers-de-vehicules-pour-un-probleme-a-l-injection-30045923.html |
| Peugeot DV5 | rappel | Rappel risque de calage en roulant — 1.5 BlueHDi 130 EAT8 (logiciel moteur): véhicules en France | — | FR | https://www.largus.fr/actualite-automobile/citroen-ds-peugeot-un-rappel-pour-les-risques-de-calage-du-1-5-bluehdi-eat8-30025965.html |
| Peugeot DV5 | garantie | Prise en charge Stellantis du réservoir d'AdBlue: 100 % des pièces avant 5 ans ou 150 000 km | depuis janvier 2025 | FR | https://www.largus.fr/guide-achat-occasion/citroen/c5-aircross/avis-fiabilite-citroen-c5-aircross-i-30038717.html |
| Peugeot DV5 | garantie | Prise en charge Stellantis du réservoir d'AdBlue: dégressive de 5 à 8 ans jusqu'à 210 000 km | depuis janvier 2025 | FR | https://www.largus.fr/guide-achat-occasion/citroen/c5-aircross/avis-fiabilite-citroen-c5-aircross-i-30038717.html |
| Volkswagen EA189 | rappel | Dieselgate – rappel EA189: mise à jour logicielle (1.2 et 2.0 TDI) | — | AT/DE/ES/FR | https://www.volkswagen.at/information-zu-ea189-dieselmotoren |
| Volkswagen EA189 | rappel | Dieselgate – rappel EA189: logiciel + « transformateur de flux » devant le débitmètre (1.6 TDI) | — | AT/DE/ES/FR | https://www.volkswagen.at/information-zu-ea189-dieselmotoren |
| Volkswagen EA189 | rappel | Dieselgate – rappel EA189: gratuit | — | AT/DE/ES/FR | https://www.volkswagen.at/information-zu-ea189-dieselmotoren |
| Volkswagen EA189 | rappel | Dieselgate – rappel EA189: validé par le KBA;véhicules en France | — | AT/DE/ES/FR | https://annualreport2016.volkswagenag.com/group-management-report/diesel-issue/eu28-and-rest-of-the-world/print.html |
| Volkswagen EA189 | garantie | « Mesure de confiance » VW après la mise à jour EA189: prise en charge de composants EGR / injection / post-traitement pendant 24 mois après l'intervention | — | AT/FR/UK | https://www.volkswagen.at/information-zu-ea189-dieselmotoren |
| Volkswagen EA189 | garantie | « Mesure de confiance » VW après la mise à jour EA189: jusqu'à 250 000 km | — | AT/FR/UK | https://www.volkswagen.at/information-zu-ea189-dieselmotoren |
| Volkswagen EA189 | rappel | Rappel des conduites haute pression de carburant du 2.0 TDI common rail (fissures par vibrations → fuite de gazole) | — | DE (**contexte**) | https://www.autobild.de/artikel/vw-golf-vi-gebrauchtwagen-test-3798221.html |
| Volkswagen EA189 | rappel | Rappel: commutateur magnétique du démarreur (ressort de rappel cassé → alimentation permanente, surchauffe, risque d'incendie) – 1.6 / 2.0 TDI | février-mars 2018 | DE/FR | https://assets.adac.de/Autodatenbank/GWInfo/gw0174-vw-golf-vi-2008-2012-diesel-bericht.pdf |
| Volkswagen EA189 | rappel | Rappel: 1.2 TDI 75 common rail – vibrations transmises au couvercle du filtre à carburant (risque de fuite de gazole) | novembre 2014 | DE/FR | https://www.caradisiac.com/soyez-prudents-si-vous-achetez-une-seat-ibiza-4-en-occasion-218738.htm |
| Ford FOX | campagne | Enquête NHTSA (Engineering Analysis) sur la courroie de distribution humide; Ford réduit l'intervalle US de 150 000 miles/10 ans à 100 000 miles/6 ans | — | DE (**contexte**) | https://www.auto-motor-und-sport.de/verkehr/nhtsa-sieht-unzumutbares-risiko-ford-oelzahnriemen-kann-motor-lahmlegen/ |
| Ford FOX | campagne | Rappel NHTSA 23V905 / Ford 23S64 (USA): tendeur et courroie d'entraînement de la pompe à huile — perte de pression d'huile | — | UK/US (**contexte**) | https://www.consumerreports.org/cars/car-recalls-defects/ford-ecosport-and-focus-recalled-for-engine-issues-a8600857471 |
| Ford FOX | campagne | Rappel: risque de fuite d'huile moteur | véhicules produits du 2 août 2019 | FR | https://www.caradisiac.com/maxi-fiche-fiabilite-ford-fiesta-vi-exempte-de-gros-reproches-204603.htm |
| Ford DRAGON | campagne | Rappel: plateau de pression d'embrayage pouvant se rompre (risque d'anomalie de transmission et d'incendie) — modèles EcoBoost à boîte manuelle | décembre 2019 | FR | https://www.caradisiac.com/fiabilite-de-la-ford-mondeo-4-la-maxi-fiche-occasion-de-caradisiac-190769.htm |
| Ford SIGMA | campagne | Rappel sécurité (UK: 15 200) — manque de liquide de refroidissement, surchauffe localisée de la culasse, fissure, fuite d'huile sous pression, risque d'incendie; pose d'un capteur de niveau de liquide | décembre 2021 | FR/UK | https://www.largus.fr/actualite-automobile/rappel-ford-16-ecoboostscti-risque-de-surchauffe-de-culasse-10799390.html |
| Hyundai G3LC | campagne | Rappel Hyundai 61DT02 (Safety Gate SR/01776/26): durite d'admission mal acheminée pouvant vibrer et se fissurer | — | FR | https://www.fiches-auto.fr/articles-auto/rappels-constructeurs/s-1296-rappels-hyundai.php |
| Hyundai G3LC | campagne | Rappel Hyundai 61DT02 (Safety Gate SR/01776/26): réduisant l'assistance au freinage | — | FR | https://www.fiches-auto.fr/articles-auto/rappels-constructeurs/s-1296-rappels-hyundai.php |
| Hyundai G3LC | campagne | Rappel 51DT07 (SR/03401/25): pompe à carburant interne défaillante -> impossibilité de démarrage ou perte de puissance | — | FR | https://www.ecologie.gouv.fr/sites/default/files/documents/rappels%202025.pdf |
| Hyundai G4FD | campagne | Rappel Kia SC176 (NHTSA 19V-120): surchauffe du catalyseur -> particules dans les cylindres -> dommages pistons | — | US (**contexte**) | https://static.nhtsa.gov/odi/rcl/2019/RCMN-19V120-3267.pdf |
| Hyundai G4FD | campagne | Rappel Kia SC176 (NHTSA 19V-120): rupture de bielle | — | US (**contexte**) | https://static.nhtsa.gov/odi/rcl/2019/RCMN-19V120-3267.pdf |
| Hyundai G4FD | campagne | Rappel Kia SC176 (NHTSA 19V-120): risque de calage ou d'incendie | — | US (**contexte**) | https://static.nhtsa.gov/odi/rcl/2019/RCMN-19V120-3267.pdf |
| Hyundai G4FD | campagne | Campagne d'amélioration Transports Canada 2021204: mise à jour du module de commande moteur pour détecter une panne imminente | — | CA (**contexte**) | https://recalls-rappels.canada.ca/fr/avis-rappel/numero-rappel-transports-canada-2021204 |
| Hyundai G4KD | campagne | Règlement collectif US (In re: Hyundai and Kia Engine Litigation): extension de garantie à vie TXXI + logiciel KSDS (Service Campaign 953, DTC P1326) | — | US (**contexte**) | https://static.nhtsa.gov/odi/tsbs/2020/MC-10178174-0001.pdf |
| Hyundai G4KD | campagne | Règlement collectif US (Engine Litigation II): garantie étendue 15 ans/150 000 miles + KSDS gratuit sur Theta II 2.4 MPI/MPI hybride (et Nu 2.0 GDI, Gamma 1.6 GDI) | 2022 | US (**contexte**) | https://www.kiamedia.com/us/en/media/pressreleases/19400/kia-america-and-hyundai-motor-america-resolve-engine-litigation |
| Hyundai G4KD | campagne | Rappel Hyundai 198 (dossier NHTSA EA21-003): inspection/remplacement moteur pour usure prématurée des coussinets de bielle (Theta II 2.4 MPI & hybride, Nu 2.0 GDI hybride, Gamma 1.6 GDI) | — | US (**contexte**) | https://static.nhtsa.gov/odi/inv/2021/INRD-EA21003-18044.pdf |
| Hyundai G4KD | campagne | Rappel Kia 230047 (France): contrôle des vibrations moteur et remplacement des moteurs à coussinets de bielle usés sur d'anciennes Optima Hybrid | sept. 2023 | FR | https://www.largus.fr/actualite-automobile/rappel-kia-optima-hybrid-des-moteurs-remplaces-sur-d-anciens-exemplaires-30029484.html |
| Mercedes OM651 | rappel | Rappel: le raccord de la conduite de dépression du servofrein peut casser — effort accru à la pédale | de juin-juillet 2017 | DE/FR | https://www.adac.de/rund-ums-fahrzeug/auto-kaufen-verkaufen/gebrauchtwagenkauf/gebrauchtwageninfos/mercedes-benz-a-klasse-276/ |
| Mercedes OM651 | rappel | Rappel: remplacement de la conduite | de juin-juillet 2017 | DE/FR | https://www.adac.de/rund-ums-fahrzeug/auto-kaufen-verkaufen/gebrauchtwagenkauf/gebrauchtwageninfos/mercedes-benz-a-klasse-276/ |
| Mercedes OM651 | campagne | Injecteurs piézoélectriques Delphi défaillants (défaut d'assemblage sur une série de pièces): remplacement des injecteurs dans le cadre d'une opération de satisfaction clientèle | — | DE/FR | https://www.largus.fr/actualite-automobile/mercedes-classe-c-classe-e-et-glk-rates-a-l-allumage-165454.html |
| Mercedes OM651 | campagne | Injecteurs piézoélectriques Delphi défaillants (défaut d'assemblage sur une série de pièces): sans rappel officiel | — | DE/FR | https://www.largus.fr/actualite-automobile/mercedes-classe-c-classe-e-et-glk-rates-a-l-allumage-165454.html |
| Mercedes OM651 | rappel | Rappel: joint défectueux du tendeur de chaîne de distribution — le tendeur peut tomber en panne | de janvier 2015 | DE/FR | https://assets.adac.de/image/upload/Autodatenbank/GWInfo/gw0358-mercedes-benz-c-klasse-2014-2023-diesel-bericht.pdf |
| Mercedes OM651 | rappel | Rappel: la chaîne détendue sauter et le moteur casser | de janvier 2015 | DE/FR | https://assets.adac.de/image/upload/Autodatenbank/GWInfo/gw0358-mercedes-benz-c-klasse-2014-2023-diesel-bericht.pdf |
| Mercedes OM651 | rappel | Rappel: remplacement du joint | de janvier 2015 | DE/FR | https://assets.adac.de/image/upload/Autodatenbank/GWInfo/gw0358-mercedes-benz-c-klasse-2014-2023-diesel-bericht.pdf |
| Mercedes OM651 | garantie | Tendeur de chaîne de distribution: Daimler a élargi à titre préventif sa période de geste commercial (Kulanz) et monte une pièce améliorée | — | DE (**contexte**) | https://www.autobild.de/artikel/mercedes-220-cdi-und-250-cdi-2795392.html |
| Mercedes OM651 | rappel | Rappel d': conduites haute pression de carburant des quatre-cylindres diesel — défaut de matière | avril 2016 | DE/FR | https://assets.adac.de/image/upload/Autodatenbank/GWInfo/gw0358-mercedes-benz-c-klasse-2014-2023-diesel-bericht.pdf |
| Mercedes OM651 | rappel | Rappel d': fissures et fuite de gazole possibles | avril 2016 | DE/FR | https://assets.adac.de/image/upload/Autodatenbank/GWInfo/gw0358-mercedes-benz-c-klasse-2014-2023-diesel-bericht.pdf |
| Mercedes OM651 | rappel | Rappel d': remplacement des conduites | avril 2016 | DE/FR | https://assets.adac.de/image/upload/Autodatenbank/GWInfo/gw0358-mercedes-benz-c-klasse-2014-2023-diesel-bericht.pdf |
| Mercedes OM651 | rappel | Rappel officiel ordonné par le KBA pour dispositifs d'invalidation illicites: la mesure de service volontaire devient un rappel obligatoire | juin 2018 | DE/FR | https://journalauto.com/constructeurs/mercedes-benz-contraint-de-rappeler-pres-de-800-000-vehicules-diesel-en-europe/ |
| Mercedes OM654 | rappel | Rappel: défaut d'étanchéité entre le circuit de refroidissement et le circuit de dépression au niveau de la pompe de refroidissement | janvier 2022 | FR | https://www.largus.fr/actualite-automobile/rappel-mercedes-un-correctif-suspendu-faute-de-pieces-de-rechange-10823393.html |
| Mercedes OM654 | rappel | Rappel: avec une fuite | janvier 2022 | FR | https://www.largus.fr/actualite-automobile/rappel-mercedes-un-correctif-suspendu-faute-de-pieces-de-rechange-10823393.html |
| Mercedes OM654 | rappel | Rappel: voire un incendie dans les cas les plus graves | janvier 2022 | FR | https://www.largus.fr/actualite-automobile/rappel-mercedes-un-correctif-suspendu-faute-de-pieces-de-rechange-10823393.html |
| Mercedes OM654 | rappel | Rappel: le bras du tendeur de courroie de la pompe à eau peut présenter un jeu trop important — risque de surchauffe du moteur | de novembre 2021 | FR | https://www.caradisiac.com/maxi-fiche-fiabilite-mercedes-classe-c-iv-le-fond-et-la-forme-200462.htm |
| Renault H4BT | rappel | Rappel (Twingo III): 9 987 versions TCe 90 — mauvaise calibration du calculateur d'injection | mars 2016 | FR | https://www.largus.fr/guide-achat-occasion/renault/twingo/avis-fiabilite-renault-twingo-iii-c07-30039496.html |
| Volvo D4204T | rappel | Rappel: le clapet anti-retour de la pompe à vide du système de freinage peut ne pas s'ouvrir par temps froid | de juin 2009 | DE (**contexte**) | https://www.adac.de/rund-ums-fahrzeug/auto-kaufen-verkaufen/gebrauchtwagenkauf/gebrauchtwageninfos/volvo-s70-v70-xc70-323/ |
| Volvo D4204T | rappel | Rappel: moteur froid — freinage plus dur | de juin 2009 | DE (**contexte**) | https://www.adac.de/rund-ums-fahrzeug/auto-kaufen-verkaufen/gebrauchtwagenkauf/gebrauchtwageninfos/volvo-s70-v70-xc70-323/ |
| Volvo D4204T | rappel | Rappel: air emprisonné lors du remplissage du liquide de refroidissement → refroidissement insuffisant de composants du moteur | de juillet 2020 | DE (**contexte**) | https://www.adac.de/rund-ums-fahrzeug/auto-kaufen-verkaufen/gebrauchtwagenkauf/gebrauchtwageninfos/volvo-s70-v70-xc70-323/ |
| Volvo D4204T | rappel | Rappel: pose d'un tuyau de purge | de juillet 2020 | DE (**contexte**) | https://www.adac.de/rund-ums-fahrzeug/auto-kaufen-verkaufen/gebrauchtwagenkauf/gebrauchtwageninfos/volvo-s70-v70-xc70-323/ |

## 4. Entretien (via `ajouter_plan`, additif)

| Fiche | Opération | km | ans | URL |
|---|---|---|---|---|
| Dacia K7M | Distribution par courroie sur les 1.4 et 1.6 MPI | 90000 | 4 | https://www.caradisiac.com/Maxi-fiche-fiabilite-que-vaut-la-Dacia-Logan-en-occasion-89871.htm |
| Ford FOX | Distribution | 240000 | 10 | https://www.caradisiac.com/fiabilite-du-ford-ecosport-la-maxi-fiche-occasion-de-caradisiac-182663.htm |
| Volvo D4204T | Distribution par courroie | 180000 | — | https://www.caradisiac.com/fiabilite-de-la-volvo-s60-v60-la-maxi-fiche-occasion-de-caradisiac-177865.htm |

## 5. Entrées d’atlas rattrapées (rejugement du 10 nov.)

- Condenseur de climatisation 308 I — https://www.fiches-auto.fr/fiabilite-peugeot/fiabilite-185-pannes-peugeot-308.php (à reporter dans `defectAtlas`, commit séparé contrôlé par `tests/atlas-source.test.mjs`)
- Suspension pneumatique arrière : compresseur et coussins — https://www.fiches-auto.fr/fiabilite-bmw/fiabilite-316-pannes-bmw-x5.php (à reporter dans `defectAtlas`, commit séparé contrôlé par `tests/atlas-source.test.mjs`)

## 6. Écart annoncé sur les 4 références

- **audi-s7-intermediaire (EA824)** : rappel réécrit sur « Défaillance des turbocompresseurs par colmatage de la crépine d'huile » : libellé « campagne constructeur mondiale 21H7 (production 2012–2017), éligibilité à vérifier par le VIN », sources remplacées par la page confirmée ; POIDS INCHANGÉ (code conservé, véhicule dans la plage de production) — rien qui pèse sur la note.
- **308-puretech-complete (EB2DTS, et EB2DT/EB2 compatibles)** : aucun changement de ce qui pèse sur la note (prises en charge ajoutées à l’affichage seulement).
- **mercedes-2025-societe (OM654)** : aucun changement de ce qui pèse sur la note (prises en charge ajoutées à l’affichage seulement).
- **revendeur-clio2-dci (K9K)** : aucun changement de ce qui pèse sur la note (prises en charge ajoutées à l’affichage seulement).

⇒ **Écart annoncé : aucun** — S7 rouge 39 · 308 orange 55 · Mercedes vert 73 · Clio II orange 51.

Hors références : **12 pannes deviennent portées** et **1 nouvelles pannes** entrent dans des fiches (Peugeot DW10, Peugeot EP6, Volkswagen EA189, Renault H5FT, Peugeot DV6, BMW N13, Ford FOX) : des scores réels de ces moteurs peuvent changer à texte identique ⇒ `BAREME_VERSION` 11.14 au moment de l’écriture.

  - Peugeot DW10 · Casse de l'axe de la pompe haute pression
  - Peugeot EP6 · Allongement puis casse de la chaîne de distribution
  - Peugeot EP6 · Consommation d'huile excessive
  - Volkswagen EA189 · Volant moteur bi-masse défaillant
  - Volkswagen EA189 · Pompe à eau prématurément défaillante
  - Renault H5FT · Usure prématurée de la chaîne de distribution, tendeur et déphaseurs d'arbre à cames
  - Peugeot DV6 · Défaillance / fuite des injecteurs
  - Peugeot DV6 · Usure prématurée du volant moteur bi-masse
  - BMW N13 · Usure prématurée de la chaîne de distribution
  - BMW N13 · Défaillances du circuit de refroidissement (pompe à eau, thermostat, raccords plastiques)
  - Ford FOX · Courroie de distribution humide (wet belt) qui se désagrège et bouche la crépine d'huile
  - Ford FOX · Durite de dégazage / circuit de refroidissement fragile (millésimes 2012-2014)

## 7. Parties NON écrites

- moteur sans fiche : 568
- période bornante : 67
- ni ajout ni nouvelle panne : défaut non identifié dans l’affirmation : 42
- nouvelle panne sans gravité établie : 37
- entretien sans intervalle écrit : 17
- plusieurs fiches, aucun code écrit : 14
- codes EA288 et CRBC écrits : pas de départage : 14
- ni ajout ni nouvelle panne : organe non identifié dans l’affirmation : 13
- codes EP6 et N18 écrits : pas de départage : 12
- autre moteur : la partie nomme une cylindrée : 11
- type verification : non fusionné : 10
- codes MR16DDT et MR20DE écrits : pas de départage : 9
- déjà citée par « Usure et rupture de la chaîne de distribution arrière » : 4
- affirmation « à confirmer » : 3
- déjà citée par « Allongement de la chaîne de distribution / usure du tendeur » : 3
- déjà citée par « Défaut du réservoir et de la pompe à urée AdBlue : 2
- codes OM607 et K9K écrits : pas de départage : 1
- retirée à la relecture : l'extrait parle du 1.4 MZ-CD : c'est le DV4, pas le DV6 : 1
- entretien : plusieurs intervalles écrits : 1
- retirée à la relecture : « usure de l'embrayage » : l'embrayage n'est pas le volant bimasse : 1
- codes N47 et B47 écrits : pas de départage : 1
- codes OM651 et OM654 écrits : pas de départage : 1
- retirée à la relecture : « quelques diesels » ne désigne pas ce moteur : 1
