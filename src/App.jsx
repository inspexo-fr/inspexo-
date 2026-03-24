import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { supabase } from './lib/supabaseClient'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import StatsBar from './components/StatsBar'
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
      <Navbar />
      <main>
        <Hero onFreeAnalysis={handleFreeAnalysis} />
        <StatsBar />
        <HowItWorks onFreeAnalysis={handleFreeAnalysis} />
        <Services onFreeAnalysis={handleFreeAnalysis} />
        <Experts />
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
        <Route path="/dashboard" element={<ClientDashboard />} />
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
