// RETIRÉE (sprint 8, 1er novembre 2026) — cette fonction était déployée
// SANS AUCUNE AUTHENTIFICATION (verify_jwt: false et aucun contrôle dans le
// code) : un POST anonyme portant un expert_id suffisait à obtenir un lien
// d'onboarding Stripe Connect pour le compte de cet expert, donc à y saisir
// ses propres coordonnées bancaires. Inexploitable jusqu'ici (table experts
// vide), elle serait devenue exploitable à la minute où le sprint 8 crée des
// inspecteurs : elle est donc neutralisée AVANT.
//
// Remplacée par `inspecteur-connect`, qui exige le JWT de l'inspecteur et ne
// délivre un lien que pour SON propre compte.
//
// Le corps d'origine reste dans l'historique git (avant ce commit) si le
// parcours expert devait un jour être repris.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(() =>
  new Response(
    JSON.stringify({
      error: "gone",
      message:
        "Fonction retirée. L'onboarding Stripe des inspecteurs passe par inspecteur-connect (authentifié).",
    }),
    { status: 410, headers: { "Content-Type": "application/json" } },
  )
);
