// Test hors ligne du sourcing de l'atlas (aucun appel réseau).
// Usage : node tests/atlas-source.test.mjs
import { readFileSync } from 'node:fs'
import {
  affirmationSansCout,
  coutUtilisable,
  marqueursEntree,
  pageParleDeLEntree,
  rangSource,
  sourcesPortentLEntree,
  sourcesPortentLEntreeLues,
} from '../supabase/functions/_shared/atlasSource.ts'

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const eq = (a, b, l) => ok(a === b, `${l}${a === b ? '' : ` (obtenu ${JSON.stringify(a)}, attendu ${JSON.stringify(b)})`}`)

// ── Le prix ne décide pas du sort de l'entrée ───────────────────────────────
//
// ⚠️ DÉFAUT TROUVÉ PAR LA PREMIÈRE CAMPAGNE RÉELLE. Sur BMW, 4 entrées sur 5
// ont été retirées au premier passage — dont la chaîne de distribution N47,
// l'un des défauts les mieux documentés de la marque. Cause : la description
// de l'atlas se termine par « Coût constaté : 2 500 à 4 500€ ». Soumise telle
// quelle, l'affirmation devient un paquet, et une page qui atteste
// parfaitement le défaut sans donner de prix est jugée « non soutenue ».
{
  const d = "Sur les moteurs diesel N47 (2007-2014), la chaîne de distribution placée côté " +
    "boîte de vitesses peut s'étirer et casser. Réparation = dépose moteur. Coût constaté : 2 500 à 4 500€."
  const a = affirmationSansCout('Chaîne de distribution N47 défaillante', d)
  ok(a.includes('N47') && a.includes('chaîne de distribution'), 'le défaut est conservé entier')
  ok(!/€|euro/i.test(a), 'aucun montant ne subsiste dans l’affirmation soumise')
  ok(!/co[ûu]t constat/i.test(a), 'la phrase de coût est retirée, pas seulement le chiffre')
  ok(a.includes('dépose moteur'), 'le remède reste — c’est lui qui fixe la gravité')
}

{
  // Autres formulations de prix rencontrées dans l'atlas.
  for (const [d, quoi] of [
    ['Défaut X. Compter 1 200 € de réparation.', 'compter N €'],
    ['Défaut Y, budget 800 euros environ.', 'budget N euros'],
    ['Défaut Z. Prix : 2 500€.', 'prix : N€'],
    ['Défaut W qui coûte 450 EUR.', 'coûte N EUR'],
  ]) {
    ok(!/\d[\d\s]*\s?(€|eur)/i.test(affirmationSansCout('T', d)), `montant retiré — ${quoi}`)
  }
}

eq(affirmationSansCout('Titre seul', ''), 'Titre seul', 'sans description, le titre suffit')
ok(affirmationSansCout('T', 'x'.repeat(900)).length <= 500, 'l’affirmation est bornée')

// ── Marqueurs : ce qui rend une entrée reconnaissable ───────────────────────
{
  const m = marqueursEntree(
    'Chaîne de distribution N47 défaillante',
    'Moteurs diesel N47 (2007-2014), chaîne côté boîte.',
    'Série 1 (E81/E87), Série 3 (E90/E91)',
  )
  ok(m.includes('n47'), 'le code moteur est un marqueur')
  ok(m.includes('e90') || m.includes('e81'), 'le code de caisse est un marqueur')
  ok(m.includes('distribution'), 'un mot technique long est un marqueur')
  ok(!m.includes('moteur'), '« moteur » est trop banal pour discriminer quoi que ce soit')
  ok(!m.includes('defaut') && !m.includes('panne'), 'les mots du métier ne discriminent rien non plus')
}

{
  const m = marqueursEntree('Courroie de distribution 1.2 PureTech', 'Courroie en bain d’huile.', '208, 2008, 308')
  ok(m.some((x) => x.includes('puretech')), 'une désignation commerciale est un marqueur')
}

