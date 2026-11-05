// Fonction d'exploitation interne (diagnostic). Accès réservé au secret d'éval.
// Opérations en lecture seule : liste des modèles disponibles sur la clé.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const EVAL_BYPASS_SECRET = Deno.env.get("EVAL_BYPASS_SECRET") ?? null;

async function secretOk(req: Request): Promise<boolean> {
  if (!EVAL_BYPASS_SECRET) return false;
  const given = req.headers.get("x-eval-secret");
  if (!given) return false;
  const digest = async (v: string) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)));
  const [a, b] = await Promise.all([digest(given), digest(EVAL_BYPASS_SECRET)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

serve(async (req: Request) => {
  if (!(await secretOk(req))) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }
  // ?stripe=1 : régime de la clé Stripe posée (test ou live), rien d'autre.
  // Lecture seule — garde-fou du script tester-pass-stripe.mjs, qui REFUSE
  // de payer si la clé n'est pas une clé de test.
  if (new URL(req.url).searchParams.get("stripe") === "1") {
    const sk = Deno.env.get("STRIPE_SECRET_KEY");
    if (!sk) {
      return new Response(JSON.stringify({ stripe: null }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    const bal = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${sk}` },
    });
    const data = await bal.json().catch(() => null);
    return new Response(
      JSON.stringify({ stripe: bal.ok ? { livemode: data?.livemode === true } : { erreur: bal.status } }),
      { headers: { "Content-Type": "application/json" } },
    );
  }
  // ?webhooks=1 : les endpoints de webhook déclarés sur la clé Stripe posée.
  // LECTURE SEULE, et rien de sensible n'en sort : Stripe ne rend le secret de
  // signature QU'À LA CRÉATION d'un endpoint, jamais au listage.
  //
  // ⚠️ Pourquoi ce point existe. Le 5 nov. 2026, l'audit a trouvé que
  // PASS_WEBHOOK_SECRET et INSPECTION_WEBHOOK_SECRET étaient absents alors que
  // la clé posée est une clé LIVE. Avant d'en créer, il faut savoir si des
  // endpoints existent déjà : en recréer par-dessus doublerait les livraisons,
  // et un endpoint existant ne redonnera JAMAIS son secret — il faudrait le
  // supprimer puis le recréer. Cette question ne peut pas se poser depuis le
  // poste : la clé ne vit que dans les secrets de la fonction.
  if (new URL(req.url).searchParams.get("webhooks") === "1") {
    const sk = Deno.env.get("STRIPE_SECRET_KEY");
    if (!sk) {
      return new Response(JSON.stringify({ webhooks: null, motif: "STRIPE_SECRET_KEY absente" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    const res = await fetch("https://api.stripe.com/v1/webhook_endpoints?limit=100", {
      headers: { Authorization: `Bearer ${sk}` },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return new Response(JSON.stringify({ webhooks: { erreur: res.status } }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    // deno-lint-ignore no-explicit-any
    const liste = (data?.data ?? []).map((e: any) => ({
      id: e.id,
      url: e.url,
      status: e.status,
      livemode: e.livemode === true,
      enabled_events: e.enabled_events,
      description: e.description ?? null,
      // ⚠️ `e.secret` n'est volontairement PAS repris : il n'est de toute façon
      // présent qu'à la création, et un diagnostic n'a pas à le véhiculer.
    }));
    return new Response(JSON.stringify({ webhooks: liste }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ?compte=<rpc> : COMBIEN de lignes une RPC d'exploitation rend-elle.
  // Lecture seule, liste fermée, et seul le NOMBRE sort — jamais les lignes.
  //
  // ⚠️ Pourquoi ce point existe : le filtre ` = 'fini'` d'`analyses_a_verifier`
  // ne rendait jamais rien, et rien ne le signalait — un écran vide ressemble
  // exactement à « il n'y a rien à faire ». Pouvoir compter les lignes d'une
  // RPC depuis le harnais, sans jeton admin, c'est ce qui permet de constater
  // qu'un filtre mord encore.
  {
    const compte = new URL(req.url).searchParams.get('compte');
    const ADMISES: Record<string, string> = {
      a_verifier: 'analyses_a_verifier',
      sans_apercu: 'analyses_sans_apercu',
    };
    if (compte) {
      const rpc = ADMISES[compte];
      if (!rpc) {
        return new Response(JSON.stringify({ error: 'rpc_inconnue', admises: Object.keys(ADMISES) }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const { data, error } = await admin.rpc(rpc, { p_limite: 100 });
      return new Response(
        JSON.stringify(error ? { rpc, erreur: error.message } : { rpc, lignes: (data ?? []).length }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
    headers: { "x-api-key": ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
  });
  const data = await res.json().catch(() => null);
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
});
