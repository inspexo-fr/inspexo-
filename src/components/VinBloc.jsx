import React, { useState } from 'react'
import { decoderVin } from '../lib/vin'

// SPRINT 7 — Bloc « Numéro de châssis (VIN) » de /a/:id.
// Étape 1, GRATUITE et locale (rien n'est envoyé nulle part) : structure,
// constructeur (WMI), pays, année-modèle probable, clé de contrôle — et
// recoupement avec l'annonce (un VIN d'une autre marque se voit immédiatement).
// Étape 2 (moteur exact, finition, équipements d'origine) : fournisseur payant
// à valider — docs/vin-fournisseurs.md — volontairement non activé.

const normalise = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function VinBloc({ vehicule }) {
  const [saisie, setSaisie] = useState('')
  const [resultat, setResultat] = useState(null)

  const decoder = (e) => {
    e.preventDefault()
    if (!saisie.trim()) return
    setResultat(decoderVin(saisie))
  }

  const marqueAnnonce = vehicule?.marque || null
  const anneeAnnonce = typeof vehicule?.annee === 'number' ? vehicule.annee : null

  const concordances = []
  if (resultat?.valide) {
    if (resultat.constructeur && marqueAnnonce) {
      const ok = normalise(resultat.constructeur).includes(normalise(marqueAnnonce)) ||
        normalise(marqueAnnonce).includes(normalise(resultat.constructeur).split(' ')[0])
      concordances.push(ok
        ? { ok, texte: `Constructeur du VIN (${resultat.constructeur}) cohérent avec l'annonce (${marqueAnnonce}).` }
        : { ok, texte: `Le VIN désigne un véhicule ${resultat.constructeur} alors que l'annonce dit ${marqueAnnonce} : faites-vous expliquer cette différence avant toute visite.` })
    }
    if (anneeAnnonce && resultat.annees_possibles.length > 0) {
      const ok = resultat.annees_possibles.some(a => Math.abs(a - anneeAnnonce) <= 1)
      concordances.push(ok
        ? { ok, texte: `Année-modèle du VIN (${resultat.annees_possibles.join(' ou ')}) compatible avec l'annonce (${anneeAnnonce}).` }
        : { ok, texte: `L'année-modèle codée dans le VIN (${resultat.annees_possibles.join(' ou ')}) ne correspond pas à l'annonce (${anneeAnnonce}) — ce code n'est pas obligatoire en Europe, mais posez la question.` })
    }
    if (!resultat.cle.obligatoire && !resultat.cle.concorde) {
      concordances.push({
        ok: null,
        texte: 'Clé de contrôle non concordante : fréquent sur les VIN européens (elle n\'y est pas obligatoire) — vérifiez simplement votre saisie contre le champ E de la carte grise.',
      })
    }
  }

  return (
    <div className="doc-sec">
      <p className="eyebrow">Numéro de châssis (VIN)</p>
      <p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 8 }}>
        Demandez-le au vendeur (champ E de la carte grise, 17 caractères) : il sert au rapport
        HistoVec, à la campagne Takata et aux rappels constructeur. Vérification de structure
        et de cohérence ici même, sur votre appareil — rien n'est transmis.
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
          {concordances.map((c, i) => (
            <p key={i} className={c.ok === false ? 'c-rouge' : c.ok ? 'c-vert' : 'c-graphite'}
              style={{ fontSize: 13, marginTop: 8, lineHeight: 1.6, fontWeight: c.ok === false ? 600 : 400 }}>
              {c.texte}
            </p>
          ))}
          <p className="mono c-graphite" style={{ marginTop: 10, fontSize: 11, lineHeight: 1.6 }}>
            Décodage normatif (ISO 3779) : structure, constructeur, année probable. Le moteur exact
            et les équipements d'origine exigent une base constructeur — en préparation pour le Pass achat.
          </p>
        </div>
      )}
    </div>
  )
}
