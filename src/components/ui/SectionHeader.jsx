import React from 'react'
import { motion } from 'framer-motion'

/**
 * SectionHeader — pré-titre mono + titre display.
 *
 * Props:
 *   - eyebrow: string — texte mono uppercase au-dessus (ex: "01 — PROCESS")
 *   - title:   ReactNode — titre principal (display-sm par défaut)
 *   - subtitle: string|ReactNode — optionnel
 *   - size: 'sm' (display-sm) | 'md' (display) — default 'sm'
 *   - align: 'left' | 'center' — default 'left'
 *   - onSurface: 'light' | 'dark' — adapte les couleurs
 */
export default function SectionHeader({
  eyebrow,
  title,
  subtitle,
  size = 'sm',
  align = 'left',
  onSurface = 'light',
  className = '',
  style = {},
}) {
  const titleColor   = onSurface === 'dark' ? 'var(--white)'  : 'var(--ink)'
  const eyebrowColor = onSurface === 'dark' ? 'var(--on-ink-60)' : 'var(--steel)'
  const subtitleCol  = onSurface === 'dark' ? 'var(--on-ink-70)' : 'var(--steel)'
  const titleSize    = size === 'md' ? 'var(--display)' : 'var(--display-sm)'

  return (
    <header
      className={className}
      style={{
        textAlign: align,
        maxWidth: align === 'center' ? 1000 : '100%',
        marginLeft: align === 'center' ? 'auto' : 0,
        marginRight: align === 'center' ? 'auto' : 0,
        ...style,
      }}
    >
      {eyebrow && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10% 0px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            fontWeight: 500,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: eyebrowColor,
            marginBottom: 'var(--space-3)',
          }}
        >
          {eyebrow}
        </motion.div>
      )}
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10% 0px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: titleSize,
          lineHeight: 0.95,
          letterSpacing: '-0.03em',
          color: titleColor,
          margin: 0,
        }}
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10% 0px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-lg)',
            fontWeight: 400,
            lineHeight: 1.5,
            color: subtitleCol,
            marginTop: 'var(--space-3)',
            maxWidth: 640,
            marginLeft: align === 'center' ? 'auto' : 0,
            marginRight: align === 'center' ? 'auto' : 0,
            letterSpacing: '-0.01em',
          }}
        >
          {subtitle}
        </motion.p>
      )}
    </header>
  )
}
