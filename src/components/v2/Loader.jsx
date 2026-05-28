import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* ────────────────────────────────────────────────────────────
   LOADER — Section 00
   - Fond ink, logo INSPEXO blanc, lettres en stagger 60ms
   - Compteur 000 → 100 mono en bas à droite
   - Fade out 400ms après ~1.5s
   ──────────────────────────────────────────────────────────── */

const LETTERS = 'INSPEXO'.split('')
const DURATION_MS = 1500
const FADE_MS = 400

export default function Loader({ onComplete }) {
  const [visible, setVisible] = useState(true)
  const [count, setCount] = useState(0)

  // Counter 0 → 100 sur DURATION_MS
  useEffect(() => {
    const start = performance.now()
    let rafId
    const tick = (now) => {
      const t = Math.min(1, (now - start) / DURATION_MS)
      setCount(Math.round(t * 100))
      if (t < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  // Déclenche la sortie après DURATION_MS, callback après le fade
  useEffect(() => {
    const tHide = setTimeout(() => setVisible(false), DURATION_MS)
    const tDone = setTimeout(() => onComplete?.(), DURATION_MS + FADE_MS)
    document.body.classList.add('loader-active')
    return () => {
      clearTimeout(tHide)
      clearTimeout(tDone)
      document.body.classList.remove('loader-active')
    }
  }, [onComplete])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loader"
          className="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: FADE_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden="true"
        >
          <style>{`
            .loader {
              position: fixed;
              inset: 0;
              z-index: var(--z-loader);
              background: var(--ink);
              display: grid;
              place-items: center;
              pointer-events: none;
            }
            .loader__logo {
              display: inline-flex;
              gap: 0.04em;
              font-family: var(--font-display);
              font-weight: 500;
              font-size: clamp(2.5rem, 8vw, 5.5rem);
              line-height: 1;
              letter-spacing: -0.03em;
              color: var(--white);
            }
            .loader__letter {
              display: inline-block;
              will-change: transform, opacity;
            }
            .loader__counter {
              position: absolute;
              bottom: clamp(24px, 4vw, 48px);
              right:  clamp(24px, 4vw, 48px);
              font-family: var(--font-mono);
              font-size: 12px;
              font-weight: 500;
              letter-spacing: 0.18em;
              color: var(--on-ink-50);
              font-feature-settings: "tnum" 1;
            }
            .loader__label {
              position: absolute;
              bottom: clamp(24px, 4vw, 48px);
              left:   clamp(24px, 4vw, 48px);
              font-family: var(--font-mono);
              font-size: 12px;
              font-weight: 500;
              letter-spacing: 0.18em;
              color: var(--on-ink-50);
              text-transform: uppercase;
            }
            @media (prefers-reduced-motion: reduce) {
              .loader__letter { opacity: 1 !important; transform: none !important; }
            }
          `}</style>

          <span className="loader__label">Initialisation</span>

          <div className="loader__logo" aria-label="INSPEXO">
            {LETTERS.map((ch, i) => (
              <motion.span
                key={i}
                className="loader__letter"
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.6,
                  ease: [0.16, 1, 0.3, 1],
                  delay: i * 0.06,
                }}
              >
                {ch}
              </motion.span>
            ))}
          </div>

          <span className="loader__counter">
            {String(count).padStart(3, '0')}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
