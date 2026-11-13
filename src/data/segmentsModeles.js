// FICHIER GÉNÉRÉ — ne pas modifier à la main.
// Source : scripts/generer-segments-modeles.mjs, à partir de
// src/data/famillesMoteur.js et de segmentsDepuisLibelleModele()
// (supabase/functions/_shared/marche.ts). Régénérer après toute modification
// de la table des familles moteur :
//   node scripts/generer-segments-modeles.mjs
// tests/marche.test.mjs échoue si ce fichier est périmé.
//
// À quoi ça sert : situer le prix d'un MODÈLE sur une page /moteur. Les
// agrégats de prix sont indexés par modèle canonique ; les libellés de
// famillesMoteur sont écrits pour un lecteur humain. Cette table fait le pont.

/** slug de famille moteur → couples (marque, modèle) du relevé de prix. */
export const SEGMENTS_PAR_SLUG = {
  'audi-2-0-tdi-ea288': [
    { marque: 'audi', modele: 'a3', libelle: 'A3' },
    { marque: 'audi', modele: 'a4', libelle: 'A4' },
    { marque: 'audi', modele: 'q3', libelle: 'Q3' },
    { marque: 'audi', modele: 'a1', libelle: 'A1' },
  ],
  'audi-4-0-v8-tfsi': [
    { marque: 'audi', modele: 's6', libelle: 'S6' },
    { marque: 'audi', modele: 's7', libelle: 'S7' },
    { marque: 'audi', modele: 's8', libelle: 'S8' },
    { marque: 'audi', modele: 'rs6', libelle: 'RS6' },
  ],
  'bmw-1-6-essence-n13': [
    { marque: 'bmw', modele: 'serie 1', libelle: 'Série 1' },
    { marque: 'bmw', modele: 'serie 3', libelle: 'Série 3' },
    { marque: 'bmw', modele: 'x1', libelle: 'X1' },
  ],
  'bmw-2-0-diesel-b47': [
    { marque: 'bmw', modele: 'serie 1', libelle: 'Série 1' },
    { marque: 'bmw', modele: 'serie 3', libelle: 'Série 3' },
    { marque: 'bmw', modele: 'x1', libelle: 'X1' },
    { marque: 'bmw', modele: 'serie 5', libelle: 'Série 5' },
  ],
  'bmw-2-0-diesel-n47': [
    { marque: 'bmw', modele: 'serie 1', libelle: 'Série 1' },
    { marque: 'bmw', modele: 'serie 3', libelle: 'Série 3' },
    { marque: 'bmw', modele: 'x1', libelle: 'X1' },
    { marque: 'bmw', modele: 'serie 5', libelle: 'Série 5' },
  ],
  'dacia-1-6-8v': [
    { marque: 'dacia', modele: 'sandero', libelle: 'Sandero' },
    { marque: 'dacia', modele: 'logan', libelle: 'Logan' },
    { marque: 'dacia', modele: 'lodgy', libelle: 'Lodgy' },
  ],
  'fiat-0-9-twinair': [
    { marque: 'fiat', modele: '500', libelle: '500' },
    { marque: 'fiat', modele: 'panda', libelle: 'Panda' },
    { marque: 'fiat', modele: '500l', libelle: '500L' },
  ],
  'fiat-1-0-firefly-70': [
    { marque: 'fiat', modele: '500', libelle: '500' },
    { marque: 'fiat', modele: 'panda', libelle: 'Panda' },
    { marque: 'lancia', modele: 'ypsilon', libelle: 'Ypsilon' },
  ],
  'fiat-1-3-multijet': [
    { marque: 'fiat', modele: '500', libelle: '500' },
    { marque: 'fiat', modele: 'panda', libelle: 'Panda' },
    { marque: 'opel', modele: 'corsa', libelle: 'Corsa' },
    { marque: 'fiat', modele: 'punto evo', libelle: 'Punto Evo' },
  ],
  'ford-1-0-ecoboost': [
    { marque: 'ford', modele: 'fiesta', libelle: 'Fiesta' },
    { marque: 'ford', modele: 'focus', libelle: 'Focus' },
    { marque: 'ford', modele: 'puma', libelle: 'Puma' },
    { marque: 'ford', modele: 'ecosport', libelle: 'EcoSport' },
  ],
  'ford-1-5-ecoboost-dragon': [
    { marque: 'ford', modele: 'focus', libelle: 'Focus' },
    { marque: 'ford', modele: 'kuga', libelle: 'Kuga' },
    { marque: 'ford', modele: 'puma st', libelle: 'Puma ST' },
    { marque: 'ford', modele: 'fiesta st', libelle: 'Fiesta ST' },
  ],
  'ford-1-6-ecoboost-sigma': [
    { marque: 'ford', modele: 'focus', libelle: 'Focus' },
    { marque: 'ford', modele: 'mondeo', libelle: 'Mondeo' },
    { marque: 'ford', modele: 'c-max', libelle: 'C-Max' },
    { marque: 'ford', modele: 'kuga', libelle: 'Kuga' },
  ],
  'hyundai-1-0-t-gdi': [
    { marque: 'hyundai', modele: 'i20', libelle: 'i20' },
    { marque: 'hyundai', modele: 'i30', libelle: 'i30' },
    { marque: 'hyundai', modele: 'kona', libelle: 'Kona' },
    { marque: 'kia', modele: 'ceed', libelle: 'Ceed' },
    { marque: 'kia', modele: 'stonic', libelle: 'Stonic' },
  ],
  'hyundai-1-4-t-gdi': [
    { marque: 'hyundai', modele: 'i30', libelle: 'i30' },
    { marque: 'hyundai', modele: 'kona', libelle: 'Kona' },
    { marque: 'kia', modele: 'ceed', libelle: 'Ceed' },
    { marque: 'kia', modele: 'sportage', libelle: 'Sportage' },
  ],
  'hyundai-1-6-crdi': [
    { marque: 'hyundai', modele: 'i30', libelle: 'i30' },
    { marque: 'hyundai', modele: 'tucson', libelle: 'Tucson' },
    { marque: 'kia', modele: 'ceed', libelle: 'Ceed' },
    { marque: 'kia', modele: 'sportage', libelle: 'Sportage' },
  ],
  'hyundai-1-6-gdi': [
    { marque: 'hyundai', modele: 'i30', libelle: 'i30' },
    { marque: 'hyundai', modele: 'tucson', libelle: 'Tucson' },
    { marque: 'kia', modele: 'ceed', libelle: 'Ceed' },
    { marque: 'kia', modele: 'sportage', libelle: 'Sportage' },
  ],
  'hyundai-2-0-essence-theta-ii': [
    { marque: 'hyundai', modele: 'tucson', libelle: 'Tucson' },
    { marque: 'hyundai', modele: 'ix35', libelle: 'Ix35' },
    { marque: 'kia', modele: 'sportage', libelle: 'Sportage' },
    { marque: 'hyundai', modele: 'santa fe', libelle: 'Santa Fe' },
  ],
  'mercedes-1-3-essence-m282': [
    { marque: 'mercedes', modele: 'classe a', libelle: 'Classe A' },
    { marque: 'mercedes', modele: 'classe b', libelle: 'Classe B' },
    { marque: 'mercedes', modele: 'cla', libelle: 'CLA' },
    { marque: 'mercedes', modele: 'gla', libelle: 'GLA' },
  ],
  'mercedes-1-5-cdi-om607': [
    { marque: 'mercedes', modele: 'classe a', libelle: 'Classe A' },
    { marque: 'mercedes', modele: 'classe b', libelle: 'Classe B' },
    { marque: 'mercedes', modele: 'cla', libelle: 'CLA' },
  ],
  'mercedes-2-0-diesel-om654': [
    { marque: 'mercedes', modele: 'classe c', libelle: 'Classe C' },
    { marque: 'mercedes', modele: 'classe e', libelle: 'Classe E' },
    { marque: 'mercedes', modele: 'glc', libelle: 'GLC' },
    { marque: 'mercedes', modele: 'classe a', libelle: 'Classe A' },
  ],
  'mercedes-2-1-cdi-om651': [
    { marque: 'mercedes', modele: 'classe c', libelle: 'Classe C' },
    { marque: 'mercedes', modele: 'classe e', libelle: 'Classe E' },
    { marque: 'mercedes', modele: 'vito', libelle: 'Vito' },
    { marque: 'mercedes', modele: 'sprinter', libelle: 'Sprinter' },
  ],
  'mini-1-6-cooper-s-prince': [
    { marque: 'mini', modele: 'cooper s', libelle: 'Cooper S' },
    { marque: 'mini', modele: 'countryman', libelle: 'Countryman' },
    { marque: 'mini', modele: 'clubman', libelle: 'Clubman' },
  ],
  'nissan-1-6-dig-t': [
    { marque: 'nissan', modele: 'juke', libelle: 'Juke' },
    { marque: 'nissan', modele: 'qashqai', libelle: 'Qashqai' },
    { marque: 'renault', modele: 'clio rs', libelle: 'Clio RS' },
    { marque: 'renault', modele: 'kadjar', libelle: 'Kadjar' },
  ],
  'nissan-2-0-essence': [
    { marque: 'nissan', modele: 'qashqai', libelle: 'Qashqai' },
    { marque: 'nissan', modele: 'x-trail', libelle: 'X-Trail' },
    { marque: 'renault', modele: 'scenic', libelle: 'Scénic' },
  ],
  'peugeot-1-2-puretech-100': [
    { marque: 'peugeot', modele: '208', libelle: '208' },
    { marque: 'peugeot', modele: '2008', libelle: '2008' },
    { marque: 'opel', modele: 'corsa f', libelle: 'Corsa F' },
    { marque: 'citroen', modele: 'c3', libelle: 'C3' },
  ],
  'peugeot-1-2-puretech-110': [
    { marque: 'peugeot', modele: '208', libelle: '208' },
    { marque: 'peugeot', modele: '2008', libelle: '2008' },
    { marque: 'peugeot', modele: '308', libelle: '308' },
    { marque: 'citroen', modele: 'c3', libelle: 'C3' },
    { marque: 'opel', modele: 'corsa f', libelle: 'Corsa F' },
  ],
  'peugeot-1-2-puretech-130': [
    { marque: 'peugeot', modele: '3008', libelle: '3008' },
    { marque: 'peugeot', modele: '308', libelle: '308' },
    { marque: 'citroen', modele: 'c4', libelle: 'C4' },
    { marque: 'ds', modele: '7 crossback', libelle: '7 Crossback' },
  ],
  'peugeot-1-2-puretech-82-atmospherique': [
    { marque: 'citroen', modele: 'c3', libelle: 'C3' },
    { marque: 'peugeot', modele: '208', libelle: '208' },
    { marque: 'peugeot', modele: '2008', libelle: '2008' },
    { marque: 'citroen', modele: 'c-elysee', libelle: 'C-Elysée' },
  ],
  'peugeot-1-5-bluehdi': [
    { marque: 'peugeot', modele: '208', libelle: '208' },
    { marque: 'peugeot', modele: '308', libelle: '308' },
    { marque: 'peugeot', modele: '3008', libelle: '3008' },
    { marque: 'citroen', modele: 'c3', libelle: 'C3' },
    { marque: 'citroen', modele: 'c4', libelle: 'C4' },
    { marque: 'citroen', modele: 'c5 aircross', libelle: 'C5 Aircross' },
    { marque: 'opel', modele: 'astra', libelle: 'Astra' },
    { marque: 'opel', modele: 'grandland', libelle: 'Grandland' },
  ],
  'peugeot-1-6-hdi': [
    { marque: 'peugeot', modele: '207', libelle: '207' },
    { marque: 'peugeot', modele: '208', libelle: '208' },
    { marque: 'peugeot', modele: '308', libelle: '308' },
    { marque: 'peugeot', modele: '3008', libelle: '3008' },
    { marque: 'citroen', modele: 'c3', libelle: 'C3' },
    { marque: 'citroen', modele: 'c4', libelle: 'C4' },
    { marque: 'citroen', modele: 'berlingo', libelle: 'Berlingo' },
    { marque: 'ford', modele: 'fiesta', libelle: 'Fiesta' },
    { marque: 'ford', modele: 'focus', libelle: 'Focus' },
  ],
  'peugeot-1-6-thp': [
    { marque: 'peugeot', modele: '308 gt', libelle: '308 GT' },
    { marque: 'peugeot', modele: '3008', libelle: '3008' },
    { marque: 'citroen', modele: 'ds3', libelle: 'DS3' },
    { marque: 'mini', modele: 'cooper s', libelle: 'Cooper S' },
  ],
  'peugeot-2-0-bluehdi': [
    { marque: 'peugeot', modele: '308', libelle: '308' },
    { marque: 'peugeot', modele: '3008', libelle: '3008' },
    { marque: 'peugeot', modele: '508', libelle: '508' },
    { marque: 'citroen', modele: 'c5 aircross', libelle: 'C5 Aircross' },
  ],
  'peugeot-2-2-bluehdi': [
    { marque: 'peugeot', modele: 'expert', libelle: 'Expert' },
    { marque: 'citroen', modele: 'jumpy', libelle: 'Jumpy' },
    { marque: 'peugeot', modele: '508', libelle: '508' },
    { marque: 'citroen', modele: 'spacetourer', libelle: 'SpaceTourer' },
  ],
  'renault-0-9-tce': [
    { marque: 'renault', modele: 'clio', libelle: 'Clio' },
    { marque: 'renault', modele: 'twingo', libelle: 'Twingo' },
    { marque: 'dacia', modele: 'sandero', libelle: 'Sandero' },
    { marque: 'dacia', modele: 'duster', libelle: 'Duster' },
  ],
  'renault-1-0-sce': [
    { marque: 'renault', modele: 'twingo', libelle: 'Twingo' },
    { marque: 'renault', modele: 'clio', libelle: 'Clio' },
    { marque: 'dacia', modele: 'sandero', libelle: 'Sandero' },
  ],
  'renault-1-0-tce': [
    { marque: 'renault', modele: 'clio', libelle: 'Clio' },
    { marque: 'renault', modele: 'captur', libelle: 'Captur' },
    { marque: 'dacia', modele: 'sandero', libelle: 'Sandero' },
  ],
  'renault-1-2-tce': [
    { marque: 'renault', modele: 'clio', libelle: 'Clio' },
    { marque: 'renault', modele: 'captur', libelle: 'Captur' },
    { marque: 'renault', modele: 'kadjar', libelle: 'Kadjar' },
    { marque: 'nissan', modele: 'qashqai', libelle: 'Qashqai' },
  ],
  'renault-1-3-tce': [
    { marque: 'renault', modele: 'clio', libelle: 'Clio' },
    { marque: 'renault', modele: 'captur', libelle: 'Captur' },
    { marque: 'renault', modele: 'megane', libelle: 'Mégane' },
    { marque: 'mercedes', modele: 'classe a', libelle: 'Classe A' },
  ],
  'renault-1-5-dci': [
    { marque: 'renault', modele: 'clio', libelle: 'Clio' },
    { marque: 'renault', modele: 'megane', libelle: 'Mégane' },
    { marque: 'dacia', modele: 'duster', libelle: 'Duster' },
    { marque: 'nissan', modele: 'qashqai', libelle: 'Qashqai' },
    { marque: 'renault', modele: 'scenic', libelle: 'Scénic' },
  ],
  'renault-1-6-16v': [
    { marque: 'renault', modele: 'megane', libelle: 'Mégane' },
    { marque: 'dacia', modele: 'duster', libelle: 'Duster' },
    { marque: 'renault', modele: 'kangoo', libelle: 'Kangoo' },
    { marque: 'dacia', modele: 'logan', libelle: 'Logan' },
  ],
  'renault-1-6-dci': [
    { marque: 'renault', modele: 'scenic', libelle: 'Scénic' },
    { marque: 'renault', modele: 'megane', libelle: 'Mégane' },
    { marque: 'renault', modele: 'kadjar', libelle: 'Kadjar' },
    { marque: 'renault', modele: 'espace', libelle: 'Espace' },
    { marque: 'renault', modele: 'talisman', libelle: 'Talisman' },
  ],
  'renault-1-6-sce': [
    { marque: 'renault', modele: 'captur', libelle: 'Captur' },
    { marque: 'renault', modele: 'megane', libelle: 'Mégane' },
    { marque: 'dacia', modele: 'duster', libelle: 'Duster' },
    { marque: 'nissan', modele: 'qashqai', libelle: 'Qashqai' },
  ],
  'toyota-1-8-essence': [
    { marque: 'toyota', modele: 'auris', libelle: 'Auris' },
    { marque: 'toyota', modele: 'avensis', libelle: 'Avensis' },
    { marque: 'toyota', modele: 'verso', libelle: 'Verso' },
  ],
  'toyota-1-8-hybride': [
    { marque: 'toyota', modele: 'prius', libelle: 'Prius' },
    { marque: 'toyota', modele: 'auris hsd', libelle: 'Auris HSD' },
    { marque: 'toyota', modele: 'corolla', libelle: 'Corolla' },
    { marque: 'toyota', modele: 'c-hr', libelle: 'C-HR' },
  ],
  'volkswagen-1-6-et-2-0-tdi-ea189': [
    { marque: 'volkswagen', modele: 'golf', libelle: 'Golf' },
    { marque: 'volkswagen', modele: 'passat', libelle: 'Passat' },
    { marque: 'audi', modele: 'a3', libelle: 'A3' },
    { marque: 'skoda', modele: 'octavia', libelle: 'Octavia' },
    { marque: 'seat', modele: 'ibiza', libelle: 'Ibiza' },
  ],
  'volkswagen-1-6-tdi-crbc': [
    { marque: 'volkswagen', modele: 'golf', libelle: 'Golf' },
    { marque: 'volkswagen', modele: 'caddy', libelle: 'Caddy' },
    { marque: 'skoda', modele: 'octavia', libelle: 'Octavia' },
    { marque: 'seat', modele: 'leon', libelle: 'Leon' },
  ],
  'volkswagen-1-8-et-2-0-tsi': [
    { marque: 'volkswagen', modele: 'golf', libelle: 'Golf' },
    { marque: 'audi', modele: 'a3', libelle: 'A3' },
    { marque: 'audi', modele: 'a4', libelle: 'A4' },
    { marque: 'audi', modele: 'q5', libelle: 'Q5' },
  ],
  'volkswagen-2-0-tdi-ea288': [
    { marque: 'volkswagen', modele: 'golf', libelle: 'Golf' },
    { marque: 'volkswagen', modele: 'passat', libelle: 'Passat' },
    { marque: 'volkswagen', modele: 'tiguan', libelle: 'Tiguan' },
    { marque: 'skoda', modele: 'octavia', libelle: 'Octavia' },
    { marque: 'seat', modele: 'leon', libelle: 'Leon' },
  ],
  'volvo-2-0-diesel-vea': [
    { marque: 'volvo', modele: 'v40', libelle: 'V40' },
    { marque: 'volvo', modele: 'v60', libelle: 'V60' },
    { marque: 'volvo', modele: 'xc60', libelle: 'XC60' },
    { marque: 'volvo', modele: 'xc40', libelle: 'XC40' },
  ],
  'volvo-2-0-essence-vea': [
    { marque: 'volvo', modele: 'v40', libelle: 'V40' },
    { marque: 'volvo', modele: 'v60', libelle: 'V60' },
    { marque: 'volvo', modele: 'xc60', libelle: 'XC60' },
    { marque: 'volvo', modele: 'xc40', libelle: 'XC40' },
  ],
}

/** Segments à interroger pour une famille moteur ([] si aucun). */
export function segmentsPourFamille(slug) {
  return SEGMENTS_PAR_SLUG[slug] ?? []
}
