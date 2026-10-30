// Notifications email (Resend) — alerte exploitant et envoi de verdict.
// Si RESEND_API_KEY est absente, rien n'est envoyé et un event le trace :
// aucune erreur n'est propagée à l'utilisateur final.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? null;
const UNSUB_SECRET = Deno.env.get("UNSUB_SECRET") ?? null;
const SUPABASE_URL_PUB = Deno.env.get("SUPABASE_URL") ?? "";
const FROM = "Inspexo <contact@inspexo.io>";
const ADMIN_EMAIL = "contact@inspexo.io";

async function sendMail(
  to: string,
  subject: string,
  html: string,
  headers?: Record<string, string>,
): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, ...(headers ? { headers } : {}) }),
    });
    if (!res.ok) {
      console.error("resend error:", res.status, (await res.text()).slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.error("resend exception:", err);
    return false;
  }
}

// ---------- Désinscription en un clic (sprint 3.1) ----------
// Lien SIGNÉ (HMAC-SHA256, secret UNSUB_SECRET) vers la fonction
// `desinscription` : infalsifiable sans le secret, aucun login requis.
// En-têtes RFC 8058 (List-Unsubscribe + List-Unsubscribe-Post) sur chaque
// email d'alerte du dossier.
export async function signatureDesinscription(userId: string): Promise<string | null> {
  if (!UNSUB_SECRET) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(UNSUB_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`desinscription:${userId}`));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function lienDesinscription(userId: string): Promise<string | null> {
  const t = await signatureDesinscription(userId);
  return t ? `${SUPABASE_URL_PUB}/functions/v1/desinscription?u=${userId}&t=${t}` : null;
}

