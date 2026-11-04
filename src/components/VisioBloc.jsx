import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { commanderVisio, getVisioConfig, mesInspections } from '../lib/inspectionApi'

// SPRINT 14 — Commande d'une visio guidée, sur /a/:id.
//
// ⚠️ AUCUNE COORDONNÉE DU VENDEUR n'est demandée, contrairement à
// l'inspection : l'acheteur est lui-même devant la voiture, personne n'a
// besoin de joindre le vendeur ni de se rendre à une adresse. Un formulaire
// qui les réclamerait collecterait des données personnelles d'un tiers sans
// aucun usage.
//
// Deux cases obligatoires et jamais pré-cochées : les CGV, et la demande
// expresse d'exécution avant la fin des 14 jours (L221-25).

const euros = (c) => `${(c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`

/** Créneaux proposés : entre 2 h et 48 h, par pas de 30 minutes, heures
 *  ouvrables élargies — on ne propose pas un appel à 3 h du matin. */
function creneauxProposes() {
  const out = []
  const t = new Date(Date.now() + 2 * 3600 * 1000)
  t.setMinutes(t.getMinutes() > 30 ? 60 : 30, 0, 0)
  const fin = Date.now() + 48 * 3600 * 1000
  while (t.getTime() < fin && out.length < 48) {
    const h = t.getHours()
    if (h >= 8 && h <= 20) out.push(new Date(t))
    t.setMinutes(t.getMinutes() + 30)
  }
  return out
}

export default function VisioBloc({ analysisId }) {
  const [config, setConfig] = useState(undefined)
  const [deja, setDeja] = useState(null)
  const [cp, setCp] = useState('')
  const [creneau, setCreneau] = useState('')
  const [cgv, setCgv] = useState(false)
  const [execution, setExecution] = useState(false)
  const [etat, setEtat] = useState('idle')
  const [message, setMessage] = useState(null)

  useEffect(() => {
    let annule = false
    getVisioConfig().then(c => { if (!annule) setConfig(c) }).catch(() => { if (!annule) setConfig(null) })
    mesInspections()
      .then(l => { if (!annule) setDeja((l || []).find(x => x.type === 'visio' && x.analysis_id === analysisId) || null) })
      .catch(() => {})
    return () => { annule = true }
  }, [analysisId])

  // Drapeau éteint ou service fermé : le bloc n'existe pas. La fermeture
  // réelle est serveur — ceci évite seulement d'afficher un bouton inutile.
  if (config === undefined) return null
  if (!config?.ouvert && !deja) return null

  if (deja) {
    const libelles = {
      a_attribuer: 'en attente d’un inspecteur', acceptee: 'inspecteur confirmé',
      refusee: 'en cours de réattribution', faite: 'compte rendu remis', annulee: 'annulée',
    }
    return (
      <section style={{ marginTop: 28 }}>
        <h2 className="h-doc">Visio guidée</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 8 }}>
          Visio commandée — <strong>{libelles[deja.statut] || deja.statut}</strong>.
        </p>
        {deja.statut === 'acceptee' && (
          <p style={{ fontSize: 14, marginTop: 8 }}>
            <Link to={`/visio/${deja.id}`}>Rejoindre l’appel →</Link>
          </p>
        )}
        <p className="mono c-graphite" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.6 }}>
          LE LIEN S’OUVRE 15 MINUTES AVANT L’HEURE DU RENDEZ-VOUS.
        </p>
      </section>
    )
  }

  const envoyer = async (e) => {
    e.preventDefault()
    if (!cgv) { setMessage('Acceptez les conditions de la visio pour continuer.'); return }
    if (!execution) {
      setMessage('Cochez la demande d’exécution immédiate : sans elle, nous ne pouvons pas fixer l’appel avant 14 jours.')
      return
    }
    setEtat('envoi'); setMessage(null)
    try {
      const { url } = await commanderVisio({
        analysis_id: analysisId,
        code_postal: cp,
        creneau,
        accepte_cgv: true,
        execution_immediate: true,
      })
      window.location.assign(url)
    } catch (err) {
      setEtat('erreur')
      setMessage(err?.message || 'Commande impossible. Réessayez.')
    }
  }

  return (
    <section style={{ marginTop: 28 }}>
      <h2 className="h-doc">Visio guidée avec un inspecteur</h2>
      <p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 8 }}>
        Vous êtes devant la voiture avec votre téléphone, un inspecteur indépendant vous guide en direct,
        point par point, sur la checklist de ce véhicule. <strong>{euros(config.prix_cents)} TTC</strong>,
        appel de 30 à 40 minutes, compte rendu écrit sous {config.rapport_heures} h.{' '}
        <strong>{config.zone_libelle}</strong> — aucun déplacement, donc aucune zone.
      </p>
      <p className="mono c-graphite" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.6 }}>
        SANS APPLICATION À INSTALLER · APPEL JAMAIS ENREGISTRÉ · {euros(config.part_inspecteur_cents)} REVIENNENT À L’INSPECTEUR
      </p>

      <form onSubmit={envoyer} style={{ marginTop: 14 }}>
        <input
          className="input" inputMode="numeric" maxLength={5} placeholder="Code postal du véhicule"
          value={cp} onChange={e => setCp(e.target.value.replace(/\D/g, '').slice(0, 5))}
          aria-label="Code postal où se trouve le véhicule" style={{ maxWidth: 220 }}
        />
        <p className="mono c-graphite" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.6 }}>
          Le code postal sert seulement aux statistiques de couverture. Aucune coordonnée du vendeur
          n’est demandée : c’est vous qui êtes devant la voiture.
        </p>

        <select
          className="input" value={creneau} onChange={e => setCreneau(e.target.value)}
          aria-label="Créneau souhaité" style={{ marginTop: 10, maxWidth: 320 }}
        >
          <option value="">Choisir un créneau…</option>
          {creneauxProposes().map(d => (
            <option key={d.toISOString()} value={d.toISOString()}>
              {d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' à '}{d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </option>
          ))}
        </select>

        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, cursor: 'pointer', fontSize: 13, lineHeight: 1.5 }}>
          <input type="checkbox" checked={cgv} onChange={() => setCgv(v => !v)} style={{ marginTop: 2, width: 16, height: 16 }} required />
          <span>
            J’accepte les <Link to="/cgv-visio" target="_blank">conditions de vente de la visio</Link> :
            accompagnement à distance, sans démontage ni essai routier, par un professionnel indépendant assuré.
          </span>
        </label>

        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, cursor: 'pointer', fontSize: 13, lineHeight: 1.5 }}>
          <input type="checkbox" checked={execution} onChange={() => setExecution(v => !v)} style={{ marginTop: 2, width: 16, height: 16 }} required />
          <span>
            Je demande que la visio soit réalisée avant la fin du délai de rétractation de 14 jours et je
            reconnais perdre ce droit une fois l’appel entièrement réalisé.
          </span>
        </label>

        <button type="submit" className="btn" style={{ marginTop: 12 }} disabled={etat === 'envoi' || !creneau || !cp}>
          {etat === 'envoi' ? 'Redirection vers le paiement…' : `Réserver pour ${euros(config.prix_cents)}`}
        </button>
        {message && <div className="c-rouge" style={{ fontSize: 13, marginTop: 8 }}>{message}</div>}
        <p className="mono c-graphite" style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
          Montant <strong>autorisé maintenant</strong>, <strong>débité seulement quand un inspecteur
          confirme</strong>. Annulation gratuite à tout moment avant le créneau.
        </p>
      </form>
    </section>
  )
}
