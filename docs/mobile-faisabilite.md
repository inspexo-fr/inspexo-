# Sprint 4B — Appli « Partager → Inspexo » : test de faisabilité

**Rien n'est publié.** L'appli embarque le site React existant (même code, mêmes
pages) dans Capacitor 8 et ajoute un seul flux : *menu Partager de l'appli
Leboncoin / La Centrale → Inspexo → verdict*. Toute la lecture de l'annonce se
fait **sur le téléphone** (WebView visible + extracteurs de l'extension
Chrome) : aucune requête de nos serveurs vers Leboncoin. Si une vérification
anti-robot s'affiche, c'est l'utilisateur qui la passe, dans la WebView — elle
n'est jamais contournée.

## Architecture du flux

```
Appli LBC → Partager → Inspexo
  iOS      : Share Extension (ios/PartageInspexo) → inspexo://partage?url=…
  Android  : intent ACTION_SEND (MainActivity.java) → inspexo://partage?url=…
→ appli Capacitor : listener appUrlOpen (src/App.jsx) → page /partage
→ WebView VISIBLE sur l'annonce (@capgo/inappbrowser)
→ à chaque chargement de page : injection des extracteurs
  (src/lib/extracteurInjectable.gen.js = extension/sites/*.js + pilote,
  regénéré par scripts/generer-extracteur-mobile.mjs)
  · anti-robot affiché ? l'utilisateur le passe → le rechargement relance
    l'extraction automatiquement
→ photos téléchargées PAR le téléphone (CapacitorHttp), 1 600 px, ré-encodées
  JPEG (EXIF supprimé) — comme l'extension Chrome
→ POST https://www.inspexo.io/api/intake (payload identique extension)
→ navigation vers /a/:id (verdict progressif habituel)
```

## Installer le build de développement sur l'iPhone (provisioning gratuit)

Préalables (une fois) :
1. Installer **Xcode** depuis l'App Store (~15 min de téléchargement), le
   lancer une fois et accepter l'installation des composants iOS.
2. `sudo xcode-select -s /Applications/Xcode.app`
3. Dans le repo : `npm run build && npx cap sync ios` (déjà fait, à refaire
   après toute modification du front).

Créer le target de l'extension de partage (5 minutes, une fois) :
4. `npx cap open ios` (ouvre `ios/App/App.xcodeproj`).
5. File → New → Target… → iOS → **Share Extension** → Product Name :
   `PartageInspexo` (ne PAS cocher « Activate scheme » si proposé en Swift UI ;
   langage Swift, pas de SwiftUI). Xcode crée le dossier du target.
6. Remplacer le contenu du `ShareViewController.swift` généré par celui de
   **`ios/PartageInspexo/ShareViewController.swift`** (fichier prêt) et
   supprimer `MainInterface.storyboard` du target s'il existe (ainsi que la clé
   `NSExtensionMainStoryboard` de l'Info.plist du target).
7. Dans l'Info.plist du target, remplacer le dictionnaire `NSExtension` par
   celui de **`ios/PartageInspexo/Info-extension.plist.fragment.xml`**
   (activation : 1 URL web ou texte).
8. Signature : cible **App** → Signing & Capabilities → Team = ton Apple ID
   (Personal Team), coche « Automatically manage signing ». Même chose pour la
   cible **PartageInspexo** (le bundle id proposé
   `io.inspexo.app.PartageInspexo` convient). Avec un compte gratuit, le
   provisioning expire au bout de 7 jours — relancer un Run suffit.

Installer sur l'iPhone :
9. iPhone branché en USB, déverrouillé ; sur l'iPhone : Réglages → Confidentialité
   et sécurité → Mode développeur → activé (redémarrage).
10. Dans Xcode : sélectionner le schéma **App** + ton iPhone → Run (⌘R).
11. Premier lancement : Réglages → Général → VPN et gestion de l'appareil →
    faire confiance à ton profil développeur.

## Protocole de test (points du rapport à vérifier sur l'appareil)

| # | Vérification | Comment |
|---|---|---|
| 1 | Le menu Partager de l'appli Leboncoin propose « Inspexo » | Ouvrir une annonce dans l'appli LBC → Partager → ligne « Inspexo » (si absente : « Plus » → activer) |
| 2 | L'URL reçue est exploitable | L'appli s'ouvre sur « Ouverture de l'annonce… » (sinon : l'URL est dans le presse-papiers — filet de sécurité) |
| 3 | La page se charge dans la WebView | L'annonce s'affiche ; si DataDome apparaît, le passer à la main → la lecture repart seule |
| 4 | Les extracteurs fonctionnent | Passage à « Récupération des photos… » puis « Analyse en cours… » |
| 5 | Temps total jusqu'au verdict | Chronométré automatiquement (console + affiché sous le spinner : lecture / photos) ; ajouter ~5-7 s de verdict progressif |

## Ce qui est déjà validé (sans appareil)

- **Extracteurs injectés : 3/3 PASS** sur les fixtures réelles de l'extension
  (leboncoin « Peugeot 308 » 3 photos, lacentrale « Ford Ranger » 6 photos,
  autoscout24 « Dacia Sandero » 5 photos) — même moteur d'extraction, injecté
  tel que dans la WebView.
- Chaîne intake → verdict : identique à l'extension Chrome (déjà en prod).
- Build web inchangé (l'appli n'affecte pas le site : tout est derrière
  `Capacitor.isNativePlatform()`).

## Limites connues du prototype

- L'ouverture de l'appli hôte depuis la Share Extension iOS passe par la chaîne
  de répondeurs (`openURL:`) : fiable en build de développement, **à remplacer
  (App Group + bannière) avant toute publication App Store**. Filet : l'URL est
  copiée dans le presse-papiers.
- Android : code complet (manifest + MainActivity) mais non compilé ici
  (pas de SDK Android sur ce poste).
- Les vidéos `public/hero/*.mp4` sont embarquées dans l'appli (28 Mo
  d'assets) : à exclure du build mobile si l'appli devient réelle.
- Xcode absent de ce poste : le target d'extension se crée en 5 clics guidés
  ci-dessus (un target Xcode ne se scripte pas fiablement sans Xcode installé).
