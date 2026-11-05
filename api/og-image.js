// SPRINT 17 — Image de partage, générée pour CHAQUE dossier.
//
// Jusqu'ici, tout lien /a/:id partagé sur WhatsApp, Facebook ou un forum
// affichait la même image générique : le lecteur voyait le logo d'Inspexo et
// rien du véhicule. Une image qui ne dit rien ne donne pas envie de cliquer.
//
// ⚠️ ELLE NE MONTRE QUE CE QUE LA PAGE PUBLIQUE AFFICHE DÉJÀ : marque, modèle,
// année, tampon du verdict, score. Ni prix, ni coordonnées, ni rien du
// vendeur. Une image de partage voyage plus loin que la page — elle se
// retrouve dans des aperçus, des caches, des captures — donc elle en dit
// MOINS, jamais plus.
//
// Police : celle fournie par @vercel/og. Nos woff2 ne sont pas lisibles par
// Satori (il accepte ttf/otf/woff, pas woff2) et aller chercher un ttf à
// chaque rendu ajouterait un aller-retour réseau dans un chemin que les
// robots d'aperçu coupent vite. La mise en page, les couleurs et le tampon
// suivent la charte ; la fonte, non. C'est le compromis assumé.
// ⚠️ PAS DE `runtime: 'edge'` ICI, ET C'EST UNE CORRECTION, PAS UN OUBLI.
// Avec ce drapeau, le déploiement échoue : « The Edge Function "api/og-image"
// is referencing unsupported modules: @vercel ». La chaîne de build de ce
// projet (CRA + fonctions dans `api/`) compile les fichiers ESM en CommonJS —
// le journal le dit : « Compiling "og-image.js" from ESM to CommonJS » — et un
// bundle CommonJS ne peut pas être servi comme fonction edge.
// `@vercel/og` fonctionne sur le runtime Node, qui est celui des autres
// fonctions du dossier `api/`. On garde donc le runtime par défaut.

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Mêmes valeurs que src/styles/tokens.css (thème clair).
const PAPIER = '#F3F0E9'
const ENCRE = '#0F1B2D'
const GRAPHITE = '#5B6270'
const RULE = '#CFC9BC'
const COULEUR = { vert: '#1E6B3A', orange: '#8F4D00', rouge: '#B3122E' }
const TAMPON = { vert: 'FEU VERT', orange: 'PRUDENCE', rouge: 'SIGNAUX ROUGES' }

// ⚠️ IMPORT DYNAMIQUE, ET LE SPÉCIFICATEUR PASSE PAR UNE VARIABLE.
//
// Deux échecs de déploiement successifs avant d'arriver ici :
//  1. avec `runtime: 'edge'` → « The Edge Function is referencing unsupported
//     modules: @vercel » ;
//  2. en runtime Node avec un `import` statique → à l'exécution,
//     « ERR_REQUIRE_ESM: require() of ES Module index.node.js not supported ».
//
// La cause est la même : la chaîne de build compile les fichiers de `api/`
// d'ESM en CommonJS (« Compiling "og-image.js" from ESM to CommonJS »), et un
// `require()` ne peut pas charger un module ESM. Node sait le faire avec
// `import()`, qui reste disponible depuis CommonJS.
//
// Le spécificateur passe par une VARIABLE pour que le compilateur ne puisse
// pas le résoudre statiquement et le réécrire en `require()` : c'est ce qui
// garantit qu'un vrai import dynamique survit à la compilation.
const PAQUET_OG = '@vercel/og'

