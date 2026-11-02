import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const ADMIN_EMAILS = ['contact@inspexo.io']

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL
const ANON_KEY     = process.env.REACT_APP_SUPABASE_ANON_KEY

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function adminFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
      'apikey':        ANON_KEY,
      ...(options.headers || {}),
    },
  })
  return res.json()
}

// Les onglets Missions, Candidatures et Statistiques du parcours experts
// d'avant le pivot ont été retirés au sprint 8 : ils ne lisaient que les
// tables héritées (missions, expert_applications), désormais sans aucun
// accès, via des fonctions edge retirées. Le recrutement passe par
// /inspecteur/inscription et le suivi par l'onglet Inspecteurs.

// ─── Composants utilitaires ───────────────────────────────────────────────────

function Spinner({ label }) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 0' }}>
      <div style={{
        width: 32, height: 32, border: '3px solid rgba(15,27,45,0.08)',
        borderTopColor: '#FF4D00', borderRadius: '50%',
        animation: 'admin-spin 0.7s linear infinite', margin: '0 auto 16px',
      }} />
      <div style={{ fontFamily: 'var(--sans)', fontSize: '0.9375rem', color: '#6B7280' }}>{label}</div>
    </div>
  )
}

function ErrorBox({ msg }) {
  return (
    <div style={{
      background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '20px 24px',
      fontFamily: 'var(--sans)', fontSize: '0.9375rem', color: '#DC2626',
    }}>
      {msg}
    </div>
  )
}

function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 24px' }}>
      <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: '1.125rem', color: '#0F1B2D', marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: 'var(--sans)', fontSize: '0.9375rem', color: '#6B7280' }}>{sub}</div>
    </div>
  )
}

// ─── Onglet Coûts de réparation (négociation chiffrée) ────────────────────────

function fileEnDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function CoutsTab() {
  const [couts, setCouts]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [q, setQ]             = useState('')
  const [statut, setStatut]   = useState('')
  const [enCours, setEnCours] = useState(null) // id en cours de validation
  const [devisFichier, setDevisFichier] = useState(null)
  const [minDevis, setMinDevis] = useState('')
  const [maxDevis, setMaxDevis] = useState('')
  const [message, setMessage]   = useState(null)

  const fetchCouts = useCallback(async () => {
    setLoading(true); setError(null)
    const params = new URLSearchParams()
    if (statut) params.set('statut', statut)
    if (q) params.set('q', q)
    const data = await adminFetch(`admin-repair-costs${params.toString() ? `?${params}` : ''}`)
    if (data.error) { setError(data.error); setLoading(false); return }
    setCouts(data.couts || [])
    setLoading(false)
  }, [statut, q])

  useEffect(() => { fetchCouts() }, [fetchCouts])

  const valider = async (id) => {
    if (!devisFichier) { setMessage('La photo du devis est obligatoire pour valider.'); return }
    setMessage(null)
    const devis_image = await fileEnDataUrl(devisFichier)
    const body = { id, statut: 'valide_devis', devis_image }
    if (minDevis) body.cout_min_eur = Number(minDevis)
    if (maxDevis) body.cout_max_eur = Number(maxDevis)
    const data = await adminFetch('admin-repair-costs', { method: 'PATCH', body: JSON.stringify(body) })
    if (data.error) { setMessage(data.error); return }
    setEnCours(null); setDevisFichier(null); setMinDevis(''); setMaxDevis('')
    fetchCouts()
  }

  if (loading) return <Spinner label="Chargement des coûts..." />
  if (error)   return <ErrorBox msg={error} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={styles.pageTitle}>Coûts de réparation</div>
          <div style={styles.pageSub}>
            {couts.length} ligne{couts.length !== 1 ? 's' : ''} — base de la marge de négociation.
            « Validé par devis » = fourchette confirmée par un devis réel (photo jointe obligatoire).
          </div>
        </div>
        <button onClick={fetchCouts} style={styles.refreshBtn}>↻ Actualiser</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <input
          placeholder="Rechercher une opération…" value={q} onChange={e => setQ(e.target.value)}
          style={{ flex: '1 1 220px', border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '9px 12px', fontFamily: 'var(--sans)', fontSize: '0.875rem', outline: 'none' }}
        />
        {[['', 'Tous'], ['source', 'Sourcés'], ['valide_devis', 'Validés devis']].map(([val, lbl]) => (
          <button key={val} onClick={() => setStatut(val)} style={{
            padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
            border: statut === val ? '1.5px solid #FF4D00' : '1.5px solid rgba(0,0,0,0.12)',
            background: statut === val ? '#FFF4EE' : '#fff',
            color: statut === val ? '#FF4D00' : '#6B7280',
            fontFamily: 'var(--sans)', fontSize: '0.8125rem', fontWeight: 600,
          }}>
            {lbl}
          </button>
        ))}
      </div>

      {message && <div style={{ marginBottom: 12, color: '#DC2626', fontSize: '0.875rem' }}>{message}</div>}

      {couts.map(c => (
        <div key={c.id} style={{
          background: '#fff', border: '1.5px solid rgba(0,0,0,0.07)', borderRadius: 12,
          padding: '14px 16px', marginBottom: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: '1 1 320px' }}>
              <span style={{ fontWeight: 700, color: '#0F1B2D', fontSize: '0.9375rem' }}>{c.operation}</span>
              <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: 2 }}>
                {[c.marque, c.famille].filter(Boolean).join(' · ') || 'Générique (toutes familles)'}
                {c.source_date ? ` · relevé le ${formatDate(c.source_date)}` : ''}
                {(Array.isArray(c.url_source) ? c.url_source : []).slice(0, 2).map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noreferrer" style={{ color: '#1E4D8C', marginLeft: 8 }}>source {i + 1}</a>
                ))}
              </div>
            </div>
            <div style={{ fontWeight: 700, color: '#1E4D8C', whiteSpace: 'nowrap' }}>
              {c.cout_min_eur != null ? `${c.cout_min_eur.toLocaleString('fr-FR')} €` : ''}
              {c.cout_min_eur != null && c.cout_max_eur != null ? ' – ' : ''}
              {c.cout_max_eur != null ? `${c.cout_max_eur.toLocaleString('fr-FR')} €` : ''}
            </div>
            <span style={{
              fontSize: '0.6875rem', fontWeight: 700, borderRadius: 100, padding: '3px 10px',
              background: c.statut === 'valide_devis' ? '#F0FDF4' : '#F0F2F5',
              color: c.statut === 'valide_devis' ? '#16A34A' : '#6B7280',
            }}>
              {c.statut === 'valide_devis' ? 'Validé par devis' : 'Sourcé'}
            </span>
            {c.statut !== 'valide_devis' && (
              <button onClick={() => { setEnCours(enCours === c.id ? null : c.id); setDevisFichier(null); setMessage(null) }} style={styles.refreshBtn}>
                {enCours === c.id ? 'Annuler' : 'Valider par devis'}
              </button>
            )}
          </div>
          {enCours === c.id && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: '#F8F9FA', borderRadius: 10, padding: '12px 14px' }}>
              <input type="file" accept="image/*,application/pdf" onChange={e => setDevisFichier(e.target.files?.[0] || null)} style={{ fontSize: '0.8125rem' }} />
              <input type="number" placeholder={`min (${c.cout_min_eur ?? '—'})`} value={minDevis} onChange={e => setMinDevis(e.target.value)}
                style={{ width: 110, border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '8px 10px', fontSize: '0.8125rem' }} />
              <input type="number" placeholder={`max (${c.cout_max_eur ?? '—'})`} value={maxDevis} onChange={e => setMaxDevis(e.target.value)}
                style={{ width: 110, border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '8px 10px', fontSize: '0.8125rem' }} />
              <button onClick={() => valider(c.id)} style={{
                background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8,
                padding: '9px 16px', fontFamily: 'var(--sans)', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
              }}>
                Confirmer (photo du devis jointe)
              </button>
            </div>
          )}
        </div>
      ))}
      {couts.length === 0 && (
        <EmptyState icon="" title="Aucun coût" sub="Les coûts sourcés arrivent automatiquement avec chaque fiche moteur générée." />
      )}
    </div>
  )
}

// ─── Onglet Pass achat (sprint 7) ─────────────────────────────────────────────

