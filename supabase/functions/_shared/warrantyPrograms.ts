// Programmes d'extension de garantie / prises en charge constructeur.
// Deux origines, mêmes règles d'affichage :
//  - KNOWN_WARRANTY_PROGRAMS : programmes vérifiés à la main (source presse
//    auto reconnue ou communication officielle), appliqués par famille moteur ;
//  - defect_sheets.programmes : programmes trouvés par la recherche web dédiée
//    à la génération de la fiche (sanitizeProgrammes ci-dessous).
// Un véhicule dans les seuils (âge, km) ⇒ raison principale + question vendeur
// sur les justificatifs d'entretien exigés.

export type WarrantyProgram = {
  titre: string;
  conditions: string; // texte court : ce qui est couvert + conditions
  age_max_ans: number | null;
  km_max: number | null;
  entretien_exige: string | null; // justificatifs demandés (ex : 3 dernières factures)
  date_vigueur: string | null; // "2024-03-19"
  url_source: string[];
};

export const KNOWN_WARRANTY_PROGRAMS: Array<{ familles_prefixes: string[]; programme: WarrantyProgram }> = [
  {
    // 1.2 PureTech essence (EB2, toutes déclinaisons EB2ADT/EB2DT/EB2ADTS…)
    familles_prefixes: ["EB2"],
    programme: {
      titre: "Extension de garantie Stellantis moteur 1.2 PureTech",
      conditions:
        "Prise en charge courroie de distribution et consommation d'huile jusqu'à 10 ans ou 175 000 km, si le plan d'entretien constructeur est respecté (3 dernières factures d'entretien exigées).",
      age_max_ans: 10,
      km_max: 175000,
      entretien_exige: "les 3 dernières factures d'entretien",
      date_vigueur: "2024-03-19",
      url_source: [
        "https://www.caradisiac.com/le-moteur-puretech-profite-d-une-extension-de-garantie-208069.htm",
        "https://www.largus.fr/actualite-automobile/moteur-puretech-stellantis-etend-la-garantie-de-la-courroie-de-distribution-30029081.html",
      ],
    },
  },
];

/** Domaines acceptés pour sourcer un programme : presse auto reconnue,
 *  sites officiels (.gouv.fr) ou domaine portant le nom de la marque/du groupe. */
const PRESS_DOMAINS = [
  "caradisiac.com",
  "largus.fr",
  "autoplus.fr",
  "auto-moto.com",
  "turbo.fr",
  "autojournal.fr",
  "challenges.fr",
  "lepoint.fr",
  "automobile-magazine.fr",
];
const GROUP_DOMAINS = ["stellantis", "renaultgroup", "volkswagen-group", "bmwgroup", "toyota-europe", "media."];

export function programmeSourceOk(url: string, marque: string): boolean {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch (_) {
    return false;
  }
  if (host.endsWith(".gouv.fr")) return true;
  if (PRESS_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) return true;
  const m = (marque || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
  if (m && host.replace(/[^a-z]/g, "").includes(m)) return true;
  return GROUP_DOMAINS.some((d) => host.includes(d));
}

/** Nettoie les programmes renvoyés par la recherche web de la fiche :
 *  source whitelistée obligatoire, champs typés/bornés, 3 max. */
// deno-lint-ignore no-explicit-any
export function sanitizeProgrammes(raw: any[], marque: string): WarrantyProgram[] {
  const out: WarrantyProgram[] = [];
  for (const p of (raw ?? []).slice(0, 5)) {
    if (!p?.titre || !p?.conditions) continue;
    const urls = (Array.isArray(p.url_source) ? p.url_source : [])
      .filter((u: unknown): u is string => typeof u === "string" && /^https?:\/\/\S+$/i.test(u))
      .filter((u: string) => programmeSourceOk(u, marque))
      .slice(0, 3);
    if (urls.length === 0) continue; // règle d'or : pas de source fiable → rejet
    out.push({
      titre: String(p.titre).slice(0, 150),
      conditions: String(p.conditions).slice(0, 400),
      age_max_ans: typeof p.age_max_ans === "number" && p.age_max_ans > 0 && p.age_max_ans <= 30 ? p.age_max_ans : null,
      km_max: typeof p.km_max === "number" && p.km_max > 0 && p.km_max < 1_000_000 ? p.km_max : null,
      entretien_exige: p.entretien_exige ? String(p.entretien_exige).slice(0, 200) : null,
      date_vigueur: p.date_vigueur ? String(p.date_vigueur).slice(0, 20) : null,
      url_source: urls,
    });
    if (out.length >= 3) break;
  }
  return out;
}

/** Programmes applicables à une famille moteur (connus + fiche). */
export function programmesPourFamille(
  famille: string | null,
  fromSheet: WarrantyProgram[] | null,
): WarrantyProgram[] {
  const fam = (famille || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const connus = fam
    ? KNOWN_WARRANTY_PROGRAMS.filter((k) => k.familles_prefixes.some((p) => fam.startsWith(p))).map((k) => k.programme)
    : [];
  const vus = new Set(connus.map((p) => p.titre.toLowerCase()));
  const extra = (fromSheet ?? []).filter((p) => !vus.has(p.titre.toLowerCase()));
  return [...connus, ...extra];
}

/** Le véhicule est-il dans les seuils du programme ? (nulls = pas de limite) */
export function vehiculeEligible(
  prog: WarrantyProgram,
  annee: number | null,
  km: number | null,
): boolean {
  const age = annee ? new Date().getFullYear() - annee : null;
  if (prog.age_max_ans != null && (age == null || age > prog.age_max_ans)) return false;
  if (prog.km_max != null && (km == null || km > prog.km_max)) return false;
  return true;
}
