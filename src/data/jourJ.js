// SPRINT 23, LOT 2 — « Le jour J » et « Comment payer ».
//
// UNE SEULE liste de documents, partagée par le kit signature (Pass) et le
// bloc gratuit du dossier : deux copies finiraient par se contredire.
// Chaque règle juridique porte sa source (service-public.gouv.fr ou
// Légifrance) ; un conseil pratique sans base légale est dit comme tel.
//
// Règles de paiement vérifiées le 12/11/2026 :
//   - entre particuliers, AUCUN plafond d'espèces (art. L112-6 CMF, qui
//     exempte les paiements entre particuliers non professionnels), mais un
//     ÉCRIT au-delà de 1 500 € (art. 1359 C. civ. ; décret n° 80-533, art. 1) ;
//   - à un professionnel, plafond de 1 000 € en espèces pour un acheteur
//     domicilié fiscalement en France (art. L112-6 et D112-3 CMF).
//   service-public F10999, « Vérifié le 26 juin 2026 ».

export const SOURCES_JOUR_J = {
  vente: { url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F1707', titre: 'Service-public — Vendre ou donner son véhicule (F1707)', court: 'service-public.gouv.fr, F1707' },
  csa: { url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F1360', titre: 'Service-public — Certificat de situation administrative (F1360)', court: 'service-public.gouv.fr, F1360' },
  histovec: { url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/R52957', titre: 'Service-public — Obtenir le certificat de situation administrative sur HistoVec (R52957)', court: 'service-public.gouv.fr, R52957' },
  ct: { url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2878', titre: 'Service-public — Contrôle technique d\'une voiture (F2878)', court: 'service-public.gouv.fr, F2878' },
  cerfa: { url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/R20300', titre: 'Service-public — Certificat de cession, cerfa 15776*02 (R20300)', court: 'service-public.gouv.fr, R20300' },
  immat: { url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F1050', titre: 'Service-public — Immatriculer un véhicule d\'occasion (F1050)', court: 'service-public.gouv.fr, F1050' },
  ants: { url: 'https://immatriculation.ants.gouv.fr', titre: 'ANTS — téléservice immatriculation', court: 'immatriculation.ants.gouv.fr' },
  especes: { url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F10999', titre: 'Service-public — Paiement en espèces (F10999)', court: 'service-public.gouv.fr, F10999' },
  cheque_banque: { url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2403', titre: 'Service-public — Chèque barré, certifié ou de banque (F2403)', court: 'service-public.gouv.fr, F2403' },
  cmf_l112_6: { url: 'https://www.legifrance.gouv.fr/codes/id/LEGISCTA000006169848/', titre: 'Légifrance — Code monétaire et financier, art. L112-6 à L112-8', court: 'Légifrance, art. L112-6 CMF' },
  cmf_d112_3: { url: 'https://www.legifrance.gouv.fr/codes/id/LEGISCTA000019265478/', titre: 'Légifrance — Code monétaire et financier, art. D112-3', court: 'Légifrance, art. D112-3 CMF' },
  civ_1359: { url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032042311', titre: 'Légifrance — Code civil, art. 1359', court: 'Légifrance, art. 1359 C. civ.' },
  decret_80_533: { url: 'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000033202239', titre: 'Légifrance — Décret n° 80-533 du 15 juillet 1980, art. 1', court: 'Légifrance, décret n° 80-533' },
}

/** Documents à exiger le jour de la vente. `source: null` = recommandation
 *  pratique, sans obligation légale, et dite comme telle. */
export function documentsJourJ(plusDe4Ans) {
  return [
    {
      id: 'carte_grise',
      titre: 'Carte grise barrée, datée et signée',
      detail: 'Barrée avec la mention « Vendu le JJ/MM/AAAA à HH h MM » et signée par le (ou les) titulaire(s). Vérifiez que le nom du vendeur est bien celui de la carte grise.',
      source: 'vente',
    },
    {
      id: 'cerfa',
      titre: 'Certificat de cession — cerfa 15776*02, 2 exemplaires',
      detail: 'Rempli et signé par le vendeur ET par vous, en deux exemplaires (un chacun). C\'est le document officiel de la vente, exigé pour la nouvelle carte grise.',
      source: 'cerfa',
    },
    {
      id: 'csa',
      titre: 'Certificat de situation administrative de moins de 15 jours',
      detail: 'Dit « non-gage et non-opposition » : il prouve qu\'aucun gage ni opposition n\'empêche le transfert. Le vendeur l\'obtient gratuitement et immédiatement sur HistoVec.',
      source: 'csa',
    },
    plusDe4Ans
      ? {
        id: 'ct',
        titre: 'PV de contrôle technique de moins de 6 mois',
        detail: 'Obligatoire pour un véhicule de plus de 4 ans (moins de 2 mois s\'il s\'agit d\'une contre-visite).',
        source: 'ct',
      }
      : {
        id: 'ct',
        titre: 'Documents du véhicule (moins de 4 ans : pas de contrôle technique exigé)',
        detail: 'Le contrôle technique n\'est pas requis avant 4 ans — exigez en revanche le carnet et les justificatifs de garantie constructeur.',
        source: 'ct',
      },
    {
      id: 'code_cession',
      titre: 'Code de cession ANTS',
      detail: 'Le vendeur déclare la cession en ligne (sous 15 jours) et vous remet le code de cession : il vous simplifie la demande de carte grise.',
      source: 'vente',
    },
    {
      id: 'factures',
      titre: 'Factures d\'entretien et carnet — recommandé',
      detail: 'Pas une obligation légale, mais c\'est la preuve de l\'entretien annoncé : exigez au minimum les factures des opérations citées dans l\'annonce.',
      source: null,
    },
    {
      id: 'cles',
      titre: 'Double des clés — recommandé',
      detail: 'Pas une obligation légale. Un double manquant se paie chez le concessionnaire : demandez-le, ou faites-en un argument de prix.',
      source: null,
    },
  ]
}

/** Comment payer. `professionnel` : vendeur pro, ou pro déguisé probable
 *  (le plafond de 1 000 € s'applique au paiement d'un professionnel). */
export function reglesPaiement(professionnel) {
  return [
    {
      id: 'moment',
      titre: 'Payez à la remise, jamais avant',
      detail: 'Ni acompte ni « réservation » avant d\'avoir vu la voiture et les documents. Le paiement se fait au moment où l\'on vous remet les clés, la carte grise barrée et le certificat de cession signés.',
      sources: [],
      conseil: true,
    },
    {
      id: 'virement',
      titre: 'Virement instantané, depuis votre banque, sur place',
      detail: 'Fait devant le vendeur au moment de la remise : il voit l\'argent arriver en quelques secondes. Un virement instantané ne s\'annule pas — vérifiez le titulaire du compte avant de valider.',
      sources: [],
      conseil: true,
    },
    {
      id: 'cheque_banque',
      titre: 'Ou chèque de banque, vérifié auprès de la banque émettrice',
      detail: 'Le vendeur appellera votre banque pour s\'assurer que le chèque est authentique : c\'est normal, et le numéro doit être cherché par lui, jamais recopié sur le chèque.',
      sources: ['cheque_banque'],
    },
    professionnel
      ? {
        id: 'especes',
        titre: 'Espèces : 1 000 € au plus face à un professionnel',
        detail: 'Un paiement en espèces à un professionnel est plafonné à 1 000 € pour un acheteur domicilié fiscalement en France. Au-delà, utilisez un virement ou un chèque de banque.',
        sources: ['cmf_l112_6', 'cmf_d112_3', 'especes'],
      }
      : {
        id: 'especes',
        titre: 'Espèces : pas de plafond entre particuliers, mais un écrit au-delà de 1 500 €',
        detail: 'Entre particuliers, la loi ne plafonne pas le paiement en espèces. Au-delà de 1 500 €, la preuve du paiement exige un écrit signé — et transporter une telle somme vous expose. Préférez le virement ou le chèque de banque.',
        sources: ['cmf_l112_6', 'civ_1359', 'decret_80_533', 'especes'],
      },
    {
      id: 'distance',
      titre: 'Jamais de mandat, de coupons ni de transfert d\'argent',
      detail: 'Mandat cash, coupons PCS ou Transcash, Western Union : l\'argent part sans recours possible. Aucun vendeur honnête ne les exige.',
      sources: [],
      conseil: true,
    },
  ]
}
