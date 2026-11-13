import React from 'react'
import { libelleSource } from './DossierApercu'

// SPRINT 24 — « Points signalés par des propriétaires ». Des contrôles à faire,
// jamais une panne affirmée ni un montant ; chacun cité par au moins 3 sites
// indépendants (forums, garages). Sans effet sur la note.
export default function PointsProprietairesBloc({ points }) {
  if (!Array.isArray(points) || points.length === 0) return null
  return (
    <div className="doc-sec" id="points-proprietaires">
      <p className="eyebrow">Points signalés par des propriétaires</p>
      <p className="c-graphite" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 4 }}>
        {points[0].mention} Ils ne changent pas la note : ce sont des contrôles à faire sur place.
      </p>
      {points.map((p, i) => (
        <div key={i} style={{ padding: '10px 0', borderTop: '1px solid var(--filet)' }}>
          <b style={{ fontSize: 15 }}>À contrôler : {p.quoi}</b>
          {p.quand && <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 2 }}>Quand : {p.quand}.</p>}
          {p.signe && <p style={{ fontSize: 14, lineHeight: 1.6 }}>À quoi le reconnaître : {p.signe}</p>}
          <p className="c-graphite" style={{ fontSize: 13, lineHeight: 1.6 }}>
            Signalé sur {p.n_sources} sites indépendants :{' '}
            {p.sources.map((u, k) => <React.Fragment key={u}>{k > 0 ? ' · ' : ''}<a href={u} target="_blank" rel="noreferrer nofollow">{libelleSource(u)}</a></React.Fragment>)}
          </p>
        </div>
      ))}
    </div>
  )
}
