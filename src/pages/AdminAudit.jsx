import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const ADMIN_EMAILS = ['contact@inspexo.io']
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY

const FONT = 'Plus Jakarta Sans, sans-serif'
const FONT_TITRE = 'Syne, sans-serif'

async function adminFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
      apikey: ANON_KEY,
      ...(options.headers || {}),
    },
  })
  return res.json()
}

/** Décompose un result_json en affirmations auditables, typées comme la table
 *  audits : panne, rappel, incoherence, juridique, photo, prix, cout, raison,
 *  entretien, checklist. */
function extraireAffirmations(result) {
  const claims = []
  const add = (claim_type, claim_text) => {
    const texte = String(claim_text || '').trim().slice(0, 500)
    if (texte) claims.push({ claim_type, claim_text: texte })
  }
  for (const r of result.raisons_principales || []) add('raison', r)
  for (const p of result.points_rassurants || []) add('raison', `[rassurant] ${p}`)
  for (const p of result.pannes_connues || []) {
    add('panne', `${p.titre} — ${p.pertinence || p.symptome || ''}`)
    if (p.rappel_officiel) add('rappel', `${p.titre} : ${p.rappel_officiel}`)
  }
  for (const i of result.incoherences || []) add('incoherence', i)
  if (result.cadre_juridique?.texte) add('juridique', result.cadre_juridique.texte)
  for (const c of result.constats_photo || []) add('photo', `${c.constat} (photo n°${c.photo_index}, ${c.organe})`)
  if (result.prix?.fourchette) {
    const f = result.prix.fourchette
    add('prix', `Fourchette P25 ${f.p25} € · médiane ${f.mediane} € · P75 ${f.p75} € (${f.n} comparables) — ${f.libelle || ''}`)
  } else if (result.prix?.commentaire) {
    add('prix', result.prix.commentaire)
  }
  for (const b of result.budget_12_mois || []) {
    add('cout', `${b.poste} : ${b.cout_min_eur ?? '?'} – ${b.cout_max_eur ?? '?'} €`)
  }
  for (const p of result.negociation?.postes || []) {
    add('cout', `[négociation] ${p.argument} : ${p.cout_min_eur ?? '?'} – ${p.cout_max_eur ?? '?'} € (${p.source_statut})`)
  }
  for (const x of result.entretien?.contradictions || []) add('entretien', `[contradiction] ${x}`)
  for (const x of result.entretien?.operations_non_faites || []) add('entretien', `[non faite] ${x}`)
  for (const op of result.entretien?.du || []) add('entretien', `[déjà dû] ${op.operation}${op.echeance ? ` (dès ${op.echeance})` : ''}`)
  for (const c of (result.checklist_sur_place || []).slice(0, 6)) add('checklist', `${c.quoi} — signal rouge : ${c.signal_rouge}`)
  return claims
}

const VERDICT_COLOR = { vert: '#16A34A', orange: '#D97706', rouge: '#DC2626' }

