// SPRINT 17 — Alertes d'exploitation : une seule mécanique, quatre motifs.
//
// L'étranglement « une alerte par type et par heure » existait déjà pour le
// service indisponible (`alerteServiceIndisponible`), écrit à la main. Le
// répéter quatre fois aurait produit quatre variantes qui divergeraient.
//
// ⚠️ L'objet des emails est NORMALISÉ, parce qu'il sert de filtre :
//   « [URGENT] Inspexo — … »  pour une alerte
//   « [Bilan] Inspexo — JJ/MM/AAAA » pour le quotidien
// Changer ces préfixes casse silencieusement les règles de boîte mail de
// l'exploitant. Ils sont figés par `tests/alerting.test.mjs`.

export const PREFIXE_URGENT = "[URGENT] Inspexo —";
export const PREFIXE_BILAN = "[Bilan] Inspexo —";

export type MotifAlerte =
  | "credit_ou_cle"
  | "echecs_repetes"
  | "fonction_en_erreur"
  | "cout_du_jour"
  | "silences_juge";

/** Libellé lisible d'un motif, pour l'objet de l'email. */
export const LIBELLE_MOTIF: Record<MotifAlerte, string> = {
  credit_ou_cle: "crédit Anthropic insuffisant ou clé invalide",
  echecs_repetes: "analyses en échec à répétition",
  fonction_en_erreur: "fonction en erreur",
  cout_du_jour: "coût IA du jour au-dessus du seuil",
  silences_juge: "le juge de vérification rend des réponses sans verdict",
};

/** Le détail renvoyé par l'API désigne-t-il un problème de CRÉDIT ou de CLÉ ?
 *
 *  ⚠️ À distinguer d'une surcharge passagère (429, 529, « overloaded ») : la
 *  surcharge se résout seule, le crédit épuisé et la clé invalide **ne se
 *  résolvent pas** et arrêtent le service jusqu'à intervention humaine. Les
 *  confondre, c'est soit crier au loup, soit rester muet pendant une panne
 *  totale. Fonction PURE, testée hors ligne. */
export function estCreditOuCle(code: string, detail: string): boolean {
  const d = `${code ?? ""} ${detail ?? ""}`.toLowerCase();
  // Surcharge passagère : explicitement NON concernée.
  if (/overloaded|capacity|temporarily unavailable/.test(d)) return false;
  return (
    /credit balance|insufficient[ _]?(?:credit|funds|quota)|billing/.test(d) ||
    /authentication[ _]error|invalid[ _](?:x-)?api[ _-]?key|unauthorized/.test(d) ||
    /^api_401\b|\bapi_401\b|^api_403\b|\bapi_403\b/.test(d)
  );
}

/** L'objet d'une alerte, normalisé. */
export function sujetAlerte(motif: MotifAlerte, precision?: string): string {
  const base = `${PREFIXE_URGENT} ${LIBELLE_MOTIF[motif] ?? motif}`;
  return precision ? `${base} (${precision})` : base;
}

/** L'objet du bilan quotidien, normalisé. */
export function sujetBilan(jour: string): string {
  return `${PREFIXE_BILAN} ${jour}`;
}

/** Nom de l'event témoin qui porte l'étranglement d'un motif. */
export const eventTemoin = (motif: MotifAlerte) => `alerte_${motif}_envoyee`;

/** Une alerte de ce motif est-elle déjà partie dans l'heure ?
 *
 *  Le témoin est un event : il survit au redémarrage de la fonction, ce
 *  qu'une variable en mémoire ne ferait pas — une fonction edge peut être
 *  recyclée à chaque requête, et l'étranglement ne tiendrait pas. */
