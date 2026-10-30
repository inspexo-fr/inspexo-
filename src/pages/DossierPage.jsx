import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Turnstile from '../components/Turnstile'
import { supabase } from '../lib/supabaseClient'
import {
  dossierList, dossierSetStatut, dossierSetAlertes, dossierRemove,
  submitOutcome, envoyerLienMagique, getMonPass,
} from '../lib/scoreApi'

const VERDICT_LABELS = { vert: 'FEU VERT', orange: 'PRUDENCE', rouge: 'SIGNAUX ROUGES' }
const VERDICT_CLASSES = { vert: 'ok', orange: 'mid', rouge: 'bad' }

const STATUTS = [
  ['a_voir', 'À voir'],
  ['visite', 'Visité'],
  ['achete', 'Acheté'],
  ['abandonne', 'Abandonné'],
]

const CONSENT =
  'Connexion par lien magique, sans mot de passe. En laissant votre email, vous acceptez de recevoir les alertes de votre dossier (désactivables à tout moment). Lien de désinscription dans chaque email.'

function FormulaireRetour({ item, onDone }) {
  const [prix, setPrix] = useState('')
  const [pannes, setPannes] = useState('')
  const [commentaire, setCommentaire] = useState('')
  const [etat, setEtat] = useState('idle')

  const envoyer = async (e) => {
    e.preventDefault()
    if (etat === 'sending') return
    setEtat('sending')
    try {
      await submitOutcome(item.analysis_id, {
        prixPaye: prix ? Math.round(Number(prix)) : null,
        pannesConfirmees: pannes || null,
        commentaire: commentaire || null,
      })
      setEtat('done')
      onDone()
    } catch (_) {
      setEtat('erreur')
    }
  }

  if (etat === 'done') {
    return (
      <div className="c-vert" style={{ fontSize: 14, fontWeight: 600, marginTop: 10 }}>
        Merci — votre retour alimente la mesure publique de justesse (/fiabilite).
      </div>
    )
  }
  return (
    <form onSubmit={envoyer} style={{ marginTop: 14, borderTop: '1px solid var(--rule-strong)', paddingTop: 12 }}>
      <p className="eyebrow" style={{ marginBottom: 10 }}>Un mois après l'achat : qu'en est-il réellement ?</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          type="number" min="1" max="999999" placeholder="Prix réellement payé (€, facultatif)"
          value={prix} onChange={e => setPrix(e.target.value)}
          className="input" aria-label="Prix réellement payé"
        />
        <textarea
          placeholder="Pannes ou défauts confirmés depuis l'achat ? (ou « aucun »)"
          value={pannes} onChange={e => setPannes(e.target.value)} maxLength={1000}
          className="textarea" style={{ minHeight: 60, marginTop: 0 }}
        />
        <textarea
          placeholder="L'analyse vous a-t-elle aidé ? (facultatif)"
          value={commentaire} onChange={e => setCommentaire(e.target.value)} maxLength={1000}
          className="textarea" style={{ minHeight: 48, marginTop: 0 }}
        />
      </div>
      <button type="submit" className="btn-ghost btn-sm btn-auto" style={{ marginTop: 10 }} disabled={etat === 'sending'}>
        {etat === 'sending' ? 'Envoi…' : 'Envoyer mon retour'}
      </button>
      {etat === 'erreur' && (
        <div className="c-rouge" style={{ fontSize: 13, marginTop: 6 }}>
          Enregistrement impossible — réessayez.
        </div>
      )}
    </form>
  )
}

