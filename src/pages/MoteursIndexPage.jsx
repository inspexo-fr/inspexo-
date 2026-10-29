import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { listMoteursPublies } from '../lib/scoreApi'
import { FAMILLES_MOTEUR } from '../data/famillesMoteur'
import { declarerPrerendu, lirePrerendu } from '../lib/prerendu'

// /moteur — index des familles dont la fiche atteint le seuil de publication.
// La liste vient de la base (list_moteurs_publies), jamais d'une liste en dur :
// une fiche qui tombe sous le seuil disparaît d'elle-même de l'index.

const cle = (m, f) => `${String(m).toLowerCase()}|${String(f).toUpperCase().replace(/[^A-Z0-9]/g, '')}`

export default function MoteursIndexPage() {
  // La liste est figée dans le HTML pré-rendu : sans cela React effaçait les
  // 42 familles affichées et attendait sa propre requête pour les remettre,
  // soit un décalage de mise en page de 0,509 à la charge de l'utilisateur.
  const [publiees, setPubliees] = useState(() => lirePrerendu('moteurs:index'))

  useEffect(() => {
    window.scrollTo(0, 0)
    if (lirePrerendu('moteurs:index') !== undefined) return
    let cancelled = false
    listMoteursPublies()
      .then((d) => {
        if (cancelled) return
        setPubliees(d)
        declarerPrerendu('moteurs:index', d)
      })
      .catch(() => { if (!cancelled) setPubliees([]) })
    return () => { cancelled = true }
  }, [])

  const dispo = new Set((publiees ?? []).map((d) => cle(d.marque, d.famille_moteur)))
  const pannesPar = new Map((publiees ?? []).map((d) => [cle(d.marque, d.famille_moteur), d.pannes]))
  const familles = FAMILLES_MOTEUR.filter((f) => dispo.has(cle(f.marque, f.famille)))
  const parMarque = familles.reduce((acc, f) => {
    (acc[f.marque] ||= []).push(f)
    return acc
  }, {})

  return (
    <>
      <Helmet>
        <title>Pannes connues par moteur : les familles que nous couvrons | Inspexo</title>
        <meta name="description" content="Pour chaque famille moteur couverte : les pannes documentées avec leurs sources, le plan d'entretien, les programmes de prise en charge constructeur et les questions à poser au vendeur." />
        <link rel="canonical" href="https://www.inspexo.io/moteur" />
        <meta property="og:title" content="Pannes connues par moteur — Inspexo" />
        <meta property="og:url" content="https://www.inspexo.io/moteur" />
        <meta property="og:image" content="https://www.inspexo.io/og-image.png" />
      </Helmet>

      <Navbar />

      <main>
        <section className="sec" style={{ borderTop: 'none' }}>
          <div className="wrap">
            <div className="sec-head">
              <h1 style={{ fontSize: 'clamp(30px,3.6vw,46px)' }}>Les moteurs que nous couvrons.</h1>
              <p>
                Une fiche par famille moteur, construite à partir de sources nommées. Une page n'est
                publiée qu'à partir de trois pannes documentées, chacune rattachée à un document
                consultable — ce qui n'est pas prouvé n'apparaît pas.
              </p>
            </div>

            {publiees === undefined ? (
              <p className="eyebrow" aria-busy="true">Lecture des fiches publiées…</p>
            ) : familles.length === 0 ? (
              <p className="lead">Aucune fiche n'atteint encore le seuil de publication.</p>
            ) : (
              <dl className="rows">
                {Object.entries(parMarque).sort((a, b) => a[0].localeCompare(b[0], 'fr')).map(([marque, liste]) => (
                  <div className="row" key={marque}>
                    <dt>{marque}</dt>
                    <dd>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {liste.map((f) => (
                          <Link key={f.slug} to={`/moteur/${f.slug}`} style={{ textDecoration: 'none' }}>
                            <span className="tag" style={{ cursor: 'pointer' }}>
                              {f.nom_commercial}
                              <span className="c-graphite"> · {pannesPar.get(cle(f.marque, f.famille))} pannes</span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </section>

        <section className="band">
          <div className="wrap">
            <p className="eyebrow">Votre annonce</p>
            <h2>Ces pages parlent des moteurs. L'analyse parle de la voiture.</h2>
            <p className="lead">
              Collez le texte d'une annonce : les pannes de sa famille moteur sont rapportées à son
              kilométrage, avec les rappels constructeur, les airbags Takata et le statut du vendeur.
            </p>
            <p style={{ marginTop: 28 }}><Link to="/score">Analyser une annonce</Link></p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
