import { useState, useEffect, useMemo, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from './lib/supabaseClient'

/* ── Legacy navbar (chargée immédiatement) ── */
import LegacyNavbar from './components/Navbar'

/* ── Hero (nouveau, branche hero, étape 3 = DOM only).
       Remplace LegacyHero ET V2Hero — un seul Hero désormais. */
import Hero from './components/hero/Hero'

/* ── Sections legacy lazy-loaded (sous le Hero, jamais critiques LCP) ── */
const StatsBar     = lazy(() => import('./components/StatsBar'))
const HowItWorks   = lazy(() => import('./components/HowItWorks'))
const Services     = lazy(() => import('./components/Services'))
const Experts      = lazy(() => import('./components/Experts'))
const BecomeExpert = lazy(() => import('./components/BecomeExpert'))
const FAQ          = lazy(() => import('./components/FAQ'))
const Footer       = lazy(() => import('./components/Footer'))
const FooterNotes  = lazy(() => import('./components/FooterNotes'))

/* ── V2 components (préservés en historique — V2Hero plus monté, remplacé par hero/Hero) ── */
import V2Loader     from './components/v2/Loader'
import V2Navbar     from './components/v2/Navbar'
import V2TrustTicker from './components/v2/TrustTicker'

/* ── Pages — lazy (jamais critiques LCP, chargées au routing) ── */
const AdminDashboard           = lazy(() => import('./pages/AdminDashboard'))
const MentionsLegales          = lazy(() => import('./pages/MentionsLegales'))
const PolitiqueConfidentialite = lazy(() => import('./pages/PolitiqueConfidentialite'))
const CGU                      = lazy(() => import('./pages/CGU'))
const NotFound                 = lazy(() => import('./pages/NotFound'))
const ClientDashboard          = lazy(() => import('./pages/ClientDashboard'))
const ExpertDashboard          = lazy(() => import('./pages/ExpertDashboard'))

/* ── Modales lazy (déclenchées sur action user — sortent Stripe du bundle initial) ── */
const AuthModal          = lazy(() => import('./components/AuthModal'))
const FreeAnalysisModal  = lazy(() => import('./components/FreeAnalysisModal'))
const ChatIA             = lazy(() => import('./components/ChatIA'))
const CheckoutModal      = lazy(() => import('./components/CheckoutModal'))

/* ── Composants légers chargés immédiatement ── */
import CookieBanner from './components/CookieBanner'
import StickyCTA from './components/StickyCTA'

import useLenis from './hooks/useLenis'

/* ────────────────────────────────────────────────────────────
   Feature flag — V2 actif si ?v2=true OU NODE_ENV=development.
   Permet de pousser sur prod sans toucher l'ancien site.
   ──────────────────────────────────────────────────────────── */
function detectV2() {
  if (typeof window === 'undefined') return false
  const flag = new URLSearchParams(window.location.search).get('v2')
  if (flag === 'true')  return true
  if (flag === 'false') return false
  return process.env.NODE_ENV === 'development'
}

function Site() {
  const isV2 = useMemo(detectV2, [])

  // Escape hatches pour capture de screenshots (dev only) :
  //   ?nolenis=true     → désactive Lenis (scroll natif)
  //   ?noloader=true    → saute le loader V2
  //   ?scrollY=N        → scroll instantané à Y=N px au mount
  const captureMode = useMemo(() => {
    if (typeof window === 'undefined') return { lenis: true, loader: true, scrollY: null }
    const q = new URLSearchParams(window.location.search)
    return {
      lenis:   q.get('nolenis')  !== 'true',
      loader:  q.get('noloader') !== 'true',
      scrollY: q.get('scrollY') ? parseInt(q.get('scrollY'), 10) : null,
    }
  }, [])

  // ⚠ Phase 2.9.1A — Lenis retiré définitivement (cassait position:sticky
  // en appliquant transform: translate3d sur <body>, ce qui faisait que le
  // hero scrollytelling Three.js ne recevait jamais la progress mise à jour).
  // useLenis(isV2 && captureMode.lenis)  // ← désactivé
  useLenis(false)

  // Scroll programmatique pour les screenshots
  useEffect(() => {
    if (captureMode.scrollY === null) return undefined
    // Scroll immédiat + retries pour laisser le DOM finir le layout
    const doScroll = () => window.scrollTo(0, captureMode.scrollY)
    doScroll()
    const t1 = setTimeout(doScroll, 50)
    const t2 = setTimeout(doScroll, 200)
    const t3 = setTimeout(doScroll, 500)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [captureMode.scrollY])

  // Toggle class v2-active sur html + body — scope du CSS global
  useEffect(() => {
    if (!isV2) return undefined
    const h = document.documentElement
    const b = document.body
    h.classList.add('v2-active')
    b.classList.add('v2-active')
    return () => {
      h.classList.remove('v2-active')
      b.classList.remove('v2-active')
    }
  }, [isV2])

  // Mode compact pour screenshots (?compact=true) — réduit min-height des écrans
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const compact = new URLSearchParams(window.location.search).get('compact') === 'true'
    if (!compact) return undefined
    document.body.classList.add('v2-compact')
    return () => document.body.classList.remove('v2-compact')
  }, [])

  // ── Auth + modal state (partagé entre Legacy et V2) ───────
  const [user, setUser]                                       = useState(null)
  const [showAuthForFreeAnalysis, setShowAuthForFreeAnalysis] = useState(false)
  const [showFreeAnalysis, setShowFreeAnalysis]               = useState(false)
  const [freeMission, setFreeMission]                         = useState(null)
  const [unlockCheckout, setUnlockCheckout]                   = useState(null)

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
    if (!user) setShowAuthForFreeAnalysis(true)
    else       setShowFreeAnalysis(true)
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

  const helmet = (
    <Helmet>
      <title>Inspexo — Expert automobile indépendant, spécialisé par marque | Toulouse</title>
      <meta name="description" content="Faites inspecter votre véhicule d'occasion par un expert qualifié, spécialisé par marque. 100% côté acheteur. Analyse IA dès 0€. Toulouse & Haute-Garonne." />
      <link rel="canonical" href="https://www.inspexo.io/" />
    </Helmet>
  )

  const sharedModals = (
    <>
      <Suspense fallback={null}>
        {showAuthForFreeAnalysis && (
          <AuthModal
            isOpen={showAuthForFreeAnalysis}
            onClose={() => setShowAuthForFreeAnalysis(false)}
            onSuccess={handleAuthSuccess}
          />
        )}
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
        {freeMission && (
          <ChatIA
            mission={freeMission}
            onClose={() => setFreeMission(null)}
            onMissionUpdate={() => {}}
            onUnlockFullAnalysis={handleUnlockFullAnalysis}
            onBookExpert={handleBookExpert}
          />
        )}
        {unlockCheckout && (
          <CheckoutModal
            isOpen={!!unlockCheckout}
            onClose={() => setUnlockCheckout(null)}
            tier={unlockCheckout.tier}
            prefillVehicle={unlockCheckout.prefillVehicle}
            expertId={unlockCheckout.expertId ?? null}
          />
        )}
      </Suspense>
      <StickyCTA
        onClick={handleFreeAnalysis}
        isVisible={!showAuthForFreeAnalysis && !showFreeAnalysis && !freeMission && !unlockCheckout}
      />
    </>
  )

  /* ── V2 layout ────────────────────────────────────────────── */
  if (isV2) {
    return (
      <V2SiteLayout
        helmet={helmet}
        onFreeAnalysis={handleFreeAnalysis}
        onReserve={(expert, tier) => {
          setUnlockCheckout({ tier, prefillVehicle: null, expertId: expert?.id ?? null })
        }}
        sharedModals={sharedModals}
        skipLoader={!captureMode.loader}
      />
    )
  }

  /* ── Legacy layout (production sans flag) ────────────────── */
  return (
    <>
      {helmet}
      <LegacyNavbar />
      <main>
        <Hero
          onPrimaryCta={handleFreeAnalysis}
          onSecondaryCta={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
        />
        <Suspense fallback={null}>
          <StatsBar />
          <HowItWorks onFreeAnalysis={handleFreeAnalysis} />
          <Services onFreeAnalysis={handleFreeAnalysis} />
          <Experts onReserve={(expert, tier) => {
            setUnlockCheckout({ tier, prefillVehicle: null, expertId: expert?.id ?? null })
          }} />
          <BecomeExpert />
          <FAQ onFreeAnalysis={handleFreeAnalysis} />
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <Footer />
        <FooterNotes />
      </Suspense>
      {sharedModals}
    </>
  )
}

/* ── V2 layout : Loader → Navbar → Hero 3 écrans → TrustTicker
                  → sections legacy en-dessous (refonte en cours)  */
function V2SiteLayout({ helmet, onFreeAnalysis, onReserve, sharedModals, skipLoader = false }) {
  const [loaderDone, setLoaderDone] = useState(skipLoader)
  return (
    <>
      {helmet}
      {!loaderDone && <V2Loader onComplete={() => setLoaderDone(true)} />}
      <V2Navbar onPrimaryCta={onFreeAnalysis} />
      <main>
        <Hero
          onPrimaryCta={onFreeAnalysis}
          onSecondaryCta={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
        />
        <V2TrustTicker />
        {/* Sections legacy lazy-loaded — refonte Phases 3-5 */}
        <Suspense fallback={null}>
          <StatsBar />
          <HowItWorks onFreeAnalysis={onFreeAnalysis} />
          <Services onFreeAnalysis={onFreeAnalysis} />
          <Experts onReserve={onReserve} />
          <BecomeExpert />
          <FAQ onFreeAnalysis={onFreeAnalysis} />
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <Footer />
        <FooterNotes />
      </Suspense>
      {sharedModals}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Site />} />
          <Route path="/dashboard" element={<ClientDashboard />} />
          <Route path="/expert" element={<ExpertDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/mentions-legales" element={<MentionsLegales />} />
          <Route path="/politique-de-confidentialite" element={<PolitiqueConfidentialite />} />
          <Route path="/cgu" element={<CGU />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <CookieBanner />
    </BrowserRouter>
  )
}
