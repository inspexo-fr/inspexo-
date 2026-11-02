// RETIRÉE (sprint 8, 2 novembre 2026).
// Administration des missions du parcours experts d'avant le pivot (onglet
// retiré du tableau de bord). La table missions est conservée en base, vide,
// sans aucun accès direct.
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
