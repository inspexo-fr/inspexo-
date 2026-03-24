import { useEffect, useRef } from 'react'

/**
 * Bloque le scroll du body sans déplacer la page.
 * @param {boolean} enabled  true par défaut — passer isOpen pour les modales contrôlées par prop
 */
export default function useScrollLock(enabled = true) {
  const scrollRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    scrollRef.current = window.scrollY

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow    = 'hidden'
    document.body.style.paddingRight = `${scrollbarWidth}px`
    document.body.classList.add('modal-open')

    return () => {
      document.body.style.overflow    = ''
      document.body.style.paddingRight = ''
      document.body.classList.remove('modal-open')
    }
  }, [enabled])
}
