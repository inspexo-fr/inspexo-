import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { supabase } from '../lib/supabaseClient'
import { resizeImageToDataUrl } from '../lib/imageUtils'
import { getPublicAnalysis } from '../lib/scoreApi'
import {
  accepterMission, consentirPhotos, constatAbsence, inspecteurMissions, monProfilInspecteur,
  refuserMission, rendreRapport,
} from '../lib/inspectionApi'
import { CONSENTEMENT_PHOTOS, euros, PART_INSPECTEUR_CENTS } from '../data/charte'

// SPRINT 8 — Espace inspecteur : missions reçues, acceptation ou refus,
// inspection guidée sur la voiture (la checklist de l'analyse, point par
// point, avec photos CONSERVÉES pour le rapport), puis remise du rapport.
//
// Les coordonnées du vendeur ne sont renvoyées par le serveur qu'APRÈS
// acceptation : avant, cet écran ne peut pas les afficher, même s'il le
// voulait.

const dateFr = (iso) => iso
  ? new Date(iso).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  : 'à confirmer'

const SIGNAUX = [['ok', 'Rien à signaler'], ['attention', 'À signaler'], ['rouge', 'Grave']]

/* ---------- Inspection guidée d'une mission acceptée ---------- */
function Inspection({ mission, onFini }) {
  const [points, setPoints] = useState(null) // checklist de l'analyse
  const [constats, setConstats] = useState([])
  const [photos, setPhotos] = useState([]) // { image, organe, legende }
  const [consentement, setConsentement] = useState(!!mission.photos_consentement_le)
  const [synthese, setSynthese] = useState('')
  const [decision, setDecision] = useState('')
  const [etat, setEtat] = useState('idle')
  const [message, setMessage] = useState(null)

  useEffect(() => {
    let annule = false
    getPublicAnalysis(mission.analysis_id, false)
      .then(row => {
        if (annule) return
        const liste = (row?.result_json?.checklist_sur_place || []).map(c => c.quoi).filter(Boolean)
        setPoints(liste)
        setConstats(liste.map(q => ({ organe: q, constat: '', signal: 'ok' })))
      })
      .catch(() => { if (!annule) setPoints([]) })
    return () => { annule = true }
  }, [mission.analysis_id])

  const majConstat = (i, champ, valeur) =>
    setConstats(prev => prev.map((c, j) => (j === i ? { ...c, [champ]: valeur } : c)))

  const activerPhotos = async () => {
    try {
      await consentirPhotos(mission.id)
      setConsentement(true)
    } catch (err) { setMessage(err?.message || 'Impossible d\'activer les photos.') }
  }

  const ajouterPhoto = async (fichiers, organe) => {
    const liste = Array.from(fichiers || [])
    for (const f of liste.slice(0, 20 - photos.length)) {
      const image = await resizeImageToDataUrl(f)
      setPhotos(prev => [...prev, { image, organe: organe || 'autre', legende: '' }])
    }
  }

  const envoyer = async (e) => {
    e.preventDefault()
    if (etat === 'envoi') return
    setMessage(null)
    if (synthese.trim().length < 40) { setMessage('Décrivez ce que vous avez constaté (40 caractères minimum).'); return }
    if (!decision) { setMessage('Donnez votre conclusion.'); return }
    setEtat('envoi')
    try {
      const r = await rendreRapport({
        inspection_id: mission.id,
        synthese: synthese.trim(),
        decision,
        constats: constats.filter(c => c.constat.trim()),
        photos,
      })
      // Un versement qui n'est pas parti doit se dire, pas se taire.
      if (r?.versement_erreur) window.alert(r.versement_erreur)
      onFini()
    } catch (err) {
      setEtat('erreur')
      setMessage(err?.message || 'Envoi impossible.')
    }
  }

  return (
    <form onSubmit={envoyer} style={{ marginTop: 14, borderTop: '1px solid var(--rule-strong)', paddingTop: 14 }}>
      <p className="eyebrow">Inspection — points à vérifier</p>
      {points === null && <p className="eyebrow" aria-busy="true" style={{ padding: '14px 0' }}>Chargement…</p>}
      {points?.length === 0 && (
        <p className="c-graphite" style={{ fontSize: 13 }}>
          Aucune checklist dans l'analyse — décrivez librement vos constats ci-dessous.
        </p>
      )}
      {constats.map((c, i) => (
        <div key={i} style={{ borderBottom: '1px solid var(--rule)', padding: '10px 0' }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{c.organe}</p>
          <div className="seg" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', marginBottom: 6 }}>
            {SIGNAUX.map(([val, lbl]) => (
              <label key={val} style={c.signal === val ? { background: 'var(--ink)', color: 'var(--paper)' } : undefined}>
                <input type="radio" name={`signal-${i}`} checked={c.signal === val}
                  onChange={() => majConstat(i, 'signal', val)} aria-label={`${c.organe} : ${lbl}`} />
                <span style={{ fontSize: 12 }}>{lbl}</span>
              </label>
            ))}
          </div>
          <input className="input" placeholder="Ce que vous constatez (facultatif si rien à signaler)"
            value={c.constat} maxLength={400} onChange={e => majConstat(i, 'constat', e.target.value)}
            aria-label={`Constat pour ${c.organe}`} />
        </div>
      ))}

      <p className="eyebrow" style={{ margin: '16px 0 8px' }}>Photos du rapport</p>
      {!consentement ? (
        <div style={{ border: '1px solid var(--rule-strong)', padding: '12px 14px' }}>
          {CONSENTEMENT_PHOTOS.map((t, i) => (
            <p key={i} style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 6 }}>{t}</p>
          ))}
          <button type="button" className="btn-ghost btn-auto" style={{ marginTop: 6 }} onClick={activerPhotos}>
            J'ai prévenu le vendeur — activer les photos
          </button>
        </div>
      ) : (
        <>
          <input type="file" accept="image/*" capture="environment" multiple style={{ fontSize: 13 }}
            onChange={e => { ajouterPhoto(e.target.files); e.target.value = '' }}
            aria-label="Ajouter des photos au rapport" />
          {photos.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 8, marginTop: 10 }}>
              {photos.map((p, i) => (
                <div key={i}>
                  <img src={p.image} alt="" style={{ width: '100%', display: 'block', border: '1px solid var(--rule)' }} />
                  <input className="input" placeholder="Légende" value={p.legende} maxLength={200}
                    style={{ fontSize: 12, marginTop: 4 }}
                    onChange={e => setPhotos(prev => prev.map((x, j) => j === i ? { ...x, legende: e.target.value } : x))}
                    aria-label={`Légende de la photo ${i + 1}`} />
                  <button type="button" className="mono c-graphite"
                    style={{ background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontSize: 11, padding: '4px 0' }}
                    onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}>
                    retirer
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="mono c-graphite" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.6 }}>
            {photos.length}/20 photo(s). Elles seront conservées dans le dossier de l'acheteur.
          </p>
        </>
      )}

      <p className="eyebrow" style={{ margin: '16px 0 8px' }}>Synthèse et conclusion</p>
      <textarea className="textarea" placeholder="Ce que vous avez vu, dans vos mots. Ce que vous n'avez pas pu vérifier, dites-le."
        value={synthese} onChange={e => setSynthese(e.target.value)} maxLength={4000}
        style={{ minHeight: 120 }} aria-label="Synthèse du rapport" />
      <div className="seg" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', marginTop: 10 }}>
        {[['acheter', 'Rien de bloquant'], ['negocier', 'À négocier'], ['ne_pas_acheter', 'Déconseillé']].map(([v, l]) => (
          <label key={v} style={decision === v ? { background: 'var(--ink)', color: 'var(--paper)' } : undefined}>
            <input type="radio" name="decision" checked={decision === v} onChange={() => setDecision(v)} aria-label={l} />
            <span style={{ fontSize: 13 }}>{l}</span>
          </label>
        ))}
      </div>

      <button type="submit" className="btn" style={{ marginTop: 14 }} disabled={etat === 'envoi'}>
        {etat === 'envoi' ? 'Envoi du rapport…' : `Remettre le rapport et déclencher mon versement (${euros(PART_INSPECTEUR_CENTS)})`}
      </button>
      {message && <div className="c-rouge" style={{ fontSize: 13, marginTop: 8 }}>{message}</div>}
    </form>
  )
}

