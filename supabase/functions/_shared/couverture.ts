// SPRINT 23 — Fiches multi-marques : UNE fiche par moteur, une couverture
// EXPLICITE (décision d'Utku du 10 nov. 2026).
//
// Ni une fiche par marque (116 fiches), ni une recherche par groupe entier
// (« Alliance », « VAG ») qui prêterait à une Dacia tout ce qui est dit d'une
// Renault. Une fiche porte la LISTE des marques et modèles qu'elle couvre,
// bornée par années, telle que les sources la donnent (`marques` et
// `modeles_annees` du fichier sources-moteurs-2026-11).
//
// ⚠️ RESTRICTIVE PAR CONSTRUCTION. Un véhicule n'est couvert que si sa
// marque, son modèle ET son année figurent dans la liste. Modèle inconnu ou
// année inconnue alors que la couverture est bornée ⇒ NON couvert : on
// n'étend jamais une fiche à un véhicule qu'on ne sait pas situer.
//
// ⚠️ Couverture vide (valeur par défaut) ⇒ la fiche ne sert qu'à sa propre
// marque, comme avant. Déployer ce code ne change donc AUCUN score ; c'est
// l'écriture des couvertures qui en change.
//
// Module PUR.
import { marqueCanonique, modeleCanonique } from "./marche.ts";

export type EntreeCouverture = {
  marque: string; // canonique (marqueCanonique)
  modele: string; // canonique (modeleCanonique)
  annee_debut: number | null;
  annee_fin: number | null;
};

export type VehiculeCouverture = { marque: unknown; modele: unknown; annee: number | null };

export function couvre(couverture: unknown, v: VehiculeCouverture): boolean {
  if (!Array.isArray(couverture) || couverture.length === 0) return false;
  const marque = marqueCanonique(v.marque);
  const modele = modeleCanonique(v.modele);
  if (!marque || !modele) return false;
  return couverture.some((e: EntreeCouverture) => {
    if (!e || e.marque !== marque || e.modele !== modele) return false;
    const borne = e.annee_debut != null || e.annee_fin != null;
    if (!borne) return true;
    if (v.annee == null) return false; // bornée, année inconnue : on ne situe pas
    return (e.annee_debut == null || v.annee >= e.annee_debut) && (e.annee_fin == null || v.annee <= e.annee_fin);
  });
}

/** Nettoie une couverture reçue (écriture admin) : marques et modèles
 *  canonisés, bornes plausibles, doublons retirés. */
export function couvertureValide(brut: unknown): EntreeCouverture[] {
  const out: EntreeCouverture[] = [];
  const vus = new Set<string>();
  for (const e of Array.isArray(brut) ? brut.slice(0, 200) : []) {
    // deno-lint-ignore no-explicit-any
    const x = e as any;
    const marque = marqueCanonique(x?.marque);
    const modele = modeleCanonique(x?.modele);
    if (!marque || !modele) continue;
    const an = (n: unknown) => (typeof n === "number" && n >= 1980 && n <= 2035 ? Math.round(n) : null);
    let debut = an(x?.annee_debut), fin = an(x?.annee_fin);
    if (debut != null && fin != null && debut > fin) [debut, fin] = [fin, debut];
    const cle = `${marque}|${modele}|${debut}|${fin}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    out.push({ marque, modele, annee_debut: debut, annee_fin: fin });
  }
  return out;
}

// ── Proposition depuis le fichier de sources (pour RELECTURE humaine) ──────
//
// `modeles_annees` est du texte libre : « Renault Clio III, Modus, Kangoo II ;
// Dacia (dCi 70/85 et 110) ; Nissan Qashqai (09/2009-01/2011), Note ». On en
// tire une PROPOSITION, jamais écrite sans relecture : un modèle mal lu
// étendrait une fiche à une voiture qu'elle ne concerne pas.

const ANNEES = (t: string) => (String(t).match(/\b(19[89]\d|20[0-3]\d)\b|\b\d{1,2}\/(\d{4})\b/g) ?? [])
  .map((y) => Number(y.slice(-4)));

export function proposerCouverture(modelesAnnees: string, marques: string[]): EntreeCouverture[] {
  const out: EntreeCouverture[] = [];
  const marquesC = marques.map((m) => ({ brut: m, c: marqueCanonique(m) })).filter((m) => m.c);
  // Bornes globales : « production 09/2009 à 02/2011 », « 2018-2024 ».
  const queue = String(modelesAnnees).split(/\s+[—–]\s+/).slice(1).join(" ");
  const global = ANNEES(queue);
  for (const seg of String(modelesAnnees).split(/\s+[—–]\s+/)[0].split(/\s*;\s*/)) {
    let marqueCourante: string | null = null;
    let reste = seg.trim();
    for (const m of marquesC) {
      const re = new RegExp(`^${m.brut.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(reste)) { marqueCourante = m.c; reste = reste.replace(re, "").trim(); break; }
    }
    if (!marqueCourante) marqueCourante = marquesC.length === 1 ? marquesC[0].c : null;
    if (!marqueCourante) continue;
    // Une parenthèse SANS nom de modèle (« (dCi 70/85 et 110) ») ne nomme
    // aucun modèle : rien n'est proposé pour cette marque.
    for (const morceau of reste.split(/\s*,\s*(?![^()]*\))/)) {
      const nom = morceau.replace(/\([^()]*\)/g, "").replace(/\b(?:dCi|TCe|HDi|BlueHDi|TDI|TSI|ch|cv)\b.*$/i, "").trim();
      const modele = modeleCanonique(nom);
      if (!modele || modele.length < 2 || /^\d/.test(modele)) continue;
      const ys = ANNEES(morceau).length ? ANNEES(morceau) : global;
      out.push({
        marque: marqueCourante, modele,
        annee_debut: ys.length ? Math.min(...ys) : null,
        annee_fin: ys.length ? Math.max(...ys) : null,
      });
    }
  }
  return couvertureValide(out);
}
