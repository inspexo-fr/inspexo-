import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DemandeZone from './DemandeZone'
import { supabase } from '../lib/supabaseClient'
import { commanderInspection, getInspectionConfig, mesInspections } from '../lib/inspectionApi'
import { marquerClicInspection } from '../lib/scoreApi'
import { euros } from '../data/charte'

// SPRINT 8 — Bloc « Faire inspecter cette voiture » de /a/:id.
// Le service n'apparaît que si le SERVEUR dit qu'il est ouvert : médiateur
// désigné, clé de paiement en place, et au moins un inspecteur validé dont
// le compte Connect accepte les versements. Hors zone couverte : liste
// d'attente par email ET code postal (sprint 10 — c'est elle qui dessine la
// carte de la demande et décide du prochain département ouvert), jamais de
// commande.
//
// `nu` : rendu sans son propre cadre ni son titre, quand le bloc est imbriqué
// dans « Et maintenant ? » (sprint 10) qui porte déjà les deux.

/** Créneaux proposés : demain et après-demain, matin ou après-midi — dans la
 *  fenêtre de 48 h que le produit garantit. */
function creneauxProposes() {
  const out = []
  const base = new Date()
  for (const jours of [1, 2]) {
    for (const [h, libelle] of [[9, 'matin'], [14, 'après-midi']]) {
      const d = new Date(base)
      d.setDate(d.getDate() + jours)
      d.setHours(h, 0, 0, 0)
      const dans = (d.getTime() - base.getTime()) / 3600000
      if (dans < 2 || dans > 48) continue
      out.push({
        iso: d.toISOString(),
        libelle: `${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} — ${libelle}`,
      })
    }
  }
  return out
}

