// Test hors ligne du dispositif de vérification indépendante (aucun réseau).
// Vérifie : l'extraction des affirmations et de LEUR source, le regroupement
// par page, la stabilité de l'empreinte, et — le point qui compte — que le
// passage de vérification ne reçoit RIEN de l'analyse hormis l'identité du
// véhicule.
// Usage : node tests/affirmations.test.mjs
import { readFileSync } from 'node:fs'
import {
  affirmationsDeAnalyse,
  empreinteAffirmation,
  identiteVehicule,
  parSource,
} from '../supabase/functions/_shared/affirmations.ts'

let ok_ = 0, ko = 0
const ok = (cond, label) => {
  if (cond) { ok_++; console.log(`PASS — ${label}`) }
  else { ko++; console.log(`FAIL — ${label}`) }
}
const eq = (a, b, label) => ok(a === b, `${label}${a === b ? '' : ` (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`}`)

const ANALYSE = {
  score: 38,
  verdict: 'rouge',
  raisons_principales: ['raison une', 'raison deux'],
  vehicule: {
    marque: 'Audi', modele: 'S7', motorisation: '4.0 TFSI', annee: '2015', famille_moteur: 'EA824',
  },
  pannes_connues: [
    {
      titre: 'Défaillance des turbocompresseurs par colmatage de la crépine',
      symptome: 'Perte de puissance, fumée bleue au démarrage',
      urls: ['https://exemple.test/turbos', 'https://exemple.test/autre'],
      sources: [{ url: 'https://exemple.test/turbos', title: 'Turbos 4.0 TFSI' }],
      rappel_officiel: 'rappel constructeur 21H7 (NHTSA 22V-178), mars 2022, Audi S6/S7 2013-2017',
    },
    {
      titre: 'Chaîne de distribution tendue',
      symptome: 'Cliquetis à froid',
      urls: ['https://exemple.test/turbos'], // même page que la première
      sources: [],
    },
    {
      // Entrée du Defect Atlas : AUCUNE url, par construction.
      titre: 'Suspension pneumatique Airmatic fuyarde',
      symptome: 'Véhicule affaissé au réveil',
      urls: [],
      sources: [],
    },
  ],
  negociation: {
    postes: [
      { poste: 'Remplacement des turbos', cout_min_eur: 3000, cout_max_eur: 5200, url_source: 'https://exemple.test/couts' },
      { poste: 'Vidange de boîte', cout_min_eur: null, cout_max_eur: null, url_source: 'https://exemple.test/couts' },
    ],
  },
  entretien: {
    a_exiger: [
      { operation: 'Remplacement de la courroie de distribution à 120 000 km', url_source: 'https://exemple.test/entretien' },
      'Contrôle du niveau d’huile avant achat',
    ],
  },
}

// ── Extraction ──────────────────────────────────────────────────────────────
const a = affirmationsDeAnalyse(ANALYSE)
const parType = (t) => a.filter((x) => x.type === t)

eq(parType('panne').length, 3, 'les trois pannes sortent, y compris celle sans source')
eq(parType('rappel').length, 1, 'le rappel officiel est une affirmation À PART de la panne')
eq(parType('cout').length, 1, 'seul le poste CHIFFRÉ sort — sans montant, rien à vérifier')
eq(parType('entretien').length, 2, 'les deux formes d’opération d’entretien sortent')

const sansSource = parType('panne').find((x) => x.texte.includes('Airmatic'))
eq(sansSource.url, null, 'une panne d’atlas sort avec url null, elle n’est pas écartée')
ok(parType('panne')[0].url === 'https://exemple.test/turbos',
  'une panne qui cite plusieurs pages est vérifiée contre la première')
eq(parType('panne')[0].titre, 'Turbos 4.0 TFSI', 'le titre de la source est repris quand il existe')
eq(parType('entretien').find((x) => x.texte.includes('huile')).url, null,
  'une opération d’entretien en texte simple n’invente pas de source')

ok(a.every((x) => !/raison une|38|rouge/.test(x.texte)),
  'aucune affirmation ne charrie le score, le verdict ni les raisons')

// ── Empreinte ───────────────────────────────────────────────────────────────
eq(empreinteAffirmation('panne', 'Chaîne  tendue '), empreinteAffirmation('panne', 'chaîne tendue'),
  'l’empreinte ignore la casse et les espaces en trop')
ok(empreinteAffirmation('panne', 'chaîne tendue') !== empreinteAffirmation('rappel', 'chaîne tendue'),
  'le type fait partie de l’empreinte : deux types, deux affirmations')
ok(/^[0-9a-f]{8}$/.test(empreinteAffirmation('panne', 'x'.repeat(50))), 'l’empreinte est un hexadécimal stable')

const doublons = affirmationsDeAnalyse({
  ...ANALYSE,
  pannes_connues: [ANALYSE.pannes_connues[0], { ...ANALYSE.pannes_connues[0] }],
})
eq(doublons.filter((x) => x.type === 'panne').length, 1, 'deux fois la même panne ne comptent qu’une fois')

// ── Trop court ──────────────────────────────────────────────────────────────
eq(affirmationsDeAnalyse({ pannes_connues: [{ titre: 'Fuite', urls: [] }] }).length, 0,
  'une affirmation de quelques caractères n’est pas vérifiable')

// ── Regroupement par page ───────────────────────────────────────────────────
const groupes = parSource(a)
eq(groupes.length, 3, 'trois pages distinctes à lire (turbos, coûts, entretien)')
const gTurbos = groupes.find((g) => g.url.endsWith('/turbos'))
eq(gTurbos.affirmations.length, 3, 'les affirmations partageant une page sont regroupées : un appel, pas trois')
ok(groupes[0].affirmations.length >= groupes[groupes.length - 1].affirmations.length,
  'les pages les plus citées d’abord — le plafond coupe ce qui porte le moins')
ok(!groupes.some((g) => g.affirmations.some((x) => x.url === null)),
  'une affirmation sans page ne crée pas de groupe')
eq(parSource(a, 1).length, 1, 'le plafond de sources est respecté')

// ── Identité ────────────────────────────────────────────────────────────────
const id = identiteVehicule(ANALYSE)
eq(id.famille_moteur, 'EA824', 'la famille moteur fait partie de l’identité transmise')
ok(!('score' in id) && !('verdict' in id), 'l’identité ne porte ni score ni verdict')
eq(identiteVehicule({}).marque, '', 'une analyse vide ne fait pas tomber l’extraction')

// ── INDÉPENDANCE : ce que la fonction envoie au modèle ─────────────────────
//
// ⚠️ C'est le contrôle central. Un passage de vérification qui verrait
// l'analyse ne vérifierait pas, il confirmerait. On lit le source de la
// fonction et on exige qu'elle ne construise son message qu'à partir de
// l'identité, des affirmations et du texte de la page.
{
  const src = readFileSync(new URL('../supabase/functions/verification/index.ts', import.meta.url), 'utf8')
  const debut = src.indexOf('const corps = (model: string)')
  const fin = src.indexOf('for (const model of [MODEL, FALLBACK_MODEL])')
  const message = src.slice(debut, fin)
  ok(debut > 0 && fin > debut, 'le corps du message au modèle est localisé')

  for (const interdit of [
    'score', 'verdict_', 'raisons_principales', 'result_json', 'critique',
    'bareme', 'axes', 'plafond', 'negociation', 'checklist', 'message_vendeur',
  ]) {
    ok(!message.includes(interdit), `le message au modèle ne porte pas « ${interdit} »`)
  }
  ok(message.includes('identite.marque') && message.includes('identite.famille_moteur'),
    'le message porte l’identité du véhicule — sans elle, « mauvais moteur » serait indécidable')
  ok(message.includes('liste') && message.includes('texteSource'),
    'le message porte les affirmations et le texte de la page, et rien d’autre')

  // Le doute ne profite jamais à l'affirmation.
  ok(/hésites.*non_soutenue|DOUTE profite/i.test(src),
    'la consigne fait trancher le doute contre l’affirmation')
  // Le silence du modèle ne vaut pas accord.
  ok(/le silence ne vaut pas accord/i.test(src),
    'une affirmation sans verdict rendu n’est pas comptée soutenue')
  // Contenu web traité comme non fiable, comme partout ailleurs.
  ok(/non fiable/i.test(src) && /neutraliser/.test(src),
    'le texte de la page est déclaré non fiable et ses chevrons neutralisés')
  // Aucune lecture de la table des clients d'API ni des partenaires ici.
  ok(!/api_clients|partenaires|mises_en_relation/.test(src),
    'la vérification ne lit ni les clients d’API ni les partenaires')
}

// ── La migration et le module disent la même chose ─────────────────────────
{
  const sql = readFileSync(new URL('../supabase/migrations/20261116120000_sprint15_pro_et_fiabilite.sql', import.meta.url), 'utf8')
  const contrainte = sql.slice(sql.indexOf("claim_type text not null check"), sql.indexOf('claim_text text not null'))
  for (const t of ['panne', 'rappel', 'cout', 'entretien']) {
    ok(contrainte.includes(`'${t}'`), `le type « ${t} » produit par le module est accepté par la base`)
  }
  const verdicts = sql.slice(sql.indexOf('verdict text not null check'), sql.indexOf('justification text'))
  for (const v of ['soutenue', 'non_soutenue', 'mauvais_moteur', 'source_absente', 'source_injoignable']) {
    ok(verdicts.includes(`'${v}'`), `le verdict « ${v} » est accepté par la base`)
  }
  // Le seuil de publication est celui qu'Utku a fixé.
  ok(/v_seuil constant integer := 30/.test(sql), 'rien n’est publié avant 30 analyses vérifiées')
  // Les invérifiables ne sont jamais fondues dans le taux de non soutenues.
  ok(!/'non_soutenues', count\(\*\) filter \(where v\.verdict in \('non_soutenue', 'source_absente'\)\)/.test(sql),
    'les affirmations sans source publique ne gonflent pas le taux de non soutenues')
  ok(/'sans_source', count/.test(sql) && /'verifiables', count/.test(sql),
    'la base publie séparément les invérifiables et le dénominateur vérifiable')
}

console.log(`\n${ok_} contrôles passés, ${ko} échec(s).`)
if (ko > 0) process.exit(1)
console.log('Tous les tests affirmations passent.')
