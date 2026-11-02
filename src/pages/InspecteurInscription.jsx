import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Turnstile from '../components/Turnstile'
import { supabase } from '../lib/supabaseClient'
import { envoyerLienMagique } from '../lib/scoreApi'
import {
  candidaterInspecteur, deposerAttestation, etatConnect, lienConnect,
  monProfilInspecteur, signerCharte,
} from '../lib/inspectionApi'
import { CHARTE_INDEPENDANCE, CHARTE_VERSION, siretValide, ZONE_LIBELLE } from '../data/charte'

// SPRINT 8 — Devenir inspecteur : statut indépendant (SIRET), assurance RC
// professionnelle, signature de la charte d'indépendance, compte Stripe
// Connect. Chaque étape est vérifiée côté serveur ; l'admin valide ensuite.

const CONSENT =
  'Connexion par lien magique, sans mot de passe. Vos pièces (SIRET, attestation d\'assurance) servent uniquement à vérifier que vous exercez légalement et que vous êtes assuré.'

function Etape({ n, titre, fait, children }) {
  return (
    <div style={{ border: '1px solid var(--rule-strong)', padding: '18px 16px', marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 10 }}>
        <span className="mono" style={{ fontSize: 11, letterSpacing: '.08em' }}>ÉTAPE {String(n).padStart(2, '0')}</span>
        <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{titre}</span>
        {fait && <span className="mono c-vert" style={{ fontSize: 11, fontWeight: 700 }}>FAIT</span>}
      </div>
      {children}
    </div>
  )
}

