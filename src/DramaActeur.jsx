import { useState, useEffect } from 'react'

export default function DramaActeur({ actorId, onBack, onPreviewTmdb }) {
  const [actorDetails, setActorDetails] = useState(null)
  const [actorCredits, setActorCredits] = useState(null)
  const [actorCreditsLoading, setActorCreditsLoading] = useState(true)
  const [tvGenreList, setTvGenreList] = useState([])
  const [actorRatingFilter, setActorRatingFilter] = useState('')
  const [actorGenreFilter, setActorGenreFilter] = useState('')

  useEffect(() => {
    if (actorId) {
      fetchActorDetails(actorId)
    }
  }, [actorId])

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
      const [detailsRes, creditsResFr, creditsResEn, genresRes] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/person/${actorId}?language=fr-FR&api_key=${apiKey}`),
        fetch(`https://api.themoviedb.org/3/person/${actorId}/tv_credits?language=fr-FR&api_key=${apiKey}`),
        fetch(`https://api.themoviedb.org/3/person/${actorId}/tv_credits?language=en-US&api_key=${apiKey}`),
        tvGenreList.length === 0 ? fetch(`https://api.themoviedb.org/3/genre/tv/list?language=fr-FR&api_key=${apiKey}`) : Promise.resolve({ json: async () => ({ genres: tvGenreList }) })
      ])

      const detailsData = await detailsRes.json()
      const creditsDataFr = await creditsResFr.json()
      const creditsDataEn = await creditsResEn.json()
      const genresData = await genresRes.json()
      
      setActorDetails(detailsData)
      if (tvGenreList.length === 0 && Array.isArray(genresData.genres)) {
        setTvGenreList(genresData.genres)
      }

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
          .slice(0, 20)
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
            {actorCredits && actorCredits.length > 0 ? `${actorCredits.length} séries notables` : 'Aucun drama trouvé pour cet acteur.'}
          </p>
        </div>
      </div>

      <div className="actor-modal-filters" style={{ marginBottom: '2rem' }}>
        <div className="actor-modal-filter" style={{ gap: '0.75rem' }}>
          <label style={{ color: 'var(--secondary-text)', marginRight: '0.4rem' }}>Note min.</label>
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={actorRatingFilter}
            onChange={(e) => setActorRatingFilter(e.target.value)}
            style={{ width: '100px', padding: '0.6rem', borderRadius: '8px', border: '1px solid #444', background: '#111', color: '#fff' }}
            placeholder="0-10"
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', backgroundColor: '#111', padding: '0.9rem 1rem', borderRadius: '12px', border: '1px solid #333' }}>
          <label style={{ color: 'var(--secondary-text)' }}>Genre</label>
          <select
            value={actorGenreFilter}
            onChange={(e) => setActorGenreFilter(e.target.value)}
            style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid #444', background: '#111', color: '#fff', minWidth: '180px' }}
          >
            <option value="">Tous</option>
            {tvGenreList.map((genre) => (
              <option key={genre.id} value={genre.id}>{genre.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="actor-results-grid">
        {!actorCreditsLoading && actorCredits && actorCredits.length > 0 && actorCredits
          .filter((credit) => {
            if (actorRatingFilter && parseFloat(credit.vote_average || 0) < parseFloat(actorRatingFilter)) {
              return false
            }
            if (actorGenreFilter && !credit.genre_ids?.includes(parseInt(actorGenreFilter))) {
              return false
            }
            return true
          })
          .map((credit) => (
            <button
              key={credit.credit_id || credit.id}
              type="button"
              className="drama-card"
              onClick={() => onPreviewTmdb(credit.id)}
              style={{ cursor: 'pointer', minHeight: '100%', border: 'none', background: '#111', textAlign: 'left', padding: 0 }}
            >
              {credit.poster_path ? (
                <img src={`https://image.tmdb.org/t/p/w185${credit.poster_path}`} alt={credit.name} className="drama-poster" />
              ) : (
                <div className="drama-poster" style={{ backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#c7d0ff' }}>Pas d'image</span>
                </div>
              )}
              <div className="drama-info">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <h4 className="drama-title" title={credit.name}>{credit.name}</h4>
                  <span style={{ backgroundColor: '#111', color: '#7c9cff', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.85rem' }}>{credit.vote_average ? `${credit.vote_average.toFixed(1)}/10` : '–'}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  {(credit.genre_ids || []).map((genreId) => {
                    const genre = tvGenreList.find((g) => g.id === genreId)
                    return genre ? (
                      <span key={genreId} style={{ backgroundColor: '#222', color: 'var(--secondary-text)', padding: '0.2rem 0.45rem', borderRadius: '999px', fontSize: '0.75rem' }}>{genre.name}</span>
                    ) : null
                  })}
                </div>
                <div className="drama-genres">Rôle : {credit.displayRole || credit.character || credit.job || 'Inconnu'}</div>
              </div>
            </button>
          ))}
      </div>
    </div>
  )
}