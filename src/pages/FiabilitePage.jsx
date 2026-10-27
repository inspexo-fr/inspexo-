import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { getFiabilite } from '../lib/scoreApi'

const FONT = 'Plus Jakarta Sans, sans-serif'
const FONT_TITRE = 'Syne, sans-serif'

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

const pct = (n, total) => (total > 0 ? `${((n / total) * 100).toFixed(1).replace('.', ',')} %` : '—')

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
      <main style={{ background: '#F8F9FA', minHeight: '100vh' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '100px 16px 64px' }}>
          <div style={{ fontFamily: FONT, fontSize: '0.8125rem', fontWeight: 600, color: '#FF4D00', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
            Justesse prouvée
          </div>
          <h1 style={{ fontFamily: FONT_TITRE, fontWeight: 800, fontSize: 'clamp(1.5rem, 5vw, 2.125rem)', color: '#0F1B2D', marginBottom: 10, lineHeight: 1.15 }}>
            On mesure nos erreurs.<br />Et on les publie.
          </h1>
          <p style={{ fontFamily: FONT, fontSize: '0.9375rem', fontWeight: 300, color: '#6B7280', lineHeight: 1.7, marginBottom: 26 }}>
            Des analyses sont tirées au hasard et relues une par une par un humain : chaque
            affirmation (panne, rappel, incohérence, point juridique, constat photo, prix, coût)
            est marquée <strong>juste</strong>, <strong>fausse</strong> ou <strong>discutable</strong>.
            Les chiffres ci-dessous sont mis à jour automatiquement — rien n'est publié avant
            50 analyses auditées.
          </p>

          {data === undefined ? (
            <div style={{ fontFamily: FONT, color: '#9CA3AF' }}>Chargement…</div>
          ) : data === null ? (
            <div style={{ fontFamily: FONT, color: '#B91C1C' }}>Statistiques momentanément indisponibles.</div>
          ) : !data.publie ? (
            <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid rgba(0,0,0,0.07)', padding: '28px 22px' }}>
              <div style={{ fontFamily: FONT_TITRE, fontWeight: 800, fontSize: '1.125rem', color: '#0F1B2D', marginBottom: 8 }}>
                Audit en cours
              </div>
              <div style={{ fontFamily: FONT, fontSize: '0.9375rem', color: '#374151', lineHeight: 1.65, marginBottom: 14 }}>
                {data.analyses_auditees} analyse{data.analyses_auditees > 1 ? 's' : ''} auditée{data.analyses_auditees > 1 ? 's' : ''} sur
                les {data.seuil} requises avant publication des taux d'erreur.
              </div>
              <div style={{ height: 8, background: '#F0F2F5', borderRadius: 100 }}>
                <div style={{
                  height: 8, borderRadius: 100, background: '#FF4D00',
                  width: `${Math.min(100, Math.round((data.analyses_auditees / data.seuil) * 100))}%`,
                }} />
              </div>
              <div style={{ marginTop: 14, fontFamily: FONT, fontSize: '0.75rem', color: '#9CA3AF', lineHeight: 1.6 }}>
                Publier un taux d'erreur sur un échantillon trop petit serait trompeur : on attend
                d'avoir la masse critique. En attendant, chaque analyse affiche déjà ses sources et
                les affirmations écartées faute de preuve.
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                {[
                  ['Analyses auditées', String(data.analyses_auditees)],
                  ['Affirmations relues', String(data.global?.total ?? 0)],
                  ['Taux d\'erreur', pct(data.global?.fausses ?? 0, data.global?.total ?? 0)],
                  ['Discutables', pct(data.global?.discutables ?? 0, data.global?.total ?? 0)],
                ].map(([lbl, val]) => (
                  <div key={lbl} style={{
                    flex: '1 1 140px', background: '#fff', borderRadius: 14,
                    border: '1.5px solid rgba(0,0,0,0.07)', padding: '16px 16px',
                  }}>
                    <div style={{ fontFamily: FONT, fontSize: '0.6875rem', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' }}>{lbl}</div>
                    <div style={{ fontFamily: FONT_TITRE, fontWeight: 800, fontSize: '1.5rem', color: '#0F1B2D' }}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid rgba(0,0,0,0.07)', padding: '20px 20px' }}>
                <div style={{ fontFamily: FONT, fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  Taux d'erreur par type d'affirmation
                </div>
                {Object.entries(data.par_type || {})
                  .sort((a, b) => (b[1].total ?? 0) - (a[1].total ?? 0))
                  .map(([type, s]) => (
                    <div key={type} style={{
                      display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0',
                      borderTop: '1px solid rgba(0,0,0,0.05)', fontFamily: FONT, fontSize: '0.875rem', color: '#0F1B2D',
                    }}>
                      <span>{TYPE_LABELS[type] || type} <span style={{ color: '#9CA3AF' }}>({s.total})</span></span>
                      <span style={{ fontWeight: 700, color: s.fausses > 0 ? '#DC2626' : '#16A34A' }}>
                        {pct(s.fausses, s.total)} d'erreurs
                      </span>
                    </div>
                  ))}
                {data.maj && (
                  <div style={{ marginTop: 12, fontFamily: FONT, fontSize: '0.6875rem', color: '#9CA3AF' }}>
                    Dernière relecture : {new Date(data.maj).toLocaleDateString('fr-FR')} — mise à jour automatique.
                  </div>
                )}
              </div>
            </>
          )}

          <div style={{ marginTop: 26, textAlign: 'center' }}>
            <Link to="/score" style={{
              display: 'inline-block', background: '#FF4D00', color: '#fff', borderRadius: 10,
              padding: '13px 26px', textDecoration: 'none', fontFamily: FONT, fontWeight: 700, fontSize: '0.9375rem',
            }}>
              Analyser une annonce
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
