// Test HORS LIGNE des garanties de conservation et de non-domination des
// prix d'API (CUA art. 6.3 et 6.4). Aucun appel réseau, aucune base.
// Usage : node tests/purge-api.test.mjs
//
// Pourquoi un test STATIQUE sur du SQL. Les deux règles vérifiées ici sont
// des garanties d'ORDRE et de PORTÉE, pas des calculs : « on n'efface jamais
// un texte dont l'empreinte n'a pas été posée », « aucun chemin d'écriture ne
// contourne l'attribution ». Elles tiennent à la FORME du code, et c'est
// cette forme qu'on fige — une inversion des deux passes, ou la réouverture
// d'une signature sans client, perdrait la preuve en silence.
import { readFileSync } from 'node:fs'
import { PART_API_MAX } from '../supabase/functions/_shared/marche.ts'

let ko = 0
let total = 0
const ok = (cond, label) => {
  total++
  if (!cond) { ko++; console.log(`FAIL — ${label}`) }
}
const titre = (t) => console.log(`\n▶ ${t}`)

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8')
const sql = lire('supabase/migrations/20261108120000_sprint12_cua_api.sql')
const cron = lire('supabase/functions/alertes/index.ts')

// ---------------------------------------------------------------------------
titre('Conservation : l’empreinte est posée AVANT tout effacement')
// ---------------------------------------------------------------------------
const corpsPurge = sql.slice(
  sql.indexOf('create or replace function public.purger_textes_api()'),
  sql.indexOf('create or replace function public.purger_preuves_api()'),
)
ok(corpsPurge.length > 200, 'le corps de purger_textes_api est bien trouvé')

const posEmpreinte = corpsPurge.indexOf("set texte_sha256 = encode(")
const posEffacement = corpsPurge.indexOf("set input_text = '[texte effacé")
ok(posEmpreinte > 0, 'la passe 1 pose bien une empreinte')
ok(posEffacement > 0, 'la passe 2 efface bien le texte')
ok(posEmpreinte < posEffacement,
  'l’empreinte est posée AVANT l’effacement — l’ordre des passes EST la garantie')

// La garantie structurelle : on n'efface que ce qui porte déjà son empreinte.
const passeEffacement = corpsPurge.slice(posEffacement)
ok(/texte_sha256 is not null/.test(passeEffacement),
  'l’effacement exige une empreinte déjà posée (texte_sha256 is not null)')
ok(/created_at < now\(\) - interval '30 days'/.test(passeEffacement),
  'l’effacement porte sur les analyses de plus de 30 jours')
ok(/via_api/.test(passeEffacement),
  'l’effacement ne touche QUE les analyses reçues par API')

// La passe 1 ne doit pas attendre les 30 jours : une empreinte manquante au
// moment d'effacer ferait perdre la preuve pour toujours.
const passe1 = corpsPurge.slice(posEmpreinte, posEffacement)
ok(!/interval '30 days'/.test(passe1),
  'la passe 1 n’attend pas 30 jours : l’empreinte est posée dès que la ligne existe')

// ---------------------------------------------------------------------------
titre('Conservation : l’empreinte est un sha256 NON SALÉ, et c’est voulu')
// ---------------------------------------------------------------------------
ok(/encode\(extensions\.digest\(input_text, 'sha256'\), 'hex'\)/.test(corpsPurge),
  'sha256 du texte seul, sans sel — le client doit pouvoir la recalculer')
ok(!/IP_HASH_SALT|\bsalt\b|\bsels?\b/i.test(corpsPurge),
  'aucun sel n’entre dans l’empreinte du texte')
// Et la raison est écrite, pas seulement appliquée : le projet vient de
// corriger un hachage non salé (sprint 11), la distinction doit rester lisible.
ok(/NON SAL/.test(sql) && /s'énumèrent|s''énumèrent|énumère/.test(sql),
  'la migration explique pourquoi ce hachage-là n’a pas besoin de sel')

// ---------------------------------------------------------------------------
titre('Conservation : le texte ne survit jamais à la purge')
// ---------------------------------------------------------------------------
ok(/set input_text = '\[texte effacé/.test(corpsPurge),
  'le texte est remplacé par un marqueur, jamais conservé ailleurs')
