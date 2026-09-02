import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { translateLongText } from './translationService'

export default function DramaList({ session, status }) {
  const [dramas, setDramas] = useState([])
  const [loading, setLoading] = useState(true)
  
  // État pour stocker les données dynamiques TMDB (titres + statut)
  const [tmdbDataMap, setTmdbDataMap] = useState({})

  const [reviewingId, setReviewingId] = useState(null)
  const [reviewRating, setReviewRating] = useState('')
  const [reviewComment, setReviewComment] = useState('')

  // --- États pour la boîte modale de durée ---
  const [runtimeModalOpen, setRuntimeModalOpen] = useState(false)
  const [runtimeDrama, setRuntimeDrama] = useState(null)
  const [runtimeMode, setRuntimeMode] = useState('average')
  
  const [avgHours, setAvgHours] = useState('')
  const [avgMinutes, setAvgMinutes] = useState('')
  const [totalHours, setTotalHours] = useState('')
  const [totalMinutes, setTotalMinutes] = useState('')
  const [individualRuntimes, setIndividualRuntimes] = useState([]) 

  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState(status === 'Watched' ? 'personal_rating_desc' : 'tmdb_desc')
  const navigate = useNavigate()

  useEffect(() => {
    fetchDramas()
  }, [session, status]) 

  useEffect(() => {
    setSortBy(status === 'Watched' ? 'personal_rating_desc' : 'tmdb_desc')
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
    } else {
      const dramasList = data || []
      setDramas(dramasList)
      // On lance la récupération TMDB en arrière-plan (Titres + Statut en temps réel)
      fetchTmdbDataAsync(dramasList)
    }
    
    setLoading(false)
  }

  // --- Fonction pour interroger TMDB (Titres multi-langues avec fallback traduction identique à DramaDetail) ---
  const fetchTmdbDataAsync = async (dramasArray) => {
    const apiKey = import.meta.env.VITE_TMDB_API_KEY
    if (!apiKey) return

    const fetchedMap = {}

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

          const enTitle = dataEn.name || dataEn.original_name || drama.title
          const origTitle = dataFr.original_name || drama.title
          let frTitle = dataFr.name

          // Même logique exacte que dans DramaDetail pour forcer la traduction française si absente ou non traduite
          if (!frTitle || frTitle === enTitle || frTitle === origTitle) {
            const textToTranslate = enTitle || origTitle
            if (textToTranslate) {
              const forcedFr = await translateLongText(textToTranslate)
              if (forcedFr) {
                frTitle = forcedFr
              }
            }
          }

          fetchedMap[drama.id] = {
            original: origTitle,
            english: enTitle,
            french: frTitle || enTitle,
            status: dataFr.status
          }
        } else {
          fetchedMap[drama.id] = { original: drama.title, english: drama.title, french: drama.title, status: drama.tmdb_status }
        }
      } catch (err) {
        fetchedMap[drama.id] = { original: drama.title, english: drama.title, french: drama.title, status: drama.tmdb_status }
      }
    }

    setTmdbDataMap(prev => ({ ...prev, ...fetchedMap }))
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
        
      if (!error) fetchDramas()
      else alert("Erreur lors du changement de statut : " + error.message)
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
      .update({ status: 'Watched', personal_rating: reviewRating, comment: reviewComment })
      .eq('id', id)
      
    if (error) alert("Erreur lors de la mise à jour : " + error.message)
    else { setReviewingId(null); fetchDramas() }
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

    const { error } = await supabase.from('dramas').delete().eq('id', id)
    if (error) alert("Erreur lors de la suppression : " + error.message)
    else setDramas(dramas.filter(drama => drama.id !== id))
  }

  const openRuntimeModal = (drama, e) => {
    e.preventDefault()
    e.stopPropagation()
    setRuntimeDrama(drama)
    setRuntimeMode('average')
    
    const baseDuration = drama.episode_run_time || 0
    const h = baseDuration >= 60 ? Math.floor(baseDuration / 60).toString() : ''
    const m = baseDuration > 0 ? (baseDuration % 60).toString() : ''

    setAvgHours(h); setAvgMinutes(m); setTotalHours(''); setTotalMinutes('');
    setIndividualRuntimes(Array(drama.number_of_episodes || 1).fill({ h, m }))
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
      calculatedRuntime = ((parseInt(avgHours, 10) || 0) * 60) + (parseInt(avgMinutes, 10) || 0)
    } else if (runtimeMode === 'individual') {
      const totalMins = individualRuntimes.reduce((acc, val) => acc + ((parseInt(val.h, 10) || 0) * 60) + (parseInt(val.m, 10) || 0), 0)
      calculatedRuntime = totalMins > 0 ? Math.round(totalMins / episodesCount) : 0
    } else {
      const totalMins = ((parseInt(totalHours, 10) || 0) * 60) + (parseInt(totalMinutes, 10) || 0)
      calculatedRuntime = Math.round(totalMins / episodesCount)
    }

    if (isNaN(calculatedRuntime) || calculatedRuntime <= 0) return alert("Veuillez entrer une durée valide.")

    const { error } = await supabase.from('dramas').update({ episode_run_time: calculatedRuntime }).eq('id', runtimeDrama.id)
    if (!error) { closeRuntimeModal(); fetchDramas() }
  }

  const getDurationText = (episodes, runTime) => {
    if (!episodes || !runTime) return 'Inconnue';
    const totalMinutes = episodes * runTime;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const hStr = hours > 0 ? `${hours}H` : '';
    const mStr = minutes > 0 ? `${minutes}M` : '';
    return `${hStr} ${mStr}`.trim();
  };

  const processedDramas = dramas
    .filter((drama) => {
      if (!searchQuery) return true
      const tmdbInfo = tmdbDataMap[drama.id]
      const query = searchQuery.toLowerCase()
      return (drama.title && drama.title.toLowerCase().includes(query)) || 
             (tmdbInfo?.original && tmdbInfo.original.toLowerCase().includes(query)) ||
             (tmdbInfo?.english && tmdbInfo.english.toLowerCase().includes(query)) ||
             (tmdbInfo?.french && tmdbInfo.french.toLowerCase().includes(query))
    })
    .sort((a, b) => {
      const infoA = tmdbDataMap[a.id] || {}
      const infoB = tmdbDataMap[b.id] || {}

      if (sortBy === 'tmdb_desc') return (b.site_rating || 0) - (a.site_rating || 0)
      if (sortBy === 'tmdb_asc') return (a.site_rating || 0) - (b.site_rating || 0)
      
      if (sortBy === 'voirdrama_desc') return (b.voirdrama_rating || 0) - (a.voirdrama_rating || 0)
      if (sortBy === 'voirdrama_asc') return (a.voirdrama_rating || 0) - (b.voirdrama_rating || 0)
      
      if (sortBy === 'air_date_desc') return new Date(b.first_air_date || 0) - new Date(a.first_air_date || 0)
      if (sortBy === 'air_date_asc') return new Date(a.first_air_date || 0) - new Date(b.first_air_date || 0)
      
      if (sortBy === 'date_desc') return new Date(b.created_at) - new Date(a.created_at)
      if (sortBy === 'date_asc') return new Date(a.created_at) - new Date(b.created_at)
      
      if (sortBy === 'status_ended') {
        const endedA = ['Ended', 'Canceled', 'Terminée', 'Annulée'].includes(infoA.status) ? 1 : 0;
        const endedB = ['Ended', 'Canceled', 'Terminée', 'Annulée'].includes(infoB.status) ? 1 : 0;
        return endedB - endedA;
      }
      if (sortBy === 'status_ongoing') {
        const ongoingA = ['Returning Series', 'In Production', 'De retour', 'En production', 'Pilot', 'Pilote'].includes(infoA.status) ? 1 : 0;
        const ongoingB = ['Returning Series', 'In Production', 'De retour', 'En production', 'Pilot', 'Pilote'].includes(infoB.status) ? 1 : 0;
        return ongoingB - ongoingA;
      }

      if (sortBy === 'personal_rating_desc') return (b.personal_rating || 0) - (a.personal_rating || 0)
      return 0
    })

  if (loading) return <div style={{ textAlign: 'center', marginTop: '3rem', fontSize: '1.2rem', color: '#fff' }}>Chargement de la bibliothèque...</div>
  if (dramas.length === 0) return <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--secondary-text)', fontSize: '1.2rem' }}>Aucune série trouvée dans cette catégorie.</div>

  return (
    <div style={{ width: '100%' }}>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', backgroundColor: 'rgba(255, 255, 255, 0.04)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <input type="text" placeholder="Rechercher une série..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="input-field" style={{ flex: '1', minWidth: '250px', margin: 0 }} />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="status-select" style={{ width: 'auto', minWidth: '260px', margin: 0 }}>
          <option value="tmdb_desc">1 - Note TMDB Décroissante</option>
          <option value="tmdb_asc">2 - Note TMDB Croissante</option>
          <option value="voirdrama_desc">3 - Note VoirDrama Décroissante</option>
          <option value="voirdrama_asc">4 - Note VoirDrama Croissante</option>
          <option value="air_date_desc">5 - Date de sortie Récent</option>
          <option value="air_date_asc">6 - Date de sortie Ancien</option>
          <option value="date_desc">7 - Date d'ajout Récent</option>
          <option value="date_asc">8 - Date d'ajout ancien</option>
          <option value="status_ended">9 - Par série terminée</option>
          <option value="status_ongoing">10 - Par série en cours de production</option>
          {status === 'Watched' && <option value="personal_rating_desc">Ma note (Décroissante)</option>}
        </select>
      </div>

      <div className="drama-grid">
        {processedDramas.map((drama) => {
          const tmdbInfo = tmdbDataMap[drama.id]
          const isLoadingStatus = !tmdbInfo
          const englishTitle = tmdbInfo?.english || drama.title
          const originalTitle = tmdbInfo?.original || drama.title
          const frenchTitle = tmdbInfo?.french || drama.title
          const isEnded = tmdbInfo ? ['Ended', 'Canceled', 'Terminée', 'Annulée'].includes(tmdbInfo.status) : false

          return (
            <Link 
              key={drama.id} 
              to={`/drama/${createSlug(drama.title)}`}
              className="drama-card" 
            >
              <div className="poster-wrapper">
                {drama.poster_url ? (
                  <img src={drama.poster_url} alt={englishTitle} className="drama-poster" />
                ) : (
                  <div className="drama-poster" style={{ backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#c7d0ff' }}>Pas d'image</span>
                  </div>
                )}
                
                <div 
                  className="card-action-btn card-action-left" 
                  title={isLoadingStatus ? "Chargement du statut..." : (isEnded ? "Série terminée" : "En cours de production")}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                >
                  {isLoadingStatus ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                    </svg>
                  ) : isEnded ? (
                    <svg width="23" height="15" viewBox="0 0 23 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M15.8565 6.36375L13.2315 8.98875L16.9703 12.7275L14.8493 14.8492L11.1105 11.1105L7.371 14.8492L5.25 12.7282L8.98875 8.9895L6.36375 6.3645L4.24275 8.4855L0 4.24275L4.24275 0L11.1105 6.86775L17.9783 0L22.221 4.24275L17.9783 8.4855L15.8565 6.36375Z" fill="currentColor"/>
                    </svg>
                  ) : (
                    <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6.5 4H4.7C6.2 2.7 8 2 10 2C10.3 2 10.6 2 10.9 2.1C11.4 2.2 11.9 1.8 12 1.2C12.1 0.7 11.7 0.2 11.1 0.0999999C10.7 -9.68576e-08 10.4 0 10 0C7.6 0 5.3 0.9 3.5 2.4V1C3.5 0.4 3.1 0 2.5 0C1.9 0 1.5 0.4 1.5 1V5C1.5 5.6 1.9 6 2.5 6H6.5C7.1 6 7.5 5.6 7.5 5C7.5 4.4 7.1 4 6.5 4ZM5 12.5C4.4 12.5 4 12.9 4 13.5V15.3C2.7 13.8 2 12 2 10C2 9.7 2 9.4 2.1 9.1C2.2 8.6 1.8 8.1 1.2 8C0.7 7.9 0.2 8.3 0.0999999 8.9C-9.68575e-08 9.3 0 9.6 0 10C0 12.4 0.9 14.7 2.4 16.5H1C0.4 16.5 0 16.9 0 17.5C0 18.1 0.4 18.5 1 18.5H5C5.3 18.5 5.6 18.3 5.8 18.1C5.8 18 5.9 17.9 5.9 17.8C5.9 17.7 5.9 17.7 5.9 17.6V17.5V13.5C6 12.9 5.6 12.5 5 12.5ZM19 3.5C19.6 3.5 20 3.1 20 2.5C20 1.9 19.6 1.5 19 1.5H15C14.9 1.5 14.9 1.5 14.8 1.5C14.7 1.5 14.6 1.6 14.5 1.6C14.4 1.7 14.3 1.7 14.3 1.8C14.3 1.9 14.2 2 14.2 2C14.2 2.1 14.2 2.1 14.2 2.2V2.3V6.3C14.2 6.9 14.6 7.3 15.2 7.3C15.8 7.3 16.2 6.9 16.2 6.3V4.7C17.5 6.1 18.2 8 18.2 10C18.2 10.3 18.2 10.6 18.1 10.9C18 11.4 18.4 11.9 19 12H19.1C19.6 12 20 11.6 20.1 11.1C20.1 10.7 20.2 10.4 20.2 10C20.2 7.6 19.3 5.3 17.8 3.5H19ZM18.3 14.5C18.2 14.4 18.1 14.3 18 14.2C17.9 14.1 17.8 14.1 17.7 14.1H17.6H17.5H13.5C12.9 14.1 12.5 14.5 12.5 15.1C12.5 15.7 12.9 16.1 13.5 16.1H15.3C13.9 17.4 12 18.1 10 18.1C9.7 18.1 9.4 18.1 9.1 18C8.6 17.9 8.1 18.3 8 18.9C7.9 19.5 8.3 19.9 8.9 20C9.3 20 9.6 20.1 10 20.1C12.4 20.1 14.7 19.2 16.5 17.7V19C16.5 19.6 16.9 20 17.5 20C18.1 20 18.5 19.6 18.5 19V15C18.5 14.8 18.4 14.6 18.3 14.5Z" fill="currentColor"/>
                    </svg>
                  )}
                </div>

                <button 
                  className="card-action-btn card-action-right" 
                  title="Supprimer" 
                  onClick={(e) => handleDelete(drama.id, e)}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              </div>

              <div className="drama-info">
                
                {/* 1. TITRE EN ANGLAIS */}
                <h4 className="drama-title-en" title={englishTitle}>
                  {englishTitle}
                </h4>
                
                {/* 2. TITRE EN VERSION ORIGINALE */}
                <div className="drama-title-orig">
                  {originalTitle}
                </div>
                
                {/* 3. TITRE EN FRANÇAIS */}
                <div style={{ fontSize: '0.78rem', color: '#c7d0ff', fontStyle: 'italic', opacity: 0.9, marginTop: '2px' }}>
                  {frenchTitle && frenchTitle !== englishTitle ? `FR : ${frenchTitle}` : `FR : ${englishTitle}`}
                </div>

                <div className="drama-genres">{drama.genre || 'Aucun genre spécifié'}</div>
                
                {/* --- TOUT CE QUI SUIT EST POUSSÉ TOUT EN BAS DE LA CARTE --- */}
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', width: '100%' }}>
                  
                  <div className="drama-meta-row">
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                      <span style={{ fontSize: '1.25rem', lineHeight: '1' }}>📑</span>
                      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                        <strong style={{ color: '#fff', fontSize: '0.9rem' }}>
                          {drama.number_of_seasons ? `${drama.number_of_seasons} Saison${drama.number_of_seasons > 1 ? 's' : ''}` : '? Saison'}
                        </strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                          {drama.number_of_episodes ? `${drama.number_of_episodes} épisodes` : '? épisodes'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                      <span style={{ fontSize: '1.25rem', lineHeight: '1' }}>⏳</span>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: '1.2' }}>
                        <strong style={{ color: '#fff', fontSize: '0.9rem' }}>
                          {getDurationText(drama.number_of_episodes, drama.episode_run_time)}
                        </strong>
                        <button 
                          onClick={(e) => openRuntimeModal(drama, e)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', padding: 0, marginTop: '0.2rem', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          (édité)
                        </button>
                      </div>
                    </div>
                  </div>

                  <hr className="card-divider" />
                  
                  <div className="drama-ratings-row">
                    <span>TMDB : <strong>{drama.site_rating || '-'}</strong></span>
                    <span>VD : <strong>{drama.voirdrama_rating || '-'}</strong></span>
                  </div>

                  {status === 'Watched' && drama.personal_rating && (
                    <div className="panel-card" style={{ marginTop: '0.5rem', marginBottom: '1rem', borderLeft: '4px solid var(--primary-color)', padding: '1rem', minHeight: '125px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', boxSizing: 'border-box' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span className="panel-label" style={{ margin: 0 }}>Ma Note</span>
                        <strong style={{ color: 'var(--primary-color)', fontSize: '1.1rem' }}>{drama.personal_rating} / 5</strong>
                      </div>
                      {drama.comment ? (
                        <Link 
                          to={`/drama/${createSlug(drama.title)}`}
                          style={{ display: 'block', fontSize: '0.9rem', color: '#ccc', fontStyle: 'italic', lineHeight: '1.4', marginTop: '0.5rem', textDecoration: 'none' }}
                          title="Cliquez pour lire le commentaire en entier"
                        >
                          "{drama.comment.length > 90 ? `${drama.comment.substring(0, 90)}... ` : drama.comment}"
                          {drama.comment.length > 90 && (
                            <span style={{ color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 'bold' }}> Lire plus</span>
                          )}
                        </Link>
                      ) : (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.5rem' }}>
                          Aucun commentaire.
                        </div>
                      )}
                    </div>
                  )}

                  <div onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
                    {reviewingId === drama.id ? (
                      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: '#1a1a1a', padding: '0.8rem', borderRadius: '8px' }}>
                        <input type="number" step="0.1" max="5" placeholder="Note (/5) *" value={reviewRating} onChange={(e) => setReviewRating(e.target.value)} onClick={(e) => e.preventDefault()} style={{ padding: '0.5rem', fontSize: '0.9rem' }} />
                        <textarea placeholder="Commentaire (optionnel)" value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} onClick={(e) => e.preventDefault()} style={{ minHeight: '50px', padding: '0.5rem', fontSize: '0.9rem' }} />
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
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      >
                        <option value="Not Found">Streaming Introuvable</option>
                        <option value="To Watch">À voir</option>
                        <option value="Watching">En cours</option>
                        <option value="Watched">Vu</option>
                      </select>
                    )}
                  </div>

                </div>

              </div>
            </Link>
          )
        })}
      </div>

      {/* --- Boîte Modale de Durée --- */}
      {runtimeModalOpen && runtimeDrama && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }} onClick={closeRuntimeModal}>
          <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)', width: '90%', maxWidth: '500px', boxShadow: '0 24px 80px rgba(0, 0, 0, 0.5)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary-color)' }}>Modifier la durée</h3>
            <p style={{ margin: '0 0 1.5rem 0', color: 'var(--secondary-text)', fontSize: '0.9rem' }}>{runtimeDrama.title}</p>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}><input type="radio" checked={runtimeMode === 'average'} onChange={() => setRuntimeMode('average')} style={{ width: 'auto', boxShadow: 'none' }} />Moyenne</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}><input type="radio" checked={runtimeMode === 'individual'} onChange={() => setRuntimeMode('individual')} style={{ width: 'auto', boxShadow: 'none' }} />Individuel</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}><input type="radio" checked={runtimeMode === 'total'} onChange={() => setRuntimeMode('total')} style={{ width: 'auto', boxShadow: 'none' }} />Total</label>
            </div>

            {runtimeMode === 'average' && (
              <div style={{ marginBottom: '2rem' }}>
                <label className="panel-label">Durée moyenne d'un épisode</label>
                <div style={{ display: 'flex', gap: '1rem' }}><div style={{ flex: 1 }}><input type="number" className="input-field" value={avgHours} onChange={e => setAvgHours(e.target.value)} placeholder="Heures" /></div><div style={{ flex: 1 }}><input type="number" className="input-field" value={avgMinutes} onChange={e => setAvgMinutes(e.target.value)} placeholder="Minutes" /></div></div>
              </div>
            )}

            {runtimeMode === 'individual' && (
              <div style={{ marginBottom: '2rem' }}>
                <label className="panel-label" style={{ marginBottom: '0.5rem' }}>Durée de chaque épisode</label>
                <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {individualRuntimes.map((duration, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: '#ccc', width: '45px' }}>Ép. {index + 1}</span>
                      <input type="number" className="input-field" style={{ padding: '0.4rem', fontSize: '0.9rem', flex: 1 }} value={duration.h} onChange={e => handleIndividualChange(index, 'h', e.target.value)} placeholder="Heures" />
                      <input type="number" className="input-field" style={{ padding: '0.4rem', fontSize: '0.9rem', flex: 1 }} value={duration.m} onChange={e => handleIndividualChange(index, 'm', e.target.value)} placeholder="Minutes" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {runtimeMode === 'total' && (
              <div style={{ marginBottom: '2rem' }}>
                <label className="panel-label">Durée totale de la série</label>
                <div style={{ display: 'flex', gap: '1rem' }}><div style={{ flex: 1 }}><input type="number" className="input-field" value={totalHours} onChange={e => totalHours(e.target.value)} placeholder="Heures" /></div><div style={{ flex: 1 }}><input type="number" className="input-field" value={totalMinutes} onChange={e => setTotalMinutes(e.target.value)} placeholder="Minutes" /></div></div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="primary-btn" onClick={handleSaveRuntime} style={{ flex: 1 }}>Enregistrer</button>
              <button className="secondary-btn" onClick={closeRuntimeModal} style={{ flex: 1 }}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}