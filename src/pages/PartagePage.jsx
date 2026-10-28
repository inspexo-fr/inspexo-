import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  estNatif, urlPartageValide, ouvrirEtExtraire, telechargerPhoto, envoyerVersIntake,
} from '../lib/mobile'

const FONT = 'Plus Jakarta Sans, sans-serif'
const FONT_TITRE = 'Syne, sans-serif'
const MAX_PHOTOS = 6

const ETAPES = {
  chargement: 'Ouverture de l\'annonce sur votre téléphone…',
  verification_humaine: 'Si une vérification s\'affiche, validez-la — l\'analyse reprendra toute seule.',
  extraction: 'Lecture de l\'annonce…',
  photos: 'Récupération des photos…',
  analyse: 'Analyse en cours — la page de résultat s\'ouvre dans quelques secondes…',
}

/** Page d'orchestration du partage mobile (« Partager → Inspexo »).
 *  Tout se passe sur le téléphone : WebView visible (l'utilisateur passe
 *  lui-même une éventuelle vérification anti-robot), extracteurs de
 *  l'extension Chrome, photos ré-encodées localement, puis intake. */
export default function PartagePage() {
  const navigate = useNavigate()
  const [etape, setEtape] = useState('chargement')
  const [erreur, setErreur] = useState(null)
  const [chrono, setChrono] = useState(null) // mesures pour le rapport de faisabilité
  const lance = useRef(false)

  useEffect(() => {
    if (lance.current) return
    lance.current = true

    const url = urlPartageValide(new URLSearchParams(window.location.search).get('u'))
    if (!estNatif()) {
      setErreur('Cette page reçoit les annonces partagées depuis l\'appli mobile Inspexo.')
      return
    }
    if (!url) {
      setErreur('Lien non pris en charge : partagez une annonce Leboncoin, La Centrale ou AutoScout24, ou collez son texte.')
      return
    }

    ;(async () => {
      const t0 = Date.now()
      try {
        const donnees = await ouvrirEtExtraire(url, setEtape)
        const tExtraction = Date.now() - t0

        setEtape('photos')
        const images = []
        for (const photoUrl of (donnees.photos || []).slice(0, MAX_PHOTOS)) {
          try { images.push(await telechargerPhoto(photoUrl)) } catch (_) { /* photo inaccessible : on continue */ }
        }
        const tPhotos = Date.now() - t0

        setEtape('analyse')
        const { id } = await envoyerVersIntake(donnees, images)
        const tTotal = Date.now() - t0
        setChrono({ extraction: tExtraction, photos: tPhotos - tExtraction, total: tTotal })
        console.info('[faisabilite] extraction', tExtraction, 'ms · photos', tPhotos - tExtraction, 'ms · total', tTotal, 'ms')
        navigate(`/a/${id}`)
      } catch (e) {
        if (e.code === 'ferme') {
          setErreur('Annonce fermée avant la fin de la lecture. Repartagez-la, ou collez son texte.')
        } else if (e.code === 'rate_limited') {
          setErreur(e.message)
        } else {
          setErreur('La lecture de l\'annonce a échoué. Collez son texte dans l\'analyse classique — même résultat.')
        }
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main style={{ background: '#F8F9FA', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Helmet><title>Analyse de l'annonce partagée — Inspexo</title><meta name="robots" content="noindex" /></Helmet>
      <div style={{ background: '#0F1B2D', padding: '16px', textAlign: 'center' }}>
        <span style={{ fontFamily: FONT_TITRE, fontWeight: 800, color: '#fff', letterSpacing: '3px' }}>
          INSP<span style={{ color: '#FF4D00' }}>E</span>XO
        </span>
      </div>
      <div style={{ flex: 1, maxWidth: 520, width: '100%', margin: '0 auto', padding: '40px 20px', boxSizing: 'border-box', textAlign: 'center' }}>
        {erreur ? (
          <>
            <div style={{ fontFamily: FONT, fontSize: '0.9375rem', color: '#92400E', lineHeight: 1.6, marginBottom: 20 }}>
              {erreur}
            </div>
            <Link to="/score" style={{
              display: 'inline-block', background: '#FF4D00', color: '#fff', borderRadius: 10,
              padding: '13px 24px', textDecoration: 'none', fontFamily: FONT, fontWeight: 700, fontSize: '0.9375rem',
            }}>
              Analyser autrement
            </Link>
          </>
        ) : (
          <>
            <span style={{
              display: 'inline-block', width: 26, height: 26, border: '3px solid #FF4D00',
              borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 16,
            }} />
            <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
            <div style={{ fontFamily: FONT, fontSize: '1rem', fontWeight: 600, color: '#0F1B2D', lineHeight: 1.6 }}>
              {ETAPES[etape] || ETAPES.chargement}
            </div>
            <div style={{ marginTop: 14, fontFamily: FONT, fontSize: '0.75rem', color: '#9CA3AF', lineHeight: 1.6 }}>
              L'annonce est lue sur votre téléphone — rien n'est collecté depuis nos serveurs.
              Les photos sont analysées puis oubliées, jamais stockées.
            </div>
            {chrono && (
              <div style={{ marginTop: 10, fontFamily: FONT, fontSize: '0.6875rem', color: '#C3C9D2' }}>
                lecture {Math.round(chrono.extraction / 1000)} s · photos {Math.round(chrono.photos / 1000)} s
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
