// SPRINT 23, LOT 3 (point 7) — Garanties batterie des véhicules électriques et
// hybrides. AFFICHAGE SEULEMENT : aucun fichier du chemin de notation ne lit ce
// module (tests/garanties-batterie.test.mjs), la note ne bouge pas.
//
// ⚠️ D'OÙ VIENNENT CES LIGNES. Chaque entrée reprend UNIQUEMENT les parties que
// le juge à vote a confirmées (docs/candidats-externes-journal.json, objets du
// groupe G de type « garantie » de docs/sources-moteurs-2026-11.json), avec la
// page qui les porte. Rien n'est ajouté de mémoire. Ce que le juge a écarté
// (Allure Care Peugeot, Leaf 1re génération, PHEV Peugeot et BMW non jugés)
// n'apparaît pas.
//
// ⚠️ PAYS. Une source d'un autre pays (Belgique, Royaume-Uni, Luxembourg…)
// reste une INFORMATION DE CONTEXTE : les conditions françaises peuvent
// différer, et la ligne le dit.
//
// ⚠️ JAMAIS « votre véhicule est couvert » : une garantie dépend de la date de
// 1re mise en circulation, du kilométrage et de l'entretien. Le dossier invite
// à demander le livret ou le certificat de garantie.
//
// BMW (hors i3), MINI et Mercedes : pages officielles françaises trouvées le
// 12/11/2026 mais ILLISIBLES depuis la session (délai dépassé, 403) — non
// relues, donc non affichées ; seul le repère presse confirmé par le juge
// s'applique à ces marques.

export const RELEVE_LE = '2026-11-10'

const S = {
  renault: { url: 'https://cdn.group.renault.com/ren/fr/renault-service/201124_RENAULT_LEAFLET_CS_ZE_95x210_2022_DEF-BD.pdf', titre: 'Renault — contrats d\'entretien E-Tech 100 % électrique (dépliant)', pays: 'FR', classe: 'officiel', date: null },
  ecmp: { url: 'https://www.automobile-propre.com/articles/peugeot-e-208-doccasion-voici-tout-ce-quil-faut-savoir-avant-dacheter/', titre: 'Automobile Propre — Peugeot e-208 d\'occasion', pays: 'FR', classe: 'presse', date: '2025-12-10' },
  tesla: { url: 'https://www.automobile-propre.com/breves/tesla-bouleverse-les-conditions-de-garantie-de-ses-batteries/', titre: 'Automobile Propre — Tesla et la garantie de ses batteries', pays: 'FR', classe: 'presse', date: '2020-02-03' },
  vw: { url: 'https://www.volkswagen.fr/fr/electriques-et-hybrides/univers-id/garantie-entretien-batterie.html', titre: 'Volkswagen France — garantie et entretien de la batterie', pays: 'FR', classe: 'officiel', date: null },
  skoda: { url: 'https://fr.skoda.be/_doc/5b73a599-3cf8-4d87-9cc3-5a24f97a76da', titre: 'Škoda Belgique — « La garantie Škoda » (brochure 09/2023)', pays: 'BE', classe: 'officiel', date: '2023-09-01' },
  cupra: { url: 'https://www.cupra.be/pdf/garantie_CUPRA_fr.pdf', titre: 'CUPRA Belgique — conditions de garantie', pays: 'BE', classe: 'officiel', date: null },
  hyundai: { url: 'https://www.hyundai.com/fr/voiture-electrique/faq-electrique.html', titre: 'Hyundai France — questions sur l\'électrique', pays: 'FR', classe: 'officiel', date: null },
  hyundaiLu: { url: 'https://www.hyundai.com/lu/service/conduite-sans-souci/garantie-de-8-ans-sur-la-batterie.html', titre: 'Hyundai Luxembourg — garantie de 8 ans sur la batterie', pays: 'LU', classe: 'officiel', date: null },
  kia: { url: 'https://www.kia.com/fr/services/garantie/', titre: 'Kia France — garantie', pays: 'FR', classe: 'officiel', date: null },
  mg: { url: 'https://www.automobile-propre.com/articles/mg-4-doccasion-voici-tout-ce-quil-faut-savoir-avant-dacheter/', titre: 'Automobile Propre — MG4 d\'occasion', pays: 'FR', classe: 'presse', date: '2025-11-12' },
  dacia: { url: 'https://cdn.group.renault.com/dac/fr/transversal-assets/apv/dacia-leaflet-%20contrats-entretien-vehicule-electrique-NBI.pdf', titre: 'Dacia — contrats d\'entretien véhicule électrique (dépliant)', pays: 'FR', classe: 'officiel', date: null },
  argus2020: { url: 'https://www.largus.fr/actualite-automobile/voitures-electriques-quelle-est-la-longevite-des-batteries-10196395.html', titre: 'L\'argus — longévité et garantie des batteries', pays: 'FR', classe: 'presse', date: '2020-03-30' },
  argus2021: { url: 'https://www.largus.fr/actualite-automobile/voitures-electriques-quelle-est-la-duree-de-garantie-de-la-batterie-10544412.html', titre: 'L\'argus — durée de garantie de la batterie', pays: 'FR', classe: 'presse', date: '2021-07-22' },
  toyotaHsd: { url: 'https://www.toyota.fr/votre-toyota/entretien/garantie-et-assistance/garantie-toyota', titre: 'Toyota France — garantie Toyota', pays: 'FR', classe: 'officiel', date: null },
  toyotaExpert: { url: 'https://www.toyota.fr/votre-toyota/entretien/garantie-et-assistance/centre-expert-hybride-toyota.html', titre: 'Toyota France — centre expert hybride', pays: 'FR', classe: 'officiel', date: null },
  toyotaBev: { url: 'https://www.toyota.fr/gamme-electrifiee/electrique/questions-electrique/quel-controle-technique-pour-une-voiture-electrique', titre: 'Toyota France — questions sur l\'électrique', pays: 'FR', classe: 'officiel', date: null },
  nissanBe: { url: 'https://fr.nissan.be/experience-nissan/vehicules-electriques/nissan-charge.html', titre: 'Nissan Belgique — véhicules électriques', pays: 'BE', classe: 'officiel', date: null },
  nissanUk: { url: 'https://www.nissan.co.uk/content/dam/Nissan/gb/EV-Customer-Promise/EV%20Customer_Promise_TCs.pdf', titre: 'Nissan Royaume-Uni — EV Customer Promise (conditions)', pays: 'UK', classe: 'officiel', date: null },
}

