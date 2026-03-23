import React from 'react'
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

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <StatsBar />
        <HowItWorks />
        <Services />
        <Experts />
        <BecomeExpert />
        <FAQ />
      </main>
      <Footer />
      <FooterNotes />
    </>
  )
}
