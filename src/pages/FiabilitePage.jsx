import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { getFiabilite } from '../lib/scoreApi'
import { tauxLisible } from '../lib/intervalle'

// SPRINT 15 — La mesure publiée change de méthode.
//
// Jusqu'ici : relecture HUMAINE, affirmation par affirmation, seuil de 50
// dossiers. Le dispositif existait depuis le sprint 3 et comptait ZÉRO ligne
// un mois plus tard. Une mesure que personne n'a le temps de produire n'est
// pas une mesure — c'est une promesse.
//
// Désormais : chaque affirmation est confrontée à LA page qu'elle cite par un
// passage séparé, qui n'a vu ni l'analyse, ni son score, ni le raisonnement
// qui l'a produite. Seuil de publication : 30 analyses vérifiées.
//
// ⚠️ Les affirmations SANS source publique (catalogue interne) sont comptées
// à part, jamais fondues dans le taux. Les y verser serait injuste — elles ne
// sont pas réfutées, elles sont invérifiables ; les taire laisserait croire
// que tout a été contrôlé. Les deux nombres sont donnés côte à côte.

const TYPE_LABELS = {
  panne: 'Pannes connues',
  rappel: 'Rappels constructeur',
  cout: 'Coûts de réparation',
  entretien: 'Entretien',
  prix: 'Prix',
  juridique: 'Cadre juridique',
}

const pct = (n, total) =>
  total > 0 ? `${((n / total) * 100).toFixed(1).replace('.', ',')} %` : 'non évalué'

const dateFr = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : null)