// ⚠️ SIGNATURE NODE, PAS EDGE. Troisième correction du même déploiement :
// écrite pour le runtime edge, la fonction recevait un `Request` dont l'URL
// est absolue. En Node, `req` est un `IncomingMessage` et `req.url` ne porte
// que le chemin — d'où « TypeError: Invalid URL ». On lit donc la requête
// comme les autres fonctions du dossier `api/`, et on écrit dans `res`.
export default async function handler(req, res) {
  const id = String(req.query?.id ?? new URL(req.url, 'http://local').searchParams.get('id') ?? '')
  if (!UUID_RE.test(id)) {
    res.status(404).send('Not found')
    return
  }

  let r = null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_analysis`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      // p_track=false : un robot d'aperçu n'est pas une visite.
      body: JSON.stringify({ p_id: id, p_track: false }),
    })
    if (res.ok) r = await res.json()
  } catch (_) { /* image de repli ci-dessous */ }

  const resultat = r?.result_json || r?.result || null
  const v = resultat?.vehicule || {}
  const enCours = (resultat?.statut_analyse ?? 'fini') !== 'fini'
  const verdict = enCours ? null : (resultat?.verdict || null)
  const score = enCours ? null : (typeof resultat?.score === 'number' ? resultat.score : null)

  const titre = [v.marque, v.modele].filter(Boolean).join(' ').slice(0, 42) || 'Dossier Inspexo'
  const sousTitre = [v.annee, v.motorisation].filter(Boolean).join(' · ').slice(0, 60)
  const couleur = verdict ? (COULEUR[verdict] || ENCRE) : GRAPHITE
  const tampon = verdict ? TAMPON[verdict] : 'ANALYSE EN COURS'

  const { ImageResponse } = await import(PAQUET_OG)
  const image = new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: PAPIER, color: ENCRE, padding: '56px 64px',
          fontFamily: 'sans-serif', justifyContent: 'space-between',
        },
        children: [
          // En-tête : la marque du service, discrète.
          {
            type: 'div',
            props: {
              style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: `2px solid ${ENCRE}`, paddingBottom: 18, fontSize: 24, letterSpacing: 4 },
              children: [
                { type: 'div', props: { style: { fontWeight: 700 }, children: 'INSPEXO' } },
                { type: 'div', props: { style: { color: GRAPHITE, letterSpacing: 2 }, children: "ANALYSE D'ANNONCE" } },
              ],
            },
          },
          // Véhicule.
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column', gap: 10 },
              children: [
                { type: 'div', props: { style: { fontSize: 78, fontWeight: 700, lineHeight: 1.05 }, children: titre } },
                sousTitre
                  ? { type: 'div', props: { style: { fontSize: 32, color: GRAPHITE }, children: sousTitre } }
                  : { type: 'div', props: { children: '' } },
              ],
            },
          },
          // Tampon du verdict + score.
          {
            type: 'div',
            props: {
              style: { display: 'flex', alignItems: 'center', gap: 32 },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex', border: `4px solid ${couleur}`, color: couleur,
                      padding: '14px 28px', fontSize: 40, fontWeight: 700, letterSpacing: 3,
                      transform: 'rotate(-2deg)',
                    },
                    children: tampon,
                  },
                },
                score != null
                  ? {
                    type: 'div',
                    props: {
                      style: { display: 'flex', alignItems: 'baseline', gap: 8, color: couleur },
                      children: [
                        { type: 'div', props: { style: { fontSize: 64, fontWeight: 700 }, children: String(score) } },
                        { type: 'div', props: { style: { fontSize: 28, color: GRAPHITE }, children: '/100' } },
                      ],
                    },
                  }
                  : { type: 'div', props: { children: '' } },
              ],
            },
          },
          // Pied : la mention qui accompagne déjà chaque dossier.
          {
            type: 'div',
            props: {
              style: { borderTop: `1px solid ${RULE}`, paddingTop: 16, fontSize: 22, color: GRAPHITE },
              children: "Analyse automatique de l'annonce. Ne remplace pas un examen du véhicule. · inspexo.io",
            },
          },
        ],
      },
    },
    { width: 1200, height: 630 },
  )

  // ⚠️ LE CACHE EST POSÉ ICI, PAS DANS LES OPTIONS D'`ImageResponse`.
  // Celle-ci pose son propre `Cache-Control: public, immutable,
  // max-age=31536000`, et l'en-tête passé en option s'AJOUTE au lieu de le
  // remplacer : la réponse sortait avec deux directives, et c'est la première
  // qui gagne chez les caches. Une image d'analyse EN COURS aurait été figée
  // un an sur « ANALYSE EN COURS », l'aperçu ne montrant jamais le verdict.
  // Trouvé en rendant l'image en local avant de déployer.
  const octets = Buffer.from(await image.arrayBuffer())
  res.setHeader('Content-Type', 'image/png')
  res.setHeader(
    'Cache-Control',
    enCours ? 'public, max-age=60' : 'public, max-age=86400, stale-while-revalidate=604800',
  )
  res.status(200).send(octets)
}
