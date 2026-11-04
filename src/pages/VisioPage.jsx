import React, { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { accesVisio, autoriserCaptures } from '../lib/inspectionApi'

// SPRINT 14 — L'appel vidéo. Une seule page pour les deux rôles : le serveur
// dit qui demande et renvoie le lien correspondant. L'acheteur ne reçoit
// jamais l'URL hôte, et l'inspecteur jamais celle du participant.
//
// Acheteur : téléphone, caméra arrière, une seule chose à l'écran à la fois.
// Inspecteur : ordinateur, la vidéo et la checklist côte à côte.
//
// ⚠️ Aucun enregistrement. Rien dans cette page ne capture le flux ; la
// fonction n'est pas activée chez le prestataire, et les CGV l'affirment.

export default function VisioPage() {
  const { id } = useParams()
  const [etat, setEtat] = useState('chargement') // chargement | ouvert | ferme | erreur
  const [acces, setAcces] = useState(null)
  const [message, setMessage] = useState(null)
  const [point, setPoint] = useState(0)
  const [coches, setCoches] = useState({})
  const [notes, setNotes] = useState({})
  const [captures, setCaptures] = useState(false)

  const charger = useCallback(async () => {
    try {
      const r = await accesVisio(id)
      setAcces(r)
      setCaptures(r.captures_autorisees === true)
      setEtat('ouvert')
    } catch (e) {
      setMessage(e?.message || 'Appel indisponible.')
      setEtat(e?.code === 'hors_fenetre' || /fenêtre|confirmé/i.test(e?.message || '') ? 'ferme' : 'erreur')
    }
  }, [id])

  useEffect(() => { charger() }, [charger])

  // Hors fenêtre : on repropose dans une minute plutôt que de laisser
  // l'acheteur recharger à la main devant la voiture.
  useEffect(() => {
    if (etat !== 'ferme') return undefined
    const t = setInterval(charger, 60_000)
    return () => clearInterval(t)
  }, [etat, charger])

  const inspecteur = acces?.role === 'inspecteur'
  const liste = acces?.checklist ?? []
  const courant = liste[point] ?? null
  const nonVerifiables = acces?.non_verifiables ?? []

  if (etat === 'chargement') {
    return <div className="wrap-doc" style={{ padding: 24 }}><p className="eyebrow" aria-busy="true">Ouverture de l'appel…</p></div>
  }

  if (etat !== 'ouvert') {
    return (
      <div className="wrap-doc" style={{ padding: 24, maxWidth: 560 }}>
        <Helmet><title>Visio guidée — Inspexo</title><meta name="robots" content="noindex" /></Helmet>
        <h1 className="h-doc">Appel vidéo</h1>
        <p style={{ fontSize: 15, lineHeight: 1.7, marginTop: 10 }}>{message}</p>
        {etat === 'ferme' && (
          <p className="mono c-graphite" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.6 }}>
            Cette page se rouvrira d'elle-même le moment venu. Vous pouvez la laisser ouverte.
          </p>
        )}
        <p style={{ marginTop: 16 }}><Link to={`/a/${acces?.analysis_id ?? ''}`}>← Retour au dossier</Link></p>
      </div>
    )
  }

  return (
    <>
      <Helmet><title>Visio guidée — Inspexo</title><meta name="robots" content="noindex" /></Helmet>
      <div style={{
        display: inspecteur ? 'grid' : 'block',
        gridTemplateColumns: inspecteur ? 'minmax(0,1fr) 380px' : undefined,
        height: '100dvh', background: 'var(--papier)',
      }}>
        {/* ---- La vidéo ---- */}
        {/* ⚠️ HAUTEUR DÉFINIE, pas minHeight : un iframe en height:100% dans un
            parent à hauteur automatique ne remplit rien, et laissait une bande
            noire sous la vidéo (vu à la première capture 390 px). */}
        <div style={{ position: 'relative', height: inspecteur ? '100dvh' : '58dvh', background: '#000' }}>
          <iframe
            title="Appel vidéo"
            src={acces.url}
            allow="camera; microphone; fullscreen; speaker; display-capture"
            style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
          />
        </div>

        {/* ---- La checklist ---- */}
        <div style={{
          padding: '14px 16px', overflowY: 'auto',
          height: inspecteur ? '100dvh' : '42dvh',
          borderLeft: inspecteur ? '1px solid var(--filet)' : 'none',
          borderTop: inspecteur ? 'none' : '1px solid var(--filet)',
        }}>
          <div className="mono c-graphite" style={{ fontSize: 11, letterSpacing: '.06em' }}>
            {inspecteur ? 'CHECKLIST DE CE VÉHICULE' : 'POINT EN COURS'}
            {liste.length > 0 && ` · ${point + 1}/${liste.length}`}
          </div>

          {courant ? (
            <>
              <h2 style={{ fontSize: inspecteur ? 17 : 20, fontWeight: 700, marginTop: 8, lineHeight: 1.35 }}>
                {courant.quoi}
              </h2>
              {courant.comment && (
                <p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 6 }}>{courant.comment}</p>
              )}
              {courant.signal_rouge && (
                <p className="c-rouge" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 6 }}>
                  Signal rouge : {courant.signal_rouge}
                </p>
              )}
            </>
          ) : (
            <p style={{ fontSize: 14, marginTop: 8 }}>Aucune checklist pour ce véhicule.</p>
          )}

          {/* L'inspecteur coche et annote ; l'acheteur suit. */}
          {inspecteur && courant && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['ok', 'attention', 'rouge', 'non_verifiable'].map(v => (
                  <button
                    key={v} type="button"
                    className={coches[point] === v ? 'btn btn-auto btn-sm' : 'btn-ghost btn-auto btn-sm'}
                    style={{ width: 'auto' }}
                    onClick={() => setCoches(c => ({ ...c, [point]: v }))}
                  >
                    {{ ok: 'Conforme', attention: 'À surveiller', rouge: 'Signal rouge', non_verifiable: 'Pas vérifiable' }[v]}
                  </button>
                ))}
              </div>
              <textarea
                className="input" rows={2} placeholder="Note (facultative)"
                value={notes[point] ?? ''}
                onChange={e => setNotes(n => ({ ...n, [point]: e.target.value.slice(0, 400) }))}
                style={{ marginTop: 8, width: '100%' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn-ghost btn-auto btn-sm" style={{ width: 'auto' }}
              disabled={point === 0} onClick={() => setPoint(p => Math.max(0, p - 1))}>
              Précédent
            </button>
            <button type="button" className="btn btn-auto btn-sm" style={{ width: 'auto' }}
              disabled={point >= liste.length - 1} onClick={() => setPoint(p => p + 1)}>
              Point suivant
            </button>
          </div>

          {/* Captures : l'ACHETEUR décide, et il peut le faire pendant l'appel. */}
          {!inspecteur && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 16, fontSize: 13, lineHeight: 1.5, cursor: 'pointer' }}>
              <input
                type="checkbox" checked={captures} disabled={captures}
                style={{ marginTop: 2, width: 16, height: 16 }}
                onChange={async () => {
                  try { await autoriserCaptures(id); setCaptures(true) } catch (_) { /* rien */ }
                }}
              />
              <span>
                J'autorise l'inspecteur à figer des images de mon écran (compteur, carnet, défaut).
                Aucune personne reconnaissable, conservation 2 ans.
              </span>
            </label>
          )}
          {inspecteur && (
            <p className="mono c-graphite" style={{ fontSize: 11, marginTop: 14, lineHeight: 1.6 }}>
              CAPTURES : {captures ? 'AUTORISÉES PAR L’ACHETEUR' : 'NON AUTORISÉES — NE RIEN FIGER'}
            </p>
          )}

          {inspecteur && nonVerifiables.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--filet)' }}>
              <div className="mono c-graphite" style={{ fontSize: 11, letterSpacing: '.06em' }}>
                HORS DE PORTÉE EN VISIO ({nonVerifiables.length})
              </div>
              {nonVerifiables.map((p, i) => (
                <p key={i} style={{ fontSize: 12, lineHeight: 1.6, marginTop: 6 }}>
                  <strong>{p.quoi}</strong> — {p.raison}
                </p>
              ))}
              <p className="mono c-graphite" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.6 }}>
                Ces points seront listés tels quels dans le compte rendu.
              </p>
            </div>
          )}

          <p className="mono c-graphite" style={{ fontSize: 11, marginTop: 16, lineHeight: 1.6 }}>
            L’APPEL N’EST PAS ENREGISTRÉ.
          </p>
        </div>
      </div>
    </>
  )
}
