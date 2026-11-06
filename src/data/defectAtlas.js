/**
 * INSPEXO — DEFECT ATLAS
 *
 * ⚠️ SPRINT 16 — CHAQUE ENTRÉE PORTE DÉSORMAIS SES SOURCES.
 * L'atlas a longtemps affiché des pannes sous la mention « source : base
 * Inspexo » — c'est-à-dire nous-mêmes. Depuis le sprint 15.1, une entrée sans
 * URL publique n'est plus affichée comme une panne. Les entrées ci-dessous ont
 * été sourcées par recherche web, chaque page a été relue par un passage
 * indépendant (le même que celui de /fiabilite), et toute entrée dont aucune
 * source n'a tenu a été RETIRÉE.
 *
 * Ne pas ajouter d'entrée sans `sources` : elle serait ignorée à l'affichage
 * et au score, et ne vaudrait qu'une question au vendeur.
 *
 * `gravite` suit le barème (securite / casse / majeure / mineure) et se juge
 * sur le REMÈDE, jamais sur la conséquence redoutée. `severity` est conservé
 * pour les écrans hérités.
 *
 * Relevé de sourcing : docs/atlas-sourcing-resultats.json (sprint 16, moteur)
 * et docs/atlas-hors-moteur-resultats.json (sprint 21, hors moteur).
 *
 * ⚠️ Une entrée dont AUCUNE page ne donne le coût est enregistrée en
 * `mineure`, même si son remède est manifestement cher : écrire « majeure »
 * sans avoir lu de fourchette serait affirmer un montant. L'entrée reste
 * affichée avec ses sources ; c'est la NOTE qu'on refuse de fonder sur rien.
 */

