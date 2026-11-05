import React, { useEffect, useMemo, useState } from 'react'
import { critair, libelleCritair, sourceZfe, verdictZfe, ZFE_SOCLE } from '../data/critair.gen'
import { getConfigPublique } from '../lib/scoreApi'

// SPRINT 20 — Crit'Air et ZFE, dans TOUTES les analyses.
//
// Le classement vient du SERVEUR (il est calculé pour chaque analyse, sur la
// première immatriculation quand l'annonce la donne). Ce composant y ajoute
// une seule chose : la ville de L'UTILISATEUR, que le serveur ne connaît pas
// et n'a pas à connaître. Elle reste dans son navigateur.
//
// ⚠️ AUCUN effet sur le score, et c'est voulu : une vignette est une
// contrainte d'usage, pas un défaut du véhicule. Un diesel de 2010 n'est pas
// en moins bon état parce qu'il ne peut pas entrer dans Paris.
//
// ⚠️ Classement inconnu ⇒ AUCUN avertissement. On n'avertit jamais sur une
// supposition : ni l'énergie devinée, ni une année absente.

const CLE_VILLE = 'inspexo_ville_utilisateur'

export default function CritairBloc({ critair: bloc, vehicule }) {
  const [ville, setVille] = useState(() => {
    try { return localStorage.getItem(CLE_VILLE) || '' } catch { return '' }
  })
  const [config, setConfig] = useState(null)

  // La liste des ZFE vient de la config publique, datée. Elle n'est lue qu'une
  // fois, et son absence n'est pas une panne : `sourceZfe` retombe sur le
  // socle du code, de sorte qu'une config muette n'efface pas les
  // avertissements en silence.
  useEffect(() => {
    let vivant = true
    getConfigPublique()
      .then((c) => { if (vivant) setConfig(c?.zfe ?? null) })
      .catch(() => {})
    return () => { vivant = false }
  }, [])

  const source = useMemo(() => (config ? sourceZfe(config) : ZFE_SOCLE), [config])

  // Le serveur a déjà calculé la classe ; ce repli ne sert qu'aux dossiers
  // produits avant le sprint 20, qui n'en portent pas.
  const classe = bloc?.classe
    || critair(vehicule?.carburant || '', vehicule?.annee ?? null)

  const zfeMoi = useMemo(
    () => (ville.trim() ? verdictZfe(ville.trim(), classe, source) : null),
    [ville, classe, source],
  )

  const enregistrer = (v) => {
    setVille(v)
    try { v.trim() ? localStorage.setItem(CLE_VILLE, v.trim()) : localStorage.removeItem(CLE_VILLE) } catch { /* vide */ }
  }

  if (classe === 'inconnu' && !bloc) return null

  const zfeAnnonce = bloc?.zfe_annonce || null
  const villesConnues = source.zones.map((z) => z.ville)

  return (
    <div className="doc-sec" id="critair">
      <p className="eyebrow">Vignette Crit'Air et zones à faibles émissions</p>

      <dl className="specs">
        <div>
          <dt>Vignette</dt>
          <dd className="num">{libelleCritair(classe)}</dd>
        </div>
        {bloc?.premiere_immatriculation && (
          <div>
            <dt>1re immatriculation</dt>
            <dd className="num">{bloc.premiere_immatriculation}</dd>
          </div>
        )}
      </dl>

      {classe === 'inconnu' ? (
        <p className="c-ink2" style={{ fontSize: 14, lineHeight: 1.6, marginTop: 10 }}>
          Classement non déterminable : l'annonce ne donne pas de quoi le
          calculer (énergie ou date de première immatriculation). Il est écrit
          sur la carte grise, champ V.7 ou sur la vignette elle-même. Aucun
          avertissement n'est émis sans cette donnée.
        </p>
      ) : (
        <>
          {/* ⚠️ La réserve est OBLIGATOIRE quand la classe a été calculée sur
              l'année-modèle : aux bornes de 2006 et 2011, un an change la
              vignette, et c'est la date de PREMIÈRE IMMATRICULATION qui
              compte. Afficher la classe sans le dire serait affirmer plus que
              ce que l'annonce permet. */}
          {bloc?.base === 'annee_modele' && (
            <p className="c-ambre" style={{ fontSize: 14, lineHeight: 1.6, marginTop: 10 }}>
              Déduit de l'année-modèle, faute de date de première
              immatriculation dans l'annonce : à vérifier sur la carte grise.
              Aux bornes de 2006 et 2011, un an d'écart change la vignette.
            </p>
          )}

          {zfeAnnonce && (
            <p style={{ fontSize: 15, lineHeight: 1.6, marginTop: 10 }}>
              {zfeAnnonce.interdit ? (
                <>
                  <strong className="c-rouge">Interdit dans la ZFE de {zfeAnnonce.ville}</strong>,
                  {' '}où cette annonce est publiée.
                </>
              ) : (
                <>Autorisé dans la ZFE de {zfeAnnonce.ville}, où cette annonce est publiée.</>
              )}
              {' '}
              <a href={zfeAnnonce.source} target="_blank" rel="noopener noreferrer">
                règles de la zone
              </a>
            </p>
          )}

          <div style={{ marginTop: 12 }}>
            <label htmlFor="ville-zfe" style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>
              Où allez-vous rouler ? <span className="c-graphite">facultatif</span>
            </label>
            <input
              id="ville-zfe"
              type="text"
              list="villes-zfe"
              value={ville}
              onChange={(e) => enregistrer(e.target.value)}
              placeholder="Votre ville"
              autoComplete="off"
              style={{ fontSize: 16, padding: '10px 12px', minHeight: 44, width: '100%', maxWidth: 320 }}
            />
            <datalist id="villes-zfe">
              {villesConnues.map((v) => <option key={v} value={v} />)}
            </datalist>
            <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.6, marginTop: 6 }}>
              Reste dans votre navigateur. Rien n'est envoyé.
            </p>
          </div>

          {ville.trim() && !zfeMoi && (
            <p className="c-ink2" style={{ fontSize: 14, lineHeight: 1.6, marginTop: 10 }}>
              Aucune ZFE répertoriée pour « {ville.trim()} » au{' '}
              {bloc?.zfe_releve_le || source.maj}. Une commune absente de la
              liste n'est pas une garantie : les zones se créent et
              s'élargissent par arrêté local.
            </p>
          )}

          {zfeMoi && (
            <p style={{ fontSize: 15, lineHeight: 1.6, marginTop: 10 }}>
              {zfeMoi.interdit ? (
                <>
                  <strong className="c-rouge">
                    Ce véhicule est interdit dans la ZFE de {zfeMoi.ville}.
                  </strong>{' '}
                  Vignette {libelleCritair(classe)} ; la zone n'accepte pas ce
                  classement. À vérifier avant d'acheter : une dérogation
                  existe parfois (petit rouleur, véhicule de collection,
                  professionnel), et elle se demande à la métropole.
                </>
              ) : (
                <>
                  Autorisé dans la ZFE de {zfeMoi.ville} au{' '}
                  {zfeMoi.releve_le}.
                </>
              )}
              {' '}
              <a href={zfeMoi.source} target="_blank" rel="noopener noreferrer">
                règles de la zone
              </a>
            </p>
          )}
        </>
      )}

      <p className="mono c-graphite" style={{ fontSize: 11, lineHeight: 1.6, marginTop: 10 }}>
        Classement d'après l'arrêté du 21 juin 2016. Zones relevées le{' '}
        {bloc?.zfe_releve_le || source.maj} — elles évoluent par arrêté local :
        vérifiez auprès de la métropole concernée. Cette information ne pèse pas
        sur le verdict.
      </p>
    </div>
  )
}
