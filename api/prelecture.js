// Proxy Vercel : https://www.inspexo.io/api/prelecture → fonction Supabase prelecture.
// Même raison d'être que /api/intake : l'extension ne parle QU'À inspexo.io, et
// le proxy transmet l'IP réelle (en-tête signé par INTAKE_PROXY_SECRET) pour
// le plafond anti-abus. Sprint 23, lot 3 : pré-lecture sans IA.
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'content-type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL
  const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY
  const PROXY_SECRET = process.env.INTAKE_PROXY_SECRET
  if (!SUPABASE_URL || !ANON_KEY || !PROXY_SECRET) return res.status(500).json({ error: 'misconfigured' })

  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 100_000) return res.status(413).json({ error: 'payload_too_large' })
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  const clientIp = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'
  try {
    const upstream = await fetch(`${SUPABASE_URL}/functions/v1/prelecture`, {
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
    res.status(upstream.status)
    res.setHeader('Content-Type', 'application/json')
    return res.send(await upstream.text())
  } catch (e) {
    return res.status(502).json({ error: 'upstream_unavailable' })
  }
}