ok(!/insert into [a-z_.]*\s*\([^)]*input_text/i.test(sql),
  'aucune copie du texte n’est insérée dans une autre table')
// La migration est ADDITIVE : elle ne crée aucune table, donc aucun endroit
// où un texte pourrait se remettre à vivre.
ok(!/create table/i.test(sql), 'la migration ne crée aucune table')

// ---------------------------------------------------------------------------
titre('Conservation : l’horizon de cinq ans est appliqué')
// ---------------------------------------------------------------------------
const corpsPreuves = sql.slice(sql.indexOf('create or replace function public.purger_preuves_api()'))
ok(/interval '5 years'/.test(corpsPreuves), 'la preuve expire à cinq ans')
ok(/texte_sha256 = null/.test(corpsPreuves), 'l’empreinte est effacée à l’expiration')
ok(/result_json = /.test(corpsPreuves), 'le résultat est effacé à l’expiration')
ok(/preuve_purgee_le is null/.test(corpsPreuves), 'l’expiration est idempotente')

// ---------------------------------------------------------------------------
titre('Conservation : les deux purges tournent, et ne sont pas publiques')
// ---------------------------------------------------------------------------
for (const f of ['purger_textes_api', 'purger_preuves_api']) {
  ok(new RegExp(`revoke all on function public\\.${f}\\(\\) from public, anon, authenticated`).test(sql),
    `${f} est retirée à anon et authenticated`)
  ok(new RegExp(`grant execute on function public\\.${f}\\(\\) to service_role`).test(sql),
    `${f} n’est exécutable qu’en service role`)
  ok(new RegExp(`rpc\\("${f}"\\)`).test(cron), `${f} est bien appelée par le cron quotidien`)
}

// ---------------------------------------------------------------------------
titre('Prix d’API : aucun chemin d’écriture sans attribution')
// ---------------------------------------------------------------------------
ok(/drop function if exists public\.agreger_marche\(jsonb\);/.test(sql),
  'la signature à un seul argument est SUPPRIMÉE, pas laissée en surcharge')
ok(/create function public\.agreger_marche\(p_lignes jsonb, p_client_id text default null\)/.test(sql),
  'la seule signature restante porte l’identifiant du client')
const corpsAgreg = sql.slice(
  sql.indexOf('create function public.agreger_marche('),
  sql.indexOf('create or replace function public.get_prix_segments('),
)
ok(/raise exception 'identifiant de client invalide'/.test(corpsAgreg),
  'un identifiant de client invalide fait ÉCHOUER le lot')
ok(!/then\s+null\s*;?\s*--.*public/i.test(corpsAgreg),
  'un identifiant invalide ne bascule jamais la contribution en « public »')
ok(/parts_api = case\s*\n\s*when p_client_id is null then marche_agregats\.parts_api/.test(corpsAgreg),
  'un relevé public ne touche pas la ventilation des parts d’API')

// ---------------------------------------------------------------------------
titre('Prix d’API : le verrou des 20 % vit aux DEUX bouts')
// ---------------------------------------------------------------------------
ok(/create or replace function public\.part_api_max\(\)/.test(sql),
  'le seuil existe comme constante unique côté base')
const seuilSql = sql.match(/select (0\.\d+)::numeric/)
ok(seuilSql !== null, 'le seuil SQL est lisible')
ok(seuilSql && Number(seuilSql[1]) === PART_API_MAX,
  `le seuil SQL (${seuilSql?.[1]}) est identique au seuil TS (${PART_API_MAX})`)

const corpsSegments = sql.slice(sql.indexOf('create or replace function public.get_prix_segments('))
ok(/public\.part_api_max\(\)/.test(corpsSegments),
  'get_prix_segments applique le verrou des 20 %')
ok(/v_total < v_seuil/.test(corpsSegments),
  'get_prix_segments applique AUSSI le seuil de 15 — les deux verrous, pas un')
ok(/jsonb_each\(a\.parts_api\)[\s\S]{0,200}group by kv\.key/.test(corpsSegments),
  'le poids est sommé PAR CLIENT sur toute la population du segment')
ok(/'lignes', '\[\]'::jsonb/.test(corpsSegments),
  'un segment non publiable ne rend AUCUN histogramme')

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${total - ko}/${total} contrôles passés`)
process.exit(ko === 0 ? 0 : 1)
