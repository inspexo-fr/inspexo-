// Vérification Cloudflare Turnstile partagée (score, extraction).
// DORMANTE tant que TURNSTILE_SECRET n'est pas posé (scripts/activer-turnstile.mjs).
const TURNSTILE_SECRET = Deno.env.get("TURNSTILE_SECRET") ?? null;

export async function verifierTurnstile(token: string | null, ip: string): Promise<boolean> {
  if (!TURNSTILE_SECRET) return true; // pas encore activé
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: TURNSTILE_SECRET, response: token, remoteip: ip }),
    });
    const d = await res.json().catch(() => null);
    return d?.success === true;
  } catch (err) {
    console.error("turnstile verify:", err);
    return false;
  }
}
