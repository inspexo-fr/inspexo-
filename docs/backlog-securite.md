# Backlog sécurité — findings restants de l'audit du 27/10/2026

Source : audit multi-agents du périmètre sprint 3 (14 agents, réfutation
adversariale). Les 8 findings confirmés (2 critiques, 5 hauts, 1 moyen) ont été
**corrigés** aux sprints 3 et 3.1, ainsi que 8 mineurs. Restent ci-dessous les
mineurs non corrigés, classés par sévérité. Aucun n'ouvre d'accès à des données
ou de mutation visible par autrui — ce sont des durcissements.

## Actions requises (clés à fournir — bloquées sans intervention)
- [ ] **Turnstile dormant** : tout est câblé (widget front, gate `/score` au-delà
  de 2 analyses/jour/IP, captcha GoTrue sur le lien magique) mais inactif tant
  que le widget Cloudflare n'existe pas. → Créer le widget (dashboard
  Cloudflare, gratuit), coller `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`
  dans `.env.local`, lancer `node scripts/activer-turnstile.mjs`, redéployer.
- [ ] **SMTP Resend pour Supabase Auth** : clé Resend introuvable en clair.
  → Créer une clé « sending » (dashboard Resend), coller `RESEND_SMTP_KEY`
  dans `.env.local`, lancer `node scripts/configurer-smtp-auth.mjs`.
  En attendant : mailer Supabase intégré, limité à 2 emails/h.

## Moyennes
- [ ] **Concurrence sur `result_json` (mode visite persistant)** : read-modify-write
  sans verrou — deux mutations simultanées du propriétaire peuvent s'écraser.
  Piste : `update … where id = :id and result_json->>'maj' = :vu` (optimistic
  lock) ou file par analyse. (`supabase/functions/visite/index.ts`)
- [ ] **`admin-audit` renvoie `input_text` brut** : le texte d'annonce peut
  contenir des données personnelles du vendeur (téléphone, adresse). Piste :
  masquer numéros/emails à l'affichage et tracer les accès.
- [ ] **Rétention des `outcomes` après suppression du compte** : `user_id` passe
  à null mais commentaire/prix restent. Piste : purge ou anonymisation à la
  suppression du compte (job RGPD).
- [ ] **Branche `terminer` du mode visite sans rate limit dédié** : n'écrit rien
  en anonyme et un event par appel en persistant, mais pas de plafond propre.
  Piste : même seau que `visite_photo`.

## Basses
- [ ] **PKCE** : le client Supabase utilise le flux implicite par défaut
  (tokens dans le fragment d'URL d'une page publique). Piste :
  `createClient(..., { auth: { flowType: 'pkce' } })` + tests du retour de lien.
- [ ] **Plafond de 100 entrées du dossier contournable par course**
  (count-then-insert sans verrou) — impact : quelques entrées au-delà de 100.
- [ ] **`track_event` : comptage avant insertion (TOCTOU)** — à aligner sur le
  modèle du score (insertion de la tentative avant comptage).
- [ ] **Preuve « validé par devis » mutable** : coûts modifiables après
  validation, photo de devis écrasable sans trace. Piste : journal des
  versions ou interdiction de PATCH après validation.
- [ ] **`api/alertes.js`** : comparaison du `CRON_SECRET` non constante (`!==`)
  et aucune restriction de méthode HTTP. Impact marginal (secret 48 hex,
  endpoint sans effet sans le secret Supabase).
- [ ] **`clientIp` (visite/score)** : fallback `x-forwarded-for` contrôlable si
  `cf-connecting-ip` absent — contre la doctrine du projet. Piste : refuser ou
  seau « unknown » plus strict.
- [ ] **Ligne progressive abandonnée** : le placeholder (orange 0) d'une analyse
  dont le pipeline est mort reste servi par les meta OG. Piste : balayage des
  lignes `en_cours` de plus d'une heure → `etape: 'erreur'`.

## Non retenus (choix produit assumés)
- `dossier_add` accepte tout `analysis_id` public : voulu (les analyses sont
  publiques par lien, l'ajout n'affecte que le dossier de l'appelant).
- Création de compte à la volée par lien magique : c'est le produit « compte
  léger » ; l'abus d'envoi d'emails est couvert par le captcha Turnstile (une
  fois activé) et les limites GoTrue.
- Cache 7 jours partagé entre visiteurs : voulu (stabilité du verdict) ;
  l'empreinte intègre désormais photos/comparables/usage.
- ~~**Robustesse** : `rappels` mettait en cache 24 h un résultat VIDE (constaté le 28/10 : audi|s7 → 0 fiche pendant que l'API directe en renvoyait 64).~~ **CORRIGÉ le 28/10** : `_shared/rappelsCache.ts` — jamais de cache sur vide ou erreur, second essai avant de conclure, entrées vides héritées ignorées, message « Vérification RappelConso indisponible, réessayez plus tard » au lieu de « aucun rappel ». Tests : `tests/rappels-cache.test.mjs` + cas d'éval `rappels-vide-non-cache`.
- **Fiabilité du verdict (à arbitrer)** : l'extraction des `operations_non_faites` est instable sur une déclaration pourtant explicite. Mesuré le 28/10 sur le cas 308 (« Distribution jamais faite. » en toutes lettres) : 2 analyses sur 3 la retiennent → orange **55** (plafond « opération critique non faite »), 1 sur 3 la rate → orange **62** et verdict conditionnel **vert**. L'écart dépasse la tolérance de stabilité (5 points) et porte sur LE défaut emblématique du 1.2 PureTech. Pistes : règle de prompt dédiée aux déclarations explicites de non-entretien (« jamais faite », « à prévoir », « non effectuée »), ou filet déterministe serveur qui relit l'annonce sur ces formulations avant le barème.
