// GÉNÉRÉ par scripts/generer-miroir-revendeur.mjs — NE PAS ÉDITER À LA MAIN.
//
// Traduction du module serveur supabase/functions/_shared/cibles.ts par le
// compilateur TypeScript. Toute correction se fait DANS CE MODULE SERVEUR,
// puis on relance le script (il tourne de lui-même au `prebuild`).
//
// `tests/revendeur.test.mjs` rejoue des centaines de cas tirés au hasard dans
// les deux fichiers et exige des résultats identiques : si cette copie est
// périmée, l'éval échoue.

// SPRINT 19.1 — Alertes rentables : recherche à sauvegarder, et « Mes cibles ».
//
// Module PUR (aucun import, aucun réseau), miroir client GÉNÉRÉ
// (`src/data/cibles.gen.js`) par scripts/generer-miroir-revendeur.mjs.
//
// ⚠️ CE QUE CE MODULE NE FAIT PAS : interroger Leboncoin. Il COMPOSE une
// recherche — des filtres à régler, et au plus un lien de recherche libre.
// Aucune requête ne part de nos serveurs vers un site d'annonces ; c'est une
// promesse publique, vérifiée par tests/pas-de-scraping.test.mjs.
//
// ⚠️ VOCABULAIRE : « prix observés », « marge estimée ». Jamais « valeur »,
// « cote », « estimation de valeur » ni « expertise » — déterminer la valeur
// d'un véhicule est réservé aux experts en automobile inscrits
// (art. L326-4 I-2° du code de la route).
export const MENTION_CIBLES = "Marges estimées à partir des prix observés sur vos propres relevés et de " +
    "vos paramètres. Ce ne sont ni des valeurs de véhicule ni des promesses de " +
    "revente.";
/** Au-dessous de ce nombre de relevés dans un segment, aucune cible.
 *  Même seuil que le mode revendeur : ce sont les mêmes annonces. */
export const SEUIL_CIBLE = 6;
// ── Histogramme de prix (mêmes tranches que le relevé agrégé) ──────────────
//
// On stocke un histogramme plutôt que les prix bruts : il se fusionne par
// simple somme d'une session à l'autre, et il ne conserve aucune annonce.
export const TRANCHE_PRIX_CIBLE = 250;
export function histogrammeDePrix(prix) {
    const h = {};
    for (const p of prix ?? []) {
        const n = Number(p);
        if (!Number.isFinite(n) || n < 200 || n > 1000000)
            continue;
        const t = String(Math.floor(n / TRANCHE_PRIX_CIBLE) * TRANCHE_PRIX_CIBLE);
        h[t] = (h[t] ?? 0) + 1;
    }
    return h;
}
/** Fusion par somme. Découper les relevés en plusieurs sessions ne doit rien
 *  changer au résultat — c'est toute la raison d'être d'un histogramme. */
export function fusionnerHistogrammes(a, b) {
    const out = { ...(a ?? {}) };
    for (const [t, n] of Object.entries(b ?? {})) {
        const v = Number(n);
        if (!Number.isFinite(v) || v <= 0)
            continue;
        out[t] = (out[t] ?? 0) + v;
    }
    return out;
}
export const effectifHistogramme = (h) => Object.values(h ?? {}).reduce((s, n) => s + (Number.isFinite(Number(n)) ? Number(n) : 0), 0);
/** Une cible à partir des quantiles d'un segment.
 *
 *  ⚠️ Les quantiles sont CALCULÉS AILLEURS, par l'unique implémentation du
 *  projet (`quantileHisto` dans _shared/marche.ts). Ce module les reçoit : en
 *  écrire une seconde ferait diverger deux chiffres qui doivent être le même.
 *
 *  ⚠️ Aucun coût de réparation n'entre ici, et c'est le point : une cible
 *  décrit un véhicule qu'on n'a pas encore vu. Les travaux se découvrent sur
 *  l'annonce, et c'est le mode revendeur qui les retranche. */
