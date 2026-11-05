// SPRINT 7 / SPRINT 20 — Décodage NORMATIF du VIN (numéro de châssis), étape 1 :
// gratuit, sûr, et entièrement local (norme ISO 3779 — rien n'est envoyé nulle
// part, aucun fournisseur payant n'est appelé).
//
// Ce que la norme garantit : structure 17 caractères sans I/O/Q, constructeur
// (WMI, positions 1-3), pays de fabrication, année-modèle PROBABLE
// (position 10 — codifiée mais non obligatoire hors Amérique du Nord), clé de
// contrôle (position 9 — obligatoire aux États-Unis seulement : en Europe on
// la calcule à titre INDICATIF, une discordance n'invalide pas le VIN).
// Ce que la norme NE donne PAS : le moteur exact, la finition, les
// équipements — c'est le décodage détaillé (fournisseur payant, à valider :
// docs/vin-fournisseurs.md), volontairement NON activé.
//
// ⚠️ MODULE PUR, ET C'EST LA SOURCE UNIQUE. `src/data/vin.gen.js` en est la
// traduction mécanique (scripts/generer-miroir-revendeur.mjs), et
// `src/lib/vin.js` n'est plus qu'un ré-export : il n'existe donc qu'une
// implémentation du décodage dans le projet. Avant le sprint 20 le décodage
// vivait côté navigateur seulement, et le serveur ne savait pas lire un VIN.
//
// ⚠️ LE VIN NE DOIT JAMAIS ENTRER DANS `result_json`. Le dossier /a/:id est
// public : y publier un VIN exposerait un identifiant de véhicule rattachable
// à son titulaire par le SIV. Le serveur garde les FAITS DÉCODÉS (constructeur,
// pays, années possibles, concordance) et une empreinte salée pour la règle 0
// d'HistoVec — jamais le numéro. Même invariant qu'au sprint 13 :
// `extraire → comparer → retirer l'identifiant → garder les faits`.
//
// Sources : ISO 3779/3780 ; registre public des WMI (attribution par pays
// via SAE International) ; transliteration et pondération de la clé : 49 CFR
// §565.15 (NHTSA).

