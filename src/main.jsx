import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './App.css'
import App from './App.jsx'

// J'initialise l'application React et je l'encapsule dans le routeur principal avec le bon basename
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename="/ChinguWatch">
      <App />
    </BrowserRouter>
  </StrictMode>,
)