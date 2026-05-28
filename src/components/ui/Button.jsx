import React from 'react'

/**
 * Button — système 3 variants × 3 tailles
 *
 * Props:
 *   - variant: 'primary' (ember bg, white text) | 'secondary' (outline ink) | 'ghost' (transparent)
 *   - size:    'sm' | 'md' | 'lg'
 *   - iconRight: ReactNode (rendu après le label)
 *   - as: 'button' | 'a' — si 'a', utilise href
 *   - onSurface: 'light' | 'dark' — adapte secondary/ghost selon le fond
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  iconRight,
  onClick,
  type = 'button',
  href,
  as,
  onSurface = 'light',
  className = '',
  style = {},
  disabled = false,
  ...rest
}) {
  const Tag = as || (href ? 'a' : 'button')
  const cls = `btn btn--${variant} btn--${size} btn--surface-${onSurface} ${className}`.trim()

  const props = {
    className: cls,
    onClick,
    style,
    'aria-disabled': disabled || undefined,
    ...(Tag === 'a' ? { href } : { type, disabled }),
    ...rest,
  }

  return (
    <>
      <style>{`
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-family: var(--font-body);
          font-weight: 500;
          letter-spacing: -0.01em;
          border-radius: var(--radius-sm);
          border: 1px solid transparent;
          cursor: pointer;
          white-space: nowrap;
          transition:
            background-color 200ms var(--ease-out),
            color 200ms var(--ease-out),
            border-color 200ms var(--ease-out),
            transform 200ms var(--ease-out),
            box-shadow 250ms var(--ease-out);
          will-change: transform;
        }
        .btn:disabled, .btn[aria-disabled="true"] { opacity: 0.45; cursor: not-allowed; }
        .btn .btn__icon { display: inline-flex; align-items: center; transition: transform 250ms var(--ease-out); }
        .btn:hover .btn__icon { transform: translateX(3px); }

        /* Tailles */
        .btn--sm { padding: 8px 16px;  font-size: 13px; line-height: 1; }
        .btn--md { padding: 12px 24px; font-size: 14px; line-height: 1; }
        .btn--lg { padding: 16px 32px; font-size: 15px; line-height: 1; }

        /* Variants */
        .btn--primary {
          background: var(--ember);
          color: var(--white);
        }
        .btn--primary:hover:not(:disabled):not([aria-disabled="true"]) {
          transform: scale(1.02);
          box-shadow: 0 8px 24px rgba(255, 91, 31, 0.25);
        }
        .btn--primary:active { transform: scale(0.99); }

        .btn--secondary.btn--surface-light {
          background: transparent;
          color: var(--ink);
          border-color: var(--ink);
        }
        .btn--secondary.btn--surface-light:hover {
          background: var(--ink);
          color: var(--white);
        }
        .btn--secondary.btn--surface-dark {
          background: transparent;
          color: var(--white);
          border-color: rgba(250, 250, 248, 0.45);
        }
        .btn--secondary.btn--surface-dark:hover {
          border-color: var(--white);
          background: rgba(250, 250, 248, 0.04);
        }

        .btn--ghost.btn--surface-light {
          background: transparent;
          color: var(--ink);
        }
        .btn--ghost.btn--surface-light:hover { color: var(--ember); }
        .btn--ghost.btn--surface-dark {
          background: transparent;
          color: var(--on-ink-70);
        }
        .btn--ghost.btn--surface-dark:hover { color: var(--white); }
      `}</style>
      <Tag {...props}>
        <span>{children}</span>
        {iconRight && <span className="btn__icon" aria-hidden>{iconRight}</span>}
      </Tag>
    </>
  )
}
