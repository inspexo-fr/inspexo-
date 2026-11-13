import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { listeModelesPublies } from '../lib/scoreApi'
import { declarerPrerendu, lirePrerendu } from '../lib/prerendu'
import FilAriane from '../components/FilAriane'

// SPRINT 23, LOT 3 — Index des pages modèle publiées (au moins 3 pannes
// confirmées par une source indépendante). La liste vient du serveur.
export default function ModelesIndexPage() {
  const [pages, setPages] = useState(() => lirePrerendu('modeles'))
  useEffect(() => {
    if (lirePrerendu('modeles') !== undefined) return
    listeModelesPublies().then((l) => { setPages(l); declarerPrerendu('modeles', l) }).catch(() => setPages([]))
  }, [])
  const parMarque = {}
  for (const p of pages || []) (parMarque[p.marque] = parMarque[p.marque] || []).push(p)
  return (
    <>
      <Helmet>
        <title>Pannes connues par modèle — Inspexo</title>
        <meta name="description" content="Les pannes connues des voitures d'occasion, modèle par modèle, uniquement quand une source indépendante les confirme." />
        <link rel="canonical" href="https://www.inspexo.io/modele" />
      </Helmet>
      <FilAriane items={[{ nom: 'Pannes par modèle', url: '/modele' }]} />
      <Navbar />
      <main>
        <section className="sec" style={{ borderTop: 'none' }}>
          <div className="wrap">
            <div className="sec-head">
              <h1 style={{ fontSize: 'clamp(30px,3.6vw,46px)' }}>Pannes connues, modèle par modèle.</h1>
              <p>Une page n'est publiée que si au moins trois pannes y sont confirmées par une source indépendante (constructeur, rappel, presse). Voir aussi <Link to="/moteur">les pages par moteur</Link>.</p>
            </div>
            {pages === undefined ? <p className="eyebrow" aria-busy="true">Chargement…</p> : (
              <div id="modeles">
                {Object.keys(parMarque).sort().map((m) => (
                  <div key={m} style={{ marginTop: 18 }}>
                    <h2 style={{ fontSize: 22 }}>{m}</h2>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 15, lineHeight: 1.9 }}>
                      {parMarque[m].map((p) => (
                        <li key={p.slug}><Link to={`/modele/${p.slug_marque}/${p.slug}`}>{[p.marque, p.modele, p.generation].filter(Boolean).join(' ')}</Link> <span className="c-graphite">— {p.n_pannes} pannes confirmées</span></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
