import React from 'react'
import { HERO_TIMELINE } from './heroData'

function smoothstep(a, b, t) {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

export default function HeroCurtain({ progress }) {
  const appear = smoothstep(HERO_TIMELINE.curtainAppear.start, HERO_TIMELINE.curtainAppear.end, progress)
  const open   = smoothstep(HERO_TIMELINE.curtainOpen.start,   HERO_TIMELINE.curtainOpen.end,   progress)
  const height = appear * (1 - open) * 100
  const opacity = appear > 0 && open < 1 ? 1 : 0
  let badgeText = 'FERMÉ'
  if (open > 0.05 && open < 0.85) badgeText = 'OUVERTURE'
  else if (open >= 0.85) badgeText = 'OUVERT'

  return (
    <>
      <style>{`
        .hero-curtain {
          position: absolute;
          top: 0; left: 0; right: 0;
          background: linear-gradient(180deg, #1A1A1D 0%, #0F0F12 100%);
          box-shadow: 0 6px 30px rgba(0, 0, 0, 0.6);
          border-bottom: 1px solid rgba(255, 91, 31, 0.2);
          z-index: 3;
          transition: opacity 200ms ease;
          overflow: hidden;
          pointer-events: none;
        }
        .hero-curtain__slats {
          position: absolute; inset: 0;
          background-image: repeating-linear-gradient(180deg,
            transparent 0, transparent 19px,
            rgba(0,0,0,0.55) 19px, rgba(0,0,0,0.55) 20px,
            rgba(255,255,255,0.05) 20px, rgba(255,255,255,0.05) 21px);
        }
        .hero-curtain__rivets {
          position: absolute; top: 0; bottom: 0;
          width: 14px;
          background-image: repeating-linear-gradient(180deg,
            transparent 0, transparent 50px,
            rgba(0,0,0,0.7) 50px, rgba(0,0,0,0.7) 56px);
        }
        .hero-curtain__rivets--left  { left: 0;  border-right: 1px solid rgba(0,0,0,0.5); }
        .hero-curtain__rivets--right { right: 0; border-left:  1px solid rgba(0,0,0,0.5); }
        .hero-curtain__label {
          position: absolute; top: 18px; left: 50%;
          transform: translateX(-50%);
          font-family: 'Geist Mono', 'JetBrains Mono', monospace;
          font-size: 9px; letter-spacing: 0.3em;
          color: rgba(250, 250, 248, 0.45);
          text-transform: uppercase;
          white-space: nowrap;
        }
        .hero-curtain__badge {
          position: absolute; left: 50%; top: 50%;
          transform: translate(-50%, -50%);
          font-family: 'Geist Mono', 'JetBrains Mono', monospace;
          font-size: 11px; letter-spacing: 0.25em;
          color: #FF5B1F;
          border: 1px solid #FF5B1F;
          padding: 7px 14px; border-radius: 3px;
          background: rgba(255, 91, 31, 0.05);
        }
      `}</style>
      <div className="hero-curtain" style={{ height: `${height}vh`, opacity }} aria-hidden="true">
        <div className="hero-curtain__slats" />
        <div className="hero-curtain__rivets hero-curtain__rivets--left" />
        <div className="hero-curtain__rivets hero-curtain__rivets--right" />
        <div className="hero-curtain__label">INSPEXO ATELIER · TLS</div>
        <div className="hero-curtain__badge">{badgeText}</div>
      </div>
    </>
  )
}
