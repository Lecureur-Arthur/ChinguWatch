import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function DramaDetail({ dramaId, onBack }) {
  const [localDrama, setLocalDrama] = useState(null)
  const [tmdbData, setTmdbData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState('To Watch')
  const [personalRating, setPersonalRating] = useState('')
  const [commentText, setCommentText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [selectedActorName, setSelectedActorName] = useState('')
  const [actorDetails, setActorDetails] = useState(null)
  const [actorCredits, setActorCredits] = useState(null)
  const [actorCreditsLoading, setActorCreditsLoading] = useState(false)
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
    fetchDramaDetails()
  }, [dramaId])

  const fetchDramaDetails = async () => {
    setLoading(true)

    // Je récupère d'abord les informations enregistrées dans ma propre base de données Supabase
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

// Si un tmdb_id est déjà stocké, on l'utilise directement.
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

  // Je traduis les statuts de diffusion anglais en français pour une interface homogène
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


  const handleActorClick = async (actor) => {
    setSelectedActorName(actor.name)
    setActorDetails(null)
    setActorCredits(null)
    setActorCreditsLoading(true)
    setActorRatingFilter('')
    setActorGenreFilter('')

    try {
      const apiKey = import.meta.env.VITE_TMDB_API_KEY
      const [detailsRes, creditsResFr, creditsResEn, genresRes] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/person/${actor.id}?language=fr-FR&api_key=${apiKey}`),
        fetch(`https://api.themoviedb.org/3/person/${actor.id}/tv_credits?language=fr-FR&api_key=${apiKey}`),
        fetch(`https://api.themoviedb.org/3/person/${actor.id}/tv_credits?language=en-US&api_key=${apiKey}`),
        tvGenreList.length === 0 ? fetch(`https://api.themoviedb.org/3/genre/tv/list?language=fr-FR&api_key=${apiKey}`) : Promise.resolve({ json: async () => ({ genres: tvGenreList }) })
      ])

      const detailsData = await detailsRes.json()
      const creditsDataFr = await creditsResFr.json()
      const creditsDataEn = await creditsResEn.json()
      const genresData = await genresRes.json()
      const actorName = getLatinDisplayName(detailsData, actor.name)
      setSelectedActorName(actorName)
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

  // J'extrais les plateformes de streaming disponibles spécifiquement sur le territoire français
  const getWatchProviders = () => {
    if (!tmdbData?.['watch/providers']?.results?.FR) return []
    const frProviders = tmdbData['watch/providers'].results.FR
    // Je regroupe les plateformes d'abonnement gratuit ou payant pour maximiser les options
    const flatrate = frProviders.flatrate || []
    const free = frProviders.free || []
    
    const allProviders = [...flatrate, ...free]
    // Je filtre les doublons éventuels basés sur l'identifiant de la plateforme
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
        Retour à la liste
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
            <div style={{ backgroundColor: '#1a1a1a', padding: '0.8rem 1.2rem', borderRadius: '8px', border: '1px solid var(--border-color)', minWidth: '155px' }}>
              <div style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase' }}>Catégorie actuelle</div>
              <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{translateAppStatus(localDrama.status)}</div>
            </div>

            <button
              onClick={() => setEditMode((prev) => !prev)}
              style={{ padding: '0.8rem 1.2rem', borderRadius: '8px', border: '1px solid var(--primary-color)', backgroundColor: editMode ? '#161616' : 'transparent', color: 'var(--primary-color)', cursor: 'pointer', minWidth: '150px' }}
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

      {/* J'affiche la grille des métadonnées uniquement si l'API TMDB a renvoyé des résultats exploitables */}
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
                    onClick={() => handleActorClick(actor)}
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

          {selectedActorName && (
            <div className="actor-modal">
              <div className="actor-modal-header">
                <div>
                  <h2 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '2rem' }}>Dramas avec {selectedActorName}</h2>
                  <p style={{ margin: '0.7rem 0 0', color: '#aaa' }}>
                    {actorCreditsLoading ? 'Chargement des dramas...' : actorCredits && actorCredits.length > 0 ? `${actorCredits.length} résultats trouvés` : 'Aucun drama trouvé pour cet acteur.'}
                  </p>
                </div>
                <button
                  onClick={() => { setSelectedActorName(''); setActorCredits(null); setActorCreditsLoading(false); }}
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
                      onClick={() => fetchActorDramaDetails(credit)}
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
          )}

          {selectedActorDramaDetails && (
            <div className="actor-drama-detail-page">
              <div className="detail-container" style={{ width: '100%', margin: '0 auto', boxShadow: '0 12px 30px rgba(0,0,0,0.6)', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                  <div>
                    <h2 className="detail-title" style={{ margin: '0' }}>{selectedActorDramaDetails.displayName || selectedActorDramaDetails.name}</h2>
                    {selectedActorDramaDetails.displayOriginalName && selectedActorDramaDetails.displayOriginalName !== selectedActorDramaDetails.displayName && (
                      <p style={{ margin: '0.5rem 0 0', color: '#aaa' }}>Original : {selectedActorDramaDetails.displayOriginalName}</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedActorDramaDetails(null)}
                      style={{ border: '1px solid var(--primary-color)', backgroundColor: 'transparent', color: 'var(--primary-color)', borderRadius: '999px', padding: '0.8rem 1.2rem', cursor: 'pointer', minWidth: '140px' }}
                    >
                      Retour aux dramas
                    </button>
                    <button
                      type="button"
                      onClick={addSelectedActorDramaToList}
                      disabled={addingActorDrama}
                      style={{ border: 'none', backgroundColor: 'var(--primary-color)', color: '#000', borderRadius: '999px', padding: '0.8rem 1.2rem', cursor: 'pointer', minWidth: '180px' }}
                    >
                      {addingActorDrama ? 'Ajout en cours...' : 'Ajouter à la liste À voir'}
                    </button>
                  </div>
                </div>

                {selectedActorDramaLoading && !selectedActorDramaTranslating && (
                  <div style={{ marginBottom: '1rem', color: '#ddd' }}>Chargement des informations du drama... La page est ouverte, patientez un instant.</div>
                )}
                <div className="detail-header" style={{ gap: '2rem', marginBottom: '1.5rem' }}>
                  <div className="detail-poster-container" style={{ width: '100%', maxWidth: '350px' }}>
                    {selectedActorDramaDetails.poster_path ? (
                      <img src={`https://image.tmdb.org/t/p/w500${selectedActorDramaDetails.poster_path}`} alt={selectedActorDramaDetails.displayName || selectedActorDramaDetails.name} />
                    ) : (
                      <div style={{ width: '100%', aspectRatio: '2 / 3', backgroundColor: '#222', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>Pas d'image</div>
                    )}
                  </div>
                  <div className="detail-info-container" style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                      <div style={{ backgroundColor: '#1a1a1a', padding: '0.8rem 1.2rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase' }}>Note TMDB</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{selectedActorDramaDetails.vote_average ? `${selectedActorDramaDetails.vote_average.toFixed(1)}/10` : '-'}</div>
                      </div>
                      <div style={{ backgroundColor: '#1a1a1a', padding: '0.8rem 1.2rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase' }}>Statut</div>
                        <div style={{ fontSize: '1.1rem', color: '#fff' }}>{selectedActorDramaDetails.status || 'Inconnu'}</div>
                      </div>
                    </div>
                    {selectedActorDramaTranslating ? (
                      <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: '#111', border: '1px solid #333' }}>
                        <div style={{ color: '#ccc', marginBottom: '0.75rem' }}>Traduction du synopsis en cours...</div>
                        <div style={{ width: '100%', backgroundColor: '#222', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: `${selectedActorDramaTranslationProgress}%`, height: '10px', backgroundColor: 'var(--primary-color)', transition: 'width 0.2s ease' }} />
                        </div>
                        <div style={{ marginTop: '0.75rem', color: '#aaa', fontSize: '0.9rem' }}>{selectedActorDramaTranslationProgress}%</div>
                      </div>
                    ) : (
                      <p style={{ lineHeight: '1.7', color: '#ddd' }}>{selectedActorDramaDetails.displayOverview || 'Aucun synopsis disponible.'}</p>
                    )}
                  </div>
                </div>

                <div className="detail-meta-grid">
                  <div className="meta-item">
                    <span className="meta-label">Saisons</span>
                    <span className="meta-value">{selectedActorDramaDetails.number_of_seasons ?? '–'}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Épisodes</span>
                    <span className="meta-value">{selectedActorDramaDetails.number_of_episodes ?? '–'}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Première diffusion</span>
                    <span className="meta-value">{selectedActorDramaDetails.first_air_date ? new Date(selectedActorDramaDetails.first_air_date).toLocaleDateString('fr-FR') : 'Inconnue'}</span>
                  </div>
                </div>

                {actorDramaMessage && (
                  <div style={{ marginTop: '1rem', color: '#ccc' }}>{actorDramaMessage}</div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}