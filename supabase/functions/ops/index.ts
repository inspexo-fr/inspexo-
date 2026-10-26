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
  const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
    headers: { "x-api-key": ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
  });
  const data = await res.json().catch(() => null);
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
});