/** energies : 'electrique' | 'hybride' (hybride simple ou rechargeable). */
export const GARANTIES_BATTERIE = [
  { id: 'G-VE-ZOE-01', marques: ['renault'], modeles: /zo[eé]|m[eé]gane\s+e-?tech|twingo\s+e-?tech/, energies: ['electrique'],
    lignes: ['Batterie de traction garantie 8 ans ou 160 000 km (Zoe, Mégane E-Tech, Twingo E-Tech) ; remplacement si l\'état de santé (SoH) est inférieur à 70 %.', 'Le même document précise « capacité de charge minimale de 66 % » : demandez le livret de garantie du véhicule pour savoir quel seuil s\'applique.'],
    sources: [S.renault] },
  { id: 'G-VE-E-CMP-01', marques: ['peugeot', 'citroen', 'citroën', 'ds', 'opel'], modeles: /e-?208|e-?2008|[eë]-?c4|corsa[\s-]?e\b|corsa\s+electric|ds\s?3\s+crossback|e-?tense/, energies: ['electrique'],
    lignes: ['Batterie garantie 8 ans ou 160 000 km avec une capacité minimale de 70 % (e-208, e-2008, ë-C4, Corsa-e, DS 3 Crossback E-Tense).'],
    sources: [S.ecmp] },
  { id: 'G-VE-TESLA-3Y-01', marques: ['tesla'], modeles: /model\s?3|model\s?y/, energies: ['electrique'],
    lignes: ['Batterie et unité d\'entraînement : Propulsion 8 ans ou 160 000 km ; Grande Autonomie et Performance 8 ans ou 192 000 km ; rétention minimale de 70 %.'],
    sources: [S.tesla] },
  { id: 'G-VE-VW-ID-01', marques: ['volkswagen', 'vw'], modeles: /\bid\.?\s?[3-7]\b|id\.?\s?buzz/, energies: ['electrique'],
    lignes: ['Batterie haute tension garantie 8 ans ou 160 000 km, avec une capacité utilisable d\'au moins 70 %.'],
    sources: [S.vw] },
  { id: 'G-VE-ENYAQ-01', marques: ['skoda', 'škoda'], modeles: /enyaq|elroq/, energies: ['electrique'],
    lignes: ['Batterie haute tension garantie 8 ans ou 160 000 km, capacité minimale par paliers : 78 % (3 ans ou 60 000 km), 74 % (5 ans ou 100 000 km), 70 % (8 ans ou 160 000 km) ; droit cessible au nouvel acquéreur.'],
    sources: [S.skoda] },
  { id: 'G-VE-BORN-01', marques: ['cupra'], modeles: /born/, energies: ['electrique'],
    lignes: ['Batterie haute tension garantie 8 ans ou 160 000 km, capacité nette minimale 78 % (3 ans ou 60 000 km), 74 % (5 ans ou 100 000 km), 70 % (8 ans ou 160 000 km) ; le nouvel acquéreur hérite du droit de réclamation.'],
    sources: [S.cupra] },
  { id: 'G-VE-KONA-EV-01', marques: ['hyundai'], modeles: /kona|ioniq/, energies: ['electrique'],
    lignes: ['Batterie haute tension garantie 8 ans ou 160 000 km ; garantie transférée au nouveau propriétaire. Le seuil de capacité n\'est pas indiqué sur la page officielle.'],
    sources: [S.hyundai] },
  { id: 'G-PHEV-HYUNDAI-KIA-01', marques: ['hyundai'], modeles: /.*/, energies: ['hybride'],
    lignes: ['Batteries haute tension des hybrides et hybrides rechargeables Hyundai couvertes 8 ans ou 160 000 km.'],
    sources: [S.hyundaiLu] },
  { id: 'G-VE-KIA-EV-01', marques: ['kia'], modeles: /e-?niro|niro\s?ev|e-?soul|\bev\s?[3-9]\b/, energies: ['electrique'],
    lignes: ['Batterie haute tension : 7 ans ou 150 000 km avec un état de santé (SoH) d\'au moins 70 % pour les années-modèles antérieures à 2026 ; à partir de l\'année-modèle 2026, 8 ans ou 160 000 km, 80 % à 5 ans et 70 % à 8 ans.', 'Transférable aux propriétaires suivants si l\'entretien a été régulier.'],
    sources: [S.kia] },
  { id: 'G-VE-MG4-01', marques: ['mg'], modeles: /mg\s?4|zs/, energies: ['electrique'],
    lignes: ['Garantie 7 ans ou 150 000 km sur le véhicule et la batterie ; le seuil de capacité n\'est pas publié par la source.'],
    sources: [S.mg] },
  { id: 'G-VE-SPRING-01', marques: ['dacia'], modeles: /spring/, energies: ['electrique'],
    lignes: ['Batterie de traction garantie 8 ans ou 120 000 km ; remplacement si l\'état de santé (SoH) est inférieur à 75 %.'],
    sources: [S.dacia] },
  { id: 'G-VE-I3-01', marques: ['bmw'], modeles: /\bi3\b/, energies: ['electrique'],
    lignes: ['Batterie haute tension : 8 ans ou 160 000 km, perte de capacité excessive sous 70 % de capacité nette.'],
    sources: [S.argus2020] },
  { id: 'G-VE-500E-01', marques: ['fiat'], modeles: /500\s?e\b|500\s+(?:la\s+prima|electri|électri)|new\s+500/, energies: ['electrique'],
    lignes: ['Batterie haute tension garantie 8 ans ou 160 000 km ; le seuil de capacité n\'est pas indiqué.'],
    sources: [S.argus2021] },
  { id: 'G-VE-SMART-EQ-01', marques: ['smart'], modeles: /eq|fortwo|forfour/, energies: ['electrique'],
    lignes: ['Batterie garantie 8 ans ou 100 000 km, si la capacité descend sous 70 %.'],
    sources: [S.argus2020] },
  { id: 'G-VE-TOYOTA-HSD-01', marques: ['toyota'], modeles: /.*/, energies: ['hybride'],
    lignes: ['Batterie de traction hybride : garantie constructeur 5 ans ou 100 000 km, puis « Bilan de santé Batterie » (1 an ou 15 000 km, renouvelable) jusqu\'à 10 ans ou 250 000 km, sous réserve d\'un contrôle batterie positif dans le réseau agréé.', 'Transférable sans frais en cas de revente.'],
    sources: [S.toyotaHsd, S.toyotaExpert] },
  { id: 'G-VE-TOYOTA-BEV-01', marques: ['toyota'], modeles: /.*/, energies: ['electrique'],
    lignes: ['Batterie lithium-ion des Toyota 100 % électriques : garantie minimale 8 ans ou 160 000 km pour 70 % de capacité ; rattachée au véhicule et transférée au nouvel acquéreur.'],
    sources: [S.toyotaBev] },
  { id: 'G-VE-LEAF-01', marques: ['nissan'], modeles: /leaf/, energies: ['electrique'], annee_min: 2018,
    lignes: ['Garantie de l\'état de santé de la batterie (Leaf 40 et 62 kWh) : perte de capacité sous 9 barres sur 12 de la jauge ; 8 ans ou 160 000 km en Belgique, 8 ans ou 100 000 miles au Royaume-Uni ; véhicules d\'occasion inclus.'],
    sources: [S.nissanBe, S.nissanUk] },
  { id: 'G-PHEV-VOLVO-01', marques: ['volvo'], modeles: /.*/, energies: ['electrique', 'hybride'],
    lignes: ['Seuil de remplacement de la batterie : sous 55 % de capacité (repère presse, la page officielle n\'a pas été lue).'],
    sources: [S.argus2021] },
]

