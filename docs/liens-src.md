# Liens de campagne `?src=` — prêts à l'emploi

Généré par `node scripts/liens-src.mjs --md`. Ne pas éditer à la main.

L'étiquette est capturée au premier rendu, gardée dans une seule clé de
`sessionStorage`, et **effacée dès qu'elle est rattachée à une analyse**.
Elle n'apparaît qu'en **agrégé** dans l'admin (onglet Parcours), jamais à
côté d'une adresse email.

⚠️ Une étiquette hors format `^[a-z0-9][a-z0-9-]{0,39}$` est **refusée en
base** : le visiteur arrive, l'analyse se fait, et la provenance est perdue
sans message d'erreur. N'inventez pas d'étiquette à la main — ajoutez un
canal dans ce script.

Une étiquette est un **compteur**, pas un titre : `tiktok-03` ne dit rien du
contenu de la vidéo. Tenez la correspondance de votre côté.


## Vidéos TikTok — `tiktok-*` → /score

- `https://www.inspexo.io/score?src=tiktok-01`
- `https://www.inspexo.io/score?src=tiktok-02`
- `https://www.inspexo.io/score?src=tiktok-03`
- `https://www.inspexo.io/score?src=tiktok-04`
- `https://www.inspexo.io/score?src=tiktok-05`
- `https://www.inspexo.io/score?src=tiktok-06`
- `https://www.inspexo.io/score?src=tiktok-07`
- `https://www.inspexo.io/score?src=tiktok-08`
- `https://www.inspexo.io/score?src=tiktok-09`
- `https://www.inspexo.io/score?src=tiktok-10`

## Publications Instagram — `insta-*` → /score

- `https://www.inspexo.io/score?src=insta-01`
- `https://www.inspexo.io/score?src=insta-02`
- `https://www.inspexo.io/score?src=insta-03`
- `https://www.inspexo.io/score?src=insta-04`
- `https://www.inspexo.io/score?src=insta-05`
- `https://www.inspexo.io/score?src=insta-06`
- `https://www.inspexo.io/score?src=insta-07`
- `https://www.inspexo.io/score?src=insta-08`
- `https://www.inspexo.io/score?src=insta-09`
- `https://www.inspexo.io/score?src=insta-10`

## YouTube (description) — `yt-*` → /score

- `https://www.inspexo.io/score?src=yt-01`
- `https://www.inspexo.io/score?src=yt-02`
- `https://www.inspexo.io/score?src=yt-03`
- `https://www.inspexo.io/score?src=yt-04`
- `https://www.inspexo.io/score?src=yt-05`

## Messages sur forums auto — `forum-*` → /airbags-takata

- `https://www.inspexo.io/airbags-takata?src=forum-01`
- `https://www.inspexo.io/airbags-takata?src=forum-02`
- `https://www.inspexo.io/airbags-takata?src=forum-03`
- `https://www.inspexo.io/airbags-takata?src=forum-04`
- `https://www.inspexo.io/airbags-takata?src=forum-05`
- `https://www.inspexo.io/airbags-takata?src=forum-06`
- `https://www.inspexo.io/airbags-takata?src=forum-07`
- `https://www.inspexo.io/airbags-takata?src=forum-08`

## Contacts presse — `presse-*` → /fiabilite

- `https://www.inspexo.io/fiabilite?src=presse-01`
- `https://www.inspexo.io/fiabilite?src=presse-02`
- `https://www.inspexo.io/fiabilite?src=presse-03`
- `https://www.inspexo.io/fiabilite?src=presse-04`
- `https://www.inspexo.io/fiabilite?src=presse-05`

## Reddit — `reddit-*` → /score

- `https://www.inspexo.io/score?src=reddit-01`
- `https://www.inspexo.io/score?src=reddit-02`
- `https://www.inspexo.io/score?src=reddit-03`
- `https://www.inspexo.io/score?src=reddit-04`
- `https://www.inspexo.io/score?src=reddit-05`

## Groupes Facebook — `fb-*` → /score

- `https://www.inspexo.io/score?src=fb-01`
- `https://www.inspexo.io/score?src=fb-02`
- `https://www.inspexo.io/score?src=fb-03`
- `https://www.inspexo.io/score?src=fb-04`
- `https://www.inspexo.io/score?src=fb-05`

## Mentions Leboncoin / petites annonces — `lbc-*` → /extension

- `https://www.inspexo.io/extension?src=lbc-01`
- `https://www.inspexo.io/extension?src=lbc-02`
- `https://www.inspexo.io/extension?src=lbc-03`

## Démarchage professionnel — `pro-*` → /pro

- `https://www.inspexo.io/pro?src=pro-01`
- `https://www.inspexo.io/pro?src=pro-02`
- `https://www.inspexo.io/pro?src=pro-03`

## Lire les résultats

Admin → onglet **Parcours** : analyses par source, taux de passage, délai
médian analyse → paiement. Le bilan quotidien par email reprend la
ventilation par source de la veille.

