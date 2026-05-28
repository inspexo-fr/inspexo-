import { useEffect } from 'react'
import Lenis from 'lenis'

/**
 * Initialise Lenis pour le smooth scroll global.
 * Lenis émet des events `scroll` standards sur window — useScrollProgress
 * écoute window.scroll, donc compatible.
 *
 * ⚠ Lenis applique `transform: translate3d` sur <body>, ce qui peut casser
 * `position: sticky` dans les descendants. Le Hero utilise `position: fixed`
 * pour rester immune à ce transform.
 */
export default function useLenis(active = true) {
  useEffect(() => {
    if (!active) return undefined
    const lenis = new Lenis({
      duration: 1.1,
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