export default function DossierPage() {
  const [user, setUser] = useState(undefined) // undefined = chargement
  const [items, setItems] = useState(null)
  const [pass, setPass] = useState(null) // Pass achat actif { mode, debut, fin } ou null
  const [email, setEmail] = useState('')
  const [lienEtat, setLienEtat] = useState('idle')
  const [captcha, setCaptcha] = useState(null)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const charger = useCallback(() => {
    dossierList().then(setItems).catch(() => setErreur('Impossible de charger votre dossier.'))
  }, [])

  useEffect(() => { if (user) charger() }, [user, charger])

  // Pass achat : l'appel rattache aussi un Pass acheté avec cet email avant
  // la première connexion (l'email Stripe crée ou précède le compte).
  useEffect(() => {
    if (user) getMonPass().then(setPass).catch(() => setPass(null))
    else setPass(null)
  }, [user])

  const envoyerLien = async (e) => {
    e.preventDefault()
    if (!email || lienEtat === 'sending') return
    setLienEtat('sending')
    try {
      await envoyerLienMagique(email, '/dossier', captcha)
      setLienEtat('done')
    } catch (_) {
      setLienEtat('erreur')
    }
  }

  const changerStatut = async (analysisId, statut) => {
    setItems(prev => prev.map(i => i.analysis_id === analysisId ? { ...i, statut } : i))
    try { await dossierSetStatut(analysisId, statut) } catch (_) { charger() }
  }
  const basculerAlertes = async (item) => {
    setItems(prev => prev.map(i => i.analysis_id === item.analysis_id ? { ...i, alertes: !i.alertes } : i))
    try { await dossierSetAlertes(item.analysis_id, !item.alertes) } catch (_) { charger() }
  }
  const retirer = async (analysisId) => {
    setItems(prev => prev.filter(i => i.analysis_id !== analysisId))
    try { await dossierRemove(analysisId) } catch (_) { charger() }
  }

  return (
    <>
      <Helmet>
        <title>Mon dossier d'achat — Inspexo</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Navbar />
      <main>
        <section className="sec" style={{ borderTop: 'none', minHeight: '70vh' }}>
          <div className="wrap-doc">
            <p className="eyebrow">Dossier d'achat</p>
            <h1 style={{ fontSize: 'clamp(28px,5vw,38px)', marginTop: 12 }}>
              Vos analyses, suivies jusqu'à la signature
            </h1>
            <p className="lead" style={{ marginTop: 14, marginBottom: 26 }}>
              Statut de chaque piste (à voir, visité, acheté, abandonné), alerte email si un rappel
              est publié sur un modèle suivi ou si une annonce revient à un autre prix.
            </p>

            {user === undefined ? null : !user ? (
              /* ---------- Connexion par lien magique ---------- */
              <div style={{ border: '1px solid var(--rule-strong)', padding: '22px 18px' }}>
                {lienEtat === 'done' ? (
                  <div className="c-vert" style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.6 }}>
                    Lien de connexion envoyé — ouvrez l'email sur cet appareil pour accéder à votre dossier.
                  </div>
                ) : (
                  <form onSubmit={envoyerLien}>
                    <p className="eyebrow" style={{ marginBottom: 10 }}>Connectez-vous par lien magique</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        type="email" required placeholder="votre@email.com" value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="input" style={{ flex: '1 1 200px', width: 'auto' }}
                        aria-label="Votre email"
                      />
                      <button type="submit" className="btn btn-auto" style={{ height: 48, width: 'auto' }} disabled={lienEtat === 'sending'}>
                        {lienEtat === 'sending' ? 'Envoi…' : 'Recevoir le lien'}
                      </button>
                    </div>
                    <Turnstile onToken={setCaptcha} action="lien-magique" />
                    <p className="mono c-graphite" style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
                      {CONSENT}
                    </p>
                    {lienEtat === 'erreur' && (
                      <div className="c-rouge" style={{ fontSize: 13, marginTop: 6 }}>
                        Envoi impossible (adresse invalide ou limite atteinte) — réessayez.
                      </div>
                    )}
                  </form>
                )}
              </div>
            ) : (
              /* ---------- Dossier ---------- */
              <>
                <div className="mono c-graphite" style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  gap: 10, marginBottom: 14, fontSize: 11, letterSpacing: '.04em',
                  borderBottom: '1px solid var(--rule-strong)', paddingBottom: 10,
                }}>
                  <span>CONNECTÉ : {user.email}</span>
                  <button
                    type="button"
                    onClick={() => supabase.auth.signOut()}
                    className="mono"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, letterSpacing: '.04em', textDecoration: 'underline', minHeight: 44, color: 'var(--ink)' }}
                  >
                    SE DÉCONNECTER
                  </button>
                </div>

                {pass && (
                  <div className="mono" style={{
                    border: '1px solid var(--rule-strong)', padding: '10px 14px', marginBottom: 14,
                    fontSize: 11, letterSpacing: '.04em', display: 'flex', justifyContent: 'space-between',
                    gap: 10, flexWrap: 'wrap',
                  }}>
                    <span className="c-vert" style={{ fontWeight: 700 }}>
                      PASS ACHAT ACTIF{pass.mode === 'precommande' ? ' (PRÉCOMMANDE)' : ''}
                    </span>
                    <span className="c-graphite">
                      jusqu'au {new Date(pass.fin).toLocaleDateString('fr-FR')} · analyses illimitées,
                      visite complète, négociation détaillée, PV de CT, kit signature
                    </span>
                  </div>
                )}

                {erreur && <div className="alert alert-rouge">{erreur}</div>}

                {items === null ? (
                  <p className="eyebrow" aria-busy="true" style={{ padding: '30px 0' }}>Chargement…</p>
                ) : items.length === 0 ? (
                  <div style={{ border: '1px solid var(--rule-strong)', padding: '26px 20px', textAlign: 'center' }}>
                    <p style={{ fontSize: 15, marginBottom: 16 }} className="c-ink2">
                      Aucune analyse suivie pour l'instant. Depuis une page de résultat, touchez
                      « Suivre dans mon dossier ».
                    </p>
                    <Link to="/score" className="btn" style={{ width: 'auto', display: 'inline-flex' }}>
                      Analyser une annonce
                    </Link>
                  </div>
                ) : (
                  items.map((item) => {
                    const label = [item.marque, item.modele].filter(Boolean).join(' ') || 'Véhicule'
                    return (
                      <article key={item.analysis_id} style={{ border: '1px solid var(--rule-strong)', padding: '16px 18px', marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                          <div>
                            <Link to={`/a/${item.analysis_id}`} style={{ fontSize: 17, fontWeight: 700, textDecoration: 'none' }}>
                              {label}{item.annee ? ` · ${item.annee}` : ''}
                            </Link>
                            <div className="mono c-graphite" style={{ fontSize: 11, marginTop: 4 }}>
                              Analysée le {new Date(item.analyse_le).toLocaleDateString('fr-FR')}
                              {item.prix_affiche ? ` · ${Number(item.prix_affiche).toLocaleString('fr-FR')} €` : ''}
                            </div>
                          </div>
                          <span className={`mono ${VERDICT_CLASSES[item.verdict] || 'mid'}`} style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.04em' }}>
                            {VERDICT_LABELS[item.verdict] || item.verdict} · {item.score}/100
                          </span>
                        </div>

                        <div className="seg" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))', marginTop: 14 }}>
                          {STATUTS.map(([val, lbl]) => (
                            <label key={val} style={item.statut === val ? { background: 'var(--ink)', color: 'var(--paper)' } : undefined}>
                              <input
                                type="radio"
                                name={`statut-${item.analysis_id}`}
                                checked={item.statut === val}
                                onChange={() => changerStatut(item.analysis_id, val)}
                                aria-label={lbl}
                              />
                              <span style={{ fontSize: 13, fontWeight: item.statut === val ? 700 : 400 }}>{lbl}</span>
                            </label>
                          ))}
                        </div>

                        <div style={{
                          display: 'flex', gap: 14, marginTop: 12, alignItems: 'center', flexWrap: 'wrap',
                          fontSize: 13,
                        }} className="c-ink2">
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minHeight: 44 }}>
                            <input type="checkbox" checked={!!item.alertes} onChange={() => basculerAlertes(item)} />
                            Alertes email (rappels, changement de prix)
                          </label>
                          <button
                            type="button"
                            onClick={() => retirer(item.analysis_id)}
                            className="c-graphite"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, textDecoration: 'underline', minHeight: 44, fontFamily: 'var(--sans)' }}
                          >
                            Retirer du dossier
                          </button>
                        </div>

                        {item.statut === 'achete' && !item.retour_fait && (
                          <FormulaireRetour item={item} onDone={charger} />
                        )}
                      </article>
                    )
                  })
                )}
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
