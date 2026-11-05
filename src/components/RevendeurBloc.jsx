import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  coutCarteGrise, messageVendeurRevendeur, offreOuverture, PARAMETRES_DEFAUT,
  prixAchatMax, prixRevente, MENTION_REVENDEUR,
} from '../data/revendeur.gen'
import { critair, libelleCritair, sourceZfe, verdictZfe, ZFE_SOCLE } from '../data/critair.gen'
import {
  getConfigPublique, preferencesRevendeurEcrire, preferencesRevendeurLire, revendeurCibleMaj,
} from '../lib/scoreApi'
import {
  parametresDepuisProfil, profilValide, rechercheSauvegardee,
} from '../data/cibles.gen'
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
const CLE_VILLE = 'inspexo_ville_revente'

const euros = (n) =>
  `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`

const RAISONS = {
  modele: 'autre modèle',
  energie: 'autre énergie',
  annee: 'année trop éloignée (± 2 ans)',
  km: 'kilométrage trop éloigné (± 40 000 km)',
  prix: 'prix illisible',
}

export default function RevendeurBloc({ analyse, analysisId }) {
  const bloc = analyse?.revendeur || null
  const masque = bloc?.masque === true

  const [config, setConfig] = useState(null)
  const [region, setRegion] = useState(() => localStorage.getItem(CLE_REGION) || '')
  const [cv, setCv] = useState(() => localStorage.getItem(CLE_CV) || '')
  const [villeRevente, setVilleRevente] = useState(() => localStorage.getItem(CLE_VILLE) || '')
  const [params, setParams] = useState(bloc?.parametres || PARAMETRES_DEFAUT)
  // ⚠️ NE GARDER QUE LES VRAIS TRAVAUX. Les lignes « imprévus », « carte
  // grise » et « marge visée » sont CALCULÉES par prixAchatMax à partir des
  // travaux et des paramètres : les lui repasser en entrée les compterait
  // DEUX FOIS. Défaut vu sur la capture — la Clio annonçait 2 017 € de manque
  // là où le serveur en calculait 1 391 €, soit exactement un second forfait
  // d'imprévus (626 €).
  const CALCULEES = new Set(['imprevus', 'carte_grise', 'marge_voulue', 'controle_technique'])
  const [lignes, setLignes] = useState(
    () => (bloc?.achat_max?.lignes || []).filter((l) => !CALCULEES.has(l.cle)),
  )
  // Le contrôle technique vient du serveur (coût SOURCÉ, et seulement si le
  // dernier a plus de six mois : l'art. R323-22 impose au vendeur d'en
  // fournir un de moins de six mois). Il reste modifiable à part.
  const [ctEur, setCtEur] = useState(
    () => (bloc?.achat_max?.lignes || []).find((l) => l.cle === 'controle_technique')?.montant_eur ?? 0,
  )
  const [copie, setCopie] = useState(false)
  const [copieFiltres, setCopieFiltres] = useState(false)
  const [carnet, setCarnet] = useState(null)

  useEffect(() => {
    getConfigPublique().then(setConfig).catch(() => setConfig({}))
  }, [])

  // ── Profil revendeur mémorisé (sprint 19.1) ───────────────────────────────
  //
  // ⚠️ L'OBJECTIF EST QU'AUCUNE QUESTION NE SOIT POSÉE DEUX FOIS. Région,
  // puissance fiscale, ville de revente et paramètres sont relus au premier
  // rendu : sur un partage depuis l'appli, les trois chiffres et le message
  // vendeur s'affichent tout de suite.
  //
  // Le profil suit le COMPTE quand il y en a un, le navigateur sinon — une
  // préférence d'affichage ne justifie pas de créer une ligne en base pour un
  // anonyme.
  useEffect(() => {
    let vivant = true
    supabase.auth.getSession().then(({ data }) => {
      if (!vivant || !data?.session) return
      preferencesRevendeurLire()
        .then((p) => {
          if (!vivant) return
          const profil = profilValide({ ...(p.parametres || {}), region: p.region, ville_revente: p.ville_revente })
          if (profil.region) { setRegion(profil.region); localStorage.setItem(CLE_REGION, profil.region) }
          if (profil.cv != null) { setCv(String(profil.cv)); localStorage.setItem(CLE_CV, String(profil.cv)) }
          if (profil.ville_revente) { setVilleRevente(profil.ville_revente); localStorage.setItem(CLE_VILLE, profil.ville_revente) }
          setParams((v) => parametresDepuisProfil(v, profil))
        })
        .catch(() => {})
    })
    return () => { vivant = false }
  }, [])

  // Enregistre un champ du profil : localStorage toujours, compte si connecté.
  const memoriser = (champ, valeur) => {
    const cles = { region: CLE_REGION, cv: CLE_CV, ville_revente: CLE_VILLE }
    if (cles[champ]) localStorage.setItem(cles[champ], String(valeur ?? ''))
    supabase.auth.getSession().then(({ data }) => {
      if (!data?.session) return
      const charge = champ === 'region' ? { region: String(valeur || '') }
        : champ === 'ville_revente' ? { villeRevente: String(valeur || '') }
        : { parametres: profilValide({ ...params, cv: champ === 'cv' ? valeur : cv }) }
      preferencesRevendeurEcrire(charge).catch(() => {})
    })
  }

  const tarifs = config?.carte_grise_tarifs || null
  // SPRINT 20 — la liste des ZFE vient de la MÊME config datée que les tarifs
  // de carte grise. Avant, elle était figée dans le miroir généré : une zone
  // créée par arrêté exigeait un redéploiement pour être prise en compte.
  const zones = useMemo(() => (config?.zfe ? sourceZfe(config.zfe) : ZFE_SOCLE), [config])
  const carte = useMemo(
    () => coutCarteGrise(cv ? Number(cv) : null, region || null, tarifs),
    [cv, region, tarifs],
  )

  const classe = bloc?.critair || critair(analyse?.vehicule?.carburant || '', analyse?.vehicule?.annee ?? null)
  const zfe = useMemo(
    () => (villeRevente ? verdictZfe(villeRevente, classe, zones) : null),
    [villeRevente, classe, zones],
  )
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
      ct_a_refaire_eur: ctEur > 0 ? ctEur : null,
      carte_grise_eur: carte.connu ? carte.montant_eur : null,
      region_connue: carte.connu,
      age_vehicule_ans: age,
    })
  }, [masque, revente, lignes, params, carte, analyse, ctEur])

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

  // ⚠️ LA RECHERCHE PORTE SUR LE MODÈLE, PAS SUR CETTE VOITURE-CI. Première
  // version : le plafond reprenait le prix d'achat maximum de l'annonce
  // ouverte, travaux compris — un embrayage et une courroie faisaient tomber
  // le plafond à 300 €, et le revendeur aurait sauvegardé une recherche
  // calibrée sur une épave. Le plafond est donc celui d'un exemplaire SANS
  // défaut connu : c'est ce qu'on cherche quand on cherche.
  const achatType = useMemo(() => {
    if (masque || !revente) return null
    const age = analyse?.vehicule?.annee ? new Date().getFullYear() - analyse.vehicule.annee : null
    return prixAchatMax(revente.valeur, [], params, {
      ct_a_refaire_eur: null,
      carte_grise_eur: carte.connu ? carte.montant_eur : null,
      region_connue: carte.connu,
      age_vehicule_ans: age,
    })
  }, [masque, revente, params, carte, analyse])

  const recherche = useMemo(() => {
    if (masque || !achatType || !bloc?.segment) return null
    return rechercheSauvegardee({
      marque: bloc.segment.marque,
      modele: bloc.segment.modele,
      energie: bloc.segment.energie,
      annee_mediane: analyse?.vehicule?.annee ?? null,
      km_median: analyse?.vehicule?.kilometrage ?? null,
    }, achatType.valeur)
  }, [masque, achatType, bloc, analyse])

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
                {masque ? <span style={{ fontSize: 15, fontWeight: 500 }}>réservé au Pass</span>
                  : achat ? (achat.possible ? euros(achat.valeur) : 'aucune marge') : '—'}
              </p>
            </div>
            <div>
              <p style={etiquette}>Offre d'ouverture</p>
              <p style={chiffre} data-testid="revendeur-offre">
                {masque ? <span style={{ fontSize: 15, fontWeight: 500 }}>réservé au Pass</span>
                  : offre != null ? euros(offre)
                  : achat && !achat.possible ? 'rien à proposer' : '—'}
              </p>
            </div>
          </div>

              {!masque && achat && !achat.possible && (
                <p style={{ fontSize: 15, lineHeight: 1.6, marginTop: 10, color: 'var(--rouge)' }}>
                  À ces conditions, cette voiture ne laisse aucune marge : les coûts dépassent le prix
                  de revente réaliste de {euros(achat.manque_eur)}. Il n'existe pas de prix d'achat qui
                  tienne votre marge visée — à moins de revoir un coût ou la marge ci-dessous.
                </p>
              )}

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

              {/* Contrôle technique : compté quand le dernier a plus de six
                  mois, parce que le VENDEUR doit en fournir un de moins de six
                  mois (art. R323-22 du code de la route). Coût SOURCÉ, sinon
                  aucune ligne — jamais de montant inventé. */}
              {ctEur > 0 && (
                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12, padding: '7px 0', borderBottom: '1px solid var(--rule)',
                }}>
                  <span style={{ fontSize: 14, lineHeight: 1.5 }}>Contrôle technique à refaire</span>
                  <input type="number" min="0" step="10" inputMode="numeric" style={champ}
                    aria-label="Coût du contrôle technique" value={ctEur}
                    onChange={(e) => setCtEur(Math.max(0, Number(e.target.value) || 0))} />
                </label>
              )}

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
                  <select value={region} onChange={(e) => { setRegion(e.target.value); memoriser('region', e.target.value) }}
                    aria-label="Votre région"
                    style={{ ...champ, width: 'auto', textAlign: 'left', maxWidth: '100%' }}>
                    <option value="">Votre région…</option>
                    {Object.keys(tarifs?.regions || {}).map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <input type="number" min="1" max="99" inputMode="numeric" placeholder="CV"
                    aria-label="Puissance fiscale en chevaux (champ P.6 de la carte grise)"
                    value={cv} style={{ ...champ, width: 72 }}
                    onChange={(e) => { setCv(e.target.value); memoriser('cv', Number(e.target.value) || null) }} />
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
                  Imprévus — part des travaux (%)
                  {(achat?.lignes || []).find((l) => l.cle === 'imprevus')
                    ? ` → ${euros((achat.lignes.find((l) => l.cle === 'imprevus') || {}).montant_eur)}`
                    : ''}
                </span>
                <input type="number" min="0" max="100" step="5" inputMode="numeric" style={champ}
                  aria-label="Imprévus, en pourcentage des travaux"
                  value={params.imprevus_pct_travaux}
                  onChange={(e) => {
                  const v = Math.max(0, Number(e.target.value) || 0)
                  setParams((p) => ({ ...p, imprevus_pct_travaux: v }))
                  memoriser('parametres', v)
                }} />
              </label>

              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, padding: '7px 0', borderBottom: '1px solid var(--rule-strong)',
              }}>
                <span style={{ fontSize: 14, lineHeight: 1.5, fontWeight: 600 }}>Marge visée</span>
                <input type="number" min="0" step="50" inputMode="numeric" style={champ}
                  aria-label="Marge visée, en euros"
                  value={params.marge_voulue_eur}
                  onChange={(e) => {
                  const v = Math.max(0, Number(e.target.value) || 0)
                  setParams((p) => ({ ...p, marge_voulue_eur: v }))
                  memoriser('parametres', v)
                }} />
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
                  onChange={(e) => {
                  const v = Math.max(0, Number(e.target.value) || 0)
                  setParams((p) => ({ ...p, marge_negociation_pct: v }))
                  memoriser('parametres', v)
                }} />
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
              <select value={villeRevente} onChange={(e) => { setVilleRevente(e.target.value); memoriser('ville_revente', e.target.value) }}
                aria-label="Ville où vous comptez revendre"
                style={{ ...champ, width: 'auto', textAlign: 'left' }}>
                <option value="">Ville de revente…</option>
                {zones.zones.map((z) => <option key={z.ville} value={z.ville}>{z.ville}</option>)}
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
              Liste des ZFE relevée le {zones.maj.split('-').reverse().join('/')} — un seuil local peut
              avoir changé depuis, à confirmer auprès de la métropole.
            </p>
          </div>

          {/* ── La recherche à sauvegarder ───────────────────────────────────
              Le prix d'achat maximum devient un plafond de recherche : c'est
              ce qui transforme une analyse en méthode. Réservé au Pass, comme
              le reste du détail. */}
          {!masque && achatType && recherche && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--rule)' }}>
              <p style={etiquette}>Recherche à sauvegarder sur Leboncoin</p>
              <div style={{ marginTop: 8 }}>
                {recherche.filtres.map((f) => (
                  <div key={f.champ} style={{
                    display: 'flex', justifyContent: 'space-between', gap: 12,
                    padding: '6px 0', borderBottom: '1px solid var(--rule)',
                  }}>
                    <span className="mono c-graphite" style={{ fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                      {f.champ}
                    </span>
                    <span className="mono num" style={{ fontSize: 13, textAlign: 'right' }}>{f.valeur}</span>
                  </div>
                ))}
              </div>
              <p className="mono c-graphite" style={{ fontSize: 10, lineHeight: 1.6, marginTop: 8 }}>
                {recherche.note}
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                <button type="button" className="btn-ghost" style={{ maxWidth: 240 }}
                  onClick={() => {
                    const texte = recherche.filtres.map((f) => `${f.champ} : ${f.valeur}`).join('\n')
                    navigator.clipboard?.writeText(texte)
                      .then(() => { setCopieFiltres(true); setTimeout(() => setCopieFiltres(false), 3000) })
                      .catch(() => {})
                  }}>
                  {copieFiltres ? 'Copié' : 'Copier les filtres'}
                </button>
                {recherche.url && (
                  <a className="btn-ghost" style={{ maxWidth: 240 }} href={recherche.url}
                    target="_blank" rel="noopener noreferrer nofollow">
                    Ouvrir la recherche
                  </a>
                )}
              </div>
              <p className="mono c-graphite" style={{ fontSize: 10, lineHeight: 1.6, marginTop: 6 }}>
                Ce plafond vaut pour un exemplaire SANS défaut connu : c'est ce qu'on cherche
                quand on cherche. Les travaux d'une annonce précise se retranchent ensuite,
                ci-dessus.
              </p>
              {!achatType.possible && (
                <p className="mono" style={{ fontSize: 11, lineHeight: 1.7, marginTop: 8, color: 'var(--ambre)' }}>
                  Même sans défaut, votre marge visée n'est pas atteignable sur ce modèle aux prix
                  que vous avez relevés. Baissez la marge, ou cherchez ailleurs.
                </p>
              )}
            </div>
          )}

          {/* ── Le carnet de cibles ──────────────────────────────────────────
              Un segment où l'utilisateur a assez de relevés devient une
              CIBLE : un modèle qu'il peut chercher activement. Le carnet est
              privé, réservé au Pass, et ne contient aucune annonce. */}
          {!masque && nbRetenus >= 6 && (
            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn-ghost" style={{ maxWidth: 300 }}
                disabled={carnet === 'en_cours' || carnet === 'fait'}
                onClick={() => {
                  setCarnet('en_cours')
                  revendeurCibleMaj(analysisId)
                    .then((r) => setCarnet(r?.enregistre ? 'fait' : 'refus'))
                    .catch(() => setCarnet('refus'))
                }}>
                {carnet === 'fait' ? 'Ajouté à mes cibles'
                  : carnet === 'en_cours' ? 'Enregistrement…'
                  : carnet === 'refus' ? 'Non enregistré'
                  : 'Ajouter ce modèle à mes cibles'}
              </button>
              {carnet === 'fait' && (
                <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.7, marginTop: 8 }}>
                  Retrouvez-le sur <Link to="/cibles">Mes cibles</Link>, avec la marge estimée des
                  autres modèles où vous avez assez de relevés.
                </p>
              )}
              {carnet === 'refus' && (
                <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.7, marginTop: 8 }}>
                  Enregistrement impossible : les cibles sont une fonction du Pass achat, et
                  demandent d'être connecté.
                </p>
              )}
            </div>
          )}

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
