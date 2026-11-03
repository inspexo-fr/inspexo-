// Point d'entrée public de l'API de scoring : POST /api/v1/analyses.
//
// Rôle du proxy : donner une URL stable sur inspexo.io et séparer la clé du
// client de l'authentification Supabase. Le client met SA clé dans
// Authorization (ou X-API-Key) ; nous la déplaçons dans X-Inspexo-Key et
// mettons la clé anon dans Authorization pour atteindre la fonction edge.
// Sans ce déplacement, les deux se marcheraient dessus.
//
// Aucune logique de quota ici : tout est décidé côté serveur, atomiquement.
const CLE_RE = /^ix_live_[A-Za-z0-9_-]{43}$/

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization, x-api-key')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed', message: 'Utilisez POST.' })
  }

  const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL
  const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY
  if (!SUPABASE_URL || !ANON_KEY) {
    return res.status(503).json({ error: 'service_indisponible', message: 'API non configurée.' })
  }

  const bearer = String(req.headers.authorization || '').match(/^Bearer\s+(\S+)$/i)
  const cle = (bearer && CLE_RE.test(bearer[1]) && bearer[1]) ||
    (CLE_RE.test(String(req.headers['x-api-key'] || '')) && String(req.headers['x-api-key'])) || null
  if (!cle) {
    return res.status(401).json({
      error: 'cle_manquante',
      message: "Clé d'API requise : en-tête « Authorization: Bearer ix_live_… » ou « X-API-Key ».",
    })
  }

  // Corps borné : une annonce fait quelques kilo-octets, pas davantage.
  const chunks = []
  let taille = 0
  for await (const c of req) {
    taille += c.length
    if (taille > 100_000) {
      return res.status(413).json({ error: 'payload_too_large', message: 'Corps trop volumineux.' })
    }
    chunks.push(c)
  }

  try {
    const amont = await fetch(`${SUPABASE_URL}/functions/v1/api-analyses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
        'X-Inspexo-Key': cle,
      },
      body: Buffer.concat(chunks).toString('utf8') || '{}',
      signal: AbortSignal.timeout(160000),
    })
    const corps = await amont.text()
    res.status(amont.status)
    res.setHeader('Content-Type', 'application/json')
    const restant = amont.headers.get('x-quota-restant')
    if (restant) res.setHeader('X-Quota-Restant', restant)
    return res.send(corps)
  } catch (e) {
    return res.status(502).json({
      error: 'upstream_unavailable',
      message: 'Service momentanément indisponible. Réessayez dans un instant.',
    })
  }
}
