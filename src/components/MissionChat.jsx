import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import useScrollLock from '../hooks/useScrollLock'

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL
const ANON_KEY     = process.env.REACT_APP_SUPABASE_ANON_KEY

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()
  const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return hm
  if (isYesterday) return `Hier ${hm}`
  return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} ${hm}`
}

export default function MissionChat({ mission, currentUser, senderRole, recipientEmail, recipientName, onClose }) {
  const [messages, setMessages]   = useState([])
  const [input, setInput]         = useState('')
  const [sending, setSending]     = useState(false)
  const [loading, setLoading]     = useState(true)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useScrollLock()

  // Charger les messages existants
  useEffect(() => {
    if (!mission?.id) return
    supabase
      .from('messages')
      .select('*')
      .eq('mission_id', mission.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setMessages(data || [])
        setLoading(false)
      })
  }, [mission?.id])

  // Realtime subscription
  useEffect(() => {
    if (!mission?.id) return
    const channel = supabase
      .channel(`mission-chat-${mission.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `mission_id=eq.${mission.id}` },
        (payload) => {
          setMessages(prev => {
            if (prev.find(m => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [mission?.id])

  // Auto-scroll vers le bas à chaque nouveau message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Marquer les messages reçus comme lus
  useEffect(() => {
    const unread = messages.filter(m => !m.read && m.sender_id !== currentUser?.id)
    if (unread.length === 0) return
    supabase
      .from('messages')
      .update({ read: true })
      .in('id', unread.map(m => m.id))
  }, [messages, currentUser?.id])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return

    setSending(true)
    setInput('')

    const { data: inserted, error } = await supabase
      .from('messages')
      .insert({
        mission_id:  mission.id,
        sender_id:   currentUser.id,
        sender_role: senderRole,
        content:     text,
      })
      .select()
      .single()

    if (error) {
      console.error('Message send error:', error)
      setInput(text) // restaurer le texte en cas d'erreur
    } else {
      // Notification email au destinataire
      if (recipientEmail) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': ANON_KEY,
              'Authorization': `Bearer ${session?.access_token || ANON_KEY}`,
            },
            body: JSON.stringify({
              to: recipientEmail,
              template: 'new_message',
              data: {
                sender_name:  currentUser.email,
                recipient_name: recipientName || '',
                brand: mission.vehicle_brand,
                model: mission.vehicle_model,
                vehicle: `${mission.vehicle_brand || ''} ${mission.vehicle_model || ''}`.trim(),
                mission_id: mission.id,
              },
            }),
          })
        } catch (e) {
          console.warn('Email notification failed:', e)
        }
      }
    }
    setSending(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const vehicleLabel = [mission?.vehicle_brand, mission?.vehicle_model, mission?.vehicle_year]
    .filter(Boolean).join(' ')

  return (
    <>
      <style>{`
        .chat-overlay {
          position: fixed; inset: 0; z-index: 10000;
          background: rgba(8,14,24,0.8);
          display: flex; align-items: flex-end; justify-content: center;
        }
        .chat-box {
          width: 100%; max-width: 560px; height: 100%;
          max-height: 92vh; background: #fff;
          display: flex; flex-direction: column;
          border-radius: 20px 20px 0 0;
          overflow: hidden;
        }
        @media (min-width: 600px) {
          .chat-overlay { align-items: center; padding: 16px; }
          .chat-box { border-radius: 20px; max-height: 86vh; }
        }
        .chat-messages {
          flex: 1; overflow-y: auto; padding: 20px 16px;
          display: flex; flex-direction: column; gap: 10px;
          overscroll-behavior: contain;
        }
        .chat-messages::-webkit-scrollbar { width: 4px; }
        .chat-messages::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px; }
        .msg-client {
          align-self: flex-end; max-width: 75%;
          background: #FF4D00; color: #fff;
          border-radius: 16px 16px 4px 16px;
          padding: 10px 14px;
        }
        .msg-expert {
          align-self: flex-start; max-width: 75%;
          background: #F3F4F6; color: #0F1B2D;
          border-radius: 16px 16px 16px 4px;
          padding: 10px 14px;
        }
        .msg-text {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-break: break-word;
        }
        .msg-time {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 11px; opacity: 0.6; margin-top: 4px; text-align: right;
        }
        .chat-input-row {
          display: flex; align-items: flex-end; gap: 8px;
          padding: 12px 16px;
          padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
          border-top: 1px solid rgba(0,0,0,0.08);
          background: #fff;
        }
        .chat-input {
          flex: 1; resize: none; border: 1.5px solid rgba(0,0,0,0.1);
          border-radius: 12px; padding: 10px 14px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 16px; line-height: 1.45; outline: none;
          max-height: 120px; overflow-y: auto;
          transition: border-color 0.2s;
          overscroll-behavior: contain;
        }
        .chat-input:focus { border-color: #FF4D00; }
        .chat-input::placeholder { color: #9CA3AF; }
        .chat-send-btn {
          width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
          background: #FF4D00; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: opacity 0.15s; color: #fff;
        }
        .chat-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .chat-send-btn:not(:disabled):hover { opacity: 0.88; }
      `}</style>

      <div className="chat-overlay" onClick={onClose}>
        <div className="chat-box" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div style={{ background: '#0F1B2D', padding: '20px 20px 16px', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{
                  fontFamily: 'Syne, sans-serif', fontWeight: 800,
                  fontSize: '1.0625rem', color: '#fff', marginBottom: 4,
                }}>
                  {recipientName ? `Chat avec ${recipientName}` : 'Chat mission'}
                </div>
                <div style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.8125rem', color: 'rgba(255,255,255,0.45)',
                }}>
                  {vehicleLabel}
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.6)', fontSize: '1rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {/* Message système — affiché en dur, non stocké */}
            <div style={{
              display: 'flex', justifyContent: 'center', marginBottom: 6,
            }}>
              <div style={{
                background: 'rgba(15,27,45,0.06)',
                borderRadius: 10,
                padding: '8px 14px',
                maxWidth: '90%',
                textAlign: 'center',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '12px',
                color: '#6B7280',
                lineHeight: 1.5,
              }}>
                🔒 Vos échanges via Inspexo garantissent un suivi de mission complet, un rapport détaillé et notre garantie satisfaction 30 jours.
              </div>
            </div>

            {loading ? (
              <div style={{
                textAlign: 'center', color: '#9CA3AF',
                fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.875rem',
                padding: '32px 0',
              }}>
                Chargement...
              </div>
            ) : messages.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '40px 16px',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.875rem', color: '#9CA3AF', lineHeight: 1.6,
              }}>
                <div style={{ fontSize: '2rem', marginBottom: 10 }}>💬</div>
                Démarrez la conversation avec {recipientName || 'votre interlocuteur'}.
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.sender_id === currentUser?.id
                return (
                  <div key={msg.id} className={isOwn ? 'msg-client' : 'msg-expert'}>
                    <div className="msg-text">{msg.content}</div>
                    <div className="msg-time">{formatTime(msg.created_at)}</div>
                  </div>
                )
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="chat-input-row">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Votre message..."
              value={input}
              rows={1}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className="chat-send-btn"
              onClick={handleSend}
              disabled={!input.trim() || sending}
              aria-label="Envoyer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>

        </div>
      </div>
    </>
  )
}
