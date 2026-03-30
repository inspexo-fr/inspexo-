import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import useScrollLock from '../hooks/useScrollLock'

const MARQUES_GENERALISTES = [
  'Renault', 'Peugeot', 'Citroën', 'Volkswagen', 'Toyota', 'Dacia', 'Ford',
  'Opel', 'Nissan', 'Hyundai', 'Kia', 'Fiat', 'Skoda', 'Seat', 'Mazda',
  'Subaru', 'Mitsubishi', 'Honda', 'Mini', 'Jeep',
]
const MARQUES_PREMIUM = [
  'BMW', 'Mercedes', 'Audi', 'Volvo', 'Land Rover', 'Jaguar', 'Lexus',
  'Genesis', 'Cadillac', 'Tesla', 'Porsche', 'Maserati', 'Ferrari',
  'Lamborghini', 'Alfa Romeo', 'Lotus', 'Aston Martin', 'McLaren',
  'Bentley', 'Rolls-Royce', 'Dodge', 'Chevrolet',
]

const EXPERIENCE_OPTIONS = ['1-3 ans', '3-5 ans', '5-10 ans', '10+ ans']
const STRUCTURE_OPTIONS = ['Garage indépendant', 'Ex-concession', 'Mécanicien indépendant', 'Passionné/Autodidacte', 'Autre']
const DIPLOMA_OPTIONS = ['CAP Mécanique', 'BEP Mécanique', 'Bac Pro MV', 'BTS MV', 'Expert automobile agréé', 'Aucun diplôme formel', 'Autre']
const AVAILABILITY_OPTIONS = ['Moins de 5h/semaine', '5-10h/semaine', '10-20h/semaine', 'Plus de 20h/semaine']
const INSURANCE_OPTIONS = ['Oui', 'Non', 'Je ne sais pas']

const INITIAL_FORM = {
  full_name: '',
  email: '',
  phone: '',
  experience_years: '',
  structure_type: '',
  diploma: '',
  city: '',
  postal_code: '',
  availability: '',
  has_insurance: '',
  motivation: '',
  technical_answer: '',
}

