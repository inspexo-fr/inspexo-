// GÉNÉRÉ par scripts/generer-miroir-revendeur.mjs — NE PAS ÉDITER À LA MAIN.
//
// Traduction du module serveur supabase/functions/_shared/revendeur.ts par le
// compilateur TypeScript. Toute correction se fait DANS CE MODULE SERVEUR,
// puis on relance le script (il tourne de lui-même au `prebuild`).
//
// `tests/revendeur.test.mjs` rejoue des centaines de cas tirés au hasard dans
// les deux fichiers et exige des résultats identiques : si cette copie est
// périmée, l'éval échoue.

// SPRINT 19 — Mode revendeur : trois chiffres, et seulement trois.
//
// Module PUR, testé hors ligne, miroir côté client GÉNÉRÉ (`src/data/revendeur.gen.js`)
// pour que l'utilisateur puisse corriger un coût et tout voir se recalculer
// sans aller-retour serveur.
//
// ⚠️ CE QUE CE MODULE N'EST PAS. Il ne détermine aucune VALEUR de véhicule —
// réservé aux experts en automobile inscrits (art. L326-4 I-2° du code de la
// route). Il relève des PRIX OBSERVÉS sur des annonces comparables et les
// combine aux PARAMÈTRES DE L'UTILISATEUR. Changez les paramètres, les trois
// chiffres changent : c'est un calcul, pas une estimation.
//
// Vocabulaire proscrit dans tout ce qui sort d'ici : « valeur », « cote »,
// « estimation », « expertise ». Un test l'impose.
export const MENTION_REVENDEUR = "Calcul à partir de prix observés et de tes paramètres. Ce n'est ni une " +
    "valeur du véhicule ni une garantie de revente.";
/** Au-dessous de ce nombre de comparables retenus : aucun chiffre.
 *  ⚠️ Pas de demi-mesure, pas de fourchette élargie « faute de mieux ». Cinq
 *  annonces ne font pas un marché, et un chiffre calculé sur cinq annonces
 *  est plus dangereux que pas de chiffre du tout : il a l'air sérieux. */
