// Décisions de cache pour /rappels — module PUR (aucun appel réseau, aucune
// dépendance Supabase) pour être testable hors ligne : tests/rappels-cache.test.mjs
//
// Incident du 28/10/2026 : l'API RappelConso a traversé une fenêtre de
// réindexation pendant laquelle elle répondait 200 avec ZÉRO enregistrement
// pour la marque Audi (alors qu'elle en publie 64). Ce vide a été écrit dans
// rappels_cache et servi pendant 24 h : l'acheteur lisait « Aucun rappel »
// alors que la vérification n'avait simplement pas eu lieu.
//
// Règles posées ici :
//  1. On ne met JAMAIS en cache une réponse vide ou en erreur — le TTL de
//     24 h est réservé aux résultats non vides, les seuls qui ne peuvent pas
//     être le symptôme d'une panne amont.
//  2. Zéro enregistrement pour TOUTE la marque (après un second essai) n'est
//     pas « aucun rappel » : c'est une indisponibilité. Une marque référencée
//     dans RappelConso y a toujours des fiches ; un zéro global signifie que
//     la requête n'a rien pu lire.
//  3. Des enregistrements existent pour la marque mais aucun ne vise le
//     modèle : là, c'est un vrai « aucun rappel pour ce modèle » — affiché
//     comme tel, mais toujours pas mis en cache (règle 1).
//  4. Une entrée de cache vide écrite par une version antérieure n'est jamais
//     servie : elle est ignorée et la vérification est refaite.

/** Issue d'un appel à RappelConso, telle que la voit l'appelant. */
export type EtatRappels =
  | "ok" // l'API a répondu et a pu être interprétée
  | "indisponible"; // erreur réseau/HTTP, ou zéro enregistrement pour la marque

export type RaisonIndisponible =
  | "http" // statut HTTP non 2xx
  | "reseau" // exception fetch / JSON illisible
  | "aucun_enregistrement_marque" // 200 mais 0 fiche pour la marque, deux fois
  | "marque_non_interrogeable"; // marque impossible à passer en clause where

export type ResultatRappels = {
  etat: EtatRappels;
  /** Fiches retenues pour ce modèle (vide = aucun rappel visant ce modèle). */
  matches: unknown[];
  /** Nombre d'enregistrements bruts renvoyés par l'API pour la marque. */
  bruts: number;
  raison?: RaisonIndisponible;
};

export const MESSAGE_INDISPONIBLE =
  "Vérification RappelConso indisponible, réessayez plus tard.";

/**
 * Une réponse mérite-t-elle d'être mise en cache ?
 * Uniquement un résultat confirmé ET non vide : tout le reste serait figer
 * une panne amont pour 24 h.
 */
export function doitMettreEnCache(r: ResultatRappels): boolean {
  return r.etat === "ok" && Array.isArray(r.matches) && r.matches.length > 0;
}

/** Nombre maximal d'appels à l'API pour une même demande. */
export const MAX_ESSAIS = 2;

/**
 * Faut-il retenter la requête avant de conclure ?
 * Oui quand l'API a répondu mais n'a renvoyé aucun enregistrement pour la
 * marque : c'est la signature exacte de la fenêtre de réindexation.
 */
export function doitRetenter(bruts: number, essaisFaits: number): boolean {
  return bruts === 0 && essaisFaits < MAX_ESSAIS;
}

/**
 * Classe une réponse de l'API déjà décodée.
 * @param bruts  enregistrements renvoyés pour la marque (avant filtre modèle)
 * @param matches fiches retenues pour le modèle demandé
 */
export function classerReponse(bruts: number, matches: unknown[]): ResultatRappels {
  if (bruts === 0) {
    return {
      etat: "indisponible",
      matches: [],
      bruts: 0,
      raison: "aucun_enregistrement_marque",
    };
  }
  return { etat: "ok", matches, bruts };
}

/** Réponse d'échec (exception, HTTP non 2xx, marque impossible à interroger). */
export function echec(raison: RaisonIndisponible): ResultatRappels {
  return { etat: "indisponible", matches: [], bruts: 0, raison };
}

export type EntreeCache = {
  payload?: { rappels?: unknown[] | null } | null;
  fetched_at?: string | null;
} | null;

/**
 * Une entrée de cache est-elle servable ?
 * Elle doit être fraîche (< ttlMs) ET non vide — une entrée vide écrite avant
 * ce durcissement est ignorée pour forcer une vraie vérification.
 */
export function cacheServable(
  entree: EntreeCache,
  maintenantMs: number,
  ttlMs: number,
): boolean {
  if (!entree || !entree.fetched_at) return false;
  const rappels = entree.payload?.rappels;
  if (!Array.isArray(rappels) || rappels.length === 0) return false;
  const age = maintenantMs - new Date(entree.fetched_at).getTime();
  return Number.isFinite(age) && age >= 0 && age < ttlMs;
}
