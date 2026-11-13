import React, { useEffect, useState } from 'react'
import { retourStockAjouter, retourStockSupprimer, retoursStockLister } from '../lib/scoreApi'
import { PAYE_PAR, PIECES } from '../data/retoursStock'
import { FAMILLES_MOTEUR } from '../data/famillesMoteur'

// SPRINT 24 lot 3 (A) — Journal des retours du professionnel. Il ne voit que
// les siens (RPC filtrées sur son compte). Aucune statistique n'est affichée.
const LIBELLE_PAYE = { marchand: 'Marchand', constructeur: 'Constructeur', garantie_commerciale: 'Garantie commerciale', autre: 'Autre' }
const FAMILLES = [...new Map(FAMILLES_MOTEUR.map((f) => [f.famille, `${f.marque} ${f.nom_commercial} (${f.famille})`])).entries()]
const VIDE = { stock_ref: '', date: '', km: '', famille: '', piece: '', cout_ttc: '', paye_par: 'marchand', commentaire: '' }

export default function JournalRetours() {
  const [liste, setListe] = useState([])
  const [f, setF] = useState(VIDE)
  const [erreur, setErreur] = useState('')
  const [dernier, setDernier] = useState(null)
  const charger = () => retoursStockLister().then(setListe).catch(() => setErreur('Journal indisponible (réservé à la formule pro).'))
  useEffect(() => { charger() }, [])
  const champ = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) })

  async function ajouter(e) {
    e.preventDefault(); setErreur('')
    try { await retourStockAjouter(f); setDernier(f); setF(VIDE); charger() } catch (err) {
      setErreur(/famille_inconnue/.test(err.message) ? 'Famille moteur inconnue.' : /date_future/.test(err.message) ? 'La date ne peut pas être dans le futur.' : /pro_requis/.test(err.message) ? 'Réservé à la formule pro.' : 'Enregistrement impossible.')
    }
  }

  return (
    <div className="doc-sec" style={{ marginTop: 40 }}>
      <h2>Journal des retours</h2>
      <p className="c-graphite" style={{ fontSize: 13 }}>Vos retours après vente, visibles par vous seul. Aucune statistique n'en est tirée ni affichée.</p>
      <form onSubmit={ajouter} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10, marginTop: 12 }}>
        <input required maxLength={40} placeholder="Référence de stock" {...champ('stock_ref')} />
        <input required type="date" {...champ('date')} />
        <input required inputMode="numeric" placeholder="Kilométrage" {...champ('km')} />
        <select required {...champ('famille')}><option value="">Famille moteur</option>{FAMILLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select required {...champ('piece')}><option value="">Pièce</option>{PIECES.map((p) => <option key={p} value={p}>{p}</option>)}</select>
        <input required inputMode="decimal" placeholder="Coût TTC (€)" {...champ('cout_ttc')} />
        <select {...champ('paye_par')}>{PAYE_PAR.map((p) => <option key={p} value={p}>Payé par : {LIBELLE_PAYE[p]}</option>)}</select>
        <input maxLength={500} placeholder="Commentaire (facultatif)" {...champ('commentaire')} />
        <button type="submit" className="btn btn-auto" style={{ width: 'auto' }}>Ajouter</button>
      </form>
      {erreur && <p role="alert" style={{ marginTop: 8 }}>{erreur}</p>}
      {dernier && (
        <p style={{ marginTop: 10, fontSize: 14 }}>
          Retour enregistré.{' '}
          <button type="button" className="btn-ghost btn-auto" disabled title="Disponible avec l'outil « Qui paie cette panne ? » (sprint 25)">Qui paie cette panne ?</button>
          <span className="c-graphite" style={{ fontSize: 13 }}> — bientôt : il sera prérempli avec ce retour.</span>
        </p>
      )}
      {liste.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr>{['Date', 'Stock', 'Km', 'Moteur', 'Pièce', 'Coût TTC', 'Payé par', ''].map((h) => <th key={h} style={{ textAlign: 'left', borderBottom: '1px solid var(--filet)', padding: 6 }}>{h}</th>)}</tr></thead>
            <tbody>{liste.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: 6 }}>{r.date_retour}</td><td>{r.stock_ref}</td><td className="num">{Number(r.km).toLocaleString('fr-FR')}</td>
                <td>{r.famille_moteur}</td><td>{r.piece}</td><td className="num">{Number(r.cout_ttc).toLocaleString('fr-FR')} €</td>
                <td>{LIBELLE_PAYE[r.paye_par]}</td>
                <td><button type="button" className="btn-ghost btn-auto" onClick={() => retourStockSupprimer(r.id).then(charger)}>Supprimer</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
