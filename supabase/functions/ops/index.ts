// Fonction d'exploitation interne (diagnostic). Accès réservé au secret d'éval.
// Opérations en lecture seule : liste des modèles disponibles sur la clé.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
    headers: { "x-api-key": ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
  });
  const data = await res.json().catch(() => null);
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
});
