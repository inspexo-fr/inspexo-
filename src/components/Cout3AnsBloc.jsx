import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { coutTroisAns, KM_AN_DEFAUT, kmAnBorne } from '../data/cout3ans.gen'
import { sourceZfe, verdictZfe, ZFE_SOCLE } from '../data/critair.gen'
import { coutTroisAnsDossier, getConfigPublique } from '../lib/scoreApi'

// SPRINT 22 — Coût réel sur 3 ans.
//
// ⚠️ VERROU SERVEUR. Sans Pass, la fonction `cout-3ans` ne renvoie que le
// total : les lignes ne sont pas dans le navigateur, elles ne sont pas
// masquées à l'écran. Avec Pass, elle renvoie aussi l'ENTRÉE du calcul, et
// le module généré `cout3ans.gen.js` — traduction du module serveur —
// recalcule ici, au kilométrage annuel et aux corrections saisies.
//
// Région, puissance fiscale et ville : mêmes clés que les blocs revendeur et
// Crit'Air, qui les ont peut-être déjà demandées. Une question n'est pas
// posée deux fois.

const CLE_KM = 'inspexo_km_an'
const CLE_REGION = 'inspexo_region'
const CLE_CV = 'inspexo_cv'
const CLE_VILLE = 'inspexo_ville_utilisateur'

const lire = (k) => { try { return localStorage.getItem(k) || '' } catch { return '' } }
const ecrire = (k, v) => { try { v ? localStorage.setItem(k, String(v)) : localStorage.removeItem(k) } catch { /* vide */ } }

