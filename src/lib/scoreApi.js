import { supabase } from './supabaseClient'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const anonKey     = process.env.REACT_APP_SUPABASE_ANON_KEY

/** Jeton d'appel des fonctions : celui de la session quand l'utilisateur est
 *  connecté (le serveur y lit le Pass achat et le dossier), l'anon key sinon.
 *  Le déblocage reste décidé CÔTÉ SERVEUR — le jeton ne fait qu'identifier. */
async function tokenAppel() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || anonKey
  } catch (_) {
    return anonKey
  }
}

async function callFunction(name, body) {
  const token = await tokenAppel()
  let res
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey':        anonKey,
      },
      body: JSON.stringify(body),
    })
  } catch (networkErr) {
    const err = new Error('Connexion impossible. Vérifiez votre réseau et réessayez.')
    err.code = 'network'
    throw err
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(data?.message || `Erreur ${res.status}. Réessayez.`)
    err.code   = data?.error || String(res.status)
    err.status = res.status
    throw err
  }
  return data
}

/** Analyse d'annonce — { text, images?, comparables? } → { id, result }.
 *  Avec { progressive: true } : réponse dès l'identification ({ partial: true }),
 *  la suite arrive sur /a/:id par polling (getAnalysisEtape). */
export const analyzeListing = (payload) => callFunction('score', payload)

/** Étape courante d'une analyse progressive — { etape, pret } (null si inconnue). */
export async function getAnalysisEtape(id) {
  const { data, error } = await supabase.rpc('get_analysis_etape', { p_id: id })
  if (error) throw error
  return data
}

/** Mode visite — photo(s) à analyser. Le mode est ÉPHÉMÈRE par défaut (le
 *  verdict recalculé vit dans la session, rien n'est écrit dans l'analyse
 *  publique) : le client renvoie donc ses constats précédents à chaque appel.
 *  → { result, constats_nouveaux, persiste } */
export const visitePhoto = (analysisId, images, constatsPrecedents = []) =>
  callFunction('visite', { analysis_id: analysisId, images, constats_precedents: constatsPrecedents })

/** Mode visite — fin de visite : réponses données + points restés non vérifiés
 *  (la synthèse signale une visite incomplète sous 70 % de couverture). */
export const visiteTerminer = (analysisId, reponses, nonVerifies = [], constatsPrecedents = []) =>
  callFunction('visite', {
    analysis_id: analysisId, terminer: true, reponses,
    non_verifies: nonVerifies, constats_precedents: constatsPrecedents,
  })

/* ---------- Dossier d'achat (compte léger, lien magique) ---------- */

// Origine FIXE des redirections de lien magique (sprint 3.1) : jamais dérivée
// de window.location.origin — l'allow-list Supabase reste stricte, sans
// wildcard de preview.
const ORIGINE_LIENS = 'https://www.inspexo.io'

/** Envoie le lien magique de connexion (compte créé au premier clic).
 *  captchaToken : jeton Turnstile, exigé par GoTrue quand le captcha est actif. */
