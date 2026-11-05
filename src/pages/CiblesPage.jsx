import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { revendeurCibleRetirer, revendeurCibles } from '../lib/scoreApi'

// SPRINT 19.1 — « Mes cibles » : les modèles où l'utilisateur a assez de
// relevés, avec la marge estimée de chacun, triés par marge.
//
// ⚠️ LES MARGES VIENNENT DE SES PROPRES RELEVÉS, pas du relevé collectif.
// Le carnet est privé, réservé au Pass, et ne contient aucune annonce : un
// histogramme de prix par segment, rien d'autre.
//
// ⚠️ VOCABULAIRE : « prix observés », « marge estimée ». Jamais « valeur »,
// « cote » ni « expertise » (art. L326-4 I-2° du code de la route).

const euros = (n) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`

export default function CiblesPage() {
  const [etat, setEtat] = useState('chargement')
  const [data, setData] = useState(null)
  const [copie, setCopie] = useState(null)

  const charger = () => {
    setEtat('chargement')
    revendeurCibles()
      .then((d) => { setData(d); setEtat('ok') })
      .catch((e) => setEtat(e?.code === 'pass_requis' ? 'pass' : e?.code === 'connexion_requise' ? 'connexion' : 'erreur'))
  }
  useEffect(charger, []) // eslint-disable-line react-hooks/exhaustive-deps

  const cibles = data?.cibles || []
  const enAttente = data?.en_attente || []

  return (
    <>
      <Helmet>
        <title>Mes cibles — Inspexo</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Navbar />
      <main className="wrap" style={{ paddingTop: 92, paddingBottom: 64, maxWidth: 820 }}>
        <p className="eyebrow">{'// Mode revendeur'}</p>
        <h1 style={{ fontSize: 34, letterSpacing: '-0.025em', marginTop: 6 }}>Mes cibles</h1>
        <p className="sub" style={{ marginTop: 8, maxWidth: 620 }}>
          Les modèles sur lesquels vous avez relevé assez d'annonces comparables, classés par
          marge estimée. Ce sont <strong>vos</strong> relevés : rien n'est repris du marché public.
        </p>

        {etat === 'chargement' && (
          <p className="mono c-graphite" style={{ marginTop: 24, fontSize: 13 }}>Chargement…</p>
        )}

        {etat === 'connexion' && (
          <p style={{ marginTop: 24, fontSize: 15, lineHeight: 1.6 }}>
            Connectez-vous pour retrouver vos cibles. <Link to="/dossier">Recevoir un lien de connexion</Link>
          </p>
        )}

        {etat === 'pass' && (
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 15, lineHeight: 1.6 }}>
              Les cibles sont une fonction du Pass achat : elles transforment vos analyses en
              méthode de recherche.
            </p>
            <div style={{ marginTop: 14, maxWidth: 280 }}>
              <Link className="btn-ghost" to="/pass">Voir le Pass achat</Link>
            </div>
          </div>
        )}

        {etat === 'erreur' && (
          <p style={{ marginTop: 24, fontSize: 15, lineHeight: 1.6 }}>
            Chargement impossible pour le moment. Réessayez dans un instant.
          </p>
        )}

        {etat === 'ok' && cibles.length === 0 && enAttente.length === 0 && (
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 15, lineHeight: 1.6 }}>
              Aucune cible pour l'instant. Analysez une annonce après avoir relevé les annonces
              comparables de votre recherche : au-delà de {data?.seuil ?? 6} relevés sur un même
              modèle, il apparaît ici.
            </p>
            <div style={{ marginTop: 14, maxWidth: 280 }}>
              <Link className="btn-ghost" to="/score">Analyser une annonce</Link>
            </div>
          </div>
        )}

        {etat === 'ok' && cibles.length > 0 && (
          <>
            {/* ⚠️ Sans puissance fiscale ni région, la carte grise ne pèse pas
                dans le calcul : les marges sont alors OPTIMISTES, et il faut
                le dire plutôt que de laisser croire au chiffre. */}
            {!data.carte_grise_connue && (
              <p className="mono" style={{ marginTop: 18, fontSize: 11, lineHeight: 1.7, color: 'var(--ambre)' }}>
                Votre région et votre puissance fiscale ne sont pas renseignées : la carte grise
                n'est pas comptée, les marges ci-dessous sont donc plus hautes qu'elles ne le
                seront. Renseignez-les une fois depuis un dossier, elles seront mémorisées.
              </p>
            )}

            <div style={{ marginTop: 22 }}>
              {cibles.map((c) => (
                <div key={`${c.marque}-${c.modele}-${c.energie}`} style={{
                  borderTop: '1px solid var(--rule-strong)', padding: '16px 0',
                  opacity: c.atteignable ? 1 : 0.72,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 18, fontWeight: 700, textTransform: 'capitalize' }}>
                        {c.marque} {c.modele}
                      </p>
                      <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.7, marginTop: 2 }}>
                        {c.energie}
                        {c.annee_mediane ? ` · année médiane ${c.annee_mediane}` : ''}
                        {c.km_median != null ? ` · ${Math.round(c.km_median / 1000)} 000 km` : ''}
                        {c.maj ? ` · mis à jour le ${c.maj.split('-').reverse().join('/')}` : ''}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p className="mono c-graphite" style={{ fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                        Marge estimée
                      </p>
                      <p className="mono num" style={{
                        fontSize: 24, fontWeight: 600,
                        color: c.atteignable ? 'var(--ink)' : 'var(--graphite)',
                      }}>
                        {c.marge_estimee > 0 ? euros(c.marge_estimee) : 'aucune'}
                      </p>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 10, marginTop: 12, overflowWrap: 'anywhere',
                  }}>
                    <div>
                      <p className="mono c-graphite" style={{ fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                        Prix observés · {c.n} relevé{c.n > 1 ? 's' : ''}
                      </p>
                      <p className="mono num" style={{ fontSize: 14 }}>
                        médiane {euros(c.p50)}
                      </p>
                      <p className="mono c-graphite" style={{ fontSize: 11 }}>
                        {euros(c.p25)}{' '}– {euros(c.p75)} (p25–p75)
                      </p>
                    </div>
                    {[
                      ['Revente réaliste', euros(c.revente)],
                      ['Achat maximum', c.achat_max > 0 ? euros(c.achat_max) : 'aucun'],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <p className="mono c-graphite" style={{ fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase' }}>{k}</p>
                        <p className="mono num" style={{ fontSize: 14 }}>{v}</p>
                      </div>
                    ))}
                  </div>

                  {!c.atteignable && (
                    <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.7, marginTop: 8 }}>
                      Votre marge visée n'est pas atteignable au quart le moins cher des prix
                      observés. Ce modèle est affiché quand même : le savoir évite d'y passer du temps.
                    </p>
                  )}

                  {c.recherche && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className="mono c-graphite" style={{ fontSize: 11 }}>
                        Recherche : plafond {euros(c.recherche.prix_max)}
                      </span>
                      <button type="button" className="btn-ghost" style={{ maxWidth: 190, height: 40 }}
                        onClick={() => {
                          const t = c.recherche.filtres.map((f) => `${f.champ} : ${f.valeur}`).join('\n')
                          navigator.clipboard?.writeText(t)
                            .then(() => { setCopie(c.modele); setTimeout(() => setCopie(null), 3000) })
                            .catch(() => {})
                        }}>
                        {copie === c.modele ? 'Copié' : 'Copier les filtres'}
                      </button>
                      {c.recherche.url && (
                        <a className="btn-ghost" style={{ maxWidth: 170, height: 40 }} href={c.recherche.url}
                          target="_blank" rel="noopener noreferrer nofollow">Ouvrir</a>
                      )}
                      <button type="button" className="btn-ghost" style={{ maxWidth: 110, height: 40 }}
                        onClick={() => {
                          revendeurCibleRetirer(c).then(charger).catch(() => {})
                        }}>
                        Retirer
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="mono c-graphite" style={{
              marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--rule)',
              fontSize: 11, lineHeight: 1.7,
            }}>
              {data.mention}
            </p>
          </>
        )}

        {etat === 'ok' && enAttente.length > 0 && (
          <div style={{ marginTop: 26, paddingTop: 16, borderTop: '1px solid var(--rule)' }}>
            <p className="eyebrow">Pas encore assez de relevés</p>
            <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.8, marginTop: 8 }}>
              {enAttente.map((e) => (
                `${e.marque} ${e.modele} (${e.energie}) — ${e.effectif}/${data.seuil}`
              )).join(' · ')}
            </p>
            <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.7, marginTop: 8 }}>
              Relevez les annonces comparables de votre recherche, puis analysez une annonce de ce
              modèle : les relevés s'additionnent d'une session à l'autre.
            </p>
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
