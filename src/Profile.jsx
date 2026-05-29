import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Profile({ session }) {
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
      
      await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      })
      
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
      <h2 style={{ marginTop: 0, marginBottom: '2rem' }}>Mon Profil</h2>

      <div className="profile-layout">
        
        {/* Je crée la colonne dédiée à l'identité visuelle de l'utilisateur */}
        <div className="profile-section">
          <h3>Photo de profil</h3>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="avatar-preview" style={{ width: '150px', height: '150px', marginBottom: '1.5rem' }} />
            ) : (
              <div className="avatar-preview" style={{ width: '150px', height: '150px', backgroundColor: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '3rem', color: '#888' }}>?</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={uploadingAvatar}
              style={{ padding: '0.5rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer' }}
            />
            {uploadingAvatar && <p style={{ marginTop: '1rem', color: '#aaa' }}>Chargement de l'image en cours...</p>}
          </div>
        </div>

        {/* Je crée la colonne dédiée à la sécurité et aux actions de gestion de compte */}
        <div className="profile-section">
          <h3>Sécurité & Authentification</h3>
          <form onSubmit={handleUpdatePassword} style={{ marginBottom: '2rem', flex: 1 }}>
            <input
              type="password"
              placeholder="Mot de passe actuel"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Nouveau mot de passe"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Confirmer le nouveau mot de passe"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
            />
            <button type="submit" disabled={loadingPassword} style={{ marginTop: '0.5rem' }}>
              {loadingPassword ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
            </button>
          </form>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button className="logout-btn" onClick={() => supabase.auth.signOut()} style={{ marginTop: '0' }}>
              Se déconnecter
            </button>
            
            <button 
              onClick={handleDeleteAccount} 
              style={{ backgroundColor: 'transparent', border: '1px solid #d32f2f', color: '#d32f2f' }}
            >
              Supprimer mon compte
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}