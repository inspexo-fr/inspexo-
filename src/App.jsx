import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from './lib/supabaseClient'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import StatsBar from './components/StatsBar'
import WhyInspexo from './components/WhyInspexo'
import HowItWorks from './components/HowItWorks'
import Services from './components/Services'
import Experts from './components/Experts'
import BecomeExpert from './components/BecomeExpert'
import FAQ from './components/FAQ'
import Footer from './components/Footer'
import FooterNotes from './components/FooterNotes'
import AdminDashboard from './pages/AdminDashboard'
import MentionsLegales from './pages/MentionsLegales'
import PolitiqueConfidentialite from './pages/PolitiqueConfidentialite'
import CGU from './pages/CGU'
import CookieBanner from './components/CookieBanner'
import AuthModal from './components/AuthModal'
import FreeAnalysisModal from './components/FreeAnalysisModal'
import ChatIA from './components/ChatIA'
import CheckoutModal from './components/CheckoutModal'
import StickyCTA from './components/StickyCTA'
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

function Site() {
  const [user, setUser] = useState(null)

  // Auth state — track user for free analysis flow
  const [showAuthForFreeAnalysis, setShowAuthForFreeAnalysis] = useState(false)
  const [showFreeAnalysis, setShowFreeAnalysis]               = useState(false)
  const [freeMission, setFreeMission]                         = useState(null)
  const [unlockCheckout, setUnlockCheckout]                   = useState(null) // { tier, prefillVehicle }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleFreeAnalysis = () => {
    if (!user) {
      setShowAuthForFreeAnalysis(true)
    } else {
      setShowFreeAnalysis(true)
    }
  }

  const handleAuthSuccess = () => {
    setShowAuthForFreeAnalysis(false)
    setShowFreeAnalysis(true)
  }

  const handleMissionCreated = (mission) => {
    setShowFreeAnalysis(false)
    setFreeMission(mission)
  }

  const handleUnlockFullAnalysis = (mission) => {
    setFreeMission(null)
    setUnlockCheckout({
      tier: 'ia',
      prefillVehicle: {
        brand: mission.vehicle_brand || '',
        model: mission.vehicle_model || '',
        year:  mission.vehicle_year  || '',
      },
    })
  }

  const handleBookExpert = () => {
    setFreeMission(null)
    document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <Helmet>
        <title>Inspexo — Analysez gratuitement une annonce de voiture d'occasion</title>
        <meta name="description" content="Collez une annonce Leboncoin ou La Centrale : verdict en 1 minute, rappels constructeur, airbags Takata, pannes connues du moteur, questions à poser au vendeur. Gratuit, 100 % côté acheteur." />
        <link rel="canonical" href="https://www.inspexo.io/" />
      </Helmet>
      <Navbar />
      <main>
        <Hero onFreeAnalysis={handleFreeAnalysis} />
        <WhyInspexo />
        <StatsBar />
        <HowItWorks onFreeAnalysis={handleFreeAnalysis} />
        <Services onFreeAnalysis={handleFreeAnalysis} />
        <Experts onReserve={(expert, tier) => {
          setUnlockCheckout({ tier, prefillVehicle: null, expertId: expert?.id ?? null })
        }} />
        <BecomeExpert />
        <FAQ onFreeAnalysis={handleFreeAnalysis} />
      </main>
      <Footer />
      <FooterNotes />

      {/* Auth pour le flow analyse gratuite */}
      {showAuthForFreeAnalysis && (
        <AuthModal
          isOpen={showAuthForFreeAnalysis}
          onClose={() => setShowAuthForFreeAnalysis(false)}
          onSuccess={handleAuthSuccess}
        />
      )}

      {/* Formulaire véhicule gratuit */}
      {showFreeAnalysis && user && (
        <FreeAnalysisModal
          user={user}
          onClose={() => setShowFreeAnalysis(false)}
          onMissionCreated={handleMissionCreated}
          onUnlockPaid={(tier) => {
            setShowFreeAnalysis(false)
            setUnlockCheckout({ tier, prefillVehicle: null })
          }}
        />
      )}

      {/* Chat IA gratuit */}
      {freeMission && (
        <ChatIA
          mission={freeMission}
          onClose={() => setFreeMission(null)}
          onMissionUpdate={() => {}}
          onUnlockFullAnalysis={handleUnlockFullAnalysis}
          onBookExpert={handleBookExpert}
        />
      )}

      {/* Checkout pour débloquer l'analyse complète */}
      {unlockCheckout && (
        <CheckoutModal
          isOpen={!!unlockCheckout}
          onClose={() => setUnlockCheckout(null)}
          tier={unlockCheckout.tier}
          prefillVehicle={unlockCheckout.prefillVehicle}
          expertId={unlockCheckout.expertId ?? null}
        />
      )}

      {/* Sticky CTA mobile — caché quand une modale/chat est ouvert */}
      <StickyCTA
        onClick={handleFreeAnalysis}
        isVisible={!showAuthForFreeAnalysis && !showFreeAnalysis && !freeMission && !unlockCheckout}
      />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Site />} />
        <Route path="/score" element={<ScorePage />} />
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
