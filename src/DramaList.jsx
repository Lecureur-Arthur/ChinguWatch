import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function DramaList({ session, status, onSelectDrama }) {
  const [dramas, setDramas] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [reviewingId, setReviewingId] = useState(null)
  const [reviewRating, setReviewRating] = useState('')
  const [reviewComment, setReviewComment] = useState('')

  useEffect(() => {
    fetchDramas()
  }, [status])

  const fetchDramas = async () => {
    setLoading(true)
    
    const { data, error } = await supabase
      .from('dramas')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) {
      console.error("Erreur lors de la récupération des séries :", error)
    } else {
      setDramas(data)
    }
    
    setLoading(false)
  }

  const handleStatusChange = async (drama, newStatus, e) => {
    // J'empêche la propagation du clic vers la carte pour ne pas déclencher l'ouverture de la page détaillée
    e.stopPropagation()
    
    if (newStatus === 'Watched') {
      setReviewingId(drama.id)
      setReviewRating('')
      setReviewComment('')
    } else {
      const { error } = await supabase
        .from('dramas')
        .update({ status: newStatus })
        .eq('id', drama.id)
        
      if (!error) {
        fetchDramas()
      } else {
        alert("Erreur lors du changement de statut : " + error.message)
      }
    }
  }

  const submitReview = async (id, e) => {
    e.stopPropagation()
    if (!reviewRating) {
      alert("La note personnelle est obligatoire pour passer une série en Vu.")
      return
    }
    
    const { error } = await supabase
      .from('dramas')
      .update({ 
        status: 'Watched', 
        personal_rating: reviewRating, 
        comment: reviewComment 
      })
      .eq('id', id)
      
    if (error) {
      alert("Erreur lors de la mise à jour : " + error.message)
    } else {
      setReviewingId(null)
      fetchDramas()
    }
  }

  const cancelReview = (e) => {
    e.stopPropagation()
    setReviewingId(null)
  }

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    const isConfirmed = window.confirm("Es-tu sûr de vouloir retirer ce drama de ta liste ?")
    if (!isConfirmed) return

    const { error } = await supabase
      .from('dramas')
      .delete()
      .eq('id', id)

    if (error) {
      alert("Erreur lors de la suppression : " + error.message)
    } else {
      setDramas(dramas.filter(drama => drama.id !== id))
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '3rem', fontSize: '1.2rem' }}>Chargement de la bibliothèque...</div>
  }

  if (dramas.length === 0) {
    return <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--secondary-text)', fontSize: '1.2rem' }}>Aucune série trouvée dans cette catégorie.</div>
  }

  return (
    <div style={{ width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
      <div className="drama-grid">
        {dramas.map((drama) => (
          <div 
            key={drama.id} 
            className="drama-card" 
            onClick={() => onSelectDrama(drama.id)}
            style={{ cursor: 'pointer' }}
          >
            {drama.poster_url ? (
              <img src={drama.poster_url} alt={drama.title} className="drama-poster" />
            ) : (
              <div className="drama-poster" style={{ backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#c7d0ff' }}>Pas d'image</span>
              </div>
            )}
            <div className="drama-info">
              <h4 className="drama-title" title={drama.title}>{drama.title}</h4>
              <div className="drama-genres">{drama.genre || 'Aucun genre spécifié'}</div>
              
              <div className="drama-ratings">
                <span title="Note TMDB">TMDB : <span className="rating-badge">{drama.site_rating || '-'}</span></span>
                <span title="Note VoirDrama">VD : <span className="rating-badge">{drama.voirdrama_rating || '-'}</span></span>
              </div>

              {status === 'Watched' && drama.personal_rating && (
                <div style={{ marginTop: '1rem', padding: '0.8rem', backgroundColor: '#1a1a1a', borderRadius: '8px', borderLeft: '3px solid var(--primary-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--secondary-text)', textTransform: 'uppercase', letterSpacing: '1px' }}>Ma Note</span>
                    <strong style={{ color: 'var(--primary-color)', fontSize: '1.1rem' }}>{drama.personal_rating} / 5</strong>
                  </div>
                  {drama.comment && (
                    <div style={{ fontSize: '0.9rem', color: 'var(--secondary-text)', fontStyle: 'italic', lineHeight: '1.4' }}>
                      "{drama.comment}"
                    </div>
                  )}
                </div>
              )}

              {/* J'applique la méthode stopPropagation sur tous les boutons pour isoler le clic de la carte entière */}
              <div onClick={(e) => e.stopPropagation()}>
                {reviewingId === drama.id ? (
                  <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: '#1a1a1a', padding: '0.8rem', borderRadius: '8px' }}>
                    <input 
                      type="number" 
                      step="0.1" 
                      max="5" 
                      placeholder="Note (/5) *" 
                      value={reviewRating} 
                      onChange={(e) => setReviewRating(e.target.value)} 
                      style={{ padding: '0.5rem', fontSize: '0.9rem' }}
                    />
                    <textarea 
                      placeholder="Commentaire (optionnel)" 
                      value={reviewComment} 
                      onChange={(e) => setReviewComment(e.target.value)} 
                      style={{ minHeight: '50px', padding: '0.5rem', fontSize: '0.9rem' }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button onClick={(e) => submitReview(drama.id, e)} style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Valider</button>
                      <button onClick={cancelReview} style={{ padding: '0.5rem', fontSize: '0.85rem', backgroundColor: '#555' }}>Annuler</button>
                    </div>
                  </div>
                ) : (
                  <select 
                    value={drama.status} 
                    onChange={(e) => handleStatusChange(drama, e.target.value, e)} 
                    style={{ marginTop: '1rem', padding: '0.5rem', fontSize: '0.9rem' }}
                  >
                    <option value="To Watch">À voir</option>
                    <option value="Watching">En cours</option>
                    <option value="Watched">Vu</option>
                  </select>
                )}

                <button 
                  onClick={(e) => handleDelete(drama.id, e)}
                  style={{ marginTop: '0.5rem', backgroundColor: 'transparent', border: '1px solid #d32f2f', color: '#d32f2f', padding: '0.5rem', fontSize: '0.9rem', width: '100%' }}
                >
                  Supprimer de la liste
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
