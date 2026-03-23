import React, { useState, useEffect, useCallback } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { supabase } from '../lib/supabaseClient'

// Initialisation Stripe — une seule fois, hors du composant
const stripeKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY
if (!stripeKey) console.error('❌ REACT_APP_STRIPE_PUBLISHABLE_KEY manquante — redémarrez npm start après avoir vérifié .env.local')
const stripePromise = stripeKey ? loadStripe(stripeKey) : null

const TIER_META = {
  ia:         { label: 'IA Spécialisée',    price: '9,90€',  emoji: '💬' },
  visio:      { label: 'Visio Test Drive',   price: '59€',    emoji: '📹' },
  inspection: { label: 'Inspection Physique',price: '249€',   emoji: '🔧' },
}

const CURRENT_YEAR = new Date().getFullYear()

// ─── Formulaire Stripe (step 2) ──────────────────────────────────────────────

function PaymentForm({ onSuccess, onError }) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setLoading(true)

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    })

    if (error) {
      onError(error.message || 'Paiement refusé. Veuillez réessayer.')
      setLoading(false)
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess()
    } else {
      onError('Statut inattendu. Contactez contact@inspexo.io.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 24 }}>
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>
      <button
        type="submit"
        disabled={!stripe || loading}
        className="checkout-submit"
        style={{ background: loading ? '#9CA3AF' : '#FF4D00' }}
      >
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span className="checkout-spinner" />
            Traitement en cours...
          </span>
        ) : 'Confirmer le paiement →'}
      </button>
    </form>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CheckoutModal({ isOpen, onClose, tier }) {
  const meta = TIER_META[tier] || TIER_META.ia

  // step: 'vehicle' | 'payment' | 'success'
  const [step, setStep] = useState('vehicle')
  const [vehicle, setVehicle] = useState({ brand: '', model: '', year: '', url: '' })
  const [clientSecret, setClientSecret] = useState(null)
  const [loadingCheckout, setLoadingCheckout] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Reset à chaque ouverture
  useEffect(() => {
    if (isOpen) {
      setStep('vehicle')
      setVehicle({ brand: '', model: '', year: '', url: '' })
      setClientSecret(null)
      setErrorMsg('')
    }
  }, [isOpen])

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Escape
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])
  useEffect(() => {
    if (isOpen) window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleKeyDown])

  // ── Step 1 : soumettre les infos véhicule → appel Edge Function ──────────
  const handleVehicleSubmit = async (e) => {
    e.preventDefault()
    setLoadingCheckout(true)
    setErrorMsg('')

    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: {
        tier,
        vehicle_brand: vehicle.brand.trim(),
        vehicle_model: vehicle.model.trim(),
        vehicle_year:  vehicle.year ? parseInt(vehicle.year, 10) : null,
        vehicle_url:   vehicle.url.trim() || null,
      },
    })

    if (error || !data?.clientSecret) {
      console.group('🔴 create-checkout error')
      console.error('error  :', error)
      console.error('data   :', data)
      console.groupEnd()
      setErrorMsg(
        data?.error
          ? `Erreur : ${data.error}`
          : 'Impossible de créer la session de paiement. Réessayez ou contactez contact@inspexo.io.'
      )
      setLoadingCheckout(false)
      return
    }

    setClientSecret(data.clientSecret)
    setStep('payment')
    setLoadingCheckout(false)
  }

  const handleChange = (field) => (e) =>
    setVehicle(prev => ({ ...prev, [field]: e.target.value }))

  if (!isOpen) return null

  // Options Stripe Elements
  const stripeOptions = clientSecret ? {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#FF4D00',
        colorBackground: '#ffffff',
        colorText: '#0F1B2D',
        colorDanger: '#DC2626',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        borderRadius: '10px',
        spacingUnit: '4px',
      },
    },
  } : {}

  return (
    <>
      <style>{`
        .checkout-input {
          width: 100%; padding: 11px 14px; border-radius: 10px;
          border: 1.5px solid rgba(0,0,0,0.1);
          font-size: 0.9375rem; font-family: 'Plus Jakarta Sans', sans-serif;
          color: #0F1B2D; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box; background: #fff; appearance: none;
        }
        .checkout-input:focus {
          border-color: #FF4D00;
          box-shadow: 0 0 0 3px rgba(255,77,0,0.08);
        }
        .checkout-input::placeholder { color: #9CA3AF; }
        .checkout-label {
          display: block; font-size: 0.875rem; font-weight: 600;
          color: #0F1B2D; margin-bottom: 6px;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .checkout-label span { color: #FF4D00; }
        .checkout-field { margin-bottom: 14px; }
        .checkout-submit {
          width: 100%; color: #fff; padding: 15px 24px;
          border-radius: 12px; font-size: 1rem; font-weight: 700;
          font-family: 'Plus Jakarta Sans', sans-serif;
          border: none; cursor: pointer; transition: opacity 0.2s, transform 0.2s;
        }
        .checkout-submit:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        .checkout-submit:disabled { cursor: not-allowed; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .checkout-spinner {
          display: inline-block; width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #fff; border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes overlay-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modal-in {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .checkout-scroll::-webkit-scrollbar { width: 5px; }
        .checkout-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .step-dot {
          width: 28px; height: 28px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.75rem; font-weight: 700;
          font-family: 'Plus Jakarta Sans', sans-serif;
          transition: background 0.2s, color 0.2s;
        }
        @media (max-width: 540px) {
          .checkout-row { grid-template-columns: 1fr !important; }
          .modal-box { border-radius: 16px 16px 0 0 !important; margin-top: auto !important; }
          .modal-overlay { align-items: flex-end !important; }
        }
      `}</style>

      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(8,14,24,0.78)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
          animation: 'overlay-in 0.2s ease',
        }}
        className="modal-overlay"
      >
        {/* Box */}
        <div
          className="modal-box"
          onClick={e => e.stopPropagation()}
          style={{
            background: '#fff', borderRadius: 20,
            width: '100%', maxWidth: 560,
            maxHeight: '92vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
            animation: 'modal-in 0.25s ease',
          }}
        >
          {/* ── Header ── */}
          <div style={{
            padding: '24px 28px 18px',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            flexShrink: 0,
          }}>
            {/* Tier badge */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 16,
            }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#F0F2F5', borderRadius: 100, padding: '5px 14px',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.8125rem', fontWeight: 600, color: '#0F1B2D',
              }}>
                <span>{meta.emoji}</span>
                {meta.label}
                <span style={{
                  color: '#FF4D00', fontFamily: 'Syne, sans-serif',
                  fontWeight: 800, marginLeft: 4,
                }}>
                  {meta.price}
                </span>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: '#F0F2F5', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1rem', color: '#6B7280', transition: 'background 0.15s',
                }}
              >
                ✕
              </button>
            </div>

            {/* Step indicators */}
            {step !== 'success' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {[
                  { key: 'vehicle', label: 'Votre véhicule' },
                  { key: 'payment', label: 'Paiement' },
                ].map((s, i) => {
                  const isActive = step === s.key
                  const isDone   = (s.key === 'vehicle' && step === 'payment')
                  return (
                    <React.Fragment key={s.key}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="step-dot" style={{
                          background: isDone ? '#22C55E' : isActive ? '#FF4D00' : '#F0F2F5',
                          color:       isDone ? '#fff'     : isActive ? '#fff'    : '#9CA3AF',
                        }}>
                          {isDone ? '✓' : i + 1}
                        </div>
                        <span style={{
                          fontFamily: 'Plus Jakarta Sans, sans-serif',
                          fontSize: '0.8125rem',
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? '#0F1B2D' : '#9CA3AF',
                        }}>
                          {s.label}
                        </span>
                      </div>
                      {i === 0 && (
                        <div style={{ flex: 1, height: 1, background: '#E5E7EB', maxWidth: 40 }} />
                      )}
                    </React.Fragment>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Body ── */}
          <div className="checkout-scroll" style={{ overflowY: 'auto', padding: '24px 28px', flexGrow: 1 }}>

            {/* ── SUCCESS ── */}
            {step === 'success' && (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>🎉</div>
                <div style={{
                  fontFamily: 'Syne, sans-serif', fontWeight: 800,
                  fontSize: '1.5rem', color: '#0F1B2D', marginBottom: 10,
                }}>
                  Paiement confirmé !
                </div>
                <div style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '1rem', fontWeight: 300,
                  color: '#6B7280', lineHeight: 1.65,
                  maxWidth: 340, margin: '0 auto 32px',
                }}>
                  Nous vous recontactons sous 2h pour organiser votre {meta.label.toLowerCase()} avec votre expert.
                </div>
                <div style={{
                  background: '#F0FDF4', border: '1px solid #BBF7D0',
                  borderRadius: 10, padding: '14px 20px',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.875rem', color: '#15803D',
                  marginBottom: 28,
                }}>
                  Un email de confirmation a été envoyé à votre adresse.
                </div>
                <button
                  onClick={onClose}
                  style={{
                    background: '#0F1B2D', color: '#fff',
                    padding: '12px 32px', borderRadius: 10,
                    fontSize: '0.9375rem', fontWeight: 700,
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  Fermer
                </button>
              </div>
            )}

            {/* ── STEP 1 : VEHICLE ── */}
            {step === 'vehicle' && (
              <>
                <div style={{
                  fontFamily: 'Syne, sans-serif', fontWeight: 800,
                  fontSize: '1.125rem', color: '#0F1B2D', marginBottom: 4,
                }}>
                  Votre véhicule
                </div>
                <div style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.875rem', fontWeight: 300,
                  color: '#6B7280', marginBottom: 24,
                }}>
                  Ces informations permettent à votre expert de préparer l'intervention.
                </div>

                <form onSubmit={handleVehicleSubmit}>
                  {/* Marque + Modèle */}
                  <div className="checkout-row" style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14,
                  }}>
                    <div className="checkout-field" style={{ marginBottom: 0 }}>
                      <label className="checkout-label">Marque <span>*</span></label>
                      <input
                        className="checkout-input" type="text"
                        placeholder="ex : BMW" required
                        value={vehicle.brand} onChange={handleChange('brand')}
                      />
                    </div>
                    <div className="checkout-field" style={{ marginBottom: 0 }}>
                      <label className="checkout-label">Modèle <span>*</span></label>
                      <input
                        className="checkout-input" type="text"
                        placeholder="ex : Série 3 320d" required
                        value={vehicle.model} onChange={handleChange('model')}
                      />
                    </div>
                  </div>

                  {/* Année */}
                  <div className="checkout-field">
                    <label className="checkout-label">Année <span>*</span></label>
                    <input
                      className="checkout-input" type="number"
                      placeholder="ex : 2019"
                      min="1990" max={CURRENT_YEAR} required
                      style={{ maxWidth: 140 }}
                      value={vehicle.year} onChange={handleChange('year')}
                    />
                  </div>

                  {/* Lien annonce */}
                  <div className="checkout-field">
                    <label className="checkout-label">
                      Lien de l'annonce
                      <span style={{ color: '#9CA3AF', fontWeight: 400, marginLeft: 6 }}>(optionnel)</span>
                    </label>
                    <input
                      className="checkout-input" type="url"
                      placeholder="https://www.leboncoin.fr/..."
                      value={vehicle.url} onChange={handleChange('url')}
                    />
                  </div>

                  {/* Error */}
                  {errorMsg && (
                    <div style={{
                      background: '#FEF2F2', border: '1px solid #FECACA',
                      borderRadius: 10, padding: '12px 16px', marginBottom: 16,
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: '0.875rem', color: '#DC2626',
                      display: 'flex', gap: 8,
                    }}>
                      <span>⚠️</span> {errorMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loadingCheckout}
                    className="checkout-submit"
                    style={{ background: loadingCheckout ? '#9CA3AF' : '#FF4D00' }}
                  >
                    {loadingCheckout ? (
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <span className="checkout-spinner" />
                        Préparation du paiement...
                      </span>
                    ) : 'Continuer vers le paiement →'}
                  </button>
                </form>
              </>
            )}

            {/* ── STEP 2 : PAYMENT ── */}
            {step === 'payment' && clientSecret && (
              <>
                <div style={{
                  fontFamily: 'Syne, sans-serif', fontWeight: 800,
                  fontSize: '1.125rem', color: '#0F1B2D', marginBottom: 4,
                }}>
                  Paiement sécurisé
                </div>
                <div style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.875rem', fontWeight: 300,
                  color: '#6B7280', marginBottom: 24,
                }}>
                  Votre carte est débitée uniquement après confirmation de l'expert.
                </div>

                {/* Récap commande */}
                <div style={{
                  background: '#F8F9FA', borderRadius: 12,
                  padding: '14px 18px', marginBottom: 24,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0F1B2D' }}>
                      {meta.emoji} {meta.label}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#6B7280', fontWeight: 300, marginTop: 2 }}>
                      {vehicle.brand} {vehicle.model} {vehicle.year}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: 'Syne, sans-serif', fontWeight: 800,
                    fontSize: '1.25rem', color: '#0F1B2D',
                  }}>
                    {meta.price}
                  </div>
                </div>

                <Elements stripe={stripePromise} options={stripeOptions}>
                  <PaymentForm
                    onSuccess={() => setStep('success')}
                    onError={(msg) => setErrorMsg(msg)}
                  />
                </Elements>

                {/* Error paiement */}
                {errorMsg && (
                  <div style={{
                    background: '#FEF2F2', border: '1px solid #FECACA',
                    borderRadius: 10, padding: '12px 16px', marginTop: 16,
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: '0.875rem', color: '#DC2626',
                    display: 'flex', gap: 8,
                  }}>
                    <span>⚠️</span> {errorMsg}
                  </div>
                )}

                {/* Trust badges */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 20, marginTop: 20, flexWrap: 'wrap',
                }}>
                  {['🔒 SSL sécurisé', '💳 Powered by Stripe', '🛡️ Paiement protégé'].map((b, i) => (
                    <span key={i} style={{
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: '0.75rem', color: '#9CA3AF',
                    }}>
                      {b}
                    </span>
                  ))}
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    </>
  )
}
