import React from 'react'
import Stamp from './Stamp'
import { Ref, creerRegistreSources } from './Footnotes'
import { useDossierExemple, refsPourRaison, libelleSource } from './DossierApercu'

// Extrait du dossier réel, au premier écran de l'accueil (chantier design,
// nov. 2026). MÊME source de données que la section « Un dossier réel »
// (useDossierExemple) : ligne véhicule, tampon, deux motifs avec leur appel de
// note et la note de source. Rien n'est recopié en dur. Tout l'extrait mène à
// la section complète.
// Mise en page « fiche » (choix d'Utku du 11 nov. 2026) : ligne véhicule et
// tampon côte à côte, motifs en liste, notes de source en bas.
export default function DossierExtrait() {
  const { row } = useDossierExemple()
  if (!row) {
    return (
      <a className="extrait" href="#dossier" aria-busy={row === undefined ? 'true' : undefined}>
        <span className="extrait-voir">Un dossier réel →</span>
      </a>
    )
  }
  const r = row.result_json || {}
  const vh = r.vehicule || {}
  const motifs = (r.raisons_principales || []).slice(0, 2)
  const registre = creerRegistreSources()
  const refs = motifs.map((m) => refsPourRaison(m, r.pannes_connues || [], registre))
  const ligne = [
    [row.marque, row.modele].filter(Boolean).join(' '),
    row.annee,
    vh.kilometrage != null ? `${Number(vh.kilometrage).toLocaleString('fr-FR')} km` : null,
    vh.prix_affiche != null ? `${Number(vh.prix_affiche).toLocaleString('fr-FR')} €` : null,
  ].filter(Boolean).join(' · ')

  return (
    <a className="extrait" href="#dossier" aria-label={`Extrait d'un dossier réel : ${ligne}. Voir le dossier complet.`}>
      <span className="extrait-haut">
        <span className="extrait-vehicule">{ligne}</span>
        <Stamp verdict={r.verdict} score={r.score} className="stamp-sm" />
      </span>
      <ol className="extrait-motifs">
        {motifs.map((m, i) => (
          <li key={i}><span className="extrait-n">{String(i + 1).padStart(2, '0')}</span><span>{m}<Ref nums={refs[i]} /></span></li>
        ))}
      </ol>
      {registre.liste.length > 0 && (
        <span className="extrait-notes">
          {registre.liste.map((s) => (
            <span key={s.n}><span className="extrait-num">[{s.n}]</span> {s.libelle || libelleSource(s.url)}</span>
          ))}
        </span>
      )}
      <span className="extrait-voir">Voir le dossier complet →</span>
    </a>
  )
}
