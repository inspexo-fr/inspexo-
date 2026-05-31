import React, { useRef, Suspense, lazy } from 'react'
import styles from './Hero.module.css'
import useScrollProgress from '../../hooks/useScrollProgress'
import useLenis from '../../hooks/useLenis'
import ChapterCounter from './ChapterCounter'
import SkipLink from './SkipLink'
import { SEQUENCES, COPY } from '../../lib/constants'

// HeroCinematic — Méthode A (spec docs/hero-spec.md). Lazy : ~1 KB JS gz
// + vidéo en preload async. Le H1 reste le LCP (peint avant le chunk fetch).
const HeroCinematic = lazy(() => import('./HeroCinematic'))

/**
 * CinematicBoundary — garde contre échec de fetch du chunk lazy (rare :
 * réseau offline pendant la navigation). Le reste du Hero (overlays DOM)
 * reste fonctionnel. Failure du <video> elle-même gérée par onError dans
 * HeroCinematic (swap vers poster img).
 */
class CinematicBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(err) {
    // eslint-disable-next-line no-console
    console.warn('[HeroCinematic] disabled —', err?.message || err)
  }
  render() { return this.state.hasError ? null : this.props.children }
}

/**
 * Hero orchestrateur (Méthode A : scrub vidéo + overlays cross-dissolve).
 *
 * Un seul `progress` (0→1) pilote :
 *   - HeroCinematic : video.currentTime = progress * video.duration
 *   - Overlays : opacité de chaque bloc texte via trap()
 *
 * Structure :
 *   <section> 4×100dvh (réservoir de scroll)
 *     <div .stage> position: fixed (immune au transform Lenis sur body)
 *       <HeroCinematic />   z1  — vidéo all-intra scrubée
 *       <div .voile />      z2  — voile radial pour lisibilité texte
 *       <div .frame>        z4  — H1 stack / sub stack / CTA / counter
 *         (les H1 et sub sont stackés en CSS grid, opacité-driven)
 *
 * Le H1 (cellule active à un instant donné) reste le LCP — paint immédiat
 * sans attendre le chunk vidéo.
 *
 * Séquences (cf. constants.SEQUENCES) :
 *   opening  [0.00, 0.15] — H1 "Une voiture d'occasion..."
 *   belt     [0.15, 0.65] — H1 "Filmez-la. L'IA voit..." + sub
 *   lock     [0.65, 0.75] — pas de H1 (vidéo seule, moment d'impact)
 *   clusters [0.75, 1.00] — H1 "Chaque modèle..." + sub + CTAs + trust
 */

/**
 * trap — opacité trapézoïdale.
 * Fade-in linéaire sur [s-f, s], plateau 1 sur [s, e], fade-out sur [e, e+f].
 * (Corrigé vs spec : Math.max(x, 0, 1) du spec retournait toujours 1.)
 */
function trap(p, [s, e], f = 0.05) {
  const clamp01 = (x) => Math.max(0, Math.min(1, x))
  return Math.min(
    clamp01((p - (s - f)) / f),   // fade-in
    clamp01(((e + f) - p) / f),   // fade-out
  )
}

function currentSequenceIndex(progress) {
  if (progress < 0.15) return 0 // opening
  if (progress < 0.65) return 1 // belt
  if (progress < 0.75) return 2 // lock
  return 3                       // clusters
}

/**
 * Highlight du "emberWord" dans une ligne du H1.
 * Cherche la sous-chaîne et l'enveloppe en <span class="ember">.
 */
function applyEmberWord(line, word) {
  if (!word || !line.toLowerCase().includes(word.toLowerCase())) return line
  const idx = line.toLowerCase().indexOf(word.toLowerCase())
  const before = line.slice(0, idx)
  const match = line.slice(idx, idx + word.length)
  const after = line.slice(idx + word.length)
  return (
    <>
      {before}
      <span className={styles.ember}>{match}</span>
      {after}
    </>
  )
}

