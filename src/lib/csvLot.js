// SPRINT 24 lot 3 — export CSV du tri de lot, composé sur l'appareil.
// ⚠️ Une cellule qui commence par = + - @ serait exécutée comme une formule
// par un tableur (injection CSV) : on la préfixe d'une apostrophe.
const cellule = (x) => {
  let t = x == null ? '' : String(x)
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`
  return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

export function csvLot(lignes) {
  const tete = ['Rang', 'Véhicule', 'Prix demandé (€)', 'Prix de revente réaliste (€)', 'Facture à prévoir (€)', 'Risque de retour 12 mois (€)', 'Marge nette estimée (€)', 'Prix d’achat plafond (€)', 'Remarque']
  const corps = lignes.map((l, i) => [i + 1, l.libelle, l.prix_demande, l.revente, l.facture_max, l.risque_max, l.marge_nette, l.plafond, l.motif].map(cellule).join(';'))
  return '﻿' + [tete.map(cellule).join(';'), ...corps].join('\r\n')
}