function enTetesDesinscription(lien: string | null): Record<string, string> | undefined {
  if (!lien) return undefined;
  return {
    "List-Unsubscribe": `<${lien}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Alerte exploitant « service IA indisponible », au plus une par heure. */
// deno-lint-ignore no-explicit-any
export async function alerteServiceIndisponible(admin: any, detail: string): Promise<void> {
  try {
    const { count } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("name", "alerte_service_envoyee")
      .gte("created_at", new Date(Date.now() - 3600 * 1000).toISOString());
    if ((count ?? 0) > 0) return; // déjà alerté dans l'heure

    const { count: enAttente } = await admin
      .from("pending_analyses")
      .select("id", { count: "exact", head: true })
      .eq("statut", "en_attente");

    const envoye = await sendMail(
      ADMIN_EMAIL,
      "Inspexo — service d'analyse indisponible",
      `<p>Les appels à l'API Anthropic échouent.</p>
       <p><strong>Détail renvoyé par l'API :</strong><br><code>${detail.replace(/[<>]/g, "").slice(0, 400)}</code></p>
       <p><strong>Demandes en attente :</strong> ${enAttente ?? 0}</p>
       <p>Les demandes en attente seront rejouées automatiquement dès le rétablissement du service.</p>`,
    );
    await admin.from("events").insert({
      name: envoye ? "alerte_service_envoyee" : "alerte_service_non_envoyee",
      props_json: { detail: detail.slice(0, 300), en_attente: enAttente ?? 0 },
    });
  } catch (err) {
    console.error("alerteServiceIndisponible:", err);
  }
}

// Pied commun des emails d'alerte du dossier d'achat : désinscription en UN
// clic (lien signé, sans login) + gestion fine depuis le dossier.
function piedDossier(lienUnsub: string | null): string {
  const unClic = lienUnsub
    ? `<a href="${lienUnsub}">vous désinscrire de toutes les alertes en un clic</a> ou `
    : "";
  return `<p style="color:#6B7280;font-size:12px">Vous recevez cet email parce que cette annonce est suivie dans votre
   <a href="https://www.inspexo.io/dossier">dossier d'achat Inspexo</a>. Vous pouvez ${unClic}gérer
   chaque alerte depuis votre dossier, ou répondre « STOP » à ce message.</p>`;
}

/** Annonce suivie revenue à un autre prix / contenu : alerte aux acheteurs
 *  dont le dossier contient une analyse de la même URL (1 par 24 h chacun). */
// deno-lint-ignore no-explicit-any
export async function alerteAnnonceModifiee(admin: any, p: {
  sourceUrl: string;
  analysisId: string;
  verdict: string;
  score: number;
  label: string;
  marque?: string | null;
  modele?: string | null;
  changements: string[];
}): Promise<void> {
  try {
    const { data: anciennes } = await admin
      .from("analyses")
      .select("id, marque, modele")
      .eq("source_url", p.sourceUrl)
      .eq("is_eval", false)
      .neq("id", p.analysisId)
      .limit(20);
    // Concordance : la nouvelle analyse doit décrire le MÊME véhicule que
    // celle que l'acheteur suit (même marque/modèle identifiés) — un texte
    // fabriqué sur la même URL mais pour un autre véhicule n'alerte personne.
    const normalise = (s: unknown) =>
      String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    // deno-lint-ignore no-explicit-any
    const ids = ((anciennes ?? []) as any[])
      .filter((a) =>
        normalise(a.marque) === normalise(p.marque) &&
        normalise(a.modele) === normalise(p.modele)
      )
      .map((a) => a.id);
    if (ids.length === 0) return;
    const { data: suivis } = await admin
      .from("dossier")
      .select("user_id")
      .in("analysis_id", ids)
      .eq("alertes", true);
    // deno-lint-ignore no-explicit-any
    const users = [...new Set(((suivis ?? []) as any[]).map((s) => s.user_id))];
    const libelle = p.verdict === "vert" ? "Feu vert" : p.verdict === "orange" ? "Prudence" : "Signaux rouges";
    for (const uid of users.slice(0, 20)) {
      const { count } = await admin
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("name", "alerte_annonce_modifiee")
        .contains("props_json", { user_id: uid, source_url: p.sourceUrl.slice(0, 300) })
        .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
      if ((count ?? 0) > 0) continue;
      const { data: userData } = await admin.auth.admin.getUserById(uid);
      const email: string | undefined = userData?.user?.email;
      if (!email) continue;
      const lienUnsub = await lienDesinscription(uid);
      const envoye = await sendMail(
        email,
        `Annonce modifiée — ${p.label}`,
        `<p>Une annonce suivie dans votre dossier d'achat vient d'être réanalysée : elle a changé depuis votre analyse.</p>
         ${p.changements.length ? `<p><strong>Changements :</strong> ${p.changements.map((c) => c.replace(/[<>]/g, "")).join(" · ")}</p>` : ""}
         <p style="font-size:18px"><strong>${libelle} — ${p.score}/100</strong><br>${p.label.replace(/[<>]/g, "")}</p>
         <p><a href="https://www.inspexo.io/a/${p.analysisId}">Voir le nouveau verdict</a></p>
         ${piedDossier(lienUnsub)}`,
        enTetesDesinscription(lienUnsub),
      );
      await admin.from("events").insert({
        name: "alerte_annonce_modifiee",
        analysis_id: p.analysisId,
        props_json: { user_id: uid, source_url: p.sourceUrl.slice(0, 300), envoye },
      });
    }
  } catch (err) {
    console.error("alerteAnnonceModifiee:", err);
  }
}

/** Nouveau rappel constructeur publié sur un modèle suivi. */
export async function emailNouveauRappel(
  to: string,
  analysisId: string,
  vehicule: string,
  titres: string[],
  userId: string,
): Promise<boolean> {
  const lienUnsub = await lienDesinscription(userId);
  return await sendMail(
    to,
    `Nouveau rappel constructeur — ${vehicule}`,
    `<p>Un rappel constructeur vient d'être publié dans la base officielle RappelConso pour un modèle suivi dans votre dossier d'achat :</p>
     <ul>${titres.slice(0, 5).map((t) => `<li>${t.replace(/[<>]/g, "")}</li>`).join("")}</ul>
     <p><a href="https://www.inspexo.io/a/${analysisId}">Revoir l'analyse et le bloc rappels</a> —
     confirmez toujours avec le VIN auprès du constructeur.</p>
     ${piedDossier(lienUnsub)}`,
    enTetesDesinscription(lienUnsub),
  );
}

/** J+30 après « acheté » : demande de retour d'issue (pannes confirmées, prix payé). */
export async function emailRetourIssue(
  to: string,
  vehicule: string,
  userId: string,
): Promise<boolean> {
  const lienUnsub = await lienDesinscription(userId);
  return await sendMail(
    to,
    `Un mois après votre achat — comment se comporte votre ${vehicule} ?`,
    `<p>Il y a un mois, vous avez marqué « acheté » sur une analyse Inspexo.</p>
     <p>Deux minutes pour nous dire ce qu'il en est réellement (pannes confirmées ou non, prix payé) :
     votre retour sert à mesurer — et publier — la justesse de nos analyses.</p>
     <p><a href="https://www.inspexo.io/dossier">Laisser mon retour dans mon dossier d'achat</a></p>
     ${piedDossier(lienUnsub)}`,
    enTetesDesinscription(lienUnsub),
  );
}

/** Confirmation d'achat du Pass (sprint 7) — email transactionnel. */
export async function emailPassActif(
  to: string,
  fin: Date,
  mode: "precommande" | "vente",
): Promise<boolean> {
  const finFr = fin.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return await sendMail(
    to,
    "Votre Pass achat Inspexo est actif",
    `<p>Merci — votre Pass achat${mode === "precommande" ? " (précommande)" : ""} est actif
     jusqu'au <strong>${finFr}</strong> : analyses illimitées, visite guidée complète,
     négociation détaillée, lecture du PV de contrôle technique et kit signature.</p>
     <p>Pour en profiter, connectez-vous avec <strong>cette adresse email</strong> (lien
     magique, sans mot de passe) :</p>
     <p><a href="https://www.inspexo.io/dossier">Ouvrir mon dossier d'achat</a></p>
     <p style="color:#6B7280;font-size:12px">Reçu et conditions disponibles dans l'email Stripe séparé.
     Droit de rétractation : voir les <a href="https://www.inspexo.io/cgv-pass">CGV du Pass</a>.
     Aucune reconduction automatique : le Pass s'arrête seul au bout de 30 jours.<br>
     Vous recevez cet email parce que vous venez d'acheter un Pass. Pour toute question, répondez à ce message.</p>`,
    { "List-Unsubscribe": "<mailto:contact@inspexo.io?subject=STOP>" },
  );
}

