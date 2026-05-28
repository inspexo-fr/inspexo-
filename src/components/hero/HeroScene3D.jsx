/**
 * HeroScene3D — Étape 4 : scène R3F lazy-loadée, Séquence 2 (belt) only.
 *
 * Composition :
 *   <Canvas> (absolute, behind .frame, pointer-events: none)
 *     ambient + directional + rim → éclairage faible, ember en accent
 *     <Belt>      8 InstancedMesh (1 par type de PARTS), tier-aware
 *     <Filaments> sprite additif ember qui scanne left→right avec bProg
 *     <CameraRig> position + lookAt scroll-driven (lerp doux)
 *
 * Pas de @react-three/postprocessing (peer-dep cassée avec three 0.184).
 * Le bloom est simulé par emissive + sprite additif (validé brief Phase 3.5).
 *
 * Stand-in : géométries primitives Three.js (BoxGeometry, CylinderGeometry,
 * etc.) en attendant les GLB. Swap futur via useGLTF dans une étape ultérieure
 * — l'API du composant ne change pas.
 *
 * LCP : ce composant n'est PAS dans le chemin LCP. Il est lazy-loadé via
 * React.lazy + Suspense fallback={null} → la coquille HTML+H1 peint en
 * premier, le canvas mount après le main bundle parse.
 */

import React, { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PARTS, TIERS, COLORS } from '../../lib/constants'

const EMBER  = new THREE.Color(COLORS.ember)
const GOLD   = new THREE.Color(COLORS.gold)
const CREAM  = new THREE.Color(COLORS.cream)
const SMOKE  = new THREE.Color(COLORS.smoke)

// Réutilisé dans useFrame — pas de new() par tick (GC pressure)
const _tmp = new THREE.Object3D()

/* ────────────────────────────────────────────────────────────
   Geometries — stand-in primitives, hoistées au module pour
   être instanciées une seule fois (partagées entre instances).
   ──────────────────────────────────────────────────────────── */
const GEOMETRIES = {
  piston:       new THREE.CylinderGeometry(0.45, 0.45, 1.1, 16),
  vilebrequin:  new THREE.TorusKnotGeometry(0.38, 0.12, 64, 8, 2, 3),
  amortisseur:  new THREE.CylinderGeometry(0.18, 0.18, 1.5, 12),
  engrenage:    new THREE.TorusGeometry(0.5, 0.16, 8, 20),
  cle:          new THREE.BoxGeometry(0.18, 1.0, 0.06),
  bougie:       new THREE.CylinderGeometry(0.12, 0.18, 0.75, 8),
  disque_frein: new THREE.CylinderGeometry(0.6, 0.6, 0.08, 24),
  puce:         new THREE.BoxGeometry(0.55, 0.05, 0.32),
}

/* Belt progress local : 0 → 1 sur la range SEQUENCES.belt [0.15, 0.65] */
function beltProgress(progress) {
  return Math.max(0, Math.min(1, (progress - 0.15) / 0.5))
}

/* Détection tier — figée au mount (pas de resize handler pour Étape 4) */
function useTier() {
  return useMemo(() => {
    if (typeof window === 'undefined') return TIERS.mobile
    const w = window.innerWidth
    if (w >= TIERS.desktop.minWidth) return TIERS.desktop
    if (w >= TIERS.tablet.minWidth)  return TIERS.tablet
    return TIERS.mobile
  }, [])
}

/* ────────────────────────────────────────────────────────────
   PartInstances — un InstancedMesh par type de PARTS.
   Positions semées déterministe (sin pseudo-random) pour
   répartir dans un volume belt sans new Math.random() à chaque
   mount.
   ──────────────────────────────────────────────────────────── */
