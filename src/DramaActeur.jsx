import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function DramaActeur({ actorId, onBack, onSelectDrama }) {
  const [actorDetails, setActorDetails] = useState(null)
  const [actorCredits, setActorCredits] = useState(null)
  const [actorCreditsLoading, setActorCreditsLoading] = useState(true)
  const [tvGenreList, setTvGenreList] = useState([])
  const [actorRatingFilter, setActorRatingFilter] = useState('')
  const [actorGenreFilter, setActorGenreFilter] = useState('')
  const [selectedActorDramaDetails, setSelectedActorDramaDetails] = useState(null)
  const [selectedActorDramaLoading, setSelectedActorDramaLoading] = useState(false)
  const [selectedActorDramaTranslating, setSelectedActorDramaTranslating] = useState(false)
  const [selectedActorDramaTranslationProgress, setSelectedActorDramaTranslationProgress] = useState(0)
  const [addingActorDrama, setAddingActorDrama] = useState(false)
  const [actorDramaMessage, setActorDramaMessage] = useState('')

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

  const translateLongText = async (text, onProgress) => {
    if (!text) return ''
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
    let chunks = []
    let currentChunk = ''

    for (let sentence of sentences) {
      if ((currentChunk + sentence).length < 450) {
        currentChunk += sentence + ' '
      } else {
        chunks.push(currentChunk.trim())
        currentChunk = sentence + ' '
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim())

    let finalTranslation = ''
    const totalChunks = chunks.length
    for (let i = 0; i < totalChunks; i++) {
      const chunk = chunks[i]
      try {
        const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=en|fr`)
        const data = await response.json()
        if (data.responseData && data.responseData.translatedText && !data.responseData.translatedText.includes('QUERY LENGTH LIMIT')) {
          finalTranslation += data.responseData.translatedText + ' '
        } else {
          finalTranslation += chunk + ' '
        }
      } catch (error) {
        finalTranslation += chunk + ' '
      }
      if (typeof onProgress === 'function') {
        onProgress(Math.round(((i + 1) / totalChunks) * 100))
      }
    }

    return finalTranslation.trim()
  }

  const fetchActorDetails = async (actorId) => {
    setActorCreditsLoading(true)
    setActorDetails(null)
    setActorCredits(null)
    setActorRatingFilter('')
    setActorGenreFilter('')
    setSelectedActorDramaDetails(null)

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
      const actorName = getLatinDisplayName(detailsData, detailsData.name)
      
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

  const fetchActorDramaDetails = async (credit) => {
    setSelectedActorDramaLoading(true)
    setSelectedActorDramaTranslating(false)
    setSelectedActorDramaTranslationProgress(0)
    setActorDramaMessage('')

    setSelectedActorDramaDetails({
      ...credit,
      displayName: credit.name || credit.original_name || 'Drama',
      displayOriginalName: credit.original_name || '',
      displayOverview: '',
      genres: credit.genre_ids ? credit.genre_ids.map((id) => tvGenreList.find((g) => g.id === id)).filter(Boolean) : [],
      status: '',
      number_of_seasons: null,
      number_of_episodes: null,
      first_air_date: credit.first_air_date || ''
    })

    try {
      const apiKey = import.meta.env.VITE_TMDB_API_KEY
      const [detailsFrRes, detailsEnRes] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/tv/${credit.id}?language=fr-FR&append_to_response=credits,watch/providers&api_key=${apiKey}`),
        fetch(`https://api.themoviedb.org/3/tv/${credit.id}?language=en-US&append_to_response=credits,watch/providers&api_key=${apiKey}`)
      ])

      const detailsFr = await detailsFrRes.json()
      const detailsEn = await detailsEnRes.json()

      const displayName = getLatinText(detailsFr.name || detailsFr.original_name, detailsEn.name || detailsEn.original_name || detailsFr.original_name)
      const displayOriginalName = getLatinText(detailsFr.original_name, detailsEn.original_name || detailsFr.name)
      let displayOverview = detailsFr.overview || detailsEn.overview || ''

      if (!detailsFr.overview && detailsEn.overview) {
        setSelectedActorDramaTranslating(true)
        displayOverview = await translateLongText(detailsEn.overview, (progress) => setSelectedActorDramaTranslationProgress(progress))
        setSelectedActorDramaTranslating(false)
      }

      setSelectedActorDramaDetails({
        ...detailsFr,
        displayName,
        displayOriginalName,
        displayOverview
      })
    } catch (error) {
      console.error('Erreur lors de la récupération du drama sélectionné', error)
      setActorDramaMessage('Impossible de charger les informations du drama.')
    }

    setSelectedActorDramaLoading(false)
  }

  const addSelectedActorDramaToList = async () => {
    if (!selectedActorDramaDetails) return
    setAddingActorDrama(true)
    setActorDramaMessage('')

    try {
      const { data: authData } = await supabase.auth.getSession()
      const userId = authData?.session?.user?.id
      if (!userId) {
        setActorDramaMessage('Utilisateur non connecté.')
        setAddingActorDrama(false)
        return
      }

      const title = selectedActorDramaDetails.displayName || selectedActorDramaDetails.name || selectedActorDramaDetails.original_name || 'Titre inconnu'
      const { data: existing, error: existError } = await supabase
        .from('dramas')
        .select('id')
        .eq('user_id', userId)
        .eq('title', title)
        .limit(1)

      if (existError) {
        console.error('Erreur de vérification du drama existant', existError)
        setActorDramaMessage('Erreur lors de la vérification du drama.')
        setAddingActorDrama(false)
        return
      }

      if (existing?.length > 0) {
        setActorDramaMessage('Ce drama est déjà présent dans votre liste.')
        setAddingActorDrama(false)
        return
      }

      const genreString = selectedActorDramaDetails.genres?.map((genre) => genre.name).join(', ') || ''
      const posterUrl = selectedActorDramaDetails.poster_path ? `https://image.tmdb.org/t/p/w500${selectedActorDramaDetails.poster_path}` : null
      const siteRating = selectedActorDramaDetails.vote_average ? parseFloat(selectedActorDramaDetails.vote_average.toFixed(1)) : null

      const { error: insertError } = await supabase.from('dramas').insert([
        {
          title,
          genre: genreString,
          site_rating: siteRating || null,
          voirdrama_rating: null,
          personal_rating: null,
          comment: null,
          synopsis: selectedActorDramaDetails.displayOverview || selectedActorDramaDetails.overview || '',
          status: 'To Watch',
          poster_url: posterUrl,
          user_id: userId
        }
      ])

      if (insertError) {
        console.error('Erreur lors de l ajout du drama', insertError)
        setActorDramaMessage('Erreur lors de l’ajout à la liste.')
      } else {
        setActorDramaMessage('Drama ajouté à la liste À voir.')
      }
    } catch (error) {
      console.error('Erreur SQL lors de l ajout du drama', error)
      setActorDramaMessage('Erreur lors de l’ajout à la liste.')
    }

    setAddingActorDrama(false)
  }

  if (actorCreditsLoading) {
    return <div style={{ textAlign: 'center', marginTop: '3rem', fontSize: '1.2rem' }}>Chargement des détails de l'acteur...</div>
  }

  if (!actorDetails) {
    return <div style={{ textAlign: 'center', marginTop: '3rem' }}>Acteur introuvable.</div>
  }

  return (
    <div className="actor-modal">
      <div className="actor-modal-header">
        <div>
          <h2 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '2rem' }}>Dramas avec {getLatinDisplayName(actorDetails, actorDetails.name)}</h2>
          <p style={{ margin: '0.7rem 0 0', color: '#aaa' }}>
            {actorCredits && actorCredits.length > 0 ? `${actorCredits.length} résultats trouvés` : 'Aucun drama trouvé pour cet acteur.'}
          </p>
        </div>
        <button
          onClick={() => { setSelectedActorDramaDetails(null); onBack(); }}
          style={{ border: '1px solid var(--primary-color)', backgroundColor: 'transparent', color: 'var(--primary-color)', borderRadius: '999px', padding: '0.8rem 1.2rem', cursor: 'pointer', minWidth: '120px' }}
        >
          Fermer
        </button>
      </div>

      <div className="actor-modal-filters">
        <div className="actor-modal-filter" style={{ gap: '0.75rem' }}>
          <label style={{ color: '#aaa', marginRight: '0.4rem' }}>Note min.</label>
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
          <label style={{ color: '#aaa' }}>Genre</label>
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
        {actorCreditsLoading && <div style={{ color: '#aaa' }}>Chargement des dramas de l’acteur...</div>}


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
              onClick={() => onSelectDrama(credit.id)} // Changed to use onSelectDrama
              style={{ cursor: 'pointer', minHeight: '100%', border: 'none', background: '#111', textAlign: 'left', padding: 0 }}
            >
              {credit.poster_path ? (
                <img src={`https://image.tmdb.org/t/p/w185${credit.poster_path}`} alt={credit.name} className="drama-poster" />
              ) : (
                <div className="drama-poster" style={{ backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#888' }}>Pas d'image</span>
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
                      <span key={genreId} style={{ backgroundColor: '#222', color: '#aaa', padding: '0.2rem 0.45rem', borderRadius: '999px', fontSize: '0.75rem' }}>{genre.name}</span>
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
