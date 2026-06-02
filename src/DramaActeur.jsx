import { useState, useEffect } from 'react'

export default function DramaActeur({ actorId, onBack, onPreviewTmdb }) {
  const [actorDetails, setActorDetails] = useState(null)
  const [actorCredits, setActorCredits] = useState(null)
  const [actorCreditsLoading, setActorCreditsLoading] = useState(true)
  const [tvGenreList, setTvGenreList] = useState([])
  const [actorGenreFilter, setActorGenreFilter] = useState([])

  const [availableGenres, setAvailableGenres] = useState([
    'Action', 'Affaire', 'Amitié', 'Arts Martiaux', 'Aventure', 'BL', 'Comédie',
    'Contexte Scolaire', 'Crime', 'Culinaire', 'Documentaire', 'Drame', 'Famille',
    'Fantastique', 'Guerre', 'Historique', 'Horreur', 'Jeunesse', 'Judiciaire',
    'Mature', 'Médical', 'Mélodrame', 'Militaire', 'Musique', 'Mystère', 'Politique',
    'Psychologique', 'Romance', 'SF', 'Sitcom', 'Sport', 'Surnaturel', 'Thriller',
    'Tokasatsu', 'Vie Quotidienne', 'Wuxia', 'Yuri'
  ])

  useEffect(() => {
    if (actorId) {
      fetchActorDetails(actorId)
    }
  }, [actorId])

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

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const apiKey = import.meta.env.VITE_TMDB_API_KEY
        if (!apiKey) return

        const response = await fetch(`https://api.themoviedb.org/3/genre/tv/list?language=fr-FR&api_key=${apiKey}`)
        const data = await response.json()

        if (data.genres) {
          setTvGenreList(data.genres)
          
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

  const getLatinDisplayName = (personDetails, fallbackName) => {
    const latinNamePattern = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 .,'\-()]+$/
    if (personDetails?.also_known_as?.length) {
      const romanized = personDetails.also_known_as.find(name => latinNamePattern.test(name))
      if (romanized) return romanized
    }
    if (personDetails?.name && latinNamePattern.test(personDetails.name)) {
      return personDetails.name
    }
    return fallbackName
  }

  const getLatinText = (originalText, fallbackText) => {
    const latinPattern = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 .,'\-()]+$/
    if (!originalText) return fallbackText
    if (latinPattern.test(originalText)) return originalText
    return fallbackText
  }

  const fetchActorDetails = async (actorId) => {
    setActorCreditsLoading(true)

    try {
      const apiKey = import.meta.env.VITE_TMDB_API_KEY
      const [detailsRes, creditsResFr, creditsResEn] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/person/${actorId}?language=fr-FR&api_key=${apiKey}`),
        fetch(`https://api.themoviedb.org/3/person/${actorId}/tv_credits?language=fr-FR&api_key=${apiKey}`),
        fetch(`https://api.themoviedb.org/3/person/${actorId}/tv_credits?language=en-US&api_key=${apiKey}`)
      ])

      const detailsData = await detailsRes.json()
      const creditsDataFr = await creditsResFr.json()
      const creditsDataEn = await creditsResEn.json()
      
      setActorDetails(detailsData)

      const englishById = new Map((creditsDataEn.cast || []).map((credit) => [credit.credit_id || credit.id, credit]))
      if (creditsDataFr.cast) {
        const mappedCredits = creditsDataFr.cast.map((credit) => {
          const englishCredit = englishById.get(credit.credit_id || credit.id)
          const fallbackTitle = englishCredit?.name || englishCredit?.original_name || credit.original_name || credit.name
          const fallbackRole = englishCredit?.character || englishCredit?.job || credit.character || credit.job

          return {
            ...credit,
            name: getLatinText(credit.name, fallbackTitle),
            original_name: getLatinText(credit.original_name, englishCredit?.original_name || credit.original_name || credit.name),
            displayRole: getLatinText(credit.character || credit.job, fallbackRole)
          }
        })

        const sortedCredits = mappedCredits
          .sort((a, b) => {
            const scoreA = parseFloat(a.vote_average || 0)
            const scoreB = parseFloat(b.vote_average || 0)
            if (scoreB !== scoreA) return scoreB - scoreA
            return (b.popularity || 0) - (a.popularity || 0)
          })
        
        setActorCredits(sortedCredits)
      } else {
        setActorCredits([])
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des crédits de l’acteur', error)
      setActorCredits([])
    }

    setActorCreditsLoading(false)
  }

  if (actorCreditsLoading) {
    return <div style={{ textAlign: 'center', marginTop: '3rem', fontSize: '1.2rem' }}>Chargement des détails de l'acteur...</div>
  }

  if (!actorDetails) {
    return <div style={{ textAlign: 'center', marginTop: '3rem' }}>Acteur introuvable.</div>
  }

  return (
    <div className="detail-container">
      <button className="back-btn" onClick={onBack}>
        Retour
      </button>

      <div className="actor-modal-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '2rem' }}>{getLatinDisplayName(actorDetails, actorDetails.name)}</h2>
          <p style={{ margin: '0.7rem 0 0', color: 'var(--secondary-text)' }}>
            {actorCredits && actorCredits.length > 0 ? `${actorCredits.length} séries` : 'Aucun drama trouvé pour cet acteur.'}
          </p>
        </div>
      </div>

      <div className="actor-modal-filters" style={{ marginBottom: '2rem' }}>
        <div className="actor-modal-filter panel-card" style={{ gap: '1.5rem', flexDirection: 'column' }}>
          <div>
            <span className="panel-label">Genres</span>
            <div className="genres-container" style={{ maxHeight: '220px', overflowY: 'auto', padding: '0.5rem' }}>
              {availableGenres.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  className={`genre-btn ${actorGenreFilter.includes(genre) ? 'active' : ''}`}
                  onClick={() => {
                    setActorGenreFilter((prev) =>
                      prev.includes(genre)
                        ? prev.filter((g) => g !== genre)
                        : [...prev, genre]
                    )
                  }}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="drama-grid">
        {!actorCreditsLoading && actorCredits && actorCredits.length > 0 && actorCredits
          .filter((credit) => {
            if (actorGenreFilter.length > 0) {
              // Mapper les noms de genres textuels aux genre_ids de l'API TMDB
              const selectedGenreIds = actorGenreFilter.flatMap((genreName) => {
                const tmdbGenres = tvGenreList.filter((g) => g.name === genreName)
                return tmdbGenres.map((g) => g.id)
              })
              
              if (!selectedGenreIds.some((genreId) => credit.genre_ids?.includes(genreId))) {
                return false
              }
            }
            return true
          })
          .map((credit) => (
            <button
              key={credit.credit_id || credit.id}
              type="button"
              className="drama-card"
              onClick={() => onPreviewTmdb(credit.id)}
              style={{ cursor: 'pointer', border: 'none', padding: 0 }}
            >
              {credit.poster_path ? (
                <img src={`https://image.tmdb.org/t/p/w185${credit.poster_path}`} alt={credit.name} className="drama-poster" />
              ) : (
                <div className="drama-poster" style={{ backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#c7d0ff' }}>Pas d'image</span>
                </div>
              )}
              <div className="drama-info">
                <h4 className="drama-title" title={credit.name}>{credit.name}</h4>
                <div className="drama-genres">Rôle : {credit.displayRole || credit.character || credit.job || 'Inconnu'}</div>
                
                <div className="drama-ratings">
                  <span title="Note TMDB">TMDB : <span className="rating-badge">{credit.vote_average ? `${credit.vote_average.toFixed(1)}/10` : '-'}</span></span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.75rem' }}>
                  {(credit.genre_ids || []).map((genreId) => {
                    const genre = tvGenreList.find((g) => g.id === genreId)
                    return genre ? (
                      <span key={genreId} style={{ backgroundColor: 'rgba(96, 224, 255, 0.12)', color: '#d8f7ff', padding: '0.25rem 0.5rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '500' }}>{genre.name}</span>
                    ) : null
                  })}
                </div>
              </div>
            </button>
          ))}
      </div>
    </div>
  )
}