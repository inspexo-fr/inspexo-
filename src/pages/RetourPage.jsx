import React, { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { retourVerifier, retourRepondre } from '../lib/scoreApi'

// SPRINT 10 — Retour d'issue, SANS COMPTE : /retour/:id?t=<jeton signé>.
//
// Le dispositif existant (sprint 3) exigeait un compte ET un dossier marqué
// « acheté » à la main : il présupposait l'achat au lieu de le demander, et
// ne touchait que les gens déjà connectés. Ici, trois questions, une minute,
// aucun mot de passe — le jeton HMAC reçu par email fait foi, et seule son
// empreinte est stockée côté serveur.
//
// La page ne révèle rien avant d'avoir fait valider le jeton par le serveur :
// un lien altéré n'affiche ni véhicule, ni verdict.

export default function RetourPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const token = params.get('t') || ''

  const [etat, setEtat] = useState('chargement') // chargement | pret | invalide | envoi | merci
  const [dossier, setDossier] = useState(null)
  const [achete, setAchete] = useState(null)
  const [prix, setPrix] = useState('')
  const [points, setPoints] = useState(null)
  const [commentaire, setCommentaire] = useState('')
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    if (!token || !id) { setEtat('invalide'); return }
    let annule = false
    retourVerifier(id, token)
      .then(d => {
        if (annule) return
        setDossier(d)
        setEtat('pret')
      })
      .catch(() => { if (!annule) setEtat('invalide') })
    return () => { annule = true }
  }, [id, token])

  const envoyer = async (e) => {
    e.preventDefault()
    if (achete === null) { setErreur('Indiquez si vous avez acheté ce véhicule.'); return }
    setErreur(null)
    setEtat('envoi')
    try {
      await retourRepondre(id, token, {
        achete,
        prix_paye: achete && prix ? Number(String(prix).replace(/\D/g, '')) : null,
        points_confirmes: points,
        commentaire: commentaire.trim() || null,
      })
      setEtat('merci')
    } catch (err) {
      setEtat('pret')
      setErreur(err?.message === 'rate_limited'
        ? 'Trop de tentatives. Réessayez plus tard.'
        : 'Enregistrement impossible. Réessayez dans un instant.')
    }
  }

  const page = (contenu) => (
    <>
      <Helmet>
        <title>Votre retour — Inspexo</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Navbar />
      <main>
        <section className="sec" style={{ borderTop: 'none' }}>
          <div className="wrap-doc">{contenu}</div>
        </section>
      </main>
      <Footer />
    </>
  )

  if (etat === 'chargement') {
    return page(<p className="eyebrow" aria-busy="true">Vérification du lien…</p>)
  }

  if (etat === 'invalide') {
    return page(
      <>
        <p className="eyebrow">Lien invalide</p>
        <h1 style={{ fontSize: 'clamp(24px,4vw,32px)', marginTop: 12 }}>
          Ce lien de retour n'est plus valable.
        </h1>
        <p className="lead" style={{ marginTop: 14 }}>
          Il a peut-être été tronqué par votre messagerie. Écrivez-nous à{' '}
          <a href="mailto:contact@inspexo.io">contact@inspexo.io</a> si vous souhaitez tout de même
          nous dire ce qu'il en est.
        </p>
        <p style={{ marginTop: 20 }}><Link to="/score">Analyser une autre annonce</Link></p>
      </>,
    )
  }

  if (etat === 'merci') {
    return page(
      <>
        <p className="eyebrow">Merci</p>
        <h1 style={{ fontSize: 'clamp(24px,4vw,32px)', marginTop: 12 }}>
          C'est enregistré.
        </h1>
        <p className="lead" style={{ marginTop: 14 }}>
          Votre retour alimente la mesure publique de notre justesse. Vous pouvez la consulter
          à tout moment sur <Link to="/fiabilite">la page fiabilité</Link> — nous ne publions rien
          tant que le nombre de retours est trop faible pour être honnête.
        </p>
        <p className="mono c-graphite" style={{ marginTop: 16, fontSize: 11, lineHeight: 1.6 }}>
          C'était le seul email que nous vous envoyons à ce sujet : il n'y aura pas de relance.
        </p>
      </>,
    )
  }

  const deja = dossier?.deja_repondu

  return page(
    <>
      <p className="eyebrow">Retour d'achat</p>
      <h1 style={{ fontSize: 'clamp(24px,4vw,32px)', marginTop: 12 }}>
        Votre {dossier?.vehicule}{dossier?.annee ? ` de ${dossier.annee}` : ''} — qu'est-ce que ça a donné ?
      </h1>
      <p className="lead" style={{ marginTop: 14 }}>
        Trois questions, une minute. Vos réponses servent à mesurer la justesse de nos analyses,
        et à la publier telle quelle.
      </p>
      {deja && (
        <p className="c-ambre" style={{ fontSize: 14, marginTop: 12, lineHeight: 1.6 }}>
          Vous avez déjà répondu — vous pouvez corriger vos réponses ci-dessous.
        </p>
      )}

      <form onSubmit={envoyer} style={{ marginTop: 24 }}>
        <div className="doc-sec">
          <p className="eyebrow">1 — Avez-vous acheté ce véhicule ?</p>
          <div className="seg" style={{ marginTop: 10 }}>
            {[[true, 'Oui, je l\'ai acheté'], [false, 'Non, finalement']].map(([v, label]) => (
              <label key={String(v)} style={achete === v ? { background: 'var(--ink)', color: 'var(--paper)' } : undefined}>
                <input type="radio" name="achete" checked={achete === v}
                  onChange={() => setAchete(v)} aria-label={label} />
                <span style={{ fontSize: 14 }}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {achete === true && (
          <div className="doc-sec">
            <p className="eyebrow">2 — À quel prix, finalement ?</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
              <input className="input" inputMode="numeric" placeholder="13 500" value={prix}
                onChange={e => setPrix(e.target.value.replace(/\D/g, '').slice(0, 6))}
                aria-label="Prix payé en euros" style={{ flex: '0 1 160px', width: 'auto' }} />
              <span style={{ fontSize: 15 }}>€</span>
            </div>
            <p className="mono c-graphite" style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
              Facultatif. C'est ce qui nous permet de mesurer l'écart réel entre prix demandé et
              prix payé — un chiffre que personne ne publie.
            </p>
          </div>
        )}

        <div className="doc-sec">
          <p className="eyebrow">
            {achete === true ? '3' : '2'} — Les points que nous avions signalés se sont-ils confirmés ?
          </p>
          {(dossier?.points ?? []).length > 0 && (
            <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>
              {dossier.points.map((p, i) => <li key={i} className="c-ink2">{p}</li>)}
            </ul>
          )}
          <div className="seg" style={{ marginTop: 12, gridTemplateColumns: '1fr' }}>
            {[
              ['oui', 'Oui, confirmés'],
              ['non', 'Non, rien de tout ça'],
              ['pas_verifie', 'Je n\'ai pas pu vérifier'],
            ].map(([v, label]) => (
              <label key={v} style={points === v ? { background: 'var(--ink)', color: 'var(--paper)' } : undefined}>
                <input type="radio" name="points" checked={points === v}
                  onChange={() => setPoints(v)} aria-label={label} />
                <span style={{ fontSize: 14 }}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="doc-sec">
          <p className="eyebrow">Autre chose ? (facultatif)</p>
          <textarea className="input" rows={3} maxLength={1000} value={commentaire}
            onChange={e => setCommentaire(e.target.value)}
            placeholder="Ce qu'on avait raté, ce qui s'est bien passé…"
            aria-label="Commentaire libre" style={{ marginTop: 10, width: '100%' }} />
        </div>

        {erreur && <p className="c-rouge" style={{ fontSize: 14, marginTop: 8 }}>{erreur}</p>}
        <button type="submit" className="btn" style={{ marginTop: 16 }} disabled={etat === 'envoi'}>
          {etat === 'envoi' ? 'Enregistrement…' : 'Envoyer mon retour'}
        </button>
        <p className="mono c-graphite" style={{ marginTop: 10, fontSize: 11, lineHeight: 1.6 }}>
          Aucun compte n'est créé. Vos réponses sont rattachées à ce dossier d'analyse, jamais
          publiées individuellement — seules des statistiques agrégées le sont.
        </p>
      </form>
    </>,
  )
}
