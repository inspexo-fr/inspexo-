import React, { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { getModelePublic } from '../lib/scoreApi'
import { slugifier } from '../data/famillesMoteur'
import { libelleSource } from '../components/DossierApercu'
import { declarerPrerendu, lirePrerendu } from '../lib/prerendu'
import FilAriane from '../components/FilAriane'

// SPRINT 23, LOT 3 (point 5) — /modele/<marque>/<modele>-<generation>.
// Agrège les fiches des familles moteur montées sur ce modèle. UNIQUEMENT les
// pannes portées par une source indépendante (même classement que le score)
// et les prises en charge DATÉES. Chaque panne renvoie à la page /moteur de
// sa famille, qui reste la page de référence : rien n'est recopié ici au-delà
// du titre.

const GRAVITE = {
  securite: { label: 'Danger pour les occupants', classe: 'rouge' },
  casse: { label: 'Casse moteur ou boîte', classe: 'rouge' },
  majeure: { label: 'Réparation majeure', classe: 'ambre' },
  mineure: { label: 'Désagrément', classe: 'muted' },
}
const jour = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : null)

export default function ModelePage() {
  const { marque, modele } = useParams()
  const cle = `modele:${marque}/${modele}`
  const [charge, setCharge] = useState(() => lirePrerendu(cle))

  useEffect(() => {
    window.scrollTo(0, 0)
    if (lirePrerendu(cle) !== undefined) return
    let annule = false
    getModelePublic(marque, modele)
      .then((d) => { if (!annule) { const c = { page: d || null }; setCharge(c); declarerPrerendu(cle, c) } })
      .catch(() => { if (!annule) setCharge({ page: null }) })
    return () => { annule = true }
  }, [cle]) // eslint-disable-line react-hooks/exhaustive-deps

  if (charge === undefined) {
    return (<><Navbar /><main><section className="sec" style={{ borderTop: 'none' }}><div className="wrap"><p className="eyebrow" aria-busy="true">Chargement…</p></div></section></main><Footer /></>)
  }
  const p = charge?.page
  if (!p) return <Navigate to="/modele" replace />

  const nom = [p.marque, p.modele, p.generation].filter(Boolean).join(' ')
  const titre = `${nom} d'occasion : les pannes connues, source par source`
  const url = `https://www.inspexo.io/modele/${p.slug_marque}/${p.slug}`
  const prises = p.sections.flatMap((s) => s.prises.map((x) => ({ ...x, famille: s })))

  return (
    <>
      <Helmet>
        <title>{`${nom} d'occasion : pannes connues et sources — Inspexo`}</title>
        <meta name="description" content={`${p.n_pannes} pannes du ${nom} confirmées par une source indépendante (constructeur, rappel, presse), moteur par moteur, avec les prises en charge datées.`} />
        <link rel="canonical" href={url} />
        {/* Sous le seuil d'indexation (sprint 24) : accessible, non indexée. */}
        {p.indexable === false && <meta name="robots" content="noindex, follow" />}
      </Helmet>
      <FilAriane items={[{ nom: 'Pannes par modèle', url: '/modele' }, { nom, url: `/modele/${p.slug_marque}/${p.slug}` }]} />
      <Navbar />
      <main>
        <section className="sec" style={{ borderTop: 'none', paddingBottom: 'clamp(28px,4vw,48px)' }}>
          <div className="wrap">
            <div className="sec-head">
              <h1 style={{ fontSize: 'clamp(30px,3.6vw,46px)' }}>{titre}</h1>
              <p>
                {p.n_pannes} panne{p.n_pannes > 1 ? 's' : ''} confirmée{p.n_pannes > 1 ? 's' : ''} par une source
                indépendante (constructeur, rappel, presse), réparties sur {p.sections.length} moteur{p.sections.length > 1 ? 's' : ''}.
                Les signalements que seuls des garages ou des forums rapportent ne figurent pas ici : ce sont des questions à poser au vendeur.
              </p>
              {/* Hauteur réservée (2 lignes) : sans elle, le passage de la police de
                  repli à la police finale fait sauter le contenu dessous (CLS). */}
              <p className="c-graphite" style={{ fontSize: 14, lineHeight: 1.6, marginTop: 8, minHeight: '3.2em' }}>
                {p.maj ? `Mis à jour le ${jour(p.maj)}` : 'Date de mise à jour non disponible'} · {p.n_sources ?? 0} source{(p.n_sources ?? 0) > 1 ? 's' : ''} citée{(p.n_sources ?? 0) > 1 ? 's' : ''} · <Link to="/methode">notre méthode</Link> · <Link to="/fiabilite">mesure de fiabilité</Link>
              </p>
            </div>
          </div>
        </section>

        <section className="sec" id="pannes">
          <div className="wrap">
            <div className="sec-head">
              <h2>Moteur par moteur.</h2>
              <p>Un {p.modele} n'a pas les pannes d'un autre moteur : vérifiez d'abord lequel équipe la voiture (carte grise, rubrique P.5, ou annonce).</p>
            </div>
            {p.sections.map((s) => {
              const lienMoteur = s.page_moteur_publiee ? `/moteur/${slugifier(s.marque, s.nom_commercial)}` : null
              return (
                <div key={s.famille} style={{ marginTop: 26 }}>
                  <h3 style={{ fontSize: 21 }}>
                    {s.nom_commercial} <span className="c-graphite" style={{ fontWeight: 400 }}>— {s.marque} {s.famille}{s.annees ? `, ${s.annees}` : ''}</span>
                  </h3>
                  {s.pannes.length > 0 && (
                    <dl className="rows">
                      {s.pannes.map((x, i) => {
                        const g = GRAVITE[x.gravite] ?? GRAVITE.mineure
                        return (
                          <div className="row" key={i}>
                            <dt><span className="num-titre">{String(i + 1).padStart(2, '0')}</span></dt>
                            <dd>
                              <b>{x.titre}</b>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                                <span className={`tag ${g.classe}`}>{g.label}</span>
                              </div>
                              <p className="c-graphite" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 6 }}>
                                Source{x.sources.length > 1 ? 's' : ''} :{' '}
                                {x.sources.map((u, k) => (
                                  <React.Fragment key={u}>{k > 0 ? ' · ' : ''}<a href={u} target="_blank" rel="noreferrer">{libelleSource(u)}</a></React.Fragment>
                                ))}
                              </p>
                            </dd>
                          </div>
                        )
                      })}
                    </dl>
                  )}
                  <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 8 }}>
                    {s.pannes_non_portees > 0 && <>{s.pannes_non_portees} autre{s.pannes_non_portees > 1 ? 's' : ''} signalement{s.pannes_non_portees > 1 ? 's' : ''} sans source indépendante. </>}
                    {s.pannes_autre_version > 0 && <>{s.pannes_autre_version} défaut{s.pannes_autre_version > 1 ? 's' : ''} d'une autre version de ce moteur (cylindrée ou puissance) non repris ici. </>}
                    {lienMoteur
                      ? <Link to={lienMoteur}>Symptômes, kilométrages et coûts sur la page du {s.nom_commercial}</Link>
                      : 'La fiche complète de ce moteur n\'est pas encore publiée.'}
                    {s.maj ? <span className="c-graphite"> · fiche vérifiée le {jour(s.maj)}</span> : null}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        {prises.length > 0 && (
          <section className="sec" id="prises-en-charge">
            <div className="wrap">
              <div className="sec-head">
                <h2>Prises en charge datées.</h2>
                <p>Garanties étendues, campagnes et rappels publiés pour ces moteurs, avec leur période. Seul le numéro de série (VIN) dit si un véhicule précis est concerné.</p>
              </div>
              <dl className="rows">
                {prises.map((x, i) => (
                  <div className="row" key={i}>
                    <dt><span className="num-titre">{x.famille.famille}</span></dt>
                    <dd>
                      <b>{x.texte}</b>
                      <p>Période : {x.periode}. {x.mention}</p>
                      {x.urls.length > 0 && (
                        <p className="c-graphite" style={{ fontSize: 13, marginTop: 4 }}>
                          {x.urls.map((u, k) => <React.Fragment key={u}>{k > 0 ? ' · ' : 'Source : '}<a href={u} target="_blank" rel="noreferrer">{libelleSource(u)}</a></React.Fragment>)}
                        </p>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        )}

        <section className="sec">
          <div className="wrap">
            <p style={{ fontSize: 15, lineHeight: 1.7 }}>
              Vous regardez une annonce de {nom} ? <Link to="/score">Analysez-la</Link> : le dossier ne retient que les
              pannes du moteur de CETTE voiture, et les rappels qui la concernent.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
