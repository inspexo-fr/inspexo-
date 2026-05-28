import React from 'react'
import { SPECIALISTS, HERO_TIMELINE } from './heroData'

function smoothstep(a, b, t) {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

/* Positions approximatives 2D des planètes (% du viewport).
   Calibrées sur la projection caméra à z=22, fov 55° dans HeroScene. */
const PLANET_2D_POSITIONS = {
  DE: { left: '18%', top: '32%' },
  IT: { left: '50%', top: '24%' },
  UK: { left: '82%', top: '32%' },
  FR: { left: '18%', top: '58%' },
  JP: { left: '50%', top: '58%' },
  KR: { left: '82%', top: '58%' },
  US: { left: '50%', top: '85%' },
}

export default function HeroPlanetLabels({ progress }) {
  const lock = smoothstep(HERO_TIMELINE.planetsLock.start, HERO_TIMELINE.planetsLock.end, progress)

  return (
    <>
      <style>{`
        .planet-labels {
          position: absolute; inset: 0;
          pointer-events: none; z-index: 5;
          transition: opacity 600ms ease;
        }
        .planet-label-group {
          position: absolute;
          transform: translate(-50%, 92px);
          text-align: center;
        }
        .planet-label__name {
          font-family: 'Geist', system-ui, sans-serif;
          font-weight: 500; font-size: 14px;
          color: #FAFAF8; margin-bottom: 4px;
          letter-spacing: -0.01em;
        }
        .planet-label__spec {
          font-family: 'Geist Mono', 'JetBrains Mono', monospace;
          font-size: 9px; letter-spacing: 0.18em;
          color: #FF5B1F; text-transform: uppercase;
        }

        @media (max-width: 768px) {
          .planet-label__name { font-size: 12px; }
          .planet-label__spec { font-size: 8px; }
          .planet-label-group { transform: translate(-50%, 70px); }
        }
      `}</style>
      <div className="planet-labels" style={{ opacity: lock }}>
        {SPECIALISTS.map((s) => {
          const pos = PLANET_2D_POSITIONS[s.key]
          return (
            <div
              key={s.key}
              className="planet-label-group"
              style={{ left: pos.left, top: pos.top }}
            >
              <div className="planet-label__name">{s.name}</div>
              <div className="planet-label__spec">{s.spec}</div>
            </div>
          )
        })}
      </div>
    </>
  )
}
