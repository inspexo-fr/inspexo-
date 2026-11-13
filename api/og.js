// Rendu Open Graph serveur pour /a/:id — servi aux crawlers de prévisualisation
// (Facebook, WhatsApp, Twitter/X, LinkedIn…) via le rewrite conditionnel de
// vercel.json. Les humains reçoivent la SPA normalement.
// Lecture via la RPC publique get_public_analysis avec p_track=false :
// les hits de bots n'incrémentent ni share_views ni result_viewed.

const SUPABASE_URL =
  process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL
const ANON_KEY =
  process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const IMAGE_STATIQUE = 'https://www.inspexo.io/og-image.png'

/** L'aperçu propre à ce dossier existe-t-il DÉJÀ dans le bucket public ?
 *
 *  ⚠️ On vérifie le fichier, on ne le suppose pas. La version précédente
 *  faisait pointer `og:image` sur une génération à la volée : elle rendait
 *  500, et tous les aperçus de partage du site ont été cassés jusqu'à ce que
 *  je m'en aperçoive. Une balise ne doit désigner qu'une URL dont on vient de
 *  constater qu'elle répond.
 *
 *  Le délai est court (2,5 s) et l'échec retombe sur l'image statique : un
 *  robot d'aperçu n'attend pas, et mieux vaut l'image générique que pas
 *  d'image du tout. */
async function imageDuDossier(id) {
  if (!SUPABASE_URL) return IMAGE_STATIQUE
  const url = `${SUPABASE_URL}/storage/v1/object/public/apercus/${id}.png`
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 2500)
    const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal })
    clearTimeout(t)
    if (res.ok && (res.headers.get('content-type') || '').includes('image/png')) return url
  } catch (_) { /* repli */ }
  return IMAGE_STATIQUE
}

export default async function handler(req, res) {
  const id = req.query.id
  if (!id || !UUID_RE.test(id)) {
    res.status(404).send('Not found')
    return
  }

  let row = null
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ p_id: id, p_track: false }),
    })
    if (resp.ok) row = await resp.json()
  } catch (_) {
    // Supabase injoignable : on sert des meta génériques.
  }

  const url = `https://www.inspexo.io/a/${id}`
  let title = 'Verdict Inspexo — analyse d\'annonce auto'
  let description =
    'Analyse automatique d\'annonce de véhicule d\'occasion : verdict, défauts connus du modèle, rappels constructeur.'

  if (row && row.verdict) {
    const vehicule =
      [row.marque, row.modele].filter(Boolean).join(' ') || 'véhicule d\'occasion'
    title = `Verdict Inspexo : ${row.verdict} — ${vehicule}`
    // Audit sprint 24 : la description d'aperçu ne recopie pas les raisons du
    // dossier (ce code lisait un champ `raisons` qui n'existe pas, il n'a donc
    // jamais servi). Un aperçu voyage plus loin que la page : il en dit moins.
  }

  // Aperçu propre au dossier s'il existe DÉJÀ, image statique sinon.
  const image = await imageDuDossier(id)

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="robots" content="noindex">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escapeHtml(title)}">
<meta property="og:site_name" content="Inspexo">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(url)}">
</head>
<body>
<p><a href="${escapeHtml(url)}">${escapeHtml(title)}</a></p>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  // Pas de cache CDN sur l'échec : une panne passagère de Supabase ne doit pas
  // figer un 404 pendant 10 minutes.
  res.setHeader('Cache-Control', row ? 'public, max-age=300, s-maxage=600' : 'no-store')
  res.status(row ? 200 : 404).send(html)
}
