// Tests hors ligne : pré-lecture de l'extension, sans IA (sprint 23, lot 3, point 4).
// Usage : node tests/prelecture.test.mjs
import fs from 'node:fs'
let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const lire = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8')
const fn = lire('../supabase/functions/prelecture/index.ts')
ok(!/api\.anthropic\.com|ANTHROPIC_API_KEY/.test(fn), 'aucun appel au modèle')
ok(fn.indexOf('proxySecretMatches(req)') > 0 && fn.indexOf('proxySecretMatches(req)') < fn.indexOf('await req.json('), 'secret de proxy vérifié AVANT la lecture du corps')
const ecritures = fn.match(/\.(insert|update|upsert|delete)\(/g) || []
ok(ecritures.length === 1 && /from\("events"\)\.insert\(\{ name: "prelecture"/.test(fn), 'seule écriture : le compteur anti-abus (rien de l’annonce n’est conservé)')
ok(/segmentDepuisTitreAnnonce\(titre\)/.test(fn) && !/body\?\.marque|body\?\.modele/.test(fn), 'marque et modèle déduits du titre par le serveur, jamais pris du client')
ok(/referencePrix\(/.test(fn) && /SEUIL_FOURCHETTE/.test(fn), 'prix observés : même calcul et même seuil que le score')
const proxy = lire('../api/prelecture.js')
ok(/INTAKE_PROXY_SECRET/.test(proxy) && /x-proxy-client-ip/.test(proxy), 'proxy Vercel : secret existant et IP réelle transmise')
const content = lire('../extension/content.js')
const iClic = content.indexOf('async function onClick'), iPre = content.indexOf("type: 'inspexo_prelecture'")
const finClic = content.indexOf('\n}\n', iClic)
ok(iPre > iClic && iPre < finClic, 'pré-lecture envoyée DANS le gestionnaire du clic, jamais avant')
const iAff = content.indexOf('function afficherPrelecture')
const corpsAff = content.slice(iAff, content.indexOf('\n}\n', iAff))
ok(iAff > 0 && /textContent/.test(corpsAff) && !/innerHTML/.test(corpsAff), 'panneau construit sans innerHTML (aucun HTML venu du serveur)')
const bg = lire('../extension/background.js')
ok(/PRELECTURE_URL = 'https:\/\/www\.inspexo\.io\/api\/prelecture'/.test(bg), 'l’extension ne parle qu’à inspexo.io')
const iPl = bg.indexOf("'inspexo_prelecture'")
const corpsPl = bg.slice(iPl, bg.indexOf('return true', iPl))
ok(iPl > 0 && /PRELECTURE_URL/.test(corpsPl) && !/photos|images/.test(corpsPl), 'la pré-lecture n’envoie aucune photo')
const m = JSON.parse(lire('../extension/manifest.json'))
ok(m.version === '1.2.0', 'extension 1.2.0')
const a = lire('../extension/privacy.html'), b = lire('../src/pages/ExtensionPrivacy.jsx')
const phrase = "Au même clic, et jamais avant"
ok(a.includes(phrase) && b.includes(phrase), 'les deux pages de confidentialité décrivent la pré-lecture, à l’identique')
console.log(`\n${ok_} PASS, ${ko} FAIL`)
if (ko > 0) process.exit(1)
