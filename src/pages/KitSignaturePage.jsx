import React, { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { getKitSignature } from '../lib/scoreApi'
import { supabase } from '../lib/supabaseClient'

// SPRINT 7 — Kit signature : « Avant de signer » (fonction du Pass achat,
// déblocage vérifié CÔTÉ SERVEUR par la RPC get_kit_signature).
// Checklist des documents à exiger (chaque obligation LÉGALE avec sa source
// service-public.gouv.fr), contrat de cession pré-rempli avec les données du
// dossier (imprimable — il COMPLÈTE le cerfa 15776*02 officiel, il ne le
// remplace pas), et démarches ANTS pas à pas.

const SOURCES = {
  vente: { url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F1707', titre: 'Service-public — Vendre ou donner son véhicule (F1707)' },
  csa: { url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F1360', titre: 'Service-public — Certificat de situation administrative (F1360)' },
  histovec: { url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/R52957', titre: 'Service-public — Obtenir le certificat de situation administrative sur HistoVec (R52957)' },
  ct: { url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2878', titre: 'Service-public — Contrôle technique d\'une voiture (F2878)' },
  cerfa: { url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/R20300', titre: 'Service-public — Certificat de cession, cerfa 15776*02 (R20300)' },
  immat: { url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F1050', titre: 'Service-public — Immatriculer un véhicule d\'occasion (F1050)' },
  ants: { url: 'https://immatriculation.ants.gouv.fr', titre: 'ANTS — téléservice immatriculation' },
}

function Src({ k }) {
  return (
    <a className="mono c-graphite" style={{ fontSize: 11 }} href={SOURCES[k].url} target="_blank" rel="noreferrer">
      [source : service-public.gouv.fr]
    </a>
  )
}

export default function KitSignaturePage() {
  const { id } = useParams()
  const [kit, setKit] = useState(undefined) // undefined=chargement, null=introuvable, {pass:false}, {pass:true,...}
  const [user, setUser] = useState(null)
  const [coches, setCoches] = useState({})
  const [prix, setPrix] = useState('')
  const [vendeur, setVendeur] = useState('')
  const [acheteur, setAcheteur] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null))
  }, [])

  useEffect(() => {
    let cancelled = false
    getKitSignature(id)
      .then(k => {
        if (cancelled) return
        setKit(k)
        if (k?.pass && k.vehicule?.prix_affiche != null) setPrix(String(k.vehicule.prix_affiche))
      })
      .catch(() => { if (!cancelled) setKit(null) })
    return () => { cancelled = true }
  }, [id])

  const vh = kit?.vehicule || {}
  const anneeCourante = new Date().getFullYear()
  const plusDe4Ans = typeof vh.annee === 'number' ? anneeCourante - vh.annee >= 4 : true
  const vehiculeLabel = [vh.marque, vh.modele, vh.motorisation].filter(Boolean).join(' ')

  const DOCUMENTS = useMemo(() => [
    {
      id: 'carte_grise',
      titre: 'Carte grise barrée, datée et signée',
      detail: 'Barrée avec la mention « Vendu le JJ/MM/AAAA à HH h MM » et signée par le (ou les) titulaire(s). Vérifiez que le nom du vendeur est bien celui de la carte grise.',
      source: 'vente',
    },
    {
      id: 'cerfa',
      titre: 'Certificat de cession — cerfa 15776*02, 2 exemplaires',
      detail: 'Rempli et signé par le vendeur ET par vous, en deux exemplaires (un chacun). C\'est le document officiel de la vente, exigé pour la nouvelle carte grise.',
      source: 'cerfa',
    },
    {
      id: 'csa',
      titre: 'Certificat de situation administrative de moins de 15 jours',
      detail: 'Dit « non-gage et non-opposition » : il prouve qu\'aucun gage ni opposition n\'empêche le transfert. Le vendeur l\'obtient gratuitement et immédiatement sur HistoVec.',
      source: 'csa',
    },
    ...(plusDe4Ans ? [{
      id: 'ct',
      titre: 'PV de contrôle technique de moins de 6 mois',
      detail: 'Obligatoire pour un véhicule de plus de 4 ans (moins de 2 mois s\'il s\'agit d\'une contre-visite). Faites-le lire par le Pass (bloc « PV de contrôle technique » du dossier).',
      source: 'ct',
    }] : [{
      id: 'ct',
      titre: 'Documents du véhicule (moins de 4 ans : pas de contrôle technique exigé)',
      detail: 'Le contrôle technique n\'est pas requis avant 4 ans — exigez en revanche le carnet et les justificatifs de garantie constructeur.',
      source: 'ct',
    }]),
    {
      id: 'code_cession',
      titre: 'Code de cession ANTS',
      detail: 'Le vendeur déclare la cession en ligne (sous 15 jours) et vous remet le code de cession : il vous simplifie la demande de carte grise.',
      source: 'vente',
    },
    {
      id: 'factures',
      titre: 'Factures d\'entretien et carnet — recommandé',
      detail: 'Pas une obligation légale, mais c\'est la preuve de l\'entretien annoncé : exigez au minimum les factures des opérations citées dans l\'annonce.',
      source: null,
    },
    {
      id: 'cles',
      titre: 'Double des clés — recommandé',
      detail: 'Un double manquant, c\'est 150 à 400 € chez le concessionnaire : un argument de plus si le vendeur ne l\'a pas.',
      source: null,
    },
  ], [plusDe4Ans])

  const imprimerContrat = () => {
    const dateJour = new Date().toLocaleDateString('fr-FR')
    const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const l = (v, taille = 28) => v ? esc(v) : '.'.repeat(taille)
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Contrat de cession — ${vehiculeLabel}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; margin: 40px auto; max-width: 720px; line-height: 1.55; font-size: 14px; }
  h1 { font-size: 20px; letter-spacing: .04em; } h2 { font-size: 14px; margin-top: 22px; border-bottom: 1px solid #111; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; } td { border: 1px solid #999; padding: 6px 8px; vertical-align: top; }
  .lbl { width: 38%; color: #444; } .sign { display: flex; gap: 40px; margin-top: 36px; } .sign div { flex: 1; }
  .note { font-size: 11px; color: #555; margin-top: 26px; border-top: 1px solid #999; padding-top: 8px; }
  @media print { body { margin: 10mm; } }
</style></head><body>
<h1>CONTRAT DE CESSION D'UN VÉHICULE D'OCCASION</h1>
<p>Établi le ${dateJour} — complète le certificat de cession officiel (cerfa n° 15776*02), qui reste obligatoire pour l'immatriculation.</p>
<h2>1. Les parties</h2>
<table>
<tr><td class="lbl">Vendeur (nom, prénom, adresse)</td><td>${l(vendeur, 60)}</td></tr>
<tr><td class="lbl">Acheteur (nom, prénom, adresse)</td><td>${l(acheteur, 60)}</td></tr>
</table>
<h2>2. Le véhicule</h2>
<table>
<tr><td class="lbl">Marque, modèle, version</td><td>${l(vehiculeLabel, 40)}</td></tr>
<tr><td class="lbl">Année (1re mise en circulation)</td><td>${l(vh.annee, 12)}</td></tr>
<tr><td class="lbl">Kilométrage au compteur</td><td>${vh.kilometrage ? Number(vh.kilometrage).toLocaleString('fr-FR') + ' km (à confirmer le jour de la vente)' : l(null, 20)}</td></tr>
<tr><td class="lbl">Immatriculation</td><td>${l(null, 16)}</td></tr>
<tr><td class="lbl">Numéro de châssis (VIN, champ E de la carte grise)</td><td>${l(null, 24)}</td></tr>
</table>
<h2>3. Prix et paiement</h2>
<table>
<tr><td class="lbl">Prix de vente convenu</td><td>${prix ? Number(prix).toLocaleString('fr-FR') + ' €' : l(null, 16)} , payé par ${l(null, 24)}</td></tr>
</table>
<h2>4. Déclarations du vendeur</h2>
<p>Le vendeur déclare : que le véhicule lui appartient ; qu'il n'est ni gagé ni frappé d'opposition (certificat de situation administrative de moins de 15 jours remis à l'acheteur) ; que le kilométrage indiqué est, à sa connaissance, exact ; qu'il a signalé par écrit les défauts dont il a connaissance :</p>
<p>${l(null, 90)}<br>${l(null, 90)}</p>
<h2>5. Documents remis ce jour</h2>
<p>☐ Carte grise barrée « Vendu le ____/____/______ à ____ h ____ », signée &nbsp; ☐ Cerfa 15776*02 (2 ex.) &nbsp; ☐ Certificat de situation administrative &nbsp; ${plusDe4Ans ? '☐ PV de contrôle technique de moins de 6 mois &nbsp;' : ''} ☐ Code de cession ANTS &nbsp; ☐ ${l(null, 20)}</p>
<div class="sign">
<div>Le vendeur<br>« Lu et approuvé », date et signature :<br><br><br></div>
<div>L'acheteur<br>« Lu et approuvé », date et signature :<br><br><br></div>
</div>
<p class="note">Document préparé avec le dossier Inspexo n° ${kit?.ref_num ? `IX-${new Date(kit.created_at).getFullYear()}-${String(kit.ref_num).padStart(5, '0')}` : ''} — il ne remplace ni le cerfa 15776*02 ni les obligations légales du vendeur (service-public.gouv.fr, fiches F1707, F1360, F2878). La vente entre particuliers reste soumise à la garantie des vices cachés (art. 1641 du Code civil).</p>
<script>window.print()</script>
</body></html>`
    const w = window.open('', '_blank', 'width=800,height=900')
    if (w) { w.document.write(html); w.document.close() }
  }

  const cochees = DOCUMENTS.filter(d => coches[d.id]).length

  return (
    <>
      <Helmet>
        <title>Avant de signer — kit signature | Inspexo</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Navbar />
      <main>
        <section className="sec" style={{ borderTop: 'none', minHeight: '70vh' }}>
          <div className="wrap-doc">
            <p className="eyebrow">Kit signature — Pass achat</p>
            <h1 style={{ fontSize: 'clamp(28px,5vw,38px)', marginTop: 12 }}>Avant de signer</h1>

            {kit === undefined ? (
              <p className="eyebrow" aria-busy="true" style={{ padding: '30px 0' }}>Chargement…</p>
            ) : kit === null && user ? (
              <div className="alert alert-rouge" style={{ marginTop: 22 }}>
                Analyse introuvable. Repassez par la page du dossier (<Link to={`/a/${id}`}>/a/…</Link>).
              </div>
            ) : kit === null || kit.pass === false ? (
              <div style={{ border: '1px solid var(--rule-strong)', padding: '22px 18px', marginTop: 22 }}>
                <p style={{ fontSize: 15, lineHeight: 1.7 }}>
                  Checklist des documents à exiger (chaque obligation avec sa source officielle),
                  contrat de cession pré-rempli avec les données de ce dossier et démarches ANTS
                  pas à pas : le kit signature fait partie du <strong>Pass achat (29 €, 30 jours)</strong>.
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                  <Link to="/pass" className="btn btn-auto" style={{ width: 'auto' }}>Découvrir le Pass achat</Link>
                  {!user && (
                    <Link to="/dossier" className="btn-ghost btn-auto" style={{ width: 'auto' }}>
                      J'ai déjà un Pass — me connecter
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <>
                <p className="lead" style={{ marginTop: 14 }}>
                  {vehiculeLabel}{vh.annee ? ` · ${vh.annee}` : ''}
                  {vh.prix_affiche ? ` · ${Number(vh.prix_affiche).toLocaleString('fr-FR')} € affichés` : ''}
                </p>

                {/* 1. Documents à exiger */}
                <div className="doc-sec" style={{ marginTop: 26 }}>
                  <p className="eyebrow">1. Les documents à exiger le jour de la vente ({cochees}/{DOCUMENTS.length})</p>
                  {DOCUMENTS.map(d => (
                    <label key={d.id} className="ctrl" style={{ alignItems: 'flex-start', cursor: 'pointer', gap: 12 }}>
                      <input
                        type="checkbox" checked={!!coches[d.id]}
                        onChange={() => setCoches(prev => ({ ...prev, [d.id]: !prev[d.id] }))}
                        style={{ marginTop: 4, width: 18, height: 18 }}
                      />
                      <span>
                        <span style={{ fontWeight: 700 }}>{d.titre}</span>
                        <span className="c-ink2" style={{ display: 'block', fontSize: 13, marginTop: 3, lineHeight: 1.6 }}>
                          {d.detail} {d.source && <Src k={d.source} />}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>

                {/* 2. Contrat pré-rempli */}
                <div className="doc-sec">
                  <p className="eyebrow">2. Contrat de cession pré-rempli</p>
                  <p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 8 }}>
                    Pré-rempli avec les données du dossier (véhicule, kilométrage, prix) — complétez
                    les noms, imprimez en deux exemplaires. Il fixe par écrit les déclarations du
                    vendeur ; le cerfa 15776*02 officiel reste obligatoire pour l'immatriculation. <Src k="cerfa" />
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                    <input className="input" placeholder="Vendeur : nom, prénom (facultatif)" value={vendeur}
                      onChange={e => setVendeur(e.target.value)} style={{ flex: '1 1 220px', width: 'auto' }} maxLength={120} />
                    <input className="input" placeholder="Acheteur : vous (facultatif)" value={acheteur}
                      onChange={e => setAcheteur(e.target.value)} style={{ flex: '1 1 220px', width: 'auto' }} maxLength={120} />
                    <input className="input num" type="number" placeholder="Prix convenu (€)" value={prix}
                      onChange={e => setPrix(e.target.value)} style={{ flex: '0 1 160px', width: 'auto' }} min="1" max="999999" />
                  </div>
                  <button type="button" className="btn btn-auto" style={{ marginTop: 12, width: 'auto' }} onClick={imprimerContrat}>
                    Imprimer le contrat (2 exemplaires)
                  </button>
                  <p className="mono c-graphite" style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
                    Les noms saisis ne quittent pas votre appareil : ils ne servent qu'à l'impression.
                  </p>
                </div>

                {/* 3. Démarches */}
                <div className="doc-sec">
                  <p className="eyebrow">3. Les démarches, pas à pas</p>
                  <div className="ctrl" style={{ alignItems: 'baseline' }}>
                    <span>
                      <span style={{ fontWeight: 700 }}>Le jour J — le vendeur déclare la cession</span>
                      <span className="c-ink2" style={{ display: 'block', fontSize: 13, marginTop: 3, lineHeight: 1.6 }}>
                        Sur <a href={SOURCES.ants.url} target="_blank" rel="noreferrer">immatriculation.ants.gouv.fr</a> (ou
                        l'application Simplimmat), dans les 15 jours suivant la signature. Il vous remet le
                        code de cession. <Src k="vente" />
                      </span>
                    </span>
                  </div>
                  <div className="ctrl" style={{ alignItems: 'baseline' }}>
                    <span>
                      <span style={{ fontWeight: 700 }}>Sous 1 mois — vous demandez la nouvelle carte grise</span>
                      <span className="c-ink2" style={{ display: 'block', fontSize: 13, marginTop: 3, lineHeight: 1.6 }}>
                        Sur <a href={SOURCES.ants.url} target="_blank" rel="noreferrer">ants.gouv.fr</a> (connexion
                        FranceConnect), avec le code de cession, le cerfa 15776*02 et le PV de contrôle
                        technique. <Src k="immat" />
                      </span>
                    </span>
                  </div>
                  <div className="ctrl" style={{ alignItems: 'baseline' }}>
                    <span>
                      <span style={{ fontWeight: 700 }}>Avant de rouler — l'assurance</span>
                      <span className="c-ink2" style={{ display: 'block', fontSize: 13, marginTop: 3, lineHeight: 1.6 }}>
                        Le véhicule doit être assuré dès la remise des clés ; le vendeur résilie de son côté.
                      </span>
                    </span>
                  </div>
                </div>

                {/* Sources */}
                <div className="doc-sec">
                  <p className="eyebrow">Sources officielles</p>
                  {Object.values(SOURCES).map((s, i) => (
                    <p key={i} className="mono" style={{ fontSize: 11, lineHeight: 1.9 }}>
                      [{i + 1}] <a href={s.url} target="_blank" rel="noreferrer">{s.titre}</a>
                    </p>
                  ))}
                </div>

                <p style={{ marginTop: 18 }}>
                  <Link to={`/a/${id}`}>← Revenir au dossier d'analyse</Link>
                </p>
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
