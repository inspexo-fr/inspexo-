// SPRINT 3 — Alertes du dossier d'achat (cron quotidien Vercel → api/alertes.js).
// 1. Rappel constructeur publié sur un modèle suivi : la base RappelConso est
//    revérifiée (via la fonction `rappels`, cache 24 h) ; si le nombre de
//    rappels principaux a augmenté depuis le dernier passage, l'acheteur est
//    prévenu par email. Premier passage = référencement silencieux.
// 2. SPRINT 10 — J+21 après l'analyse : invitation au retour d'issue par LIEN
//    SIGNÉ, sans compte, sur l'union des sources qui nous ont laissé un email
//    (dossier, Pass, inspection, opt-in « recevoir ce rapport »).
//    Trois garde-fous, dans cet ordre :
//      - UNE SEULE invitation par (analyse, email) : l'unicité est dans le
//        schéma (`retours`), donc l'union des sources est dédoublonnée par la
//        base et non par la prudence du code ;
//      - JAMAIS de relance : il n'existe aucun code qui ré-envoie. Une ligne
//        `retours` déjà présente fait simplement passer au suivant ;
//      - aucune invitation vers un email désinscrit (`desinscriptions`, ou
//        `dossier.alertes = false` pour les sources de type dossier).
//    Elle REMPLACE l'ancien envoi « J+30 après acheté » du sprint 3, qui
//    aurait fait deux sollicitations pour le même véhicule.
// L'alerte « annonce revenue à un autre prix » vit dans la fonction `score`
// (déclenchée au moment précis de la réanalyse), pas ici.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  emailNouveauRappel,
  emailRetourSigne,
  empreinteEmail,
  empreinteJeton,
  signatureRetour,
} from "../_shared/notify.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const CRON_PROXY_SECRET = Deno.env.get("CRON_PROXY_SECRET") ?? null;

const MAX_VEHICULES_PAR_RUN = 30; // appels `rappels` par passage (cache 24 h en face)
const MAX_EMAILS_PAR_RUN = 20;
// Délai avant l'invitation au retour d'issue : trois semaines, le temps qu'un
// achat se décide et qu'on ait roulé un peu.
const JOURS_AVANT_RETOUR = 21;
const MAX_RETOURS_PAR_RUN = 25;

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

/** Candidats à l'invitation : une analyse réelle, un email, trois semaines
 *  passées. L'union est volontairement construite ici puis dédoublonnée par
 *  la base : si une même personne est à la fois cliente du Pass et titulaire
 *  d'un dossier, elle ne reçoit qu'un seul email. */
// deno-lint-ignore no-explicit-any
async function candidatsRetour(admin: any): Promise<Array<{
  analysis_id: string;
  email: string;
  source: "dossier" | "pass" | "inspection" | "lead";
  vehicule: string;
}>> {
  const depuis = new Date(Date.now() - JOURS_AVANT_RETOUR * 24 * 3600 * 1000).toISOString();
  // Fenêtre basse : on ne réveille pas des analyses vieilles de six mois le
  // jour où cette fonctionnalité est déployée.
  const pasAvant = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  const out: Array<{ analysis_id: string; email: string; source: "dossier" | "pass" | "inspection" | "lead"; vehicule: string }> = [];
  const libelle = (a: { marque?: string | null; modele?: string | null }) =>
    [a?.marque, a?.modele].filter(Boolean).join(" ") || "voiture";

  // a) Dossiers — l'email vient du compte ; les alertes coupées valent refus.
  const { data: dossiers } = await admin
    .from("dossier")
    .select("user_id, analysis_id, analyses!inner(marque, modele, created_at, is_eval)")
    .eq("alertes", true)
    .eq("analyses.is_eval", false)
    .lte("analyses.created_at", depuis)
    .gte("analyses.created_at", pasAvant)
    .limit(200);
  // deno-lint-ignore no-explicit-any
  for (const d of ((dossiers ?? []) as any[])) {
    const { data: u } = await admin.auth.admin.getUserById(d.user_id);
    const email = u?.user?.email;
    if (email) out.push({ analysis_id: d.analysis_id, email, source: "dossier", vehicule: libelle(d.analyses) });
  }

  // b) Pass achat — l'email est celui du paiement, il peut n'avoir aucun compte.
  const { data: passes } = await admin
    .from("passes")
    .select("email, user_id")
    .eq("statut", "actif")
    .lte("created_at", depuis)
    .gte("created_at", pasAvant)
    .limit(100);
  // deno-lint-ignore no-explicit-any
  for (const p of ((passes ?? []) as any[])) {
    if (!p.email || !p.user_id) continue;
    const { data: ds } = await admin
      .from("dossier")
      .select("analysis_id, analyses!inner(marque, modele, created_at, is_eval)")
      .eq("user_id", p.user_id)
      .eq("analyses.is_eval", false)
      .lte("analyses.created_at", depuis)
      .gte("analyses.created_at", pasAvant)
      .limit(5);
    // deno-lint-ignore no-explicit-any
    for (const d of ((ds ?? []) as any[])) {
      out.push({ analysis_id: d.analysis_id, email: p.email, source: "pass", vehicule: libelle(d.analyses) });
    }
  }

  // c) Inspections payées — l'acheteur a un compte, et un avis très informé.
  const { data: inspections } = await admin
    .from("inspections")
    .select("acheteur_id, analysis_id, created_at, analyses!inner(marque, modele, is_eval)")
    .eq("analyses.is_eval", false)
    .lte("created_at", depuis)
    .gte("created_at", pasAvant)
    .limit(100);
  // deno-lint-ignore no-explicit-any
  for (const i of ((inspections ?? []) as any[])) {
    if (!i.acheteur_id) continue;
    const { data: u } = await admin.auth.admin.getUserById(i.acheteur_id);
    const email = u?.user?.email;
    if (email) out.push({ analysis_id: i.analysis_id, email, source: "inspection", vehicule: libelle(i.analyses) });
  }

  // d) Opt-in « recevoir ce rapport par email » : consentement explicite déjà
  //    donné pour être recontacté à propos de CETTE analyse.
  const { data: leads } = await admin
    .from("leads")
    .select("email, analysis_id, analyses!inner(marque, modele, is_eval)")
    .eq("source", "rapport")
    .eq("analyses.is_eval", false)
    .not("analysis_id", "is", null)
    .lte("created_at", depuis)
    .gte("created_at", pasAvant)
    .limit(100);
  // deno-lint-ignore no-explicit-any
  for (const l of ((leads ?? []) as any[])) {
    out.push({ analysis_id: l.analysis_id, email: l.email, source: "lead", vehicule: libelle(l.analyses) });
  }

  return out;
}