export default function AdminAudit() {
  const [user, setUser] = useState(undefined)
  const [email, setEmail] = useState('')
  const [lienEtat, setLienEtat] = useState('idle')
  const [stats, setStats] = useState(null)
  const [tirage, setTirage] = useState(null) // { analysis, deja_auditee }
  const [verdicts, setVerdicts] = useState({}) // index -> juste|faux|discutable
  const [etat, setEtat] = useState('idle') // idle | tirage | envoi | envoye | erreur
  const [annonceOuverte, setAnnonceOuverte] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  const chargerStats = useCallback(() => {
    adminFetch('admin-audit?mode=stats').then(d => { if (!d.error) setStats(d) })
  }, [])

  useEffect(() => {
    if (user && ADMIN_EMAILS.includes(user.email)) chargerStats()
  }, [user, chargerStats])

  const tirer = async () => {
    setEtat('tirage')
    setTirage(null)
    setVerdicts({})
    setAnnonceOuverte(false)
    const d = await adminFetch('admin-audit?mode=random')
    setTirage(d.error ? null : d)
    setEtat('idle')
  }

  const claims = useMemo(
    () => (tirage?.analysis ? extraireAffirmations(tirage.analysis.result_json || {}) : []),
    [tirage],
  )

  const envoyer = async () => {
    if (etat === 'envoi' || !tirage?.analysis) return
    const retenus = claims
      .map((c, i) => ({ ...c, verdict: verdicts[i] }))
      .filter(c => c.verdict)
    if (retenus.length === 0) return
    setEtat('envoi')
    const d = await adminFetch('admin-audit', {
      method: 'POST',
      body: JSON.stringify({ analysis_id: tirage.analysis.id, verdicts: retenus }),
    })
    if (d.error) { setEtat('erreur'); return }
    setEtat('envoye')
    chargerStats()
  }

  /* ---------- Auth ---------- */
  if (user === undefined) return null
  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    return (
      <div style={{ minHeight: '100vh', background: '#0F1B2D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
        <div style={{ maxWidth: 380, width: '100%', padding: 24 }}>
          <div style={{ fontFamily: FONT_TITRE, fontWeight: 800, fontSize: '1.375rem', color: '#fff', marginBottom: 8 }}>
            Audit de justesse
          </div>
          {user ? (
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9375rem' }}>
              {user.email} n'est pas administrateur.
            </div>
          ) : lienEtat === 'done' ? (
            <div style={{ color: '#4ADE80', fontSize: '0.9375rem' }}>
              Lien de connexion envoyé — ouvrez l'email sur cet appareil.
            </div>
          ) : (
            <form onSubmit={async (e) => {
              e.preventDefault()
              setLienEtat('sending')
              try {
                const { error } = await supabase.auth.signInWithOtp({
                  email,
                  options: { emailRedirectTo: `${window.location.origin}/admin/audit` },
                })
                setLienEtat(error ? 'erreur' : 'done')
              } catch (_) { setLienEtat('erreur') }
            }}>
              <input
                type="email" required placeholder="email administrateur" value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: 'none', padding: '12px 14px', fontFamily: FONT, fontSize: '0.9375rem', marginBottom: 10 }}
              />
              <button type="submit" disabled={lienEtat === 'sending'} style={{
                width: '100%', background: '#FF4D00', color: '#fff', border: 'none', borderRadius: 10,
                padding: '12px', fontFamily: FONT, fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer',
              }}>
                {lienEtat === 'sending' ? 'Envoi…' : 'Recevoir le lien de connexion'}
              </button>
              {lienEtat === 'erreur' && <div style={{ color: '#F87171', fontSize: '0.8125rem', marginTop: 8 }}>Envoi impossible — réessayez.</div>}
            </form>
          )}
        </div>
      </div>
    )
  }

  /* ---------- Écran d'audit ---------- */
  const a = tirage?.analysis
  const nMarques = Object.keys(verdicts).length
  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA', fontFamily: FONT }}>
      <div style={{ background: '#0F1B2D', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontFamily: FONT_TITRE, fontWeight: 800, color: '#fff', letterSpacing: '2px' }}>
          INSP<span style={{ color: '#FF4D00' }}>E</span>XO · AUDIT
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '0.8125rem' }}>
          {stats && (
            <span>
              {stats.analyses_auditees}/{stats.seuil_publication} analyses auditées
              {stats.analyses_auditees >= stats.seuil_publication ? ' — taux publiés sur /fiabilite' : ''}
            </span>
          )}
          <a href="/admin" style={{ color: 'rgba(255,255,255,0.8)' }}>Dashboard</a>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: FONT_TITRE, fontWeight: 800, fontSize: '1.375rem', color: '#0F1B2D' }}>
              Relecture d'une analyse au hasard
            </div>
            <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>
              Marquez chaque affirmation : juste / fausse / discutable. Les taux alimentent /fiabilite.
            </div>
          </div>
          <button onClick={tirer} disabled={etat === 'tirage'} style={{
            background: '#FF4D00', color: '#fff', border: 'none', borderRadius: 10,
            padding: '12px 20px', fontFamily: FONT, fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer',
            opacity: etat === 'tirage' ? 0.6 : 1,
          }}>
            {etat === 'tirage' ? 'Tirage…' : a ? 'Tirer une autre analyse' : 'Tirer une analyse au hasard'}
          </button>
        </div>

        {stats?.par_type && Object.keys(stats.par_type).length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            {Object.entries(stats.par_type).map(([type, s]) => (
              <span key={type} style={{
                fontSize: '0.75rem', fontWeight: 600, color: '#374151', background: '#fff',
                border: '1px solid rgba(0,0,0,0.08)', borderRadius: 100, padding: '4px 12px',
              }}>
                {type} : {s.fausses}/{s.total} fausses
              </span>
            ))}
          </div>
        )}

        {!a ? (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.07)', padding: '40px 24px', textAlign: 'center', color: '#9CA3AF' }}>
            {etat === 'tirage' ? 'Tirage en cours…' : 'Tirez une analyse pour commencer.'}
          </div>
        ) : (
          <>
            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.07)', padding: '18px 20px', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#0F1B2D' }}>
                    {[a.marque, a.modele, a.annee].filter(Boolean).join(' ') || 'Véhicule non identifié'}
                    {tirage.deja_auditee && <span style={{ color: '#D97706', fontSize: '0.75rem', marginLeft: 8 }}>(déjà auditée)</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                    Analyse du {new Date(a.created_at).toLocaleDateString('fr-FR')} ·{' '}
                    <a href={`/a/${a.id}`} target="_blank" rel="noreferrer" style={{ color: '#1E4D8C' }}>voir la page publique</a>
                  </div>
                </div>
                <span style={{ fontWeight: 800, fontFamily: FONT_TITRE, color: VERDICT_COLOR[a.verdict] || '#6B7280' }}>
                  {a.verdict} · {a.score}/100
                </span>
              </div>
              <button
                onClick={() => setAnnonceOuverte(v => !v)}
                style={{ marginTop: 10, background: 'none', border: 'none', color: '#1E4D8C', cursor: 'pointer', fontFamily: FONT, fontSize: '0.8125rem', fontWeight: 600, padding: 0 }}
              >
                {annonceOuverte ? '▾ Masquer' : '▸ Afficher'} le texte de l'annonce
              </button>
              {annonceOuverte && (
                <pre style={{
                  marginTop: 8, whiteSpace: 'pre-wrap', fontFamily: FONT, fontSize: '0.8125rem',
                  color: '#374151', background: '#F8F9FA', borderRadius: 10, padding: '12px 14px', maxHeight: 300, overflowY: 'auto',
                }}>
                  {a.input_text}
                </pre>
              )}
            </div>

            {claims.map((c, i) => (
              <div key={i} style={{
                background: '#fff', borderRadius: 12, border: '1.5px solid rgba(0,0,0,0.06)',
                padding: '12px 16px', marginBottom: 8, display: 'flex', gap: 12, flexWrap: 'wrap',
                alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ flex: '1 1 380px' }}>
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 700, color: '#1E4D8C', background: 'rgba(30,77,140,0.08)',
                    borderRadius: 100, padding: '2px 10px', marginRight: 8, textTransform: 'uppercase',
                  }}>
                    {c.claim_type}
                  </span>
                  <span style={{ fontSize: '0.875rem', color: '#0F1B2D', lineHeight: 1.5 }}>{c.claim_text}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['juste', '#16A34A'], ['discutable', '#D97706'], ['faux', '#DC2626']].map(([v, couleur]) => (
                    <button
                      key={v}
                      onClick={() => setVerdicts(prev => ({ ...prev, [i]: prev[i] === v ? undefined : v }))}
                      style={{
                        border: `1.5px solid ${verdicts[i] === v ? couleur : 'rgba(0,0,0,0.12)'}`,
                        background: verdicts[i] === v ? `${couleur}18` : '#fff',
                        color: verdicts[i] === v ? couleur : '#6B7280',
                        borderRadius: 100, padding: '6px 12px', fontFamily: FONT,
                        fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
              <button
                onClick={envoyer}
                disabled={etat === 'envoi' || etat === 'envoye' || nMarques === 0}
                style={{
                  background: '#0F1B2D', color: '#fff', border: 'none', borderRadius: 10,
                  padding: '13px 24px', fontFamily: FONT, fontWeight: 700, fontSize: '0.9375rem',
                  cursor: 'pointer', opacity: etat === 'envoi' || nMarques === 0 ? 0.5 : 1,
                }}
              >
                {etat === 'envoi' ? 'Enregistrement…' : etat === 'envoye' ? 'Enregistré ✓' : `Enregistrer ${nMarques} verdict${nMarques > 1 ? 's' : ''}`}
              </button>
              {etat === 'envoye' && (
                <button onClick={tirer} style={{
                  background: '#FF4D00', color: '#fff', border: 'none', borderRadius: 10,
                  padding: '13px 24px', fontFamily: FONT, fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer',
                }}>
                  Analyse suivante →
                </button>
              )}
              {etat === 'erreur' && <span style={{ color: '#B91C1C', fontSize: '0.875rem' }}>Enregistrement impossible — réessayez.</span>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
