// SPRINT 10 — Copie CLIENT des deux règles d'affichage des partenaires.
//
// Pourquoi une copie : la source de vérité est
// `supabase/functions/_shared/partenaires.ts`, hors du périmètre de build de
// CRA (ModuleScopePlugin interdit d'importer en dehors de src/). Même
// dispositif que `src/data/marche.js` et `src/data/charte.js`.
//
// GARDE-FOU : `tests/partenaires.test.mjs` compare les deux implémentations
// et échoue si elles divergent. Ne modifier ce fichier qu'en miroir.
//
// Ces deux règles ne sont pas cosmétiques :
//  - un verdict ROUGE ne doit JAMAIS afficher de partenaire, parce qu'on
//    n'aide pas à acheter une voiture classée rouge ;
//  - la phrase de préalable remet l'inspection à sa place sur un rouge : une
//    vérification, pas une étape vers l'achat.

/** Verdicts pour lesquels un partenaire peut apparaître. */
export const VERDICTS_PARTENAIRES = ['vert', 'orange']

export function partenairesAffichables(verdict) {
  return VERDICTS_PARTENAIRES.includes(String(verdict ?? ''))
}

/** Phrase imposée au-dessus du lien d'inspection quand le verdict est ROUGE. */
export const PREALABLE_ROUGE =
  "Demandez d'abord au vendeur la preuve écrite qui lève le point rouge. " +
  'Si elle tient, l\'inspection vérifie le reste.'

/** Mention légale obligatoire de toute communication sur un crédit
 *  (art. L312-5 du code de la consommation). Affichée EN ÉVIDENCE à côté du
 *  lien, jamais en note de bas de page. */
export const MENTION_CREDIT =
  "Attention ! Un crédit coûte de l'argent et doit être remboursé"

const MENTION_CREDIT_RE =
  /attention\s*!\s*un cr[ée]dit co[uû]te de l['’ʼ´`]argent et doit [eê]tre rembours[ée]\s*\.?/gi

/** Le texte du partenaire SANS la mention : elle est réaffichée seule, pour
 *  qu'elle soit lisible au lieu d'être noyée dans le paragraphe. */
export function texteSansMentionCredit(texte) {
  return String(texte ?? '').replace(MENTION_CREDIT_RE, ' ').replace(/\s{2,}/g, ' ').trim()
}

// ---------------------------------------------------------------------------
// Transparence sur la rémunération : la phrase DÉCOULE de ce qui est déclaré
// en base, partenaire par partenaire. Elle n'est pas figée dans le code, donc
// elle ne peut pas devenir fausse après la signature d'un contrat.
// ---------------------------------------------------------------------------

export const PHRASE_COMMISSION =
  'Inspexo perçoit une commission de ces partenaires si vous souscrivez via ce lien. ' +
  "Elle n'a aucune influence sur le score ni sur le verdict."

export const PHRASE_AUCUNE =
  'Inspexo ne perçoit aucune rémunération de ces partenaires.'

export function phraseRemunerationPartenaire(remuneration) {
  return remuneration === 'commission'
    ? 'Inspexo perçoit une commission de ce partenaire si vous souscrivez via ce lien. ' +
      "Elle n'a aucune influence sur le score ni sur le verdict."
    : 'Inspexo ne perçoit aucune rémunération de ce partenaire.'
}

/** `null` quand les régimes diffèrent : il faut alors l'afficher partenaire
 *  par partenaire, sinon la phrase serait inexacte pour l'un d'eux. */
export function phraseRemunerationGlobale(partenaires) {
  if (!Array.isArray(partenaires) || partenaires.length === 0) return null
  const avecCommission = partenaires.filter(p => p.remuneration === 'commission').length
  if (avecCommission === partenaires.length) return PHRASE_COMMISSION
  if (avecCommission === 0) return PHRASE_AUCUNE
  return null
}
