// SPRINT 8 — Remise du rapport d'inspection, puis versement de la part de
// l'inspecteur (60 %).
//
//   POST { inspection_id, photos[], constats[], synthese, decision }
//     → dépose les photos dans le bucket privé `rapports` (CONSERVÉES :
//       elles sont le rapport acheté — consentement horodaté exigé),
//     → écrit rapport_json et passe l'inspection à `faite`,
//     → crée le Transfer Stripe vers le compte Connect de l'inspecteur,
//       avec LE MÊME transfer_group que la charge et source_transaction =
//       la charge, pour que les fonds soient disponibles immédiatement,
//     → prévient l'acheteur.
//
// Le versement est déclenché ICI, côté serveur, à la remise du rapport : il
// n'existe aucun point d'entrée client qui déplace de l'argent (l'ancienne
// fonction create-transfer, appelable anonymement, a été neutralisée).
// Idempotent : une inspection déjà `faite` ou déjà versée ne repaie pas.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emailRapportPret } from "../_shared/notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const MAX_PHOTOS = 20;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Photo = { bytes: Uint8Array; ext: string; organe: string; legende: string };

/** Décode une image data-URL en octets. Les photos du rapport sont stockées :
 *  on contrôle le type et la taille avant d'écrire quoi que ce soit. */
