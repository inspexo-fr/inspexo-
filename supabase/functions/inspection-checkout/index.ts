// SPRINT 8 — Commande d'une inspection (179 € TTC, sous 48 h).
//
// GET  → configuration publique : la vente est-elle OUVERTE, et sur quelle
//        zone ? Elle ne l'est que si TROIS conditions sont réunies :
//        MEDIATEUR_NOM renseigné, clé Stripe présente, et au moins un
//        inspecteur VALIDÉ dont le compte Connect accepte les versements.
//        Avec ?cp=31000 : disponibilité réelle du département demandé.
// POST → session Stripe Checkout + ligne `inspections` au statut a_payer.
//        Le paiement n'attribue RIEN : l'activation se fait exclusivement
//        dans inspection-webhook, à réception de l'événement signé.
//
// Séparation charge / transfert (Stripe Connect) : la charge porte un
// transfer_group, et le versement des 60 % à l'inspecteur réutilise LE MÊME
// transfer_group, au moment où le rapport est rendu. L'ancien code du
// parcours expert posait deux transfer_group différents — la charge et le
// transfert n'étaient donc reliés par rien.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  departementDeCp,
  prestation,
  type TypePrestation,
  validerCreneau,
} from "../_shared/inspection.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? null;
const MEDIATEUR_NOM = (Deno.env.get("MEDIATEUR_NOM") ?? "").trim();
const IP_HASH_SALT = Deno.env.get("IP_HASH_SALT");
if (!IP_HASH_SALT) throw new Error("IP_HASH_SALT manquant — configurez le secret.");

const ORIGINE = "https://www.inspexo.io";
const CGV_VERSION = "2026-11-03";
const COMMANDES_MAX_PAR_IP = 6; // par 24 h

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const first = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

/** Y a-t-il au moins un inspecteur opérationnel ? (condition d'ouverture)
 *
 *  ⚠️ PAR TYPE DE PRESTATION. Une inspection exige un inspecteur couvrant LE
 *  DÉPARTEMENT ; une visio exige un inspecteur ayant ACTIVÉ l'option, sans
 *  aucune contrainte géographique. Appliquer le filtre de département à une
 *  visio fermerait un service qui n'a pourtant pas de zone. */
// deno-lint-ignore no-explicit-any
async function inspecteurOperationnel(
  admin: any,
  dept: string | null,
  type: TypePrestation = "inspection",
): Promise<boolean> {
  let q = admin.from("inspecteurs").select("id", { count: "exact", head: true })
    .eq("statut", "valide").eq("stripe_paiements_actifs", true);
  if (type === "visio") q = q.eq("visio", true);
  else if (dept) q = q.contains("departements", [dept]);
  const { count } = await q;
  return (count ?? 0) > 0;
}

