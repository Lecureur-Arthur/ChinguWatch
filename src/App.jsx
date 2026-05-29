import { useState, useEffect } from 'react'
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
  
  // États de navigation et historique
  const [activeTab, setActiveTab] = useState('to_watch')
  const [selectedDramaId, setSelectedDramaId] = useState(null)
  const [selectedActorId, setSelectedActorId] = useState(null)
  const [previewTmdbId, setPreviewTmdbId] = useState(null)
  const [navHistory, setNavHistory] = useState([]) 

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

  // Fonction de navigation profonde avec sauvegarde de l'historique
  const navigateTo = (tab, params = {}) => {
    setNavHistory(prev => [...prev, { 
      tab: activeTab, 
      dramaId: selectedDramaId, 
      actorId: selectedActorId, 
      tmdbId: previewTmdbId 
    }])
    setActiveTab(tab)
    if (params.dramaId !== undefined) setSelectedDramaId(params.dramaId)
    if (params.actorId !== undefined) setSelectedActorId(params.actorId)
    if (params.tmdbId !== undefined) setPreviewTmdbId(params.tmdbId)
  }

  // Fonction de retour en arrière
  const goBack = () => {
    setNavHistory(prev => {
      const newHistory = [...prev]
      const lastState = newHistory.pop()
      if (lastState) {
        setActiveTab(lastState.tab)
        setSelectedDramaId(lastState.dramaId)
        setSelectedActorId(lastState.actorId)
        setPreviewTmdbId(lastState.tmdbId)
      } else {
        setActiveTab('to_watch')
      }
      return newHistory
    })
  }

  // Réinitialisation lors du clic sur le menu principal
  const handleNavClick = (tab) => {
    setNavHistory([])
    setActiveTab(tab)
    setSelectedDramaId(null)
    setSelectedActorId(null)
    setPreviewTmdbId(null)
  }

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

  return (
    <div className="app-container">
      <nav className="navbar">
        <h1>ChinguWatch</h1>
        
        <div className="nav-buttons">
          <button className={`nav-btn ${activeTab === 'to_watch' ? 'active' : ''}`} onClick={() => handleNavClick('to_watch')}>À voir</button>
          <button className={`nav-btn ${activeTab === 'watching' ? 'active' : ''}`} onClick={() => handleNavClick('watching')}>En cours</button>
          <button className={`nav-btn ${activeTab === 'watched' ? 'active' : ''}`} onClick={() => handleNavClick('watched')}>Vu</button>
          <button className={`nav-btn ${activeTab === 'add' ? 'active' : ''}`} onClick={() => handleNavClick('add')}>Ajouter</button>
          
          <button type="button" className="avatar-nav-btn" onClick={() => handleNavClick('profile')} aria-label="Ouvrir le profil">
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
        {activeTab === 'to_watch' && <DramaList session={session} status="To Watch" onSelectDrama={(id) => navigateTo('detail', { dramaId: id })} />}
        {activeTab === 'watching' && <DramaList session={session} status="Watching" onSelectDrama={(id) => navigateTo('detail', { dramaId: id })} />}
        {activeTab === 'watched' && <DramaList session={session} status="Watched" onSelectDrama={(id) => navigateTo('detail', { dramaId: id })} />}
        {activeTab === 'add' && <AddDrama session={session} />}
        {activeTab === 'profile' && <Profile session={session} onSessionRefresh={refreshSession} onAvatarUpdate={handleAvatarUpdate} />}
        {activeTab === 'detail' && selectedDramaId && <DramaDetail dramaId={selectedDramaId} onBack={goBack} onSelectActor={(id) => navigateTo('actor', { actorId: id })} />}
        {activeTab === 'actor' && selectedActorId && <DramaActeur actorId={selectedActorId} onBack={goBack} onPreviewTmdb={(id) => navigateTo('tmdb_preview', { tmdbId: id })} />}
        {activeTab === 'tmdb_preview' && previewTmdbId && <TmdbPreview tmdbId={previewTmdbId} onBack={goBack} session={session} />}
      </main>
    </div>
  )
}