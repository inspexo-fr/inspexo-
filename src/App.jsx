import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import CookieBanner from './components/CookieBanner'

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
const KitSignaturePage = lazy(() => import('./pages/KitSignaturePage'))
const CGVPass = lazy(() => import('./pages/CGVPass'))
const DossierPage = lazy(() => import('./pages/DossierPage'))
const FiabilitePage = lazy(() => import('./pages/FiabilitePage'))
const AdminAudit = lazy(() => import('./pages/AdminAudit'))
const ExtensionPage = lazy(() => import('./pages/ExtensionPage'))
const ExtensionPrivacy = lazy(() => import('./pages/ExtensionPrivacy'))
const ClientDashboard = lazy(() => import('./pages/ClientDashboard'))
const ExpertDashboard = lazy(() => import('./pages/ExpertDashboard'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const MentionsLegales = lazy(() => import('./pages/MentionsLegales'))
const PolitiqueConfidentialite = lazy(() => import('./pages/PolitiqueConfidentialite'))
const CGU = lazy(() => import('./pages/CGU'))
const NotFound = lazy(() => import('./pages/NotFound'))

// L'attente est volontairement muette : la page pré-rendue est déjà à l'écran
// et le fragment est préchargé, donc ce repli ne dure que quelques images.
// Un texte ou un gabarit provisoire créerait un décalage visuel inutile.
const Attente = <div style={{ minHeight: '100vh' }} aria-busy="true" />

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={Attente}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/score" element={<ScorePage />} />
          <Route path="/pass" element={<PassPage />} />
          <Route path="/moteur" element={<MoteursIndexPage />} />
          <Route path="/moteur/:slug" element={<MoteurPage />} />
          <Route path="/airbags-takata" element={<TakataPage />} />
          <Route path="/a/:id" element={<ResultPage />} />
          <Route path="/a/:id/visite" element={<VisitePage />} />
          <Route path="/a/:id/signature" element={<KitSignaturePage />} />
          <Route path="/dossier" element={<DossierPage />} />
          <Route path="/fiabilite" element={<FiabilitePage />} />
          <Route path="/admin/audit" element={<AdminAudit />} />
          <Route path="/extension" element={<ExtensionPage />} />
          <Route path="/extension/confidentialite" element={<ExtensionPrivacy />} />
          <Route path="/dashboard" element={<ClientDashboard />} />
          <Route path="/expert" element={<ExpertDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/mentions-legales" element={<MentionsLegales />} />
          <Route path="/politique-de-confidentialite" element={<PolitiqueConfidentialite />} />
          <Route path="/cgu" element={<CGU />} />
          <Route path="/cgv-pass" element={<CGVPass />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <CookieBanner />
    </BrowserRouter>
  )
}
