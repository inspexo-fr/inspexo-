// SPRINT 11 — Administration des clés d'API.
//   GET  → clients, usage du mois, plafond journalier global consommé.
//   POST { action: "creer" | "revoquer" | "quota" }
//
// La clé en clair n'existe QU'UNE FOIS, dans la réponse à « creer ». Elle
// n'est ni stockée, ni journalisée, ni renvoyée ensuite : si elle est perdue,
// il faut en créer une autre. C'est la seule façon qu'un vol de la base ne
// donne aucune clé utilisable.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifierAdmin } from "../_shared/adminAuth.ts";
import {
  apercuCle,
  genererCle,
  hacherCle,
  PLAFOND_JOUR_API,
  QUOTA_MENSUEL_DEFAUT,
} from "../_shared/apiClients.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const API_KEY_SALT = Deno.env.get("API_KEY_SALT") ?? null;
const moisCourant = () => new Date().toISOString().slice(0, 7);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const acces = await verifierAdmin(req);
  if (!acces.ok) return json({ error: acces.error }, acces.status);
  if (!API_KEY_SALT) return json({ error: "API_KEY_SALT manquant" }, 503);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (req.method === "GET") {
      const { data: clients, error } = await admin
        .from("api_clients")
        .select("id, nom, cle_apercu, quota_mensuel, actif, created_at, revoque_le, contact")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: usage } = await admin
        .from("api_usage")
        .select("client_id, mois, appels, dernier_appel")
        .order("mois", { ascending: false })
        .limit(2000);

      const { data: jour } = await admin
        .from("api_quota_jour")
        .select("jour, appels")
        .order("jour", { ascending: false })
        .limit(30);

      return json({
        clients: clients ?? [],
        usage: usage ?? [],
        jours: jour ?? [],
        mois_courant: moisCourant(),
        plafond_jour_global: PLAFOND_JOUR_API,
        quota_defaut: QUOTA_MENSUEL_DEFAUT,
      });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      const action = String(body?.action ?? "");

      if (action === "creer") {
        const nom = String(body?.nom ?? "").trim();
        if (nom.length < 2 || nom.length > 80) return json({ error: "nom_invalide" }, 400);
        const quota = Number.isFinite(Number(body?.quota_mensuel))
          ? Math.max(0, Math.min(100000, Math.round(Number(body.quota_mensuel))))
          : QUOTA_MENSUEL_DEFAUT;
        const contact = body?.contact ? String(body.contact).slice(0, 160) : null;

        const cle = genererCle();
        const { data, error } = await admin.from("api_clients").insert({
          nom,
          cle_hash: await hacherCle(cle, API_KEY_SALT),
          cle_apercu: apercuCle(cle),
          quota_mensuel: quota,
          contact,
        }).select("id, nom, cle_apercu, quota_mensuel").single();
        if (error) throw error;

        await admin.from("events").insert({
          name: "api_cle_creee",
          props_json: { client: nom, par: acces.user.email ?? null },
        });
        // La clé EN CLAIR n'apparaît qu'ici, une seule fois.
        return json({ ok: true, client: data, cle, avertissement:
          "Cette clé ne sera plus jamais affichée. Transmettez-la au client par un canal sûr." });
      }

      if (action === "revoquer") {
        const id = String(body?.id ?? "");
        const { error } = await admin.from("api_clients")
          .update({ actif: false, revoque_le: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
        await admin.from("events").insert({
          name: "api_cle_revoquee",
          props_json: { client_id: id, par: acces.user.email ?? null },
        });
        return json({ ok: true });
      }

      if (action === "quota") {
        const id = String(body?.id ?? "");
        const quota = Math.max(0, Math.min(100000, Math.round(Number(body?.quota_mensuel ?? 0))));
        const { error } = await admin.from("api_clients").update({ quota_mensuel: quota }).eq("id", id);
        if (error) throw error;
        return json({ ok: true, quota_mensuel: quota });
      }

      return json({ error: "action_inconnue" }, 400);
    }

    return json({ error: "method_not_allowed" }, 405);
  } catch (e) {
    console.error("admin-api:", e);
    return json({ error: "server_error" }, 500);
  }
});