export default function InspecteurInscription() {
  const [user, setUser] = useState(undefined)
  const [profil, setProfil] = useState(null)
  const [email, setEmail] = useState('')
  const [captcha, setCaptcha] = useState(null)
  const [lienEtat, setLienEtat] = useState('idle')

  const [form, setForm] = useState({
    nom: '', telephone: '', siret: '', raisonSociale: '',
    rcAssureur: '', rcNumero: '', rcEcheance: '', departements: '31',
  })
  const [etat, setEtat] = useState('idle')
  const [message, setMessage] = useState(null)
  const [charteLue, setCharteLue] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  const charger = useCallback(() => {
    monProfilInspecteur().then(p => {
      setProfil(p)
      if (p) {
        setForm(f => ({
          ...f,
          nom: p.nom || '', telephone: p.telephone || '', siret: p.siret || '',
          raisonSociale: p.raison_sociale || '', rcAssureur: p.rc_pro_assureur || '',
          rcEcheance: p.rc_pro_echeance || '',
          departements: (p.departements || []).join(', ') || '31',
        }))
      }
    }).catch(() => {})
  }, [])
  useEffect(() => { if (user) charger() }, [user, charger])

  // Retour depuis Stripe : on rafraîchit l'état du compte.
  useEffect(() => {
    if (user && new URLSearchParams(window.location.search).get('stripe')) {
      etatConnect().then(charger).catch(() => {})
    }
  }, [user, charger])

  const envoyerLien = async (e) => {
    e.preventDefault()
    if (!email || lienEtat === 'sending') return
    setLienEtat('sending')
    try {
      await envoyerLienMagique(email, '/inspecteur/inscription', captcha)
      setLienEtat('done')
    } catch (_) { setLienEtat('erreur') }
  }

  const enregistrer = async (e) => {
    e.preventDefault()
    setMessage(null)
    if (!siretValide(form.siret)) {
      setMessage('Ce SIRET n\'est pas valide (14 chiffres, clé de contrôle incluse).')
      return
    }
    setEtat('envoi')
    try {
      await candidaterInspecteur({
        ...form,
        departements: form.departements.split(',').map(s => s.trim()).filter(Boolean),
      })
      setMessage('Candidature enregistrée.')
      charger()
    } catch (err) {
      setMessage(err?.message || 'Enregistrement impossible.')
    }
    setEtat('idle')
  }

  const deposer = async (fichier) => {
    if (!fichier) return
    setMessage(null)
    const lecteur = new FileReader()
    lecteur.onload = async () => {
      try {
        await deposerAttestation(lecteur.result)
        setMessage('Attestation déposée.')
        charger()
      } catch (err) { setMessage(err?.message || 'Dépôt impossible.') }
    }
    lecteur.readAsDataURL(fichier)
  }

  const signer = async () => {
    setMessage(null)
    try {
      await signerCharte(CHARTE_VERSION)
      charger()
    } catch (err) { setMessage(err?.message || 'Signature impossible.') }
  }

  const connecterStripe = async () => {
    setMessage(null)
    try {
      const { url } = await lienConnect()
      window.location.assign(url)
    } catch (err) { setMessage(err?.message || 'Connexion Stripe impossible.') }
  }

  return (
    <>
      <Helmet>
        <title>Devenir inspecteur — Inspexo</title>
        <meta name="description" content="Rejoindre le réseau d'inspecteurs indépendants Inspexo : statut indépendant, assurance RC professionnelle, charte d'indépendance. 60 % du prix de l'inspection." />
        <meta name="robots" content="noindex" />
      </Helmet>
      <Navbar />
      <main>
        <section className="sec" style={{ borderTop: 'none', minHeight: '70vh' }}>
          <div className="wrap-doc">
            <p className="eyebrow">Réseau d'inspecteurs</p>
            <h1 style={{ fontSize: 'clamp(28px,5vw,38px)', marginTop: 12 }}>Devenir inspecteur</h1>
            <p className="lead" style={{ marginTop: 14, marginBottom: 26 }}>
              Vous vous déplacez chez le vendeur, vous examinez la voiture, vous rendez un rapport
              photo. L'acheteur paie 179 € : <strong>107,40 € vous reviennent</strong>, versés
              automatiquement à la remise du rapport. Zone de lancement : {ZONE_LIBELLE}.
            </p>

            {user === undefined ? null : !user ? (
              <div style={{ border: '1px solid var(--rule-strong)', padding: '22px 18px' }}>
                {lienEtat === 'done' ? (
                  <div className="c-vert" style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.6 }}>
                    Lien de connexion envoyé — ouvrez l'email sur cet appareil pour continuer.
                  </div>
                ) : (
                  <form onSubmit={envoyerLien}>
                    <p className="eyebrow" style={{ marginBottom: 10 }}>Commencer</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input type="email" required placeholder="votre@email.com" value={email}
                        onChange={e => setEmail(e.target.value)} className="input"
                        style={{ flex: '1 1 200px', width: 'auto' }} aria-label="Votre email" />
                      <button type="submit" className="btn btn-auto" style={{ height: 48, width: 'auto' }}
                        disabled={lienEtat === 'sending'}>
                        {lienEtat === 'sending' ? 'Envoi…' : 'Recevoir le lien'}
                      </button>
                    </div>
                    <Turnstile onToken={setCaptcha} action="lien-magique" />
                    <p className="mono c-graphite" style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>{CONSENT}</p>
                    {lienEtat === 'erreur' && (
                      <div className="c-rouge" style={{ fontSize: 13, marginTop: 6 }}>
                        Envoi impossible — réessayez.
                      </div>
                    )}
                  </form>
                )}
              </div>
            ) : (
              <>
                {profil?.statut === 'valide' && (
                  <div style={{ border: '1px solid var(--rule-strong)', padding: '16px', marginBottom: 18 }}>
                    <p className="c-vert" style={{ fontWeight: 700 }}>Votre compte est validé.</p>
                    <p style={{ fontSize: 14, marginTop: 6 }}>
                      <Link to="/inspecteur">Ouvrir mon espace inspecteur →</Link>
                    </p>
                  </div>
                )}
                {profil?.statut === 'refuse' && (
                  <div className="alert alert-rouge" style={{ marginBottom: 18 }}>
                    Candidature refusée.{profil.motif_refus ? ` Motif : ${profil.motif_refus}` : ''} Vous pouvez
                    compléter votre dossier et le soumettre à nouveau.
                  </div>
                )}
                {profil && profil.statut === 'candidat' && (
                  <div style={{ border: '1px solid var(--rule-strong)', padding: '14px 16px', marginBottom: 18 }}>
                    <p className="eyebrow">Dossier en cours</p>
                    <p style={{ fontSize: 14, marginTop: 6, lineHeight: 1.6 }}>
                      Complétez les quatre étapes : nous vérifions votre dossier et vous recevez un
                      email dès qu'il est validé.
                    </p>
                  </div>
                )}

                {/* 1 — Identité professionnelle */}
                <Etape n={1} titre="Statut indépendant" fait={!!profil?.siret}>
                  <form onSubmit={enregistrer}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input className="input" placeholder="Nom et prénom" required maxLength={120}
                        value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} aria-label="Nom et prénom" />
                      <input className="input" placeholder="Téléphone" required maxLength={30}
                        value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })} aria-label="Téléphone" />
                      <input className="input mono" placeholder="SIRET (14 chiffres)" required maxLength={20}
                        value={form.siret} onChange={e => setForm({ ...form, siret: e.target.value })} aria-label="SIRET" />
                      <input className="input" placeholder="Raison sociale (facultatif)" maxLength={160}
                        value={form.raisonSociale} onChange={e => setForm({ ...form, raisonSociale: e.target.value })} aria-label="Raison sociale" />
                      <input className="input" placeholder="Départements couverts (ex. 31)" maxLength={40}
                        value={form.departements} onChange={e => setForm({ ...form, departements: e.target.value })} aria-label="Départements couverts" />
                    </div>
                    <p className="eyebrow" style={{ margin: '14px 0 8px' }}>Assurance responsabilité civile professionnelle</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input className="input" placeholder="Assureur" maxLength={120}
                        value={form.rcAssureur} onChange={e => setForm({ ...form, rcAssureur: e.target.value })} aria-label="Assureur" />
                      <input className="input" placeholder="N° de contrat" maxLength={60}
                        value={form.rcNumero} onChange={e => setForm({ ...form, rcNumero: e.target.value })} aria-label="Numéro de contrat" />
                      <label className="mono c-graphite" style={{ fontSize: 11 }}>
                        ÉCHÉANCE DU CONTRAT
                        <input className="input" type="date" value={form.rcEcheance}
                          onChange={e => setForm({ ...form, rcEcheance: e.target.value })} aria-label="Échéance de l'assurance" />
                      </label>
                    </div>
                    <button type="submit" className="btn-ghost btn-auto" style={{ marginTop: 12 }} disabled={etat === 'envoi'}>
                      {etat === 'envoi' ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </form>
                </Etape>

                {/* 2 — Attestation */}
                <Etape n={2} titre="Attestation d'assurance" fait={!!profil?.rc_pro_document}>
                  <p style={{ fontSize: 14, lineHeight: 1.6 }}>
                    Déposez l'attestation en cours de validité (PDF ou photo, 8 Mo maximum).
                    Elle n'est lisible que par Inspexo.
                  </p>
                  <input type="file" accept="application/pdf,image/*" style={{ marginTop: 10, fontSize: 13 }}
                    onChange={e => { deposer(e.target.files?.[0]); e.target.value = '' }}
                    disabled={!profil} aria-label="Attestation d'assurance" />
                </Etape>

                {/* 3 — Charte */}
                <Etape n={3} titre="Charte d'indépendance" fait={!!profil?.charte_signee_le}>
                  {profil?.charte_signee_le ? (
                    <p style={{ fontSize: 14 }}>
                      Signée le {new Date(profil.charte_signee_le).toLocaleDateString('fr-FR')} (version {profil.charte_version}).
                    </p>
                  ) : (
                    <>
                      <ol style={{ paddingLeft: 18, margin: '4px 0 0' }}>
                        {CHARTE_INDEPENDANCE.map((c, i) => (
                          <li key={i} style={{ fontSize: 14, lineHeight: 1.65, marginBottom: 8 }}>{c}</li>
                        ))}
                      </ol>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, cursor: 'pointer', fontSize: 13, lineHeight: 1.5 }}>
                        <input type="checkbox" checked={charteLue} onChange={() => setCharteLue(v => !v)}
                          style={{ marginTop: 2, width: 16, height: 16 }} />
                        <span>J'ai lu et j'accepte ces engagements (version {CHARTE_VERSION}).</span>
                      </label>
                      <button type="button" className="btn-ghost btn-auto" style={{ marginTop: 10 }}
                        disabled={!charteLue || !profil} onClick={signer}>
                        Signer la charte
                      </button>
                    </>
                  )}
                </Etape>

                {/* 4 — Stripe Connect */}
                <Etape n={4} titre="Compte de versement (Stripe)" fait={!!profil?.stripe_paiements_actifs}>
                  <p style={{ fontSize: 14, lineHeight: 1.6 }}>
                    Stripe vérifie votre identité et vos coordonnées bancaires. Inspexo ne voit
                    jamais votre RIB. C'est par ce compte que vous recevez vos 107,40 € par inspection.
                  </p>
                  {profil?.stripe_paiements_actifs ? (
                    <p className="c-vert" style={{ fontSize: 14, marginTop: 8, fontWeight: 600 }}>
                      Compte opérationnel : les versements sont possibles.
                    </p>
                  ) : (
                    <button type="button" className="btn-ghost btn-auto" style={{ marginTop: 10 }}
                      onClick={connecterStripe} disabled={!profil}>
                      {profil?.stripe_connecte ? 'Reprendre la configuration Stripe' : 'Configurer mon compte Stripe'}
                    </button>
                  )}
                </Etape>

                {message && (
                  <div className={/impossible|invalide|refus/i.test(message) ? 'c-rouge' : 'c-vert'}
                    style={{ fontSize: 14, marginTop: 10, fontWeight: 600 }}>{message}</div>
                )}

                <p className="mono c-graphite" style={{ marginTop: 18, fontSize: 11, lineHeight: 1.7 }}>
                  CONNECTÉ : {user.email} —{' '}
                  <button type="button" onClick={() => supabase.auth.signOut()}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', font: 'inherit', color: 'inherit' }}>
                    se déconnecter
                  </button>
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
