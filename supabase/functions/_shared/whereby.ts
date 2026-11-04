// SPRINT 14 — Création de la salle vidéo (Whereby Embedded).
//
// Pourquoi Whereby plutôt que LiveKit ou Daily (comparaison du 4 nov. 2026) :
//  - « users in European countries will connect to a data center physically
//    located within the EEC », et un DPA publié — c'est le point qui a
//    tranché ;
//  - « Media sent between participants in a room will not be stored » : rien
//    à promettre que le prestataire ne tienne déjà ;
//  - rejoindre depuis le navigateur d'un téléphone SANS application est leur
//    produit, pas une option à construire ;
//  - 0,0042 $/minute-participant, soit ≈ 0,29 $ par visio de 35 min à deux :
//    0,5 % d'une vente de 59 €.
//
// ⚠️ L'ENREGISTREMENT N'EST JAMAIS DEMANDÉ. Aucun champ de cette requête ne
// l'active, et les CGV l'affirment. Si un jour quelqu'un ajoute
// `recording` ici, il contredira un document contractuel.
//
// ⚠️ LE LIEN N'EST PAS UN DROIT D'ENTRÉE. `endDate` ferme la salle côté
// Whereby, mais c'est la fenêtre vérifiée SERVEUR (`fenetreVisio`) qui
// commande l'accès de notre côté : une URL recopiée hors fenêtre ne donne rien.

const API = "https://api.whereby.dev/v1/meetings";

export type SalleVisio = {
  salle: string;
  url_acheteur: string;
  url_inspecteur: string;
};

/** Crée la salle d'une mission. Rend null si la clé n'est pas posée — le
 *  service est alors fermé, et l'appelant le signale sans planter. */
export async function creerSalle(
  creneau: Date,
  opts: { finMinutes?: number } = {},
): Promise<{ ok: true; salle: SalleVisio } | { ok: false; raison: string }> {
  const cle = Deno.env.get("WHEREBY_API_KEY") ?? "";
  if (!cle) return { ok: false, raison: "cle_absente" };

  // La salle vit de 15 minutes avant le créneau à 90 minutes après : au-delà,
  // Whereby la ferme de lui-même. Deux verrous valent mieux qu'un.
  const debut = new Date(creneau.getTime() - 15 * 60_000);
  const fin = new Date(creneau.getTime() + (opts.finMinutes ?? 90) * 60_000);

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        isLocked: false,
        startDate: debut.toISOString(),
        endDate: fin.toISOString(),
        // `viewer` interdit à l'acheteur de piloter la salle ; l'inspecteur est
        // hôte. Aucun champ d'enregistrement : voir l'avertissement ci-dessus.
        roomMode: "normal",
        fields: ["hostRoomUrl"],
      }),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      return { ok: false, raison: `whereby_${res.status}: ${detail}` };
    }
    const d = await res.json();
    const url = String(d?.roomUrl ?? "");
    const hote = String(d?.hostRoomUrl ?? url);
    if (!url) return { ok: false, raison: "reponse_sans_url" };
    return {
      ok: true,
      salle: {
        salle: String(d?.meetingId ?? ""),
        // Caméra arrière par défaut côté acheteur : c'est la voiture qu'il
        // filme, pas son visage.
        url_acheteur: `${url}?camera=rear&chat=off&leaveButton=on`,
        url_inspecteur: `${hote}?chat=off&leaveButton=on`,
      },
    };
  } catch (e) {
    return { ok: false, raison: String((e as Error)?.message ?? e).slice(0, 160) };
  }
}

/** Ferme la salle à la remise du compte rendu. Échec non bloquant : la salle
 *  expire de toute façon par `endDate`. */
export async function supprimerSalle(meetingId: string): Promise<void> {
  const cle = Deno.env.get("WHEREBY_API_KEY") ?? "";
  if (!cle || !meetingId) return;
  try {
    await fetch(`${API}/${encodeURIComponent(meetingId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${cle}` },
    });
  } catch (_) { /* la salle expirera d'elle-même */ }
}
