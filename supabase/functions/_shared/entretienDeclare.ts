// Filet déterministe sur les déclarations d'entretien — module PUR
// (aucun appel réseau, aucun modèle) : tests/entretien-declare.test.mjs
//
// Pourquoi : l'extraction par le modèle des opérations déclarées non faites
// s'est révélée instable. Mesuré le 28/10/2026 sur une annonce qui dit en
// toutes lettres « Distribution jamais faite. » : 1 analyse sur 3 la ratait,
// le plafond « opération critique non faite » sautait et le verdict passait
// de 55 à 62 avec un conditionnel vert — sur une 308 PureTech, c'est-à-dire
// sur le défaut emblématique de ce moteur.
//
// Ce filet relit le texte de l'annonce avec des motifs FIXES avant le barème.
// Ce qu'il trouve est un fait établi par l'annonce elle-même : le modèle ne
// peut pas l'omettre, la critique ne peut pas le supprimer (source : annonce,
// extrait cité).

/** Statut déclaré par l'annonce pour une opération d'entretien. */
export type StatutEntretien = "non_fait" | "a_prevoir" | "fait";

export type FaitEntretien = {
  /** Libellé normalisé de l'opération (« Distribution », « Pneus »…). */
  operation: string;
  statut: StatutEntretien;
  /** Citation de l'annonce, 15 mots maximum. */
  extrait: string;
  /** Opération dont le défaut peut coûter le moteur : pèse sur le barème. */
  critique: boolean;
};

type Operation = {
  cle: string;
  libelle: string;
  critique: boolean;
  /** Motif du sujet, fautes courantes comprises. */
  sujet: string;
};

// Le sujet doit être nommé explicitement : jamais de détection sur un mot
// isolé qui pourrait désigner autre chose.
const OPERATIONS: Operation[] = [
  {
    cle: "distribution",
    libelle: "Distribution",
    critique: true,
    // « distibution », « distrib » : fautes et abréviations constatées.
    sujet:
      "(?:kit\\s+de\\s+)?(?:courroie\\s+de\\s+|cha[îi]ne\\s+de\\s+)?distr?ib(?:ution|utions|ition)?\\b",
  },
  {
    cle: "embrayage",
    libelle: "Embrayage",
    critique: true,
    sujet: "embra(?:yage|illage|yge|iage)\\b",
  },
  {
    cle: "vidange_boite",
    libelle: "Vidange de boîte",
    critique: true,
    sujet: "(?:vidange|huile)\\s+(?:de\\s+)?(?:la\\s+)?bo[îi]te(?:\\s+(?:auto|automatique|de\\s+vitesses))?\\b",
  },
  {
    cle: "courroie_accessoires",
    libelle: "Courroie d'accessoires",
    critique: true,
    sujet: "courroie(?:\\s+d['’]\\s*accessoires?)?\\b",
  },
  {
    cle: "vidange",
    libelle: "Vidange",
    critique: false,
    sujet: "vidanges?\\b",
  },
  {
    cle: "pneus",
    libelle: "Pneus",
    critique: false,
    sujet: "pneu(?:s|x)?\\b|pneumatiques?\\b",
  },
  {
    cle: "freins",
    libelle: "Freins",
    critique: false,
    sujet: "freins?\\b|plaquettes?\\b|disques?\\s+(?:de\\s+)?freins?\\b",
  },
  {
    cle: "controle_technique",
    libelle: "Contrôle technique",
    critique: false,
    sujet: "contr[ôo]les?\\s+techniques?\\b|\\bCT\\b",
  },
  {
    cle: "amortisseurs",
    libelle: "Amortisseurs",
    critique: false,
    sujet: "amortisseurs?\\b",
  },
];

// Verbes d'exécution d'une opération (accords et fautes courantes).
const VERBE_FAIT =
  "(?:faite?s?|fait|chang[ée]e?s?|changer|remplac[ée]e?s?|effectu[ée]e?s?|refaite?s?|refait|r[ée]alis[ée]e?s?|pos[ée]e?s?|mont[ée]e?s?|neufs?|neuves?|neuf|neuve)";

// Qualificatif court admis entre le sujet et le verbe : « pneus AVANT neufs »,
// « plaquettes ARRIÈRE changées ». Limité à deux mots pour que le verbe reste
// rattaché au sujet et non à une autre partie de la phrase.
const QUALIFICATIF = "(?:\\s+(?:avant|arri[èe]re|av|ar|droite?s?|gauches?|x\\s*\\d{1,2}|\\d{1,2})\\b){0,2}";

