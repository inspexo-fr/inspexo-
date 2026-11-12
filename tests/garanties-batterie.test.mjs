// Tests hors ligne : garanties batterie (sprint 23, lot 3, point 7).
// Usage : node tests/garanties-batterie.test.mjs
import fs from 'node:fs'
import { GARANTIES_BATTERIE, REPERE_TRANSVERSAL, garantiesPourVehicule, energieBatterie, questionsBatterie, estEtranger } from '../src/data/garantiesBatterie.js'
let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const lire = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'))
const src = lire('../docs/sources-moteurs-2026-11.json')
const juge = lire('../docs/candidats-externes-journal.json').affirmations

// ---- Rien qui ne soit confirmé par le juge
const entrees = [...GARANTIES_BATTERIE, REPERE_TRANSVERSAL]
for (const g of entrees) {
  const objet = src.objets.find((o) => o.id === g.id)
  ok(objet && objet.groupe === 'G' && objet.type === 'garantie', `${g.id} : objet du groupe G de type garantie`)
  const confirmees = (juge[g.id]?.parties || []).flatMap((p) => (p.confirmees || []).map((c) => c.url))
  ok(confirmees.length > 0, `${g.id} : au moins une partie confirmée par le juge`)
  for (const s of g.sources) {
    ok(confirmees.includes(s.url), `${g.id} : URL exacte confirmée par le juge (${s.url.slice(0, 60)}…)`)
    const so = objet?.sources.find((x) => x.url === s.url)
    ok(so && so.pays === s.pays, `${g.id} : pays de la source repris tel quel (${s.pays})`)
    ok(so && (so.date ?? null) === s.date, `${g.id} : date de la source reprise telle quelle`)
  }
}
for (const id of ['G-VE-E-CMP-02', 'G-VE-LEAF-02', 'G-PHEV-PEUGEOT-01', 'G-PHEV-BMW-01']) {
  ok(!entrees.some((g) => g.id === id), `${id} (écarté ou non jugé) : absent`)
}

// ---- Énergie
ok(energieBatterie({ carburant: 'Électrique' }) === 'electrique', 'électrique reconnu')
ok(energieBatterie({ carburant: 'Hybride rechargeable' }) === 'hybride', 'hybride rechargeable reconnu')
ok(energieBatterie({ carburant: 'Essence', motorisation: '1.2 PureTech' }) === null, 'essence : aucune garantie batterie')
ok(garantiesPourVehicule({ marque: 'Peugeot', modele: '308', carburant: 'Essence' }).garanties.length === 0, 'thermique : rien')

// ---- Rapprochement
const zoe = garantiesPourVehicule({ marque: 'Renault', modele: 'Zoe', carburant: 'Électrique' }, 2019)
ok(zoe.garanties.length === 1 && zoe.garanties[0].id === 'G-VE-ZOE-01' && !zoe.garanties[0].contexte, 'Zoe : garantie Renault, source française')
const leaf = garantiesPourVehicule({ marque: 'Nissan', modele: 'Leaf', carburant: 'Électrique' }, 2020)
ok(leaf.garanties[0]?.contexte === true, 'Leaf : sources belge et britannique ⇒ information de contexte')
ok(garantiesPourVehicule({ marque: 'Nissan', modele: 'Leaf', carburant: 'Électrique' }, 2015).garanties.length === 0, 'Leaf de 2015 : la garantie de la 2e génération ne s\'applique pas')
ok(garantiesPourVehicule({ marque: 'Skoda', modele: 'Enyaq', carburant: 'Électrique' }).garanties[0]?.contexte === true, 'Enyaq : source belge ⇒ contexte')
ok(garantiesPourVehicule({ marque: 'Toyota', modele: 'Yaris', carburant: 'Hybride' }).garanties[0]?.id === 'G-VE-TOYOTA-HSD-01', 'Yaris hybride : garantie hybride Toyota')
ok(garantiesPourVehicule({ marque: 'Toyota', modele: 'bZ4X', carburant: 'Électrique' }).garanties.every((g) => g.id !== 'G-VE-TOYOTA-HSD-01'), 'bZ4X : pas la garantie hybride')
ok(garantiesPourVehicule({ marque: 'Mercedes', modele: 'EQA', carburant: 'Électrique' }).garanties[0]?.id === 'G-VE-TRANSVERSAL-01', 'Mercedes : repère presse confirmé seulement')
ok(garantiesPourVehicule({ marque: 'Renault', modele: 'Clio E-Tech', carburant: 'Hybride' }).garanties.length === 0, 'Clio E-Tech hybride : pas la garantie de la Zoe')
ok(garantiesPourVehicule({ marque: 'Dacia', modele: 'Spring', carburant: 'Électrique' }).garanties[0]?.lignes[0].includes('75 %'), 'Spring : seuil de 75 %')

// ---- Formulations
const texte = JSON.stringify(entrees.map((g) => g.lignes))
ok(!/vous [eê]tes couvert|est couvert|couverte par la garantie/i.test(texte), 'jamais « votre véhicule est couvert »')
ok(!/\bvaleur\b|\bcote\b|estimation|expertise|\bexpert/i.test(texte), 'vocabulaire interdit absent')
ok(estEtranger({ pays: 'BE' }) && !estEtranger({ pays: 'FR' }), 'règle du pays')
ok(questionsBatterie('electrique', 'Renault').some((q) => /location/.test(q)), 'électrique : question batterie louée')
ok(questionsBatterie('hybride', 'Toyota').some((q) => /Bilan de santé/.test(q)), 'hybride Toyota : bilan de santé')
ok(questionsBatterie(null, 'Peugeot').length === 0, 'thermique : aucune question batterie')

// ---- Affichage seulement : le chemin de notation ne le lit pas
for (const f of ['../supabase/functions/_shared/bareme.ts', '../supabase/functions/score/index.ts']) {
  ok(!/garantiesBatterie|GARANTIES_BATTERIE/.test(fs.readFileSync(new URL(f, import.meta.url), 'utf8')), `${f.split('/').pop()} n'importe pas les garanties batterie`)
}
console.log(`\n${ok_} PASS, ${ko} FAIL`)
if (ko > 0) process.exit(1)
