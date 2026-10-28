import React, { useRef } from 'react'
import { Link } from 'react-router-dom'
import Seal from './Seal'

// Barre de navigation de la maquette sprint 5 : marque + cachet IX, liens,
// CTA Analyser (seul élément orange de la barre), menu mobile en <details>.
const LIENS = [
  { href: '/score', label: 'Analyser une annonce' },
  { href: '/#dossier', label: 'Un dossier réel' },
  { href: '/pass', label: 'Pass achat' },
  { href: '/extension', label: 'Extension et appli' },
  { href: '/#faq', label: 'Questions' },
]

function LienNav({ href, label, onClick }) {
  // Les ancres de l'accueil passent par une URL complète pour fonctionner
  // depuis les sous-pages ; les routes passent par le routeur.
  if (href.startsWith('/#')) {
    return <a href={href} onClick={onClick}>{label}</a>
  }
  return <Link to={href} onClick={onClick}>{label}</Link>
}

export default function Navbar() {
  const menuRef = useRef(null)
  const fermerMenu = () => { menuRef.current?.removeAttribute('open') }

  return (
    <header className="nav">
      <div className="wrap">
        <Link className="brand" to="/" aria-label="Inspexo, accueil">
          <Seal />
          <span>Inspexo</span>
        </Link>
        <nav className="navlinks" aria-label="Principal">
          {LIENS.map(l => <LienNav key={l.href} {...l} />)}
        </nav>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link className="nav-cta" to="/score">Analyser</Link>
          <details className="menu" ref={menuRef}>
            <summary aria-label="Ouvrir le menu">MENU</summary>
            <nav aria-label="Principal, mobile">
              {LIENS.map(l => <LienNav key={l.href} {...l} onClick={fermerMenu} />)}
              <LienNav href="/dossier" label="Mon dossier d'achat" onClick={fermerMenu} />
            </nav>
          </details>
        </div>
      </div>
    </header>
  )
}
