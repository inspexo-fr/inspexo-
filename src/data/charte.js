// SPRINT 8 — Charte d'indépendance et règles d'inspection, côté client.
//
// COPIE EXACTE de supabase/functions/_shared/inspection.ts (une page React ne
// peut pas importer un module Deno). L'inspecteur signe le texte qu'il voit :
// si les deux copies divergeaient, la signature enregistrée ne correspondrait
// plus à ce qui a été affiché. tests/inspection.test.mjs compare les deux
// fichiers phrase par phrase et fait échouer l'éval en cas d'écart.

export const CHARTE_VERSION = '2026-11-01'

export const CHARTE_INDEPENDANCE = [
  "Je suis payé par l'acheteur, jamais par le vendeur. Je n'accepte, pendant ou après une inspection Inspexo, aucune somme, remise, commission, cadeau ni avantage de la part du vendeur du véhicule, de son mandataire, d'un garage ou d'un intermédiaire concerné par la vente.",
  "Je n'ai aucun intérêt dans la vente. Je n'inspecte pas un véhicule vendu par moi-même, par un proche, par mon employeur, ni par une entreprise dans laquelle j'ai un intérêt. Si je découvre un tel lien, je refuse la mission ou je la signale immédiatement.",
  "Je ne propose jamais de réparer ce que je constate. Je n'oriente pas l'acheteur vers mon propre atelier ni vers un garage avec lequel j'ai un accord commercial.",
  "Je rapporte ce que j'ai vu, pas ce qui arrange. Je ne tais aucun défaut constaté et je n'en invente aucun. Ce que je n'ai pas pu vérifier, je l'écris comme non vérifié.",
  "Je respecte le véhicule et les personnes. Je me présente, j'explique ma démarche au vendeur, je ne photographie ni plaque d'immatriculation, ni document d'identité, ni personne.",
  "Je suis indépendant et assuré. J'exerce sous mon propre numéro SIRET et je maintiens une assurance responsabilité civile professionnelle en cours de validité pendant toute ma collaboration.",
  "Je sais qu'un manquement met fin à la collaboration. Inspexo peut suspendre mon compte immédiatement, et la rémunération d'une mission entachée d'un manquement n'est pas due.",
]

export const CONSENTEMENT_PHOTOS = [
  'Les photos que vous prenez pendant cette inspection sont CONSERVÉES : elles constituent le rapport remis à l\'acheteur. C\'est la seule situation où Inspexo garde des photos.',
  'Prévenez le vendeur que vous photographiez le véhicule pour le compte de l\'acheteur.',
  'Ne photographiez jamais : la plaque d\'immatriculation, un document d\'identité, la carte grise en entier, une personne, l\'intérieur du domicile.',
]

export const ZONE_LIBELLE = 'Toulouse et Haute-Garonne'
export const PRIX_INSPECTION_CENTS = 17900
export const PART_INSPECTEUR_CENTS = 10740

/** Validation du SIRET côté client (confort de saisie) — le serveur refait
 *  le contrôle, c'est lui qui fait foi. Même règle, exception La Poste incluse. */
export function siretValide(brut) {
  const s = String(brut ?? '').replace(/[\s.-]/g, '')
  if (!/^[0-9]{14}$/.test(s)) return false
  if (s.startsWith('356000000')) {
    return s.split('').reduce((t, c) => t + Number(c), 0) % 5 === 0
  }
  let somme = 0
  for (let i = 0; i < s.length; i++) {
    const depuisDroite = s.length - 1 - i
    let v = Number(s[i])
    if (depuisDroite % 2 === 1) { v *= 2; if (v > 9) v -= 9 }
    somme += v
  }
  return somme % 10 === 0
}
