import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'

export default function DramaList({ session, status }) {
  const [dramas, setDramas] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [reviewingId, setReviewingId] = useState(null)
  const [reviewRating, setReviewRating] = useState('')
  const [reviewComment, setReviewComment] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  
  // J'initialise le tri par défaut en fonction du statut de la page active
  const [sortBy, setSortBy] = useState(status === 'Watched' ? 'personal_rating_desc' : 'rating_desc')

  const navigate = useNavigate()

  useEffect(() => {
    const fetchDramas = async () => {
      const { data, error } = await supabase
        .from('dramas')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', status)
      
      if (data) {
        setDramas(data)
      }
    }

    fetchDramas()
  }, [session, status]) 

  useEffect(() => {
    // Je force la réinitialisation du tri par défaut lors de la navigation entre les onglets
    setSortBy(status === 'Watched' ? 'personal_rating_desc' : 'rating_desc')
    fetchDramas()
  }, [status])

  const fetchDramas = async () => {
    setLoading(true)
    
    const { data, error } = await supabase
      .from('dramas')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('status', status)

    if (error) {
      console.error("Erreur lors de la récupération des séries :", error)
    } else {
      setDramas(data || [])
    }
    
    setLoading(false)
  }

  const createSlug = (title) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  const handleStatusChange = async (drama, newStatus, e) => {
    e.preventDefault()
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
    e.preventDefault()
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
    e.preventDefault()
    e.stopPropagation()
    setReviewingId(null)
  }

  const handleDelete = async (id, e) => {
    e.preventDefault()
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

  const processedDramas = dramas
    .filter((drama) => {
      if (!searchQuery) return true
      return drama.title.toLowerCase().includes(searchQuery.toLowerCase())
    })
    .sort((a, b) => {
      if (sortBy === 'date_desc') {
        return new Date(b.created_at) - new Date(a.created_at)
      }
      if (sortBy === 'date_asc') {
        return new Date(a.created_at) - new Date(b.created_at)
      }
      if (sortBy === 'alpha_asc') {
        return a.title.localeCompare(b.title)
      }
      if (sortBy === 'rating_desc') {
        return (b.site_rating || 0) - (a.site_rating || 0)
      }
      if (sortBy === 'personal_rating_desc') {
        return (b.personal_rating || 0) - (a.personal_rating || 0)
      }
      return 0
    })

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '3rem', fontSize: '1.2rem' }}>Chargement de la bibliothèque...</div>
  }

  if (dramas.length === 0) {
    return <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--secondary-text)', fontSize: '1.2rem' }}>Aucune série trouvée dans cette catégorie.</div>
  }

  return (
    <div style={{ width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', backgroundColor: 'rgba(255, 255, 255, 0.04)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <input
          type="text"
          placeholder="Rechercher une série..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field"
          style={{ flex: '1', minWidth: '250px', margin: 0 }}
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="status-select"
          style={{ width: 'auto', minWidth: '220px', margin: 0 }}
        >
          <option value="rating_desc">Note TMDB (Décroissante)</option>
          <option value="date_desc">Plus récents d'abord</option>
          <option value="date_asc">Plus anciens d'abord</option>
          <option value="alpha_asc">Ordre alphabétique (A-Z)</option>
          {status === 'Watched' && <option value="personal_rating_desc">Ma note (Décroissante)</option>}
        </select>
      </div>

      {processedDramas.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--secondary-text)', fontSize: '1.1rem' }}>Aucun résultat pour cette recherche.</div>
      ) : (
        <div className="drama-grid">
          {processedDramas.map((drama) => (
            <Link 
              key={drama.id} 
              to={`/drama/${createSlug(drama.title)}`}
              className="drama-card" 
              style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}
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
                  <div className="panel-card" style={{ marginTop: '1rem', borderLeft: '4px solid var(--primary-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span className="panel-label">Ma Note</span>
                      <strong style={{ color: 'var(--primary-color)', fontSize: '1.1rem' }}>{drama.personal_rating} / 5</strong>
                    </div>
                    {drama.comment && (
                      <div style={{ fontSize: '0.9rem', color: '#ccc', fontStyle: 'italic', lineHeight: '1.4', marginTop: '0.5rem' }}>
                        "{drama.comment}"
                      </div>
                    )}
                  </div>
                )}

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
                        onClick={(e) => e.preventDefault()}
                        style={{ padding: '0.5rem', fontSize: '0.9rem' }}
                      />
                      <textarea 
                        placeholder="Commentaire (optionnel)" 
                        value={reviewComment} 
                        onChange={(e) => setReviewComment(e.target.value)} 
                        onClick={(e) => e.preventDefault()}
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
                      onClick={(e) => e.preventDefault()}
                      className="status-select"
                      style={{ marginTop: '1rem' }}
                    >
                      <option value="Not Found">Vidéos introuvables</option>
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
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}