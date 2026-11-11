import React, { useState, useEffect, useRef } from 'react'

// Bandeau cookies — chantier design (nov. 2026) : compact, deux lignes au plus
// sur téléphone, une sur ordinateur, et il ne RECOUVRE plus rien : tant qu'il
// est affiché, le bas de la page est réservé à sa hauteur exacte (mesurée,
// donc juste quelle que soit la largeur). Le texte légal est inchangé.
export default function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    try {
      if (!localStorage.getItem('inspexo_cookies_accepted')) setVisible(true)
    } catch (_) { setVisible(true) }
  }, [])

  useEffect(() => {
    if (!visible || !ref.current) return undefined
    const reserver = () => { document.body.style.paddingBottom = `${ref.current?.offsetHeight ?? 0}px` }
    reserver()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(reserver) : null
    ro?.observe(ref.current)
    window.addEventListener('resize', reserver)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', reserver)
      document.body.style.paddingBottom = ''
    }
  }, [visible])

  const accept = () => {
    try { localStorage.setItem('inspexo_cookies_accepted', 'true') } catch (_) { /* stockage indisponible */ }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="cookies" ref={ref} role="region" aria-label="Cookies">
      <p>
        Ce site utilise des cookies essentiels pour l'authentification et le paiement sécurisé.{' '}
        <a href="/politique-de-confidentialite">En savoir plus</a>
        {/* Bouton dans le fil du texte : deux lignes au plus sur téléphone. */}
        <button type="button" onClick={accept} aria-label="J'ai compris">
          <span className="cookies-long">J'ai compris</span><span className="cookies-court">OK</span>
        </button>
      </p>
    </div>
  )
}
