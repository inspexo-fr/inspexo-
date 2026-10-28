import React from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main>
        <section className="sec" style={{ borderTop: 'none', minHeight: '60vh' }}>
          <div className="wrap-doc" style={{ textAlign: 'center' }}>
            <p className="mono c-graphite" style={{ fontSize: 'clamp(64px,18vw,120px)', fontWeight: 600, lineHeight: 1, letterSpacing: '-0.04em' }} aria-hidden="true">
              404
            </p>
            <h1 style={{ fontSize: 'clamp(26px,4vw,34px)', marginTop: 18 }}>Page introuvable</h1>
            <p className="c-ink2" style={{ margin: '12px auto 32px', maxWidth: '26em', lineHeight: 1.6 }}>
              La page que vous cherchez n'existe pas ou a été déplacée.
            </p>
            <Link to="/" className="btn" style={{ width: 'auto', display: 'inline-flex' }}>
              Retour à l'accueil
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
