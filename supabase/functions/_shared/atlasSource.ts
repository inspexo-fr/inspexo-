// SPRINT 16 — Règles PURES du sourcing de l'atlas.
//
// Séparées de la fonction edge pour être testables hors ligne : le fichier de
// la fonction importe `deno.land`, que Node ne sait pas charger. Même raison
// que pour tous les autres modules purs du projet.

/** L'affirmation soumise au vérificateur : le DÉFAUT, sans le prix.
 *
 * ⚠️ Défaut trouvé à la première campagne (BMW, 4 entrées sur 5 retirées).
 * La description de l'atlas finit souvent par « Coût constaté : 2 500 à
 * 4 500 € ». Soumise telle quelle, l'affirmation devient un paquet : une page
 * qui atteste parfaitement la chaîne de distribution N47 mais ne donne aucun
 * prix est jugée « non soutenue » — et l'entrée disparaît alors qu'elle est
 * l'un des défauts les mieux documentés de la marque.
 *
 * Le coût suit son propre chemin : il n'est retenu que s'il est publié par
 * une page, et il ne décide jamais du sort de l'entrée. */
export function affirmationSansCout(titre: string, description: string): string {
  // Tous les espaces, y compris insécable et fine, entre les chiffres.
  const MONTANT = String.raw`\d[\d\s\u00a0\u202f.,]*\s?(?:€|eur\b|euros?)`;
  const sansPrix = String(description ?? "")
    // « Coût constaté : 2 500 à 4 500€ », « Compter 1 200 € », « coûte 450 EUR »
    .replace(new RegExp(String.raw`(?:co[ûu]te?s?|prix|tarif|budget|compter|facture)[^.]{0,80}?${MONTANT}\.?`, "gi"), " ")
    .replace(new RegExp(MONTANT, "gi"), " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;])/g, "$1")
    .trim();
  return `${String(titre ?? "").trim()}${sansPrix ? ` — ${sansPrix}` : ""}`.slice(0, 500);
}

/** Marqueurs distinctifs d'une entrée : codes (moteur, caisse, boîte) et mots
 *  techniques rares. Une page qui n'en contient AUCUN ne parle pas de ça. */
export function marqueursEntree(titre: string, description: string, models: string): string[] {
  const texte = `${titre} ${description} ${models}`;
  const out = new Set<string>();
  // Codes : N47, EA888, W203, 722.9, 1.2 PureTech, DQ200…
  for (const m of texte.matchAll(/\b([A-Z]{1,3}\d{2,4}[A-Z]?|\d{3}\.\d|\d\.\d\s?[A-Za-zé]{3,})\b/g)) {
    out.add(m[1].toLowerCase());
  }
  // Mots techniques d'au moins 6 lettres, hors mots trop courants.
  const BANAL = new Set([
    "moteur", "moteurs", "vehicule", "vehicules", "probleme", "problemes", "defaut",
    "defauts", "panne", "pannes", "reparation", "constate", "constatee", "coutent",
    "remplacement", "premiere", "premieres", "modeles", "annees", "version", "versions",
  ]);
  for (const m of texte.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").matchAll(/\b([a-z]{6,})\b/g)) {
    if (!BANAL.has(m[1])) out.add(m[1]);
  }
  return [...out];
}

/** La page contient-elle au moins un marqueur distinctif de l'entrée ? */
export function pageParleDeLEntree(textePage: string, marqueurs: string[]): boolean {
  const t = textePage.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let touches = 0;
  for (const m of marqueurs) if (t.includes(m)) touches += 1;
  return touches >= 2;
}
