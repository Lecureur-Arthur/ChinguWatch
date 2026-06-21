import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { translateLongText } from './translationService'

export default function TmdbPreview({ session }) {
  const { slug } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [translating, setTranslating] = useState(false)
  const [translationProgress, setTranslationProgress] = useState(0)
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState('')
  const [tvGenreList, setTvGenreList] = useState([])
  const [castNameMap, setCastNameMap] = useState({})
  
  const [internalTmdbId, setInternalTmdbId] = useState(location.state?.tmdbId || null)

  const latinPattern = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 .,'\-()]+$/

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

  const getLatinText = (originalText, fallbackText = '') => {
    if (!originalText) return fallbackText || ''
    return latinPattern.test(originalText) ? originalText : fallbackText || originalText
  }

  const getCastDisplayName = (actor) => {
    const cachedName = castNameMap[actor.id]
    if (cachedName) return cachedName
    if (actor.name && latinPattern.test(actor.name)) return actor.name
    if (actor.original_name && latinPattern.test(actor.original_name)) return actor.original_name
    return actor.name || actor.original_name || 'Inconnu'
  }

  const fetchRomanizedCastNames = async (cast) => {
    const apiKey = import.meta.env.VITE_TMDB_API_KEY
    const missingNames = cast.filter(actor => !castNameMap[actor.id] && !latinPattern.test(actor.name))
    if (missingNames.length === 0) return

    const fetches = missingNames.map(async (actor) => {
      try {
        const response = await fetch(`https://api.themoviedb.org/3/person/${actor.id}?language=en-US&api_key=${apiKey}`)
        const data = await response.json()
        const name = getLatinText(data.name, actor.name)
        return [actor.id, name]
      } catch (error) {
        return [actor.id, actor.name]
      }
    })

    const results = await Promise.all(fetches)
    setCastNameMap(prev => {
      const next = { ...prev }
      results.forEach(([id, name]) => {
        if (id) next[id] = name
      })
      return next
    })
  }

  useEffect(() => {
    if (details?.credits?.cast?.length) {
      fetchRomanizedCastNames(details.credits.cast.slice(0, 15))
    }
  }, [details])

  useEffect(() => {
    if (internalTmdbId) {
      fetchGenresAndDetails(internalTmdbId)
    } else if (slug) {
      findTmdbIdFromSlug(slug)
    }
  }, [slug, internalTmdbId])

  const translateTmdbStatus = (status) => {
    const statusMap = {
      'Ended': 'Terminé',
      'Returning Series': 'En cours de production',
      'Canceled': 'Annulé',
      'In Production': 'En production',
      'Pilot': 'Pilote'
    }
    return statusMap[status] || status
  }

  const findTmdbIdFromSlug = async (searchSlug) => {
    const apiKey = import.meta.env.VITE_TMDB_API_KEY
    const query = encodeURIComponent(searchSlug.replace(/-/g, ' '))
    try {
      const res = await fetch(`https://api.themoviedb.org/3/search/tv?query=${query}&language=fr-FR&api_key=${apiKey}`)
      const data = await res.json()
      if (data.results && data.results.length > 0) {
         setInternalTmdbId(data.results[0].id)
      } else {
         setLoading(false)
         setMessage('Série introuvable.')
      }
    } catch (err) {
      setLoading(false)
      setMessage('Erreur de recherche.')
    }
  }

  const fetchGenresAndDetails = async (idToFetch) => {
    setLoading(true)
    setMessage('')
    try {
      const apiKey = import.meta.env.VITE_TMDB_API_KEY
      
      const genreRes = await fetch(`https://api.themoviedb.org/3/genre/tv/list?language=fr-FR&api_key=${apiKey}`)
      const genreData = await genreRes.json()
      setTvGenreList(genreData.genres || [])

      const [detailsFrRes, detailsEnRes] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/tv/${idToFetch}?language=fr-FR&append_to_response=credits,watch/providers&api_key=${apiKey}`),
        fetch(`https://api.themoviedb.org/3/tv/${idToFetch}?language=en-US&append_to_response=credits,watch/providers&api_key=${apiKey}`)
      ])

      const detailsFr = await detailsFrRes.json()
      const detailsEn = await detailsEnRes.json()

      const displayName = getLatinText(detailsFr.name || detailsFr.original_name, detailsEn.name || detailsEn.original_name || detailsFr.original_name)
      const displayOriginalName = getLatinText(detailsFr.original_name, detailsEn.original_name || detailsFr.name)
      const frOverview = detailsFr.overview
      const enOverview = detailsEn.overview
      let displayOverview = ''

      if (frOverview && enOverview && frOverview.trim() === enOverview.trim()) {
        setTranslating(true)
        displayOverview = await translateLongText(enOverview, setTranslationProgress)
        setTranslating(false)
      } else if (frOverview) {
        displayOverview = frOverview
      } else if (enOverview) {
        setTranslating(true)
        displayOverview = await translateLongText(enOverview, setTranslationProgress)
        setTranslating(false)
      }

      setDetails({
        ...detailsFr,
        displayName,
        displayOriginalName,
        displayOverview
      })
    } catch (error) {
      console.error('Erreur lors de la récupération du drama', error)
      setMessage('Impossible de charger les informations.')
    }
    setLoading(false)
  }

  const addToList = async () => {
    if (!details) return
    setAdding(true)
    setMessage('')

    try {
      const userId = session?.user?.id
      if (!userId) {
        setMessage('Utilisateur non connecté.')
        setAdding(false)
        return
      }

      const title = details.displayName || details.name || details.original_name || 'Titre inconnu'
      const { data: existing } = await supabase
        .from('dramas')
        .select('id')
        .eq('user_id', userId)
        .eq('title', title)
        .limit(1)

      if (existing?.length > 0) {
        setMessage('Ce drama est déjà présent dans votre liste.')
        setAdding(false)
        return
      }

      const genreString = details.genres?.map((genre) => genre.name).join(', ') || ''
      const posterUrl = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null
      const siteRating = details.vote_average ? parseFloat(details.vote_average.toFixed(1)) : null
      
      const getWatchProviders = () => {
        if (!details?.['watch/providers']?.results?.FR) return []
        const frProviders = details['watch/providers'].results.FR
        const flatrate = frProviders.flatrate || []
        const free = frProviders.free || []
        const allProviders = [...flatrate, ...free]
        return Array.from(new Map(allProviders.map(item => [item.provider_id, item])).values())
      }

      const { error: insertError } = await supabase.from('dramas').insert([
        {
          title,
          genre: genreString,
          site_rating: siteRating || null,
          voirdrama_rating: null,
          personal_rating: null,
          comment: null,
          synopsis: details.displayOverview || details.overview || '',
          status: 'To Watch',
          poster_url: posterUrl,
          user_id: userId,
          tmdb_id: internalTmdbId,
          tmdb_status: details.status || null,
          first_air_date: details.first_air_date || null,
          number_of_seasons: details.number_of_seasons || null,
          number_of_episodes: details.number_of_episodes || null,
          episode_run_time: details.episode_run_time?.[0] || null,
          cast_list: details.credits?.cast?.slice(0, 15) || [],
          watch_providers: getWatchProviders()
        }
      ])

      if (insertError) {
        setMessage('Erreur lors de l’ajout à la liste.')
      } else {
        setMessage('Drama ajouté avec succès à la liste À voir.')
      }
    } catch (error) {
      setMessage('Erreur lors de l’ajout à la liste.')
    }
    setAdding(false)
  }

  const getWatchProviders = () => {
    if (!details?.['watch/providers']?.results?.FR) return []
    const frProviders = details['watch/providers'].results.FR
    const flatrate = frProviders.flatrate || []
    const free = frProviders.free || []
    const allProviders = [...flatrate, ...free]
    return Array.from(new Map(allProviders.map(item => [item.provider_id, item])).values())
  }

  const getProviderNames = () => {
    const providers = getWatchProviders()
    const providerNames = providers.map(p => p.provider_name)
    return {
      hasNetflix: providerNames.includes('Netflix'),
      hasPrimeVideo: providerNames.includes('Amazon Prime Video'),
      hasDisneyPlus: providerNames.includes('Disney Plus'),
      hasAppleTV: providerNames.includes('Apple TV'),
      providers: providers
    }
  }

  const getStreamingLinks = () => {
    const title = details?.displayName || ''
    const encodedTitle = encodeURIComponent(title)
    const slugName = createSlug(title)
    
    return {
      netflix: `https://www.netflix.com/search?q=${encodedTitle}`,
      primeVideo: `https://www.primevideo.com/search?q=${encodedTitle}`,
      disneyPlus: `https://www.disneyplus.com/search?q=${encodedTitle}`,
      appleTV: `https://tv.apple.com/search?term=${encodedTitle}`,
      voirDrama: `https://voirdrama.to/drama/${slugName}/`
    }
  }

  const openLink = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const copyTitleAndOpenVoirDrama = () => {
    const title = details?.displayName || ''
    navigator.clipboard.writeText(title).then(() => {
      window.open('https://voirdrama.to/', '_blank', 'noopener,noreferrer')
    }).catch(err => {
      console.error('Erreur lors de la copie:', err)
      window.open('https://voirdrama.to/', '_blank', 'noopener,noreferrer')
    })
  }

  if (loading) return <div style={{ textAlign: 'center', marginTop: '3rem', fontSize: '1.2rem' }}>Chargement des détails...</div>
  if (!details) return <div style={{ textAlign: 'center', marginTop: '3rem' }}>Erreur de chargement ou série introuvable.</div>

  const { hasNetflix, hasPrimeVideo, hasDisneyPlus, hasAppleTV, providers } = getProviderNames()

  return (
    <div className="detail-container">
      <button className="back-btn" onClick={() => navigate(-1)}>
        Retour
      </button>

      {message && <div style={{ marginBottom: '1.5rem', color: 'var(--secondary-text)', textAlign: 'right', fontWeight: 'bold' }}>{message}</div>}

      <div className="detail-header">
        <div className="detail-poster-container">
          {details.poster_path ? (
            <img src={`https://image.tmdb.org/t/p/w500${details.poster_path}`} alt={details.displayName} />
          ) : (
            <div style={{ width: '100%', aspectRatio: '2 / 3', backgroundColor: '#333', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#888' }}>Pas d'image</span>
            </div>
          )}
        </div>
        
        <div className="detail-info-container">
          <h2 className="detail-title">{details.displayName}</h2>
          <div style={{ color: '#aaa', marginBottom: '1.5rem', fontSize: '1.1rem' }}>
            {details.genres?.map((genre) => genre.name).join(', ') || 'Aucun genre spécifié'}
          </div>

          <div className="detail-top-row" style={{ justifyContent: 'flex-end' }}>
            <button
              onClick={addToList}
              disabled={adding}
              className="secondary-btn"
              style={{ backgroundColor: 'var(--primary-color)', color: '#000', border: 'none', fontWeight: 'bold' }}
            >
              {adding ? 'Ajout en cours...' : 'Ajouter à la liste'}
            </button>
          </div>

          <div className="detail-stats-row">
            <div className="panel-card stat-card">
              <span className="panel-label">Note TMDB</span>
              <span className="panel-value">{details.vote_average ? `${details.vote_average.toFixed(1)} / 10` : '-'}</span>
            </div>
          </div>

          <div className="panel-card synopsis-card">
            <span className="panel-label">Synopsis</span>
            {translating ? (
              <div className="translation-status">
                <p className="translating-text">Traduction du synopsis en cours...</p>
                <div className="progress-container">
                  <div className="progress-bar" style={{ width: `${translationProgress}%` }} />
                </div>
              </div>
            ) : (
              <p className="synopsis-text">{details.displayOverview || 'Aucun synopsis disponible.'}</p>
            )}
          </div>
        </div>
      </div>

      <div className="detail-meta-grid">
        <div className="meta-item">
          <span className="meta-label">Statut</span>
          <span className="meta-value">{translateTmdbStatus(details.status)}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Épisodes</span>
          <span className="meta-value">{details.number_of_episodes || '?'}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Saisons</span>
          <span className="meta-value">{details.number_of_seasons || '?'}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Durée moyenne</span>
          <span className="meta-value">
            {details.episode_run_time && details.episode_run_time.length > 0 
              ? `${details.episode_run_time[0]} min` 
              : 'Inconnue'}
          </span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Première diffusion</span>
          <span className="meta-value">
            {details.first_air_date ? new Date(details.first_air_date).toLocaleDateString('fr-FR') : 'Inconnue'}
          </span>
        </div>
      </div>

      <div className="cast-section" style={{ borderTop: 'none', paddingTop: '0', marginTop: '1rem' }}>
        <h3 style={{ color: 'var(--primary-color)', margin: '0 0 1rem 0' }}>Où regarder</h3>
        
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {hasNetflix && (
            <button onClick={() => openLink(getStreamingLinks().netflix)} className="streaming-badge netflix">
              <span style={{ fontSize: '1.4rem' }}>🎬</span>
              <span>Netflix</span>
            </button>
          )}
          {hasPrimeVideo && (
            <button onClick={() => openLink(getStreamingLinks().primeVideo)} className="streaming-badge prime-video">
              <span style={{ fontSize: '1.4rem' }}>▶️</span>
              <span>Prime Video</span>
            </button>
          )}
          {hasDisneyPlus && (
            <button onClick={() => openLink(getStreamingLinks().disneyPlus)} className="streaming-badge disney-plus">
              <span style={{ fontSize: '1.4rem' }}>⭐</span>
              <span>Disney+</span>
            </button>
          )}
          {hasAppleTV && (
            <button onClick={() => openLink(getStreamingLinks().appleTV)} className="streaming-badge apple-tv">
              <span style={{ fontSize: '1.4rem' }}>🍎</span>
              <span>Apple TV</span>
            </button>
          )}
          <button
            onClick={() => openLink(getStreamingLinks().voirDrama)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1.25rem',
              backgroundColor: 'rgba(96, 224, 255, 0.15)',
              border: '1px solid rgba(96, 224, 255, 0.4)',
              borderRadius: '12px',
              color: '#60e0ff',
              fontWeight: '600',
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>🔍</span>
            <span>VoirDrama</span>
          </button>
          <button
            onClick={copyTitleAndOpenVoirDrama}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1.25rem',
              backgroundColor: 'rgba(143, 156, 255, 0.15)',
              border: '1px solid rgba(143, 156, 255, 0.4)',
              borderRadius: '12px',
              color: '#8f9cff',
              fontWeight: '600',
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            title="Copie le titre du drama et ouvre VoirDrama"
          >
            <span style={{ fontSize: '1.2rem' }}>📋</span>
            <span>Copier & VoirDrama</span>
          </button>
        </div>
        
        {(hasNetflix || hasPrimeVideo || hasDisneyPlus || hasAppleTV) && (
          <div className="providers-container">
            {providers.map(provider => (
              <img 
                key={provider.provider_id} 
                src={`https://image.tmdb.org/t/p/w45${provider.logo_path}`} 
                alt={provider.provider_name}
                title={provider.provider_name}
                className="provider-logo"
              />
            ))}
          </div>
        )}
      </div>

      {details.credits && details.credits.cast && details.credits.cast.length > 0 && (
        <div className="cast-section">
          <h3 style={{ color: 'var(--primary-color)', margin: '0 0 1.5rem 0', fontSize: '1.3rem', fontWeight: '700', letterSpacing: '0.05em' }}>Acteurs et Personnages</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            {details.credits.cast.slice(0, 15).map(actor => (
              <button
                key={actor.id}
                type="button"
                className="cast-card"
                onClick={() => navigate(`/actor/${createSlug(getCastDisplayName(actor))}`, { state: { tmdbActorId: actor.id } })}
                style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0, textAlign: 'left' }}
              >
                {actor.profile_path ? (
                  <img src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`} alt={actor.name} className="cast-photo" />
                ) : (
                  <div className="cast-photo" style={{ backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '2rem', color: '#555' }}>?</span>
                  </div>
                )}
                <div className="cast-info">
                  <div className="cast-name" title={actor.name}>{getCastDisplayName(actor)}</div>
                  <div className="cast-character" title={actor.character}>Rôle : {getLatinText(actor.character, actor.character)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}