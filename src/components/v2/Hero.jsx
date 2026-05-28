import React, { useRef, useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useHeroScrollProgress } from './hero/useHeroScrollProgress'
import HeroScene from './hero/HeroScene'
import HeroCurtain from './hero/HeroCurtain'
import HeroText from './hero/HeroText'
import HeroRevealText from './hero/HeroRevealText'
import HeroPlanetLabels from './hero/HeroPlanetLabels'

/* ────────────────────────────────────────────────────────────
   HERO V2 — Phase 2.9 v3 + fix 2.9.1B
   Container 5000px de haut. À l'intérieur, .hero-fixed en
   position:fixed (au lieu de sticky — robuste face aux
   ancêtres avec overflow-x:hidden) pilotée par scrollY via
   useHeroScrollProgress.
   ──────────────────────────────────────────────────────────── */

export default function Hero({ onFreeAnalysis, onSelectTier }) {
  const heroRef = useRef(null)
  const { progress, isInView } = useHeroScrollProgress(heroRef)
  const reduceMotion = useReducedMotion()
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768
  )

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handlePrimaryCta = () => onFreeAnalysis?.()
  const handleSecondaryCta = () => {
    if (typeof window !== 'undefined' && heroRef.current) {
      const target = heroRef.current.offsetTop + heroRef.current.offsetHeight
      window.scrollTo({ top: target, behavior: 'smooth' })
    }
  }

  return (
    <>
      <style>{`
        .hero-section {
          position: relative;
          height: 5000px;
          background: #050507;
          /* PAS d'overflow ici — sinon casse fixed/sticky aussi */
        }
        .hero-fixed {
          position: fixed;
          top: 0; left: 0;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          z-index: 0;
        }
        body.v2-compact .hero-section { height: 5000px; }
      `}</style>
      <section ref={heroRef} className="hero-section" id="hero">
        <div
          className="hero-fixed"
          style={{
            visibility: isInView ? 'visible' : 'hidden',
            pointerEvents: isInView ? 'auto' : 'none',
          }}
        >
          <HeroScene progress={progress} isMobile={isMobile} reduceMotion={reduceMotion} />
          <HeroCurtain progress={progress} />
          <HeroText
            progress={progress}
            onPrimaryCta={handlePrimaryCta}
            onSecondaryCta={handleSecondaryCta}
          />
          <HeroRevealText progress={progress} />
          <HeroPlanetLabels progress={progress} />
        </div>
      </section>
    </>
  )
}
