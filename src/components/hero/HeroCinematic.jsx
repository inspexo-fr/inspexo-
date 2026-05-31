/**
 * HeroCinematic — Méthode A (spec docs/hero-spec.md §1).
 *
 * Scrub frame-accurate par <video> all-intra :
 *   - video.currentTime = progress * video.duration
 *   - rAF throttle, seek seulement si delta > ½ frame (1/48 s à 24 fps)
 *   - pause() jamais play(), muted, playsInline, preload="auto"
 *
 * Responsive : wide desktop / vert mobile via matchMedia (figés au mount).
 * prefers-reduced-motion : on rend uniquement le poster (img), pas de scrub.
 *
 * onError vidéo → fallback poster img automatique (codec/network failure).
 *
 * LCP : composant lazy-loadé depuis Hero.jsx → ne dégrade pas le H1 LCP.
 * z-index 1 (au-dessus du fond ink, en dessous du voile + frame).
 */
import React, { useEffect, useRef, useState } from 'react'
import styles from './Hero.module.css'

const SOURCES = {
  wide: { video: '/hero/hero_wide.mp4', poster: '/hero/poster_wide.jpg' },
  vert: { video: '/hero/hero_vert.mp4', poster: '/hero/poster_vert.jpg' },
}

function detectOrientation() {
  if (typeof window === 'undefined') return 'wide'
  // Mobile portrait → source verticale. Breakpoint aligné sur TIERS.mobile (<768).
  return window.matchMedia('(max-width: 767px)').matches ? 'vert' : 'wide'
}

function detectReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function HeroCinematic({ progress }) {
  // Figés au mount — re-mount manuel sur resize cross-breakpoint (rare en usage)
  const [orientation] = useState(detectOrientation)
  const [reducedMotion] = useState(detectReducedMotion)
  const [videoFailed, setVideoFailed] = useState(false)
  const { video: videoSrc, poster: posterSrc } = SOURCES[orientation]

  const videoRef = useRef(null)
  const rafRef = useRef(0)
  const pendingProgressRef = useRef(progress)

  // Scrub : throttle rAF, seek si delta > ½ frame
  useEffect(() => {
    if (reducedMotion || videoFailed) return undefined
    pendingProgressRef.current = progress
    if (rafRef.current) return undefined
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      const v = videoRef.current
      if (!v || v.readyState < 2 || !v.duration) return
      const target = pendingProgressRef.current * v.duration
      // ½ frame de seuil = 1/(2×24) ≈ 0.0208 s — évite seek redondants
      if (Math.abs(v.currentTime - target) > 1 / 48) {
        v.currentTime = target
      }
    })
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
    }
  }, [progress, reducedMotion, videoFailed])

  // iOS Safari : déclenche un play()/pause() au loadedmetadata pour débloquer
  // le scrub. Sans ça, currentTime= ne fait rien tant que play() n'a pas été
  // appelé une fois. muted+playsInline = autoplay autorisé sans interaction.
  useEffect(() => {
    if (reducedMotion || videoFailed) return undefined
    const v = videoRef.current
    if (!v) return undefined
    const onMeta = () => {
      const p = v.play()
      if (p && p.then) p.then(() => v.pause()).catch(() => v.pause())
      else v.pause()
    }
    v.addEventListener('loadedmetadata', onMeta, { once: true })
    return () => v.removeEventListener('loadedmetadata', onMeta)
  }, [reducedMotion, videoFailed])

  // Reduced-motion OU vidéo cassée → poster only
  if (reducedMotion || videoFailed) {
    return (
      <img
        src={posterSrc}
        alt=""
        aria-hidden="true"
        className={styles.cinematic}
      />
    )
  }

  return (
    <video
      ref={videoRef}
      src={videoSrc}
      poster={posterSrc}
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      className={styles.cinematic}
      onError={() => setVideoFailed(true)}
    />
  )
}
