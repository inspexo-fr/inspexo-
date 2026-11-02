// Proxy Vercel : https://www.inspexo.io/api/marche → fonction Supabase marche.
// Même raison d'être que api/intake.js : l'extension Chrome ne parle QU'À
// inspexo.io (engagement de confidentialité du Web Store). Le proxy transmet
// l'IP réelle du client (en-tête accompagné du secret MARCHE_PROXY_SECRET)
// pour que le plafond de contributions par jour s'applique au bon utilisateur
// et non à l'IP de sortie de Vercel.
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'content-type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL
  const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY
  const PROXY_SECRET = process.env.MARCHE_PROXY_SECRET
  if (!SUPABASE_URL || !ANON_KEY || !PROXY_SECRET) {
    return res.status(500).json({ error: 'misconfigured' })
  }

  // Corps borné : 60 annonces de métadonnées tiennent largement dans 200 Ko.
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 200_000) return res.status(413).json({ error: 'payload_too_large' })
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')

  // Sur Vercel, la première entrée de x-forwarded-for est l'IP du client.
  const clientIp = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'

  try {
    const upstream = await fetch(`${SUPABASE_URL}/functions/v1/marche`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
        'x-proxy-secret': PROXY_SECRET,
        'x-proxy-client-ip': clientIp,
      },
      body: raw,
      signal: AbortSignal.timeout(20000),
    })
    const body = await upstream.text()
    res.status(upstream.status)
    res.setHeader('Content-Type', 'application/json')
    return res.send(body)
  } catch (e) {
    return res.status(502).json({ error: 'upstream_unavailable' })
  }
}
