import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  coutCarteGrise, messageVendeurRevendeur, offreOuverture, PARAMETRES_DEFAUT,
  prixAchatMax, prixRevente, MENTION_REVENDEUR,
} from '../data/revendeur.gen'
import { critair, libelleCritair, verdictZfe, ZFE, ZFE_RELEVE_LE } from '../data/critair.gen'
import { getConfigPublique, preferencesRevendeurEcrire, preferencesRevendeurLire } from '../lib/scoreApi'
import { supabase } from '../lib/supabaseClient'

// SPRINT 19 — Mode revendeur : trois chiffres, et seulement trois.
//
// ⚠️ TOUT LE CALCUL EST LOCAL. Le module `src/data/revendeur.gen.js` est la
// traduction du module serveur par le compilateur TypeScript : l'utilisateur
// corrige un coût et les trois chiffres bougent, sans aller-retour.
//
// ⚠️ CE QUE CE BLOC NE DIT PAS. Il ne détermine aucune VALEUR de véhicule —
// réservé aux experts en automobile inscrits (art. L326-4 I-2° du code de la
// route). Il relève des PRIX OBSERVÉS sur les annonces que l'utilisateur a
// lui-même relevées, et applique SES paramètres.

const CLE_REGION = 'inspexo_region'
const CLE_CV = 'inspexo_cv'

const euros = (n) =>
  `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`

const RAISONS = {
  modele: 'autre modèle',
  energie: 'autre énergie',
  annee: 'année trop éloignée (± 2 ans)',
  km: 'kilométrage trop éloigné (± 40 000 km)',
  prix: 'prix illisible',
}