const euros = (n) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`
const fourchette = (a, b) => (a === b ? euros(a) : `${euros(a)} – ${euros(b)}`)

export default function Cout3AnsBloc({ analysisId, critair }) {
  const [kmAn, setKmAn] = useState(() => kmAnBorne(lire(CLE_KM) || KM_AN_DEFAUT))
  const [saisieKm, setSaisieKm] = useState(() => String(kmAnBorne(lire(CLE_KM) || KM_AN_DEFAUT)))
  const [region, setRegion] = useState(() => lire(CLE_REGION))
  const [cv, setCv] = useState(() => lire(CLE_CV))
  const [ville] = useState(() => lire(CLE_VILLE))
  const [config, setConfig] = useState(null)
  const [rep, setRep] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [corrections, setCorrections] = useState({})
  // Avec Pass, le kilométrage se recalcule LOCALEMENT : la requête garde le
  // kilométrage du premier appel. Sans Pass, chaque changement la refait.
  const [estPass, setEstPass] = useState(false)
  const kmPremier = useRef(kmAn)
  const kmRequete = estPass ? kmPremier.current : kmAn

  useEffect(() => { getConfigPublique().then(setConfig).catch(() => setConfig({})) }, [])

  // Région et CV changent la carte grise, calculée SERVEUR : on redemande.
  // Le kilométrage annuel, lui, se recalcule localement quand on a l'entrée.
  useEffect(() => {
    let vivant = true
    setErreur(null)
    coutTroisAnsDossier(analysisId, { kmAn: kmRequete, region, cv })
      .then((r) => { if (vivant) { setRep(r); setEstPass(r?.pass === true) } })
      .catch((e) => { if (vivant) setErreur(e) })
    return () => { vivant = false }
  }, [analysisId, region, cv, kmRequete])

  const cout = useMemo(() => {
    if (!rep) return null
    if (rep.pass && rep.entree) return coutTroisAns(rep.entree, { km_an: kmAn, corrections })
    return rep.cout
  }, [rep, kmAn, corrections])

  const zones = useMemo(() => (config?.zfe ? sourceZfe(config.zfe) : ZFE_SOCLE), [config])
  const classe = critair?.classe || 'inconnu'
  const zfeMoi = ville ? verdictZfe(ville, classe, zones) : null
  const zfeAnnonce = critair?.zfe_annonce || null
  const regions = Object.keys(config?.carte_grise_tarifs?.regions || {})

  const validerKm = () => {
    const v = kmAnBorne(saisieKm)
    setKmAn(v); setSaisieKm(String(v)); ecrire(CLE_KM, v)
  }

  if (erreur && !cout) {
    return (
      <div className="doc-sec" id="cout-3ans">
        <p className="eyebrow">Coût réel sur 3 ans</p>
        <p className="c-graphite" style={{ fontSize: 14 }}>Calcul indisponible pour le moment.</p>
      </div>
    )
  }
  if (!cout) return null

  const masque = cout.masque === true

  return (
    <div className="doc-sec" id="cout-3ans">
      <p className="eyebrow">Coût réel sur 3 ans</p>

      <dl className="specs">
        <div>
          <dt>Total sur 3 ans</dt>
          <dd className="num">{fourchette(cout.total_min, cout.total_max)}</dd>
        </div>
        <div>
          <dt>Kilométrage annuel</dt>
          <dd className="num">{String(cout.km_an).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} km</dd>
        </div>
      </dl>

      {cout.partiel && (
        <p className="c-ambre" style={{ fontSize: 14, lineHeight: 1.6, marginTop: 10 }}>
          Total partiel : {cout.non_chiffrees} poste{cout.non_chiffrees > 1 ? 's' : ''} non
          chiffré{cout.non_chiffrees > 1 ? 's' : ''}, à ajouter.
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
        <label style={{ fontSize: 14 }}>
          <span style={{ display: 'block', marginBottom: 6 }}>Kilomètres par an</span>
          <input
            type="number" inputMode="numeric" min={1000} max={80000} step={1000}
            value={saisieKm}
            onChange={(e) => setSaisieKm(e.target.value)}
            onBlur={validerKm}
            onKeyDown={(e) => { if (e.key === 'Enter') validerKm() }}
            style={{ fontSize: 16, padding: '10px 12px', minHeight: 44, width: 140 }}
          />
        </label>
        <label style={{ fontSize: 14 }}>
          <span style={{ display: 'block', marginBottom: 6 }}>Région (carte grise)</span>
          <select value={region} onChange={(e) => { setRegion(e.target.value); ecrire(CLE_REGION, e.target.value) }}
            style={{ fontSize: 16, padding: '10px 12px', minHeight: 44, maxWidth: 260 }}>
            <option value="">—</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 14 }}>
          <span style={{ display: 'block', marginBottom: 6 }}>Puissance fiscale (CV)</span>
          <input
            type="number" inputMode="numeric" min={1} max={99}
            value={cv}
            onChange={(e) => setCv(e.target.value)}
            onBlur={(e) => ecrire(CLE_CV, e.target.value)}
            style={{ fontSize: 16, padding: '10px 12px', minHeight: 44, width: 100 }}
          />
        </label>
      </div>

      {(zfeMoi?.interdit || zfeAnnonce?.interdit) && (
        <p style={{ fontSize: 15, lineHeight: 1.6, marginTop: 12 }}>
          <strong className="c-rouge">Avertissement ZFE</strong> : cette vignette est interdite dans la
          zone de {zfeMoi?.interdit ? zfeMoi.ville : zfeAnnonce.ville}. Un usage quotidien y est exclu,
          quel que soit le coût ci-dessus.{' '}
          <a href={(zfeMoi?.interdit ? zfeMoi : zfeAnnonce).source} target="_blank" rel="noopener noreferrer">règles de la zone</a>
        </p>
      )}

      {masque ? (
        <p className="c-ink2" style={{ fontSize: 14, lineHeight: 1.6, marginTop: 12 }}>
          Le détail ligne à ligne ({cout.nb_lignes_masquees} postes, chacun avec sa source et modifiable)
          est réservé au <Link to="/pass">Pass achat</Link>.
        </p>
      ) : (
        <div style={{ marginTop: 14 }}>
          {cout.lignes.map((l) => (
            <div key={l.id} style={{ borderBottom: '1px solid var(--rule)', padding: '10px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15 }}>
                  {l.libelle}
                  {l.occurrences > 1 && l.poste !== 'controle_technique' ? ` × ${l.occurrences}` : ''}
                </span>
                {l.chiffree
                  ? <span className="num" style={{ fontSize: 15 }}>{fourchette(l.min, l.max)}</span>
                  : <span className="c-ambre" style={{ fontSize: 14 }}>{l.motif}</span>}
              </div>
              <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.6, marginTop: 4 }}>
                {l.echeance}
                {l.source && <> · {l.source.libelle}{l.source.urls.map((u, i) => (
                  <span key={u}> <a href={u} target="_blank" rel="noopener noreferrer">[{i + 1}]</a></span>
                ))}</>}
              </p>
              {l.poste !== 'prix' && (
                <label className="mono c-graphite" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  Corriger
                  <input
                    type="number" inputMode="numeric" min={0}
                    defaultValue={l.corrigee ? l.min : ''}
                    placeholder="€"
                    onBlur={(e) => {
                      const v = e.target.value === '' ? undefined : Number(e.target.value)
                      setCorrections((c) => { const n = { ...c }; if (v == null) delete n[l.id]; else n[l.id] = v; return n })
                    }}
                    style={{ fontSize: 16, padding: '6px 8px', minHeight: 44, width: 110 }}
                  />
                </label>
              )}
            </div>
          ))}
          {cout.non_etablies?.length > 0 && (
            <p className="c-graphite" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 10 }}>
              Non comptés, faute d'échéance établie par une source indépendante :{' '}
              {cout.non_etablies.map((o) => o.operation).join(', ')} — à vérifier dans le carnet.
            </p>
          )}
        </div>
      )}

      <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.6, marginTop: 12 }}>{cout.mention}</p>
    </div>
  )
}
