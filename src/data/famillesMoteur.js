// Familles moteur couvertes par Inspexo — table de référence (sprint 6).
//
// Elle sert à trois choses : la campagne de génération des fiches
// (scripts/couverture-moteurs.mjs), les pages publiques /moteur/<slug> et le
// lien interne depuis un dossier vers la page de son moteur.
//
// RÈGLE : chaque entrée porte l'URL qui atteste son CODE DE FAMILLE
// (`source_code`). Le code est ce qui relie une annonce à sa fiche : s'y
// tromper, c'est afficher les pannes d'un autre moteur. Une famille dont le
// code n'est pas attesté par une page consultable n'entre pas dans cette
// table, même si elle est très répandue (voir LACUNES en bas de fichier).
//
// L'ordre suit l'importance dans le parc d'occasion français : il n'existe
// aucun classement public des familles moteur par volume, la priorisation
// croise donc les classements de modèles (AAA DATA / NGC-Data, relayés par
// L'Argus et le Journal de l'Automobile) avec les motorisations montées.

/** Sources du classement du parc, citées sur les pages publiques. */
export const SOURCES_PARC = [
  {
    url: 'https://www.largus.fr/actualite-automobile/voitures-d-occasion-le-top-30-des-modeles-les-plus-vendus-en-2023-30028302.html',
    libelle: 'L\'Argus — top 30 des voitures d\'occasion les plus vendues en 2023 (données NGC-Data)',
    etablit: 'Marché VO 5,245 M de transactions, soit trois fois le neuf. Clio 338 402, C3 165 610, 208 153 057, Golf 4e, Scénic 102 143.',
  },
  {
    url: 'https://www.largus.fr/actualite-automobile/ventes-d-occasion-2023-le-top-20-des-diesels-les-plus-vendus-en-france-30028701.html',
    libelle: 'L\'Argus — top 20 des diesels d\'occasion les plus vendus en 2023 (NGC-Data)',
    etablit: 'Le diesel pèse 2,71 M de transactions VO (≈ 51,6 %). Clio 171 017, 308 91 105, Mégane 89 084, C3 75 286, Duster 43 388.',
  },
  {
    url: 'https://www.statistiques.developpement-durable.gouv.fr/immatriculations-des-voitures-particulieres-en-2022-forte-baisse-dans-le-neuf-comme-dans-loccasion',
    libelle: 'SDES (ministère de la Transition écologique) — immatriculations 2022, neuf et occasion',
    etablit: 'L\'occasion représente 5,3 M d\'immatriculations, soit 77 % des achats ; le parc VO reste majoritairement diesel (52,2 %).',
  },
  {
    url: 'https://www.fiches-auto.fr/articles-auto/chiffres-de-l-auto/s-651-voitures-les-plus-vendues-en-france.php',
    libelle: 'Fiches-auto — immatriculations de voitures neuves en France, par année',
    etablit: 'Clio 4 en tête de 2014 à 2018, Peugeot 208 de 2019 à 2022 : les millésimes qui composent le parc d\'occasion d\'aujourd\'hui.',
  },
]

