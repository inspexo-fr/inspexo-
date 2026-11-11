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
