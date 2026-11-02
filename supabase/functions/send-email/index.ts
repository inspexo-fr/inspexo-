// RETIRÉE (sprint 8, 2 novembre 2026).
// ⚠️ C'ÉTAIT UN RELAIS DE MAIL OUVERT : la fonction acceptait
// { to, template, data } et expédiait via Resend SANS AUCUNE
// AUTHENTIFICATION. verify_jwt valait true, mais l'anon key est publiée dans
// le bundle JavaScript du site : n'importe qui pouvait donc envoyer des
// emails depuis contact@inspexo.io vers n'importe quelle adresse, en brûlant
// la réputation d'expédition du domaine (spam, hameçonnage).
//
// Les emails du produit actuel ne passent pas par ici : ils partent du
// serveur via _shared/notify.ts, jamais d'un appel client.
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