// Map seqId → range pour lookup O(1)
const RANGE_BY_ID = SEQUENCES.reduce((acc, s) => { acc[s.id] = s.range; return acc }, {})

export default function Hero({ onPrimaryCta, onSecondaryCta, onAfter }) {
  // Lenis smooth scroll global (compatible avec position:fixed du Hero)
  useLenis(true)

  const ref = useRef(null)
  const progress = useScrollProgress(ref)
  const seqIdx = currentSequenceIndex(progress)

  // Acte 4 : CTAs fade-in sur range clusters
  const ctaOpacity = trap(progress, RANGE_BY_ID.clusters)
  const ctaInteractive = ctaOpacity > 0.5

  return (
    <section ref={ref} className={styles.hero} id="hero">
      <div className={styles.stage}>
        <CinematicBoundary>
          <Suspense fallback={null}>
            <HeroCinematic progress={progress} />
          </Suspense>
        </CinematicBoundary>

        {/* Voile radial sombre — assure la lisibilité du texte sur la vidéo
            quand elle s'éclaircit (acte 4 notamment). */}
        <div className={styles.voile} aria-hidden="true" />

        <div className={styles.frame}>
          <div className={styles.overline}>{COPY.overline}</div>

          {/* H1 stack — crossfade par séquence via trap().
              Tous les variants sont rendus stackés en CSS grid, opacité-driven.
              Lock (0.65-0.75) n'a pas d'entrée → trou intentionnel (vidéo seule). */}
          <div className={styles.h1Stack}>
            {Object.entries(COPY.h1).map(([seqId, lines]) => {
              const opacity = trap(progress, RANGE_BY_ID[seqId])
              if (opacity <= 0.01) return null
              const emberKey = COPY.emberWord[seqId] || ''
              return (
                <h1
                  key={seqId}
                  className={styles.h1}
                  style={{ opacity }}
                  aria-hidden={opacity < 0.5}
                >
                  {lines.map((line, i) => (
                    <span key={i} className={styles.h1Line}>
                      {applyEmberWord(line, emberKey)}
                    </span>
                  ))}
                </h1>
              )
            })}
          </div>

          {/* Sub stack — crossfade similaire, COPY.sub n'existe que pour
              belt + clusters. Les autres séquences = pas de sub. */}
          <div className={styles.subStack}>
            {Object.entries(COPY.sub).map(([seqId, text]) => {
              const opacity = trap(progress, RANGE_BY_ID[seqId])
              if (opacity <= 0.01) return null
              return (
                <p
                  key={seqId}
                  className={styles.sub}
                  style={{ opacity }}
                  aria-hidden={opacity < 0.5}
                >
                  {text}
                </p>
              )
            })}
          </div>

          {/* CTAs — fade-in acte 4 (range clusters). pointerEvents off
              tant que l'opacité < 0.5 pour éviter clics fantômes. */}
          <div
            className={styles.ctaWrap}
            style={{
              opacity: ctaOpacity,
              pointerEvents: ctaInteractive ? 'auto' : 'none',
            }}
            aria-hidden={!ctaInteractive}
          >
            <div className={styles.ctas}>
              <button
                type="button"
                className={`${styles.cta} ${styles.ctaPrimary}`}
                onClick={onPrimaryCta}
                tabIndex={ctaInteractive ? 0 : -1}
              >
                {COPY.ctaPrimary}
                <span aria-hidden="true" className={styles.ctaArrow}>→</span>
              </button>
              <button
                type="button"
                className={`${styles.cta} ${styles.ctaGhost}`}
                onClick={onSecondaryCta}
                tabIndex={ctaInteractive ? 0 : -1}
              >
                {COPY.ctaSecondary}
              </button>
            </div>
            <ul className={styles.trustRow} aria-label="Garanties">
              {COPY.trust.map((t, i) => (
                <li key={i} className={styles.trustItem}>{t}</li>
              ))}
            </ul>
          </div>
        </div>

        <ChapterCounter index={seqIdx} />
        <SkipLink targetId="after-hero" />
      </div>
    </section>
  )
}
