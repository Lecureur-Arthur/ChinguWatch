import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import './App.css'
import Auth from './Auth'
import AddDrama from './AddDrama'
import Profile from './Profile'
import DramaList from './DramaList'
import DramaDetail from './DramaDetail'
import DramaActeur from './DramaActeur'
import TmdbPreview from './TmdbPreview'

export default function App() {
  const [session, setSession] = useState(null)
  
  // État pour stocker les compteurs de chaque catégorie
  const [counts, setCounts] = useState({
    toWatch: 0,
    watching: 0,
    watched: 0,
    notFound: 0
  })
  
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchCategoryCounts(session.user.id)
    })
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchCategoryCounts(session.user.id)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fonction pour récupérer les totaux depuis Supabase
  const fetchCategoryCounts = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('dramas')
        .select('status')
        .eq('user_id', userId)

      if (error) throw error

      const tally = {
        toWatch: 0,
        watching: 0,
        watched: 0,
        notFound: 0
      }

      data.forEach(item => {
        if (item.status === 'To Watch') tally.toWatch++
        if (item.status === 'Watching') tally.watching++
        if (item.status === 'Watched') tally.watched++
        if (item.status === 'Not Found') tally.notFound++
      })

      setCounts(tally)
    } catch (err) {
      console.error("Erreur lors de la récupération des compteurs :", err)
    }
  }

  if (!session) return <Auth />

  const isActive = (path) => location.pathname.startsWith(path)

  return (
    <div className="app-layout">
      {/* SIDEBAR GAUCHE */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          {/* Remplace ce SVG par ton propre logo (ex: le phénix/oiseau de ton Figma) */}
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
          Chingu<span>Watch</span>
        </div>
        
        <div className="sidebar-divider"></div>
        <div className="menu-label">Menu Principal</div>
        
        <button className={`nav-btn ${isActive('/ToWatch') ? 'active' : ''}`} onClick={() => navigate('/ToWatch')}>
          {/* SVG icon "A voir" */}
          <svg className="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
          À voir
          <span className="sidebar-badge">{counts.toWatch}</span>
        </button>
        <button className={`nav-btn ${isActive('/Watching') ? 'active' : ''}`} onClick={() => navigate('/Watching')}>
          <svg className="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
            <polyline points="17 2 12 7 7 2"></polyline>
          </svg>
          En cours
          <span className="sidebar-badge">{counts.watching}</span>
        </button>
        <button className={`nav-btn ${isActive('/Watched') ? 'active' : ''}`} onClick={() => navigate('/Watched')}>
          <svg className="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          Vu
          <span className="sidebar-badge">{counts.watched}</span>
        </button>

        <div className="sidebar-divider"></div>
        <div className="menu-label">Outils & Découverte</div>

        <button className={`nav-btn ${isActive('/NotFound') ? 'active' : ''}`} onClick={() => navigate('/NotFound')}>
          {/* Remplace ce SVG par ton icône "Vidéo introuvable" */}
          <svg className="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          Vidéo introuvable
          <span className="sidebar-badge badge-warning">{counts.notFound}</span>
        </button>
        <button className={`nav-btn ${isActive('/Add') ? 'active' : ''}`} onClick={() => navigate('/Add')}>
          {/* Remplace ce SVG par ton icône "Ajouter" */}
          <svg className="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          Ajouter un titre
        </button>

        <div style={{ flex: 1 }}></div>

        <button className={`nav-btn ${isActive('/Profil') ? 'active' : ''}`} onClick={() => navigate('/Profil')}>
          {/* Remplace ce SVG par ton icône "Paramètres" */}
          <svg className="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          Paramètres
        </button>
      </aside>

      {/* CONTENU PRINCIPAL */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/ToWatch" replace />} />
          <Route path="/ToWatch" element={<DramaList session={session} status="To Watch" />} />
          <Route path="/Watching" element={<DramaList session={session} status="Watching" />} />
          <Route path="/Watched" element={<DramaList session={session} status="Watched" />} />
          <Route path="/Add" element={<AddDrama session={session} />} />
          <Route path="/Profil" element={<Profile session={session} />} />
          <Route path="/drama/:slug" element={<DramaDetail />} />
          <Route path="/actor/:slug" element={<DramaActeur />} />
          <Route path="/preview/:slug" element={<TmdbPreview session={session} />} />
          <Route path="/NotFound" element={<DramaList session={session} status="Not Found" />} />
        </Routes>
      </main>
    </div>
  )
}