# Pré-rendu des pages publiques

## Pourquoi

`/moteur/<famille>`, `/moteur` et `/airbags-takata` n'ont d'intérêt que par leur
contenu. Le site étant une application React (CRA), ce contenu n'existe qu'après
exécution du JavaScript. `scripts/prerendu.mjs` visite donc chaque route
publique dans un vrai navigateur après le build et écrit le HTML obtenu dans
`build/<route>/index.html`.

Vercel sert un fichier existant avant d'appliquer la réécriture SPA : une route
pré-rendue arrive donc complète, et une route absente retombe sur
`build/index.html`, qui reste la sortie CRA intacte.

**`build/index.html` n'est jamais écrit par le pré-rendu.** C'est ce qui rend le
dispositif sans danger : si le pré-rendu ne tourne pas, chaque page est
simplement rendue par React comme avant — jamais une 404. Corollaire : l'accueil
n'est pas pré-rendu (mesuré, il y perdait : FCP 3,2 s contre 1,8 s, pour un
contenu que Google rend déjà).

## Le risque, et pourquoi le build s'arrête

Le conteneur de build de Vercel **n'a pas de Chromium**. Si rien n'est fait,
`scripts/prerendu.mjs` ne peut pas démarrer de navigateur. Le piège est que le
site resterait parfaitement utilisable dans un navigateur : seules les pages
servies aux robots d'indexation seraient vides, et personne ne le verrait avant
des semaines.

Le script **échoue donc bruyamment** (code de sortie 1, donc build en échec)
dans les trois cas :

- `playwright` indisponible ;
- le navigateur ne démarre pas ;
- moins de 10 pages produites, ou une seule route en échec.

C'est voulu : un déploiement qui s'arrête se voit, une page vide non.

## La chaîne en place

Le script essaie DEUX navigateurs, dans cet ordre :

1. **Playwright tel quel** — c'est le chemin du poste de travail.
2. **`@sparticuz/chromium` + `playwright-core`** — Chromium empaqueté avec ses
   bibliothèques, pour les conteneurs qui n'ont rien.

C'est le second qui sert sur Vercel. Mesuré le 29/10/2026 : l'image de build
est une Amazon Linux, `npx playwright install chromium` y télécharge 191 Mio
d'une build Ubuntu de repli (« BEWARE: your OS is not officially supported »)
à laquelle il manque les bibliothèques système — elle meurt au démarrage avec
« Target page, context or browser has been closed ». `@sparticuz/chromium`
embarque les siennes et ne dépend pas de l'image ; il n'y a donc plus de
`buildCommand` particulier.

⚠️ Quatre de ses drapeaux sont filtrés, sans quoi Playwright ne démarre pas :
`--single-process` et `--no-zygote` (taillés pour une Lambda qui rend une page
et s'arrête), `--headless='shell'` (Playwright pose le sien) et
`--disable-web-security` (inutile ici).

`package.json` :

```json
"prebuild":  "node scripts/photos-disponibles.mjs",
"build":     "react-scripts build",
"postbuild": "node scripts/prerendu.mjs"
```

Les identifiants Supabase viennent de `.env.local` en local, des variables du
projet sur Vercel (`REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY` —
déjà nécessaires au build CRA).

## Vérifier un déploiement

Après chaque déploiement (préversion comprise), sans exécuter de JavaScript :

```bash
node scripts/verifier-prerendu.mjs https://<deploiement>.vercel.app
```

Le script récupère quatre pages et vérifie que leur HTML contient bien le titre,
des fragments qui ne peuvent venir que de la base, et assez de texte lisible.
Une coquille vide fait 117 caractères : l'écart est sans ambiguïté.

## Si le pré-rendu casse un jour

### Si même le Chromium empaqueté ne démarre plus

Repli de dernier recours : pré-rendre en local et committer le résultat.

Repli de dernier recours, parce qu'il fige le contenu : une fiche moteur
modifiée en base n'apparaîtra qu'au prochain pré-rendu manuel.

```bash
npm run build                      # produit build/ pré-rendu
rsync -a --include='*/' --include='index.html' --exclude='*' \
      build/moteur build/airbags-takata prerendu-fige/
git add prerendu-fige && git commit -m "chore: pré-rendu figé"
```

Puis copier `prerendu-fige/` dans `build/` depuis le `postbuild`, à la place de
l'appel à Playwright. **Dans ce cas, noter la date du figeage dans ce fichier**
et le refaire à chaque campagne de génération de fiches.
