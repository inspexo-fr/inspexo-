import React from 'react'

/**
 * Container — wrapper avec max-width 1440px et padding horizontal responsive.
 *
 * Props:
 *   - as: tag HTML (default 'div')
 *   - wide: bool — passe à 1600px pour les sections qui demandent plus d'air
 *   - className, style, children
 */
export default function Container({
  as: Tag = 'div',
  wide = false,
  className = '',
  style = {},
  children,
  ...rest
}) {
  return (
    <Tag
      className={className}
      style={{
        width: '100%',
        maxWidth: wide ? 1600 : 1440,
        marginLeft: 'auto',
        marginRight: 'auto',
        paddingLeft: 'clamp(20px, 4vw, 64px)',
        paddingRight: 'clamp(20px, 4vw, 64px)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
