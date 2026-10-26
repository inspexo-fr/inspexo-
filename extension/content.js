// Bouton flottant « Analyser avec Inspexo » sur les pages d'annonce.
// Aucune collecte : rien n'est lu ni envoyé avant le clic de l'utilisateur.
'use strict'

const INSPEXO_BASE = 'https://www.inspexo.io'

function currentSite () {
  return (globalThis.INSPEXO_SITES || []).find(s => {
    try { return s.match(window.location) } catch (_) { return false }
  }) || null
}

function currentSerpSite () {
  return (globalThis.INSPEXO_SITES || []).find(s => {
    try { return s.matchSerp && s.matchSerp(window.location) } catch (_) { return false }
  }) || null
}

function buildButton () {
  const btn = document.createElement('button')
  btn.id = 'inspexo-analyser-btn'
  btn.type = 'button'
  btn.innerHTML = '<span id="inspexo-btn-dot"></span><span id="inspexo-btn-label">Analyser avec Inspexo</span>'
  btn.addEventListener('click', onClick)
  return btn
}

function setState (label, disabled) {
  const el = document.getElementById('inspexo-btn-label')
  const btn = document.getElementById('inspexo-analyser-btn')
  if (el) el.textContent = label
  if (btn) btn.disabled = !!disabled
}

async function onClick () {
  const site = currentSite()
  let data = null
  try { data = site ? site.extract(document) : null } catch (_) { data = null }

  // Extraction impossible (HTML du site modifié) : fallback propre vers /score,
  // préremplie avec ce que la page offre de sélectionnable (titre + sélection).
  if (!data || (!data.titre && !data.description)) {
    const selection = String(window.getSelection() || '').trim()
    const texte = [document.title, selection].filter(Boolean).join('\n\n').slice(0, 5500)
    window.open(
      texte ? `${INSPEXO_BASE}/score?texte=${encodeURIComponent(texte)}` : `${INSPEXO_BASE}/score`,
      '_blank',
    )
    return
  }

  setState('Analyse en cours… (moins d’une minute)', true)
  try {
    const reponse = await chrome.runtime.sendMessage({ type: 'inspexo_analyser', data })
    if (reponse && reponse.ok) {
      setState('Analyser avec Inspexo', false)
      return // le service worker a ouvert /a/:id dans un nouvel onglet
    }
    if (reponse && reponse.error === 'rate_limited') {
      setState('Limite de 5 analyses / 24 h atteinte', false)
      setTimeout(() => setState('Analyser avec Inspexo', false), 6000)
      return
    }
    throw new Error(reponse && reponse.error ? reponse.error : 'echec')
  } catch (_) {
    // Échec réseau/API : fallback /score avec le texte extrait.
    const texte = [
      data.titre, data.prix && `Prix : ${data.prix}`, data.annee && `Année : ${data.annee}`,
      data.kilometrage && `Kilométrage : ${data.kilometrage}`, data.description,
    ].filter(Boolean).join('\n').slice(0, 5500)
    window.open(`${INSPEXO_BASE}/score?texte=${encodeURIComponent(texte)}`, '_blank')
    setState('Analyser avec Inspexo', false)
  }
}

// Page de résultats : bouton « Ajouter ces annonces comme comparables ».
// Seuls titre/année/km/prix des annonces affichées sont extraits, à la demande,
// et joints à la PROCHAINE analyse. Rien d'autre n'est collecté.
function buildSerpButton () {
  const btn = document.createElement('button')
  btn.id = 'inspexo-comparables-btn'
  btn.type = 'button'
  btn.innerHTML = '<span id="inspexo-btn-dot"></span><span>Ajouter ces annonces comme comparables</span>'
  btn.addEventListener('click', async () => {
    const site = currentSerpSite()
    let comparables = []
    try { comparables = site ? site.extractSerp(document) : [] } catch (_) { comparables = [] }
    if (!comparables.length) {
      btn.querySelector('span:last-child').textContent = 'Aucune annonce lisible sur cette page'
      setTimeout(() => { btn.querySelector('span:last-child').textContent = 'Ajouter ces annonces comme comparables' }, 4000)
      return
    }
    await chrome.runtime.sendMessage({ type: 'inspexo_comparables', comparables })
    btn.querySelector('span:last-child').textContent =
      `${comparables.length} annonce${comparables.length > 1 ? 's' : ''} enregistrée${comparables.length > 1 ? 's' : ''} pour la prochaine analyse`
    setTimeout(() => { btn.querySelector('span:last-child').textContent = 'Ajouter ces annonces comme comparables' }, 5000)
  })
  return btn
}

function refresh () {
  const existing = document.getElementById('inspexo-analyser-btn')
  const onAdPage = !!currentSite()
  if (onAdPage && !existing && document.body) document.body.appendChild(buildButton())
  if (!onAdPage && existing) existing.remove()

  const existingSerp = document.getElementById('inspexo-comparables-btn')
  const onSerp = !onAdPage && !!currentSerpSite()
  if (onSerp && !existingSerp && document.body) document.body.appendChild(buildSerpButton())
  if (!onSerp && existingSerp) existingSerp.remove()
}

refresh()
// Les trois sites sont des SPA : on suit les changements d'URL sans navigation.
let lastHref = window.location.href
setInterval(() => {
  if (window.location.href !== lastHref) {
    lastHref = window.location.href
    refresh()
  }
}, 1200)
