import React, { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Footnotes, { Ref, creerRegistreSources } from '../components/Footnotes'
import { libelleSource } from '../components/DossierApercu'
import { getMoteurPublic } from '../lib/scoreApi'
import { FAMILLES_MOTEUR, familleParSlug } from '../data/famillesMoteur'

// /moteur/<slug> — page publique d'une famille moteur.
// RIEN n'est écrit ici qui ne vienne de la fiche : pannes, plan d'entretien,
// programmes et rappels sont lus en base et chaque affirmation porte son
// appel de note. Si la fiche n'atteint pas le seuil de publication, la page
// n'existe pas (redirection) — pas de page vide de preuves.

const GRAVITE = {
  securite: { label: 'Danger pour les occupants', classe: 'rouge' },
  casse: { label: 'Casse moteur ou boîte', classe: 'rouge' },
  majeure: { label: 'Réparation majeure', classe: 'ambre' },
  mineure: { label: 'Désagrément', classe: 'muted' },
}

const euros = (min, max) => {
  const fr = (n) => Number(n).toLocaleString('fr-FR')
  if (min != null && max != null && min !== max) return `${fr(min)} – ${fr(max)} €`
  const seul = min ?? max
  return seul != null ? `${fr(seul)} €` : null
}

function intervalle(op) {
  const parts = [
    op.intervalle_km ? `${Number(op.intervalle_km).toLocaleString('fr-FR')} km` : null,
    op.intervalle_annees ? `${op.intervalle_annees} ans` : null,
  ].filter(Boolean)
  if (parts.length === 0) return 'intervalle à vérifier dans le carnet'
  return parts.join(' ou ')
}

export default function MoteurPage() {
  const { slug } = useParams()
  const famille = familleParSlug(slug)
  const [fiche, setFiche] = useState(undefined) // undefined = chargement, null = absente

  useEffect(() => {
    window.scrollTo(0, 0)
    if (!famille) { setFiche(null); return }
    let cancelled = false
    getMoteurPublic(famille.marque, famille.famille)
      .then((d) => { if (!cancelled) setFiche(d || null) })
      .catch(() => { if (!cancelled) setFiche(null) })
    return () => { cancelled = true }
  }, [famille?.slug]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!famille) return <Navigate to="/moteur" replace />

  const nom = famille.nom_commercial
  const titre = `Pannes connues du ${nom} : ce qu'il faut vérifier avant d'acheter`
  const url = `https://www.inspexo.io/moteur/${famille.slug}`

  if (fiche === undefined) {
    return (
      <>
        <Navbar />
        <main><section className="sec" style={{ borderTop: 'none', minHeight: '50vh' }}>
          <div className="wrap"><p className="eyebrow" aria-busy="true">Lecture de la fiche moteur…</p></div>
        </section></main>
      </>
    )
  }

  // Seuil de publication : au moins 3 pannes, toutes sourcées (même règle que
  // la RPC list_moteurs_publies qui alimente le sitemap).
  const pannes = (fiche?.pannes ?? []).filter((p) => (p.url_source ?? []).length > 0)
  if (!fiche || pannes.length < 3) {
    return (
      <>
        <Helmet><meta name="robots" content="noindex" /></Helmet>
        <Navbar />
        <main>
          <section className="sec" style={{ borderTop: 'none', minHeight: '50vh' }}>
            <div className="wrap-doc">
              <p className="eyebrow">Fiche en préparation</p>
              <h1 style={{ fontSize: 'clamp(26px,4vw,34px)', marginTop: 12 }}>
                La fiche du {nom} n'est pas encore publiable.
              </h1>
              <p className="lead" style={{ marginTop: 14 }}>
                Nous ne publions une page moteur qu'à partir de trois pannes documentées, chacune
                rattachée à une source consultable. Celle-ci n'y est pas encore.
              </p>
              <div style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link to="/score" className="btn btn-auto" style={{ width: 'auto', display: 'inline-flex' }}>
                  Analyser une annonce
                </Link>
                <Link to="/moteur" className="btn-ghost btn-auto" style={{ width: 'auto', display: 'inline-flex' }}>
                  Voir les moteurs couverts
                </Link>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </>
    )
  }

  const plan = (fiche.plan_entretien ?? [])
  const programmes = (fiche.programmes ?? [])
  const rappels = pannes.filter((p) => p.rappel_code)
  const maj = fiche.updated_at ? new Date(fiche.updated_at).toLocaleDateString('fr-FR') : null

  // Registre des sources : numérotation unique dans l'ordre d'apparition.
  const registre = creerRegistreSources()
  const refsPanne = pannes.map((p) => {
    const titres = new Map((p.sources ?? []).filter((s) => s?.url).map((s) => [s.url, s.title]))
    return (p.url_source ?? []).slice(0, 4).map((u) => registre.register(u, libelleSource(u, titres.get(u)), u))
  })
  const refsPlan = plan.map((op) => (op.url_source ?? []).slice(0, 2).map((u) => registre.register(u, libelleSource(u), u)))
  const refsProg = programmes.map((pr) => (pr.url_source ? [pr.url_source] : []).map((u) => registre.register(u, libelleSource(u), u)))

  const questions = [
    ...pannes.slice(0, 4).map((p) => `${p.titre} : l'organe a-t-il déjà été remplacé ? Pouvez-vous m'envoyer la facture (date, kilométrage, pièces) ?`),
    ...plan.filter((op) => op.critique).slice(0, 2).map((op) => `${op.operation} : à quel kilométrage a-t-elle été faite, et par qui ?`),
    'Pouvez-vous m\'envoyer le numéro VIN et la carte grise, pour consulter HistoVec ?',
  ].slice(0, 7)

  const faq = [
    {
      q: `Le ${nom} est-il fiable ?`,
      r: `Cette page ne donne pas d'avis général : elle liste ${pannes.length} défaillance${pannes.length > 1 ? 's' : ''} documentée${pannes.length > 1 ? 's' : ''} sur cette famille moteur, chacune avec sa source. Un exemplaire bien entretenu et dont les opérations critiques sont prouvées par facture n'a pas le même risque qu'un exemplaire sans historique.`,
    },
    {
      q: `Quelles questions poser au vendeur d'un ${nom} ?`,
      r: questions.slice(0, 3).join(' '),
    },
    {
      q: 'D\'où viennent ces informations ?',
      r: `De sources nommées et consultables, listées en bas de page${maj ? ` et vérifiées le ${maj}` : ''}. Une source qui parle d'un autre moteur est écartée, et une panne sans source n'est pas publiée.`,
    },
  ]

  return (
    <>
      <Helmet>
        <title>{titre} | Inspexo</title>
        <meta name="description" content={`${pannes.length} pannes connues du ${nom}, chacune avec sa source : symptômes, kilométrage typique, coût de réparation, plan d'entretien et questions à poser au vendeur avant d'acheter.`} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={titre} />
        <meta property="og:description" content={`${pannes.length} pannes documentées, le plan d'entretien et les questions à poser au vendeur.`} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        <meta property="og:image" content="https://www.inspexo.io/og-image.png" />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.map(({ q, r }) => ({
            '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: r },
          })),
        })}</script>
      </Helmet>

      <Navbar />

      <main>
        {/* En-tête */}
        <section className="sec" style={{ borderTop: 'none', paddingBottom: 'clamp(28px,4vw,48px)' }}>
          <div className="wrap">
            <div className="sec-head">
              <h1 style={{ fontSize: 'clamp(30px,3.6vw,46px)' }}>{titre}</h1>
              <p>
                {famille.marque} — famille moteur {fiche.famille_moteur}
                {famille.millesimes ? `, ${famille.millesimes}` : ''}.
                {' '}{pannes.length} défaillance{pannes.length > 1 ? 's' : ''} documentée{pannes.length > 1 ? 's' : ''},
                chacune rattachée à sa source.
              </p>
            </div>
            <div className="hero-facts" style={{ marginTop: 0 }}>
              <div><span>Modèles concernés</span><span>{famille.modeles?.length ?? 0}</span></div>
              <div><span>Pannes documentées</span><span className="num">{pannes.length}</span></div>
              <div><span>Sources citées</span><span className="num">{registre.liste.length || '—'}</span></div>
              <div><span>Vérifié le</span><span className="num">{maj ?? '—'}</span></div>
            </div>
          </div>
        </section>

        {/* Modèles concernés */}
        {(famille.modeles ?? []).length > 0 && (
          <section className="sec">
            <div className="wrap">
              <div className="sec-head">
                <h2>Quels modèles montent ce moteur ?</h2>
                <p>Liste établie à partir des sources techniques citées en bas de page. Les millésimes exacts varient selon les finitions et les marchés.</p>
              </div>
              <div className="channels">
                {famille.modeles.map((m, i) => (
                  <div className="channel" key={i}>
                    <h3 style={{ fontSize: 19 }}>{m}</h3>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Pannes */}
        <section className="sec" id="pannes">
          <div className="wrap">
            <div className="sec-head">
              <h2>Les pannes connues, une par une.</h2>
              <p>Pas d'avis général sur le moteur : des défaillances précises, avec leurs symptômes, le kilométrage auquel elles apparaissent et, quand une source le publie, le coût de la réparation.</p>
            </div>
            <dl className="rows">
              {pannes.map((p, i) => {
                const g = GRAVITE[p.gravite] ?? GRAVITE.mineure
                const cout = euros(p.cout_indicatif_eur_min, p.cout_indicatif_eur_max)
                return (
                  <div className="row" key={i}>
                    <dt>{String(i + 1).padStart(2, '0')}{p.organe ? ` · ${p.organe}` : ''}</dt>
                    <dd>
                      <b>{p.titre}<Ref nums={refsPanne[i]} /></b>
                      <p>{p.symptomes}</p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                        <span className={`tag ${g.classe}`}>{g.label}</span>
                        {p.km_typique && <span className="tag muted">{p.km_typique}</span>}
                        {cout && <span className="tag">{cout}</span>}
                        {p.rappel_code && <span className="tag ambre">Rappel {p.rappel_code}</span>}
                      </div>
                    </dd>
                  </div>
                )
              })}
            </dl>
          </div>
        </section>

        {/* Plan d'entretien */}
        {plan.length > 0 && (
          <section className="sec" id="entretien">
            <div className="wrap">
              <div className="sec-head">
                <h2>Ce que l'entretien doit avoir couvert.</h2>
                <p>Intervalles publiés par le constructeur ou la presse technique. Quand aucun chiffre fiable n'est publié, c'est écrit : on ne complète pas au jugé.</p>
              </div>
              <div className="crit" style={{ marginTop: 0 }}>
                {plan.map((op, i) => (
                  <div key={i}>
                    <span>
                      {op.operation}
                      <Ref nums={refsPlan[i]} />
                      {op.critique && <span className="tag rouge" style={{ marginLeft: 8 }}>critique</span>}
                    </span>
                    <span className="leader" aria-hidden="true"></span>
                    <span className={`val ${op.a_verifier_carnet ? 'na' : ''}`}>{intervalle(op)}</span>
                  </div>
                ))}
              </div>
              {plan.some((op) => euros(op.cout_min_eur, op.cout_max_eur)) && (
                <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.7, marginTop: 16 }}>
                  Coûts indicatifs à faire chiffrer par un garage. À utiliser comme arguments, pas comme une remise garantie.
                </p>
              )}
            </div>
          </section>
        )}

        {/* Programmes de prise en charge */}
        {programmes.length > 0 && (
          <section className="sec" id="programme">
            <div className="wrap">
              <div className="sec-head">
                <h2>Prise en charge constructeur.</h2>
                <p>Extension de garantie ou geste commercial publiés par la marque pour cette famille moteur. Les conditions exactes sont celles de la source : faites-les confirmer avant d'acheter.</p>
              </div>
              <dl className="rows">
                {programmes.map((pr, i) => (
                  <div className="row" key={i}>
                    <dt>{pr.type ?? 'Programme'}</dt>
                    <dd>
                      <b>{pr.intitule ?? pr.titre ?? 'Programme constructeur'}<Ref nums={refsProg[i]} /></b>
                      {pr.conditions && <p>{pr.conditions}</p>}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                        {pr.plafond_km && <span className="tag">{Number(pr.plafond_km).toLocaleString('fr-FR')} km</span>}
                        {pr.plafond_annees && <span className="tag">{pr.plafond_annees} ans</span>}
                      </div>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        )}

        {/* Rappels connus */}
        {rappels.length > 0 && (
          <section className="sec" id="rappels">
            <div className="wrap">
              <div className="sec-head">
                <h2>Rappels constructeur liés à ce moteur.</h2>
                <p>Codes de campagne relevés dans les sources citées. Seul le numéro de série (VIN) dit si un exemplaire précis est visé, et si l'intervention a été faite.</p>
              </div>
              {rappels.map((p, i) => (
                <div className="ctrl" key={i} style={{ alignItems: 'baseline' }}>
                  <span>
                    {p.rappel_code} — {p.titre}
                    {p.rappel_vehicules && (
                      <span className="mono c-graphite" style={{ display: 'block', fontSize: 11, marginTop: 2 }}>
                        {p.rappel_vehicules}
                      </span>
                    )}
                  </span>
                  <span className="val mid">{p.rappel_date ?? 'à confirmer'}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Questions au vendeur */}
        <section className="sec" id="questions">
          <div className="wrap">
            <div className="sec-head">
              <h2>Les questions à poser au vendeur.</h2>
              <p>Composées à partir des pannes ci-dessus : chacune demande une preuve, pas une opinion.</p>
            </div>
            <div className="steps">
              {questions.map((q, i) => (
                <div className="step" key={i}>
                  <span className="n">{String(i + 1).padStart(2, '0')}</span>
                  <div><p style={{ marginTop: 0 }}>{q}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="band">
          <div className="wrap">
            <p className="eyebrow">Une annonce en particulier ?</p>
            <h2>Cette page parle du moteur. L'analyse parle de la voiture.</h2>
            <p className="lead">
              Collez le texte de l'annonce : rappels constructeur, airbags Takata, pannes de cette
              famille moteur rapportées à ce kilométrage, statut réel du vendeur et questions à lui poser.
              Gratuit, sans inscription.
            </p>
            <p style={{ marginTop: 28 }}><Link to="/score">Analyser une annonce</Link></p>
          </div>
        </section>

        {/* FAQ */}
        <section className="sec">
          <div className="wrap faq-grid">
            <div className="sec-head" style={{ marginBottom: 24 }}><h2>Questions fréquentes.</h2></div>
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

        {/* Sources */}
        <section className="sec">
          <div className="wrap">
            <Footnotes sources={registre.liste} titre="Sources de cette page" />
            <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.7, marginTop: 16, maxWidth: '60em' }}>
              Fiche {fiche.famille_moteur}{maj ? ` vérifiée le ${maj}` : ''}. Chaque panne listée cite au moins
              une source consultable ; ce qui n'est pas sourcé n'est pas publié. Cette page ne remplace pas
              l'examen du véhicule par un professionnel.
            </p>
            <nav style={{ marginTop: 28 }} aria-label="Autres moteurs">
              <p className="eyebrow" style={{ marginBottom: 10 }}>Autres moteurs couverts</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {FAMILLES_MOTEUR.filter((f) => f.slug !== famille.slug).slice(0, 12).map((f) => (
                  <Link key={f.slug} to={`/moteur/${f.slug}`} className="tag" style={{ textDecoration: 'none' }}>
                    {f.nom_commercial}
                  </Link>
                ))}
              </div>
            </nav>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
