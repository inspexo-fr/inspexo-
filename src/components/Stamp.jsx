import React from 'react'

// Tampon de verdict — trois couleurs, la couleur est portée par le texte et
// le double filet, jamais par un fond.
const LIBELLES = {
  vert: { classe: 'vert', label: 'FEU VERT' },
  orange: { classe: 'ambre', label: 'PRUDENCE' },
  rouge: { classe: 'rouge', label: 'SIGNAUX ROUGES' },
}

export default function Stamp({ verdict, score, label = null, className = '' }) {
  const v = LIBELLES[verdict] || { classe: 'neutre', label: label || String(verdict || '').toUpperCase() }
  const lab = label || v.label
  return (
    <div
      className={`stamp ${v.classe} ${className}`.trim()}
      role="img"
      aria-label={`${lab}, ${score} sur 100`}
    >
      <span className="lab">{lab}</span>
      <span className="score num">{score}<small>/100</small></span>
    </div>
  )
}
