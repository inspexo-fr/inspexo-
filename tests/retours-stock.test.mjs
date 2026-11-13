// Tests hors ligne : journal des retours — listes fermées identiques côté site
// et côté base. Usage : node tests/retours-stock.test.mjs
import fs from 'node:fs'
import { PIECES, PAYE_PAR } from '../src/data/retoursStock.js'
let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const sql = fs.readFileSync('supabase/migrations/20261201120000_sprint24_retours_stock.sql', 'utf8')
const liste = (re) => [...(sql.match(re)?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
ok(JSON.stringify(liste(/piece in \(([^)]*)\)/s)) === JSON.stringify(PIECES), 'pièces : même liste en base et sur le site')
ok(JSON.stringify(liste(/paye_par in \(([^)]*)\)/s)) === JSON.stringify(PAYE_PAR), '« payé par » : même liste en base et sur le site')
ok(!/create policy/i.test(sql) && /revoke all on public\.retours_stock from anon, authenticated/.test(sql), 'aucune policy, aucun droit direct sur la table')
ok(/where user_id = auth\.uid\(\)/.test(sql.slice(sql.indexOf('retours_stock_lister'))), 'lecture filtrée sur le compte de l’appelant')
ok(/admins where user_id = auth\.uid\(\)/.test(sql.slice(sql.indexOf('retours_stock_agreges'))), 'vue agrégée réservée à l’admin')
const comp = fs.readFileSync('src/components/JournalRetours.jsx', 'utf8')
ok(!/moyenne|médiane|statistique[s]? :/i.test(comp.replace(/Aucune statistique/g, '')), 'aucune statistique affichée au pro')
if (ko) { console.log(`\n${ko} échec(s)`); process.exit(1) } else console.log(`\nTous les tests passent (${ok_})`)
