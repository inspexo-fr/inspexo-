// Tests hors ligne : export CSV du tri de lot. Usage : node tests/csv-lot.test.mjs
import { csvLot } from '../src/lib/csvLot.js'
let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const csv = csvLot([{ libelle: '=HYPERLINK("x")', prix_demande: 5000, revente: 8000, facture_max: 500, risque_max: 0, marge_nette: 2500, plafond: 7000, motif: null }, { libelle: 'Clio; "IV"', prix_demande: null }])
ok(csv.startsWith('﻿'), 'BOM UTF-8 (accents lisibles dans un tableur)')
ok(csv.includes(`"'=HYPERLINK(""x"")"`), 'formule neutralisée (injection CSV)')
ok(csv.includes('"Clio; ""IV"""'), 'point-virgule et guillemets échappés')
ok(csv.split('\r\n').length === 3, 'une ligne d’en-tête + une par véhicule')
if (ko) { console.log(`\n${ko} échec(s)`); process.exit(1) } else console.log(`\nTous les tests passent (${ok_})`)
