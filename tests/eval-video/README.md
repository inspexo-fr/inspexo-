# Éval du mode enregistrement d'écran

Chaque cas = un dossier `tests/eval-video/<nom>/` contenant :

- `enregistrement.webm` / `.mp4` (Android) / `.mov` (iPhone) — le fichier vidéo
  n'est **pas commité** (gitignoré) : à déposer à la main.
- `expected.json` :

```json
{
  "texte_must_include": ["PureTech", ["84 500", "84500"]],
  "images_vehicule_min": 1,
  "cout_max_eur": 0.20
}
```

Lancement : `npm run eval:video` (ou `node tests/eval-video/run.mjs <cas>`).

Le harnais rejoue le VRAI front (build/) dans un navigateur : extraction des
images côté navigateur, lecture du texte par la fonction `extraction`,
vérification du texte extrait, analyse complète, et **coût total mesuré**
(extraction + analyse, objectif < 0,20 €). Les `.mov` HEVC d'iPhone passent par
WebKit (décodage système macOS) — chromium ne les lit pas, c'est précisément le
cas de repli « mode captures » côté utilisateur.

Cas de référence : `synthetique-308` (régénérable via
`node tests/eval-video/generer-enregistrement.mjs`). Les 2 cas RÉELS fournis
par Utku se déposent ici : `iphone-reel/enregistrement.mov`,
`android-reel/enregistrement.mp4` + leurs `expected.json`.
