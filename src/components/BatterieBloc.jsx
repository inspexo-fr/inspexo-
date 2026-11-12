import React, { useState } from 'react'
import { garantiesPourVehicule, questionsBatterie, RELEVE_LE } from '../data/garantiesBatterie'

// SPRINT 23, LOT 3 (point 7) — Batterie des véhicules électriques et hybrides.
// AFFICHAGE SEULEMENT : sans effet sur la note. Chaque garantie montre sa
// source, son pays et sa date ; une source d'un autre pays est dite
// « information de contexte ». Jamais « votre véhicule est couvert ».

const PAYS = { FR: 'France', BE: 'Belgique', UK: 'Royaume-Uni', LU: 'Luxembourg', CH: 'Suisse', IE: 'Irlande' }
const jour = (iso) => iso.split('-').reverse().join('/')

export default function BatterieBloc({ vehicule, annee }) {
  const [copie, setCopie] = useState(false)
  const { energie, garanties } = garantiesPourVehicule(vehicule, annee)
  if (!energie) return null
  const questions = questionsBatterie(energie, vehicule?.marque)

  return (
    <div className="doc-sec" id="batterie">
      <p className="eyebrow">Batterie</p>
      {garanties.length === 0 ? (
        <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 6 }}>
          Aucune garantie batterie confirmée dans nos sources pour ce modèle. Demandez au vendeur le livret ou le
          certificat de garantie de la batterie.
        </p>
      ) : garanties.map((g) => (
        <div key={g.id} style={{ marginTop: 10 }}>
          {g.contexte && (
            <p className="c-ambre" style={{ fontSize: 13, fontWeight: 600 }}>
              Information de contexte : conditions publiées hors de France, les conditions françaises peuvent différer.
            </p>
          )}
          {g.lignes.map((l, i) => <p key={i} style={{ fontSize: 14, lineHeight: 1.6, marginTop: 4 }}>{l}</p>)}
          <p className="c-graphite" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 4 }}>
            {g.sources.map((s, i) => (
              <React.Fragment key={s.url}>
                {i > 0 ? ' · ' : 'Source : '}
                <a href={s.url} target="_blank" rel="noreferrer">{s.titre}</a>
                {` (${PAYS[s.pays] || s.pays}, ${s.date ? `publiée le ${jour(s.date)}` : `page consultée le ${jour(RELEVE_LE)}`})`}
              </React.Fragment>
            ))}
          </p>
        </div>
      ))}
      <p className="c-graphite" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 10 }}>
        Une garantie batterie dépend de la date de première mise en circulation, du kilométrage et de l'entretien :
        seul le livret ou le certificat de garantie du véhicule dit si elle court encore. Ces informations ne changent pas la note.
      </p>
      <p className="eyebrow" style={{ marginTop: 14 }}>Questions au vendeur</p>
      <ul style={{ fontSize: 14, lineHeight: 1.6, margin: '6px 0 0', paddingLeft: 18 }}>
        {questions.map((q, i) => <li key={i}>{q}</li>)}
      </ul>
      <button
        type="button" className="btn-ghost btn-sm btn-auto" style={{ marginTop: 8 }}
        onClick={async () => {
          try { await navigator.clipboard.writeText(questions.join('\n')); setCopie(true); setTimeout(() => setCopie(false), 2000) } catch (_) { /* indisponible */ }
        }}
      >
        {copie ? 'Copié' : 'Copier les questions'}
      </button>
    </div>
  )
}
