import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { translateLongText } from './translationService'

export default function DramaDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()

  const [localDrama, setLocalDrama] = useState(null)
  const [tmdbData, setTmdbData] = useState(null)
  const [castNameMap, setCastNameMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [synopsisLoading, setSynopsisLoading] = useState(false)
  const [synopsisProgress, setSynopsisProgress] = useState(0)
  const [tmdbSynopsis, setTmdbSynopsis] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('To Watch')
  const [personalRating, setPersonalRating] = useState('')
  const [commentText, setCommentText] = useState('')
  const [voirDramaRating, setVoirDramaRating] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [editMode, setEditMode] = useState(false)
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
    if (tmdbData?.credits?.cast?.length) {
      fetchRomanizedCastNames(tmdbData.credits.cast.slice(0, 15))
    }
  }, [tmdbData])

  useEffect(() => {
    fetchDramaDetails()
  }, [slug])

  const fetchDramaDetails = async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: allDramas, error: dbError } = await supabase
      .from('dramas')
      .select('*')
      .eq('user_id', user.id)

    if (dbError) {
      console.error("Erreur de récupération locale", dbError)
      setLoading(false)
      return
    }

    const dbData = allDramas.find(d => createSlug(d.title) === slug)

    if (!dbData) {
      setLocalDrama(null)
      setLoading(false)
      return
    }

    setLocalDrama(dbData)
    setSelectedStatus(dbData.status || 'To Watch')
    setPersonalRating(dbData.personal_rating ?? '')
    setCommentText(dbData.comment ?? '')
    setVoirDramaRating(dbData.voirdrama_rating ?? '')

    const apiKey = import.meta.env.VITE_TMDB_API_KEY
    let tmdbId = dbData.tmdb_id || null

    try {
      if (!tmdbId) {
        tmdbId = await findTmdbIdFromTitle(dbData.title)
      }

      if (tmdbId) {
        const [detailResFr, detailResEn] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?language=fr-FR&append_to_response=credits,watch/providers&api_key=${apiKey}`),
          fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?language=en-US&append_to_response=credits,watch/providers&api_key=${apiKey}`)
        ])

        const detailDataFr = await detailResFr.json()
        const detailDataEn = await detailResEn.json()
        setTmdbData(detailDataFr)

        if (dbData.cast_list === null) {
          const frProviders = detailDataFr?.['watch/providers']?.results?.FR
          const allProviders = [...(frProviders?.flatrate || []), ...(frProviders?.free || [])]
          const uniqueProviders = Array.from(new Map(allProviders.map(item => [item.provider_id, item])).values())
          
          await supabase.from('dramas').update({
            tmdb_id: tmdbId,
            tmdb_status: detailDataFr.status || null,
            first_air_date: detailDataFr.first_air_date || null,
            number_of_seasons: detailDataFr.number_of_seasons || null,
            number_of_episodes: detailDataFr.number_of_episodes || null,
            episode_run_time: detailDataFr.episode_run_time?.[0] || null,
            cast_list: detailDataFr.credits?.cast?.slice(0, 15) || [],
            watch_providers: uniqueProviders
          }).eq('id', dbData.id)
        }

        const frOverview = detailDataFr.overview
        const enOverview = detailDataEn.overview

        if (frOverview && enOverview && frOverview.trim() === enOverview.trim()) {
          setSynopsisLoading(true)
          const translated = await translateLongText(enOverview, setSynopsisProgress)
          setTmdbSynopsis(translated || enOverview)
          setSynopsisLoading(false)
        } else if (frOverview) {
          setTmdbSynopsis(frOverview)
        } else if (enOverview) {
          setSynopsisLoading(true)
          const translated = await translateLongText(enOverview, setSynopsisProgress)
          setTmdbSynopsis(translated || enOverview)
          setSynopsisLoading(false)
        } else {
          setTmdbSynopsis('Aucun synopsis disponible.')
        }
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des données TMDB", error)
    }

    setLoading(false)
  }

  const translateStatus = (status) => {
    const statusMap = {
      'Ended': 'Terminé',
      'Returning Series': 'En cours de production',
      'Canceled': 'Annulé',
      'In Production': 'En production',
      'Pilot': 'Pilote'
    }
    return statusMap[status] || status
  }

  const translateAppStatus = (status) => {
    const appStatusMap = {
      'To Watch': 'À voir',
      'Watching': 'En cours',
      'Watched': 'Vu'
    }
    return appStatusMap[status] || status
  }

  const findTmdbIdFromTitle = async (title) => {
    const apiKey = import.meta.env.VITE_TMDB_API_KEY
    const query = encodeURIComponent(title || '')
    try {
      const [responseFr, responseEn] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/search/tv?query=${query}&language=fr-FR&api_key=${apiKey}`),
        fetch(`https://api.themoviedb.org/3/search/tv?query=${query}&language=en-US&api_key=${apiKey}`)
      ])
      const dataFr = await responseFr.json()
      const dataEn = await responseEn.json()
      const results = [...(dataFr.results || []), ...(dataEn.results || [])]
      const normalizedTitle = title?.trim().toLowerCase()
      const exactMatch = results.find((item) => {
        return [item.name, item.original_name].some((value) => value?.trim().toLowerCase() === normalizedTitle)
      })
      if (exactMatch) return exactMatch.id
      const partialMatch = results.find((item) => {
        return [item.name, item.original_name].some((value) => {
          const lowered = value?.trim().toLowerCase()
          return lowered && (lowered === normalizedTitle || lowered.includes(normalizedTitle) || normalizedTitle.includes(lowered))
        })
      })
      return partialMatch?.id || results[0]?.id || null
    } catch (error) {
      console.error('Erreur de recherche TMDB par titre', error)
      return null
    }
  }

  const handleSaveChanges = async () => {
    setSaving(true)
    setSaveMessage('')

    const updatePayload = {
      status: selectedStatus,
      personal_rating: selectedStatus === 'Watched' ? (personalRating || null) : null,
      comment: selectedStatus === 'Watched' ? (commentText || null) : null,
      voirdrama_rating: voirDramaRating ? parseFloat(voirDramaRating) : null
    }

    const { error } = await supabase
      .from('dramas')
      .update(updatePayload)
      .eq('id', localDrama.id)

    if (error) {
      setSaveMessage('Erreur lors de la sauvegarde : ' + error.message)
    } else {
      setSaveMessage('Mises à jour enregistrées.')
      await fetchDramaDetails()
    }

    setSaving(false)
  }

  const getWatchProviders = () => {
    if (!tmdbData?.['watch/providers']?.results?.FR) return []
    const frProviders = tmdbData['watch/providers'].results.FR
    const flatrate = frProviders.flatrate || []
    const free = frProviders.free || []
    const allProviders = [...flatrate, ...free]
    const uniqueProviders = Array.from(new Map(allProviders.map(item => [item.provider_id, item])).values())
    return uniqueProviders
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
    const title = localDrama?.title || ''
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
    const title = localDrama?.title || ''
    navigator.clipboard.writeText(title).then(() => {
      window.open('https://voirdrama.to/', '_blank', 'noopener,noreferrer')
    }).catch(err => {
      console.error('Erreur lors de la copie:', err)
      window.open('https://voirdrama.to/', '_blank', 'noopener,noreferrer')
    })
  }

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '3rem', fontSize: '1.2rem' }}>Chargement des détails...</div>
  }

  if (!localDrama) {
    return <div style={{ textAlign: 'center', marginTop: '3rem' }}>Série introuvable.</div>
  }

  const { hasNetflix, hasPrimeVideo, hasDisneyPlus, hasAppleTV, providers } = getProviderNames()

  return (
    <div className="detail-container">
      <button className="back-btn" onClick={() => navigate(-1)}>
        Retour
      </button>

      <div className="detail-header">
        <div className="detail-poster-container">
          {localDrama.poster_url ? (
            <img src={localDrama.poster_url} alt={localDrama.title} />
          ) : (
            <div style={{ width: '100%', aspectRatio: '2/3', backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}>
              <span style={{ color: '#888' }}>Pas d'image</span>
            </div>
          )}
        </div>

        <div className="detail-info-container">
          <h2 className="detail-title">{localDrama.title}</h2>
          <div style={{ color: '#aaa', marginBottom: '1.5rem', fontSize: '1.1rem' }}>
            {localDrama.genre}
          </div>

          <div className="detail-top-row">
            <div className="panel-card status-panel">
              <span className="panel-label">Catégorie actuelle</span>
              <span className="panel-value">{translateAppStatus(localDrama.status)}</span>
            </div>
            <button className={`secondary-btn ${editMode ? 'secondary-btn-active' : ''}`} onClick={() => setEditMode((prev) => !prev)}>
              {editMode ? 'Fermer les options' : 'Options'}
            </button>
          </div>

          {editMode && (
            <div className="editor-grid">
              <div className="panel-card">
                <span className="panel-label">Changer de catégorie</span>
                <select id="drama-status" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="status-select">
                  <option value="Not Found">Vidéos introuvables</option>
                  <option value="To Watch">À voir</option>
                  <option value="Watching">En cours</option>
                  <option value="Watched">Vu</option>
                </select>
              </div>

              <div className="panel-card">
                <span className="panel-label">Ma note personnelle</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={personalRating}
                  onChange={(e) => setPersonalRating(e.target.value)}
                  placeholder="Note sur 5"
                  className="input-field"
                />
              </div>

              <div className="panel-card">
                <span className="panel-label">Note VoirDrama</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={voirDramaRating}
                  onChange={(e) => setVoirDramaRating(e.target.value)}
                  placeholder="Note sur 5"
                  className="input-field"
                />
              </div>

              <div className="panel-card">
                <span className="panel-label">Mon commentaire</span>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Ajouter ou modifier votre commentaire..."
                  className="textarea-field"
                />
              </div>

              <div className="action-row">
                <button onClick={handleSaveChanges} disabled={saving} className="primary-btn">
                  {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
                {saveMessage && <span className="info-text">{saveMessage}</span>}
              </div>
            </div>
          )}

          <div className="detail-stats-row">
            <div className="panel-card stat-card">
              <span className="panel-label">Note TMDB</span>
              <span className="panel-value">{localDrama.site_rating || '-'} / 10</span>
            </div>

            <div className="panel-card stat-card">
              <span className="panel-label">Note VoirDrama</span>
              <span className="panel-value">{localDrama.voirdrama_rating || '-'} / 5</span>
            </div>

            {localDrama.status === 'Watched' && localDrama.personal_rating && (
              <div className="panel-card stat-card highlight-card">
                <span className="panel-label">Ma note</span>
                <span className="panel-value">{localDrama.personal_rating} / 5</span>
              </div>
            )}
          </div>

          <div className="panel-card synopsis-card">
            <span className="panel-label">Synopsis</span>
            {synopsisLoading ? (
              <div className="translation-status">
                <p className="translating-text">Traduction du synopsis en cours...</p>
                <div className="progress-container">
                  <div className="progress-bar" style={{ width: `${synopsisProgress}%` }} />
                </div>
              </div>
            ) : (
              <p className="synopsis-text">{tmdbSynopsis || localDrama.synopsis || 'Aucun synopsis disponible.'}</p>
            )}
          </div>

          {localDrama.comment && (
            <div className="panel-card" style={{ marginTop: '1.5rem', borderLeft: '4px solid var(--primary-color)' }}>
              <div className="panel-label" style={{ marginBottom: '0.5rem' }}>Mon Avis</div>
              <div style={{ fontStyle: 'italic', color: '#fff', fontSize: '1rem', lineHeight: '1.6' }}>
                "{localDrama.comment}"
              </div>
            </div>
          )}
        </div>
      </div>

      {tmdbData && (
        <>
          <div className="detail-meta-grid">
            <div className="meta-item">
              <span className="meta-label">Statut</span>
              <span className="meta-value">{translateStatus(tmdbData.status)}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Épisodes</span>
              <span className="meta-value">{tmdbData.number_of_episodes || '?'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Saisons</span>
              <span className="meta-value">{tmdbData.number_of_seasons || '?'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Durée moyenne</span>
              <span className="meta-value">
                {tmdbData.episode_run_time && tmdbData.episode_run_time.length > 0 
                  ? `${tmdbData.episode_run_time[0]} min` 
                  : 'Inconnue'}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Première diffusion</span>
              <span className="meta-value">
                {tmdbData.first_air_date ? new Date(tmdbData.first_air_date).toLocaleDateString('fr-FR') : 'Inconnue'}
              </span>
            </div>
          </div>

          <div className="cast-section" style={{ borderTop: 'none', paddingTop: '0', marginTop: '1rem' }}>
            <h3 style={{ color: 'var(--primary-color)', margin: '0 0 1rem 0' }}>Où regarder</h3>
            
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {hasNetflix && (
                <button onClick={() => openLink(getStreamingLinks().netflix)} className="streaming-badge">
                  <span style={{ fontSize: '1.4rem' }}>🎬</span>
                  <span>Netflix</span>
                </button>
              )}
              {hasPrimeVideo && (
                <button onClick={() => openLink(getStreamingLinks().primeVideo)} className="streaming-badge">
                  <span style={{ fontSize: '1.4rem' }}>▶️</span>
                  <span>Prime Video</span>
                </button>
              )}
              {hasDisneyPlus && (
                <button onClick={() => openLink(getStreamingLinks().disneyPlus)} className="streaming-badge">
                  <span style={{ fontSize: '1.4rem' }}>⭐</span>
                  <span>Disney+</span>
                </button>
              )}
              {hasAppleTV && (
                <button onClick={() => openLink(getStreamingLinks().appleTV)} className="streaming-badge">
                  <span style={{ fontSize: '1.4rem' }}>🍎</span>
                  <span>Apple TV</span>
                </button>
              )}
              <button onClick={() => openLink(getStreamingLinks().voirDrama)} className="streaming-badge">
                <span style={{ fontSize: '1.2rem' }}>🔍</span>
                <span>VoirDrama</span>
              </button>
              <button onClick={copyTitleAndOpenVoirDrama} className="streaming-badge" title="Copie le titre du drama et ouvre VoirDrama">
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

          {tmdbData.credits && tmdbData.credits.cast && tmdbData.credits.cast.length > 0 && (
            <div className="cast-section">
              <h3 style={{ color: 'var(--primary-color)', margin: '0 0 1.5rem 0', fontSize: '1.3rem', fontWeight: '700', letterSpacing: '0.05em' }}>Acteurs et Personnages</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                {tmdbData.credits.cast.slice(0, 15).map(actor => (
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
        </>
      )}
    </div>
  )
}