// ── La page parle-t-elle de l'entrée ? ──────────────────────────────────────
{
  const marqueurs = marqueursEntree('Chaîne de distribution N47', 'Chaîne côté boîte.', 'Série 3 (E90)')
  ok(pageParleDeLEntree('Le moteur N47 souffre d’une chaîne de distribution fragile sur E90.', marqueurs),
    'une page qui nomme le code ET l’organe passe')
  ok(!pageParleDeLEntree('Comparatif des SUV familiaux de 2024, essais et prix.', marqueurs),
    'une page hors sujet est écartée')
  ok(!pageParleDeLEntree('Le moteur de cette voiture est fiable.', marqueurs),
    'une page qui ne touche qu’un mot banal ne passe pas')
  ok(!pageParleDeLEntree('', marqueurs), 'une page vide ne passe pas')
  // Deux touches minimum : une seule coïncidence ne prouve rien.
  ok(!pageParleDeLEntree('Tout sur la distribution automobile.', marqueurs),
    'un seul marqueur ne suffit pas')
}

{
  // Accents : la page peut écrire « chaine » sans accent circonflexe.
  const m = marqueursEntree('Chaîne de distribution N47', 'étirement de la chaîne', 'E90')
  ok(pageParleDeLEntree('Probleme de chaine de distribution sur le N47 des E90.', m),
    'la comparaison ignore les accents')
}

