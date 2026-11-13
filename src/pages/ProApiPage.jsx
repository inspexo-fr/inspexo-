import React from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import FilAriane from '../components/FilAriane'

// SPRINT 11 — /pro/api : la documentation de l'API de scoring v0.
// Aucun prix affiché (tarif sur devis). Les limites sont annoncées ici, pas
// découvertes en production.

const REQUETE = `curl -X POST https://www.inspexo.io/api/v1/analyses \\
  -H "Authorization: Bearer ix_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "texte": "Peugeot 308 1.2 PureTech 130 de 2019, 100 000 km, ...",
    "prix": 13900,
    "km": 100000
  }'`

const REPONSE = `{
  "id": "9f9e54c4-5630-4173-92b1-9bcec68fad1a",
  "url": "https://www.inspexo.io/a/9f9e54c4-…",
  "verdict": "orange",
  "score": 55,
  "bareme_version": "11.0",
  "cache": false,
  "vehicule": {
    "marque": "Peugeot", "modele": "308",
    "motorisation": "1.2 PureTech 130", "famille_moteur": "EB2DT",
    "annee": 2019, "kilometrage": 100000, "prix_affiche": 13900
  },
  "axes": {
    "prix":                 { "note": 12, "commentaire": "…" },
    "kilometrage_age":      { "note": 13, "commentaire": "…" },
    "historique_entretien": { "note": 11, "commentaire": "…" },
    "risques_mecaniques":   { "note":  9, "commentaire": "…" },
    "vendeur_cadre":        { "note": 12, "commentaire": "…" }
  },
  "motifs": [
    "La courroie de distribution en bain d'huile doit être remplacée à l'échéance.",
    "…"
  ],
  "points": [
    {
      "titre": "Courroie de distribution en bain d'huile",
      "organe": "distribution",
      "gravite": "majeure",
      "km_typique": "dès 100 000 km",
      "cout_min_eur": 400, "cout_max_eur": 750,
      "source": "base Inspexo",
      "urls": ["https://…"]
    }
  ],
  "incoherences": [],
  "quota": { "restant_mois": 97, "quota_mensuel": 100 }
}`

const LIMITES = [
  ['Quota mensuel', 'Fixé par contrat, décompté par appel. Le compteur repart le 1er du mois. L\'en-tête X-Quota-Restant donne le solde à chaque réponse.'],
  ['Plafond journalier global', 'Un plafond journalier s\'applique à l\'ensemble du trafic API, toutes clés confondues : il protège le service et il est annoncé plutôt que subi.'],
  ['Dépassement', 'HTTP 429 avec un message qui dit lequel des deux plafonds est atteint et quand il repart. Jamais de coupure silencieuse.'],
  ['Cache de 7 jours', 'Une annonce déjà analysée dans les 7 jours renvoie le même résultat, marqué "cache": true. Il est décompté comme un appel.'],
  ['Durée', 'Une analyse complète prend 40 à 90 secondes. Prévoyez un délai d\'attente de 180 secondes.'],
  ['Taille', 'Le texte de l\'annonce est tronqué à 6 000 caractères.'],
]

const ERREURS = [
  ['401', 'cle_manquante / cle_inconnue', 'Clé absente, mal formée ou inconnue.'],
  ['403', 'cle_revoquee', 'La clé a été révoquée.'],
  ['429', 'quota_mensuel / plafond_journalier', 'Un des deux plafonds est atteint.'],
  ['400', 'texte_trop_court', 'Le champ « texte » fait moins de 40 caractères.'],
  ['503', 'service_unavailable', 'Fournisseur d\'IA indisponible. L\'appel n\'est pas décompté.'],
]

export default function ProApiPage() {
  return (
    <>
      <Helmet>
        <title>API de scoring Inspexo — documentation</title>
        <meta name="description" content="API de scoring d'annonces automobiles : un POST, un JSON avec verdict, score, notes par critère, points sourcés et version du barème. Limites, erreurs, exemple de réponse." />
        <link rel="canonical" href="https://www.inspexo.io/pro/api" />
      </Helmet>
      <FilAriane items={[{ nom: 'API', url: '/pro/api' }]} />
      <Navbar />
      <main>
        <section className="sec" style={{ borderTop: 'none' }}>
          <div className="wrap-doc">
            <p className="eyebrow">API de scoring · v0</p>
            <h1 style={{ fontSize: 'clamp(28px,3.4vw,40px)', marginTop: 10 }}>
              POST /api/v1/analyses
            </h1>
            <p className="lead" style={{ marginTop: 14 }}>
              Vous envoyez le texte d'une annonce, nous rendons le verdict complet. C'est
              exactement le même pipeline que celui du site public : même barème, mêmes règles de
              sourçage, même cache. <strong>Aucun traitement de faveur n'est possible</strong> —
              le calcul ne sait pas qui appelle.
            </p>

            <div className="doc-sec">
              <p className="eyebrow">Authentification</p>
              <p style={{ fontSize: 15, lineHeight: 1.7, marginTop: 8 }}>
                Une clé par client, dans l'en-tête <code>Authorization: Bearer ix_live_…</code>
                {' '}(ou <code>X-API-Key</code>). Elle n'est affichée qu'à sa création : nous n'en
                conservons qu'une empreinte salée et ne pouvons pas vous la rappeler.
              </p>
            </div>

            <div className="doc-sec">
              <p className="eyebrow">Requête</p>
              <pre className="mono" style={{ fontSize: 12, lineHeight: 1.7, overflowX: 'auto', marginTop: 8 }}>
                {REQUETE}
              </pre>
              <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.6, marginTop: 8 }}>
                <strong>texte</strong> obligatoire (40 caractères minimum) ·
                {' '}<strong>prix</strong> et <strong>km</strong> facultatifs, en euros et en kilomètres.
              </p>
            </div>

            <div className="doc-sec">
              <p className="eyebrow">Réponse</p>
              <pre className="mono" style={{ fontSize: 12, lineHeight: 1.7, overflowX: 'auto', marginTop: 8 }}>
                {REPONSE}
              </pre>
              <p className="c-ink2" style={{ fontSize: 14, lineHeight: 1.7, marginTop: 10 }}>
                Chaque entrée de <code>points</code> porte ses <code>urls</code> : un défaut sans
                source consultable n'est pas publié, chez nous comme chez vous.
                {' '}<code>bareme_version</code> identifie la règle de calcul utilisée — elle
                change quand un score changerait à faits identiques.
              </p>
            </div>

            <div className="doc-sec">
              <p className="eyebrow">Limites</p>
              <div className="rows" style={{ marginTop: 8 }}>
                {LIMITES.map(([t, d]) => (
                  <div className="row" key={t}>
                    <h3 style={{ fontSize: 16 }}>{t}</h3>
                    <p style={{ fontSize: 14 }}>{d}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="doc-sec">
              <p className="eyebrow">Erreurs</p>
              <dl className="specs api-erreurs" style={{ marginTop: 8 }}>
                {ERREURS.map(([code, nom, d]) => (
                  <div key={nom}>
                    <dt>{code} · {nom}</dt>
                    <dd style={{ fontSize: 13 }}>{d}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="doc-sec">
              <p className="eyebrow">Conditions</p>
              <p style={{ fontSize: 15, lineHeight: 1.7, marginTop: 8 }}>
                L'usage de l'API suppose de ne pas modifier le verdict rendu et de ne pas revendre
                les données brutes. Les conditions complètes sont remises avec le devis.
              </p>
              <p style={{ fontSize: 15, marginTop: 14 }}>
                <Link to="/pro#contact">Demander un accès et un devis →</Link>
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
