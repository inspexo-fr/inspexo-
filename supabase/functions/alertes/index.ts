// SPRINT 3 — Alertes du dossier d'achat (cron quotidien Vercel → api/alertes.js).
// 1. Rappel constructeur publié sur un modèle suivi : la base RappelConso est
//    revérifiée (via la fonction `rappels`, cache 24 h) ; si le nombre de
//    rappels principaux a augmenté depuis le dernier passage, l'acheteur est
//    prévenu par email. Premier passage = référencement silencieux.
// 2. J+30 après « acheté » : email de retour d'issue (pannes confirmées ?
//    prix payé ?) → formulaire dans /dossier → table outcomes.
// L'alerte « annonce revenue à un autre prix » vit dans la fonction `score`
// (déclenchée au moment précis de la réanalyse), pas ici.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emailNouveauRappel, emailRetourIssue } from "../_shared/notify.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const CRON_PROXY_SECRET = Deno.env.get("CRON_PROXY_SECRET") ?? null;

const MAX_VEHICULES_PAR_RUN = 30; // appels `rappels` par passage (cache 24 h en face)
const MAX_EMAILS_PAR_RUN = 20;

async function secretOk(req: Request): Promise<boolean> {
  if (req.headers.get("Authorization") === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) return true;
  if (!CRON_PROXY_SECRET) return false;
  const given = req.headers.get("x-cron-secret");
  if (!given) return false;
  const digest = async (v: string) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)));
  const [a, b] = await Promise.all([digest(given), digest(CRON_PROXY_SECRET)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

serve(async (req: Request) => {
  if (!(await secretOk(req))) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }
  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  const bilan = { vehicules_verifies: 0, alertes_rappel: 0, retours_envoyes: 0, erreurs: 0 };

  try {
    // ================= 1. Rappels sur les modèles suivis =================
    const { data: suivis } = await admin
      .from("dossier")
      .select("id, user_id, analysis_id, rappels_vus, analyses!inner(marque, modele, annee, result_json, is_eval)")
      .eq("alertes", true)
      .eq("analyses.is_eval", false)
      .in("statut", ["a_voir", "visite"])
      .limit(300);

    // Un appel `rappels` par véhicule distinct (marque|modèle|année).
    type Rappel = { titre?: string };
    const parVehicule = new Map<string, { count: number; titres: string[] } | null>();
    const cle = (m: string, mo: string, a: number | null) => `${m}|${mo}|${a ?? ""}`.toLowerCase();

    // deno-lint-ignore no-explicit-any
    for (const d of ((suivis ?? []) as any[])) {
      const a = d.analyses;
      if (!a?.marque || !a?.modele) continue;
      const k = cle(a.marque, a.modele, a.annee);
      if (parVehicule.has(k)) continue;
      if (parVehicule.size >= MAX_VEHICULES_PAR_RUN) break;
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/rappels`, {
          method: "POST",
          signal: AbortSignal.timeout(30_000),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            marque: a.marque,
            modele: a.modele,
            annee: a.annee,
            carburant: a.result_json?.vehicule?.carburant ?? null,
            motorisation: a.result_json?.vehicule?.motorisation ?? null,
            generation: a.result_json?.vehicule?.generation ?? null,
          }),
        });
        const json = await res.json().catch(() => null);
        const rappels: Rappel[] = Array.isArray(json?.rappels) ? json.rappels : [];
        parVehicule.set(k, {
          count: rappels.length,
          titres: rappels.map((r) => String(r.titre ?? "").slice(0, 160)).filter(Boolean),
        });
        bilan.vehicules_verifies += 1;
      } catch (err) {
        console.error("alertes rappels fetch:", err);
        parVehicule.set(k, null);
        bilan.erreurs += 1;
      }
    }

    // deno-lint-ignore no-explicit-any
    for (const d of ((suivis ?? []) as any[])) {
      if (bilan.alertes_rappel >= MAX_EMAILS_PAR_RUN) break;
      const a = d.analyses;
      if (!a?.marque || !a?.modele) continue;
      const etat = parVehicule.get(cle(a.marque, a.modele, a.annee));
      if (!etat) continue;
      if (d.rappels_vus == null) {
        // Premier passage : on référence sans alerter (les rappels existants
        // étaient déjà affichés sur /a/:id au moment de l'analyse).
        await admin.from("dossier").update({ rappels_vus: etat.count }).eq("id", d.id);
        continue;
      }
      if (etat.count <= d.rappels_vus) continue;
      const { data: userData } = await admin.auth.admin.getUserById(d.user_id);
      const email: string | undefined = userData?.user?.email;
      if (email) {
        const vehicule = [a.marque, a.modele, a.annee].filter(Boolean).join(" ");
        const envoye = await emailNouveauRappel(email, d.analysis_id, vehicule, etat.titres.slice(0, 5));
        await admin.from("events").insert({
          name: "alerte_rappel_envoyee",
          analysis_id: d.analysis_id,
          props_json: { user_id: d.user_id, avant: d.rappels_vus, apres: etat.count, envoye },
        });
        if (envoye) bilan.alertes_rappel += 1;
      }
      await admin.from("dossier").update({ rappels_vus: etat.count }).eq("id", d.id);
    }

    // ================= 2. J+30 après « acheté » =================
    const { data: achetes } = await admin
      .from("dossier")
      .select("id, user_id, analysis_id, analyses!inner(marque, modele, is_eval)")
      .eq("statut", "achete")
      .eq("analyses.is_eval", false)
      .eq("outcome_email_envoye", false)
      .lte("statut_depuis", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
      .limit(MAX_EMAILS_PAR_RUN);

    // deno-lint-ignore no-explicit-any
    for (const d of ((achetes ?? []) as any[])) {
      const { count: dejaRepondu } = await admin
        .from("outcomes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", d.user_id)
        .eq("analysis_id", d.analysis_id);
      if ((dejaRepondu ?? 0) > 0) {
        await admin.from("dossier").update({ outcome_email_envoye: true }).eq("id", d.id);
        continue;
      }
      const { data: userData } = await admin.auth.admin.getUserById(d.user_id);
      const email: string | undefined = userData?.user?.email;
      if (email) {
        const vehicule = [d.analyses?.marque, d.analyses?.modele].filter(Boolean).join(" ") || "véhicule";
        const envoye = await emailRetourIssue(email, vehicule);
        await admin.from("events").insert({
          name: "outcome_email_envoye",
          analysis_id: d.analysis_id,
          props_json: { user_id: d.user_id, envoye },
        });
        if (envoye) bilan.retours_envoyes += 1;
      }
      await admin.from("dossier").update({ outcome_email_envoye: true }).eq("id", d.id);
    }

    return new Response(JSON.stringify(bilan), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("alertes error:", err);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
  }
});
