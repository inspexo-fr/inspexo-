import React, { useEffect, useState } from 'react'
import InspectionBloc from './InspectionBloc'
import { getPartenairesActifs } from '../lib/scoreApi'
import {
  MENTION_CREDIT, partenairesAffichables, PREALABLE_ROUGE, texteSansMentionCredit,
} from '../data/partenaires'

// SPRINT 10 — « Et maintenant ? » : ce que l'acheteur peut faire, une fois le
// verdict lu. Placé sous le verdict, là où la décision se prend.
//
// TROIS RÈGLES QUI NE SE DISCUTENT PAS :
//
// 1. Un verdict ROUGE n'affiche JAMAIS de partenaire assurance ou crédit. On
//    n'aide pas à acheter une voiture classée rouge. Le bloc n'est pas masqué
//    en CSS : la requête n'est même pas faite, donc rien ne part au navigateur.
//
// 2. Sur un rouge, l'inspection reste proposée — vérifier avant de renoncer
//    est utile — mais jamais comme l'action à faire d'abord : lien secondaire,
//    précédé de la phrase qui remet l'ordre des choses.
//
// 3. Aucun lien, textuel ou visuel, entre les pannes détectées et la garantie.
//    Ce composant ne reçoit NI les pannes, NI le score, NI le prix : il ne
//    connaît que le verdict (pour savoir s'il doit se taire) et l'identifiant
//    du dossier (pour compter la mise en relation). Une phrase du type « cette
//    panne serait couverte » est structurellement impossible à écrire ici, et
//    le texte du partenaire est de toute façon contrôlé à l'enregistrement.

/** Lien de mise en relation : il passe par /go/<slug>, qui journalise puis
 *  redirige. L'URL du partenaire n'existe pas côté navigateur. */
function LienPartenaire({ partenaire, analysisId }) {
  const href = `/go/${partenaire.slug}${analysisId ? `?a=${analysisId}&s=web` : '?s=web'}`
  const estCredit = partenaire.type === 'credit'
  // La mention légale est obligatoire DANS le texte validé — c'est ainsi
  // qu'on vérifie qu'elle existe — mais elle s'affiche à part, en évidence :
  // la laisser aussi dans le paragraphe la ferait lire deux fois et la
  // banaliserait.
  const corps = estCredit ? texteSansMentionCredit(partenaire.texte_valide) : partenaire.texte_valide
  return (
    <div style={{ padding: '14px 0', borderTop: '1px solid var(--filet)' }}>
      {corps && (
        <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>{corps}</p>
      )}
      {/* Mention légale du crédit (art. L312-5 du code de la consommation) :
          À CÔTÉ du lien et lisible, jamais en note de bas de page. */}
      {estCredit && (
        <p style={{ fontSize: 15, lineHeight: 1.6, marginTop: 10, fontWeight: 700 }}>
          {MENTION_CREDIT}.
        </p>
      )}
      <a
        className="btn-ghost btn-sm btn-auto"
        style={{ marginTop: 10, display: 'inline-flex' }}
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
      >
        {partenaire.nom} — en savoir plus
      </a>
    </div>
  )
}

export default function EtMaintenant({ analysisId, vehicule, verdict }) {
  const rouge = verdict === 'rouge'
  const peutAfficherPartenaires = partenairesAffichables(verdict)
  const [partenaires, setPartenaires] = useState([])

  useEffect(() => {
    // Sur un rouge, aucune requête : la règle est appliquée avant le réseau,
    // pas après coup dans le rendu.
    if (!peutAfficherPartenaires) { setPartenaires([]); return }
    let annule = false
    getPartenairesActifs()
      .then(l => { if (!annule) setPartenaires(l) })
      .catch(() => { if (!annule) setPartenaires([]) })
    return () => { annule = true }
  }, [peutAfficherPartenaires])

  return (
    <div className="doc-sec" id="et-maintenant">
      <p className="eyebrow">Et maintenant ?</p>

      {rouge ? (
        <>
          <p style={{ fontSize: 15, lineHeight: 1.6, fontWeight: 600 }}>{PREALABLE_ROUGE}</p>
          <details className="fold" style={{ marginTop: 10 }}>
            <summary>
              <span className="pm" aria-hidden="true">+</span>
              Faire quand même inspecter cette voiture sur place
            </summary>
            <div className="a">
              <InspectionBloc analysisId={analysisId} vehicule={vehicule} nu />
            </div>
          </details>
        </>
      ) : (
        <InspectionBloc analysisId={analysisId} vehicule={vehicule} nu />
      )}

      {peutAfficherPartenaires && partenaires.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.6 }}>
            Inspexo n'est ni assureur ni organisme de crédit. Les services ci-dessous sont proposés
            par des partenaires indépendants, avec lesquels vous traitez directement : nous nous
            limitons à vous les indiquer. Le verdict ci-dessus est calculé sans eux.
          </p>
          {partenaires.map(p => (
            <LienPartenaire key={p.slug} partenaire={p} analysisId={analysisId} />
          ))}
        </div>
      )}
    </div>
  )
}