/** Repère de presse 2021, confirmé, pour les marques sans entrée propre. */
export const REPERE_TRANSVERSAL = {
  id: 'G-VE-TRANSVERSAL-01',
  marques: ['citroen', 'citroën', 'ds', 'dacia', 'honda', 'kia', 'mg', 'mercedes', 'mercedes-benz', 'mini', 'opel', 'smart'],
  lignes: ['Repère de presse pour les modèles vendus en 2020-2021 : garantie standard de 8 ans ou 160 000 km avec un seuil de capacité de 70 %. Les conditions de CE modèle sont à lire dans son livret de garantie.'],
  sources: [S.argus2021],
}

const norm = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** 'electrique' | 'hybride' | null, d'après ce que l'identification a écrit. */
export function energieBatterie(vehicule) {
  const t = norm([vehicule?.carburant, vehicule?.motorisation].filter(Boolean).join(' '))
  if (/hybride|hybrid|phev|plug-?in|rechargeable/.test(t)) return 'hybride'
  if (/electri|\bev\b|kwh/.test(t)) return 'electrique'
  return null
}

export const estEtranger = (src) => src.pays !== 'FR' && src.pays !== 'UE'

/** Garanties qui concernent ce véhicule. Chaque résultat dit si c'est une
 *  garantie publiée en France ou une information de contexte. */