function PartInstances({ part, count, partIndex }) {
  const meshRef = useRef(null)

  // Material par instance group — on partage la geometry, on garde le material
  // pour pouvoir piloter l'emissiveIntensity (filament scan) sans toucher aux
  // autres groups
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color:            new THREE.Color(0xC8C2B8),
    metalness:        0.7,
    roughness:        0.45,
    emissive:         EMBER.clone(),
    emissiveIntensity: 0,
  }), [])

  // Positions statiques semées — 1 fois au mount
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // Belt étendu de x=-7 à x=+7 (14 unités)
      // partIndex décale chaque type pour éviter superposition exacte
      const phase = (partIndex * count + i) / (PARTS.length * count)
      const x = -7 + 14 * phase
      // Y, Z scattered via sin pseudo-random (déterministe → stable au reload)
      const seed1 = Math.sin((partIndex * 13.3 + i * 7.7) * 0.5) * 0.5 + 0.5
      const seed2 = Math.sin((partIndex * 5.1  + i * 11.2) * 0.5) * 0.5 + 0.5
      const y = (seed1 - 0.5) * 3.2
      const z = (seed2 - 0.5) * 4.5 - 1.5
      arr[i * 3]     = x
      arr[i * 3 + 1] = y
      arr[i * 3 + 2] = z
    }
    return arr
  }, [partIndex, count])

  // Rotation phase par instance — déterministe
  const phases = useMemo(() => {
    const arr = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      arr[i] = Math.sin((partIndex * 3.7 + i * 2.3)) * Math.PI
    }
    return arr
  }, [partIndex, count])

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.elapsedTime
    const bProg = beltProgress(state.scene.userData.progress ?? 0)

    // Filament scan — pulse emissive max quand x ≈ scanX
    // bProg 0→1 mappe scanX -7 → +7
    const scanX = -7 + 14 * bProg

    for (let i = 0; i < count; i++) {
      const x = positions[i * 3]
      const y = positions[i * 3 + 1]
      const z = positions[i * 3 + 2]

      // Léger flottement vertical par phase
      _tmp.position.set(
        x,
        y + Math.sin(t * 0.6 + phases[i]) * 0.18,
        z,
      )
      _tmp.rotation.set(
        t * 0.18 + phases[i],
        t * 0.12 + phases[i] * 0.5,
        0,
      )
      // Échelle légèrement modulée par bProg (parts "respirent")
      _tmp.scale.setScalar(0.65 + bProg * 0.25)
      _tmp.updateMatrix()
      meshRef.current.setMatrixAt(i, _tmp.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true

    // Emissive intensity — pulse global selon proximité moyenne du scan
    // Approximation : intensité = nb de parts à <1.5 unités du filament
    let pulse = 0
    for (let i = 0; i < count; i++) {
      const dx = Math.abs(positions[i * 3] - scanX)
      if (dx < 1.5) pulse += 1 - dx / 1.5
    }
    material.emissiveIntensity = Math.min(1.4, (pulse / count) * 6)
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[GEOMETRIES[part], material, count]}
      frustumCulled={false}
    />
  )
}

/* ────────────────────────────────────────────────────────────
   Belt — orchestre les 8 PartInstances. count total réparti
   à parts égales.
   ──────────────────────────────────────────────────────────── */
function Belt({ tier }) {
  const totalInstances = tier.instances
  const perPart = Math.max(1, Math.floor(totalInstances / PARTS.length))

  return PARTS.map((part, pi) => (
    <PartInstances key={part} part={part} partIndex={pi} count={perPart} />
  ))
}

/* ────────────────────────────────────────────────────────────
   Filaments — sprite additif ember, scanne le belt.
   Plane vertical (0.5 × 8), blending Additive, depthWrite off,
   opacity modulée par bProg pour fade in/out aux extrémités.
   ──────────────────────────────────────────────────────────── */
