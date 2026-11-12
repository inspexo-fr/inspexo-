// SPRINT 23, LOT 3 (point 3) — LA prochaine action du premier écran.
//
// Une seule, déterministe, toujours faisable tout de suite et gratuitement :
// elle renvoie à un bloc du dossier, jamais à un partenaire (règle du
// sprint 10 : rien ne pousse à acheter une voiture classée rouge).
// Ordre de priorité : la sécurité de l'argent d'abord, puis le verdict.
// Module PUR (tests/prochaine-action.test.mjs).

export function prochaineAction(r) {
  if (!r || r.type !== 'vehicule' || r.statut_analyse === 'en_cours') return null
  const signaux = Array.isArray(r.securite_transaction?.signaux_arnaque) ? r.securite_transaction.signaux_arnaque.length : 0
  if (signaux > 0) {
    return {
      texte: `Ne versez rien avant d'avoir vu la voiture et ses documents : l'annonce présente ${signaux === 1 ? 'un signal' : `${signaux} signaux`} d'arnaque.`,
      ancre: '#transaction',
      lien: signaux === 1 ? 'Voir le signal' : 'Voir les signaux',
    }
  }
  const message = Boolean(r.message_vendeur)
  const checklist = Array.isArray(r.checklist_sur_place) && r.checklist_sur_place.length > 0
  if (r.verdict === 'rouge') {
    return message
      ? { texte: 'Ne vous engagez pas en l\'état : posez d\'abord au vendeur les questions du message préparé.', ancre: '#message', lien: 'Lire le message' }
      : { texte: 'Ne vous engagez pas en l\'état : les motifs ci-dessus sont à éclaircir avec le vendeur.', ancre: '#motifs', lien: 'Revoir les motifs' }
  }
  if (r.verdict === 'orange' && message) {
    return { texte: 'Envoyez au vendeur le message préparé avant de vous déplacer.', ancre: '#message', lien: 'Copier le message' }
  }
  if (checklist) {
    return { texte: 'Préparez la visite : la liste de contrôle sur place tient en une page.', ancre: '#checklist', lien: 'Voir la liste' }
  }
  if (message) return { texte: 'Envoyez au vendeur le message préparé.', ancre: '#message', lien: 'Copier le message' }
  return null
}