// ---------------------------------------------------------------------------
// WMI (3 caractères) → constructeur + pays de fabrication.
// Liste volontairement limitée aux attributions connues et stables du marché
// européen/français : un WMI absent est rendu « constructeur non reconnu »,
// jamais deviné.
// ---------------------------------------------------------------------------
const WMI: Record<string, [string, string]> = {
  // France
  VF1: ['Renault', 'France'], VF3: ['Peugeot', 'France'], VF6: ['Renault Trucks', 'France'],
  VF7: ['Citroën', 'France'], VF8: ['Matra', 'France'],
  VR1: ['DS Automobiles', 'France'], VR3: ['Peugeot', 'France'], VR7: ['Citroën', 'France'],
  VNK: ['Toyota (usine de Valenciennes)', 'France'],
  // Allemagne
  WVW: ['Volkswagen', 'Allemagne'], WV1: ['Volkswagen Utilitaires', 'Allemagne'], WV2: ['Volkswagen Utilitaires', 'Allemagne'],
  WAU: ['Audi', 'Allemagne'], WA1: ['Audi (SUV)', 'Allemagne'],
  WBA: ['BMW', 'Allemagne'], WBS: ['BMW M', 'Allemagne'], WBY: ['BMW i', 'Allemagne'],
  WMW: ['Mini', 'Allemagne'],
  WDB: ['Mercedes-Benz', 'Allemagne'], WDD: ['Mercedes-Benz', 'Allemagne'], WDC: ['Mercedes-Benz (SUV)', 'Allemagne'],
  W1K: ['Mercedes-Benz', 'Allemagne'], W1N: ['Mercedes-Benz (SUV)', 'Allemagne'], W1V: ['Mercedes-Benz (vans)', 'Allemagne'],
  WME: ['Smart', 'Allemagne'],
  WP0: ['Porsche', 'Allemagne'], WP1: ['Porsche (SUV)', 'Allemagne'],
  W0L: ['Opel', 'Allemagne'], W0V: ['Opel (groupe PSA/Stellantis)', 'Allemagne'],
  WF0: ['Ford of Europe', 'Allemagne'],
  // Espagne / Portugal
  VSS: ['Seat', 'Espagne'], VSK: ['Nissan (usine de Barcelone)', 'Espagne'],
  VS6: ['Ford (usine de Valence)', 'Espagne'], VSX: ['Opel (usine de Saragosse)', 'Espagne'],
  // Royaume-Uni
  SAL: ['Land Rover', 'Royaume-Uni'], SAJ: ['Jaguar', 'Royaume-Uni'],
  SJN: ['Nissan (usine de Sunderland)', 'Royaume-Uni'], SB1: ['Toyota (usine de Burnaston)', 'Royaume-Uni'],
  SHH: ['Honda (usine de Swindon)', 'Royaume-Uni'], SCC: ['Lotus', 'Royaume-Uni'],
  // Italie
  ZFA: ['Fiat', 'Italie'], ZAR: ['Alfa Romeo', 'Italie'], ZLA: ['Lancia', 'Italie'],
  ZAM: ['Maserati', 'Italie'], ZFF: ['Ferrari', 'Italie'], ZHW: ['Lamborghini', 'Italie'],
  // Europe centrale et du nord
  TMB: ['Škoda', 'Tchéquie'], TMA: ['Hyundai (usine de Nošovice)', 'Tchéquie'],
  TRU: ['Audi (usine de Győr)', 'Hongrie'], TSM: ['Suzuki (usine de Magyar)', 'Hongrie'],
  U5Y: ['Kia (usine de Žilina)', 'Slovaquie'], U6Y: ['Kia (usine de Žilina)', 'Slovaquie'],
  YV1: ['Volvo', 'Suède'], YV4: ['Volvo (SUV)', 'Suède'], YS3: ['Saab', 'Suède'],
  UU1: ['Dacia', 'Roumanie'],
  XTA: ['Lada/AvtoVAZ', 'Russie'],
  NMT: ['Toyota (usine d’Adapazarı)', 'Turquie'], NM0: ['Ford (usine de Kocaeli)', 'Turquie'],
  // Asie (imports courants en France)
  KMH: ['Hyundai', 'Corée du Sud'], KNA: ['Kia', 'Corée du Sud'], KND: ['Kia', 'Corée du Sud'], KNE: ['Kia', 'Corée du Sud'],
  JMZ: ['Mazda (Europe)', 'Japon'], MM0: ['Mazda (usine de Thaïlande)', 'Thaïlande'],
  // Amérique du Nord (imports)
  '1FA': ['Ford', 'États-Unis'], '1FT': ['Ford (pick-up)', 'États-Unis'], '1G1': ['Chevrolet', 'États-Unis'],
  '1HG': ['Honda', 'États-Unis'], '2HG': ['Honda', 'Canada'], '3VW': ['Volkswagen (usine de Puebla)', 'Mexique'],
  '5YJ': ['Tesla', 'États-Unis'], '7SA': ['Tesla (Texas)', 'États-Unis'],
}

// Préfixes à 2 caractères (le 3e caractère distingue l'usine, le constructeur
// reste certain) — appliqués seulement si le WMI exact n'est pas listé.
const WMI2: Record<string, [string, string]> = {
  JT: ['Toyota', 'Japon'], JH: ['Honda', 'Japon'], JN: ['Nissan', 'Japon'],
  JM: ['Mazda', 'Japon'], JS: ['Suzuki', 'Japon'], JF: ['Subaru', 'Japon'],
  JA: ['Isuzu/Mitsubishi', 'Japon'], JY: ['Yamaha', 'Japon'],
  KM: ['Hyundai', 'Corée du Sud'], KN: ['Kia', 'Corée du Sud'], KP: ['SsangYong', 'Corée du Sud'],
  VF: ['Constructeur français (groupe non reconnu)', 'France'],
  SA: ['Constructeur britannique', 'Royaume-Uni'],
}

