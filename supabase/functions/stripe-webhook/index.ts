// RETIRÉE (sprint 8, 2 novembre 2026).
// Webhook du parcours experts d'avant le pivot : il ne touchait que les
// tables héritées missions et experts, désormais fermées. Les produits
// actuels ont chacun leur endpoint signé (pass-webhook, inspection-webhook).
// ⚠️ Penser à supprimer l'endpoint correspondant dans le dashboard Stripe.
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
