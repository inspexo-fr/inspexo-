import React from 'react'
import styles from './Hero.module.css'
import { COPY } from '../../lib/constants'

/**
 * Compteur minimal "0X / 04 — <titre>".
 * Discret, Plus Jakarta. Seul élément HUD conservé (clin d'œil Terminal légitime).
 */
export default function ChapterCounter({ index }) {
  // index : 0..3 (correspond à SEQUENCES)
  const safe = Math.max(0, Math.min(3, index))
  const numero = String(safe + 1).padStart(2, '0')
  const title = COPY.counter[safe]
  return (
    <div className={styles.counter} aria-hidden="true">
      <span className={styles.counterNum}>{numero} / 04</span>
      <span className={styles.counterSep}>—</span>
      <span className={styles.counterTitle}>{title}</span>
    </div>
  )
}
