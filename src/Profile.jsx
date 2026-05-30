import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

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
    <div className="form-container profile-page">
      <h2>Mon Profil</h2>

      <div className="profile-layout">
        <div className="profile-section">
          <h3 className="profile-section-title">Photo de profil</h3>
          <div className="profile-avatar-panel">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="avatar-preview avatar-preview--large" />
            ) : (
              <div className="avatar-preview avatar-preview--large avatar-fallback-panel">
                <span className="avatar-fallback">?</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={uploadingAvatar}
              className="file-input"
            />
            {uploadingAvatar && <p className="upload-status">Chargement de l'image en cours...</p>}
          </div>
        </div>

        <div className="profile-section">
          <h3 className="profile-section-title">Sécurité & Authentification</h3>
          <form onSubmit={handleUpdatePassword} className="profile-form">
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
            <button type="submit" disabled={loadingPassword}>
              {loadingPassword ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
            </button>
          </form>

          <div className="profile-actions">
            <button className="logout-btn" onClick={() => supabase.auth.signOut()}>
              Se déconnecter
            </button>
            <button className="danger-btn" onClick={handleDeleteAccount}>
              Supprimer mon compte
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}