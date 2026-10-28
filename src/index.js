import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './styles/tokens.css'
import './styles/base.css'
import App from './App'

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
)
