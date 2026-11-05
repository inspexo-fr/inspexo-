import React, { useState } from 'react'
import { concordanceVin, decoderVin } from '../lib/vin'

// SPRINT 7 / SPRINT 20 — Bloc « Numéro de châssis (VIN) » de /a/:id.
//
// Étape 1, GRATUITE et locale (rien n'est envoyé nulle part) : structure,
// constructeur (WMI), pays, année-modèle probable, clé de contrôle — et
// recoupement avec l'annonce (un VIN d'une autre marque se voit immédiatement).
// Étape 2 (moteur exact, finition, équipements d'origine) : fournisseur payant
// à valider — docs/vin-fournisseurs.md — volontairement non activé.
//
// SPRINT 20 — DEUX sources, et la différence se dit :
//  · le VIN écrit DANS L'ANNONCE, trouvé par le serveur (expression régulière,
//    jamais par le modèle) et déjà décodé : `vin` ;
//  · le VIN que l'acheteur obtient du vendeur et saisit ici.
//
// ⚠️ Le serveur ne transmet JAMAIS le numéro, seulement ce qu'il en a déduit :
// /a/:id est une page publique, et un VIN est rattachable à son titulaire par
// le SIV. C'est pourquoi ce bloc n'affiche pas le VIN de l'annonce — il le
// commente. L'acheteur, lui, a l'annonce sous les yeux.
//
// ⚠️ La comparaison vit dans `concordanceVin` (module partagé) : avant le
// sprint 20 elle était écrite ici, et le serveur pouvait conclure autrement
// que l'écran sur le même VIN.

function Constats({ constats }) {
  return constats.map((c, i) => (
    <p
      key={i}
      className={c.ok === false ? 'c-rouge' : c.ok ? 'c-vert' : 'c-graphite'}
      style={{ fontSize: 13, marginTop: 8, lineHeight: 1.6, fontWeight: c.ok === false ? 600 : 400 }}
    >
      {c.texte}
    </p>
  ))
}