/** Envoie au plus MAX_RETOURS_PAR_RUN invitations, une par (analyse, email). */
// deno-lint-ignore no-explicit-any
async function inviterAuxRetours(admin: any, bilan: { invitations_envoyees: number; invitations_ignorees: number; erreurs: number }) {
  try {
    const candidats = await candidatsRetour(admin);
    // Dédoublonnage en mémoire AVANT d'écrire : évite de tenter cent fois la
    // même insertion quand plusieurs sources désignent la même personne.
    const vus = new Set<string>();
    let envoyes = 0;

    for (const c of candidats) {
      if (envoyes >= MAX_RETOURS_PAR_RUN) break;
      const emailHash = await empreinteEmail(c.email);
      if (!emailHash) break; // UNSUB_SECRET absent : on n'envoie aucun lien signé
      const cle = `${c.analysis_id}|${emailHash}`;
      if (vus.has(cle)) continue;
      vus.add(cle);

      // Opposition : un « STOP » vaut pour toutes les sources.
      const { data: stop } = await admin
        .from("desinscriptions").select("email_hash").eq("email_hash", emailHash).maybeSingle();
      if (stop) { bilan.invitations_ignorees += 1; continue; }

      const token = await signatureRetour(c.analysis_id, emailHash);
      if (!token) break;
      const tokenHash = await empreinteJeton(token);

      // L'insertion EST le verrou anti-relance : la contrainte d'unicité
      // (analysis_id, email_hash) fait échouer la seconde tentative, quelle
      // que soit la source qui l'a proposée.
      const { error: insErr } = await admin.from("retours").insert({
        analysis_id: c.analysis_id,
        email_hash: emailHash,
        token_hash: tokenHash,
        source: c.source,
      });
      if (insErr) { bilan.invitations_ignorees += 1; continue; }

      const envoye = await emailRetourSigne(c.email, c.vehicule, c.analysis_id, token, emailHash);
      if (envoye) {
        await admin.from("retours").update({ envoye_le: new Date().toISOString() })
          .eq("analysis_id", c.analysis_id).eq("email_hash", emailHash);
        bilan.invitations_envoyees += 1;
        envoyes += 1;
      }
      await admin.from("events").insert({
        name: "retour_invitation",
        analysis_id: c.analysis_id,
        props_json: { source: c.source, envoye },
      });
    }
  } catch (e) {
    console.error("inviterAuxRetours:", e);
    bilan.erreurs += 1;
  }
}

serve(async (req: Request) => {
  if (!(await secretOk(req))) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }
  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  const bilan = {
    vehicules_verifies: 0,
    alertes_rappel: 0,
    invitations_envoyees: 0,
    invitations_ignorees: 0,
    erreurs: 0,
  };

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
        const envoye = await emailNouveauRappel(email, d.analysis_id, vehicule, etat.titres.slice(0, 5), d.user_id);
        await admin.from("events").insert({
          name: "alerte_rappel_envoyee",
          analysis_id: d.analysis_id,
          props_json: { user_id: d.user_id, avant: d.rappels_vus, apres: etat.count, envoye },
        });
        if (envoye) bilan.alertes_rappel += 1;
      }
      await admin.from("dossier").update({ rappels_vus: etat.count }).eq("id", d.id);
    }

    // ===== 2. (RETIRÉ au sprint 10) J+30 après « acheté » =====
    // Cet envoi doublonnait désormais l'invitation J+21 ci-dessous : un
    // acheteur ayant marqué « acheté » dans son dossier aurait reçu DEUX
    // sollicitations pour le même véhicule, ce qui contredit la règle « une
    // seule invitation par dossier et par email, jamais de relance ».
    // Le formulaire de retour du dossier (RPC submit_outcome, réservée aux
    // comptes) reste disponible : c'est une action de l'utilisateur, pas une
    // sollicitation de notre part.

    // ========== 2. J+21 : invitation au retour d'issue, lien signé ==========
    await inviterAuxRetours(admin, bilan);

    return new Response(JSON.stringify(bilan), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("alertes error:", err);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
  }
});