// Région / pays de fabrication d'après le 1er caractère (ISO 3780).
const REGIONS: Array<[RegExp, string]> = [
  [/^[A-H]/, 'Afrique'], [/^[J-R]/, 'Asie'], [/^[S-Z]/, 'Europe'],
  [/^[1-5]/, 'Amérique du Nord'], [/^[6-7]/, 'Océanie'], [/^[8-90]/, 'Amérique du Sud'],
]

// Année-modèle (position 10) : lettres puis chiffres, cycle de 30 ans.
// I, O, Q, U, Z et 0 ne sont jamais utilisés.
const ANNEE_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789'

// Clé de contrôle (position 9) — 49 CFR §565.15.
const TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
}
const POIDS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]

function valeur(c: string): number | null {
  if (/[0-9]/.test(c)) return Number(c)
  return TRANSLIT[c] ?? null
}

export function cleControle(vin: string): string | null {
  let somme = 0
  for (let i = 0; i < 17; i++) {
    const v = valeur(vin[i])
    if (v == null) return null
    somme += v * POIDS[i]
  }
  const reste = somme % 11
  return reste === 10 ? 'X' : String(reste)
}

/** Années-modèle possibles pour le code de la position 10 (cycle de 30 ans),
 *  bornées à [1980, année courante + 1]. */
export function anneesPossibles(code: string, anneeCourante: number = new Date().getFullYear()): number[] {
  const idx = ANNEE_CODES.indexOf(code)
  if (idx === -1) return []
  const annees: number[] = []
  for (let base = 1980; base <= anneeCourante + 1; base += 30) {
    const a = base + idx
    if (a >= 1980 && a <= anneeCourante + 1) annees.push(a)
  }
  return annees
}

export type DecodeVin = {
  valide: boolean;
  vin: string;
  erreurs: string[];
  constructeur: string | null;
  pays: string | null;
  region: string | null;
  annees_possibles: number[];
  annee_obligatoire: boolean;
  cle: { attendue: string | null; presente: string; concorde: boolean; obligatoire: boolean } | null;
};

/**
 * Décodage normatif complet. Ne devine JAMAIS : un WMI inconnu est rendu
 * comme tel, la clé de contrôle est indicative hors Amérique du Nord.
 * → { valide, vin, erreurs[], constructeur, pays, region, annees_possibles,
 *     annee_obligatoire (bool), cle: { attendue, presente, concorde } }
 */
export function decoderVin(brut: unknown, anneeCourante?: number): DecodeVin {
  const vin = String(brut || '').toUpperCase().replace(/[\s-]/g, '')
  const erreurs: string[] = []
  if (vin.length !== 17) {
    erreurs.push(`Un VIN compte exactement 17 caractères (${vin.length} saisis).`)
  }
  if (/[IOQ]/.test(vin)) {
    erreurs.push('Les lettres I, O et Q n’existent jamais dans un VIN (confusion avec 1 et 0) : relisez la carte grise (champ E).')
  }
  if (vin.length === 17 && /[^A-HJ-NPR-Z0-9]/.test(vin)) {
    erreurs.push('Caractère invalide : un VIN ne contient que des lettres (sauf I, O, Q) et des chiffres.')
  }
  if (erreurs.length > 0) {
    return { valide: false, vin, erreurs, constructeur: null, pays: null, region: null, annees_possibles: [], annee_obligatoire: false, cle: null }
  }

  const wmi3 = vin.slice(0, 3)
  const wmi2 = vin.slice(0, 2)
  const [constructeur, pays] = WMI[wmi3] ?? WMI2[wmi2] ?? [null, null]
  const region = REGIONS.find(([re]) => re.test(vin[0]))?.[1] ?? null
  const ameriqueDuNord = /^[1-5]/.test(vin[0])

  const attendue = cleControle(vin)
  const cle = {
    attendue,
    presente: vin[8],
    concorde: attendue != null && attendue === vin[8],
    // Hors Amérique du Nord la clé n'est pas obligatoire : une discordance
    // est un SIGNAL à vérifier (frappe ? VIN maquillé ?), pas une preuve.
    obligatoire: ameriqueDuNord,
  }

  return {
    valide: true,
    vin,
    erreurs: [],
    constructeur,
    pays,
    region,
    annees_possibles: anneesPossibles(vin[9], anneeCourante ?? new Date().getFullYear()),
    annee_obligatoire: ameriqueDuNord,
    cle,
  }
}

