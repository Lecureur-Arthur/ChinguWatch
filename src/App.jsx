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
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [avatarError, setAvatarError] = useState(false)
  
  // J'utilise les hooks de react-router-dom pour gérer la navigation et l'url courante.
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAvatarUrl(session?.user?.user_metadata?.avatar_url ?? null)
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setAvatarUrl(session?.user?.user_metadata?.avatar_url ?? null)
      setAvatarError(false)
    })
  }, [])

  if (!session) {
    return <Auth />
  }

  // Je conserve ma méthode de rafraîchissement de session.
  const refreshSession = async () => {
    const { data: { session: newSession } } = await supabase.auth.getSession()
    setSession(newSession)
    setAvatarUrl(newSession?.user?.user_metadata?.avatar_url ?? null)
    setAvatarError(false)
  }

  const activeAvatarUrl = avatarUrl || session.user?.user_metadata?.avatar_url

  const handleAvatarUpdate = (newUrl) => {
    setAvatarUrl(newUrl)
    setAvatarError(false)
  }

  const tryLoadSignedAvatar = async (failedUrl) => {
    if (!failedUrl || avatarError) return
    const filePathMatch = failedUrl.match(/avatars\/(.+)$/)
    if (!filePathMatch) {
      setAvatarError(true)
      return
    }
    const filePath = filePathMatch[1]
    const { data, error } = await supabase.storage.from('avatars').createSignedUrl(filePath, 60)
    if (error || !data?.signedUrl) {
      setAvatarError(true)
      return
    }
    setAvatarUrl(data.signedUrl)
    setAvatarError(false)
  }

  // Je vérifie si la route courante correspond au bouton pour lui appliquer la classe active.
  const isActive = (path) => location.pathname.startsWith(path)

  return (
    <div className="app-container">
      <nav className="navbar">
        <h1>ChinguWatch</h1>
        
        <div className="nav-buttons">
          <button className={`nav-btn ${isActive('/ToWatch') ? 'active' : ''}`} onClick={() => navigate('/ToWatch')}>À voir</button>
          <button className={`nav-btn ${isActive('/Watching') ? 'active' : ''}`} onClick={() => navigate('/Watching')}>En cours</button>
          <button className={`nav-btn ${isActive('/Watched') ? 'active' : ''}`} onClick={() => navigate('/Watched')}>Vu</button>
          <button className={`nav-btn ${isActive('/Add') ? 'active' : ''}`} onClick={() => navigate('/Add')}>Ajouter</button>
          
          <button type="button" className="avatar-nav-btn" onClick={() => navigate('/Profil')} aria-label="Ouvrir le profil">
            {activeAvatarUrl && !avatarError ? (
              <img src={activeAvatarUrl} alt="Profil" className="nav-avatar" onError={(e) => tryLoadSignedAvatar(e.currentTarget.src)} />
            ) : (
              <span className="avatar-fallback">
                {session.user?.user_metadata?.full_name?.charAt(0).toUpperCase() || session.user?.email?.charAt(0).toUpperCase() || 'P'}
              </span>
            )}
          </button>
        </div>
      </nav>

      <main style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        {/* J'organise ici l'ensemble de mes routes pour faire correspondre l'URL au bon composant. */}
        <Routes>
          <Route path="/" element={<Navigate to="/ToWatch" replace />} />
          <Route path="/ToWatch" element={<DramaList session={session} status="To Watch" />} />
          <Route path="/Watching" element={<DramaList session={session} status="Watching" />} />
          <Route path="/Watched" element={<DramaList session={session} status="Watched" />} />
          <Route path="/Add" element={<AddDrama session={session} />} />
          <Route path="/Profil" element={<Profile session={session} onSessionRefresh={refreshSession} onAvatarUpdate={handleAvatarUpdate} />} />
          <Route path="/drama/:id" element={<DramaDetail />} />
          <Route path="/actor/:id" element={<DramaActeur />} />
          <Route path="/preview/:id" element={<TmdbPreview session={session} />} />
        </Routes>
      </main>
    </div>
  )
}