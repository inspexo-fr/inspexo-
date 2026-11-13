import React, { useEffect, useState } from 'react'
import { coutTroisAnsDossier } from '../lib/scoreApi'

// SPRINT 24, LOT 2 — La facture à prévoir. Gratuite, déterministe, hors score.
// Ligne par ligne : entretien dû (distribution d'abord), défauts connus dont
// le kilométrage couvre la voiture, prises en charge valables ou expirées.
// Une ligne sans source confirmée n'a pas de montant : c'est une question.

const STATUTS = {
  a_prevoir: { label: 'À prévoir', classe: 'c-ambre' },
  question: { label: 'À demander', classe: 'c-graphite' },
  valable: { label: 'Valable', classe: 'c-vert' },
  expiree: { label: 'Expirée', classe: 'c-rouge' },
  a_verifier: { label: 'À vérifier (VIN)', classe: 'c-graphite' },
}
const RUBRIQUES = [
  ['entretien', 'Entretien dû'],
  ['defaut', 'Défauts connus à ce kilométrage'],
  ['prise_en_charge', 'Prises en charge'],
]
const euros = (n) => `${Math.round(n).toLocaleString('fr-FR')} €`

export default function FactureBloc({ analysisId }) {
  const [facture, setFacture] = useState(undefined)
  useEffect(() => {
    let annule = false
    coutTroisAnsDossier(analysisId).then((r) => { if (!annule) setFacture(r?.facture ?? null) }).catch(() => { if (!annule) setFacture(null) })
    return () => { annule = true }
  }, [analysisId])
  if (!facture || !Array.isArray(facture.lignes) || facture.lignes.length === 0) return null
  const chiffre = facture.total_max > 0

  return (
    <div className="doc-sec" id="facture">
      <p className="eyebrow">Facture à prévoir</p>
      <p style={{ fontSize: 16, lineHeight: 1.6, marginTop: 6, fontWeight: 600 }}>
        {chiffre
          ? <>À prévoir : {euros(facture.total_min)} à {euros(facture.total_max)}, sur les lignes chiffrées par une source.</>
          : <>Aucune ligne n'est chiffrée par une source confirmée : tout est à demander au vendeur.</>}
        {facture.sans_montant > 0 && <span className="c-graphite" style={{ fontWeight: 400 }}> {facture.sans_montant} ligne{facture.sans_montant > 1 ? 's' : ''} sans montant.</span>}
      </p>
      {RUBRIQUES.map(([cle, titre]) => {
        const lignes = facture.lignes.filter((l) => l.rubrique === cle)
        if (lignes.length === 0) return null
        return (
          <div key={cle} style={{ marginTop: 14 }}>
            <p className="eyebrow">{titre}</p>
            {lignes.map((l) => {
              const st = STATUTS[l.statut] ?? STATUTS.question
              return (
                <div key={l.id} style={{ padding: '10px 0', borderTop: '1px solid var(--filet)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <b style={{ fontSize: 15 }}>{l.libelle}</b>
                    <span className={st.classe} style={{ fontSize: 13, fontWeight: 600 }}>
                      {st.label}{l.min != null && l.max != null ? ` · ${euros(l.min)} – ${euros(l.max)}` : ''}
                    </span>
                  </div>
                  {l.echeance && <p className="c-graphite" style={{ fontSize: 13, marginTop: 2 }}>{l.echeance}</p>}
                  <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 4 }}>À dire : « {l.phrase_vendeur} »</p>
                  <p style={{ fontSize: 14, lineHeight: 1.6 }}>À demander : {l.justificatif}.</p>
                  <p className="c-graphite" style={{ fontSize: 13, lineHeight: 1.6 }}>
                    {l.source
                      ? <>Source : {l.source.url ? <a href={l.source.url} target="_blank" rel="noreferrer">{l.source.libelle}</a> : l.source.libelle}{l.source.date ? `, relevé le ${l.source.date}` : ''}</>
                      : 'Aucune source confirmée : pas de montant.'}
                  </p>
                </div>
              )
            })}
          </div>
        )
      })}
      <p className="c-graphite" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 10 }}>{facture.mention} Cette facture ne change pas la note.</p>
    </div>
  )
}
