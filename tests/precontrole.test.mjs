// Test hors ligne du pré-contrôle des sources (sprint 23). Aucun réseau.
import { chercherExtrait, controlerPage, decoderEntites, DEMI_FENETRE, MARQUE_SECTION, normaliser, texteCentre } from '../supabase/functions/_shared/precontrole.ts'
let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) ok_++; else { ko++; console.log(`FAIL — ${l}`) } }
const page = 'Le moteur 1.2 PureTech a une courroie qui baigne dans l’huile. Selon Peugeot, l&rsquo;intervalle passe à 100 000 km ou 6 ans.'
const n = normaliser(page), sp = normaliser(page).replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/ +/g, ' ').trim()
ok(chercherExtrait(n, sp, "courroie qui baigne dans l'huile").trouve === 'exact', 'apostrophe typographique normalisée')
ok(chercherExtrait(n, sp, "l'intervalle passe à 100 000 km ou 6 ans").trouve === 'exact', 'entité HTML et espace insécable fine normalisées')
ok(chercherExtrait(n, sp, "Selon Peugeot l'intervalle passe à 100 000 km").trouve === 'sans_ponctuation', 'virgule manquante : retrouvé sans ponctuation')
ok(chercherExtrait(n, sp, 'la chaîne de distribution casse').trouve === 'absent', 'phrase absente')
ok(chercherExtrait(n, sp, 'courroie').trouve === 'absent', 'extrait trop court : jamais compté comme trouvé')
ok(decoderEntites('&#8217;&#x2019;&eacute;') === '’’é', 'entités numériques et nommées')
const r = controlerPage('https://x.fr', page, ["courroie qui baigne dans l'huile", 'phrase inventée sur la page'], 14000)
ok(r.joignable && r.trouves === 1 && r.extraits_verbatim === 2, 'un trouvé sur deux')
ok(controlerPage('https://x.fr', null, ['a'], 14000).joignable === false, 'page injoignable')
const longue = 'x '.repeat(10000) + "courroie qui baigne dans l'huile"
ok(controlerPage('https://x.fr', longue, ["courroie qui baigne dans l'huile"], 14000).au_dela_du_juge === 1, 'extrait au-delà des 14 000 caractères lus par le juge : signalé')
// ── Fenêtre centrée ─────────────────────────────────────────────────────────
{
  const M = MARQUE_SECTION
  const texte = 'intro '.repeat(3000) + ` ${M}Fiabilité du 1.5 dCi${M} ` + 'bla '.repeat(500) + "La courroie qui baigne dans l\u2019huile s'use vite." + ' suite'.repeat(3000)
  const c = texteCentre({ titre: 'Renault 1.5 dCi : les pannes', texte }, ["courroie qui baigne dans l'huile s'use vite"])
  ok(c && c.startsWith('[Titre de la page : Renault 1.5 dCi : les pannes]'), 'le titre de la page vient en tête')
  ok(c && c.includes('[Section : Fiabilité du 1.5 dCi]'), 'le titre de section le plus proche avant l’extrait')
  ok(c && c.includes("La courroie qui baigne dans l’huile") === false && c.includes("La courroie qui baigne dans l'huile"), 'l’extrait est dans la fenêtre (apostrophe normalisée, casse d’origine)')
  ok(c && c.length < 2 * DEMI_FENETRE + 400, 'environ 3 000 caractères de part et d’autre, pas plus')
  ok(c && c.includes('[…]'), 'la coupe est signalée')
  ok(texteCentre({ titre: null, texte }, ['une phrase qui ne figure nulle part ici']) === null, 'extrait non retrouvé : null (lecture standard)')
  const deux = texteCentre({ titre: null, texte: 'a '.repeat(10000) + 'premier extrait assez long ici ' + 'b '.repeat(100) + 'second extrait assez long ici' + ' c'.repeat(10000) }, ['premier extrait assez long ici', 'second extrait assez long ici'])
  ok(deux && (deux.match(/\[…\]/g) ?? []).length === 2, 'deux extraits proches : UNE fenêtre fusionnée')
}

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${ok_}/${ok_ + ko} contrôles passés`)
if (ko > 0) process.exit(1)
