import { useEffect } from 'react'
import Lenis from 'lenis'

/**
 * useLenis(active = true)
 *   - active=false → ne fait rien (utile pour le mode legacy intact)
 *   - active=true  → init Lenis smooth scroll global
 */
export default function useLenis(active = true) {
  useEffect(() => {
    if (!active) return undefined

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
    })

    let rafId
    const raf = (time) => {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [active])
}
