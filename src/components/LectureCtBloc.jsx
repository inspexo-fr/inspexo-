import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { lectureCt, getMonPass } from '../lib/scoreApi'
import { resizeImageToDataUrl } from '../lib/imageUtils'

// SPRINT 7 — Bloc « PV de contrôle technique » de /a/:id (fonction du Pass).
// Photo(s) du PV → lecture serveur : date, centre, kilométrage, chaque
// défaillance (code + catégorie) expliquée, reliée aux pannes de la fiche et
// chiffrée si un coût sourcé existe. Les photos ne sont JAMAIS stockées.
// Le déblocage est décidé côté serveur : sans Pass, la fonction répond
// pass_requis — ce bloc n'affiche alors que l'annonce de la fonction.

const CAT_LABELS = {
  mineure: { label: 'Mineure', classe: 'c-graphite' },
  majeure: { label: 'Majeure — contre-visite', classe: 'c-ambre' },
  critique: { label: 'Critique — circulation interdite le soir même', classe: 'c-rouge' },
}

const euros = (min, max) => {
  const f = (n) => `${Number(n).toLocaleString('fr-FR')} €`
  if (min != null && max != null && min !== max) return `${f(min)} – ${f(max)}`
  return f(min ?? max)
}

function LectureAffichee({ lecture }) {
  if (!lecture) return null
  const dateFr = lecture.date_ct ? lecture.date_ct.split('-').reverse().join('/') : null
  return (
    <div style={{ marginTop: 10 }}>
      <div className="mono c-graphite" style={{ fontSize: 11, letterSpacing: '.04em', lineHeight: 1.8 }}>
        {dateFr ? `CONTRÔLE DU ${dateFr}` : 'DATE ILLISIBLE'}
        {lecture.centre ? ` · ${lecture.centre.toUpperCase()}` : ''}
        {lecture.km_releve ? ` · ${lecture.km_releve.toLocaleString('fr-FR')} KM RELEVÉS` : ''}
      </div>
      {lecture.resultat && (
        <p style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}
          className={lecture.resultat === 'favorable' ? 'c-vert' : 'c-rouge'}>
          Résultat {lecture.resultat}
          {lecture.contre_visite && (
            <span className="c-ambre">
              {' '}· contre-visite exigée{lecture.date_limite ? ` avant le ${lecture.date_limite.split('-').reverse().join('/')}` : ''}
            </span>
          )}
        </p>
      )}
      {(lecture.defauts || []).map((d, i) => {
        const cat = CAT_LABELS[d.categorie] || CAT_LABELS.mineure
        return (
          <div key={i} className="ctrl" style={{ alignItems: 'baseline' }}>
            <span>
              {d.code && <span className="mono c-graphite" style={{ fontSize: 11, marginRight: 8 }}>{d.code}</span>}
              {d.libelle}
              <span className={`mono ${cat.classe}`} style={{ display: 'block', fontSize: 11, marginTop: 2 }}>
                {cat.label}
              </span>
              {d.explication && (
                <span className="c-ink2" style={{ display: 'block', fontSize: 13, marginTop: 4, lineHeight: 1.6 }}>
                  {d.explication}
                </span>
              )}
              {d.panne_liee && (
                <span className="c-graphite" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>
                  À relier à une panne connue du moteur : {d.panne_liee}
                </span>
              )}
            </span>
            <span className="val num">
              {d.cout_min_eur != null || d.cout_max_eur != null ? euros(d.cout_min_eur, d.cout_max_eur) : '—'}
            </span>
          </div>
        )
      })}
      {(lecture.defauts || []).length === 0 && (
        <p style={{ fontSize: 14, marginTop: 6 }}>Aucune défaillance lisible sur ce PV.</p>
      )}
      <p className="mono c-graphite" style={{ marginTop: 10, fontSize: 11, lineHeight: 1.6 }}>
        Coûts indiqués uniquement quand une source publiée existe — à faire chiffrer par un garage.
        Photos lues puis oubliées, jamais stockées.
      </p>
    </div>
  )
}

export default function LectureCtBloc({ analysisId, result, onMaj }) {
  const [pass, setPass] = useState(null) // null = inconnu, false, true
  const [etat, setEtat] = useState('idle') // idle | envoi | erreur | pass_requis | illisible
  const [message, setMessage] = useState(null)
  const [lecture, setLecture] = useState(result?.lecture_ct || null)
  const fileRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    getMonPass().then(p => { if (!cancelled) setPass(!!p) }).catch(() => { if (!cancelled) setPass(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => { if (result?.lecture_ct) setLecture(result.lecture_ct) }, [result?.lecture_ct])

  const envoyer = async (fileList) => {
    const files = Array.from(fileList || []).slice(0, 3)
    if (files.length === 0 || etat === 'envoi') return
    setEtat('envoi')
    setMessage(null)
    try {
      const images = []
      for (const f of files) images.push(await resizeImageToDataUrl(f))
      const { lecture: l, result: maj, message: msg } = await lectureCt(analysisId, images)
      if (l && !l.lisible) {
        setEtat('illisible')
        setMessage(msg || 'Document illisible — photographiez le PV entier, à plat.')
        return
      }
      setLecture(l)
      if (maj && onMaj) onMaj(maj)
      setEtat('idle')
    } catch (e) {
      if (e?.code === 'pass_requis') setEtat('pass_requis')
      else { setEtat('erreur'); setMessage(e?.message || 'Lecture impossible. Réessayez.') }
    }
  }

  return (
    <div className="doc-sec">
      <p className="eyebrow">PV de contrôle technique</p>

      {lecture ? (
        <LectureAffichee lecture={lecture} />
      ) : (
        <p style={{ fontSize: 14, lineHeight: 1.7, marginTop: 8 }}>
          Photographiez le procès-verbal remis par le vendeur : date, kilométrage relevé,
          chaque défaillance avec son code et sa catégorie, expliquée en une phrase, reliée
          aux pannes connues du moteur et chiffrée quand un coût sourcé existe. Le kilométrage
          du PV est comparé à celui de l'annonce.
        </p>
      )}

      {pass ? (
        <>
          <input
            ref={fileRef} type="file" accept="image/*" capture="environment" multiple
            style={{ display: 'none' }}
            onChange={(e) => { envoyer(e.target.files); e.target.value = '' }}
          />
          <button
            type="button" className="btn-ghost btn-auto" style={{ marginTop: 12 }}
            disabled={etat === 'envoi'}
            onClick={() => fileRef.current?.click()}
          >
            {etat === 'envoi' ? 'Lecture du PV en cours…' : lecture ? 'Relire un autre PV' : 'Photographier le PV (3 photos max)'}
          </button>
          {(etat === 'erreur' || etat === 'illisible') && message && (
            <p className={etat === 'erreur' ? 'c-rouge' : 'c-ambre'} style={{ fontSize: 13, marginTop: 8 }}>{message}</p>
          )}
        </>
      ) : pass === false && !lecture ? (
        <p style={{ fontSize: 13, marginTop: 10, lineHeight: 1.6 }}>
          <Link to="/pass">Fonction du Pass achat (29 €, 30 jours)</Link> — connectez-vous
          depuis votre <Link to="/dossier">dossier d'achat</Link> si vous l'avez déjà.
        </p>
      ) : null}
    </div>
  )
}