export async function envoyerLienMagique(email, redirectPath = '/dossier', captchaToken = null) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${ORIGINE_LIENS}${redirectPath}`,
      ...(captchaToken ? { captchaToken } : {}),
    },
  })
  if (error) throw error
}

export async function dossierAdd(analysisId) {
  const { error } = await supabase.rpc('dossier_add', { p_analysis_id: analysisId })
  if (error) throw error
}

export async function dossierList() {
  const { data, error } = await supabase.rpc('dossier_list')
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export async function dossierSetStatut(analysisId, statut) {
  const { error } = await supabase.rpc('dossier_set_statut', { p_analysis_id: analysisId, p_statut: statut })
  if (error) throw error
}

export async function dossierSetAlertes(analysisId, actives) {
  const { error } = await supabase.rpc('dossier_set_alertes', { p_analysis_id: analysisId, p_actives: actives })
  if (error) throw error
}

export async function dossierRemove(analysisId) {
  const { error } = await supabase.rpc('dossier_remove', { p_analysis_id: analysisId })
  if (error) throw error
}

/** Retour d'issue J+30 : prix payé, pannes confirmées, commentaire. */
export async function submitOutcome(analysisId, { prixPaye = null, pannesConfirmees = null, commentaire = null } = {}) {
  const { error } = await supabase.rpc('submit_outcome', {
    p_analysis_id: analysisId,
    p_prix_paye: prixPaye,
    p_pannes_confirmees: pannesConfirmees,
    p_commentaire: commentaire,
  })
  if (error) throw error
}

/** Statistiques publiques de justesse (/fiabilite) — rien avant 50 analyses. */
export async function getFiabilite() {
  const { data, error } = await supabase.rpc('get_fiabilite')
  if (error) throw error
  return data
}

/** Dépôt d'une demande en attente quand le service IA est indisponible. */
export async function submitPendingAnalysis(email, text, usage) {
  const { data, error } = await supabase.rpc('submit_pending_analysis', {
    p_email: email,
    p_text: text,
    p_usage: usage ?? null,
  })
  if (error) throw error
  return data // id de la demande
}

/** Rappels constructeur + Takata — { marque, modele, annee?, analysis_id? } */
export const fetchRappels = (payload) => callFunction('rappels', payload)

/** Lecture publique d'une analyse par id (RPC, pas de listing possible). */
export async function getPublicAnalysis(id, track = true) {
  // track=false : lectures internes (aperçu de l'accueil) — n'incrémente ni
  // share_views ni l'event result_viewed.
  const { data, error } = await supabase.rpc('get_public_analysis', { p_id: id, p_track: track })
  if (error) throw error
  return data // null si introuvable
}

/** Fiche complète d'une famille moteur pour sa page publique /moteur/<slug>. */
export async function getMoteurPublic(marque, famille) {
  const { data, error } = await supabase.rpc('get_moteur_public', { p_marque: marque, p_famille: famille })
  if (error) throw error
  return data
}

/** Histogrammes de prix pour une liste de couples { marque, modele }.
 *  La RPC ne rend l'histogramme qu'au-delà du seuil de publication ; les
 *  quantiles sont calculés côté client par `src/data/marche.js`, pour qu'il
 *  n'existe qu'UNE implémentation des quantiles dans le projet. */
export async function getPrixSegments(segments) {
  const { data, error } = await supabase.rpc('get_prix_segments', { p_segments: segments })
  if (error) throw error
  return Array.isArray(data) ? data : []
}

/** Événements de parcours (sprint 11) : reliés à l'analyse, SANS aucun
 *  identifiant navigateur — ni cookie, ni empreinte d'IP. Un échec est
 *  silencieux : une mesure ne doit jamais gêner l'utilisateur. */
const marquerEtape = (nom, analysisId) =>
  supabase.rpc('track_event', { p_name: nom, p_analysis_id: analysisId ?? null })
    .then(() => {}, () => {})

export const marquerClicPass = (analysisId) => marquerEtape('pass_clicked', analysisId)
export const marquerClicInspection = (analysisId) => marquerEtape('inspection_clicked', analysisId)

/** Demande de contact professionnel (page /pro). */
export async function submitLeadPro({ email, societe, volume, message }) {
  const { error } = await supabase.rpc('submit_lead_pro', {
    p_email: email, p_societe: societe ?? null,
    p_volume: volume ?? null, p_message: message ?? null,
  })
  if (error) throw error
}

/** Partenaires ACTIFS (assurance / crédit). La liste est vide tant qu'aucun
 *  partenaire n'a été activé en base : rien n'est codé en dur côté client, et
 *  l'URL du partenaire n'est jamais transmise au navigateur — le lien passe
 *  obligatoirement par /go/<slug>, sinon la mise en relation ne serait pas
 *  comptée. */
export async function getPartenairesActifs() {
  const { data, error } = await supabase.rpc('get_partenaires_actifs')
  if (error) throw error
  return Array.isArray(data) ? data : []
}

/** Demande d'inspection hors zone : email + code postal (carte de la demande,
 *  qui dit où recruter des inspecteurs). */
export async function submitDemandeZone(email, codePostal, analysisId = null) {
  const { error } = await supabase.rpc('submit_demande_zone', {
    p_email: email, p_code_postal: codePostal, p_analysis_id: analysisId,
  })
  if (error) throw error
}

/** Retour d'issue par lien signé — aucune session, le jeton fait foi. */
async function appelRetour(payload) {
  const { data, error } = await supabase.functions.invoke('retour', { body: payload })
  if (error) {
    // Les erreurs métier arrivent avec un statut non-2xx : on relaie le code.
    let detail = null
    try { detail = await error.context?.json?.() } catch (_) { /* corps illisible */ }
    throw new Error(detail?.error || error.message || 'retour_indisponible')
  }
  return data
}

export const retourVerifier = (analysisId, token) =>
  appelRetour({ action: 'verifier', analysis_id: analysisId, token })

export const retourRepondre = (analysisId, token, reponse) =>
  appelRetour({ action: 'repondre', analysis_id: analysisId, token, ...reponse })

/** Familles dont la fiche atteint le seuil de publication (sitemap, liens). */
export async function listMoteursPublies() {
  const { data, error } = await supabase.rpc('list_moteurs_publies')
  if (error) throw error
  return Array.isArray(data) ? data : []
}

/** Fiche famille moteur publiée (pannes sourcées) — null si pas encore prête. */
export async function getDefectSheet(marque, famille) {
  const { data, error } = await supabase.rpc('get_defect_sheet', {
    p_marque: marque,
    p_famille: famille,
  })
  if (error) throw error
  return data
}

/* ---------- Pass achat (sprint 7) ---------- */

/** Configuration publique du Pass — { actif, mode, prix_cents, mediateur }. */
export async function getPassConfig() {
  const res = await fetch(`${supabaseUrl}/functions/v1/pass-checkout`, {
    headers: { 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
  })
  if (!res.ok) throw new Error(`Erreur ${res.status}`)
  return res.json()
}

/** Crée la session Stripe Checkout → { url }. CGV acceptées obligatoires. */
export const creerPassCheckout = (email, { renonceRetractation = false, analysisId = null } = {}) =>
  callFunction('pass-checkout', {
    email,
    accepte_cgv: true,
    renonce_retractation: renonceRetractation,
    analysis_id: analysisId,
  })

/** Y a-t-il une session ? Les RPC du Pass sont réservées à `authenticated` :
 *  les appeler sans session renvoie 401 — une erreur réseau inutile sur
 *  CHAQUE page de résultat vue par un visiteur anonyme. On s'abstient. */
async function estConnecte() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return !!session?.access_token
  } catch (_) {
    return false
  }
}

/** Pass actif de l'utilisateur connecté — { mode, debut, fin } ou null.
 *  Rattache au passage les Pass achetés avec cet email avant le 1er login. */
export async function getMonPass() {
  if (!(await estConnecte())) return null
  const { data, error } = await supabase.rpc('get_mon_pass')
  if (error) throw error
  return data
}

/** Pré-remplissage du kit signature (Pass requis, vérifié serveur).
 *  Sans session : même forme que la réponse serveur « pas de Pass », sans
 *  aller chercher un 401. Le déblocage reste décidé par la RPC. */
export async function getKitSignature(analysisId) {
  if (!(await estConnecte())) return { pass: false }
  const { data, error } = await supabase.rpc('get_kit_signature', { p_analysis_id: analysisId })
  if (error) throw error
  return data
}

/** Lecture du PV de contrôle technique (Pass requis, vérifié serveur).
 *  Photos envoyées au modèle puis oubliées — jamais stockées. */
/* ---------- Certificat de situation administrative HistoVec (sprint 13) ---------- */

/** Dépose le PDF du CSA. Le fichier n'est JAMAIS stocké : le serveur en extrait
 *  le texte en mémoire, en tire les faits par des règles fixes, et l'oublie.
 *  Un signal ROUGE revient même sans Pass. */
export const lectureHistovec = (analysisId, pdfBase64) =>
  callFunction('lecture-histovec', { analysis_id: analysisId, pdf_base64: pdfBase64 })

/** Corrige un relevé kilométrique mal lu sur le PV et relance le calcul.
 *  Aucun nouvel appel au modèle : on rejoue le barème sur la série corrigée. */
export const corrigerKmCt = (analysisId, corrections) =>
  callFunction('lecture-ct', { analysis_id: analysisId, action: 'corriger_km', corrections })

export const lectureCt = (analysisId, images, constatsPrecedents = []) =>
  callFunction('lecture-ct', {
    analysis_id: analysisId, images, constats_precedents: constatsPrecedents,
  })

/** Lead email — source ∈ pass_waitlist | expert_waitlist | rapport */
export async function submitLead(email, source, analysisId = null) {
  const { error } = await supabase.rpc('submit_lead', {
    p_email: email,
    p_source: source,
    p_analysis_id: analysisId,
  })
  if (error) throw error
}

/** Event de mesure côté client (whitelist serveur). Jamais bloquant. */
export async function trackEvent(name, analysisId = null, props = null) {
  try {
    await supabase.rpc('track_event', {
      p_name: name,
      p_analysis_id: analysisId,
      p_props: props,
    })
  } catch (_) { /* la mesure ne doit jamais casser l'UX */ }
}
