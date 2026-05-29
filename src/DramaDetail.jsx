import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function DramaDetail({ dramaId, onBack, onSelectActor }) {
  const [localDrama, setLocalDrama] = useState(null)
  const [tmdbData, setTmdbData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState('To Watch')
  const [personalRating, setPersonalRating] = useState('')
  const [commentText, setCommentText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    fetchDramaDetails()
  }, [dramaId])

  const fetchDramaDetails = async () => {
    setLoading(true)

    const { data: dbData, error: dbError } = await supabase
      .from('dramas')
      .select('*')
      .eq('id', dramaId)
      .single()

    if (dbError) {
      console.error("Erreur de récupération locale", dbError)
      setLoading(false)
      return
    }

    setLocalDrama(dbData)
    setSelectedStatus(dbData.status || 'To Watch')
    setPersonalRating(dbData.personal_rating ?? '')
    setCommentText(dbData.comment ?? '')

    const apiKey = import.meta.env.VITE_TMDB_API_KEY
    let tmdbId = dbData.tmdb_id || null

    try {
      if (!tmdbId) {
        tmdbId = await findTmdbIdFromTitle(dbData.title)
      }

      if (tmdbId) {
        const detailRes = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?language=fr-FR&append_to_response=credits,watch/providers&api_key=${apiKey}`)
        const detailData = await detailRes.json()
        setTmdbData(detailData)
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
      comment: selectedStatus === 'Watched' ? (commentText || null) : null
    }

    const { error } = await supabase
      .from('dramas')
      .update(updatePayload)
      .eq('id', dramaId)

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

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '3rem', fontSize: '1.2rem' }}>Chargement des détails...</div>
  }

  if (!localDrama) {
    return <div style={{ textAlign: 'center', marginTop: '3rem' }}>Série introuvable.</div>
  }

  const providers = getWatchProviders()

  return (
    <div className="detail-container">
      <button className="back-btn" onClick={onBack}>
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

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ backgroundColor: '#1a1a1a', padding: '0.8rem 1.2rem', borderRadius: '10px', border: '1px solid var(--border-color)', minWidth: '155px' }}>
              <div style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase' }}>Catégorie actuelle</div>
              <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{translateAppStatus(localDrama.status)}</div>
            </div>

            <button
              onClick={() => setEditMode((prev) => !prev)}
              style={{ padding: '0.8rem 1.2rem', borderRadius: '8px', border: '1px solid var(--primary-color)', background: editMode ? '#161616' : 'transparent', color: 'var(--primary-color)', cursor: 'pointer', minWidth: '150px' }}
            >
              {editMode ? 'Fermer les options' : 'Options'}
            </button>
          </div>

          {editMode && (
            <>
              <div style={{ backgroundColor: '#1a1a1a', padding: '0.8rem 1.2rem', borderRadius: '8px', border: '1px solid var(--border-color)', minWidth: '195px', marginBottom: '1rem' }}>
                <label htmlFor="drama-status" style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Changer de catégorie</label>
                <select
                  id="drama-status"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', backgroundColor: '#1f1f1f', border: '1px solid var(--border-color)', color: '#fff' }}
                >
                  <option value="To Watch">À voir</option>
                  <option value="Watching">En cours</option>
                  <option value="Watched">Vu</option>
                </select>
              </div>

              <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ backgroundColor: '#1a1a1a', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ marginBottom: '0.75rem', color: '#aaa', fontSize: '0.85rem', textTransform: 'uppercase' }}>Ma note personnelle</div>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={personalRating}
                    onChange={(e) => setPersonalRating(e.target.value)}
                    placeholder="Note sur 5"
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: '#121212', color: '#fff' }}
                  />
                </div>

                <div style={{ backgroundColor: '#1a1a1a', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ marginBottom: '0.75rem', color: '#aaa', fontSize: '0.85rem', textTransform: 'uppercase' }}>Mon commentaire</div>
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Ajouter ou modifier votre commentaire..."
                    style={{ width: '100%', minHeight: '90px', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: '#121212', color: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem' }}>
                <button
                  onClick={handleSaveChanges}
                  disabled={saving}
                  style={{ padding: '0.9rem 1.4rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary-color)', color: '#fff', cursor: 'pointer', fontWeight: '700' }}
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
                {saveMessage && <span style={{ color: '#aaa' }}>{saveMessage}</span>}
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <div style={{ backgroundColor: '#1a1a1a', padding: '0.8rem 1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase' }}>Note TMDB</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{localDrama.site_rating || '-'} / 10</div>
            </div>

            <div style={{ backgroundColor: '#1a1a1a', padding: '0.8rem 1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase' }}>Note VoirDrama</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{localDrama.voirdrama_rating || '-'}/5</div>
            </div>

            {localDrama.status === 'Watched' && localDrama.personal_rating && (
              <div style={{ backgroundColor: 'rgba(100, 108, 255, 0.1)', padding: '0.8rem 1.5rem', borderRadius: '8px', border: '1px solid var(--primary-color)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--primary-color)', textTransform: 'uppercase' }}>Ma Note</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{localDrama.personal_rating}/5</div>
              </div>
            )}
          </div>

          <p style={{ lineHeight: '1.6', fontSize: '1.05rem', color: '#ddd' }}>
            {localDrama.synopsis || "Aucun synopsis disponible."}
          </p>

          {localDrama.comment && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#1a1a1a', borderRadius: '8px', borderLeft: '4px solid var(--primary-color)' }}>
              <div style={{ fontSize: '0.85rem', color: '#aaa', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Mon Avis</div>
              <div style={{ fontStyle: 'italic', color: '#fff' }}>"{localDrama.comment}"</div>
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

          {providers.length > 0 && (
            <div className="cast-section" style={{ borderTop: 'none', paddingTop: '0', marginTop: '1rem' }}>
              <h3 style={{ color: 'var(--primary-color)', margin: '0 0 1rem 0' }}>Où regarder</h3>
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
            </div>
          )}

          {tmdbData.credits && tmdbData.credits.cast && tmdbData.credits.cast.length > 0 && (
            <div className="cast-section">
              <h3 style={{ color: 'var(--primary-color)', margin: '0 0 1.5rem 0' }}>Distribution Principale</h3>
              <div className="cast-scroll">
                {tmdbData.credits.cast.slice(0, 15).map(actor => (
                  <button
                    key={actor.id}
                    type="button"
                    className="cast-card"
                    onClick={() => onSelectActor(actor.id)}
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
                      <div className="cast-name" title={actor.name}>{actor.name}</div>
                      <div className="cast-character" title={actor.character}>{actor.character}</div>
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