/** Confirmation de remboursement du Pass (sprint 7). */
export async function emailPassRembourse(to: string, montantCents: number): Promise<boolean> {
  const montant = (montantCents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 });
  return await sendMail(
    to,
    "Votre Pass achat Inspexo a été remboursé",
    `<p>Votre Pass achat a été remboursé (${montant} €). Le remboursement apparaît sous
     5 à 10 jours ouvrés sur le moyen de paiement utilisé, selon votre banque.</p>
     <p>L'accès aux fonctions du Pass est désactivé. Les analyses gratuites restent, elles,
     toujours disponibles.</p>
     <p style="color:#6B7280;font-size:12px">Pour toute question, répondez à ce message.</p>`,
    { "List-Unsubscribe": "<mailto:contact@inspexo.io?subject=STOP>" },
  );
}

/** Envoi du verdict à un acheteur dont la demande était en attente. */
export async function envoyerVerdict(
  to: string,
  analysisId: string,
  verdict: string,
  score: number,
  vehicule: string,
): Promise<boolean> {
  const couleur = verdict === "vert" ? "#16A34A" : verdict === "orange" ? "#D97706" : "#DC2626";
  const libelle = verdict === "vert" ? "Feu vert" : verdict === "orange" ? "Prudence" : "Signaux rouges";
  return await sendMail(
    to,
    `Votre analyse Inspexo est prête — ${libelle} (${score}/100)`,
    `<p>Le service était momentanément indisponible lors de votre demande : votre analyse vient d'être réalisée.</p>
     <p style="font-size:18px"><strong style="color:${couleur}">${libelle} — ${score}/100</strong><br>${vehicule}</p>
     <p><a href="https://www.inspexo.io/a/${analysisId}">Voir le verdict complet</a></p>
     <p style="color:#6B7280;font-size:12px">Analyse automatique à partir du texte de l'annonce. Ne remplace pas un examen du véhicule.<br>
     Vous recevez cet email parce que vous avez demandé à être prévenu. Pour ne plus rien recevoir, répondez « STOP » à ce message.</p>`,
    { "List-Unsubscribe": "<mailto:contact@inspexo.io?subject=STOP>" },
  );
}