export default function VinBloc({ vehicule, vin }) {
  const [saisie, setSaisie] = useState('')
  const [resultat, setResultat] = useState(null)

  const decoder = (e) => {
    e.preventDefault()
    if (!saisie.trim()) return
    setResultat(decoderVin(saisie))
  }

  const constatsSaisie = resultat?.valide ? concordanceVin(resultat, vehicule).constats : []
  if (resultat?.valide && !resultat.cle.obligatoire && !resultat.cle.concorde) {
    constatsSaisie.push({
      ok: null,
      texte: 'Clé de contrôle non concordante : fréquent sur les VIN européens (elle n\'y est pas '
        + 'obligatoire) — vérifiez simplement votre saisie contre le champ E de la carte grise.',
    })
  }

  const annonce = vin?.present ? vin : null

  return (
    <div className="doc-sec" id="vin">
      <p className="eyebrow">Numéro de châssis (VIN)</p>

      {/* ── Le VIN que l'annonce contient déjà ───────────────────────────── */}
      {annonce && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 8 }}>
            {annonce.etiquette
              ? 'L\'annonce donne le numéro de châssis. Il a été décodé ici, et le numéro lui-même n\'est pas repris sur cette page.'
              : 'Une suite de 17 caractères reconnue comme un numéro de châssis figure dans l\'annonce. Décodée ci-dessous, sous réserve que ce soit bien le VIN de ce véhicule.'}
          </p>
          {annonce.valide ? (
            <>
              <dl className="specs">
                <div>
                  <dt>Constructeur (WMI)</dt>
                  <dd>{annonce.constructeur || 'Non reconnu — ce WMI n\'est pas dans notre liste'}</dd>
                </div>
                {annonce.pays && <div><dt>Pays de fabrication</dt><dd>{annonce.pays}</dd></div>}
                {!annonce.pays && annonce.region && (
                  <div><dt>Région de fabrication</dt><dd>{annonce.region}</dd></div>
                )}
                {annonce.annees_possibles?.length > 0 && (
                  <div>
                    <dt>Année-modèle probable</dt>
                    <dd className="num">{annonce.annees_possibles.join(' ou ')}</dd>
                  </div>
                )}
              </dl>
              <Constats constats={annonce.concordance?.constats || []} />
              {/* ⚠️ La clé de contrôle n'est obligatoire qu'en Amérique du
                  Nord : une discordance est un signal de relecture, jamais une
                  preuve que le VIN est faux. Elle ne pèse pas sur le verdict. */}
              {annonce.cle_concorde === false && !annonce.cle_obligatoire && (
                <p className="c-graphite" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
                  Clé de contrôle non concordante. Elle n'est pas obligatoire sur
                  les VIN européens : à relire contre le champ E de la carte
                  grise, sans en conclure quoi que ce soit.
                </p>
              )}
              {annonce.cle_concorde === false && annonce.cle_obligatoire && (
                <p className="c-rouge" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.6, fontWeight: 600 }}>
                  Clé de contrôle non concordante sur un VIN d'Amérique du Nord,
                  où elle est <strong>obligatoire</strong> : ce numéro est mal
                  recopié, ou il n'est pas authentique. À faire expliquer.
                </p>
              )}
            </>
          ) : (
            <p className="c-graphite" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
              La suite trouvée ne respecte pas la structure d'un VIN : rien n'en
              est déduit.
            </p>
          )}
        </div>
      )}

      {/* ── Le VIN que l'acheteur demande au vendeur ─────────────────────── */}
      <p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 8 }}>
        {annonce
          ? 'Vérifiez-le sur place contre la carte grise (champ E) et le numéro frappé sur le véhicule : c\'est la seule façon de voir qu\'un numéro a été substitué.'
          : 'Demandez-le au vendeur (champ E de la carte grise, 17 caractères) : il sert au rapport HistoVec, à la campagne Takata et aux rappels constructeur. Vérification de structure et de cohérence ici même, sur votre appareil — rien n\'est transmis.'}
      </p>
      <form onSubmit={decoder} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <input
          className="input mono" value={saisie} onChange={e => setSaisie(e.target.value)}
          placeholder="VF3XXXXXXXXXXXXXX" maxLength={21} aria-label="Numéro de châssis (VIN)"
          style={{ flex: '1 1 220px', width: 'auto', textTransform: 'uppercase' }}
          autoComplete="off" spellCheck="false"
        />
        <button type="submit" className="btn-ghost btn-auto" style={{ height: 48 }}>Vérifier</button>
      </form>

      {resultat && !resultat.valide && (
        <div className="alert alert-rouge" style={{ marginTop: 10 }}>
          {resultat.erreurs.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

      {resultat?.valide && (
        <div style={{ marginTop: 10 }}>
          <dl className="specs">
            <div><dt>Constructeur (WMI)</dt><dd>{resultat.constructeur || 'Non reconnu — vérifiez la saisie'}</dd></div>
            {resultat.pays && <div><dt>Pays de fabrication</dt><dd>{resultat.pays}</dd></div>}
            {!resultat.pays && resultat.region && <div><dt>Région de fabrication</dt><dd>{resultat.region}</dd></div>}
            {resultat.annees_possibles.length > 0 && (
              <div><dt>Année-modèle probable</dt><dd className="num">{resultat.annees_possibles.join(' ou ')}</dd></div>
            )}
          </dl>
          <Constats constats={constatsSaisie} />
        </div>
      )}

      <p className="mono c-graphite" style={{ marginTop: 10, fontSize: 11, lineHeight: 1.6 }}>
        Décodage normatif (ISO 3779) : structure, constructeur, année probable. Le moteur exact
        et les équipements d'origine exigent une base constructeur — en préparation pour le Pass achat.
      </p>
    </div>
  )
}
