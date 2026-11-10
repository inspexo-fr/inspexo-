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
const JOUR_MOIS = `\\b\\d{1,2}(?:er)?\\s+(?:${MOIS})(?:\\s+${ANNEE})?`;
const UNE_DATE = `(?:${JOUR_MOIS}|\\b\\d{1,2}\\/\\d{1,2}\\/(?:19|20)?\\d{2}\\b|(?:${MOIS})\\s+${ANNEE}|\\b\\d{1,2}\\/(?:19|20)?\\d{2}\\b|\\b${ANNEE}\\b)`;
// Une date ou une plage : « 2011-2013 », « février 2015 et septembre 2015 ».
// Une ou plusieurs plages : « 24/11/2014 – 29/05/2015 et 17/08/2015 – … »,
// « entre le 31 août et le 25 octobre 2011 ».
const DATE = `${UNE_DATE}(?:\\s*(?:[-–à]|et|,)\\s*(?:le\\s+)?${UNE_DATE})*`;
// Un volume : « 944 modèles », « 211 725 véhicules », « >1,6 M de véhicules ».
const VOLUME = `[>≈~]?\\s?\\d[\\d\\s\\u00a0\\u202f.,]*\\s*(?:M|millions?|milliers?)?\\s*(?:de\\s+)?(?:mod[eè]les|v[ée]hicules|voitures|unit[ée]s|exemplaires|propri[ée]taires|clients|automobilistes|plaignants|personnes)`;
// « 109 890 Clio et Kangoo » : un nombre groupé par milliers suivi d'un NOM
// PROPRE. ⚠️ Sans drapeau « i » : insensible à la casse, il prenait « 1 500 et
// 2 000 tr/min » ou « 100 000 km » pour des volumes.
const VOLUME_NOMME = /\b\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?=\s+[A-ZÉ])/;
// Un coût : « 2 500 € », « 210 M$ », « 1 200 euros ».
const COUT = `\\d[\\d\\s\\u00a0\\u202f.,]*\\s*(?:M|k)?\\s*(?:€|euros?|\\$|£|chf|USD|EUR)`;
// Un kilométrage, détail pour une panne (« parfois avant 50 000 km »).
// ⚠️ « 110-120 km/h » est une VITESSE, pas un kilométrage : jamais retiré.
const KM = `\\d[\\d\\s\\u00a0\\u202f.,]*\\s*km(?!\\s*\\/\\s*h)\\b`;
// Un intervalle d'entretien : « 160 000 km ou 6 ans », « 5 ans / 75 000 miles ».
const INTERVALLE = `\\d[\\d\\s\\u00a0\\u202f.,]*\\s*(?:km|miles|ans|mois)(?:\\s*(?:ou|\\/)\\s*\\d[\\d\\s\\u00a0\\u202f.,]*\\s*(?:km|miles|ans|mois))?`;
const PREFIXE = `(?:\\b(?:entre\\s+le|jusqu['’](?:au|en|à)\\s*(?:(?:fin|début|mi-?)\\s*)?|(?:fin|début|mi-?)\\s+|à\\s+partir\\s+d['’]?e?|depuis|dès|avant|après|entre|de|du|en|le|au)\\s*)?`;

export type Periode = {
  /** Années bornes (inclusives) ; null = non bornée de ce côté. */
  debut: number | null;
  fin: number | null;
  texte: string;
  /** false = période seulement indicative (« surtout avant 2006 ») : elle
   *  n'est pas une borne, et elle le dit. */
  bornante: boolean;
};

export type Noyau = { noyau: string; details: string[]; periodes: Periode[] };

// Les mots qui accompagnent une période et sortent AVEC elle : « moteurs
// produits jusqu'au … », « production entre … ». Sans eux, le noyau garde un
// mot orphelin (« …boîte EDC produits — … »).
const AVANT_PERIODE = `(?:(?:moteurs?|v[ée]hicules?|mod[eè]les?)\\s+)?(?:produits?|produites?|production|fabriqu[ée]e?s?|construits?|immatricul[ée]e?s?|vendus?|livr[ée]e?s?)\\s*`;
const INDICATIF = /\b(?:surtout|principalement|notamment|en particulier|plut[oô]t|souvent)\b/i;

const nettoyer = (t: string) =>
  t.replace(/\s+([,.;:)])/g, "$1").replace(/\(\s*[,;]?\s*\)/g, "").replace(/\(\s*,\s*/g, "(").replace(/,\s*\)/g, ")")
    .replace(/\s{2,}/g, " ").replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, "").replace(/\s*:\s*:/g, " :")
    .replace(/:\s*—\s*/g, ": ").replace(/\s+—\s+(?=[,;:])/g, "")
    .replace(/(?:\s*,\s*|\s+(?:et|ou)\s+)+(?=\s*(?:[)—:;]|$))/g, "").replace(/,\s*,/g, ",")
    .replace(/\s+([,.;:)])/g, "$1").replace(/:(?=\S)/g, ": ").replace(/,(?=[^\s\d])/g, ", ").replace(/\s{2,}/g, " ").trim();

