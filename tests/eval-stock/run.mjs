// Éval du contrôle d'entrée en stock contre la fonction DÉPLOYÉE (secret
// d'éval). Seule la lecture de carte grise coûte (vision) ; mur --budget.
// Usage : node tests/eval-stock/run.mjs --budget 0.30
import { readFileSync, existsSync } from 'node:fs'
const args = process.argv.slice(2)
const BUDGET = Number(args[args.indexOf('--budget') + 1]) || 0.3
const env = {}
for (const l of (existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '') }
const appel = async (corps) => {
  const r = await fetch(`${env.REACT_APP_SUPABASE_URL}/functions/v1/stock`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.REACT_APP_SUPABASE_ANON_KEY}`, 'x-eval-secret': env.EVAL_BYPASS_SECRET }, body: JSON.stringify(corps) })
  return { status: r.status, json: await r.json().catch(() => null) }
}
let ko = 0, cout = 0
const ok = (c, l) => { console.log(`${c ? 'PASS' : 'FAIL'} — ${l}`); if (!c) ko++ }

// 1. Carte grise fictive (seul appel payant, ≈ 0,01 €).
if (cout + 0.02 > BUDGET) { console.log('⏸ mur atteint avant la carte grise'); process.exit(1) }
const photo = 'data:image/png;base64,' + readFileSync('tests/eval-stock/carte-grise-fictive.png').toString('base64')
const cg = await appel({ mode: 'carte_grise', photo })
cout += cg.json?.cout_eur ?? 0.02
const c = cg.json?.carte_grise ?? {}
console.log(JSON.stringify(c))
ok(cg.status === 200 && c.marque === 'RENAULT' && /CLIO/i.test(c.denomination), 'marque et dénomination lues')
ok(c.premiere_immat === '2016-03-14' && c.energie === 'diesel' && c.puissance_kw === 66 && c.puissance_fiscale === 4, 'date, énergie, puissance lues')
ok(c.vin === 'VF1RFB00X56123456', 'VIN lu exactement')
ok(!/TESTEUR|JEAN|IMAGINAIRE|TOULOUSE|AA-123-AA/i.test(JSON.stringify(cg.json)), 'NI nom, NI adresse, NI plaque dans la réponse')

// 2. Une fiche (sans IA) : Clio IV 1.5 dCi, 148 000 km, distribution déclarée non faite.
const f = await appel({ mode: 'fiche', marge_visee: 500, vehicule: { marque: 'Renault', modele: 'Clio IV', premiere_immat: '2016-03', energie: 'diesel', motorisation: '1.5 dCi 90', kilometrage: 148000, prix_demande: 6900, operations_non_faites: ['Distribution'] } })
const r = f.json ?? {}
console.log(JSON.stringify({ statut: r.statut, famille: r.vehicule?.famille, defauts: r.defauts_confirmes?.length, controles: r.controles?.length, facture: [r.facture?.total_min, r.facture?.total_max], risque: [r.risque?.total_min, r.risque?.total_max], deja: r.deja_dans_facture, plafond: r.plafond?.calcule ? r.plafond.valeur : r.plafond?.motif }))
ok(f.status === 200 && r.statut === 'ok' && r.vehicule?.famille === 'K9K', 'moteur résolu : K9K')
ok(r.controles?.length === 3, '3 contrôles sur place')
const libF = new Set((r.facture?.lignes ?? []).map((l) => l.libelle))
ok((r.risque?.lignes ?? []).every((l) => !libF.has(l.libelle)), 'aucune ligne à la fois dans la facture et le risque')
ok(r.plafond && (r.plafond.calcule ? r.plafond.lignes.length === 4 : /15 prix/.test(r.plafond.motif)), 'plafond ligne par ligne, ou motif « moins de 15 prix »')
ok(!/\b(cote|estimation|expertise)\b/i.test(JSON.stringify(r)), 'vocabulaire')

// 3. Moteur incertain : on demande, on ne devine pas.
const m = await appel({ mode: 'fiche', vehicule: { marque: 'Mercedes', modele: 'Classe C', annee: 2018, energie: 'diesel', motorisation: '', kilometrage: 90000 } })
console.log(JSON.stringify({ statut: m.json?.statut, candidats: m.json?.candidats?.map((x) => x.famille) }))
ok(m.json?.statut === 'moteur_a_choisir' && m.json.candidats.length >= 2, 'Classe C 2018 diesel : moteur à choisir (OM651 / OM654), pas deviné')

// 4. Lot.
const lot = await appel({ mode: 'lot', marge_visee: 500, lignes: [
  { marque: 'Renault', modele: 'Clio IV', premiere_immat: '2016-03', energie: 'diesel', motorisation: '1.5 dCi 90', kilometrage: 148000, prix_demande: 6900 },
  { marque: 'Peugeot', modele: '308', premiere_immat: '2016-05', energie: 'essence', motorisation: '1.2 PureTech 130', kilometrage: 84500, prix_demande: 9900 },
  { marque: 'Renault', modele: 'Clio IV', kilometrage: 120000 },
] })
console.log(JSON.stringify(lot.json?.lignes?.map((l) => [l.libelle, l.marge_nette, l.motif])))
ok(lot.status === 200 && lot.json.lignes.length === 3, 'lot de 3 lignes rendu')
console.log(`\n— coût : ${cout.toFixed(4)} € / ${BUDGET.toFixed(2)} € · ${ko ? `${ko} échec(s)` : 'tout passe'}`)
process.exit(ko ? 1 : 0)
