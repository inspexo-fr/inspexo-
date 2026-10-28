import React from 'react'

// Lignes à filets : liste de définitions structurée par des filets fins.
// items : [{ dt, titre, texte }] — dt en mono, titre en gras, texte en corps.
export default function Rows({ items }) {
  return (
    <dl className="rows">
      {items.map((it, i) => (
        <div className="row" key={i}>
          <dt>{it.dt}</dt>
          <dd>
            {it.titre && <b>{it.titre}</b>}
            {it.texte && <p>{it.texte}</p>}
            {it.children}
          </dd>
        </div>
      ))}
    </dl>
  )
}
