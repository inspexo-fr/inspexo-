// SPRINT 10 — Administration des retours d'issue.
//   GET → taux de réponse, achats, écart entre prix affiché et prix payé,
//         points confirmés par famille moteur.
//
// C'est la mesure qui dit si nos analyses tombent juste. Elle ne sert à rien
// si on la lit en se flattant : le dénominateur est le nombre d'INVITATIONS
// envoyées, pas le nombre de réponses reçues, et les analyses d'éval en sont
// exclues comme partout ailleurs.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifierAdmin } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const acces = await verifierAdmin(req);
  if (!acces.ok) return json({ error: acces.error }, acces.status);
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: invitations } = await admin
      .from("retours")
      .select("id, analysis_id, source, envoye_le, repondu_le, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);

    const { data: reponses } = await admin
      .from("outcomes")
      .select("analysis_id, prix_paye_eur, points_confirmes_choix, achete, source, created_at, commentaire")
      .order("created_at", { ascending: false })
      .limit(5000);

    // Prix affiché et famille moteur : lus sur l'analyse, pour l'écart et la
    // ventilation. `is_eval` exclut les analyses de test.
    const ids = [...new Set((reponses ?? []).map((r) => r.analysis_id))].slice(0, 2000);
    const { data: analyses } = ids.length
      ? await admin
        .from("analyses")
        .select("id, marque, modele, famille_moteur, verdict, score, result_json, is_eval")
        .in("id", ids)
      : { data: [] };

    // deno-lint-ignore no-explicit-any
    const parAnalyse = new Map<string, any>((analyses ?? []).map((a) => [a.id, a]));

    const envoyees = (invitations ?? []).filter((i) => i.envoye_le).length;
    const repondues = (invitations ?? []).filter((i) => i.repondu_le).length;

    type Ecart = { analysis_id: string; vehicule: string; affiche: number; paye: number; ecart: number };
    const ecarts: Ecart[] = [];
    const parFamille = new Map<string, { oui: number; non: number; pas_verifie: number; achats: number; total: number }>();
    let achats = 0, reponsesReelles = 0;

    for (const r of (reponses ?? [])) {
      const a = parAnalyse.get(r.analysis_id);
      if (!a || a.is_eval) continue; // jamais les analyses de test
      reponsesReelles += 1;
      if (r.achete) achats += 1;

      const famille = a.famille_moteur || "famille inconnue";
      if (!parFamille.has(famille)) {
        parFamille.set(famille, { oui: 0, non: 0, pas_verifie: 0, achats: 0, total: 0 });
      }
      const f = parFamille.get(famille)!;
      f.total += 1;
      if (r.achete) f.achats += 1;
      if (r.points_confirmes_choix === "oui") f.oui += 1;
      else if (r.points_confirmes_choix === "non") f.non += 1;
      else if (r.points_confirmes_choix === "pas_verifie") f.pas_verifie += 1;

      const affiche = a.result_json?.vehicule?.prix_affiche;
      if (r.achete && typeof affiche === "number" && typeof r.prix_paye_eur === "number") {
        ecarts.push({
          analysis_id: r.analysis_id,
          vehicule: [a.marque, a.modele].filter(Boolean).join(" ") || "véhicule",
          affiche,
          paye: r.prix_paye_eur,
          ecart: r.prix_paye_eur - affiche,
        });
      }
    }

    return json({
      invitations: {
        creees: (invitations ?? []).length,
        envoyees,
        repondues,
        // Le taux se calcule sur les invitations RÉELLEMENT envoyées.
        taux_reponse: envoyees > 0 ? Math.round((repondues / envoyees) * 1000) / 10 : null,
      },
      reponses: {
        total: reponsesReelles,
        achats,
        taux_achat: reponsesReelles > 0 ? Math.round((achats / reponsesReelles) * 1000) / 10 : null,
      },
      prix: {
        n: ecarts.length,
        ecart_median: median(ecarts.map((e) => e.ecart)),
        // Positif = payé plus cher que demandé (rare), négatif = négocié.
        details: ecarts.slice(0, 100),
      },
      par_famille: [...parFamille.entries()]
        .map(([famille, v]) => ({ famille, ...v }))
        .sort((a, b) => b.total - a.total),
      lignes: (reponses ?? []).slice(0, 500).map((r) => {
        const a = parAnalyse.get(r.analysis_id);
        return {
          analysis_id: r.analysis_id,
          date: r.created_at,
          source: r.source,
          vehicule: a ? [a.marque, a.modele].filter(Boolean).join(" ") : "",
          famille: a?.famille_moteur ?? "",
          verdict: a?.verdict ?? "",
          score: a?.score ?? null,
          achete: r.achete,
          prix_affiche: a?.result_json?.vehicule?.prix_affiche ?? null,
          prix_paye: r.prix_paye_eur,
          points_confirmes: r.points_confirmes_choix,
          commentaire: (r.commentaire ?? "").slice(0, 300),
          is_eval: Boolean(a?.is_eval),
        };
      }).filter((l) => !l.is_eval),
    });
  } catch (e) {
    console.error("admin-retours:", e);
    return json({ error: "server_error" }, 500);
  }
});