export default function FiabilitePage() {
  const [data, setData] = useState(undefined)

  useEffect(() => {
    window.scrollTo(0, 0)
    getFiabilite().then(setData).catch(() => setData(null))
  }, [])

  const v = data?.verification
  const denominateur = v?.verifiables ?? 0
  const nonSoutenues = (v?.non_soutenues ?? 0) + (v?.mauvais_moteur ?? 0)
  const global = tauxLisible(nonSoutenues, denominateur)

  return (
    <>
      <Helmet>
        <title>Notre taux d'erreur, publié — Inspexo</title>
        <meta name="description" content="Chaque affirmation de nos analyses est confrontée à la source qu'elle cite par une vérification indépendante : taux d'affirmations non soutenues, mesuré et publié." />
        <link rel="canonical" href="https://www.inspexo.io/fiabilite" />
      </Helmet>
      <Navbar />
      <main>
        <section className="sec" style={{ borderTop: 'none', minHeight: '70vh' }}>
          <div className="wrap-doc">
            <p className="eyebrow">Justesse mesurée</p>
            <h1 style={{ fontSize: 'clamp(28px,5vw,40px)', marginTop: 12 }}>
              Notre taux d'erreur, publié.
            </h1>
            <p className="lead" style={{ marginTop: 14, marginBottom: 24 }}>
              Nos analyses citent leurs sources. Encore faut-il que les sources disent ce que
              nous leur faisons dire. Chaque affirmation est donc relue <strong>contre la page
              qu'elle cite</strong>, et le résultat est publié ici, qu'il nous arrange ou non.
            </p>

            {/* ── Méthode : avant les chiffres, pas après ──────────────── */}
            <div className="doc-sec" style={{ marginTop: 0 }}>
              <p className="eyebrow">La méthode</p>
              <div className="rows" style={{ marginTop: 10 }}>
                <div className="row">
                  <h3>Le jeu de test, ce sont de vraies analyses</h3>
                  <p>
                    Des annonces réelles, sur des marques et des motorisations variées, analysées
                    par le site comme n'importe quel visiteur le ferait. Pas d'exemples choisis
                    pour bien se tenir.
                  </p>
                </div>
                <div className="row">
                  <h3>La vérification n'a pas vu l'analyse</h3>
                  <p>
                    Un second passage reçoit l'affirmation, l'identité du véhicule et le texte de
                    la page citée. <strong>Il ne voit ni le score, ni le verdict, ni le
                    raisonnement qui a produit l'affirmation</strong> — sans quoi il ne
                    vérifierait pas, il confirmerait.
                  </p>
                </div>
                <div className="row">
                  <h3>Trois réponses possibles</h3>
                  <p>
                    <strong>Soutenue</strong> : la page dit bien cela. <strong>Non soutenue</strong> :
                    la page ne le dit pas, ou reste trop vague pour le porter. <strong>Mauvais
                    moteur</strong> : la page est claire, mais elle parle d'une autre motorisation
                    ou d'une autre génération. En cas de doute, l'affirmation est comptée contre
                    nous.
                  </p>
                </div>
                <div className="row">
                  <h3>Ce qui n'est pas vérifiable est dit comme tel</h3>
                  <p>
                    Certaines pannes viennent de notre catalogue interne et ne citent aucune page
                    publique. Elles ne peuvent pas être vérifiées de cette façon : elles sont
                    comptées à part, jamais mélangées au taux d'erreur.
                  </p>
                </div>
              </div>
            </div>

            {data === undefined ? (
              <p className="eyebrow" aria-busy="true" style={{ marginTop: 28 }}>Chargement…</p>
            ) : data === null ? (
              <div className="alert alert-rouge" style={{ marginTop: 28 }}>
                Statistiques momentanément indisponibles.
              </div>
            ) : !data.publie ? (
              <div style={{ border: '1px solid var(--rule-strong)', padding: '24px 20px', marginTop: 28 }}>
                <p className="eyebrow">Mesure en cours</p>
                <p style={{ fontSize: 15, lineHeight: 1.6, margin: '10px 0 14px' }}>
                  {data.analyses_verifiees} analyse{data.analyses_verifiees > 1 ? 's' : ''} vérifiée
                  {data.analyses_verifiees > 1 ? 's' : ''} sur les {data.seuil} requises avant
                  publication.
                </p>
                <div className="pbar" role="progressbar" aria-valuemin={0} aria-valuemax={data.seuil}
                  aria-valuenow={data.analyses_verifiees} aria-label="Avancement de la vérification">
                  <i style={{ width: `${Math.min(100, Math.round(((data.analyses_verifiees || 0) / data.seuil) * 100))}%` }} />
                </div>
                <p className="mono c-graphite" style={{ marginTop: 14, fontSize: 11, lineHeight: 1.6 }}>
                  Publier un taux sur un échantillon trop petit serait trompeur : un seul dossier
                  malheureux déplacerait le chiffre de plusieurs points. En attendant, chaque
                  analyse affiche déjà ses sources et le nombre d'affirmations écartées faute de
                  preuve.
                </p>
              </div>
            ) : (
              <>
                <div className="hero-facts" style={{ marginTop: 28 }}>
                  <div><span>Analyses vérifiées</span><span className="num">{String(data.analyses_verifiees)}</span></div>
                  <div><span>Affirmations vérifiables</span><span className="num">{String(denominateur)}</span></div>
                  <div><span>Non soutenues</span><span className="num">{global.brut}</span></div>
                  <div><span>Erreurs corrigées</span><span className="num">{String(v?.corrigees ?? 0)}</span></div>
                </div>

                {/* ⚠️ Le NOMBRE BRUT d'abord, le taux ensuite. « 2 sur 70 » se
                    vérifie ; « 2,9 % » se cite hors contexte. Et tant que
                    l'intervalle est large, il est donné : un taux publié sans
                    son incertitude affirme plus que ce que les données
                    permettent. */}
                <p style={{ fontSize: 17, lineHeight: 1.7, marginTop: 20 }}>
                  <strong>{global.brut}</strong> affirmation{nonSoutenues > 1 ? 's' : ''} non
                  soutenue{nonSoutenues > 1 ? 's' : ''} par la source citée, soit{' '}
                  <strong>{global.taux}</strong>
                  {global.intervalle && (
                    <> — intervalle de confiance à 95 % : <strong>{global.intervalle}</strong></>
                  )}.
                </p>
                {global.intervalle && (
                  <p className="mono c-graphite" style={{ marginTop: 8, fontSize: 11, lineHeight: 1.7 }}>
                    L'échantillon est encore petit : le taux réel peut raisonnablement se trouver
                    n'importe où dans cet intervalle. Il se resserrera à mesure que le nombre
                    d'analyses vérifiées augmentera.
                  </p>
                )}

                <div className="crit" style={{ marginTop: 24 }}>
                  {[
                    ['Soutenues par leur source', v?.soutenues ?? 0, true],
                    ['Non soutenues par leur source', v?.non_soutenues ?? 0, false],
                    ["Source parlant d'un autre moteur", v?.mauvais_moteur ?? 0, false],
                  ].map(([libelle, n, bon]) => {
                    const t = tauxLisible(n, denominateur)
                    return (
                      <div key={libelle}>
                        <span>{libelle} <span className="c-graphite">({t.brut})</span></span>
                        <span className="leader" aria-hidden="true"></span>
                        <span className={`val num ${bon || n === 0 ? 'ok' : 'bad'}`}>{t.taux}</span>
                      </div>
                    )
                  })}
                </div>

                <p className="mono c-graphite" style={{ marginTop: 14, fontSize: 11, lineHeight: 1.7 }}>
                  Hors dénominateur, et dit explicitement : {v?.sans_source ?? 0} affirmation
                  {(v?.sans_source ?? 0) > 1 ? 's' : ''} sans source publique (catalogue interne),
                  {' '}{v?.injoignables ?? 0} page{(v?.injoignables ?? 0) > 1 ? 's' : ''} citée
                  {(v?.injoignables ?? 0) > 1 ? 's' : ''} que nous n'avons pas pu relire
                  (document PDF, page indisponible). Nous ne les comptons ni pour nous, ni contre
                  nous.
                </p>

                {Object.keys(data.verification_par_type || {}).length > 0 && (
                  <div style={{ marginTop: 28 }}>
                    <p className="eyebrow" style={{ marginBottom: 6 }}>Par type d'affirmation</p>
                    <div className="crit" style={{ marginTop: 0 }}>
                      {Object.entries(data.verification_par_type)
                        .sort((a, b) => (b[1].verifiables ?? 0) - (a[1].verifiables ?? 0))
                        .map(([type, s]) => (
                          <div key={type}>
                            <span>{TYPE_LABELS[type] || type} <span className="c-graphite">
                              ({tauxLisible((s.non_soutenues ?? 0) + (s.mauvais_moteur ?? 0), s.verifiables ?? 0).brut})
                            </span></span>
                            <span className="leader" aria-hidden="true"></span>
                            <span className={`val num ${((s.non_soutenues ?? 0) + (s.mauvais_moteur ?? 0)) > 0 ? 'bad' : 'ok'}`}>
                              {tauxLisible((s.non_soutenues ?? 0) + (s.mauvais_moteur ?? 0), s.verifiables ?? 0).taux}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {data.maj && (
                  <p className="mono c-graphite" style={{ marginTop: 14, fontSize: 11 }}>
                    Dernière vérification : {dateFr(data.maj)} — mise à jour automatique.
                  </p>
                )}

                {(data.analyses_auditees ?? 0) > 0 && (
                  <div style={{ marginTop: 28 }}>
                    <p className="eyebrow" style={{ marginBottom: 6 }}>Relecture humaine (mesure distincte)</p>
                    <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.7 }}>
                      {data.analyses_auditees} analyse{data.analyses_auditees > 1 ? 's' : ''} relue
                      {data.analyses_auditees > 1 ? 's' : ''} à la main, {data.global?.total ?? 0}{' '}
                      affirmation{(data.global?.total ?? 0) > 1 ? 's' : ''} marquée
                      {(data.global?.total ?? 0) > 1 ? 's' : ''} juste, fausse ou discutable —{' '}
                      {pct(data.global?.fausses ?? 0, data.global?.total ?? 0)} de fausses.
                      Deux méthodes, deux chiffres : nous ne les additionnons pas.
                    </p>
                  </div>
                )}
              </>
            )}

            <div style={{ marginTop: 32 }}>
              <Link to="/score" className="btn" style={{ width: 'auto', display: 'inline-flex' }}>
                Analyser une annonce
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
