import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import PassPage from './pages/PassPage'
import MoteurPage from './pages/MoteurPage'
import MoteursIndexPage from './pages/MoteursIndexPage'
import TakataPage from './pages/TakataPage'
import AdminDashboard from './pages/AdminDashboard'
import MentionsLegales from './pages/MentionsLegales'
import PolitiqueConfidentialite from './pages/PolitiqueConfidentialite'
import CGU from './pages/CGU'
import CookieBanner from './components/CookieBanner'
import NotFound from './pages/NotFound'
import ClientDashboard from './pages/ClientDashboard'
import ExpertDashboard from './pages/ExpertDashboard'
import ScorePage from './pages/ScorePage'
import ExtensionPage from './pages/ExtensionPage'
import ExtensionPrivacy from './pages/ExtensionPrivacy'
import ResultPage from './pages/ResultPage'
import VisitePage from './pages/VisitePage'
import DossierPage from './pages/DossierPage'
import FiabilitePage from './pages/FiabilitePage'
import AdminAudit from './pages/AdminAudit'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/score" element={<ScorePage />} />
        <Route path="/pass" element={<PassPage />} />
        <Route path="/moteur" element={<MoteursIndexPage />} />
        <Route path="/moteur/:slug" element={<MoteurPage />} />
        <Route path="/airbags-takata" element={<TakataPage />} />
        <Route path="/a/:id" element={<ResultPage />} />
        <Route path="/a/:id/visite" element={<VisitePage />} />
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
        <Route path="*" element={<NotFound />} />
      </Routes>
      <CookieBanner />
    </BrowserRouter>
  )
}