export function cibleDepuisQuantiles(seg, p, opts = {}) {
    if (!seg || seg.n < SEUIL_CIBLE)
        return null;
    const p25 = Math.round(seg.p25);
    const p50 = Math.round(seg.p50);
    if (!(p50 > 0) || !(p25 > 0))
        return null;
    const revente = Math.round(p50 * (1 - p.marge_negociation_pct / 100));
    const anneeCourante = opts.annee_courante ?? new Date().getUTCFullYear();
    const age = seg.annee_moyenne ? anneeCourante - seg.annee_moyenne : 0;
    const forfaitAge = age > 10 ? p.imprevus_vehicule_ancien_eur : 0;
    const carteGrise = opts.carte_grise_eur != null && opts.carte_grise_eur >= 0
        ? Math.round(opts.carte_grise_eur)
        : 0;
    const coutsFixes = forfaitAge + carteGrise;
    const achatMax = Math.round(revente - coutsFixes - p.marge_voulue_eur);
    // Acheter au quart le moins cher des prix observés : ce qui reste avant la
    // marge visée. C'est la question du revendeur, et c'est le critère de tri.
    const margeEstimee = Math.round(revente - coutsFixes - p25);
    return {
        marque: seg.marque,
        modele: seg.modele,
        energie: seg.energie,
        n: seg.n,
        p25,
        p50,
        annee_moyenne: seg.annee_moyenne ?? null,
        km_moyen: seg.km_moyen ?? null,
        revente,
        achat_max: achatMax,
        marge_estimee: margeEstimee,
        atteignable: achatMax >= p25,
        maj: seg.maj ?? null,
    };
}
/** Tri par marge estimée décroissante. Les inatteignables restent affichées,
 *  en bas : savoir qu'un modèle ne paie pas est une information. */
