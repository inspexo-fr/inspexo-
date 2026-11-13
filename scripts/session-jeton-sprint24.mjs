// SPRINT 24 — UNE session de jeton administrateur (décision d'Utku, 13 nov.) :
//   1. FIREFLY : retirer les 2 pannes d'une autre version (1.0 T3 120 ch et
//      1.3 T4). Le SERVEUR désigne les pannes « exclue » (règle des variantes,
//      table : « 1.0 FireFly 70 ») ; le script exige qu'il y en ait EXACTEMENT
//      2, simule, puis écrit. Les pannes retirées sont rendues et sauvegardées.
//   2. 2ZR-FXE : rattacher les parties confirmées qui portent sur le MOTEUR :
//      source Caradisiac (Auris 2) ajoutée à la consommation d'huile, et
//      panne nouvelle « onduleur du système hybride (Prius 3) ». Les trois
//      rappels confirmés (faisceau C-HR/Prius 4, pompe Corolla 12, Lexus CT)
//      visent des MODÈLES : une fiche moteur ne les filtre pas par modèle, ils
//      pèseraient sur toute Toyota 1.8 hybride. Laissés de côté.
//
//   ADMIN_ACCESS_TOKEN dans .env.local (une heure), puis :
//   node scripts/session-jeton-sprint24.mjs            → simule tout, n'écrit rien
//   node scripts/session-jeton-sprint24.mjs --ecrire   → écrit
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const ECRIRE = process.argv.includes('--ecrire')
const env = {}
for (const l of (existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.REACT_APP_SUPABASE_URL, ANON = env.REACT_APP_SUPABASE_ANON_KEY, JETON = env.ADMIN_ACCESS_TOKEN
if (!JETON) { console.error('ADMIN_ACCESS_TOKEN absent de .env.local'); process.exit(1) }
const F = `${U}/functions/v1/admin-defect-sheets`
const H = { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${JETON}` }
const patch = async (corps) => { const r = await fetch(F, { method: 'PATCH', headers: H, body: JSON.stringify(corps) }); return { status: r.status, json: await r.json().catch(() => null) } }
const fin = (code, msg) => { if (msg) console.error(msg); console.log('\n⚠️ Retirer ADMIN_ACCESS_TOKEN de .env.local maintenant.'); process.exit(code) }

const AURIS2 = 'https://www.caradisiac.com/fiabilite-de-la-toyota-auris-2-la-maxi-fiche-occasion-de-caradisiac-111729.htm'
const PRIUS3 = 'https://www.caradisiac.com/fiabilite-de-la-toyota-prius-3-la-maxi-fiche-occasion-de-caradisiac-165788.htm'
// Rédigée en session à partir de la page relue le 13 nov. 2026 (extraits
// cités) : rien qui n'y figure.
const ONDULEUR = {
  titre: "Défaillance de l'onduleur (inverseur) du système hybride (Prius 3)",
  organe: 'Onduleur du système hybride',
  symptomes: "Défaillance qui entraîne l'arrêt de la voiture. Un rappel a concerné le logiciel de gestion de l'inverseur en 2014, mais certains propriétaires ont connu le souci après.",
  km_typique: null,
  gravite: 'majeure',
  cout_indicatif_eur_min: 2500,
  cout_indicatif_eur_max: 3200,
  sources: [{ url: PRIUS3, vehicule_concerne: 'Toyota Prius 3 1.8 hybride (2ZR-FXE)', nomme_moteur: false }],
  rappel_code: null, rappel_date: null, rappel_vehicules: null,
  rappel_annee_debut: 0, rappel_annee_fin: 0,
  gravite_citee_par_source: false,
}

const g = await fetch(F, { headers: H })
if (!g.ok) fin(1, `Lecture des fiches refusée : HTTP ${g.status} (jeton expiré ?)`)
const fiches = (await g.json()).sheets ?? []
const trouver = (marque, fam) => fiches.filter((f) => String(f.marque).toLowerCase() === marque && String(f.famille_norm) === fam)
const ff = trouver('fiat', 'FIREFLY'), zr = trouver('toyota', '2ZRFXE')
if (ff.length !== 1 || zr.length !== 1) fin(1, `Fiches attendues : 1 FIREFLY, 1 2ZR-FXE ; trouvées ${ff.length} et ${zr.length}.`)

const dossier = join(homedir(), 'inspexo-backups'); mkdirSync(dossier, { recursive: true })
const sauvegarde = join(dossier, `fiches-session-sprint24-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
writeFileSync(sauvegarde, JSON.stringify({ firefly: ff[0], zr: zr[0] }, null, 1))
console.log(`Sauvegarde avant écriture : ${sauvegarde}`)

// 1. FIREFLY
const sonde = await patch({ id: ff[0].id, retirer_autre_version: true, titres_attendus: [], simuler: true })
const aRetirer = sonde.json?.a_retirer ?? []
console.log(`\nFIREFLY (version « ${sonde.json?.version} ») — le serveur retirerait ${aRetirer.length} panne(s) :`)
for (const t of aRetirer) console.log(`  - ${t}`)
if (aRetirer.length !== 2) fin(1, 'ARRÊT : 2 pannes attendues exactement. Rien n’est écrit.')
const sim = await patch({ id: ff[0].id, retirer_autre_version: true, titres_attendus: aRetirer, simuler: true })
if (sim.status !== 200) fin(1, `ARRÊT : simulation refusée (${sim.status}).`)
console.log(`  simulation : ${sim.json.restantes} panne(s) resteraient.`)

// 2. 2ZR-FXE
const huile = (zr[0].pannes ?? []).find((p) => /^consommation d.huile/i.test(String(p.titre)))
if (!huile) fin(1, 'ARRÊT : panne « consommation d’huile » introuvable sur la fiche 2ZR-FXE.')
const dejaOnduleur = (zr[0].pannes ?? []).some((p) => /onduleur|inverseur/i.test(String(p.titre)))
console.log(`\n2ZR-FXE — ajout de la source Auris 2 à « ${huile.titre} » ; panne « ${ONDULEUR.titre} »${dejaOnduleur ? ' DÉJÀ PRÉSENTE (sautée)' : ''}.`)

if (!ECRIRE) fin(0, '\nSimulation seulement. Relancer avec --ecrire pour écrire.')

const w1 = await patch({ id: ff[0].id, retirer_autre_version: true, titres_attendus: aRetirer })
console.log(`\nFIREFLY : HTTP ${w1.status} — ${w1.json?.retirees?.length ?? 0} retirée(s), ${w1.json?.restantes} restante(s).`)
const w2 = await patch({ id: zr[0].id, ajouter_sources: [{ panne_titre: huile.titre, sources: [{ url: AURIS2 }] }] })
console.log(`2ZR-FXE source : HTTP ${w2.status} — ${JSON.stringify(w2.json)}`)
const w3 = dejaOnduleur ? { status: 'sautée' } : await patch({ id: zr[0].id, ajouter_pannes: [ONDULEUR] })
console.log(`2ZR-FXE onduleur : HTTP ${w3.status} — ${JSON.stringify(w3.json ?? null)}`)
writeFileSync(sauvegarde.replace('.json', '-resultat.json'), JSON.stringify({ w1: w1.json, w2: w2.json, w3: w3.json ?? null }, null, 1))
fin([w1, w2].every((w) => w.status === 200) && (dejaOnduleur || w3.status === 200) ? 0 : 1)