// Verbes attendus derrière « à … » quand l'opération reste à faire.
const VERBE_A_FAIRE =
  "(?:pr[ée]voir|faire|changer|refaire|remplacer|revoir|planifier|anticiper|passer|repasser)";

/** Mots qui, juste avant une détection, en inversent le sens. */
const NEGATION_AMONT =
  /(?:\b(?:pas|aucune?|aucuns|rien|nul{1,2}e?|jamais)\s+(?:de\s+|d['’]\s*)?|\bsans\s+)$/i;

/** Un contexte comme « jamais eu de souci de … » parle de pannes, pas d'entretien. */
const FAUX_SUJET =
  /\b(?:probl[èe]mes?|soucis?|panne|pannes|bruits?|claquements?|fuites?|d[ée]fauts?)\b/i;

const MAX_MOTS_EXTRAIT = 15;

/** Phrase du texte contenant l'index donné (découpage sur . ! ? ; retours). */
function phraseAutour(texte: string, index: number): { phrase: string; debutPhrase: number } {
  const avant = texte.slice(0, index);
  const sepAvant = Math.max(
    avant.lastIndexOf("."),
    avant.lastIndexOf("!"),
    avant.lastIndexOf("?"),
    avant.lastIndexOf(";"),
    avant.lastIndexOf("\n"),
    avant.lastIndexOf("—"),
  );
  const debut = sepAvant >= 0 ? sepAvant + 1 : 0;
  const reste = texte.slice(index);
  const m = reste.match(/[.!?;\n—]/);
  const fin = index + (m && m.index != null ? m.index : reste.length);
  return { phrase: texte.slice(debut, fin).trim(), debutPhrase: debut };
}

/** Citation de l'annonce ramenée à 15 mots, sans couper au milieu d'un mot. */
export function extraitCourt(phrase: string, maxMots = MAX_MOTS_EXTRAIT): string {
  const mots = phrase.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (mots.length <= maxMots) return mots.join(" ");
  return `${mots.slice(0, maxMots).join(" ")}…`;
}

type Detection = { operation: Operation; statut: StatutEntretien; index: number; phrase: string };

/**
 * Relit le texte d'une annonce et renvoie les opérations d'entretien dont le
 * vendeur déclare explicitement l'état. Aucune inférence : seules les
 * formulations listées déclenchent un fait.
 */
export function detecterEntretienDeclare(texte: string): FaitEntretien[] {
  const t = String(texte ?? "");
  if (!t.trim()) return [];
  const detections: Detection[] = [];

  for (const op of OPERATIONS) {
    // 1. NON FAIT — « distribution jamais faite », « distribution n'a jamais
    //    été changée », « distribution pas faite », « courroie non remplacée ».
    const nonFait = new RegExp(
      `(${op.sujet})(${QUALIFICATIF}(?:\\s+\\([^)]*\\))?(?:\\s+(?:n['’]\\s*(?:a|est|ont|sont)|a|est|ont|sont))?\\s+(?:jamais|pas|non)\\s+(?:encore\\s+)?(?:[ée]t[ée]\\s+)?${VERBE_FAIT})`,
      "gi",
    );
    // 2. NON FAIT inverse — « jamais changé la distribution ». Le verbe doit
    //    être présent entre la négation et le sujet : « jamais eu de problème
    //    de distribution » ne peut donc pas matcher.
    const nonFaitInverse = new RegExp(
      `(jamais\\s+(?:[ée]t[ée]\\s+)?${VERBE_FAIT}\\s+(?:l[ae]\\s+|les\\s+|le\\s+|de\\s+l[ae]\\s+|du\\s+)?(?:${op.sujet}))`,
      "gi",
    );
    // 3. NON FAIT — « distribution d'origine » (formule standard du marché).
    const origine = new RegExp(`(${op.sujet})(\\s+(?:d['’]\\s*|de\\s+l['’]\\s*)origine)`, "gi");
    // 4. À PRÉVOIR — « distribution à prévoir », « pneus à changer ».
    const aPrevoir = new RegExp(`(${op.sujet})(${QUALIFICATIF}\\s+[àa]\\s+${VERBE_A_FAIRE})`, "gi");
    // 5. FAIT — « distribution faite à 95 000 km », « vidange effectuée le … ».
    const fait = new RegExp(
      `(${op.sujet})(${QUALIFICATIF}(?:\\s+\\([^)]*\\))?(?:\\s+(?:a|ont|est|sont))?\\s+(?:[ée]t[ée]\\s+)?${VERBE_FAIT})`,
      "gi",
    );

    const essais: Array<{ re: RegExp; statut: StatutEntretien }> = [
      { re: nonFait, statut: "non_fait" },
      { re: nonFaitInverse, statut: "non_fait" },
      { re: origine, statut: "non_fait" },
      { re: aPrevoir, statut: "a_prevoir" },
      { re: fait, statut: "fait" },
    ];

    for (const { re, statut } of essais) {
      for (const m of t.matchAll(re)) {
        const index = m.index ?? 0;
        const amont = t.slice(Math.max(0, index - 24), index);
        // « pas de distribution à prévoir », « sans vidange à faire » : la
        // négation porte sur l'opération elle-même, il n'y a rien à signaler.
        if (NEGATION_AMONT.test(amont)) continue;
        const { phrase } = phraseAutour(t, index);
        // « jamais eu de problème de distribution » : le sujet de la phrase
        // est une panne, pas une opération d'entretien.
        if (statut === "non_fait" && FAUX_SUJET.test(phrase)) continue;
        detections.push({ operation: op, statut, index, phrase });
      }
    }
  }

  // Une même opération ne produit qu'un fait : le statut le plus engageant
  // gagne (non_fait > a_prevoir > fait), et à égalité la première occurrence.
  const RANG: Record<StatutEntretien, number> = { non_fait: 3, a_prevoir: 2, fait: 1 };
  const parOperation = new Map<string, Detection>();
  for (const d of detections) {
    const deja = parOperation.get(d.operation.cle);
    if (!deja || RANG[d.statut] > RANG[deja.statut]) parOperation.set(d.operation.cle, d);
  }

  // « courroie » seule ne doit pas doubler « distribution » quand les deux
  // visent la même phrase (« courroie de distribution jamais faite »).
  const distribution = parOperation.get("distribution");
  const courroie = parOperation.get("courroie_accessoires");
  if (distribution && courroie && courroie.phrase === distribution.phrase) {
    parOperation.delete("courroie_accessoires");
  }
  // Même principe pour la vidange de boîte, plus précise que la vidange.
  const vidangeBoite = parOperation.get("vidange_boite");
  const vidange = parOperation.get("vidange");
  if (vidangeBoite && vidange && vidange.phrase === vidangeBoite.phrase) {
    parOperation.delete("vidange");
  }

  return [...parOperation.values()]
    .sort((a, b) => a.index - b.index)
    .map((d) => ({
      operation: d.operation.libelle,
      statut: d.statut,
      extrait: extraitCourt(d.phrase),
      critique: d.operation.critique,
    }));
}

/**
 * Opérations critiques que l'annonce déclare non faites ou à prévoir : dans
 * les deux cas l'opération n'est pas faite, et c'est ce que compte le barème.
 */
export function compterCritiquesNonFaites(faits: FaitEntretien[]): number {
  return faits.filter((f) => f.critique && (f.statut === "non_fait" || f.statut === "a_prevoir")).length;
}

/** Libellé affiché dans « Doit déjà avoir été fait ». */
export function libelleDeclaration(f: FaitEntretien): string {
  const etat = f.statut === "fait"
    ? "déclarée faite dans l'annonce"
    : f.statut === "a_prevoir"
    ? "déclarée à prévoir dans l'annonce"
    : "déclarée non faite dans l'annonce";
  return `${f.operation} — ${etat}`;
}

/**
 * Un fait du filet est-il déjà couvert par une phrase du modèle ?
 * Comparaison sur le nom de l'opération uniquement : si le modèle a déjà dit
 * « distribution jamais faite », le filet ne le répète pas.
 */
export function dejaCouvert(f: FaitEntretien, phrases: string[]): boolean {
  const cle = f.operation.toLowerCase().split(/\s+/)[0].replace(/[^a-zà-ÿ]/g, "");
  if (cle.length < 4) return false;
  return phrases.some((p) => p.toLowerCase().includes(cle.slice(0, 6)));
}