/** Transforme « 1.2 PureTech 110 » + « Peugeot » en slug d'URL. */
export function slugifier(marque, nomCommercial) {
  return `${marque} ${nomCommercial}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Sources de code revenant souvent : nommées une fois, référencées ensuite.
const S = {
  EB: 'https://fr.wikipedia.org/wiki/Moteur_EB',
  EP: 'https://fr.wikipedia.org/wiki/Moteur_EP',
  DW: 'https://fr.wikipedia.org/wiki/Moteur_DW',
  PURETECH: 'https://www.caradisiac.com/faut-il-acheter-une-peugeot-citroen-ds-d-occasion-equipee-du-moteur-1-2-puretech-196274.htm',
  RENAULT_K: 'https://en.wikipedia.org/wiki/Renault_K-Type_engine',
  NISSAN_HR: 'https://en.wikipedia.org/wiki/Nissan_HR_engine',
  NISSAN_MR: 'https://en.wikipedia.org/wiki/Nissan_MR_engine',
  VW_TDI: 'https://en.wikipedia.org/wiki/List_of_Volkswagen_Group_diesel_engines',
  VW_EA288_SSP: 'https://www.vag-technique.fr/ext_files/ssp/vw/SSP_514_La_nouvelle_gamme_de_moteurs_diesel_EA288.pdf',
  DIESELGATE: 'https://en.wikipedia.org/wiki/Volkswagen_emissions_scandal',
  BMW_N47: 'https://en.wikipedia.org/wiki/BMW_N47',
  BMW_B47: 'https://en.wikipedia.org/wiki/BMW_B47',
  MB_OM651: 'https://en.wikipedia.org/wiki/Mercedes-Benz_OM651_engine',
  MB_OM654: 'https://en.wikipedia.org/wiki/Mercedes-Benz_OM654_engine',
  TOYOTA_ZR: 'https://en.wikipedia.org/wiki/Toyota_ZR_engine',
  FORD_ECOBOOST: 'https://en.wikipedia.org/wiki/Ford_EcoBoost_engine',
  HK_KAPPA: 'https://en.wikipedia.org/wiki/Hyundai_Kappa_engine',
  HK_GAMMA: 'https://en.wikipedia.org/wiki/Hyundai_Gamma_engine',
  HK_U: 'https://en.wikipedia.org/wiki/Hyundai_U_engine',
  HK_THETA: 'https://en.wikipedia.org/wiki/Hyundai_Theta_engine',
  FIAT_JTD: 'https://en.wikipedia.org/wiki/Fiat_JTD_engine',
  FIAT_TWINAIR: 'https://en.wikipedia.org/wiki/Fiat_TwinAir_engine',
  FIAT_FIREFLY: 'https://en.wikipedia.org/wiki/Fiat_Global_Small_Engine',
  VOLVO_VEA: 'https://en.wikipedia.org/wiki/Volvo_Engine_Architecture',
  AUDI_NHTSA: 'https://static.nhtsa.gov/odi/rcl/2022/RCAK-22V178-9203.pdf',
  LARGUS_DIESELS: 'https://www.largus.fr/actualite-automobile/diesels-psarenault-la-liste-des-pannes-recurrentes-depuis-2010-9554392.html',
  DV6: 'https://autocopilot.fr/motorisations/1-6-hdi',
  DV5: 'https://autoscore.pro/engine/psa-1.5-bluehdi-dv5',
  DV5_FIABILITE: 'https://www.fiches-auto.fr/articles-auto/chiffres-fiabilite-diesel/s-2526-fiabilite-15-bluehdi.php',
  DV5_PRISE_EN_CHARGE: 'https://www.quechoisir.org/actualite-moteur-diesel-1-5-bluehdi-de-stellantis-la-grogne-monte-n132914/',
  DIESELS_FIABILITE: 'https://www.fiches-auto.fr/articles-auto/enquete-fiabilite/s-1192-diesels-les-moins-fiables.php',
}

const brut = [
  // ===================== Renault · Dacia · Nissan =====================
  // La Clio est la voiture la plus échangée d'occasion en France (338 402 en
  // 2023) et le 1.5 dCi sa motorisation diesel emblématique.
  { marque: 'Renault', nom_commercial: '1.5 dCi', famille: 'K9K',
    modeles: ['Renault Clio III/IV', 'Renault Mégane III/IV', 'Dacia Duster I/II', 'Nissan Qashqai I/II', 'Renault Scénic III'],
    millesimes: '2001-2022', source_code: S.RENAULT_K, source_pannes: S.LARGUS_DIESELS },
  { marque: 'Renault', nom_commercial: '1.2 TCe', famille: 'H5FT',
    modeles: ['Renault Clio IV', 'Renault Captur I', 'Renault Kadjar', 'Nissan Qashqai II'],
    millesimes: '2012-2019', source_code: S.NISSAN_HR },
  { marque: 'Renault', nom_commercial: '0.9 TCe', famille: 'H4BT',
    modeles: ['Renault Clio IV', 'Renault Twingo III', 'Dacia Sandero II', 'Dacia Duster II'],
    millesimes: '2012-2021', source_code: S.NISSAN_HR },
  { marque: 'Renault', nom_commercial: '1.3 TCe', famille: 'H5HT',
    modeles: ['Renault Clio V', 'Renault Captur II', 'Renault Mégane IV', 'Mercedes Classe A W177'],
    millesimes: '2018-2022', source_code: S.NISSAN_HR },
  { marque: 'Renault', nom_commercial: '1.0 SCe', famille: 'H4D',
    modeles: ['Renault Twingo III', 'Renault Clio V', 'Dacia Sandero III'],
    millesimes: '2014-2022', source_code: S.NISSAN_HR },
  { marque: 'Renault', nom_commercial: '1.0 TCe', famille: 'H4DT',
    modeles: ['Renault Clio V', 'Renault Captur II', 'Dacia Sandero III'],
    millesimes: '2019-2022', source_code: S.NISSAN_HR },
  { marque: 'Renault', nom_commercial: '1.6 SCe', famille: 'H4M',
    modeles: ['Renault Captur', 'Renault Mégane IV', 'Dacia Duster II', 'Nissan Qashqai'],
    millesimes: '2004-2022', source_code: S.NISSAN_HR },
  { marque: 'Renault', nom_commercial: '1.6 16V', famille: 'K4M',
    modeles: ['Renault Mégane II/III', 'Dacia Duster I', 'Renault Kangoo II', 'Dacia Logan'],
    millesimes: '1999-2016', source_code: S.RENAULT_K },
  { marque: 'Dacia', nom_commercial: '1.6 8V', famille: 'K7M',
    modeles: ['Dacia Sandero I/II', 'Dacia Logan', 'Dacia Lodgy'],
    millesimes: '2004-2014', source_code: S.RENAULT_K },
  { marque: 'Nissan', nom_commercial: '2.0 essence', famille: 'MR20DE',
    modeles: ['Nissan Qashqai I/II', 'Nissan X-Trail', 'Renault Scénic III'],
    millesimes: '2005-2022', source_code: S.NISSAN_MR },
  { marque: 'Nissan', nom_commercial: '1.6 DIG-T', famille: 'MR16DDT',
    modeles: ['Nissan Juke I', 'Nissan Qashqai II', 'Renault Clio RS', 'Renault Kadjar'],
    millesimes: '2010-2019', source_code: S.NISSAN_MR },

  // ===================== Stellantis =====================
  // 208 et C3 sont 3e et 2e du classement VO 2023 ; le 1.2 PureTech est leur
  // motorisation essence dominante, et son défaut de courroie humide en fait
  // le moteur le plus scruté du marché.
  { marque: 'Peugeot', nom_commercial: '1.6 HDi', famille: 'DV6',
    modeles: ['Peugeot 207/208', 'Peugeot 308 I/II', 'Peugeot 3008 I', 'Citroën C3/C4', 'Citroën Berlingo', 'Ford Fiesta/Focus'],
    millesimes: '2004-2018', source_code: S.DV6, source_pannes: S.DIESELS_FIABILITE,
    note: 'Codes attestés : DV6ATED4 et DV6BTED (90 ch), DV6TED4 et DV6CTED (110 ch), DV6C/DV6D/DV6E pour les BlueHDi Euro 6 à partir de 2014.' },
  { marque: 'Peugeot', nom_commercial: '1.5 BlueHDi', famille: 'DV5',
    modeles: ['Peugeot 208 II', 'Peugeot 308 II/III', 'Peugeot 3008 II', 'Citroën C3/C4', 'Citroën C5 Aircross', 'Opel Astra/Grandland'],
    millesimes: '2017-2022', source_code: S.DV5, source_pannes: S.DV5_FIABILITE,
    source_programme: S.DV5_PRISE_EN_CHARGE,
    note: 'Chaîne reliant les arbres à cames sous-dimensionnée (7 mm) sur les productions d\'octobre 2017 à janvier 2023 ; prise en charge Stellantis à 100 % en deçà de 5 ans ou 150 000 km.' },
  { marque: 'Peugeot', nom_commercial: '1.2 PureTech 110', famille: 'EB2DT',
    modeles: ['Peugeot 208 I/II', 'Peugeot 2008', 'Peugeot 308 II', 'Citroën C3 III', 'Opel Corsa F'],
    millesimes: '2014-2022', source_code: S.PURETECH },
  { marque: 'Peugeot', nom_commercial: '1.2 PureTech 130', famille: 'EB2DTS',
    modeles: ['Peugeot 3008 II', 'Peugeot 308 II/III', 'Citroën C4 III', 'DS 7 Crossback'],
    millesimes: '2015-2022', source_code: S.PURETECH },
  { marque: 'Peugeot', nom_commercial: '1.2 PureTech 100', famille: 'EB2ADTS',
    modeles: ['Peugeot 208 II', 'Peugeot 2008 II', 'Opel Corsa F', 'Citroën C3 III'],
    millesimes: '2018-2022', source_code: S.EB },
  { marque: 'Peugeot', nom_commercial: '1.2 PureTech 82 atmosphérique', famille: 'EB2F',
    modeles: ['Citroën C3 II/III', 'Peugeot 208 I', 'Peugeot 2008 I', 'Citroën C-Elysée'],
    millesimes: '2012-2018', source_code: S.EB },
  { marque: 'Peugeot', nom_commercial: '1.6 THP', famille: 'EP6',
    modeles: ['Peugeot 308 GT', 'Peugeot 3008 I', 'Citroën DS3', 'Mini Cooper S R56'],
    millesimes: '2006-2017', source_code: S.EP },
  { marque: 'Peugeot', nom_commercial: '2.0 BlueHDi', famille: 'DW10',
    modeles: ['Peugeot 308 II', 'Peugeot 3008 II', 'Peugeot 508 I/II', 'Citroën C5 Aircross'],
    millesimes: '2014-2022', source_code: S.DW },
  { marque: 'Peugeot', nom_commercial: '2.2 BlueHDi', famille: 'DW12',
    modeles: ['Peugeot Expert', 'Citroën Jumpy', 'Peugeot 508 I', 'Citroën SpaceTourer'],
    millesimes: '2006-2022', source_code: S.DW },
  { marque: 'Fiat', nom_commercial: '1.3 Multijet', famille: 'SDE',
    modeles: ['Fiat 500', 'Fiat Panda III', 'Opel Corsa D/E', 'Fiat Punto Evo'],
    millesimes: '2003-2020', source_code: S.FIAT_JTD },
  { marque: 'Fiat', nom_commercial: '0.9 TwinAir', famille: 'TWINAIR',
    modeles: ['Fiat 500', 'Fiat Panda III', 'Fiat 500L'],
    millesimes: '2010-2022', source_code: S.FIAT_TWINAIR },
  { marque: 'Fiat', nom_commercial: '1.0 FireFly', famille: 'FIREFLY',
    modeles: ['Fiat 500 Hybrid', 'Fiat Panda Hybrid', 'Lancia Ypsilon'],
    millesimes: '2020-2022', source_code: S.FIAT_FIREFLY },

  // ===================== Groupe Volkswagen =====================
  { marque: 'Volkswagen', nom_commercial: '2.0 TDI (EA288)', famille: 'EA288',
    modeles: ['VW Golf VII', 'VW Passat B8', 'VW Tiguan II', 'Skoda Octavia III', 'Seat Leon III'],
    millesimes: '2012-2020', source_code: S.VW_TDI, source_complement: S.VW_EA288_SSP },
  { marque: 'Audi', nom_commercial: '2.0 TDI (EA288)', famille: 'EA288',
    modeles: ['Audi A3 8V', 'Audi A4 B9', 'Audi Q3 I/II', 'Audi A1 GB'],
    millesimes: '2012-2020', source_code: S.VW_TDI, source_complement: S.VW_EA288_SSP },
  { marque: 'Volkswagen', nom_commercial: '1.6 TDI (CRBC)', famille: 'CRBC',
    modeles: ['VW Golf VII', 'VW Caddy IV', 'Skoda Octavia III', 'Seat Leon III'],
    millesimes: '2012-2020', source_code: S.VW_TDI },
  { marque: 'Volkswagen', nom_commercial: '1.6 et 2.0 TDI (EA189)', famille: 'EA189',
    modeles: ['VW Golf VI', 'VW Passat B7', 'Audi A3 8P', 'Skoda Octavia II', 'Seat Ibiza IV'],
    millesimes: '2008-2015', source_code: S.DIESELGATE,
    note: 'Famille visée par le scandale des émissions : 948 064 véhicules concernés en France.' },
  { marque: 'Audi', nom_commercial: '4.0 V8 TFSI', famille: 'EA824',
    modeles: ['Audi S6 C7', 'Audi S7 C7', 'Audi S8 D4', 'Audi RS6 C7'],
    millesimes: '2012-2018', source_code: S.AUDI_NHTSA },

  // ===================== BMW · Mini =====================
  { marque: 'BMW', nom_commercial: '2.0 diesel (B47)', famille: 'B47',
    modeles: ['BMW Série 1 F20/F40', 'BMW Série 3 F30/G20', 'BMW X1 F48', 'BMW Série 5 G30'],
    millesimes: '2014-2022', source_code: S.BMW_B47 },
  { marque: 'BMW', nom_commercial: '2.0 diesel (N47)', famille: 'N47',
    modeles: ['BMW Série 1 E87/F20', 'BMW Série 3 E90/F30', 'BMW X1 E84', 'BMW Série 5 F10'],
    millesimes: '2007-2015', source_code: S.BMW_N47,
    note: 'Chaîne de distribution côté boîte : défaut documenté, réparation avec dépose du moteur.' },
  { marque: 'BMW', nom_commercial: '1.6 essence (N13)', famille: 'N13',
    modeles: ['BMW Série 1 F20', 'BMW Série 3 F30', 'BMW X1 E84'],
    millesimes: '2011-2016', source_code: S.EP,
    note: 'Dérivé du Prince EP6 développé avec PSA.' },
  { marque: 'Mini', nom_commercial: '1.6 Cooper S (Prince)', famille: 'N18',
    modeles: ['Mini Cooper S R56', 'Mini Countryman R60', 'Mini Clubman R55'],
    millesimes: '2006-2016', source_code: S.EP },

  // ===================== Mercedes =====================
  { marque: 'Mercedes', nom_commercial: '2.1 CDI (OM651)', famille: 'OM651',
    modeles: ['Mercedes Classe C W204/W205', 'Mercedes Classe E W212', 'Mercedes Vito', 'Mercedes Sprinter'],
    millesimes: '2008-2019', source_code: S.MB_OM651 },
  { marque: 'Mercedes', nom_commercial: '2.0 diesel (OM654)', famille: 'OM654',
    modeles: ['Mercedes Classe C W205', 'Mercedes Classe E W213', 'Mercedes GLC X253', 'Mercedes Classe A W177'],
    millesimes: '2016-2022', source_code: S.MB_OM654 },
  { marque: 'Mercedes', nom_commercial: '1.5 CDI (OM607)', famille: 'OM607',
    modeles: ['Mercedes Classe A W176', 'Mercedes Classe B W246', 'Mercedes CLA C117'],
    millesimes: '2012-2019', source_code: S.RENAULT_K,
    note: 'Version Mercedes du 1.5 dCi Renault (K9K).' },
  { marque: 'Mercedes', nom_commercial: '1.3 essence (M282)', famille: 'M282',
    modeles: ['Mercedes Classe A W177', 'Mercedes Classe B W247', 'Mercedes CLA C118', 'Mercedes GLA H247'],
    millesimes: '2018-2022', source_code: S.NISSAN_HR,
    note: 'Développé avec Renault-Nissan : même base que le 1.3 TCe (H5Ht).' },

  // ===================== Toyota =====================
  { marque: 'Toyota', nom_commercial: '1.8 Hybride', famille: '2ZR-FXE',
    modeles: ['Toyota Prius XW30/XW50', 'Toyota Auris HSD', 'Toyota Corolla E210', 'Toyota C-HR'],
    millesimes: '2009-2022', source_code: S.TOYOTA_ZR },
  { marque: 'Toyota', nom_commercial: '1.8 essence', famille: '2ZR-FE',
    modeles: ['Toyota Auris I/II', 'Toyota Avensis III', 'Toyota Verso'],
    millesimes: '2007-2018', source_code: S.TOYOTA_ZR },

  // ===================== Ford =====================
  { marque: 'Ford', nom_commercial: '1.0 EcoBoost', famille: 'FOX',
    modeles: ['Ford Fiesta VII', 'Ford Focus III/IV', 'Ford Puma', 'Ford EcoSport'],
    millesimes: '2012-2022', source_code: S.FORD_ECOBOOST,
    note: 'Courroie de distribution humide : dégradation documentée, rappels 2024 aux États-Unis.' },
  { marque: 'Ford', nom_commercial: '1.5 EcoBoost (Dragon)', famille: 'DRAGON',
    modeles: ['Ford Focus Mk4', 'Ford Kuga Mk3', 'Ford Puma ST', 'Ford Fiesta ST'],
    millesimes: '2017-2022', source_code: S.FORD_ECOBOOST },
  { marque: 'Ford', nom_commercial: '1.6 EcoBoost (Sigma)', famille: 'SIGMA',
    modeles: ['Ford Focus III', 'Ford Mondeo IV', 'Ford C-Max', 'Ford Kuga I'],
    millesimes: '2010-2022', source_code: S.FORD_ECOBOOST,
    note: 'Rappel 2017 de plus de 360 000 véhicules pour risque d\'incendie (défaut de circulation du liquide de refroidissement).' },

  // ===================== Hyundai · Kia =====================
  { marque: 'Hyundai', nom_commercial: '1.0 T-GDI', famille: 'G3LC',
    modeles: ['Hyundai i20', 'Hyundai i30', 'Hyundai Kona', 'Kia Ceed', 'Kia Stonic'],
    millesimes: '2014-2022', source_code: S.HK_KAPPA },
  { marque: 'Hyundai', nom_commercial: '1.4 T-GDI', famille: 'G4LD',
    modeles: ['Hyundai i30', 'Hyundai Kona', 'Kia Ceed', 'Kia Sportage'],
    millesimes: '2015-2022', source_code: S.HK_KAPPA },
  { marque: 'Hyundai', nom_commercial: '1.6 CRDi', famille: 'D4FB',
    modeles: ['Hyundai i30', 'Hyundai Tucson', 'Kia Ceed', 'Kia Sportage'],
    millesimes: '2004-2022', source_code: S.HK_U },
  { marque: 'Hyundai', nom_commercial: '1.6 GDI', famille: 'G4FD',
    modeles: ['Hyundai i30', 'Hyundai Tucson', 'Kia Ceed', 'Kia Sportage'],
    millesimes: '2010-2022', source_code: S.HK_GAMMA },
  { marque: 'Hyundai', nom_commercial: '2.0 essence (Theta II)', famille: 'G4KD',
    modeles: ['Hyundai Tucson/ix35', 'Kia Sportage', 'Hyundai Santa Fe'],
    millesimes: '2007-2020', source_code: S.HK_THETA,
    note: 'Débris de vilebrequin obstruant la lubrification : campagnes de rappel massives aux États-Unis.' },

  // ===================== Volvo =====================
  { marque: 'Volvo', nom_commercial: '2.0 diesel (VEA)', famille: 'D4204T',
    modeles: ['Volvo V40', 'Volvo V60', 'Volvo XC60', 'Volvo XC40'],
    millesimes: '2013-2022', source_code: S.VOLVO_VEA },
  { marque: 'Volvo', nom_commercial: '2.0 essence (VEA)', famille: 'B4204T',
    modeles: ['Volvo V40', 'Volvo V60', 'Volvo XC60', 'Volvo XC40'],
    millesimes: '2014-2022', source_code: S.VOLVO_VEA },
]

/** Table publique : chaque entrée porte son slug d'URL. */
export const FAMILLES_MOTEUR = brut.map((f) => ({ ...f, slug: slugifier(f.marque, f.nom_commercial) }))

/** Retrouve une famille par son slug d'URL (/moteur/<slug>). */
export function familleParSlug(slug) {
  return FAMILLES_MOTEUR.find((f) => f.slug === slug) ?? null
}

/** Retrouve la famille d'un véhicule analysé (marque + code moteur). */
export function familleParCode(marque, code) {
  if (!marque || !code) return null
  const m = String(marque).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  const c = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '')
  return FAMILLES_MOTEUR.find((f) => {
    const fm = f.marque.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return (fm === m || m.includes(fm) || fm.includes(m)) &&
      f.famille.toUpperCase().replace(/[^A-Z0-9]/g, '') === c
  }) ?? null
}

// ---------------------------------------------------------------------------
// LACUNES ASSUMÉES — familles très répandues dont le CODE n'est pas attesté
// par une page consultable, donc volontairement absentes de la table :
//
// • DV4 (1.4 HDi) : aucune source consultée n'associe ce code à la cylindrée
//   de 1,4 l. Les articles de fiabilité décrivent bien le 1.4 HDi mais sans
//   jamais nommer son code interne. Famille écartée tant que ce lien n'est
//   pas établi. (DV6 et DV5 sont désormais couverts : voir plus haut.)
// • EA211 (1.0/1.2/1.4/1.5 TSI) et EA888 (1.8/2.0 TSI) : la liste Wikipedia
//   des moteurs du groupe VW ne couvre que les diesels.
// • Codes Opel propres (B14XFT, B16DTH…), codes internes Fiat/Alfa.
// • Codes de boîtes de vitesses (DQ200, DQ381, EAT8, DC4…) : aucun attesté.
//   Le filtre serveur refuse déjà toute panne nommant un code de boîte qui
//   n'est pas celui du véhicule, cette lacune ne crée donc pas de faux
//   positif — elle limite seulement la couverture.
// ---------------------------------------------------------------------------
