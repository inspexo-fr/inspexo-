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

/** Analyse d'annonce — { text, images?, comparables? } → { id, result } */
export const analyzeListing = (payload) => callFunction('score', payload)

/** Rappels constructeur + Takata — { marque, modele, annee?, analysis_id? } */
export const fetchRappels = (payload) => callFunction('rappels', payload)

/** Lecture publique d'une analyse par id (RPC, pas de listing possible). */
export async function getPublicAnalysis(id) {
  const { data, error } = await supabase.rpc('get_public_analysis', { p_id: id })
  if (error) throw error
  return data // null si introuvable
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
