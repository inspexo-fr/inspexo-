// SPRINT 23 — Le NOYAU d'une affirmation, soumis au juge (décision d'Utku du
// 10 nov. 2026, « effet paquet »).
//
// Un intitulé de source mêle le fait (organe + défaut + moteur) et des
// détails : une date, un volume (« 944 modèles »), un coût. Soumis tel quel,
// il devient un paquet : une page qui atteste parfaitement le défaut mais ne
// cite pas le volume est jugée « non soutenue ». C'est le défaut du sprint 16
// (le coût dans la description de l'atlas), sous une autre forme.
//
// Le juge reçoit donc le NOYAU. Les DÉTAILS retirés ne sont affichés que s'ils
// figurent LITTÉRALEMENT dans un extrait confirmé (`detailsAffichables`) :
// contrôle déterministe, gratuit, sans modèle.
//
// ⚠️ Pour une affirmation d'ENTRETIEN, l'intervalle EST le noyau : « 120 000 km
// / 60 mois » n'est pas retiré.
//
// Module PUR.
import { normaliser } from "./precontrole.ts";

const MOIS = "janv(?:ier|\\.)?|f[ée]vr?(?:ier|\\.)?|mars|avr(?:il|\\.)?|mai|juin|juil(?:let|\\.)?|ao[uû]t|sept(?:embre|\\.)?|oct(?:obre|\\.)?|nov(?:embre|\\.)?|d[ée]c(?:embre|\\.)?";
const ANNEE = "(?:19|20)\\d{2}";
// Une date : « décembre 2014 », « 03/2018 », « sept. 2009 – fév. 2011 », « 2011-2013 ».
const DATE = `(?:\\b\\d{1,2}\\/\\d{1,2}\\/(?:19|20)?\\d{2}\\b|(?:${MOIS})\\s+${ANNEE}|\\b\\d{1,2}\\/(?:19|20)?\\d{2}\\b|\\b${ANNEE}\\b)(?:\\s*[-–à]\\s*(?:(?:${MOIS})\\s+)?${ANNEE})?`;
// Un volume : « 944 modèles », « 211 725 véhicules », « >1,6 M de véhicules ».
const VOLUME = `[>≈~]?\\s?\\d[\\d\\s\\u00a0\\u202f.,]*\\s*(?:M|millions?|milliers?)?\\s*(?:de\\s+)?(?:mod[eè]les|v[ée]hicules|voitures|unit[ée]s|exemplaires|propri[ée]taires|clients)`;
// Un coût : « 2 500 € », « 210 M$ », « 1 200 euros ».
const COUT = `\\d[\\d\\s\\u00a0\\u202f.,]*\\s*(?:M|k)?\\s*(?:€|euros?|\\$|£|chf|USD|EUR)`;
// Un kilométrage, détail pour une panne (« parfois avant 50 000 km »).
// ⚠️ « 110-120 km/h » est une VITESSE, pas un kilométrage : jamais retiré.
const KM = `\\d[\\d\\s\\u00a0\\u202f.,]*\\s*km(?!\\s*\\/\\s*h)\\b`;
// Un intervalle d'entretien : « 160 000 km ou 6 ans », « 5 ans / 75 000 miles ».
const INTERVALLE = `\\d[\\d\\s\\u00a0\\u202f.,]*\\s*(?:km|miles|ans|mois)(?:\\s*(?:ou|\\/)\\s*\\d[\\d\\s\\u00a0\\u202f.,]*\\s*(?:km|miles|ans|mois))?`;
const PREFIXE = `(?:\\b(?:jusqu['’](?:au|en|à)|à\\s+partir\\s+d['’]?e?|depuis|dès|avant|après|de|du|en|le|au)\\s*)?`;

export type Noyau = { noyau: string; details: string[] };

const nettoyer = (t: string) =>
  t.replace(/\s+([,.;:)])/g, "$1").replace(/\(\s*\)/g, "").replace(/\s{2,}/g, " ")
    .replace(/^[\s,;:–-]+|[\s,;:–-]+$/g, "").replace(/\s*:\s*:/g, " :").trim();

export function extraireNoyau(intitule: string, type: string): Noyau {
  let t = String(intitule ?? "");
  const details: string[] = [];
  // ENTRETIEN : le noyau est le TYPE de distribution et l'opération ; les
  // intervalles (souvent plusieurs, selon les sources) sont des détails,
  // vérifiés littéralement page par page. Soumis en bloc, aucun page ne
  // porterait les quatre intervalles d'un même intitulé.
  if (type === "entretien") {
    const coupe = t.split(/\s+[—–-]\s+|;\s*|:\s+(?=\d)/)[0];
    for (const m of t.matchAll(new RegExp(INTERVALLE, "gi"))) details.push(m[0].trim());
    return { noyau: nettoyer(coupe.replace(/\([^()]*\)/g, "")), details: [...new Set(details)] };
  }
  const motifs = [COUT, VOLUME, DATE, KM];
  // 1. Une parenthèse qui porte un détail est retirée ENTIÈRE (contexte compris).
  t = t.replace(/\(([^()]*)\)/g, (m, inner) => {
    if (motifs.some((x) => new RegExp(x, "i").test(inner))) { details.push(inner.trim()); return ""; }
    return m;
  });
  // 2. Les détails restants, au fil du texte.
  for (const x of motifs) {
    t = t.replace(new RegExp(`${PREFIXE}${x}`, "gi"), (m) => {
      details.push(m.trim());
      return "";
    });
  }
  return { noyau: nettoyer(t), details: [...new Set(details.map((d) => d.replace(/\s+/g, " ")))].filter((d) => d.length > 1) };
}

/** L'affirmation soumise au juge : le noyau, rattaché au moteur. */
export function affirmationNoyau(intitule: string, type: string, moteur: string): string {
  const { noyau } = extraireNoyau(intitule, type);
  return `Sur ${String(moteur).trim()} : ${noyau}`.slice(0, 400);
}

/** Les détails qu'on peut AFFICHER : seulement ceux qui figurent tels quels
 *  (normalisés) dans un extrait d'une page CONFIRMÉE par le juge. */
export function detailsAffichables(details: string[], extraitsConfirmes: string[]): string[] {
  const textes = extraitsConfirmes.map(normaliser);
  return details.filter((d) => {
    const n = normaliser(d).replace(/^(?:jusqu'(?:au|en|à)|à partir d'?e?|de|du|en|le|au|depuis|dès|avant|après)\s*/, "");
    return n.length >= 3 && textes.some((t) => t.includes(n));
  });
}
