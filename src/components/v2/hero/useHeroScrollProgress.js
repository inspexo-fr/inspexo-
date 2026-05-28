import { useEffect, useState } from 'react'

/**
 * Hook qui retourne :
 *   - progress    : 0..1 selon la progression du scroll dans le Hero (5000px)
 *   - isInView    : true si une partie du Hero overlap le viewport
 *
 * ⚠ DEBUG LOGS Phase 2.9.1B — à retirer après validation Utku.
 */
export function useHeroScrollProgress(heroRef) {
  const [progress, setProgress] = useState(0)
  const [isInView, setIsInView] = useState(true)

  useEffect(() => {
    let rafId = null
    const update = () => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        if (!heroRef.current) {
          // eslint-disable-next-line no-console
          console.warn('[HeroScroll] heroRef.current is NULL')
          rafId = null
          return
        }
        const rect = heroRef.current.getBoundingClientRect()
        const heroHeight = heroRef.current.offsetHeight
        const viewportHeight = window.innerHeight
        const totalScrollable = heroHeight - viewportHeight
        const scrolledIntoHero = Math.max(0, -rect.top)
        const p = totalScrollable > 0
          ? Math.max(0, Math.min(1, scrolledIntoHero / totalScrollable))
          : 0
        // Hero visible si une partie overlap le viewport
        const inView = rect.bottom > 0 && rect.top < viewportHeight
        // eslint-disable-next-line no-console
        console.log(
          '[HeroScroll] rect.top=', Math.round(rect.top),
          'rect.bottom=', Math.round(rect.bottom),
          'inView=', inView,
          'progress=', p.toFixed(3)
        )
        setProgress(p)
        setIsInView(inView)
        rafId = null
      })
    }

    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    update()

    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [heroRef])

  return { progress, isInView }
}
