// Règles PURES de la fusion des sources (sprint 23, étape f) — aucun réseau,
// aucune écriture. Testées hors ligne par tests/fusion-regles.test.mjs.
//
// Décisions d'Utku du 11 nov. 2026 :
//   · une source n'est rattachée à une panne EXISTANTE que si l'affirmation
//     désigne le MÊME ORGANE et le MÊME DÉFAUT. « 2 mots en commun » ne suffit
//     pas. Un cas douteux devient une NOUVELLE panne proposée, jamais un ajout
//     de source ;
//   · gravité d'une nouvelle panne : celle que la SOURCE établit (montant
//     publié dans un extrait de page confirmée, ou danger pour les occupants
//     écrit dans un extrait), jamais promue en « casse » sans coût publié ;
//     sans gravité établie, pas de panne ;
//   · une affirmation à période BORNANTE n'est pas écrite tant que les pannes
//     n'ont pas de champ d'années ;
//   · les prises en charge sont affichées seulement (aucun effet sur la note).

// Apostrophe typographique ramenée à l'apostrophe droite : « pompe d’injection »
// doit se lire comme « pompe d'injection ».
const norm = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`´]/g, "'")

// ── Organes — liste PROPRE à la fusion, plus fine que celle de la négociation :
// courroie et chaîne de distribution sont deux organes (on ne rattache pas
// une source sur la chaîne à une panne de courroie).
export const ORGANES_FUSION = {
  courroie_distribution: /\bcourroie\s+(?:de\s+)?distribution|\bcourroie\s+(?:humide|crantee|dans\s+le\s+bain)|\bcourroie\b(?!\s+(?:d'accessoires|accessoire|alternateur|de\s+servitude))/,
  chaine_distribution: /\bchaine(?:\s+de\s+distribution)?\b|\btendeur\s+de\s+chaine/,
  courroie_accessoires: /\bcourroie\s+(?:d'accessoires|accessoire|alternateur|de\s+servitude)/,
  turbo: /\bturbo(?:compresseur)?s?\b/,
  // Injecteurs et pompe haute pression : deux organes (une fuite d'injecteur
  // n'est pas une fuite de pompe HP).
  injecteurs: /\binjecteurs?\b/,
  pompe_hp: /\bpompe\s+(?:a\s+|d')?(?:injection|haute\s+pression|hp)\b|\bhpfp\b|\bcp4\b|\baxe\s+de\s+(?:la\s+)?pompe\s+haute\s+pression\b/,
  egr: /\begr\b|\bvanne\s+de\s+recirculation/,
  fap: /\bfap\b|\bfiltre\s+a\s+particules/,
  adblue: /\badblue\b|\bscr\b|\breservoir\s+d'uree|\buree\b/,
  embrayage: /\bembrayages?\b|\bvolant\s+moteur\b|\bbi-?masse\b/,
  boite: /\bboite\b|\bmecatronique\b|\bdsg\b|\bedc\b|\beat[68]\b|\bcvt\b|\bvariateur\b|\bconvertisseur\b/,
  lubrification: /\bpompe\s+a\s+huile\b|\bcrepine\b|\bpression\s+d'huile\b/,
  consommation_huile: /\bconsommation\s+d'huile\b|\bsurconsommation\s+d'huile\b|\bconsomme\s+de\s+l'huile\b|\bsegments?\b|\bsegmentation\b|\bdilution\b/,
  // Le refroidissement est découpé : une pompe à eau n'est pas une durite de
  // dégazage, un thermostat n'est pas un radiateur.
  pompe_eau: /\bpompe\s+a\s+eau\b/,
  thermostat: /\bthermostat\b|\bboitier\s+de\s+(?:sortie\s+d'eau|thermostat)\b/,
  refroidissement: /\bradiateur\b|\bliquide\s+de\s+refroidissement\b|\bvase\s+d'expansion\b|\brefroidissement\b|\bdurites?\s+de\s+(?:refroidissement|degazage)\b/,
  joint_culasse: /\bjoint\s+de\s+culasse\b|\bculasse\b/,
  allumage: /\bbobines?\b|\bbougies?\b|\ballumage\b/,
  admission: /\badmission\b|\bcollecteur\b|\bvolets?\s+de\s+turbulence\b|\bpapillon\b/,
  carburant: /\bpompe\s+a\s+carburant\b|\bpompe\s+de\s+gavage\b|\bcircuit\s+de\s+carburant\b|\bfuite\s+de\s+carburant\b/,
  electrique: /\balternateur\b|\bdemarreur\b|\bbatterie\b|\bfaisceau\b|\bcalculateur\b|\becu\b/,
  freinage: /\bfrein(?:s|age)?\b|\bservofrein\b|\bplaquettes?\b|\bdisques?\b/,
  suspension: /\bamortisseurs?\b|\bsuspension\b|\bcoussins?\b|\bressorts?\b/,
  clim: /\bclim(?:atisation)?\b|\bcondenseur\b|\bcompresseur\s+de\s+clim/,
  echappement: /\bechappement\b|\bcatalyseur\b|\bsilencieux\b/,
  moteur_interne: /\bpistons?\b|\bbielles?\b|\bcoussinets?\b|\bvilebrequin\b|\barbre\s+a\s+cames\b|\bpoussoirs?\b|\bculbuteurs?\b|\bdistribution\s+variable\b|\bvvt\b|\bdephaseur\b/,
}

// ── Défauts — ce qui arrive à l'organe.
export const DEFAUTS_FUSION = {
  rupture: /\brupture\b|\bcasse\b|\bcassee?s?\b|\bse\s+rompt\b|\bsaut(?:e|er)?\s+de\s+dents?\b/,
  usure: /\busure\b|\buse(?:e|es|s)?\b|\ballongement\b|\bs'allonge\b|\bdegradation\b|\bdesagregation\b|\bse\s+desagrege\b|\bdelitement\b|\beffritement\b/,
  fuite: /\bfuites?\b|\bsuintements?\b|\bsuinte\b/,
  encrassement: /\bencrass\w*\b|\bcolmat\w*\b|\bobstru\w*\b|\bbouch\w*\b|\bcalamin\w*\b|\bdepots?\b/,
  consommation: /\bconsommation\b|\bsurconsommation\b|\bconsomme\b/,
  surchauffe: /\bsurchauffe\b|\bchauffe\b/,
  grippage: /\bgripp\w*\b|\bbloqu\w*\b|\bblocage\b/,
  panne_electrique: /\bpanne\s+electrique\b|\bdefaillance\s+(?:du\s+)?(?:calculateur|capteur|faisceau)\b|\bcourt-circuit\b/,
  corrosion: /\bcorrosion\b|\brouille\b/,
  fissure: /\bfissur\w*\b/,
  incendie: /\bincendie\b|\bfeu\b|\bembrasement\b/,
}

// ⚠️ Les SYMPTÔMES (bruit, à-coups, perte de puissance, calage) ne sont pas des
// défauts : deux pannes différentes les partagent. Ils ont été retirés de la
// table le 11 nov. 2026 après qu'ils eurent rattaché « durites d'admission du
// turbo qui éclatent » à « défaillance du turbocompresseur ».

/** Organe PRINCIPAL : le premier organe nommé dans le texte (le sujet). */
export function organePrincipal(texte) {
  const t = ` ${norm(texte)} `
  let meilleur = null, pos = Infinity
  for (const [k, re] of Object.entries(ORGANES_FUSION)) {
    const m = re.exec(t)
    if (m && m.index < pos) { pos = m.index; meilleur = k }
  }
  return meilleur
}

const classes = (table, texte) => {
  const t = ` ${norm(texte)} `
  return new Set(Object.entries(table).filter(([, re]) => re.test(t)).map(([k]) => k))
}
export const organesFusion = (t) => classes(ORGANES_FUSION, t)
export const defautsFusion = (t) => classes(DEFAUTS_FUSION, t)

const inter = (a, b) => [...a].filter((x) => b.has(x))

/** Rattacher une PARTIE d'affirmation (un défaut) à une panne existante ?
 *  Exige : un organe commun ET un défaut commun, sur une SEULE panne de la
 *  fiche. Organe ou défaut absents d'un côté, plusieurs pannes candidates, ou
 *  aucune : douteux ⇒ nouvelle panne proposée. */
export function rapprocher(partie, pannes) {
  const oA = organePrincipal(partie), dA = defautsFusion(partie)
  const voisines = (pannes ?? []).filter((p) => oA && organePrincipal(p.titre ?? '') === oA).map((p) => p.titre)
  if (!oA) return { panne: null, voisines, raison: 'organe non identifié dans l’affirmation' }
  if (dA.size === 0) return { panne: null, voisines, raison: 'défaut non identifié dans l’affirmation' }
  const candidates = []
  for (const p of pannes ?? []) {
    if (organePrincipal(p.titre ?? '') !== oA) continue
    const d = inter(dA, defautsFusion(`${p.titre ?? ''} ${p.symptomes ?? ''}`))
    if (d.length) candidates.push({ p, d })
  }
  if (candidates.length === 1) {
    const c = candidates[0]
    return { panne: c.p, voisines, raison: `même organe principal (${oA}) et même défaut (${c.d.join(', ')})` }
  }
  if (candidates.length > 1) return { panne: null, voisines, raison: `${candidates.length} pannes candidates : douteux` }
  return { panne: null, voisines, raison: voisines.length ? `même organe (${oA}) mais défaut différent ou non nommé dans la panne : douteux` : 'aucune panne de la fiche sur cet organe' }
}

// ── Montants publiés : « 1 200 € », « 2 500 à 4 500 euros », « 900€ ».
const RE_MONTANT = /(\d{1,3}(?:[\s.]\d{3})+|\d{3,6})\s*(?:€|euros?\b|eur\b)/gi
// Fourchette : « entre 2 500 et 4 500 euros », « 2 500 à 4 500 € » — la borne
// basse n'est pas suivie du signe, elle compte quand même.
const RE_FOURCHETTE = /(\d{1,3}(?:[\s.]\d{3})+|\d{3,6})\s*(?:€|euros?)?\s*(?:a|et|-|–)\s*(\d{1,3}(?:[\s.]\d{3})+|\d{3,6})\s*(?:€|euros?\b|eur\b)/gi
export function montantsDe(texte) {
  const t = norm(texte)
  const bas = [...t.matchAll(RE_FOURCHETTE)].map((m) => Number(m[1].replace(/[\s.]/g, '')))
  return [...bas, ...[...t.matchAll(RE_MONTANT)].map((m) => Number(m[1].replace(/[\s.]/g, '')))]
    .filter((n) => n >= 50 && n <= 30000)
    .filter((n, k, a) => a.indexOf(n) === k)
}
const DANGER = /\bincendie\b|\bfeu\b|\bembrasement\b|\bperte\s+(?:de\s+)?(?:freinage|direction|controle)\b|\bfreinage\s+(?:defaillant|inefficace|degrade)\b|\bairbag\b|\bdanger\b|\baccident\b/

/** Gravité ÉTABLIE PAR LA SOURCE, à partir des extraits des pages confirmées
 *  par le juge (`extraitsConfirmes` : textes relevés sur ces pages).
 *  · danger écrit dans un extrait ⇒ securite ;
 *  · montant écrit dans un extrait ⇒ casse (> 3 000 €, et seulement si le
 *    remède le justifie), majeure (500-3 000 €), mineure (< 500 €) ;
 *  · sinon : aucune gravité ⇒ pas de panne. */
export function graviteSourcee(extraitsConfirmes, titre) {
  const tous = (extraitsConfirmes ?? []).map(norm).join(' \n ')
  if (DANGER.test(tous)) return { gravite: 'securite', cout_min: null, cout_max: null, raison: 'danger pour les occupants écrit dans un extrait confirmé' }
  const montants = montantsDe((extraitsConfirmes ?? []).join(' \n '))
  if (montants.length === 0) return { gravite: null, cout_min: null, cout_max: null, raison: 'aucune gravité établie par la source (ni montant, ni danger écrit)' }
  const max = Math.max(...montants), min = Math.min(...montants)
  let gravite = max > 3000 ? 'casse' : max >= 500 ? 'majeure' : 'mineure'
  // Garde-fou du projet (graviteRemede) : un organe remplaçable n'est pas une
  // casse sans montant > 3 000 € ; ici le montant existe, la casse tient.
  return { gravite, cout_min: min, cout_max: max, raison: `montant publié : ${min === max ? max : `${min}-${max}`} €` }
}

/** La partie porte-t-elle une période BORNANTE (« produits de 2009 à 2011 ») ? */
export const estBornee = (affirmation) => (affirmation?.periodes ?? []).some((p) => p.bornante === true)

/** Intervalle d'entretien écrit : « tous les 60 000 km ou 4 ans ». */
export function intervalleEcrit(texte) {
  const t = norm(texte)
  const kms = [...new Set([...t.matchAll(/(\d{2,3})[\s.]?(\d{3})\s*km/g)].map((m) => Number(m[1] + m[2])))]
  const anss = [...new Set([...t.matchAll(/(\d{1,2})\s*ans?\b/g)].map((m) => Number(m[1])))]
  // Plusieurs intervalles écrits (« 140 000 km / 10 ans, 10 ans / 210 000 km »,
  // selon la version) : on ne sait pas lequel vaut pour quel moteur ⇒ rien.
  if (kms.length > 1 || anss.length > 1) return { km: null, ans: null, plusieurs: true }
  return { km: kms[0] ?? null, ans: anss[0] ?? null, plusieurs: false }
}
