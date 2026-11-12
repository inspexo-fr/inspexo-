// SPRINT 23 — Un rappel ne pèse que s'il concerne CE véhicule, en France
// (décision d'Utku du 12 nov. 2026), en deux règles déterministes :
//
//   1. Un rappel dont TOUTES les sources sont d'un autre pays (NHTSA, Consumer
//      Reports, presse étrangère…) devient une INFORMATION DE CONTEXTE : jamais
//      rappel officiel, jamais de poids sur la note, jamais repris dans les
//      raisons. Exception : une campagne de portée MONDIALE établie par une
//      source confirmée (rappel_portee « mondiale », ex. 21H7) concerne aussi
//      la France. Une source de pays INCONNU n'est pas « d'un autre pays » : le
//      rappel n'est pas requalifié sur une supposition.
//   2. Un rappel dont les millésimes ou la période ÉCRITS excluent l'année du
//      véhicule n'est PAS AFFICHÉ du tout. (Cas réel : 20U6/L8, « millésimes
//      2013-2014 », affiché sur une S7 de 2015.)
//
// Module PUR, aucun import (tests/rappels-applicables.test.mjs).

/** Pays d'une source, d'après son hôte. null = inconnu (jamais deviné). */
const HOTES_PAYS: Record<string, string> = {
  // France
  "caradisiac.com": "FR", "quechoisir.org": "FR", "ufcquechoisir.org": "FR",
  "automobile-propre.com": "FR", "journalauto.com": "FR", "60millions-mag.com": "FR",
  "lautomobile-magazine.fr": "FR", "autoplus.fr": "FR",
  // Union européenne (une campagne UE vaut pour la France)
  "europa.eu": "UE", "ec.europa.eu": "UE",
  // États-Unis
  "nhtsa.gov": "US", "static.nhtsa.gov": "US", "consumerreports.org": "US",
  "amp.consumerreports.org": "US", "thedrive.com": "US", "carbuzz.com": "US",
  "caranddriver.com": "US", "insideevs.com": "US", "jdpower.com": "US",
  "edmunds.com": "US", "kbb.com": "US", "cars.com": "US", "autoblog.com": "US",
  "slashgear.com": "US", "truedelta.com": "US", "kiamedia.com": "US",
  // Royaume-Uni
  "honestjohn.co.uk": "UK", "whatcar.com": "UK", "autoexpress.co.uk": "UK",
  "autocar.co.uk": "UK", "carbuyer.co.uk": "UK", "pistonheads.com": "UK",
  "which.co.uk": "UK",
  // Allemagne
  "adac.de": "DE", "autobild.de": "DE", "auto-motor-und-sport.de": "DE", "kba.de": "DE",
  // Australie
  "drive.com.au": "AU", "caradvice.com.au": "AU",
}
const TLD_PAYS: Record<string, string> = {
  fr: "FR", eu: "UE", gov: "US", uk: "UK", de: "DE", gr: "GR", it: "IT", es: "ES",
  be: "BE", ch: "CH", at: "AT", nl: "NL", au: "AU", ca: "CA", ie: "IE", nz: "NZ",
  pl: "PL", pt: "PT", se: "SE", no: "NO", dk: "DK", fi: "FI", cz: "CZ", jp: "JP",
}

export function paysDeSource(url: unknown): string | null {
  let hote = ""
  try { hote = new URL(String(url)).hostname.toLowerCase().replace(/^www\./, "") } catch { return null }
  for (const [h, p] of Object.entries(HOTES_PAYS)) if (hote === h || hote.endsWith(`.${h}`)) return p
  const tld = hote.split(".").pop() ?? ""
  return TLD_PAYS[tld] ?? null
}

/** Toutes les sources sont-elles CONNUES et d'un autre pays que la France/UE ? */
export function sourcesToutesEtrangeres(urls: unknown[]): { etrangeres: boolean; pays: string[] } {
  const liste = (urls ?? []).filter((u) => typeof u === "string") as string[]
  if (liste.length === 0) return { etrangeres: false, pays: [] }
  const pays = liste.map(paysDeSource)
  const connus = pays.filter((p): p is string => p !== null)
  const etrangeres = pays.every((p) => p !== null && p !== "FR" && p !== "UE")
  return { etrangeres, pays: [...new Set(connus)] }
}

