import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { getFiabilite } from '../lib/scoreApi'

const TYPE_LABELS = {
  panne: 'Pannes connues',
  rappel: 'Rappels constructeur',
  incoherence: 'Incohérences',
  juridique: 'Cadre juridique',
  photo: 'Constats photo',
  prix: 'Prix',
  cout: 'Coûts et négociation',
  raison: 'Raisons principales',
  entretien: 'Entretien',
  checklist: 'Checklist',
}

const pct = (n, total) => (total > 0 ? `${((n / total) * 100).toFixed(1).replace('.', ',')} %` : 'non évalué')

export default function FiabilitePage() {
  const [data, setData] = useState(undefined)

  useEffect(() => {
    window.scrollTo(0, 0)
    getFiabilite().then(setData).catch(() => setData(null))
  }, [])

  return (
    <>
      <Helmet>
        <title>Fiabilité mesurée de nos analyses — Inspexo</title>
        <meta name="description" content="Chaque affirmation de nos analyses est relue par un humain sur des analyses tirées au hasard : taux d'erreur mesuré et publié, par type d'affirmation." />
        <link rel="canonical" href="https://www.inspexo.io/fiabilite" />
      </Helmet>
      <Navbar />
      <main>
        <section className="sec" style={{ borderTop: 'none', minHeight: '70vh' }}>
          <div className="wrap-doc">
            <p className="eyebrow">Justesse prouvée</p>
            <h1 style={{ fontSize: 'clamp(28px,5vw,40px)', marginTop: 12 }}>
              On mesure nos erreurs. Et on les publie.
            </h1>
            <p className="lead" style={{ marginTop: 14, marginBottom: 28 }}>
              Des analyses sont tirées au hasard et relues une par une par un humain : chaque
              affirmation (panne, rappel, incohérence, point juridique, constat photo, prix, coût)
              est marquée <strong>juste</strong>, <strong>fausse</strong> ou <strong>discutable</strong>.
              Les chiffres ci-dessous sont mis à jour automatiquement — rien n'est publié avant
              50 analyses auditées.
            </p>

            {data === undefined ? (
              <p className="eyebrow" aria-busy="true">Chargement…</p>
            ) : data === null ? (
              <div className="alert alert-rouge">Statistiques momentanément indisponibles.</div>
            ) : !data.publie ? (
              <div style={{ border: '1px solid var(--rule-strong)', padding: '24px 20px' }}>
                <p className="eyebrow">Audit en cours</p>
                <p style={{ fontSize: 15, lineHeight: 1.6, margin: '10px 0 14px' }}>
                  {data.analyses_auditees} analyse{data.analyses_auditees > 1 ? 's' : ''} auditée{data.analyses_auditees > 1 ? 's' : ''} sur
                  les {data.seuil} requises avant publication des taux d'erreur.
                </p>
                <div className="pbar" role="progressbar" aria-valuemin={0} aria-valuemax={data.seuil} aria-valuenow={data.analyses_auditees} aria-label="Avancement de l'audit">
                  <i style={{ width: `${Math.min(100, Math.round((data.analyses_auditees / data.seuil) * 100))}%` }} />
                </div>
                <p className="mono c-graphite" style={{ marginTop: 14, fontSize: 11, lineHeight: 1.6 }}>
                  Publier un taux d'erreur sur un échantillon trop petit serait trompeur : on attend
                  d'avoir la masse critique. En attendant, chaque analyse affiche déjà ses sources et
                  les affirmations écartées faute de preuve.
                </p>
              </div>
            ) : (
              <>
                <div className="hero-facts" style={{ marginTop: 0 }}>
                  <div><span>Analyses auditées</span><span className="num">{String(data.analyses_auditees)}</span></div>
                  <div><span>Affirmations relues</span><span className="num">{String(data.global?.total ?? 0)}</span></div>
                  <div><span>Taux d'erreur</span><span className="num">{pct(data.global?.fausses ?? 0, data.global?.total ?? 0)}</span></div>
                  <div><span>Discutables</span><span className="num">{pct(data.global?.discutables ?? 0, data.global?.total ?? 0)}</span></div>
                </div>
                <div style={{ marginTop: 28 }}>
                  <p className="eyebrow" style={{ marginBottom: 6 }}>Taux d'erreur par type d'affirmation</p>
                  <div className="crit" style={{ marginTop: 0 }}>
                    {Object.entries(data.par_type || {})
                      .sort((a, b) => (b[1].total ?? 0) - (a[1].total ?? 0))
                      .map(([type, s]) => (
                        <div key={type}>
                          <span>{TYPE_LABELS[type] || type} <span className="c-graphite">({s.total})</span></span>
                          <span className="leader" aria-hidden="true"></span>
                          <span className={`val num ${s.fausses > 0 ? 'bad' : 'ok'}`}>{pct(s.fausses, s.total)}</span>
                        </div>
                      ))}
                  </div>
                  {data.maj && (
                    <p className="mono c-graphite" style={{ marginTop: 12, fontSize: 11 }}>
                      Dernière relecture : {new Date(data.maj).toLocaleDateString('fr-FR')} — mise à jour automatique.
                    </p>
                  )}
                </div>
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
