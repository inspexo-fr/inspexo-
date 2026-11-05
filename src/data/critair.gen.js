// GÉNÉRÉ par scripts/generer-miroir-revendeur.mjs — NE PAS ÉDITER À LA MAIN.
//
// Traduction du module serveur supabase/functions/_shared/critair.ts par le
// compilateur TypeScript. Toute correction se fait DANS CE MODULE SERVEUR,
// puis on relance le script (il tourne de lui-même au `prebuild`).
//
// `tests/revendeur.test.mjs` rejoue des centaines de cas tirés au hasard dans
// les deux fichiers et exige des résultats identiques : si cette copie est
// périmée, l'éval échoue.

// SPRINT 19 — Crit'Air et zones à faibles émissions.
//
// Module PUR. Le classement Crit'Air se déduit de l'énergie et de la date de
// première immatriculation : c'est une table réglementaire, pas une
// estimation. La liste des ZFE, en revanche, bouge par arrêté — elle est donc
// DATÉE, et sa date s'affiche à l'écran.
//
// ⚠️ POURQUOI LA DATE EST AFFICHÉE ET NON CACHÉE. Une ZFE se crée, s'élargit
// ou se suspend par décision locale, et le cadre national a lui-même été
// remis en cause deux fois en 2026 — abrogation votée le 15 avril puis
// CENSURÉE par le Conseil constitutionnel le 21 mai (cavalier législatif),
// puis nouvelle proposition examinée le 8 octobre sans aller au vote. Les ZFE
// sont donc toujours en vigueur, mais un seuil périmé ferait baisser un prix
// de revente sans que personne ne s'en aperçoive. On publie la date du
// relevé, et on invite à vérifier auprès de la métropole.
/** Date du relevé des ZFE ci-dessous. À remonter à chaque mise à jour. */
export const ZFE_RELEVE_LE = "2026-11-05";
/** Énergies telles que l'identification les écrit. */
function familleEnergie(energie) {
    const e = String(energie ?? "").toLowerCase();
    if (/électri|electri|hydrog/.test(e))
        return "elec";
    // ⚠️ Un hybride RECHARGEABLE est Crit'Air 1 comme une essence récente ; un
    // hybride non rechargeable suit son carburant. Les deux s'écrivent
    // « hybride » dans les annonces : on retombe donc sur le carburant quand il
    // est précisé, et sur « essence » sinon — jamais sur un classement plus
    // favorable que ce que la donnée permet d'affirmer.
    if (/diesel|gazole|hdi|dci|tdi|cdi|bluehdi|crdi/.test(e))
        return "diesel";
    if (/essence|hybride|gpl|e85|éthanol|ethanol|gaz/.test(e))
        return "essence";
    return "inconnu";
}
/** Le classement Crit'Air, d'après l'arrêté du 21 juin 2016.
 *
 *  `premiereImmat` : date ISO (AAAA-MM-JJ) ou année seule (AAAA). Une année
 *  seule est traitée comme le 1er juillet : au milieu de l'année, donc sans
 *  favoriser ni pénaliser systématiquement. Les bornes réglementaires tombant
 *  au 1er janvier, cela ne change le résultat pour aucune année pleine. */
export function critair(energie, premiereImmat) {
    const f = familleEnergie(energie);
    if (f === "elec")
        return "0";
    const brut = String(premiereImmat ?? "").trim();
    let d = null;
    if (/^\d{4}$/.test(brut))
        d = new Date(`${brut}-07-01T00:00:00Z`);
    else if (/^\d{4}-\d{2}(-\d{2})?$/.test(brut))
        d = new Date(`${brut.length === 7 ? `${brut}-01` : brut}T00:00:00Z`);
    if (!d || Number.isNaN(d.getTime()) || f === "inconnu")
        return "inconnu";
    const apres = (iso) => d.getTime() >= new Date(`${iso}T00:00:00Z`).getTime();
    if (f === "essence") {
        if (apres("2011-01-01"))
            return "1";
        if (apres("2006-01-01"))
            return "2";
        if (apres("1997-01-01"))
            return "3";
        return "non_classe";
    }
    // diesel
    if (apres("2011-01-01"))
        return "2";
    if (apres("2006-01-01"))
        return "3";
    if (apres("2001-01-01"))
        return "4";
    if (apres("1997-01-01"))
        return "5";
    return "non_classe";
}
/** ZFE relevées au ZFE_RELEVE_LE.
 *
 * ⚠️ Liste VOLONTAIREMENT COURTE et conservatrice : seules les zones dont le
 * seuil est stable et documenté y figurent. Une ZFE omise ne fait rien de
 * faux (aucun avertissement, aucune décote) ; une ZFE inventée ou au mauvais
 * seuil ferait baisser un prix à tort. Dans le doute, on n'inscrit pas.
 *
 * Les agglomérations dont la restriction ne vise que les « non classés »
 * figurent avec ce seul niveau. */