function PassesTab() {
  const [passes, setPasses]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [enCours, setEnCours] = useState(null) // id du remboursement en cours
  const [message, setMessage] = useState(null)

  const fetchPasses = useCallback(async () => {
    setLoading(true); setError(null)
    const data = await adminFetch('admin-passes', { method: 'GET' })
    if (data.error) { setError(data.error); setLoading(false); return }
    setPasses(data.passes || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchPasses() }, [fetchPasses])

  const rembourser = async (p) => {
    const montant = (p.montant_cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })
    // Remboursement Stripe intégral + email au client : irréversible.
    if (!window.confirm(`Rembourser intégralement ${montant} € à ${p.email} ? (Stripe + email de confirmation)`)) return
    setEnCours(p.id); setMessage(null)
    const data = await adminFetch('admin-passes', {
      method: 'POST',
      body: JSON.stringify({ action: 'rembourser', id: p.id }),
    })
    setEnCours(null)
    if (data.error) { setMessage(`Remboursement impossible : ${data.error}`); return }
    setMessage(`Remboursé (${data.refund_status}) — email envoyé à ${p.email}.`)
    fetchPasses()
  }

  const exporterCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lignes = [
      ['email', 'mode', 'statut', 'actif', 'montant_eur', 'retractation_renoncee', 'cgv_version', 'debut', 'fin', 'achete_le', 'stripe_session', 'stripe_payment_intent'].join(';'),
      ...passes.map(p => [
        p.email, p.mode, p.statut, p.actif ? 'oui' : 'non',
        (p.montant_cents / 100).toFixed(2).replace('.', ','),
        p.retractation_renoncee ? 'oui' : 'non', p.cgv_version ?? '',
        p.debut, p.fin, p.created_at, p.stripe_session, p.stripe_payment_intent ?? '',
      ].map(esc).join(';')),
    ]
    // BOM pour qu'Excel ouvre le CSV en UTF-8 (accents des emails).
    const blob = new Blob(['\uFEFF' + lignes.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `inspexo-passes-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (loading) return <Spinner label="Chargement des Pass..." />
  if (error)   return <ErrorBox msg={error} />

  const actifs = passes.filter(p => p.actif).length
  const ca = passes.filter(p => p.statut !== 'rembourse').reduce((s, p) => s + p.montant_cents, 0) / 100

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={styles.pageTitle}>Pass achat</div>
          <div style={styles.pageSub}>
            {passes.length} Pass vendus — {actifs} actif{actifs !== 1 ? 's' : ''} — {ca.toLocaleString('fr-FR')} € encaissés (hors remboursés).
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exporterCsv} style={styles.refreshBtn} disabled={passes.length === 0}>Export CSV</button>
          <button onClick={fetchPasses} style={styles.refreshBtn}>↻ Actualiser</button>
        </div>
      </div>

      {message && <div style={{ marginBottom: 12, color: '#0F1B2D', fontSize: '0.875rem', fontWeight: 600 }}>{message}</div>}

      {passes.map(p => (
        <div key={p.id} style={{
          background: '#fff', border: '1.5px solid rgba(0,0,0,0.07)', borderRadius: 12,
          padding: '14px 16px', marginBottom: 10,
          display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <div style={{ flex: '1 1 260px' }}>
            <span style={{ fontWeight: 700, color: '#0F1B2D', fontSize: '0.9375rem' }}>{p.email}</span>
            <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: 2 }}>
              {p.mode === 'precommande' ? 'Précommande' : 'Vente'} · acheté le {formatDate(p.created_at)} ·
              valable du {formatDate(p.debut)} au {formatDate(p.fin)} ·
              rétractation {p.retractation_renoncee ? 'renoncée (usage immédiat)' : 'conservée'}
              {p.user_id ? ' · compte rattaché' : ' · compte non rattaché'}
            </div>
          </div>
          <div style={{ fontWeight: 700, color: '#1E4D8C', whiteSpace: 'nowrap' }}>
            {(p.montant_cents / 100).toLocaleString('fr-FR')} €
          </div>
          <span style={{
            fontSize: '0.6875rem', fontWeight: 700, borderRadius: 100, padding: '3px 10px',
            background: p.statut === 'rembourse' ? '#FEF2F2' : p.actif ? '#F0FDF4' : '#F0F2F5',
            color: p.statut === 'rembourse' ? '#DC2626' : p.actif ? '#16A34A' : '#6B7280',
          }}>
            {p.statut === 'rembourse' ? 'Remboursé' : p.actif ? 'Actif' : 'Expiré'}
          </span>
          {p.statut !== 'rembourse' && (
            <button
              onClick={() => rembourser(p)}
              disabled={enCours === p.id}
              style={{
                background: '#fff', color: '#DC2626', border: '1.5px solid rgba(220,38,38,0.35)',
                borderRadius: 8, padding: '8px 14px', fontFamily: 'var(--sans)',
                fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              {enCours === p.id ? 'Remboursement…' : 'Rembourser'}
            </button>
          )}
        </div>
      ))}
      {passes.length === 0 && (
        <EmptyState icon="" title="Aucun Pass vendu" sub="Les achats apparaissent ici dès le premier paiement Stripe confirmé par le webhook." />
      )}
    </div>
  )
}

// ─── Onglet Inspecteurs (sprint 8) ────────────────────────────────────────────

function InspecteursTab() {
  const [data, setData]       = useState({ inspecteurs: [], inspections: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [message, setMessage] = useState(null)
  const [enCours, setEnCours] = useState(null)

  const fetchTout = useCallback(async () => {
    setLoading(true); setError(null)
    const d = await adminFetch('admin-inspecteurs', { method: 'GET' })
    if (d.error) { setError(d.error); setLoading(false); return }
    setData({ inspecteurs: d.inspecteurs || [], inspections: d.inspections || [] })
    setLoading(false)
  }, [])
  useEffect(() => { fetchTout() }, [fetchTout])

  const agir = async (id, action) => {
    let motif = null
    if (action !== 'valider') {
      motif = window.prompt(action === 'refuser' ? 'Motif du refus (envoyé au candidat) :' : 'Motif de la suspension :')
      if (motif === null) return
    }
    setEnCours(id); setMessage(null)
    const d = await adminFetch('admin-inspecteurs', {
      method: 'POST', body: JSON.stringify({ action, id, motif }),
    })
    setEnCours(null)
    if (d.error) { setMessage(d.message ? `${d.error} — ${d.message}` : d.error); return }
    setMessage(action === 'valider' ? 'Inspecteur validé (email envoyé).' : 'Décision enregistrée.')
    fetchTout()
  }

  const voirDocument = async (id) => {
    const d = await adminFetch(`admin-inspecteurs?document=${id}`, { method: 'GET' })
    if (d.url) window.open(d.url, '_blank', 'noopener')
    else setMessage('Attestation indisponible.')
  }

  if (loading) return <Spinner label="Chargement des inspecteurs..." />
  if (error)   return <ErrorBox msg={error} />

  const valides = data.inspecteurs.filter(i => i.statut === 'valide').length
  const enAttente = data.inspecteurs.filter(i => i.statut === 'candidat').length
  const Pastille = ({ ok, children }) => (
    <span style={{
      fontSize: '0.6875rem', fontWeight: 700, borderRadius: 100, padding: '2px 8px', marginRight: 6,
      background: ok ? '#F0FDF4' : '#FEF2F2', color: ok ? '#16A34A' : '#DC2626',
    }}>{ok ? '✓' : '✗'} {children}</span>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={styles.pageTitle}>Inspecteurs</div>
          <div style={styles.pageSub}>
            {valides} validé{valides !== 1 ? 's' : ''} — {enAttente} en attente — {data.inspections.length} inspection(s).
            {valides === 0 && ' Tant qu’aucun inspecteur n’est validé, le service reste fermé au public.'}
          </div>
        </div>
        <button onClick={fetchTout} style={styles.refreshBtn}>↻ Actualiser</button>
      </div>

      {message && <div style={{ marginBottom: 12, fontSize: '0.875rem', fontWeight: 600, color: '#0F1B2D' }}>{message}</div>}

      {data.inspecteurs.map(i => (
        <div key={i.id} style={{
          background: '#fff', border: '1.5px solid rgba(0,0,0,0.07)', borderRadius: 12,
          padding: '14px 16px', marginBottom: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: '1 1 300px' }}>
              <span style={{ fontWeight: 700, color: '#0F1B2D', fontSize: '0.9375rem' }}>{i.nom}</span>
              <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: 2 }}>
                {i.email}{i.telephone ? ` · ${i.telephone}` : ''} · SIRET {i.siret}
                {i.raison_sociale ? ` · ${i.raison_sociale}` : ''} · dép. {(i.departements || []).join(', ') || '—'}
              </div>
            </div>
            <span style={{
              fontSize: '0.6875rem', fontWeight: 700, borderRadius: 100, padding: '3px 10px',
              background: i.statut === 'valide' ? '#F0FDF4' : i.statut === 'candidat' ? '#FFF4EE' : '#F0F2F5',
              color: i.statut === 'valide' ? '#16A34A' : i.statut === 'candidat' ? '#FF4D00' : '#6B7280',
            }}>{i.statut}</span>
          </div>

          <div style={{ marginTop: 10 }}>
            <Pastille ok={i.pieces.siret_valide}>SIRET</Pastille>
            <Pastille ok={i.pieces.rc_pro_valide}>RC pro {i.rc_pro_echeance ? `au ${formatDate(i.rc_pro_echeance)}` : ''}</Pastille>
            <Pastille ok={i.pieces.rc_pro_document}>Attestation</Pastille>
            <Pastille ok={i.pieces.charte_signee}>Charte {i.charte_version || ''}</Pastille>
            <Pastille ok={i.pieces.stripe_pret}>Stripe</Pastille>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {i.rc_pro_document && (
              <button onClick={() => voirDocument(i.id)} style={styles.refreshBtn}>Voir l’attestation</button>
            )}
            {i.statut !== 'valide' && (
              <button onClick={() => agir(i.id, 'valider')} disabled={enCours === i.id} style={{
                background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8,
                padding: '9px 16px', fontFamily: 'var(--sans)', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
              }}>
                {enCours === i.id ? '…' : 'Valider'}
              </button>
            )}
            {i.statut === 'candidat' && (
              <button onClick={() => agir(i.id, 'refuser')} style={styles.refreshBtn}>Refuser</button>
            )}
            {i.statut === 'valide' && (
              <button onClick={() => agir(i.id, 'suspendre')} style={styles.refreshBtn}>Suspendre</button>
            )}
          </div>
        </div>
      ))}
      {data.inspecteurs.length === 0 && (
        <EmptyState icon="" title="Aucun inspecteur" sub="Les candidatures déposées sur /inspecteur/inscription apparaissent ici." />
      )}

      {data.inspections.length > 0 && (
        <>
          <div style={{ ...styles.pageTitle, fontSize: '1rem', marginTop: 28, marginBottom: 10 }}>Inspections</div>
          {data.inspections.map(ins => (
            <div key={ins.id} style={{
              background: '#fff', border: '1.5px solid rgba(0,0,0,0.07)', borderRadius: 12,
              padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between',
              gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.875rem',
            }}>
              <span>
                <strong>INS-{String(ins.ref_num || 0).padStart(5, '0')}</strong> · {ins.code_postal} ·{' '}
                {formatDate(ins.created_at)}
              </span>
              <span style={{ color: '#6B7280' }}>
                {ins.statut}
                {ins.verse_le ? ` · versé ${(ins.part_inspecteur_cents / 100).toLocaleString('fr-FR')} €` : ''}
                {ins.statut === 'faite' && !ins.transfer_id ? ' · VERSEMENT À RÉGULARISER' : ''}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [user, setUser]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]     = useState('passes')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
  }, [])

  // Précharge pour les stats
  useEffect(() => {
    if (!user || !ADMIN_EMAILS.includes(user.email)) return
  }, [user])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner label="Vérification des accès..." />
      </div>
    )
  }

  // Accès refusé
  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0F1B2D',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--sans)',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
                    <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: '1.5rem', color: '#fff', marginBottom: 10 }}>
            Accès refusé
          </div>
          <div style={{ fontSize: '0.9375rem', color: 'rgba(255,255,255,0.5)', marginBottom: 28, fontWeight: 300 }}>
            {user ? `${user.email} n'est pas administrateur.` : 'Vous devez être connecté.'}
          </div>
          <a href="/" style={{
            display: 'inline-block', background: '#FF4D00', color: '#fff',
            padding: '12px 28px', borderRadius: 10, textDecoration: 'none',
            fontWeight: 700, fontSize: '0.9375rem',
          }}>
            ← Retour à l'accueil
          </a>
        </div>
      </div>
    )
  }

  const navItems = [
    { key: 'passes',       label: 'Pass achat' },
    { key: 'inspecteurs',  label: 'Inspecteurs' },
    { key: 'couts',        label: 'Coûts réparation' },
    { key: 'audit',        label: 'Audit justesse', href: '/admin/audit' },
  ]

  return (
    <>
      <style>{`
        @keyframes admin-spin { to { transform: rotate(360deg); } }
        body { margin: 0; }
        .admin-nav-item:hover { background: rgba(255,255,255,0.06) !important; }
        .admin-table tr:hover td { background: #F0F4FF !important; }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'var(--sans)' }}>

        {/* ── Sidebar ── */}
        <aside style={{
          width: 240, flexShrink: 0,
          background: '#0F1B2D',
          display: 'flex', flexDirection: 'column',
          position: 'sticky', top: 0, height: '100vh',
        }}>
          {/* Logo */}
          <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <a href="/" style={{ textDecoration: 'none' }}>
              <span style={{
                fontFamily: 'var(--sans)', fontWeight: 800, fontSize: '1.125rem',
                color: '#fff', letterSpacing: '3px', textTransform: 'uppercase',
              }}>
                INSP<span style={{ color: '#FF4D00' }}>E</span>XO
              </span>
            </a>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'rgba(255,77,0,0.15)', border: '1px solid rgba(255,77,0,0.3)',
              borderRadius: 100, padding: '2px 8px', marginTop: 8,
              fontSize: '0.6875rem', fontWeight: 700, color: '#FF4D00',
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              Admin
            </div>
          </div>

          {/* Nav */}
          <nav style={{ padding: '16px 12px', flexGrow: 1 }}>
            {navItems.map(item => (
              <button
                key={item.key}
                className="admin-nav-item"
                onClick={() => item.href ? (window.location.href = item.href) : setTab(item.key)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--sans)', fontSize: '0.9375rem', fontWeight: 600,
                  textAlign: 'left', marginBottom: 2,
                  background: tab === item.key ? 'rgba(255,77,0,0.15)' : 'transparent',
                  color:      tab === item.key ? '#FF4D00' : 'rgba(255,255,255,0.55)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* User */}
          <div style={{
            padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.07)',
          }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Connecté en tant que</div>
            <div style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.7)', wordBreak: 'break-all' }}>{user.email}</div>
            <button
              onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')}
              style={{
                marginTop: 12, width: '100%', padding: '8px 0',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8, color: '#EF4444', fontSize: '0.8125rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--sans)',
              }}
            >
              Déconnexion
            </button>
          </div>
        </aside>

        {/* ── Contenu principal ── */}
        <main style={{ flexGrow: 1, background: '#F8F9FA', minHeight: '100vh', overflowY: 'auto' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px' }}>
            {tab === 'passes'       && <PassesTab />}
            {tab === 'inspecteurs'  && <InspecteursTab />}
            {tab === 'couts'        && <CoutsTab />}
          </div>
        </main>
      </div>
    </>
  )
}

// ─── Styles partagés ──────────────────────────────────────────────────────────

const styles = {
  pageTitle: {
    fontFamily: 'var(--sans)', fontWeight: 800,
    fontSize: '1.5rem', color: '#0F1B2D', marginBottom: 4,
  },
  pageSub: {
    fontFamily: 'var(--sans)',
    fontSize: '0.9375rem', color: '#6B7280', fontWeight: 400,
  },
  refreshBtn: {
    background: '#fff', border: '1.5px solid rgba(0,0,0,0.1)',
    borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
    fontFamily: 'var(--sans)', fontSize: '0.875rem', fontWeight: 600,
    color: '#374151', transition: 'background 0.15s',
  },
  table: {
    width: '100%', borderCollapse: 'collapse',
    background: '#fff', borderRadius: 16, overflow: 'hidden',
    border: '1.5px solid rgba(0,0,0,0.07)',
    fontFamily: 'var(--sans)',
    boxShadow: '0 2px 12px rgba(15,27,45,0.04)',
  },
  thead: {
    background: '#0F1B2D',
  },
  th: {
    padding: '12px 16px', textAlign: 'left',
    fontSize: '0.6875rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
  },
  tr: { transition: 'background 0.15s' },
  td: {
    padding: '12px 16px', verticalAlign: 'middle',
    borderBottom: '1px solid rgba(0,0,0,0.05)',
  },
  idBadge: {
    display: 'inline-block', background: '#F0F2F5',
    borderRadius: 6, padding: '3px 8px',
    fontSize: '0.75rem', fontWeight: 700, color: '#6B7280',
    letterSpacing: '0.05em', fontFamily: 'monospace',
  },
  select: {
    padding: '6px 10px', borderRadius: 8,
    border: '1.5px solid rgba(0,0,0,0.1)',
    fontSize: '0.8125rem', fontWeight: 600,
    fontFamily: 'var(--sans)',
    background: '#fff', cursor: 'pointer', outline: 'none',
  },
  actionBtn: {
    padding: '6px 12px', borderRadius: 8,
    border: '1px solid rgba(0,0,0,0.1)',
    background: '#F8F9FA', color: '#374151',
    fontSize: '0.8125rem', fontWeight: 600,
    fontFamily: 'var(--sans)',
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  brandPill: {
    display: 'inline-block', background: 'rgba(255,77,0,0.08)',
    color: '#FF4D00', borderRadius: 100, padding: '2px 8px',
    fontSize: '0.6875rem', fontWeight: 600,
  },
}
