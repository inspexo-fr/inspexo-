import React, { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SPECIALISTS, HERO_TIMELINE } from './heroData'

function smoothstep(a, b, t) {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}
function lerp(a, b, t) {
  return a + (b - a) * t
}

/* ── StarField — 500 particules (réduit sur mobile/reduced-motion) ── */
function StarField({ count = 500 }) {
  const ref = useRef()
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 80
      positions[i * 3 + 1] = (Math.random() - 0.5) * 50
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60 - 10
      const useEmber = Math.random() < 0.18
      if (useEmber) {
        colors[i * 3] = 1; colors[i * 3 + 1] = 0.36; colors[i * 3 + 2] = 0.12
      } else {
        const b = 0.4 + Math.random() * 0.5
        colors[i * 3] = b; colors[i * 3 + 1] = b; colors[i * 3 + 2] = b * 0.95
      }
    }
    return { positions, colors }
  }, [count])

  useFrame(() => {
    if (ref.current) ref.current.rotation.y += 0.0005
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color"    args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.08} vertexColors transparent opacity={0.85} sizeAttenuation />
    </points>
  )
}

/* ── ClusterAndPlanet — 1 spécialiste : 8 icônes en orbite + planète + anneau + halo + drapeau ── */
function ClusterAndPlanet({ specialist, idx, progress }) {
  const groupRef = useRef()
  const planetRef = useRef()
  const ringRef = useRef()
  const glowRef = useRef()
  const flagRef = useRef()
  const iconsRef = useRef([])

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    const iconsAppear    = smoothstep(HERO_TIMELINE.iconsAppear.start,    HERO_TIMELINE.iconsAppear.end,    progress)
    const iconsConverge  = smoothstep(HERO_TIMELINE.iconsConverge.start,  HERO_TIMELINE.iconsConverge.end,  progress)
    const planetsAppear  = smoothstep(HERO_TIMELINE.planetsAppear.start,  HERO_TIMELINE.planetsAppear.end,  progress)
    const planetsLock    = smoothstep(HERO_TIMELINE.planetsLock.start,    HERO_TIMELINE.planetsLock.end,    progress)
    const flagDropPhase  = smoothstep(HERO_TIMELINE.flagsDrop.start,      HERO_TIMELINE.flagsDrop.end,      progress)
    const flagFadePhase  = smoothstep(HERO_TIMELINE.flagsDrop.end,        HERO_TIMELINE.flagsDrop.end + 0.06, progress)

    iconsRef.current.forEach((icon, i) => {
      if (!icon) return
      const baseAngle = (i / 8) * Math.PI * 2 + idx * 0.5
      const baseRadius = 2 + (i % 3) * 0.2
      const orbitOffset = time * (0.3 + (i % 4) * 0.05)
      const angle = baseAngle + orbitOffset * 0.15
      const targetX = specialist.basePos[0] + Math.cos(angle) * baseRadius
      const targetY = specialist.basePos[1] + Math.sin(time * 0.6 + i * 0.5 + idx) * 0.3
      const targetZ = specialist.basePos[2] + Math.sin(angle) * baseRadius * 0.6 + Math.cos(time * 0.5 + i) * 0.4
      icon.position.x = lerp(targetX, specialist.basePos[0], iconsConverge)
      icon.position.y = lerp(targetY, specialist.basePos[1], iconsConverge)
      icon.position.z = lerp(targetZ, specialist.basePos[2], iconsConverge)
      icon.rotation.x += 0.012
      icon.rotation.y += 0.015
      icon.rotation.z += 0.008
      icon.scale.setScalar(lerp(1, 0.15, iconsConverge))
      if (icon.material) {
        icon.material.opacity = iconsAppear * (1 - iconsConverge * 0.85)
      }
    })

    if (planetRef.current) {
      planetRef.current.material.opacity = planetsAppear
      planetRef.current.scale.setScalar(lerp(0.3, 1, planetsAppear))
      planetRef.current.rotation.y += 0.003
      planetRef.current.rotation.x = 0.15
    }
    if (ringRef.current) {
      ringRef.current.material.opacity = planetsAppear * 0.5
      ringRef.current.scale.setScalar(lerp(0.3, 1, planetsAppear))
      ringRef.current.rotation.z += 0.001
    }
    if (glowRef.current) {
      glowRef.current.material.opacity = planetsLock * 0.18
      glowRef.current.scale.setScalar(lerp(0.3, 1, planetsAppear))
    }
    if (flagRef.current) {
      const flagYTarget = specialist.basePos[1] + 2.2
      flagRef.current.position.y = lerp(20, flagYTarget, flagDropPhase)
      flagRef.current.position.x = specialist.basePos[0]
      flagRef.current.material.opacity = flagDropPhase * (1 - flagFadePhase)
    }
  })

  /* Crée 8 icônes mécaniques avec géométries variées */
  const icons = useMemo(() => {
    return Array.from({ length: 8 }).map((_, i) => {
      const isAI = i === 0
      let geometry
      if (isAI) geometry = new THREE.BoxGeometry(0.5, 0.5, 0.15)
      else if (i % 4 === 1) geometry = new THREE.TorusGeometry(0.32, 0.08, 8, 16)
      else if (i % 4 === 2) geometry = new THREE.CylinderGeometry(0.18, 0.18, 0.5, 8)
      else if (i % 4 === 3) geometry = new THREE.OctahedronGeometry(0.32, 0)
      else geometry = new THREE.BoxGeometry(0.4, 0.4, 0.4)
      const material = new THREE.MeshStandardMaterial({
        color: isAI ? 0xff5b1f : 0xc8c8d0,
        emissive: isAI ? 0xff5b1f : 0x202028,
        emissiveIntensity: isAI ? 0.6 : 0.15,
        roughness: 0.4,
        metalness: 0.6,
        transparent: true,
        opacity: 0,
      })
      return { geometry, material }
    })
  }, [])

  /* Texture canvas du drapeau (avec le nom de marque iconique) */
  const flagTexture = useMemo(() => {
    if (typeof document === 'undefined') return null
    const canvas = document.createElement('canvas')
    canvas.width = 256; canvas.height = 80
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'rgba(255,91,31,0.15)'
    ctx.fillRect(0, 0, 256, 80)
    ctx.strokeStyle = '#FF5B1F'
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, 254, 78)
    ctx.fillStyle = '#FF5B1F'
    ctx.font = '600 28px "Geist Mono", "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(specialist.flag, 128, 42)
    return new THREE.CanvasTexture(canvas)
  }, [specialist.flag])

  return (
    <group ref={groupRef}>
      {icons.map((icon, i) => (
        <mesh
          key={i}
          ref={(el) => (iconsRef.current[i] = el)}
          geometry={icon.geometry}
          material={icon.material}
        />
      ))}
      <mesh ref={planetRef} position={specialist.basePos}>
        <sphereGeometry args={[1.4, 48, 48]} />
        <meshStandardMaterial
          color={specialist.planetColor}
          emissive={specialist.planetEmissive}
          emissiveIntensity={0.4}
          roughness={0.35}
          metalness={0.55}
          transparent
          opacity={0}
        />
      </mesh>
      <mesh ref={ringRef} position={specialist.basePos} rotation={[Math.PI / 2.2, 0, 0]}>
        <ringGeometry args={[1.9, 2.2, 64]} />
        <meshBasicMaterial color={0xff5b1f} side={THREE.DoubleSide} transparent opacity={0} />
      </mesh>
      <mesh ref={glowRef} position={specialist.basePos}>
        <sphereGeometry args={[1.7, 32, 32]} />
        <meshBasicMaterial color={0xff5b1f} transparent opacity={0} side={THREE.BackSide} />
      </mesh>
      {flagTexture && (
        <mesh ref={flagRef} position={[specialist.basePos[0], 20, specialist.basePos[2] + 1]}>
          <planeGeometry args={[2.2, 0.7]} />
          <meshBasicMaterial map={flagTexture} transparent opacity={0} depthTest={false} />
        </mesh>
      )}
    </group>
  )
}

/* ── CameraController — zoom subtil selon le scroll ── */
function CameraController({ progress }) {
  const { camera } = useThree()
  useFrame(() => {
    const cameraPhase = smoothstep(0.18, 0.45, progress)
    camera.position.z = lerp(18, 22, cameraPhase)
  })
  return null
}

export default function HeroScene({ progress, isMobile = false, reduceMotion = false }) {
  const starCount = reduceMotion ? 50 : isMobile ? 220 : 500
  return (
    <Canvas
      camera={{ position: [0, 0, 18], fov: 55, near: 0.1, far: 200 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    >
      <fogExp2 attach="fog" args={[0x050507, 0.025]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 8, 5]} intensity={0.8} color={0xffaa88} />
      <pointLight position={[0, 0, 8]} intensity={2.5} distance={40} color={0xff5b1f} />
      <StarField count={starCount} />
      {SPECIALISTS.map((s, i) => (
        <ClusterAndPlanet key={s.key} specialist={s} idx={i} progress={progress} />
      ))}
      <CameraController progress={progress} />
    </Canvas>
  )
}
