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

`vercel.json` :

```json
"buildCommand": "npx playwright install chromium && npm run build"
```

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

## Si Vercel ne peut pas installer Chromium

`npx playwright install chromium` télécharge un Chromium qui dépend de quelques
bibliothèques système. Si l'image de build ne les fournit pas, deux replis, par
ordre de préférence.

### 1. Chromium empaqueté pour le serverless

```bash
npm i -D @sparticuz/chromium playwright-core
```

Dans `scripts/prerendu.mjs`, remplacer le lancement par :

```js
const { chromium } = await import('playwright-core')
const sparticuz = (await import('@sparticuz/chromium')).default
nav = await chromium.launch({
  executablePath: await sparticuz.executablePath(),
  args: sparticuz.args,
})
```

`@sparticuz/chromium` embarque ses bibliothèques : il ne dépend pas de l'image.
Retirer alors `npx playwright install chromium` de `buildCommand`.

### 2. Pré-rendre en local et committer le résultat

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
