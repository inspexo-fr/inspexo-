import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { reponseVendeur, getMonPass } from '../lib/scoreApi'
import { resizeImageToDataUrl } from '../lib/imageUtils'

// SPRINT 23, LOT 2 (point 2) — Réponses et justificatifs du vendeur (Pass).
// Registre SÉPARÉ des faits de l'annonce. Une réponse collée reste une
// déclaration ; une pièce photographiée n'est « justifiée » que si elle porte
// le VIN ou l'immatriculation du véhicule et que sa date et son kilométrage
// sont cohérents. Seule une pièce justifiée peut lever un plafond. Les photos
// ne sont jamais stockées ; le VIN et la plaque lus ne sortent pas du serveur.

const LEVES = {
  rappel_48: 'le rappel constructeur est attesté fait : le plafond « rappel à faire confirmer » est levé',
  operation_critique_55: 'l\'opération déclarée non faite est attestée faite : le plafond correspondant est levé',
  entretien_65: 'un entretien est attesté : le plafond « aucune information d\'entretien » est levé',
}

function Piece({ p }) {
  const ok = p.statut === 'justifie'
  const v = p.verifie || {}
  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid var(--filet)' }}>
      <div className="mono" style={{ fontSize: 11, letterSpacing: '.04em' }}>
        <span className={ok ? 'c-vert' : 'c-ambre'}>{ok ? 'JUSTIFIÉE' : 'DÉCLARÉE'}</span>
        {' · '}{p.type_piece === 'attestation_rappel' ? 'attestation de rappel' : p.type_piece}
        {p.date ? ` du ${p.date}` : ''}{p.km ? ` · ${Number(p.km).toLocaleString('fr-FR')} km` : ''}
      </div>
      {p.operations?.length > 0 && (
        <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 4 }}>
          {p.operations.map((o) => o.libelle).join(' · ')}{p.code_rappel ? ` (campagne ${p.code_rappel})` : ''}
        </p>
      )}
      <p className="c-graphite" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 2 }}>
        Vérifié : véhicule {v.vehicule === 'vin' ? 'par le VIN' : v.vehicule === 'immatriculation' ? 'par l\'immatriculation' : 'non'} ·
        date {v.date ? (p.borne_date === 'annee_modele' ? 'cohérente (bornée par l\'année-modèle, 1re immatriculation inconnue)' : 'cohérente') : 'non'} ·
        kilométrage {v.km ? 'cohérent' : 'non'}
      </p>
      {p.incoherences?.length > 0 && (
        <ul className="c-rouge" style={{ fontSize: 13, lineHeight: 1.6, margin: '4px 0 0', paddingLeft: 18 }}>
          {p.incoherences.map((i, k) => <li key={k}>{i} Cette pièce ne lève rien.</li>)}
        </ul>
      )}
      {!ok && !p.incoherences?.length && p.non_verifiable?.length > 0 && (
        <p className="c-graphite" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 2 }}>
          Reste déclarée : {p.non_verifiable.join(' ')}
        </p>
      )}
    </div>
  )
}

