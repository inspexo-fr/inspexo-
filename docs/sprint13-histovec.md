# Sprint 13 — Lecture du rapport HistoVec — NOTES DE TRAVAIL

> État au 3 novembre 2026. Branche `sprint13` (partie de `sprint12-vocabulaire`,
> non mergée — vérifié : `merge-base == HEAD` des deux côtés).
>
> ⛔ **BLOQUÉ à l'étape 0** : aucun rapport HistoVec réel n'est disponible.
> `tests/histovec/` n'existe pas et rien ne correspond sur la machine. Aucune
> règle d'extraction ne sera écrite avant d'avoir lu le format réel.

---

## 1. `unpdf` — vérifié dans le runtime réel, pas seulement en local

Exigence d'Utku : prouver que la bibliothèque fonctionne **dans un déploiement**
avant de construire dessus. Fait, puis la fonction jetable a été supprimée.

| Épreuve | Pages | Poids | Caractères | Durée |
|---|---|---|---|---|
| PDF témoin fabriqué (texte connu, flux non compressé) | 1 | 1,2 Ko | 446 | **106 ms** |
| PDF réel, texte, flux compressés + polices intégrées | 11 | 508 Ko | 20 499 | **442 ms** |
| PDF réel **scanné** (aucune couche texte) | 9 | 4,2 Mo | **2** | 449 ms |

- Runtime : `supabase-edge-runtime-1.77.9 (compatible Deno v2.1.4)`.
- `npm:unpdf@1.9.1`, **zéro dépendance** — rien d'autre ne monte dans le bundle.
- L'ordre des lignes est **conservé** : les règles pourront s'appuyer sur la
  succession des lignes, pas seulement sur des motifs isolés.
- Nombre de caractères **identique** en local (Node) et en déployé : l'extraction
  ne dépend pas du runtime, donc les fixtures de test hors ligne seront fidèles.
- Procédé : fonction jetable `test-unpdf`, fermée par `x-eval-secret`, déployée
  puis **supprimée** (vérifié : l'URL rend 404). Les PDF réels employés comme
  échantillons sont des documents personnels d'Utku sans lien avec le projet :
  seuls les COMPTAGES ont été relevés, aucun contenu n'a été affiché ni conservé.

### ⚠️ Ce que la troisième épreuve nous apprend

Un PDF de 9 pages peut s'analyser sans erreur et ne rendre **que 2 caractères**.
`unpdf` n'a pas échoué — il n'y avait pas de texte à extraire, le document étant
une image. Conséquences pour l'implémentation :

1. **« Aucune erreur » ne veut pas dire « lecture réussie ».** Il faut un seuil
   de texte utile et un contrôle de présence des marqueurs HistoVec attendus.
   Sans cela, un scan produirait zéro fait et l'écran afficherait « rapport lu,
   aucun signal » — le pire des messages, puisqu'il rassure à tort.
2. Si les rapports HistoVec réels s'avéraient être des images, la contrainte
   « sans IA » devient incompatible avec le format. À trancher à l'étape 0.
3. Le coût est faible et la détection rapide (449 ms) : le refus est franc.

### Autre point relevé

Le téléversement doit être **plafonné côté serveur**. Le scan de 4,2 Mo devient
~5,6 Mo en base64 : au-delà de la limite de 4,5 Mo des fonctions Vercel. Sans
effet ici (le client appelle les fonctions Supabase **en direct**, seuls
`intake`, `marche` et `go` passent par un proxy Vercel), mais un plafond
explicite évite d'en dépendre.

---

## 2. Décisions actées (Utku, 3 novembre 2026)

| Sujet | Décision |
|---|---|
| Extraction du texte | **Côté serveur**, avec `unpdf`. Le filtre PII devient testable et vérifiable, ce qu'un nettoyage navigateur ne permet pas |
| `BAREME_VERSION` | **11.1**, et mentionné dans les CUA de l'API |
| Dépôt du PDF | Bloc sur `/a/:id`, sur le modèle de `LectureCtBloc` |
| Message vendeur | **Corrigé** : le texte actuel demande « le VIN et une photo de la carte grise » pour « consulter le rapport HistoVec ». C'est faux — un acheteur ne peut pas consulter HistoVec avec un VIN, seul le titulaire génère le rapport et le partage |

### Règle 0 — concordance (à exécuter AVANT le filtre PII)

Comparer marque, modèle, énergie et date de 1ʳᵉ immatriculation du rapport avec
l'annonce, plus **VIN et plaque si l'annonce les montre**. Discordance ⇒
**ROUGE** « ce rapport ne correspond pas à ce véhicule ».

⚠️ **L'ordre est le point délicat** : la comparaison a besoin du VIN et de la
plaque, que le filtre PII doit justement retirer. La séquence est donc, **en
mémoire et dans cet ordre** : extraire → comparer → **retirer VIN et plaque** →
ne garder que les faits utiles. Rien n'est stocké à aucune étape. Un test devra
vérifier qu'aucun VIN ni plaque ne survit dans les faits retenus — c'est
l'invariant qui protège l'ordre de ces opérations contre une réécriture future.

---

## 3. Ce qu'il reste à faire à l'étape 0

Déposer 2-3 rapports réels dans `tests/histovec/` (dossier **déjà ignoré** par
git, vérifié avec `git check-ignore`). Je rendrai alors la note de format :
champs réellement présents, libellés exacts, stabilité de la mise en page,
extractibilité — puis des fixtures **anonymisées** dans
`tests/histovec-fixtures/`, versionnées, structure conservée et identités
remplacées.
