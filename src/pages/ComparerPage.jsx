import React, { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { comparerDossiers } from '../lib/scoreApi'

// SPRINT 22 — Comparer 2 ou 3 dossiers (Pass).
//
// ⚠️ La recommandation est calculée PAR RÈGLES côté serveur
// (`_shared/comparateur.ts`), jamais par le modèle, et le serveur vérifie le
// Pass ET que chaque dossier appartient à l'appelant. Cette page ne décide
// rien : elle affiche.
//
// À 390 px, le tableau devient des rangées empilées : un critère, puis une
// cellule par véhicule. Jamais de défilement horizontal.

const VERDICT_LABELS = { vert: 'FEU VERT', orange: 'PRUDENCE', rouge: 'SIGNAUX ROUGES' }
const VERDICT_CLASSES = { vert: 'c-vert', orange: 'c-ambre', rouge: 'c-rouge' }
const GRAVITE = { aucune: 'aucune', mineure: 'mineure', majeure: 'majeure', casse: 'risque de casse', securite: 'sécurité' }

const lire = (k) => { try { return localStorage.getItem(k) || '' } catch { return '' } }
const euros = (n) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`
const fourchette = (a, b) => (a == null && b == null ? '—' : a === b || b == null ? euros(a ?? b) : `${euros(a)} – ${euros(b)}`)

function Rangee({ titre, fiches, rendu }) {
  return (
    <div style={{ borderBottom: '1px solid var(--rule)', padding: '12px 0' }}>
      <p className="eyebrow" style={{ marginBottom: 8 }}>{titre}</p>
      <div className="cmp-grille" style={{ display: 'grid', gridTemplateColumns: `repeat(${fiches.length}, minmax(0, 1fr))`, gap: 12 }}>
        {fiches.map((f, i) => (
          <div key={f.analysis_id} style={{ fontSize: 14, lineHeight: 1.5, minWidth: 0, overflowWrap: 'anywhere' }}>
            <span className="mono c-graphite cmp-lettre" style={{ fontSize: 11 }}>{String.fromCharCode(65 + i)} · </span>
            {rendu(f)}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ComparerPage() {
  const [params] = useSearchParams()
  const ids = useMemo(() => (params.get('ids') || '').split(',').filter(Boolean).slice(0, 3), [params])
  const [data, setData] = useState(null)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    if (ids.length < 2) { setErreur({ code: 'invalid_input' }); return }
    comparerDossiers(ids, { kmAn: lire('inspexo_km_an') || undefined, region: lire('inspexo_region'), cv: lire('inspexo_cv') })
      .then(setData)
      .catch((e) => setErreur(e))
  }, [ids])

  const fiches = data?.fiches || []
  const reco = data?.recommandation || null

  return (
    <>
      <Helmet>
        <title>Comparer — Inspexo</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <style>{`@media (max-width: 560px){ .cmp-grille{ grid-template-columns: 1fr !important; } }`}</style>
      <Navbar />
      <main className="wrap" style={{ paddingTop: 92, paddingBottom: 64, maxWidth: 980 }}>
        <p className="eyebrow">{'// Comparer'}</p>
        <h1 style={{ fontSize: 32, marginTop: 6 }}>Vos dossiers, côte à côte</h1>

        {erreur && (
          <div style={{ border: '1px solid var(--rule-strong)', padding: '18px 20px', marginTop: 20 }}>
            {erreur.code === 'pass_requis' ? (
              <p style={{ fontSize: 15 }}>La comparaison de dossiers est réservée au <Link to="/pass">Pass achat</Link>.</p>
            ) : erreur.code === 'connexion_requise' || erreur.status === 401 ? (
              <p style={{ fontSize: 15 }}>Connectez-vous depuis <Link to="/dossier">votre dossier</Link> pour comparer.</p>
            ) : erreur.code === 'hors_dossier' ? (
              <p style={{ fontSize: 15 }}>Ces analyses ne figurent pas toutes dans <Link to="/dossier">votre dossier</Link>.</p>
            ) : erreur.code === 'invalid_input' ? (
              <p style={{ fontSize: 15 }}>Choisissez 2 ou 3 dossiers depuis <Link to="/dossier">votre dossier</Link>.</p>
            ) : (
              <p style={{ fontSize: 15 }}>Comparaison indisponible pour le moment. Réessayez plus tard.</p>
            )}
          </div>
        )}

        {!erreur && !data && <p className="eyebrow" aria-busy="true" style={{ padding: '30px 0' }}>Chargement…</p>}

        {fiches.length > 0 && (
          <>
            <Rangee titre="Véhicule" fiches={fiches} rendu={(f) => (
              <Link to={`/a/${f.analysis_id}`} style={{ fontWeight: 700 }}>{f.titre || 'Véhicule'}</Link>
            )} />
            <Rangee titre="Verdict et score" fiches={fiches} rendu={(f) => (
              <span className={`mono ${VERDICT_CLASSES[f.verdict] || ''}`} style={{ fontWeight: 600 }}>
                {VERDICT_LABELS[f.verdict] || f.verdict} · {f.score ?? '—'}/100
              </span>
            )} />
            <Rangee titre="Pannes portées par une source indépendante" fiches={fiches} rendu={(f) => (
              f.pannes_portees.length === 0 ? <>aucune</> : (
                <>{f.pannes_portees.length} (gravité max. {GRAVITE[f.gravite_max] || f.gravite_max})
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {f.pannes_portees.slice(0, 4).map((p) => <li key={p.titre}>{p.titre}</li>)}
                  </ul>
                </>
              )
            )} />
            <Rangee titre="Questions au vendeur" fiches={fiches} rendu={(f) => <>{f.questions}</>} />
            <Rangee titre="Travaux à prévoir chiffrés" fiches={fiches} rendu={(f) => (
              f.travaux.postes === 0 ? <>aucun poste chiffré</>
                : f.travaux.min == null && f.travaux.max == null
                  // La négociation ne publie un total qu'à partir de 2 postes chiffrés.
                  ? <>{f.travaux.postes} poste chiffré, sans total (voir le dossier)</>
                  : <>{fourchette(f.travaux.min, f.travaux.max)} ({f.travaux.postes} poste{f.travaux.postes > 1 ? 's' : ''})</>
            )} />
            <Rangee titre="Prix et position dans les comparables" fiches={fiches} rendu={(f) => (
              <>{f.prix.demande != null ? euros(f.prix.demande) : '—'}
                {f.prix.position ? <><br /><span className="c-ink2">{f.prix.position}{f.prix.n ? ` (${f.prix.n} annonces)` : ''}</span></> : <><br /><span className="c-graphite">position non évaluée</span></>}
              </>
            )} />
            <Rangee titre="Crit'Air" fiches={fiches} rendu={(f) => <>{f.critair || 'non déterminé'}</>} />
            <Rangee titre="Coût réel sur 3 ans" fiches={fiches} rendu={(f) => (
              f.cout_3ans ? (
                <>{fourchette(f.cout_3ans.total_min, f.cout_3ans.total_max)}
                  {f.cout_3ans.partiel && (
                    <><br /><span className="c-ambre">sans : {f.cout_3ans.non_chiffrees.map((l) => l.libelle).join(', ')}</span></>
                  )}
                </>
              ) : <>—</>
            )} />

            {reco && (
              <section style={{ border: '1px solid var(--rule-strong)', padding: '18px 20px', marginTop: 24 }}>
                <p className="eyebrow">Recommandation</p>
                {reco.issue === 'recommande' && (
                  <>
                    <p style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>Prendre : {reco.titre}</p>
                    <ol style={{ margin: '10px 0 0', paddingLeft: 20, fontSize: 15, lineHeight: 1.6 }}>
                      {reco.raisons.map((r) => <li key={r.texte}>{r.texte}</li>)}
                    </ol>
                  </>
                )}
                {reco.issue === 'aucune' && <p style={{ fontSize: 16, marginTop: 6 }}>{reco.motif}</p>}
                {reco.issue === 'indecis' && (
                  <>
                    <p style={{ fontSize: 16, marginTop: 6 }}>{reco.motif}</p>
                    {reco.manque?.length > 0 && (
                      <p className="c-ink2" style={{ fontSize: 14, lineHeight: 1.6, marginTop: 8 }}>
                        Ce qui manque pour trancher : {reco.manque.join(' ; ')}.
                      </p>
                    )}
                  </>
                )}
                {reco.ecartes?.length > 0 && (
                  <p className="c-ink2" style={{ fontSize: 14, lineHeight: 1.6, marginTop: 10 }}>
                    Écarté{reco.ecartes.length > 1 ? 's' : ''} : {reco.ecartes.map((e) => `${e.titre} (${e.motif})`).join(' ; ')}.
                  </p>
                )}
                <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.6, marginTop: 12 }}>
                  Recommandation calculée par règles fixes : élimination des verdicts rouges et des faits graves,
                  puis score (écart d'au moins 5 points), gravité des pannes documentées et coût sur 3 ans
                  (écart d'au moins 500 €, mêmes postes chiffrés des deux côtés). Un véhicule n'est recommandé
                  que s'il l'emporte sur au moins deux critères sans en perdre aucun. Analyse automatique à
                  partir des annonces, ne remplace pas un examen des véhicules.
                </p>
              </section>
            )}
          </>
        )}
      </main>
      <Footer />
    </>
  )
}
