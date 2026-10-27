import React from 'react'
import LeadEmailForm from './LeadEmailForm'

// Pivot sprint 1 : les profils d'experts fictifs et leurs chiffres ont été
// retirés. Cette section présente le réseau en construction et capte les
// emails (lead source = expert_waitlist).

const couverture = [
  'Peugeot', 'Renault', 'Citroën', 'Volkswagen', 'Toyota', 'Ford',
  'BMW', 'Mercedes', 'Audi', 'Porsche', 'Land Rover', 'Alfa Romeo',
]

export default function Experts() {
  return (
    <>
      <style>{`
        .expert-brand-pill {
          padding: 5px 14px; border-radius: 100px;
          font-size: 0.75rem; font-weight: 600;
          font-family: 'Plus Jakarta Sans', sans-serif;
          border: 1px solid rgba(255,255,255,0.1);
          background: transparent;
          color: rgba(255,255,255,0.45);
          white-space: nowrap;
        }
        @media (max-width: 768px) {
          .experts-section { padding: 64px 20px !important; }
          .experts-title { font-size: 1.625rem !important; line-height: 1.2 !important; }
          .experts-build-card { padding: 28px 22px !important; }
        }
      `}</style>

      <section id="experts" className="experts-section" style={{ background: '#0F1B2D', padding: '96px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          {/* Label */}
          <div style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: '0.8125rem', fontWeight: 600,
            color: '#FF4D00', letterSpacing: '0.12em',
            textTransform: 'uppercase', marginBottom: 20,
          }}>
            {'// 03 — Nos experts'}
          </div>

          <div style={{ marginBottom: 40 }}>
            <h2 className="experts-title" style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 800,
              fontSize: 'clamp(2rem, 4vw, 2.75rem)',
              color: '#fff', lineHeight: 1.1, marginBottom: 16,
            }}>
              Réseau d'experts<br />en construction.
            </h2>
            <p style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '0.9375rem', fontWeight: 300,
              color: 'rgba(255,255,255,0.45)', maxWidth: 520, lineHeight: 1.65,
            }}>
              Nous recrutons des mécaniciens et experts qualifiés, spécialisés par marque,
              payés exclusivement par l'acheteur — jamais par le vendeur, jamais par le garage.
              Zone de lancement : Toulouse &amp; Haute-Garonne.
            </p>
          </div>

          {/* Bloc liste d'attente */}
          <div className="experts-build-card" style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, padding: '36px 32px',
            maxWidth: 680, marginBottom: 40,
          }}>
            <div style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 800,
              fontSize: '1.125rem', color: '#fff', marginBottom: 8,
            }}>
              Être prévenu de l'ouverture des inspections
            </div>
            <div style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '0.875rem', fontWeight: 300,
              color: 'rgba(255,255,255,0.45)', marginBottom: 18, lineHeight: 1.65,
            }}>
              Visio Test Drive et Inspection Physique ouvrent dès que les premiers
              experts de votre marque sont opérationnels. Laissez votre email :
              vous serez prévenu en premier.
            </div>
            <LeadEmailForm
              source="expert_waitlist"
              buttonLabel="Rejoindre la liste d'attente"
              successMessage="✓ Enregistré ! Vous serez prévenu dès l'ouverture."
            />
          </div>

          {/* Marques en cours de recrutement */}
          <div>
            <span style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '0.75rem', fontWeight: 600,
              color: 'rgba(255,255,255,0.3)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              display: 'block', marginBottom: 10,
            }}>
              Marques prioritaires au lancement
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {couverture.map(b => (
                <span key={b} className="expert-brand-pill">{b}</span>
              ))}
              <span className="expert-brand-pill" style={{ color: 'rgba(255,255,255,0.3)' }}>
                + autres marques sur demande
              </span>
            </div>
          </div>

        </div>
      </section>
    </>
  )
}
