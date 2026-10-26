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
