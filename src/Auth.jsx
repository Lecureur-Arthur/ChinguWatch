import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    if (isSignUp) {
      if (password !== confirmPassword) {
        alert("Les mots de passe ne correspondent pas.")
        setLoading(false)
        return
      }
      
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        alert(error.message)
      } else {
        alert('Inscription réussie. Vous êtes maintenant connecté.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        alert(error.message)
      }
    }
    
    setLoading(false)
  }

  return (
    <div className="form-container" style={{ marginTop: '10vh' }}>
      <h2>{isSignUp ? 'Créer un compte' : 'Connexion à ChinguWatch'}</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Votre email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Votre mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        
        {isSignUp && (
          <input
            type="password"
            placeholder="Confirmer le mot de passe"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        )}
        
        <button type="submit" disabled={loading}>
          {loading ? 'Chargement...' : (isSignUp ? "S'inscrire" : 'Se connecter')}
        </button>
      </form>
      
      <button 
        onClick={() => setIsSignUp(!isSignUp)} 
        style={{ marginTop: '1rem', backgroundColor: 'transparent', border: '1px solid var(--primary-color)', color: 'var(--primary-color)' }}
      >
        {isSignUp ? 'Déjà un compte ? Se connecter' : "Pas de compte ? S'inscrire"}
      </button>
    </div>
  )
}