export default function FaitsVendeurBloc({ analysisId, result, onMaj }) {
  const [pass, setPass] = useState(null)
  const [etat, setEtat] = useState('idle')
  const [message, setMessage] = useState(null)
  const [texte, setTexte] = useState('')
  const [registre, setRegistre] = useState(result?.faits_vendeur || null)
  const fileRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    getMonPass().then(p => { if (!cancelled) setPass(!!p) }).catch(() => { if (!cancelled) setPass(false) })
    return () => { cancelled = true }
  }, [])
  useEffect(() => { if (result?.faits_vendeur) setRegistre(result.faits_vendeur) }, [result?.faits_vendeur])

  const envoyer = async ({ images = [], txt = '' }) => {
    if (etat === 'envoi') return
    setEtat('envoi'); setMessage(null)
    try {
      const r = await reponseVendeur(analysisId, { texte: txt, images })
      if (r.result?.faits_vendeur) setRegistre(r.result.faits_vendeur)
      if (r.result && onMaj) onMaj(r.result)
      if (!r.lisible && r.message) { setEtat('illisible'); setMessage(r.message); return }
      if (!r.persiste) setMessage('Résultat affiché pour cette visite seulement : suivez ce véhicule dans votre dossier d\'achat pour le conserver.')
      setTexte('')
      setEtat('idle')
    } catch (e) {
      setEtat('erreur'); setMessage(e?.message || 'Envoi impossible. Réessayez.')
    }
  }

  const photos = async (fileList) => {
    const files = Array.from(fileList || []).slice(0, 2)
    if (!files.length) return
    const images = []
    for (const f of files) images.push(await resizeImageToDataUrl(f))
    envoyer({ images })
  }

  const declares = registre?.declares || []
  const pieces = registre?.pieces || []
  const leves = registre?.leves || []

  return (
    <div className="doc-sec" id="vendeur">
      <p className="eyebrow">Pièces du vendeur</p>
      <p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 8 }}>
        Collez la réponse du vendeur ou photographiez une facture, une attestation de rappel. Ce que le vendeur
        déclare est rangé à part des faits de l'annonce et ne change rien à la note. Une pièce ne compte que si elle
        porte le numéro de série ou l'immatriculation de ce véhicule, avec une date et un kilométrage cohérents.
      </p>

      {(declares.length > 0 || pieces.length > 0) && (
        <div style={{ marginTop: 12 }}>
          <p className="c-graphite" style={{ fontSize: 13 }}>
            {registre?.mention || 'Pièce fournie par le vendeur, non authentifiée par Inspexo.'}
          </p>
          {leves.length > 0 && (
            <ul style={{ fontSize: 14, lineHeight: 1.6, margin: '6px 0 0', paddingLeft: 18 }}>
              {leves.map((l) => <li key={l}>Pièce justifiée : {LEVES[l] || l}.</li>)}
            </ul>
          )}
          {pieces.map((p, i) => <Piece key={i} p={p} />)}
          {declares.length > 0 && (
            <div style={{ paddingTop: 10, borderTop: '1px solid var(--filet)' }}>
              <div className="mono c-graphite" style={{ fontSize: 11, letterSpacing: '.04em' }}>DÉCLARÉ, SANS PIÈCE</div>
              <ul style={{ fontSize: 14, lineHeight: 1.6, margin: '4px 0 0', paddingLeft: 18 }}>
                {declares.map((d, i) => <li key={i}>{d.fait} — <span className="c-graphite">« {d.extrait} »</span></li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {pass ? (
        <div style={{ marginTop: 12 }}>
          <textarea
            className="input" rows={4} value={texte} maxLength={4000}
            onChange={(e) => setTexte(e.target.value)}
            placeholder="Collez ici la réponse du vendeur"
            aria-label="Réponse du vendeur"
            style={{ width: '100%', fontSize: 16 }}
          />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            <button type="button" className="btn-ghost btn-auto" disabled={etat === 'envoi' || !texte.trim()} onClick={() => envoyer({ txt: texte })}>
              Ranger la réponse
            </button>
            <input
              ref={fileRef} type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }}
              onChange={(e) => { photos(e.target.files); e.target.value = '' }}
            />
            <button type="button" className="btn-ghost btn-auto" disabled={etat === 'envoi'} onClick={() => fileRef.current?.click()}>
              {etat === 'envoi' ? 'Lecture en cours…' : 'Photographier une pièce (2 photos max)'}
            </button>
          </div>
          {message && (
            <p className={etat === 'erreur' ? 'c-rouge' : 'c-graphite'} style={{ fontSize: 13, marginTop: 8 }}>{message}</p>
          )}
        </div>
      ) : pass === false ? (
        <p style={{ fontSize: 13, marginTop: 10, lineHeight: 1.6 }}>
          <Link to="/pass">Fonction du Pass achat (29 €, 30 jours)</Link> — connectez-vous
          depuis votre <Link to="/dossier">dossier d'achat</Link> si vous l'avez déjà.
        </p>
      ) : null}
    </div>
  )
}
