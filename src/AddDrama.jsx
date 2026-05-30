import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import { translateLongText } from './translationService'

export default function AddDrama({ session }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [translationProgress, setTranslationProgress] = useState(0)

  const [title, setTitle] = useState('')
  const [posterUrl, setPosterUrl] = useState('')
  const [selectedGenres, setSelectedGenres] = useState([])
  const [apiGenres, setApiGenres] = useState([])
  const [siteRating, setSiteRating] = useState('')
  const [voirDramaRating, setVoirDramaRating] = useState('')
  const [synopsis, setSynopsis] = useState('')
  const [status, setStatus] = useState('To Watch')
  const [selectedDramaDetails, setSelectedDramaDetails] = useState(null)
  const [addingDrama, setAddingDrama] = useState(false)
  const [addMessage, setAddMessage] = useState('')
  
  const [personalRating, setPersonalRating] = useState('')
  const [comment, setComment] = useState('')
  
  const [loading, setLoading] = useState(false)

  const synopsisRef = useRef(null)

  const [availableGenres, setAvailableGenres] = useState([
    'Action', 'Affaire', 'Amitié', 'Arts Martiaux', 'Aventure', 'BL', 'Comédie',
    'Contexte Scolaire', 'Crime', 'Culinaire', 'Documentaire', 'Drame', 'Famille',
    'Fantastique', 'Guerre', 'Historique', 'Horreur', 'Jeunesse', 'Judiciaire',
    'Mature', 'Médical', 'Mélodrame', 'Militaire', 'Musique', 'Mystère', 'Politique',
    'Psychologique', 'Romance', 'SF', 'Sitcom', 'Sport', 'Surnaturel', 'Thriller',
    'Tokasatsu', 'Vie Quotidienne', 'Wuxia', 'Yuri'
  ])

  useEffect(() => {
    if (synopsisRef.current) {
      synopsisRef.current.style.height = 'auto'
      synopsisRef.current.style.height = `${synopsisRef.current.scrollHeight}px`
    }
  }, [synopsis])

  const normalizeGenres = (genresList) => {
    const genreMapping = {
      'Action & Adventure': ['Action', 'Aventure'],
      'Science-Fiction & Fantastique': ['SF', 'Fantastique'],
      'Sci-Fi & Fantasy': ['SF', 'Fantastique'],
      'Familial': ['Famille'],
      'Kids': ['Jeunesse'],
      'War & Politics': ['Guerre', 'Politique']
    }

    let normalized = []
    genresList.forEach(g => {
      if (genreMapping[g]) {
        normalized.push(...genreMapping[g])
      } else {
        normalized.push(g)
      }
    })
    return normalized
  }

  const getLatinText = (originalText, fallbackText) => {
    const latinPattern = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 .,'\-()]+$/
    if (!originalText) return fallbackText || ''
    if (latinPattern.test(originalText)) return originalText
    return fallbackText || originalText
  }

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const apiKey = import.meta.env.VITE_TMDB_API_KEY
        if (!apiKey) return

        const response = await fetch(`https://api.themoviedb.org/3/genre/tv/list?language=fr-FR&api_key=${apiKey}`)
        const data = await response.json()

        if (data.genres) {
          const tmdbGenres = data.genres.map(g => g.name)
          const normalizedTmdbGenres = normalizeGenres(tmdbGenres)
          
          setAvailableGenres(prevGenres => {
            const combined = new Set([...prevGenres, ...normalizedTmdbGenres])
            return Array.from(combined).sort((a, b) => a.localeCompare(b, 'fr'))
          })
        }
      } catch (error) {
        console.error("Erreur de récupération des genres", error)
      }
    }
    
    fetchGenres()
  }, [])

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim() !== '') {
        executeSearch(searchQuery)
      } else {
        setSearchResults([])
      }
    }, 500)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery])

  const executeSearch = async (query) => {
    setIsSearching(true)
    const apiKey = import.meta.env.VITE_TMDB_API_KEY
    
    try {
      const [responseFr, responseEn] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(query)}&language=fr-FR&api_key=${apiKey}`),
        fetch(`https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(query)}&language=en-US&api_key=${apiKey}`)
      ])
      
      const dataFr = await responseFr.json()
      const dataEn = await responseEn.json()
      
      const mergedResults = (dataFr.results || []).map(frItem => {
        const enItem = (dataEn.results || []).find(item => item.id === frItem.id)
        const isAsian = ['zh', 'ko', 'ja', 'th'].includes(frItem.original_language)
        const isUntranslated = isAsian && frItem.name === frItem.original_name
        const displayName = isUntranslated && enItem ? enItem.name : frItem.name
        
        return {
          ...frItem,
          displayName: displayName
        }
      })
      
      setSearchResults(mergedResults)
    } catch (error) {
      console.error("Erreur lors de la recherche", error)
    } finally {
      setIsSearching(false)
    }
  }

  const translateLanguageCode = (code) => {
    const languageMap = {
      en: 'Anglais',
      fr: 'Français',
      ja: 'Japonais',
      ko: 'Coréen',
      zh: 'Chinois',
      es: 'Espagnol',
      de: 'Allemand',
      it: 'Italien',
      pt: 'Portugais',
      ru: 'Russe',
      th: 'Thaïlandais',
      vi: 'Vietnamien'
    }
    return languageMap[code] || code || 'Inconnue'
  }

  const translateStatus = (status) => {
    const statusMap = {
      Ended: 'Terminé',
      'Returning Series': 'En cours de diffusion',
      Canceled: 'Annulé',
      'In Production': 'En production',
      Pilot: 'Pilote'
    }
    return statusMap[status] || status || 'Inconnu'
  }

  const toggleGenre = (genreName) => {
    if (apiGenres.includes(genreName)) return

    if (selectedGenres.includes(genreName)) {
      setSelectedGenres(selectedGenres.filter(g => g !== genreName))
    } else {
      setSelectedGenres([...selectedGenres, genreName])
    }
  }

  const selectDrama = async (dramaId, selectedTitle) => {
    setIsSearching(true)
    const apiKey = import.meta.env.VITE_TMDB_API_KEY

    try {
      const [responseFr, responseEn] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/tv/${dramaId}?language=fr-FR&append_to_response=credits,watch/providers&api_key=${apiKey}`),
        fetch(`https://api.themoviedb.org/3/tv/${dramaId}?language=en-US&append_to_response=credits,watch/providers&api_key=${apiKey}`)
      ])

      const dataFr = await responseFr.json()
      const dataEn = await responseEn.json()

      const displayName = getLatinText(dataFr.name || dataFr.original_name, dataEn?.name || dataEn?.original_name || dataFr.original_name)
      const displayOriginalName = getLatinText(dataFr.original_name, dataEn?.original_name || dataFr.name)
      const frOverview = dataFr.overview
      const enOverview = dataEn?.overview
      let currentSynopsis = ''

      if (frOverview && enOverview && frOverview.trim() === enOverview.trim()) {
        currentSynopsis = await translateLongText(enOverview)
      } else if (frOverview) {
        currentSynopsis = frOverview
      } else if (enOverview) {
        currentSynopsis = await translateLongText(enOverview)
      }

      const getWatchProviders = (data) => {
        if (!data?.['watch/providers']?.results?.FR) return []
        const frProviders = data['watch/providers'].results.FR
        const flatrate = frProviders.flatrate || []
        const free = frProviders.free || []
        const allProviders = [...flatrate, ...free]
        return Array.from(new Map(allProviders.map(item => [item.provider_id, item])).values())
      }

      setSelectedDramaDetails({
        id: dramaId,
        displayName,
        displayOriginalName,
        status: translateStatus(dataFr.status),
        first_air_date: dataFr.first_air_date,
        number_of_episodes: dataFr.number_of_episodes,
        number_of_seasons: dataFr.number_of_seasons,
        vote_average: dataFr.vote_average,
        original_language: dataFr.original_language,
        genres: dataFr.genres || [],
        displayOverview: currentSynopsis,
        poster_path: dataFr.poster_path,
        overview: dataFr.overview || dataEn.overview || '',
        name: dataFr.name,
        original_name: dataFr.original_name,
        cast_list: dataFr.credits?.cast?.slice(0, 15) || [],
        watch_providers: getWatchProviders(dataFr),
        episode_run_time: dataFr.episode_run_time?.[0] || null
      })

      setSearchResults([])
      setSearchQuery('')
    } catch (error) {
      console.error('Erreur lors de la sélection du drama', error)
    }

    setIsSearching(false)
  }

  const handleBackToSearch = () => {
    setSelectedDramaDetails(null)
    setAddMessage('')
  }

  const addSelectedDramaToList = async () => {
    if (!selectedDramaDetails) return
    setAddingDrama(true)
    setAddMessage('')

    try {
      const { data: authData } = await supabase.auth.getSession()
      const userId = authData?.session?.user?.id
      if (!userId) {
        setAddMessage('Utilisateur non connecté.')
        setAddingDrama(false)
        return
      }

      const title = selectedDramaDetails.displayName || selectedDramaDetails.name || selectedDramaDetails.original_name || 'Titre inconnu'
      const { data: existing, error: existError } = await supabase
        .from('dramas')
        .select('id')
        .eq('user_id', userId)
        .eq('title', title)
        .limit(1)

      if (existError) {
        console.error('Erreur lors de la vérification du drama existant', existError)
        setAddMessage('Impossible de vérifier si le drama existe déjà.')
        setAddingDrama(false)
        return
      }

      if (existing?.length > 0) {
        setAddMessage('Ce drama est déjà présent dans votre liste.')
        setAddingDrama(false)
        return
      }

      const genreString = selectedDramaDetails.genres?.map((genre) => genre.name).join(', ') || ''
      const posterUrl = selectedDramaDetails.poster_path ? `https://image.tmdb.org/t/p/w500${selectedDramaDetails.poster_path}` : null
      const siteRating = selectedDramaDetails.vote_average ? parseFloat(selectedDramaDetails.vote_average.toFixed(1)) : null

      const { error: insertError } = await supabase.from('dramas').insert([
        {
          title,
          genre: genreString,
          site_rating: siteRating || null,
          voirdrama_rating: voirDramaRating || null,
          personal_rating: null,
          comment: null,
          synopsis: selectedDramaDetails.displayOverview || selectedDramaDetails.overview || '',
          status: 'To Watch',
          poster_url: posterUrl,
          user_id: userId,
          tmdb_id: selectedDramaDetails.id,
          tmdb_status: selectedDramaDetails.status || null,
          first_air_date: selectedDramaDetails.first_air_date || null,
          number_of_seasons: selectedDramaDetails.number_of_seasons || null,
          number_of_episodes: selectedDramaDetails.number_of_episodes || null,
          episode_run_time: selectedDramaDetails.episode_run_time || null,
          cast_list: selectedDramaDetails.cast_list || [],
          watch_providers: selectedDramaDetails.watch_providers || []
        }
      ])

      if (insertError) {
        console.error('Erreur lors de l ajout du drama', insertError)
        setAddMessage('Erreur lors de l’ajout à la liste.')
      } else {
        setAddMessage('Drama ajouté à la liste À voir.')
      }
    } catch (error) {
      console.error('Erreur lors de l ajout du drama', error)
      setAddMessage('Erreur lors de l’ajout à la liste.')
    }

    setAddingDrama(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (status === 'Watched' && !personalRating) {
      alert("La note personnelle est obligatoire pour une série vue.")
      return
    }

    setLoading(true)

    const finalGenres = selectedGenres.join(', ')

    const { error } = await supabase
      .from('dramas')
      .insert([
        {
          title,
          genre: finalGenres,
          site_rating: siteRating || null,
          voirdrama_rating: voirDramaRating || null,
          personal_rating: status === 'Watched' ? personalRating : null,
          comment: status === 'Watched' ? comment : null,
          synopsis,
          status,
          poster_url: posterUrl,
          user_id: session.user.id,
          tmdb_status: null,
          first_air_date: null,
          number_of_seasons: null,
          number_of_episodes: null,
          episode_run_time: null,
          cast_list: null,
          watch_providers: null
        }
      ])

    if (error) {
      alert(error.message)
    } else {
      alert('Série ajoutée avec succès.')
      setTitle('')
      setPosterUrl('')
      setSelectedGenres([])
      setApiGenres([])
      setSiteRating('')
      setVoirDramaRating('')
      setPersonalRating('')
      setComment('')
      setSynopsis('')
      setStatus('To Watch')
      setSelectedDramaDetails(null)
    }
    setLoading(false)
  }

  return (
    <div className="form-container">
      <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Ajouter une nouvelle série</h2>
      
      <div style={{ marginBottom: '1rem', paddingBottom: '0.8rem', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Rechercher un drama avec TMDB" 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
          />
          {isSearching && !isTranslating && <span style={{ fontSize: '0.9rem', color: '#c7d0ff', whiteSpace: 'nowrap' }}>Recherche...</span>}
          {isTranslating && <span style={{ fontSize: '0.9rem', color: 'var(--secondary-text)', whiteSpace: 'nowrap' }}>Traduction en cours... {translationProgress}%</span>}
        </div>
        
        {searchResults.length > 0 && (
          <div style={{ marginTop: '0.5rem', backgroundColor: '#1f1f1f', borderRadius: '8px', padding: '0.5rem', textAlign: 'left' }}>
            {searchResults.map((result) => (
              <div 
                key={result.id} 
                onClick={() => selectDrama(result.id, result.displayName)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem', 
                  padding: '0.5rem', 
                  cursor: 'pointer', 
                  borderBottom: '1px solid #333', 
                  transition: 'background-color 0.2s' 
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {result.poster_path ? (
                  <img 
                    src={`https://image.tmdb.org/t/p/w92${result.poster_path}`} 
                    alt={result.displayName} 
                    style={{ width: '45px', height: '68px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} 
                  />
                ) : (
                  <div style={{ width: '45px', height: '68px', backgroundColor: '#333', borderRadius: '4px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: '#c7d0ff' }}>Pas d'image</span>
                  </div>
                )}
                
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <strong style={{ color: '#fff', fontSize: '1rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {result.displayName}
                  </strong>
                  <span style={{ color: 'var(--secondary-text)', fontSize: '0.85rem' }}>
                    {result.first_air_date ? result.first_air_date.substring(0, 4) : 'Date inconnue'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedDramaDetails ? (
        <div className="panel-card" style={{ marginTop: '1rem', width: '100%', maxWidth: '1000px' }}>
          <div className="detail-top-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '2rem' }}>{selectedDramaDetails.displayName}</h2>
              {selectedDramaDetails.displayOriginalName && selectedDramaDetails.displayOriginalName !== selectedDramaDetails.displayName && (
                <p style={{ margin: '0.35rem 0 0', color: 'var(--secondary-text)' }}>Original : {selectedDramaDetails.displayOriginalName}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleBackToSearch}
              className="secondary-btn"
              style={{ height: 'fit-content', padding: '0.85rem 1.25rem' }}
            >
              Retour à la recherche
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div>
              {selectedDramaDetails.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w500${selectedDramaDetails.poster_path}`}
                  alt={selectedDramaDetails.displayName}
                  style={{ width: '100%', borderRadius: '18px', marginBottom: '1rem', boxShadow: '0 20px 40px rgba(0,0,0,0.35)' }}
                />
              ) : (
                <div style={{ width: '100%', minHeight: '320px', backgroundColor: '#151515', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60e0ff', marginBottom: '1rem' }}>
                  Pas d'image
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {selectedDramaDetails.genres?.map((genre) => (
                  <span
                    key={genre.id}
                    style={{
                      backgroundColor: 'rgba(96, 224, 255, 0.08)',
                      color: '#c7d0ff',
                      padding: '0.45rem 0.9rem',
                      borderRadius: '999px',
                      fontSize: '0.85rem'
                    }}
                  >
                    {genre.name}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gap: '0.85rem' }}>
              <div className="panel-card stat-card" style={{ padding: '1rem' }}>
                <span className="panel-label">Statut</span>
                <div className="panel-value">{selectedDramaDetails.status || 'Inconnu'}</div>
              </div>
              <div className="panel-card stat-card" style={{ padding: '1rem' }}>
                <span className="panel-label">Première diffusion</span>
                <div className="panel-value">{selectedDramaDetails.first_air_date ? new Date(selectedDramaDetails.first_air_date).toLocaleDateString('fr-FR') : 'Inconnue'}</div>
              </div>
              <div className="panel-card stat-card" style={{ padding: '1rem' }}>
                <span className="panel-label">Saisons</span>
                <div className="panel-value">{selectedDramaDetails.number_of_seasons ?? '–'}</div>
              </div>
              <div className="panel-card stat-card" style={{ padding: '1rem' }}>
                <span className="panel-label">Épisodes</span>
                <div className="panel-value">{selectedDramaDetails.number_of_episodes ?? '–'}</div>
              </div>
              <div className="panel-card stat-card" style={{ padding: '1rem' }}>
                <span className="panel-label">Langue</span>
                <div className="panel-value">{translateLanguageCode(selectedDramaDetails.original_language)}</div>
              </div>
              <div className="panel-card stat-card" style={{ padding: '1rem' }}>
                <span className="panel-label">Note TMDB</span>
                <div className="panel-value">{selectedDramaDetails.vote_average ? `${selectedDramaDetails.vote_average.toFixed(1)}/10` : '–'}</div>
              </div>
              <div className="panel-card" style={{ padding: '1rem' }}>
                <label className="panel-label" htmlFor="voir-drama-rating">Note VoirDrama</label>
                <input
                  id="voir-drama-rating"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={voirDramaRating}
                  onChange={(e) => setVoirDramaRating(e.target.value)}
                  placeholder="0-5"
                  className="input-field"
                  style={{ marginTop: '0.35rem' }}
                />
              </div>
            </div>
          </div>

          <div className="synopsis-card" style={{ marginBottom: '1.5rem' }}>
            <span className="panel-label">Synopsis</span>
            <p className="synopsis-text" style={{ margin: 0 }}>
              {selectedDramaDetails.displayOverview || 'Aucun synopsis disponible.'}
            </p>
          </div>

          <button
            type="button"
            onClick={addSelectedDramaToList}
            disabled={addingDrama}
            className="primary-btn"
            style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}
          >
            {addingDrama ? 'Ajout en cours...' : 'Ajouter à la liste À voir'}
          </button>

          {addMessage && <div className="info-text" style={{ marginTop: '1rem' }}>{addMessage}</div>}
        </div>
      ) : (
        <div>
          <p style={{ color: 'var(--secondary-text)', marginBottom: '1rem' }}>Recherchez un drama et cliquez dessus pour voir toutes les informations avant de l'ajouter à votre liste.</p>
        </div>
      )}
    </div>
  )
}