import React from 'react'
import { HERO_TIMELINE } from './heroData'

function smoothstep(a, b, t) {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

export default function HeroText({ progress, onPrimaryCta, onSecondaryCta }) {
  const fadeOut = smoothstep(HERO_TIMELINE.heroFadeOut.start, HERO_TIMELINE.heroFadeOut.end, progress)
  const opacity = 1 - fadeOut
  const pointerEvents = opacity > 0.5 ? 'auto' : 'none'

  return (
    <>
      <style>{`
        .hero-text {
          position: absolute; inset: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center; padding: 0 24px;
          z-index: 4;
          transition: opacity 200ms ease;
        }
        .hero-text__eyebrow {
          font-family: 'Geist Mono', 'JetBrains Mono', monospace;
          font-size: 10px; letter-spacing: 0.24em;
          color: #FF5B1F; text-transform: uppercase;
          margin-bottom: 22px; font-weight: 500;
        }
        .hero-text__title {
          font-family: 'Geist', system-ui, sans-serif; font-weight: 500;
          font-size: clamp(28px, 4.5vw, 64px);
          line-height: 0.98; letter-spacing: -0.025em;
          margin: 0 0 22px; max-width: 700px; color: #FAFAF8;
        }
        .hero-text__title .ember { color: #FF5B1F; }
        .hero-text__sub {
          font-size: 15px; line-height: 1.5;
          color: rgba(250, 250, 248, 0.55);
          margin: 0 0 28px; max-width: 480px;
        }
        .hero-text__cta {
          display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;
        }
        .hero-btn {
          font-family: inherit; font-size: 14px; font-weight: 500;
          padding: 13px 22px; border-radius: 999px;
          border: none; cursor: pointer;
          transition: transform 180ms ease, background 180ms ease, color 180ms ease, border-color 180ms ease;
        }
        .hero-btn--primary {
          background: #FAFAF8; color: #0A0A0B;
        }
        .hero-btn--primary:hover {
          background: #FF5B1F; color: #FAFAF8;
          transform: translateY(-1px);
        }
        .hero-btn--secondary {
          background: transparent; color: #FAFAF8;
          border: 1px solid rgba(250, 250, 248, 0.25);
        }
        .hero-btn--secondary:hover {
          border-color: rgba(250, 250, 248, 0.55);
          transform: translateY(-1px);
        }
        .hero-text__hint {
          position: absolute; bottom: 30px; left: 50%;
          transform: translateX(-50%);
          font-family: 'Geist Mono', 'JetBrains Mono', monospace;
          font-size: 10px; letter-spacing: 0.2em;
          color: rgba(250, 250, 248, 0.5);
          text-transform: uppercase;
          animation: hint-bob 2s ease-in-out infinite;
        }
        @keyframes hint-bob {
          0%, 100% { transform: translate(-50%, 0); }
          50%      { transform: translate(-50%, 4px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-text__hint { animation: none; }
        }
      `}</style>
      <div className="hero-text" style={{ opacity, pointerEvents }}>
        <div className="hero-text__eyebrow">Expertise automobile × intelligence artificielle</div>
        <h1 className="hero-text__title">
          Vérifiez avant. <span className="ember">Pas</span> après.
        </h1>
        <p className="hero-text__sub">
          Notre IA croise les défauts connus de chaque marque avec votre véhicule. En 4 minutes.
        </p>
        <div className="hero-text__cta">
          <button type="button" className="hero-btn hero-btn--primary" onClick={onPrimaryCta}>
            Analyser un véhicule
          </button>
          <button type="button" className="hero-btn hero-btn--secondary" onClick={onSecondaryCta}>
            Voir les paliers
          </button>
        </div>
        <div className="hero-text__hint">Scrollez ↓</div>
      </div>
    </>
  )
}