/** Le drapeau de la prestation est-il allumé pour cet appelant ? */
// deno-lint-ignore no-explicit-any
async function drapeauOuvert(req: Request, type: TypePrestation): Promise<boolean> {
  if (type !== "visio") return true; // l'inspection n'a pas de drapeau
  const commeAppelant = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const { data } = await commeAppelant.rpc("drapeau_actif", { p_cle: "visio_guidee" });
  return data === true;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ---------------- Configuration publique ----------------
  if (req.method === "GET") {
    const url = new URL(req.url);
    const type: TypePrestation = url.searchParams.get("type") === "visio" ? "visio" : "inspection";
    const p = prestation(type);
    const cp = url.searchParams.get("cp");
    const dept = cp ? departementDeCp(cp) : null;
    // Le service n'existe pour le public que si un inspecteur peut réellement
    // y répondre ET que le cadre légal est en place. Pour la visio s'ajoute le
    // drapeau, éteint par défaut.
    const base = MEDIATEUR_NOM.length > 0 && !!STRIPE_SECRET_KEY
      && await drapeauOuvert(req, type);
    const auMoinsUn = base ? await inspecteurOperationnel(admin, null, type) : false;
    const dansZone = base && dept
      ? await inspecteurOperationnel(admin, dept, type)
      : false;
    return json({
      type,
      ouvert: base && auMoinsUn,
      zone_libelle: p.zone_libelle,
      prix_cents: p.prix_cents,
      part_inspecteur_cents: p.part_inspecteur_cents,
      retenue_cents: p.retenue_cents,
      attente_absence_minutes: p.attente_absence_minutes,
      rapport_heures: p.rapport_heures,
      annulation_gratuite_heures: p.annulation_gratuite_heures,
      delai_heures: 48,
      mediateur: base ? MEDIATEUR_NOM : null,
      cgv_version: CGV_VERSION,
      ...(cp ? { code_postal: cp, departement: dept, disponible_zone: dansZone } : {}),
    });
  }

  try {
    // Ce contrôle précède la lecture du corps, donc le type de prestation
    // n'est pas encore connu : le message doit valoir pour les deux. Nommer
    // « l'inspection » ici répondait « l'inspection n'est pas ouverte » à une
    // demande de visio.
    if (!STRIPE_SECRET_KEY || MEDIATEUR_NOM.length === 0) {
      return json({
        error: "inspection_indisponible",
        message: "Ce service n'est pas encore ouvert. Laissez votre email pour être prévenu.",
      }, 409);
    }

    // L'acheteur doit être connecté : l'inspection vit dans SON dossier et
    // le rapport lui sera remis.
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(jwt);
    const user = u?.user ?? null;
    if (!user) {
      return json({
        error: "connexion_requise",
        message: "Connectez-vous (lien magique) pour commander une inspection : le rapport sera déposé dans votre dossier.",
      }, 401);
    }

    const body = await req.json().catch(() => null);
    const analysisId = typeof body?.analysis_id === "string" && /^[0-9a-f-]{36}$/i.test(body.analysis_id)
      ? body.analysis_id
      : null;
    if (!analysisId) return json({ error: "invalid_input", message: "Analyse introuvable." }, 400);

    const type: TypePrestation = body?.type === "visio" ? "visio" : "inspection";
    const p = prestation(type);

    // Drapeau : la visio reste fermée tant qu'il n'est pas allumé.
    if (!(await drapeauOuvert(req, type))) {
      return json({
        error: "fonction_fermee",
        message: "La visio guidée n'est pas encore ouverte. Elle le sera après un premier appel réel de bout en bout.",
      }, 403);
    }

    const cp = String(body?.code_postal ?? "").replace(/\s/g, "");
    const dept = departementDeCp(cp);
    // Un code postal VALIDE est exigé même pour la visio : on ne commande pas
    // un rendez-vous sans savoir où se trouve la voiture.
    if (!dept) return json({ error: "invalid_input", message: "Code postal invalide." }, 400);

    if (!(await inspecteurOperationnel(admin, dept, type))) {
      return json({
        error: "zone_non_couverte",
        message: type === "visio"
          ? "Aucun inspecteur disponible en visio pour l'instant. Réessayez un peu plus tard."
          : `Aucun inspecteur disponible sur ce secteur pour l'instant (${p.zone_libelle} au lancement).`,
      }, 409);
    }

    const creneau = validerCreneau(body?.creneau);
    if (!creneau.ok) return json({ error: "creneau_invalide", message: creneau.raison }, 400);

    // Rétractation (L221-25) : sans demande EXPRESSE d'exécution avant la fin
    // des 14 jours, l'acheteur garderait son droit de rétractation après
    // l'inspection réalisée — inspecteur payé, acheteur remboursé. La case est
    // distincte de l'acceptation des CGV et n'est jamais pré-cochée côté
    // client ; ici, on refuse simplement la commande sans elle.
    if (body?.execution_immediate !== true) {
      return json({
        error: "execution_immediate_requise",
        message:
          "Vous devez demander expressément que l'inspection soit réalisée avant la fin du délai de rétractation de 14 jours.",
      }, 400);
    }
    if (body?.accepte_cgv !== true) {
      return json({ error: "cgv_requises", message: "Vous devez accepter les conditions de l'inspection." }, 400);
    }

    // Coordonnées du véhicule : conservées pour l'inspecteur, révélées
    // seulement après son acceptation (RPC inspecteur_missions).
    const vendeurNom = String(body?.vendeur_nom ?? "").slice(0, 120);
    const vendeurTel = String(body?.vendeur_telephone ?? "").slice(0, 30);
    const vendeurAdresse = String(body?.vendeur_adresse ?? "").slice(0, 240);
    if (!vendeurAdresse || !vendeurTel) {
      return json({
        error: "invalid_input",
        message: "Adresse du véhicule et téléphone du vendeur sont nécessaires à l'inspecteur.",
      }, 400);
    }

    const { data: analyse } = await admin
      .from("analyses").select("id, marque, modele").eq("id", analysisId).maybeSingle();
    if (!analyse) return json({ error: "not_found", message: "Analyse introuvable." }, 404);

    // Rate limit anti-TOCTOU : tentative insérée AVANT le comptage.
    const ipHash = await sha256Hex(IP_HASH_SALT + clientIp(req));
    await admin.from("events").insert({
      name: "inspection_commande", analysis_id: analysisId, ip_hash: ipHash,
      props_json: { departement: dept },
    });
    const { count } = await admin.from("events")
      .select("id", { count: "exact", head: true })
      .eq("name", "inspection_commande").eq("ip_hash", ipHash)
      .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
    if ((count ?? 0) > COMMANDES_MAX_PAR_IP) {
      return json({ error: "rate_limited", message: "Trop de commandes. Réessayez demain." }, 429);
    }

    // Ligne d'inspection AVANT la session : son id sert de transfer_group,
    // ce qui relie la charge et le futur versement sans ambiguïté.
    const { data: insp, error: insErr } = await admin
      .from("inspections")
      .insert({
        analysis_id: analysisId,
        acheteur_id: user.id,
        code_postal: cp,
        departement: dept,
        vendeur_nom: vendeurNom || null,
        vendeur_telephone: vendeurTel,
        vendeur_adresse: vendeurAdresse,
        creneau_souhaite: creneau.date.toISOString(),
        // Montants FIGÉS à la commande, par type de prestation. Une
        // évolution de tarif ne doit jamais réécrire le passé.
        type,
        prix_cents: p.prix_cents,
        part_inspecteur_cents: p.part_inspecteur_cents,
        statut: "a_payer",
      })
      .select("id")
      .single();
    if (insErr || !insp) {
      console.error("inspection insert:", insErr);
      return json({ error: "db_error", message: "Commande impossible. Réessayez." }, 500);
    }
    const transferGroup = `inspection_${insp.id}`;

    const vehicule = [analyse.marque, analyse.modele].filter(Boolean).join(" ") || "véhicule";
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Carte uniquement : un moyen à notification différée (SEPA) encaisse
      // en plusieurs jours alors que le produit promet une inspection sous
      // 48 h — et l'événement async_payment_succeeded n'est pas dans notre
      // chaîne. L'acheteur serait débité sans qu'aucun inspecteur ne soit
      // prévenu (audit du 2 nov., mineur n° 7).
      payment_method_types: ["card"],
      customer_email: user.email ?? undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: p.prix_cents,
          product_data: {
            name: `${p.libelle} — ${vehicule}`,
            description: type === "visio"
              ? "Appel vidéo de 30 à 40 minutes avec un inspecteur indépendant, qui vous guide point par point depuis votre téléphone. Compte rendu écrit sous 2 heures. Appel jamais enregistré. Prix TTC. Montant autorisé maintenant, débité seulement quand un inspecteur confirme."
              : "Inspection par un professionnel indépendant, sur place, sous 48 heures. Rapport photo remis dans votre dossier Inspexo. Prix TTC. Montant autorisé maintenant, débité seulement quand un inspecteur confirme.",
          },
        },
      }],
      success_url: `${ORIGINE}/a/${analysisId}?${type}=ok`,
      cancel_url: `${ORIGINE}/a/${analysisId}?${type}=annule`,
      payment_intent_data: {
        description: `Inspexo — ${p.libelle.toLowerCase()} ${vehicule}`,
        // PAIEMENT EN DEUX TEMPS. À la commande, le montant est seulement
        // AUTORISÉ ; il n'est débité qu'au moment où un inspecteur confirme
        // (capture dans `inspecteur-mission`). Personne ne paie pour une
        // mission que personne n'a prise.
        // ⚠️ Une autorisation de carte ne tient que 7 jours : la fenêtre de
        // confirmation est à 48 h, et le cron relâche au-delà.
        capture_method: "manual",
        // Charge et transfert séparés : le groupe est posé ICI et réutilisé
        // tel quel au versement (inspection-rapport).
        transfer_group: transferGroup,
      },
      metadata: {
        produit: "inspection",
        // Le webhook n'a pas accès à notre table avant de retrouver la ligne :
        // le type voyage avec la session.
        type,
        inspection_id: insp.id,
        analysis_id: analysisId,
        departement: dept,
        cgv_version: CGV_VERSION,
      },
    });
    if (!session.url) throw new Error("session Stripe sans URL");

    await admin.from("inspections")
      .update({
        stripe_session: session.id,
        transfer_group: transferGroup,
        // Preuve de la demande d'exécution immédiate, avec la version du texte
        // accepté : c'est ce couple qui vaut consentement, pas la case seule.
        execution_immediate_le: new Date().toISOString(),
        cgv_version: CGV_VERSION,
        maj_le: new Date().toISOString(),
      })
      .eq("id", insp.id);

    return json({ url: session.url, inspection_id: insp.id });
  } catch (error) {
    console.error("inspection-checkout error:", error);
    return json({ error: "internal", message: "Commande impossible. Réessayez." }, 500);
  }
});