export const ZFE = [
    { ville: "Paris", interdits: ["non_classe", "5", "4", "3"], source: "https://www.paris.fr/pages/la-zone-a-faibles-emissions-zfe-16799" },
    { ville: "Lyon", interdits: ["non_classe", "5", "4", "3"], source: "https://www.grandlyon.com/services/la-zone-a-faibles-emissions" },
    { ville: "Grenoble", interdits: ["non_classe", "5", "4", "3"], source: "https://www.grenoblealpesmetropole.fr/878-zone-a-faibles-emissions.htm" },
    { ville: "Montpellier", interdits: ["non_classe", "5", "4"], source: "https://www.montpellier3m.fr/zfe" },
    { ville: "Strasbourg", interdits: ["non_classe", "5", "4"], source: "https://www.strasbourg.eu/zfe" },
    { ville: "Marseille", interdits: ["non_classe", "5", "4"], source: "https://www.ampmetropole.fr/zfe" },
    { ville: "Toulouse", interdits: ["non_classe", "5", "4"], source: "https://www.toulouse-metropole.fr/zfe" },
    { ville: "Nice", interdits: ["non_classe", "5"], source: "https://www.nicecotedazur.org/zfe" },
    { ville: "Rouen", interdits: ["non_classe", "5"], source: "https://www.metropole-rouen-normandie.fr/zfe" },
    { ville: "Reims", interdits: ["non_classe", "5"], source: "https://www.grandreims.fr/zfe" },
    { ville: "Saint-Étienne", interdits: ["non_classe", "5"], source: "https://www.saint-etienne-metropole.fr/zfe" },
    { ville: "Rennes", interdits: ["non_classe"], source: "https://metropole.rennes.fr/zfe" },
    { ville: "Nantes", interdits: ["non_classe"], source: "https://metropole.nantes.fr/zfe" },
    { ville: "Lille", interdits: ["non_classe"], source: "https://www.lillemetropole.fr/zfe" },
];
const sansAccent = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
/** Le SOCLE : la liste du code. Elle n'est pas un doublon de la config, c'est
 *  son filet. Si la config est absente, vide ou illisible, c'est elle qui
 *  sert — sans quoi une config muette ferait disparaître TOUS les
 *  avertissements ZFE sans produire la moindre erreur. */
export const ZFE_SOCLE = { zones: ZFE, maj: ZFE_RELEVE_LE };
const CLASSES = ["0", "1", "2", "3", "4", "5", "non_classe"];
/** La liste des ZFE telle que la config la donne, VALIDÉE zone par zone.
 *
 *  ⚠️ Une zone malformée est ÉCARTÉE, pas corrigée, et elle n'emporte pas les
 *  autres : un seuil mal saisi ne doit pas faire dire à un acheteur que sa
 *  future voiture est interdite là où elle ne l'est pas, et il ne doit pas
 *  non plus effacer les treize zones justes. Si plus rien n'est valide, on
 *  retombe sur le socle du code. */
export function sourceZfe(config) {
    // deno-lint-ignore no-explicit-any
    const c = config;
    const brut = Array.isArray(c?.zones) ? c.zones : [];
    const zones = [];
    for (const z of brut) {
        const ville = typeof z?.ville === "string" ? z.ville.trim() : "";
        const source = typeof z?.source === "string" ? z.source.trim() : "";
        const interdits = Array.isArray(z?.interdits)
            ? z.interdits.filter((x) => typeof x === "string" && CLASSES.includes(x))
            : [];
        if (!ville || !/^https?:\/\//i.test(source) || interdits.length === 0)
            continue;
        if (interdits.length !== z.interdits.length)
            continue; // une classe inconnue = saisie douteuse
        zones.push({ ville, interdits, source });
    }
    const maj = typeof c?.maj === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.maj) ? c.maj : "";
    if (zones.length === 0 || !maj)
        return ZFE_SOCLE;
    return { zones, maj };
}
/** Le véhicule est-il interdit dans la ZFE de cette ville ?
 *
 *  Rend `null` si la ville n'a pas de ZFE répertoriée, ou si le classement
 *  est inconnu : on n'avertit JAMAIS sur une supposition. */
export function verdictZfe(ville, classe, source = ZFE_SOCLE) {
    if (classe === "inconnu")
        return null;
    const v = sansAccent(ville);
    if (!v)
        return null;
    const z = source.zones.find((x) => sansAccent(x.ville) === v);
    if (!z)
        return null;
    return {
        ville: z.ville,
        critair: classe,
        interdit: z.interdits.includes(classe),
        source: z.source,
        releve_le: source.maj,
    };
}
/** Libellé affichable d'une vignette. */
export function libelleCritair(c) {
    if (c === "0")
        return "Crit'Air 0 (vert)";
    if (c === "non_classe")
        return "non classé";
    if (c === "inconnu")
        return "classement inconnu";
    return `Crit'Air ${c}`;
}
