import React, { useEffect, useState } from 'react'
import { mesInspections, photosRapport, urlPhotoRapport } from '../lib/inspectionApi'

// SPRINT 8 — Rapport d'inspection remis à l'acheteur, affiché sur /a/:id.
// Les photos SONT conservées (c'est le rapport acheté) : elles ne sont
// lisibles que par l'acheteur et l'inspecteur, via des URL signées de courte
// durée — jamais d'URL publique.

const DECISIONS = {
  acheter: { label: 'Rien de bloquant constaté', classe: 'c-vert' },
  negocier: { label: 'À négocier avant d\'acheter', classe: 'c-ambre' },
  ne_pas_acheter: { label: 'L\'inspecteur déconseille l\'achat', classe: 'c-rouge' },
}

function Photo({ chemin, legende, organe }) {
  const [url, setUrl] = useState(null)
  const [erreur, setErreur] = useState(false)
  useEffect(() => {
    let annule = false
    urlPhotoRapport(chemin)
      .then(u => { if (!annule) setUrl(u) })
      .catch(() => { if (!annule) setErreur(true) })
    return () => { annule = true }
  }, [chemin])

  if (erreur) return null
  return (
    <figure style={{ margin: 0 }}>
      {url
        ? <img src={url} alt={legende || organe || 'Photo du rapport'} loading="lazy"
            style={{ width: '100%', height: 'auto', display: 'block', border: '1px solid var(--rule)' }} />
        : <div style={{ aspectRatio: '4 / 3', border: '1px solid var(--rule)', background: 'var(--gris-2, #F0F2F5)' }} />}
      {(legende || organe) && (
        <figcaption className="mono c-graphite" style={{ fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>
          {[organe, legende].filter(Boolean).join(' — ')}
        </figcaption>
      )}
    </figure>
  )
}

export default function RapportInspection({ analysisId }) {
  const [inspection, setInspection] = useState(null)
  const [photos, setPhotos] = useState([])

  useEffect(() => {
    let annule = false
    mesInspections()
      .then(liste => {
        const i = liste.find(x => x.analysis_id === analysisId && x.statut === 'faite' && x.rapport)
        if (!annule) setInspection(i ?? null)
        if (i) return photosRapport(i.id)
        return []
      })
      .then(p => { if (!annule) setPhotos(Array.isArray(p) ? p : []) })
      .catch(() => {})
    return () => { annule = true }
  }, [analysisId])

  if (!inspection?.rapport) return null
  const r = inspection.rapport
  const d = DECISIONS[r.decision] || DECISIONS.negocier

  return (
    <div className="doc-sec">
      <p className="eyebrow">Rapport d'inspection sur place</p>
      <div className="mono c-graphite" style={{ fontSize: 11, letterSpacing: '.04em', marginTop: 6 }}>
        {inspection.ref_num ? `DOSSIER N° INS-${String(inspection.ref_num).padStart(5, '0')} · ` : ''}
        PAR {String(r.inspecteur || 'INSPECTEUR INDÉPENDANT').toUpperCase()}
        {r.rendu_le ? ` · ${new Date(r.rendu_le).toLocaleDateString('fr-FR')}` : ''}
      </div>

      <p className={d.classe} style={{ fontSize: 17, fontWeight: 700, marginTop: 10 }}>{d.label}</p>
      <p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 8, whiteSpace: 'pre-wrap' }}>{r.synthese}</p>

      {(r.constats || []).length > 0 && (
        <div style={{ marginTop: 12 }}>
          {r.constats.map((c, i) => (
            <div className="ctrl" key={i} style={{ alignItems: 'baseline' }}>
              <span>
                {c.constat}
                {c.organe && (
                  <span className="mono c-graphite" style={{ display: 'block', fontSize: 11, marginTop: 2 }}>
                    {c.organe}
                  </span>
                )}
              </span>
              <span className={`val ${c.signal === 'rouge' ? 'bad' : c.signal === 'attention' ? 'mid' : 'ok'}`}>
                {c.signal === 'rouge' ? 'ROUGE' : c.signal === 'attention' ? 'ATTENTION' : 'OK'}
              </span>
            </div>
          ))}
        </div>
      )}

      {photos.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 10, marginTop: 14,
        }}>
          {photos.map((p, i) => <Photo key={i} chemin={p.chemin} legende={p.legende} organe={p.organe} />)}
        </div>
      )}

      <p className="mono c-graphite" style={{ marginTop: 12, fontSize: 11, lineHeight: 1.6 }}>
        Inspection visuelle et documentaire sur place, sans démontage ni passage au pont.
        L'inspecteur est payé par vous et jamais par le vendeur. Ces photos ne sont visibles
        que par vous et par lui.
      </p>
    </div>
  )
}
