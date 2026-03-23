import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
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

function Site() {
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Site />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}
