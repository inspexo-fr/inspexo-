// Tests hors ligne : données propres à chaque page modèle (sprint 24, SEO).
// Usage : node tests/donnees-modele.test.mjs
import { energieFamille, critairParAnnees, rappelsDuModele, moteursMontes, anneeRecente, autreGeneration } from '../supabase/functions/_shared/donneesModele.ts'
let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l}${JSON.stringify(a) === JSON.stringify(b) ? '' : ` (obtenu ${JSON.stringify(a)})`}`)
eq(['1.5 dCi', '1.2 PureTech 130', '2.0 TDI (EA288)', '1.8 hybride', '320d', 'moteur inconnu'].map(energieFamille), ['diesel', 'essence', 'diesel', 'hybride', 'diesel', 'inconnu'], 'énergie lue dans le nom commercial, « inconnu » plutôt qu’une supposition')
const k9k = critairParAnnees('diesel', 2008, 2014)
eq(k9k.map((c) => [c.classe, c.de, c.a]), [['3', 2008, 2010], ['2', 2011, 2014]], 'diesel : Crit\'Air 3 jusqu’en 2010, 2 à partir de 2011 (arrêté du 21 juin 2016)')
ok(k9k[0].zfe_interdites.includes('Paris') && !k9k[1].zfe_interdites.includes('Paris'), 'ZFE : Crit\'Air 3 interdite à Paris, pas Crit\'Air 2')
eq(critairParAnnees('inconnu', 2010, 2015), [], 'énergie inconnue : aucune vignette affichée')
const r = rappelsDuModele([{ titre: 'Ancien', date: '2005-01-01' }, { titre: 'Récent', date: '2019-05-02', lien: 'https://rappel.conso.gouv.fr/x' }, { titre: 'Sans date' }], 2013)
eq(r.map((x) => x.titre), ['Récent', 'Sans date'], 'rappels : publiés depuis l’apparition du plus ancien moteur, les plus récents d’abord')
eq([autreGeneration('clio 5 voiture de tourisme', 'Clio', 'IV'), autreGeneration('Clio IV phase 2', 'Clio', 'IV'), autreGeneration('clio, captur voiture de tourisme', 'Clio', 'IV'), autreGeneration('clio 5', 'Clio', null)], [true, false, false, false], 'rappel nommant une autre génération : écarté ; générique ou même génération : gardé')
eq(rappelsDuModele([{ titre: 'clio 5 voiture de tourisme', date: '2023-06-23' }, { titre: 'clio, captur voiture de tourisme', date: '2020-03-06' }], 2001, 'Clio', 'IV').map((x) => x.titre), ['clio, captur voiture de tourisme'], 'page Clio IV : le rappel Clio 5 n’apparaît pas')
const m = moteursMontes([{ marque: 'Renault', famille: 'K9K', nom_commercial: '1.5 dCi', debut: 2001, derniere_attestee: 2022 }], 2026)
ok(m[0].energie === 'diesel' && m[0].annees === '2001–2022' && m[0].critair.length >= 2, 'moteurs montés : années, énergie et vignettes')
eq(anneeRecente([{ debut: 2001 }, { debut: 2018 }, {}]), 2018, 'génération : année du moteur le plus récent')
eq(anneeRecente([{}]), null, 'aucune année : null')
console.log(`\n${ok_} PASS, ${ko} FAIL`)
if (ko > 0) process.exit(1)
