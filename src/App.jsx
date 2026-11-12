import React, { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import CookieBanner from './components/CookieBanner'
import { capterSource } from './lib/source'

// Chaque route est chargée à la demande. Sans cela, une page publique de
// famille moteur embarquait les 22 pages du site — dashboards admin, mode
// visite, dossier — soit 189 Ko compressés à télécharger et exécuter avant
// que quoi que ce soit n'apparaisse. Le pré-rendu injecte un lien de
// préchargement vers le fragment de la route servie (scripts/prerendu.mjs),
// pour que le découpage ne coûte pas un aller-retour réseau de plus.
const HomePage = lazy(() => import('./pages/HomePage'))
const ScorePage = lazy(() => import('./pages/ScorePage'))
const PassPage = lazy(() => import('./pages/PassPage'))
const MoteursIndexPage = lazy(() => import('./pages/MoteursIndexPage'))
const MoteurPage = lazy(() => import('./pages/MoteurPage'))
const TakataPage = lazy(() => import('./pages/TakataPage'))
const ResultPage = lazy(() => import('./pages/ResultPage'))
const VisitePage = lazy(() => import('./pages/VisitePage'))
const RetourPage = lazy(() => import('./pages/RetourPage'))
const AlerteConfirmerPage = lazy(() => import('./pages/AlerteConfirmerPage'))
const ModelePage = lazy(() => import('./pages/ModelePage'))
const ModelesIndexPage = lazy(() => import('./pages/ModelesIndexPage'))
const ProPage = lazy(() => import('./pages/ProPage'))
const ProApiPage = lazy(() => import('./pages/ProApiPage'))
const KitSignaturePage = lazy(() => import('./pages/KitSignaturePage'))
const InspecteurPage = lazy(() => import('./pages/InspecteurPage'))
const InspecteurInscription = lazy(() => import('./pages/InspecteurInscription'))
const CGVPass = lazy(() => import('./pages/CGVPass'))
const CGVInspection = lazy(() => import('./pages/CGVInspection'))
const CGVVisio = lazy(() => import('./pages/CGVVisio'))
const VisioPage = lazy(() => import('./pages/VisioPage'))
const DossierPage = lazy(() => import('./pages/DossierPage'))
const CiblesPage = lazy(() => import('./pages/CiblesPage'))
const ComparerPage = lazy(() => import('./pages/ComparerPage'))
const FiabilitePage = lazy(() => import('./pages/FiabilitePage'))
const AdminAudit = lazy(() => import('./pages/AdminAudit'))
const ExtensionPage = lazy(() => import('./pages/ExtensionPage'))
const ExtensionPrivacy = lazy(() => import('./pages/ExtensionPrivacy'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const MentionsLegales = lazy(() => import('./pages/MentionsLegales'))
const PolitiqueConfidentialite = lazy(() => import('./pages/PolitiqueConfidentialite'))
const CGU = lazy(() => import('./pages/CGU'))
const NotFound = lazy(() => import('./pages/NotFound'))
const PartagePage = lazy(() => import('./pages/PartagePage'))

// L'attente est volontairement muette : la page pré-rendue est déjà à l'écran
// et le fragment est préchargé, donc ce repli ne dure que quelques images.
// Un texte ou un gabarit provisoire créerait un décalage visuel inutile.
const Attente = <div style={{ minHeight: '100vh' }} aria-busy="true" />

// Étiquette de campagne (?src=) relevée au tout premier rendu, avant toute
// navigation interne : une entrée par /pass?src=… doit rester attribuable
// même si l'utilisateur va ensuite analyser une annonce.
capterSource()

// SPRINT 18 — Réception d'un partage dans l'appli mobile.
//
// ⚠️ MONTÉ À L'INTÉRIEUR DU ROUTEUR, ET LA NAVIGATION PASSE PAR LUI.
// Première version : `window.location.href = '/partage?u=…'`. Mesuré sur
// l'émulateur — la WebView finissait sur `about:blank`. Le serveur local de
// Capacitor sert des FICHIERS : il n'a pas le repli SPA de Vercel, donc
// `/partage` n'existe pas sur le disque et la navigation meurt en silence.
// Un `navigate()` de React Router ne touche jamais le serveur : il change
// l'URL et rend le composant.
//
// L'import de Capacitor reste DYNAMIQUE et conditionné au natif : sur le web,
// le paquet ne doit être ni chargé ni exécuté — il serait payé par chaque
// visiteur pour une fonction qu'aucun navigateur n'utilise.
function EcouteurPartage() {
  const navigate = useNavigate()
  useEffect(() => {
    let poignee = null
    let annule = false
    import('@capacitor/core').then(({ Capacitor }) => {
      if (annule || !Capacitor.isNativePlatform()) return undefined
      return import('@capacitor/app').then(({ App: CapApp }) => {
        poignee = CapApp.addListener('appUrlOpen', ({ url }) => {
          try {
            const u = new URL(url)
            if (u.protocol === 'inspexo:' && (u.host === 'partage' || u.pathname.includes('partage'))) {
              const cible = u.searchParams.get('url')
              if (cible) navigate(`/partage?u=${encodeURIComponent(cible)}`)
            }
            // inspexo://aller?p=/a/<id> — ouvrir une page DANS l'appli.
            // ⚠️ Ajouté après une capture ratée : `simctl openurl` avec une URL
            // https ouvrait SAFARI, et les captures de store montraient donc le
            // site dans un navigateur, pas l'application. Une capture qui ne
            // montre pas l'app est un motif de rejet — et un mensonge.
            // Le chemin est validé : il doit commencer par un seul '/', sinon
            // '//ailleurs.example' serait une adresse absolue déguisée.
            if (u.protocol === 'inspexo:' && u.host === 'aller') {
              const chemin = u.searchParams.get('p') || ''
              if (/^\/[^/]/.test(chemin)) navigate(chemin)
            }
          } catch (_) { /* lien profond illisible : ignoré */ }
        })
      })
    }).catch(() => { /* web : Capacitor absent, c'est le cas normal */ })
    return () => {
      annule = true
      Promise.resolve(poignee).then((h) => h?.remove?.()).catch(() => {})
    }
  }, [navigate])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <EcouteurPartage />
      <Suspense fallback={Attente}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/score" element={<ScorePage />} />
          {/* Réception d'un partage depuis l'appli mobile. Inoffensive sur le
              web : sans paramètre ?u=, la page renvoie vers /score. */}
          <Route path="/partage" element={<PartagePage />} />
          <Route path="/pass" element={<PassPage />} />
          <Route path="/moteur" element={<MoteursIndexPage />} />
          <Route path="/moteur/:slug" element={<MoteurPage />} />
          <Route path="/airbags-takata" element={<TakataPage />} />
          <Route path="/a/:id" element={<ResultPage />} />
          <Route path="/a/:id/visite" element={<VisitePage />} />
          <Route path="/a/:id/signature" element={<KitSignaturePage />} />
          <Route path="/dossier" element={<DossierPage />} />
          <Route path="/comparer" element={<ComparerPage />} />
          <Route path="/cibles" element={<CiblesPage />} />
          <Route path="/inspecteur" element={<InspecteurPage />} />
          <Route path="/inspecteur/inscription" element={<InspecteurInscription />} />
          <Route path="/retour/:id" element={<RetourPage />} />
          <Route path="/alerte/confirmer" element={<AlerteConfirmerPage />} />
          <Route path="/modele" element={<ModelesIndexPage />} />
          <Route path="/modele/:marque/:modele" element={<ModelePage />} />
          <Route path="/pro" element={<ProPage />} />
          <Route path="/pro/api" element={<ProApiPage />} />
          <Route path="/fiabilite" element={<FiabilitePage />} />
          <Route path="/admin/audit" element={<AdminAudit />} />
          <Route path="/extension" element={<ExtensionPage />} />
          <Route path="/extension/confidentialite" element={<ExtensionPrivacy />} />
          {/* /dashboard et /expert (parcours experts d'avant le pivot) ont été
              démontés au sprint 8 : plus aucun lien n'y menait, et les
              fonctions qu'ils appelaient sont retirées. */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/mentions-legales" element={<MentionsLegales />} />
          <Route path="/politique-de-confidentialite" element={<PolitiqueConfidentialite />} />
          <Route path="/cgu" element={<CGU />} />
          <Route path="/cgv-pass" element={<CGVPass />} />
          <Route path="/cgv-inspection" element={<CGVInspection />} />
          <Route path="/cgv-visio" element={<CGVVisio />} />
          <Route path="/visio/:id" element={<VisioPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <CookieBanner />
    </BrowserRouter>
  )
}
