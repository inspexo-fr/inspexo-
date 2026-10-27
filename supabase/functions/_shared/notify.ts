// Notifications email (Resend) — alerte exploitant et envoi de verdict.
// Si RESEND_API_KEY est absente, rien n'est envoyé et un event le trace :
// aucune erreur n'est propagée à l'utilisateur final.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? null;
const FROM = "Inspexo <contact@inspexo.io>";
const ADMIN_EMAIL = "contact@inspexo.io";

async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
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

// Pied commun des emails d'alerte du dossier d'achat : gestion + désinscription.
const PIED_DOSSIER =
  `<p style="color:#6B7280;font-size:12px">Vous recevez cet email parce que cette annonce est suivie dans votre
   <a href="https://www.inspexo.io/dossier">dossier d'achat Inspexo</a>. Pour ne plus recevoir d'alertes,
   désactivez-les depuis votre dossier ou répondez « STOP » à ce message.</p>`;

/** Annonce suivie revenue à un autre prix / contenu : alerte aux acheteurs
 *  dont le dossier contient une analyse de la même URL (1 par 24 h chacun). */
// deno-lint-ignore no-explicit-any
export async function alerteAnnonceModifiee(admin: any, p: {
  sourceUrl: string;
  analysisId: string;
  verdict: string;
  score: number;
  label: string;
  changements: string[];
}): Promise<void> {
  try {
    const { data: anciennes } = await admin
      .from("analyses")
      .select("id")
      .eq("source_url", p.sourceUrl)
      .eq("is_eval", false)
      .neq("id", p.analysisId)
      .limit(20);
    // deno-lint-ignore no-explicit-any
    const ids = ((anciennes ?? []) as any[]).map((a) => a.id);
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
      const envoye = await sendMail(
        email,
        `Annonce modifiée — ${p.label}`,
        `<p>Une annonce suivie dans votre dossier d'achat vient d'être réanalysée : elle a changé depuis votre analyse.</p>
         ${p.changements.length ? `<p><strong>Changements :</strong> ${p.changements.map((c) => c.replace(/[<>]/g, "")).join(" · ")}</p>` : ""}
         <p style="font-size:18px"><strong>${libelle} — ${p.score}/100</strong><br>${p.label.replace(/[<>]/g, "")}</p>
         <p><a href="https://www.inspexo.io/a/${p.analysisId}">Voir le nouveau verdict</a></p>
         ${PIED_DOSSIER}`,
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
): Promise<boolean> {
  return await sendMail(
    to,
    `Nouveau rappel constructeur — ${vehicule}`,
    `<p>Un rappel constructeur vient d'être publié dans la base officielle RappelConso pour un modèle suivi dans votre dossier d'achat :</p>
     <ul>${titres.slice(0, 5).map((t) => `<li>${t.replace(/[<>]/g, "")}</li>`).join("")}</ul>
     <p><a href="https://www.inspexo.io/a/${analysisId}">Revoir l'analyse et le bloc rappels</a> —
     confirmez toujours avec le VIN auprès du constructeur.</p>
     ${PIED_DOSSIER}`,
  );
}

/** J+30 après « acheté » : demande de retour d'issue (pannes confirmées, prix payé). */
export async function emailRetourIssue(
  to: string,
  vehicule: string,
): Promise<boolean> {
  return await sendMail(
    to,
    `Un mois après votre achat — comment se comporte votre ${vehicule} ?`,
    `<p>Il y a un mois, vous avez marqué « acheté » sur une analyse Inspexo.</p>
     <p>Deux minutes pour nous dire ce qu'il en est réellement (pannes confirmées ou non, prix payé) :
     votre retour sert à mesurer — et publier — la justesse de nos analyses.</p>
     <p><a href="https://www.inspexo.io/dossier">Laisser mon retour dans mon dossier d'achat</a></p>
     ${PIED_DOSSIER}`,
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
  );
}
