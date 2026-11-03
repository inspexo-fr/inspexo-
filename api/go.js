// Proxy Vercel : https://www.inspexo.io/go/<slug> → fonction Supabase `go`.
//
// Le navigateur n'apprend jamais l'URL du partenaire : il demande /go/<slug>,
// le serveur journalise la mise en relation puis renvoie une 302. Sans ce
// détour, un lien direct serait suivi sans être compté et le chiffre montré
// dans l'admin serait faux.
//
// `Referrer-Policy: no-referrer` : le partenaire ne doit pas recevoir
// l'adresse du dossier d'analyse que l'acheteur lisait — ce serait une fuite
// de donnée sur sa recherche de voiture.
module.exports = async (req, res) => {
  const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL
  const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY
  const PROXY_SECRET = process.env.GO_PROXY_SECRET

  const echec = (code) => {
    res.statusCode = 302
    res.setHeader('Location', `https://www.inspexo.io/?lien=${code}`)
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Cache-Control', 'no-store')
    return res.end()
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405
    return res.end()
  }
  if (!SUPABASE_URL || !ANON_KEY || !PROXY_SECRET) return echec('indisponible')

  // /go/<slug> — le slug est le dernier segment du chemin.
  const url = new URL(req.url, 'https://www.inspexo.io')
  const slug = url.pathname.replace(/^\/go\//, '').replace(/\/+$/, '').toLowerCase()
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return echec('inconnu')

  const analysisId = url.searchParams.get('a')
  const source = url.searchParams.get('s')
  const clientIp = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'

  try {
    const upstream = await fetch(`${SUPABASE_URL}/functions/v1/go`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
        'x-proxy-secret': PROXY_SECRET,
        'x-proxy-client-ip': clientIp,
      },
      body: JSON.stringify({
        slug,
        analysis_id: analysisId,
        source,
        ip: clientIp,
        user_agent: req.headers['user-agent'] || '',
      }),
      signal: AbortSignal.timeout(8000),
    })
    const body = await upstream.json().catch(() => null)
    if (!upstream.ok || !body || !body.url) return echec('inconnu')

    res.statusCode = 302
    res.setHeader('Location', body.url)
    res.setHeader('Referrer-Policy', 'no-referrer')
    // Jamais de mise en cache : chaque passage doit être compté.
    res.setHeader('Cache-Control', 'no-store, max-age=0')
    return res.end()
  } catch (e) {
    return echec('indisponible')
  }
}
