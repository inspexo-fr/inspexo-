import React from 'react'

// Sources numérotées en fin de dossier + appels de notes [n] dans le corps.
// Registre construit au rendu : register(cle, libelle, url?) renvoie le numéro
// stable de la source (dédupliquée par clé).
export function creerRegistreSources() {
  const parCle = new Map()
  const liste = []
  return {
    register(cle, libelle, url = null) {
      if (parCle.has(cle)) return parCle.get(cle)
      const n = liste.length + 1
      parCle.set(cle, n)
      liste.push({ n, libelle, url })
      return n
    },
    liste,
  }
}

// Appel de note : [1] [2] — en exposant mono.
export function Ref({ nums }) {
  const liste = (Array.isArray(nums) ? nums : [nums]).filter(n => n != null)
  if (liste.length === 0) return null
  return <span className="ref">{liste.map(n => `[${n}]`).join(' ')}</span>
}

export default function Footnotes({ sources, titre = 'Sources' }) {
  if (!sources || sources.length === 0) return null
  return (
    <div className="doc-sec">
      <p className="eyebrow">{titre}</p>
      <ol className="sources">
        {sources.map(s => (
          <li key={s.n}>
            [{s.n}] {s.libelle}
            {s.url && (
              <>
                {' '}
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {(() => { try { return new URL(s.url).hostname.replace(/^www\./, '') } catch (_) { return s.url } })()}
                </a>
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
