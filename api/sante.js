// SPRINT 17 — Point de contrôle public, pour un service de surveillance externe.
//
// Sans secret, et c'est voulu : un service gratuit comme UptimeRobot ne sait
// pas porter d'en-tête d'authentification sur son palier gratuit, et un secret
// posé dans l'URL d'un moniteur tiers n'est pas un secret.
//
// ⚠️ EN CONTREPARTIE, IL NE DIT RIEN D'UTILE À UN TIERS. Ni volume, ni chiffre
// d'affaires, ni date de dernière analyse : le trafic d'Inspexo ne doit pas se
// déduire d'une page publique. Il prouve trois choses, et seulement trois :
// la base répond, le schéma attendu est là, les fonctions critiques répondent.
//
// ⚠️ ET SURTOUT, IL NE JUGE PAS SUR LE VOLUME. Un point de contrôle qui
// passerait au rouge faute d'analyse récente serait rouge en permanence
// aujourd'hui (treize analyses réelles depuis le 18 octobre) — et un voyant
// toujours rouge ne se regarde plus.

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

const TIMEOUT_MS = 8000

async function avecDelai(promesse, ms) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await promesse(ctrl.signal)
  } finally {
    clearTimeout(t)
  }
}

/** La base répond-elle, et le schéma attendu est-il en place ? */
async function verifierBase() {
  try {
    const res = await avecDelai(
      (signal) =>
        fetch(`${SUPABASE_URL}/rest/v1/rpc/sante`, {
          method: 'POST',
          headers: {
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: '{}',
          signal,
        }),
      TIMEOUT_MS,
    )
    if (!res.ok) return { ok: false, detail: `http_${res.status}` }
    const j = await res.json()
    return { ok: j?.base === 'ok' && j?.schema === true, detail: j?.schema === true ? 'ok' : 'schema_incomplet' }
  } catch (e) {
    return { ok: false, detail: String(e?.name === 'AbortError' ? 'timeout' : e).slice(0, 80) }
  }
}

/** Une fonction edge répond-elle ?
 *
 *  Le pré-vol CORS (OPTIONS) suffit : il prouve que la fonction est déployée
 *  et qu'elle sert, sans rien consommer — ni crédit IA, ni quota, ni ligne en
 *  base. Un GET sur `score` lancerait une analyse. */
async function verifierFonction(nom) {
  try {
    const res = await avecDelai(
      (signal) => fetch(`${SUPABASE_URL}/functions/v1/${nom}`, { method: 'OPTIONS', signal }),
      TIMEOUT_MS,
    )
    return res.status >= 200 && res.status < 500
  } catch (_) {
    return false
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (!SUPABASE_URL || !ANON_KEY) {
    res.status(503).send(JSON.stringify({ ok: false, erreur: 'configuration_absente' }))
    return
  }

  const [base, score, rappels] = await Promise.all([
    verifierBase(),
    verifierFonction('score'),
    verifierFonction('rappels'),
  ])

  const ok = base.ok && score && rappels

  // Alerte IMMÉDIATE, et seulement en cas de panne détectée. Le point de
  // contrôle étant public, on ne déclenche jamais d'appel sortant sur un
  // passage normal : c'est la panne qui parle, pas le moniteur.
  // L'étranglement horaire vit côté serveur (`alerterUneFoisParHeure`), donc
  // marteler cette URL ne produit pas plus d'un email par heure.
  if (!ok) {
    const detail = [
      base.ok ? null : `base: ${base.detail}`,
      score ? null : 'fonction score injoignable',
      rappels ? null : 'fonction rappels injoignable',
    ].filter(Boolean).join(' · ')
    try {
      await avecDelai(
        (signal) =>
          fetch(`${SUPABASE_URL}/functions/v1/alertes`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${ANON_KEY}`,
              apikey: ANON_KEY,
              'x-cron-secret': process.env.CRON_PROXY_SECRET || '',
            },
            body: JSON.stringify({ tache: 'sante', detail }),
            signal,
          }),
        TIMEOUT_MS,
      )
    } catch (_) {
      // Une alerte qui n'arrive pas ne doit pas changer le code de retour :
      // le moniteur externe reste le filet, et c'est lui qui compte.
    }
  }
  // 503 et non 500 : c'est une indisponibilité, pas un bogue de ce point de
  // contrôle. Les moniteurs distinguent les deux dans leurs historiques.
  res.status(ok ? 200 : 503).send(
    JSON.stringify({
      ok,
      base: base.ok ? 'ok' : base.detail,
      fonctions: { score: score ? 'ok' : 'injoignable', rappels: rappels ? 'ok' : 'injoignable' },
      verifie_le: new Date().toISOString(),
    }),
  )
}
