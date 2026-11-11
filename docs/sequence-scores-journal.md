# Séquence des scores — journal (sprint 23, nov. 2026)

Décision d'Utku du 11 nov. 2026 : (b) → (c) → (c2) → (d), un seul changement
à la fois, chacun suivi des 4 références × 3 (`--plafond-session 7`).
Arrêt si une couleur change, si un score bouge de plus de 3 points hors écart
annoncé, ou si le cumul de tests atteint 7 €. Arrêt obligatoire avant (e) et (f).
Chaque déploiement est annoncé ICI avant d'être fait.

Point de départ (après a2, 11 nov.) : S7 rouge 39/35/39 · 308 orange 55 ·
Mercedes vert 71 · Clio II orange 51 · cumul tests 3,00 €.

## (b) merge de sprint22c — 11 nov. 2026
- Écart annoncé : **aucun** (sprint22c ne touche pas `score`).
- Déploiement annoncé : **aucun**. `admin-defect-sheets` tourne déjà en version
  22c. `sheet-builder` tourne en 22c + juge corrigé du sprint 23 : le
  redéployer depuis main ramènerait l'ancien juge (défaut des silences), il
  n'est donc PAS redéployé.
- Outillage : `--plafond-session` reporté de sprint23 dans `scripts/eval.mjs`.
- Résultat (b) : S7 rouge 39/39/39 · 308 orange 55/55/55 · Mercedes vert
  71/71/71 · Clio II orange 51/51/51 — inchangés. 1,046 € · cumul 4,04 €.

## (c) sprint22d, signaux d'entretien déterministes — 11 nov. 2026
- Écart annoncé (barème rejoué hors ligne sur les faits des dossiers de (b),
  signaux remplacés par ceux des motifs fixes) : S7 39 · 308 55 ·
  **Mercedes 71 → 73** (aucun signal écrit, garantie exclue ⇒ axe entretien
  non évalué) · Clio II 51.
- `BAREME_VERSION` : 22d portait « 11.10 », déjà pris par (a2) et servi depuis
  ce matin. Renuméroté **11.11** (11.10-22d n'a jamais été servi).
- Déploiement annoncé : `score` + fonctions qui importent `bareme.ts`
  (`api-analyses`, `lecture-ct`, `lecture-histovec`, `visite`), liste à
  confirmer par `scripts/fonctions-a-redeployer.mjs`.