// ── L'atlas publié et le code concordent ───────────────────────────────────
{
  const js = readFileSync(new URL('../src/data/defectAtlas.js', import.meta.url), 'utf8')
  const json = readFileSync(new URL('../supabase/functions/_shared/defectAtlas.json', import.meta.url), 'utf8')
  const cote = JSON.parse(js.slice(js.indexOf('{')))
  const serveur = JSON.parse(json)
  eq(JSON.stringify(cote), JSON.stringify(serveur),
    'la copie serveur de l’atlas est IDENTIQUE au fichier client')

  const toutes = Object.values(cote).flatMap((b) => b.defects ?? [])
  const sourcees = toutes.filter((d) => Array.isArray(d.url_source) && d.url_source.length > 0)
  eq(sourcees.length, toutes.length,
    'toute entrée encore présente dans l’atlas porte au moins une URL')
  ok(toutes.every((d) => (d.url_source ?? []).every((u) => /^https:\/\//.test(u))),
    'toutes les URL sont en https')
  ok(toutes.every((d) => ['securite', 'casse', 'majeure', 'mineure'].includes(d.gravite)),
    'chaque entrée porte une gravité du BARÈME, pas l’ancienne étiquette à trois niveaux')
  // On ne promeut jamais en « casse » sans coût sourcé.
  ok(toutes.every((d) => d.gravite !== 'casse' || (d.cout_max_eur ?? 0) >= 3000),
    'aucune entrée n’est « casse » sans un coût sourcé qui le justifie')
}

// ── Affichage : les liens d'abord, l'étiquette ensuite ─────────────────────
//
// ⚠️ Décision du 4 novembre 2026 : une entrée d'atlas qui cite des pages
// publiques s'affiche comme une fiche moteur, « Sources : » suivi des liens.
// Le code court-circuitait sur `base_inspexo` AVANT de regarder les URL — la
// courroie de la 308, entrée fusionnée portant l'étiquette du catalogue ET
// quatre pages, n'affichait aucun lien.
{
  const page = readFileSync(new URL('../src/pages/ResultPage.jsx', import.meta.url), 'utf8')
  ok(/if \(!\(p\.urls \|\| \[\]\)\.length && p\.source_statut === 'base_inspexo'\) return numsBaseInspexo\(\)/.test(page),
    'le registre ne retombe sur « base Inspexo » que si l’entrée ne cite AUCUNE page')
  ok(/\(p\.urls \|\| \[\]\)\.length > 0\s*\n?\s*\? 'sources en ligne/.test(page),
    'le libellé affiché suit la présence de sources, pas l’étiquette interne')
  ok(!/x\.source_statut === 'base_inspexo'\)\.length/.test(page),
    'le décompte des pannes suit lui aussi les sources réelles')

  const score = readFileSync(new URL('../supabase/functions/score/index.ts', import.meta.url), 'utf8')
  ok(/source_statut: atlasUrls\.length > 0 \? "en_ligne" : "base_inspexo"/.test(score),
    'côté serveur, une entrée d’atlas sourcée n’est plus étiquetée « base Inspexo »')
}

console.log(`\n${ok_} contrôles passés, ${ko} échec(s).`)
if (ko > 0) process.exit(1)
// ---------------------------------------------------------------------------
// ⚠️ LE RANG D'UNE SOURCE VIENT DE SON HÔTE, PAS D'UNE ÉTIQUETTE DU MODÈLE.
//
// Défaut mesuré le 5 novembre 2026 sur la campagne hors moteur. Le garde-fou
// du sprint 16 lisait `r.type !== "forum_marque"` — un champ que le MODÈLE
// remplit. Résultat : `autoliva.com` (réparateur de boîtes) et
// `ecutesting.com` (réparateur de mécatroniques) classés « presse_auto »,
// `caroom.fr` (guide d'achat) classé « constructeur_ou_rappel ». Sept entrées
// sur neuf ne tenaient que sur des pages commerciales — et la même famille de
// sites était citée ailleurs dans la MÊME campagne comme motif de retrait.
// C'est la leçon d'`estAppelApi` : un garde-fou ne peut pas reposer sur une
// valeur que l'appelant choisit.
// ---------------------------------------------------------------------------
console.log('\n▶ Rang déterministe des sources')
eq(rangSource('https://static.nhtsa.gov/odi/tsbs/2016/SB-10092372-5448.pdf'), 'officiel',
  'une note technique NHTSA est officielle')
eq(rangSource('https://rappel.conso.gouv.fr/fiche/1234'), 'officiel', 'RappelConso est officiel')
eq(rangSource('https://www.largus.fr/actualite-automobile/x.html'), 'presse', 'L’Argus est de la presse')
eq(rangSource('https://www.drive.com.au/news/y'), 'presse', 'Drive.com.au est de la presse')
eq(rangSource('https://www.quechoisir.org/actualite-z'), 'presse', 'Que Choisir est de la presse')
// ⚠️ L'ORDRE COMPTE : un sous-domaine de forum sur un titre reconnu reste un
// forum. Sans ce test, `forum-auto.caradisiac.com` passerait pour de la presse.
eq(rangSource('https://forum-auto.caradisiac.com/topic/123'), 'forum',
  'un forum hébergé sous un titre de presse reste un forum')
eq(rangSource('https://www.reddit.com/r/cars/x'), 'forum', 'Reddit est un forum')
eq(rangSource('https://www.planete-citroen.com/forum/x'), 'forum', 'Planète-Citroën est un forum')
// Les hôtes réellement rencontrés dans la campagne, et mal classés par le modèle.
// Les hôtes dont la VENTE est établie (relevée sur leur page le 5 nov. 2026).
for (const h of ['autoliva.com', 'ecutesting.com', 'caroom.fr', 'la-boite-automatique.com',
                 'findservicehistory.com', 'specialiste-bmw.fr', 'oscaro.com']) {
  eq(rangSource(`https://www.${h}/page`), 'vendeur', `${h} est vendeur`)
}
// ⚠️ ET CEUX-LÀ RESTENT « INCONNU », PAS « VENDEUR ». Les nommer vendeurs
// serait AFFIRMER qu'ils vendent quelque chose sans l'avoir vérifié. Même
// conséquence — aucun ne porte une entrée — sans l'allégation.
for (const h of ['automotohebdo.fr', 'kangoo-pro.fr', 'superbaroudeur.com']) {
  eq(rangSource(`https://www.${h}/page`), 'inconnu', `${h} reste inconnu, faute de l’avoir vérifié`)
  ok(!sourcesPortentLEntree([`https://www.${h}/page`]), `et ${h} ne porte rien`)
}
// « inconnu » est le DÉFAUT : il ne porte pas.
eq(rangSource('https://exemple-inconnu-xyz.fr/page'), 'inconnu', 'un hôte non classé est inconnu')
eq(rangSource('pas-une-url'), 'inconnu', 'une URL illisible est inconnue')
eq(rangSource(null), 'inconnu', 'null est inconnu')
ok(!sourcesPortentLEntree(['https://exemple-inconnu-xyz.fr/page', null, 'pas-une-url']),
  'et aucun des trois ne porte quoi que ce soit')

console.log('\n▶ Ce qui PORTE une entrée')
ok(sourcesPortentLEntree(['https://static.nhtsa.gov/a.pdf', 'https://autoliva.com/b']),
  'une source officielle porte l’entrée, même accompagnée de commercial')
ok(sourcesPortentLEntree(['https://www.largus.fr/a']), 'une source de presse porte l’entrée')
ok(!sourcesPortentLEntree(['https://autoliva.com/a', 'https://la-boite-automatique.com/b']),
  '⚠️ deux sources de vendeurs ne portent PAS une entrée')
ok(!sourcesPortentLEntree(['https://forum-auto.caradisiac.com/a', 'https://autoliva.com/b']),
  'un forum et un vendeur ne portent pas une entrée')
ok(!sourcesPortentLEntree([]), 'aucune source ne porte rien')

console.log('\n▶ Un coût de réparateur ne fixe pas la gravité')
ok(!coutUtilisable(['https://la-boite-automatique.com/tarifs']),
  '⚠️ un prix affiché par celui qui vend la réparation est une offre, pas un relevé')
ok(coutUtilisable(['https://www.largus.fr/budget-entretien']),
  'un coût publié par la presse est utilisable')
ok(coutUtilisable(['https://static.nhtsa.gov/a.pdf', 'https://specialiste-bmw.fr/b']),
  'une source officielle suffit à rendre le coût utilisable')

console.log('\n▶ Les garde-fous sont bien CÂBLÉS, pas seulement écrits')
{
  const builder = readFileSync(new URL('../supabase/functions/atlas-builder/index.ts', import.meta.url), 'utf8')
  ok(/sourcesPortentLEntree\(retenues/.test(builder),
    'atlas-builder décide de garder avec le filtre par hôte')
  // ⚠️ Chercher la chaîne ne suffit pas : le commentaire qui EXPLIQUE le
  // défaut la contient. On ne regarde donc que les lignes de CODE.
  {
    const codeSeul = builder.split('\n').filter((l) => !l.trim().startsWith('//'))
    ok(!codeSeul.some((l) => /r\.type !== "forum_marque"/.test(l)),
      '⚠️ le code ne lit PLUS l’étiquette que le modèle s’attribue')
    ok(builder.includes('r.type !== "forum_marque"'),
      'le test mord : la chaîne existe bien, dans le commentaire qui explique le défaut')
  }
  ok(/coutUtilisable\(retenues/.test(builder), 'et il refuse un coût non utilisable')
  const script = readFileSync(new URL('../scripts/etendre-atlas.mjs', import.meta.url), 'utf8')
  ok(/sourcesPortentLEntree\(urls\)/.test(script),
    'la fusion refuse aussi une entrée sans source portante — un relevé déjà payé n’entre pas pour autant')
}

console.log('\n▶ Rang « compilation » et « hors sujet » (arbitrage du 6 nov. 2026)')
eq(rangSource('https://docteurmoteurs.com/x'), 'compilation', 'docteurmoteurs est une compilation')
eq(rangSource('https://mymotorlist.com/x'), 'compilation', 'mymotorlist aussi')
eq(rangSource('https://enginescope.gr/x'), 'compilation', 'enginescope aussi')
eq(rangSource('https://motorreviewer.com/x'), 'compilation', 'motorreviewer, même famille')
// ⚠️ UNE COMPILATION NE PORTE PAS, exactement comme un forum : elle agrège des
// fils de discussion sans rédaction identifiable, elle ne vaut pas mieux que
// ce qu'elle agrège.
ok(!sourcesPortentLEntree(['https://docteurmoteurs.com/x']),
  '⚠️ une compilation seule ne porte PAS une panne')
ok(!sourcesPortentLEntree(['https://docteurmoteurs.com/x', 'https://forum-peugeot.com/y']),
  'compilation + forum ne portent pas davantage')
ok(sourcesPortentLEntree(['https://docteurmoteurs.com/x', 'https://www.largus.fr/y']),
  'mais une presse à côté suffit')
ok(!coutUtilisable(['https://docteurmoteurs.com/tarifs']),
  'et une compilation ne chiffre pas une gravité')

eq(rangSource('https://uvoz.info/x'), 'hors_sujet',
  'uvoz.info est HORS SUJET : un site bosnien sur l’import de véhicules')
ok(!sourcesPortentLEntree(['https://uvoz.info/x']), 'un hôte hors sujet ne porte rien')

console.log('\n▶ Les rangs PORTANTS, arrêtés par Utku')
for (const [u, attendu] of [
  ['https://static.nhtsa.gov/a.pdf', 'officiel'],
  ['https://recalls-rappels.canada.ca/fr/x', 'officiel'],
  ['https://www.ford.com/support/recalls/', 'officiel'],
  ['https://www.dacia.fr/x', 'officiel'],
  ['https://www.largus.fr/actualite/x', 'presse'],
  ['https://www.thedrive.com/news/x', 'presse'],
  ['https://www.bmwblog.com/x', 'presse'],
  ['https://www.larevueautomobile.com/x', 'presse'],
  ['https://www.fiches-auto.fr/articles-auto/x.php', 'editorial'],
  ['https://www.pistonheads.com/news/x', 'editorial'],
  ['https://www.planeterenault.com/essais/x', 'editorial'],
  ['https://drivisual.tv/x', 'editorial'],
]) eq(rangSource(u), attendu, `${u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 42)}`)

console.log('\n▶ ⚠️ Les motifs de vente n’attrapent AUCUN hôte portant')
{
  const portants = [
    'static.nhtsa.gov', 'recalls-rappels.canada.ca', 'ford.com', 'dacia.fr',
    'renault.fr', 'peugeot.fr', 'citroen.fr', 'volkswagen.fr', 'largus.fr',
    'thedrive.com', 'slashgear.com', 'bmwblog.com', 'larevueautomobile.com',
    'quechoisir.org', 'adac.de', 'honestjohn.co.uk', 'carbuzz.com',
    'drive.com.au', 'fiches-auto.fr', 'pistonheads.com', 'planeterenault.com',
    'drivisual.tv',
  ]
  const mauvais = portants.filter((h) => !['officiel', 'presse', 'editorial'].includes(rangSource(`https://${h}/x`)))
  ok(mauvais.length === 0, `les ${portants.length} hôtes portants le restent`, mauvais.join(', '))
  // Et les motifs mordent bien là où ils doivent.
  for (const h of ['garage-pouget.fr', 'aepspieces.com', 'go-parts.com', 'autodoc.co.uk',
                   'rachat-cash-voiture.fr', 'occasion-moteur.com', 'getusedengine.com']) {
    eq(rangSource(`https://${h}/x`), 'vendeur', `${h} est reconnu vendeur par motif`)
  }
}

console.log('\n▶ La génération vérifie le rang AVANT d’accepter une source')
{
  const fiches = readFileSync(new URL('../supabase/functions/_shared/defectSheets.ts', import.meta.url), 'utf8')
  ok(/sourcesPortentLEntree\(urls\)/.test(fiches),
    '⚠️ sheet-builder exige une source indépendante — c’est ce qui manquait quand uvoz.info est passé')
  ok(/rangSource\(u\) === "hors_sujet"/.test(fiches),
    'et il rejette une panne dont toutes les sources sont hors sujet')
  ok(/coutUtilisable\(urls\)/.test(fiches),
    'un prix de vendeur ne chiffre rien dans une fiche')
}

// ⚠️ CE FICHIER N'AVAIT AUCUN CODE DE SORTIE. Il imprimait « Tous les tests
// atlas-source passent » quoi qu'il arrive — et le 6 nov. 2026 il l'a imprimé
// avec TREIZE échecs à l'écran, après le renommage du rang « commercial ».
// Chaîné dans `npm run eval`, il n'a donc jamais pu bloquer un déploiement
// depuis le sprint 16.
//
// Quatrième occurrence de ce motif dans le projet, après les trois
// `process.exit(1)` placés avant les nouveaux blocs de
// tests/inspection.test.mjs. Un test qui ne peut pas échouer n'est pas un test.

// ──────────────────────────────────────────────────────────────────────────
// Les 4 arbitrages d'Utku du 6 nov. 2026
// ──────────────────────────────────────────────────────────────────────────
console.log('\n▶ Arbitrages du 6 nov. 2026')

eq(rangSource('https://www.truedelta.com/car-reliability-by-brand'), 'editorial',
  'truedelta.com : éditorial (enquêtes de propriétaires, fondateur identifié)')
ok(sourcesPortentLEntree(['https://www.truedelta.com/x']),
  'et il porte une entrée — comme tout rang éditorial')

// ⚠️ « Si tu ne peux toujours pas lire la page citée, la panne ne passe pas. »
ok(!sourcesPortentLEntreeLues(['https://www.truedelta.com/x'], []),
  'mais une page éditoriale ILLISIBLE ne porte pas')
ok(sourcesPortentLEntreeLues(['https://www.truedelta.com/x'], ['https://www.truedelta.com/x']),
  'la même page, lue, porte')
ok(!sourcesPortentLEntreeLues(['https://www.largus.fr/a', 'https://forum-auto.caradisiac.com/b'],
  ['https://forum-auto.caradisiac.com/b']),
  'une presse illisible ne se rattrape pas sur un forum lisible')
ok(sourcesPortentLEntreeLues(['https://www.largus.fr/a', 'https://www.truedelta.com/b'],
  ['https://www.largus.fr/a']),
  'il suffit qu’UNE source portante ait été lue')
ok(!sourcesPortentLEntreeLues([], []), 'aucune source : rien ne porte')

// ⚠️ Un tiers qui republie ne vaut pas le bulletin d'origine.
for (const h of ['ford.oemdtc.com', 'oemdtc.com', 'www.oemdtc.com']) {
  eq(rangSource(`https://${h}/tsb-12345`), 'inconnu',
    `${h} : inconnu — un miroir de bulletin n’est pas le bulletin`)
}
eq(rangSource('https://autos.yahoo.com/article-repris'), 'inconnu',
  'autos.yahoo.com : inconnu — on cite l’article d’origine, pas le portail')
ok(!sourcesPortentLEntree(['https://ford.oemdtc.com/x', 'https://autos.yahoo.com/y']),
  'et ni l’un ni l’autre ne porte une panne')

eq(rangSource('https://www.ntn-snr.com/fr/roulement-x'), 'vendeur',
  'ntn-snr.com : vendeur — sa documentation est autoritaire, mais il vend les pièces')
ok(!coutUtilisable(['https://www.ntn-snr.com/fr/piece']),
  'donc son prix ne fixe aucune gravité')

// ⚠️ Le sous-domaine d'un constructeur chez un TIERS ne doit pas devenir
// officiel par ressemblance de nom. Contre-épreuve du vrai domaine.
eq(rangSource('https://www.ford.com/support/recalls/'), 'officiel',
  'contre-épreuve : ford.com, lui, est bien officiel')

// ⚠️ La règle de lisibilité est portée par l'ORDRE des opérations dans
// `atlas-builder` : la page est récupérée AVANT que l'URL ne devienne une
// source. Ce contrôle statique interdit d'inverser les deux.
{
  const b = readFileSync('supabase/functions/atlas-builder/index.ts', 'utf8')
  const iTexte = b.indexOf('const texte = await texteDeLaPage(url)')
  const iIllisible = b.indexOf('motif: "page_illisible"')
  const iRetenue = b.indexOf('retenues.push({')
  ok(iTexte > 0 && iIllisible > iTexte && iRetenue > iIllisible,
    'atlas-builder écarte une page illisible AVANT de l’attacher comme source')
  const d = readFileSync('supabase/functions/_shared/defectSheets.ts', 'utf8')
  ok(/LIMITE ASSUMÉE[\s\S]{0,900}sourcesPortentLEntreeLues/.test(d),
    'et sheet-builder DIT qu’il ne vérifie que le rang, pas la lisibilité')
}

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${ok_}/${ok_ + ko} contrôles passés`)
if (ko > 0) {
  console.error(`${ko} échec(s) dans tests/atlas-source.test.mjs`)
  process.exit(1)
}
console.log('Tous les tests atlas-source passent.')