export function garantiesPourVehicule(vehicule, annee = null) {
  const energie = energieBatterie(vehicule)
  if (!energie) return { energie: null, garanties: [] }
  const marque = norm(vehicule?.marque)
  const modele = norm([vehicule?.modele, vehicule?.motorisation].filter(Boolean).join(' '))
  const garanties = GARANTIES_BATTERIE
    .filter((g) => g.marques.map(norm).includes(marque) && g.energies.includes(energie) && g.modeles.test(modele))
    .filter((g) => !(g.annee_min && typeof annee === 'number' && annee < g.annee_min))
  // Toyota électrique : l'entrée générique ne s'applique pas à un hybride.
  const liste = garanties.length > 0
    ? garanties
    : (REPERE_TRANSVERSAL.marques.map(norm).includes(marque) && energie === 'electrique' ? [REPERE_TRANSVERSAL] : [])
  return {
    energie,
    garanties: liste.map((g) => ({
      id: g.id,
      lignes: g.lignes,
      sources: g.sources,
      contexte: g.sources.every(estEtranger),
    })),
  }
}

/** Questions au vendeur, à copier. Neutres : elles ne supposent aucun défaut. */
export function questionsBatterie(energie, marque) {
  if (!energie) return []
  const q = [
    'Pouvez-vous me fournir un certificat récent de l\'état de santé de la batterie (SoH), établi par le réseau de la marque ou par un organisme indépendant ?',
    'Avez-vous le livret ou le certificat de garantie de la batterie (date de début, kilométrage limite, seuil de capacité) ?',
  ]
  if (energie === 'electrique') q.push('La batterie est-elle vendue avec la voiture, ou est-elle en location ?')
  if (energie === 'hybride' && norm(marque) === 'toyota') q.push('Le « Bilan de santé Batterie » a-t-il été fait dans le réseau Toyota au cours des 12 derniers mois ?')
  return q
}
