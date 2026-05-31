# SPEC D'INTÉGRATION — Hero cinématique scrubé (Claude Code, CRA + JS)
> Stack : CRA + JavaScript, pas de Next/TS/Tailwind. Source de vérité : `src/lib/constants.js`.

---

## 0. ARCHITECTURE EN COUCHES
```
z3  Overlays interactifs  (hover amas → logos)        ← React/DOM
z2  Texte + compteur + CTA + scan UI                  ← React/DOM (synchro scroll)
z1  Cinématique scrubée  (hero_wide/vert.mp4)         ← <video> ou <canvas>
z0  Fond #0F0E0D                                       ← CSS
```
**Un seul `progress` (0→1)** issu de `useScrollProgress` pilote **À LA FOIS** la frame de la vidéo **et** les overlays. La cinématique (espace, traversée, traînées baked, verrouillage, amas) est dans la vidéo ; le reste est temps réel et éditable.

---

## 1. SCRUB FRAME-ACCURATE — 2 méthodes

### Méthode A — `<video>` all-intra (à faire en premier)
- Charger `hero_wide.mp4` (vidéo all-intra = chaque frame seekable, voir brief rendu).
- Au scroll : `video.currentTime = progress * video.duration`.
- **Throttle par rAF** : ne seek que si la frame cible change. Ne **jamais** seek dans l'event scroll directement.
```js
let raf = 0, pending = 0;
function onProgress(p){ pending = p; if(!raf) raf = requestAnimationFrame(apply); }
function apply(){
  raf = 0;
  if (video.readyState >= 2 && video.duration) {
    const t = pending * video.duration;
    if (Math.abs(video.currentTime - t) > 1/48) video.currentTime = t; // ~½ frame de seuil
  }
}
```
- `video.pause()` (jamais play), `muted`, `playsInline`, `preload="auto"` **après montage**.

### Méthode B — Canvas image-sequence (upgrade « soie Apple », si A pas assez fluide)
- Précharger ~200 WebP (`seq/f_###.webp`) en `Image()`, dessiner sur `<canvas>` selon `frameIndex = Math.round(progress*(N-1))`.
- Afficher dès les 1ʳ frames chargées (progressif), barre de préchargement invisible.
- Plus lourd à charger, **scrub indestructible**. Réserver si la Méthode A stutter sur ta machine cible.

**Reco** : ship la **Méthode A**. Si ton œil voit du stutter au scrub → bascule B.

---

## 2. LCP & LAZY (ne pas casser l'acquis de l'Étape 3)
- Le **H1 reste le LCP** (paint immédiat). La cinématique **ne doit pas** être dans le chemin LCP.
- Monter le composant vidéo/canvas en **`React.lazy`** + `<Suspense fallback={null}>`, **après hydratation**. `poster` = `poster_wide.webp` (s'affiche pendant le chargement).
- **Mobile / `prefers-reduced-motion`** : **ne pas charger la vidéo** → afficher uniquement le **poster** (frame finale ou frame héros), aucun scrub.
- Choix de source responsive : `hero_wide.mp4` desktop / `hero_vert.mp4` mobile (via `matchMedia`, choisi au montage).

---

## 3. SYNCHRO DES OVERLAYS (réutilise `constants.js`)
Le même `progress` pilote le texte par séquence (cross-dissolve) :
```js
import { SEQUENCES, COPY } from '../lib/constants';
const trap = (p,[s,e],f=0.05)=> Math.min(
  Math.max((p-(s-f))/f,0,1), Math.max(((e+f)-p)/f,0,1)
);
// opacité de chaque bloc = trap(progress, SEQUENCES[i].range)
```
- **Texte par acte** : `COPY.h1.opening` → `belt` → (acte 3 = court, pas de H1 ou un mot) → `clusters`. Sub `COPY.sub.*`. Mot-clé ember persistant (`COPY.emberWord`).
- **Compteur** : `0X / 04 — COPY.counter[i]` selon l'acte.
- **CTA `COPY.ctaPrimary`** : apparaît en acte 4 (≥75 %).
- **Scan UI** (optionnel, en plus du scan baked) : un fin trait/halo ember en SVG sur la zone héros pendant l'acte 2. Subtil.
- **Voile** : dégradé radial sombre derrière le texte → lisibilité quand la vidéo s'éclaircit (acte 4).

---

## 4. HOVER AMAS — acte 4 (polish v1.5)
À `progress ≈ 1`, la vidéo montre les 8 amas **figés à des positions écran connues**. Placer des **hotspots DOM absolus** à ces coordonnées :
- Hover → afficher les **logos de la marque** (`CLUSTERS[i].brands`, placeholders pour l'instant) en monochrome crème + léger focus (tilt-shift CSS sur le reste).
- Mappe les positions une fois la dernière frame calée (constantes de position à relever sur le rendu final).

---

## 5. RESPONSIVE & PERF
- `dvh` (pas `vh`) pour la hauteur (barre d'adresse iOS).
- Vidéo all-intra = décodage léger ; surveiller le **poids du fichier** (viser < ~8–12 Mo wide). Si canvas-sequence : budget préchargement + `revokeObjectURL`.
- three.js **n'est plus requis** pour le hero (la 3D est dans la vidéo) → bundle initial encore plus léger. (Garder R3F seulement si on réintroduit de l'interactif 3D plus tard.)

---

## 6. CRITÈRES D'ACCEPTATION
- **Scrub fluide** (avant ET arrière), zéro saccade, sur Chrome desktop GPU réel.
- **LCP inchangé** (H1 immédiat ; vérifier que la vidéo n'apparaît pas dans l'élément LCP).
- `prefers-reduced-motion` → **poster statique**, pas de scrub.
- Mobile → `hero_vert.mp4` ou poster, fluide.
- Overlays nets et lisibles à tout `progress` ; texte verbatim depuis `COPY`.

---

## 7. FICHIERS
```
public/hero/hero_wide.mp4  hero_vert.mp4  poster_wide.webp  poster_vert.webp
public/hero/seq/*.webp                     (si Méthode B)
src/components/hero/HeroCinematic.jsx       (lazy : <video>/<canvas> + scrub)
src/components/hero/Hero.jsx                (orchestrateur : Suspense + overlays)
src/hooks/useScrollProgress.js             (déjà là)
```

## 8. ORDRE
1. Intégrer **Méthode A** (`<video>` all-intra) + poster + lazy post-LCP.
2. Câbler `progress` → scrub + overlays (texte/compteur/CTA via `constants`).
3. Responsive (wide/vert) + reduced-motion (poster).
4. Hover amas (v1.5).
5. Si stutter → Méthode B (canvas-sequence).

**Avant chaque grosse étape : récap + confirmation.** Tant que la vidéo n'est pas livrée, bosse avec un **placeholder** (n'importe quel mp4 court) pour valider le mécanisme de scrub.
