import { useEffect, useState } from 'react'
import { getConfigPublique } from '../lib/scoreApi'

// COMBIEN DE NOS AFFIRMATIONS SONT PORTÉES PAR UNE SOURCE INDÉPENDANTE ?
//
// Décision d'Utku du 6 nov. 2026 : « le nombre de pannes portées par une
// source indépendante, publié tel quel. »
//
// Depuis le sprint 21.1, une panne ne pèse sur le score que si au moins une de
// ses sources est officielle, de presse ou éditoriale — un garage, un vendeur
// de pièces ou un forum ne porte rien, parce que son revenu dépend de ce que
// le défaut soit réel et réparé. Le reste s'affiche en question au vendeur.
//
// ⚠️ LE CHIFFRE EST LU EN BASE, JAMAIS ÉCRIT EN DUR. La ligne « publié dès
// 50 dossiers relus à la main » de l'accueil a menti pendant un mois parce
// qu'elle était figée dans un fichier (sprint 15.1). Il est recalculé chaque
// jour par le cron, et il bouge : chaque fiche moteur générée en ajoute,
// chaque lot de la campagne de re-sourcing en ajoute.
//
// ⚠️ ET « PAS ENCORE MESURÉ » SE DIT. Tant que le cron n'a pas tourné, la
// valeur semée par la migration porte `maj: null` : on n'affiche alors aucun
// chiffre. Afficher 0/0 laisserait croire que notre catalogue est vide, ce qui
// est faux et alarmant pour la mauvaise raison.

/** Rend `null` quand rien n'est encore mesuré — à l'appelant de décider s'il
 *  affiche un repli ou rien du tout. */
export function usePannesPortees() {
  const [etat, setEtat] = useState(undefined)
  useEffect(() => {
    getConfigPublique()
      .then((c) => {
        const p = c?.pannes_portees
        setEtat(p && p.maj && Number(p.total) > 0 ? p : null)
      })
      .catch(() => setEtat(null))
  }, [])
  return etat
}

export function tauxPortees(p) {
  if (!p || !Number(p.total)) return null
  return Math.round((Number(p.portees) / Number(p.total)) * 100)
}

/** Une phrase, pour l'accueil. */
export function PhrasePannesPortees() {
  const p = usePannesPortees()
  if (!p) return null
  return (
    <>
      {' '}
      <strong>{p.portees}</strong> de nos <strong>{p.total}</strong> pannes
      {' '}référencées sont portées par une source indépendante ({tauxPortees(p)} %).
    </>
  )
}

/** Le bloc détaillé, pour /fiabilite. */
export default function PannesPortees() {
  const p = usePannesPortees()

  // ⚠️ Pas de squelette, pas de « Chargement… » : ce bloc n'est pas le sujet
  // de la page. Un écran qui clignote sur une mesure secondaire détourne du
  // taux d'erreur, qui est ce que le lecteur est venu lire.
  if (p === undefined || p === null) return null

  const taux = tauxPortees(p)
  return (
    <div style={{ border: '1px solid var(--rule-strong)', padding: '24px 20px', marginTop: 28 }}>
      <p className="eyebrow">Ce que nos sources valent</p>
      <p style={{ fontSize: 15, lineHeight: 1.6, margin: '10px 0 14px' }}>
        Une panne ne pèse sur le score que si au moins une de ses sources est{' '}
        <strong>officielle</strong> (rappel, bulletin technique, document du constructeur),{' '}
        <strong>de presse</strong> à rédaction identifiée, ou <strong>éditoriale</strong>{' '}
        — un média indépendant qui ne vend ni la réparation ni les pièces.
      </p>
      <p style={{ fontSize: 24, margin: '0 0 10px', fontFamily: 'var(--font-mono, monospace)' }}>
        <strong>{p.portees}</strong>
        <span style={{ color: 'var(--muted)' }}> / {p.total}</span>
        <span style={{ fontSize: 15, color: 'var(--muted)' }}> &nbsp;({taux} %)</span>
      </p>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--muted)', margin: 0 }}>
        {/* ⚠️ Le nombre brut d'abord, le pourcentage ensuite — « 54 sur 231 »
            se vérifie, « 23 % » se croit. Même règle que le taux d'erreur. */}
        Les {p.total - p.portees} autres restent affichées, mais comme{' '}
        <strong>questions au vendeur</strong> : « signalé par des garages et forums, non
        confirmé par une source indépendante ». Elles ne retirent aucun point.
        {p.fiches_a_terre > 0 && (
          <>
            {' '}Sur {p.fiches_total} fiches moteur, {p.fiches_a_terre} n'ont aujourd'hui
            aucune panne portée.
          </>
        )}
      </p>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '12px 0 0' }}>
        Recalculé chaque jour · dernière mesure le{' '}
        {String(p.maj).slice(8, 10)}/{String(p.maj).slice(5, 7)}/{String(p.maj).slice(0, 4)}
      </p>
    </div>
  )
}