export const SEUIL_COMPARABLES = 6;
export const ECART_ANNEES = 2;
export const ECART_KM = 40000;
export const PARAMETRES_DEFAUT = {
    marge_negociation_pct: 8,
    marge_voulue_eur: 500,
    imprevus_pct_travaux: 15,
    imprevus_vehicule_ancien_eur: 150,
    decote_zfe_pct: 10,
    offre_retrait_pct: 15,
};
const nombre = (x) => {
    const n = typeof x === "number" ? x : Number(String(x ?? "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
};
const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
/** Deux énergies sont-elles la même ? Diesel et essence ne se mélangent
 *  jamais : un diesel et une essence du même modèle ne se revendent pas au
 *  même prix, et c'est précisément ce qu'on mesure. */
export function memeEnergie(a, b) {
    const f = (e) => {
        const s = norm(e);
        if (/electri|hydrog/.test(s))
            return "elec";
        if (/diesel|gazole|hdi|dci|tdi|cdi|crdi|bluehdi/.test(s))
            return "diesel";
        if (/hybride/.test(s))
            return "hybride";
        if (/essence|gpl|e85|ethanol/.test(s))
            return "essence";
        return "";
    };
    const x = f(a), y = f(b);
    return x !== "" && x === y;
}
/** Les comparables de SON dossier, filtrés. Aucun agrégat, aucun seuil de 15 :
 *  ce sont les annonces que l'utilisateur a lui-même sous les yeux. */
export function filtrerComparables(liste, v) {
    const retenus = [];
    const ecartes = [];
    const modeleCible = norm(v.modele);
    for (const c of liste ?? []) {
        const titre = String(c?.titre ?? c?.modele ?? "").slice(0, 80);
        const prix = nombre(c?.prix);
        if (prix == null || prix < 200 || prix > 1000000) {
            ecartes.push({ titre, raison: "prix" });
            continue;
        }
        if (!modeleCible || norm(c?.modele) !== modeleCible) {
            ecartes.push({ titre, raison: "modele" });
            continue;
        }
        if (!memeEnergie(c?.energie, v.energie)) {
            ecartes.push({ titre, raison: "energie" });
            continue;
        }
        const an = nombre(c?.annee);
        if (v.annee != null && (an == null || Math.abs(an - v.annee) > ECART_ANNEES)) {
            ecartes.push({ titre, raison: "annee" });
            continue;
        }
        const km = nombre(c?.km);
        if (v.km != null && (km == null || Math.abs(km - v.km) > ECART_KM)) {
            ecartes.push({ titre, raison: "km" });
            continue;
        }
        retenus.push({ ...c, prix, annee: an, km });
    }
    return { retenus, ecartes };
}
export const mediane = (xs) => {
    const v = [...xs].filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    if (v.length === 0)
        return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
};
/** Pente prix/km MESURÉE sur les comparables, par moindres carrés.
 *
 *  ⚠️ Rendue seulement si elle est mesurable ET plausible : au moins 6 points,
 *  au moins 3 kilométrages distincts, pente négative, et au plus 0,20 €/km.
 *  Sinon `null` — et aucun ajustement n'est appliqué. On ne décote jamais
 *  « au barème » : une pente inventée déplacerait le prix sans que rien ne
 *  l'appuie. Même règle qu'au sprint 9 pour le relevé agrégé. */
export function penteKm(c) {
    const pts = c.filter((x) => x.km != null && Number.isFinite(x.prix));
    if (pts.length < SEUIL_COMPARABLES)
        return null;
    if (new Set(pts.map((p) => Math.round(p.km / 10000))).size < 3)
        return null;
    const n = pts.length;
    const mx = pts.reduce((s, p) => s + p.km, 0) / n;
    const my = pts.reduce((s, p) => s + p.prix, 0) / n;
    let num = 0, den = 0;
    for (const p of pts) {
        num += (p.km - mx) * (p.prix - my);
        den += (p.km - mx) ** 2;
    }
    if (den === 0)
        return null;
    const pente = num / den; // € par km, négatif attendu
    if (!(pente < 0) || pente < -0.2)
        return null;
    return pente;
}
/** PRIX DE REVENTE RÉALISTE.
 *  Médiane observée, ajustée du kilométrage quand la pente est mesurable,
 *  moins la marge que l'acheteur final négociera, moins la décote ZFE le cas
 *  échéant. Rend `null` sous le seuil de comparables. */
export function prixRevente(comparables, v, p, interditZfe = false) {
    if (comparables.length < SEUIL_COMPARABLES)
        return null;
    const med = mediane(comparables.map((c) => c.prix));
    if (med == null)
        return null;
    const pente = penteKm(comparables);
    let ajustement = 0;
    if (pente != null && v.km != null) {
        const kmMedian = mediane(comparables.map((c) => c.km).filter((k) => k != null));
        if (kmMedian != null)
            ajustement = Math.round(pente * (v.km - kmMedian));
    }
    const base = med + ajustement;
    const retrait = Math.round(base * (p.marge_negociation_pct / 100));
    const apresNego = base - retrait;
    const decote = interditZfe ? Math.round(apresNego * (p.decote_zfe_pct / 100)) : 0;
    return {
        valeur: Math.max(0, apresNego - decote),
        mediane_observee: med,
        nb_comparables: comparables.length,
        ajustement_km_eur: ajustement,
        retrait_negociation_eur: retrait,
        decote_zfe_eur: decote,
        pente_eur_par_km: pente,
    };
}
/** PRIX D'ACHAT MAXIMUM POUR LA MARGE VISÉE.
 *
 *  ⚠️ Ce n'est pas un conseil d'achat : c'est le résultat d'une soustraction
 *  dont chaque terme est affiché et modifiable. Si l'utilisateur change sa
 *  marge visée, le chiffre change — c'est tout ce qu'il signifie.
 *
 *  ⚠️ ET QUAND LES COÛTS DÉPASSENT LE PRIX DE REVENTE, ON NE REND PAS 0 €.
 *  Premier jet : `Math.max(0, …)`, et la Clio II du jeu d'essai sortait
 *  « prix d'achat maximum : 0 € », avec un message vendeur proposant « 0 € ».
 *  Un zéro a l'air d'un chiffre ; ce cas n'en a pas. La bonne réponse est
 *  « cette voiture ne laisse pas de marge à ces conditions » — et c'est une
 *  réponse UTILE : savoir en deux minutes qu'une affaire ne passe pas, c'est
 *  exactement ce qu'on demande à cet écran. */
export function prixAchatMax(revente, travaux, p, opts = {}) {
    const lignes = [...travaux];
    const manquants = [];
    const totalTravaux = travaux.reduce((s, l) => s + (Number(l.montant_eur) || 0), 0);
    // Contrôle technique : le VENDEUR doit en fournir un de moins de six mois
    // (art. R323-22 du code de la route). Un contrôle encore valide mais plus
    // ancien que six mois est donc bien un coût à prévoir pour revendre.
    if (opts.ct_a_refaire_eur != null && opts.ct_a_refaire_eur > 0) {
        lignes.push({ cle: "controle_technique", libelle: "Contrôle technique à refaire", montant_eur: opts.ct_a_refaire_eur, modifiable: true });
    }
    // ⚠️ Pas de moyenne nationale silencieuse : sans région, pas de chiffre.
    // Une carte grise va de la gratuité à plus de 1 000 € selon la région,
    // les chevaux fiscaux et l'énergie. Inventer une moyenne fausserait le
    // prix d'achat maximum sans que l'utilisateur sache d'où vient l'erreur.
    if (opts.carte_grise_eur != null && opts.carte_grise_eur >= 0) {
        lignes.push({ cle: "carte_grise", libelle: "Carte grise", montant_eur: opts.carte_grise_eur, modifiable: true });
    }
    else if (opts.region_connue === false) {
        manquants.push("carte_grise");
    }
    const imprevusTravaux = Math.round(totalTravaux * (p.imprevus_pct_travaux / 100));
    const imprevusAge = (opts.age_vehicule_ans ?? 0) > 10 ? p.imprevus_vehicule_ancien_eur : 0;
    if (imprevusTravaux + imprevusAge > 0) {
        lignes.push({
            cle: "imprevus",
            libelle: `Imprévus (${p.imprevus_pct_travaux} % des travaux${imprevusAge ? ` + ${imprevusAge} € véhicule de plus de 10 ans` : ""})`,
            montant_eur: imprevusTravaux + imprevusAge,
            modifiable: true,
        });
    }
    lignes.push({ cle: "marge_voulue", libelle: "Marge visée", montant_eur: p.marge_voulue_eur, modifiable: true });
    const total = lignes.reduce((s, l) => s + (Number(l.montant_eur) || 0), 0);
    const brut = Math.round(revente - total);
    return {
        valeur: Math.max(0, brut),
        brut,
        possible: brut > 0,
        manque_eur: brut < 0 ? -brut : 0,
        revente_eur: revente,
        lignes,
        incomplet: manquants.length > 0,
        manquants,
    };
}
/** OFFRE D'OUVERTURE : prix d'achat maximum moins le retrait, arrondie à la
 *  cinquantaine INFÉRIEURE. Arrondir vers le haut ferait proposer plus que le
 *  calcul ne permet.
 *
 *  ⚠️ `null` quand il n'y a pas de prix d'achat maximum positif : sans cela le
 *  message vendeur proposait « 0 € » au vendeur, ce qui n'est pas une offre
 *  basse mais une absurdité. */
export function offreOuverture(prixMax, p) {
    if (!(prixMax > 0))
        return null;
    const brut = prixMax * (1 - p.offre_retrait_pct / 100);
    const arrondie = Math.floor(brut / 50) * 50;
    return arrondie > 0 ? arrondie : null;
}
/** Coût de la carte grise : CV × tarif régional + frais fixes.
 *
 *  ⚠️ CE QUE CE CALCUL NE FAIT PAS : appliquer une exonération « véhicule
 *  propre ». Elle vaut 0 %, 50 % ou 100 % selon la région, et plusieurs l'ont
 *  supprimée depuis 2025. L'appliquer d'office donnerait un coût faux dans un
 *  sens, l'ignorer dans l'autre. La ligne reste MODIFIABLE à l'écran et
 *  renvoie au simulateur officiel : mieux vaut un chiffre que l'utilisateur
 *  corrige qu'un chiffre qu'il croit exact.
 *
 *  Et surtout : sans région ou sans puissance fiscale, AUCUN chiffre. */
export function coutCarteGrise(cv, region, bareme) {
    if (!bareme || !bareme.regions)
        return { connu: false, motif: "bareme_absent" };
    if (!region || !String(region).trim())
        return { connu: false, motif: "region_inconnue" };
    const n = typeof cv === "number" ? cv : Number(cv);
    if (!Number.isFinite(n) || n <= 0 || n > 99)
        return { connu: false, motif: "cv_inconnus" };
    const cible = norm(region);
    const entree = Object.entries(bareme.regions).find(([r]) => norm(r) === cible);
    if (!entree)
        return { connu: false, motif: "region_absente_du_bareme" };
    const [nomRegion, tarif] = entree;
    const montant = Math.round((n * Number(tarif) + Number(bareme.frais_fixes_eur || 0)) * 100) / 100;
    return { connu: true, montant_eur: montant, cv: n, tarif_cv: Number(tarif), region: nomRegion, maj: bareme.maj };
}
/** L'énergie d'un comparable : le champ s'il est là, sinon les marqueurs du
 *  titre (« 1.5 dCi », « TDI », « HDi »…). Rien d'inventé : un titre muet
 *  rend "" et le comparable sera écarté pour énergie. */
export function energieDeStructure(s) {
    const champ = String(s?.carburant ?? "").trim();
    if (champ)
        return champ;
    const t = norm(s?.titre);
    if (/\b(dci|hdi|tdi|cdi|crdi|bluehdi|jtd|d4d|cdti|tdci|hdi)\b/.test(t))
        return "diesel";
    if (/\belectrique\b|\bev\b/.test(t))
        return "electrique";
    if (/\bhybride\b|\bhev\b|\bphev\b/.test(t))
        return "hybride";
    if (/\b(tsi|tfsi|vti|thp|puretech|ecoboost|mpi|gti|vvt|tce)\b/.test(t))
        return "essence";
    return "";
}
/** Normalise les structures reçues en comparables comparables, puis filtre.
 *  Rend aussi le décompte des écartés par raison : l'écran doit pouvoir dire
 *  POURQUOI il n'a pas assez de comparables, et pas seulement qu'il n'en a
 *  pas assez. */
export function comparablesDepuisStructures(structures, v, opts) {
    const liste = (structures ?? []).map((s) => ({
        prix: nombre(s?.prix) ?? 0,
        annee: nombre(s?.annee),
        km: nombre(s?.km),
        modele: opts.modele_de(String(s?.titre ?? "")),
        energie: energieDeStructure(s),
        boite: s?.boite ?? null,
        titre: String(s?.titre ?? "").slice(0, 160),
    }));
    const r = filtrerComparables(liste, { ...v, modele: opts.modele_cible });
    return { ...r, recus: liste.length };
}
// ── Message au vendeur ─────────────────────────────────────────────────────
/** Message court, prêt à copier : trois ou quatre arguments CHIFFRÉS et
 *  l'offre d'ouverture.
 *
 *  ⚠️ Un argument sans montant n'entre PAS dans le message. Dire « la
 *  distribution est à prévoir » sans savoir ce qu'elle coûte, c'est annoncer
 *  qu'on négocie sans savoir sur quoi — et le vendeur le voit. */
export function messageVendeurRevendeur(arguments_, offre, prixDemande) {
    const chiffres = (arguments_ ?? [])
        .filter((a) => Number.isFinite(Number(a?.montant_eur)) && Number(a.montant_eur) > 0)
        .sort((a, b) => Number(b.montant_eur) - Number(a.montant_eur))
        .slice(0, 4);
    if (chiffres.length === 0 || offre == null)
        return "";
    // ⚠️ PAS de toLocaleString : son résultat dépend de la version d'ICU du
    // moteur. Deno et le navigateur n'ont aucune raison de porter la même, et ce
    // module est justement dupliqué entre les deux — le test de parité serait
    // alors vrai ou faux selon la machine. On groupe les milliers nous-mêmes,
    // avec une espace insécable, ce qui est aussi ce qu'attend un message collé
    // dans une messagerie.
    const euros = (n) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} €`;
    const lignes = chiffres.map((a) => `- ${a.poste} : environ ${euros(Number(a.montant_eur))}`);
    const entete = prixDemande != null && prixDemande > 0
        ? `Bonjour, votre annonce m'intéresse. À ${euros(prixDemande)}, voici ce que j'ai relevé :`
        : `Bonjour, votre annonce m'intéresse. Voici ce que j'ai relevé :`;
    return [
        entete,
        ...lignes,
        "",
        `Compte tenu de ces postes, je vous propose ${euros(offre)}.`,
        "Je peux me déplacer rapidement et payer sans condition de financement.",
    ].join("\n");
}
/** Ce qu'un visiteur SANS Pass reçoit : le prix de revente réaliste, et rien
 *  de plus.
 *
 *  ⚠️ MASQUAGE SERVEUR, pas un flou CSS. La correction du sprint 7 l'avait
 *  déjà appris pour la négociation : floutée côté client, la donnée partait
 *  quand même au navigateur. Ici le prix d'achat maximum, les lignes de coût,
 *  les arguments et le message vendeur ne QUITTENT PAS le serveur. */
export function revendeurPublique(b) {
    if (!b)
        return null;
    return {
        comparables: b.comparables,
        revente: b.revente,
        achat_max: null,
        offre: null,
        parametres: b.parametres,
        carte_grise: null,
        critair: b.critair,
        zfe: b.zfe,
        arguments: [],
        message_vendeur: "",
        mention: b.mention,
        masque: true,
        nb_lignes_masquees: b.achat_max?.lignes.length ?? 0,
        nb_arguments_masques: (b.arguments ?? []).length,
    };
}
