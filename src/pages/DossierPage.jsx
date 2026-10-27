import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { supabase } from '../lib/supabaseClient'
import {
  dossierList, dossierSetStatut, dossierSetAlertes, dossierRemove,
  submitOutcome, envoyerLienMagique,
} from '../lib/scoreApi'

const FONT = 'Plus Jakarta Sans, sans-serif'
const FONT_TITRE = 'Syne, sans-serif'

const VERDICT_STYLE = {
  vert:   { color: '#16A34A', bg: '#F0FDF4', label: 'Feu vert' },
  orange: { color: '#D97706', bg: '#FFFBEB', label: 'Prudence' },
  rouge:  { color: '#DC2626', bg: '#FEF2F2', label: 'Signaux rouges' },
}

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
      <div style={{ fontFamily: FONT, fontSize: '0.875rem', color: '#16A34A', fontWeight: 600, marginTop: 10 }}>
        Merci — votre retour alimente la mesure publique de justesse (/fiabilite).
      </div>
    )
  }
  return (
    <form onSubmit={envoyer} style={{
      marginTop: 12, background: '#FFF7F2', border: '1.5px solid rgba(255,77,0,0.25)',
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ fontFamily: FONT, fontSize: '0.875rem', fontWeight: 700, color: '#0F1B2D', marginBottom: 10 }}>
        Un mois après l'achat : qu'en est-il réellement ?
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          type="number" min="1" max="999999" placeholder="Prix réellement payé (€, facultatif)"
          value={prix} onChange={e => setPrix(e.target.value)}
          style={{ border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '10px 12px', fontFamily: FONT, fontSize: '0.875rem', outline: 'none' }}
        />
        <textarea
          placeholder="Pannes ou défauts confirmés depuis l'achat ? (ou « aucun »)"
          value={pannes} onChange={e => setPannes(e.target.value)} maxLength={1000}
          style={{ border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '10px 12px', fontFamily: FONT, fontSize: '0.875rem', minHeight: 60, resize: 'vertical', outline: 'none' }}
        />
        <textarea
          placeholder="L'analyse vous a-t-elle aidé ? (facultatif)"
          value={commentaire} onChange={e => setCommentaire(e.target.value)} maxLength={1000}
          style={{ border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '10px 12px', fontFamily: FONT, fontSize: '0.875rem', minHeight: 48, resize: 'vertical', outline: 'none' }}
        />
      </div>
      <button type="submit" disabled={etat === 'sending'} style={{
        marginTop: 10, background: '#0F1B2D', color: '#fff', border: 'none', borderRadius: 8,
        padding: '10px 18px', fontFamily: FONT, fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
        opacity: etat === 'sending' ? 0.6 : 1,
      }}>
        {etat === 'sending' ? 'Envoi…' : 'Envoyer mon retour'}
      </button>
      {etat === 'erreur' && (
        <div style={{ fontFamily: FONT, fontSize: '0.8125rem', color: '#B91C1C', marginTop: 6 }}>
          Enregistrement impossible — réessayez.
        </div>
      )}
    </form>
  )
}

