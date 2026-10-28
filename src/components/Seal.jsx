import React from 'react'

// Cachet IX — logo temporaire de la nouvelle DA. SEUL endroit à modifier le
// jour où le vrai logo le remplace : toutes les pages passent par ici.
export default function Seal({ size = 30 }) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} aria-hidden="true">
      <rect className="seal-bg" x="0" y="0" width="30" height="30" />
      <rect className="seal-line" x="3.5" y="3.5" width="23" height="23" fill="none" strokeWidth="1" />
      <path className="seal-fg" d="M8.2 9h2.6v12H8.2zM13.2 9h2.9l2.3 3.9L20.7 9h2.9l-3.8 5.9 4 6.1h-2.9l-2.5-4.1-2.5 4.1h-2.9l4-6.1z" />
    </svg>
  )
}
