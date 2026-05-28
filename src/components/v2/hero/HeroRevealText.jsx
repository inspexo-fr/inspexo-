import React, { useMemo } from 'react'
import { HERO_TEXT, HERO_TIMELINE } from './heroData'

function smoothstep(a, b, t) {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

export default function HeroRevealText({ progress }) {
  const reveal = smoothstep(HERO_TIMELINE.textReveal.start, HERO_TIMELINE.textReveal.end, progress)
  const fade = smoothstep(HERO_TIMELINE.textFadeOut.start, HERO_TIMELINE.textFadeOut.end, progress)
  const opacity = reveal * (1 - fade)

  const allLetters = useMemo(() => {
    const l1 = HERO_TEXT.line1.split('').map((ch) => ({ ch, line: 1 }))
    const l2 = HERO_TEXT.line2.split('').map((ch) => ({ ch, line: 2 }))
    return [...l1, ...l2]
  }, [])

  const totalLetters = allLetters.length
  const lettersToShow = Math.floor(reveal * totalLetters)

  const l1Items = []
  const l2Items = []
  allLetters.forEach((item, i) => {
    const show = i < lettersToShow
    const isActive = i === lettersToShow - 1 && reveal > 0 && reveal < 1
    const el = item.ch === ' ' ? (
      <span key={i}>{' '}</span>
    ) : (
      <span
        key={i}
        className={`letter ${show ? 'show' : ''} ${isActive ? 'tire-active' : ''}`}
      >
        {item.ch}
      </span>
    )
    if (item.line === 1) l1Items.push(el)
    else l2Items.push(el)
  })

  return (
    <>
      <style>{`
        .reveal-text {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          text-align: center; width: 90%; max-width: 780px;
          z-index: 5; pointer-events: none;
          transition: opacity 200ms ease;
        }
        .reveal-text__line {
          font-family: 'Geist', system-ui, sans-serif; font-weight: 500;
          font-size: clamp(24px, 3.4vw, 46px);
          line-height: 1.15; letter-spacing: -0.025em;
          color: #FAFAF8; margin-bottom: 8px;
        }
        .reveal-text__line--l2 {
          font-weight: 400;
          font-size: clamp(20px, 2.8vw, 38px);
          color: rgba(250, 250, 248, 0.85);
        }
        .letter {
          display: inline-block; position: relative;
          opacity: 0; transition: opacity 200ms ease;
        }
        .letter.show { opacity: 1; }
        .letter::before {
          content: ''; position: absolute;
          left: -20px; top: 50%;
          width: 18px; height: 7px;
          transform: translateY(-50%);
          background-image: linear-gradient(90deg,
            transparent 0%, rgba(255,91,31,0.4) 30%,
            #FF5B1F 50%, rgba(255,91,31,0.4) 70%, transparent 100%);
          opacity: 0;
        }
        .letter.tire-active::before {
          opacity: 1;
          animation: tire-pass 380ms ease-out;
        }
        @keyframes tire-pass {
          0%   { transform: translate(-15px, -50%); opacity: 0; }
          30%  { opacity: 1; }
          80%  { opacity: 0.6; }
          100% { transform: translate(20px, -50%); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .letter.tire-active::before { animation: none; opacity: 0; }
        }
      `}</style>
      <div className="reveal-text" style={{ opacity }} aria-hidden="true">
        <div className="reveal-text__line">{l1Items}</div>
        <div className="reveal-text__line reveal-text__line--l2">{l2Items}</div>
      </div>
    </>
  )
}
