// SPRINT 10 — Administration des partenaires (assurance / crédit).
//   GET  → partenaires + mises en relation par semaine, BRUTES et NETTES.
//   POST { action: "enregistrer" | "activer" } → écriture, sous contrôle légal.
//
// Le contrôle légal n'est PAS une politique éditoriale : sans immatriculation
// ORIAS, décrire un contrat ou vanter un crédit nous ferait basculer dans une
// activité réglementée. Il est donc appliqué ICI, à l'écriture, et le refus
// dit exactement ce qui cloche.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifierAdmin } from "../_shared/adminAuth.ts";
import {
  compterNet,
  peutActiver,
  type TypePartenaire,
  verifierTextePartenaire,
} from "../_shared/partenaires.ts";

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

/** Lundi de la semaine ISO contenant `d`, en AAAA-MM-JJ. */
function semaineDe(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const jour = (x.getUTCDay() + 6) % 7; // lundi = 0
  x.setUTCDate(x.getUTCDate() - jour);
  return x.toISOString().slice(0, 10);
}

const aujourdhui = () =>
  new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date());

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const acces = await verifierAdmin(req);
  if (!acces.ok) return json({ error: acces.error }, acces.status);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (req.method === "GET") {
      const { data: partenaires, error } = await admin
        .from("partenaires")
        .select("id, type, slug, nom, url, texte_valide, valide_le, actif, created_at, maj")
        .order("type").order("nom");
      if (error) throw error;

      const depuis = new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString();
      const { data: mer } = await admin
        .from("mises_en_relation")
        .select("partenaire_id, analysis_id, ip_hash, created_at, robot")
        .gte("created_at", depuis)
        .limit(20000);

      // deno-lint-ignore no-explicit-any
      const lignes = (mer ?? []) as any[];
      const stats = (partenaires ?? []).map((p) => {
        const siennes = lignes.filter((l) => l.partenaire_id === p.id);
        // Par semaine : le BRUT dit ce qui a frappé la route, le NET ce qui
        // ressemble à un humain (robots écartés, un dossier par jour au plus).
        const semaines = new Map<string, typeof siennes>();
        for (const l of siennes) {
          const s = semaineDe(new Date(l.created_at));
          if (!semaines.has(s)) semaines.set(s, []);
          semaines.get(s)!.push(l);
        }
        return {
          partenaire_id: p.id,
          total_brut: siennes.length,
          total_net: compterNet(siennes, p.id),
          par_semaine: [...semaines.entries()]
            .sort((a, b) => (a[0] < b[0] ? 1 : -1))
            .slice(0, 26)
            .map(([semaine, l]) => ({
              semaine,
              brut: l.length,
              net: compterNet(l, p.id),
            })),
        };
      });

      return json({ partenaires: partenaires ?? [], stats, aujourdhui: aujourdhui() });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      const action = String(body?.action ?? "");

      if (action === "enregistrer") {
        const type = String(body?.type ?? "") as TypePartenaire;
        if (type !== "assurance" && type !== "credit") {
          return json({ error: "type_invalide" }, 400);
        }
        const texte = String(body?.texte_valide ?? "");
        const controle = verifierTextePartenaire(type, texte);
        if (!controle.ok) {
          // Le refus est explicite : l'exploitant doit pouvoir corriger sans
          // deviner, et comprendre que la règle est juridique.
          return json({ error: "texte_refuse", motifs: controle.motifs }, 422);
        }
        const slug = String(body?.slug ?? "").trim().toLowerCase();
        if (!/^[a-z0-9-]{3,40}$/.test(slug)) return json({ error: "slug_invalide" }, 400);
        const url = String(body?.url ?? "").trim();
        if (!/^https:\/\/\S+$/.test(url)) return json({ error: "url_invalide" }, 400);
        const nom = String(body?.nom ?? "").trim();
        if (nom.length < 2 || nom.length > 80) return json({ error: "nom_invalide" }, 400);
        const valideLe = String(body?.valide_le ?? "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(valideLe)) return json({ error: "date_invalide" }, 400);

        // Un texte modifié repart ÉTEINT : la validation d'hier ne vaut pas
        // pour le texte d'aujourd'hui.
        const { error: upErr } = await admin.from("partenaires").upsert({
          type, slug, nom, url, texte_valide: texte, valide_le: valideLe,
          actif: false, maj: new Date().toISOString(),
        }, { onConflict: "slug" });
        if (upErr) throw upErr;
        await admin.from("events").insert({
          name: "partenaire_enregistre",
          props_json: { slug, type, par: acces.user.email ?? null },
        });
        return json({ ok: true, actif: false });
      }

      if (action === "activer") {
        const slug = String(body?.slug ?? "").trim().toLowerCase();
        const actif = body?.actif === true;
        const { data: p } = await admin
          .from("partenaires").select("id, type, texte_valide").eq("slug", slug).maybeSingle();
        if (!p) return json({ error: "introuvable" }, 404);

        if (actif) {
          // Deux verrous à l'allumage : la date d'entrée en vigueur pour le
          // crédit, et une re-vérification du texte (il a pu être modifié en
          // base par une autre voie).
          const dateOk = peutActiver(p.type as TypePartenaire, aujourdhui());
          if (!dateOk.ok) return json({ error: "activation_refusee", motifs: dateOk.motifs }, 422);
          const texteOk = verifierTextePartenaire(p.type as TypePartenaire, p.texte_valide);
          if (!texteOk.ok) return json({ error: "texte_refuse", motifs: texteOk.motifs }, 422);
        }

        const { error: majErr } = await admin.from("partenaires")
          .update({ actif, maj: new Date().toISOString() }).eq("id", p.id);
        if (majErr) throw majErr;
        await admin.from("events").insert({
          name: actif ? "partenaire_active" : "partenaire_desactive",
          props_json: { slug, par: acces.user.email ?? null },
        });
        return json({ ok: true, actif });
      }

      return json({ error: "action_inconnue" }, 400);
    }

    return json({ error: "method_not_allowed" }, 405);
  } catch (e) {
    console.error("admin-partenaires:", e);
    return json({ error: "server_error" }, 500);
  }
});