/** Lit les années d'une période retirée. « jusqu'en 2006 » → fin 2006 ;
 *  « sept. 2009 – fév. 2011 » → 2009–2011 ; « à partir de 2012 » → début 2012. */
export function lirePeriode(texte: string): Periode | null {
  const ys = (texte.match(/\b(19[89]\d|20[0-3]\d)\b|\b\d{1,2}\/\d{1,2}\/(\d{2,4})\b/g) ?? [])
    .map((y) => { const m = y.match(/(\d{2,4})$/)!; const n = Number(m[1]); return n < 100 ? 2000 + n : n; })
  if (ys.length === 0) return null
  const lo = Math.min(...ys), hi = Math.max(...ys)
  const bornante = !INDICATIF.test(texte)
  if (/jusqu|avant|au plus tard/i.test(texte) && ys.length === 1) return { debut: null, fin: hi, texte, bornante }
  if (/(?:à partir|depuis|dès|apr[eè]s)/i.test(texte) && ys.length === 1) return { debut: lo, fin: null, texte, bornante }
  return { debut: lo, fin: hi, texte, bornante }
}

export function extraireNoyau(intitule: string, type: string): Noyau {
  let t = String(intitule ?? "");
  const details: string[] = [];
  const periodes: Periode[] = [];
  const noter = (d: string, estPeriode: boolean) => {
    const x = d.replace(/\s+/g, " ").trim();
    if (x.length < 2) return;
    details.push(x);
    if (estPeriode) { const p = lirePeriode(x); if (p) periodes.push(p); }
  };
  // ENTRETIEN : le noyau est le TYPE de distribution et l'opération ; les
  // intervalles (souvent plusieurs, selon les sources) sont des détails,
  // vérifiés littéralement page par page.
  if (type === "entretien") {
    const coupe = t.replace(/\([^()]*\)/g, "").split(/\s+[—–-]\s+|;\s*|:\s+(?=\d)/)[0];
    for (const m of t.matchAll(new RegExp(INTERVALLE, "gi"))) details.push(m[0].trim());
    return { noyau: nettoyer(coupe.replace(/\([^()]*\)/g, "")), details: [...new Set(details)], periodes };
  }
  // 1. DANS UNE PARENTHÈSE, SEGMENT PAR SEGMENT (décision d'Utku du 10 nov.
  //    2026) : la VERSION reste (marque, modèle, puissance, appellation —
  //    « Nissan 1.5 dCi 110 », « Twingo III EDC »). Seuls sortent les segments
  //    de date, période, volume ou coût.
  t = t.replace(/\(([^()]*)\)/g, (_m, inner: string) => {
    const garde: string[] = [];
    // Séparateurs : « ; » et « , » SUIVIE D'UNE ESPACE — une virgule décimale
    // (« 0,5 l ») n'en est pas un.
    for (const seg of inner.split(/\s*;\s*|,\s+/)) {
      let reste = seg;
      // Volume et coût : le segment entier sort (« 109 890 Clio et Kangoo »).
      if ([COUT, VOLUME].some((x) => new RegExp(x, "i").test(reste)) || VOLUME_NOMME.test(reste)) { noter(seg, false); continue; }
      // Date : SEULE la date sort, la version reste (« 1.5 dCi jusqu'en juin
      // 2002 » → « 1.5 dCi »).
      reste = reste.replace(new RegExp(`(?:${AVANT_PERIODE})?${PREFIXE}${DATE}`, "gi"), (m) => { noter(m, true); return ""; });
      reste = reste.replace(/\s+/g, " ").trim();
      // Un adverbe resté en bout (« dCi 110 surtout ») passe devant : le sens
      // ne change pas, la phrase reste propre.
      const adv = reste.match(/^(.*?)\s+(surtout|principalement|notamment)$/i);
      if (adv) reste = `${adv[2]} ${adv[1]}`;
      if (/^(?:surtout|principalement|notamment|avant|après|depuis|moteurs?|production|produits?|et|ou|sur|de|du|des|entre)?$/i.test(reste)) continue;
      garde.push(reste);
    }
    return garde.length ? `(${garde.join(", ")})` : "";
  });
  // 2. Hors parenthèse : volume → le NOMBRE sort, le nom reste (« 944 modèles
  //    équipés » → « modèles équipés ») ; coût et période sortent entiers, avec
  //    le participe qui les porte (« produits jusqu'au 20/10/2015 »).
  t = t.replace(new RegExp(VOLUME, "gi"), (m) => {
    noter(m, false);
    return m.replace(/^[>≈~]?\s?\d[\d\s  .,]*\s*(?:M|millions?|milliers?)?\s*(?:de\s+)?/i, "");
  });
  t = t.replace(new RegExp(VOLUME_NOMME.source, "g"), (m) => { noter(m, false); return ""; });
  t = t.replace(new RegExp(`(?:${AVANT_PERIODE})?${PREFIXE}${DATE}`, "gi"), (m) => { noter(m, true); return ""; });
  // ⚠️ Le KILOMÉTRAGE ne sort pas : dates, périodes, volumes et coûts
  // seulement (décision d'Utku du 10 nov. 2026). « moins de 5 ans et
  // 100 000 km » est une condition, pas un détail.
  // Un coût sort avec ses mots d'approche (« autour de 1 200 € »), sans quoi
  // « autour » reste orphelin.
  const APPROCHE_COUT = `(?:\\b(?:autour\\s+de|environ|pour|jusqu['’]à|plus\\s+de|moins\\s+de|de|à)\\s+)?`;
  for (const x of [COUT]) {
    t = t.replace(new RegExp(`${APPROCHE_COUT}${x}`, "gi"), (m) => { noter(m, false); return ""; });
  }
  return { noyau: nettoyer(t), details: [...new Set(details)], periodes };
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

// ── Relecture de forme (sprint 23) ─────────────────────────────────────────
const ORPHELINS_NOYAU = /\b(?:de|du|des|la|le|les|l'|à|au|aux|et|ou|par|pour|sur|avec|en|entre|produits?|produites?|équipés?|équipées?|jusqu'?|depuis|dès|surtout)\s*(?:—|:|$|\)|,)/i
/** Les défauts de forme d'un noyau. Vide = phrase propre, envoyable au juge.
 *  Partagé par `scripts/relire-noyaux.mjs` et le lanceur du juge : la règle
 *  qui relit est celle qui filtre. */
