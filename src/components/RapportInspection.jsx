import React, { useEffect, useState } from 'react'
import { mesInspections, photosRapport } from '../lib/inspectionApi'

// SPRINT 8 — Rapport d'inspection remis à l'acheteur, affiché sur /a/:id.
// Les photos SONT conservées (c'est le rapport acheté) : elles ne sont
// lisibles que par l'acheteur et l'inspecteur, via des URL signées de courte
// durée délivrées par la fonction `inspection-photo` (jamais d'URL publique,
// et jamais de décision d'accès côté client).

const DECISIONS = {
  acheter: { label: 'Rien de bloquant constaté', classe: 'c-vert' },
  negocier: { label: 'À négocier avant d\'acheter', classe: 'c-ambre' },
  ne_pas_acheter: { label: 'L\'inspecteur déconseille l\'achat', classe: 'c-rouge' },
}

export default function RapportInspection({ analysisId }) {
  const [inspection, setInspection] = useState(null)
  const [photos, setPhotos] = useState([])
  // Une photo payée qui ne s'affiche pas doit se VOIR : le silence laisserait
  // croire que l'inspecteur n'en a pas pris.
  const [photosErreur, setPhotosErreur] = useState(false)

  useEffect(() => {
    let annule = false
    mesInspections()
      .then(async (liste) => {
        const i = liste.find(x => x.analysis_id === analysisId && x.statut === 'faite' && x.rapport)
        if (annule) return
        setInspection(i ?? null)
        if (!i || !(i.rapport?.photos > 0)) return
        try {
          const p = await photosRapport(i.id)
          if (!annule) setPhotos(p)
        } catch (_) {
          if (!annule) setPhotosErreur(true)
        }
      })
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
          {photos.map((p, i) => (
            <figure key={i} style={{ margin: 0 }}>
              <img src={p.url} alt={p.legende || p.organe || 'Photo du rapport'} loading="lazy"
                style={{ width: '100%', height: 'auto', display: 'block', border: '1px solid var(--rule)' }} />
              {(p.legende || p.organe) && (
                <figcaption className="mono c-graphite" style={{ fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>
                  {[p.organe, p.legende].filter(Boolean).join(' — ')}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}

      {photosErreur && (
        <p className="c-ambre" style={{ fontSize: 13, marginTop: 12, lineHeight: 1.6 }}>
          Les {r.photos} photo{r.photos > 1 ? 's' : ''} de ce rapport n'ont pas pu être chargées.
          Rechargez la page ; si cela persiste, écrivez à contact@inspexo.io — elles existent et
          vous y avez droit.
        </p>
      )}

      <p className="mono c-graphite" style={{ marginTop: 12, fontSize: 11, lineHeight: 1.6 }}>
        Inspection visuelle et documentaire sur place, sans démontage ni passage au pont.
        L'inspecteur est payé par vous et jamais par le vendeur. Ces photos ne sont visibles
        que par vous et par lui.
      </p>
    </div>
  )
}
