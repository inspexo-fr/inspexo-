import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { getPublicAnalysis, visitePhoto, visiteTerminer } from '../lib/scoreApi'
import { IconeAppareilPhoto } from '../components/Icones'
import { resizeImageToDataUrl } from '../lib/imageUtils'

const FONT = 'Plus Jakarta Sans, sans-serif'
const FONT_TITRE = 'Syne, sans-serif'

const VERDICT_STYLE = {
  vert:   { color: '#16A34A', label: 'Feu vert' },
  orange: { color: '#D97706', label: 'Prudence' },
  rouge:  { color: '#DC2626', label: 'Signaux rouges' },
}

const DECISION_STYLE = {
  acheter:        { label: 'Acheter', color: '#16A34A', bg: '#F0FDF4' },
  negocier:       { label: 'Négocier', color: '#D97706', bg: '#FFFBEB' },
  ne_pas_acheter: { label: 'Ne pas acheter', color: '#DC2626', bg: '#FEF2F2' },
}

// Les points où une photo est particulièrement utile (analyse vision).
const PHOTO_SUGGEREE_RE = /compteur|pneu|contr[ôo]le technique|\bct\b|carnet|document|carrosserie|peinture/i

/** Points ajoutés en tête si la checklist de l'analyse ne les couvre pas :
 *  ce sont les photos que l'appel vision sait exploiter (compteur, PV de CT). */
function etapesPhoto(checklist) {
  const texte = JSON.stringify(checklist).toLowerCase()
  const etapes = []
  if (!/compteur/.test(texte)) {
    etapes.push({
      quoi: 'Compteur kilométrique',
      comment: 'Contact mis, photographiez le compteur : le kilométrage lu est comparé automatiquement à celui de l\'annonce.',
      signal_rouge: 'Kilométrage différent de celui annoncé.',
      photo: true,
    })
  }
  if (!/contrôle technique|controle technique|proces-verbal|procès-verbal/.test(texte)) {
    etapes.push({
      quoi: 'PV de contrôle technique et carnet d\'entretien',
      comment: 'Demandez les documents et photographiez le procès-verbal du CT : les défaillances listées sont lues automatiquement.',
      signal_rouge: 'Documents refusés, CT absent (véhicule de plus de 4 ans), défaillances majeures listées.',
      photo: true,
    })
  }
  return etapes
}

