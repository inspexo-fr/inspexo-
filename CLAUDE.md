# INSPEXO — Contexte Projet pour Claude Code

## Mission
Inspexo aide les acheteurs de véhicules d'occasion à éviter les mauvaises affaires. **Pivot (oct. 2026) : l'IA est le produit principal.**
- Le **score d'annonce gratuit** (`/score`) est l'outil d'acquisition : verdict vert/orange/rouge en < 20 s.
- Le **Pass achat à 29 €** (à venir) est la montée en gamme : accompagnement IA complet jusqu'à la signature.
- Les **experts humains** spécialisés par marque (Visio, Inspection) sont en **liste d'attente** le temps de constituer le réseau.

L'indépendance reste totale : **jamais payé par le vendeur**. L'inspection est payée exclusivement par l'acheteur. ⚠️ Depuis le sprint 10, un partenaire assurance ou financement PEUT verser une commission d'apport : elle est alors **déclarée en base partenaire par partenaire** et affichée à l'écran au-dessus du lien. Ne plus écrire « Inspexo est payé exclusivement par l'acheteur » sans préciser de quoi on parle — la formule exacte est « l'inspection est payée exclusivement par l'acheteur ».

## URLs & Accès
- **Site déployé** : inspexo-k2dv.vercel.app
- **Domaine** : inspexo.io (OVH)
- **GitHub** : github.com/inspexo-fr/inspexo-
- **Email** : contact@inspexo.io (ImprovMX + Gmail SMTP)

## Stack Technique
- **Frontend** : React (composants séparés, PAS de monolithe App.js)
- **Hébergement** : Vercel
- **Base de données** : Supabase (Auth + PostgreSQL + Row Level Security + Edge Functions)
- **Paiement** : Stripe + Stripe Connect — JAMAIS de virement manuel
- **IA** : API Anthropic Claude (`claude-sonnet-5` pour le score) — appel via Supabase Edge Function, JAMAIS côté client
- **Réservation** : Cal.com
- **Emails** : Resend
- **Visio** : Google Meet

## Architecture Frontend

### Structure des fichiers
```
inspexo/
├── api/
│   └── og.js                # Fonction Vercel : meta Open Graph de /a/:id pour les crawlers
├── public/
│   └── index.html
├── src/
│   ├── components/          # Navbar, Hero, StatsBar, HowItWorks, Services,
│   │                        # Experts (waitlist), BecomeExpert, FAQ, Footer,
│   │                        # FooterNotes, LeadEmailForm, modales legacy…
│   ├── pages/
│   │   ├── ScorePage.jsx    # /score — formulaire d'analyse d'annonce
│   │   ├── ResultPage.jsx   # /a/:id — résultat public partageable
│   │   └── …                # dashboards, pages légales
│   ├── data/
│   │   └── defectAtlas.js   # Defect Atlas (source de vérité, copié côté functions)
│   ├── lib/
│   │   ├── supabaseClient.js
│   │   ├── scoreApi.js      # appels edge functions + RPC (leads, events)
│   │   └── imageUtils.js    # redim 1600px + suppression EXIF via canvas
│   ├── App.jsx              # routes + assemblage
│   └── index.js
├── supabase/
│   ├── functions/
│   │   ├── score/           # analyse d'annonce (Claude Sonnet 5)
│   │   ├── rappels/         # RappelConso + Takata
│   │   └── _shared/         # defectAtlas.json, takata_models.json, brandAliases.ts
│   └── migrations/
├── vercel.json              # rewrite OG (user-agent bots) + fallback SPA
├── .env.local               # JAMAIS commité
├── CLAUDE.md
└── package.json
```

### Design System — STRICTEMENT RESPECTER
```css
/* Couleurs */
--bleu-nuit: #0F1B2D;
--bleu-mid: #1A2E45;
--bleu-accent: #1E4D8C;
--orange: #FF4D00;
--orange-light: #FF6B35;
--orange-pale: #FFF0EA;
--blanc: #FFFFFF;
--gris-clair: #F8F9FA;
--gris-2: #F0F2F5;
--texte: #0F1B2D;
--muted: #6B7280;
--bordure: rgba(0,0,0,0.07);

/* Typographie */
--font-titre: 'Syne', sans-serif;       /* weight: 700, 800 */
--font-corps: 'Plus Jakarta Sans', sans-serif;  /* weight: 300-800 */
```

### Style visuel — Référence ancien design
Le site utilise un style éditorial/magazine avec :
- Sections numérotées : "// 01 — Comment ça marche", "// 02 — Nos services", etc.
- Hero avec texte outline : "votre véhicule" en WebkitTextStroke transparent
- Cards de services : la card featured (Visio) a un fond bleu nuit avec ombre portée
- Typographie contrastée : titres très grands (44-80px), corps léger (weight 300)
- Micro-interactions : .card-hover avec translateY(-4px) au survol
- Badges arrondis (border-radius: 100px) pour les tags et filtres
- Séparateurs subtils entre les items de liste (borderBottom)

### Routes
- `/` — landing (sections ci-dessous)
- `/score` — score d'annonce gratuit (mobile d'abord, sans login)
- `/a/:id` — résultat public partageable (OG dynamique pour les bots via `api/og.js`)
- dashboards et pages légales existants

### Structure de la landing (10 sections dans l'ordre)
1. **Navbar** — fixe 64px, bleu nuit, logo "INSPEXO" (Syne, letterspacing 3px, E en orange), liens desktop + hamburger mobile, CTA "Analyser une annonce" → `/score` (ancres en `/#section` pour fonctionner depuis les sous-pages)
2. **Hero** — bleu nuit, min-height 100vh, badge orange arrondi, titre Syne 68px+ avec text-outline, sous-titre italique, CTA principal "Analyser une annonce" → `/score` + bouton outline, badges de confiance (le badge « Experts qualifiés vérifiés » a été retiré)
2bis. **Pourquoi Inspexo** (sprint 2A) — fond blanc, 4 colonnes sobres sans emoji (Chaque panne a sa source / Rappels officiels / Airbags Takata vérifiés / Le cadre juridique du vendeur), phrase de clôture « Ce qui n'est pas prouvé n'apparaît pas. »
3. **Barre Stats** — fond orange, 4 stats : "5,5M Transactions VO/an", "30+ Marques couvertes", "9,90€ Pour commencer", "100% Côté acheteur"
4. **Comment ça marche** — fond blanc, 3 étapes avec icônes dans cercles orange pâle, numérotées "Étape 01/02/03"
5. **Nos Services** — fond gris clair, 3 cards (IA / Visio featured / Inspection), encart garantie en bas. CTA Visio & Inspection = « Rejoindre la liste d'attente » (formulaire email inline, lead `expert_waitlist`)
6. **Nos Experts** — fond bleu nuit, bloc « Réseau d'experts en construction » + capture email (lead `expert_waitlist`) + pills des marques prioritaires. Les profils fictifs et leurs chiffres ont été retirés (sprint 1)
7. **Devenir Expert** — fond orange pâle, grille revenus (40€ / 175€), CTA bleu nuit
8. **FAQ** — fond blanc, accordéon avec chevron +/rotate(45deg)
9. **Footer** — bleu nuit, logo atténué, grille 3 colonnes (Navigation, Contact, Légal)
10. **Notes bas de page** — fond #080E18, 3 astérisques max

### Navbar — PAS de lien FAQ
La navbar contient uniquement : Comment ça marche, Nos services, Nos experts, Devenir expert + CTA.
PAS de lien FAQ dans la navbar.

## Modèle Économique — pivot IA

| Offre | Prix | Statut |
|-------|------|--------|
| Score d'annonce | Gratuit (5 analyses / 24 h / IP) | ✅ En ligne — acquisition |
| Pass achat | 29 € | ⬜ À venir — produit principal |
| Visio Test Drive | 59 € (prix de lancement) | ⏸ Liste d'attente |
| Inspection Physique | 249 € (prix de lancement) | ⏸ Liste d'attente |

- Le score gratuit crée du doute UTILE (factuel, jamais alarmiste) et pousse vers le Pass achat.
- Le Pass achat (29 €) : accompagnement IA complet jusqu'à la signature — à spécifier. Les leads sont collectés dès maintenant (source `pass_waitlist`).
- Visio (59 €, split 19/40) et Inspection (249 €, split 79/170) restent affichés sur le site avec CTA « Rejoindre la liste d'attente » (source `expert_waitlist`) tant que le réseau d'experts n'est pas opérationnel. Hausse prévue post-traction : Visio → 75 €, Inspection → 299 € (part expert inchangée).
- L'ancien palier « IA Spécialisée 9,90 € » (chat 10 échanges : FreeAnalysisModal / ChatIA / fonction `ai-chat`) existe toujours dans le code mais n'est plus le produit mis en avant.

## Score d'annonce gratuit (Sprint 1 livré, approfondi au Sprint 1.5 — oct. 2026)

### Règle d'or (Sprint 1.5)
ZÉRO affirmation technique sans source. Une panne ne peut provenir QUE du catalogue (Defect Atlas « base Inspexo » + fiche famille moteur web-sourcée) — jointure par identifiant côté serveur, une panne inventée est structurellement impossible. Le budget 12 mois ne garde que les postes au coût chiffré à la source. Un 3e appel (critique) supprime tout ce qui n'est tracé à rien (events `claim_dropped`). Jamais « confiance basse » à l'écran : « source : base Inspexo » ou « sources en ligne, à confirmer sur place ».

