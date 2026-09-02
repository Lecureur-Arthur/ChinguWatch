import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Stats from './Stats'

export default function Profile({ session, onSessionRefresh, onAvatarUpdate }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [loadingPassword, setLoadingPassword] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(null)

  useEffect(() => {
    if (session?.user?.user_metadata?.avatar_url) {
      setAvatarUrl(session.user.user_metadata.avatar_url)
    }
  }, [session])

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    
    if (newPassword !== confirmNewPassword) {
      alert("Les nouveaux mots de passe ne correspondent pas.")
      return
    }

    setLoadingPassword(true)

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword
    })

    if (verifyError) {
      alert("Le mot de passe actuel est incorrect.")
      setLoadingPassword(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (updateError) {
      alert("Erreur lors de la mise à jour : " + updateError.message)
    } else {
      alert("Mot de passe mis à jour avec succès.")
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
    }
    
    setLoadingPassword(false)
  }

  const handleAvatarUpload = async (e) => {
    try {
      setUploadingAvatar(true)
      const file = e.target.files[0]
      if (!file) return

      const fileExt = file.name.split('.').pop()
      const fileName = `${session.user.id}-${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
      const publicUrl = data.publicUrl
      setAvatarUrl(publicUrl)
      if (onAvatarUpdate) {
        onAvatarUpdate(publicUrl)
      }
      
      await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      })

      if (onSessionRefresh) {
        await onSessionRefresh()
      }
      
      alert("Image de profil mise à jour.")

    } catch (error) {
      alert("Erreur lors de l'upload : " + error.message)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleDeleteAccount = async () => {
    const isConfirmed = window.confirm("Êtes-vous sûr de vouloir supprimer définitivement votre compte ? Cette action est irréversible et effacera toutes vos données.")
    
    if (!isConfirmed) return

    const { error } = await supabase.rpc('delete_user')

    if (error) {
      alert("Erreur lors de la suppression du compte : " + error.message)
    } else {
      alert("Votre compte a été supprimé avec succès.")
      await supabase.auth.signOut()
    }
  }

  return (
    <div className="form-container">
      <h2 style={{ marginTop: 0, marginBottom: '2rem' }}>Paramètres du compte</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
        
        {/* --- SECTION AVATAR --- */}
        <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem' }}>
          <h3 className="panel-label" style={{ alignSelf: 'flex-start', marginBottom: '1.5rem', margin: 0 }}>Photo de profil</h3>
          
          <div style={{ position: 'relative', marginBottom: '2rem' }}>
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt="Avatar" 
                style={{ width: '150px', height: '150px', borderRadius: '50%', objectFit: 'cover', border: '4px solid rgba(160, 116, 255, 0.3)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }} 
              />
            ) : (
              <div style={{ width: '150px', height: '150px', borderRadius: '50%', backgroundColor: '#1b243b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', color: '#c7d0ff', border: '4px solid rgba(160, 116, 255, 0.3)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                ?
              </div>
            )}
          </div>

          <label className="secondary-btn" style={{ cursor: 'pointer', textAlign: 'center', width: '100%', padding: '12px' }}>
            {uploadingAvatar ? 'Chargement...' : 'Changer l\'image'}
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleAvatarUpload} 
              disabled={uploadingAvatar} 
              style={{ display: 'none' }} // Cache l'input moche, laisse le label agir comme un bouton
            />
          </label>
        </div>

        {/* --- SECTION SÉCURITÉ (Mot de passe) --- */}
        <div className="panel-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
          <h3 className="panel-label" style={{ marginBottom: '1.5rem', margin: 0 }}>Sécurité & Authentification</h3>
          
          <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
            
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>Mot de passe actuel</label>
              <input 
                type="password" 
                value={currentPassword} 
                onChange={(e) => setCurrentPassword(e.target.value)} 
                required 
                className="input-field" 
                style={{ margin: 0, width: '100%' }} 
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>Nouveau mot de passe</label>
              <input 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                required 
                className="input-field" 
                style={{ margin: 0, width: '100%' }} 
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>Confirmer le nouveau mot de passe</label>
              <input 
                type="password" 
                value={confirmNewPassword} 
                onChange={(e) => setConfirmNewPassword(e.target.value)} 
                required 
                className="input-field" 
                style={{ margin: 0, width: '100%' }} 
              />
            </div>
            
            <button type="submit" disabled={loadingPassword} className="primary-btn" style={{ marginTop: 'auto', padding: '12px' }}>
              {loadingPassword ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
            </button>
          </form>
        </div>
      </div>

      {/* --- SECTION ZONE DE DANGER --- */}
      <div className="panel-card" style={{ padding: '1.5rem 2rem', marginBottom: '2rem', borderLeft: '4px solid #ef4444' }}>
        <h3 className="panel-label" style={{ marginBottom: '1.5rem', color: '#ef4444', margin: 0 }}>Zone de danger</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          
          <button 
            onClick={() => supabase.auth.signOut()} 
            className="secondary-btn" 
            style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Se déconnecter
          </button>
          
          <button 
            onClick={handleDeleteAccount} 
            style={{ 
              flex: 1, 
              minWidth: '200px', 
              backgroundColor: 'rgba(239, 68, 68, 0.1)', 
              color: '#ef4444', 
              border: '1px solid rgba(239, 68, 68, 0.3)', 
              padding: '12px', 
              borderRadius: '12px', 
              fontWeight: '600', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '8px', 
              transition: 'all 0.2s' 
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ef4444'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"></path>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
            Supprimer mon compte
          </button>

        </div>
      </div>

      {/* --- STATISTIQUES --- */}
      <Stats session={session} />
      
    </div>
  )
}