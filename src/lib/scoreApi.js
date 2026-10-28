import { supabase } from './supabaseClient'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const anonKey     = process.env.REACT_APP_SUPABASE_ANON_KEY

async function callFunction(name, body) {
  let res
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${anonKey}`,
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

/** Mode enregistrement d'écran — lit le texte de l'annonce sur les captures
 *  extraites de la vidéo (côté navigateur) et repère les photos du véhicule.
 *  → { est_annonce_vehicule, texte, images_vehicule: [n° 1-based] } */
export const extraireTexteCaptures = (images, captchaToken = null) =>
  callFunction('extraction', { images, ...(captchaToken ? { captcha_token: captchaToken } : {}) })

/** Rappels constructeur + Takata — { marque, modele, annee?, analysis_id? } */
export const fetchRappels = (payload) => callFunction('rappels', payload)

/** Lecture publique d'une analyse par id (RPC, pas de listing possible). */
export async function getPublicAnalysis(id) {
  const { data, error } = await supabase.rpc('get_public_analysis', { p_id: id })
  if (error) throw error
  return data // null si introuvable
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
