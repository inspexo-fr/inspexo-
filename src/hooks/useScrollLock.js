import { useEffect } from 'react'

/**
 * Bloque le scroll du body (fix iOS Safari) et ajoute .modal-open (masque StickyCTA).
 * @param {boolean} enabled  true par défaut — passer isOpen pour les modales contrôlées par prop
 */
export default function useScrollLock(enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const scrollY = window.scrollY

    document.body.classList.add('modal-open')
    document.body.style.position = 'fixed'
    document.body.style.top      = `-${scrollY}px`
    document.body.style.left     = '0'
    document.body.style.right    = '0'
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.classList.remove('modal-open')
      document.body.style.position = ''
      document.body.style.top      = ''
      document.body.style.left     = ''
      document.body.style.right    = ''
      document.body.style.overflow = ''
      window.scrollTo(0, scrollY)
    }
  }, [enabled])
}
