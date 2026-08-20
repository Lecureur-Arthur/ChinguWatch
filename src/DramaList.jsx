import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'

export default function DramaList({ session, status }) {
  const [dramas, setDramas] = useState([])
  const [loading, setLoading] = useState(true)
  
<<<<<<< HEAD
  // État pour stocker les titres dynamiques TMDB { [dramaId]: { original, english, french } }
=======
  // État pour stocker les titres TMDB récupérés dynamiquement { [dramaId]: { original, english } }
>>>>>>> e3ad3735e4b56a518fb29c0536cfe1ff70d45a0f
  const [tmdbTitlesMap, setTmdbTitlesMap] = useState({})

  const [reviewingId, setReviewingId] = useState(null)
  const [reviewRating, setReviewRating] = useState('')
  const [reviewComment, setReviewComment] = useState('')

  // --- États pour la boîte modale de durée ---
  const [runtimeModalOpen, setRuntimeModalOpen] = useState(false)
  const [runtimeDrama, setRuntimeDrama] = useState(null)
<<<<<<< HEAD
  const [runtimeMode, setRuntimeMode] = useState('average') // 'average', 'individual' ou 'total'
  
  const [avgHours, setAvgHours] = useState('')
  const [avgMinutes, setAvgMinutes] = useState('')
  const [totalHours, setTotalHours] = useState('')
  const [totalMinutes, setTotalMinutes] = useState('')
  const [individualRuntimes, setIndividualRuntimes] = useState([]) 
=======
  const [runtimeMode, setRuntimeMode] = useState('average')
  
  const [avgHours, setAvgHours] = useState('')
  const [avgMinutes, setAvgMinutes] = useState('')
  
  const [totalHours, setTotalHours] = useState('')
  const [totalMinutes, setTotalMinutes] = useState('')
  
  const [individualRuntimes, setIndividualRuntimes] = useState([])
>>>>>>> e3ad3735e4b56a518fb29c0536cfe1ff70d45a0f

  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState(status === 'Watched' ? 'personal_rating_desc' : 'rating_desc')

  const navigate = useNavigate()

  useEffect(() => {
    fetchDramas()
  }, [session, status]) 

  useEffect(() => {
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
      setDramas([])
<<<<<<< HEAD
    } else {
      const dramasList = data || []
      setDramas(dramasList)
      // On lance la récupération TMDB en arrière-plan pour les titres
=======
      setLoading(false)
    } else {
      const dramasList = data || []
      setDramas(dramasList)
      setLoading(false)
>>>>>>> e3ad3735e4b56a518fb29c0536cfe1ff70d45a0f
      fetchTmdbTitlesAsync(dramasList)
    }
  }

  const fetchTmdbTitlesAsync = async (dramasArray) => {
    const apiKey = import.meta.env.VITE_TMDB_API_KEY
    if (!apiKey) return

    const titlesMap = {}

    for (const drama of dramasArray) {
      let tmdbId = drama.tmdb_id

      try {
        if (!tmdbId && drama.title) {
          const query = encodeURIComponent(drama.title)
          const res = await fetch(`https://api.themoviedb.org/3/search/tv?query=${query}&api_key=${apiKey}`)
          const searchData = await res.json()
          if (searchData.results && searchData.results.length > 0) {
            tmdbId = searchData.results[0].id
          }
        }

        if (tmdbId) {
          const [resFr, resEn] = await Promise.all([
            fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?language=fr-FR&api_key=${apiKey}`),
            fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?language=en-US&api_key=${apiKey}`)
          ])

          const dataFr = await resFr.json()
          const dataEn = await resEn.json()

          titlesMap[drama.id] = {
            original: dataFr.original_name || drama.title,
            english: dataEn.name || dataEn.original_name || drama.title
          }
        } else {
          titlesMap[drama.id] = {
            original: drama.title,
            english: drama.title
          }
        }
      } catch (err) {
        titlesMap[drama.id] = {
          original: drama.title,
          english: drama.title
        }
      }
    }

    setTmdbTitlesMap(prev => ({ ...prev, ...titlesMap }))
  }

  // --- Fonction pour interroger TMDB et récupérer les 3 titres ---
  const fetchTmdbTitlesAsync = async (dramasArray) => {
    const apiKey = import.meta.env.VITE_TMDB_API_KEY
    if (!apiKey) return

    const titlesMap = {}

    for (const drama of dramasArray) {
      let tmdbId = drama.tmdb_id

      try {
        if (!tmdbId && drama.title) {
          const query = encodeURIComponent(drama.title)
          const res = await fetch(`https://api.themoviedb.org/3/search/tv?query=${query}&api_key=${apiKey}`)
          const searchData = await res.json()
          if (searchData.results && searchData.results.length > 0) {
            tmdbId = searchData.results[0].id
          }
        }

        if (tmdbId) {
          const [resFr, resEn] = await Promise.all([
            fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?language=fr-FR&api_key=${apiKey}`),
            fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?language=en-US&api_key=${apiKey}`)
          ])

          const dataFr = await resFr.json()
          const dataEn = await resEn.json()

          titlesMap[drama.id] = {
            original: dataFr.original_name || drama.title,
            english: dataEn.name || dataEn.original_name || drama.title,
            french: dataFr.name || drama.title
          }
        } else {
          titlesMap[drama.id] = { original: drama.title, english: drama.title, french: drama.title }
        }
      } catch (err) {
        titlesMap[drama.id] = { original: drama.title, english: drama.title, french: drama.title }
      }
    }

    setTmdbTitlesMap(prev => ({ ...prev, ...titlesMap }))
  }

  const createSlug = (title) => {
    return title
      ? title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
      : ''
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

<<<<<<< HEAD
  // --- Logique d'ouverture et de sauvegarde de la modale ---
=======
>>>>>>> e3ad3735e4b56a518fb29c0536cfe1ff70d45a0f
  const openRuntimeModal = (drama, e) => {
    e.preventDefault()
    e.stopPropagation()
    setRuntimeDrama(drama)
    setRuntimeMode('average')
    
    const baseDuration = drama.episode_run_time || 0
    const h = baseDuration >= 60 ? Math.floor(baseDuration / 60).toString() : ''
    const m = baseDuration > 0 ? (baseDuration % 60).toString() : ''

    setAvgHours(h)
    setAvgMinutes(m)
    setTotalHours('')
    setTotalMinutes('')
    
    const episodesCount = drama.number_of_episodes || 1
    setIndividualRuntimes(Array(episodesCount).fill({ h, m }))
    
    setRuntimeModalOpen(true)
  }

  const closeRuntimeModal = () => {
    setRuntimeModalOpen(false)
    setRuntimeDrama(null)
  }

  const handleIndividualChange = (index, field, value) => {
    const newRuntimes = [...individualRuntimes]
    newRuntimes[index] = { ...newRuntimes[index], [field]: value }
    setIndividualRuntimes(newRuntimes)
  }

  const handleSaveRuntime = async () => {
    if (!runtimeDrama) return

    let calculatedRuntime = 0
    const episodesCount = runtimeDrama.number_of_episodes || 1

    if (runtimeMode === 'average') {
      const h = parseInt(avgHours, 10) || 0
      const m = parseInt(avgMinutes, 10) || 0
      calculatedRuntime = (h * 60) + m
    } else if (runtimeMode === 'individual') {
      const totalMins = individualRuntimes.reduce((acc, val) => {
        const h = parseInt(val.h, 10) || 0
        const m = parseInt(val.m, 10) || 0
        return acc + (h * 60) + m
      }, 0)
      calculatedRuntime = totalMins > 0 ? Math.round(totalMins / episodesCount) : 0
    } else {
      const hours = parseInt(totalHours, 10) || 0
      const minutes = parseInt(totalMinutes, 10) || 0
      const totalMins = (hours * 60) + minutes
      calculatedRuntime = Math.round(totalMins / episodesCount)
    }

    if (isNaN(calculatedRuntime) || calculatedRuntime <= 0) {
      alert("Veuillez entrer une durée valide.")
      return
    }

    const { error } = await supabase
      .from('dramas')
      .update({ episode_run_time: calculatedRuntime })
      .eq('id', runtimeDrama.id)

    if (error) {
      alert("Erreur lors de la mise à jour : " + error.message)
    } else {
      closeRuntimeModal()
      fetchDramas()
    }
  }

  const getDurationText = (episodes, runTime) => {
    if (!episodes) return null;
    if (!runTime) return `${episodes} épisode${episodes > 1 ? 's' : ''}`;
    
    const totalMinutes = episodes * runTime;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const durationStr = `${hours > 0 ? `${hours}h ` : ''}${minutes > 0 ? `${minutes}m` : ''}`.trim();
    
    return `${episodes} ép. • ${durationStr}`;
  };

  const processedDramas = dramas
    .filter((drama) => {
      if (!searchQuery) return true
      const titles = tmdbTitlesMap[drama.id]
      const query = searchQuery.toLowerCase()
<<<<<<< HEAD
      return (drama.title && drama.title.toLowerCase().includes(query)) || 
             (titles?.original && titles.original.toLowerCase().includes(query)) ||
             (titles?.english && titles.english.toLowerCase().includes(query)) ||
             (titles?.french && titles.french.toLowerCase().includes(query))
=======
      return drama.title.toLowerCase().includes(query) || 
             (titles?.original && titles.original.toLowerCase().includes(query)) ||
             (titles?.english && titles.english.toLowerCase().includes(query))
>>>>>>> e3ad3735e4b56a518fb29c0536cfe1ff70d45a0f
    })
    .sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.created_at) - new Date(a.created_at)
      if (sortBy === 'date_asc') return new Date(a.created_at) - new Date(b.created_at)
      if (sortBy === 'alpha_asc') return (a.title || '').localeCompare(b.title || '')
      if (sortBy === 'rating_desc') return (b.site_rating || 0) - (a.site_rating || 0)
      if (sortBy === 'personal_rating_desc') return (b.personal_rating || 0) - (a.personal_rating || 0)
      return 0
    })

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '3rem', fontSize: '1.2rem', color: '#fff' }}>Chargement de la bibliothèque...</div>
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
          {processedDramas.map((drama) => {
<<<<<<< HEAD
            const titles = tmdbTitlesMap[drama.id] || { original: drama.title, english: drama.title, french: drama.title }
            const englishTitle = titles.english
            const originalTitle = titles.original
            const frenchTitle = titles.french
=======
            const titles = tmdbTitlesMap[drama.id] || { original: drama.title, english: drama.title }
            const originalTitle = titles.original
            const englishTitle = titles.english
>>>>>>> e3ad3735e4b56a518fb29c0536cfe1ff70d45a0f

            return (
              <Link 
                key={drama.id} 
<<<<<<< HEAD
                to={`/drama/${createSlug(drama.title)}`}
=======
                to={`/drama/${createSlug(englishTitle)}`}
>>>>>>> e3ad3735e4b56a518fb29c0536cfe1ff70d45a0f
                className="drama-card" 
                style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}
              >
                {drama.poster_url ? (
                  <img src={drama.poster_url} alt={englishTitle} className="drama-poster" />
                ) : (
                  <div className="drama-poster" style={{ backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#c7d0ff' }}>Pas d'image</span>
                  </div>
                )}
                <div className="drama-info">
                  
                  {/* --- HIÉRARCHIE INVERSÉE : Titre Anglais en gros, Titre Original en dessous --- */}
                  <h4 className="drama-title" title={englishTitle} style={{ marginBottom: '0.1rem', fontSize: '1.1rem' }}>
                    {englishTitle}
                  </h4>
                  
<<<<<<< HEAD
                  <div style={{ fontSize: '0.85rem', color: '#a0a0a0', fontStyle: 'italic', marginBottom: '0.1rem' }}>
                    {originalTitle}
                  </div>
                  
                  {frenchTitle && frenchTitle !== englishTitle && frenchTitle !== originalTitle && (
                    <div style={{ fontSize: '0.75rem', color: '#777', marginBottom: '0.5rem' }}>
                      {frenchTitle}
                    </div>
                  )}

                  <div className="drama-genres" style={{ marginTop: '0.5rem' }}>{drama.genre || 'Aucun genre spécifié'}</div>
                  
                  {drama.number_of_episodes && (
                    <div 
                      onClick={(e) => e.stopPropagation()} 
                      style={{ fontSize: '0.85rem', color: '#a0a0a0', marginTop: '0.25rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}
                    >
                      ⏳ {getDurationText(drama.number_of_episodes, drama.episode_run_time)}
                      
                      <button 
                        onClick={(e) => openRuntimeModal(drama, e)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.75rem', padding: '0', textDecoration: 'underline', opacity: 0.8 }}
                      >
                        {drama.episode_run_time ? '(Éditer)' : '+ Ajouter durée'}
                      </button>
                    </div>
                  )}
                  
                  <div className="drama-ratings">
                    <span title="Note TMDB">TMDB : <span className="rating-badge">{drama.site_rating || '-'}</span></span>
                    <span title="Note VoirDrama">VD : <span className="rating-badge">{drama.voirdrama_rating || '-'}</span></span>
                  </div>

                  {status === 'Watched' && drama.personal_rating && (
                    <div className="panel-card" style={{ marginTop: '1rem', borderLeft: '4px solid var(--primary-color)', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span className="panel-label" style={{ margin: 0 }}>Ma Note</span>
                        <strong style={{ color: 'var(--primary-color)', fontSize: '1.1rem' }}>{drama.personal_rating} / 5</strong>
                      </div>
                      {drama.comment && (
                        <div style={{ fontSize: '0.9rem', color: '#ccc', fontStyle: 'italic', lineHeight: '1.4', marginTop: '0.5rem' }}>
                          "{drama.comment}"
                        </div>
                      )}
                    </div>
                  )}

=======
                  <div style={{ fontSize: '0.85rem', color: '#a0a0a0', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                    {originalTitle}
                  </div>

                  <div className="drama-genres" style={{ marginTop: '0.5rem' }}>{drama.genre || 'Aucun genre spécifié'}</div>
                  
                  {drama.number_of_episodes && (
                    <div 
                      onClick={(e) => e.stopPropagation()} 
                      style={{ fontSize: '0.85rem', color: '#a0a0a0', marginTop: '0.25rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}
                    >
                      ⏳ {getDurationText(drama.number_of_episodes, drama.episode_run_time)}
                      
                      <button 
                        onClick={(e) => openRuntimeModal(drama, e)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.75rem', padding: '0', textDecoration: 'underline', opacity: 0.8 }}
                      >
                        {drama.episode_run_time ? '(Éditer)' : '+ Ajouter durée'}
                      </button>
                    </div>
                  )}
                  
                  <div className="drama-ratings">
                    <span title="Note TMDB">TMDB : <span className="rating-badge">{drama.site_rating || '-'}</span></span>
                    <span title="Note VoirDrama">VD : <span className="rating-badge">{drama.voirdrama_rating || '-'}</span></span>
                  </div>

                  {status === 'Watched' && drama.personal_rating && (
                    <div className="panel-card" style={{ marginTop: '1rem', borderLeft: '4px solid var(--primary-color)', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span className="panel-label" style={{ margin: 0 }}>Ma Note</span>
                        <strong style={{ color: 'var(--primary-color)', fontSize: '1.1rem' }}>{drama.personal_rating} / 5</strong>
                      </div>
                      {drama.comment && (
                        <div style={{ fontSize: '0.9rem', color: '#ccc', fontStyle: 'italic', lineHeight: '1.4', marginTop: '0.5rem' }}>
                          "{drama.comment}"
                        </div>
                      )}
                    </div>
                  )}

>>>>>>> e3ad3735e4b56a518fb29c0536cfe1ff70d45a0f
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
<<<<<<< HEAD
                        <option value="Not Found">Streaming Introuvable</option>
=======
                        <option value="Not Found">Vidéos introuvables</option>
>>>>>>> e3ad3735e4b56a518fb29c0536cfe1ff70d45a0f
                        <option value="To Watch">À voir</option>
                        <option value="Watching">En cours</option>
                        <option value="Watched">Vu</option>
                      </select>
                    )}

                    <button 
                      onClick={(e) => handleDelete(drama.id, e)}
                      style={{ marginTop: '0.5rem', backgroundColor: 'transparent', border: '1px solid #d32f2f', color: '#d32f2f', padding: '0.5rem', fontSize: '0.9rem', width: '100%', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      Supprimer de la liste
                    </button>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* --- Boîte Modale de Durée --- */}
      {runtimeModalOpen && runtimeDrama && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)'
          }} 
          onClick={closeRuntimeModal}
        >
          <div 
            style={{
              background: 'var(--surface)', padding: '2rem', borderRadius: '24px',
              border: '1px solid var(--border-color)', width: '90%', maxWidth: '500px',
              boxShadow: '0 24px 80px rgba(0, 0, 0, 0.5)'
            }} 
            onClick={e => e.stopPropagation()} 
          >
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary-color)' }}>Modifier la durée</h3>
            <p style={{ margin: '0 0 1.5rem 0', color: 'var(--secondary-text)', fontSize: '0.9rem' }}>{runtimeDrama.title}</p>
            
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input 
                  type="radio" 
                  checked={runtimeMode === 'average'} 
                  onChange={() => setRuntimeMode('average')} 
                  style={{ width: 'auto', boxShadow: 'none' }}
                />
                Moyenne
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input 
                  type="radio" 
                  checked={runtimeMode === 'individual'} 
                  onChange={() => setRuntimeMode('individual')} 
                  style={{ width: 'auto', boxShadow: 'none' }}
                />
                Individuel
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input 
                  type="radio" 
                  checked={runtimeMode === 'total'} 
                  onChange={() => setRuntimeMode('total')} 
                  style={{ width: 'auto', boxShadow: 'none' }}
                />
                Total
              </label>
            </div>

            {runtimeMode === 'average' && (
              <div style={{ marginBottom: '2rem' }}>
                <label className="panel-label">Durée moyenne d'un épisode</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={avgHours} 
                      onChange={e => setAvgHours(e.target.value)} 
                      placeholder="Heures" 
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={avgMinutes} 
                      onChange={e => setAvgMinutes(e.target.value)} 
                      placeholder="Minutes" 
                    />
                  </div>
                </div>
<<<<<<< HEAD
                <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.75rem', fontStyle: 'italic' }}>
                  S'appliquera uniformément aux {runtimeDrama.number_of_episodes || 1} épisodes.
                </p>
=======
>>>>>>> e3ad3735e4b56a518fb29c0536cfe1ff70d45a0f
              </div>
            )}

            {runtimeMode === 'individual' && (
              <div style={{ marginBottom: '2rem' }}>
                <label className="panel-label" style={{ marginBottom: '0.5rem' }}>Durée de chaque épisode</label>
                <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {individualRuntimes.map((duration, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: '#ccc', width: '45px' }}>Ép. {index + 1}</span>
                      <input 
                        type="number" 
                        className="input-field" 
                        style={{ padding: '0.4rem', fontSize: '0.9rem', flex: 1 }} 
                        value={duration.h} 
                        onChange={e => handleIndividualChange(index, 'h', e.target.value)} 
                        placeholder="Heures"
                      />
                      <input 
                        type="number" 
                        className="input-field" 
                        style={{ padding: '0.4rem', fontSize: '0.9rem', flex: 1 }} 
                        value={duration.m} 
                        onChange={e => handleIndividualChange(index, 'm', e.target.value)} 
                        placeholder="Minutes"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {runtimeMode === 'total' && (
              <div style={{ marginBottom: '2rem' }}>
                <label className="panel-label">Durée totale de la série</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={totalHours} 
                      onChange={e => setTotalHours(e.target.value)} 
                      placeholder="Heures" 
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={totalMinutes} 
                      onChange={e => setTotalMinutes(e.target.value)} 
                      placeholder="Minutes" 
                    />
                  </div>
                </div>
<<<<<<< HEAD
                <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.75rem', fontStyle: 'italic' }}>
                  Sera divisé par les {runtimeDrama.number_of_episodes || 1} épisodes pour calculer la moyenne.
                </p>
=======
>>>>>>> e3ad3735e4b56a518fb29c0536cfe1ff70d45a0f
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="primary-btn" onClick={handleSaveRuntime} style={{ flex: 1 }}>
                Enregistrer
              </button>
              <button className="secondary-btn" onClick={closeRuntimeModal} style={{ flex: 1 }}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}