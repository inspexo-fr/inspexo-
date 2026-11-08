// SPRINT 1.5 — Admin des fiches famille moteur.
// GET    : liste des fiches (?statut=generee|validee)
// PATCH  : { id, statut: "validee" } — relecture humaine (passe la fiche en
//          « base Inspexo ») ; accepte aussi { id, pannes } pour corriger la
//          liste avant validation.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sourcesPortentLEntree } from "../_shared/atlasSource.ts";
import { sanitizePannes } from "../_shared/defectSheets.ts";
import { fusionnerPlan } from "../_shared/planEntretien.ts";
import { verifierAdmin } from "../_shared/adminAuth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // Rôle admin vérifié en base (table admins) — sprint 3.1.
    const acces = await verifierAdmin(req);
    if (!acces.ok) {
      return new Response(JSON.stringify({ error: acces.error }), { status: acces.status, headers: cors });
    }
    const user = acces.user;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (req.method === "GET") {
      const url = new URL(req.url);
      const statut = url.searchParams.get("statut");
      let query = admin.from("defect_sheets").select("*").order("created_at", { ascending: false }).limit(100);
      if (statut === "generee" || statut === "validee") query = query.eq("statut", statut);
      const { data, error } = await query;
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
      return new Response(JSON.stringify({ sheets: data }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (req.method === "PATCH") {
      const body = await req.json().catch(() => null);
      if (!body?.id) {
        return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers: cors });
      }
      const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.statut === "validee") {
        fields.statut = "validee";
        fields.validee_par = user.email;
        fields.validee_at = new Date().toISOString();
      }
      if (Array.isArray(body.pannes)) {
        // Règle d'or maintenue à la correction manuelle : URL obligatoire,
        // familles étrangères rejetées, champs typés/bornés.
        const { data: row } = await admin
          .from("defect_sheets")
          .select("famille_moteur, marque, pannes")
          .eq("id", body.id)
          .maybeSingle();
        if (!row) {
          return new Response(JSON.stringify({ error: "Sheet not found" }), { status: 404, headers: cors });
        }
        // Les titres déjà enregistrés sont exemptés du contrôle de rang : on
        // corrige une fiche existante, on n'introduit pas une affirmation.
        const titresExistants = (Array.isArray(row.pannes) ? row.pannes : [])
          .map((p: { titre?: unknown }) => String(p?.titre ?? ""))
          .filter(Boolean);
        const { pannes: cleaned } = sanitizePannes(
          body.pannes, row.famille_moteur, row.marque, titresExistants,
        );
        if (cleaned.length !== body.pannes.length) {
          return new Response(
            JSON.stringify({
              error: "pannes invalides",
              detail: `${body.pannes.length - cleaned.length} panne(s) rejetée(s) : URL source manquante, champs invalides ou famille moteur étrangère.`,
            }),
            { status: 400, headers: cors },
          );
        }
        fields.pannes = cleaned;
      }
      // ── AJOUT DE SOURCES À DES PANNES EXISTANTES ──────────────────────
      //
      // C'est le chemin d'écriture de la campagne de re-sourcing : elle ne fait
      // qu'AJOUTER des sources à des pannes déjà là. Aucune suppression, aucun
      // titre nouveau, aucune gravité touchée.
      //
      // ⚠️ Il n'emprunte PAS le chemin `pannes` ci-dessus, et c'est voulu :
      // réécrire la liste entière pour ajouter une URL donnerait à une
      // opération additive le pouvoir de tout remplacer — et il suffirait d'un
      // corps de requête tronqué pour vider une fiche. Ici, une panne absente
      // du corps est une panne qu'on ne touche pas.
      if (Array.isArray(body.ajouter_sources)) {
        const { data: row } = await admin
          .from("defect_sheets").select("pannes").eq("id", body.id).maybeSingle();
        if (!row) {
          return new Response(JSON.stringify({ error: "Sheet not found" }), { status: 400, headers: cors });
        }
        const pannes = (Array.isArray(row.pannes) ? row.pannes : []) as Array<Record<string, unknown>>;
        const parTitre = new Map<string, Record<string, unknown>>();
        for (const p of pannes) parTitre.set(String(p?.titre ?? "").trim().toLowerCase(), p);
        let touchees = 0, ajoutees = 0;
        const inconnues: string[] = [];
        for (const ajout of body.ajouter_sources.slice(0, 40)) {
          const cle = String(ajout?.panne_titre ?? "").trim().toLowerCase();
          const panne = parTitre.get(cle);
          if (!panne) { inconnues.push(String(ajout?.panne_titre ?? "").slice(0, 120)); continue; }
          const existantes = Array.isArray(panne.sources) ? panne.sources as Array<{ url?: unknown }> : [];
          const vues = new Set(existantes.map((x) => String(x?.url ?? "")));
          const neuves = (Array.isArray(ajout?.sources) ? ajout.sources : [])
            .filter((x: { url?: unknown }) => typeof x?.url === "string" && /^https:\/\/\S{8,500}$/i.test(x.url))
            // Une source ajoutée doit PORTER : la campagne n'a aucune raison
            // d'enrichir une panne d'un forum de plus.
            .filter((x: { url: string }) => sourcesPortentLEntree([x.url]) && !vues.has(x.url))
            .slice(0, 4)
            .map((x: { url: string; title?: unknown }) => ({
              url: x.url,
              title: typeof x.title === "string" ? x.title.slice(0, 150) : null,
            }));
          if (neuves.length === 0) continue;
          panne.sources = [...existantes, ...neuves].slice(0, 8);
          touchees++; ajoutees += neuves.length;
        }
        if (touchees === 0) {
          return new Response(
            JSON.stringify({ error: "aucune source ajoutable", inconnues }),
            { status: 400, headers: cors },
          );
        }
        fields.pannes = pannes;
        const { error: e2 } = await admin.from("defect_sheets").update(fields).eq("id", body.id);
        if (e2) return new Response(JSON.stringify({ error: e2.message }), { status: 500, headers: cors });
        return new Response(
          JSON.stringify({ pannes_touchees: touchees, sources_ajoutees: ajoutees, inconnues }),
          { headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      // ── SPRINT 22 — AJOUT D'UN PLAN D'ENTRETIEN SOURCÉ ─────────────────
      //
      // Même philosophie qu'`ajouter_sources` : ADDITIF. `fusionnerPlan`
      // ajoute une opération nouvelle, complète une opération « à vérifier
      // dans le carnet », et ne remplace JAMAIS une opération déjà établie.
      // Le rang des sources est recontrôlé ici : l'écriture ne fait pas
      // confiance à l'appelant, même administrateur.
      //
      // Le plan d'AVANT est renvoyé dans la réponse : le script le garde pour
      // pouvoir revenir en arrière (`restaurer_plan`) dans l'heure du jeton.
      if (Array.isArray(body.ajouter_plan) || Array.isArray(body.restaurer_plan)) {
        const { data: row } = await admin
          .from("defect_sheets").select("plan_entretien").eq("id", body.id).maybeSingle();
        if (!row) {
          return new Response(JSON.stringify({ error: "Sheet not found" }), { status: 400, headers: cors });
        }
        const avant = Array.isArray(row.plan_entretien) ? row.plan_entretien : [];
        let plan = avant;
        let bilan: Record<string, unknown> = {};
        if (Array.isArray(body.restaurer_plan)) {
          // Retour arrière : on remet EXACTEMENT ce qui a été renvoyé avant.
          plan = body.restaurer_plan.slice(0, 12);
          bilan = { restaure: true };
        } else {
          const f = fusionnerPlan(avant, body.ajouter_plan);
          if (f.ajoutees + f.completees === 0) {
            return new Response(JSON.stringify({ error: "aucune operation ajoutable", refusees: f.refusees }), { status: 400, headers: cors });
          }
          plan = f.plan;
          bilan = { ajoutees: f.ajoutees, completees: f.completees, refusees: f.refusees };
        }
        const { error: e3 } = await admin.from("defect_sheets")
          .update({ ...fields, plan_entretien: plan }).eq("id", body.id);
        if (e3) return new Response(JSON.stringify({ error: e3.message }), { status: 500, headers: cors });
        return new Response(JSON.stringify({ ...bilan, plan_avant: avant, plan_apres: plan }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      if (Object.keys(fields).length === 1) {
        return new Response(JSON.stringify({ error: "Nothing to update" }), { status: 400, headers: cors });
      }
      const { data, error } = await admin
        .from("defect_sheets")
        .update(fields)
        .eq("id", body.id)
        .select()
        .single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
      return new Response(JSON.stringify({ sheet: data }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });
  } catch (err) {
    console.error("admin-defect-sheets error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors });
  }
});
