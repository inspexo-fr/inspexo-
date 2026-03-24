import { useEffect } from 'react'

/**
 * Bloque le scroll sans déplacer la page (pas de position:fixed).
 * Gère aussi la classe body.modal-open et iOS touchmove.
 * @param {boolean} enabled  true par défaut — passer isOpen pour les modales contrôlées par prop
 */
export default function useScrollLock(enabled = true) {
  useEffect(() => {
    if (!enabled) return

    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow             = 'hidden'
    document.body.style.height               = '100%'
    document.documentElement.style.height    = '100%'
    document.body.classList.add('modal-open')

    const preventScroll = (e) => {
      const isScrollable = (el) => {
        const style = window.getComputedStyle(el)
        return style.overflowY === 'auto' || style.overflowY === 'scroll'
      }
      let el = e.target
      while (el && el !== document.body) {
        if (isScrollable(el) && el.scrollHeight > el.clientHeight) return
        el = el.parentElement
      }
      e.preventDefault()
    }
    document.addEventListener('touchmove', preventScroll, { passive: false })

    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow             = ''
      document.body.style.height               = ''
      document.documentElement.style.height    = ''
      document.body.classList.remove('modal-open')
      document.removeEventListener('touchmove', preventScroll)
    }
  }, [enabled])
}
