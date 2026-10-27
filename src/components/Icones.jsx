// Icônes SVG sobres (trait 1.8, courant), en remplacement des emojis.
// Usage : <IconeAppareilPhoto /> hérite de la couleur du texte (currentColor).
import React from 'react'

const base = (size) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
  style: { verticalAlign: '-3px', flexShrink: 0 },
  'aria-hidden': true,
})

export const IconeAppareilPhoto = ({ size = 17 }) => (
  <svg {...base(size)}>
    <path d="M3 8.2A2.2 2.2 0 0 1 5.2 6h1.9l1.1-1.7A2 2 0 0 1 9.9 3.4h4.2a2 2 0 0 1 1.7.9L16.9 6h1.9A2.2 2.2 0 0 1 21 8.2v9.6a2.2 2.2 0 0 1-2.2 2.2H5.2A2.2 2.2 0 0 1 3 17.8z" />
    <circle cx="12" cy="13" r="3.4" />
  </svg>
)

export const IconeLoupe = ({ size = 17 }) => (
  <svg {...base(size)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.4-4.4" />
  </svg>
)

export const IconeCadenas = ({ size = 17 }) => (
  <svg {...base(size)}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
  </svg>
)

export const IconeVideo = ({ size = 17 }) => (
  <svg {...base(size)}>
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="m16 10 5-3v10l-5-3" />
  </svg>
)

export const IconeAlerte = ({ size = 17 }) => (
  <svg {...base(size)}>
    <path d="M12 3.5 2.8 19.5a1 1 0 0 0 .9 1.5h16.6a1 1 0 0 0 .9-1.5z" />
    <path d="M12 9.5v5" />
    <path d="M12 17.6v.1" />
  </svg>
)

export const IconeDocument = ({ size = 17 }) => (
  <svg {...base(size)}>
    <path d="M7 3h7l4 4v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M14 3v4h4" />
    <path d="M9 12h6M9 16h6" />
  </svg>
)

export const IconeStats = ({ size = 17 }) => (
  <svg {...base(size)}>
    <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />
  </svg>
)

export const IconeOutil = ({ size = 17 }) => (
  <svg {...base(size)}>
    <path d="M14.5 6.5a4 4 0 0 1 5-5l-3 3 .9 2.1L19.5 7.5l3-3a4 4 0 0 1-5 5L8 19a2.1 2.1 0 0 1-3-3z" />
  </svg>
)

export const IconeUtilisateur = ({ size = 17 }) => (
  <svg {...base(size)}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </svg>
)

export const IconeChat = ({ size = 17 }) => (
  <svg {...base(size)}>
    <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" />
  </svg>
)

export const IconeEclair = ({ size = 17 }) => (
  <svg {...base(size)}>
    <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z" />
  </svg>
)

export const IconeRepere = ({ size = 17 }) => (
  <svg {...base(size)}>
    <path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11z" />
    <circle cx="12" cy="10" r="2.6" />
  </svg>
)

export const IconeBouclier = ({ size = 17 }) => (
  <svg {...base(size)}>
    <path d="M12 3 5 5.8v5.4c0 4.4 2.9 7.6 7 9.3 4.1-1.7 7-4.9 7-9.3V5.8z" />
    <path d="m9 11.6 2.2 2.2L15 10" />
  </svg>
)

export const IconeCloche = ({ size = 17 }) => (
  <svg {...base(size)}>
    <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
    <path d="M10.3 19a2 2 0 0 0 3.4 0" />
  </svg>
)

export const IconeEnveloppe = ({ size = 17 }) => (
  <svg {...base(size)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </svg>
)

export const IconeCalendrier = ({ size = 17 }) => (
  <svg {...base(size)}>
    <rect x="4" y="5" width="16" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M4 10h16" />
  </svg>
)

export const IconeCoche = ({ size = 17 }) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.2 12.4 2.6 2.6 5-5.6" />
  </svg>
)