/* ---------- Page ---------- */
export default function InspecteurPage() {
  const [user, setUser] = useState(undefined)
  const [profil, setProfil] = useState(undefined)
  const [missions, setMissions] = useState(null)
  const [ouverte, setOuverte] = useState(null) // mission en cours d'inspection
  const [message, setMessage] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  const charger = useCallback(() => {
    monProfilInspecteur().then(setProfil).catch(() => setProfil(null))
    inspecteurMissions().then(setMissions).catch(() => setMissions([]))
  }, [])
  useEffect(() => { if (user) charger() }, [user, charger])

  const accepter = async (m) => {
    setMessage(null)
    try {
      await accepterMission(m.id, m.creneau_souhaite)
      charger()
    } catch (err) {
      setMessage(err?.message || 'Acceptation impossible.')
      charger()
    }
  }
  const refuser = async (m) => {
    setMessage(null)
    try { await refuserMission(m.id); charger() } catch (err) { setMessage(err?.message || 'Refus impossible.') }
  }

  const aFaire = (missions || []).filter(m => !m.a_moi)
  const miennes = (missions || []).filter(m => m.a_moi)

  return (
    <>
      <Helmet>
        <title>Espace inspecteur — Inspexo</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Navbar />
      <main>
        <section className="sec" style={{ borderTop: 'none', minHeight: '70vh' }}>
          <div className="wrap-doc">
            <p className="eyebrow">Espace inspecteur</p>
            <h1 style={{ fontSize: 'clamp(28px,5vw,38px)', marginTop: 12 }}>Mes missions</h1>

            {user === undefined ? null : !user ? (
              <p className="lead" style={{ marginTop: 18 }}>
                <Link to="/inspecteur/inscription">Connectez-vous à votre espace inspecteur</Link>.
              </p>
            ) : profil === undefined ? (
              <p className="eyebrow" aria-busy="true" style={{ padding: '30px 0' }}>Chargement…</p>
            ) : !profil ? (
              <p className="lead" style={{ marginTop: 18 }}>
                Vous n'avez pas encore de dossier inspecteur.{' '}
                <Link to="/inspecteur/inscription">Déposer ma candidature →</Link>
              </p>
            ) : profil.statut !== 'valide' ? (
              <div style={{ border: '1px solid var(--rule-strong)', padding: '18px 16px', marginTop: 18 }}>
                <p style={{ fontSize: 15, lineHeight: 1.7 }}>
                  Votre compte est au statut « {profil.statut} ». Les missions apparaîtront ici une
                  fois votre dossier validé.{' '}
                  <Link to="/inspecteur/inscription">Compléter mon dossier →</Link>
                </p>
              </div>
            ) : (
              <>
                <p className="lead" style={{ marginTop: 14, marginBottom: 20 }}>
                  {euros(PART_INSPECTEUR_CENTS)} par inspection, versés à la remise du rapport.
                  Départements couverts : {(profil.departements || []).join(', ') || '—'}.
                </p>
                {message && <div className="alert alert-rouge" style={{ marginBottom: 14 }}>{message}</div>}

                {missions === null ? (
                  <p className="eyebrow" aria-busy="true">Chargement…</p>
                ) : (
                  <>
                    {/* À prendre */}
                    <p className="eyebrow" style={{ marginBottom: 10 }}>
                      Missions disponibles ({aFaire.length})
                    </p>
                    {aFaire.length === 0 && (
                      <p className="c-graphite" style={{ fontSize: 14, marginBottom: 20 }}>
                        Aucune mission en attente sur vos départements. Vous recevrez un email
                        dès qu'une inspection est payée près de chez vous.
                      </p>
                    )}
                    {aFaire.map(m => (
                      <article key={m.id} style={{ border: '1px solid var(--rule-strong)', padding: '14px 16px', marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                          <span style={{ fontWeight: 700, fontSize: 16 }}>
                            {[m.marque, m.modele, m.annee].filter(Boolean).join(' ') || 'Véhicule'}
                          </span>
                          <span className="mono num" style={{ fontWeight: 600 }}>{euros(m.part_inspecteur_cents)}</span>
                        </div>
                        <div className="mono c-graphite" style={{ fontSize: 11, marginTop: 4, lineHeight: 1.7 }}>
                          SECTEUR {m.code_postal} · CRÉNEAU {dateFr(m.creneau_souhaite).toUpperCase()}
                          <br />L'ADRESSE S'AFFICHE APRÈS ACCEPTATION
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                          <button type="button" className="btn btn-auto" style={{ width: 'auto' }} onClick={() => accepter(m)}>
                            Accepter
                          </button>
                          <button type="button" className="btn-ghost btn-auto" style={{ width: 'auto' }} onClick={() => refuser(m)}>
                            Refuser
                          </button>
                          <Link to={`/a/${m.analysis_id}`} className="btn-ghost btn-auto" style={{ width: 'auto' }}>
                            Voir l'analyse
                          </Link>
                        </div>
                      </article>
                    ))}

                    {/* Les miennes */}
                    <p className="eyebrow" style={{ margin: '24px 0 10px' }}>Mes missions ({miennes.length})</p>
                    {miennes.length === 0 && (
                      <p className="c-graphite" style={{ fontSize: 14 }}>Aucune mission acceptée pour l'instant.</p>
                    )}
                    {miennes.map(m => (
                      <article key={m.id} style={{ border: '1px solid var(--rule-strong)', padding: '14px 16px', marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                          <span style={{ fontWeight: 700, fontSize: 16 }}>
                            {[m.marque, m.modele, m.annee].filter(Boolean).join(' ') || 'Véhicule'}
                          </span>
                          <span className={`mono ${m.statut === 'faite' ? 'c-vert' : ''}`} style={{ fontSize: 12, fontWeight: 600 }}>
                            {m.statut === 'faite' ? 'RAPPORT REMIS' : 'À INSPECTER'}
                          </span>
                        </div>
                        <div style={{ fontSize: 14, marginTop: 8, lineHeight: 1.7 }}>
                          <strong>Rendez-vous :</strong> {dateFr(m.creneau_confirme || m.creneau_souhaite)}<br />
                          <strong>Adresse :</strong> {m.vendeur_adresse || '—'}<br />
                          <strong>Vendeur :</strong> {[m.vendeur_nom, m.vendeur_telephone].filter(Boolean).join(' · ') || '—'}
                        </div>
                        {m.statut !== 'faite' && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                            <button type="button" className="btn btn-auto" style={{ width: 'auto' }}
                              onClick={() => setOuverte(ouverte?.id === m.id ? null : m)}>
                              {ouverte?.id === m.id ? 'Fermer' : 'Commencer l\'inspection'}
                            </button>
                            <button type="button" className="btn-ghost btn-auto" style={{ width: 'auto' }} onClick={() => refuser(m)}>
                              Me désister
                            </button>
                            {/* Véhicule non présenté. Une photo horodatée prise SUR PLACE est
                                exigée : l'indemnité de 40 € est prélevée sur l'acheteur, elle ne
                                peut pas reposer sur la seule parole de celui qui la touche. */}
                            <label className="btn-ghost btn-auto" style={{ width: 'auto', cursor: 'pointer' }}>
                              Véhicule non présenté
                              <input
                                type="file" accept="image/*" capture="environment"
                                style={{ display: 'none' }}
                                onChange={async (e) => {
                                  const f = e.target.files?.[0]
                                  e.target.value = ''
                                  if (!f) return
                                  if (!window.confirm(
                                    "Confirmez-vous que le véhicule ne vous a pas été présenté ?\n\n"
                                    + "40 € vous seront versés pour le déplacement, le reste sera remboursé "
                                    + "à l'acheteur. Votre photo sert de preuve et peut être réexaminée.",
                                  )) return
                                  setMessage(null)
                                  try {
                                    const image = await resizeImageToDataUrl(f)
                                    const r = await constatAbsence(m.id, image)
                                    setMessage(r?.versee === false
                                      ? "Constat enregistré. Le versement de l'indemnité est en cours de régularisation."
                                      : 'Constat enregistré : votre indemnité de déplacement part sous peu.')
                                    charger()
                                  } catch (err) {
                                    setMessage(err?.message || 'Constat impossible. Réessayez.')
                                  }
                                }}
                              />
                            </label>
                          </div>
                        )}
                        {ouverte?.id === m.id && m.statut !== 'faite' && (
                          <Inspection mission={m} onFini={() => { setOuverte(null); charger() }} />
                        )}
                      </article>
                    ))}
                  </>
                )}

                <p className="mono c-graphite" style={{ marginTop: 22, fontSize: 11, lineHeight: 1.7 }}>
                  CONNECTÉ : {user.email} —{' '}
                  <button type="button" onClick={() => supabase.auth.signOut()}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', font: 'inherit', color: 'inherit' }}>
                    se déconnecter
                  </button>
                </p>
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