/** Années écrites qui bornent le rappel. Champs de la fiche d'abord (période
 *  de PRODUCTION : la fin tolère un an, une voiture produite en décembre est
 *  du millésime suivant) ; sinon un intervalle de MILLÉSIMES écrit dans le
 *  texte (« millésimes 2013-2014 », « modèles 2015-2016 ») : bornes strictes. */
export function anneesDuRappel(e: { rappel_annee_debut?: number | null; rappel_annee_fin?: number | null; rappel_vehicules?: string | null }):
  { debut: number | null; fin: number | null; tolerance_fin: number } | null {
  if (e.rappel_annee_debut != null || e.rappel_annee_fin != null) {
    return { debut: e.rappel_annee_debut ?? null, fin: e.rappel_annee_fin ?? null, tolerance_fin: 1 }
  }
  const t = String(e.rappel_vehicules ?? "")
  const m = t.match(/\b(?:mill[ée]simes?|ann[ée]es?[- ]mod[èe]les?|mod[èe]les?)\s+((?:19|20)\d\d)\s*(?:-|–|à|et)\s*((?:19|20)\d\d)\b/i)
  if (m) return { debut: Number(m[1]), fin: Number(m[2]), tolerance_fin: 0 }
  return null
}

export function horsPeriode(e: Parameters<typeof anneesDuRappel>[0], annee: number | null): boolean {
  if (annee == null) return false
  const a = anneesDuRappel(e)
  if (!a) return false
  return (a.debut != null && annee < a.debut) || (a.fin != null && annee > a.fin + a.tolerance_fin)
}

const NOMS_PAYS: Record<string, string> = { US: "aux États-Unis", UK: "au Royaume-Uni", DE: "en Allemagne", AU: "en Australie", CA: "au Canada", GR: "en Grèce" }

/** Un titre qui s'annonce « Rappel officiel : … » ne le dit plus quand le
 *  rappel est requalifié en contexte. */
export function titreSansRappelOfficiel(titre: unknown): string {
  const t = String(titre ?? "").replace(/^\s*rappel\s+officiel\s*[:—–-]\s*/i, "")
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t
}

type AvecRappel = {
  titre?: string;
  rappel_code?: string | null; rappel_date?: string | null; rappel_vehicules?: string | null
  rappel_portee?: string | null; rappel_annee_debut?: number | null; rappel_annee_fin?: number | null
  urls?: unknown[]; rappel_contexte?: string | null
}

/** Applique les deux règles à une entrée de catalogue (panne de fiche). */
export function appliquerReglesRappel<T extends AvecRappel>(e: T, annee: number | null): T & { rappel_contexte: string | null; rappel_ecarte: null | "hors_periode" | "etranger" } {
  const vide = { rappel_code: null, rappel_date: null, rappel_vehicules: null, rappel_portee: null, rappel_annee_debut: null, rappel_annee_fin: null }
  if (!e.rappel_code) return { ...e, rappel_contexte: e.rappel_contexte ?? null, rappel_ecarte: null }
  // Règle 2 d'abord : un rappel qui ne concerne pas ce millésime ne s'affiche pas.
  if (horsPeriode(e, annee)) return { ...e, ...vide, rappel_contexte: null, rappel_ecarte: "hors_periode" }
  // Règle 1 : sources toutes étrangères, hors campagne mondiale établie.
  const s = sourcesToutesEtrangeres(e.urls ?? [])
  if (e.rappel_portee !== "mondiale" && (e.rappel_portee === "etranger" || s.etrangeres)) {
    const ou = s.pays.length === 1 && NOMS_PAYS[s.pays[0]] ? NOMS_PAYS[s.pays[0]] : "hors de France"
    return {
      ...e, ...vide,
      ...(typeof e.titre === "string" ? { titre: titreSansRappelOfficiel(e.titre) } : {}),
      rappel_contexte: `Campagne publiée ${ou} (${e.rappel_code}) : information de contexte, aucune campagne connue en France pour ce véhicule.`,
      rappel_ecarte: "etranger",
    }
  }
  return { ...e, rappel_contexte: e.rappel_contexte ?? null, rappel_ecarte: null }
}
