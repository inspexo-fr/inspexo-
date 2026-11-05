// Test hors ligne des alertes d'exploitation (aucun réseau, aucune base).
// Usage : node tests/alerting.test.mjs
import { readFileSync } from 'node:fs'
import {
  bilanHtml,
  dejaAlerte,
  estCreditOuCle,
  eventTemoin,
  PREFIXE_BILAN,
  PREFIXE_URGENT,
  sujetAlerte,
  sujetBilan,
} from '../supabase/functions/_shared/alerting.ts'

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(a === b, `${l}${a === b ? '' : ` (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`}`)

// ── Les objets d'email servent de FILTRE : ils sont figés ──────────────────
//
// ⚠️ Utku filtre ces messages dans Gmail. Changer un préfixe ne casse rien
// visiblement : les alertes continuent de partir, mais elles n'arrivent plus
// dans le bon dossier — et une alerte qu'on ne voit pas n'existe pas.
eq(PREFIXE_URGENT, '[URGENT] Inspexo —', 'le préfixe des alertes est figé')
eq(PREFIXE_BILAN, '[Bilan] Inspexo —', 'le préfixe du bilan est figé')
ok(sujetAlerte('credit_ou_cle').startsWith('[URGENT] Inspexo — '), 'une alerte porte le préfixe urgent')
ok(sujetBilan('05/11/2026') === '[Bilan] Inspexo — 05/11/2026', 'le bilan porte sa date')
ok(!sujetBilan('x').startsWith(PREFIXE_URGENT), 'le bilan n’emprunte jamais le préfixe urgent')
ok(sujetAlerte('cout_du_jour', '7,40 €').includes('7,40 €'), 'la précision entre dans l’objet')
ok(sujetAlerte('credit_ou_cle').includes('crédit'), 'l’objet dit de quoi il s’agit, sans ouvrir le message')

// ── Crédit/clé contre surcharge passagère ──────────────────────────────────
//
// ⚠️ LE DISCRIMINANT QUI COMPTE. Une surcharge se résout seule ; un crédit
// épuisé ou une clé invalide arrêtent le service jusqu'à intervention. Les
// confondre, c'est soit crier au loup, soit rester muet pendant une panne.
for (const [code, detail, quoi] of [
  ['api_400', 'Your credit balance is too low to access the Anthropic API', 'crédit épuisé'],
  ['api_401', 'authentication_error: invalid x-api-key', 'clé invalide'],
  ['api_401', '', 'code 401 seul'],
  ['api_403', 'unauthorized', 'code 403'],
  ['api_400', 'insufficient_quota', 'quota insuffisant'],
  ['api_400', 'billing issue on your account', 'problème de facturation'],
]) {
  ok(estCreditOuCle(code, detail), `alerte levée — ${quoi}`)
}

for (const [code, detail, quoi] of [
  ['api_529', 'Overloaded', 'surcharge 529'],
  ['api_429', 'rate_limit_error: number of requests', 'limite de débit'],
  ['api_500', 'internal server error', 'erreur serveur passagère'],
  ['api_503', 'temporarily unavailable', 'indisponibilité passagère'],
  ['fetch_error', 'network timeout', 'réseau'],
  ['', '', 'rien du tout'],
]) {
  ok(!estCreditOuCle(code, detail), `PAS d’alerte crédit/clé — ${quoi}`)
}

// Le piège : « overloaded » gagne sur « quota », parce que la surcharge se
// résout seule même quand le message mentionne un quota.
ok(!estCreditOuCle('api_529', 'Overloaded: quota temporarily exceeded'),
  'une surcharge qui mentionne « quota » reste une surcharge')

// ── Témoin d'étranglement ──────────────────────────────────────────────────
eq(eventTemoin('cout_du_jour'), 'alerte_cout_du_jour_envoyee', 'le témoin porte le motif')
ok(new Set(['credit_ou_cle', 'echecs_repetes', 'fonction_en_erreur', 'cout_du_jour'].map(eventTemoin)).size === 4,
  'un témoin distinct par motif — sinon une alerte en étoufferait une autre')

// ⚠️ Base muette ⇒ on N'ENVOIE PAS. Une base qui ne répond pas est déjà un
// incident ; y ajouter une boucle d'emails l'aggrave.
{
  const adminCasse = { from: () => { throw new Error('base indisponible') } }
  ok(await dejaAlerte(adminCasse, 'cout_du_jour'),
    'si la base ne répond pas, on considère avoir déjà alerté : pas de boucle d’emails')
}
{
  const adminVide = {
    from: () => ({ select: () => ({ eq: () => ({ gte: () => Promise.resolve({ count: 0 }) }) }) }),
  }
  eq(await dejaAlerte(adminVide, 'cout_du_jour'), false, 'aucun témoin récent : l’alerte peut partir')
}
{
  const adminPlein = {
    from: () => ({ select: () => ({ eq: () => ({ gte: () => Promise.resolve({ count: 1 }) }) }) }),
  }
  eq(await dejaAlerte(adminPlein, 'cout_du_jour'), true, 'un témoin dans l’heure étrangle l’alerte')
}

// ── Le bilan en HTML ───────────────────────────────────────────────────────
{
  const b = {
    jour: '2026-11-04',
    analyses: 12,
    analyses_par_source: { 'tiktok-01': 7, direct: 5 },
    verdicts: { orange: 6, rouge: 4, vert: 2 },
    clics: { pass: 3, inspection: 1, partage: 5 },
    paiements: { pass: 1, inspections: 0 },
    listes_attente: { pass_waitlist: 2 },
    leads_pro: 1,
    erreurs: { total: 2, par_etape: { analyse: 2 }, service_indisponible: 0 },
    cout_ia_eur: 1.2345,
    analyses_eval: 3,
  }
  const h = bilanHtml(b)
  ok(h.includes('2026-11-04'), 'le bilan porte sa date')
  ok(h.includes('<strong>12</strong>'), 'le nombre d’analyses réelles y est')
  ok(h.includes('1.23 €'), 'le coût est arrondi à deux décimales')
  ok(h.includes("analyses d'éval"), 'la part d’éval est dite, pas cachée')
  ok(h.includes('tiktok-01'), 'les sources sont détaillées')
  ok(h.includes('#B91C1C'), 'des erreurs présentes sont mises en rouge')
  ok(h.includes('Erreurs par étape'), 'le détail des erreurs n’apparaît que s’il y en a')
}
{
  // Journée vide : le bilan doit rester lisible, sans « NaN » ni « undefined ».
  const h = bilanHtml({})
  ok(!/NaN|undefined|\[object/.test(h), 'une journée vide ne produit ni NaN ni undefined')
  ok(h.includes('<em>aucun</em>'), 'les rubriques vides le disent')
  ok(!h.includes('Erreurs par étape'), 'pas de section d’erreurs quand il n’y en a aucune')
  ok(h.includes('0.00 €'), 'un coût nul s’écrit 0,00 € et non vide')
}

// ── Concordance avec la migration ──────────────────────────────────────────
{
  const sql = readFileSync(new URL('../supabase/migrations/20261117120000_sprint17_surveillance.sql', import.meta.url), 'utf8')
  // Les tarifs doivent être les MÊMES des deux côtés : deux comptes du même
  // argent qui divergent, c'est une facture qu'on ne sait plus expliquer.
  const score = readFileSync(new URL('../supabase/functions/score/index.ts', import.meta.url), 'utf8')
  ok(score.includes('3e-6') && score.includes('15e-6'), 'les tarifs de score sont bien ceux attendus')
  for (const [tarif, quoi] of [
    ['0.000003', 'entrée 3 $/M'],
    ['0.000015', 'sortie 15 $/M'],
    ['0.0000003', 'lecture de cache 0,30 $/M'],
    ['0.00000375', 'écriture de cache 3,75 $/M'],
    ['0.92', 'conversion en euros'],
  ]) {
    ok(sql.includes(tarif), `cout_ia_jour applique le même tarif que score — ${quoi}`)
  }
  ok(/is_eval = false/.test(sql), 'le bilan exclut les analyses d’éval des volumes')
  ok(sql.indexOf("'cout_ia_eur', public.cout_ia_jour(p_jour)") > 0,
    'mais le coût les inclut : c’est de l’argent réellement dépensé')
  // Le point de contrôle public ne doit rendre AUCUN chiffre d'affaires.
  const sante = sql.slice(sql.indexOf('function public.sante()'), sql.indexOf('comment on function public.sante()'))
  for (const table of ['analyses', 'events', 'passes', 'leads', 'inspections', 'verifications']) {
    ok(!sante.includes(`public.${table}`),
      `le point de contrôle public ne lit pas public.${table}`)
  }
  ok(!/count\(\*\)\s*from\s+public\./.test(sante),
    'il ne compte aucune ligne métier')
  ok(/grant execute on function public\.sante\(\) to anon/.test(sql), 'sante() est bien ouverte à anon')
  ok(/revoke all on function public\.cout_ia_jour\(date\) from public, anon, authenticated/.test(sql),
    'le coût du jour n’est PAS public')
}

console.log(`\n${ok_} contrôles passés, ${ko} échec(s).`)
if (ko > 0) process.exit(1)
console.log('Tous les tests alerting passent.')
