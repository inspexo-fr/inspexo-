// RETIRÉE (sprint 8, 2 novembre 2026).
// Paiement des trois anciens paliers (IA 9,90 € / Visio 59 € / Inspection
// 249 €), remplacés par le Pass achat (pass-checkout) et l'inspection à la
// demande (inspection-checkout). Son seul appelant était CheckoutModal,
// supprimé avec l'ancien parcours.
//
// Le corps d'origine reste dans l'historique git (avant ce commit) si ce
// parcours devait un jour être repris.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(() =>
  new Response(
    JSON.stringify({ error: "gone", message: "Fonction retirée." }),
    { status: 410, headers: { "Content-Type": "application/json" } },
  )
);
