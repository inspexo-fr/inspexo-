# INSPEXO — Contexte Projet pour Claude Code

## Mission
Inspexo aide les acheteurs de véhicules d'occasion à éviter les mauvaises affaires. **Pivot (oct. 2026) : l'IA est le produit principal.**
- Le **score d'annonce gratuit** (`/score`) est l'outil d'acquisition : verdict vert/orange/rouge en < 20 s.
- Le **Pass achat à 29 €** (à venir) est la montée en gamme : accompagnement IA complet jusqu'à la signature.
- Les **experts humains** spécialisés par marque (Visio, Inspection) sont en **liste d'attente** le temps de constituer le réseau.

L'indépendance reste totale : payé exclusivement par l'acheteur, jamais par le vendeur.

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

### Règle de coût des tests (OBLIGATOIRE)
- **Pendant le développement** : ne rejouer que les cas concernés par la modification (`npm run eval -- <cas>`). L'éval complète ne tourne **qu'une fois, avant le merge**.
- **Test de stabilité** (3 passages) : uniquement sur 3 cas fixes — `audi-s7-intermediaire`, `308-puretech-complete`, `mercedes-2025-societe`.
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
- **Gravité par CONSÉQUENCE** (4 niveaux) : `securite` = danger pour les occupants, uniquement si une source le dit ; `casse` = remplacement moteur/boîte, ou réparation sourcée > 3 000 € ou > 30 % du prix demandé ; `majeure` = 500 à 3 000 € ; `mineure` = moins de 500 € ou désagrément. Le reclassement est fait côté serveur à partir du coût sourcé ; **sans coût publié, la gravité de la source est conservée et jamais promue en « casse »**.
- **Rouge réservé aux faits graves** : danger sécurité, risque de casse, rappel « stop drive » non traité, cadre juridique gravement compromis (pro déguisé, ou intermédiaire excluant la garantie légale) ou signes de fraude (compteur contredit, double prix). Sinon le score ne peut pas descendre sous 40 : **une panne seulement « majeure » plafonne en orange**. Une couverture de garantie n'étant acquise qu'une fois les justificatifs fournis, elle n'allège jamais le verdict affiché — seulement le conditionnel.
- **Codes de boîte jamais devinés** : le filtre couvre tous les codes (DQ/DL, BVM/BVA, MS6/MA6, EAT, HP…) — une panne qui nomme un code n'est retenue que si c'est celui du véhicule, et aucune si la boîte n'est pas identifiée. (Cas réel : l'annonce 308 ne dit que « Boîte : Manuelle », donc la panne « synchros de 2e BVM6 » n'est ni affichée ni comptée.)
- **Fiches fusionnées par alias de marque** : « Mercedes » et « Mercedes-Benz » créaient deux fiches OM654 au contenu différent, et le lookup en choisissait une arbitrairement. Il accepte désormais toutes les écritures connues de la marque (`expandBrand`) et **fusionne** les pannes des fiches compatibles (dédup par mots-clés, la version la plus renseignée gagne, les champs manquants sont complétés par l'autre). Sans cela, une analyse perdait le seuil kilométrique ou le coût présent dans l'autre fiche.
- **Usure encore lointaine** : une panne d'usure dont la source situe l'apparition au-delà du double du kilométrage actuel reste **affichée** (l'acheteur doit la connaître) mais **ne pèse pas sur la note** — un danger pour les occupants ou un rappel applicable pèsent toujours, eux. (Cas réel : l'usure des culbuteurs OM654, documentée « dès environ 160 000 km », ne doit pas faire chuter le score d'une Classe C de 36 606 km.)
- **Déduplication des pannes** : l'atlas et la fiche décrivent parfois le même défaut avec d'autres mots ; deux pannes partageant au moins deux mots significatifs sont fusionnées (la plus grave gagne, le rappel officiel est conservé), ce qui évite de compter deux fois la même courroie.
- **Axe risques = pannes affichées** : la note porte sur EXACTEMENT la liste montrée à l'acheteur, selon la **gravité maximale** et jamais le nombre — un moteur mieux documenté n'est pas pénalisé pour cette raison (vérifié par test : 1 panne majeure = 5 pannes de même gravité max).
- **Atténuation par garantie** : une panne couverte par une garantie constructeur en cours ou un programme d'extension dont le véhicule respecte les seuils est rétrogradée d'un cran dans un calcul parallèle ; si le score y gagne, `/a/:id` affiche sous le verdict « Verdict si <condition> : <couleur> <score>/100 ». Le conditionnel ne s'affiche que s'il change réellement quelque chose (une autre panne non couverte de même gravité l'annule, à juste titre).
- **Raison du plafond** : quand le score est plafonné, la cause est affichée en une ligne sous le verdict (« Vert impossible sans preuve d'entretien : demandez le carnet et les factures. »).
- **Éval de stabilité** : chaque cas analysable est rejoué 3 fois sans cache ; échec si l'écart de score dépasse 5 points ou si la couleur change. `npm run eval -- --sans-stabilite` pour sauter cette phase.
- **Modèle de secours** : `claude-sonnet-4-6`. Bascule si le principal est indisponible ou dépasse 45 s sur un appel ; modèles réellement utilisés loggés dans `score_done.modeles`. `npm run eval -- --modele-secours` valide un run complet sur le secours. ⚠️ `claude-sonnet-5-5` est plus récent mais **inutilisable ici** : il refuse le `tool_choice` forcé (« type "tool" and "any" are not supported for this model ») sur lequel repose tout le pipeline, et exige `thinking: between_tools` au lieu de `disabled` (le code gère déjà ce second point par modèle). Le secours est plus lent (60-110 s contre 35-50 s) : les images base64 sont libérées dès l'appel vision terminé pour tenir dans les ressources de l'edge function.
- **Codes de rappel** : un code de campagne n'est conservé que s'il figure LITTÉRALEMENT dans une des pages citées (vérification par récupération du texte à la génération, event `rappel_code_retire`) ; sinon le rappel est affiché sans code. La critique supprime tout code absent du catalogue. La fiche porte aussi la **plage de production** de la campagne : un véhicule hors plage voit la mention « hors de la plage de production visée, à faire confirmer par le VIN » et le rappel ne pèse plus sur la note. (Cas réel : KGH, campagne Peugeot du 8/12/2022, ne couvre que les productions d'avril 2017 à l'automne 2018 — elle ne s'applique pas à une 308 de 2020.)

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

0. **Agents et prod** : aucun agent (subagent, workflow d'audit, script de test) ne teste JAMAIS contre la base Supabase de production — sonde, injection, lecture ou écriture de table incluses. Tout test de ce type se fait sur `supabase start` en local ou sur une branche de preview Supabase. Seule exception : `npm run eval`, qui passe exclusivement par la whitelist d'éval (header `x-eval-secret`).

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