export default function ExpertApplicationModal({ isOpen, onClose }) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [selectedBrands, setSelectedBrands] = useState([])
  const [cvFile, setCvFile] = useState(null)
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('')

  useScrollLock(isOpen)

  // Close on Escape key
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (isOpen) window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleKeyDown])

  const toggleBrand = (brand) => {
    setSelectedBrands(prev =>
      prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]
    )
  }

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (selectedBrands.length === 0) {
      setErrorMsg('Sélectionnez au moins une marque de spécialité.')
      return
    }
    if (!form.experience_years || !form.structure_type || !form.diploma || !form.availability || !form.has_insurance) {
      setErrorMsg('Merci de remplir tous les champs obligatoires.')
      return
    }
    if ((form.technical_answer || '').trim().length < 100) {
      setErrorMsg('La réponse technique doit contenir au moins 100 caractères.')
      return
    }
    setStatus('loading')
    setErrorMsg('')

    // Upload CV if provided
    let cv_url = null
    if (cvFile) {
      const ext = cvFile.name.split('.').pop()
      const path = `${Date.now()}_${form.email.replace(/[^a-z0-9]/gi, '_')}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('expert-documents').upload(path, cvFile)
      if (uploadErr) {
        setErrorMsg(`Erreur upload fichier : ${uploadErr.message}`)
        setStatus('error')
        return
      }
      const { data: urlData } = supabase.storage.from('expert-documents').getPublicUrl(path)
      cv_url = urlData?.publicUrl || null
    }

    const { error } = await supabase.from('expert_applications').insert([{
      full_name: form.full_name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || null,
      brands: selectedBrands,
      experience_years: form.experience_years,
      structure_type: form.structure_type,
      diploma: form.diploma,
      city: form.city.trim() || null,
      postal_code: form.postal_code.trim() || null,
      availability: form.availability,
      has_insurance: form.has_insurance,
      motivation: form.motivation.trim() || null,
      technical_answer: form.technical_answer.trim(),
      cv_url,
      status: 'pending',
    }])

    if (error) {
      console.group('🔴 Supabase insert error — expert_applications')
      console.error('code    :', error.code)
      console.error('message :', error.message)
      console.error('details :', error.details)
      console.error('hint    :', error.hint)
      console.error('full obj:', error)
      console.groupEnd()
      setErrorMsg(`Erreur (${error.code || '?'}) : ${error.message}`)
      setStatus('error')
    } else {
      setStatus('success')
    }
  }

  const handleReset = () => {
    setForm(INITIAL_FORM)
    setSelectedBrands([])
    setCvFile(null)
    setStatus('idle')
    setErrorMsg('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      <style>{`
        .modal-input {
          width: 100%; padding: 11px 14px; border-radius: 10px;
          border: 1.5px solid rgba(0,0,0,0.1);
          font-size: 0.9375rem; font-family: 'Plus Jakarta Sans', sans-serif;
          color: #0F1B2D; outline: none; transition: border-color 0.2s;
          box-sizing: border-box; background: #fff;
          appearance: none; -webkit-appearance: none;
        }
        .modal-input:focus { border-color: #FF4D00; box-shadow: 0 0 0 3px rgba(255,77,0,0.08); }
        .modal-input::placeholder { color: #9CA3AF; }
        .modal-label {
          display: block; font-size: 0.875rem; font-weight: 600;
          color: #0F1B2D; margin-bottom: 6px;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .modal-label span { color: #FF4D00; margin-left: 2px; }
        .brand-tag {
          padding: 5px 13px; border-radius: 100px;
          font-size: 0.75rem; font-weight: 600;
          font-family: 'Plus Jakarta Sans', sans-serif;
          cursor: pointer; transition: all 0.15s;
          border: 1.5px solid rgba(0,0,0,0.1);
          background: #F8F9FA; color: #4B5563;
          user-select: none;
        }
        .brand-tag:hover { border-color: #FF4D00; color: #FF4D00; background: rgba(255,77,0,0.05); }
        .brand-tag.selected { background: #FF4D00; color: #fff; border-color: #FF4D00; }
        .modal-submit {
          width: 100%; background: #FF4D00; color: #fff;
          padding: 15px 24px; border-radius: 12px;
          font-size: 1rem; font-weight: 700;
          font-family: 'Plus Jakarta Sans', sans-serif;
          border: none; cursor: pointer;
          transition: opacity 0.2s, transform 0.2s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .modal-submit:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        .modal-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .close-btn {
          width: 36px; height: 36px; border-radius: 50%;
          background: #F0F2F5; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.1rem; color: #6B7280;
          transition: background 0.2s, color 0.2s; flex-shrink: 0;
        }
        .close-btn:hover { background: #E5E7EB; color: #0F1B2D; }
        .modal-scroll::-webkit-scrollbar { width: 5px; }
        .modal-scroll::-webkit-scrollbar-track { background: transparent; }
        .modal-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 10px; }
        @keyframes modal-in {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes overlay-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @media (max-width: 640px) {
          .modal-box { border-radius: 16px 16px 0 0 !important; margin-top: auto !important; max-height: 92vh !important; }
          .modal-overlay { align-items: flex-end !important; }
        }
      `}</style>

      {/* Overlay */}
      <div
        className="modal-overlay"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(8,14,24,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
          animation: 'overlay-in 0.2s ease',
        }}
      >
        {/* Modal box */}
        <div
          className="modal-box"
          onClick={e => e.stopPropagation()}
          style={{
            background: '#fff', borderRadius: 20,
            width: '100%', maxWidth: 620,
            maxHeight: '90vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
            animation: 'modal-in 0.25s ease',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '28px 32px 20px',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            flexShrink: 0,
          }}>
            <div>
              <div style={{
                fontFamily: 'Syne, sans-serif', fontWeight: 800,
                fontSize: '1.375rem', color: '#0F1B2D', marginBottom: 4,
              }}>
                Rejoindre le réseau Inspexo
              </div>
              <div style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.875rem', fontWeight: 300, color: '#6B7280',
              }}>
                On vous recontacte sous 48h pour valider votre profil.
              </div>
            </div>
            <button className="close-btn" onClick={onClose} aria-label="Fermer">✕</button>
          </div>

          {/* Body */}
          <div className="modal-scroll" style={{ overflowY: 'auto', padding: '28px 32px', flexGrow: 1 }}>

            {status === 'success' ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
                <div style={{
                  fontFamily: 'Syne, sans-serif', fontWeight: 800,
                  fontSize: '1.375rem', color: '#0F1B2D', marginBottom: 10,
                }}>
                  Candidature envoyée !
                </div>
                <div style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '1rem', fontWeight: 300,
                  color: '#6B7280', lineHeight: 1.65, marginBottom: 32, maxWidth: 360, margin: '0 auto 32px',
                }}>
                  Nous vous recontactons sous 48h pour la suite de votre candidature.
                </div>
                <button
                  onClick={handleReset}
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
            ) : (
              <form onSubmit={handleSubmit}>

                {/* Row : Nom + Email */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div>
                    <label className="modal-label">Nom complet <span>*</span></label>
                    <input
                      className="modal-input" type="text" placeholder="Jean Dupont"
                      required value={form.full_name} onChange={handleChange('full_name')}
                    />
                  </div>
                  <div>
                    <label className="modal-label">Email <span>*</span></label>
                    <input
                      className="modal-input" type="email" placeholder="jean@exemple.com"
                      required value={form.email} onChange={handleChange('email')}
                    />
                  </div>
                </div>

                {/* Row : Téléphone */}
                <div style={{ marginBottom: 14 }}>
                  <label className="modal-label">Téléphone</label>
                  <input
                    className="modal-input" type="tel" placeholder="06 12 34 56 78"
                    value={form.phone} onChange={handleChange('phone')}
                  />
                </div>

                {/* Row : Expérience + Structure */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div>
                    <label className="modal-label">Années d'expérience <span>*</span></label>
                    <select className="modal-input" required value={form.experience_years} onChange={handleChange('experience_years')}>
                      <option value="">Sélectionner</option>
                      {EXPERIENCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="modal-label">Type de structure <span>*</span></label>
                    <select className="modal-input" required value={form.structure_type} onChange={handleChange('structure_type')}>
                      <option value="">Sélectionner</option>
                      {STRUCTURE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>

                {/* Row : Diplôme + Assurance RC Pro */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div>
                    <label className="modal-label">Diplôme ou certification <span>*</span></label>
                    <select className="modal-input" required value={form.diploma} onChange={handleChange('diploma')}>
                      <option value="">Sélectionner</option>
                      {DIPLOMA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="modal-label">Assurance RC Pro <span>*</span></label>
                    <select className="modal-input" required value={form.has_insurance} onChange={handleChange('has_insurance')}>
                      <option value="">Sélectionner</option>
                      {INSURANCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>

                {/* Row : Ville + Code postal */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div>
                    <label className="modal-label">Ville <span>*</span></label>
                    <input
                      className="modal-input" type="text" placeholder="Toulouse" required
                      value={form.city} onChange={handleChange('city')}
                    />
                  </div>
                  <div>
                    <label className="modal-label">Code postal <span>*</span></label>
                    <input
                      className="modal-input" type="text" placeholder="31000" required
                      value={form.postal_code} onChange={handleChange('postal_code')}
                    />
                  </div>
                </div>

                {/* Disponibilité */}
                <div style={{ marginBottom: 20 }}>
                  <label className="modal-label">Disponibilité estimée <span>*</span></label>
                  <select className="modal-input" required value={form.availability} onChange={handleChange('availability')}>
                    <option value="">Sélectionner</option>
                    {AVAILABILITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                {/* Marques — multi-select pills */}
                <div style={{ marginBottom: 20 }}>
                  <label className="modal-label">
                    Marques de spécialisation <span>*</span>
                    {selectedBrands.length > 0 && (
                      <span style={{
                        marginLeft: 8, color: '#6B7280', fontWeight: 400, fontSize: '0.8125rem',
                      }}>
                        ({selectedBrands.length} sélectionnée{selectedBrands.length > 1 ? 's' : ''})
                      </span>
                    )}
                  </label>

                  {/* Généralistes */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: '0.75rem', fontWeight: 600,
                      color: '#9CA3AF', textTransform: 'uppercase',
                      letterSpacing: '0.08em', marginBottom: 8,
                    }}>
                      🚗 Généralistes
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {MARQUES_GENERALISTES.map(b => (
                        <button
                          key={b} type="button"
                          className={`brand-tag${selectedBrands.includes(b) ? ' selected' : ''}`}
                          onClick={() => toggleBrand(b)}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Premium */}
                  <div>
                    <div style={{
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: '0.75rem', fontWeight: 600,
                      color: '#9CA3AF', textTransform: 'uppercase',
                      letterSpacing: '0.08em', marginBottom: 8,
                    }}>
                      💎 Premium & Sportives
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {MARQUES_PREMIUM.map(b => (
                        <button
                          key={b} type="button"
                          className={`brand-tag${selectedBrands.includes(b) ? ' selected' : ''}`}
                          onClick={() => toggleBrand(b)}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Question technique */}
                <div style={{ marginBottom: 20 }}>
                  <label className="modal-label">
                    Question technique <span>*</span>
                  </label>
                  <div style={{
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: '0.8125rem', fontWeight: 400,
                    color: '#6B7280', lineHeight: 1.5, marginBottom: 8,
                  }}>
                    Pour la marque principale que vous avez sélectionnée, décrivez un défaut mécanique récurrent, comment vous le diagnostiquez, et l'estimation du coût de réparation.
                  </div>
                  <textarea
                    className="modal-input" required minLength={100}
                    placeholder="Ex : Sur les BMW Série 3 F30 avec moteur N47, le défaut récurrent est..."
                    rows={5}
                    style={{ resize: 'vertical', minHeight: 110, lineHeight: 1.6 }}
                    value={form.technical_answer} onChange={handleChange('technical_answer')}
                  />
                  <div style={{
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: '0.75rem', color: (form.technical_answer || '').length >= 100 ? '#16A34A' : '#9CA3AF',
                    marginTop: 4,
                  }}>
                    {(form.technical_answer || '').length}/100 caractères minimum
                  </div>
                </div>

                {/* Motivation */}
                <div style={{ marginBottom: 20 }}>
                  <label className="modal-label">Motivation (optionnel)</label>
                  <textarea
                    className="modal-input"
                    placeholder="Parlez-nous de votre parcours, de votre spécialité, et de ce qui vous motive à rejoindre Inspexo..."
                    rows={3}
                    style={{ resize: 'vertical', minHeight: 70, lineHeight: 1.6 }}
                    value={form.motivation} onChange={handleChange('motivation')}
                  />
                </div>

                {/* Upload CV */}
                <div style={{ marginBottom: 24 }}>
                  <label className="modal-label">CV ou justificatif (optionnel)</label>
                  <div style={{
                    border: '1.5px dashed rgba(0,0,0,0.15)',
                    borderRadius: 10, padding: '16px 14px',
                    textAlign: 'center', cursor: 'pointer',
                    background: cvFile ? '#F0FDF4' : '#FAFAFA',
                    transition: 'background 0.2s',
                  }}
                    onClick={() => document.getElementById('cv-upload').click()}
                  >
                    <input
                      id="cv-upload" type="file" accept=".pdf,.jpg,.jpeg,.png"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        if (f.size > 5 * 1024 * 1024) {
                          setErrorMsg('Le fichier ne doit pas dépasser 5 Mo.')
                          return
                        }
                        setCvFile(f)
                        setErrorMsg('')
                      }}
                    />
                    {cvFile ? (
                      <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.875rem', color: '#16A34A', fontWeight: 600 }}>
                        ✅ {cvFile.name}
                      </div>
                    ) : (
                      <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.875rem', color: '#6B7280' }}>
                        📎 Cliquez pour uploader (PDF, JPG, PNG — max 5 Mo)
                      </div>
                    )}
                  </div>
                </div>

                {/* Error message */}
                {(status === 'error' || errorMsg) && (
                  <div style={{
                    background: '#FEF2F2', border: '1px solid #FECACA',
                    borderRadius: 10, padding: '12px 16px',
                    marginBottom: 16,
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: '0.875rem', color: '#DC2626',
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                  }}>
                    <span style={{ flexShrink: 0 }}>⚠️</span>
                    {errorMsg}
                  </div>
                )}

                {/* Submit */}
                <button type="submit" className="modal-submit" disabled={status === 'loading'}>
                  {status === 'loading' ? (
                    <>
                      <span style={{
                        width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)',
                        borderTopColor: '#fff', borderRadius: '50%',
                        display: 'inline-block',
                        animation: 'spin 0.7s linear infinite',
                      }} />
                      Envoi en cours...
                    </>
                  ) : (
                    'Envoyer ma candidature →'
                  )}
                </button>

              </form>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 540px) {
          .modal-box form > div:first-child,
          .modal-box form > div:nth-child(2) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  )
}
