// Génère des CSA d'exemple AVEC LE GÉNÉRATEUR OFFICIEL HistoVec (csaAsPdf,
// pdf-lib) : les PDF produits sont fidèles à l'octet au vrai document, au lieu
// d'en être une imitation. Données entièrement inventées et anonymes.
import { writeFileSync, mkdirSync } from 'node:fs'
import { generateCsa } from './index.js'

// PNG 1×1 transparent : les deux logos sont embarqués par le générateur, leur
// contenu n'a aucune incidence sur le texte extrait.
const PNG_1x1 = Uint8Array.from(atob(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
), c => c.charCodeAt(0))

const commun = {
  histoVecLogoBytes: PNG_1x1,
  marianneImageBytes: PNG_1x1,
  qrCodeUrl: 'https://histovec.interieur.gouv.fr/histovec/fixture',
  webSiteUrl: 'https://histovec.interieur.gouv.fr',
  dateDonnees: '2026-11-01',
  validityDate: '2026-11-16',
}

// Historique : codes réels de backend/src/constant/historique.js.
const histoSimple = ['13/04/2020 IMMAT_NORMALE']
const histoDeuxMains = ['13/04/2020 IMMAT_NORMALE', '02/09/2023 CHANG_TIT_NORMAL']
const histoLocation = [
  '13/04/2020 IMMAT_NORMALE',
  '20/06/2021 CHANG_LOC',
  '04/02/2024 CHANG_TIT_NORMAL',
]
const histoVge = [
  '13/04/2020 IMMAT_NORMALE',
  '11/07/2023 DEC_VE',
  '28/08/2023 PREM_RAP_VE',
  '15/09/2023 CHANG_TIT_NORMAL',
]