// deno-lint-ignore no-explicit-any
function decoderPhoto(raw: any): Photo | null {
  const data = typeof raw?.image === "string" ? raw.image : null;
  if (!data) return null;
  const m = data.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/s);
  if (!m) return null;
  const b64 = m[2].replace(/\s/g, "");
  if (b64.length < 100 || b64.length > 4_500_000) return null;
  if (!/^[A-Za-z0-9+/=]+$/.test(b64)) return null;
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  } catch (_) {
    return null;
  }
  return {
    bytes,
    ext: m[1] === "jpg" ? "jpeg" : m[1],
    organe: String(raw?.organe ?? "autre").slice(0, 40),
    legende: String(raw?.legende ?? "").slice(0, 200),
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ---- L'appelant est-il l'inspecteur VALIDÉ de CETTE mission ? ----
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(jwt);
    const user = u?.user ?? null;
    if (!user) return json({ error: "unauthorized", message: "Connexion requise." }, 401);

    const { data: inspecteur } = await admin
      .from("inspecteurs")
      .select("id, nom, statut, stripe_account_id, stripe_paiements_actifs")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!inspecteur || inspecteur.statut !== "valide") {
      return json({ error: "forbidden", message: "Compte inspecteur non validé." }, 403);
    }

    const body = await req.json().catch(() => null);
    const inspectionId = typeof body?.inspection_id === "string" ? body.inspection_id : null;
    if (!inspectionId || !/^[0-9a-f-]{36}$/i.test(inspectionId)) {
      return json({ error: "invalid_input", message: "inspection_id requis." }, 400);
    }

    const { data: insp } = await admin
      .from("inspections")
      .select("id, ref_num, statut, inspecteur_id, acheteur_id, analysis_id, part_inspecteur_cents, transfer_group, transfer_id, stripe_charge, photos_consentement_le")
      .eq("id", inspectionId)
      .maybeSingle();
    if (!insp) return json({ error: "not_found", message: "Inspection introuvable." }, 404);
    if (insp.inspecteur_id !== inspecteur.id) {
      return json({ error: "forbidden", message: "Cette mission n'est pas la vôtre." }, 403);
    }
    if (insp.statut === "faite") {
      return json({ error: "deja_rendu", message: "Le rapport a déjà été remis." }, 409);
    }
    if (insp.statut !== "acceptee") {
      return json({ error: "invalid_state", message: "Mission non acceptée." }, 409);
    }

    // ---- Rapport ----
    const synthese = String(body?.synthese ?? "").trim().slice(0, 4000);
    if (synthese.length < 40) {
      return json({ error: "invalid_input", message: "La synthèse doit décrire ce que vous avez constaté (40 caractères minimum)." }, 400);
    }
    const decision = ["acheter", "negocier", "ne_pas_acheter"].includes(body?.decision)
      ? body.decision
      : null;
    if (!decision) return json({ error: "invalid_input", message: "Donnez votre conclusion." }, 400);

    // deno-lint-ignore no-explicit-any
    const constats = (Array.isArray(body?.constats) ? body.constats : [])
      .slice(0, 30)
      // deno-lint-ignore no-explicit-any
      .filter((c: any) => typeof c?.constat === "string" && c.constat.trim().length > 0)
      // deno-lint-ignore no-explicit-any
      .map((c: any) => ({
        organe: String(c.organe ?? "autre").slice(0, 40),
        constat: String(c.constat).slice(0, 400),
        signal: ["ok", "attention", "rouge"].includes(c.signal) ? c.signal : "attention",
      }));

    // ---- Photos : conservées, donc consentement obligatoire ----
    const brutes = Array.isArray(body?.photos) ? body.photos.slice(0, MAX_PHOTOS) : [];
    const photos = brutes.map(decoderPhoto).filter((p): p is Photo => p !== null);
    if (photos.length > 0 && !insp.photos_consentement_le) {
      return json({
        error: "consentement_requis",
        message: "Confirmez d'abord que le vendeur est informé de la prise de photos conservées.",
      }, 403);
    }

    const chemins: Array<{ chemin: string; organe: string; legende: string }> = [];
    for (const [i, p] of photos.entries()) {
      const chemin = `${insp.id}/${Date.now()}-${i}.${p.ext}`;
      const { error: upErr } = await admin.storage
        .from("rapports")
        .upload(chemin, p.bytes, { contentType: `image/${p.ext}`, upsert: false });
      if (upErr) {
        console.error("upload photo rapport:", upErr);
        continue;
      }
      chemins.push({ chemin, organe: p.organe, legende: p.legende });
    }
    if (chemins.length > 0) {
      await admin.from("inspection_photos").insert(
        chemins.map((c) => ({ inspection_id: insp.id, chemin: c.chemin, organe: c.organe, legende: c.legende })),
      );
    }

    const rapport = {
      decision,
      synthese,
      constats,
      photos: chemins.length,
      inspecteur: inspecteur.nom,
      rendu_le: new Date().toISOString(),
    };

    // Idempotence : seule une ligne encore `acceptee` passe à `faite`.
    const { data: majRows, error: majErr } = await admin
      .from("inspections")
      .update({
        statut: "faite",
        rapport_json: rapport,
        rapport_rendu_le: new Date().toISOString(),
        maj_le: new Date().toISOString(),
      })
      .eq("id", insp.id)
      .eq("statut", "acceptee")
      .select("id")
      .maybeSingle();
    if (majErr) {
      console.error("maj rapport:", majErr);
      return json({ error: "db_error", message: "Enregistrement impossible." }, 500);
    }
    if (!majRows) return json({ error: "deja_rendu", message: "Le rapport a déjà été remis." }, 409);

    // ---- Versement des 60 % (charge et transfert séparés) ----
    let transferId: string | null = null;
    let versementErreur: string | null = null;
    if (!insp.transfer_id && inspecteur.stripe_account_id && inspecteur.stripe_paiements_actifs) {
      try {
        const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
        const transfer = await stripe.transfers.create({
          amount: insp.part_inspecteur_cents,
          currency: "eur",
          destination: inspecteur.stripe_account_id,
          // MÊME groupe que la charge (inspection-checkout) : les deux
          // moitiés de l'opération sont reliées dans Stripe.
          transfer_group: insp.transfer_group ?? `inspection_${insp.id}`,
          // Rattache le virement à la charge encaissée : les fonds sont
          // disponibles sans attendre le solde de la plateforme.
          ...(insp.stripe_charge ? { source_transaction: insp.stripe_charge } : {}),
          metadata: { inspection_id: insp.id, inspecteur_id: inspecteur.id },
        }, { idempotencyKey: `inspection-transfer-${insp.id}` });
        transferId = transfer.id;
        await admin.from("inspections")
          .update({ transfer_id: transfer.id, verse_le: new Date().toISOString() })
          .eq("id", insp.id);
      } catch (e) {
        // Le rapport est rendu quoi qu'il arrive : un versement en échec se
        // rattrape à la main (admin), il ne doit pas bloquer l'acheteur.
        versementErreur = String(e?.message ?? e).slice(0, 200);
        console.error("transfert inspecteur:", versementErreur);
      }
    }

    // ---- L'acheteur est prévenu ----
    const { data: analyse } = await admin
      .from("analyses").select("marque, modele").eq("id", insp.analysis_id).maybeSingle();
    const vehicule = [analyse?.marque, analyse?.modele].filter(Boolean).join(" ") || "votre véhicule";
    const { data: acheteur } = await admin.auth.admin.getUserById(insp.acheteur_id);
    if (acheteur?.user?.email) {
      await emailRapportPret(acheteur.user.email, vehicule, insp.analysis_id, decision);
    }

    await admin.from("events").insert({
      name: "inspection_rapport_rendu",
      analysis_id: insp.analysis_id,
      props_json: {
        inspection_id: insp.id,
        decision,
        constats: constats.length,
        photos: chemins.length,
        verse: transferId !== null,
        versement_erreur: versementErreur,
      },
    });

    return json({
      ok: true,
      rapport,
      verse: transferId !== null,
      ...(versementErreur ? { versement_erreur: "Le virement sera régularisé par Inspexo." } : {}),
    });
  } catch (error) {
    console.error("inspection-rapport error:", error);
    return json({ error: "internal", message: "Erreur interne. Réessayez." }, 500);
  }
});
