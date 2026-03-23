# INSPEXO — Contexte Projet pour Claude Code

## Mission
Inspexo est une plateforme React qui met en relation des acheteurs de véhicules d'occasion avec des experts automobiles **spécialisés par marque**. L'indépendance est totale : les experts sont payés exclusivement par l'acheteur, jamais par le vendeur.

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
- **IA palier 1** : API Anthropic Claude Sonnet (appel via Supabase Edge Function, JAMAIS côté client)
- **Réservation** : Cal.com
- **Emails** : Resend
- **Visio** : Google Meet

## Architecture Frontend

### Structure des fichiers
```
inspexo/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Navbar.jsx
│   │   ├── Hero.jsx
│   │   ├── StatsBar.jsx
│   │   ├── HowItWorks.jsx
│   │   ├── Services.jsx
│   │   ├── Experts.jsx
│   │   ├── BecomeExpert.jsx
│   │   ├── FAQ.jsx
│   │   ├── Footer.jsx
│   │   └── FooterNotes.jsx
│   ├── pages/              # Pour les futures pages (dashboard, paiement...)
│   ├── lib/
│   │   └── supabaseClient.js
│   ├── styles/
│   │   └── global.css
│   ├── App.jsx              # ~20 lignes max — assemblage des composants
│   └── index.js
├── .env.local               # JAMAIS commité
├── .gitignore
├── CLAUDE.md
├── package.json
└── README.md
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

### Structure du site (10 sections dans l'ordre)
1. **Navbar** — fixe 64px, bleu nuit, logo "INSPEXO" (Syne, letterspacing 3px, E en orange), liens desktop + hamburger mobile, CTA "Trouver mon expert"
2. **Hero** — bleu nuit, min-height 100vh, badge orange arrondi, titre Syne 68px+ avec text-outline, sous-titre italique, 2 boutons (orange + outline), badges de confiance
3. **Barre Stats** — fond orange, 4 stats : "5,5M Transactions VO/an", "30+ Marques couvertes", "9,90€ Pour commencer", "100% Côté acheteur"
4. **Comment ça marche** — fond blanc, 3 étapes avec icônes dans cercles orange pâle, numérotées "Étape 01/02/03"
5. **Nos Services** — fond gris clair, 3 cards (IA / Visio featured / Inspection), encart garantie en bas
6. **Nos Experts** — fond bleu nuit, filtres marques séparés Généralistes / Premium & Sportives en pills, cards experts, zone notification email pour villes non couvertes
7. **Devenir Expert** — fond orange pâle, grille revenus (40€ / 175€), CTA bleu nuit
8. **FAQ** — fond blanc, accordéon avec chevron +/rotate(45deg)
9. **Footer** — bleu nuit, logo atténué, grille 3 colonnes (Navigation, Contact, Légal)
10. **Notes bas de page** — fond #080E18, 3 astérisques max

### Navbar — PAS de lien FAQ
La navbar contient uniquement : Comment ça marche, Nos services, Nos experts, Devenir expert + CTA.
PAS de lien FAQ dans la navbar.

## Modèle Économique — 3 paliers (PRIX DE LANCEMENT)

| Palier | Prix | Plateforme | Expert | Split |
|--------|------|-----------|--------|-------|
| IA Spécialisée | 9,90€ | 9,90€ | 0€ | 100/0 |
| Visio Test Drive | 59€ | 19€ | 40€ | 32/68 |
| Inspection Physique | 249€ | 79€ | 170€ | 32/68 |

### Détail des paliers

**Palier 1 — IA Spécialisée (9,90€)**
- Disponible 48h après achat
- Entraînée sur la marque spécifique
- Défauts et maladies fréquents du modèle
- Script de questions au vendeur
- Estimation du juste prix marché
- Signaux d'alerte à ne pas manquer
- Rapport détaillé
- L'IA doit CRÉER DU DOUTE, pas rassurer
- Chaque défaillance catégorisée : 🟢 "Vérifiable par vous" / 🔴 "Nécessite un expert"
- 60-70% des défaillances doivent être en rouge → pousse vers palier supérieur
- Formulation : "Découvrez les points de défaillance connus de ce modèle — et décidez si vous avez besoin d'un expert sur place"
- Badge sur la card : "Éclairez votre décision"
- Emoji card : 💬

**Palier 2 — Visio Test Drive (59€) — CARD FEATURED (fond bleu nuit)**
- Expert qualifié sur la marque
- En direct pendant la visite de l'acheteur
- Guidage pendant l'essai routier
- Vérification identité véhicule *
- Historique administratif
- Avis et recommandations du spécialiste
- Compte-rendu détaillé sous 24h
- Badge : "⭐ Recommandé"
- Emoji card : 📹
- Ce que la visio PEUT vérifier : documents, cohérence kilométrique, état visuel, bruits moteur au démarrage
- Ce que la visio NE PEUT PAS vérifier : mécanique sous capot en détail, suspensions, freins, zones repeintes, essai routier complet

**Palier 3 — Inspection Physique (249€)**
- Tout le palier Visio +
- Déplacement de l'expert sur place
- Inspection compartiment moteur
- Essai statique et routier complet
- Frappe à froid *
- Détection zones repeintes
- Analyse du contrôle technique
- Rapport photo complet sous 24h
- Rapport chiffré des défauts constatés (estimation frais de remise en état)
- Badge : "Rien au hasard"
- Emoji card : 🔧

### Stratégie prix
- Afficher "Prix de lancement" sur le site
- Le palier IA est le moteur d'acquisition (marge ~100%, volume)
- Hausse prévue post-traction : Visio → 75€, Inspection → 299€ (part expert inchangée)

## Marques Couvertes

**Lancement : 6-8 marques prioritaires** (80% du volume VO Toulouse)
Peugeot, Renault, Volkswagen, BMW, Mercedes, Toyota, Audi, Ford
Un expert peut couvrir 2-3 marques du même groupe (ex: expert VAG = VW + Skoda + Seat)

**Affichées sur le site (filtres séparés) :**
🚗 Généralistes : Renault, Peugeot, Citroën, Volkswagen, Toyota, Dacia, Ford, Opel, Nissan, Hyundai, Kia, Fiat, Skoda, Seat, Mazda, Subaru, Mitsubishi, Honda, Mini, Jeep

💎 Premium & Sportives : BMW, Mercedes, Audi, Volvo, Land Rover, Jaguar, Lexus, Genesis, Cadillac, Tesla, Porsche, Maserati, Ferrari, Lamborghini, Alfa Romeo, Lotus, Aston Martin, McLaren, Bentley, Rolls-Royce, Dodge, Chevrolet

Marques rares sans expert disponible → "Disponibilité sur demande"

## Experts fictifs pour le lancement

```javascript
const experts = [
  { nom: 'Thomas R.', marque: 'BMW', specialite: 'Série 3, M3 — moteurs N52 et S55', exp: '12 ans', missions: 847, note: '4.9' },
  { nom: 'Marc D.', marque: 'Mercedes', specialite: 'Classe C, E — moteurs OM651 et M276', exp: '9 ans', missions: 634, note: '4.8' },
  { nom: 'Sophie L.', marque: 'Porsche', specialite: '911, Cayenne — moteurs MA1 et M48', exp: '7 ans', missions: 312, note: '5.0' },
  { nom: 'Kevin M.', marque: 'Audi', specialite: 'A4, RS4 — moteurs CDNC et CGWB', exp: '11 ans', missions: 521, note: '4.9' },
  { nom: 'Laura M.', marque: 'Ferrari', specialite: '488, F8 — moteurs V8 biturbo', exp: '8 ans', missions: 89, note: '5.0' },
  { nom: 'Pierre V.', marque: 'Land Rover', specialite: 'Defender, Discovery — châssis 4x4', exp: '14 ans', missions: 198, note: '5.0' },
  { nom: 'Nicolas F.', marque: 'Volkswagen', specialite: 'Golf, Passat — boîtes DSG et moteurs TSI', exp: '10 ans', missions: 398, note: '4.9' },
  { nom: 'Antoine B.', marque: 'Renault', specialite: 'Mégane, Clio — moteurs K9K et H4M', exp: '8 ans', missions: 445, note: '4.8' },
  { nom: 'Sarah C.', marque: 'Maserati', specialite: 'Ghibli, Quattroporte — V6 biturbo', exp: '9 ans', missions: 112, note: '4.8' },
  { nom: 'Paul T.', marque: 'Alfa Romeo', specialite: 'Giulia, Stelvio — moteurs GME', exp: '11 ans', missions: 203, note: '4.9' },
];
```

## Décisions Actées — NE JAMAIS VIOLER

- "Qualifié" et JAMAIS "certifié" (risque légal)
- 3 astérisques max en bas de page
- Garantie 30 jours → dans les CGU uniquement, pas sur le site
- Autorisation Stripe avant confirmation expert (éviter chargebacks)
- Avis experts fictifs au lancement → activer notation vérifiée dès premières missions
- Stripe Connect obligatoire — JAMAIS de virement manuel
- Palier IA = créer du doute, PAS rassurer
- Inspection Distancielle en Phase 2 uniquement
- L'expert ne négocie PAS — le rapport chiffré donne les arguments à l'acheteur
- 3 paliers uniquement (pas 4)
- Prix de lancement affichés clairement
- Pas de lien FAQ dans la navbar

## Sécurité — OBLIGATIONS

1. **Variables d'environnement** : Clés API dans `.env.local` uniquement, JAMAIS dans le code
2. **Supabase RLS** : Row Level Security sur TOUTES les tables
3. **Logique sensible côté serveur** : Calcul de prix, webhooks Stripe, appels API Anthropic → Supabase Edge Functions ou Vercel Serverless, JAMAIS côté client
4. **Webhooks Stripe** : Vérifier la signature, ne pas se fier au client
5. **RGPD** : Consentement cookies explicite, droit de suppression

## Roadmap

| Session | Tâche | Statut |
|---------|-------|--------|
| 1-3 | Frontend React en composants + design system + déploiement | 🔄 En cours |
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
