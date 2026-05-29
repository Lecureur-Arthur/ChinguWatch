import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function TmdbPreview({ tmdbId, onBack, session }) {
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [translating, setTranslating] = useState(false)
  const [translationProgress, setTranslationProgress] = useState(0)
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState('')
  const [tvGenreList, setTvGenreList] = useState([])

  useEffect(() => {
    fetchGenresAndDetails()
  }, [tmdbId])

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

  const fetchGenresAndDetails = async () => {
    setLoading(true)
    setMessage('')
    try {
      const apiKey = import.meta.env.VITE_TMDB_API_KEY
      
      const genreRes = await fetch(`https://api.themoviedb.org/3/genre/tv/list?language=fr-FR&api_key=${apiKey}`)
      const genreData = await genreRes.json()
      setTvGenreList(genreData.genres || [])

      const [detailsFrRes, detailsEnRes] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?language=fr-FR&append_to_response=credits,watch/providers&api_key=${apiKey}`),
        fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?language=en-US&append_to_response=credits,watch/providers&api_key=${apiKey}`)
      ])

      const detailsFr = await detailsFrRes.json()
      const detailsEn = await detailsEnRes.json()

      const displayName = getLatinText(detailsFr.name || detailsFr.original_name, detailsEn.name || detailsEn.original_name || detailsFr.original_name)
      const displayOriginalName = getLatinText(detailsFr.original_name, detailsEn.original_name || detailsFr.name)
      let displayOverview = detailsFr.overview || detailsEn.overview || ''

      if (!detailsFr.overview && detailsEn.overview) {
        setTranslating(true)
        displayOverview = await translateLongText(detailsEn.overview, setTranslationProgress)
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
      const { data: existing, error: existError } = await supabase
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
          tmdb_id: tmdbId
        }
      ])

      if (insertError) {
        setMessage('Erreur lors de l’ajout à la liste.')
      } else {
        setMessage('Drama ajouté à la liste À voir.')
      }
    } catch (error) {
      setMessage('Erreur lors de l’ajout à la liste.')
    }
    setAdding(false)
  }

  if (loading) return <div style={{ textAlign: 'center', marginTop: '3rem' }}>Chargement des détails...</div>
  if (!details) return <div style={{ textAlign: 'center', marginTop: '3rem' }}>Erreur de chargement.</div>

  return (
    <div className="detail-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <button className="back-btn" onClick={onBack} style={{ margin: 0 }}>
          Retour
        </button>
        <button
          onClick={addToList}
          disabled={adding}
          style={{ border: 'none', backgroundColor: 'var(--primary-color)', color: '#000', borderRadius: '999px', padding: '0.8rem 1.5rem', fontWeight: 'bold' }}
        >
          {adding ? 'Ajout...' : 'Ajouter à la liste À voir'}
        </button>
      </div>

      {message && <div style={{ marginBottom: '1.5rem', color: 'var(--secondary-text)', textAlign: 'right' }}>{message}</div>}

      <div className="detail-header">
        <div className="detail-poster-container">
          {details.poster_path ? (
            <img src={`https://image.tmdb.org/t/p/w500${details.poster_path}`} alt={details.displayName} />
          ) : (
            <div style={{ width: '100%', aspectRatio: '2 / 3', backgroundColor: '#222', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Pas d'image</div>
          )}
        </div>
        <div className="detail-info-container">
          <h2 className="detail-title">{details.displayName}</h2>
          {details.displayOriginalName && details.displayOriginalName !== details.displayName && (
            <p style={{ margin: '0 0 1.5rem 0', color: '#aaa' }}>Original : {details.displayOriginalName}</p>
          )}

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <div style={{ backgroundColor: '#1a1a1a', padding: '0.8rem 1.2rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase' }}>Note TMDB</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{details.vote_average ? `${details.vote_average.toFixed(1)}/10` : '-'}</div>
            </div>
            <div style={{ backgroundColor: '#1a1a1a', padding: '0.8rem 1.2rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase' }}>Statut</div>
              <div style={{ fontSize: '1.1rem', color: '#fff', marginTop: '0.2rem' }}>{details.status || 'Inconnu'}</div>
            </div>
          </div>

          {translating ? (
            <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: '#111', border: '1px solid #333' }}>
              <div style={{ color: '#ccc', marginBottom: '0.75rem' }}>Traduction du synopsis en cours...</div>
              <div style={{ width: '100%', backgroundColor: '#222', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: `${translationProgress}%`, height: '10px', backgroundColor: 'var(--primary-color)', transition: 'width 0.2s ease' }} />
              </div>
            </div>
          ) : (
            <p style={{ lineHeight: '1.7', color: '#ddd' }}>{details.displayOverview || 'Aucun synopsis disponible.'}</p>
          )}
        </div>
      </div>

      <div className="detail-meta-grid">
        <div className="meta-item">
          <span className="meta-label">Saisons</span>
          <span className="meta-value">{details.number_of_seasons ?? '–'}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Épisodes</span>
          <span className="meta-value">{details.number_of_episodes ?? '–'}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Première diffusion</span>
          <span className="meta-value">{details.first_air_date ? new Date(details.first_air_date).toLocaleDateString('fr-FR') : 'Inconnue'}</span>
        </div>
      </div>
    </div>
  )
}