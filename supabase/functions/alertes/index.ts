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
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { executerDecision } from "../_shared/inspectionArgent.ts";
import { compterPannesPortees, entreesAtlasAPlat } from "../_shared/atlasSource.ts";
import defectAtlas from "../_shared/defectAtlas.json" with { type: "json" };
import { alerterUneFoisParHeure, bilanHtml, sujetAlerte, sujetBilan } from "../_shared/alerting.ts";
import {
  alerteExploitant,
  alerteRapportEnRetard,
  emailAutorisationExpiree,
  emailNouveauRappel,
  emailRappelModele,
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
// Fenêtre haute : on ne réveille jamais une analyse de plus de 60 jours.
// Si le cron reste à l'arrêt longtemps, le rattrapage ne doit pas écrire à
// des gens dont l'achat est largement derrière eux.
const JOURS_FENETRE_RETOUR = 60;
// Plafond par passage. Il interagit avec la fenêtre : un arriéré plus grand
// que 50 × (jours restants dans la fenêtre) perd silencieusement sa queue.
// À une exécution par jour, 50 draine 3 000 invitations avant expiration.
const MAX_RETOURS_PAR_RUN = 50;

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
  // Fenêtre basse : on ne réveille pas des analyses anciennes le jour où
  // cette fonctionnalité est déployée, ni après une interruption du cron.
  const pasAvant = new Date(Date.now() - JOURS_FENETRE_RETOUR * 24 * 3600 * 1000).toISOString();
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


/** Recompte les pannes portées par une source indépendante et écrit le
 *  résultat dans `config`.
 *
 *  ⚠️ Extraite pour être appelable SEULE (tâche `pannes_portees`), sans
 *  déclencher les sept autres passes du cron : celles-ci envoient des emails —
 *  invitations au retour d'issue, alertes d'exploitation, avis d'expiration.
 *  Recompter un chiffre d'affichage ne doit pas écrire à des gens. */
async function recompterPannesPortees(
  // deno-lint-ignore no-explicit-any
  admin: any,
): Promise<{ portees: number; total: number; fiches_a_terre: number; fiches_total: number }> {
  const { data: fiches, error } = await admin.from("defect_sheets").select("pannes");
  // ⚠️ Une lecture en échec n'écrit RIEN : écraser le chiffre publié par un
  // zéro parce que la base n'a pas répondu afficherait « 0 panne portée », ce
  // qui est faux et alarmant pour la mauvaise raison.
  if (error) throw error;
  const compte = compterPannesPortees(
    (fiches ?? []) as unknown[],
    entreesAtlasAPlat(defectAtlas),
  );
  await admin.from("config").upsert({
    cle: "pannes_portees",
    valeur: { ...compte, maj: new Date().toISOString().slice(0, 10) },
  }, { onConflict: "cle" });
  return compte;
}

// ===== Alertes « rappel sur ce modèle » SANS compte (sprint 23, lot 3) =====
// Fonction à part : appelée par le passage quotidien ET par la tâche
// `alertes_modele` (ce passage seul, sans les autres envois du cron).
type EtatVehicule = { count: number; titres: string[] } | null;
async function passeAlertesModele(
  // deno-lint-ignore no-explicit-any
  admin: any,
  parVehicule: Map<string, EtatVehicule>,
  bilan: { alertes_rappel: number; alertes_modele_envoyees: number; alertes_modele_purgees: number; vehicules_verifies: number; erreurs: number },
): Promise<void> {
  const cle = (m: string, mo: string, a: number | null) => `${m}|${mo}|${a ?? ""}`.toLowerCase();
    // Double opt-in : seules les inscriptions CONFIRMÉES reçoivent quelque
    // chose ; une adresse désinscrite (`desinscriptions`) n'en reçoit plus et
    // ses inscriptions sont effacées ; une inscription non confirmée sous
    // 7 jours est effacée.
    try {
      const septJours = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const { count: purgees } = await admin.from("alertes_modele")
        .delete({ count: "exact" }).is("confirme_le", null).lt("jeton_envoye_le", septJours);
      bilan.alertes_modele_purgees = purgees ?? 0;

      const { data: abonnes } = await admin.from("alertes_modele")
        .select("id, email, email_hash, marque, modele, annee, analysis_id, rappels_vus")
        .not("confirme_le", "is", null).limit(300);
      const liste = (abonnes ?? []) as Array<{ id: string; email: string; email_hash: string; marque: string; modele: string; annee: number | null; analysis_id: string | null; rappels_vus: number | null }>;
      const hashes = [...new Set(liste.map((x) => x.email_hash))];
      const opposes = new Set<string>();
      for (let i = 0; i < hashes.length; i += 100) {
        const { data: op } = await admin.from("desinscriptions").select("email_hash").in("email_hash", hashes.slice(i, i + 100));
        for (const o of op ?? []) opposes.add(o.email_hash);
      }
      if (opposes.size > 0) {
        const { count: eff } = await admin.from("alertes_modele").delete({ count: "exact" }).in("email_hash", [...opposes]);
        bilan.alertes_modele_purgees += eff ?? 0;
      }
      for (const x of liste) {
        if (opposes.has(x.email_hash)) continue;
        if (bilan.alertes_rappel + bilan.alertes_modele_envoyees >= MAX_EMAILS_PAR_RUN) break;
        const k = cle(x.marque, x.modele, x.annee);
        if (!parVehicule.has(k)) {
          if (parVehicule.size >= MAX_VEHICULES_PAR_RUN) continue;
          try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/rappels`, {
              method: "POST", signal: AbortSignal.timeout(30_000),
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
              body: JSON.stringify({ marque: x.marque, modele: x.modele, annee: x.annee }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || !Array.isArray(json?.rappels) || json?.indisponible === true) {
              parVehicule.set(k, null); bilan.erreurs += 1;
            } else {
              parVehicule.set(k, { count: json.rappels.length, titres: json.rappels.map((r: { titre?: string }) => String(r.titre ?? "").slice(0, 160)).filter(Boolean) });
              bilan.vehicules_verifies += 1;
            }
          } catch (err) {
            console.error("alertes modele fetch:", err);
            parVehicule.set(k, null); bilan.erreurs += 1;
          }
        }
        const etat = parVehicule.get(k);
        if (!etat) continue;
        if (x.rappels_vus == null) {
          await admin.from("alertes_modele").update({ rappels_vus: etat.count }).eq("id", x.id);
          continue;
        }
        if (etat.count <= x.rappels_vus) continue;
        const vehicule = [x.marque, x.modele, x.annee].filter(Boolean).join(" ");
        const envoye = await emailRappelModele(x.email, vehicule, etat.titres.slice(0, 5), x.analysis_id, x.email_hash);
        await admin.from("events").insert({ name: "alerte_modele_envoyee", analysis_id: x.analysis_id, props_json: { avant: x.rappels_vus, apres: etat.count, envoye } });
        if (envoye) bilan.alertes_modele_envoyees += 1;
        await admin.from("alertes_modele").update({ rappels_vus: etat.count }).eq("id", x.id);
      }
    } catch (err) {
      console.error("alertes modele:", err);
      bilan.erreurs += 1;
    }

}

serve(async (req: Request) => {
  if (!(await secretOk(req))) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }
  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  // SPRINT 17 — Tâche « santé » : alerte IMMÉDIATE quand une fonction critique
  // ne répond plus. Appelée par `/api/sante` (point de contrôle public) à la
  // seule condition qu'il ait DÉTECTÉ une panne — jamais à chaque passage.
  //
  // ⚠️ Pas de secret nouveau : on réemploie `CRON_PROXY_SECRET`, déjà posé des
  // deux côtés. Un secret de plus, c'est une rotation de plus à ne pas oublier.
  // Et l'étranglement horaire borne l'amplification à un email par heure, même
  // si quelqu'un martèle le point de contrôle public.
  try {
    const corps = await req.clone().json().catch(() => null);

    // SPRINT 17 — Tâche « test » : envoie UNE alerte et UN bilan factices,
    // pour vérifier que la chaîne d'email arrive et régler les filtres de
    // boîte mail. Protégée par le même secret que le cron.
    //
    // ⚠️ Les deux messages portent « TEST » DANS L'OBJET et le disent en
    // première ligne : un message d'essai qui ressemble à une vraie alerte
    // apprend à ignorer les vraies. Et elle n'emprunte PAS l'étranglement
    // horaire — sinon un test consommerait le droit d'alerter de l'heure, et
    // un incident survenant juste après resterait muet.
    if (corps?.tache === "test") {
      const alerte = await alerteExploitant(
        `${sujetAlerte("fonction_en_erreur")} — TEST`.replace("fonction en erreur — TEST", "TEST"),
        `<p><strong>Ceci est un message d'essai.</strong> Aucun incident n'est en cours.</p>
         <p>Il sert à vérifier que les alertes arrivent et à régler les filtres de boîte mail.
            Les vraies alertes portent le même préfixe <code>[URGENT] Inspexo —</code>,
            suivi du motif (crédit ou clé, échecs répétés, fonction en erreur, coût du jour).</p>
         <p>Une alerte par motif et par heure, au maximum.</p>`,
      );
      const bilan = await alerteExploitant(
        `${sujetBilan(new Date().toLocaleDateString("fr-FR"))} — TEST`,
        `<p><strong>Ceci est un bilan d'essai.</strong> Les chiffres ci-dessous sont factices.</p>` +
          bilanHtml({
            jour: new Date().toISOString().slice(0, 10),
            analyses: 12,
            analyses_par_source: { "tiktok-01": 7, direct: 5 },
            verdicts: { orange: 6, rouge: 4, vert: 2 },
            clics: { pass: 3, inspection: 1, partage: 5 },
            paiements: { pass: 1, inspections: 0 },
            listes_attente: { pass_waitlist: 2 },
            leads_pro: 1,
            erreurs: { total: 0, par_etape: {}, service_indisponible: 0 },
            cout_ia_eur: 1.23,
            analyses_eval: 3,
          }),
      );
      return new Response(JSON.stringify({ tache: "test", alerte, bilan }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Recompter SEULEMENT le chiffre public, sans envoyer un seul email.
    // Utilisé après chaque lot de la campagne de re-sourcing : le chiffre
    // bouge, et attendre le cron du lendemain pour le voir afficherait une
    // mesure périmée sur une page qui dit « recalculé chaque jour ».
    if (corps?.tache === "pannes_portees") {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const compte = await recompterPannesPortees(admin);
      return new Response(JSON.stringify({ tache: "pannes_portees", ...compte }), {
        // ⚠️ Pas de CORS ici, et ce n'est pas un oubli : `alertes` est une
        // fonction de cron, appelée de serveur à serveur derrière
        // CRON_PROXY_SECRET. Aucun navigateur ne l'appelle. J'avais recopié
        // un `corsHeaders` d'`atlas-builder` — un nom qui n'existe pas dans ce
        // fichier, donc un ReferenceError sur ce seul chemin.
        headers: { "Content-Type": "application/json" },
      });
    }

    // SPRINT 23 lot 3 — le passage des alertes sans compte, SEUL (aucun autre
    // envoi du cron : ni invitations, ni bilan). Sert à purger une adresse
    // désinscrite sans attendre le lendemain, et aux essais.
    if (corps?.tache === "alertes_modele") {
      const b = { alertes_rappel: 0, alertes_modele_envoyees: 0, alertes_modele_purgees: 0, vehicules_verifies: 0, erreurs: 0 };
      await passeAlertesModele(admin, new Map(), b);
      return new Response(JSON.stringify({ tache: "alertes_modele", ...b }), { headers: { "Content-Type": "application/json" } });
    }

    // SPRINT 23 lot 3 — ESSAI de l'e-mail d'alerte : l'envoie à UNE inscription
    // CONFIRMÉE de l'adresse donnée, avec les rappels actuels du modèle, SANS
    // rien modifier. Objet marqué « [ESSAI] » : un essai qui ressemble à une
    // vraie alerte apprend à ignorer les vraies.
    if (corps?.tache === "alerte_modele_essai") {
      const email = String(corps?.email ?? "").trim().toLowerCase();
      const hash = email ? await empreinteEmail(email) : null;
      const { data: rows } = hash
        ? await admin.from("alertes_modele").select("email, email_hash, marque, modele, annee, analysis_id")
          .eq("email_hash", hash).not("confirme_le", "is", null).limit(1)
        : { data: [] };
      const x = (rows ?? [])[0];
      if (!x) {
        return new Response(JSON.stringify({ tache: "alerte_modele_essai", envoye: false, raison: "aucune_inscription_confirmee" }), { headers: { "Content-Type": "application/json" } });
      }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/rappels`, {
        method: "POST", signal: AbortSignal.timeout(30_000),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ marque: x.marque, modele: x.modele, annee: x.annee }),
      });
      const j = await res.json().catch(() => null);
      const titres = Array.isArray(j?.rappels) ? j.rappels.slice(0, 5).map((r: { titre?: string }) => String(r.titre ?? "").slice(0, 160)) : [];
      const vehicule = [x.marque, x.modele, x.annee].filter(Boolean).join(" ");
      const envoye = await emailRappelModele(x.email, vehicule, titres.length ? titres : ["(essai : aucun rappel publié à ce jour pour ce modèle)"], x.analysis_id, x.email_hash, true);
      await admin.from("events").insert({ name: "alerte_modele_essai", props_json: { envoye, rappels: titres.length } });
      return new Response(JSON.stringify({ tache: "alerte_modele_essai", envoye, vehicule, rappels: titres.length }), { headers: { "Content-Type": "application/json" } });
    }

    if (corps?.tache === "sante") {
      const detail = String(corps?.detail ?? "").slice(0, 300).replace(/[<>]/g, "");
      const etat = await alerterUneFoisParHeure(
        admin,
        "fonction_en_erreur",
        `<p>Le point de contrôle <code>/api/sante</code> signale qu'une brique ne répond plus.</p>
         <p><strong>Détail&nbsp;:</strong> <code>${detail || "non précisé"}</code></p>
         <p>À vérifier&nbsp;: l'état du projet Supabase, puis le déploiement des fonctions
            <code>score</code> et <code>rappels</code>.</p>`,
        alerteExploitant,
        detail.slice(0, 60),
      );
      return new Response(JSON.stringify({ tache: "sante", etat }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("tache sante:", e);
  }

  const bilan = {
    vehicules_verifies: 0,
    alertes_rappel: 0,
    invitations_envoyees: 0,
    invitations_ignorees: 0,
    textes_api_purges: 0,
    preuves_api_purgees: 0,
    autorisations_relachees: 0,
    rapports_en_retard: 0,
    photos_inspection_purgees: 0,
    preuves_absence_purgees: 0,
    pannes_portees: 0,
    pannes_total: 0,
    coordonnees_vendeur_purgees: 0,
    alertes_modele_envoyees: 0,
    alertes_modele_purgees: 0,
    bilan_envoye: false,
    erreurs: 0,
  };

  try {
    // ================= 1. Rappels sur les modèles suivis =================
    const { data: suivis } = await admin
      .from("dossier")
      .select("id, user_id, analysis_id, statut, rappels_vus, analyses!inner(marque, modele, annee, result_json, is_eval)")
      .eq("alertes", true)
      .eq("analyses.is_eval", false)
      // SPRINT 23 lot 3 : un rappel publié APRÈS l'achat compte autant, sinon
      // plus — le véhicule est désormais celui de l'acheteur. « abandonne »
      // reste exclu : on n'écrit pas au sujet d'une voiture qu'on n'a pas prise.
      .in("statut", ["a_voir", "visite", "achete"])
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
        // ⚠️ RappelConso indisponible n'est PAS « zéro rappel » : compter 0
        // abaisserait la référence, et le passage suivant enverrait une
        // fausse alerte pour tous les rappels déjà connus.
        if (!res.ok || !Array.isArray(json?.rappels) || json?.indisponible === true) {
          parVehicule.set(k, null);
          bilan.erreurs += 1;
          continue;
        }
        const rappels: Rappel[] = json.rappels;
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
        const envoye = await emailNouveauRappel(email, d.analysis_id, vehicule, etat.titres.slice(0, 5), d.user_id, d.statut === "achete");
        await admin.from("events").insert({
          name: "alerte_rappel_envoyee",
          analysis_id: d.analysis_id,
          props_json: { user_id: d.user_id, avant: d.rappels_vus, apres: etat.count, envoye, achete: d.statut === "achete" },
        });
        if (envoye) bilan.alertes_rappel += 1;
      }
      await admin.from("dossier").update({ rappels_vus: etat.count }).eq("id", d.id);
    }

    // ===== 1 bis. Alertes « rappel sur ce modèle » SANS compte (sprint 23) ====
    await passeAlertesModele(admin, parVehicule, bilan);

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

    // ========== 3. Purge des textes d'annonces reçues par API (30 jours) ====
    // L'usage (date, clé, nombre) reste pour la comptabilité ; le texte, lui,
    // n'a plus aucune raison d'être conservé (CUA art. 6.4). La fonction pose
    // d'abord l'empreinte sha256, et n'efface QUE les textes qui en portent
    // une : c'est l'ordre des deux passes qui garantit la preuve.
    try {
      const { data: purgees } = await admin.rpc("purger_textes_api");
      bilan.textes_api_purges = Number(purgees ?? 0);
    } catch (e) {
      console.error("purger_textes_api:", e);
      bilan.erreurs += 1;
    }

    // ========== 4. Expiration des preuves d'API (5 ans) ====================
    // Passé la durée que nous avons ANNONCÉE, la preuve s'en va : résultat et
    // empreinte. Conserver plus longtemps que l'engagement pris serait une
    // rétention sans base légale (CUA art. 6.4, art. L110-4 C. com.).
    try {
      const { data: expirees } = await admin.rpc("purger_preuves_api");
      bilan.preuves_api_purgees = Number(expirees ?? 0);
    } catch (e) {
      console.error("purger_preuves_api:", e);
      bilan.erreurs += 1;
    }

    // ========== 5. Autorisations non confirmées à 48 h ====================
    // Personne n'a pris la mission : on RELÂCHE l'autorisation. Rien n'a
    // jamais été débité, et l'acheteur doit l'apprendre de nous.
    // ⚠️ 48 h et pas plus : une autorisation de carte ne tient que 7 jours.
    // Laissée filer, elle expirerait chez Stripe et la mission serait
    // confirmable sans être payable.
    try {
      const { data: aExpirer } = await admin.rpc("inspections_a_expirer", { p_limite: 50 });
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2023-10-16" });
      for (const insp of (aExpirer ?? [])) {
        const { data: pris } = await admin.rpc("inspection_expirer", { p_inspection_id: insp.id });
        if (pris !== true) continue; // quelqu'un l'a prise entre-temps
        const res = await executerDecision(stripe, admin, insp.id, {
          action: "annuler_autorisation",
          payment_intent: insp.stripe_payment_intent,
        });
        if (!res.ok) {
          bilan.erreurs += 1;
          await alerteExploitant(
            "Inspexo — autorisation non relâchée",
            `<p>Inspection ${insp.id} expirée, mais l'autorisation n'a pas pu être annulée.</p>
             <p>Erreur : ${res.erreur ?? "inconnue"}</p>`,
          );
        }
        bilan.autorisations_relachees += 1;
        try {
          const [{ data: acheteur }, { data: analyse }] = await Promise.all([
            admin.auth.admin.getUserById(insp.acheteur_id),
            admin.from("analyses").select("marque, modele").eq("id", insp.analysis_id).maybeSingle(),
          ]);
          if (acheteur?.user?.email) {
            await emailAutorisationExpiree(
              acheteur.user.email,
              [analyse?.marque, analyse?.modele].filter(Boolean).join(" ") || "votre véhicule",
              insp.analysis_id ?? null,
            );
          }
        } catch (e) {
          console.error("email d'expiration:", e);
        }
      }
    } catch (e) {
      console.error("expiration des autorisations:", e);
      bilan.erreurs += 1;
    }

    // ========== 6. Rapports non remis sous 24 h ===========================
    // L'acheteur attend un rapport qu'il a payé. Une alerte exploitant, une
    // seule par inspection (`rapport_alerte_le`).
    try {
      const { data: retards } = await admin.rpc("inspections_rapport_en_retard", { p_limite: 50 });
      for (const insp of (retards ?? [])) {
        await alerteRapportEnRetard(insp.id, insp.ref_num ?? null, insp.creneau_confirme ?? null);
        await admin.rpc("inspection_noter_alerte_rapport", { p_inspection_id: insp.id });
        bilan.rapports_en_retard += 1;
      }
    } catch (e) {
      console.error("rapports en retard:", e);
      bilan.erreurs += 1;
    }

    // ========== 7. Conservation : appliquer les durées ANNONCÉES ==========
    // CGV et politique de confidentialité : photos du rapport 2 ans,
    // constatations écrites 5 ans, coordonnées du vendeur 3 mois. Une durée
    // écrite que rien n'applique serait une promesse fausse.
    try {
      const { data: lots } = await admin.rpc("inspections_photos_a_purger", { p_limite: 20 });
      for (const lot of (lots ?? [])) {
        const chemins: string[] = Array.isArray(lot.chemins) ? lot.chemins : [];
        if (chemins.length > 0) {
          // Le stockage n'est pas une table : la suppression des fichiers se
          // fait ici, en service role, AVANT de marquer la ligne purgée.
          const { error } = await admin.storage.from("rapports").remove(chemins);
          if (error) {
            console.error("suppression des photos d'inspection:", error);
            bilan.erreurs += 1;
            continue; // la ligne reste à purger : on repassera demain
          }
        }
        await admin.rpc("inspection_noter_photos_purgees", { p_inspection_id: lot.inspection_id });
        bilan.photos_inspection_purgees += 1;
      }
    } catch (e) {
      console.error("purge des photos d'inspection:", e);
      bilan.erreurs += 1;
    }

    // Photo de constat d'absence : UN AN (litiges et contestations de
    // paiement), puis suppression. Elle est conservée, donc elle doit être
    // annoncée et purgée comme le reste.
    try {
      const { data: preuves } = await admin.rpc("inspections_preuves_a_purger", { p_limite: 20 });
      for (const p of (preuves ?? [])) {
        if (p.chemin) {
          const { error } = await admin.storage.from("rapports").remove([p.chemin]);
          if (error) {
            console.error("suppression de la photo de constat:", error);
            bilan.erreurs += 1;
            continue;
          }
        }
        await admin.rpc("inspection_noter_preuve_purgee", { p_inspection_id: p.inspection_id });
        bilan.preuves_absence_purgees += 1;
      }
    } catch (e) {
      console.error("purge des preuves d'absence:", e);
      bilan.erreurs += 1;
    }

    // ========== 8. Recompter les pannes portées par une source =============
    //
    // Chiffre PUBLIÉ sur /fiabilite et sur l'accueil (décision d'Utku du
    // 6 nov. 2026 : « publié tel quel »).
    //
    // ⚠️ IL EST RECALCULÉ CHAQUE JOUR, JAMAIS ÉCRIT À LA MAIN. La ligne
    // « publié dès 50 dossiers relus à la main » de l'accueil a menti pendant
    // un mois parce qu'elle était figée dans un fichier. Toute phrase qui
    // annonce un état doit lire cet état — et un état qui bouge (la campagne
    // de re-sourcing ajoute des sources, chaque fiche générée en ajoute
    // d'autres) doit être repris à la source, pas recopié.
    //
    // ⚠️ Et le comptage est fait ICI, en TypeScript, parce que `rangSource`
    // n'existe qu'en TypeScript. Le refaire en SQL créerait une seconde liste
    // d'hôtes : deux chiffres qui divergent, dont un public qui cesserait de
    // décrire la règle réellement appliquée au score.
    try {
      const compte = await recompterPannesPortees(admin);
      bilan.pannes_portees = compte.portees;
      bilan.pannes_total = compte.total;
    } catch (e) {
      console.error("comptage des pannes portées:", e);
      bilan.erreurs += 1;
    }

    try {
      const { data: n } = await admin.rpc("purger_coordonnees_vendeur");
      bilan.coordonnees_vendeur_purgees = Number(n ?? 0);
      await admin.rpc("purger_rapports_inspection");
    } catch (e) {
      console.error("purge des coordonnées vendeur:", e);
      bilan.erreurs += 1;
    }

    // ================= SPRINT 17 — Bilan quotidien =================
    //
    // Porté par le cron EXISTANT : un second cron, c'est une seconde chose
    // qui peut s'arrêter sans bruit. Il part en DERNIER, après toutes les
    // passes, pour que leurs effets du jour y figurent.
    //
    // ⚠️ Le cron tourne à 07:00 UTC : 8 h en heure d'hiver, 9 h en heure
    // d'été. Vercel ne planifie qu'en UTC, et déplacer l'heure deux fois par
    // an serait une occasion d'oublier. Le bilan porte donc son heure d'envoi.
    try {
      const hier = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
      const { data: b, error } = await admin.rpc("bilan_quotidien", { p_jour: hier });
      if (error) throw error;
      const jourFr = hier.split("-").reverse().join("/");
      const envoye = await alerteExploitant(
        sujetBilan(jourFr),
        bilanHtml(b) +
          `<p style="color:#6B7280;font-size:12px">Envoyé à ${
            new Date().toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })
          } (Paris). Le cron est planifié en UTC&nbsp;: 8 h l'hiver, 9 h l'été.</p>`,
      );
      bilan.bilan_envoye = envoye;
      await admin.from("events").insert({
        name: envoye ? "bilan_quotidien_envoye" : "bilan_quotidien_non_envoye",
        props_json: { jour: hier, analyses: Number(b?.analyses ?? 0), cout_ia_eur: Number(b?.cout_ia_eur ?? 0) },
      });
    } catch (e) {
      console.error("bilan quotidien:", e);
      bilan.erreurs += 1;
    }

    return new Response(JSON.stringify(bilan), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("alertes error:", err);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
  }
});
