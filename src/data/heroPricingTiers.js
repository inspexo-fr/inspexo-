/**
 * INSPEXO — Paliers tarifaires Hero (Phase 2.9)
 * Affichés en tableau premium dans l'écran 3 du Hero.
 */

export const heroPricingTiers = [
  {
    id: 'ai',
    n: '01',
    name: 'Analyse IA',
    subtitle: 'Découvrez les défauts connus du modèle',
    duration: '4 min',
    price: '12 €',
  },
  {
    id: 'visio',
    n: '02',
    name: 'Visio Test Drive',
    subtitle: 'Un expert vérifie le véhicule en direct',
    duration: '45 min',
    price: '75 €',
  },
  {
    id: 'physical',
    n: '03',
    name: 'Inspection Physique',
    subtitle: "L'expert se déplace et inspecte sur place",
    duration: '2 h',
    price: '250 €',
  },
  {
    id: 'nego',
    n: '04',
    name: 'Inspection + Rapport Négo',
    subtitle: 'Inspection + rapport chiffré pour négocier',
    duration: '3 h',
    price: '400 €',
  },
]
