import React from 'react'
import styles from './Hero.module.css'

/**
 * Lien "Passer" pour accessibilité clavier.
 * Caché visuellement sauf au focus ; cible l'élément après le Hero.
 */
export default function SkipLink({ targetId = 'after-hero' }) {
  const onClick = (e) => {
    e.preventDefault()
    const el = document.getElementById(targetId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      el.focus?.()
    }
  }
  return (
    <a href={`#${targetId}`} onClick={onClick} className={styles.skipLink}>
      Passer le Hero
    </a>
  )
}
