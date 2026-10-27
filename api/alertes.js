// Cron Vercel quotidien → fonction Supabase `alertes` (dossier d'achat) :
// rappels publiés sur les modèles suivis + emails de retour J+30.
// Sécurité : Vercel appelle ce chemin avec Authorization: Bearer CRON_SECRET
// (en-tête ajouté automatiquement quand la variable CRON_SECRET existe) ; le
// proxy relaie ensuite vers Supabase avec CRON_PROXY_SECRET.
module.exports = async (req, res) => {
  const CRON_SECRET = process.env.CRON_SECRET
  const CRON_PROXY_SECRET = process.env.CRON_PROXY_SECRET
  const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL
  const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY
  if (!CRON_SECRET || !CRON_PROXY_SECRET || !SUPABASE_URL || !ANON_KEY) {
    return res.status(500).json({ error: 'misconfigured' })
  }
  if (req.headers['authorization'] !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  try {
    const upstream = await fetch(`${SUPABASE_URL}/functions/v1/alertes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
        'x-cron-secret': CRON_PROXY_SECRET,
      },
      body: '{}',
      signal: AbortSignal.timeout(150000),
    })
    const body = await upstream.text()
    res.status(upstream.status)
    res.setHeader('Content-Type', 'application/json')
    return res.send(body)
  } catch (e) {
    return res.status(502).json({ error: 'upstream_unavailable' })
  }
}
