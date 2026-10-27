// SPRINT 3 — Admin des coûts de réparation (table repair_costs).
// GET   : liste (?statut=source|valide_devis, ?q=recherche) — 200 lignes max.
// PATCH : { id, statut: "valide_devis", devis_image?: dataURL, cout_min_eur?,
//           cout_max_eur? } — passe une ligne en « validé par devis » avec la
//           photo du devis jointe (bucket privé `devis`), et permet d'ajuster
//           la fourchette à partir du devis réel.
// POST  : création manuelle d'une ligne (opération, fourchette, source OU devis).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAILS = ["contact@inspexo.io"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const normaliser = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().slice(0, 200);

function parseDevisImage(raw: unknown): { bytes: Uint8Array; contentType: string; ext: string } | null {
  if (typeof raw !== "string") return null;
  const m = raw.match(/^data:(image\/(jpeg|png|webp)|application\/(pdf));base64,(.+)$/s);
  if (!m) return null;
  const data = m[4].replace(/\s/g, "");
  if (data.length < 100 || data.length > 6_000_000) return null;
  const contentType = m[1];
  const ext = contentType === "application/pdf" ? "pdf" : contentType.split("/")[1];
  try {
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, contentType, ext };
  } catch (_) {
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing token" }, 401);
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);
    if (!ADMIN_EMAILS.includes(user.email ?? "")) return json({ error: "Forbidden" }, 403);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (req.method === "GET") {
      const url = new URL(req.url);
      const statut = url.searchParams.get("statut");
      const q = url.searchParams.get("q");
      let query = admin.from("repair_costs").select("*").order("updated_at", { ascending: false }).limit(200);
      if (statut === "source" || statut === "valide_devis") query = query.eq("statut", statut);
      if (q) query = query.ilike("operation", `%${q.replace(/[%_]/g, "")}%`);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);
      return json({ couts: data });
    }

    if (req.method === "PATCH") {
      const body = await req.json().catch(() => null);
      if (!body?.id) return json({ error: "Missing id" }, 400);
      const { data: row } = await admin.from("repair_costs").select("id").eq("id", body.id).maybeSingle();
      if (!row) return json({ error: "Ligne introuvable" }, 404);

      const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof body.cout_min_eur === "number" && body.cout_min_eur > 0 && body.cout_min_eur < 100000) {
        fields.cout_min_eur = Math.round(body.cout_min_eur);
      }
      if (typeof body.cout_max_eur === "number" && body.cout_max_eur > 0 && body.cout_max_eur < 100000) {
        fields.cout_max_eur = Math.round(body.cout_max_eur);
      }
      if (body.statut === "valide_devis") {
        const devis = parseDevisImage(body.devis_image);
        if (!devis) {
          return json({ error: "La validation par devis exige la photo du devis (JPEG/PNG/WebP/PDF)." }, 400);
        }
        const path = `${body.id}.${devis.ext}`;
        const { error: upErr } = await admin.storage
          .from("devis")
          .upload(path, devis.bytes, { contentType: devis.contentType, upsert: true });
        if (upErr) return json({ error: `upload devis : ${upErr.message}` }, 500);
        fields.statut = "valide_devis";
        fields.devis_path = path;
        fields.valide_par = user.email;
        fields.valide_at = new Date().toISOString();
      }
      const { error } = await admin.from("repair_costs").update(fields).eq("id", body.id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      const operation = typeof body?.operation === "string" ? body.operation.trim().slice(0, 200) : "";
      const min = typeof body?.cout_min_eur === "number" && body.cout_min_eur > 0 ? Math.round(body.cout_min_eur) : null;
      const max = typeof body?.cout_max_eur === "number" && body.cout_max_eur > 0 ? Math.round(body.cout_max_eur) : null;
      const urls = (Array.isArray(body?.url_source) ? body.url_source : [])
        .filter((u: unknown): u is string => typeof u === "string" && /^https?:\/\/\S+$/i.test(u))
        .slice(0, 3);
      const devis = parseDevisImage(body?.devis_image);
      if (!operation || (min == null && max == null)) {
        return json({ error: "operation et au moins un coût requis" }, 400);
      }
      // Aucun montant inventé : une ligne manuelle exige une source publiée OU un devis.
      if (urls.length === 0 && !devis) {
        return json({ error: "Une URL source publiée ou une photo de devis est exigée." }, 400);
      }
      const famille = typeof body?.famille === "string" ? body.famille.trim().slice(0, 60) : null;
      const marque = typeof body?.marque === "string" ? body.marque.trim().slice(0, 60) : null;
      const rowNew: Record<string, unknown> = {
        marque,
        marque_norm: marque ? normaliser(marque) : "",
        famille,
        famille_norm: famille ? famille.toUpperCase().replace(/[^A-Z0-9]/g, "") : "",
        operation,
        operation_norm: normaliser(operation),
        cout_min_eur: min,
        cout_max_eur: max,
        url_source: urls,
        source_date: new Date().toISOString().slice(0, 10),
        statut: devis ? "valide_devis" : "source",
        ...(devis ? { valide_par: user.email, valide_at: new Date().toISOString() } : {}),
      };
      const { data: inserted, error } = await admin
        .from("repair_costs")
        .upsert(rowNew, { onConflict: "marque_norm,famille_norm,operation_norm" })
        .select("id")
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (devis && inserted?.id) {
        const path = `${inserted.id}.${devis.ext}`;
        const { error: upErr } = await admin.storage
          .from("devis")
          .upload(path, devis.bytes, { contentType: devis.contentType, upsert: true });
        if (!upErr) await admin.from("repair_costs").update({ devis_path: path }).eq("id", inserted.id);
      }
      return json({ ok: true, id: inserted?.id ?? null });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error("admin-repair-costs error:", err);
    return json({ error: "internal" }, 500);
  }
});
