import React from 'react'
import { Link } from 'react-router-dom'
import Seal from './Seal'

// Pied de page de la maquette sprint 5 — identique sur toutes les pages.
export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="cols">
          <div className="col">
            <Link className="brand" to="/" style={{ marginBottom: 12 }}>
              <Seal />
              <span>Inspexo</span>
            </Link>
            <p className="baseline">L'analyse d'annonce côté acheteur. Toulouse, pour toute la France.</p>
          </div>
          <div className="col">
            <p>Produit</p>
            <Link to="/score">Analyser une annonce</Link>
            <Link to="/pass">Pass achat</Link>
            <Link to="/extension">Extension Chrome</Link>
            <Link to="/extension">Appli mobile</Link>
            <Link to="/moteur">Pannes par moteur</Link>
            <Link to="/airbags-takata">Airbags Takata</Link>
            <Link to="/fiabilite">Fiabilité</Link>
          </div>
          <div className="col">
            <p>Société</p>
            <a href="/#faq">Experts et garages : liste d'attente</a>
            <Link to="/mentions-legales">Mentions légales</Link>
            <Link to="/cgu">Conditions d'utilisation</Link>
            <Link to="/cgv-pass">CGV du Pass achat</Link>
            <Link to="/politique-de-confidentialite">Confidentialité</Link>
            <a href="mailto:contact@inspexo.io">Contact</a>
          </div>
        </div>
        <div className="legal">
          <span>DUPLEX SAS · Toulouse · 2026</span>
          <span>Analyse automatique. Ne remplace pas l'examen du véhicule par un professionnel.</span>
        </div>
      </div>
    </footer>
  )
}
