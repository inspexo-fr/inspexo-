import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  estNatif, urlPartageValide, ouvrirEtExtraire, telechargerPhoto, envoyerVersIntake,
} from '../lib/mobile'
import { enregistrerComparables } from '../lib/comparablesLocaux'

// ⚠️ Cette page portait encore Syne et Plus Jakarta Sans, supprimées du projet
// au sprint 5 : elle s'affichait donc dans la police de repli du système,
// seule page du site dans ce cas. On reprend les familles des tokens.
const SANS = 'var(--sans)'
const MAX_PHOTOS = 6

const ETAPES = {
  chargement: 'Ouverture de la page sur votre téléphone…',
  verification_humaine: 'Si une vérification s\'affiche, validez-la — la lecture reprendra toute seule.',
  extraction: 'Lecture de la page…',
  photos: 'Récupération des photos…',
  analyse: 'Analyse en cours — la page de résultat s\'ouvre dans quelques secondes…',
}

/** Page d'orchestration du partage mobile (« Partager → Inspexo »).
 *  Tout se passe sur le téléphone : WebView visible (l'utilisateur passe
 *  lui-même une éventuelle vérification anti-robot), extracteurs de
 *  l'extension Chrome, photos ré-encodées localement, puis intake.
 *
 *  DEUX GESTES, un seul écran :
 *   - une ANNONCE partagée → analyse, puis /a/:id ;
 *   - une page de RECHERCHE partagée → les annonces affichées deviennent les
 *     comparables de la prochaine analyse (mode revendeur). Elles restent sur
 *     l'appareil ; rien ne part vers nos serveurs à ce moment-là. */
export default function PartagePage() {
  const navigate = useNavigate()
  const [etape, setEtape] = useState('chargement')
  const [erreur, setErreur] = useState(null)
  const [comparables, setComparables] = useState(0)
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
        const lu = await ouvrirEtExtraire(url, setEtape)

        // Page de recherche : on garde les annonces sur l'appareil et on
        // s'arrête là. Aucun envoi, aucune analyse — l'utilisateur a demandé
        // des comparables, pas un verdict.
        if (lu.type === 'recherche') {
          setComparables(enregistrerComparables(lu.annonces))
          return
        }

        const donnees = lu.data
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
          setErreur('Page fermée avant la fin de la lecture. Repartagez-la, ou collez le texte de l\'annonce.')
        } else if (e.code === 'rate_limited') {
          setErreur(e.message)
        } else {
          setErreur('La lecture de la page a échoué. Collez le texte de l\'annonce dans l\'analyse classique — même résultat.')
        }
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const bouton = {
    display: 'inline-block', background: 'var(--signal)', color: 'var(--on-signal)', borderRadius: 2,
    padding: '13px 24px', textDecoration: 'none', fontFamily: SANS, fontWeight: 700, fontSize: '0.9375rem',
  }

  return (
    <main style={{ background: 'var(--paper)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Helmet><title>Page partagée — Inspexo</title><meta name="robots" content="noindex" /></Helmet>
      <div style={{ background: 'var(--nav-bg)', padding: '16px', textAlign: 'center' }}>
        <span style={{ fontFamily: SANS, fontWeight: 800, color: 'var(--nav-fg)', letterSpacing: '3px' }}>
          INSP<span style={{ color: 'var(--signal)' }}>E</span>XO
        </span>
      </div>
      <div style={{ flex: 1, maxWidth: 520, width: '100%', margin: '0 auto', padding: '40px 20px', boxSizing: 'border-box', textAlign: 'center' }}>
        {erreur ? (
          <>
            <div style={{ fontFamily: SANS, fontSize: '0.9375rem', color: 'var(--ink)', lineHeight: 1.6, marginBottom: 20 }}>
              {erreur}
            </div>
            <Link to="/score" style={bouton}>Analyser autrement</Link>
          </>
        ) : comparables > 0 ? (
          <>
            <div style={{ fontFamily: SANS, fontSize: '1rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.6 }}>
              {comparables} annonce{comparables > 1 ? 's' : ''} relevée{comparables > 1 ? 's' : ''} sur cette recherche.
            </div>
            <div style={{ marginTop: 12, fontFamily: SANS, fontSize: '0.875rem', color: 'var(--graphite)', lineHeight: 1.6 }}>
              Partagez maintenant l'annonce qui vous intéresse : ces prix serviront de comparables
              pour calculer votre prix de revente et votre prix d'achat maximum.
            </div>
            <div style={{ marginTop: 16, fontFamily: SANS, fontSize: '0.75rem', color: 'var(--graphite)', lineHeight: 1.6 }}>
              Elles restent sur votre téléphone, et s'effacent au bout de 24 heures.
            </div>
            <div style={{ marginTop: 24 }}>
              <Link to="/score" style={bouton}>Analyser une annonce</Link>
            </div>
          </>
        ) : (
          <>
            <span style={{
              display: 'inline-block', width: 26, height: 26, border: '3px solid var(--signal)',
              borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 16,
            }} />
            <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
            <div style={{ fontFamily: SANS, fontSize: '1rem', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.6 }}>
              {ETAPES[etape] || ETAPES.chargement}
            </div>
            <div style={{ marginTop: 14, fontFamily: SANS, fontSize: '0.75rem', color: 'var(--graphite)', lineHeight: 1.6 }}>
              La page est lue sur votre téléphone — rien n'est collecté depuis nos serveurs.
              Les photos sont analysées puis oubliées, jamais stockées.
            </div>
            {chrono && (
              <div style={{ marginTop: 10, fontFamily: SANS, fontSize: '0.6875rem', color: 'var(--graphite)' }}>
                lecture {Math.round(chrono.extraction / 1000)} s · photos {Math.round(chrono.photos / 1000)} s
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
