import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// 1. Importe HashRouter au lieu de BrowserRouter
import { HashRouter } from 'react-router-dom'
import './App.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* 2. Remplace BrowserRouter par HashRouter */}
    {/* Note : le basename n'est généralement plus nécessaire avec HashRouter */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)