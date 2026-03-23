import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const SUPABASE_URL  = process.env.REACT_APP_SUPABASE_URL
const ANON_KEY      = process.env.REACT_APP_SUPABASE_ANON_KEY

async function callAiChat(messages, missionId, generateReport = false) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session?.access_token || ANON_KEY}`,
      'apikey':        ANON_KEY,
    },
    body: JSON.stringify({ messages, mission_id: missionId, generate_report: generateReport }),
  })
  return res.json()
}

export default function ChatIA({ mission, onClose, onMissionUpdate, onUnlockFullAnalysis, onBookExpert }) {
  const [messages, setMessages]             = useState([])
  const [input, setInput]                   = useState('')
  const [loading, setLoading]               = useState(false)
  const [isClosed, setIsClosed]             = useState(false)
  const [showConfirm, setShowConfirm]       = useState(false)
  const [exchangeCount, setExchangeCount]   = useState(mission?.exchange_count || 0)
  const [showConversion, setShowConversion] = useState(false)
  const [uploadingFile, setUploadingFile]   = useState(false)
  const messagesEndRef = useRef(null)
  const textareaRef    = useRef(null)
  const fileInputRef   = useRef(null)

  const isFree = mission?.is_free && !mission?.converted_to_paid

  // Charge la conversation existante ou démarre automatiquement
  useEffect(() => {
    if (mission?.status === 'completed' || mission?.ai_report) {
      if (mission.ai_conversation?.length) setMessages(mission.ai_conversation)
      setIsClosed(true)
      return
    }

    if (mission?.ai_conversation?.length) {
      setMessages(mission.ai_conversation)
      return
    }

    // Première ouverture : auto-start avec les infos du véhicule
    const initConversation = async () => {
      setLoading(true)
      const vehicleInfo = [
        mission?.vehicle_brand,
        mission?.vehicle_model,
        mission?.vehicle_year ? `(${mission.vehicle_year})` : null,
        mission?.vehicle_km   ? `— ${mission.vehicle_km} km` : null,
      ].filter(Boolean).join(' ')

      const initialMessages = [{
        role: 'user',
        content: `Je regarde un ${vehicleInfo}${mission?.vehicle_url ? ` — annonce : ${mission.vehicle_url}` : ''}.`,
      }]

      try {
        const data = await callAiChat(initialMessages, mission.id)
        if (data.message) {
          setMessages([...initialMessages, { role: 'assistant', content: data.message }])
          if (data.exchange_count !== undefined) setExchangeCount(data.exchange_count)
        }
      } catch (err) {
        console.error('Init chat error:', err)
      } finally {
        setLoading(false)
      }
    }

    initConversation()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [input])

  const sendMessageWithMessages = async (msgs, generateReport = false) => {
    setLoading(true)
    try {
      const data = await callAiChat(msgs, mission.id, generateReport)

      if (!data.message) throw new Error(data.error || 'Réponse vide')

      const assistantMsg = { role: 'assistant', content: data.message }
      setMessages([...msgs, assistantMsg])

      if (data.exchange_count !== undefined) setExchangeCount(data.exchange_count)

      if (data.is_partial_report) {
        setIsClosed(true)
        setShowConversion(true)
        onMissionUpdate?.()
      } else if (data.is_report) {
        setIsClosed(true)
        onMissionUpdate?.()
      }
    } catch (err) {
      console.error('Chat error:', err)
      setMessages([...msgs, {
        role: 'assistant',
        content: '❌ Erreur de connexion avec l\'IA. Réessaie dans quelques secondes.',
      }])
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async (generateReport = false) => {
    if ((!input.trim() && !generateReport) || loading || isClosed) return

    const userMsg     = generateReport ? null : { role: 'user', content: input.trim() }
    const newMessages = userMsg ? [...messages, userMsg] : [...messages]

    if (userMsg) { setMessages(newMessages); setInput('') }

    await sendMessageWithMessages(newMessages, generateReport)
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingFile(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mission_id', mission.id)

      const response = await fetch(`${SUPABASE_URL}/functions/v1/upload-chat-file`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || ANON_KEY}`,
          'apikey': ANON_KEY,
        },
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        const uploadMsg = {
          role: 'user',
          content: `📎 J'ai uploadé un fichier : ${data.file_name} (${file.type === 'application/pdf' ? 'PDF' : 'Image'})`,
        }
        const newMessages = [...messages, uploadMsg]
        setMessages(newMessages)
        await sendMessageWithMessages(newMessages)
      } else {
        alert(data.error || 'Erreur lors de l\'upload')
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Erreur lors de l\'upload du fichier')
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const handleGenerateReport = () => {
    if (messages.length < 2) {
      alert('Pose au moins une question avant de générer le rapport.')
      return
    }
    setShowConfirm(true)
  }

  const handleUnlockFullAnalysis = () => {
    if (onUnlockFullAnalysis) onUnlockFullAnalysis(mission)
  }

  const handleBookExpert = () => {
    if (onBookExpert) onBookExpert(mission)
  }

  const vehicleLabel = [mission?.vehicle_brand, mission?.vehicle_model, mission?.vehicle_year]
    .filter(Boolean).join(' ')

  return (
    <>
      <style>{`
        @keyframes chat-fade-in { from { opacity: 0; } to { opacity: 1; } }
        .chat-textarea:focus { outline: none; border-color: rgba(255,77,0,0.5) !important; }
        .chat-textarea::placeholder { color: rgba(255,255,255,0.3); }
        .chat-scroll::-webkit-scrollbar { width: 4px; }
        .chat-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 10px; }
        .chat-msg-ai { white-space: pre-wrap; word-break: break-word; }
        @keyframes chat-spin { to { transform: rotate(360deg); } }
        .chat-upload-btn:hover { border-color: rgba(255,77,0,0.5) !important; color: #FF4D00 !important; }
      `}</style>

      {/* Plein écran */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#080E18',
        display: 'flex', flexDirection: 'column',
        animation: 'chat-fade-in 0.2s ease',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px', background: '#0F1B2D',
          borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              background: '#FF4D00', color: '#fff',
              padding: '3px 10px', borderRadius: 100,
              fontSize: '0.6875rem', fontWeight: 700,
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              IA Expert
            </span>
            <span style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 800,
              fontSize: '0.9375rem', color: '#fff',
            }}>
              {vehicleLabel || 'Analyse véhicule'}
            </span>
            {isClosed && !showConversion && (
              <span style={{
                background: 'rgba(34,197,94,0.12)', color: '#22C55E',
                border: '1px solid rgba(34,197,94,0.25)',
                padding: '3px 10px', borderRadius: 100,
                fontSize: '0.6875rem', fontWeight: 600,
              }}>
                ✅ Rapport généré
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)', borderRadius: 8,
              padding: '7px 16px', cursor: 'pointer',
              fontSize: '0.8125rem', fontWeight: 600,
            }}
          >
            {isClosed ? 'Fermer' : 'Réduire'}
          </button>
        </div>

        {/* ── Compteur d'échanges (mode gratuit) ── */}
        {isFree && (
          <div style={{
            padding: '8px 24px', background: 'rgba(255,77,0,0.08)',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexShrink: 0,
          }}>
            <span style={{
              color: exchangeCount >= 8 ? '#FF4D00' : 'rgba(255,255,255,0.5)',
              fontSize: '0.8125rem', fontWeight: exchangeCount >= 8 ? 600 : 400,
            }}>
              Échange {exchangeCount}/10
            </span>
            <div style={{
              width: 120, height: 4,
              background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden',
            }}>
              <div style={{
                width: `${Math.min((exchangeCount / 10) * 100, 100)}%`,
                height: '100%',
                background: exchangeCount >= 8 ? '#FF4D00' : '#00c864',
                borderRadius: 2, transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        )}

        {/* ── Messages ── */}
        <div className="chat-scroll" style={{
          flex: 1, overflowY: 'auto',
          padding: '28px 24px',
          display: 'flex', flexDirection: 'column', gap: 16,
          maxWidth: 860, width: '100%', margin: '0 auto',
          alignSelf: 'stretch',
          position: 'relative',
        }}>
          {messages.length === 0 && !loading && (
            <div style={{ textAlign: 'center', marginTop: 64, color: 'rgba(255,255,255,0.25)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>💬</div>
              <div style={{ fontSize: '0.9375rem' }}>Démarrage de l'analyse...</div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '82%',
            }}>
              {msg.role === 'assistant' && (
                <div style={{
                  fontSize: '0.6875rem', fontWeight: 600, color: '#FF4D00',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: 6,
                }}>
                  Expert IA Inspexo
                </div>
              )}
              <div
                className={msg.role === 'assistant' ? 'chat-msg-ai' : ''}
                style={{
                  background: msg.role === 'user'
                    ? '#FF4D00'
                    : 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  padding: '13px 18px',
                  borderRadius: msg.role === 'user'
                    ? '18px 18px 4px 18px'
                    : '4px 18px 18px 18px',
                  fontSize: '0.9375rem', lineHeight: 1.65,
                  whiteSpace: msg.role === 'user' ? 'normal' : 'pre-wrap',
                  wordBreak: 'break-word',
                  border: msg.role === 'assistant'
                    ? '1px solid rgba(255,255,255,0.08)'
                    : 'none',
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 18, height: 18,
                border: '2px solid rgba(255,255,255,0.12)',
                borderTopColor: '#FF4D00', borderRadius: '50%',
                animation: 'chat-spin 0.7s linear infinite',
              }} />
              <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.4)' }}>
                L'expert IA analyse...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input ── */}
        {isClosed && !showConversion ? (
          <div style={{
            padding: '16px 24px', background: '#0F1B2D',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            textAlign: 'center', flexShrink: 0,
          }}>
            <span style={{ fontSize: '0.9375rem', color: 'rgba(255,255,255,0.4)' }}>
              ✅ Conversation clôturée — Rapport généré
            </span>
          </div>
        ) : !showConversion ? (
          <div style={{
            padding: '14px 24px', background: '#0F1B2D',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', gap: 10, alignItems: 'flex-end',
            flexShrink: 0, maxWidth: 860, width: '100%', margin: '0 auto',
            alignSelf: 'stretch',
          }}>
            {/* Bouton génerer rapport — masqué en mode gratuit */}
            {!isFree && (
              <button
                onClick={handleGenerateReport}
                disabled={loading || messages.length < 2}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,77,0,0.5)',
                  color: messages.length < 2 ? 'rgba(255,77,0,0.3)' : '#FF4D00',
                  borderRadius: 10, padding: '10px 16px',
                  cursor: messages.length < 2 ? 'not-allowed' : 'pointer',
                  fontSize: '0.8125rem', fontWeight: 700,
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                📋 Générer le rapport
              </button>
            )}

            {/* Upload fichier */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <button
              className="chat-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile || loading || isClosed}
              title="Uploader un devis ou une facture (JPG, PNG, PDF)"
              style={{
                background: 'none',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10, padding: '10px 12px',
                cursor: uploadingFile || loading ? 'not-allowed' : 'pointer',
                color: 'rgba(255,255,255,0.5)', fontSize: '1.125rem',
                flexShrink: 0, transition: 'border-color 0.2s, color 0.2s',
              }}
            >
              {uploadingFile ? '⏳' : '📎'}
            </button>

            <textarea
              ref={textareaRef}
              className="chat-textarea"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pose ta question à l'expert IA... (Entrée pour envoyer)"
              rows={1}
              disabled={loading}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '10px 14px',
                color: '#fff', fontSize: '0.9375rem',
                resize: 'none', maxHeight: 120, lineHeight: 1.5,
              }}
            />

            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              style={{
                background: loading || !input.trim() ? 'rgba(255,77,0,0.3)' : '#FF4D00',
                border: 'none', borderRadius: 10,
                padding: '10px 20px', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                color: '#fff', fontSize: '0.9375rem', fontWeight: 700,
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {loading ? '...' : 'Envoyer'}
            </button>
          </div>
        ) : null}

        {/* ── Écran de conversion (rapport partiel atteint) ── */}
        {showConversion && (
          <div style={{
            borderTop: '2px solid #FF4D00',
            background: '#0F1B2D',
            padding: '32px 24px',
            flexShrink: 0,
            maxWidth: 860, width: '100%', margin: '0 auto',
            alignSelf: 'stretch',
          }}>
            <h3 style={{
              color: '#fff', fontFamily: 'Syne, sans-serif', fontWeight: 800,
              fontSize: '1.25rem', textAlign: 'center', marginBottom: 8,
            }}>
              Analyse gratuite terminée
            </h3>
            <p style={{
              color: 'rgba(255,255,255,0.55)', fontSize: '0.875rem',
              textAlign: 'center', lineHeight: 1.6, marginBottom: 24,
            }}>
              Tu as identifié les points critiques. Pour obtenir les coûts détaillés et les arguments de négociation :
            </p>

            <button
              onClick={handleUnlockFullAnalysis}
              style={{
                width: '100%', background: '#FF4D00', color: '#fff',
                border: 'none', borderRadius: 12, padding: '16px',
                fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1rem',
                cursor: 'pointer', marginBottom: 10,
              }}
            >
              🔓 Débloquer l'analyse complète — 9,90€
            </button>

            <button
              onClick={handleBookExpert}
              style={{
                width: '100%', background: 'transparent', color: '#FF4D00',
                border: '1px solid #FF4D00', borderRadius: 12, padding: '14px',
                fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, fontSize: '0.9rem',
                cursor: 'pointer', marginBottom: 10,
              }}
            >
              👨‍🔧 Réserver un expert physique — à partir de 59€
            </button>

            <button
              onClick={onClose}
              style={{
                width: '100%', background: 'transparent', color: 'rgba(255,255,255,0.35)',
                border: 'none', padding: '10px',
                fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.8125rem',
                cursor: 'pointer',
              }}
            >
              Quitter avec le rapport partiel
            </button>

            <p style={{
              color: 'rgba(255,255,255,0.25)', fontSize: '0.6875rem',
              textAlign: 'center', marginTop: 14,
            }}>
              Tu peux retrouver ton rapport partiel dans "Mes missions"
            </p>
          </div>
        )}
      </div>

      {/* ── Modal de confirmation rapport (mode payant) ── */}
      {showConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10001,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: '#1A2E45', borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.12)',
            padding: '36px 32px', maxWidth: 440, width: '100%',
            textAlign: 'center',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 14 }}>⚠️</div>
            <div style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 800,
              fontSize: '1.25rem', color: '#fff', marginBottom: 10,
            }}>
              Générer le rapport final ?
            </div>
            <p style={{
              fontSize: '0.9375rem', color: 'rgba(255,255,255,0.55)',
              lineHeight: 1.65, marginBottom: 28,
            }}>
              Une fois le rapport généré, cette conversation sera{' '}
              <strong style={{ color: '#FF4D00' }}>définitivement clôturée</strong>.
              Tu ne pourras plus poser de questions.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff', borderRadius: 10,
                  padding: '10px 24px', cursor: 'pointer',
                  fontSize: '0.9375rem', fontWeight: 600,
                }}
              >
                Annuler
              </button>
              <button
                onClick={() => { setShowConfirm(false); sendMessage(true) }}
                style={{
                  background: '#FF4D00', border: 'none',
                  color: '#fff', borderRadius: 10,
                  padding: '10px 24px', cursor: 'pointer',
                  fontSize: '0.9375rem', fontWeight: 700,
                }}
              >
                Générer le rapport
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