export default function RevendeurBloc({ analyse }) {
  const bloc = analyse?.revendeur || null
  const masque = bloc?.masque === true

  const [config, setConfig] = useState(null)
  const [region, setRegion] = useState(() => localStorage.getItem(CLE_REGION) || '')
  const [cv, setCv] = useState(() => localStorage.getItem(CLE_CV) || '')
  const [villeRevente, setVilleRevente] = useState('')
  const [params, setParams] = useState(bloc?.parametres || PARAMETRES_DEFAUT)
  const [lignes, setLignes] = useState(() => (bloc?.achat_max?.lignes || []).filter((l) => l.cle !== 'marge_voulue'))
  const [copie, setCopie] = useState(false)

  useEffect(() => {
    getConfigPublique().then(setConfig).catch(() => setConfig({}))
  }, [])

  // La région suit le COMPTE quand il y en a un, le navigateur sinon.
  useEffect(() => {
    let vivant = true
    supabase.auth.getSession().then(({ data }) => {
      if (!vivant || !data?.session) return
      preferencesRevendeurLire()
        .then((p) => {
          if (!vivant) return
          if (p.region) { setRegion(p.region); localStorage.setItem(CLE_REGION, p.region) }
          if (p.parametres && Object.keys(p.parametres).length) {
            setParams((v) => ({ ...v, ...p.parametres }))
          }
        })
        .catch(() => {})
    })
    return () => { vivant = false }
  }, [])

  const memoriserRegion = (valeur) => {
    setRegion(valeur)
    localStorage.setItem(CLE_REGION, valeur)
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) preferencesRevendeurEcrire({ region: valeur }).catch(() => {})
    })
  }

  const tarifs = config?.carte_grise_tarifs || null
  const carte = useMemo(
    () => coutCarteGrise(cv ? Number(cv) : null, region || null, tarifs),
    [cv, region, tarifs],
  )

  const classe = bloc?.critair || critair(analyse?.vehicule?.carburant || '', analyse?.vehicule?.annee ?? null)
  const zfe = useMemo(() => (villeRevente ? verdictZfe(villeRevente, classe) : null), [villeRevente, classe])
  const interdit = !!(zfe && zfe.interdit)

  // Prix de revente : recalculé localement dès qu'un paramètre bouge (la
  // décote ZFE, notamment, dépend de la ville de revente que seul
  // l'utilisateur connaît).
  const retenus = useMemo(() => analyse?.revendeur?.retenus || [], [analyse])
  const revente = useMemo(() => {
    if (retenus.length) {
      return prixRevente(
        retenus.map((c) => ({ ...c, modele: 'x', energie: 'x' })),
        { modele: 'x', energie: 'x', annee: analyse?.vehicule?.annee ?? null, km: analyse?.vehicule?.kilometrage ?? null },
        params, interdit,
      )
    }
    return bloc?.revente || null
  }, [retenus, params, interdit, bloc, analyse])

  const achat = useMemo(() => {
    if (masque || !revente) return null
    const age = analyse?.vehicule?.annee ? new Date().getFullYear() - analyse.vehicule.annee : null
    return prixAchatMax(revente.valeur, lignes, params, {
      carte_grise_eur: carte.connu ? carte.montant_eur : null,
      region_connue: carte.connu,
      age_vehicule_ans: age,
    })
  }, [masque, revente, lignes, params, carte, analyse])

  const offre = achat ? offreOuverture(achat.valeur, params) : null
  const messageVendeur = useMemo(() => {
    if (masque || !offre) return ''
    const args = [
      ...lignes.filter((l) => Number(l.montant_eur) > 0).map((l) => ({
        poste: l.libelle, montant_eur: Number(l.montant_eur), source: l.source || null,
      })),
      ...(bloc?.arguments || []).filter((a) => !lignes.some((l) => l.libelle === a.poste)),
    ]
    return messageVendeurRevendeur(args, offre, analyse?.vehicule?.prix_affiche ?? null)
  }, [masque, offre, lignes, bloc, analyse])

  if (!bloc) return null

  const nbRetenus = bloc.comparables?.retenus ?? 0
  const nbRecus = bloc.comparables?.recus ?? 0

  const champ = {
    font: 'inherit', fontFamily: 'var(--mono)', fontSize: 13, padding: '6px 8px',
    border: '1px solid var(--rule)', background: 'var(--field)', color: 'var(--ink)',
    borderRadius: 2, width: 96, textAlign: 'right', minHeight: 44, boxSizing: 'border-box',
  }
  const chiffre = { fontFamily: 'var(--mono)', fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }
  const etiquette = {
    fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.06em',
    textTransform: 'uppercase', color: 'var(--graphite)',
  }

  return (
    <div className="doc-sec" id="revendeur" data-testid="revendeur-bloc">
      <p className="eyebrow">Mode revendeur</p>

      {/* ── Pas assez de comparables : aucun chiffre, et on dit pourquoi ── */}
      {nbRetenus < 6 ? (
        <>
          <p style={{ fontSize: 15, lineHeight: 1.6, marginTop: 8 }}>
            Pas assez de comparables : {nbRetenus} annonce{nbRetenus > 1 ? 's' : ''} retenue
            {nbRetenus > 1 ? 's' : ''} sur {nbRecus} relevée{nbRecus > 1 ? 's' : ''}. Il en faut au moins six,
            au même modèle, même énergie, à ± 2 ans et ± 40 000 km.
          </p>
          {(bloc.comparables?.ecartes || []).length > 0 && (
            <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.7, marginTop: 8 }}>
              Écartées :{' '}
              {Object.entries(
                (bloc.comparables.ecartes || []).reduce((acc, e) => {
                  acc[e.raison] = (acc[e.raison] || 0) + 1
                  return acc
                }, {}),
              ).map(([r, n]) => `${n} pour ${RAISONS[r] || r}`).join(' · ')}
            </p>
          )}
          <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.7, marginTop: 10 }}>
            Pour en relever : ouvrez votre recherche Leboncoin et utilisez « Ajouter ces annonces comme
            comparables » dans l'extension, ou partagez la page de résultats depuis l'appli.
            Rien n'est relevé sans ce geste.
          </p>
        </>
      ) : (
        <>
          {/* ── Les trois chiffres ── */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 18, marginTop: 10,
          }}>
            <div>
              <p style={etiquette}>Prix de revente réaliste</p>
              <p style={chiffre} data-testid="revendeur-revente">{revente ? euros(revente.valeur) : '—'}</p>
            </div>
            <div>
              <p style={etiquette}>Prix d'achat maximum pour ta marge visée</p>
              <p style={chiffre} data-testid="revendeur-achat-max">
                {masque ? '—' : achat ? euros(achat.valeur) : '—'}
              </p>
            </div>
            <div>
              <p style={etiquette}>Offre d'ouverture</p>
              <p style={chiffre} data-testid="revendeur-offre">
                {masque ? '—' : offre != null ? euros(offre) : '—'}
              </p>
            </div>
          </div>

          <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.7, marginTop: 10 }}>
            {bloc.mention || MENTION_REVENDEUR}
          </p>

          <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.7, marginTop: 6 }}>
            Prix demandés sur {nbRetenus} annonce{nbRetenus > 1 ? 's' : ''} que vous avez relevées
            {revente?.mediane_observee ? ` — médiane ${euros(revente.mediane_observee)}` : ''}
            {revente?.pente_eur_par_km != null ? ', écart kilométrique mesuré sur ce lot' : ', aucun écart kilométrique mesurable'}.
          </p>

          {/* ── Le détail, modifiable ── */}
          {masque ? (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--rule)' }}>
              <p style={{ fontSize: 15, lineHeight: 1.6 }}>
                {bloc.nb_lignes_masquees > 0
                  ? `${bloc.nb_lignes_masquees} ligne${bloc.nb_lignes_masquees > 1 ? 's' : ''} de coût`
                  : 'Le détail'}
                {bloc.nb_arguments_masques > 0
                  ? `, ${bloc.nb_arguments_masques} argument${bloc.nb_arguments_masques > 1 ? 's' : ''} chiffré${bloc.nb_arguments_masques > 1 ? 's' : ''}`
                  : ''}
                , le prix d'achat maximum, l'offre d'ouverture et le message prêt à envoyer sont réservés au Pass achat.
              </p>
              <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.7, marginTop: 8 }}>
                Ces chiffres ne sont pas masqués à l'écran : ils ne quittent pas nos serveurs.
              </p>
              <div style={{ marginTop: 12, maxWidth: 280 }}>
                <Link className="btn-ghost" to="/pass">Voir le Pass achat</Link>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--rule)' }}>
              <p style={etiquette}>Ce qui est retranché du prix de revente</p>

              {lignes.map((l, i) => (
                <label key={l.cle} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12, padding: '7px 0', borderBottom: '1px solid var(--rule)',
                }}>
                  <span style={{ fontSize: 14, lineHeight: 1.5 }}>
                    {l.libelle}
                    {l.source && (
                      <>
                        {' '}
                        <a href={l.source} target="_blank" rel="noopener noreferrer nofollow"
                          className="mono c-graphite" style={{ fontSize: 10 }}>source</a>
                      </>
                    )}
                  </span>
                  <input type="number" min="0" step="10" inputMode="numeric" style={champ}
                    value={l.montant_eur}
                    aria-label={`Coût : ${l.libelle}`}
                    onChange={(e) => {
                      const v = Math.max(0, Number(e.target.value) || 0)
                      setLignes((xs) => xs.map((x, j) => (j === i ? { ...x, montant_eur: v } : x)))
                    }} />
                </label>
              ))}

              {/* Carte grise : AUCUN chiffre sans région. Un tarif national
                  moyen fausserait le prix d'achat maximum sans que personne ne
                  sache d'où vient l'erreur. */}
              <div style={{ padding: '9px 0', borderBottom: '1px solid var(--rule)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, lineHeight: 1.5 }}>Carte grise</span>
                  <span className="mono num" style={{ fontSize: 14 }}>
                    {carte.connu ? euros(carte.montant_eur) : 'non calculée'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <select value={region} onChange={(e) => memoriserRegion(e.target.value)}
                    aria-label="Votre région"
                    style={{ ...champ, width: 'auto', textAlign: 'left', maxWidth: '100%' }}>
                    <option value="">Votre région…</option>
                    {Object.keys(tarifs?.regions || {}).map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <input type="number" min="1" max="99" inputMode="numeric" placeholder="CV"
                    aria-label="Puissance fiscale en chevaux (champ P.6 de la carte grise)"
                    value={cv} style={{ ...champ, width: 72 }}
                    onChange={(e) => { setCv(e.target.value); localStorage.setItem(CLE_CV, e.target.value) }} />
                </div>
                <p className="mono c-graphite" style={{ fontSize: 10, lineHeight: 1.6, marginTop: 6 }}>
                  Puissance fiscale : champ P.6 de la carte grise.
                  {tarifs?.maj ? ` Tarifs régionaux relevés le ${tarifs.maj.split('-').reverse().join('/')}.` : ''}
                  {' '}Les exonérations « véhicule propre » ne sont pas appliquées — à vérifier au simulateur officiel.
                </p>
              </div>

              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, padding: '7px 0', borderBottom: '1px solid var(--rule)',
              }}>
                <span style={{ fontSize: 14, lineHeight: 1.5 }}>
                  Imprévus ({params.imprevus_pct_travaux} % des travaux
                  {(achat?.lignes || []).some((l) => l.cle === 'imprevus') ? ', forfait inclus' : ''})
                </span>
                <input type="number" min="0" max="100" step="5" inputMode="numeric" style={champ}
                  aria-label="Imprévus, en pourcentage des travaux"
                  value={params.imprevus_pct_travaux}
                  onChange={(e) => setParams((p) => ({ ...p, imprevus_pct_travaux: Math.max(0, Number(e.target.value) || 0) }))} />
              </label>

              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, padding: '7px 0', borderBottom: '1px solid var(--rule-strong)',
              }}>
                <span style={{ fontSize: 14, lineHeight: 1.5, fontWeight: 600 }}>Marge visée</span>
                <input type="number" min="0" step="50" inputMode="numeric" style={champ}
                  aria-label="Marge visée, en euros"
                  value={params.marge_voulue_eur}
                  onChange={(e) => setParams((p) => ({ ...p, marge_voulue_eur: Math.max(0, Number(e.target.value) || 0) }))} />
              </label>

              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, padding: '9px 0',
              }}>
                <span style={{ fontSize: 14, lineHeight: 1.5 }}>
                  Marge que l'acheteur final négociera sur votre prix affiché
                </span>
                <input type="number" min="0" max="40" step="1" inputMode="numeric" style={champ}
                  aria-label="Marge de négociation de l'acheteur final, en pourcentage"
                  value={params.marge_negociation_pct}
                  onChange={(e) => setParams((p) => ({ ...p, marge_negociation_pct: Math.max(0, Number(e.target.value) || 0) }))} />
              </label>

              {achat?.incomplet && (
                <p className="mono" style={{ fontSize: 11, lineHeight: 1.7, marginTop: 8, color: 'var(--ambre)' }}>
                  Calcul incomplet : {achat.manquants.includes('carte_grise') ? 'la carte grise n’est pas chiffrée (région ou puissance fiscale manquante)' : achat.manquants.join(', ')}.
                  Le prix d'achat maximum est donc plus haut qu'il ne le sera réellement.
                </p>
              )}
            </div>
          )}

          {/* ── Crit'Air et ZFE ── */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--rule)' }}>
            <p style={etiquette}>Crit'Air et zone à faibles émissions</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              <span className="mono num" style={{ fontSize: 14 }}>{libelleCritair(classe)}</span>
              <select value={villeRevente} onChange={(e) => setVilleRevente(e.target.value)}
                aria-label="Ville où vous comptez revendre"
                style={{ ...champ, width: 'auto', textAlign: 'left' }}>
                <option value="">Ville de revente…</option>
                {ZFE.map((z) => <option key={z.ville} value={z.ville}>{z.ville}</option>)}
              </select>
            </div>
            {zfe && (
              <p style={{
                fontSize: 14, lineHeight: 1.6, marginTop: 8,
                color: zfe.interdit ? 'var(--rouge)' : 'var(--ink)',
              }}>
                {zfe.interdit
                  ? `Interdit dans la ZFE de ${zfe.ville} : le prix de revente est réduit de ${params.decote_zfe_pct} % dans le calcul.`
                  : `Autorisé dans la ZFE de ${zfe.ville} au seuil en vigueur.`}
                {' '}
                <a href={zfe.source} target="_blank" rel="noopener noreferrer nofollow"
                  className="mono c-graphite" style={{ fontSize: 10 }}>source</a>
              </p>
            )}
            <p className="mono c-graphite" style={{ fontSize: 10, lineHeight: 1.6, marginTop: 6 }}>
              Liste des ZFE relevée le {ZFE_RELEVE_LE.split('-').reverse().join('/')} — un seuil local peut
              avoir changé depuis, à confirmer auprès de la métropole.
            </p>
          </div>

          {/* ── Message vendeur ── */}
          {!masque && messageVendeur && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--rule)' }}>
              <p style={etiquette}>Message au vendeur</p>
              <pre style={{
                whiteSpace: 'pre-wrap', fontFamily: 'var(--sans)', fontSize: 14, lineHeight: 1.6,
                background: 'var(--field)', border: '1px solid var(--rule)', padding: '12px 14px',
                marginTop: 8, borderRadius: 2,
              }}>{messageVendeur}</pre>
              <button type="button" className="btn-ghost" style={{ marginTop: 10, maxWidth: 240 }}
                onClick={() => {
                  navigator.clipboard?.writeText(messageVendeur)
                    .then(() => { setCopie(true); setTimeout(() => setCopie(false), 3000) })
                    .catch(() => {})
                }}>
                {copie ? 'Copié' : 'Copier le message'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