export default function DossierPage() {
  const [user, setUser] = useState(undefined) // undefined = chargement
  const [items, setItems] = useState(null)
  const [email, setEmail] = useState('')
  const [lienEtat, setLienEtat] = useState('idle')
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

  const envoyerLien = async (e) => {
    e.preventDefault()
    if (!email || lienEtat === 'sending') return
    setLienEtat('sending')
    try {
      await envoyerLienMagique(email, '/dossier')
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
      <main style={{ background: '#F8F9FA', minHeight: '100vh' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '100px 16px 64px' }}>
          <div style={{ fontFamily: FONT, fontSize: '0.8125rem', fontWeight: 600, color: '#FF4D00', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
            Dossier d'achat
          </div>
          <h1 style={{ fontFamily: FONT_TITRE, fontWeight: 800, fontSize: 'clamp(1.5rem, 5vw, 2rem)', color: '#0F1B2D', marginBottom: 8 }}>
            Vos analyses, suivies jusqu'à la signature
          </h1>
          <p style={{ fontFamily: FONT, fontSize: '0.9375rem', fontWeight: 300, color: '#6B7280', lineHeight: 1.65, marginBottom: 26 }}>
            Statut de chaque piste (à voir, visité, acheté, abandonné), alerte email si un rappel
            est publié sur un modèle suivi ou si une annonce revient à un autre prix.
          </p>

          {user === undefined ? null : !user ? (
            /* ---------- Connexion par lien magique ---------- */
            <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid rgba(0,0,0,0.07)', padding: '24px 20px' }}>
              {lienEtat === 'done' ? (
                <div style={{ fontFamily: FONT, fontSize: '0.9375rem', color: '#16A34A', fontWeight: 600, lineHeight: 1.6 }}>
                  Lien de connexion envoyé — ouvrez l'email sur cet appareil pour accéder à votre dossier.
                </div>
              ) : (
                <form onSubmit={envoyerLien}>
                  <div style={{ fontFamily: FONT, fontSize: '0.9375rem', fontWeight: 700, color: '#0F1B2D', marginBottom: 10 }}>
                    Connectez-vous par lien magique
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      type="email" required placeholder="votre@email.com" value={email}
                      onChange={e => setEmail(e.target.value)}
                      style={{
                        flex: '1 1 200px', boxSizing: 'border-box', border: '1.5px solid rgba(0,0,0,0.12)',
                        borderRadius: 10, padding: '12px 14px', fontSize: 16, fontFamily: FONT, outline: 'none',
                      }}
                    />
                    <button type="submit" disabled={lienEtat === 'sending'} style={{
                      background: '#FF4D00', color: '#fff', border: 'none', borderRadius: 10,
                      padding: '12px 20px', fontFamily: FONT, fontSize: '0.9375rem', fontWeight: 700,
                      cursor: 'pointer', opacity: lienEtat === 'sending' ? 0.6 : 1,
                    }}>
                      {lienEtat === 'sending' ? 'Envoi…' : 'Recevoir le lien'}
                    </button>
                  </div>
                  <div style={{ marginTop: 8, fontFamily: FONT, fontSize: '0.6875rem', color: '#9CA3AF', lineHeight: 1.5 }}>
                    {CONSENT}
                  </div>
                  {lienEtat === 'erreur' && (
                    <div style={{ fontFamily: FONT, fontSize: '0.8125rem', color: '#B91C1C', marginTop: 6 }}>
                      Envoi impossible (adresse invalide ou limite atteinte) — réessayez.
                    </div>
                  )}
                </form>
              )}
            </div>
          ) : (
            /* ---------- Dossier ---------- */
            <>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 14, fontFamily: FONT, fontSize: '0.8125rem', color: '#6B7280',
              }}>
                <span>Connecté : {user.email}</span>
                <button
                  onClick={() => supabase.auth.signOut()}
                  style={{ background: 'none', border: 'none', color: '#1E4D8C', cursor: 'pointer', fontFamily: FONT, fontSize: '0.8125rem', fontWeight: 600 }}
                >
                  Se déconnecter
                </button>
              </div>

              {erreur && <div style={{ fontFamily: FONT, color: '#B91C1C', marginBottom: 12 }}>{erreur}</div>}

              {items === null ? (
                <div style={{ fontFamily: FONT, color: '#9CA3AF', padding: '30px 0' }}>Chargement…</div>
              ) : items.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid rgba(0,0,0,0.07)', padding: '28px 20px', textAlign: 'center' }}>
                  <div style={{ fontFamily: FONT, fontSize: '0.9375rem', color: '#374151', marginBottom: 16 }}>
                    Aucune analyse suivie pour l'instant. Depuis une page de résultat, touchez
                    « Suivre dans mon dossier ».
                  </div>
                  <Link to="/score" style={{
                    display: 'inline-block', background: '#FF4D00', color: '#fff', borderRadius: 10,
                    padding: '12px 22px', textDecoration: 'none', fontFamily: FONT, fontWeight: 700, fontSize: '0.9375rem',
                  }}>
                    Analyser une annonce
                  </Link>
                </div>
              ) : (
                items.map((item) => {
                  const v = VERDICT_STYLE[item.verdict] || VERDICT_STYLE.orange
                  const label = [item.marque, item.modele].filter(Boolean).join(' ') || 'Véhicule'
                  return (
                    <div key={item.analysis_id} style={{
                      background: '#fff', borderRadius: 16, border: '1.5px solid rgba(0,0,0,0.07)',
                      padding: '18px 18px', marginBottom: 12,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <div>
                          <Link to={`/a/${item.analysis_id}`} style={{
                            fontFamily: FONT, fontSize: '1rem', fontWeight: 700, color: '#0F1B2D', textDecoration: 'none',
                          }}>
                            {label}{item.annee ? ` · ${item.annee}` : ''}
                          </Link>
                          <div style={{ fontFamily: FONT, fontSize: '0.75rem', color: '#9CA3AF', marginTop: 2 }}>
                            Analysée le {new Date(item.analyse_le).toLocaleDateString('fr-FR')}
                            {item.prix_affiche ? ` · ${Number(item.prix_affiche).toLocaleString('fr-FR')} €` : ''}
                          </div>
                        </div>
                        <span style={{
                          fontFamily: FONT, fontSize: '0.75rem', fontWeight: 700,
                          color: v.color, background: v.bg, borderRadius: 100, padding: '4px 12px',
                        }}>
                          {v.label} · {item.score}/100
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
                        {STATUTS.map(([val, lbl]) => (
                          <button
                            key={val}
                            onClick={() => changerStatut(item.analysis_id, val)}
                            style={{
                              fontFamily: FONT, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                              borderRadius: 100, padding: '6px 12px',
                              border: item.statut === val ? '1.5px solid #FF4D00' : '1.5px solid rgba(0,0,0,0.12)',
                              background: item.statut === val ? '#FFF0EA' : '#fff',
                              color: item.statut === val ? '#C2410C' : '#6B7280',
                            }}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>

                      <div style={{
                        display: 'flex', gap: 14, marginTop: 10, alignItems: 'center', flexWrap: 'wrap',
                        fontFamily: FONT, fontSize: '0.75rem', color: '#6B7280',
                      }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!item.alertes} onChange={() => basculerAlertes(item)} />
                          Alertes email (rappels, changement de prix)
                        </label>
                        <button
                          onClick={() => retirer(item.analysis_id)}
                          style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontFamily: FONT, fontSize: '0.75rem', textDecoration: 'underline' }}
                        >
                          Retirer du dossier
                        </button>
                      </div>

                      {item.statut === 'achete' && !item.retour_fait && (
                        <FormulaireRetour item={item} onDone={charger} />
                      )}
                    </div>
                  )
                })
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
