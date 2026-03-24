import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function ReviewModal({ mission, onClose, onSubmitted }) {
  const [rating, setRating]           = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment]         = useState('')
  const [loading, setLoading]         = useState(false)
  const [submitted, setSubmitted]     = useState(false)

  const handleSubmit = async () => {
    if (rating === 0) return
    setLoading(true)

    try {
      const { error: reviewError } = await supabase.from('reviews').insert({
        mission_id:    mission.id,
        expert_id:     mission.expert_id,
        user_id:       mission.user_id,
        rating,
        comment:       comment.trim() || null,
        vehicle_brand: mission.vehicle_brand,
        vehicle_model: mission.vehicle_model,
      })
      if (reviewError) throw reviewError

      await supabase
        .from('missions')
        .update({ review_submitted: true })
        .eq('id', mission.id)

      // Recalculate expert average
      const { data: reviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('expert_id', mission.expert_id)
        .eq('is_visible', true)

      if (reviews && reviews.length > 0) {
        const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        await supabase
          .from('experts')
          .update({
            avg_rating:   Math.round(avg * 10) / 10,
            review_count: reviews.length,
          })
          .eq('id', mission.expert_id)
      }

      setSubmitted(true)
      if (onSubmitted) onSubmitted()
    } catch (err) {
      console.error('Review error:', err)
      alert('Erreur lors de l\'envoi de l\'avis. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  const overlayStyle = {
    position: 'fixed', inset: 0, zIndex: 10000,
    background: 'rgba(15,27,45,0.88)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16,
  }

  const modalStyle = {
    background: '#fff', borderRadius: 20,
    padding: window.innerWidth < 540 ? '28px 20px' : '40px 36px',
    maxWidth: 480, width: '100%', textAlign: 'center',
    maxHeight: '90vh', overflowY: 'auto',
  }

  const titleStyle = {
    fontFamily: 'Syne, sans-serif', fontWeight: 800,
    fontSize: '1.375rem', color: '#0F1B2D', marginBottom: 8,
  }

  const subStyle = {
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    color: '#6B7280', fontSize: '0.875rem', marginBottom: 28,
  }

  if (submitted) {
    return (
      <div style={overlayStyle} onClick={onClose}>
        <div style={modalStyle} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎉</div>
          <div style={titleStyle}>Merci pour ton avis !</div>
          <p style={{ ...subStyle, marginBottom: 28 }}>
            Ton retour aide la communauté Inspexo à trouver les meilleurs experts.
          </p>
          <button
            onClick={onClose}
            style={{
              background: '#FF4D00', color: '#fff',
              border: 'none', borderRadius: 10,
              padding: '12px 32px',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={titleStyle}>Comment s'est passée ta mission ?</div>
        <p style={subStyle}>
          {mission?.vehicle_brand} {mission?.vehicle_model}
          {mission?.vehicle_year ? ` · ${mission.vehicle_year}` : ''}
        </p>

        {/* Stars */}
        <div style={{ marginBottom: 28 }}>
          <div>
            {[1, 2, 3, 4, 5].map(i => (
              <span
                key={i}
                onClick={() => setRating(i)}
                onMouseEnter={() => setHoverRating(i)}
                onMouseLeave={() => setHoverRating(0)}
                style={{
                  fontSize: '2.25rem', cursor: 'pointer', padding: '0 3px',
                  color: i <= (hoverRating || rating) ? '#FF4D00' : '#E5E7EB',
                  transition: 'color 0.12s',
                }}
              >
                ★
              </span>
            ))}
          </div>
          <p style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            color: '#9CA3AF', fontSize: '0.8125rem', marginTop: 8,
          }}>
            {rating === 0 ? 'Clique pour noter'
              : rating === 1 ? 'Décevant'
              : rating === 2 ? 'Moyen'
              : rating === 3 ? 'Correct'
              : rating === 4 ? 'Très bien'
              : 'Excellent'}
          </p>
        </div>

        {/* Comment */}
        <textarea
          style={{
            width: '100%', boxSizing: 'border-box',
            border: '1px solid #E5E7EB', borderRadius: 12,
            padding: '13px 16px', resize: 'none', outline: 'none',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: '0.9375rem', lineHeight: 1.55,
            minHeight: 96, marginBottom: 28, color: '#0F1B2D',
          }}
          placeholder="Ton commentaire (optionnel)..."
          value={comment}
          onChange={e => setComment(e.target.value)}
        />

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid #E5E7EB',
              borderRadius: 10, padding: '11px 24px',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '0.875rem', cursor: 'pointer', color: '#6B7280',
            }}
          >
            Plus tard
          </button>
          <button
            onClick={handleSubmit}
            disabled={rating === 0 || loading}
            style={{
              background: rating === 0 ? '#E5E7EB' : '#FF4D00',
              color: rating === 0 ? '#9CA3AF' : '#fff',
              border: 'none', borderRadius: 10,
              padding: '11px 32px',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontWeight: 600, fontSize: '0.875rem',
              cursor: rating === 0 ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Envoi...' : 'Envoyer mon avis'}
          </button>
        </div>
      </div>
    </div>
  )
}
