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

## Score d'annonce gratuit (Sprint 1 — livré oct. 2026)

### Produit
- `/score` : texte d'annonce (≤ 6 000 car.) + jusqu'à 3 captures (redimensionnées à 1 600 px côté client, EXIF supprimé par réencodage canvas, JAMAIS stockées — seul `images_count` persiste) + jusqu'à 5 annonces comparables.
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
