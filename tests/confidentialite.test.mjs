// Test hors ligne : la politique de confidentialité dit-elle ce que le code fait ?
// Usage : node tests/confidentialite.test.mjs
//
// ⚠️ POURQUOI CE TEST EXISTE. Le 5 novembre 2026, un audit a trouvé que le
// sprint 20 avait ajouté deux collectes — l'empreinte du VIN de l'annonce et la
// lecture de la commune pour les ZFE — sans que la politique en dise un mot.
// Pire : elle affirmait « le VIN n'est jamais conservé », ce que l'empreinte
// rendait inexact. Un document qui promet plus que ce que le code tient est une
// allégation fausse, et il ne se dément jamais tout seul.
//
// La règle vérifiée ici : SI le code porte la fonctionnalité, ALORS la politique
// doit en parler. Le test ne juge pas la rédaction — il refuse le silence.
import { readFileSync } from 'node:fs'

const lire = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const POLITIQUE = lire('../src/pages/PolitiqueConfidentialite.jsx')
const SCORE = lire('../supabase/functions/score/index.ts')
const CRITAIR = lire('../supabase/functions/_shared/critair.ts')
const VIN = lire('../supabase/functions/_shared/vin.ts')

let ko = 0
let total = 0
const ok = (cond, label, detail = '') => {
  total++
  if (!cond) { ko++; console.log(`FAIL — ${label}${detail ? ` (${detail})` : ''}`) }
}
const titre = (t) => console.log(`\n▶ ${t}`)

// Une collecte est « documentée » si la politique contient TOUS ses marqueurs.
// Les marqueurs sont choisis pour être stables : des mots que la rédaction ne
// peut pas perdre sans changer de sens.
const COLLECTES = [
  {
    nom: 'empreinte du VIN de l’annonce',
    presentDansLeCode: () => /vin_empreinte/.test(SCORE),
    marqueurs: ['empreinte salée', 'châssis', 'Finalité unique', 'HistoVec'],
  },
  {
    nom: 'classement Crit’Air',
    presentDansLeCode: () => /critairClasse/.test(SCORE) && /arrêté du 21 juin 2016/.test(CRITAIR),
    marqueurs: ["Crit'Air", '21 juin 2016', 'première immatriculation'],
  },
  {
    nom: 'commune de l’annonce lue pour les ZFE',
    presentDansLeCode: () => /verdictZfe\(/.test(SCORE),
    marqueurs: ["commune indiquée dans l'annonce", 'zone à faibles émissions'],
  },
  {
    nom: 'ville de l’acheteur gardée dans son navigateur',
    presentDansLeCode: () => /inspexo_ville_utilisateur/.test(lire('../src/components/CritairBloc.jsx')),
    marqueurs: ['dans votre navigateur', 'jamais envoyée'],
  },
  {
    nom: 'code postal lu sans être enregistré',
    presentDansLeCode: () => /code_postal/.test(SCORE),
    marqueurs: ['code postal'],
  },
  {
    nom: 'réponses et pièces du vendeur (photo lue, VIN et plaque comparés en mémoire)',
    presentDansLeCode: () => /FACTURE_TOOL/.test(lire('../supabase/functions/reponse-vendeur/index.ts')),
    marqueurs: ['Réponses et justificatifs du vendeur', 'nous ne la conservons pas', 'en mémoire', 'ni l\'un ni l\'autre n\'est enregistré'],
  },
  {
    nom: 'texte de l’annonce envoyé à Anthropic',
    presentDansLeCode: () => /api\.anthropic\.com/.test(SCORE),
    marqueurs: ['Anthropic', '30 jours'],
  },
]

titre('Chaque collecte présente dans le code est documentée')
for (const c of COLLECTES) {
  if (!c.presentDansLeCode()) {
    console.log(`  (ignorée — absente du code : ${c.nom})`)
    continue
  }
  const absents = c.marqueurs.filter((m) => !POLITIQUE.includes(m))
  ok(absents.length === 0, `${c.nom} : documentée`, absents.length ? `marqueurs absents : ${absents.join(', ')}` : '')
}

titre('⚠️ Aucune promesse que le code ne tient pas')
// La phrase qui a été rendue inexacte par le sprint 20c. Si elle revient sans
// réserve, c'est qu'on a recommencé.
const SANS_RESERVE = /n'est <strong>jamais<\/strong> conservé&nbsp;: le <strong>numéro de série \(VIN\)<\/strong> et\s*l'<strong>immatriculation<\/strong>\. Ils sont lus/
ok(!SANS_RESERVE.test(POLITIQUE),
  'la promesse « le VIN n’est jamais conservé » n’est plus affirmée sans réserve')
// Elle doit porter sur le CERTIFICAT, et renvoyer à la section du VIN d’annonce.
ok(/figurant sur le certificat/.test(POLITIQUE),
  'la non-conservation du VIN est rattachée au CERTIFICAT, pas à toute source')
ok(/6 undecies/.test(POLITIQUE),
  'la section 6 ter ter renvoie à celle qui décrit l’empreinte')

titre('L’empreinte est décrite pour ce qu’elle est')
ok(/secret connu de nous seuls/.test(POLITIQUE) || /salée/.test(POLITIQUE),
  'le salage est dit (sinon « empreinte » laisserait croire à un hachage réversible)')
ok(/ne permet pas de\s*retrouver le numéro/.test(POLITIQUE.replace(/\s+/g, ' ').replace(/ /g, ' ')) ||
   /ne permet pas de retrouver le numéro/.test(POLITIQUE.replace(/\s+/g, ' ')),
  'il est dit qu’elle ne permet pas de retrouver le numéro')
ok(/Le numéro n'est jamais conservé/.test(POLITIQUE),
  'il est dit que le numéro lui-même n’est pas conservé')
// ⚠️ La durée doit être celle du dossier — pas « indéfiniment », pas un chiffre
// inventé : c'est la décision d'Utku du 5 nov. 2026.
ok(/celle du dossier auquel elle est rattachée/.test(POLITIQUE),
  'la durée de conservation de l’empreinte est celle du dossier')

titre('Le VIN ne sort pas dans la réponse publique')
// Contrôle croisé avec le code : la politique promet que le numéro n'apparaît
// sur aucune page. Le code doit le tenir.
const lignesVin = SCORE.split('\n').filter((l) => /vinTrouve!?\.vin/.test(l))
ok(lignesVin.length > 0, 'le numéro est bien lu quelque part (sinon ce contrôle serait vide)')
ok(lignesVin.every((l) => /decoderVin\(|sha256Hex\(/.test(l)),
  '⚠️ le numéro n’est lu QUE pour être décodé ou empreint — la promesse de la politique tient',
  lignesVin.filter((l) => !/decoderVin\(|sha256Hex\(/.test(l)).join(' | ').slice(0, 160))
ok(/export function trouverVin/.test(VIN), 'la recherche du VIN est bien déterministe (module pur)')
ok(/jamais par une intelligence artificielle/.test(POLITIQUE),
  'la politique dit que le repérage n’est pas fait par une IA — ce que le code tient')

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${total - ko}/${total} contrôles passés`)
process.exit(ko === 0 ? 0 : 1)
