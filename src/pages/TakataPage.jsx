import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import takata from '../data/takataModels.json'

// /airbags-takata — liste officielle du ministère, telle quelle. Rien n'est
// ajouté ni interprété : les modèles, les périodes et la date de la liste
// viennent du fichier source (src/data/takataModels.json), lui-même copié de
// la page du ministère citée en bas de page.

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

function dateListe() {
  const iso = takata._updated || ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

/** Recherche sur la même donnée que l'analyse : marque + modèle, sans année. */
function chercher(requete) {
  const q = norm(requete)
  if (q.length < 2) return null
  const resultats = []
  for (const [marque, entrees] of Object.entries(takata.marques || {})) {
    const marqueN = norm(marque)
    for (const e of entrees) {
      const nomN = norm(e.nom)
      // Le texte saisi contient la marque et/ou le modèle, ou l'inverse.
      const toucheMarque = q.includes(marqueN) || marqueN.includes(q)
      const toucheModele = q.includes(nomN) || nomN.includes(q) ||
        nomN.split(/[^a-z0-9]+/).filter((w) => w.length >= 2).some((w) => q.includes(w))
      if ((toucheMarque && toucheModele) || (toucheModele && nomN.length >= 3)) {
        resultats.push({ marque, ...e })
      }
    }
  }
  return resultats
}

export default function TakataPage() {
  const [requete, setRequete] = useState('')
  const resultats = useMemo(() => chercher(requete), [requete])
  const marques = Object.entries(takata.marques || {}).sort((a, b) => a[0].localeCompare(b[0], 'fr'))
  const total = marques.reduce((n, [, v]) => n + v.length, 0)
  const maj = dateListe()

  const faq = [
    {
      q: 'Comment savoir si ma voiture est concernée par le rappel Takata ?',
      r: `La liste officielle du ministère de la Transition écologique recense les modèles équipés d'airbags Takata au nitrate d'ammonium. Cette page en reprend l'intégralité (liste du ${maj}). Un modèle listé ne signifie pas que votre exemplaire précis est concerné : seul le numéro de série (VIN) permet de trancher, auprès du constructeur.`,
    },
    {
      q: 'Que faire si mon modèle figure sur la liste ?',
      r: 'Communiquez votre numéro de série (VIN) au constructeur ou à un concessionnaire de la marque : ils vérifient si votre véhicule fait partie de la campagne et si l\'airbag a déjà été remplacé. Le remplacement est gratuit. Certains véhicules font l\'objet d\'une consigne « stop drive » : ne plus rouler jusqu\'au remplacement.',
    },
    {
      q: 'Pourquoi ces airbags sont-ils dangereux ?',
      r: 'Le gaz propulseur au nitrate d\'ammonium peut se dégrader avec le temps, la chaleur et l\'humidité. Au déclenchement, le générateur peut alors se rompre et projeter des éclats métalliques dans l\'habitacle.',
    },
    {
      q: 'Et si ma voiture n\'est pas sur la liste ?',
      r: 'Le modèle n\'est pas visé par la campagne telle que publiée à la date de cette liste. La liste officielle évolue : vérifiez la page du ministère, et faites confirmer par le VIN en cas de doute.',
    },
  ]

  return (
    <>
      <Helmet>
        <title>Airbags Takata : la liste officielle des modèles concernés | Inspexo</title>
        <meta name="description" content={`Liste officielle du ministère de la Transition écologique des modèles équipés d'airbags Takata : ${total} modèles sur ${marques.length} marques (liste du ${maj}). Vérifiez si votre voiture est concernée avant de l'acheter.`} />
        <link rel="canonical" href="https://www.inspexo.io/airbags-takata" />
        <meta property="og:title" content="Airbags Takata : la liste officielle des modèles concernés" />
        <meta property="og:description" content={`${total} modèles sur ${marques.length} marques, d'après la liste du ministère de la Transition écologique du ${maj}.`} />
        <meta property="og:url" content="https://www.inspexo.io/airbags-takata" />
        <meta property="og:image" content="https://www.inspexo.io/og-image.png" />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.map(({ q, r }) => ({
            '@type': 'Question',
            name: q,
            acceptedAnswer: { '@type': 'Answer', text: r },
          })),
        })}</script>
      </Helmet>

      <Navbar />

      <main>
        <section className="sec" style={{ borderTop: 'none' }}>
          <div className="wrap">
            <div className="sec-head">
              <h1 style={{ fontSize: 'clamp(30px,3.6vw,46px)' }}>
                Airbags Takata : les modèles concernés.
              </h1>
              <p>
                La liste officielle du ministère de la Transition écologique, reprise telle quelle :
                {' '}{total} modèles sur {marques.length} marques. Un modèle listé ne veut pas dire que
                votre exemplaire est concerné — seul le numéro de série (VIN) tranche, auprès du constructeur.
              </p>
            </div>

            {/* Recherche : même donnée que celle utilisée par l'analyse */}
            <div className="formcard" style={{ maxWidth: 680 }}>
              <div className="formcard-head">
                <span>Mon modèle est-il concerné ?</span>
                <span>Liste du {maj}</span>
              </div>
              <div style={{ padding: '20px 18px 18px' }}>
                <label className="lbl" htmlFor="takata-q">Marque et modèle</label>
                <input
                  id="takata-q"
                  className="input"
                  style={{ marginTop: 8 }}
                  type="search"
                  placeholder="Exemple : Citroën C3, BMW Série 1, Audi A4"
                  value={requete}
                  onChange={(e) => setRequete(e.target.value)}
                  autoComplete="off"
                />
                <div aria-live="polite" style={{ marginTop: 14 }}>
                  {resultats === null ? (
                    <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.6 }}>
                      Saisissez une marque et un modèle pour interroger la liste.
                    </p>
                  ) : resultats.length === 0 ? (
                    <div className="alert alert-vert" style={{ margin: 0 }}>
                      <strong>Aucun modèle correspondant dans la liste officielle</strong> du {maj}.
                      Vérifiez l'orthographe, et faites confirmer par le VIN si vous avez un doute :
                      la liste évolue.
                    </div>
                  ) : (
                    <div className="alert alert-rouge" style={{ margin: 0 }}>
                      <strong>
                        {resultats.length} modèle{resultats.length > 1 ? 's' : ''} de la liste correspond
                        {resultats.length > 1 ? 'ent' : ''} à votre recherche :
                      </strong>
                      {resultats.slice(0, 12).map((r, i) => (
                        <div key={i} className="ctrl" style={{ borderTop: '1px solid currentColor', opacity: 0.9 }}>
                          <span>{r.marque} {r.nom}</span>
                          <span className="val num">{r.debut ?? '?'}–{r.fin ?? '?'}</span>
                        </div>
                      ))}
                      <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6 }}>
                        Faites vérifier votre numéro de série (VIN) par le constructeur : lui seul sait si
                        cet exemplaire est visé et si l'airbag a déjà été remplacé. Le remplacement est gratuit.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Liste intégrale, par marque */}
            <div style={{ marginTop: 'clamp(36px,5vw,56px)' }}>
              <p className="eyebrow">La liste officielle, marque par marque</p>
              <div className="faq" style={{ marginTop: 14 }}>
                {marques.map(([marque, entrees]) => (
                  <details key={marque}>
                    <summary>
                      {marque}
                      <span className="mono c-graphite" style={{ fontSize: 12, fontWeight: 400 }}>
                        {entrees.length} modèle{entrees.length > 1 ? 's' : ''}
                        <span className="pm" aria-hidden="true" style={{ marginLeft: 10 }}>+</span>
                      </span>
                    </summary>
                    <div className="a">
                      {entrees.map((e, i) => (
                        <div key={i} className="ctrl">
                          <span>{e.nom}</span>
                          <span className="val num">{e.debut ?? '?'}–{e.fin ?? '?'}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Questions */}
        <section className="sec">
          <div className="wrap faq-grid">
            <div className="sec-head" style={{ marginBottom: 24 }}><h2>Questions sur le rappel Takata.</h2></div>
            <div className="faq">
              {faq.map(({ q, r }, i) => (
                <details key={i}>
                  <summary>{q}<span className="pm" aria-hidden="true">+</span></summary>
                  <div className="a">{r}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Source + CTA */}
        <section className="band">
          <div className="wrap">
            <p className="eyebrow">Avant d'acheter</p>
            <h2>Une annonce ne vous dira pas si l'airbag a été remplacé.</h2>
            <p className="lead">
              Chaque analyse Inspexo vérifie cette liste automatiquement, avec les rappels
              constructeur et les pannes connues du moteur. Gratuit, sans inscription.
            </p>
            <p style={{ marginTop: 28 }}>
              <Link to="/score">Analyser une annonce</Link>
            </p>
          </div>
        </section>

        <section className="sec">
          <div className="wrap">
            <p className="eyebrow">Source</p>
            <ol className="sources" style={{ marginTop: 8 }}>
              <li>
                [1] Ministère de la Transition écologique — rappel des airbags Takata, liste du {maj}.{' '}
                <a href={takata._source} target="_blank" rel="noopener noreferrer">
                  {(() => { try { return new URL(takata._source).hostname.replace(/^www\./, '') } catch (_) { return takata._source } })()}
                </a>
              </li>
            </ol>
            <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.7, marginTop: 14, maxWidth: '60em' }}>
              Cette page reprend la liste publiée par le ministère à la date indiquée, sans ajout ni
              interprétation. Elle ne remplace pas la vérification du numéro de série auprès du
              constructeur, seule réponse valable pour un véhicule donné.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
