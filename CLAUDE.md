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
- Envoi à **J+21** par le cron `alertes`, sur l'union dossier + Pass + inspection + opt-in `rapport`. **Une seule invitation par (analyse, email)** : l'unicité est dans le schéma (`retours`), donc l'union est dédoublonnée par la base et non par la prudence du code. **Aucune relance n'existe dans le code.**
- ⚠️ L'ancien envoi « J+30 après acheté » a été **RETIRÉ** (`emailRetourIssue` supprimée) : il aurait fait deux sollicitations pour le même véhicule. Le formulaire de `/dossier` (RPC `submit_outcome`) reste, c'est une action de l'utilisateur.
- Nouvelle table `desinscriptions` (empreinte d'email) : la désinscription du sprint 3.1 ne coupait que les alertes d'un COMPTE, or une invitation peut partir vers quelqu'un qui n'en a pas. `desinscription` gagne un mode `e=<empreinte>&t=<signature>`.

### Transparence sur la rémunération (ajout après relecture d'Utku)
La phrase affichée n'est **pas figée dans le code** : `partenaires.remuneration` (`commission` | `aucune`, **NOT NULL sans valeur par défaut**) est déclarée à l'enregistrement, publiée par `get_partenaires_actifs` et traduite par `phraseRemunerationGlobale`. Elle ne peut donc pas devenir fausse parce qu'on aurait oublié de la changer après avoir signé un contrat. Régimes **mélangés** entre partenaires ⇒ la phrase globale est remplacée par une phrase **par partenaire** : on ne généralise jamais à tort. Une déclaration manquante est traitée comme « aucune rémunération », jamais l'inverse. Affichée dans le même style que la mention légale (gras, 15 px), au-dessus des liens.
- **Promesse « payé exclusivement par l'acheteur » revue partout** : les seules occurrences portaient déjà sur l'INSPECTEUR (`InspectionBloc`, `RapportInspection`, `notify.ts`, charte) et restent exactes. Seule la CGU art. 2 était ambiguë — reformulée en « L'inspection est payée exclusivement par l'acheteur ». ⚠️ La charte d'indépendance (`src/data/charte.js` ≡ `_shared/inspection.ts`) n'a PAS été touchée : `tests/inspection.test.mjs` exige qu'elles restent identiques mot pour mot.
- **CGU article 3 bis** : conditions de référencement d'un partenaire (texte validé, contrôle automatique, mention légale, activation manuelle, jamais sur un rouge), rémunération, et ce qui est transmis (rien).

### Admin et divers
- Onglets **Partenaires** (enregistrer sous contrôle légal, activer/éteindre, mises en relation par semaine brut/net, export CSV) et **Retours** (taux de réponse sur les invitations ENVOYÉES, achats, écart médian prix affiché → prix payé, points confirmés par famille moteur).
- `leads.code_postal` + RPC `submit_demande_zone` : la liste d'attente hors zone capture le code postal — c'est la carte de la demande, elle dit où recruter. Composant `DemandeZone.jsx`.
- Route `/retour/:id`, réécriture `/go/:slug` dans `vercel.json`, secret **`GO_PROXY_SECRET`** (Supabase + Vercel prod) à poser avant la mise en service.
- Page `/politique-de-confidentialite` : trois sections ajoutées (liens partenaires, code postal, retour après achat).
- **Aucune modification du score** : aucune éval payante, coût 0 €.

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
