import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './styles/tokens.css'
import './styles/base.css'
import App from './App'

// Pourquoi createRoot et PAS hydrateRoot, alors que les pages publiques sont
// pré-rendues : le HTML pré-rendu est la sérialisation d'un DOM rendu côté
// client (scripts/prerendu.mjs), pas une sortie de rendu serveur. Il lui
// manque les marqueurs que React place entre deux nœuds texte voisins, qui
// fusionnent à la sérialisation — l'hydratation échoue alors sur TOUTES les
// pages (erreurs React #418/#425 mesurées, y compris sur une page sans aucune
// donnée distante), et React reconstruit quand même en journalisant une
// erreur. Le pré-rendu sert donc ce pour quoi il est fait : donner aux
// moteurs de recherche un contenu lisible sans JavaScript. Le coût de la
// reprise en main par React est réduit autrement (découpage par route et
// données déjà présentes dans le HTML, voir src/lib/prerendu.js).
ReactDOM.createRoot(document.getElementById('root')).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
)
