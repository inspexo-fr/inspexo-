import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import PointsProprietairesBloc from '../components/PointsProprietairesBloc'
import JournalRetours from '../components/JournalRetours'
import { stockCarteGrise, stockFiche, stockLot, stockVin } from '../lib/scoreApi'
import { resizeImageToDataUrl } from '../lib/imageUtils'
import { decoderVin } from '../lib/vin'
import { csvLot } from '../lib/csvLot'

// SPRINT 24 lot 3 — CONTRÔLE D'ENTRÉE EN STOCK (formule pro, drapeau serveur).
// Rien n'est enregistré : chaque résultat est calculé à la demande et rendu à
// l'appelant seul. La photo de carte grise n'est jamais stockée.
const eur = (n) => (n == null ? '—' : `${Math.round(n).toLocaleString('fr-FR')} €`)
const OPERATIONS = ['Distribution', 'Embrayage', 'Vidange']
const VIDE = { marque: '', modele: '', premiere_immat: '', energie: '', motorisation: '', kilometrage: '', prix_demande: '', famille: '', operations_non_faites: [] }

function Ligne({ libelle, valeur, detail }) {
  return (
    <div className="row">
      <dt>{libelle}</dt>
      <dd><b className="num">{valeur}</b>{detail && <p className="c-graphite" style={{ fontSize: 13, marginTop: 2 }}>{detail}</p>}</dd>
    </div>
  )
}

function Resultat({ r }) {
  return (
    <div style={{ marginTop: 32 }}>
      <div className="doc-sec">
        <p className="eyebrow">{r.vehicule.marque} {r.vehicule.modele}{r.vehicule.annee ? ` · ${r.vehicule.annee}` : ''} · {r.vehicule.kilometrage.toLocaleString('fr-FR')} km · {r.vehicule.motorisation || r.vehicule.famille}</p>
      </div>

      <div className="doc-sec">
        <h2>Prix d'achat plafond</h2>
        {r.plafond.calcule ? (
          <>
            <p className="lead" style={{ marginTop: 6 }}>
              {r.plafond.possible ? <>Plafond : <b className="num">{eur(r.plafond.valeur)}</b></> : <>Pas de marge à ces conditions : il manque <b className="num">{eur(r.plafond.manque_eur)}</b>.</>}
            </p>
            <dl className="rows">{r.plafond.lignes.map((l) => <Ligne key={l.cle} libelle={`${l.signe} ${l.libelle}`} valeur={eur(l.montant_eur)} detail={l.detail} />)}</dl>
          </>
        ) : <p className="lead" style={{ marginTop: 6 }}>{r.plafond.motif}</p>}
        <p className="c-graphite" style={{ fontSize: 13, marginTop: 8 }}>{r.mention}</p>
      </div>

      <div className="doc-sec">
        <h2>3 contrôles à faire sur place</h2>
        {r.controles.length === 0 ? <p>Aucun défaut confirmé ni point signalé pour ce moteur.</p> : r.controles.map((c, i) => (
          <div key={i} style={{ padding: '10px 0', borderTop: '1px solid var(--filet)' }}>
            <b>{i + 1}. {c.quoi}</b>{c.origine === 'proprietaires' && <span className="tag muted" style={{ marginLeft: 8 }}>signalé par des propriétaires</span>}
            {c.quand && <p style={{ fontSize: 14 }}>Quand : {c.quand}</p>}
            {c.signe && <p style={{ fontSize: 14 }}>À quoi le reconnaître : {c.signe}</p>}
          </div>
        ))}
      </div>

      <div className="doc-sec">
        <h2>Défauts confirmés sur cette période</h2>
        {r.defauts_confirmes.length === 0 ? <p>Aucun défaut confirmé par une source indépendante pour ce moteur.</p> : (
          <dl className="rows">{r.defauts_confirmes.map((d, i) => (
            <Ligne key={i} libelle={d.organe || '—'} valeur={d.titre}
              detail={[d.km_typique, d.cout_min_eur != null && d.cout_max_eur != null ? `${eur(d.cout_min_eur)} à ${eur(d.cout_max_eur)}${d.source ? `, selon ${d.source}` : ''}` : null].filter(Boolean).join(' · ') || null} />
          ))}</dl>
        )}
      </div>

      <div className="doc-sec">
        <h2>Risque de retour sur 12 mois</h2>
        <p className="c-graphite" style={{ fontSize: 13 }}>Défauts confirmés qui peuvent survenir à ce kilométrage, avec leur coût cité. Une liste, pas une probabilité.</p>
        {r.risque.lignes.length === 0 ? <p>Aucun défaut chiffré à ce kilométrage.</p> : (
          <dl className="rows">{r.risque.lignes.map((l, i) => (
            <Ligne key={i} libelle={l.seuil || '—'} valeur={`${l.libelle} : ${eur(l.min)} à ${eur(l.max)}`} detail={l.source ? `selon ${l.source}` : null} />
          ))}</dl>
        )}
        {r.risque.sans_cout.length > 0 && <p className="c-graphite" style={{ fontSize: 13 }}>Sans coût publié (hors total) : {r.risque.sans_cout.join(' · ')}</p>}
        {r.deja_dans_facture.length > 0 && <p className="c-graphite" style={{ fontSize: 13 }}>Déjà compté dans la facture : {r.deja_dans_facture.join(' · ')}</p>}
      </div>

      <div className="doc-sec">
        <h2>Facture à prévoir</h2>
        <dl className="rows">{r.facture.lignes.filter((l) => l.rubrique === 'entretien').map((l) => (
          <Ligne key={l.id} libelle={l.libelle} valeur={l.min != null ? `${eur(l.min)} à ${eur(l.max)}` : 'à vérifier'} detail={[l.echeance, l.min != null && l.source?.libelle ? `selon ${l.source.libelle}` : null].filter(Boolean).join(' · ') || null} />
        ))}</dl>
      </div>

      {r.prises_en_charge.length > 0 && (
        <div className="doc-sec">
          <h2>Prises en charge</h2>
          <dl className="rows">{r.prises_en_charge.map((l) => <Ligne key={l.id} libelle={l.statut} valeur={l.libelle} detail={l.echeance} />)}</dl>
        </div>
      )}

      <PointsProprietairesBloc points={r.points_proprietaires} />
      {r.questions.length > 0 && (
        <div className="doc-sec">
          <h2>Questions au vendeur</h2>
          {r.questions.map((q, i) => <p key={i} style={{ fontSize: 14 }}>{q}</p>)}
        </div>
      )}
    </div>
  )
}

