import { supabase } from './supabaseClient'

// SPRINT 8 — Appels de l'inspection à la demande.
// Toutes les décisions (zone ouverte, Pass, validation d'un inspecteur,
// versement) sont prises CÔTÉ SERVEUR : ce fichier ne fait que transporter.

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

async function jeton() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || anonKey
  } catch (_) {
    return anonKey
  }
}

async function appel(nom, { methode = 'POST', corps = null, requete = '' } = {}) {
  const token = await jeton()
  let res
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/${nom}${requete}`, {
      method: methode,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
      ...(corps ? { body: JSON.stringify(corps) } : {}),
    })
  } catch (_) {
    const err = new Error('Connexion impossible. Vérifiez votre réseau.')
    err.code = 'network'
    throw err
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(data?.message || `Erreur ${res.status}.`)
    err.code = data?.error || String(res.status)
    err.status = res.status
    throw err
  }
  return data
}

/* ---------- Côté acheteur ---------- */

/** Configuration publique de l'inspection ; avec un code postal, la
 *  disponibilité réelle du secteur. */
export const getInspectionConfig = (codePostal = null) =>
  appel('inspection-checkout', { methode: 'GET', requete: codePostal ? `?cp=${encodeURIComponent(codePostal)}` : '' })

/** Disponibilité d'une zone (RPC publique, sans révéler les inspecteurs). */
export async function inspectionZone(codePostal) {
  const { data, error } = await supabase.rpc('inspection_zone', { p_code_postal: codePostal })
  if (error) throw error
  return data
}

/** Commande : rend { url } vers la page de paiement Stripe. */
export const commanderInspection = (payload) =>
  appel('inspection-checkout', { corps: payload })

/** Les inspections de l'acheteur connecté. */
export async function mesInspections() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return []
  const { data, error } = await supabase.rpc('mes_inspections')
  if (error) throw error
  return Array.isArray(data) ? data : []
}

/** Photos d'un rapport (chemins ; l'URL signée vient de la fonction). */
export async function photosRapport(inspectionId) {
  const { data, error } = await supabase.rpc('inspection_photos_liste', { p_inspection_id: inspectionId })
  if (error) throw error
  return Array.isArray(data) ? data : []
}

/** URL signée d'une photo de rapport (lecture réservée aux parties). */
export async function urlPhotoRapport(chemin) {
  const { data, error } = await supabase.storage.from('rapports').createSignedUrl(chemin, 300)
  if (error) throw error
  return data?.signedUrl ?? null
}

/* ---------- Côté inspecteur ---------- */

export async function monProfilInspecteur() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data, error } = await supabase.rpc('mon_profil_inspecteur')
  if (error) throw error
  return data
}

export async function candidaterInspecteur(p) {
  const { error } = await supabase.rpc('inspecteur_candidater', {
    p_nom: p.nom,
    p_telephone: p.telephone,
    p_siret: p.siret,
    p_raison_sociale: p.raisonSociale || null,
    p_rc_assureur: p.rcAssureur || null,
    p_rc_numero: p.rcNumero || null,
    p_rc_echeance: p.rcEcheance || null,
    p_departements: p.departements,
  })
  if (error) throw error
}

export async function signerCharte(version) {
  const { error } = await supabase.rpc('inspecteur_signer_charte', { p_version: version })
  if (error) throw error
}

export const deposerAttestation = (document) => appel('inspecteur-dossier', { corps: { document } })

/** Lien d'onboarding Stripe Connect (compte de l'appelant uniquement). */
export const lienConnect = () => appel('inspecteur-connect', { corps: {} })
export const etatConnect = () => appel('inspecteur-connect', { corps: { action: 'etat' } })

export async function inspecteurMissions() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return []
  const { data, error } = await supabase.rpc('inspecteur_missions')
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export const accepterMission = (inspectionId, creneau = null) =>
  appel('inspecteur-mission', { corps: { action: 'accepter', inspection_id: inspectionId, creneau } })

export const refuserMission = (inspectionId, motif = null) =>
  appel('inspecteur-mission', { corps: { action: 'refuser', inspection_id: inspectionId, motif } })

export const consentirPhotos = (inspectionId) =>
  appel('inspecteur-mission', { corps: { action: 'consentement_photos', inspection_id: inspectionId } })

export const rendreRapport = (payload) => appel('inspection-rapport', { corps: payload })