export const defectAtlas = {
  "BMW": {
    "label": "BMW",
    "logo": "/logos/bmw.svg",
    "defects": [
      {
        "id": "bmw-n47-chaine",
        "severity": "CRITIQUE",
        "title": "Chaîne de distribution N47 défaillante",
        "description": "Sur les moteurs diesel N47 (2007-2014), la chaîne de distribution placée côté boîte de vitesses peut s'étirer et casser. Réparation = dépose moteur. Coût constaté : 2 500 à 4 500€.",
        "models": "Série 1 (E81/E87), Série 3 (E90/E91), Série 5 (E60), X1, X3",
        "years": "2007-2014",
        "gravite": "majeure",
        "sources": [
          {
            "url": "https://www.quechoisir.org/actualite-moteur-diesel-bmw-chaine-de-distribution-fragile-n11281/",
            "title": "Moteur Diesel BMW - Chaîne de distribution fragile - Que Choisir"
          }
        ],
        "url_source": [
          "https://www.quechoisir.org/actualite-moteur-diesel-bmw-chaine-de-distribution-fragile-n11281/"
        ],
        "remede": "Remplacement du kit complet de chaîne de distribution (chaîne, pignons, tendeur et patins/guides), opération nécessitant la dépose de la boîte de vitesses car la chaîne est logée côté volant moteur ; en cas de rupture ayant endommagé soupapes/pistons, remplacement ou reconstruction du moteur."
      }
    ]
  },
  "AUDI": {
    "label": "Audi",
    "logo": "/logos/audi.svg",
    "defects": [
      {
        "id": "audi-tfsi-conso-huile",
        "severity": "CRITIQUE",
        "title": "Consommation d'huile excessive 2.0 TFSI EA888 gen 2",
        "description": "Moteur 2.0 TFSI première et deuxième génération : segmentation défectueuse entraînant une consommation jusqu'à 1L/1000 km. Réparation = dépose moteur + segments + pistons. Coût 3 000-5 000€.",
        "models": "A4 B8, A5, A6 C7, Q5 — 1.8 et 2.0 TFSI 211 ch",
        "years": "2008-2012",
        "gravite": "casse",
        "sources": [
          {
            "url": "https://www.auto-platinium.com/blogs/410-fiabilite-20-tsi",
            "title": "Moteur 2.0 TSI : Fiabilité & durée de vie"
          }
        ],
        "url_source": [
          "https://www.auto-platinium.com/blogs/410-fiabilite-20-tsi"
        ],
        "cout_min_eur": 3000,
        "cout_max_eur": 5500,
        "remede": "Dépose du moteur, démontage du bloc-cylindres et remplacement des pistons et de leurs segments (racleurs) par la version révisée (« piston kit »), parfois accompagné d'une révision du système de ventilation de carter (PCV)."
      },
      {
        "id": "audi-tdi-pompe-injection",
        "severity": "MAJEUR",
        "title": "Pompe à injection CP4 (2.0/3.0 TDI)",
        "description": "Pompe Bosch CP4 sensible à la qualité du gazole et à la moindre trace d'eau. En cas de casse, débris dans tout le circuit = remplacement injecteurs + pompe + rails. Devis 5 000€+ courants.",
        "models": "A3, A4, A6, Q5 — 2.0 TDI et 3.0 TDI",
        "years": "2008-2016",
        "gravite": "casse",
        "sources": [
          {
            "url": "https://dieselspecialisten.se/info/cp4-problem-vw-audi-vanligt-fel-i-20-tdi-och-30-tdi/",
            "title": "CP4 problem VW Audi – vanligt fel i 2.0 TDI och 3.0 TDI"
          }
        ],
        "url_source": [
          "https://dieselspecialisten.se/info/cp4-problem-vw-audi-vanligt-fel-i-20-tdi-och-30-tdi/"
        ],
        "cout_min_eur": 4000,
        "cout_max_eur": 6000,
        "remede": "Remplacement complet de la pompe haute pression CP4, des injecteurs, de la rampe commune (rail) et des canalisations contaminées par les débris métalliques issus de la casse de la pompe."
      }
    ]
  },
  "MERCEDES": {
    "label": "Mercedes-Benz",
    "logo": "/logos/mercedes.svg",
    "defects": [
      {
        "id": "mb-rouille-w211-w203",
        "severity": "MAJEUR",
        "title": "Corrosion structurelle (W203, W211, W210)",
        "description": "Période 1995-2009 : qualité d'apprêt et de protection anti-corrosion défaillante. Bas de caisse, passages de roues, plancher, ailes. Vérifier impérativement les soubassements.",
        "models": "Classe C (W203), Classe E (W210/W211), Classe A (W168)",
        "years": "1995-2009",
        "gravite": "majeure",
        "sources": [
          {
            "url": "https://amgcourtenay.fr/mercedes-classe-e-w210-histoire-moteurs-et-achat/",
            "title": "Mercedes Classe E W210 : histoire, moteurs et achat"
          }
        ],
        "url_source": [
          "https://amgcourtenay.fr/mercedes-classe-e-w210-histoire-moteurs-et-achat/"
        ],
        "cout_min_eur": 600,
        "cout_max_eur": 2500,
        "remede": "Traitement anticorrosion localisé : ponçage/décapage de la rouille, application d'un convertisseur de rouille et d'un apprêt, puis repeinture des zones touchées (passages de roue, bas de portes, bas de caisse, ailes) ; en cas de corrosion perforante, remplacement par soudure des tôles de bas de cais"
      }
    ]
  },
  "PEUGEOT": {
    "label": "Peugeot",
    "logo": "/logos/peugeot.svg",
    "defects": [
      {
        "id": "psa-1.2-puretech-courroie",
        "severity": "CRITIQUE",
        "title": "Courroie de distribution 1.2 PureTech dans le bain d'huile",
        "description": "Moteur 1.2 PureTech (EB2DT, EB2ADT) : courroie immergée dans l'huile qui se délite. Particules obstruent la pompe à huile = casse moteur. Action commerciale Stellantis en cours, mais pas tous les modèles couverts.",
        "models": "208, 2008, 308, 3008, 5008 — 1.2 PureTech 110/130 ch",
        "years": "2014-2022",
        "gravite": "majeure",
        "sources": [
          {
            "url": "https://www.largus.fr/actualite-automobile/peugeot-citroen-ds-nouveau-rappel-de-grande-ampleur-pour-le-moteur-1-2-puretech-30024702.html",
            "title": "Peugeot-Citroën-DS-Opel. Nouveau rappel de grande ampleur pour le moteur 1.2 PureTech"
          },
          {
            "url": "https://www.largus.fr/actualite-automobile/moteur-psa-12-puretech-lusure-de-la-courroie-un-probleme-regle-10546406.html",
            "title": "Moteur PSA 1.2 PureTech. L'usure de la courroie, un problème réglé ?"
          }
        ],
        "url_source": [
          "https://www.largus.fr/actualite-automobile/peugeot-citroen-ds-nouveau-rappel-de-grande-ampleur-pour-le-moteur-1-2-puretech-30024702.html",
          "https://www.largus.fr/actualite-automobile/moteur-psa-12-puretech-lusure-de-la-courroie-un-probleme-regle-10546406.html"
        ],
        "cout_min_eur": 850,
        "cout_max_eur": 1500,
        "remede": "Remplacement de la courroie de distribution à bain d'huile (kit distribution) et, si des particules ont colmaté le circuit, nettoyage ou remplacement de la crépine/pompe à huile ainsi que de la pompe à vide du système de freinage."
      },
      {
        "id": "psa-1.6-thp-chaine",
        "severity": "MAJEUR",
        "title": "Distribution 1.6 THP (EP6) — chaîne et VVT",
        "description": "Moteur 1.6 THP (coopération BMW-PSA) : chaîne de distribution qui s'étire prématurément + déphaseurs d'arbre à cames bruyants. Consommation d'huile importante également. Réparation 1 500-2 500€.",
        "models": "207, 208, 308 GT/GTI, 3008, 5008, RCZ, DS3, DS4",
        "years": "2007-2017",
        "gravite": "majeure",
        "sources": [
          {
            "url": "https://www.fiches-auto.fr/articles-auto/fiabilite-moteurs-essence/s-2280-fiabilite-des-16-thp.php",
            "title": "Fiabilité des 1.6 THP Peugeot / Citroën / DS / Mini"
          }
        ],
        "url_source": [
          "https://www.fiches-auto.fr/articles-auto/fiabilite-moteurs-essence/s-2280-fiabilite-des-16-thp.php"
        ],
        "cout_min_eur": 991,
        "cout_max_eur": 2500,
        "remede": "Remplacement de la chaîne de distribution et de son tendeur hydraulique (parfois guides/patins associés) sur le bloc 1.6 THP concerné."
      }
    ]
  },
  "RENAULT": {
    "label": "Renault",
    "logo": "/logos/renault.svg",
    "defects": [
      {
        "id": "renault-1.2-tce-conso-huile",
        "severity": "CRITIQUE",
        "title": "1.2 TCe (H5Ft) — consommation d'huile et casse moteur",
        "description": "Moteur 1.2 TCe 115/120 ch : consommation d'huile excessive due à segmentation défectueuse + risque de casse moteur (bielle). Programme de prise en charge Renault existant mais conditionnel.",
        "models": "Clio IV, Captur, Mégane III/IV, Scénic III, Kadjar",
        "years": "2012-2018",
        "gravite": "majeure",
        "sources": [
          {
            "url": "https://www.assemblee-nationale.fr/dyn/15/questions/QANR5L15QE23164.pdf",
            "title": null
          }
        ],
        "url_source": [
          "https://www.assemblee-nationale.fr/dyn/15/questions/QANR5L15QE23164.pdf"
        ],
        "cout_min_eur": 6000,
        "remede": "Remplacement de la segmentation des pistons (voire du moteur complet en cas de casse avérée) accompagné d'une reprogrammation du calculateur moteur, pris en charge par Renault selon des critères conditionnels (entretien, kilométrage, historique)."
      },
      {
        "id": "renault-1.5-dci-injecteurs",
        "severity": "MAJEUR",
        "title": "Injecteurs Delphi 1.5 dCi (K9K)",
        "description": "Moteur 1.5 dCi très répandu : injecteurs Delphi fragiles (grippage, fuites de retour). Symptômes : démarrage difficile, fumée blanche, mode dégradé. Jeu complet 1 200-1 800€.",
        "models": "Clio, Mégane, Scénic, Captur, Kadjar, Kangoo, Twingo dCi",
        "years": "2001-2019",
        "gravite": "majeure",
        "sources": [
          {
            "url": "https://goyalive.com/moteur-1-5-dci/",
            "title": "Moteur 1.5 dCi : Fiabilité, Problèmes et Durée de Vie - Goyalive"
          },
          {
            "url": "https://autocopilot.fr/motorisations/1-5-dci-k9k",
            "title": "Moteur Renault K9K 1.5 dCi : fiabilité, injecteurs, turbo"
          }
        ],
        "url_source": [
          "https://goyalive.com/moteur-1-5-dci/",
          "https://autocopilot.fr/motorisations/1-5-dci-k9k"
        ],
        "cout_min_eur": 1000,
        "cout_max_eur": 1600,
        "remede": "Remplacement du jeu d'injecteurs Delphi grippés ou fuyards (test de débit retour préalable), avec codage électronique obligatoire après pose."
      }
    ]
  },
  "VW": {
    "label": "Volkswagen",
    "logo": "/logos/vw.svg",
    "defects": [
      {
        "id": "vw-distrib-1.4-tsi",
        "severity": "MAJEUR",
        "title": "Chaîne de distribution 1.4 TSI",
        "description": "Moteur 1.4 TSI (CAVA, CTHE) : tendeur et chaîne de distribution défaillants avant 100 000 km. Bruit de chaîne au démarrage. Réparation 1 200-2 000€.",
        "models": "Golf VI/VII, Polo, Touran, Tiguan, Caddy 1.4 TSI 122/140 ch",
        "years": "2007-2015",
        "gravite": "majeure",
        "sources": [
          {
            "url": "https://thecarlane.com/1-4-tsi-engine-problems/",
            "title": "VW 1.4 TSI Engine Problems by Model: Chain, Pistons, Costs"
          },
          {
            "url": "https://www.wearebargain.com/blog/fiabilite-auto/probleme-chaine-distribution-tsi",
            "title": "Problème chaîne TSI : quels moteurs VW éviter en occasion"
          }
        ],
        "url_source": [
          "https://thecarlane.com/1-4-tsi-engine-problems/",
          "https://www.wearebargain.com/blog/fiabilite-auto/probleme-chaine-distribution-tsi"
        ],
        "cout_min_eur": 900,
        "cout_max_eur": 1800,
        "remede": "Remplacement de la chaîne de distribution, du tendeur hydraulique (version révisée depuis 2012) et des guides/patins (kit de distribution complet), parfois avec calage de la distribution."
      },
      {
        "id": "vw-dieselgate-egr",
        "severity": "MINEUR",
        "title": "Séquelles update Dieselgate (EA189)",
        "description": "Suite à la mise à jour antipollution post-Dieselgate, recrudescence de pannes EGR, FAP colmatés et turbo fatigué. Vérifier impérativement si l'update a été appliqué et si des problèmes sont apparus depuis.",
        "models": "Tous TDI 1.6 et 2.0 EA189 (2008-2015)",
        "years": "2008-2015",
        "gravite": "majeure",
        "sources": [
          {
            "url": "https://www.autocar.co.uk/car-news/industry/volkswagen-denies-its-dieselgate-fix-causes-breakdowns",
            "title": "Volkswagen denies its Dieselgate fix causes breakdowns"
          }
        ],
        "url_source": [
          "https://www.autocar.co.uk/car-news/industry/volkswagen-denies-its-dieselgate-fix-causes-breakdowns"
        ],
        "cout_min_eur": 1000,
        "cout_max_eur": 3000,
        "remede": "Remplacement de la vanne EGR, des injecteurs et parfois du turbocompresseur défaillants suite à la sursollicitation induite par la mise à jour anti-pollution EA189 ; dans certains cas un retrait de la pièce bridant l'admission d'air a aussi été pratiqué."
      },
      {
        "id": "vw-boite-boite-dsg-dq200-mecatronique-et-embrayages-s",
        "severity": "CRITIQUE",
        "title": "Boîte DSG DQ200 : mécatronique et embrayages secs",
        "description": "Boîte à double embrayage sec DQ200 à sept rapports : défaillance du bloc mécatronique, à-coups, perte de rapports et passage en mode secours.",
        "models": "Golf VI, Golf VII, Polo V, Passat B7",
        "years": "2008-2019",
        "categorie": "boite",
        "cibles": [
          "DQ200"
        ],
        "gravite": "casse",
        "sources": [
          {
            "url": "https://www.drive.com.au/news/new-recall-of-80-000-volkswagen-audi-and-skoda-cars-with-dsg-gearboxes-some-for-the-second-time-in-six-years/",
            "title": "New recall of 80,000 Volkswagen, Audi and Skoda cars with DSG gearboxes - some for the second time in six years"
          }
        ],
        "url_source": [
          "https://www.drive.com.au/news/new-recall-of-80-000-volkswagen-audi-and-skoda-cars-with-dsg-gearboxes-some-for-the-second-time-in-six-years/"
        ],
        "cout_min_eur": 1200,
        "cout_max_eur": 3500,
        "remede": "Remplacement (ou reconditionnement) du bloc mécatronique DQ200 défaillant (logement de l'accumulateur de pression fissuré, électronique de contrôle), avec remplacement du kit d'embrayage sec si celui-ci est également usé ou affecté par la pression hydraulique instable."
      }
    ]
  },
  "FORD": {
    "label": "Ford",
    "defects": [
      {
        "id": "ford-boite-boite-powershift-dps6-a-coups-broutement-et-",
        "severity": "MINEUR",
        "title": "Boîte PowerShift DPS6 : à-coups, broutement et embrayages secs",
        "description": "Boîte à double embrayage sec PowerShift DPS6 : broutement au démarrage, à-coups, usure prématurée des embrayages et du module de commande.",
        "models": "Fiesta VI, Focus III, B-Max, EcoSport",
        "years": "2011-2018",
        "categorie": "boite",
        "cibles": [
          "POWERSHIFT",
          "DPS6"
        ],
        "gravite": "mineure",
        "sources": [
          {
            "url": "https://static.nhtsa.gov/odi/tsbs/2016/SB-10092372-5448.pdf",
            "title": "FORD: 2011-2015 Fiesta 2012-2016 Focus - TSB DPS6 Clutch Shudder"
          },
          {
            "url": "https://carbuzz.com/2018-ford-focus-transmission-problems-smart-buy/",
            "title": "The Last Of Ford's Excellent Small Cars Makes A Bargain Used Buy - But Is It A Smart One?"
          }
        ],
        "url_source": [
          "https://static.nhtsa.gov/odi/tsbs/2016/SB-10092372-5448.pdf",
          "https://carbuzz.com/2018-ford-focus-transmission-problems-smart-buy/"
        ],
        "remede": "Remplacement du module d'embrayage double sec (clutch pack) et reprogrammation du module de commande TCM/PCM (apprentissage adaptatif de l'embrayage), parfois avec remplacement du joint d'arbre d'entrée en cas de fuite."
      }
    ]
  }
}
