// RETIRÉE (sprint 8, 1er novembre 2026) — cette fonction était déployée
// SANS AUCUNE AUTHENTIFICATION (verify_jwt: false et aucun contrôle dans le
// code) et DÉPLAÇAIT DE L'ARGENT : un POST anonyme portant un mission_id
// déclenchait un virement Stripe réel vers le compte Connect de l'expert.
// Un identifiant de mission suffisait. Inexploitable jusqu'ici (aucune
// mission avec expert et montant), elle est neutralisée avant que le
// sprint 8 n'introduise de vrais virements.
//
// Remplacée par le versement de `inspection-rapport` : déclenché côté
// serveur à la remise du rapport, jamais par un appel client, avec
// transfer_group cohérent avec la charge et source_transaction.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(() =>
  new Response(
    JSON.stringify({
      error: "gone",
      message:
        "Fonction retirée. Le versement à l'inspecteur est déclenché côté serveur à la remise du rapport.",
    }),
    { status: 410, headers: { "Content-Type": "application/json" } },
  )
);
