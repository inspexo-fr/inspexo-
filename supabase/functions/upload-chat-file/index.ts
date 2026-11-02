// RETIRÉE (sprint 8, 2 novembre 2026).
// Dépôt de fichiers du chat IA (modèle d'avant le pivot). Déployée
// verify_jwt:false SANS AUCUNE AUTHENTIFICATION, elle écrivait dans le
// stockage. Plus aucun écran du site ne l'appelle depuis le sprint 5.
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