function Filaments() {
  const ref = useRef(null)

  const material = useMemo(() => new THREE.MeshBasicMaterial({
    color:        EMBER,
    transparent:  true,
    opacity:      0.5,
    blending:     THREE.AdditiveBlending,
    depthWrite:   false,
    toneMapped:   false,
  }), [])

  useFrame((state) => {
    if (!ref.current) return
    const bProg = beltProgress(state.scene.userData.progress ?? 0)
    const scanX = -7 + 14 * bProg
    ref.current.position.x = scanX
    // Fade : opacité monte 0→0.6 sur [0, 0.1], reste plate, redescend [0.9, 1]
    const fadeIn  = Math.min(1, bProg / 0.1)
    const fadeOut = Math.min(1, (1 - bProg) / 0.1)
    material.opacity = 0.6 * Math.min(fadeIn, fadeOut)
  })

  return (
    <mesh ref={ref} material={material}>
      <planeGeometry args={[0.5, 8]} />
    </mesh>
  )
}

/* ────────────────────────────────────────────────────────────
   CameraRig — interpolation scroll-driven.
   bProg 0   : vue large (z=10, y=0.5)
   bProg 0.5 : milieu (z=6, slight pan)
   bProg 1   : zoom anatomie (z=3.5)
   Lerp doux pour amortir les jumps de progress.
   ──────────────────────────────────────────────────────────── */
function CameraRig() {
  const targetPos    = useRef(new THREE.Vector3(0, 0.5, 10))
  const currentPos   = useRef(new THREE.Vector3(0, 0.5, 10))

  useFrame((state, dt) => {
    const bProg = beltProgress(state.scene.userData.progress ?? 0)

    // Position cible
    targetPos.current.set(
      Math.sin(bProg * Math.PI) * 1.2,  // léger pan latéral en cloche
      0.5 + bProg * 0.3,
      10 - bProg * 6.5,
    )

    // Lerp doux (10% par tick, frame-rate dependant mais OK pour Étape 4)
    currentPos.current.lerp(targetPos.current, Math.min(1, dt * 5))
    state.camera.position.copy(currentPos.current)
    state.camera.lookAt(0, 0, 0)
  })

  return null
}

/* ────────────────────────────────────────────────────────────
   ProgressBridge — injecte `progress` dans scene.userData pour
   que les hooks useFrame puissent y accéder sans context React
   custom (et sans re-render des InstancedMesh à chaque scroll).
   ──────────────────────────────────────────────────────────── */
function ProgressBridge({ progress }) {
  useFrame((state) => {
    state.scene.userData.progress = progress
  })
  return null
}

/* ────────────────────────────────────────────────────────────
   HeroScene3D — composant exporté.
   Lazy-loadé depuis Hero.jsx → ce chunk reste hors du main
   bundle (preserve LCP).
   ──────────────────────────────────────────────────────────── */
export default function HeroScene3D({ progress }) {
  const tier = useTier()

  // prefers-reduced-motion : fige la scène à un état moyen statique
  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  // Si reduced-motion : on garde le canvas (pour ne pas masquer la composition)
  // mais on fige progress à 0.4 (milieu de belt)
  const effectiveProgress = reducedMotion ? 0.4 : progress

  return (
    <Canvas
      style={{
        position:      'absolute',
        inset:         0,
        zIndex:        1,
        pointerEvents: 'none',
      }}
      gl={{
        alpha:           true,
        antialias:       true,
        powerPreference: 'high-performance',
      }}
      dpr={[1, 1.5]}
      camera={{ fov: 35, position: [0, 0.5, 10], near: 0.1, far: 100 }}
      frameloop={reducedMotion ? 'demand' : 'always'}
    >
      <ambientLight intensity={0.35} color={CREAM} />
      <directionalLight position={[5, 5, 5]}   intensity={0.9} color={CREAM} />
      <directionalLight position={[-5, -2, 3]} intensity={0.3} color={GOLD} />

      <ProgressBridge progress={effectiveProgress} />
      <Belt      tier={tier} />
      <Filaments />
      <CameraRig />
    </Canvas>
  )
}
