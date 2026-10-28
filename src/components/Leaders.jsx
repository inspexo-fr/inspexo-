import React from 'react'

// Critères à pointillés : libellé … valeur. « non évalué » quand la note
// manque — le silence d'une annonce ne fait jamais baisser la note.
// items : [{ libelle, note (0-20 ou null), detail? }]
function classeNote(note) {
  if (note == null) return 'na'
  if (note >= 14) return 'ok'
  if (note >= 8) return 'mid'
  return 'bad'
}

export default function Leaders({ items, ariaLabel = 'Notation par critère' }) {
  return (
    <div className="crit" aria-label={ariaLabel}>
      {items.map((it, i) => (
        <div key={i}>
          <span>{it.libelle}</span>
          <span className="leader" aria-hidden="true"></span>
          {it.note == null ? (
            <span className="val na">non évalué</span>
          ) : (
            <span className={`val num ${classeNote(it.note)}`}>
              {String(it.note).padStart(2, '0')}/20
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
