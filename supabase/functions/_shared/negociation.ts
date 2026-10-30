// SPRINT 3 — Marge de négociation chiffrée.
// Fonction PURE et déterministe, testable hors ligne (tests/negociation.test.mjs).
//
// Règle d'or inchangée : un poste n'entre dans le TOTAL que si son coût est
// sourcé (table repair_costs — « sourcé » ou « validé par devis » — ou coût
// publié de la fiche moteur). Les autres restent des « arguments sans montant ».
// Le total n'est affiché en fourchette qu'à partir de 2 postes chiffrés.

export type CoutCandidat = {
  operation: string;
  cout_min_eur: number | null;
  cout_max_eur: number | null;
  urls: string[];
  // valide_devis : confirmé par un devis réel (admin) ; source : fourchette
  // publiée (recherche sourcée) ; fiche : coût publié de la fiche moteur.
  statut: "valide_devis" | "source" | "fiche";
  famille_norm: string; // "" = générique (toutes familles)
};

export type PosteNegociation = {
  type:
    | "defaut_photo"
    | "defaut_annonce"
    | "ct_defaut"
    | "entretien_non_prouve"
    | "echeance_proche";
  poste: string;
  argument: string;
  cout_min_eur: number | null;
  cout_max_eur: number | null;
  source_statut: "valide_devis" | "source" | "fiche" | null;
  urls: string[];
};

export type Negociation = {
  total_min_eur: number | null;
  total_max_eur: number | null;
  nb_postes_chiffres: number;
  postes: PosteNegociation[]; // chiffrés, coût décroissant
  arguments_sans_montant: PosteNegociation[];
  argumentaire: string | null; // prêt à dire au vendeur (détail Pass)
  mention: string;
};

// SPRINT 7 — version PUBLIQUE (sans Pass) du bloc négociation, miroir exact
// de la fonction SQL public._negociation_publique (get_public_analysis).
// Gratuit = fourchette totale + 2 postes principaux ; le reste est RETENU
// côté serveur (le floutage client du sprint 3 envoyait tout au navigateur).
export type NegociationPublique = {
  total_min_eur: number | null;
  total_max_eur: number | null;
  nb_postes_chiffres: number;
  postes: PosteNegociation[];
  arguments_sans_montant: PosteNegociation[];
  argumentaire: null;
  mention: string;
  masque: true;
  nb_postes_masques: number;
  nb_arguments_masques: number;
};

export function negociationPublique(n: Negociation | null): Negociation | NegociationPublique | null {
  if (!n || typeof n !== "object") return n;
  const postes = Array.isArray(n.postes) ? n.postes : [];
  const sansMontant = Array.isArray(n.arguments_sans_montant) ? n.arguments_sans_montant : [];
  return {
    total_min_eur: n.total_min_eur ?? null,
    total_max_eur: n.total_max_eur ?? null,
    nb_postes_chiffres: n.nb_postes_chiffres ?? postes.length,
    postes: postes.slice(0, 2),
    arguments_sans_montant: [],
    argumentaire: null,
    mention: n.mention,
    masque: true,
    nb_postes_masques: Math.max(postes.length - 2, 0),
    nb_arguments_masques: sansMontant.length,
  };
}

// Le texte du vendeur n'est JAMAIS recopié tel quel dans un argument affiché :
// extrait court (≤ 15 mots par défaut), sans lien, email ni numéro de
// téléphone/SIRET (toute suite d'au moins 9 chiffres — jamais un kilométrage
// ou un prix, qui en comptent 6 au plus).
export function nettoyerCitationVendeur(t: string, maxMots = 15): string {
  let s = t
    .replace(/(https?:\/\/|www\.)\S+/gi, "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]{2,}/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  s = s.replace(/[+\d][\d\s.\-()]{6,}\d/g, (m) => ((m.match(/\d/g) ?? []).length >= 9 ? "" : m))
    .replace(/\s{2,}/g, " ").trim();
  const mots = s.split(/\s+/).filter(Boolean);
  if (mots.length > maxMots) s = mots.slice(0, maxMots).join(" ") + "…";
  return s;
}

export const MENTION_NEGOCIATION =
  "Coûts indicatifs à faire chiffrer par un garage. À utiliser comme arguments, pas comme une remise garantie.";

const MAX_POSTES_CHIFFRES = 6;
const MAX_SANS_MONTANT = 6;
// Échéance « proche » : l'opération tombera pendant la première année de
// détention (moins de 15 000 km ou 12 mois).
const ECHEANCE_KM = 15_000;

export const norm = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const STOP = new Set([
  "dans", "avec", "sans", "pour", "cette", "votre", "notre", "leur", "elle",
  "sont", "etre", "avant", "apres", "tres", "plus", "moins", "photo", "cote",
  "droit", "gauche", "avant", "arriere", "vehicule", "voiture", "moteur",
  "remplacement", "changement", "kit", "usure", "etat", "legere", "visible",
]);

export const tokens = (t: string) =>
  new Set(norm(t).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w)));

