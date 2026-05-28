import { useEffect, useState } from 'react'

/**
 * Retourne la progression 0→1 du scroll dans la section référencée par `ref`.
 * - 0 quand la section commence à entrer dans le viewport (top du conteneur = 0)
 * - 1 quand la section est entièrement traversée (totalScrollable atteint)
 *
 * Utilise un seul rAF par event scroll pour éviter le throttling React.
 * Compatible Lenis (Lenis dispatch des events scroll natifs sur window).
 */
export default function useScrollProgress(ref) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let rafId = null
    const update = () => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (!ref.current) return
        const rect = ref.current.getBoundingClientRect()
        const sectionHeight = ref.current.offsetHeight
        const viewportHeight = window.innerHeight
        const totalScrollable = sectionHeight - viewportHeight
        const scrolledIn = Math.max(0, -rect.top)
        const p = totalScrollable > 0
          ? Math.max(0, Math.min(1, scrolledIn / totalScrollable))
          : 0
        setProgress(p)
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
  }, [ref])

  return progress
}
