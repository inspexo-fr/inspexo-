import React from 'react'
import { missionTicker } from '../../data/missionTicker'

/* ────────────────────────────────────────────────────────────
   TRUST TICKER — Section 03
   Bandeau pleine largeur — fond paper, hauteur 80px.
   Marquee CSS pur (perf, pas Framer) — 60s linear infinite.
   Hover sur le bandeau = pause de l'animation.
   ──────────────────────────────────────────────────────────── */

const STATUS_ICON = {
  VALIDÉE:           '✓',
  'EN COURS':        '◐',
  'RAPPORT ENVOYÉ':  '→',
}

function MissionItem({ m }) {
  return (
    <span className="ticker__item">
      <span className="ticker__time">[{m.time}]</span>
      <span className="ticker__sep">·</span>
      <span className="ticker__action">{m.action}</span>
      <span className="ticker__sep">·</span>
      <span className="ticker__brand">
        {m.brand} <span className="ticker__model">{m.model}</span>
      </span>
      <span className="ticker__sep">·</span>
      <span className="ticker__city">{m.city}</span>
      <span className="ticker__sep">·</span>
      <span className="ticker__status">
        <span className="ticker__status-icon" aria-hidden>{STATUS_ICON[m.status] || '·'}</span>
        {m.status}
      </span>
    </span>
  )
}

export default function TrustTicker() {
  // Dupliqué 2× pour un loop sans coupure
  const items = [...missionTicker, ...missionTicker]

  return (
    <>
      <style>{`
        .ticker {
          position: relative;
          width: 100%;
          height: 80px;
          background: var(--paper);
          border-top: 1px solid var(--mist);
          border-bottom: 1px solid var(--mist);
          overflow: hidden;
          display: flex;
          align-items: center;
        }

        /* Fade des extrémités pour adoucir l'entrée/sortie */
        .ticker::before,
        .ticker::after {
          content: '';
          position: absolute;
          top: 0; bottom: 0;
          width: 120px;
          z-index: 2;
          pointer-events: none;
        }
        .ticker::before {
          left: 0;
          background: linear-gradient(90deg, var(--paper) 0%, rgba(245, 243, 238, 0) 100%);
        }
        .ticker::after {
          right: 0;
          background: linear-gradient(270deg, var(--paper) 0%, rgba(245, 243, 238, 0) 100%);
        }

        .ticker__track {
          display: flex;
          align-items: center;
          gap: 56px;
          width: max-content;
          padding-left: 56px;
          animation: ticker-scroll 60s linear infinite;
          will-change: transform;
        }
        .ticker:hover .ticker__track,
        .ticker__track:focus-within {
          animation-play-state: paused;
        }
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ticker__track { animation: none; }
        }

        .ticker__item {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.04em;
          color: var(--ink);
          white-space: nowrap;
          font-feature-settings: "tnum" 1;
        }
        .ticker__sep {
          color: var(--ember);
          font-weight: 700;
          font-size: 14px;
          line-height: 1;
        }
        .ticker__time {
          color: var(--steel);
          font-size: 12px;
        }
        .ticker__action {
          color: var(--ember);
          font-weight: 600;
        }
        .ticker__brand {
          color: var(--ink);
          font-weight: 600;
        }
        .ticker__model {
          color: var(--steel);
          font-weight: 500;
          margin-left: 4px;
        }
        .ticker__city {
          color: var(--ink);
          font-weight: 500;
        }
        .ticker__status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--ink);
          font-weight: 500;
        }
        .ticker__status-icon {
          color: var(--signal);
          font-size: 14px;
          line-height: 1;
        }
      `}</style>

      <section id="trust-ticker" className="ticker" aria-label="Missions récentes" role="region">
        <div className="ticker__track" aria-hidden="true">
          {items.map((m, i) => (
            <MissionItem key={`${m.time}-${i}`} m={m} />
          ))}
        </div>
      </section>
    </>
  )
}