export function defautsNoyau(n: string, intitule: string, type: string): string[] {
  const d = []
  if (/…|\.\.\./.test(n)) d.push('points de suspension')
  if (/\(\s*\)/.test(n)) d.push('parenthèse vide')
  if (/\(\s*[,;]|[,;]\s*\)/.test(n)) d.push('virgule contre une parenthèse')
  if (ORPHELINS_NOYAU.test(n)) d.push(`mot orphelin (« ${n.match(ORPHELINS_NOYAU)[0].trim()} »)`)
  if (/[,;:—]\s*[,;:—]/.test(n)) d.push('double ponctuation')
  if (/\s{2,}/.test(n)) d.push('double espace')
  if (/^[,;:—\-(]/.test(n) || /[,;:—\-(]$/.test(n)) d.push('ponctuation en bord')
  // « Distribution : chaîne » est un noyau d'entretien complet (le moteur le préfixe).
  if (n.split(/\s+/).length < (type === 'entretien' ? 2 : 3)) d.push('trop court')
  if ((n.match(/\(/g) ?? []).length !== (n.match(/\)/g) ?? []).length) d.push('parenthèse non fermée')
  if (/\b(?:jusqu'(?:au|en)|le|au|du|entre)\s+\d{1,2}\b(?![.,]\d)(?!\s\d{3})(?!\s*(?:km|ch|cv|ans|mois|%|l\b|v\b|kw))/i.test(n)) d.push('jour ou nombre orphelin')
  if (/\b(?:de moins|ou de|et de|autour|vers|environ|entre|à partir|dès)\s*$/i.test(n)) d.push('fin tronquée')
  if (/\b(?:entre|de|à)\s+(?:et|à)\b/i.test(n)) d.push('plage vidée')
  // « 1.4/1.6 VTi » est une cylindrée, pas une date.
  if (/(?<![.\d])\d{1,2}\/(?:\d{2}|\d{4})\b(?![.\d])|\b(?:19|20)\d{2}\b(?!\s*(?:cm|ch|nm|tr))|€/i.test(n)) d.push('date ou coût restant')
  if (type !== 'entretien') {
    for (const v of intitule.match(/\b(?:dCi|TCe|PureTech|BlueHDi|HDi|VTi|THP|TSI|TDI)\s*\d{2,3}\b|\b\d[.,]\d\s*(?:dCi|TCe|PureTech|BlueHDi|HDi)\b/g) ?? []) {
      if (!n.includes(v)) d.push(`version perdue (« ${v} »)`)
    }
  }
  return d
}
