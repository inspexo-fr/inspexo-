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


// ─── Onglet Partenaires (assurance / crédit) ─────────────────────────────────
//
// Le contrôle légal vit CÔTÉ SERVEUR (_shared/partenaires.ts) : cet écran se
// contente de relayer les motifs de refus mot pour mot. Rien n'est validé
// ici, pour qu'un contournement du front ne contourne pas la loi.

function telechargerCsv(nom, lignes) {
  // BOM pour qu'Excel ouvre le CSV en UTF-8.
  const blob = new Blob(['﻿' + lignes.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `inspexo-${nom}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
const csvEsc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

const FORMULAIRE_VIDE = {
  type: 'assurance', slug: '', nom: '', url: '', texte_valide: '',
  valide_le: new Date().toISOString().slice(0, 10),
  // Volontairement vide : la rémunération doit être un choix conscient, pas
  // une case préremplie. Le serveur refuse l'enregistrement sans elle.
  remuneration: '',
}

function PartenairesTab() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(FORMULAIRE_VIDE)
  const [motifs, setMotifs] = useState([])
  const [message, setMessage] = useState(null)

  const charger = useCallback(async () => {
    setError(null)
    const r = await adminFetch('admin-partenaires')
    if (r?.error) setError(r.error)
    else setData(r)
  }, [])
  useEffect(() => { charger() }, [charger])

  const enregistrer = async (e) => {
    e.preventDefault()
    setMotifs([]); setMessage(null)
    const r = await adminFetch('admin-partenaires', {
      method: 'POST',
      body: JSON.stringify({ action: 'enregistrer', ...form }),
    })
    if (r?.error === 'texte_refuse') { setMotifs(r.motifs || []); return }
    if (r?.error) { setMotifs([r.error]); return }
    setMessage('Enregistré — et laissé ÉTEINT : un texte modifié doit être réactivé à la main.')
    setForm(FORMULAIRE_VIDE)
    charger()
  }

  const basculer = async (slug, actif) => {
    setMotifs([]); setMessage(null)
    const r = await adminFetch('admin-partenaires', {
      method: 'POST', body: JSON.stringify({ action: 'activer', slug, actif }),
    })
    if (r?.error) { setMotifs(r.motifs || [r.error]); return }
    setMessage(actif ? 'Partenaire activé — il apparaît maintenant sous les verdicts vert et orange.' : 'Partenaire éteint.')
    charger()
  }

  const exporter = () => {
    const stats = new Map((data?.stats ?? []).map(s => [s.partenaire_id, s]))
    const lignes = [['partenaire', 'type', 'slug', 'actif', 'remuneration', 'semaine', 'brut', 'net'].join(';')]
    for (const p of (data?.partenaires ?? [])) {
      for (const sem of (stats.get(p.id)?.par_semaine ?? [])) {
        lignes.push([p.nom, p.type, p.slug, p.actif ? 'oui' : 'non', p.remuneration, sem.semaine, sem.brut, sem.net].map(csvEsc).join(';'))
      }
    }
    telechargerCsv('mises-en-relation', lignes)
  }

  if (error) return <ErrorBox msg={error} />
  if (!data) return <Spinner label="Chargement des partenaires..." />

  const stats = new Map((data.stats ?? []).map(s => [s.partenaire_id, s]))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={styles.pageTitle}>Partenaires</div>
          <div style={styles.pageSub}>
            Mise en relation seulement. Jamais de contenu de contrat, jamais de chiffre commercial,
            jamais sur un verdict rouge.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exporter} style={styles.refreshBtn} disabled={(data.partenaires ?? []).length === 0}>Export CSV</button>
          <button onClick={charger} style={styles.refreshBtn}>↻ Actualiser</button>
        </div>
      </div>

      {message && <div style={{ marginBottom: 12, color: '#0F1B2D', fontSize: '0.875rem', fontWeight: 600 }}>{message}</div>}
      {motifs.length > 0 && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '14px 18px', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, color: '#DC2626', fontSize: '0.875rem', marginBottom: 6 }}>Refusé</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#DC2626', fontSize: '0.875rem', lineHeight: 1.6 }}>
            {motifs.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}

      {(data.partenaires ?? []).length === 0 && (
        <EmptyState title="Aucun partenaire" sub="Rien ne s'affiche sur le site tant qu'aucun partenaire n'est enregistré ET activé." />
      )}

      {(data.partenaires ?? []).map(p => {
        const st = stats.get(p.id)
        return (
          <div key={p.id} style={{ background: '#fff', border: '1.5px solid rgba(0,0,0,0.07)', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: '1 1 260px' }}>
                <span style={{ fontWeight: 700, color: '#0F1B2D', fontSize: '0.9375rem' }}>{p.nom}</span>
                <span style={{
                  marginLeft: 8, fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                  background: p.actif ? 'rgba(22,163,74,0.12)' : 'rgba(0,0,0,0.06)',
                  color: p.actif ? '#16A34A' : '#6B7280',
                }}>{p.actif ? 'ACTIF' : 'ÉTEINT'}</span>
                <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: 2 }}>
                  {p.type} · /go/{p.slug} · texte validé le {formatDate(p.valide_le)} ·
                  {' '}{p.remuneration === 'commission' ? 'commission perçue' : 'aucune rémunération'}
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#374151', marginTop: 8, lineHeight: 1.6 }}>{p.texte_valide}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F1B2D' }}>{st?.total_net ?? 0}</div>
                <div style={{ fontSize: '0.6875rem', color: '#9CA3AF' }}>
                  mises en relation (net)<br />{st?.total_brut ?? 0} brut, robots inclus
                </div>
                <button onClick={() => basculer(p.slug, !p.actif)} style={{ ...styles.refreshBtn, marginTop: 8 }}>
                  {p.actif ? 'Éteindre' : 'Activer'}
                </button>
              </div>
            </div>
            {(st?.par_semaine ?? []).length > 0 && (
              <div style={{ marginTop: 10, borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 8 }}>
                <div style={{ fontSize: '0.6875rem', color: '#9CA3AF', marginBottom: 4 }}>Par semaine — net / brut</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: '0.75rem', color: '#374151' }}>
                  {st.par_semaine.slice(0, 12).map(s => (
                    <span key={s.semaine}>{s.semaine.slice(5)} : <strong>{s.net}</strong> / {s.brut}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}

      <form onSubmit={enregistrer} style={{ background: '#fff', border: '1.5px solid rgba(0,0,0,0.07)', borderRadius: 12, padding: '18px 20px', marginTop: 18 }}>
        <div style={{ fontWeight: 800, color: '#0F1B2D', marginBottom: 4 }}>Enregistrer un partenaire</div>
        <div style={{ fontSize: '0.8125rem', color: '#6B7280', marginBottom: 14, lineHeight: 1.6 }}>
          Le texte doit être celui que le partenaire a validé par écrit. Il est contrôlé côté serveur :
          aucune couverture, aucun prix, aucun taux, aucune mensualité, aucune comparaison.
          Un texte de crédit doit porter la mention légale, et un partenaire crédit ne peut pas être
          activé avant le 20/11/2026. La rémunération déclarée ici est affichée telle quelle à
          l'acheteur, au-dessus du lien : une commission non déclarée viderait de son sens la
          promesse d'indépendance.
        </div>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={styles.input}>
            <option value="assurance">Assurance (garantie panne)</option>
            <option value="credit">Crédit</option>
          </select>
          <input style={styles.input} placeholder="Nom affiché" value={form.nom} required
            onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
          <input style={styles.input} placeholder="slug (a-z, chiffres, tirets)" value={form.slug} required
            onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} />
          <input style={styles.input} placeholder="https://…" value={form.url} required
            onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
          <input style={styles.input} type="date" value={form.valide_le} required
            onChange={e => setForm(f => ({ ...f, valide_le: e.target.value }))} />
          <select value={form.remuneration} required style={styles.input}
            onChange={e => setForm(f => ({ ...f, remuneration: e.target.value }))}>
            <option value="">Rémunération ? (obligatoire)</option>
            <option value="aucune">Aucune rémunération</option>
            <option value="commission">Commission si souscription</option>
          </select>
        </div>
        <textarea style={{ ...styles.input, marginTop: 10, width: '100%', minHeight: 96 }}
          placeholder="Texte validé par le partenaire (20 à 600 caractères)"
          value={form.texte_valide} required maxLength={600}
          onChange={e => setForm(f => ({ ...f, texte_valide: e.target.value }))} />
        <button type="submit" style={{ ...styles.refreshBtn, marginTop: 12 }}>Enregistrer (éteint)</button>
      </form>
    </div>
  )
}

// ─── Onglet Retours d'issue ──────────────────────────────────────────────────

function RetoursTab() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const charger = useCallback(async () => {
    setError(null)
    const r = await adminFetch('admin-retours')
    if (r?.error) setError(r.error)
    else setData(r)
  }, [])
  useEffect(() => { charger() }, [charger])

  const exporter = () => {
    const lignes = [
      ['date', 'vehicule', 'famille', 'verdict', 'score', 'achete', 'prix_affiche', 'prix_paye', 'ecart', 'points_confirmes', 'source', 'commentaire'].join(';'),
      ...(data?.lignes ?? []).map(l => [
        l.date, l.vehicule, l.famille, l.verdict, l.score,
        l.achete === true ? 'oui' : l.achete === false ? 'non' : '',
        l.prix_affiche ?? '', l.prix_paye ?? '',
        (l.prix_affiche != null && l.prix_paye != null) ? l.prix_paye - l.prix_affiche : '',
        l.points_confirmes ?? '', l.source, l.commentaire,
      ].map(csvEsc).join(';')),
    ]
    telechargerCsv('retours', lignes)
  }

  if (error) return <ErrorBox msg={error} />
  if (!data) return <Spinner label="Chargement des retours..." />

  const Chiffre = ({ valeur, libelle, suffixe = '' }) => (
    <div style={{ background: '#fff', border: '1.5px solid rgba(0,0,0,0.07)', borderRadius: 12, padding: '16px 18px', flex: '1 1 160px' }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F1B2D' }}>
        {valeur == null ? '—' : `${valeur}${suffixe}`}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: 2, lineHeight: 1.5 }}>{libelle}</div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={styles.pageTitle}>Retours d'issue</div>
          <div style={styles.pageSub}>
            Une seule invitation par dossier et par email, jamais de relance. Le taux se calcule sur
            les invitations réellement envoyées.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exporter} style={styles.refreshBtn} disabled={(data.lignes ?? []).length === 0}>Export CSV</button>
          <button onClick={charger} style={styles.refreshBtn}>↻ Actualiser</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <Chiffre valeur={data.invitations?.envoyees} libelle="invitations envoyées" />
        <Chiffre valeur={data.invitations?.repondues} libelle="réponses reçues" />
        <Chiffre valeur={data.invitations?.taux_reponse} suffixe=" %" libelle="taux de réponse" />
        <Chiffre valeur={data.reponses?.achats} libelle="véhicules achetés" />
        <Chiffre valeur={data.reponses?.taux_achat} suffixe=" %" libelle="part d'achats parmi les réponses" />
        <Chiffre valeur={data.prix?.ecart_median} suffixe=" €" libelle={`écart médian prix affiché → prix payé (${data.prix?.n ?? 0} cas)`} />
      </div>

      <div style={{ fontWeight: 800, color: '#0F1B2D', marginBottom: 8 }}>Points confirmés, par famille moteur</div>
      {(data.par_famille ?? []).length === 0 && (
        <EmptyState title="Aucun retour pour l'instant" sub="Les invitations partent 3 semaines après l'analyse." />
      )}
      {(data.par_famille ?? []).map(f => (
        <div key={f.famille} style={{
          background: '#fff', border: '1.5px solid rgba(0,0,0,0.07)', borderRadius: 12,
          padding: '12px 16px', marginBottom: 8, display: 'flex', justifyContent: 'space-between',
          gap: 10, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <div>
            <span style={{ fontWeight: 700, color: '#0F1B2D', fontSize: '0.9375rem' }}>{f.famille}</span>
            <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: 2 }}>
              {f.total} retour{f.total > 1 ? 's' : ''} · {f.achats} achat{f.achats > 1 ? 's' : ''}
            </div>
          </div>
          <div style={{ fontSize: '0.8125rem', color: '#374151' }}>
            confirmés <strong style={{ color: '#16A34A' }}>{f.oui}</strong> ·
            {' '}infirmés <strong style={{ color: '#DC2626' }}>{f.non}</strong> ·
            {' '}non vérifiés <strong>{f.pas_verifie}</strong>
          </div>
        </div>
      ))}
    </div>
  )
}


// ─── Onglet Parcours (tunnel de conversion, sans traceur) ────────────────────
//
// Les étapes sont reconstituées côté serveur à partir d'événements reliés par
// analysis_id. Aucun cookie, aucun identifiant navigateur, aucune IP : la
// source est une simple étiquette de campagne, affichée EN AGRÉGÉ seulement.

const ETAPES_TUNNEL = [
  ['analyse_lancee', 'Analyse lancée'],
  ['verdict_affiche', 'Verdict affiché'],
  ['clic_pass', 'Clic Pass'],
  ['paiement_ouvert', 'Paiement ouvert'],
  ['paiement_reussi', 'Paiement réussi'],
  ['clic_inspection', 'Clic inspection'],
  ['liste_attente', "Liste d'attente"],
  ['clic_partenaire', 'Clic partenaire'],
  ['optin_rapport', 'Opt-in rapport'],
  ['retour_issue', "Retour d'issue"],
]

function dureeLisible(secondes) {
  if (secondes == null) return '—'
  const s = Number(secondes)
  if (s < 3600) return `${Math.round(s / 60)} min`
  if (s < 86400) return `${(s / 3600).toFixed(1)} h`
  return `${(s / 86400).toFixed(1)} j`
}

function ParcoursTab() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [semaines, setSemaines] = useState(12)

  const charger = useCallback(async () => {
    setError(null)
    const r = await adminFetch(`admin-parcours?semaines=${semaines}`)
    if (r?.error) setError(r.error)
    else setData(r)
  }, [semaines])
  useEffect(() => { charger() }, [charger])

  if (error) return <ErrorBox msg={error} />
  if (!data) return <Spinner label="Chargement du parcours..." />

  const total = data.total ?? {}
  const base = total.analyse_lancee || 0
  const pct = (n) => (base > 0 ? Math.round((n / base) * 1000) / 10 : 0)

  // Agrégation par source, toutes semaines confondues.
  const parSource = new Map()
  for (const l of (data.semaines ?? [])) {
    if (!parSource.has(l.src)) parSource.set(l.src, Object.fromEntries(ETAPES_TUNNEL.map(([k]) => [k, 0])))
    const acc = parSource.get(l.src)
    for (const [k] of ETAPES_TUNNEL) acc[k] += l[k] || 0
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={styles.pageTitle}>Parcours</div>
          <div style={styles.pageSub}>
            Sans cookie ni traceur : étapes reconstituées côté serveur, reliées à l'analyse.
            Analyses d'éval exclues.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={semaines} onChange={e => setSemaines(Number(e.target.value))} style={styles.input}>
            {[4, 8, 12, 26, 52].map(n => <option key={n} value={n}>{n} semaines</option>)}
          </select>
          <button onClick={charger} style={styles.refreshBtn}>↻ Actualiser</button>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1.5px solid rgba(0,0,0,0.07)', borderRadius: 12, padding: '18px 20px', marginBottom: 18 }}>
        <div style={{ fontWeight: 800, color: '#0F1B2D', marginBottom: 12 }}>
          Tunnel — {base} analyse{base > 1 ? 's' : ''} sur la période
        </div>
        {ETAPES_TUNNEL.map(([cle, label]) => {
          const n = total[cle] || 0
          return (
            <div key={cle} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 3 }}>
                <span style={{ color: '#374151' }}>{label}</span>
                <span style={{ color: '#0F1B2D', fontWeight: 700 }}>{n} · {pct(n)} %</span>
              </div>
              <div style={{ height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct(n)}%`, height: '100%', background: cle === 'paiement_reussi' ? '#16A34A' : '#FF4D00' }} />
              </div>
            </div>
          )
        })}
        <div style={{ marginTop: 14, fontSize: '0.8125rem', color: '#6B7280' }}>
          Délai médian analyse → paiement : <strong style={{ color: '#0F1B2D' }}>
            {dureeLisible(data.delai_median_paiement_s)}
          </strong>
        </div>
      </div>

      <div style={{ fontWeight: 800, color: '#0F1B2D', marginBottom: 8 }}>Par source</div>
      {parSource.size === 0 && <EmptyState title="Aucune analyse sur la période" sub="Les liens étiquetés (?src=…) apparaîtront ici." />}
      {[...parSource.entries()].sort((a, b) => b[1].analyse_lancee - a[1].analyse_lancee).map(([src, v]) => (
        <div key={src} style={{ background: '#fff', border: '1.5px solid rgba(0,0,0,0.07)', borderRadius: 12, padding: '12px 16px', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: '#0F1B2D', fontSize: '0.9375rem' }}>{src}</span>
            <span style={{ fontSize: '0.8125rem', color: '#374151' }}>
              {v.analyse_lancee} analyse{v.analyse_lancee > 1 ? 's' : ''} ·
              {' '}{v.clic_pass} clic Pass · {v.paiement_reussi} payé{v.paiement_reussi > 1 ? 's' : ''} ·
              {' '}{v.clic_inspection} clic inspection
            </span>
          </div>
        </div>
      ))}

      <div style={{ fontWeight: 800, color: '#0F1B2D', margin: '18px 0 8px' }}>Par semaine</div>
      <table style={styles.table}>
        <thead style={styles.thead}>
          <tr>
            <th style={styles.th}>Semaine</th><th style={styles.th}>Source</th>
            {ETAPES_TUNNEL.slice(0, 5).map(([k, l]) => <th key={k} style={styles.th}>{l}</th>)}
          </tr>
        </thead>
        <tbody>
          {(data.semaines ?? []).slice(0, 60).map((l, i) => (
            <tr key={i}>
              <td style={styles.td}>{l.semaine}</td>
              <td style={styles.td}>{l.src}</td>
              {ETAPES_TUNNEL.slice(0, 5).map(([k]) => <td key={k} style={styles.td}>{l[k]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Onglet API ──────────────────────────────────────────────────────────────

function ApiTab() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [nom, setNom] = useState('')
  const [contact, setContact] = useState('')
  const [quota, setQuota] = useState(100)
  const [cleNeuve, setCleNeuve] = useState(null)

  const charger = useCallback(async () => {
    setError(null)
    const r = await adminFetch('admin-api')
    if (r?.error) setError(r.error)
    else setData(r)
  }, [])
  useEffect(() => { charger() }, [charger])

  const creer = async (e) => {
    e.preventDefault()
    const r = await adminFetch('admin-api', {
      method: 'POST',
      body: JSON.stringify({ action: 'creer', nom, contact, quota_mensuel: quota }),
    })
    if (r?.error) { setError(r.error); return }
    setCleNeuve(r)
    setNom(''); setContact('')
    charger()
  }

  const revoquer = async (id, nomClient) => {
    // Irréversible : la clé cesse de fonctionner immédiatement.
    if (!window.confirm(`Révoquer la clé de « ${nomClient} » ? Elle cessera de fonctionner immédiatement.`)) return
    await adminFetch('admin-api', { method: 'POST', body: JSON.stringify({ action: 'revoquer', id }) })
    charger()
  }

  const exporter = () => {
    const parClient = new Map((data?.clients ?? []).map(c => [c.id, c]))
    const lignes = [
      ['client', 'contact', 'mois', 'appels', 'quota_mensuel', 'actif', 'dernier_appel'].join(';'),
      ...(data?.usage ?? []).map(u => {
        const c = parClient.get(u.client_id)
        return [c?.nom ?? u.client_id, c?.contact ?? '', u.mois, u.appels,
          c?.quota_mensuel ?? '', c?.actif ? 'oui' : 'non', u.dernier_appel ?? ''].map(csvEsc).join(';')
      }),
    ]
    telechargerCsv('api-usage', lignes)
  }

  if (error) return <ErrorBox msg={error} />
  if (!data) return <Spinner label="Chargement de l'API..." />

  const usageMois = new Map(
    (data.usage ?? []).filter(u => u.mois === data.mois_courant).map(u => [u.client_id, u]))
  const jourCourant = (data.jours ?? [])[0]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={styles.pageTitle}>API de scoring</div>
          <div style={styles.pageSub}>
            Plafond journalier global : {jourCourant?.appels ?? 0} / {data.plafond_jour_global} appels aujourd'hui.
            Aucune facturation automatique — tarif sur devis.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exporter} style={styles.refreshBtn} disabled={(data.usage ?? []).length === 0}>Export CSV</button>
          <button onClick={charger} style={styles.refreshBtn}>↻ Actualiser</button>
        </div>
      </div>

      {cleNeuve && (
        <div style={{ background: '#FFF4EE', border: '1.5px solid #FF4D00', borderRadius: 12, padding: '16px 18px', marginBottom: 14 }}>
          <div style={{ fontWeight: 800, color: '#0F1B2D', marginBottom: 6 }}>
            Clé de « {cleNeuve.client?.nom} » — affichée une seule fois
          </div>
          <code style={{ display: 'block', background: '#fff', padding: '10px 12px', borderRadius: 8, fontSize: '0.8125rem', wordBreak: 'break-all' }}>
            {cleNeuve.cle}
          </code>
          <div style={{ fontSize: '0.8125rem', color: '#B45309', marginTop: 8 }}>{cleNeuve.avertissement}</div>
          <button onClick={() => setCleNeuve(null)} style={{ ...styles.refreshBtn, marginTop: 10 }}>J'ai noté la clé</button>
        </div>
      )}

      {(data.clients ?? []).length === 0 && (
        <EmptyState title="Aucun client d'API" sub="Créez une clé ci-dessous. Elle ne sera affichée qu'une fois." />
      )}

      {(data.clients ?? []).map(c => {
        const u = usageMois.get(c.id)
        const appels = u?.appels ?? 0
        return (
          <div key={c.id} style={{ background: '#fff', border: '1.5px solid rgba(0,0,0,0.07)', borderRadius: 12, padding: '14px 16px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: '1 1 260px' }}>
              <span style={{ fontWeight: 700, color: '#0F1B2D', fontSize: '0.9375rem' }}>{c.nom}</span>
              <span style={{ marginLeft: 8, fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                background: c.actif ? 'rgba(22,163,74,0.12)' : 'rgba(0,0,0,0.06)',
                color: c.actif ? '#16A34A' : '#6B7280' }}>
                {c.actif ? 'ACTIVE' : 'RÉVOQUÉE'}
              </span>
              <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: 2 }}>
                {c.cle_apercu} · créée le {formatDate(c.created_at)}
                {c.contact ? ` · ${c.contact}` : ''}
                {c.revoque_le ? ` · révoquée le ${formatDate(c.revoque_le)}` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: appels >= c.quota_mensuel ? '#DC2626' : '#0F1B2D' }}>
                {appels} / {c.quota_mensuel}
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#9CA3AF' }}>appels ce mois-ci</div>
              {c.actif && (
                <button onClick={() => revoquer(c.id, c.nom)} style={{ ...styles.refreshBtn, marginTop: 8 }}>Révoquer</button>
              )}
            </div>
          </div>
        )
      })}

      <form onSubmit={creer} style={{ background: '#fff', border: '1.5px solid rgba(0,0,0,0.07)', borderRadius: 12, padding: '18px 20px', marginTop: 18 }}>
        <div style={{ fontWeight: 800, color: '#0F1B2D', marginBottom: 4 }}>Créer une clé</div>
        <div style={{ fontSize: '0.8125rem', color: '#6B7280', marginBottom: 14, lineHeight: 1.6 }}>
          La clé n'est affichée qu'une fois, à sa création : nous n'en conservons qu'une empreinte
          salée et ne pourrons pas vous la rappeler. En cas de perte, il faut en créer une autre.
        </div>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
          <input style={styles.input} placeholder="Nom du client" value={nom} required maxLength={80}
            onChange={e => setNom(e.target.value)} />
          <input style={styles.input} placeholder="Contact (email)" value={contact} maxLength={160}
            onChange={e => setContact(e.target.value)} />
          <input style={styles.input} type="number" min="0" max="100000" value={quota}
            onChange={e => setQuota(Number(e.target.value))} aria-label="Quota mensuel" />
        </div>
        <button type="submit" style={{ ...styles.refreshBtn, marginTop: 12 }}>Créer la clé</button>
      </form>
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

  // Arbitrage d'une annulation contestée. Le barème est automatique ; il peut
  // se tromper sur un cas réel (vendeur qui conteste son absence, inspecteur
  // qui s'est trompé d'adresse). Une inspection ne s'arbitre QU'UNE FOIS.
  const arbitrer = async (ins, decision) => {
    const libelle = decision === 'rembourser_integral'
      ? `rendre les ${(ins.retenue_cents / 100).toLocaleString('fr-FR')} € retenus à l'acheteur`
      : 'confirmer la retenue au bénéfice de l\'inspecteur'
    const note = window.prompt(`Arbitrage INS-${String(ins.ref_num || 0).padStart(5, '0')} — ${libelle}.\n\nNote (conservée, 500 car. max) :`)
    if (note === null) return
    setEnCours(ins.id); setMessage(null)
    const d = await adminFetch('admin-inspecteurs', {
      method: 'PATCH',
      body: JSON.stringify({ inspection_id: ins.id, decision, note }),
    })
    setEnCours(null)
    if (d.error) { setMessage(d.message ? `${d.error} — ${d.message}` : d.error); return }
    setMessage(d.argent_traite === false
      ? `Décision enregistrée, mais le mouvement bancaire a échoué (${d.erreur || 'erreur inconnue'}). À régulariser dans Stripe.`
      : 'Arbitrage enregistré.')
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
                {ins.annulee_par ? ` (${ins.annulee_par})` : ''}
                {ins.autorisee_le && !ins.capturee_le && ins.statut === 'a_attribuer' ? ' · AUTORISÉ, NON DÉBITÉ' : ''}
                {ins.verse_le ? ` · versé ${(ins.part_inspecteur_cents / 100).toLocaleString('fr-FR')} €` : ''}
                {ins.retenue_cents > 0 ? ` · retenue ${(ins.retenue_cents / 100).toLocaleString('fr-FR')} €` : ''}
                {ins.retenue_cents > 0 && !ins.retenue_transfer_id ? ' · INDEMNITÉ NON VERSÉE' : ''}
                {ins.statut === 'faite' && !ins.transfer_id ? ' · VERSEMENT À RÉGULARISER' : ''}
                {ins.arbitre_le ? ` · arbitré : ${ins.arbitrage_decision}` : ''}
              </span>

              {/* Arbitrage : seulement là où il y a une retenue à trancher. */}
              {ins.retenue_cents > 0 && !ins.arbitre_le && (
                <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', width: '100%' }}>
                  {ins.absence_photo_path && (
                    <button type="button" style={styles.refreshBtn} disabled={enCours === ins.id}
                      onClick={async () => {
                        const d = await adminFetch(`admin-inspecteurs?preuve=${ins.id}`, { method: 'GET' })
                        if (d.url) window.open(d.url, '_blank', 'noopener')
                        else setMessage('Photo indisponible.')
                      }}>
                      Voir la preuve
                    </button>
                  )}
                  <button type="button" style={styles.refreshBtn} disabled={enCours === ins.id}
                    onClick={() => arbitrer(ins, 'rembourser_integral')}>
                    Rendre la retenue
                  </button>
                  <button type="button" style={styles.refreshBtn} disabled={enCours === ins.id}
                    onClick={() => arbitrer(ins, 'confirmer_retenue')}>
                    Confirmer la retenue
                  </button>
                </span>
              )}
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
    { key: 'parcours',     label: 'Parcours' },
    { key: 'api',          label: 'API' },
    { key: 'partenaires',  label: 'Partenaires' },
    { key: 'retours',      label: 'Retours' },
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
            {tab === 'parcours'     && <ParcoursTab />}
            {tab === 'api'          && <ApiTab />}
            {tab === 'partenaires'  && <PartenairesTab />}
            {tab === 'retours'      && <RetoursTab />}
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
  input: {
    border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '9px 12px',
    fontFamily: 'var(--sans)', fontSize: '0.875rem', outline: 'none',
    background: '#fff', color: '#0F1B2D',
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
