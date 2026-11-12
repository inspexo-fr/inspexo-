import React from 'react'
import { SOURCES_JOUR_J, documentsJourJ, reglesPaiement } from '../data/jourJ'

// SPRINT 23, LOT 2 (point 1) — Sécurité de la transaction. GRATUIT.
// 1. Signaux d'arnaque relevés par motifs fixes côté serveur, chacun cité
//    depuis l'annonce. Sans effet sur la note.
// 2. « Le jour J » : les documents à exiger (même liste que le kit Pass).
// 3. « Comment payer » : chaque règle juridique avec son article.

function Sources({ cles }) {
  if (!cles?.length) return <span className="c-graphite" style={{ fontSize: 13 }}>(conseil pratique, sans obligation légale)</span>
  return (
    <span className="c-graphite" style={{ fontSize: 13 }}>
      {cles.map((k, i) => (
        <React.Fragment key={k}>
          {i > 0 ? ' · ' : ''}
          <a href={SOURCES_JOUR_J[k].url} target="_blank" rel="noreferrer" title={SOURCES_JOUR_J[k].titre}>[{SOURCES_JOUR_J[k].court}]</a>
        </React.Fragment>
      ))}
    </span>
  )
}

export default function SecuriteTransactionBloc({ result }) {
  const signaux = Array.isArray(result?.securite_transaction?.signaux_arnaque) ? result.securite_transaction.signaux_arnaque : []
  const annee = result?.vehicule?.annee
  const plusDe4Ans = typeof annee === 'number' ? new Date().getFullYear() - annee >= 4 : true
  const professionnel = ['pro', 'pro_deguise_probable'].includes(result?.statut_vendeur)
  const documents = documentsJourJ(plusDe4Ans)
  const paiement = reglesPaiement(professionnel)

  return (
    <div className="doc-sec" id="transaction">
      <p className="eyebrow">Transaction</p>

      {result?.securite_transaction && (
        signaux.length > 0 ? (
          <div style={{ marginTop: 8 }}>
            <p className="c-rouge" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.5 }}>
              {signaux.length === 1 ? 'Un signal' : `${signaux.length} signaux`} d'arnaque relevé{signaux.length > 1 ? 's' : ''} dans l'annonce
            </p>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
              {signaux.map((s, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  {s.libelle}
                  <br />
                  <span className="c-graphite">« {s.extrait} »</span>
                </li>
              ))}
            </ul>
            <p className="c-graphite" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
              Relevés par des règles fixes sur le texte de l'annonce. Ils ne changent pas la note : ils portent sur la vente, pas sur le véhicule.
            </p>
          </div>
        ) : (
          <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 6 }} className="c-ink2">
            Aucun des signaux d'arnaque que nous recherchons (paiement à distance, vendeur à l'étranger, livraison par transporteur, visite refusée, acompte, prix très bas) n'apparaît dans l'annonce.
          </p>
        )
      )}

      <p className="eyebrow" style={{ marginTop: 18 }}>Le jour J</p>
      <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
        {documents.map((d) => (
          <li key={d.id} style={{ marginBottom: 8 }}>
            <strong>{d.titre}</strong>. {d.detail}{' '}
            <Sources cles={d.source ? [d.source] : []} />
          </li>
        ))}
      </ul>

      <p className="eyebrow" style={{ marginTop: 18 }}>Paiement</p>
      <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
        {paiement.map((r) => (
          <li key={r.id} style={{ marginBottom: 8 }}>
            <strong>{r.titre}</strong>. {r.detail}{' '}
            <Sources cles={r.sources} />
          </li>
        ))}
      </ul>
    </div>
  )
}
