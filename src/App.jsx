import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './App.css'
import Auth from './Auth'
import AddDrama from './AddDrama'
import Profile from './Profile'
import DramaList from './DramaList'
import DramaDetail from './DramaDetail'

export default function App() {
  const [session, setSession] = useState(null)
  
  // Je définis une variable d'état supplémentaire pour suivre la série en cours d'inspection
  const [activeTab, setActiveTab] = useState('to_watch')
  const [selectedDramaId, setSelectedDramaId] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  if (!session) {
    return <Auth />
  }

  // J'implémente la fonction qui bascule la vue sur les détails de la série sélectionnée
  const handleSelectDrama = (id) => {
    setSelectedDramaId(id)
    setActiveTab('detail')
  }

  // J'implémente la fonction qui restaure l'affichage de la bibliothèque
  const handleBackToList = () => {
    setSelectedDramaId(null)
    setActiveTab('to_watch')
  }

  return (
    <div className="app-container">
      <nav className="navbar">
        <h1>ChinguWatch</h1>
        
        <div className="nav-buttons">
          <button className={`nav-btn ${activeTab === 'to_watch' ? 'active' : ''}`} onClick={() => { setActiveTab('to_watch'); setSelectedDramaId(null); }}>À voir</button>
          <button className={`nav-btn ${activeTab === 'watching' ? 'active' : ''}`} onClick={() => { setActiveTab('watching'); setSelectedDramaId(null); }}>En cours</button>
          <button className={`nav-btn ${activeTab === 'watched' ? 'active' : ''}`} onClick={() => { setActiveTab('watched'); setSelectedDramaId(null); }}>Vu</button>
          <button className={`nav-btn ${activeTab === 'add' ? 'active' : ''}`} onClick={() => { setActiveTab('add'); setSelectedDramaId(null); }}>Ajouter</button>
          
          <button className="avatar-nav-btn" onClick={() => { setActiveTab('profile'); setSelectedDramaId(null); }}>
            {session.user?.user_metadata?.avatar_url ? (
              <img src={session.user.user_metadata.avatar_url} alt="Profil" className="nav-avatar" />
            ) : (
              <span style={{ color: '#fff', fontWeight: 'bold' }}>P</span>
            )}
          </button>
        </div>
      </nav>

      <main style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        {activeTab === 'to_watch' && <DramaList session={session} status="To Watch" onSelectDrama={handleSelectDrama} />}
        {activeTab === 'watching' && <DramaList session={session} status="Watching" onSelectDrama={handleSelectDrama} />}
        {activeTab === 'watched' && <DramaList session={session} status="Watched" onSelectDrama={handleSelectDrama} />}
        {activeTab === 'add' && <AddDrama session={session} />}
        {activeTab === 'profile' && <Profile session={session} />}
        {activeTab === 'detail' && selectedDramaId && <DramaDetail dramaId={selectedDramaId} onBack={handleBackToList} />}
      </main>
    </div>
  )
}