// Organes canoniques : permet d'apparier « plaquettes usées » ↔ « plaquettes
// de frein avant » sans dépendre du mot exact.
const ORGANES: Record<string, string[]> = {
  pneu: ["pneu", "pneus", "pneumatique", "pneumatiques", "gommes"],
  frein: ["frein", "freins", "plaquette", "plaquettes", "disque", "disques", "freinage"],
  distribution: ["distribution", "courroie", "chaine"],
  embrayage: ["embrayage", "volant moteur", "bi-masse", "bimasse"],
  vidange: ["vidange", "revision", "entretien courant"],
  amortisseur: ["amortisseur", "amortisseurs", "suspension", "suspensions"],
  batterie: ["batterie"],
  parebrise: ["pare-brise", "parebrise", "pare brise", "impact"],
  carrosserie: ["carrosserie", "rayure", "rayures", "aile", "pare-chocs", "parechocs", "portiere", "capot", "peinture", "bosse", "enfoncement", "choc"],
  fap: ["fap", "filtre a particules"],
  egr: ["egr"],
  turbo: ["turbo", "turbocompresseur"],
  injecteur: ["injecteur", "injecteurs", "injection"],
  clim: ["climatisation", "clim", "compresseur"],
  echappement: ["echappement", "catalyseur", "silencieux"],
  jante: ["jante", "jantes"],
};

export function organesDe(texte: string): Set<string> {
  const t = ` ${norm(texte)} `;
  const found = new Set<string>();
  for (const [organe, mots] of Object.entries(ORGANES)) {
    if (mots.some((m) => t.includes(norm(m)))) found.add(organe);
  }
  return found;
}

const RANG_STATUT: Record<string, number> = { valide_devis: 0, source: 1, fiche: 2 };

/** Meilleur coût sourcé pour un libellé de poste : même organe canonique ou
 *  ≥ 2 mots significatifs communs ; devis validé > fourchette sourcée > fiche. */
export function chercherCout(
  poste: string,
  candidats: CoutCandidat[],
): CoutCandidat | null {
  const orgPoste = organesDe(poste);
  const tokPoste = tokens(poste);
  let best: { c: CoutCandidat; score: number } | null = null;
  for (const c of candidats) {
    if (c.cout_min_eur == null && c.cout_max_eur == null) continue;
    const orgC = organesDe(c.operation);
    let communsOrg = 0;
    for (const o of orgPoste) if (orgC.has(o)) communsOrg += 1;
    let communsTok = 0;
    for (const t of tokens(c.operation)) if (tokPoste.has(t)) communsTok += 1;
    if (communsOrg === 0 && communsTok < 2) continue;
    // Priorité au statut, puis au nombre de recoupements, puis ordre stable.
    const score = (2 - RANG_STATUT[c.statut]) * 100 + communsOrg * 10 + communsTok;
    if (!best || score > best.score) best = { c, score };
  }
  return best?.c ?? null;
}

type EntreeNegociation = {
  famille_moteur: string | null;
  boite_code: string | null;
  kilometrage: number | null;
  age_ans: number | null;
  constats_photo: Array<{ organe: string; constat: string; signal: string }>;
  ct_defauts: string[];
  defauts_annonce: Array<{ description: string; organe: string | null }>;
  // Opérations DUES (plan sourcé) sans justificatif annoncé.
  entretien_du_non_prouve: Array<{
    operation: string;
    cout_min_eur: number | null;
    cout_max_eur: number | null;
    critique: boolean;
    urls?: string[];
  }>;
  // Opérations que l'annonce déclare EXPLICITEMENT non faites (« distribution
  // jamais faite ») — déjà auditées par la critique.
  operations_non_faites: string[];
  plan_entretien: Array<{
    operation: string;
    intervalle_km: number | null;
    intervalle_annees: number | null;
    cout_min_eur: number | null;
    cout_max_eur: number | null;
    a_verifier_carnet: boolean;
    urls?: string[];
  }>;
  couts: CoutCandidat[]; // lignes repair_costs déjà filtrées famille-compatibles + génériques
};