export default function InspectionBloc({ analysisId, vehicule, nu = false }) {
  const [config, setConfig] = useState(undefined) // undefined = chargement
  const [user, setUser] = useState(null)
  const [deja, setDeja] = useState(null) // inspection déjà commandée pour cette analyse
  const [cp, setCp] = useState('')
  const [zone, setZone] = useState(null) // { disponible, departement }
  const [ouvertFormulaire, setOuvertFormulaire] = useState(false)
  const [creneau, setCreneau] = useState('')
  const [vendeurNom, setVendeurNom] = useState('')
  const [vendeurTel, setVendeurTel] = useState('')
  const [vendeurAdresse, setVendeurAdresse] = useState('')
  const [cgv, setCgv] = useState(false)
  const [etat, setEtat] = useState('idle')
  const [message, setMessage] = useState(null)

  const creneaux = creneauxProposes()

  useEffect(() => {
    let annule = false
    getInspectionConfig().then(c => { if (!annule) setConfig(c) }).catch(() => { if (!annule) setConfig(null) })
    supabase.auth.getSession().then(({ data: { session } }) => { if (!annule) setUser(session?.user ?? null) })
    return () => { annule = true }
  }, [])

  useEffect(() => {
    if (!user) return
    mesInspections()
      .then(l => setDeja(l.find(i => i.analysis_id === analysisId) ?? null))
      .catch(() => {})
  }, [user, analysisId])

  // Disponibilité du secteur dès que le code postal est complet. Un code
  // postal saisi = une intention d'inspection : c'est CETTE étape du tunnel
  // qu'on mesure, pas le simple affichage du bloc.
  useEffect(() => {
    if (!/^[0-9]{5}$/.test(cp)) { setZone(null); return }
    marquerClicInspection(analysisId)
    let annule = false
    getInspectionConfig(cp)
      .then(c => { if (!annule) setZone({ disponible: c.disponible_zone, departement: c.departement }) })
      .catch(() => { if (!annule) setZone(null) })
    return () => { annule = true }
    // `analysisId` ne change jamais pendant la vie du composant : l'inclure
    // dans les dépendances ne changerait rien, mais la règle le réclame.
  }, [cp, analysisId])

  if (config === undefined) return null

  /** Cadre du bloc : absent quand il est imbriqué (`nu`). */
  const Cadre = ({ titre, children }) =>
    nu
      ? <div>{children}</div>
      : <div className="doc-sec"><p className="eyebrow">{titre}</p>{children}</div>

  // ---- Une inspection existe déjà pour cette analyse ----
  if (deja) {
    return (
      <Cadre titre="Inspection sur place">
        <p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 8 }}>
          Inspection commandée{deja.ref_num ? ` (dossier n° INS-${String(deja.ref_num).padStart(5, '0')})` : ''} —{' '}
          <strong>{{
            a_attribuer: 'en attente d\'un inspecteur',
            acceptee: 'inspecteur confirmé',
            refusee: 'en cours de réattribution',
            faite: 'rapport remis',
            annulee: 'annulée',
          }[deja.statut] || deja.statut}</strong>.
          {deja.inspecteur_nom && deja.statut === 'acceptee' && (
            <> Votre inspecteur : {deja.inspecteur_nom}{deja.inspecteur_telephone ? ` (${deja.inspecteur_telephone})` : ''}.</>
          )}
        </p>
        <p style={{ fontSize: 14, marginTop: 8 }}>
          <Link to="/dossier">Suivre dans mon dossier d'achat →</Link>
        </p>
      </Cadre>
    )
  }

  // ---- Service pas encore ouvert : liste d'attente ----
  if (!config?.ouvert) {
    return (
      <Cadre titre="Inspection sur place">
        <p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 8 }}>
          Faire examiner la voiture par un professionnel indépendant avant d'acheter, sur place,
          sous 48 heures : nous constituons le réseau d'inspecteurs, à commencer par {config?.zone_libelle || 'Toulouse et la Haute-Garonne'}.
          L'inspecteur est payé par vous, jamais par le vendeur.
        </p>
        <DemandeZone
          title="Être prévenu quand l'inspection ouvre près de chez moi"
          analysisId={analysisId}
        />
      </Cadre>
    )
  }

  const commander = async (e) => {
    e.preventDefault()
    if (etat === 'envoi') return
    setMessage(null)
    if (!cgv) { setMessage('Acceptez les conditions de l\'inspection pour continuer.'); return }
    setEtat('envoi')
    try {
      const { url } = await commanderInspection({
        analysis_id: analysisId,
        code_postal: cp,
        creneau,
        vendeur_nom: vendeurNom,
        vendeur_telephone: vendeurTel,
        vendeur_adresse: vendeurAdresse,
        accepte_cgv: true,
      })
      window.location.assign(url)
    } catch (err) {
      setEtat('erreur')
      setMessage(err?.message || 'Commande impossible. Réessayez.')
    }
  }

  return (
    <Cadre titre="Faire inspecter cette voiture">
      <p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 8 }}>
        Un professionnel indépendant se déplace, examine {vehicule || 'le véhicule'} point par point
        et vous remet un rapport photo. <strong>{euros(config.prix_cents)} TTC</strong>, créneau
        sous {config.delai_heures} heures, {config.zone_libelle}. Il est payé par vous et
        jamais par le vendeur : il a signé une charte d'indépendance.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <input
          className="input" inputMode="numeric" maxLength={5} placeholder="Code postal du véhicule"
          value={cp} onChange={e => setCp(e.target.value.replace(/\D/g, '').slice(0, 5))}
          aria-label="Code postal où se trouve le véhicule"
          style={{ flex: '1 1 180px', width: 'auto' }}
        />
      </div>

      {zone && !zone.disponible && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 14, lineHeight: 1.6 }}>
            Aucun inspecteur sur le département {zone.departement} pour l'instant — nous commençons
            par {config.zone_libelle}.
          </p>
          <DemandeZone
            title="Me prévenir quand un inspecteur couvre mon secteur"
            analysisId={analysisId}
            codePostalInitial={cp}
          />
        </div>
      )}

      {zone?.disponible && !user && (
        <p style={{ fontSize: 14, marginTop: 12, lineHeight: 1.6 }}>
          Inspecteur disponible sur votre secteur.{' '}
          <Link to="/dossier">Connectez-vous</Link> pour commander : le rapport sera déposé dans votre dossier.
        </p>
      )}

      {zone?.disponible && user && !ouvertFormulaire && (
        <button type="button" className="btn" style={{ marginTop: 12 }} onClick={() => setOuvertFormulaire(true)}>
          Commander l'inspection — {euros(config.prix_cents)}
        </button>
      )}

      {zone?.disponible && user && ouvertFormulaire && (
        <form onSubmit={commander} style={{ marginTop: 14 }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Créneau souhaité</p>
          <div className="seg" style={{ gridTemplateColumns: '1fr', gap: 6 }}>
            {creneaux.map(c => (
              <label key={c.iso} style={creneau === c.iso ? { background: 'var(--ink)', color: 'var(--paper)' } : undefined}>
                <input type="radio" name="creneau" checked={creneau === c.iso}
                  onChange={() => setCreneau(c.iso)} aria-label={c.libelle} />
                <span style={{ fontSize: 13 }}>{c.libelle}</span>
              </label>
            ))}
          </div>
          {creneaux.length === 0 && (
            <p className="c-ambre" style={{ fontSize: 13, marginTop: 6 }}>
              Aucun créneau dans les 48 heures à cette heure-ci — revenez demain matin.
            </p>
          )}

          <p className="eyebrow" style={{ margin: '14px 0 8px' }}>Où se trouve la voiture</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input className="input" placeholder="Adresse complète" value={vendeurAdresse} required
              onChange={e => setVendeurAdresse(e.target.value)} maxLength={240} aria-label="Adresse du véhicule" />
            <input className="input" placeholder="Téléphone du vendeur" value={vendeurTel} required
              onChange={e => setVendeurTel(e.target.value)} maxLength={30} aria-label="Téléphone du vendeur" />
            <input className="input" placeholder="Nom du vendeur (facultatif)" value={vendeurNom}
              onChange={e => setVendeurNom(e.target.value)} maxLength={120} aria-label="Nom du vendeur" />
          </div>
          <p className="mono c-graphite" style={{ marginTop: 6, fontSize: 11, lineHeight: 1.6 }}>
            Ces coordonnées ne sont montrées qu'à l'inspecteur qui accepte la mission, et seulement
            après son acceptation. Prévenez le vendeur de sa venue.
          </p>

          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, cursor: 'pointer', fontSize: 13, lineHeight: 1.5 }}>
            <input type="checkbox" checked={cgv} onChange={() => setCgv(v => !v)} style={{ marginTop: 2, width: 16, height: 16 }} required />
            <span>
              J'accepte les <Link to="/cgv-pass" target="_blank">conditions</Link> : inspection visuelle
              et documentaire sur place, sans démontage ni passage au pont, par un professionnel indépendant assuré.
            </span>
          </label>

          <button type="submit" className="btn" style={{ marginTop: 12 }} disabled={etat === 'envoi' || !creneau}>
            {etat === 'envoi' ? 'Redirection vers le paiement…' : `Payer ${euros(config.prix_cents)}`}
          </button>
          {message && <div className="c-rouge" style={{ fontSize: 13, marginTop: 8 }}>{message}</div>}
          <p className="mono c-graphite" style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
            Paiement sécurisé Stripe. {Math.round(60)} % reviennent à l'inspecteur, versés à la remise
            du rapport. Annulation et remboursement tant qu'aucun inspecteur n'a accepté.
          </p>
        </form>
      )}
    </Cadre>
  )
}
