// Widget Cloudflare Turnstile (anti-robots). DORMANT tant que
// REACT_APP_TURNSTILE_SITE_KEY n'est pas définie : le composant ne rend rien
// et aucun script externe n'est chargé. Activation : scripts/activer-turnstile.mjs.
import React, { useEffect, useRef } from 'react'

const SITE_KEY = process.env.REACT_APP_TURNSTILE_SITE_KEY

export const turnstileActif = () => Boolean(SITE_KEY)

export default function Turnstile({ onToken, action = 'defaut' }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return undefined
    let widgetId = null
    let demonte = false

    const rendre = () => {
      if (demonte || !window.turnstile || !ref.current || widgetId !== null) return
      widgetId = window.turnstile.render(ref.current, {
        sitekey: SITE_KEY,
        action,
        language: 'fr',
        callback: (token) => onToken(token),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
      })
    }

    if (window.turnstile) {
      rendre()
    } else {
      let script = document.getElementById('turnstile-script')
      if (!script) {
        script = document.createElement('script')
        script.id = 'turnstile-script'
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        script.async = true
        document.head.appendChild(script)
      }
      script.addEventListener('load', rendre)
    }
    return () => {
      demonte = true
      if (widgetId !== null && window.turnstile) {
        try { window.turnstile.remove(widgetId) } catch (_) { /* déjà retiré */ }
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!SITE_KEY) return null
  return <div ref={ref} style={{ margin: '10px 0' }} />
}
