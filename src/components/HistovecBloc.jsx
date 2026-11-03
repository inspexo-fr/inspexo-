import React, { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { lectureHistovec } from '../lib/scoreApi'

// SPRINT 13 — Dépôt et lecture du certificat de situation administrative
// HistoVec (le PDF produit par le bouton « Imprimer le CSA »).
//
// ⚠️ RÈGLE PRODUIT : un signal ROUGE est affiché MÊME SANS PASS. On ne cache
// pas un vol, un gage ou une procédure « véhicule gravement endommagé »
// derrière un paiement. Le masquage du détail est fait SERVEUR
// (`_histovec_publique`) : ce composant n'affiche que ce qu'il reçoit.
//
// Le PDF n'est jamais stocké, et n'est même pas conservé en mémoire ici au-delà
// de l'envoi.

const COULEUR = { rouge: 'c-rouge', orange: 'c-orange', avertissement: 'c-graphite' }
const ETIQUETTE = { rouge: 'SIGNAL ROUGE', orange: 'À VÉRIFIER', avertissement: 'INFORMATION' }

function Signaux({ signaux }) {
  if (!signaux?.length) {
    return (
      <p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 10 }}>
        Rien à signaler sur le certificat : pas de gage, pas d'opposition, pas de vol,
        aucune procédure pour véhicule endommagé.
      </p>
    )
  }
  return (
    <div style={{ marginTop: 10 }}>
      {signaux.map((s, i) => (
        <div key={s.cle ?? i} style={{ paddingTop: 10, borderTop: i > 0 ? '1px solid var(--filet)' : 'none', marginTop: i > 0 ? 10 : 0 }}>
          <div className={`mono ${COULEUR[s.niveau] ?? ''}`} style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
            {ETIQUETTE[s.niveau] ?? s.niveau}
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 4 }}>{s.texte}</p>
        </div>
      ))}
    </div>
  )
}

export default function HistovecBloc({ analysisId, result, onMaj }) {
  const [etat, setEtat] = useState('idle') // idle | envoi | erreur
  const [message, setMessage] = useState(null)
  const [lecture, setLecture] = useState(result?.histovec ?? null)
  const champ = useRef(null)

  const deposer = async (fichier) => {
    if (!fichier) return
    setEtat('envoi')
    setMessage(null)
    try {
      const b64 = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
        r.onerror = () => reject(new Error('Lecture du fichier impossible.'))
        r.readAsDataURL(fichier)
      })
      const r = await lectureHistovec(analysisId, b64)
      setLecture(r.histovec)
      setEtat('idle')
      if (onMaj) onMaj(r)
    } catch (e) {
      setEtat('erreur')
      setMessage(e?.message || 'Lecture impossible. Réessayez.')
    }
  }

  return (
    <section id="histovec" style={{ marginTop: 28 }}>
      <h2 className="h-doc">Certificat de situation administrative</h2>

      {lecture ? (
        <>
          <Signaux signaux={lecture.signaux} />

          {lecture.concorde === false && (
            <p className="mono c-rouge" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.6 }}>
              CE CERTIFICAT NE DÉCRIT PAS LE VÉHICULE DE L'ANNONCE.
            </p>
          )}

          {lecture.masque && lecture.nb_masques > 0 && (
            <p className="mono c-graphite" style={{ fontSize: 11, marginTop: 12, lineHeight: 1.6 }}>
              {lecture.nb_masques} autre{lecture.nb_masques > 1 ? 's' : ''} point
              {lecture.nb_masques > 1 ? 's' : ''} relevé{lecture.nb_masques > 1 ? 's' : ''} sur ce
              certificat (nombre de détenteurs, passage en location, procédure levée, validité) —{' '}
              <Link to="/pass">lecture complète dans le Pass achat</Link>. Les signaux rouges, eux,
              sont toujours affichés.
            </p>
          )}

          <p className="mono c-graphite" style={{ fontSize: 11, marginTop: 12, lineHeight: 1.6 }}>
            Lu par règles fixes, sans intelligence artificielle. Le PDF n'est pas conservé : seuls
            les faits ci-dessus le sont, sans le numéro de série ni l'immatriculation.
          </p>
        </>
      ) : (
        <>
          <p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 8 }}>
            Demandez au vendeur le <strong>Certificat de situation administrative détaillé</strong> —
            bouton « Imprimer le CSA » sur{' '}
            <a href="https://histovec.interieur.gouv.fr" target="_blank" rel="noopener noreferrer">
              histovec.interieur.gouv.fr
            </a>
            {' '}(gratuit, 2 minutes, c'est lui qui le génère). Déposez-le ici : nous le croisons avec
            l'annonce — gage, opposition, vol, véhicule gravement endommagé, détenteurs successifs.
          </p>
          <div style={{ marginTop: 12 }}>
            <input
              ref={champ} type="file" accept="application/pdf" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; deposer(f) }}
            />
            <button
              type="button" className="btn btn-auto" style={{ width: 'auto' }}
              disabled={etat === 'envoi'} onClick={() => champ.current?.click()}
            >
              {etat === 'envoi' ? 'Lecture…' : 'Déposer le certificat (PDF)'}
            </button>
          </div>
          <p className="mono c-graphite" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.6 }}>
            Le fichier n'est pas conservé. Les signaux rouges sont affichés même sans Pass achat.
          </p>
        </>
      )}

      {message && <div className="c-rouge" style={{ fontSize: 13, marginTop: 10 }}>{message}</div>}
    </section>
  )
}