const normFam = (f: string | null) => (f ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Filtre les lignes repair_costs applicables : génériques ("" ) ou dont la
 *  famille est compatible par préfixe avec la famille moteur ou la boîte. */
export function coutsApplicables(
  rows: CoutCandidat[],
  famille: string | null,
  boite: string | null,
): CoutCandidat[] {
  const fam = normFam(famille);
  const bte = normFam(boite);
  return rows.filter((r) => {
    const f = normFam(r.famille_norm);
    if (f === "") return true;
    if (fam && (f.startsWith(fam) || fam.startsWith(f))) return true;
    if (bte && (f.startsWith(bte) || bte.startsWith(f))) return true;
    return false;
  });
}

const fr = (n: number) => n.toLocaleString("fr-FR");
const fourchetteTexte = (min: number | null, max: number | null) =>
  min != null && max != null && min !== max
    ? `${fr(min)} – ${fr(max)} €`
    : `${fr((min ?? max)!)} €`;

export function calculerNegociation(e: EntreeNegociation): Negociation {
  // Candidats de coût : devis validés et fourchettes sourcées de repair_costs
  // (déjà filtrés famille-compatibles), puis coûts publiés du plan d'entretien.
  const candidats: CoutCandidat[] = [
    ...e.couts,
    ...e.plan_entretien
      .filter((op) => op.cout_min_eur != null || op.cout_max_eur != null)
      .map((op) => ({
        operation: op.operation,
        cout_min_eur: op.cout_min_eur,
        cout_max_eur: op.cout_max_eur,
        urls: [],
        statut: "fiche" as const,
        famille_norm: "",
      })),
  ];

  const bruts: Array<Omit<PosteNegociation, "cout_min_eur" | "cout_max_eur" | "source_statut" | "urls"> & {
    cout_direct_min?: number | null;
    cout_direct_max?: number | null;
    cout_direct_urls?: string[];
  }> = [];

  // 1) Défauts constatés sur les photos (jamais le compteur : un écart de
  // compteur est un signal de fuite, pas un argument de remise).
  for (const c of e.constats_photo) {
    if (c.signal !== "rouge" && c.signal !== "attention") continue;
    if (c.organe === "compteur" || c.organe === "document_ct" || c.organe === "autre") continue;
    bruts.push({
      type: "defaut_photo",
      poste: c.constat.slice(0, 140),
      argument: `Les photos montrent : ${c.constat}`,
    });
  }

  // 2) Défaillances lisibles sur le PV de contrôle technique photographié.
  for (const d of e.ct_defauts.slice(0, 6)) {
    bruts.push({
      type: "ct_defaut",
      poste: d.slice(0, 140),
      argument: `Le contrôle technique relève : ${d}`,
    });
  }

  // 3) Défauts que l'annonce admet elle-même (déjà reformulés/écourtés côté
  //    serveur : jamais le texte du vendeur tel quel, affiché entre guillemets).
  for (const d of e.defauts_annonce.slice(0, 6)) {
    bruts.push({
      type: "defaut_annonce",
      poste: d.description.slice(0, 140),
      argument: `L'annonce le reconnaît : « ${d.description} »`,
    });
  }

  // 4) Entretien « doit déjà avoir été fait » sans justificatif annoncé,
  //    et opérations que l'annonce déclare elle-même non faites.
  for (const op of e.entretien_du_non_prouve.slice(0, 5)) {
    bruts.push({
      type: "entretien_non_prouve",
      poste: op.operation.slice(0, 140),
      argument: `${op.operation} : due au kilométrage, aucun justificatif annoncé — sans facture, ce coût est à prévoir.`,
      cout_direct_min: op.cout_min_eur,
      cout_direct_max: op.cout_max_eur,
      cout_direct_urls: op.urls ?? [],
    });
  }
  for (const op of e.operations_non_faites.slice(0, 4)) {
    bruts.push({
      type: "entretien_non_prouve",
      poste: op.slice(0, 140),
      argument: `L'annonce le déclare (« ${op} ») — ce coût est donc devant vous.`,
    });
  }

  // 5) Opérations du plan d'entretien à échéance sous 12 mois / 15 000 km.
  //    (prochaine occurrence périodique ; les opérations déjà dues sont au 4).
  if (e.kilometrage != null || e.age_ans != null) {
    for (const op of e.plan_entretien) {
      if (op.a_verifier_carnet) continue;
      let proche = false;
      let echeance = "";
      if (op.intervalle_km != null && e.kilometrage != null) {
        // Prochaine occurrence périodique STRICTEMENT au-delà du km actuel
        // (l'occurrence déjà due sans justificatif est le poste « entretien
        // non prouvé », pas une échéance).
        const prochainKm = (Math.floor(e.kilometrage / op.intervalle_km) + 1) * op.intervalle_km;
        if (prochainKm - e.kilometrage <= ECHEANCE_KM) {
          proche = true;
          echeance = `dans ${fr(prochainKm - e.kilometrage)} km environ`;
        }
      }
      if (!proche && op.intervalle_annees != null && e.age_ans != null) {
        const prochainAge = (Math.floor(e.age_ans / op.intervalle_annees) + 1) * op.intervalle_annees;
        if (prochainAge - e.age_ans <= 1) {
          proche = true;
          echeance = `dans moins d'un an (intervalle ${op.intervalle_annees} ans)`;
        }
      }
      if (!proche) continue;
      bruts.push({
        type: "echeance_proche",
        poste: op.operation.slice(0, 140),
        argument: `${op.operation} : à l'échéance ${echeance} — ce coût arrive dans la première année.`,
        cout_direct_min: op.cout_min_eur,
        cout_direct_max: op.cout_max_eur,
        cout_direct_urls: op.urls ?? [],
      });
    }
  }

  // ---- Déduplication : un même fait (« distribution jamais faite ») peut
  // arriver par plusieurs canaux (défaut admis, opération non faite, plan) —
  // deux postes partageant au moins 2 mots significatifs sont fusionnés,
  // le premier rencontré gagne (jamais compté deux fois dans le total).
  const signatures: Array<Set<string>> = [];
  const dedupliques = bruts.filter((b) => {
    const sig = tokens(b.poste);
    const doublon = signatures.some((s2) => {
      let communs = 0;
      for (const t of sig) if (s2.has(t)) communs += 1;
      return communs >= 2;
    });
    if (doublon) return false;
    signatures.push(sig);
    return true;
  });

  // ---- Chiffrage : coût direct (plan sourcé) sinon meilleur candidat ----
  const chiffres: PosteNegociation[] = [];
  const sansMontant: PosteNegociation[] = [];
  for (const b of dedupliques) {
    const { cout_direct_min, cout_direct_max, cout_direct_urls, ...reste } = b;
    if (cout_direct_min != null || cout_direct_max != null) {
      chiffres.push({
        ...reste,
        cout_min_eur: cout_direct_min ?? null,
        cout_max_eur: cout_direct_max ?? null,
        source_statut: "fiche",
        urls: (cout_direct_urls ?? []).slice(0, 2),
      });
      continue;
    }
    const trouve = chercherCout(b.poste, candidats);
    if (trouve) {
      chiffres.push({
        ...reste,
        cout_min_eur: trouve.cout_min_eur,
        cout_max_eur: trouve.cout_max_eur,
        source_statut: trouve.statut,
        urls: trouve.urls.slice(0, 2),
      });
    } else {
      sansMontant.push({ ...reste, cout_min_eur: null, cout_max_eur: null, source_statut: null, urls: [] });
    }
  }

  // Coût décroissant, ordre stable.
  chiffres.sort((a, b) =>
    ((b.cout_max_eur ?? b.cout_min_eur ?? 0) - (a.cout_max_eur ?? a.cout_min_eur ?? 0))
  );
  const postes = chiffres.slice(0, MAX_POSTES_CHIFFRES);
  const arguments_sans_montant = sansMontant.slice(0, MAX_SANS_MONTANT);

  // Total en fourchette UNIQUEMENT à partir de 2 postes chiffrés.
  let total_min: number | null = null;
  let total_max: number | null = null;
  if (postes.length >= 2) {
    total_min = postes.reduce((s, p) => s + (p.cout_min_eur ?? p.cout_max_eur ?? 0), 0);
    total_max = postes.reduce((s, p) => s + (p.cout_max_eur ?? p.cout_min_eur ?? 0), 0);
  }

  // Argumentaire prêt à dire au vendeur (détail réservé au Pass côté UI).
  let argumentaire: string | null = null;
  if (postes.length + arguments_sans_montant.length > 0) {
    const lignes = [
      ...postes.map((p) =>
        `– ${p.argument} (${fourchetteTexte(p.cout_min_eur, p.cout_max_eur)} selon ${
          p.source_statut === "valide_devis" ? "un devis vérifié" : p.source_statut === "source" ? "les tarifs publiés" : "les coûts publiés pour ce moteur"
        })`
      ),
      ...arguments_sans_montant.map((p) => `– ${p.argument} (à faire chiffrer par un garage)`),
    ];
    argumentaire =
      `Votre véhicule m'intéresse, mais en l'état je dois prévoir :\n${lignes.join("\n")}\n` +
      (total_min != null
        ? `Au total, cela représente ${fr(total_min)} à ${fr(total_max!)} € de remise en état : je vous propose d'en tenir compte dans le prix.`
        : `Je vous propose d'en tenir compte dans le prix.`);
  }

  return {
    total_min_eur: total_min,
    total_max_eur: total_max,
    nb_postes_chiffres: postes.length,
    postes,
    arguments_sans_montant,
    argumentaire,
    mention: MENTION_NEGOCIATION,
  };
}