export default function StockPage() {
  const [onglet, setOnglet] = useState('fiche')
  const [marge, setMarge] = useState(500)
  const [v, setV] = useState(VIDE)
  const [vin, setVin] = useState('')
  const [res, setRes] = useState(null)
  const [lot, setLot] = useState('')
  const [lotRes, setLotRes] = useState(null)
  const [etat, setEtat] = useState('')
  const [erreur, setErreur] = useState('')

  const champ = (k) => ({ value: v[k], onChange: (e) => setV({ ...v, [k]: e.target.value }) })
  const echec = (e) => { setEtat(''); setErreur(e?.code === 'fonction_fermee' || e?.code === 'pro_requis' ? 'Réservé à la formule pro, pas encore ouverte.' : e?.message || 'Erreur.') }

  async function decoder() {
    setErreur('')
    try {
      const { vin: d } = await stockVin(vin)
      if (!d.valide) return setErreur(`Numéro de série invalide : ${d.erreurs.join(', ')}`)
      setV({ ...v, marque: d.constructeur || v.marque, premiere_immat: v.premiere_immat || (d.annees_possibles.length === 1 ? String(d.annees_possibles[0]) : '') })
    } catch (e) { echec(e) }
  }

  async function photo(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setErreur(''); setEtat('Lecture de la carte grise…')
    try {
      const { carte_grise: cg } = await stockCarteGrise(await resizeImageToDataUrl(f))
      setEtat('')
      if (!cg.lisible && !cg.marque) return setErreur('Carte grise illisible : saisis les champs.')
      setV({ ...v, marque: cg.marque || v.marque, modele: cg.denomination || v.modele, premiere_immat: cg.premiere_immat?.slice(0, 7) || v.premiere_immat, energie: cg.energie || v.energie, motorisation: v.motorisation || (cg.puissance_ch ? `${cg.puissance_ch} ch` : '') })
      if (cg.vin) setVin(cg.vin)
    } catch (err) { echec(err) } finally { e.target.value = '' }
  }

  async function analyser(famille, motorisation) {
    setErreur(''); setEtat('Calcul…'); setRes(null)
    const vehicule = { ...v, ...(famille ? { famille, motorisation } : {}) }
    if (famille) setV(vehicule)
    try { setRes(await stockFiche(vehicule, Number(marge) || 0)); setEtat('') } catch (e) { echec(e) }
  }

  async function trier() {
    setErreur(''); setEtat('Calcul du lot…'); setLotRes(null)
    // Une ligne : marque;modèle;AAAA-MM;énergie;motorisation;km;prix — ou VIN;modèle;motorisation;km;prix
    const lignes = lot.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 20).map((l, i) => {
      const c = l.split(';').map((x) => x.trim())
      if (/^[A-HJ-NPR-Z0-9]{17}$/i.test(c[0])) {
        const d = decoderVin(c[0])
        return { id: String(i + 1), libelle: c[0], marque: d.constructeur || '', modele: c[1], annee: d.annees_possibles.length === 1 ? d.annees_possibles[0] : null, motorisation: c[2], kilometrage: c[3], prix_demande: c[4] }
      }
      return { id: String(i + 1), marque: c[0], modele: c[1], premiere_immat: c[2], energie: c[3], motorisation: c[4], kilometrage: c[5], prix_demande: c[6] }
    })
    try { setLotRes((await stockLot(lignes, Number(marge) || 0)).lignes); setEtat('') } catch (e) { echec(e) }
  }

  function telecharger() {
    const url = URL.createObjectURL(new Blob([csvLot(lotRes)], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `tri-de-lot-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Helmet>
        <title>Contrôle d'entrée en stock | Inspexo</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Navbar />
      <main>
        <section className="sec" style={{ borderTop: 'none' }}>
          <div className="wrap-doc">
            <p className="eyebrow">Formule pro</p>
            <h1 style={{ fontSize: 'clamp(28px,4vw,40px)' }}>Contrôle d'entrée en stock</h1>
            <p className="lead">Un véhicule sans annonce : défauts confirmés, contrôles sur place, facture à prévoir, risque de retour et prix d'achat plafond, calcul affiché ligne par ligne. Rien n'est enregistré ni remis à un acheteur.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
              <button type="button" className={onglet === 'fiche' ? 'btn btn-auto' : 'btn-ghost btn-auto'} onClick={() => setOnglet('fiche')}>Un véhicule</button>
              <button type="button" className={onglet === 'lot' ? 'btn btn-auto' : 'btn-ghost btn-auto'} onClick={() => setOnglet('lot')}>Tri de lot</button>
              <label style={{ marginLeft: 'auto' }}>Marge visée (€) <input type="number" min="0" value={marge} onChange={(e) => setMarge(e.target.value)} style={{ width: 110 }} /></label>
            </div>

            {onglet === 'fiche' && (
              <form onSubmit={(e) => { e.preventDefault(); analyser() }} style={{ marginTop: 24, display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input placeholder="Numéro de série (VIN, 17 caractères)" value={vin} onChange={(e) => setVin(e.target.value)} style={{ flex: '1 1 260px' }} />
                  <button type="button" className="btn-ghost btn-auto" onClick={decoder}>Décoder</button>
                  <label className="btn-ghost btn-auto" style={{ cursor: 'pointer' }}>Photo de carte grise<input type="file" accept="image/*" capture="environment" onChange={photo} hidden /></label>
                </div>
                <p className="c-graphite" style={{ fontSize: 13 }}>La photo n'est jamais stockée. Seuls la marque, le type, la dénomination, la 1re immatriculation, le numéro de série, l'énergie et la puissance en sont lus — jamais le nom ni l'adresse.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
                  <input required placeholder="Marque" {...champ('marque')} />
                  <input required placeholder="Modèle" {...champ('modele')} />
                  <input placeholder="1re immatriculation (AAAA-MM)" {...champ('premiere_immat')} />
                  <input placeholder="Énergie (diesel, essence…)" {...champ('energie')} />
                  <input placeholder="Motorisation (ex. 1.5 dCi 90)" {...champ('motorisation')} />
                  <input required inputMode="numeric" placeholder="Kilométrage" {...champ('kilometrage')} />
                  <input inputMode="numeric" placeholder="Prix demandé (facultatif)" {...champ('prix_demande')} />
                </div>
                <fieldset style={{ border: 'none', padding: 0 }}>
                  <legend style={{ fontSize: 14 }}>Opérations que le vendeur déclare NON faites :</legend>
                  {OPERATIONS.map((o) => (
                    <label key={o} style={{ marginRight: 16 }}>
                      <input type="checkbox" checked={v.operations_non_faites.includes(o)}
                        onChange={(e) => setV({ ...v, operations_non_faites: e.target.checked ? [...v.operations_non_faites, o] : v.operations_non_faites.filter((x) => x !== o) })} /> {o}
                    </label>
                  ))}
                </fieldset>
                <button type="submit" className="btn btn-auto" style={{ width: 'auto' }}>Contrôler</button>
              </form>
            )}

            {onglet === 'lot' && (
              <div style={{ marginTop: 24 }}>
                <p style={{ fontSize: 14 }}>Jusqu'à 20 lignes. Une ligne : <code>marque;modèle;AAAA-MM;énergie;motorisation;km;prix</code>, ou <code>VIN;modèle;motorisation;km;prix</code>.</p>
                <textarea rows={8} value={lot} onChange={(e) => setLot(e.target.value)} style={{ width: '100%', fontSize: 16 }} />
                <button type="button" className="btn btn-auto" style={{ width: 'auto', marginTop: 8 }} onClick={trier}>Classer le lot</button>
              </div>
            )}

            {etat && <p className="eyebrow" aria-live="polite" style={{ marginTop: 16 }}>{etat}</p>}
            {erreur && <p role="alert" style={{ marginTop: 16, color: 'var(--rouge)' }}>{erreur}{/formule pro/.test(erreur) && <> <Link to="/pro">En savoir plus</Link></>}</p>}

            {res?.statut === 'moteur_a_choisir' && (
              <div className="doc-sec" style={{ marginTop: 24 }}>
                <p>{res.message}</p>
                {res.candidats.map((c) => (
                  <button key={c.famille} type="button" className="btn-ghost btn-auto" style={{ margin: '6px 8px 0 0' }} onClick={() => analyser(c.famille, c.nom_commercial)}>{c.nom_commercial} ({c.annees})</button>
                ))}
              </div>
            )}
            {res?.statut === 'moteur_non_couvert' && <p className="lead" style={{ marginTop: 24 }}>{res.message}</p>}
            {res?.statut === 'ok' && <Resultat r={res} />}

            {lotRes && (
              <div style={{ marginTop: 28, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead><tr>{['#', 'Véhicule', 'Prix demandé', 'Revente réaliste', 'Facture', 'Risque 12 mois', 'Marge nette', 'Plafond', ''].map((h) => <th key={h} style={{ textAlign: 'left', borderBottom: '1px solid var(--filet)', padding: 6 }}>{h}</th>)}</tr></thead>
                  <tbody>{lotRes.map((l, i) => (
                    <tr key={l.id}>
                      <td style={{ padding: 6 }}>{i + 1}</td><td style={{ padding: 6 }}>{l.libelle}</td><td className="num">{eur(l.prix_demande)}</td><td className="num">{eur(l.revente)}</td>
                      <td className="num">{eur(l.facture_max)}</td><td className="num">{eur(l.risque_max)}</td><td className="num"><b>{eur(l.marge_nette)}</b></td><td className="num">{eur(l.plafond)}</td>
                      <td className="c-graphite" style={{ fontSize: 13 }}>{l.motif}</td>
                    </tr>
                  ))}</tbody>
                </table>
                <button type="button" className="btn-ghost btn-auto" style={{ marginTop: 12 }} onClick={telecharger}>Exporter en CSV</button>
              </div>
            )}
            <JournalRetours />
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
