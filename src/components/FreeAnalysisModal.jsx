import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function FreeAnalysisModal({ user, onClose, onMissionCreated }) {
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [km, setKm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!brand.trim() || !model.trim()) {
      setError('Marque et modèle obligatoires')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data, error: insertError } = await supabase
        .from('missions')
        .insert({
          user_id: user.id,
          tier: 'ia_free',
          status: 'in_progress',
          is_free: true,
          exchange_count: 0,
          price_total: 0,
          price_platform: 0,
          price_expert: 0,
          vehicle_brand: brand.trim(),
          vehicle_model: model.trim(),
          vehicle_year: year.trim() || null,
          vehicle_km: km.trim() || null,
        })
        .select()
        .single()

      if (insertError) throw insertError

      onMissionCreated(data)
    } catch (err) {
      console.error('Error creating mission:', err)
      setError('Erreur lors de la création. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <>
      <style>{`
        .free-modal-input:focus {
          outline: none;
          border-color: rgba(255,77,0,0.5) !important;
        }
        .free-modal-input::placeholder { color: rgba(255,255,255,0.25); }
      `}</style>

      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(15,27,45,0.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: '#1A2E45',
            borderRadius: 20,
            padding: '40px 32px',
            maxWidth: 480, width: '100%',
            border: '1px solid rgba(255,255,255,0.1)',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Badge gratuit */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <span style={{
              display: 'inline-block',
              background: 'rgba(0,200,100,0.15)',
              color: '#00c864',
              border: '1px solid rgba(0,200,100,0.3)',
              padding: '4px 14px', borderRadius: 100,
              fontSize: '0.75rem', fontWeight: 700,
              letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>
              ✨ GRATUIT — 10 échanges avec l'expert IA
            </span>
          </div>

          <h2 style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 800,
            fontSize: '1.5rem', color: '#fff',
            textAlign: 'center', marginBottom: 8,
          }}>
            Quel véhicule tu regardes ?
          </h2>

          <p style={{
            color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem',
            textAlign: 'center', lineHeight: 1.6, marginBottom: 28,
          }}>
            Notre expert IA analyse les défauts connus, les points à vérifier, et te prépare pour la visite.
          </p>

          {/* Marque */}
          <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 5 }}>
            Marque *
          </label>
          <input
            className="free-modal-input"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, padding: '12px 14px',
              color: '#fff', fontSize: '0.9375rem', marginBottom: 14,
            }}
            placeholder="Ex: BMW, Peugeot, Mercedes..."
            value={brand}
            onChange={e => setBrand(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          {/* Modèle */}
          <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 5 }}>
            Modèle *
          </label>
          <input
            className="free-modal-input"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, padding: '12px 14px',
              color: '#fff', fontSize: '0.9375rem', marginBottom: 14,
            }}
            placeholder="Ex: Série 3, 3008, Classe A..."
            value={model}
            onChange={e => setModel(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          {/* Année + KM sur la même ligne */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 5 }}>
                Année
              </label>
              <input
                className="free-modal-input"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10, padding: '12px 14px',
                  color: '#fff', fontSize: '0.9375rem',
                }}
                placeholder="2019"
                value={year}
                onChange={e => setYear(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 5 }}>
                Kilométrage
              </label>
              <input
                className="free-modal-input"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10, padding: '12px 14px',
                  color: '#fff', fontSize: '0.9375rem',
                }}
                placeholder="85 000 km"
                value={km}
                onChange={e => setKm(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>

          {error && (
            <p style={{ color: '#FF4D00', fontSize: '0.8125rem', marginBottom: 12 }}>
              {error}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? 'rgba(255,77,0,0.5)' : '#FF4D00',
              color: '#fff', border: 'none', borderRadius: 12,
              padding: '16px', cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1rem',
              marginTop: 4,
            }}
          >
            {loading ? 'Création...' : '🔍 Lancer l\'analyse gratuite'}
          </button>

          <p style={{
            color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem',
            textAlign: 'center', marginTop: 14, lineHeight: 1.5,
          }}>
            10 échanges gratuits · Rapport partiel inclus · Sans engagement
          </p>
        </div>
      </div>
    </>
  )
}