### Pipeline (3 appels claude-sonnet-5, tool use strict, thinking désactivé)
1. **Identification** : marque/modèle/génération/famille moteur UNIQUE (jamais « A ou B » ; déduction autorisée quand modèle+motorisation+année déterminent une seule famille), prix texte vs prix visuel, CT, `statut_vendeur` ∈ particulier|pro|intermediaire_pour_particulier|pro_deguise_probable (indices : « frais de mise en main », « nos véhicules », dépôt-vente…). Court-circuit si pas une annonce véhicule.
2. **Fiche famille moteur** (`defect_sheets`, clé marque+famille+plage d'années) : cache 90 j (`generee`) ou permanent (`validee` après relecture humaine via `admin-defect-sheets`). Génération par la fonction dédiée `sheet-builder` (web search Anthropic, 3 recherches max, TOUTE panne sans URL rejetée, familles étrangères rejetées) — `score` la déclenche puis POLLE la table ≤ 50 s ; sinon l'analyse continue sans fiche (`cache: pending`) et le prochain appel la trouve. ⚠️ wall-clock edge functions = 150 s (plan gratuit) : c'est la contrainte qui a imposé ce découplage.
3. **Analyse** : 5 axes /20 (prix, km/âge, historique, risques mécaniques, vendeur/cadre juridique), score = somme, verdict par bandes (≥70 vert, 40-69 orange, <40 rouge, le plus sévère gagne) ; raisons par impact financier (statut intermédiaire/pro déguisé FORCÉ serveur en raison 1-2) ; questions → message vendeur composé SERVEUR (+ VIN/carte grise/HistoVec) ; checklist 12-15 (démarrage à froid en premier) ; cadre juridique = constantes serveur par statut ; avertissement = constante serveur.
4. **Critique** : décisions gardee/supprimee/reformulee par claim, sources {annonce, fiche, rappelconso, takata, droit, socle, aucune}, « aucune » ⇒ suppression ; n'émet QUE les non-gardées (économie de tokens) ; > 50 % des pannes supprimées ⇒ bandeau « Analyse limitée ».

### Sécurité (audit ultracode oct. 2026 — corrigé)
- Anti-injection : chevrons neutralisés (‹ ›) dans annonce/comparables ; images et contenu web du catalogue déclarés non fiables dans les 3 prompts + celui de la fiche.
- RPC durcies : `submit_lead` (dédup unique (email, source), 10/ip/24 h), `track_event` (props ≤ 2 Ko, schéma strict verdict_feedback, 120/ip/24 h), `get_public_analysis` (share_views/result_viewed dédupliqués 1/ip/h) — ip hachée côté SQL via `_request_ip_hash` (header cf-connecting-ip, pgcrypto).
- Rate limit score anti-TOCTOU : insertion de la tentative AVANT comptage. IP_HASH_SALT sans fallback (fail-fast). Clause where RappelConso filtrée (`"`/`\`/`*` interdits).
- Bypass d'éval : header `x-eval-secret` = secret `EVAL_BYPASS_SECRET` (supabase secrets + .env.local, jamais commité).

### ⚠️ LE BUDGET ANNONCÉ EST UN MUR (règle du 5 nov. 2026)
**Le compteur s'arrête de lui-même au budget annoncé, et on demande avant
d'aller au-delà. Sans exception.**
- Le 5 novembre, un correctif annoncé à **0,60 €** a coûté **2,31 €**. Chaque
  relance se justifiait seule — comprendre un motif d'échec, obtenir un dossier
  à inspecter, vérifier les autres références — et **personne n'a jamais décidé
  d'y mettre quatre fois la somme**. Un budget qu'on dépasse en l'expliquant
  après coup n'est pas un budget.
- Tous les scripts qui dépensent acceptent **`--budget <eur>`** : le mur de CE
  run, en plus du plafond cumulé. Le premier atteint arrête, dit ce qui n'a pas
  été joué, et demande une décision explicite pour continuer.
  `scripts/eval.mjs`, `verifier-analyses.mjs`, `sourcer-atlas.mjs`,
  `rattraper-atlas.mjs`.
- Dépasser est **une décision d'Utku**, jamais un glissement : on s'arrête, on
  dit ce qu'il reste à faire et ce que ça coûtera, on attend.

### Règle de coût des tests (OBLIGATOIRE)
- **Pendant le développement** : ne rejouer que les cas concernés par la modification (`npm run eval -- <cas>`). L'éval complète ne tourne **qu'une fois, avant le merge**.
- **Test de stabilité** (3 passages) : uniquement sur 3 cas fixes — `audi-s7-intermediaire`, `308-puretech-complete`, `mercedes-2025-societe`.
- **Toute campagne de stabilité passe par `scripts/eval.mjs`, JAMAIS par curl** : `npm run eval -- <cas> --repetitions N`. Les appels directs échappent au compteur `.eval-cout.json` et au plafond de 5 € (constaté le 28/10 : 1,20 € hors compteur).
- **Run avec le modèle de secours** : une seule fois par sprint (`npm run eval -- --modele-secours`).
- Chaque `npm run eval` **affiche le coût total** à la fin. Le script **s'arrête et demande confirmation** avant de dépasser **5 € de tests dans une même session** (compteur cumulé dans `.eval-cout.json`, remis à zéro avec `--reset-cout`).

### Éval de non-régression — BLOQUANTE avant deploy
`npm run eval` (tests/eval/, 8 cas : 6 historiques + Audi S7 intermédiaire/EA824 + injection de prompt). Un cas = annonce.txt + expected.json {http_status, verdict_min/max, score_min/max, statut_vendeur, famille_moteur (préfixe compatible), statut_in_raisons12, rappels_min, must_include[], must_not_include[]}. Rejoue contre la fonction déployée ; retry automatique si fiche `pending`.

### Rappels / Takata (Sprint 1.5)
- Filtre d'années strict : date_publication ≥ année-modèle − 1 (appliqué après le cache, qui reste par marque+modèle).
- Carrosseries et badges moteur exclus du matching (sportback, tfsi…) ; dérivés sportifs mappés vers le modèle de base (S7/RS7 → A7 — RappelConso n'étiquette que « a7 »).
- Bloc Takata TOUJOURS affiché : positif = bandeau rouge ; négatif = « modèle non listé dans la campagne officielle (liste du JJ/MM/AAAA) ».
- HistoVec (https://histovec.interieur.gouv.fr) dans le bloc cadre juridique.

## Détails Sprint 1 (historique)

### Produit
- `/score` : texte d'annonce (≤ 6 000 car.) + jusqu'à 6 photos (redimensionnées à 1 600 px côté client, EXIF supprimé par réencodage canvas, JAMAIS stockées — seul `images_count` persiste) + jusqu'à 5 annonces comparables.
- Résultat en < 20 s : verdict `vert|orange|rouge`, score 0-100, exactement 3 raisons, pannes connues (gravité `securite|majeure|mineure` + confiance `haute|moyenne|basse` affichées), incohérences, questions au vendeur, avis prix (médiane des comparables).
- `/a/:id` : page publique partageable — bloc rappels constructeur + bandeau Takata, boutons Partager / « Recevoir ce rapport par email » (lead `rapport`) / « Être prévenu du Pass achat » (lead `pass_waitlist`).
- Mention obligatoire sous chaque résultat : « Analyse automatique à partir du texte de l'annonce. Ne remplace pas un examen du véhicule. »

### Edge function `score`
- Modèle `claude-sonnet-5`, tool use strict forcé (`rendre_verdict`), `thinking: disabled`, `max_tokens: 2000`. ⚠️ Sonnet 5 rejette `temperature` (400).
- System prompt avec `cache_control`, contenant le Defect Atlas complet (`src/data/defectAtlas.js`, copié en `_shared/defectAtlas.json`). Règle : panne de l'atlas → confiance « haute » ; connaissances générales non vérifiées → « basse ».
- Le texte d'annonce est traité comme DONNÉE NON FIABLE : toute instruction qu'il contient est ignorée (anti prompt-injection).
- Jamais de récupération d'URL (pas de scraping) : lien collé seul → 422 avec message demandant le texte.
- Rate limit : 5 analyses / 24 h par `ip_hash` = sha256(IP_HASH_SALT + IP). ⚠️ Seule source d'IP fiable : header `cf-connecting-ip` (stable, non spoofable) ; le `x-forwarded-for` Supabase varie à chaque requête.
- Coût mesuré : ≈ 0,028 $ / analyse (~1 350 tokens de sortie), latence 11-16 s. Tokens loggés dans l'event `score_done`.

### Edge function `rappels`
- RappelConso v2 : dataset `rappelconso-v2-gtin-espaces` (data.economie.gouv.fr, API Explore v2.1 — l'ancien `rappelconso0` n'existe plus). Catégorie exacte : `"automobiles et moyens de déplacement"`. Marques en minuscules et incohérentes (« vw », « mercedes-benz », « citroen » ET « citroën ») → alias dans `_shared/brandAliases.ts` (fichier commenté, à enrichir à la main).
- Filtre modèle côté serveur par candidats (phrase complète, bigrammes « serie 3 », codes châssis/moteur « f30 », « 320d »). Dédoublonnage par `numero_fiche`. Cache 24 h en table `rappels_cache`.
- Takata : `_shared/takata_models.json` (33 marques, 235 modèles, source https://www.ecologie.gouv.fr/rappel-airbag-takata — à régénérer périodiquement). Match marque + modèle + année → bandeau « Modèle concerné par la campagne airbags Takata — vérifiez avec le numéro de série (VIN) sur le site du constructeur avant tout achat ». Année inconnue = bandeau affiché par prudence.

### Base de données (migration `20261018120000_sprint1_score`)
- Tables : `analyses`, `leads` (source ∈ `pass_waitlist|expert_waitlist|rapport`), `events`, `rappels_cache`. RLS activée partout, AUCUNE policy anon — les edge functions écrivent en service role.
- Accès public UNIQUEMENT via RPC SECURITY DEFINER :
  - `get_public_analysis(p_id, p_track)` — lecture par id uniquement (pas de listing), incrémente `share_views` + event `result_viewed` ; `p_track=false` pour les crawlers OG.
  - `submit_lead(p_email, p_source, p_analysis_id)` — insert lead + event `lead_submitted`.
  - `track_event(p_name, p_analysis_id, p_props)` — whitelist stricte (`share_clicked`).
- Événements de mesure : `score_started`, `score_done` (durée + tokens dans `props_json` → base du calcul de coût), `rappels_found`, `result_viewed`, `share_clicked`, `lead_submitted`.

## Extension Chrome + analyse photos (Sprint 2C — oct. 2026)

- **Extension MV3** (`extension/`) : bouton flottant « Analyser avec Inspexo » sur les pages d'annonce leboncoin.fr / lacentrale.fr / autoscout24.fr. Extracteurs par site dans `extension/sites/*.js` (__NEXT_DATA__ → JSON-LD → dataLayer), testés sur fixtures (`tests/extension/`, `node tests/extension/run.mjs` ; AS24 = 3 pages réelles, LBC/LaCentrale = reconstituées, DataDome bloquant la capture). Photos téléchargées par le service worker, redimensionnées 1 600 px, EXIF supprimé, base64. Échec d'extraction → fallback `/score?texte=`. Permissions minimales (activeTab, scripting, 3 hôtes). Zip de soumission + `extension/STORE.md`. Pages site : `/extension` (présentation, `STORE_URL` à renseigner après publication) et `/extension/confidentialite`.
- **Chaîne d'envoi** : extension → `https://www.inspexo.io/api/intake` (proxy Vercel, seul domaine contacté — engagement Web Store) → fonction `intake` (secret `INTAKE_PROXY_SECRET` des deux côtés, IP réelle transmise) → fonction `score` en service→service (`x-intake-ip-hash`) : rate limit 5/24 h partagé avec /score. `source_url` conservée dans `result_json`.
- **Analyse photos** (score et intake) : jusqu'à 6 photos. Appel vision dédié `claude-sonnet-5` (tool `rendre_constats_photo`, lancé en parallèle de la fiche) → `constats_photo[]` {organe ∈ compteur|pneus|carrosserie|jantes|interieur|moteur|document_ct|autre, constat, signal ∈ ok|attention|rouge, photo_index, confiance}. Règles SERVEUR : km compteur vs annoncé (écart > 2 % ⇒ incohérence en tête), PV de CT lu → `ct_defauts` reliés aux pannes par l'analyse, jamais d'estimation de valeur, constats uniquement sur le visible. Chaque constat passe par la critique (claims `PH*`, source `photo`) ; les écartés alimentent le bandeau de rigueur. UI : bloc « Ce que montrent les photos » après les incohérences (pastilles, photos jamais affichées ni stockées). Usage loggé par appel dans `score_done` (`calls.photos`).
- **Éval** : cas `photo-compteur` (3 photos générées, compteur 188 452 km vs 120 000 km annoncés ⇒ incohérence exigée) ; assertions `photos_bloc`, `incoherences_must_include` ; les photos d'un cas se placent dans `tests/eval/<cas>/photos/`.

## Corrections de fond (sprint 2 — oct. 2026)

- **Date du jour** : `<date_du_jour>` (Europe/Paris) injectée dans les 4 appels (identification, vision, analyse, critique). La critique supprime toute « incohérence de date » portant sur une date antérieure ou égale à aujourd'hui, et toute « incohérence » qui constate seulement qu'un élément est illisible.
- **Entretien** : `defect_sheets.plan_entretien` (intervalles SOURCÉS uniquement — constructeur ou presse auto reconnue ; sinon `a_verifier_carnet`, jamais de chiffre inventé ; `critique: true` quand l'opération est liée à une panne de la fiche). L'analyse rend `entretien.{signaux_positifs, contradictions, operations_non_faites}` ; le serveur en déduit les 3 listes affichées (« Doit déjà avoir été fait », « Prouvé ou annoncé », « À exiger avant d'acheter » avec coût sourcé). **L'absence d'information n'est JAMAIS pénalisée** : filtre serveur des formulations d'absence, claims `CT*`/`ONF*` audités par la critique, puis **recalcul de l'axe + du score + du verdict après la critique** (annonce muette ⇒ axe « non évalué », exclu du score ; signaux positifs sans contradiction ⇒ plancher 12/20).
- **Raisons** : interdiction des raisons génériques (valables pour toute annonce) côté prompt ET côté critique ; nouvelle ligne **Points rassurants** (≤ 3, claims `PR*` audités).
- **Fiches** : seuil qualité ≥ 4 sources dont ≥ 2 spécifiques au moteur (`nomme_moteur`), une source générique ne porte jamais une panne seule, gravité `securite` uniquement si une source la qualifie (`gravite_citee_par_source`). Mode `regenerer` de `sheet-builder` (hors cache/cooldown). ⚠️ limite API : ≤ 16 paramètres nullables par schéma d'outil → sentinelles (0 / "") dans FICHE_TOOL.
- **Checklist** : chaque point est un geste faisable sur place (verbe d'action) avec un signal rouge OBSERVABLE ; pour un véhicule de moins de 4 ans, le point « contrôle technique » devient « Documents du véhicule ».
- **Usage** : question facultative ville/mixte/route sur `/score` ; diesel + ville ⇒ geste valise FAP/EGR en tête de checklist.
- **Prix** : table `comparables_prix` alimentée par chaque analyse (données véhicule uniquement) ; fourchette affichée seulement à partir de **15 comparables** (même modèle/motorisation, ±2 ans, ±30 % km, < 3 mois) en **P25 / médiane / P75**, avec le libellé obligatoire « Prix demandés sur N annonces comparables relevées le JJ/MM — les prix de vente réels sont souvent inférieurs. » et la provenance ; sinon « non évalué ». Les comparables de l'extension (bouton « Ajouter ces annonces comme comparables » sur une page de résultats, permission `storage`, 24 h max) sont prioritaires.

### Corrections complémentaires (fin oct. 2026)

- **Code de boîte jamais deviné** : `boite_code` dans l'identification, renseigné uniquement s'il est déterminé par le couple, le nombre de rapports, la version et l'année (repères VAG vérifiés : DQ200 = 7 rapports secs ≤ 250 Nm ; DQ250 = 6 rapports humide ; DQ381 = 7 rapports humide ~420 Nm depuis 2017 sur MQB ; DQ500 ; DL501/DL382 longitudinales), sinon `""`. **Filtre serveur** : une panne qui nomme un code de boîte n'est retenue que si c'est celui du véhicule ; une panne de boîte à double embrayage sans code exige une boîte automatique identifiée (events `panne_boite_ecartee`). Exemple : l'A3 35 TDI 150 (340 Nm, S tronic 7) est une **DQ381**, jamais une DQ200.
- **Jamais zéro raison** : si la critique écarte toutes les raisons, le serveur rattrape celles qui citent un élément concret, sinon énonce le constat factuel qui explique ce vide. Invariante vérifiée par l'éval.
- **Filtres déterministes** : raisons génériques (« vendeur particulier : aucune garantie… ») écartées pour les statuts particulier/pro tant qu'il reste une raison ; « incohérence » qui ne fait que constater une donnée manquante écartée (ce n'est pas une contradiction).
- **Budget d'attente de fiche adaptatif** : 50 s seulement si l'atlas ne couvre pas la marque, 20 s sinon, 8 s avec photos — la fiche arrive ensuite en arrière-plan et `/a/:id` l'injecte sans rechargement (analyse avec photos : 160 s → 42 s).
- **Panne d'API** : `score` distingue l'indisponibilité du fournisseur (crédit, surcharge, timeout → HTTP 503 `service_unavailable`) d'une vraie erreur. `/score` propose alors « Service momentanément indisponible, laissez votre email… », la demande est enregistrée (`pending_analyses` + RPC `submit_pending_analysis`, 5/ip/24 h), une alerte part vers contact@inspexo.io (Resend, **une par heure maximum**), et la file est rejouée par `retry-pending` dès qu'une analyse réussit (signal de retour du service), avec envoi du verdict par email. `sheet-builder --mode regenerer` ne supprime plus la fiche existante avant d'avoir généré la nouvelle.

### Stabilité du verdict (fin oct. 2026)

- **Score déterministe** : le modèle EXTRAIT les faits, il ne note plus. Les 5 axes sont calculés par `_shared/bareme.ts` (fonction pure) à partir des faits retenus APRÈS l'audit de la critique : statut vendeur, km/an et kilométrage absolu, signaux d'entretien prouvés, opérations critiques déclarées non faites, pannes et gravités, rappels non confirmés, incohérences, position du prix dans la fourchette. **Plafonds de sûreté** : une panne de sécurité plafonne à 58, une opération critique non faite à 55, un rappel non confirmé à 48, deux pannes critiques distinctes à 39 (une même panne « sécurité + rappel » ne compte qu'une fois). Seuils de couleur fixes (≥70 vert, 40-69 orange, <40 rouge) ; le verdict du modèle n'est plus consulté. Test hors ligne : `node tests/bareme.test.mjs` (calibration + 50 appels identiques), exécuté en tête de `npm run eval`.
- **Cache 7 jours** : empreinte `input_hash` = SHA-256(texte normalisé + URL). Même annonce → même analyse renvoyée (`cache: true`, event `score_cache_hit`). Annonce modifiée à la même URL → nouvelle analyse + `analyse_precedente` {score, verdict, date, changements} → bandeau « Annonce modifiée depuis la dernière analyse ». `no_cache: true` réservé à l'éval.
- **GRAVITÉ = LE REMÈDE, PAS LA CONSÉQUENCE (règle générale, arbitrage du 28/10/2026)** : la gravité d'un défaut se juge sur **le remède du défaut tel qu'il se présente**, jamais sur ce qui arriverait si on l'ignorait. Exemple de référence : la courroie de distribution humide du 1.2 PureTech (EB2) se soigne par un remplacement de courroie (400-750 €) → **`majeure`**, dans la fiche comme dans l'atlas, avec la mention « si elle n'est pas remplacée à l'échéance : risque de casse moteur » dans les symptômes. `securite` reste réservé à un **danger direct pour les occupants explicitement sourcé** (freins, direction, incendie, airbag) — une casse moteur probable est une affaire de coût, pas de sécurité : elle immobilise le véhicule, elle ne blesse pas les occupants. Appliqué dans `_shared/defectSheets.ts` (prompt de génération + champ `gravite_citee_par_source`) et aux 4 fiches EB2 existantes (sauvegarde `~/inspexo-backups/fiches-eb2-avant-arbitrage-*.json`).
- **Gravité par CONSÉQUENCE** (4 niveaux) : `securite` = danger pour les occupants, uniquement si une source le dit ; `casse` = remplacement moteur/boîte, ou réparation sourcée > 3 000 € ou > 30 % du prix demandé ; `majeure` = 500 à 3 000 € ; `mineure` = moins de 500 € ou désagrément. Le reclassement est fait côté serveur à partir du coût sourcé ; **sans coût publié, la gravité de la source est conservée et jamais promue en « casse »**.
- **Rouge réservé aux faits graves** : danger sécurité, risque de casse, rappel « stop drive » non traité, cadre juridique gravement compromis (pro déguisé, ou intermédiaire excluant la garantie légale) ou signes de fraude (compteur contredit, double prix). Sinon le score ne peut pas descendre sous 40 : **une panne seulement « majeure » plafonne en orange**. Une couverture de garantie n'étant acquise qu'une fois les justificatifs fournis, elle n'allège jamais le verdict affiché — seulement le conditionnel.
- **Codes de boîte jamais devinés** : le filtre couvre tous les codes (DQ/DL, BVM/BVA, MS6/MA6, EAT, HP…) — une panne qui nomme un code n'est retenue que si c'est celui du véhicule, et aucune si la boîte n'est pas identifiée. (Cas réel : l'annonce 308 ne dit que « Boîte : Manuelle », donc la panne « synchros de 2e BVM6 » n'est ni affichée ni comptée.)
- **Fiches fusionnées par alias de marque** : « Mercedes » et « Mercedes-Benz » créaient deux fiches OM654 au contenu différent, et le lookup en choisissait une arbitrairement. Il accepte désormais toutes les écritures connues de la marque (`expandBrand`) et **fusionne** les pannes des fiches compatibles (dédup par mots-clés, la version la plus renseignée gagne, les champs manquants sont complétés par l'autre). Sans cela, une analyse perdait le seuil kilométrique ou le coût présent dans l'autre fiche.
- **Usure encore lointaine** (règle remplacée au Sprint 3 par l'« horizon de détention ») : une panne d'usure compte dans la note si son kilométrage typique tombe avant **km actuel + 60 000 km** ; au-delà elle reste **affichée** avec la mention « au-delà d'une détention moyenne » et **ne pèse pas sur la note** — un danger pour les occupants ou un rappel applicable pèsent toujours, eux. Helpers purs `seuilKmPanne`/`panneDansHorizon` dans `_shared/bareme.ts`, testés hors ligne (40 000 km avec usure à 100 000 → compte ; 36 606 km avec usure à 160 000 → ne compte pas).
- **Déduplication des pannes** : l'atlas et la fiche décrivent parfois le même défaut avec d'autres mots ; deux pannes partageant au moins deux mots significatifs sont fusionnées (la plus grave gagne, le rappel officiel est conservé), ce qui évite de compter deux fois la même courroie.
- **Axe risques = pannes affichées** : la note porte sur EXACTEMENT la liste montrée à l'acheteur, selon la **gravité maximale** et jamais le nombre — un moteur mieux documenté n'est pas pénalisé pour cette raison (vérifié par test : 1 panne majeure = 5 pannes de même gravité max).
- **Atténuation par garantie** : une panne couverte par une garantie constructeur en cours ou un programme d'extension dont le véhicule respecte les seuils est rétrogradée d'un cran dans un calcul parallèle ; si le score y gagne, `/a/:id` affiche sous le verdict « Verdict si <condition> : <couleur> <score>/100 ». Le conditionnel ne s'affiche que s'il change réellement quelque chose (une autre panne non couverte de même gravité l'annule, à juste titre).
- **Raison du plafond** : quand le score est plafonné, la cause est affichée en une ligne sous le verdict (« Vert impossible sans preuve d'entretien : demandez le carnet et les factures. »).
- **Éval de stabilité** : chaque cas analysable est rejoué 3 fois sans cache ; échec si l'écart de score dépasse 5 points ou si la couleur change. `npm run eval -- --sans-stabilite` pour sauter cette phase.
- **Modèle de secours** : `claude-sonnet-4-6`. Bascule si le principal est indisponible ou dépasse 45 s sur un appel ; modèles réellement utilisés loggés dans `score_done.modeles`. `npm run eval -- --modele-secours` valide un run complet sur le secours. ⚠️ `claude-sonnet-5-5` est plus récent mais **inutilisable ici** : il refuse le `tool_choice` forcé (« type "tool" and "any" are not supported for this model ») sur lequel repose tout le pipeline, et exige `thinking: between_tools` au lieu de `disabled` (le code gère déjà ce second point par modèle). Le secours est plus lent (60-110 s contre 35-50 s) : les images base64 sont libérées dès l'appel vision terminé pour tenir dans les ressources de l'edge function.
- **Codes de rappel** : un code de campagne n'est conservé que s'il figure LITTÉRALEMENT dans une des pages citées (vérification par récupération du texte à la génération, event `rappel_code_retire`) ; sinon le rappel est affiché sans code. La critique supprime tout code absent du catalogue. La fiche porte aussi la **plage de production** de la campagne : un véhicule hors plage voit la mention « hors de la plage de production visée, à faire confirmer par le VIN » et le rappel ne pèse plus sur la note. (Cas réel : KGH, campagne Peugeot du 8/12/2022, ne couvre que les productions d'avril 2017 à l'automne 2018 — elle ne s'applique pas à une 308 de 2020.)

## Sprint 3 — Rendre Inspexo irrésistible (oct. 2026)

### Négociation chiffrée
- Table `repair_costs` : opération × famille (moteur OU boîte ; `''` = générique), fourchette €, `url_source`, `extrait_source`, date, statut `source|valide_devis` (+ `devis_path` bucket privé `devis`). Alimentée par : backfill des fiches existantes (migration), **harvest automatique** à chaque fiche générée (`defectSheets.ts`), seed de 11 fourchettes génériques publiées VÉRIFIÉES (Vroomly/iDGarages, extrait cité), et l'admin (onglet « Coûts réparation » : création manuelle avec source OU devis, passage en « validé par devis » avec photo du devis OBLIGATOIRE).
- Module PUR `_shared/negociation.ts` (testé hors ligne `tests/negociation.test.mjs`, inclus dans `npm run eval`). Postes : défauts constatés (constats photo attention/rouge sauf compteur, défaillances du PV de CT, **défauts admis par l'annonce** — nouveau champ `defauts_annonce` extrait par l'analyse, claims DA* audités par la critique), entretien dû non prouvé, **opérations déclarées non faites** (« distribution jamais faite »), échéances du plan < 12 mois / 15 000 km. Un poste n'entre dans le TOTAL que si son coût est sourcé (priorité : devis validé > fourchette publiée > coût de fiche) ; **déduplication inter-canaux** (≥ 2 mots significatifs communs = même fait, jamais compté deux fois) ; total en fourchette UNIQUEMENT à partir de 2 postes chiffrés ; mention obligatoire « Coûts indicatifs à faire chiffrer par un garage… ».
- UI `/a/:id` : gratuit = fourchette + 2 postes principaux ; le reste (autres postes, arguments sans montant, sources, argumentaire prêt à dire) est FLOUTÉ avec capteur « Être prévenu » (pass_waitlist) tant que la précommande du Pass n'est pas en ligne.

### Verdict progressif
- `/score` envoie `progressive: true` → `score` répond **dès l'identification** (~4-7 s, ligne `analyses` partielle `result_json.statut_analyse='en_cours'` + placeholders verdict orange/score 0 en colonnes), la suite tourne en arrière-plan (`EdgeRuntime.waitUntil`) avec étapes `photos_fiche → analyse → verification → final` (ou `erreur`). Le score n'est publié qu'après la critique. L'éval, intake et les anciens clients restent SYNCHRONES (progressive jamais envoyé) ; le header d'éval peut tester le progressif sans quota.
- `/a/:id` polle la RPC légère `get_analysis_etape` toutes les 2 s, affiche l'indicateur d'étapes (rappels/Takata/cadre juridique déjà exploitables), recharge le résultat complet quand `pret`. Le cache 7 j ignore les lignes en cours (> 10 min) et en erreur ; une ligne en cours fraîche est resservie telle quelle (`partial: true`).
- Latences loggées : event `score_partial` {time_to_first_content_ms} + `score_done` {time_to_first_content_ms, time_to_final_ms, progressive}. Mesuré en prod : **4,4-6,4 s** premier contenu, 48-63 s final.

### Mode visite (réservé Pass, démo libre)
- `/a/:id/visite` : plein écran mobile, un point de checklist par écran (oui/non/doute), photo facultative (bouton surligné sur compteur/pneus/CT/carnet + 2 étapes photo synthétiques si absentes de la checklist). Photos JAMAIS stockées.
- Fonction edge `visite` : vision partagée `_shared/photo.ts` (PHOTO_TOOL/PHOTO_SYSTEM/validerConstatsPhoto, utilisée aussi par `score`), rate limit 15 photos/ip/24 h et 12/analyse (anti-TOCTOU : tentative insérée avant comptage, events `visite_photo`). Les constats validés (flag `visite: true`) sont réinjectés : **recalcul du barème** via `result_json.recalcul` (faits + ct_defauts + entretien_du_non_prouve + operations_non_faites + plan_entretien, AUCUNE donnée personnelle) et recalcul de la marge. Fin de visite : synthèse déterministe `acheter|negocier|ne_pas_acheter` (rouge/« non » critique/fraude → ne pas acheter ; orange ou non/doute → négocier) + points qui ont fait basculer ; sous 70 % de points renseignés : « Visite incomplète », points critiques non vérifiés listés, « acheter » impossible, décision « sur les points vérifiés ».
- **DEUX RÉGIMES (audit sécurité — NE JAMAIS REVENIR EN ARRIÈRE)** : une analyse est publique et partageable, donc un appelant ANONYME est en régime **éphémère** — verdict recalculé et synthèse RENVOYÉS dans la réponse, JAMAIS écrits dans l'analyse (le client renvoie `constats_precedents` à chaque appel pour cumuler sa session). La **persistance** exige un utilisateur connecté qui suit l'analyse dans son dossier ; `verdict_initial` est alors figé à la première mutation et affiché sur /a/:id. Les réponses de synthèse (`quoi`) sont validées contre la checklist de L'ANALYSE (+ 2 titres d'étapes photo, constantes partagées avec VisitePage) : jamais de texte libre stockable.
- **Compteur contredit** (photo vs annonce > 2 %) = preuve matérielle de fraude : plafond barème **35 (rouge)**, jamais levé par une garantie (`FaitsAxes.compteur_contredit`). Vérifié : Golf vert 73 → photo compteur → rouge 35, synthèse « ne pas acheter ».

### Dossier d'achat (compte léger)
- `/dossier` : connexion par LIEN MAGIQUE (`signInWithOtp`), aucune policy anon — RPC SECURITY DEFINER réservées à `authenticated` : `dossier_add/list/set_statut/set_alertes/remove`, `submit_outcome`. Statuts `a_voir|visite|achete|abandonne`. Bouton « Suivre dans mon dossier » sur `/a/:id` (retour magic link `?dossier=1` = ajout auto).
- Alertes (désinscription dans CHAQUE email, lien /dossier + STOP) : (1) **nouveau rappel** sur un modèle suivi — cron Vercel quotidien 07:00 UTC (`vercel.json crons` → `api/alertes.js` protégé par `CRON_SECRET` → fonction `alertes` protégée par `CRON_PROXY_SECRET`, les deux posés sur Vercel prod + supabase secrets + .env.local) ; premier passage = référencement silencieux (`dossier.rappels_vus`), seule une AUGMENTATION alerte ; (2) **annonce modifiée** (même source_url, autre contenu) — `alerteAnnonceModifiee` dans `score`, 1/utilisateur/annonce/24 h ; (3) **J+30 après « acheté »** — email retour d'issue → formulaire dans /dossier → table `outcomes` (prix payé, pannes confirmées).

### Justesse prouvée
- `/admin/audit` (page dédiée, lien magique admin) + fonction `admin-audit` : analyse tirée AU HASARD (non auditée en priorité), chaque affirmation marquée juste/faux/discutable par type (`panne|rappel|incoherence|juridique|photo|prix|cout|raison|entretien|checklist`) → table `audits`.
- `/fiabilite` (public) : RPC `get_fiabilite` — RIEN n'est publié avant **50 analyses auditées** (en dessous : avancée n/50 uniquement) ; au-delà : analyses auditées, affirmations relues, taux d'erreur global et par type, mise à jour automatique.

### Divers Sprint 3
- Routes ajoutées : `/a/:id/visite`, `/dossier`, `/fiabilite`, `/admin/audit` ; onglet admin « Coûts réparation ».
- `npm run eval` exécute désormais aussi `tests/negociation.test.mjs` (hors ligne).
- Captures du rapport : `captures-sprint3/` (gitignoré).
- **analyses.is_eval** : TOUTE analyse créée par l'éval ou un test (header x-eval-secret) est flaguée et EXCLUE des comparables de prix, de l'audit /admin/audit, de get_fiabilite et des alertes dossier. Backfill fait le 27/10 (491 analyses de test, 13 réelles).
- **Durcissements d'audit (ne pas défaire)** : empreinte du cache = texte + URL + **nb photos + nb comparables + usage** ; l'auto-ajout au dossier (`?dossier=1`) exige une intention locale posée < 15 min avant le lien magique ; l'alerte « annonce modifiée » n'est déclenchée que par le canal extension (isInternal) avec concordance marque/modèle ; `dossier_add`/`submit_outcome` n'insèrent un event que sur création réelle (ip_hash + user_id) ; les fourchettes `repair_costs` issues des fiches sont VÉRIFIÉES littéralement sur la page citée avant insertion (`montantPresent`), sinon écartées ; un rappel dont la plage de production exclut le véhicule (borne stricte côté début : immatriculation < début de production) est retiré de la note, des raisons et de la synthèse.
- Zéro emoji sur le site : icônes SVG sobres dans `src/components/Icones.jsx`.

## Sprint 3.1 — Durcissement avant presse (oct. 2026)

- **Anti-abus Turnstile** (câblé, DORMANT sans clés — activation : `scripts/activer-turnstile.mjs` après création du widget Cloudflare) : widget `src/components/Turnstile.jsx` (ne rend rien sans `REACT_APP_TURNSTILE_SITE_KEY`), gate serveur dans `score` au-delà de **2 analyses/24 h/IP** (erreur `captcha_required`, l'UI affiche le widget et relance ; extension/intake exemptée, plafond 5 inchangé), captcha GoTrue sur le lien magique (`options.captchaToken` passé par tous les formulaires). `emailRedirectTo` FIXÉ à `https://www.inspexo.io` (jamais `window.location.origin`) ; allow-list sans wildcard : www/apex/localhost uniquement.
- **Désinscription en un clic** : liens SIGNÉS HMAC (`UNSUB_SECRET`, secret supabase + .env.local) vers la fonction `desinscription` (déployée `--no-verify-jwt` : le lien email est l'auth) — GET = page de confirmation (jamais d'effet de bord sur GET, les scanners préchargent), POST = RFC 8058 one-click → `dossier.alertes=false` pour tout l'utilisateur. En-têtes `List-Unsubscribe` + `List-Unsubscribe-Post` sur les 3 emails d'alerte ; `envoyerVerdict` porte un `List-Unsubscribe` mailto.
- **Texte vendeur jamais recopié tel quel** : `nettoyerCitationVendeur` (export de `_shared/negociation.ts`, testé hors ligne) — sans lien/email, sans suite de ≥ 9 chiffres (téléphones, SIRET — km et prix conservés), ≤ 15 mots + ellipse ; appliqué aux `defauts_annonce` (affichés « entre guillemets ») et aux `operations_non_faites` ; le prompt exige une reformulation neutre.
- **Admin par rôle en base** : table `admins` (seed contact@inspexo.io) + helper `_shared/adminAuth.ts` (`verifierAdmin`) utilisé par les 5 fonctions admin-* — plus AUCUN `ADMIN_EMAILS` côté serveur. Policies storage du bucket `devis` VERSIONNÉES en migration (lecture réservée aux admins, écriture service role uniquement).
- `submit_outcome` exige le statut **« acheté »** du dossier ; plafond de 60 events `score_cache_hit`/IP/24 h.
- **Backlog sécurité** : `docs/backlog-securite.md` (mineurs restants classés + actions à clés : Turnstile, SMTP Resend).

## Sprint 5 — Nouvelle direction artistique (oct. 2026)

- **Référence absolue : `docs/design/maquette-v1.html`** (commitée). Reproduire, ne pas interpréter. Style « document administratif » : papier (#F3F0E9), filets fins, coins droits (0-2 px), aucune ombre, aucun fond pastel, aucun dégradé, zéro emoji ; les couleurs de verdict s'écrivent en TEXTE/FILET/TAMPON, jamais en fond ; **orange = une seule action par écran**.
- **Tokens** : `src/styles/tokens.css` (copie du :root de la maquette, clair + sombre via prefers-color-scheme et [data-theme]) ; classes portées dans `src/styles/base.css`. Polices **Schibsted Grotesk + Martian Mono** (preconnect + display=swap, chargement non bloquant media=print/onload) — Syne et Plus Jakarta Sans SUPPRIMÉES partout (les composants landing legacy ont été supprimés du repo).
- **Composants de brique** (un fichier chacun) : `Seal` (cachet IX — SEUL endroit à changer pour le futur logo), `Stamp` (tampon 3 couleurs : FEU VERT / PRUDENCE / SIGNAUX ROUGES), `Rows`, `Doc` (+ `formatRef`/`formatDateDossier`), `Leaders` (pointillés, « non évalué »), `Footnotes` (+ `Ref`, `creerRegistreSources`), `PhotoSlot` (hachuré tant que le fichier n'existe pas dans `public/photos/` : carnet.jpg, compteur.jpg, controle-technique.jpg), `AnalyseForm` (LE formulaire de /score, partagé avec le hero de l'accueil), `EmailCapture`, `DossierApercu` (vraie analyse S7 lue en base, id épinglé, p_track=false).
- **Numéro de dossier** : colonne `analyses.ref_num` (séquence + backfill, migration 20261028170000) exposée par `get_public_analysis` ; affiché « Dossier n° IX-AAAA-NNNNN » (année de création + ref_num sur 5 chiffres, composé côté client).
- **/a/:id = un dossier** : en-tête n° + date/heure, fiche véhicule en grille, tampon, critères à pointillés dépliables (commentaire d'axe), motifs numérotés avec appels de notes [n] (rattachement par mots significatifs aux sources des pannes — pas de recouvrement = pas d'appel), contrôles officiels, entretien, message vendeur, checklist, pannes, négociation (détail flouté Pass inchangé), photos, **sources numérotées en fin de dossier** (registre construit au rendu, dédup par URL), ligne « N affirmations écartées » en pied. Aucune logique touchée.
- **Qualité vérifiée** : contrastes AA calculés sur toutes les paires de tokens (2 thèmes), Lighthouse mobile accueil et /a/:id = **perf 100 / a11y 100** (maximum-scale retiré, champs 16 px contre le zoom iOS), zéro scroll horizontal à 390 px (13 pages × 2 thèmes), prefers-reduced-motion global, cibles ≥ 44 px, éval S7/308/Mercedes PASS avec verdicts identiques (rouge 38 / orange 55 / vert 71).
- **Cache RappelConso durci (28/10)** : module PUR `_shared/rappelsCache.ts` — une réponse **vide ou en erreur n'est JAMAIS mise en cache** (le TTL 24 h ne porte que sur un résultat non vide) ; zéro enregistrement pour TOUTE la marque ⇒ **second essai**, puis état `indisponible` (une marque référencée a toujours des fiches : un zéro global = panne amont, pas « aucun rappel ») ; une entrée vide héritée n'est jamais servie ; l'UI affiche alors « Vérification RappelConso indisponible, réessayez plus tard » (jamais « aucun rappel ») et le bloc Takata reste rendu ; event `rappels_indisponible` avec la raison. Tests : `tests/rappels-cache.test.mjs` (23 cas hors ligne, chaîné dans `npm run eval`) + cas d'éval `rappels-vide-non-cache` (3 chemins contre la fonction déployée, 0 €, signal observable = drapeau `cache`).
- **Double prix** : le prompt exige désormais le prix d'en-tête ET le **montant total réellement dû** (frais obligatoires inclus) — reprendre le total quand l'annonce le donne (« soit un montant total de… »), sinon additionner.
- **Filet déterministe sur l'entretien déclaré (28/10)** : `_shared/entretienDeclare.ts` relit le texte de l'annonce avec des motifs FIXES (distribution / courroie / embrayage / vidange / vidange de boîte / pneus / freins / CT / amortisseurs, fautes courantes comprises) et produit des faits `{operation, statut: non_fait|a_prevoir|fait, extrait ≤ 15 mots, critique}`. Injection **APRÈS l'audit de la critique** : ni le modèle (qui peut omettre) ni la critique (qui pourrait supprimer) ne peuvent faire disparaître ce que le vendeur écrit noir sur blanc. Les faits négatifs entrent dans `operations_non_faites` ET en tête de « Doit déjà avoir été fait » (avec l'extrait cité affiché) ; les faits positifs datés entrent dans les signaux d'entretien et les points rassurants. Le comptage des opérations critiques non faites est un **plancher** : `max(modèle, filet)`. Garde-fous : négation amont (« pas de distribution à prévoir »), faux sujet (« jamais eu de problème de distribution »), « distribution faite » reste un positif. Tests : `tests/entretien-declare.test.mjs` (33 cas dont les 5 pièges), event `entretien_declare_detecte`.
- **Un défaut, une seule entrée** : `_shared/dedupPannes.ts` fusionne les doublons du catalogue **en amont**, avant de le présenter au modèle (l'atlas et la fiche décrivaient le même défaut avec deux gravités : le verdict de la 308 valait 48 ou 55 selon celle que le modèle citait). Règle : même défaut = ≥ 2 mots **spécifiques** communs — les mots génériques (`fuite`, `huile`, `défaillance`, `durite`…) ne prouvent rien, sans quoi « fuite de carburant » et « fuite de liquide de refroidissement » fusionnaient à tort sur l'EA824. La plus grave gagne et hérite des champs les plus précis (coût, seuil km, rappel, sources). Tests : `tests/dedup-pannes.test.mjs`, event `catalogue_dedupliquee`.
- **Stabilité mesurée après ces deux filets** (5 passages sans cache sur la vraie 308) : orange **48/48/48/48/45**, écart max **3 points**, conditionnel jamais vert, distribution retenue **5/5**. ⚠️ Le score de référence de ce cas passe de 55 à ~48 : la dédup amont fait gagner la gravité `securite` de la fiche sur le `majeure` de l'atlas pour la courroie en bain d'huile — c'est la règle « la plus grave gagne », appliquée désormais dès le catalogue.

## Sprint 6 — Couverture moteur et pages publiques (oct. 2026)

### Couverture
- `src/data/famillesMoteur.js` : **48 familles** sur 14 marques, chacune avec l'URL qui atteste SON code (`source_code`) et le classement justifié par `SOURCES_PARC`. Un bloc LACUNES documente ce qui est volontairement absent (DV4, codes internes Opel/Fiat, codes de boîte) — on ne déclare pas une famille dont le code n'est pas attesté.
- `scripts/couverture-moteurs.mjs` lance la génération (`--etat`, `--famille`, `--plafond`, `--regenerer`, `--reset-cout`), compte le coût dans `.couverture-cout.json` et **s'arrête au plafond**.
- **Gravité jugée sur le REMÈDE** (`_shared/graviteRemede.ts`, testé hors ligne) : une panne dont le remède est un ORGANE (chaîne, courroie, tendeur, crépine, turbo…) ne peut pas être « casse » sans coût sourcé > 3 000 € ; le remède qui EST le moteur ou la boîte (segmentation, pistons, vilebrequin, réfection) la justifie. Le garde-fou ne PROMEUT jamais une gravité, et `gravite_arbitree: true` protège un arbitrage humain (turbos EA824). Migration `20261029180000` pour les fiches déjà en base.

### Pages publiques SEO
- `/moteur/<slug>` (42 publiées), `/moteur` (index), `/airbags-takata` (liste officielle par marque + champ « mon modèle est-il concerné ? », date de liste et lien ministère). Seuil de publication : **≥ 3 pannes toutes sourcées** (RPC `get_moteur_public`, `list_moteurs_publies`) — pas de page sans preuves.
- **Pré-rendu statique** (`scripts/prerendu.mjs`, lancé par `postbuild`) : Playwright visite chaque route publique et écrit `build/<route>/index.html` ; 52 pages + l'accueil au sitemap (53 URL), robots.txt dressé à partir des pages RÉELLEMENT produites. `vercel.json` porte `buildCommand: npx playwright install chromium && npm run build` — le conteneur de build de Vercel n'a pas de navigateur.
- ⚠️ **`build/index.html` n'est JAMAIS écrit par le pré-rendu** : il reste la sortie CRA intacte et sert de repli universel. C'est ce qui rend le dispositif sans danger — une route non pré-rendue est simplement rendue par React, jamais une 404. Corollaire assumé : **l'accueil n'est pas pré-rendu** (mesuré, il y perdait : FCP 3,2 s contre 1,4 s, pour un contenu que Google rend déjà).
- **Le pré-rendu ne se tait jamais** : playwright absent, navigateur qui ne démarre pas, une route en échec ou moins de 10 pages produites ⇒ **code de sortie 1, build en échec**. Un déploiement qui s'arrête se voit ; une page vide servie à Google se découvre des semaines plus tard. `scripts/verifier-prerendu.mjs <url>` contrôle un déploiement **sans exécuter de JavaScript** (éprouvé dans les deux sens : une coquille vide fait 117 caractères). Chaîne et replis : `docs/prerendu.md`.
- ⚠️ **Mesuré le 29/10, contre-intuitif** : Vercel n'applique PAS les parenthèses de négation d'un `rewrites.source` au-delà de la première — deux formulations essayées en préversion, `/photos/absent.jpg` renvoie dans les deux cas la coquille en 200. Un fichier absent reçoit donc 6 Ko de HTML au lieu d'un 404. Sans conséquence depuis que `PhotoSlot` ne demande plus un fichier absent, mais **ne pas réécrire ce motif en croyant que ça marche** : il faudrait passer à la syntaxe `routes` historique, ce qui n'en vaut pas le risque. `(?!api/)` est conservé tel quel (les fonctions sont de toute façon résolues avant les réécritures).
- ⚠️ Les identifiants moteur portent la **puissance** : `/moteur/peugeot-1-2-puretech-130`, pas `/moteur/peugeot-1-2-puretech` (qui renvoie à l'index).

### Performance (Lighthouse mobile ≥ 96 partout)
- **Pas d'hydratation possible** : le HTML pré-rendu est la sérialisation d'un DOM rendu côté client, sans les marqueurs du rendu serveur — `hydrateRoot` échoue sur TOUTES les pages (erreurs React #418/#425, vérifié). On garde `createRoot` ; le pré-rendu sert ce pour quoi il est fait, donner un contenu lisible sans JavaScript.
- **Découpage par route** (`React.lazy`) : fragment principal 189 → 67 Ko compressés. Le pré-rendu injecte un `<link rel="preload" as="script">` vers les fragments que la route charge vraiment, pour ne pas ajouter d'aller-retour.
- **Police variable** : `schibsted-grotesk-var-*.woff2` (graisses 400–900 en un fichier) remplace 4 statiques de 46,8 Ko — **rendu identique au pixel près** (vérifié, écart max 0 sur 400/500/700/800). Polices livrées : 308 → 192 Ko.
- **Données figées dans le HTML** (`src/lib/prerendu.js`) là où elles SONT le contenu (fiches moteur, index) : premier rendu sans requête en base. Pas sur l'accueil (18,6 Ko de HTML pour aucun gain : le dossier d'exemple est sous la ligne de flottaison). Sur `/moteur`, c'est ce qui ramène le décalage de mise en page de **0,509 à 0**.
- `scripts/photos-disponibles.mjs` (script `prebuild`) dresse la liste de `public/photos/` : un emplacement sans fichier reste hachuré sans jamais lancer de requête.
- Mesures finales (mobile) : accueil 97, fiches moteur 97, `/airbags-takata` 97, `/moteur` 97, `/score` 97, `/pass` 96, `/fiabilite` 96, pages légales 98-99 — **a11y 100 partout**, SEO 100.
- Reste connu : l'audit « tailles de police lisibles » signale l'échelle mono 11 px de la maquette sur `/fiabilite`. C'est la DA, elle n'est pas modifiée.

## Sprint 7 — Pass achat complet (oct.-nov. 2026)

### Paiement et accès
- **Stripe Checkout** (page hébergée, pas d'Elements ni de clé publishable côté front) : fonction `pass-checkout` (GET = config publique `{actif, mode, prix_cents, mediateur}` ; POST = session, rate limit 10/ip/24 h anti-TOCTOU). 29 € TTC / 30 jours / annonces illimitées ; `PASS_MODE=precommande` → 19 €. **La vente ne s'active que si `MEDIATEUR_NOM` (secret supabase) est renseigné** — sinon `/pass` reste en « bientôt » + capteur `pass_waitlist` (comportement d'avant, conservé dans `PassCheckout.jsx`).
- **Activation UNIQUEMENT par le webhook** `pass-webhook` (endpoint Stripe dédié, secret `PASS_WEBHOOK_SECRET`, `constructEventAsync` + SubtleCrypto, déployé **--no-verify-jwt**) : `checkout.session.completed` (metadata `produit=pass`, payé) → ligne `passes` idempotente (unique `stripe_session`), compte créé (`auth.admin.createUser`, email_confirm) ou rattaché par email, email Resend (`emailPassActif`). `charge.refunded` → statut `rembourse`.
- **Table `passes`** (migration `20261030120000`) : email, user_id nullable (rattachement paresseux par email — `get_mon_pass()` RPC authenticated ET `passAuth.ts` le font), stripe_session unique, mode, statut `actif|rembourse`, `retractation_renoncee`, `cgv_version`, debut/fin (l'expiration est portée par la date, pas par un cron). RLS sans policy : service role uniquement.
- **Déblocage CÔTÉ SERVEUR, jamais client** (`_shared/passAuth.ts`, JWT utilisateur transmis par `scoreApi.callFunction` quand connecté) :
  - `score` : pass actif → ni limite 5/24 h ni captcha (events `score_started/score_done` portent `pass: true`) ;
  - `visite` : **démo sans Pass = 2 photos analysées par analyse+IP** (erreur `pass_requis`), Pass = 12/analyse et 45/ip/24 h ; checklist et synthèse restent libres ;
  - **négociation détaillée** : `get_public_analysis` (et les réponses directes de `score`/`visite`/`lecture-ct`) **masque** sans Pass — `_negociation_publique` SQL = `negociationPublique` TS (fourchette + 2 postes ; `masque`, `nb_postes_masques`, `nb_arguments_masques` ; le flou de `/a/:id` couvre un GABARIT FACTICE, la vraie donnée ne part plus au navigateur, correction du floutage CSS du sprint 3) ;
  - kit signature : RPC `get_kit_signature` (authenticated + `_pass_actif`).
- **Admin** : fonction `admin-passes` (verifierAdmin) — liste, **remboursement Stripe intégral en un clic** (+ email `emailPassRembourse`, event `pass_rembourse`), export CSV composé côté front (onglet « Pass achat » d'/admin).
- **Scripts** : `scripts/configurer-stripe-pass.mjs` (clé `STRIPE_SECRET_KEY` test OU live depuis .env.local → crée/complète l'endpoint webhook, pose les secrets `STRIPE_SECRET_KEY/PASS_MODE/PASS_WEBHOOK_SECRET/MEDIATEUR_NOM` ; ⚠️ le secret de signature n'est fourni par Stripe QU'À LA CRÉATION de l'endpoint) ; `scripts/tester-pass-stripe.mjs` (e2e : session → Playwright paie 4242… → webhook → ligne `passes` vérifiée par SQL de l'API de gestion → nettoyage ; **REFUSE de tourner si la clé posée est live** — vérifié via `ops?stripe=1`, diagnostic lecture seule derrière x-eval-secret). Un paiement live est un acte d'Utku, jamais d'un script.
- CGV : page `/cgv-pass` (DUPLEX SAS, SIREN 941 962 060, prix, 30 jours, rétractation 14 j L221-18 + **case dédiée de renonciation** pour usage immédiat L221-25/28, garantie commerciale « remboursé sans condition 14 j », médiateur lu depuis la config serveur). Case d'acceptation des CGV OBLIGATOIRE avant paiement (vérifiée serveur : `accepte_cgv !== true` → 400).

### Lecture du PV de contrôle technique (Pass)
- Fonction `lecture-ct` : photos du PV (≤ 3, jamais stockées) → appel vision dédié (`CT_TOOL`/`CT_SYSTEM` dans `_shared/lectureCt.ts`, module PUR testé hors ligne `tests/lecture-ct.test.mjs`) : date, centre, km relevé, chaque défaillance `{code imprimé, libellé, catégorie mineure|majeure|critique TELLE QU'IMPRIMÉE, explication 1 phrase}`, contre-visite + date limite. **Sentinelles ("" / 0), jamais null** (limite 16 params API).
- **AUCUNE donnée personnelle** : nom/adresse/immatriculation/VIN interdits au prompt ET filtrés serveur (`PII_RE` → « [retiré] ») ; vérifié par l'éval (plaque/VIN/nom fictifs présents sur le PV synthétique, assertion d'absence).
- Liaison aux pannes de la fiche (organes canoniques / ≥ 2 mots significatifs — helpers exportés de `negociation.ts`) ; **chiffrage uniquement si coût sourcé** (`chercherCout` sur `repair_costs`) ; km du PV vs annonce : **annonce < PV (tolérance 1 %) = compteur contredit** (preuve documentaire officielle) → plafond rouge 35 + incohérence en tête ; recalcul barème + négociation comme le mode visite, MÊMES DEUX RÉGIMES (éphémère / persistant si dossier, verdict_initial figé). Rate limit 10 lectures/ip/24 h, 6/analyse. Accès : Pass actif ou x-eval-secret.
- UI : bloc « PV de contrôle technique » sur `/a/:id` (`LectureCtBloc.jsx`) — sans Pass : annonce de la fonction + lien /pass ; le résultat persité s'affiche depuis `result_json.lecture_ct`.
- **Éval `npm run eval:ct`** (tests/eval-ct/run.mjs) : cas `pv-synthetique` (PV généré par `generer-pv.mjs`, commité) — l'annonce passe par le cache 7 j de `score` (≈ 0,08 € au premier passage seulement), la lecture ≈ 0,01 € ; teste AUSSI le refus 403 `pass_requis` sans secret. **PV réels : déposer photos dans `tests/eval-ct/<cas>/photos/` (gitignoré — données personnelles) + expected.json.**

### VIN (étape 1 livrée, étape 2 À VALIDER)
- `src/lib/vin.js` (pur, local, `tests/vin.test.mjs`) : 17 caractères sans I/O/Q, WMI → constructeur/pays (liste curée marché FR, jamais deviné : WMI inconnu = « non reconnu »), région ISO 3780, années-modèle possibles (position 10, cycle 30 ans, ambiguïté assumée « 1996 ou 2026 »), clé de contrôle 49 CFR §565.15 (**obligatoire en Amérique du Nord seulement** — discordance = signal, pas invalidité, en Europe). Bloc `VinBloc.jsx` sur `/a/:id` : recoupement constructeur/année du VIN vs annonce.
- **Décodage détaillé (moteur exact)** : rapport comparatif `docs/vin-fournisseurs.md` (Vincario ≈ 0,49 €/VIN à tester en premier — seul self-service avec champ Engine Code ; DAT France pour les équipements d'origine ; CarsXE repli sans code moteur). **RIEN d'activé ni payé sans l'accord d'Utku.**

### Kit signature (Pass)
- Route `/a/:id/signature` (`KitSignaturePage.jsx`), données de pré-remplissage par RPC `get_kit_signature` (Pass vérifié serveur ; sans Pass : teaser + CTA). Checklist cochable des documents, **chaque obligation légale sourcée service-public.gouv.fr** (⚠️ service-public.fr redirige désormais vers .gouv.fr ; F1480 est devenu « hériter d'un véhicule » — la vente = **F1707**) : carte grise barrée « Vendu le … à … » signée (F1707), cerfa 15776*02 ×2 (R20300), certificat de situation administrative < 15 j (F1360/HistoVec R52957), CT < 6 mois si > 4 ans — contre-visite < 2 mois (F2878), code de cession ANTS (F1707), factures/clés (recommandé, annoncé comme tel). Contrat de cession pré-rempli imprimable (fenêtre print ; noms saisis JAMAIS transmis ; il COMPLÈTE le cerfa, ne le remplace pas ; garantie vices cachés mentionnée). Démarches : vendeur déclare sous 15 j (code de cession), acheteur carte grise sous 1 mois (F1050).

### Mise en service (ordre OBLIGATOIRE)
1. dump prod puis `db push` (migration sprint7) ; 2. déployer `pass-webhook` **--no-verify-jwt**, puis `pass-checkout`, `lecture-ct`, `admin-passes`, `ops`, `score`, `visite` ; 3. `node scripts/configurer-stripe-pass.mjs` avec sk_test + `node scripts/tester-pass-stripe.mjs` ; 4. éval ciblée S7/308/Mercedes + `npm run eval:ct` ; 5. pour VENDRE : médiateur désigné → relancer configurer-stripe-pass avec sk_live + MEDIATEUR_NOM, paiement réel remboursé via l'admin.

## Sprint 8 — Inspection à la demande (nov. 2026)

### Inventaire de l'ancien parcours experts (fait avant de construire)
- **En base, VIDE mais présent** : `experts` (0), `missions` (2 lignes de test), `expert_applications` (0), `profiles` (2), `reviews` (0), `messages` (0), `chat_files` (1), `price_data` (0). ⚠️ **Aucune migration ne crée ces tables** — elles datent du dashboard (sessions 1-3), et ce sont les **seules du projet avec des policies RLS anon/authenticated directes**. Laissées intactes : le sprint 8 construit à côté.
- **En code** : routes `/dashboard` et `/expert` toujours montées mais **sans aucun lien public** ; onglets admin Missions/Candidatures ; `CheckoutModal` et `FreeAnalysisModal` orphelins ; `ChatIA`, `CalBooking`, `MissionChat`, `ReviewModal`, `AuthModal` encore importés par les 2 dashboards. Cal.com = aucune intégration active (mentions résiduelles seulement).
- **Supprimé au sprint 5** : les 13 composants de la landing legacy (Hero, Services, Experts, BecomeExpert, ExpertModal, ExpertApplicationModal, FAQ, HowItWorks, StatsBar, StickyCTA, WhyInspexo, LeadEmailForm, FooterNotes) — tout le parcours de candidature expert public avait donc disparu, mais la table, les fonctions admin et l'espace `/expert` étaient restés.
- ⚠️ **TROUVAILLE DE SÉCURITÉ (corrigée, déployée)** : `create-connect-account` et `create-transfer` étaient déployées `verify_jwt:false` **sans aucune authentification dans le code** — confirmé en prod, la première répondait sans le moindre jeton. Un POST anonyme avec un `expert_id` rendait un **lien d'onboarding Stripe** (donc la possibilité d'y mettre son propre RIB) ; un POST avec un `mission_id` déclenchait un **virement réel**. Inexploitables table vide, elles le devenaient dès la création d'inspecteurs → **neutralisées en 410 avant toute autre chose**. ⚠️ **`ai-chat` et `upload-chat-file` sont dans le même état** (sans auth, `ai-chat` consomme du crédit Anthropic) : signalés, hors périmètre du sprint 8 — à traiter.

### Produit
- Bloc « Faire inspecter cette voiture » sur `/a/:id` : **179 € TTC**, créneau **sous 48 h**, zone **Toulouse et Haute-Garonne (dép. 31)** au lancement. Hors zone ou service fermé : **liste d'attente email** (`expert_waitlist`), jamais de commande.
- **VERROU D'OUVERTURE (serveur)** : le service n'est `ouvert` que si **MEDIATEUR_NOM** est posé ET **au moins un inspecteur `valide` avec `stripe_paiements_actifs`** couvre le département. Vérifié côté serveur à chaque appel — l'interface ne peut pas passer outre.
- Espace inspecteur `/inspecteur` : missions de ses départements, accepter/refuser, inspection guidée par la **checklist de l'analyse**, **photos CONSERVÉES** pour le rapport, rapport déposé dans le dossier de l'acheteur (`RapportInspection` sur `/a/:id`, URL signées 300 s).
- Onboarding `/inspecteur/inscription` en 4 étapes : SIRET, attestation RC pro (bucket privé), charte d'indépendance signée, Stripe Connect. Validation par l'admin (onglet « Inspecteurs »).

### Architecture
- **Tables** (migration `20261101120000`) : `inspecteurs`, `inspections`, `inspection_refus`, `inspection_photos` — RLS active, **zéro policy**, accès par RPC SECURITY DEFINER uniquement. Buckets privés `rapports` et `inspecteurs`.
- ⚠️ **EXCEPTION ASSUMÉE au principe « photos jamais stockées »** : les photos prises par l'INSPECTEUR pendant une inspection payée sont conservées — **elles SONT le rapport acheté**. Bucket privé, lisibles des seules parties (acheteur, inspecteur, admin), **consentement horodaté exigé côté serveur** avant tout dépôt (`inspection_consentement_photos`). Les photos de l'ACHETEUR (score, mode visite, PV de CT) restent, elles, jamais stockées.
- **Coordonnées du vendeur révélées APRÈS acceptation seulement** : `inspecteur_missions` les rend `null` tant que `inspecteur_id <> moi` (vérifié par test).
- **Acceptation atomique** : `inspection_accepter` filtre sur le statut dans l'UPDATE — deux acceptations simultanées, une seule passe, la seconde reçoit `deja_prise`.
- **Argent (charge et transfert séparés)** : `inspection-checkout` pose `transfer_group = inspection_<id>` sur la charge ; `inspection-rapport` crée le Transfer avec **le même transfer_group** + `source_transaction` = la charge (fonds disponibles immédiatement) + `idempotencyKey`. ⚠️ Le legacy posait **deux transfer_group différents** : charge et transfert n'étaient reliés par rien — ne pas reproduire. **Aucun point d'entrée client ne déplace d'argent** : le versement part du serveur à la remise du rapport.
- **Module pur** `_shared/inspection.ts` (+ copie client `src/data/charte.js`) : prix et parts en centimes (60 % = 107,40 €), SIRET Luhn **avec l'exception La Poste** (SIREN 356000000 : somme des 14 chiffres multiple de 5), zone, créneau [+2 h, +48 h], charte versionnée. `tests/inspection.test.mjs` (48 contrôles) : **invariant monétaire sur 50 000 montants** (les deux parts font toujours le total), et **charte identique client/serveur mot pour mot** — l'inspecteur signe le texte qu'il voit.
- Webhook **distinct** de celui du Pass (`INSPECTION_WEBHOOK_SECRET`, `inspection-webhook` en `--no-verify-jwt`) : un incident sur un produit ne coupe pas l'autre.

### Mise en service (ordre)
1. `node scripts/configurer-stripe-inspection.mjs` (crée l'endpoint webhook, pose le secret) ; 2. `node scripts/tester-inspection-stripe.mjs` **en clé sk_test** (parcours complet : commande → paiement → webhook → masquage des coordonnées → acceptation → rapport → versement → idempotence ; **refuse de tourner sur une clé live**) ; 3. recruter et valider un inspecteur (admin) ; 4. poser `MEDIATEUR_NOM` → le service s'ouvre de lui-même.

### Fermeture de l'ancien parcours experts (2 nov. 2026) — NE PAS ROUVRIR
- **Surfaces retirées (410), vérifiées en prod** : `send-email`, `ai-chat`, `upload-chat-file`, `create-checkout`, `stripe-webhook`, `admin-missions`, `admin-applications` — en plus de `create-connect-account` et `create-transfer` (sprint 8, veille). ⚠️ **`send-email` était un RELAIS DE MAIL OUVERT** : `{to, template, data}` → Resend, sans aucune authentification. `verify_jwt:true` ne protégeait rien, **l'anon key est publiée dans le bundle du site** — retenir cette leçon : *verify_jwt n'est pas un contrôle d'accès*, seul le code en est un.
- **`extraction` supprimée du déploiement** : elle tournait en prod alors que son code n'existe que sur la branche `sprint3` non mergée (donc non relisible depuis main) et consommait du crédit vision. La source reste intacte sur `sprint3` ; redéployer avec le sprint 3.2 le jour où il est mergé.
- **Front** : `/dashboard` et `/expert` démontés ; 9 fichiers supprimés (ClientDashboard, ExpertDashboard, CheckoutModal, FreeAnalysisModal, ChatIA, CalBooking, MissionChat, ReviewModal, AuthModal — cluster fermé, plus aucun import) ; onglets admin **Missions, Candidatures et Statistiques** retirés avec la modale Stripe Connect héritée (AdminDashboard : 1361 → 700 lignes). Reste : Pass achat, Inspecteurs, Coûts réparation, Audit justesse.
- **Base** (migration `20261102210000`) : les **19 policies** des 8 tables héritées supprimées — toutes étaient ouvertes au rôle `public`, donc à anon. Les deux pires : « Anyone can insert applications » (insertion publique sans contrôle) et « Anyone can view approved experts » (lecture publique de fiches avec email et téléphone). Tables **conservées, vides, sans aucun accès direct** ; dump hors dépôt `~/inspexo-backups/tables-heritees-*.sql`.
- **Résultat vérifié** : **ZÉRO policy sur l'ensemble des tables publiques du projet**. L'architecture est uniforme — RLS active partout, aucune policy, accès uniquement par RPC SECURITY DEFINER.
- ⚠️ **Le CLI Supabase a changé** (nov. 2026) : `db dump` et `db push` ciblent la base **locale** par défaut → `--linked` obligatoire ; et toute mutation en mode agent exige `--yes` (sinon `HostedMutationConsentRequiredError`).

### Audit adversarial du sprint 8 (2 nov. 2026) — corrigé, `docs/audit-securite-sprint8.md`
127 agents, 6 dimensions, 3 sceptiques par finding (survie = moins de 2 réfutations) : 40 findings bruts, 18 survivants, **rien de critique**, 6 majeurs — tous corrigés. Les leçons à retenir :
- ⚠️ **Une policy storage ne peut pas interroger une table « RLS active, zéro policy »** : elle sera TOUJOURS fausse. La policy `rapports lecture parties` rendait invisibles, à 100 % et en silence, les photos du rapport payé 179 €. Toute décision d'accès qui doit lire ces tables passe par une **fonction edge en service role** (`inspection-photo`), jamais par une policy. Corollaire : un `catch → return null` côté client transforme une panne en « il n'y avait pas de photos » — faire remonter l'erreur.
- ⚠️ **Un drapeau que seul un écran met à jour n'est jamais à jour** : `stripe_paiements_actifs` ne basculait que si l'inspecteur rouvrait l'écran d'inscription, et le `return_url` de Connect pointait ailleurs. Résultat : KYC terminé, drapeau faux, mission acceptée, déplacement fait, versement silencieusement sauté. Un état venu d'un tiers s'abonne (`account.updated`), il ne se devine pas — et un versement raté s'annonce (email exploitant + message à l'inspecteur), il ne se tait pas.
- ⚠️ **`charge.refunded` ne veut pas dire « remboursement total »** : tester `charge.refunded === true` ou `amount_refunded >= amount`. Un remboursement partiel basculait l'inspection en `annulee`, tuant une mission payée ou faisant disparaître de l'écran de l'acheteur le rapport qu'il avait acheté. Et un remboursement n'annule pas un transfert déjà parti : `transfers.createReversal` proportionnel, avec clé d'idempotence.
- **Ordre des opérations** : faire la transition d'état atomique **avant** de téléverser, sinon deux appels concurrents laissent des fichiers rattachés à une version jamais validée.
- **Version d'un texte signé** : constante **SQL** (`charte_version_courante()`), jamais un paramètre client — et une signature posée ne se réécrit pas, c'est une preuve.
- **Ce qui a tenu à l'audit** : double versement impossible (`!transfer_id` + `idempotencyKey` + CAS sur le statut), coordonnées du vendeur réellement masquées avant acceptation, acceptation atomique, les 3 RPC inspecteur vérifiant `statut = 'valide'`.

## Sprint 9 — Prix de marché (nov. 2026)

### ⚠️ L'écart fermé en ouvrant le sprint
La règle « agrégats uniquement » était écrite depuis le sprint 4B mais **n'avait jamais été appliquée** : la migration `20261028150000` est arrivée sur main par le merge sprint5-da (elle a créé `comparables_agregats`, fondu les lignes brutes et vidé `comparables_prix`), **mais le changement de code correspondant est resté sur la branche `sprint4b`, jamais mergée** (commit `0bdcea7`). Résultat : le code de `score` réinsérait des **lignes brutes d'annonces** dans `comparables_prix` — avec `analysis_id`, donc rattachables — et `comparables_agregats` était une table morte remplie une seule fois. ⚠️ **Portée réelle, mesurée sur le dump du 02/11 avant correction : `comparables_prix` contenait 0 ligne et `comparables_agregats` 1 ligne.** Le chemin de code était faux et aurait accumulé des lignes brutes dès que le trafic réel serait monté, mais **rien ne s'était accumulé en production** — ne pas raconter cet épisode comme une fuite de données, c'en était le risque, pas le fait. **Leçon : une migration mergée ne prouve pas que le code qui l'accompagne l'est.** Vérifier `git branch --contains <commit>` avant de tenir une règle pour acquise.

### Stockage — `marche_agregats` (migration `20261104120000`, additive)
- Nouvelle table (la clé primaire de `comparables_agregats` ne pouvait pas accueillir génération / boîte / région sans être refaite) : `(marque_norm, modele_norm, generation_norm, techno, cyl, boite, annee, km_tranche, region, mois, prix_tranche) → effectif`. RLS active, **zéro policy**, accès service role + RPC.
- `agreger_marche(jsonb)` (service role) : fusion par somme, **effectif plafonné à 25 par ligne**, lignes incomplètes ignorées en silence plutôt que lot rejeté. `get_prix_segments(jsonb)` (anon, pages /moteur) : rend l'**histogramme replié**, jamais les quantiles — ceux-ci sont calculés par le module partagé, pour qu'il n'existe **qu'une implémentation des quantiles dans le projet**.
- Fonte des données existantes (agrégats 4B + lignes brutes accumulées depuis le 28/10), puis `delete from comparables_prix` et **révocation de l'INSERT** sur les deux tables héritées : un retour en arrière échouerait bruyamment au lieu de rétablir en silence un stockage interdit.
- Granularité : le **mois** (jamais la date), la **région** (jamais la ville ni le code postal). Aucun titre, aucune URL, aucun lien vers une analyse.

### Module pur `_shared/marche.ts` (213 contrôles, `tests/marche.test.mjs`)
- **Canonisation, le point dur du sprint** : l'identification écrit « Clio IV », une page de résultats « Clio IV 1.5 dCi 90 Business », `famillesMoteur` « Clio III/IV ». Trois segments, aucun n'atteint 15, aucune fourchette ne sort. `marqueCanonique` (via `brandAliases`, « VW » → volkswagen) et `modeleCanonique` sont appliquées **à l'écriture ET à la lecture**. `modeleCanonique` retire les générations (romaines, arabes, phase, Mk, codes de caisse) puis **s'arrête au premier mot technique** (cylindrée, motorisation, carburant, boîte, désignation de puissance). Les vraies déclinaisons sont **conservées** : « Santa Fe », « C5 Aircross », « Discovery Sport », « 308 GT », « Sandero Stepway » forment leur propre segment — deux segments justes valent mieux qu'un segment qui publierait le prix d'une 308 de base sous l'étiquette d'une 308 GT.
- Fourchette ≥ **15 relevés**, fenêtre **3 mois**, fusion d'histogrammes par somme (découper les relevés en lots ne change rien au résultat — c'est toute la raison d'être des agrégats). La **région est une préférence, pas un filtre** : si le sous-ensemble régional atteint seul le seuil il est publié, sinon repli national. Filtrer d'office affamerait le segment.
- **Ajustement kilométrique MESURÉ** : pente lue sur les tranches de km réellement présentes (médiane par tranche, moindres carrés pondérés). Pas de pente mesurable — moins de 3 tranches peuplées, pente positive, pente invraisemblable — **pas d'ajustement**. Aucune décote « au barème », aucune extrapolation hors segment. La fourchette AFFICHÉE reste celle des prix observés (le libellé « prix demandés relevés le … » doit rester littéralement vrai) ; la correction ne déplace que la **référence** qui sert à la position et à la négociation.
- Région dérivée du **seul code postal** (101 départements → 18 régions). Un nom de ville ne donne jamais de région. Le code postal est extrait par l'identification (sentinelle `""` s'il n'est pas écrit) et **jamais enregistré** : il ne sert qu'en mémoire à déduire la région.

### Collecte — UNE COLLECTE = UN CLIC (décision d'Utku, ne pas défaire)
- Pas de relevé en tâche de fond. Sur une page de résultats, le bouton existant « Ajouter ces annonces comme comparables » sert l'analyse en cours (inchangé) **et**, si la case « Contribuer anonymement aux prix de marché » est cochée (**décochée par défaut**, choix mémorisé dans `chrome.storage.local`), alimente `marche_agregats`. La promesse « aucune collecte sans votre action » reste littéralement vraie et c'est ce que disent les deux pages de confidentialité (`extension/privacy.html` + `src/pages/ExtensionPrivacy.jsx`, à garder synchrones).
- Chaîne : content script → service worker → `https://www.inspexo.io/api/marche` (proxy Vercel, secret `MARCHE_PROXY_SECRET`, IP réelle transmise) → fonction `marche`. **Aucune requête de nos serveurs vers Leboncoin / La Centrale / AS24** : seul le DOM déjà chargé par l'utilisateur est lu.
- **Marque et modèle sont déduits du titre PAR LE SERVEUR** (`segmentDepuisTitreAnnonce`, null en cas de doute) : le client ne décide pas dans quel segment ses prix atterrissent.
- Plafonds par IP / 24 h : **20 lots et 600 annonces**, anti-TOCTOU (tentative insérée avant comptage). Extension en version **1.1.0**.

### Affichage
- `/a/:id`, bloc `#prix` : P25 / médiane / P75 observés, **position** (« dans le quart le moins cher » / « dans la moyenne » / « plus chère que 75 % des annonces comparables »), effectif, portée régionale, date, mention « prix demandés, pas prix de vente », ligne de correction kilométrique quand elle a été mesurée. Sous le seuil : « non évalué » inchangé.
- Barème : l'axe prix sort du « non évalué » dès qu'une fourchette existe ; paliers fixes appliqués aux bornes **corrigées du kilométrage** (`fourchette_decalage_km`), bornes **observées** affichées.
- Négociation : poste `prix_marche` = écart au P50 de référence quand l'annonce est au-dessus, `source_statut: 'marche'`. ⚠️ Il est porté par `result_json.recalcul.prix_marche` — sans quoi il **disparaîtrait de la marge dès la première photo de visite ou lecture de PV**, ces fonctions reconstruisant la négociation à partir du recalcul sans relire les agrégats.
- `/moteur/<slug>`, bloc `#prix` : fourchette par modèle au-delà du seuil, données figées dans le HTML pré-rendu.

### Deux copies, deux garde-fous (le périmètre de build de CRA interdit d'importer `supabase/functions`)
- `src/data/marche.js` : copie client de la lecture. `tests/marche.test.mjs` rejoue **400 histogrammes tirés au hasard** dans les deux implémentations et exige des résultats identiques.
- `src/data/segmentsModeles.js` : table **GÉNÉRÉE** (`scripts/generer-segments-modeles.mjs`, chaîné au `prebuild`) — 48 familles, 101 segments, avec le libellé d'affichage accentué (« Série 3 », « Mégane ») dont le test vérifie qu'il se renormalise exactement vers la clé. `--verifier` fait échouer l'éval si le fichier est périmé. On fige le RÉSULTAT du module serveur plutôt que de réécrire sa logique en JS.

### Mise en service — FAITE le 2 nov. 2026
1. dump prod hors dépôt (`~/inspexo-backups/schema-…` + `data-public-…`) ; 2. `db push` : migration `20261104120000` appliquée, 23/23 ; 3. `marche`, `score`, `visite`, `lecture-ct` déployées ; 4. `MARCHE_PROXY_SECRET` posé côté secrets Supabase **et** variables Vercel production ; 5. éval ciblée **PASS, verdicts identiques** (S7 rouge 38 / 308 orange 55 / Mercedes vert 71, 0,304 €) ; merge dans main et déploiement Vercel vérifiés.
- Contrôles de surface en prod : `marche` rend **403** sans secret de proxy et avec un mauvais secret ; `/api/marche` rend **400** (donc le secret concorde des deux côtés) ; `get_prix_segments` ouverte à anon et bien formée ; `agreger_marche` et la table `marche_agregats` **refusées à anon** (42501).
- ⬜ Reste à faire : publier l'extension 1.1.0 sur le Chrome Web Store (geste d'Utku). La nouvelle page de confidentialité est déjà en ligne, l'ancienne promesse « aucune collecte, aucun suivi » n'y figure plus.

## Sprint 10 — Le moment du verdict (nov. 2026)

### Cadre juridique — NE JAMAIS ASSOUPLIR
Sans immatriculation ORIAS, Inspexo est **indicateur** : il met en relation, il ne conseille pas. Les règles sont appliquées **à l'écriture** par `_shared/partenaires.ts` (module pur, `tests/partenaires.test.mjs`, 105 contrôles) — un texte non conforme ne peut pas être enregistré, et le refus nomme le motif.
- **Assurance** : aucun contenu de contrat. Ni couverture, ni franchise, ni plafond, ni exclusion, ni liste d'organes, ni prix, ni comparaison — et **aucun lien avec les pannes détectées** (« cette panne serait couverte » est explicitement refusé).
- **Crédit** (art. R519-2 CMF) : ni taux, ni TAEG, ni mensualité, ni durée, ni simulateur, ni montant empruntable. La mention de l'**art. L312-5 du code de la consommation** est OBLIGATOIRE dans le texte validé, et les arguments de facilité ou de rapidité sont refusés (« rapide », « facile », « immédiat », « en quelques minutes », « sans justificatif », « accord garanti », « réponse immédiate »). **Activation impossible avant le 20/11/2026** (`CREDIT_ACTIVABLE_LE`), vérifiée à l'allumage.
- La mention légale est **retirée du corps du texte à l'affichage** (`texteSansMentionCredit`) et réaffichée seule, en gras, juste au-dessus du lien : dans le paragraphe elle serait lue deux fois et banalisée.
- **Éteints par défaut** : `partenaires.actif = false`, aucune ligne semée. Un texte modifié repart ÉTEINT — la validation d'hier ne vaut pas pour le texte d'aujourd'hui.

### Indépendance du verdict — prouvée, pas affirmée
`tests/independance-score.test.mjs` (chaîné dans `npm run eval`) : contrôle **statique** qu'aucun des 13 fichiers du chemin de notation ne cite un partenaire, la table des mises en relation, une RPC partenaire ou la route `/go/` — avec sept contre-exemples qui vérifient que le contrôle mord encore. Plus un contrôle **fonctionnel** : score identique flags ON et OFF sur six profils couvrant les trois verdicts, sans rémanence, et des champs de partenaire injectés dans les faits ne changent rien. ⚠️ Les mots « garantie », « crédit » et « retours » sont VOLONTAIREMENT hors de la liste : le projet les emploie légitimement (garantie constructeur, crédit d'API Anthropic, retours à la ligne) — un test qui crie à tort finit désactivé.

### Bloc « Et maintenant ? » (`EtMaintenant.jsx`, sous les motifs)
- **Vert / orange** : inspection (le bloc du sprint 8 y est **déplacé**, pas dupliqué — `InspectionBloc ... nu`), puis garantie et financement en liens secondaires si leur partenaire est actif.
- **Rouge** : jamais de partenaire. La requête n'est **même pas émise** (vérifié dans les captures : aucun appel réseau), ce n'est pas un masquage CSS. L'inspection reste, mais jamais en action orange : phrase de préalable obligatoire (`PREALABLE_ROUGE`) puis repli secondaire.
- Le composant ne reçoit **ni les pannes, ni le score, ni le prix** : il ne connaît que le verdict et l'identifiant du dossier. Un rapprochement panne ↔ garantie y est structurellement impossible.

### Mise en relation
- Tables `partenaires` et `mises_en_relation` (migration `20261105120000`, additive) : RLS active, zéro policy, accès par RPC SECURITY DEFINER.
- `get_partenaires_actifs()` (anon) **ne rend jamais l'URL** : le navigateur n'a que le slug, la redirection passe obligatoirement par `/go/<slug>` → `api/go.js` → fonction `go` → 302. Sans ce détour, un lien serait suivi sans être compté.
- `Referrer-Policy: no-referrer` sur la redirection : le partenaire ne reçoit pas l'adresse du dossier que l'acheteur lisait.
- **Aucune transmission de coordonnées en V1** (décision d'Utku) : pas de case de consentement, pas d'envoi de données. À construire seulement si un partenaire l'exige.
- **Comptage brut et net** : les robots et agents d'aperçu de lien (`estRobot`, même liste que la réécriture OG de `vercel.json`) sont journalisés mais exclus ; dédoublonnage **par dossier, par partenaire et par jour** (`cleDedup`). L'admin affiche les deux chiffres séparément.

### Retour d'issue — l'existant était trop étroit
⚠️ Le dispositif du sprint 3 **existait mais ne touchait presque personne** : il exigeait un compte ET un dossier marqué « acheté » à la main, et présupposait l'achat au lieu de le demander.
- Nouveau : lien **signé HMAC** (`signatureRetour`, secret `UNSUB_SECRET`, seule l'empreinte est stockée) → page `/retour/:id?t=…`, **sans compte**. Trois questions : avez-vous acheté, à quel prix, les points signalés se sont-ils confirmés (oui / non / pas vérifié).
- Envoi à **J+21** par le cron `alertes`, sur l'union dossier + Pass + inspection + opt-in `rapport`. Fenêtre haute **60 jours** (`JOURS_FENETRE_RETOUR`) et **50 invitations par passage** : si le cron reste à l'arrêt, le rattrapage ne doit pas écrire à des gens dont l'achat est largement derrière eux. ⚠️ Les deux réglages interagissent — un arriéré supérieur à 50 × (jours restants dans la fenêtre) perd silencieusement sa queue ; à une exécution par jour, 50 draine 3 000 invitations avant expiration.
- **Mesuré le 3/11/2026 avant le premier passage : 0 invitation**, et pas seulement à cause du délai — les quatre populations sources sont vides (0 dossier, 0 Pass actif, 0 inspection, 0 opt-in `rapport`), pour 13 analyses réelles du 18 au 27/10, toutes anonymes. Le dispositif restera silencieux tant que personne n'aura créé un dossier, acheté un Pass, commandé une inspection ou demandé son rapport par email. Script de contrôle : `scratchpad/compter-invitations.sh` (lecture seule, `set role postgres` + `default_transaction_read_only`). **Une seule invitation par (analyse, email)** : l'unicité est dans le schéma (`retours`), donc l'union est dédoublonnée par la base et non par la prudence du code. **Aucune relance n'existe dans le code.**
- ⚠️ L'ancien envoi « J+30 après acheté » a été **RETIRÉ** (`emailRetourIssue` supprimée) : il aurait fait deux sollicitations pour le même véhicule. Le formulaire de `/dossier` (RPC `submit_outcome`) reste, c'est une action de l'utilisateur.
- Nouvelle table `desinscriptions` (empreinte d'email) : la désinscription du sprint 3.1 ne coupait que les alertes d'un COMPTE, or une invitation peut partir vers quelqu'un qui n'en a pas. `desinscription` gagne un mode `e=<empreinte>&t=<signature>`.

### Transparence sur la rémunération (ajout après relecture d'Utku)
La phrase affichée n'est **pas figée dans le code** : `partenaires.remuneration` (`commission` | `aucune`, **NOT NULL sans valeur par défaut**) est déclarée à l'enregistrement, publiée par `get_partenaires_actifs` et traduite par `phraseRemunerationGlobale`. Elle ne peut donc pas devenir fausse parce qu'on aurait oublié de la changer après avoir signé un contrat. Régimes **mélangés** entre partenaires ⇒ la phrase globale est remplacée par une phrase **par partenaire** : on ne généralise jamais à tort. ⚠️ **Une déclaration manquante n'est JAMAIS lue comme « aucune »** : le partenaire n'est alors **pas affiché du tout** (`remunerationDeclaree` / `partenairesPubliables`, plus un filtre indépendant dans `get_partenaires_actifs`, migration `20261105140000`). Afficher « Inspexo ne perçoit aucune rémunération » sans que personne ne l'ait affirmé serait une allégation fausse — pratique commerciale trompeuse au sens de l'art. L121-2 du code de la consommation. Le silence n'affirme rien. Affichée dans le même style que la mention légale (gras, 15 px), au-dessus des liens.
- **Promesse « payé exclusivement par l'acheteur » revue partout** : les seules occurrences portaient déjà sur l'INSPECTEUR (`InspectionBloc`, `RapportInspection`, `notify.ts`, charte) et restent exactes. Seule la CGU art. 2 était ambiguë — reformulée en « L'inspection est payée exclusivement par l'acheteur ». ⚠️ La charte d'indépendance (`src/data/charte.js` ≡ `_shared/inspection.ts`) n'a PAS été touchée : `tests/inspection.test.mjs` exige qu'elles restent identiques mot pour mot.
- **CGU article 3 bis** : conditions de référencement d'un partenaire (texte validé, contrôle automatique, mention légale, activation manuelle, jamais sur un rouge), rémunération, et ce qui est transmis (rien).

### Admin et divers
- Onglets **Partenaires** (enregistrer sous contrôle légal, activer/éteindre, mises en relation par semaine brut/net, export CSV) et **Retours** (taux de réponse sur les invitations ENVOYÉES, achats, écart médian prix affiché → prix payé, points confirmés par famille moteur).
- `leads.code_postal` + RPC `submit_demande_zone` : la liste d'attente hors zone capture le code postal — c'est la carte de la demande, elle dit où recruter. Composant `DemandeZone.jsx`.
- Route `/retour/:id`, réécriture `/go/:slug` dans `vercel.json`, secret **`GO_PROXY_SECRET`** (Supabase + Vercel prod) à poser avant la mise en service.
- Page `/politique-de-confidentialite` : trois sections ajoutées (liens partenaires, code postal, retour après achat).
- **Aucune modification du score** : aucune éval payante, coût 0 €.

⚠️ **Ne jamais modifier une migration déjà appliquée.** Le filtre SQL ci-dessus avait d'abord été écrit dans `20261105120000`, déjà poussée : l'édition n'aurait jamais rejoué en prod, et le fichier aurait cessé de décrire ce qui a réellement tourné. Corrigé par une migration dédiée, l'originale restaurée à l'identique.

### Mise en service — FAITE le 3 nov. 2026
1. `GO_PROXY_SECRET` posé côté secrets Supabase **et** variables Vercel production ; 2. dump prod hors dépôt puis migration `20261105120000` appliquée (**24/24**) ; 3. `go`, `retour`, `admin-partenaires`, `admin-retours`, `alertes`, `desinscription` déployées — ⚠️ `desinscription` a **conservé `verify_jwt=false`** au redéploiement (vérifié : les liens de désinscription des emails restent valides) ; 4. merge dans main et déploiement Vercel ; 5. vérification en production sur un dossier vert et un rouge.
- Contrôles de surface en prod : `get_partenaires_actifs` rend `[]` (aucun partenaire actif) ; `partenaires`, `mises_en_relation`, `retours` et `desinscriptions` **refusées à anon** (401) ; `go` rend **403** sans secret de proxy ; `retour` rend **403** sur un jeton inconnu.
- ⚠️ `/go/<inconnu>` redirige vers `?lien=inconnu` et non `?lien=indisponible` : **c'est la preuve que les deux secrets concordent** (un secret discordant donnerait un 403 de la fonction, donc `indisponible`). Les deux codes ont été séparés exprès — les confondre rendait une erreur de configuration invisible.
- Vérifié sur la prod réelle, à 390 px : sur un **rouge**, aucune requête partenaires n'est émise (règle appliquée avant le réseau), la phrase de préalable est là et l'inspection est repliée en lien secondaire ; sur un **vert**, la requête part et ne rend rien faute de partenaire actif. Zéro erreur JavaScript, zéro débordement. Captures dans `captures-sprint10/prod/`.
- ⬜ Reste : désigner un partenaire assurance (puis l'enregistrer, déclarer sa rémunération et l'activer dans l'admin). **Crédit bloqué jusqu'au 20/11/2026** par `peutActiver`, vérifié à l'allumage.

## Sprint 11 — Mesure du parcours et API pro v0 (nov. 2026)

### ⚠️ Défaut corrigé en ouvrant le sprint
`_request_ip_hash` calculait `sha256(prefixe || ip)`, **sans aucun sel secret**. Les 4 milliards d'adresses IPv4 s'énumèrent en quelques secondes : les empreintes stockées étaient **réversibles en pratique**, ce que ne disait ni la politique de confidentialité ni l'exemption CNIL invoquée. (Les fonctions edge, elles, utilisaient bien `IP_HASH_SALT`.) Corrigé par un **sel aléatoire quotidien** (`ip_salts`, purgé au-delà de 2 jours : passé ce délai la ré-identification est impossible même pour nous), et les **empreintes non salées déjà en base ont été effacées** — ciblage par nom d'événement, seuls les events insérés par les RPC SQL étant concernés.
⚠️ Conséquence assumée : les plafonds SQL comptés sur 24 h (leads, `track_event`) se réinitialisent au changement de sel. Le plafond critique — **5 analyses / 24 h** — vit dans la fonction edge avec `IP_HASH_SALT` stable et **n'est pas affecté**.

### A. Mesure du parcours — sans cookie, sans traceur, sans consentement
- Dix étapes reliées par `analysis_id` **seul**. Six existaient déjà ; deux ont été ajoutées à la whitelist `track_event` (`pass_clicked`, `inspection_clicked`) et **n'écrivent AUCUNE empreinte d'IP** — plafonnées par analyse, pas par IP, puisqu'il n'y a pas d'identifiant.
- `?src=` : étiquette de campagne, format `^[a-z0-9][a-z0-9-]{0,39}$` imposé **côté client et côté base**. Capturée au premier rendu (`src/lib/source.js`), gardée dans **une seule clé de `sessionStorage`** dont la valeur est l'étiquette seule, **effacée dès le rattachement** à une analyse. Colonne `analyses.src`. ⚠️ Elle n'apparaît **qu'en agrégé** dans l'admin, jamais dans un export à côté d'un email.
- RPC `get_parcours(semaines)` (service role) + onglet admin **Parcours** : tunnel, taux de passage, ventilation par source, délai médian analyse → paiement.

### B. API de scoring v0
- `POST /api/v1/analyses` → `api/v1/analyses.js` (déplace la clé du client de `Authorization` vers `X-Inspexo-Key`, sans quoi elle entrerait en collision avec l'authentification Supabase) → fonction `api-analyses` → `score` en service→service. **Même pipeline, même barème, même cache 7 jours.**
- Réponse : verdict, score, `axes`, `motifs`, `points` sourcés avec leurs URL, `bareme_version`, `quota`.
- `api_clients` : la clé n'est **jamais stockée en clair** (empreinte salée `API_KEY_SALT`), affichée **une seule fois** à la création, comparaison en **temps constant**.
- **Deux plafonds** : quota mensuel par client, et plafond **journalier global** séparé du public (`PLAFOND_JOUR_API`). Décision et débit **atomiques** dans `api_consommer` (deux appels simultanés ne peuvent pas consommer le même dernier crédit). `api_rembourser` rend le crédit quand l'analyse n'a rien produit.
- Pages `/pro` et `/pro/api` pré-rendues, **aucun prix affiché**, formulaire → `leads_pro`. CUA en **brouillon non publié** : `docs/cua-api-v0.md` (5 points à trancher).

### ⚠️ Le drapeau de quota API — les deux facteurs, toujours
`estAppelApi(headers, serviceRoleKey)` exige **l'en-tête `x-api-client` ET la clé de service role**. L'en-tête seul ne vaut rien : il est trivial à ajouter depuis un navigateur et ouvrirait le service gratuit à volonté. Même construction que `isInternal` (extension). Le drapeau décide **quel compteur s'applique**, jamais ce que vaut le verdict.
Prouvé par `tests/independance-score.test.mjs` : en-tête seul → appel public ; en-tête + clé anon → appel public ; les deux → appel API. Et, par lecture du source : `score` délègue au prédicat testé, ne lit jamais l'en-tête hors du drapeau, et **aucune ligne portant `isApi` ne touche au score, au verdict ni aux pannes**.

### Divers
- `BAREME_VERSION` dans `_shared/bareme.ts` — **additive, aucun effet sur le calcul**. À incrémenter dès qu'une modification change un score à faits identiques, jamais pour un libellé.
- Page `/politique-de-confidentialite` : trois sections ajoutées (mesure d'audience, étiquette de campagne, API).
- `npm run eval` enchaîne `tests/api-clients.test.mjs`.

### Mise en service partielle — 3 nov. 2026 (merge EN ATTENTE)
Déployé pour pouvoir exécuter les deux vérifications demandées : dump prod hors dépôt, migration `20261106120000` (25/25), secret `API_KEY_SALT`, fonctions `score`, `api-analyses`, `admin-api`, `admin-parcours`. **Le merge de `sprint11` n'est pas fait.** `api/v1/analyses.js` et les pages `/pro` ne sont donc en ligne que sur la preview.
- **Éval ciblée après `--reset-cout` : verdicts INCHANGÉS** — S7 rouge 38, 308 orange 55, Mercedes vert 71.
- **Appel API réel** : Clio IV 1.5 dCi → orange 56, 5 points tous sourcés, `bareme_version` 11.0, quota décompté. Second appel sur la même annonce → `cache: true`, coût nul.
- Chemins de refus vérifiés en conditions réelles : **401** sans clé et sur clé inconnue, **429** sur quota épuisé (message nommant le plafond et sa date de remise à zéro), **403** sur clé révoquée.
- ⚠️ **Défaut trouvé par l'appel de contrôle, corrigé** : `axes` revenait `null`. `result_json.score_detail` **EST** la carte des axes, pas un objet qui la contient — `score_detail.axes` était donc toujours indéfini. C'est exactement ce que cet appel devait débusquer.
- Merge fait le 3 nov. 2026 : `/api/v1/analyses` et `/pro` sont en production, les deux pages **pré-rendues** et servies sans JavaScript, **aucun prix affiché**.

### Décisions CUA du 3 nov. 2026 — écrites ET appliquées
⚠️ Une règle écrite dans les CUA que le code n'applique pas serait un engagement faux. Les trois décisions comportementales sont donc implémentées (migration `20261107120000`), pas seulement rédigées :
- **Cache non refacturé pour le MÊME client sur la MÊME annonce sous 7 jours** : `api_appels` + `api_deja_facture`, remboursement dans `api-analyses`, champ `quota.facture` dans la réponse. Une autre annonce, un autre client, ou plus de 7 jours ⇒ facturé.
- **Prix reçus par API EXCLUS du relevé agrégé par défaut** : `api_clients.prix_partages` (défaut **false**) lu par `api-analyses`, transmis à `score` sous forme de booléen `partager_prix`. ⚠️ `score` ne lit **jamais** la table des clients — le test d'indépendance l'interdit explicitement.
- **Texte des annonces API effacé à 30 jours** : `analyses.via_api` + `purger_textes_api()`, appelée chaque jour par le cron `alertes`. L'usage (date, clé, nombre) reste pour la comptabilité.
- Attribution « Analyse Inspexo » + lien `/a/:id` dès restitution à un tiers, et responsabilité plafonnée (12 mois, indirects exclus) : contractuel.
- ⬜ **`docs/cua-api-v0.md` reste NON PUBLIÉ et doit être relu par un avocat avant le premier contrat.**
- Le test d'indépendance énumère désormais les **7 usages admis** du drapeau `isApi` : toute utilisation nouvelle hors de cette liste fait échouer `npm run eval`, ce qui force à décider si elle est légitime. Un simple plafond sur le nombre de lignes n'aurait rien garanti.

### Page de confidentialité — manque comblé
Le formulaire pro collectait email, société, volume et message libre (`leads_pro`) sans que la politique n'en dise un mot. Sections **2.f** et **6 octies** ajoutées : finalité unique, base légale (mesures précontractuelles), conservation 3 ans après le dernier contact.

## Sprint 12 — Vocabulaire et compléments CUA API (nov. 2026)

### Vocabulaire : jamais « la valeur » d'un véhicule
La détermination de la valeur d'un véhicule est réservée aux **experts en
automobile inscrits** (art. **L326-4 I-2° du code de la route**). Notre analyse
ne détermine pas une valeur : elle **relève des prix observés** et situe le prix
demandé par **écart avec les annonces comparables**. Vocabulaire proscrit quand
il s'applique à NOTRE analyse : « valeur », « estimation », « cote »,
« expertise », « expert ». Remplacements : « prix observés », « écart avec les
annonces comparables », « analyse », « fourchette de coûts ».
- ⚠️ **Trois familles d'occurrences ne se touchent PAS, et pour des raisons
  différentes.** (1) Les **dénégations** (« ne constitue ni une expertise
  automobile au sens réglementaire ») : les retirer affaiblirait la protection
  qu'elles apportent — elles disent précisément que nous n'en sommes pas une.
  (2) Les occurrences qui désignent les **inspecteurs humains** (CGU art. 2, 7,
  8, 10, 11 ; mentions légales ; FAQ ; footer) : ce sont de vrais
  professionnels, le mot est juste. (3) Les **identifiants** : la source de lead
  `expert_waitlist` est une valeur contrainte en base, « Peugeot Expert » est un
  modèle d'utilitaire, et le filtre de `ResultPage` qui MATCHE « estimation de
  valeur » dans une justification de la critique lit une sortie de modèle — le
  changer casserait l'appariement sans rien assainir.
- « Décote mesurée sur ce segment » devient « **Écart observé sur ce segment** »
  à l'affichage. Le calcul et les noms internes (`decote_eur_10000km`) sont
  inchangés : c'est bien une pente mesurée sur des prix demandés.

### Compléments aux CUA de l'API (`docs/cua-api-v0.md`, toujours NON PUBLIÉ)
- **Restitution à un tiers = le verdict COMPLET, ou rien** (art. 4.4-4.7) :
  score, **date d'analyse**, `bareme_version`, mention « analyse automatisée de
  l'annonce, sans examen du véhicule », lien `/a/:id`, attribution. Ni extrait
  ni modification. **Interdit au vendeur du véhicule analysé** — mise dans les
  mains du vendeur, l'analyse devient un argument de vente.
  - ⚠️ **La date d'analyse MANQUAIT dans la réponse de l'API** : vérifié, elle
    n'y était pas. Ajoutée (`date_analyse`, lue sur `analyses.created_at`) —
    donc sur un résultat servi par le cache c'est la date de l'analyse
    **d'origine**, ce qui est exactement le point : sans elle, un verdict de
    sept jours se lit comme un verdict du jour. L'obligation d'affichage est
    aussi rendue **comme donnée** (objet `restitution`), pas seulement comme
    prose contractuelle.
- **Conservation** (art. 6.4) : avant la purge du texte à 30 jours, le résultat
  et une **empreinte sha256 du texte** sont conservés **5 ans** (preuve en cas
  de litige, art. **L110-4 C. com.**), puis effacés par `purger_preuves_api()`.
  - ⚠️ **L'ordre des deux passes de `purger_textes_api` EST la garantie** :
    passe 1 pose l'empreinte (sans attendre 30 jours), passe 2 n'efface QUE les
    textes qui en portent une (`texte_sha256 is not null`). Inversées, elles
    perdraient la preuve en silence et pour toujours.
  - ⚠️ **L'empreinte est un sha256 NON SALÉ, et c'est voulu** : sa valeur de
    preuve vient de ce que le client peut la recalculer. Rien à voir avec le
    défaut d'IP non salée corrigé au sprint 11 — une IP s'énumère en quelques
    secondes, un texte d'annonce non.
- **Prix partagés** (art. 6.3) : annonces **publiques** uniquement, segment
  publié à partir de **15 relevés** ET **si aucun client d'API ne pèse plus de
  20 %** du segment. Un relevé dominé par une source n'observe plus le marché,
  il reflète cette source.
  - `marche_agregats.parts_api` (carte {client → effectif}, vide dans le cas
    normal) + `PART_API_MAX` / `partApiDominante` / `partApiAcceptable` dans
    `_shared/marche.ts`, miroir dans `src/data/marche.js`, et `part_api_max()`
    + `get_prix_segments` côté base. La **région reste une préférence** : un
    sous-ensemble régional dominé se replie sur le national, il ne se publie
    pas. Le dénominateur est le total **publié** (comparables en mémoire
    compris).
  - ⚠️ **`agreger_marche(jsonb)` est SUPPRIMÉE, pas surchargée** : laisser
    vivre la signature à un argument rouvrirait un chemin d'écriture **sans
    attribution**, donc une façon de faire entrer des prix d'API dans un
    segment sans qu'ils y soient comptés. Un verrou contournable par
    l'ancienne porte n'est pas un verrou. Un identifiant de client invalide
    fait **échouer le lot** au lieu de le basculer en « public ».
- **Responsabilité** (art. 7) : **obligation de moyens**, le client répond seul
  de l'usage du verdict auprès de ses clients et **garantit Inspexo** en cas
  d'usage trompeur, plafond = **le plus élevé** entre les sommes payées sur
  12 mois et un plancher.
  - 🔒 **BLOQUANT** : le plancher est un `[MONTANT À FIXER AVEC L'AVOCAT ET
    L'ASSUREUR RC PRO]`. Un plancher supérieur à la garantie souscrite serait
    un engagement pris sur les fonds propres sans le savoir. **Aucun contrat ne
    peut être signé avant qu'il soit arrêté.**
- **Annexes, brouillons NON PUBLIÉS** : `docs/cgv-pro-v0.md` (tarifs sur devis,
  paiement 60 j **maximum** — plafond impératif de L441-10, pénalités au taux
  BCE + 10 points, indemnité forfaitaire de **40 €** par facture, mentions de
  L441-9 à poser sur le gabarit de facture) et `docs/dpa-api-v0.md` (art. 28
  RGPD : Inspexo **sous-traitant**, instructions documentées, sous-traitants
  ultérieurs dont **Anthropic hors UE**, effacement en fin de contrat — sauf la
  preuve de 5 ans et les pièces comptables, réserve de l'art. 28.3 g).
- ⚠️ **Le périmètre de l'acte art. 28 est explicite** : Inspexo est
  sous-traitant pour l'analyse, mais **responsable du traitement pour son
  propre compte** sur la facturation et le relevé de prix agrégé. Confondre les
  deux qualifications ferait signer un acte qui ne couvre pas ce qu'il prétend.

### Tests — hors ligne, aucune éval payante (coût 0 €)
- `tests/purge-api.test.mjs` (**nouveau**, chaîné dans `npm run eval`) :
  36 contrôles **statiques** sur la migration. Les règles vérifiées sont des
  garanties d'**ordre** et de **portée**, pas des calculs — c'est la forme du
  code qu'on fige. Il contrôle aussi que le seuil des 20 % est **identique en
  SQL et en TypeScript**, et que la signature sans client est bien supprimée.
- `tests/marche.test.mjs` : +32 contrôles sur le verrou des 20 % (borne incluse
  à 20 %, règle **par client** et non sur le cumul, poids cumulé sur plusieurs
  lignes, interaction avec la préférence régionale, effet des comparables en
  mémoire). Le tirage de parité client/serveur génère désormais des
  `parts_api`, et le test **exige que le verrou morde** sur ce tirage — sans
  quoi la parité ne prouverait rien à son sujet.
- Les 15 suites hors ligne passent. **Aucune modification du calcul du score** :
  `tests/independance-score.test.mjs` passe inchangé (41/41).

### Titre d'expert : « inspecteur » partout (L326-8 C. route)
« Expert en automobile » est un **titre protégé** (usurpation sanctionnée). Le
mot est remplacé par **« inspecteur »** partout où il désigne nos intervenants
humains (CGU art. 1, 2, 5, 6, 8, 9, 10, 11 ; mentions légales ; FAQ ; footer),
et « leur expertise » par « leur spécialisation ».
- **Conservé volontairement** : les deux **dénégations** (« n'est pas […] un
  expert automobile agréé », « ne constitue ni une expertise ») — elles
  protègent précisément contre cette confusion. Et le commentaire de
  `defectAtlas.js`.
- Non touchés : `expert_waitlist` (valeur contrainte en base), « Peugeot
  Expert » (utilitaire), la regex de `ResultPage:140` (elle MATCHE une sortie
  de modèle).
- ⚠️ Le premier relevé annonçait 11 occurrences dans CGU ; il y en avait **23**
  — le contexte de `grep` collapsait plusieurs occurrences par ligne. Compter
  les LIGNES change ne suffit pas : compter les occurrences.

### CGU alignées sur les offres réellement vendues
Supprimés : **9,90 €** (produit mort, `ai-chat` en 410), **Visio 59 €** et
**Inspection 249 €** (liste d'attente). Plus aucun prix d'offre non vendue dans
un document contractuel. 3.1 corrigé (**5 analyses / 24 h, sans compte**).
Article 7 réécrit en **une règle par offre** — le « cas par cas » supprimé, le
Pass garde « remboursé sans condition sous 14 jours ».
- Les articles **1, 5, 6, 8 et 14** ont suivi : ils ne décrivaient plus que les
  offres supprimées. Un document cohérent ou rien.
- Nouvelle page **`/cgv-inspection`** : une offre payante, un document. C'est
  ce texte que `inspection-checkout` estampillait déjà par `CGV_VERSION` sans
  qu'il existe. **Prix, zone, délai et médiateur lus dans la configuration
  serveur**, jamais recopiés — un prix en dur dans un contrat devient faux en
  silence.
- Détail et proposition : `docs/cgu-alignement-offres.md`.

### Inspection : paiement en deux temps, expiration, annulation
⚠️ **Ce que le code faisait et que personne n'avait vu** : le paiement était
**encaissé à la commande**. Un acheteur payait 179 € pour une mission que
personne n'avait prise et que rien n'obligeait à prendre. La décision
« autorisation avant confirmation » était **actée depuis le sprint 1** et
jamais appliquée à l'inspection.
- **Autorisation puis capture** : `capture_method: "manual"` à la commande,
  capture dans `inspecteur-mission` au moment où un inspecteur confirme.
  ⚠️ Le webhook exigeait `payment_status === "paid"` : sous capture manuelle la
  session arrive en `"unpaid"`, et l'inspection **n'aurait JAMAIS atteint « à
  attribuer »**. Il accepte désormais l'autorisation (`requires_capture`).
- ⚠️ **48 h, et pas plus** : une autorisation de carte ne tient que **7 jours**.
  `tests/inspection.test.mjs` **interdit** à la fenêtre de s'en approcher (
  facteur deux de marge). Au-delà de 48 h, le cron relâche l'autorisation
  (`inspections_a_expirer`), rien n'est débité, l'acheteur est prévenu.
- **Barème d'annulation** dans `_shared/inspection.ts` (`decisionAnnulation`,
  **pur**) : avant confirmation → autorisation relâchée ; après, à plus de 24 h
  → remboursement intégral ; à moins de 24 h **ou vendeur absent constaté** →
  **40 € à l'inspecteur**, le reste rendu. L'absence l'emporte sur le délai : un
  déplacement fait pour rien s'indemnise.
- **Le constat d'absence exige une photo horodatée** : la retenue est prélevée
  sur l'acheteur, elle ne peut pas reposer sur la parole de celui qui la
  touche. ⚠️ La photo est déposée **AVANT** la transition d'état, à l'inverse de
  la règle du projet : la preuve conditionne la somme. Un fichier orphelin vaut
  mieux qu'une retenue injustifiée.
- ⚠️ **Le transfert part AVANT le remboursement** (`_shared/inspectionArgent.ts`) :
  les fonds de la charge sont encore entiers, donc `source_transaction` ne
  manque pas de disponible ; et un remboursement manqué se rattrape depuis nos
  colonnes, alors qu'un transfert manqué laisse l'inspecteur impayé.
- ⚠️ **Le webhook ne doit pas défaire le barème** : `charge.refunded` applique
  une reprise **proportionnelle** du transfert. Un remboursement de 139 €
  aurait reprise une part des 40 € accordés. Garde : statut `annulee` (posé
  avant Stripe) + `remboursement_pilote`.
- **Capture en échec après acceptation** → `inspection_capture_echouee` remet
  la mission en attribution et alerte : une mission ne reste pas « confirmée »
  sans argent encaissé. **Compte Connect incomplet** lors d'une retenue →
  l'acheteur est remboursé **intégralement**, l'indemnité se régularise à la
  main.
- **Demande expresse d'exécution immédiate** (L221-25) : case **obligatoire,
  jamais pré-cochée**, texte exact dans `DEMANDE_EXECUTION_IMMEDIATE`,
  horodatée avec `cgv_version`. Sans elle l'acheteur gardait **14 jours de
  rétractation après l'inspection faite** — inspecteur payé, acheteur
  remboursé. Le test vérifie que l'écran affiche le texte **mot pour mot**.
- **Arbitrage exploitant** (`PATCH admin-inspecteurs`) : rendre ou confirmer la
  retenue, **une seule fois** (la décision est une trace). La preuve se signe
  par **identifiant d'inspection**, jamais par un chemin fourni par le client.
- **Alerte** si un rapport n'est pas remis 24 h après le créneau, une par
  inspection.

### ⚠️ Bug trouvé par les tests — invariant monétaire
L'invariant sur **20 000 annulations** a échoué sur **661 cas** : à un prix
inférieur à 40 €, le remboursement devenait **négatif** — on redemandait de
l'argent à l'acheteur pour avoir annulé. À 179 € le cas n'arrive pas, mais le
prix est un paramètre. La retenue est bornée par le montant encaissé, **en TS
et dans les deux RPC SQL**.
⚠️ Et le `process.exit(1)` de `tests/inspection.test.mjs` se trouvait **avant**
les nouveaux blocs : leurs échecs n'auraient jamais fait échouer la suite.
Déplacé en fin de fichier, et vérifié qu'il mord. **Ajouter des tests après la
porte de sortie revient à ne pas en ajouter.**

### Conservation — les durées annoncées sont APPLIQUÉES
Photos du rapport **2 ans** (délai de l'action en vices cachés, art. **1648
C. civ.**), constatations écrites **5 ans**, coordonnées du vendeur **3 mois**.
Écrit dans les CGV et la politique de confidentialité, **et** appliqué par la
passe 7 du cron `alertes` — la suppression des fichiers se fait dans la
fonction edge, le stockage n'étant pas une table. Charte **2026-11-03** :
« aucune personne reconnaissable » (les inspecteurs devront re-signer ; il n'y
en a aucun aujourd'hui).

### Mise en service — PAS FAITE (branche `sprint12-vocabulaire`, non mergée)
1. dump prod hors dépôt ; 2. essai en **transaction annulée** de la migration
(`node scripts/essai-migration-annulee.mjs`, à coller dans l'éditeur SQL du
dashboard — une seule session, `rollback` final) ; 3. `db push --linked --yes`
(migrations `20261108120000` et `20261109120000`) ; 4. déployer `score`,
`api-analyses`, `alertes`, `inspection-checkout`, `inspection-webhook`
(**--no-verify-jwt**), `inspecteur-mission`, `inspection-annuler` (nouvelle),
`admin-inspecteurs` ; 5. éval ciblée S7/308/Mercedes (verdicts inchangés) ;
6. **tests Stripe en `sk_test`** du parcours autorisation → capture,
expiration, les trois annulations et l'arbitrage ; 7. merge.
- ⚠️ **Aucun outil local ne permet d'exécuter du SQL sur la prod** : pas de
  `psql`, pas de Docker, et le CLI Supabase 3.0.0 n'a ni `db execute` ni
  équivalent (`snippets` = list/download, `notebooks` = push/pull). L'essai en
  transaction annulée passe donc par le dashboard, ou par un
  `SUPABASE_ACCESS_TOKEN` (API de gestion) / `SUPABASE_DB_PASSWORD` (driver
  `pg`) si l'un des deux est posé.
- **`agreger_marche` est DROP puis CREATE**, mais l'ordre reste sans danger :
  `p_client_id` a une **valeur par défaut**, donc l'appel à un seul argument du
  `score` encore en place continue de résoudre. Déployer `score` juste après
  la migration sert seulement à ce que l'attribution commence à être
  enregistrée — pas à éviter une panne.

## Sprint 13 — Lecture du rapport HistoVec (nov. 2026)

### ⚠️ Ce que HistoVec produit réellement — étudié dans le code source officiel
`github.com/histovec/histovec-beta`, **dernier commit de `main` le 5 octobre
2023** (plus de trois ans : à reconfirmer sur un rapport récent). Note complète :
`docs/sprint13-histovec-format.md`.
- Le bouton du vendeur s'appelle **« Imprimer le CSA »** et produit le
  **« Certificat de situation administrative détaillé »**. Le **rapport**
  HistoVec, lui, est une **page web à onglets** partagée par un lien, et les
  onglets « Contrôles techniques » et « Kilométrage » sont **conditionnels**.
  Aucune feuille `@media print` dans le dépôt : imprimer la page ne rendrait que
  l'onglet actif.
- **Le PDF ne contient NI kilométrage, NI contrôles techniques, NI nombre de
  titulaires, NI modèle, NI énergie.** Cinq des six règles tiennent quand même —
  le nombre de détenteurs se **déduit** des opérations `CHANG_TIT_NORMAL*`, et
  `CHANG_LOC` révèle un passage en location. **Décision : le kilométrage est
  traité par `lecture-ct`, pas par HistoVec.**
- ⚠️ **Piège documenté dans leur code** : pour une OVE, le CSA écrit
  « Véhicule endommagé » là où le rapport web écrit « Procédure de réparation
  contrôlée » — divergence assumée par la DSR. Les deux doivent être reconnues.
- ⚠️ **Trois formes négatives** : « Aucune » (oppositions, saisie), « Aucun »
  (gage), « Non » (suspensions). Une seule regex les manque.

### ⚠️ Appariement POSITIONNEL, validé par format
Mesuré sur des CSA produits par le générateur officiel : la mise en page à deux
colonnes sort les **quatre libellés d'identification d'affilée, PUIS les quatre
valeurs**. Une règle « libellé : valeur sur la même ligne » ne trouve **rien**.
- L'appariement est donc positionnel — et comme une position est une hypothèse,
  **chaque valeur est validée par SON format** (plaque SIV ou FNI, date
  JJ/MM/AAAA réelle, VIN de 17 caractères sans I/O/Q, marque dans une liste).
  Format inattendu ⇒ **rien n'est attribué**, jamais d'approximation. Test avec
  deux valeurs inversées : ni plaque ni VIN attribués, le champ resté en place
  conservé.
- ⚠️ `marqueCanonique` **NORMALISE sans valider** : elle rend
  « zzzzpasunemarque » pour une marque inventée. S'en servir comme contrôle
  laissait passer n'importe quoi — défaut trouvé par le test. La liste vient de
  `BRAND_ALIAS_GROUPS` **plus un complément** (`MARQUES_COMPLEMENT`), car la
  table d'alias n'existe que pour les marques AYANT des alias : SMART n'y était
  pas, et son CSA était refusé.
- Les espaces doubles du code source **n'arrivent pas à l'extraction** ; les
  libellés se **replient sur deux lignes**.

### Ordre des opérations — c'est un INVARIANT
`extraire → comparer (règle 0) → retirer VIN et plaque → garder les faits`.
La concordance a besoin des identifiants que le filtre doit retirer : l'ordre
est donc la garantie, et un test vérifie qu'aucun VIN ni plaque ne survit dans
les faits sérialisés.

### Produit
- Module **pur** `_shared/histovec.ts` (extraction + règle 0 + 5 règles), zéro
  IA, zéro réseau. Fonction `lecture-histovec` (`npm:unpdf@1.9.1`, extraction en
  mémoire, PDF **jamais stocké**, plafond 6 Mo, 10 lectures/IP/24 h, 5/analyse).
- ⚠️ **Un signal ROUGE est affiché même sans Pass** : on ne cache pas un vol, un
  gage ou une procédure non levée derrière un paiement. Le masquage du détail est
  **SERVEUR** (`_histovec_publique` ≡ `histovecPublique`), posé dans
  `get_public_analysis` au même endroit que celui de la négociation. La fonction
  est **redéclarée à l'identique** dans la migration plutôt que modifiée par
  chirurgie de chaîne sur `pg_get_functiondef` : une substitution peut
  s'appliquer à moitié sans que personne ne le voie.
- ⚠️ **Un rapport discordant ne produit AUCUN autre signal** — sinon on prêterait
  à cette voiture l'historique d'une autre.
- **Seuil de texte utile** (400 caractères) **+ contrôle des marqueurs** avant de
  retenir un seul fait. Mesuré : un PDF de 9 pages peut s'analyser sans erreur en
  ne rendant que **2 caractères** (c'était un scan). « Aucune erreur » ne vaut pas
  « lecture réussie » : sans ce seuil, l'écran afficherait « rapport lu, aucun
  signal », qui rassure à tort.

### Barème — `BAREME_VERSION` 11.1
Deux faits : `histovec_opposition` (plafond **30**) et `histovec_vge_en_cours`
(plafond **32**) — ce sont des **empêchements** (on ne peut pas devenir
propriétaire, ou pas circuler), donc plafonds plus bas qu'un défaut de sécurité.
Aucune garantie ne les lève dans le conditionnel.
- **SANS HistoVec, le score est strictement identique** : prouvé par
  `tests/bareme.test.mjs` sur 4 profils × 3 formes du même fait (champ absent,
  `undefined`, `false`). Et le contraire est testé aussi, sinon le premier test
  serait vrai pour la mauvaise raison.
- La version bouge quand même : la surface d'entrée a changé et les clients
  d'API suivent ce numéro. Mentionné aux CUA, art. 9.3.

### Kilométrage du PV — `lecture-ct` ne lisait que le relevé du jour
La section « Kilométrages relevés lors des précédents contrôles techniques
depuis le 20 mai 2018 » était **ignorée**. Format réel, relevé sur le modèle
officiel : **une seule ligne**, relevés séparés par `//`, au format
`02/08/2019 : 48330 Km // 13/08/2020 : 57428 Km`.
- `comparerKmCt` lit désormais la **SÉRIE** : un relevé qui recule entre deux
  contrôles officiels pose `compteur_contredit` **même quand l'annonce est
  cohérente** avec le dernier relevé — le fait grave est la série, deux chiffres
  imprimés par deux centres à deux dates.
- **Le signal rouge montre ses chiffres** : les relevés exacts avec leurs dates
  (« 17/01/2023 : 61 953 km → 22/01/2025 : 59 450 km ») et « vérifiez ces
  chiffres sur votre PV ». Une valeur mal lue se **corrige** (`corriger_km`), ce
  qui rejoue le barème **sans nouvel appel au modèle**.
- ⚠️ Les relevés sont **réordonnés par date** : la détection dépend de l'ordre,
  et le document liste souvent du plus récent au plus ancien.

### Message vendeur — il était FAUX
Il demandait « le VIN et une photo de la carte grise » pour « consulter le
rapport HistoVec ». **Un acheteur ne peut pas consulter HistoVec avec un VIN** :
seul le titulaire génère le rapport et le partage. Remplacé par la demande des
**deux documents nommés exactement** : le « Certificat de situation
administrative détaillé » (bouton « Imprimer le CSA ») et une photo du dernier
procès-verbal de contrôle technique.

### Fixtures
`tests/histovec-fixtures/` — sept CSA produits par le **générateur officiel**
(`csaAsPdf` + pdf-lib), donc fidèles à l'octet, **données entièrement
inventées**, donc versionnés. Chaque `.txt` est le texte réellement extrait :
le module prend du TEXTE, donc les tests hors ligne n'ont besoin d'aucun
analyseur PDF. `tests/histovec/` (rapports réels) et
`tests/eval-ct/publics/` (PV publics) sont **ignorés par git**.
- ⚠️ **Défaut trouvé par le test** : `{ ...FAITS_VIDES }` partageait la
  **référence** du tableau `operations` entre tous les appels — chaque lecture
  s'ajoutait aux précédentes (5 opérations là où le document en portait 3).
  `operations: []` est désormais explicite.

### ⬜ Reste à faire — la fonctionnalité n'est PAS en ligne
- **Aucun drapeau d'activation n'a encore été posé** : la fonction est déployée
  et le bloc est monté, mais rien n'a été validé sur un **vrai rapport récent**.
  C'est la condition posée par Utku avant mise en ligne.
- **PV publics non téléchargés** : `automotive.encheres-vo.com` redirige vers
  `/login` et `fiveauction.fr` rend **403**. Les documents sont derrière une
  authentification — je n'ai pas cherché à la contourner. Le PV synthétique
  porte désormais la section kilométrique, au format du modèle officiel.

### Drapeaux de fonctionnalité (migration `20261112120000`)
Table `drapeaux` (RLS active, zéro policy), trois états : **`eteint`** (défaut),
**`admin_uniquement`**, `public`. Onglet admin « Fonctionnalités ».
- ⚠️ Évalué **CÔTÉ SERVEUR** à chaque appel, via `drapeau_actif` appelée **avec
  le jeton de l'appelant** (elle a besoin de `auth.uid()` pour trancher
  « admin uniquement »). Un drapeau lu au navigateur ne ferait que cacher un
  bouton : la fonction resterait appelable.
- `admin_uniquement` est l'état qui compte : il permet d'éprouver une fonction
  **en production, sur de vraies données**, avant de l'ouvrir. `lecture_histovec`
  y est câblé et **éteint**.
- Clé inconnue ⇒ **éteint**. On n'ouvre pas une fonction par faute de frappe.

### ⚠️ Stabilité : la cause n'était PAS l'entretien — et mon premier correctif était FAUX
Mercedes 220 d, même texte : **77 puis 71**. Diagnostic (gratuit, en comparant
les deux analyses déjà produites) : faits d'entretien **identiques**, axe
entretien **13 dans les deux**, même fiche (`cache: hit`, OM654), zéro
affirmation écartée. L'écart venait de **`risques_mecaniques` (16 vs 13)** :
**2 pannes du catalogue retenues d'un côté, AUCUNE de l'autre**. Le modèle
CHOISIT quelles entrées citer, et ce choix varie.
- Correctif n° 1 — `_shared/pannesApplicables.ts` garantissant **toutes** les
  entrées applicables (filtres horizon km + code de boîte). **Déterministe
  (55/55/55) mais FAUX** : il a attribué à une Mercedes de 2025 des défauts
  d'**OM651**, de **M272/M273 (V6 essence)**, de boîte **722.9** et de caisses
  **W203/W211/W210**. Score tombé à **orange 55**. Leçon : *le modèle faisait un
  vrai travail d'appariement, et le filet l'avait supprimé.*
- ⚠️ **Le discriminant est la SOURCE de l'entrée.** Les réfs **`F…` viennent de
  la fiche moteur**, indexée par marque + famille + années : elles sont déjà
  propres à ce moteur. Les réfs **`A…` viennent de l'atlas de marque**, qui
  couvre toute la gamme — savoir si « Suspension Airmatic » concerne cette
  voiture suppose de connaître son équipement. **Le filet ne garantit donc que
  les entrées de FICHE** ; l'atlas reste au jugement du modèle.
- Filtres d'appariement généralisés par la même occasion : une entrée qui NOMME
  un code de **famille moteur**, de **caisse** ou de **boîte** ne s'applique que
  si c'est celui du véhicule. Si l'entrée nomme et que nous ne savons pas, elle
  est écartée — on n'affirme pas.
- Variance d'abord ramenée de 6 points à 2 (vert 73 / 71) — insuffisant : **près
  d'un seuil, 2 points changent le verdict**.
- ⚠️ **RÈGLE FINALE (4 nov. 2026) — une entrée d'ATLAS ne pèse sur le score que
  si l'annonce mentionne EXPLICITEMENT ce qu'elle vise** (équipement, génération
  ou code). Sinon elle reste **affichée** et devient une **question au vendeur**.
  Les entrées de FICHE restent garanties.
  - C'est ce qui rend le résultat déterministe **sans encoder l'équipement** :
    la décision ne dépend plus d'un jugement de modèle mais de la présence d'un
    mot dans un texte — vérifiable, reproductible, explicable à l'acheteur.
  - `ciblesAtlas` extrait ce qu'une entrée vise : codes (moteur, caisse, boîte)
    et noms propres d'équipement (« Airmatic »), hors mots génériques. Une
    entrée qui ne vise **rien de distinctif** n'est jamais confirmée : question.
    Conservateur à dessein — mieux vaut une question de trop qu'un point de
    score pris sur une supposition.
  - **Exceptions qui pèsent toujours** : un danger pour les occupants
    (`securite`) et un rappel officiel applicable. Ils ne dépendent pas d'un
    équipement.
- **Résultat : Mercedes 71 / 71 / 71**, et les deux références tiennent —
  S7 **rouge 38**, 308 **orange 55**. `BAREME_VERSION` → **11.3**, documentée
  aux CUA art. 9.3 avec un tableau des versions : `11.1` ne changeait aucun
  score rendu par l'API, `11.3` **en change** (la liste des défauts qui pèsent
  n'est plus le choix du modèle). La `11.2` n'a jamais été servie à un client.
- 42 contrôles hors ligne, dont 500 évaluations du même couple
  (entrée, annonce) sans divergence.
- 29 contrôles hors ligne, dont les **cinq titres réels** qui avaient été
  injectés à tort.

### ⚠️ Un essai de migration doit ASSERTER, pas afficher
Le premier script d'essai en transaction annulée comportait **16 `select`
d'information et un seul vrai contrôle**. Or **l'éditeur SQL de Supabase
n'affiche QUE LE DERNIER résultat** : la batterie de `select` était invisible,
et l'essai « passé sans erreur » ne prouvait que l'application des migrations —
aucun invariant n'était vérifié.
- Réécrit : **23 assertions** qui écrivent leur verdict dans une table
  temporaire, puis un bloc final qui **lève une erreur** en listant tout ce qui
  a échoué. Pas d'erreur = tout est vérifié, et le dernier résultat affiché le
  dit explicitement.
- Règle à garder : **un contrôle qui n'échoue pas bruyamment n'est pas un
  contrôle.** C'est la même leçon que le `process.exit(1)` placé avant les
  nouveaux tests dans `tests/inspection.test.mjs` au sprint 12.

### ⚠️ Droits d'anon : neuf tables sans `revoke` (trouvé par l'essai, corrigé)
L'essai a signalé qu'`anon` détenait SELECT sur `inspections`. Vérification par
un appel REST réel avec la clé anon : **HTTP 200, ZÉRO ligne**. **Aucune donnée
n'a été exposée** — la RLS, active et sans policy, bloque chaque ligne. Le
défaut est une **absence de défense en profondeur**, pas une fuite : il
suffirait qu'une policy soit ajoutée, ou la RLS désactivée le temps d'une
maintenance, pour qu'il devienne effectif. Ne pas raconter cet épisode comme
une fuite.
- **Origine** : les tables du **sprint 1** (`analyses`, `events`, `leads`,
  `rappels_cache`), du **sprint 7** (`passes`) et du **sprint 8**
  (`inspecteurs`, `inspections`, `inspection_photos`, `inspection_refus`)
  activent la RLS mais ne révoquent rien : elles ont hérité des **droits par
  défaut** que Supabase accorde dans `public`. Les tables plus récentes portent
  toutes un `revoke all` — l'habitude a été prise en route, après celles-là.
- **`authenticated` est révoqué aussi** : mesuré, **rien dans le front ne lit
  une table en direct** — 29 appels `.rpc(...)`, zéro `.from('table')` (les
  quatre `.from(` sont des `Array.from`). Aucun écran ne perd rien.
- Migration `20261113120000` : **boucle** sur tous les objets de `public`
  (tables, partitions, vues, vues matérialisées) plutôt qu'une liste — une
  liste oublierait les 8 tables héritées du dashboard, qu'aucune migration ne
  crée, et oublierait la prochaine. Elle **vérifie elle-même** l'état atteint et
  lève si un droit subsiste.
- ⚠️ **Cause racine traitée** : `alter default privileges … revoke all on tables
  from anon, authenticated`. Sans cela, la prochaine table créée héritera à
  nouveau des mêmes droits et personne ne le verra.
- L'assertion de l'essai ne porte plus sur une **liste de cinq tables** — c'est
  précisément ce qui avait laissé passer les neuf autres. Elle porte sur **tout
  le schéma public**, les deux rôles, en lecture **et** en écriture, plus la RLS
  et les droits par défaut. Une table ajoutée sans révocation fera désormais
  échouer l'essai.

### ⚠️ Ce que la révocation aurait pu casser : SECURITY INVOKER
Après la révocation, une fonction **SECURITY INVOKER** appelée avec la clé anon
ou un jeton utilisateur s'exécuterait avec les droits de l'appelant — donc sans
aucun droit sur les tables. Elle casserait **immédiatement et en production**.
Une seule aurait suffi.
- Inventaire des sites d'appel réels : **28 `.rpc()` dans le front** + **5 RPC
  appelées par une fonction edge avec le jeton de l'utilisateur**
  (`inspection_accepter`, `inspection_annuler`,
  `inspection_consentement_photos`, `inspection_constat_absence`,
  `inspection_refuser`, via `commeUtilisateur` / `commeAppelant`). **33 au
  total.** L'extension n'appelle aucune RPC : elle passe par les proxys Vercel,
  en service role.
- **Les 33 sont SECURITY DEFINER** (vérifié sur la dernière définition de
  chacune dans les migrations). Aucune ne manque.
- L'essai le vérifie sur l'état RÉEL (`prosecdef`), avec trois assertions :
  les 33 existent (sinon la vérification serait vraie pour la mauvaise raison),
  les 33 sont DEFINER, et — règle **qui se maintient d'elle-même** — toute
  fonction dont l'exécution est accordée à anon ou authenticated est DEFINER.
- **Essai réel sous le rôle `anon`** : `set local role anon`, appel de
  `get_public_analysis` (avec `p_track => false`, un essai n'incrémente pas un
  compteur) et de `get_prix_segments`, puis `reset role`. Plus la
  **contre-épreuve** : sous `anon`, la lecture DIRECTE de `analyses` doit
  échouer. Sans elle, le succès des RPC serait vrai pour la mauvaise raison —
  la révocation pourrait n'avoir pas pris.

### ⚠️ Cinq fonctions SECURITY INVOKER exécutables par anon (trouvé par l'essai)
L'assertion générale « toute fonction exécutable par anon est DEFINER » a
immédiatement trouvé cinq cas — alors que la liste nommée des 33 RPC, elle,
passait. C'est l'intérêt d'une règle qui se maintient d'elle-même par rapport à
une énumération.
- **`essai_verifie`** : mon propre outil de mesure, créé dans `public`, se
  signalait lui-même. Déplacé dans **`pg_temp`** — l'outil ne doit pas peser
  sur ce qu'il mesure.
- **`update_updated_at`** : fonction de trigger. EXECUTE révoqué de `public`,
  `anon`, `authenticated` — PostgreSQL ne vérifie pas EXECUTE au déclenchement
  d'un trigger, c'est donc sans risque.
- **`_departement`, `charte_version_courante`, `part_api_max`** : vérifié,
  **aucune n'est appelée par le front ni par l'extension** (`p_departements`,
  dans `inspectionApi.js`, est un nom de paramètre, pas un appel). Elles sont
  appelées depuis d'autres fonctions SQL, où `current_user` est le
  propriétaire. EXECUTE révoqué.
- **Cause racine** : PostgreSQL accorde EXECUTE à `PUBLIC` sur toute fonction
  nouvelle. Inversé par `alter default privileges for role postgres … revoke
  execute on functions`, et la migration **vérifie elle-même** que les 33 RPC
  conservent leur grant — révoquer un défaut ne doit rien retirer à l'existant.

### ⚠️ Droits par défaut : une entrée n'est pas à nous
Il reste dans `pg_default_acl` une entrée appartenant à **`supabase_admin`**
(`anon=arwdDxtm/supabase_admin`) que nos migrations, qui tournent en
`postgres`, **ne peuvent pas modifier**. L'assertion sur les droits par défaut
est donc restreinte au rôle `postgres`, celui qui crée nos objets.
- Ce n'est pas un assouplissement : le filet contre une table créée autrement
  reste l'assertion **globale** « `anon` ne peut lire AUCUN objet de `public` »,
  qui ne dépend d'aucun propriétaire et attraperait le cas.

### Mise en service partielle — 3-4 nov. 2026 (merge EN ATTENTE)
`score`, `lecture-ct` et `lecture-histovec` déployées pour l'éval. Migration
`20261111120000` **non appliquée**.
- **Éval ciblée : S7 rouge 38 et 308 orange 55, identiques à la référence.**
  Mercedes a rendu **77 au premier passage, 71 au second** — la référence est 71.
  Vérifié sur l'analyse produite : ni fait HistoVec, ni plafond, ni fourchette de
  prix, donc **le barème n'est pas en cause** ; c'est la variance d'extraction des
  faits d'entretien. ⚠️ 6 points d'écart, soit **au-delà de la tolérance de 5**
  de l'éval de stabilité : à surveiller sur ce cas. Coût total **0,38 €**.

## Sprint 14 — Visio guidée, partout en France (nov. 2026)

### Deux prestations, un seul circuit
Table **`PRESTATIONS`** dans `_shared/inspection.ts`, indexée par
`inspection | visio` : prix, part inspecteur, zone, délai d'annulation
gratuite, retenue, délai de compte rendu, attente avant constat d'absence.
Côté base, une **colonne `type`** sur `inspections` — pas une table `visios` :
toute la machinerie d'argent est réutilisée sans une ligne dupliquée.
- Visio : **59 €**, dont **40 € à l'inspecteur en MONTANT FIXE** (40/59 vaut
  67,7966 % — un ratio obligerait à arrondir là où le contrat annonce un
  chiffre rond), **France entière**, compte rendu sous **2 h**.
- ⚠️ **L'inspection n'a pas bougé** : `tests/inspection.test.mjs` fige les
  valeurs d'avant le sprint et vérifie que sans type passé le barème rend la
  même décision. Invariant monétaire sur 20 000 cas, les **deux** prestations.
- **Annulation visio gratuite à tout moment avant le créneau** (aucun
  déplacement engagé). La retenue de **20 €** ne vient pas d'une annulation
  tardive mais d'une **absence**, constatable seulement **15 min** après
  l'heure du rendez-vous (`absenceConstatable`, qui refuse aussi sur un
  créneau inconnu).
- ⚠️ Pour une visio, l'inspecteur **ne peut pas photographier** une voiture
  qu'il ne voit pas : `inspection_constat_absence` n'exige la photo que pour
  une inspection. La preuve d'une absence en visio est le délai d'attente plus
  l'arbitrage exploitant — exiger une image aurait conduit à en fabriquer une.

### Vidéo : Whereby Embedded
Retenu contre LiveKit Cloud et LiveKit auto-hébergé. Le point décisif n'est pas
le prix mais l'**hébergement** : « users in European countries will connect to a
data center physically located within the EEC », DPA publié, et « Media sent
between participants in a room will not be stored ». LiveKit ne documente
aucune résidence de données hors du plan à 500 $/mois.
- Coût : **0,0042 $/minute-participant**, soit ≈ 0,29 $ par visio de 35 min à
  deux — **0,5 % d'une vente de 59 €**. LiveKit serait 8× moins cher, pour un
  gain de 0,25 $ qui ne paie pas une journée d'intégration.
- ⚠️ **Le palier gratuit plafonne à 30 min par réunion**, or l'appel dure 30 à
  40 min : le plan Build (10,99 $/mois) est à souscrire **avant la première
  visio réelle**, pas après.
- ⚠️ **L'enregistrement n'est jamais demandé** : aucun champ de la requête ne
  l'active, et les CGV l'affirment. Ajouter `recording` dans
  `_shared/whereby.ts` contredirait un document contractuel.
- ⚠️ **Le lien n'est pas un droit d'entrée.** `fenetreVisio` (−15 min, +90 min)
  est vérifiée **serveur** à chaque demande (`visio-acces`) : une URL recopiée
  hors fenêtre ne donne rien.

### Ce que la visio ne peut pas faire — et le dire est le produit
`pointsNonVerifiables` déduit de la **checklist du véhicule** (même source que
le mode visite) ce qui reste hors de portée, en trois familles : passer **sous**
la voiture, **démonter** ou brancher un outil, **conduire**. La liste figure au
compte rendu, et `compteRenduConforme` interdit « expertise », « valeur du
véhicule » et « cote ».
- **Aucune coordonnée du vendeur n'est collectée** pour une visio : l'acheteur
  est lui-même devant la voiture. Un formulaire qui les réclamerait collecterait
  les données d'un tiers sans aucun usage.

### ⚠️ Le garde-fou qui a trouvé un vrai défaut dès sa première exécution
`tests/fonctions-redefinies.test.mjs` compare, pour chaque fonction SQL
redéfinie, les colonnes rendues avant et après. Une colonne qui disparaît sans
être **nommée dans la migration qui la retire** fait échouer la suite.
- Il a immédiatement signalé que j'avais repris le corps d'`inspecteur_missions`
  du **sprint 8** au lieu du **sprint 8-audit**, perdant `photos_consentement_le`
  — et surtout le garde-fou interdisant à un inspecteur **sans versement actif
  ou à l'assurance RC pro expirée** de voir la moindre mission. Même chose sur
  `inspection_accepter` : Connect, assurance, et fenêtre de créneau +1 h/+72 h.
  **Un inspecteur sans assurance valide aurait pu prendre une mission.**
- ⚠️ `inspecteur_missions` ET `inspection_accepter` filtraient aussi sur
  `i.departement = any(v.departements)` : une visio, sans zone, n'aurait jamais
  été ni visible ni acceptable — liste vide, aucune erreur.

### ⚠️ La porte de sortie des tests, dépassée une TROISIÈME fois
Mes nouveaux blocs s'exécutaient après `process.exit(1)` : la suite sortait en 0
avec des `FAIL` à l'écran. Elle est désormais la **dernière instruction** de
`tests/inspection.test.mjs` et **fusionnée avec le message de succès** — on ne
peut plus afficher « tous les tests passent » sans avoir franchi le contrôle.

### Mise en service — FAITE le 4 nov. 2026
1. dumps prod hors dépôt (`schema-avant-sprint14-…` 153 Ko + `data-public-avant-sprint14-…`
   9 Mo, 38 tables) ; 2. `scripts/essai-local.sh` : **34 migrations rejouées
   depuis une base vide**, 33/33 assertions ; 3. `db push --remote --yes` :
   `20261114120000` appliquée (une seule en attente) ; 4. 19 suites hors ligne
   OK ; 5. merge `sprint14` → `main` et push, déploiement Vercel **Ready** ;
   6. **cinq** fonctions déployées.
- ⚠️ **J'ai redéployé `inspection-annuler` en croyant qu'elle importait
  `_shared/inspection.ts` : c'est FAUX.** Elle n'importe que `notify.ts` et
  `inspectionArgent.ts`, et aucun des deux ne mène au barème ; la chaîne que
  j'avais « trouvée » venait d'un `grep` qui avait matché une occurrence en
  **commentaire**. Le redéploiement était inutile (inoffensif, mais inutile),
  et la leçon que j'en avais tirée était construite sur du sable.
  **`scripts/fonctions-a-redeployer.mjs` a rendu 4 fonctions là où j'en
  annonçais 5, et c'est le script qui avait raison.**
- Vérifié en production : **308 PureTech → orange 55**, sa référence (0,121 €) ;
  `drapeau_actif` rend **false** pour `visio_guidee` et `lecture_histovec` ;
  `pass-checkout` `actif:false` ; `inspection-checkout` `ouvert:false` pour les
  **deux** types et **409** sur un POST visio ; `visio-acces` **401** ;
  `/cgv-visio` pré-rendue (21 Ko lisibles sans JavaScript) ; espace inspecteur
  et `/visio/:id` sans erreur JavaScript, **zéro débordement à 390 px** ; sur un
  vrai dossier, aucun bloc visio ni HistoVec et l'inspection repliée en liste
  d'attente. Captures `captures-sprint14/prod-*.png`.
- ⚠️ **Défaut trouvé par cette vérification** : le contrôle `MEDIATEUR_NOM`
  précède la lecture du corps de la requête, donc le type de prestation n'est
  pas encore connu — une demande de **visio** recevait « L'inspection n'est pas
  encore ouverte ». Message rendu neutre (branche
  `fix-message-prestation-fermee`, non mergée).

### ⚠️ Ce que la vérification de mon erreur a trouvé : le barème SQL ignorait le type
En allant voir POURQUOI le script me contredisait, j'ai trouvé un vrai défaut,
plus grave que celui que je croyais avoir évité. Le sprint 14 a factorisé les
montants par prestation **en TypeScript** (`PRESTATIONS`), mais les deux
fonctions SQL qui décident de l'argent avaient gardé les constantes de
l'inspection **en dur** : `24` heures et `least(4000, prix_cents)`.
- Sur une visio de 59 €, si le drapeau avait été allumé : annulation à moins de
  24 h du créneau ⇒ **40 € retenus** alors que la visio s'annule **librement**
  jusqu'au créneau ; absence constatée ⇒ **40 € au lieu des 20 €** annoncés aux
  CGV. Deux montants contractuels faux, au détriment de l'acheteur.
- **Jamais atteint en production** : `visio_guidee` est éteint depuis le
  premier jour et aucune visio n'a pu être commandée. C'est un défaut de code,
  pas un incident — ne pas le raconter autrement.
- ⚠️ **Le commentaire en tête de `inspection-annuler/index.ts` affirmait que
  TypeScript et SQL étaient « vérifiées concordantes par
  tests/inspection.test.mjs ». Aucun test ne lisait le SQL.** Une affirmation
  de concordance dans un commentaire n'est pas une concordance : c'est elle qui
  a endormi la vigilance au moment de factoriser.
- Correctif (migration `20261115120000`) : **une seule source SQL**,
  `prestation_bareme(type)`, dont `tests/inspection.test.mjs` vérifie qu'elle
  énonce exactement les nombres de `PRESTATIONS`, et qu'aucune des deux RPC ne
  les recopie à côté. Vérifié que le test mord (2000 → 2500, et fenêtre remise
  en dur : échec dans les deux cas).
- ⚠️ L'assertion de `scripts/essai-migration-annulee.mjs` cherchait la chaîne
  **`least(4000`** — elle vérifiait donc la **présence de la constante
  fautive**. Un contrôle écrit en recopiant le code qu'il surveille valide le
  défaut au lieu de le trouver. Réécrit sur la **propriété** : retenue bornée
  par l'encaissé **et** lue dans le barème du type, pour les deux RPC.

### `scripts/fonctions-a-redeployer.mjs` — à lancer à CHAQUE mise en ligne
Il lit les imports réels du code, construit le graphe **inverse** et remonte
**transitivement** (un module `_shared` peut en importer un autre) : à partir
des fichiers modifiés — commités ou non — il nomme toutes les fonctions edge à
redéployer, y compris celles qu'aucun `git diff --name-only` ne cite.

```sh
node scripts/fonctions-a-redeployer.mjs sprint15   # depuis une réf
node scripts/fonctions-a-redeployer.mjs --commande # juste la ligne à coller
```
- Il **sépare** les fonctions à déployer avec **`--no-verify-jwt`**
  (`pass-webhook`, `inspection-webhook`, `desinscription`) : leur
  authentification est dans le code, oublier le drapeau casse un webhook de
  paiement ou tous les liens de désinscription déjà envoyés. Si l'une d'elles
  disparaît du dépôt, le script **s'arrête** plutôt que de laisser la liste
  pourrir.
- Il signale aussi un module `_shared` **importé par personne**.
- Il ne sait pas qu'un changement est purement rédactionnel : il surdéploie
  plutôt que de sous-déployer, ce qui est le bon sens de l'erreur.

### Captures
`scripts/captures-visio.mjs` (dossier `captures-sprint14/`, gitignoré). Deux
pièges rencontrés, tous deux visibles seulement sur l'image :
- ⚠️ chez Playwright, **la route enregistrée EN DERNIER gagne** : mon
  fourre-tout Supabase interceptait aussi `visio-acces`, et l'écran affichait
  « Aucune checklist pour ce véhicule » ;
- ⚠️ un `iframe` en `height:100%` dans un parent à `minHeight` ne remplit rien :
  une bande noire sous la vidéo. Hauteur **définie** désormais.

## Sprint 15 — Abonnement pro et fiabilité mesurée (nov. 2026)

### Liste d'attente « Abonnement pro »
Seconde section de `/pro` : email, **activité** et **tranche d'annonces par
mois**, toutes deux en listes fermées — aucun champ libre, donc aucune
description d'entreprise collectée. **Ni prix ni date** : la formule n'existe
pas, et une échéance annoncée puis manquée coûte plus cher que le silence.
- `leads_pro` gagne `type` (`api` | `abonnement`), `activite`,
  `annonces_par_mois` plutôt qu'une seconde table dont la moitié des colonnes
  serait identique. ⚠️ `submit_lead_pro` est **DROP puis CREATE** : ajouter des
  paramètres à valeur par défaut aurait créé une SECONDE fonction, et l'appel à
  quatre arguments serait resté résoluble — donc une ligne aurait pu entrer
  sans type. Même raisonnement que pour `agreger_marche` au sprint 12.
- Compteur dans l'admin, onglet **Parcours** (c'est une mesure de demande) :
  **agrégé par activité et par volume**, jamais une adresse à côté d'une
  réponse. Politique de confidentialité : sections 2.f bis et 6 octies.

### ⚠️ La page « taux d'erreur » existait — et n'avait jamais rien mesuré
`/fiabilite` était en ligne depuis le sprint 3, avec sa promesse reprise sur
l'accueil : « publié dès 50 dossiers relus à la main ». La table `audits`
comptait **0 ligne** un mois plus tard. Une mesure qui exige un geste manuel
par affirmation n'est pas une mesure, c'est une promesse — et elle était
affichée au public.
- La méthode publiée devient la **vérification indépendante**, seuil **30**.
  La relecture humaine est **conservée** (table, écran, RPC) et affichée comme
  une mesure **distincte** quand elle a des lignes : deux méthodes, deux
  chiffres, jamais additionnés.
- `get_fiabilite` est redéfinie **sans retirer une seule clé** : ce qui change
  est ce que `publie` et `seuil` gouvernent.

### Le dispositif de vérification
`_shared/affirmations.ts` (PUR, 52 contrôles hors ligne) extrait les
affirmations et **la source que chacune cite**. La fonction `verification`
(admin ou `x-eval-secret`) lit la page et la confronte à l'affirmation.
- ⚠️ **Le passage de vérification ne voit ni le score, ni le verdict, ni les
  raisons, ni le raisonnement.** Il reçoit l'affirmation, le texte de la page,
  et **l'identité du véhicule** — un fait de l'annonce, sans lequel
  « mauvais moteur » serait indécidable. `tests/affirmations.test.mjs` lit le
  source de la fonction et **interdit dix termes** dans le corps du message
  envoyé au modèle. Un passage qui verrait l'analyse ne vérifierait pas, il
  confirmerait.
- Trois verdicts (`soutenue`, `non_soutenue`, `mauvais_moteur`) plus deux
  constats (`source_absente`, `source_injoignable`). Le doute tranche **contre**
  l'affirmation, et le **silence du modèle ne vaut pas accord**.
- Une page = un appel : les affirmations qui partagent une source sont
  regroupées. Vérifier la même phrase contre quatre pages multiplierait le coût
  sans rien apprendre.

### ⚠️ 55 % des affirmations ne citent AUCUNE page publique
Mesuré en passant le module sur les **505 `result_json`** du dump de
production : 5,1 affirmations par analyse, **1,62 page distincte à lire**, et
**55 % d'affirmations sans source publique**. La cause est structurelle : le
**Defect Atlas ne porte aucune URL** (vérifié : zéro dans
`src/data/defectAtlas.js`), ses pannes s'affichent « source : base Inspexo ».
- Elles sont comptées **à part**, jamais fondues dans le taux. Les y verser
  serait injuste — elles ne sont pas réfutées, elles sont invérifiables ; les
  taire laisserait croire que tout a été contrôlé. La page donne les deux
  nombres côte à côte, et le dénominateur publié (`verifiables`) exclut
  explicitement les invérifiables et les pages illisibles.
- ⚠️ **Conséquence sur le seuil de 30** : le dénominateur sera d'environ
  **70 affirmations vérifiables**, donc **une erreur pèse ~1,4 point**. Le taux
  publié sera bruyant tant que l'échantillon n'aura pas grossi.

### Plafond de 5 analyses/24 h levé pour l'admin
`adminIllimite` dans `score`, rôle lu **en base** (`estAdminUserId`), jamais
déduit d'un email ni d'un en-tête. Même construction que `pass` et `isApi` :
le drapeau décide **quel compteur s'applique**, jamais ce que vaut le verdict.
`tests/independance-score.test.mjs` **énumère ses 4 usages** et interdit toute
ligne le portant qui toucherait au score — vérifié que les deux gardes mordent.

### Coût — estimé AVANT de lancer quoi que ce soit
`node scripts/verifier-analyses.mjs --estimer --combien 50` ne dépense rien.
Compteur propre `.verification-cout.json`, plafond 6 € par défaut.

| | 30 analyses | 50 analyses |
|---|---|---|
| Vérification (0,029 €/analyse, mesuré) | 0,87 € | 1,45 € |
| Analyses elles-mêmes (≈ 0,12 €) | 3,60 € | 6,00 € |
| Nouvelles fiches moteur (≈ 0,30 €, ~1 sur 2) | ≈ 4,50 € | ≈ 7,50 € |
| **Total** | **≈ 9 €** | **≈ 15 €** |

La vérification est la partie **la moins chère** : ce sont les analyses, et
surtout les fiches moteur à générer pour des familles non couvertes, qui font
le budget.

### Sprint 15.1 — « source : base Inspexo » n'est pas une source
Décision d'Utku du 4 nov. 2026. Tant qu'une entrée du Defect Atlas n'a pas
d'**URL publique**, elle **ne s'affiche plus comme une panne**. Elle devient
une **question au vendeur**, sans le mot « panne » ni « défaut », et **sans
effet sur le score — même quand l'annonce mentionne ce qu'elle vise** (ce qui
abroge, pour ces entrées, la règle du sprint 13 ; celle-ci reste en vigueur
pour les entrées d'atlas qui auront une source).
- `sansSourcePublique` / `questionSansSource` dans `_shared/pannesApplicables.ts`.
  Le retrait a lieu **avant le barème, la négociation et la composition du
  dossier** — une entrée retirée ne laisse de trace ni dans la note, ni dans la
  marge. Event `panne_sans_source_retiree`. **`BAREME_VERSION` → 11.4.**
- ⚠️ **LE CAS QUI AURAIT TOUT CASSÉ** : la courroie de la 308 existe dans
  l'atlas (gravité plus sévère, zéro URL) **et** dans la fiche EB2 (quatre
  URLs). La déduplication amont garde la réf de l'**atlas** mais **fusionne les
  URLs des deux** — l'entrée fusionnée cite donc des pages et n'est pas
  retirée. Sans cette fusion, la règle supprimait la panne centrale du dossier.
  Vérifié en production : la courroie sort avec `statut base_inspexo` ET
  4 URLs. Un test dédié fige ce comportement.
- **Verdicts de référence INCHANGÉS** : S7 rouge 38, 308 orange 55, Mercedes
  vert 71 (0,30 €). ⚠️ À dire honnêtement : dans ces trois dossiers, **chaque
  panne affichée citait déjà au moins une page** — la règle n'y retire rien, et
  c'est pourquoi rien ne bouge. Son effet se verra sur les marques où l'atlas
  est fourni et la fiche mince. Les trois cas prouvent l'absence de régression,
  pas l'exercice de la règle.

### Promesses publiques : plus rien de figé dans un fichier
- **Accueil** : « publié dès 50 dossiers relus à la main » est remplacé par la
  méthode réelle **et un état LU EN BASE** (`EtatFiabilite`, appelle
  `get_fiabilite`). ⚠️ Cette ligne a menti pendant un mois parce qu'elle était
  écrite en dur : **une promesse figée dans un fichier ne se dément jamais
  toute seule**. Toute phrase qui annonce un état doit lire cet état.
- **`/fiabilite`** : les **nombres bruts** (« 2 sur 70 ») sont donnés à côté du
  taux, et l'**intervalle de Wilson à 95 %** tant qu'il est large.
  `src/lib/intervalle.js` (pur, `tests/intervalle.test.mjs`, 26 contrôles).
  - Wilson et non l'approximation normale : à 0 erreur sur 70, la normale rend
    un intervalle de **largeur nulle** — elle ferait dire « 0 % d'erreur »
    quand la vérité est « au plus 5 % ». Le seuil d'affichage porte sur la
    **largeur** (≥ 2 points), pas sur n : c'est la largeur qui dit si le
    chiffre est solide.
  - ⚠️ **Un taux publié sans son incertitude affirme plus que ce que les
    données permettent.** À 30 analyses le dénominateur fera ≈ 70 affirmations
    et l'intervalle ≈ 9 points.

### Sprint 16 préparé, NON lancé — sourcer le Defect Atlas
`docs/sprint16-sourcer-atlas.md`. **30 entrées, 6 marques, zéro URL**, mais les
30 portent `models` et `years` : la cible est explicite. Méthode reprise de
`sheet-builder` (≥ 1 URL, montant/code vérifié littéralement, au moins une
source nommant le moteur ou la caisse, gravité jugée sur le remède, **entrée
retirée si rien n'est trouvé**), puis repassage par le dispositif de
vérification du sprint 15 — se citer soi-même est précisément la faute à ne pas
refaire. **≈ 8,50 €**, plafond proposé 10 €.
- ⚠️ **Une option B existe et mérite d'être pesée** : retirer l'atlas. Ses
  6 marques sont déjà couvertes par 29 des 48 familles moteur, et les fiches
  sont sourcées par construction. Sur la courroie de la 308, l'apport réel de
  l'atlas était **un jugement de gravité, pas une connaissance**.

## Sprint 16 — Sourcer le Defect Atlas (4 nov. 2026)

**30 entrées passées au crible : 10 gardées, 20 retirées, 5 gravités rejugées**
(après le rattrapage PDF). Coût **6,82 €** sur un plafond de 10 €. Verdicts de référence **inchangés** :
S7 rouge 38, 308 orange 55, Mercedes vert 71.

### Le dispositif — quatre étapes, et l'ordre EST la garantie
`atlas-builder` : recherche web (≤ 3 requêtes) → **filtre déterministe** (page
lisible ET portant ≥ 2 marqueurs distinctifs de l'entrée) → **vérification
indépendante** → gravité rejugée sur le remède.
- ⚠️ L'étape de vérification emploie **le juge de `/fiabilite`**, extrait dans
  `_shared/verifSource.ts` et partagé mot pour mot. Si le sourcing se relisait
  avec un prompt plus doux que celui de la mesure publiée, le taux de
  `/fiabilite` flatterait des entrées que **sa propre méthode** aurait recalées.
  Le test d'indépendance contrôle désormais les deux fichiers.
- Elle ne voit **ni la recherche, ni ce que l'étape 1 a conclu** : sans ce
  cloisonnement, le sourcing se relirait lui-même — la faute exacte que le
  sprint 15 a corrigée.

### ⚠️ Le défaut trouvé par la première campagne réelle : le prix dans le paquet
Premier passage sur BMW : **4 entrées sur 5 retirées**, dont la **chaîne de
distribution N47** — l'un des défauts les mieux documentés de la marque.
Cause : la description de l'atlas finit par « Coût constaté : 2 500 à 4 500 € ».
Soumise telle quelle, l'affirmation devient un **paquet** : une page qui atteste
parfaitement le défaut mais ne donne aucun prix est jugée « non soutenue », et
l'entrée disparaît.
- `affirmationSansCout` (`_shared/atlasSource.ts`) retire la phrase de coût
  avant vérification. Le coût suit son propre chemin : retenu seulement s'il est
  publié, il ne décide **jamais** du sort de l'entrée. Après correction, le N47
  est gardé.
- ⚠️ Vérifié sur l'atlas d'origine : la forme « coûte 450 EUR », que la
  première regex manquait, **n'apparaissait dans aucune entrée** — la campagne
  n'en a donc pas souffert. Le test couvre quand même les quatre formes.

### ⚠️ Un risque CRÉÉ par le sourcing, et attrapé avant l'éval
Tant que l'atlas n'avait pas d'URL, une entrée nommant un moteur étranger —
« Consommation d'huile 2.0 TFSI **EA888** » pour une S7 en **EA824** — ne
pouvait pas nuire : la règle du sprint 15.1 la retirait de l'affichage.
**Sourcée, elle redevenait citable**, et le cas d'éval de la S7 interdit
explicitement le mot « EA888 ».
- `entreeApplicable` ne protège que la liste garantie et ne juge **jamais** les
  entrées d'atlas. Le filtre est donc posé **sur le CATALOGUE**, avant qu'il ne
  soit présenté au modèle (`codeEtranger`, au même endroit que le filtre de
  code de boîte) : **ce qui n'est jamais montré ne peut pas être cité.**

### ⚠️ On ne promeut jamais une gravité sans coût publié
La fonction retombe sur « majeure » quand aucune page ne donne de prix — ce qui,
pour une entrée notée MINEUR, serait une **aggravation décidée par défaut**. Un
défaut ne devient pas plus grave parce que personne n'en a publié le prix. Sans
coût sourcé, le rang d'origine est conservé (appliqué en phase `--appliquer`,
donc sans repayer la collecte).

### Résultats
- **Gardées (9)** : BMW N47 · Audi EA888 consommation d'huile (**casse**,
  3 000-5 500 € sourcés) et pompe CP4 (**casse**, 4 000-6 000 €) · Mercedes
  corrosion W203/W211/W210 · Peugeot courroie PureTech (2 sources, 850-1 500 €)
  et distribution EP6 · Renault injecteurs Delphi K9K · VW chaîne 1.4 TSI et
  séquelles Dieselgate EA189.
- **Retirées (21)**, motif dominant : aucune source de rang 1 ou 2, **seuls des
  forums et des pages commerciales de garages**. Exemple : « Vanne EGR et FAP
  encrassés (diesel) » — ma-bmw.com, forum-bmw.fr, carbon-cleaning, re-fap.
- **Pages écartées** : 28 « non soutenue » (le juge), 22 **illisibles**, 3
  « mauvais moteur », 3 hors sujet. ⚠️ **Les 22 illisibles sont un biais contre
  les meilleures sources** : ce sont surtout des PDF (notes techniques NHTSA,
  documents constructeur) que l'extracteur ne lit pas. À traiter avec `unpdf`,
  déjà utilisé par `lecture-histovec`.
- **Effet mesuré** : sur une analyse 308 produite après le sourcing, **1
  affirmation sur 9 sans source publique (11 %)**, contre **55 %** mesurés sur
  les 505 analyses d'avant.

### Décisions appliquées (les 4 questions du document de préparation)
1. **Option A** — sourcer, pas retirer l'atlas.
2. **Plafond 10 €** — 6,70 € dépensés, compteur `.atlas-cout.json`.
3. **Forums en appui seulement** — un forum ne porte jamais une entrée seul,
   côté prompt **et** côté serveur (`nonForum.length > 0`). C'est le motif de
   retrait le plus fréquent.
4. **Gravité qui descend : on garde l'entrée avec sa nouvelle gravité** — c'est
   l'information juste. BMW N47 passe de CRITIQUE à `majeure` et reste publiée.

### Rattrapage PDF et affichage (4 nov. 2026, décidé après le rapport)
- **Les PDF sont lus** (`unpdf` branché sur `texteDeLaPage`, partagé). Les 22
  pages écartées « illisibles » étaient surtout des **notes techniques NHTSA et
  des documents constructeur** — les sources de rang 1. Refuser le format le
  plus fiable biaisait la mesure contre les meilleures preuves.
  - Relues et repassées par la **vérification indépendante** : **1 entrée
    rattrapée** (Renault 1.2 TCe H5Ft). Les NHTSA sont revenues
    « non soutenues » sur le fond, les autres pages sont réellement
    injoignables (429, 410). **L'atlas publié compte 10 entrées sur 30.**
  - ⚠️ Le relevé enregistre le verdict du **second passage même quand il ne
    sauve rien** : laisser « page illisible » pour une page qu'on vient de lire
    et de rejeter sur le fond serait un compte rendu faux.
- **Affichage : les liens d'abord, l'étiquette ensuite.** Une entrée qui cite
  des pages s'affiche comme une fiche moteur, « Sources : » suivi des liens.
  ⚠️ `numsPourPanne` court-circuitait sur `base_inspexo` **avant** de regarder
  les URL : la courroie de la 308 — entrée fusionnée portant l'étiquette du
  catalogue **et quatre pages publiques** — n'affichait aucun lien. Vérifié en
  production : **14 liens de sources**, plus aucune panne étiquetée
  « base Inspexo ».
- ⚠️ **Garde-fou sur `--appliquer`** : il refusait de voir qu'il tournait sur
  un atlas **déjà réécrit**. Lancé deux fois, il lisait sa propre sortie — « 0
  retirées » — et l'entrée rattrapée était impossible à réintégrer, **en
  silence**. Il compare maintenant le nombre d'entrées d'entrée au nombre de
  résultats du relevé et s'arrête.
- ⬜ **L'atlas s'arrête là.** Son extension à d'autres marques sera décidée
  après la mesure de fiabilité — c'est elle qui dira si la méthode vaut la
  dépense.

## Sprint 17 — Surveillance et leviers de trafic (nov. 2026)

### Surveillance
- **Quatre motifs d'alerte**, une seule mécanique (`_shared/alerting.ts`),
  **une alerte par motif et par heure**, objet préfixé `[URGENT] Inspexo — `.
  Le bilan quotidien porte `[Bilan] Inspexo — JJ/MM/AAAA`. ⚠️ **Ces préfixes
  sont des FILTRES de boîte mail** : les changer ne casse rien visiblement,
  mais les alertes n'arrivent plus dans le bon dossier — et une alerte qu'on
  ne voit pas n'existe pas. Figés par `tests/alerting.test.mjs`.
- ⚠️ **Une surcharge passagère n'alerte PAS** (429, 529, « overloaded ») :
  elle se résout seule. Seuls le crédit épuisé et la clé invalide alertent,
  parce qu'ils **ne se résolvent pas** sans intervention. `estCreditOuCle` est
  pure et testée dans les deux sens, y compris le piège « Overloaded: quota
  temporarily exceeded » — qui reste une surcharge.
- ⚠️ **Base muette ⇒ on n'envoie pas.** `dejaAlerte` rend `true` quand la
  lecture du témoin échoue : une base qui ne répond pas est déjà un incident,
  y ajouter une boucle d'emails l'aggrave.
- **Seuils en base** (`config`), modifiables sans redéploiement. Un seuil dans
  le code se change par un déploiement, autant dire qu'il ne se change pas.
- **Bilan quotidien** porté par le cron EXISTANT — un second cron serait une
  seconde chose capable de s'arrêter sans bruit. ⚠️ Le coût **inclut** l'éval
  (argent réellement dépensé), les volumes **l'excluent** (ce n'est pas du
  trafic). ⚠️ 07:00 **UTC** = 8 h l'hiver, **9 h l'été** : le bilan porte son
  heure d'envoi plutôt que de déplacer le cron deux fois par an.
- **`/api/sante`**, public et sans secret. ⚠️ **Aucune donnée d'affaires** : ni
  volume, ni chiffre, ni date de dernière analyse — une URL publique ne doit
  pas laisser déduire le trafic. ⚠️ Et **elle ne juge pas sur le volume** : un
  contrôle rouge faute d'analyse récente serait rouge en permanence
  aujourd'hui, et un voyant toujours rouge ne se regarde plus.
  - L'alerte « fonction en erreur » part de là, **seulement en cas de panne
    détectée**, via la tâche `sante` de la fonction `alertes` — réemploi de
    `CRON_PROXY_SECRET`, aucun secret nouveau à faire tourner.
- Mode d'emploi du moniteur externe : `docs/surveillance.md` (**UptimeRobot**,
  plus **Healthchecks.io** pour le cron — un cron qui cesse de tourner ne
  produit aucune erreur, seul un dead-man's switch voit une absence).

### Image de partage par dossier
`api/og-image` (`@vercel/og`) : marque, modèle, année, tampon, score — **rien
que ce que la page publique affiche déjà**. Une image de partage voyage plus
loin que la page (aperçus, caches, captures) : elle en dit **moins**, jamais
plus.
- ⚠️ **DÉFAUT TROUVÉ EN RENDANT L'IMAGE EN LOCAL AVANT DE DÉPLOYER** :
  `ImageResponse` pose son propre `Cache-Control: public, immutable,
  max-age=31536000`, et l'en-tête passé en option **s'ajoute au lieu de le
  remplacer**. La réponse sortait avec deux directives, et c'est la première
  qui gagne : une image d'analyse **en cours** aurait été figée **un an** sur
  « ANALYSE EN COURS », l'aperçu ne montrant jamais le verdict. L'en-tête est
  désormais **réécrit** sur une `Response` neuve.
- Police : celle de `@vercel/og`. Nos fontes sont en **woff2**, que Satori ne
  lit pas, et aller chercher un ttf à chaque rendu ajouterait un aller-retour
  dans un chemin que les robots d'aperçu coupent vite. Mise en page, couleurs
  et tampon suivent la charte ; la fonte, non.
- ⚠️ Le rendu Satori **n'est pas vérifiable hors ligne** (le paquet Node
  réclame `hb.wasm` et un `require` dynamique). Vérifié localement : statut
  200, `image/png`, en-tête de cache correct. Les captures
  `captures-sprint14/s17-og-*.png` sont un **aperçu de mise en page**, pas le
  rendu réel — à confirmer sur la préversion.

### Takata : la page existait, elle manquait l'année
⚠️ **Ne PAS créer `/takata`** : `/airbags-takata` existe depuis le sprint 6,
pré-rendue, avec la liste officielle, la date, le lien ministère et une FAQ en
données structurées. Deux pages sur le même sujet se concurrencent.
- Ce qui manquait : **l'année**. Chaque modèle de la liste porte sa plage
  (`debut`/`fin`) et elle n'était pas exploitée — un acheteur voyait « Clio »
  et en concluait que SA Clio était visée. La recherche prend désormais
  marque + modèle **+ année**, et ce qui concerne l'année saisie remonte en
  tête : une liste où le « oui » est en bas se lit comme un « non ».
- ⚠️ **Une année hors plage n'est jamais une garantie définitive** : la liste
  évolue et seul le VIN tranche. Dit à l'écran et dans la FAQ. **Une donnée
  absente n'écarte jamais** : bornes manquantes ⇒ l'entrée reste, et le dit.
- `/takata` → `/airbags-takata` en **301**.

### Liens de campagne
`scripts/liens-src.mjs --md` → `docs/liens-src.md` (54 liens, 9 canaux).
⚠️ Le script **vérifie le format** `^[a-z0-9][a-z0-9-]{0,39}$` avant d'écrire :
une étiquette hors format est **refusée en base**, le visiteur arrive,
l'analyse se fait, et la provenance est perdue **sans message d'erreur**.

### Sprint 17.1 — Une « incohérence » oppose deux éléments, ou n'en est pas une
L'annonce de la S7 écrit « MOTEUR A CHAINE », et l'EA824 **est** à chaîne : la
mention est exacte. Le modèle la signalait pourtant comme une contradiction,
**deux passages sur quatre** — l'éval échouait par intermittence, et surtout
l'acheteur lisait une contradiction qui n'existe pas. **Un dossier qui invente
une contradiction est pire qu'un dossier muet : il envoie poser une question
sans objet.**
- `_shared/incoherences.ts` (pur, 30 contrôles) : une incohérence du MODÈLE
  n'est retenue que si elle oppose l'annonce à un **élément nommé** — fiche
  moteur, rappel, document (CT, carte grise, facture, carnet, HistoVec), ou
  une autre affirmation de la même annonce. Opposer l'annonce à une
  connaissance générale non citée n'est pas une contradiction, c'est une
  opinion.
- ⚠️ **Les incohérences POSÉES PAR LE SERVEUR sont exemptes.** La constante
  juridique de l'intermédiaire **ne passerait pas** le filtre linguistique (le
  test le vérifie explicitement) : sans exemption, une expression régulière
  effacerait une règle de droit. Même chose pour le compteur contredit par une
  photo ou par un PV.
- Le filtre s'applique **avant le barème** : une incohérence écartée ne pèse ni
  sur l'axe vendeur, ni sur la suspicion de fraude. Les écartées sont **tracées**
  (`incoherence_sans_opposition`), jamais effacées en silence.
- ⚠️ **La corroboration par la fiche ne règle PAS ce cas** : la fiche EA824 ne
  contient pas le mot « chaîne ». `corroboreeParLeCatalogue` existe pour le cas
  symétrique (fiche « courroie en bain d'huile » contre annonce « courroie »),
  et le test fige cette portée limitée — l'annoncer plus large serait faux.
- **Résultat : S7 rouge 39 / 39 / 39**, une seule incohérence (la juridique).
  308 orange 55 et Mercedes vert 71 inchangés.
  ⚠️ **Le score de référence de la S7 passe de 38 à 39** : la fausse
  incohérence pesait sur l'axe vendeur. Et **39 est à un point de l'orange** —
  ce cas est désormais le plus près d'une bascule de couleur.

### ⚠️ L'éval n'imprimait l'URL du dossier qu'en cas de SUCCÈS
Sur un échec, il fallait relancer une analyse **payante** pour pouvoir aller
voir ce qui n'allait pas. C'est exactement au moment où ça rate qu'on a besoin
du dossier. Corrigé — et c'est la deuxième fois que la sortie de l'éval me
coûte un run : la première en la filtrant sur `PASS|FAIL`, ce qui a jeté la
ligne donnant le motif.

## Outillage local (4 nov. 2026)

**Docker Desktop est installé**, et avec lui la pile Supabase locale. ⚠️ Le
binaire n'est **pas sur le PATH** de ce shell : il faut
`export PATH="$HOME/.docker/bin:$PATH"` (ou
`/Applications/Docker.app/Contents/Resources/bin`) avant tout appel à `docker`
ou à une commande `supabase` qui en dépend (`db dump`, `db push`, `start`).

- `supabase/config.toml` créé par `supabase init` — Postgres **17**, aligné sur
  la prod (17.6.1). Aucun secret dedans.
- **`scripts/essai-local.sh`** : le nouveau chemin d'essai. Il démarre la pile
  si besoin, fait un `db reset` qui **rejoue les 33 migrations depuis une base
  vide**, puis exécute les assertions. Éprouvé : **33/33**.
- ⚠️ **Deux formes du même script**, et la distinction compte :
  - `node scripts/essai-migration-annulee.mjs` → script COMPLET (migrations
    incluses, `BEGIN`/`ROLLBACK`), pour éprouver des migrations **non encore
    appliquées** — la forme pour la prod ;
  - `… --assertions` → **assertions seules**, la forme locale. Rejouer les
    corps après un `db reset` échoue, et à juste titre : une migration n'est
    pas idempotente (`drop function` puis `create function` ne se rejoue pas).
    C'est l'erreur que j'ai faite au premier essai local.
- Le **reset local est l'épreuve la plus forte** : il exige que l'histoire
  complète des migrations passe depuis zéro, pas seulement les dernières.
- SQL local : `docker exec supabase_db_inspexo psql -U postgres -d postgres`.
  C'est le `psql` qui manquait depuis le début du projet.

### ⚠️ Le CLI Supabase a encore changé (constaté le 4 nov. 2026)
- **`--linked` est devenu `--remote`**, et **`--role` n'existe plus** sur
  `db dump` (il était obligatoire jusqu'ici contre `permission denied for
  schema auth` — la nouvelle version s'en charge seule). `db push --remote
  --yes`, `migration list --remote`.
- **`db dump` passe désormais par Docker** : sans `docker` sur le PATH, il
  échoue en `DockerRunError`. Le chemin `pg_dump` 17 du scratchpad n'est plus
  nécessaire — et ses bibliothèques disparaissent de `/tmp` au redémarrage, ne
  pas compter dessus.
- Toujours préfixer : `export PATH="$HOME/.docker/bin:$PATH"` et
  `SUPABASE_ACCESS_TOKEN=$(security find-generic-password -s "Supabase CLI" -w)`.

### Sprint 17.2 — Aperçus de partage : une image par dossier, générée UNE FOIS
Branche `apercus-partage`, **non mergée**. Remplace la génération à la volée,
abandonnée après quatre échecs de déploiement.
- **Rendue par un NAVIGATEUR** (`scripts/apercus.mjs` + Playwright), pas par un
  moteur SVG serveur. Un navigateur lit nos fontes **woff2**, que Satori
  refuse : la typographie de la charte est respectée, ce que l'autre approche
  ne permettait pas. Aucun coût IA — on relit des dossiers déjà produits.
- Déposée dans le bucket **public** `apercus`, nom = identifiant du dossier,
  par la fonction `apercu` (admin ou `x-eval-secret`, service role pour
  l'écriture). ⚠️ **Aucune policy** : une policy qui interrogerait `analyses`
  serait toujours fausse (leçon du bucket `rapports`, sprint 8). La signature
  PNG est vérifiée **octet par octet** — le bucket est public, on ne se fie pas
  au type déclaré.
- `api/og.js` **vérifie que le fichier existe** (HEAD, 2,5 s) avant de le
  désigner ; sinon image statique. ⚠️ C'est la leçon de l'épisode précédent :
  une balise ne doit désigner qu'une URL dont on vient de constater qu'elle
  répond. Testé en local contre le stockage : fichier présent → URL du
  stockage, fichier absent → statique, base injoignable → statique.
- La page React garde l'image **statique**, délibérément : les robots d'aperçu
  passent par la réécriture serveur, pas par le rendu React.

### ⚠️ `statut_analyse` ne vaut QUE 'en_cours' ou 'terminee'
Au sprint 15 j'ai écrit `coalesce(..., 'fini') = 'fini'` dans
`analyses_a_verifier` : la condition était **toujours fausse**, et la liste
« à vérifier » de l'onglet Fiabilité restait **vide, sans erreur ni message**.
Personne ne l'a vu parce qu'aucune campagne n'était encore passée par cet
écran — **un filtre qui ne rend rien ressemble exactement à « il n'y a rien à
faire »**.
- Corrigé par redéfinition dans `20261118120000`. L'idiome du projet existait
  depuis le sprint 3 : **on exclut l'échec (`<> 'en_cours'`), on n'énumère
  jamais le succès**.
- `tests/apercus.test.mjs` balaie `api/`, `scripts/`, `src/pages/` et `score`
  et refuse toute comparaison à une valeur inventée. ⚠️ Les **migrations** sont
  hors balayage : une migration appliquée ne se modifie jamais, celle du
  sprint 15 gardera son filtre fautif — c'est l'histoire de ce qui a tourné.
  Ce qui compte est la DERNIÈRE définition, vérifiée séparément.

## Sprint 18 — Application mobile (nov. 2026)

⚠️ **`sprint4b` ne sera JAMAIS mergée** : 97 commits de retard, un diff à
**−47 552 lignes**. La merger effacerait les sprints 5 à 17. La couche mobile
a été **portée sur main**, pas l'inverse.

### Ce qui tourne
Capacitor 8, `io.inspexo.app`, nom « Inspexo ». Android et iOS construits,
installés et testés (émulateur Medium_Phone_API_37, simulateurs iPhone 17e et
17 Pro Max). Chaîne de partage vérifiée de bout en bout sur Android : menu
Partager → Inspexo → `/partage` → WebView sur l'annonce.
- ⚠️ **Le serveur local de Capacitor sert des FICHIERS** : il n'a pas le repli
  SPA de Vercel. `window.location.href = '/partage?…'` finissait sur
  `about:blank`. La navigation passe par le routeur React, qui ne touche
  jamais le serveur.
- ⚠️ **Zone sûre iOS** : la barre de navigation passait sous l'horloge.
  `viewport-fit=cover` + `env(safe-area-inset-top)`, qui vaut 0 ailleurs —
  le site web n'est pas touché.
- ⚠️ **Aucun JDK utilisable sur le poste** : celui d'Android Studio est en
  version 25, que Gradle 8.14 refuse (« class file major version 69 »).
  Temurin 21 installé dans `~/outils-jdk`, hors dépôt. `JAVA_HOME` est à
  poser pour tout appel à `gradlew`.
- Icônes et écrans de lancement dérivés de la charte, **156 déclinaisons**.
  L'icône n'a ni texte fin ni transparence : iOS refuse l'alpha, et un texte
  de 11 px disparaît à 40×40.

### La promesse « lue par l'appareil », prouvée des DEUX côtés
- **Par le code** : `tests/pas-de-scraping.test.mjs`. ⚠️ Sa première version
  interdisait le MOT « leboncoin » dans le code serveur — elle a aussitôt
  signalé `intake` et `marche`, qui portent une **liste blanche de
  validation**. Interdire le mot, c'était interdire la validation elle-même.
  Le test traque désormais les **fetch**, pas les mots.
- ⚠️ **Trou bouché au passage** : `texteDeLaPage` récupère une URL QUELCONQUE
  — celle que cite une fiche moteur. Rien n'empêchait une source d'être une
  annonce Leboncoin, auquel cas **notre serveur serait allé la chercher**.
  `estSiteDAnnonces` refuse ces domaines **avant toute requête** : la
  promesse tient désormais par construction, pas par chance.
- **Par la mesure** : `scripts/capture-reseau-partage.mjs` écoute la WebView
  pendant un partage réel. Relevé du 5/11/2026 : **105 requêtes, 73 vers
  leboncoin.fr — toutes depuis l'appareil — 0 vers nos serveurs.**
  ⚠️ Une observation faite depuis le téléphone ne voit pas ce que fait un
  serveur : les deux preuves sont nécessaires, aucune ne suffit seule.

### Déclarations des stores — `docs/stores-declarations.md`
Dérivées du **code**, pas de la page de confidentialité.
- ⚠️ **Photos déclarées COLLECTÉES** (décision d'Utku). Nous n'en conservons
  aucune, mais elles transitent par Anthropic, qui **supprime les entrées de
  son API sous 30 jours** et les conserve **jusqu'à 2 ans** si un contenu est
  signalé (vérifié le 5/11/2026 sur privacy.claude.com). **Trente jours, ce
  n'est pas du temps réel. En cas de doute on déclare plus, jamais moins.**
  Mêmes réglages que le texte de l'annonce : non liées à l'identité, aucun
  suivi. Pas d'IDFA, donc pas d'invite ATT.
- Politique corrigée : **Vercel ajouté**, **Cal.com retiré** — il y figurait
  alors que rien ne lui est envoyé, ce qui est aussi inexact qu'une omission —
  **section « Application mobile »**, **durée de conservation chez Anthropic
  publiée**. Cloudflare le jour des clés seulement.

### Captures de vente
⚠️ La première série ouvrait les pages par une URL `https://`, que
`simctl openurl` transmet à **Safari** : les images montraient le site dans un
navigateur, barre d'adresse comprise, et non l'application. Corrigé par un
lien profond `inspexo://aller?p=/chemin`, qui a par ailleurs son utilité.
⚠️ **Sur iOS, seul l'accueil est capturable sans intervention** : iOS 27
affiche toujours « Ouvrir dans « Inspexo » ? » sur un lien profond externe, et
aucun outil disponible ici ne sait toucher l'écran du simulateur. Deux écrans
restent à prendre à la main dans Xcode — non bloquant, Apple accepte une seule
capture pour soumettre.


## ⚠️ Verdicts de référence de l'éval (état COURANT)

| Cas | Verdict | Depuis |
|---|---|---|
| `audi-s7-intermediaire` | **rouge 39** | 5 nov. 2026 (sprint 17.1) |
| `308-puretech-complete` | **orange 55** | 28 oct. 2026 |
| `mercedes-2025-societe` | **vert 71** | 4 nov. 2026 (sprint 13) |

⚠️ **Les relevés datés dans les sections de sprint ci-dessus disent ce qui a
été mesuré CE JOUR-LÀ** : la S7 y figure à 38 avant le sprint 17.1, et c'est
exact. On ne réécrit pas un relevé passé pour le faire coïncider avec le
présent — c'est ce tableau qui fait foi pour l'état courant.

⚠️ **La S7 est à un point de l'orange** (seuil à 40). C'est le cas le plus
près d'une bascule de couleur : toute modification du barème ou des filtres
doit le rejouer.

## Marques Couvertes

**Lancement : 6-8 marques prioritaires** (80% du volume VO Toulouse)
Peugeot, Renault, Volkswagen, BMW, Mercedes, Toyota, Audi, Ford
Un expert peut couvrir 2-3 marques du même groupe (ex: expert VAG = VW + Skoda + Seat)

**Affichées sur le site (filtres séparés) :**
🚗 Généralistes : Renault, Peugeot, Citroën, Volkswagen, Toyota, Dacia, Ford, Opel, Nissan, Hyundai, Kia, Fiat, Skoda, Seat, Mazda, Subaru, Mitsubishi, Honda, Mini, Jeep

💎 Premium & Sportives : BMW, Mercedes, Audi, Volvo, Land Rover, Jaguar, Lexus, Genesis, Cadillac, Tesla, Porsche, Maserati, Ferrari, Lamborghini, Alfa Romeo, Lotus, Aston Martin, McLaren, Bentley, Rolls-Royce, Dodge, Chevrolet

Marques rares sans expert disponible → "Disponibilité sur demande"

## Experts

Les profils d'experts fictifs et leurs chiffres ont été **retirés du site** (sprint 1). La section « Nos experts » affiche un bloc « Réseau d'experts en construction » avec capture email (lead `expert_waitlist`). Ne pas réintroduire de faux profils ni de faux chiffres.

## Décisions Actées — NE JAMAIS VIOLER

- "Qualifié" et JAMAIS "certifié" (risque légal)
- 3 astérisques max en bas de page
- Garantie 30 jours → dans les CGU uniquement, pas sur le site
- Autorisation Stripe avant confirmation expert (éviter chargebacks)
- Aucun faux profil ni faux avis — notation vérifiée dès les premières missions réelles
- Stripe Connect obligatoire — JAMAIS de virement manuel
- L'IA crée du doute UTILE (factuel), elle ne rassure PAS
- Inspection Distancielle en Phase 2 uniquement
- L'expert ne négocie PAS — le rapport chiffré donne les arguments à l'acheteur
- Offre simple : score gratuit → Pass achat 29 € → experts en liste d'attente (pas d'empilement de paliers)
- Prix de lancement affichés clairement
- Pas de lien FAQ dans la navbar
- Images d'analyse JAMAIS stockées (envoyées à Claude puis oubliées, seul `images_count` persiste) ; EXIF supprimé côté client
- Mention de consentement d'une ligne sous chaque champ email ; lien de désinscription dans chaque email envoyé
- Jamais de récupération automatique d'URL (pas de scraping) : on demande le texte de l'annonce
- Le verdict porte sur l'annonce et le modèle, jamais sur le vendeur en tant que personne
- Aucun chiffre d'économies affiché
- Accès public à la base UNIQUEMENT via RPC SECURITY DEFINER — aucune policy RLS anon directe

## Sécurité — OBLIGATIONS

0. **Agents et prod** : aucun agent (subagent, workflow d'audit, script de test) ne teste JAMAIS contre la base Supabase de production. ⚠️ **Depuis le 4 nov. 2026, il n'y a plus d'excuse** : Docker Desktop est installé et `scripts/essai-local.sh` rejoue l'intégralité des migrations sur une base vide puis exécute les assertions. Les essais de migration se font **en local**, plus dans l'éditeur SQL de la prod — sonde, injection, lecture ou écriture de table incluses. Tout test de ce type se fait sur `supabase start` en local ou sur une branche de preview Supabase. Seule exception : `npm run eval`, qui passe exclusivement par la whitelist d'éval (header `x-eval-secret`).

0 bis. **Fichiers personnels d'Utku : JAMAIS ouverts.** N'ouvre, ne lis, ne copie et n'envoie aucun fichier situé hors du dépôt — `~/Documents`, `~/Downloads`, `~/Desktop`, iCloud Drive, et tout le reste du disque. Cela vaut aussi pour en relever une simple métadonnée (taille, nombre de pages, nombre de caractères) : « je n'ai pas affiché le contenu » n'est pas une permission de l'avoir lu. Pour éprouver un format ou une bibliothèque, **fabrique le fichier d'essai** (cf. le PDF témoin du sprint 13, `scripts/`-style, généré à la demande) ou utilise **uniquement ce qu'Utku a déposé dans le dépôt**. Un fichier déposé dans le dépôt est une autorisation ; un fichier trouvé sur le disque n'en est pas une. Seule exception : un chemin qu'Utku indique explicitement dans sa demande.

0 quinquies. **On ne redéclare JAMAIS une fonction SQL de mémoire.** On reprend le corps de sa **dernière** définition — pas de la première trouvée — et on n'y change que ce qu'on vient changer. ⚠️ Trois récidives : `get_public_analysis` (sprint 13, rattrapé), puis `inspecteur_missions` et `inspection_accepter` (sprint 14), où j'avais pris le corps du sprint 8 au lieu de celui du sprint 8-audit — perdant au passage `photos_consentement_le`, le garde-fou **RC pro expirée**, le garde-fou **Stripe Connect** et la **fenêtre de créneau +1 h/+72 h**. Un inspecteur sans assurance valide aurait pu prendre une mission. `tests/fonctions-redefinies.test.mjs` compare désormais les colonnes rendues avant et après chaque redéfinition : une colonne qui disparaît sans être **nommée dans la migration qui la retire** fait échouer la suite.

0 ter. **Aucune table ni fonction créée depuis le dashboard Supabase — UNIQUEMENT par migration.** Un objet créé à la main n'est décrit par aucun fichier, échappe à l'essai en transaction annulée, et hérite des droits par défaut sans que personne ne le voie. C'est ainsi que neuf tables (sprints 1, 7 et 8) se sont retrouvées lisibles par `anon` — sans fuite, la RLS tenant, mais sans défense en profondeur.

0 quater. **Toute nouvelle RPC destinée au front porte un `grant execute … to anon` (ou `to authenticated`) EXPLICITE.** Depuis la migration `20261113120000`, les droits par défaut du rôle `postgres` dans `public` ne donnent plus ni SELECT sur les tables ni EXECUTE sur les fonctions. Un accès public est donc une **décision écrite**, jamais un héritage. Une RPC sans grant ne sera pas appelable : c'est le bon sens de l'échec. ⚠️ Corollaire : une fonction qu'on ne destine PAS au front ne reçoit aucun grant — et si elle est appelée depuis une autre fonction, celle-ci doit être `SECURITY DEFINER` (sinon `current_user` est l'appelant, qui n'a plus EXECUTE).

1. **Variables d'environnement** : Clés API dans `.env.local` uniquement, JAMAIS dans le code
2. **Supabase RLS** : Row Level Security sur TOUTES les tables
3. **Logique sensible côté serveur** : Calcul de prix, webhooks Stripe, appels API Anthropic → Supabase Edge Functions ou Vercel Serverless, JAMAIS côté client
4. **Webhooks Stripe** : Vérifier la signature, ne pas se fier au client
5. **RGPD** : Consentement cookies explicite, droit de suppression

## Roadmap

| Session | Tâche | Statut |
|---------|-------|--------|
| 1-3 | Frontend React en composants + design system + déploiement | ✅ |
| S1 | Pivot IA : score d'annonce gratuit + rappels/Takata + waitlists | ✅ Livré (oct. 2026) |
| S5 | Nouvelle direction artistique (document, tampon, filets) | ✅ Mergé (oct. 2026) |
| S2 | Pass achat 29 € (produit principal) | ⬜ |
| 4 | Supabase — tables users, experts, missions, paiements | ⬜ |
| 5 | Stripe + Stripe Connect | ⬜ |
| 6 | Espace client post-paiement | ⬜ |
| 7 | Dashboard admin | ⬜ |
| 8 | IA Anthropic palier 9,90€ | ⬜ |
| 9 | Cal.com réservation | ⬜ |
| 10 | Resend emails automatiques | ⬜ |
| 11 | RGPD | ⬜ |
| 12 | CGU/CGV | ⬜ |
| 13 | Avis vérifiés | ⬜ |
| 14 | Optimisation mobile | ⬜ |
| 15 | Tunnel conversion end-to-end | ⬜ |
| 16 | Inspection Distancielle (Phase 2) | ⬜ |

## Conventions de Code

- Un fichier par composant, PascalCase (ex: `ServiceCard.jsx`)
- CSS : inline styles avec objets JS (comme l'ancien App.js) + classes CSS pour hover/responsive via `<style>` tags
- Pas de TypeScript pour le MVP
- Pas de framework CSS (pas de Tailwind, pas de Bootstrap)
- Google Fonts via `<style>` dans le composant racine : `@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400&family=Syne:wght@700;800&display=swap')`

## Lancement
- **Zone** : Toulouse & Haute-Garonne
- **Objectif An 1** : ~23K€ CA plateforme (réaliste)
- **Experts nécessaires au lancement** : 4-5 experts couvrant les 6-8 marques prioritaires
