// SPRINT 23 — Alerte [URGENT] quand le juge se tait (décision d'Utku du
// 11 nov. 2026) : plus de 10 % des affirmations d'un passage sans verdict.
// Une alerte par heure au plus (mécanique commune `alerterUneFoisParHeure`).
import { alerterUneFoisParHeure } from "./alerting.ts";
import { passageTropSilencieux } from "./jugeStable.ts";
import { alerteExploitant } from "./notify.ts";

export async function surveillerSilences(
  // deno-lint-ignore no-explicit-any
  admin: any,
  fonction: string,
  silences: Array<{ n: number; sans: number }>,
  url?: string,
): Promise<void> {
  const pire = silences.find((s) => passageTropSilencieux(s.sans, s.n));
  if (!pire || !admin) return;
  try {
    await alerterUneFoisParHeure(
      admin,
      "silences_juge",
      `<p>Le juge de vérification a rendu un passage où <strong>${pire.sans} affirmation(s) sur ${pire.n}</strong>
         sont restées <strong>sans verdict</strong> (seuil : plus de 10 %).</p>
       <p><strong>Fonction&nbsp;:</strong> ${fonction.replace(/[<>]/g, "")}<br>
          <strong>Page&nbsp;:</strong> <code>${String(url ?? "").replace(/[<>]/g, "").slice(0, 300)}</code></p>
       <p>Un silence n'est jamais compté comme un vote ni mis au cache, mais un silence massif signale
          un changement de forme des réponses du modèle (cf. verdicts encodés en chaîne JSON, 10 nov. 2026).
          Lancer un appel <code>debug</code> sur <code>sources-externes</code>.</p>`,
      alerteExploitant,
      fonction,
    );
  } catch (e) {
    console.error("surveillerSilences:", e);
  }
}