const cas = [
  {
    nom: 'csa-aucune-anomalie',
    quoi: "Rien à signaler. Couvre les TROIS formes négatives : « Aucune » (oppositions, saisie), « Aucun » (gage), « Non » (suspensions).",
    base: { marque: 'PEUGEOT', plaque: 'AA-123-AA', vin: 'VF3XXXXXXXXXXXXXX', premierCertificat: '2020-04-13' },
    detail: {
      duplicataTitre: 'non', perteTitre: 'non', volTitre: 'non', volVehicule: 'non',
      dvsCurrentStatusLines: ['Aucune'],
      gagesCurrentStatusLines: ['Aucun'],
      otcisCurrentStatusLines: ['Aucune'],
      otcisPVCurrentStatusLines: ['Aucune'],
      oveisCurrentStatusLines: '',
      ovesCurrentStatusLines: '',
      proceduresReparationControleeStatus: 'non',
      suspensionsCurrentStatusLines: ['Non'],
      historyItems: histoDeuxMains,
    },
  },
  {
    nom: 'csa-gage-et-opposition',
    quoi: 'Gage ET opposition au transfert : « ne rien payer avant levée ».',
    base: { marque: 'RENAULT', plaque: 'BB-456-BB', vin: 'VF1YYYYYYYYYYYYYY', premierCertificat: '2018-09-05' },
    detail: {
      duplicataTitre: 'non', perteTitre: 'non', volTitre: 'non', volVehicule: 'non',
      dvsCurrentStatusLines: ['Aucune'],
      gagesCurrentStatusLines: ['- Nom du créancier :  ORGANISME DE CREDIT FIXTURE', '  Date du gage :  12/03/2024'],
      otcisCurrentStatusLines: ["- Date de l'opposition :  04/05/2025"],
      otcisPVCurrentStatusLines: ['PV(s) en attente', '- Date du PV :  22/01/2025'],
      oveisCurrentStatusLines: '',
      ovesCurrentStatusLines: '',
      proceduresReparationControleeStatus: 'non',
      suspensionsCurrentStatusLines: ['Non'],
      historyItems: histoSimple,
    },
  },
  {
    nom: 'csa-vehicule-endommage-en-cours',
    quoi: "Procédure de réparation contrôlée EN COURS, libellé CSA « Opposition véhicule endommagé ».",
    base: { marque: 'VOLKSWAGEN', plaque: 'CC-789-CC', vin: 'WVWZZZZZZZZZZZZZZ', premierCertificat: '2020-04-13' },
    detail: {
      duplicataTitre: 'non', perteTitre: 'non', volTitre: 'non', volVehicule: 'non',
      dvsCurrentStatusLines: ['Aucune'],
      gagesCurrentStatusLines: ['Aucun'],
      otcisCurrentStatusLines: ['Aucune'],
      otcisPVCurrentStatusLines: ['Aucune'],
      oveisCurrentStatusLines: '',
      ovesCurrentStatusLines: ["- Date de l'opposition :  11/07/2023"],
      proceduresReparationControleeStatus: 'oui',
      suspensionsCurrentStatusLines: ['Non'],
      historyItems: histoVge,
    },
  },
  {
    nom: 'csa-vehicule-irreparable',
    quoi: 'Véhicule économiquement irréparable (OVEI) + suspension motivée.',
    base: { marque: 'CITROEN', plaque: 'DD-321-DD', vin: 'VF7ZZZZZZZZZZZZZZ', premierCertificat: '2016-02-29' },
    detail: {
      duplicataTitre: 'oui', perteTitre: 'non', volTitre: 'non', volVehicule: 'non',
      dvsCurrentStatusLines: ["- Nom de l'autorité à l'origine de l'inscription :", '    TRESORERIE FIXTURE', '  Date de la déclaration valant saisie :  09/10/2024'],
      gagesCurrentStatusLines: ['Aucun'],
      otcisCurrentStatusLines: ['Aucune'],
      otcisPVCurrentStatusLines: ['Aucune'],
      oveisCurrentStatusLines: ["- Date de l'opposition :  03/03/2024"],
      ovesCurrentStatusLines: '',
      proceduresReparationControleeStatus: 'oui',
      suspensionsCurrentStatusLines: ['- Motif :  PVE', '  Date de la suspension :  01/03/2024'],
      historyItems: histoVge,
    },
  },
  {
    nom: 'csa-vole',
    quoi: 'Véhicule déclaré volé.',
    base: { marque: 'BMW', plaque: 'EE-654-EE', vin: 'WBAZZZZZZZZZZZZZZ', premierCertificat: '2021-11-08' },
    detail: {
      duplicataTitre: 'non', perteTitre: 'oui', volTitre: 'oui', volVehicule: 'oui',
      dvsCurrentStatusLines: ['Aucune'],
      gagesCurrentStatusLines: ['Aucun'],
      otcisCurrentStatusLines: ['Aucune'],
      otcisPVCurrentStatusLines: ['Aucune'],
      oveisCurrentStatusLines: '',
      ovesCurrentStatusLines: '',
      proceduresReparationControleeStatus: 'non',
      suspensionsCurrentStatusLines: ['Non'],
      historyItems: histoSimple,
    },
  },
  {
    nom: 'csa-ancienne-location',
    quoi: "Passage en location (CHANG_LOC) : « voiture de particulier » contredite.",
    base: { marque: 'DACIA', plaque: 'FF-987-FF', vin: 'UU1ZZZZZZZZZZZZZZ', premierCertificat: '2020-04-13' },
    detail: {
      duplicataTitre: 'non', perteTitre: 'non', volTitre: 'non', volVehicule: 'non',
      dvsCurrentStatusLines: ['Aucune'],
      gagesCurrentStatusLines: ['Aucun'],
      otcisCurrentStatusLines: ['Aucune'],
      otcisPVCurrentStatusLines: ['Aucune'],
      oveisCurrentStatusLines: '',
      ovesCurrentStatusLines: '',
      proceduresReparationControleeStatus: 'non',
      suspensionsCurrentStatusLines: ['Non'],
      historyItems: histoLocation,
    },
  },
  {
    nom: 'csa-certificat-annule',
    quoi: "Certificat annulé : la section détaillée DISPARAÎT entièrement.",
    base: {
      marque: 'FORD', plaque: 'GG-147-GG', vin: 'WF0ZZZZZZZZZZZZZZ', premierCertificat: '2014-06-20',
      isCIAnnule: true, annulationCurrentStatus: 'oui', dateAnnulationCI: '2025-07-30',
    },
    detail: null,
  },
]

mkdirSync('sortie', { recursive: true })
const index = []
for (const c of cas) {
  const octets = await generateCsa({ ...commun, ...c.base }, c.detail ?? undefined)
  writeFileSync(`sortie/${c.nom}.pdf`, octets)
  index.push({ nom: c.nom, quoi: c.quoi, octets: octets.length })
  console.log(`${c.nom}.pdf — ${octets.length} octets`)
}
writeFileSync('sortie/index.json', JSON.stringify(index, null, 2))
