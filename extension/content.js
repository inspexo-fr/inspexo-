// Bouton flottant « Analyser avec Inspexo » sur les pages d'annonce.
// AUCUNE COLLECTE SANS ACTION DE L'UTILISATEUR : rien n'est lu ni envoyé avant
// un clic. Sur une page de résultats, le clic sur « Ajouter ces annonces comme
// comparables » sert l'analyse en cours ; et SI — et seulement si —
// l'utilisateur a coché « Contribuer anonymement aux prix de marché » (case
// décochée par défaut, choix mémorisé), les mêmes données alimentent aussi le
// relevé de prix agrégé. Jamais de relevé en tâche de fond.
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
  // Pré-lecture sans IA, au même clic : affichée en une seconde, pendant que
  // l'analyse complète tourne.
  chrome.runtime.sendMessage({ type: 'inspexo_prelecture', data })
    .then((r) => { if (r && r.ok) afficherPrelecture(r.pre) })
    .catch(() => {})
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

// Panneau de pré-lecture (sprint 23, lot 3) : rappels, Crit'Air, prix observés,
// signaux d'arnaque. Construit avec textContent : aucun HTML venu du serveur.
function ligne (parent, texte, couleur) {
  const p = document.createElement('p')
  p.textContent = texte
  if (couleur) p.style.color = couleur
  parent.appendChild(p)
}
function afficherPrelecture (pre) {
  if (!pre || typeof pre !== 'object') return
  const ancien = document.getElementById('inspexo-prelecture')
  if (ancien) ancien.remove()
  const box = document.createElement('div')
  box.id = 'inspexo-prelecture'
  box.setAttribute('role', 'status')
  const fermer = document.createElement('button')
  fermer.type = 'button'
  fermer.textContent = '×'
  fermer.setAttribute('aria-label', 'Fermer la pré-lecture')
  fermer.addEventListener('click', () => box.remove())
  box.appendChild(fermer)
  ligne(box, 'Pré-lecture Inspexo')
  const signaux = Array.isArray(pre.signaux_arnaque) ? pre.signaux_arnaque : []
  for (const s of signaux.slice(0, 3)) ligne(box, `Signal d’arnaque : ${s.libelle} « ${s.extrait} »`, '#FF6B5B')
  if (pre.rappels) {
    if (pre.rappels.indisponible) ligne(box, 'Rappels : vérification RappelConso indisponible, réessayez plus tard.')
    else ligne(box, pre.rappels.n > 0 ? `Rappels publiés sur ce modèle : ${pre.rappels.n} (à vérifier avec le VIN).` : 'Aucun rappel RappelConso trouvé pour ce modèle à cette date.')
  }
  if (pre.critair && pre.critair.classe && pre.critair.classe !== 'inconnu') ligne(box, `${pre.critair.libelle} (déduit de l’année-modèle).`)
  if (pre.prix && pre.prix.evalue) {
    ligne(box, `Prix observés : ${pre.prix.p25} € – ${pre.prix.p75} € sur ${pre.prix.n} annonces${pre.prix.position ? ` ; ce prix est ${pre.prix.position}` : ''}.`)
  }
  ligne(box, pre.mention || 'Pré-lecture sans intelligence artificielle. L’analyse complète suit.')
  document.body.appendChild(box)
}

// Page de résultats : bouton « Ajouter ces annonces comme comparables ».
// Seuls titre/année/km/prix/carburant/boîte/code postal des annonces AFFICHÉES
// sont extraits, AU CLIC, et joints à la prochaine analyse. La case
// « Contribuer anonymement aux prix de marché » (décochée par défaut) ajoute
// l'envoi au relevé agrégé — et rien de plus : aucune URL, aucun titre
// conservé côté serveur, la seule granularité est le mois et la région.
const CLE_CONTRIB = 'inspexo_contribuer'

async function contributionActive () {
  try {
    return (await chrome.storage.local.get(CLE_CONTRIB))[CLE_CONTRIB] === true
  } catch (_) { return false }
}

function buildSerpBlock () {
  const wrap = document.createElement('div')
  wrap.id = 'inspexo-serp-bloc'

  const btn = document.createElement('button')
  btn.id = 'inspexo-comparables-btn'
  btn.type = 'button'
  btn.innerHTML = '<span id="inspexo-btn-dot"></span><span>Ajouter ces annonces comme comparables</span>'

  const label = document.createElement('label')
  label.id = 'inspexo-contrib-label'
  const case_ = document.createElement('input')
  case_.type = 'checkbox'
  case_.id = 'inspexo-contrib-case'
  // Décochée par défaut : l'absence de choix n'est jamais un consentement.
  case_.checked = false
  contributionActive().then((v) => { case_.checked = v })
  case_.addEventListener('change', () => {
    chrome.storage.local.set({ [CLE_CONTRIB]: case_.checked }).catch(() => {})
  })
  label.appendChild(case_)
  label.appendChild(document.createTextNode('Contribuer anonymement aux prix de marché'))

  const dire = (texte, ms = 5000) => {
    const cible = btn.querySelector('span:last-child')
    cible.textContent = texte
    setTimeout(() => { cible.textContent = 'Ajouter ces annonces comme comparables' }, ms)
  }

  btn.addEventListener('click', async () => {
    const site = currentSerpSite()
    let annonces = []
    try { annonces = site ? site.extractSerp(document) : [] } catch (_) { annonces = [] }
    if (!annonces.length) {
      dire('Aucune annonce lisible sur cette page', 4000)
      return
    }
    // 1) Toujours : comparables de la prochaine analyse (comportement d'origine).
    await chrome.runtime.sendMessage({ type: 'inspexo_comparables', comparables: annonces })
    const n = annonces.length
    const pluriel = n > 1 ? 's' : ''
    // 2) Seulement si l'utilisateur a coché : contribution au relevé agrégé.
    if (case_.checked) {
      const rep = await chrome.runtime.sendMessage({
        type: 'inspexo_contribuer', site: site.nom, annonces,
      }).catch(() => null)
      if (rep && rep.ok) {
        dire(`${n} annonce${pluriel} enregistrée${pluriel} + contribution envoyée`)
        return
      }
      if (rep && rep.error === 'rate_limited') {
        dire(`${n} annonce${pluriel} enregistrée${pluriel} — plafond de contributions atteint`, 6000)
        return
      }
      dire(`${n} annonce${pluriel} enregistrée${pluriel} — contribution non envoyée`, 6000)
      return
    }
    dire(`${n} annonce${pluriel} enregistrée${pluriel} pour la prochaine analyse`)
  })

  wrap.appendChild(btn)
  wrap.appendChild(label)
  return wrap
}

function refresh () {
  const existing = document.getElementById('inspexo-analyser-btn')
  const onAdPage = !!currentSite()
  if (onAdPage && !existing && document.body) document.body.appendChild(buildButton())
  if (!onAdPage && existing) existing.remove()

  const existingSerp = document.getElementById('inspexo-serp-bloc')
  const onSerp = !onAdPage && !!currentSerpSite()
  if (onSerp && !existingSerp && document.body) document.body.appendChild(buildSerpBlock())
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
