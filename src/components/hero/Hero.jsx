import React, { useRef } from 'react'
import styles from './Hero.module.css'
import useScrollProgress from '../../hooks/useScrollProgress'
import useLenis from '../../hooks/useLenis'
import ChapterCounter from './ChapterCounter'
import SkipLink from './SkipLink'
import { SEQUENCES, COPY } from '../../lib/constants'

/**
 * Hero orchestrateur (étape 3 : DOM-only, pas de 3D).
 *
 * Structure :
 *   <section> 4×100dvh (réservoir de scroll)
 *     <div .stage> position: fixed (immune au transform Lenis sur body)
 *       overline / H1 / sub / CTAs (DOM léger pour LCP immédiat)
 *       <ChapterCounter />
 *       <SkipLink />
 *       (le canvas 3D viendra ici en Étape 4 via React.lazy + Suspense)
 *
 * Le H1 est rendu immédiatement avec le wording de la séquence opening
 * (pas d'animation bloquante sur le H1 = LCP minimal).
 */

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

export default function Hero({ onPrimaryCta, onSecondaryCta, onAfter }) {
  // Lenis smooth scroll global (compatible avec position:fixed du Hero)
  useLenis(true)

  const ref = useRef(null)
  const progress = useScrollProgress(ref)
  const seqIdx = currentSequenceIndex(progress)
  const seqId = SEQUENCES[seqIdx].id

  // Wording dérivé de la séquence courante
  const h1Lines = COPY.h1[seqId] || COPY.h1.opening
  const emberKey = COPY.emberWord[seqId] || COPY.emberWord.opening
  const sub = COPY.sub[seqId] // peut être undefined (opening, lock)
  const showCtas = seqId === 'clusters'

  return (
    <section ref={ref} className={styles.hero} id="hero">
      <div className={styles.stage}>
        <div className={styles.frame}>
          <div className={styles.overline}>{COPY.overline}</div>

          <h1 className={styles.h1}>
            {h1Lines.map((line, i) => (
              <span key={i} className={styles.h1Line}>
                {applyEmberWord(line, emberKey)}
              </span>
            ))}
          </h1>

          {sub && <p className={styles.sub}>{sub}</p>}

          {showCtas && (
            <div className={styles.ctas}>
              <button
                type="button"
                className={`${styles.cta} ${styles.ctaPrimary}`}
                onClick={onPrimaryCta}
              >
                {COPY.ctaPrimary}
                <span aria-hidden="true" className={styles.ctaArrow}>→</span>
              </button>
              <button
                type="button"
                className={`${styles.cta} ${styles.ctaGhost}`}
                onClick={onSecondaryCta}
              >
                {COPY.ctaSecondary}
              </button>
            </div>
          )}

          {showCtas && (
            <ul className={styles.trustRow} aria-label="Garanties">
              {COPY.trust.map((t, i) => (
                <li key={i} className={styles.trustItem}>{t}</li>
              ))}
            </ul>
          )}
        </div>

        <ChapterCounter index={seqIdx} />
        <SkipLink targetId="after-hero" />
      </div>
    </section>
  )
}
