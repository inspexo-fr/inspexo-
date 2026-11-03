# Fixtures CSA HistoVec — générées par le générateur OFFICIEL

Les sept PDF de ce dossier sont produits par **`csaAsPdf`, le générateur
d'HistoVec lui-même** (`github.com/histovec/histovec-beta`, pdf-lib) : ils sont
fidèles à l'octet au vrai document, au lieu d'en être une imitation.

Les données sont **entièrement inventées** : plaques `AA-123-AA`, VIN
`VF3XXXXXXXXXXXXXX`, créancier « ORGANISME DE CREDIT FIXTURE ». Aucun rapport
réel n'a servi. C'est pourquoi ces fichiers sont **versionnés**, contrairement à
`tests/histovec/` (rapports réels, ignoré par git).

`generer.mjs` conserve la recette. Il a besoin du générateur HistoVec cloné hors
du dépôt + `pdf-lib`, `qr.js`, `dayjs` — voir `docs/sprint13-histovec-format.md`.

Chaque `.txt` est le texte **réellement extrait** du PDF voisin par `unpdf`.
C'est le socle des tests hors ligne : le module de lecture prend du TEXTE, donc
les tests n'ont besoin d'aucun analyseur PDF.

| Fixture | Ce qu'elle couvre |
|---|---|
| `csa-aucune-anomalie` | rien à signaler ; les **trois formes négatives** (« Aucune », « Aucun », « Non ») ; deux titulaires |
| `csa-gage-et-opposition` | gage avec créancier + OTCI + PV en attente |
| `csa-vehicule-endommage-en-cours` | réparation contrôlée **en cours**, libellé CSA « Opposition véhicule endommagé » |
| `csa-vehicule-irreparable` | OVEI + déclaration valant saisie + suspension motivée + duplicata |
| `csa-vole` | véhicule volé, titre volé et perdu |
| `csa-ancienne-location` | `CHANG_LOC` dans l'historique |
| `csa-certificat-annule` | certificat annulé : **la section détaillée disparaît** |