// deno-lint-ignore no-explicit-any
export async function dejaAlerte(admin: any, motif: MotifAlerte, fenetreMs = 3_600_000): Promise<boolean> {
  try {
    const { count } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("name", eventTemoin(motif))
      .gte("created_at", new Date(Date.now() - fenetreMs).toISOString());
    return (count ?? 0) > 0;
  } catch (err) {
    // ⚠️ En cas de doute on N'ENVOIE PAS : une base qui ne répond pas est
    // déjà un incident, et y ajouter une boucle d'emails l'aggrave.
    console.error("dejaAlerte:", err);
    return true;
  }
}

/** Alerte l'exploitant au plus une fois par heure pour ce motif. */
// deno-lint-ignore no-explicit-any
export async function alerterUneFoisParHeure(
  admin: any,
  motif: MotifAlerte,
  corpsHtml: string,
  envoyer: (sujet: string, html: string) => Promise<boolean>,
  precision?: string,
): Promise<"envoyee" | "etranglee" | "echec"> {
  if (await dejaAlerte(admin, motif)) return "etranglee";
  let envoye = false;
  try {
    envoye = await envoyer(sujetAlerte(motif, precision), corpsHtml);
  } catch (err) {
    console.error("alerterUneFoisParHeure:", err);
  }
  try {
    await admin.from("events").insert({
      name: envoye ? eventTemoin(motif) : `alerte_${motif}_non_envoyee`,
      props_json: { motif, precision: (precision ?? "").slice(0, 200) },
    });
  } catch (_) { /* best effort */ }
  return envoye ? "envoyee" : "echec";
}

/** Le bilan quotidien en HTML. Fonction PURE : elle prend le jsonb rendu par
 *  `bilan_quotidien` et n'appelle rien. */
// deno-lint-ignore no-explicit-any
export function bilanHtml(b: any): string {
  const n = (x: unknown) => Number(x ?? 0);
  const carte = (o: Record<string, unknown> | null | undefined) => {
    const e = Object.entries(o ?? {});
    if (e.length === 0) return "<em>aucun</em>";
    return e.sort((a, b2) => n(b2[1]) - n(a[1])).map(([k, v]) => `${k}&nbsp;: <strong>${n(v)}</strong>`).join(" · ");
  };
  const cout = n(b?.cout_ia_eur);
  const erreurs = n(b?.erreurs?.total);

  return `
<p style="font-size:15px">Journée du <strong>${b?.jour ?? "?"}</strong>.</p>
<table style="border-collapse:collapse;font-size:14px">
  <tr><td style="padding:4px 12px 4px 0">Analyses réelles</td><td><strong>${n(b?.analyses)}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0">Coût IA</td><td><strong>${cout.toFixed(2)} €</strong>${
    n(b?.analyses_eval) > 0 ? ` <span style="color:#6B7280">(dont ${n(b.analyses_eval)} analyses d'éval)</span>` : ""
  }</td></tr>
  <tr><td style="padding:4px 12px 4px 0">Erreurs de pipeline</td><td><strong style="color:${
    erreurs > 0 ? "#B91C1C" : "#111"
  }">${erreurs}</strong></td></tr>
</table>
<p style="font-size:14px"><strong>Par source</strong><br>${carte(b?.analyses_par_source)}</p>
<p style="font-size:14px"><strong>Verdicts</strong><br>${carte(b?.verdicts)}</p>
<p style="font-size:14px"><strong>Clics</strong><br>${carte(b?.clics)}</p>
<p style="font-size:14px"><strong>Paiements</strong><br>${carte(b?.paiements)}</p>
<p style="font-size:14px"><strong>Listes d'attente</strong><br>${carte(b?.listes_attente)}${
    n(b?.leads_pro) > 0 ? ` · pro&nbsp;: <strong>${n(b.leads_pro)}</strong>` : ""
  }</p>
${erreurs > 0 ? `<p style="font-size:14px"><strong>Erreurs par étape</strong><br>${carte(b?.erreurs?.par_etape)}</p>` : ""}
<p style="color:#6B7280;font-size:12px">Bilan automatique. Les analyses d'éval sont exclues des volumes
mais incluses dans le coût&nbsp;— c'est de l'argent réellement dépensé.</p>`;
}