export default function VisitePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [analysis, setAnalysis] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [idx, setIdx] = useState(-1) // -1 = intro, items.length = écran final
  const [reponses, setReponses] = useState({}) // idx -> 'oui'|'non'|'doute'
  const [photoEtat, setPhotoEtat] = useState('idle') // idle | analyse | erreur
  const [constatsItem, setConstatsItem] = useState({}) // idx -> [constats]
  const [constatsVisite, setConstatsVisite] = useState([]) // session cumulée (mode éphémère)
  const [verdictLive, setVerdictLive] = useState(null) // {verdict, score} après recalcul
  const [persiste, setPersiste] = useState(null) // true si l'analyse est suivie dans le dossier
  const [synthese, setSynthese] = useState(null)
  const [finEnCours, setFinEnCours] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
    let cancelled = false
    getPublicAnalysis(id)
      .then(row => {
        if (cancelled) return
        if (!row || row.result_json?.type !== 'vehicule') { setErreur('Analyse introuvable.'); return }
        if (row.result_json?.statut_analyse === 'en_cours') {
          setErreur('L\'analyse est encore en cours — attendez le verdict final avant la visite.')
          return
        }
        setAnalysis({ id: row.id, result: row.result_json, marque: row.marque, modele: row.modele, annee: row.annee })
        setVerdictLive({ verdict: row.result_json.verdict, score: row.result_json.score })
      })
      .catch(() => { if (!cancelled) setErreur('Impossible de charger cette analyse.') })
    return () => { cancelled = true }
  }, [id])

  const items = useMemo(() => {
    const base = analysis?.result?.checklist_sur_place || []
    return [
      ...etapesPhoto(base),
      ...base.map(c => ({ ...c, photo: PHOTO_SUGGEREE_RE.test(`${c.quoi} ${c.comment}`) })),
    ]
  }, [analysis])

  const repondre = (etat) => {
    setReponses(prev => ({ ...prev, [idx]: etat }))
    setPhotoEtat('idle')
    setIdx(i => Math.min(items.length, i + 1))
  }

  const prendrePhoto = async (fileList) => {
    const file = fileList?.[0]
    if (!file) return
    setPhotoEtat('analyse')
    try {
      const dataUrl = await resizeImageToDataUrl(file)
      const itemAuMomentDeLaPhoto = idx
      const { result, constats_nouveaux, persiste: p } = await visitePhoto(id, [dataUrl], constatsVisite)
      setConstatsItem(prev => ({
        ...prev,
        [itemAuMomentDeLaPhoto]: [...(prev[itemAuMomentDeLaPhoto] || []), ...(constats_nouveaux || [])],
      }))
      setConstatsVisite(prev => [...prev, ...(constats_nouveaux || [])].slice(0, 24))
      setPersiste(p === true)
      if (result?.verdict) setVerdictLive({ verdict: result.verdict, score: result.score })
      setPhotoEtat('idle')
    } catch (_) {
      setPhotoEtat('erreur')
    }
  }

  const terminer = async () => {
    if (finEnCours) return
    setFinEnCours(true)
    try {
      const reponsesListe = items
        .map((it, i) => ({ quoi: it.quoi, etat: reponses[i] }))
        .filter(r => r.etat)
      // Points restés sans réponse : sous 70 % de couverture, la synthèse se
      // déclare incomplète et ne peut pas conclure « Acheter ».
      const nonVerifies = items.filter((_, i) => !reponses[i]).map(it => it.quoi)
      const { synthese: s, result, persiste: p } = await visiteTerminer(id, reponsesListe, nonVerifies, constatsVisite)
      setSynthese(s)
      setPersiste(p === true)
      if (result?.verdict) setVerdictLive({ verdict: result.verdict, score: result.score })
    } catch (_) {
      setSynthese({ decision: 'negocier', points: ['Synthèse indisponible — appuyez-vous sur le verdict de l\'analyse.'] })
    }
    setFinEnCours(false)
  }

  const vehiculeLabel = analysis
    ? [analysis.marque, analysis.modele, analysis.annee].filter(Boolean).join(' ')
    : ''
  const vLive = verdictLive ? (VERDICT_STYLE[verdictLive.verdict] || VERDICT_STYLE.orange) : null

  const boutonReponse = (etat, label, couleur) => (
    <button
      key={etat}
      onClick={() => repondre(etat)}
      style={{
        flex: 1, minWidth: 90, background: '#fff', border: `2px solid ${couleur}`,
        color: couleur, borderRadius: 14, padding: '16px 10px',
        fontFamily: FONT, fontSize: '1rem', fontWeight: 800, cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )

  /* ---------- Habillage plein écran mobile ---------- */
  return (
    <main style={{ background: '#F8F9FA', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Helmet>
        <title>Mode visite — Inspexo</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      {/* Barre haute */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10, background: '#0F1B2D',
        padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
        <Link to={`/a/${id}`} style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontFamily: FONT, fontSize: '0.875rem', fontWeight: 600 }}>
          ← Verdict
        </Link>
        <div style={{ fontFamily: FONT_TITRE, fontWeight: 800, color: '#fff', fontSize: '0.9375rem', letterSpacing: '1px' }}>
          MODE VISITE
        </div>
        <div style={{ fontFamily: FONT, color: 'rgba(255,255,255,0.7)', fontSize: '0.8125rem', minWidth: 48, textAlign: 'right' }}>
          {idx >= 0 && idx < items.length ? `${idx + 1}/${items.length}` : ''}
        </div>
      </div>

      {/* Verdict vivant */}
      {vLive && idx >= 0 && (
        <div style={{
          background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.07)', padding: '8px 16px',
          fontFamily: FONT, fontSize: '0.8125rem', color: '#6B7280',
          display: 'flex', justifyContent: 'space-between', gap: 8,
        }}>
          <span>{vehiculeLabel}</span>
          <span style={{ color: vLive.color, fontWeight: 700 }}>
            {vLive.label} · {verdictLive.score}/100
          </span>
        </div>
      )}

      <div style={{ flex: 1, maxWidth: 560, width: '100%', margin: '0 auto', padding: '20px 16px 40px', boxSizing: 'border-box' }}>
        {erreur ? (
          <div style={{ fontFamily: FONT, color: '#B91C1C', padding: '40px 0', textAlign: 'center' }}>
            {erreur}
            <div style={{ marginTop: 16 }}>
              <Link to={`/a/${id}`} style={{ color: '#1E4D8C', fontWeight: 600 }}>Retour au verdict</Link>
            </div>
          </div>
        ) : !analysis ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <span style={{
              display: 'inline-block', width: 26, height: 26, border: '3px solid #FF4D00',
              borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
            }} />
            <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
          </div>
        ) : synthese ? (
          /* ---------- Synthèse finale ---------- */
          (() => {
            const d = DECISION_STYLE[synthese.decision] || DECISION_STYLE.negocier
            const nego = analysis.result?.negociation
            return (
              <div>
                {synthese.incomplete && (
                  <div style={{
                    background: '#FFFBEB', border: '1.5px solid rgba(217,119,6,0.4)',
                    borderRadius: 12, padding: '12px 16px', marginBottom: 12,
                    fontFamily: FONT, fontSize: '0.875rem', color: '#92400E', fontWeight: 700,
                  }}>
                    Visite incomplète : {synthese.non_verifies} point{synthese.non_verifies > 1 ? 's' : ''} non vérifié{synthese.non_verifies > 1 ? 's' : ''}.
                    {(synthese.points_critiques_non_verifies || []).length > 0 && (
                      <div style={{ fontWeight: 400, marginTop: 6 }}>
                        Points critiques à vérifier avant de décider :
                        {synthese.points_critiques_non_verifies.map((q, i) => (
                          <div key={i}>– {q}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div style={{
                  background: d.bg, border: `2px solid ${d.color}`, borderRadius: 18,
                  padding: '26px 20px', textAlign: 'center', marginBottom: 16,
                }}>
                  <div style={{ fontFamily: FONT, fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    Synthèse de visite — {vehiculeLabel}
                  </div>
                  <div style={{ fontFamily: FONT_TITRE, fontWeight: 800, fontSize: '1.75rem', color: d.color }}>
                    {synthese.sur_points_verifies ? (
                      <span style={{ display: 'block', fontFamily: FONT, fontSize: '0.8125rem', fontWeight: 600, color: '#6B7280', marginBottom: 2 }}>
                        Sur les points vérifiés :
                      </span>
                    ) : null}
                    {d.label}
                  </div>
                  {verdictLive && (
                    <div style={{ fontFamily: FONT, fontSize: '0.875rem', color: '#374151', marginTop: 6 }}>
                      Verdict actualisé : {(VERDICT_STYLE[verdictLive.verdict] || {}).label} · {verdictLive.score}/100
                    </div>
                  )}
                </div>
                <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.07)', padding: '16px 18px', marginBottom: 14 }}>
                  <div style={{ fontFamily: FONT, fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    Les points qui ont pesé
                  </div>
                  {(synthese.points || []).map((p, i) => (
                    <div key={i} style={{ fontFamily: FONT, fontSize: '0.875rem', color: '#0F1B2D', lineHeight: 1.6, padding: '4px 0' }}>
                      – {p}
                    </div>
                  ))}
                </div>
                {synthese.decision === 'negocier' && nego?.total_min_eur != null && (
                  <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid rgba(30,77,140,0.3)', padding: '16px 18px', marginBottom: 14, fontFamily: FONT }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Marge de négociation chiffrée
                    </div>
                    <div style={{ fontFamily: FONT_TITRE, fontWeight: 800, fontSize: '1.5rem', color: '#1E4D8C' }}>
                      {Number(nego.total_min_eur).toLocaleString('fr-FR')} – {Number(nego.total_max_eur).toLocaleString('fr-FR')} €
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#92400E', marginTop: 6, lineHeight: 1.5 }}>{nego.mention}</div>
                  </div>
                )}
                {persiste === false && (
                  <div style={{
                    fontFamily: FONT, fontSize: '0.75rem', color: '#9CA3AF', lineHeight: 1.6,
                    marginBottom: 12, textAlign: 'center',
                  }}>
                    Mode démo : cette visite reste sur cet écran et ne modifie pas la page
                    publique de l'analyse. Pour la conserver, suivez d'abord l'analyse dans
                    votre dossier d'achat (connexion par lien magique).
                  </div>
                )}
                <button
                  onClick={() => navigate(`/a/${id}`)}
                  style={{
                    width: '100%', background: '#0F1B2D', color: '#fff', border: 'none',
                    borderRadius: 12, padding: '15px', fontFamily: FONT, fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Revoir le verdict complet
                </button>
              </div>
            )
          })()
        ) : idx === -1 ? (
          /* ---------- Intro ---------- */
          <div>
            <div style={{
              background: '#FFF0EA', border: '1.5px solid rgba(255,77,0,0.3)', borderRadius: 12,
              padding: '10px 14px', marginBottom: 18, fontFamily: FONT, fontSize: '0.75rem', color: '#C2410C', fontWeight: 600,
            }}>
              Fonction du Pass achat — en démo libre pendant le lancement.
            </div>
            <h1 style={{ fontFamily: FONT_TITRE, fontWeight: 800, fontSize: '1.5rem', color: '#0F1B2D', margin: '0 0 10px' }}>
              Vous êtes devant la voiture ?
            </h1>
            <p style={{ fontFamily: FONT, fontSize: '0.9375rem', color: '#374151', lineHeight: 1.65, marginBottom: 10 }}>
              {vehiculeLabel} — {items.length} points à vérifier, un par un. Répondez
              « Oui / Non / Doute » ; photographiez le compteur, les pneus, le PV de contrôle
              technique ou le carnet quand c'est proposé : chaque photo est analysée sur-le-champ
              et le verdict se met à jour.
            </p>
            <p style={{ fontFamily: FONT, fontSize: '0.75rem', color: '#9CA3AF', lineHeight: 1.6, marginBottom: 22 }}>
              Les photos sont analysées puis oubliées : jamais stockées. À la fin : synthèse
              « acheter / négocier / ne pas acheter » avec les points qui ont pesé.
            </p>
            <button
              onClick={() => setIdx(0)}
              style={{
                width: '100%', background: '#FF4D00', color: '#fff', border: 'none',
                borderRadius: 12, padding: '17px', fontFamily: FONT, fontSize: '1.0625rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Commencer la visite →
            </button>
          </div>
        ) : idx >= items.length ? (
          /* ---------- Écran avant synthèse ---------- */
          <div style={{ textAlign: 'center', paddingTop: 20 }}>
            <h2 style={{ fontFamily: FONT_TITRE, fontWeight: 800, fontSize: '1.375rem', color: '#0F1B2D' }}>
              Visite terminée
            </h2>
            <p style={{ fontFamily: FONT, fontSize: '0.9375rem', color: '#374151', lineHeight: 1.6 }}>
              {Object.values(reponses).filter(x => x === 'non').length} « non » ·{' '}
              {Object.values(reponses).filter(x => x === 'doute').length} doute(s) sur{' '}
              {Object.keys(reponses).length} points vérifiés.
            </p>
            <button
              onClick={terminer}
              disabled={finEnCours}
              style={{
                width: '100%', background: '#FF4D00', color: '#fff', border: 'none', marginTop: 16,
                borderRadius: 12, padding: '17px', fontFamily: FONT, fontSize: '1.0625rem', fontWeight: 700,
                cursor: 'pointer', opacity: finEnCours ? 0.6 : 1,
              }}
            >
              {finEnCours ? 'Synthèse en cours…' : 'Obtenir la synthèse'}
            </button>
            <button
              onClick={() => setIdx(0)}
              style={{
                marginTop: 12, background: 'none', border: 'none', color: '#6B7280',
                fontFamily: FONT, fontSize: '0.875rem', cursor: 'pointer', textDecoration: 'underline',
              }}
            >
              Revoir les points
            </button>
          </div>
        ) : (
          /* ---------- Un point de checklist ---------- */
          (() => {
            const it = items[idx]
            const constats = constatsItem[idx] || []
            return (
              <div>
                <div style={{ height: 6, background: '#F0F2F5', borderRadius: 100, marginBottom: 20 }}>
                  <div style={{
                    height: 6, borderRadius: 100, background: '#FF4D00',
                    width: `${Math.round((idx / items.length) * 100)}%`, transition: 'width 0.25s',
                  }} />
                </div>
                <h2 style={{ fontFamily: FONT_TITRE, fontWeight: 800, fontSize: '1.3125rem', color: '#0F1B2D', margin: '0 0 10px', lineHeight: 1.25 }}>
                  {it.quoi}
                </h2>
                <p style={{ fontFamily: FONT, fontSize: '0.9375rem', color: '#374151', lineHeight: 1.65, marginBottom: 8 }}>
                  {it.comment}
                </p>
                <p style={{ fontFamily: FONT, fontSize: '0.875rem', color: '#B91C1C', lineHeight: 1.6, marginBottom: 18 }}>
                  Signal rouge : {it.signal_rouge}
                </p>

                {/* Photo facultative */}
                <input
                  ref={fileInputRef} type="file" accept="image/*" capture="environment" hidden
                  onChange={e => { prendrePhoto(e.target.files); e.target.value = '' }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photoEtat === 'analyse'}
                  style={{
                    width: '100%', background: it.photo ? '#FFF0EA' : '#fff',
                    border: `1.5px solid ${it.photo ? 'rgba(255,77,0,0.4)' : 'rgba(0,0,0,0.12)'}`,
                    color: it.photo ? '#C2410C' : '#374151', borderRadius: 12, padding: '13px',
                    fontFamily: FONT, fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', marginBottom: 10,
                  }}
                >
                  {photoEtat === 'analyse'
                    ? 'Analyse de la photo en cours…'
                    : it.photo
                    ? <><IconeAppareilPhoto /> Photographier (analysé sur-le-champ — recommandé ici)</>
                    : <><IconeAppareilPhoto /> Ajouter une photo (facultatif)</>}
                </button>
                {photoEtat === 'erreur' && (
                  <div style={{ fontFamily: FONT, fontSize: '0.8125rem', color: '#B91C1C', marginBottom: 10 }}>
                    Photo non analysée (limite atteinte ou réseau) — continuez la visite.
                  </div>
                )}
                {constats.map((c, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8,
                    fontFamily: FONT, fontSize: '0.8125rem', color: '#0F1B2D', lineHeight: 1.5,
                    background: '#fff', borderRadius: 10, padding: '9px 12px', border: '1px solid rgba(0,0,0,0.07)',
                  }}>
                    <span style={{
                      width: 9, height: 9, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                      background: c.signal === 'rouge' ? '#DC2626' : c.signal === 'attention' ? '#D97706' : '#16A34A',
                    }} />
                    {c.constat}
                  </div>
                ))}

                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  {boutonReponse('oui', 'Oui, OK', '#16A34A')}
                  {boutonReponse('doute', 'Doute', '#D97706')}
                  {boutonReponse('non', 'Non', '#DC2626')}
                </div>
                <button
                  onClick={() => setIdx(i => Math.min(items.length, i + 1))}
                  style={{
                    marginTop: 14, width: '100%', background: 'none', border: 'none', color: '#9CA3AF',
                    fontFamily: FONT, fontSize: '0.8125rem', cursor: 'pointer', textDecoration: 'underline',
                  }}
                >
                  Passer ce point
                </button>
              </div>
            )
          })()
        )}
      </div>
    </main>
  )
}
