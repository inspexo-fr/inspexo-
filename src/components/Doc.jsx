import React from 'react'

// Cadre dossier : bordure pleine + en-tête numéro / date en mono.
// numero : « Dossier n° IX-2026-04812 » ; date : « 28.10.2026 · 14:32 ».
export function formatRef(refNum, createdAt) {
  if (refNum == null) return null
  const annee = createdAt ? new Date(createdAt).getFullYear() : new Date().getFullYear()
  return `IX-${annee}-${String(refNum).padStart(5, '0')}`
}

export function formatDateDossier(createdAt) {
  if (!createdAt) return ''
  const d = new Date(createdAt)
  const deux = (n) => String(n).padStart(2, '0')
  return `${deux(d.getDate())}.${deux(d.getMonth() + 1)}.${d.getFullYear()} · ${deux(d.getHours())}:${deux(d.getMinutes())}`
}

export default function Doc({ numero, date, ariaLabel, children, className = '' }) {
  return (
    <article className={`doc ${className}`.trim()} aria-label={ariaLabel}>
      {(numero || date) && (
        <div className="doc-head">
          <span>{numero}</span>
          <span>{date}</span>
        </div>
      )}
      <div className="doc-body">{children}</div>
    </article>
  )
}