export function trierCibles(cibles) {
    return [...(cibles ?? [])].sort((a, b) => {
        if (a.atteignable !== b.atteignable)
            return a.atteignable ? -1 : 1;
        return b.marge_estimee - a.marge_estimee;
    });
}
// ── La recherche à sauvegarder ─────────────────────────────────────────────
export const ECART_ANNEES_CIBLE = 2;
export const ECART_KM_CIBLE = 40000;
const ENERGIES_LBC = {
    diesel: "Diesel",
    essence: "Essence",
    hybride: "Hybride",
    electrique: "Électrique",
};
const normEnergie = (e) => {
    const s = String(e ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (/electri|hydrog/.test(s))
        return "electrique";
    if (/diesel|gazole|hdi|dci|tdi|cdi|crdi|bluehdi/.test(s))
        return "diesel";
    if (/hybride/.test(s))
        return "hybride";
    if (/essence|gpl|e85|ethanol/.test(s))
        return "essence";
    return "";
};
/** Arrondi du plafond de prix pour une RECHERCHE.
 *
 *  ⚠️ Arrondi à la centaine SUPÉRIEURE, à l'inverse de l'offre d'ouverture
 *  (arrondie vers le bas). Ce n'est pas une incohérence : une offre arrondie
 *  vers le haut proposerait plus que le calcul ne permet, tandis qu'un
 *  plafond de recherche arrondi vers le bas CACHERAIT des annonces qui se
 *  négocient de cinquante euros. Les deux arrondis vont dans le sens de
 *  l'utilisateur. */
export const plafondRecherche = (achatMax) => Math.max(0, Math.ceil(achatMax / 100) * 100);
/** Compose la recherche à sauvegarder chez Leboncoin.
 *
 *  ⚠️ LE LIEN NE PORTE QUE LA RECHERCHE TEXTE, VOLONTAIREMENT. Nous ne
 *  pouvons pas vérifier le nom des paramètres d'URL de Leboncoin sans
 *  l'interroger — ce que nous ne faisons jamais. Un lien qui appliquerait un
 *  mauvais filtre de prix ou d'année est PIRE que pas de lien : il écarterait
 *  en silence les annonces qui comptent, et l'utilisateur nous croirait.
 *  Les filtres sont donc donnés en clair, à régler sur place. */
export function rechercheSauvegardee(seg, achatMax) {
    const prixMax = plafondRecherche(achatMax);
    const filtres = [];
    // Les clés de segment sont normalisées en minuscules (« renault clio ») :
    // à l écran, on remet une majuscule par mot. C est un libellé, pas une clé.
    const capit = (t) => t.replace(/(^|[\s-])([a-zà-ÿ])/g, (_, a, b) => a + b.toUpperCase());
    const nombre = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
    const titre = capit([seg.marque, seg.modele].filter(Boolean).join(" ").trim());
    if (titre)
        filtres.push({ champ: "Modèle", valeur: titre });
    const e = normEnergie(seg.energie);
    if (e)
        filtres.push({ champ: "Carburant", valeur: ENERGIES_LBC[e] });
    if (seg.annee_moyenne) {
        filtres.push({
            champ: "Année",
            valeur: `de ${seg.annee_moyenne - ECART_ANNEES_CIBLE} à ${seg.annee_moyenne + ECART_ANNEES_CIBLE}`,
        });
    }
    if (seg.km_moyen != null) {
        filtres.push({
            champ: "Kilométrage",
            valeur: `jusqu'à ${nombre(seg.km_moyen + ECART_KM_CIBLE)} km`,
        });
    }
    filtres.push({ champ: "Prix maximum", valeur: `${nombre(prixMax)} €` });
    const url = titre
        ? `https://www.leboncoin.fr/recherche?text=${encodeURIComponent([titre, ENERGIES_LBC[e] ?? ""].filter(Boolean).join(" "))}`
        : null;
    return {
        filtres,
        url,
        note: "Le lien ouvre la recherche par texte. Les filtres ci-dessus se règlent " +
            "sur la page : nous ne devinons pas les paramètres d'URL de Leboncoin, " +
            "et nous ne l'interrogeons jamais depuis nos serveurs.",
        prix_max: prixMax,
    };
}
export const PROFIL_VIDE = {
    region: "",
    ville_revente: "",
    cv: null,
    marge_voulue_eur: null,
    imprevus_pct_travaux: null,
    marge_negociation_pct: null,
};
const borne = (v, min, max) => {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n))
        return null;
    return n < min ? min : n > max ? max : Math.round(n);
};
/** Nettoie un profil reçu (navigateur ou base). Tout champ hors bornes est
 *  ramené à null plutôt qu'au défaut : un profil à moitié lu ne doit pas se
 *  faire passer pour un profil renseigné. */
export function profilValide(brut) {
    const o = (brut ?? {});
    return {
        region: String(o.region ?? "").slice(0, 60),
        ville_revente: String(o.ville_revente ?? "").slice(0, 60),
        cv: borne(o.cv, 1, 99),
        marge_voulue_eur: borne(o.marge_voulue_eur, 0, 50000),
        imprevus_pct_travaux: borne(o.imprevus_pct_travaux, 0, 100),
        marge_negociation_pct: borne(o.marge_negociation_pct, 0, 50),
    };
}
/** Le profil est-il assez renseigné pour afficher les trois chiffres SANS
 *  poser de question ? La région et la puissance fiscale sont les seules
 *  informations que le calcul ne peut pas deviner. */
export function profilComplet(p) {
    return !!p.region && p.cv != null;
}
/** Applique le profil aux paramètres par défaut. Un champ non renseigné garde
 *  la valeur par défaut — on ne remplace jamais un défaut par un null. */
export function parametresDepuisProfil(defauts, profil) {
    const out = { ...defauts };
    for (const cle of ["marge_voulue_eur", "imprevus_pct_travaux", "marge_negociation_pct"]) {
        const v = profil[cle];
        if (v != null)
            out[cle] = v;
    }
    return out;
}