// ---------------------------------------------------------------------------
// SPRINT 20 — TROUVER un VIN dans un texte, sans jamais le deviner.
// ---------------------------------------------------------------------------
// ⚠️ C'est une RECHERCHE DÉTERMINISTE, volontairement pas un travail de
// modèle : un VIN est un identifiant de 17 caractères, et un modèle de langue
// qui « extrait » un identifiant peut en halluciner un plausible. Une erreur
// d'un caractère désignerait une autre voiture, et le dossier affirmerait une
// discordance qui n'existe pas. Une expression régulière, elle, ne peut rien
// inventer : soit les 17 caractères sont écrits, soit il n'y a pas de VIN.

/** Étiquettes sous lesquelles une annonce ou un document nomme le VIN. */
const ETIQUETTE_VIN =
  /(?:\bVIN\b|n[°o]?\s*de\s*ch[aâ]ssis|num[ée]ro\s*de\s*ch[aâ]ssis|\bch[aâ]ssis\b|num[ée]ro\s*de\s*s[ée]rie|\bserial\b)\s*(?:n[°o]\s*)?[:#=]?\s*([A-HJ-NPR-Z0-9]{17})(?![A-Z0-9])/i;

/** Un jeton de 17 caractères isolé, sans étiquette. */
const JETON_VIN = /(?<![A-Z0-9])([A-HJ-NPR-Z0-9]{17})(?![A-Z0-9])/gi;

export type VinTrouve = {
  vin: string;
  /** Le texte le nommait-il explicitement ? Un VIN étiqueté est une donnée
   *  fournie ; un jeton isolé reste une reconnaissance de forme. */
  etiquette: boolean;
};

/** Le VIN écrit dans un texte, ou `null`.
 *
 *  Deux passes, et la seconde est délibérément MÉFIANTE :
 *  1. étiqueté (« VIN : … », « n° de châssis … ») — on le prend tel quel ;
 *  2. jeton isolé de 17 caractères — accepté SEULEMENT si sa forme le
 *     corrobore : un WMI reconnu, ou une clé de contrôle qui tombe juste.
 *
 *  ⚠️ Sans la seconde condition, une référence d'annonce (« REF2024ABCD12345 »)
 *  passerait pour un VIN et le dossier annoncerait une discordance de
 *  constructeur sur une chaîne qui n'en est pas un. Un jeton uniquement
 *  numérique est refusé d'office : 17 chiffres, c'est un numéro, pas un VIN. */
export function trouverVin(texte: unknown): VinTrouve | null {
  const t = String(texte ?? "");
  if (t.length < 17) return null;

  const etiquete = t.match(ETIQUETTE_VIN);
  if (etiquete) return { vin: etiquete[1].toUpperCase(), etiquette: true };

  for (const m of t.matchAll(JETON_VIN)) {
    const candidat = m[1].toUpperCase();
    if (/^[0-9]{17}$/.test(candidat)) continue; // 17 chiffres : un numéro, pas un VIN
    const d = decoderVin(candidat);
    if (!d.valide) continue;
    const corrobore = d.constructeur != null || d.cle?.concorde === true;
    if (corrobore) return { vin: candidat, etiquette: false };
  }
  return null;
}

// ---------------------------------------------------------------------------
// CONCORDANCE avec ce que dit l'annonce.
// ---------------------------------------------------------------------------
const sansAccentVin = (s: unknown) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export type ConcordanceVin = {
  /** 'accord' | 'discordance' | 'indecidable' pour chaque élément comparé. */
  constructeur: "accord" | "discordance" | "indecidable";
  annee: "accord" | "discordance" | "indecidable";
  /** Phrases prêtes à afficher, une par élément comparé. */
  constats: Array<{ ok: boolean; texte: string }>;
};

/** Le VIN décrit-il bien le véhicule de l'annonce ?
 *
 *  ⚠️ UNE SEULE implémentation, partagée par le serveur et par le bloc VIN de
 *  /a/:id. Avant le sprint 20 la comparaison vivait dans le composant : le
 *  serveur et l'écran pouvaient conclure différemment sur le même VIN. */
export function concordanceVin(
  d: DecodeVin,
  vehicule: { marque?: unknown; annee?: unknown },
): ConcordanceVin {
  const constats: Array<{ ok: boolean; texte: string }> = [];
  const marque = sansAccentVin(vehicule?.marque);
  const annee = typeof vehicule?.annee === "number" ? vehicule.annee : null;

  let cstr: ConcordanceVin["constructeur"] = "indecidable";
  if (d.valide && d.constructeur && marque) {
    const c = sansAccentVin(d.constructeur);
    // Le libellé du WMI porte parfois l'usine (« Audi (usine de Győr) ») : on
    // compare donc sur le premier mot autant que sur la chaîne entière.
    const ok = c.includes(marque) || marque.includes(c.split(" ")[0]);
    cstr = ok ? "accord" : "discordance";
    constats.push(ok
      ? { ok: true, texte: `Constructeur du VIN (${d.constructeur}) cohérent avec l'annonce (${vehicule.marque}).` }
      : {
        ok: false,
        texte: `Le VIN désigne un véhicule ${d.constructeur} alors que l'annonce dit ${vehicule.marque} : ` +
          `faites-vous expliquer cette différence avant toute visite.`,
      });
  }

  let an: ConcordanceVin["annee"] = "indecidable";
  if (d.valide && annee != null && d.annees_possibles.length > 0) {
    const ok = d.annees_possibles.some((a) => Math.abs(a - annee) <= 1);
    an = ok ? "accord" : "discordance";
    constats.push(ok
      ? { ok: true, texte: `Année-modèle du VIN (${d.annees_possibles.join(" ou ")}) compatible avec l'annonce (${annee}).` }
      : {
        ok: false,
        // ⚠️ Le code d'année n'est PAS obligatoire hors Amérique du Nord :
        // une discordance est une question, jamais une preuve.
        texte: `L'année-modèle codée dans le VIN (${d.annees_possibles.join(" ou ")}) ne correspond pas à ` +
          `l'annonce (${annee}) — ce code n'est pas obligatoire en Europe, mais posez la question.`,
      });
  }

  return { constructeur: cstr, annee: an, constats };
}

/** La phrase d'incohérence posée par le SERVEUR quand le VIN désigne un autre
 *  constructeur. Constante, pour que le filtre d'exemption la retrouve mot
 *  pour mot (`filtrerIncoherences`). */
export function incoherenceConstructeur(constructeurVin: string, marqueAnnonce: string): string {
  return `Le numéro de châssis désigne un véhicule ${constructeurVin}, alors que l'annonce annonce un véhicule ` +
    `${marqueAnnonce} : l'un des deux est faux. À faire expliquer, carte grise en main, avant tout déplacement.`;
}
