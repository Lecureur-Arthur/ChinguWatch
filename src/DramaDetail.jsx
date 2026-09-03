import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { translateLongText } from './translationService'

const TMDB_TV_GENRES = {
  10759: "Action & Aventure", 16: "Animation", 35: "Comédie", 80: "Crime",
  99: "Documentaire", 18: "Drame", 10751: "Familial", 10762: "Kids",
  9648: "Mystère", 10763: "News", 10764: "Reality", 10765: "Sci-Fi & Fantasy",
  10766: "Soap", 10767: "Talk", 10768: "Guerre & Politique", 37: "Western"
};

export default function DramaDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()

  const [userDramas, setUserDramas] = useState([])
  const [previewMode, setPreviewMode] = useState(false)
  const [seenActors, setSeenActors] = useState(new Set())

  const [showRuntimeModal, setShowRuntimeModal] = useState(false)
  const [editRuntime, setEditRuntime] = useState(0)

  const [localDrama, setLocalDrama] = useState(null)
  const [tmdbData, setTmdbData] = useState(null)
  const [englishTitle, setEnglishTitle] = useState('')
  const [originalTitle, setOriginalTitle] = useState('')
  const [frenchTitle, setFrenchTitle] = useState('')
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
  const [editingField, setEditingField] = useState(null)

  // --- États pour la Modale Acteur ---
  const [selectedActor, setSelectedActor] = useState(null)
  const [actorCredits, setActorCredits] = useState([])
  const [loadingActor, setLoadingActor] = useState(false)

  // --- NOUVEAUX ÉTATS POUR LES SAISONS ---
  const [tmdbSeasons, setTmdbSeasons] = useState([])
  const [seasonsProgress, setSeasonsProgress] = useState({})

  // --- États pour la boîte modale de durée ---
  const [runtimeModalOpen, setRuntimeModalOpen] = useState(false)
  const [runtimeMode, setRuntimeMode] = useState('average')
  const [avgHours, setAvgHours] = useState('')
  const [avgMinutes, setAvgMinutes] = useState('')
  const [totalHours, setTotalHours] = useState('')
  const [totalMinutes, setTotalMinutes] = useState('')
  const [individualRuntimes, setIndividualRuntimes] = useState([])

  const latinPattern = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 .,'\-()]+$/

  const createSlug = (title) => {
    return title ? title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim() : ''
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
      fetchRomanizedCastNames(tmdbData.credits.cast.slice(0, 16))
    }
  }, [tmdbData])

  useEffect(() => {
    setSelectedActor(null)
    setPreviewMode(false)
    fetchDramaDetails()
  }, [slug])

  // --- VERIFICATION DES ACTEURS "DÉJÀ VUS" ---
  useEffect(() => {
    const findSeenActors = async () => {
      if (!tmdbData?.credits?.cast || !userDramas || userDramas.length === 0) return;

      const watchedTmdbIds = userDramas
        .filter(d => d.status === 'Watched' && d.tmdb_id)
        .map(d => d.tmdb_id);

      if (watchedTmdbIds.length === 0) return;

      const apiKey = import.meta.env.VITE_TMDB_API_KEY;
      const castToCheck = tmdbData.credits.cast.slice(0, 16);
      const seenSet = new Set();

      await Promise.all(
        castToCheck.map(async (actor) => {
          try {
            const res = await fetch(`https://api.themoviedb.org/3/person/${actor.id}/tv_credits?api_key=${apiKey}`);
            const data = await res.json();
            
            if (data.cast) {
              const hasSeen = data.cast.some(credit => watchedTmdbIds.includes(credit.id));
              if (hasSeen) {
                seenSet.add(actor.id);
              }
            }
          } catch (err) {}
        })
      );

      setSeenActors(seenSet);
    };

    findSeenActors();
  }, [tmdbData, userDramas]);

  const handleAddToCatalog = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return;

    const newDrama = {
      user_id: user.id,
      title: englishTitle,
      poster_url: localDrama.poster_url,
      status: 'To Watch', 
      site_rating: localDrama.site_rating,
      tmdb_id: localDrama.tmdb_id,
      episode_run_time: localDrama.episode_run_time,
      number_of_seasons: localDrama.number_of_seasons || null,
      number_of_episodes: localDrama.number_of_episodes || null,
      synopsis: tmdbSynopsis,
      seasons_progress: {}
    }

    const { data, error } = await supabase.from('dramas').insert([newDrama]).select()

    if (error) {
      alert("Erreur lors de l'ajout : " + error.message)
      setSaving(false)
    } else {
      navigate(`/drama/${createSlug(englishTitle)}`)
    }
  }

  const handleQuickAdd = async (e, credit) => {
    e.preventDefault();
    e.stopPropagation();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const englishTitle = credit.title_en || credit.name;
    const newDrama = {
      user_id: user.id,
      title: englishTitle,
      poster_url: credit.poster_path ? `https://image.tmdb.org/t/p/w500${credit.poster_path}` : null,
      status: 'To Watch',
      site_rating: credit.vote_average || null,
      tmdb_id: credit.id,
      episode_run_time: 0,
      number_of_seasons: credit.number_of_seasons || null,
      number_of_episodes: credit.total_episodes || credit.number_of_episodes || null,
      synopsis: credit.overview || '',
      seasons_progress: {}
    };

    const { data, error } = await supabase.from('dramas').insert([newDrama]).select();

    if (error) {
      alert("Erreur lors de l'ajout rapide : " + error.message);
    } else if (data && data.length > 0) {
      setUserDramas(prev => [...prev, data[0]]);
    }
  };

  const fetchDramaDetails = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: allDramas } = await supabase.from('dramas').select('*').eq('user_id', user.id)
    setUserDramas(allDramas || [])

    const apiKey = import.meta.env.VITE_TMDB_API_KEY

    // ---------- MODE PREVIEW ----------
    if (slug.startsWith('preview-')) {
      setPreviewMode(true)
      const tmdbId = slug.replace('preview-', '')
      try {
        const [detailResFr, detailResEn] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?language=fr-FR&append_to_response=credits,watch/providers&api_key=${apiKey}`),
          fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?language=en-US&append_to_response=credits,watch/providers&api_key=${apiKey}`)
        ])
        const detailDataFr = await detailResFr.json()
        const detailDataEn = await detailResEn.json()
        setTmdbData(detailDataFr)
        setTmdbSeasons(detailDataFr.seasons || [])

        const englishTitle = detailDataEn.name || detailDataEn.original_name || 'Titre Inconnu'
        const originalTitle = detailDataFr.original_name || detailDataEn.original_name || englishTitle
        const frenchTitle = detailDataFr.name || englishTitle

        setEnglishTitle(englishTitle)
        setOriginalTitle(originalTitle)
        setFrenchTitle(frenchTitle)

        setLocalDrama({
          id: 'preview',
          title: englishTitle,
          poster_url: detailDataFr.poster_path ? `https://image.tmdb.org/t/p/w500${detailDataFr.poster_path}` : null,
          status: 'Not Added',
          personal_rating: null,
          site_rating: detailDataFr.vote_average,
          voirdrama_rating: null,
          comment: null,
          episode_run_time: (detailDataFr.episode_run_time && detailDataFr.episode_run_time.length > 0) ? detailDataFr.episode_run_time[0] : 0,
          number_of_seasons: detailDataFr.number_of_seasons || null,
          number_of_episodes: detailDataFr.number_of_episodes || null,
          tmdb_id: tmdbId
        })

        const frOverview = detailDataFr.overview
        const enOverview = detailDataEn.overview
        if (frOverview && frOverview.trim() !== '') {
          setTmdbSynopsis(frOverview)
        } else if (enOverview && enOverview.trim() !== '') {
          setTmdbSynopsis(enOverview)
        } else {
          setTmdbSynopsis('Aucun synopsis disponible.')
        }
      } catch (error) {}
      setLoading(false)
      return
    }

    // ---------- MODE CATALOGUE ----------
    const dbData = (allDramas || []).find(d => createSlug(d.title) === slug)

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
    setEnglishTitle(dbData.title)
    setOriginalTitle(dbData.title)

    let tmdbId = dbData.tmdb_id || null
    try {
      if (!tmdbId) {
        const query = encodeURIComponent(dbData.title || '')
        const [responseFr, responseEn] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/search/tv?query=${query}&language=fr-FR&api_key=${apiKey}`),
          fetch(`https://api.themoviedb.org/3/search/tv?query=${query}&language=en-US&api_key=${apiKey}`)
        ])
        const dataFr = await responseFr.json()
        const dataEn = await responseEn.json()
        const results = [...(dataFr.results || []), ...(dataEn.results || [])]
        const exactMatch = results.find((item) => [item.name, item.original_name].some((value) => value?.trim().toLowerCase() === dbData.title?.trim().toLowerCase()))
        tmdbId = exactMatch ? exactMatch.id : results[0]?.id || null
      }

      if (tmdbId) {
        const [detailResFr, detailResEn] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?language=fr-FR&append_to_response=credits,watch/providers&api_key=${apiKey}`),
          fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?language=en-US&append_to_response=credits,watch/providers&api_key=${apiKey}`)
        ])
        const detailDataFr = await detailResFr.json()
        const detailDataEn = await detailResEn.json()
        setTmdbData(detailDataFr)

        const englishTitle = detailDataEn.name || detailDataEn.original_name || dbData.title
        const originalTitle = detailDataFr.original_name || detailDataEn.original_name || dbData.title
        const frenchTitle = detailDataFr.name || englishTitle

        setEnglishTitle(englishTitle)
        setOriginalTitle(originalTitle)
        setFrenchTitle(frenchTitle)

        const frOverview = detailDataFr.overview
        const enOverview = detailDataEn.overview
        if (frOverview && frOverview.trim() !== '') {
          setTmdbSynopsis(frOverview)
        } else if (enOverview && enOverview.trim() !== '') {
          setTmdbSynopsis(enOverview)
        } else {
          setTmdbSynopsis('Aucun synopsis disponible.')
        }

        // --- RÉTROCOMPATIBILITÉ ET REMPLISSAGE INTELLIGENT DES SAISONS ---
        const ongoingStatuses = ['Returning Series', 'In Production', 'Pilot', 'Pilote', 'De retour', 'En production'];
        const isOngoing = ongoingStatuses.includes(detailDataFr.status) || ongoingStatuses.includes(detailDataEn.status);

        let currentOverallStatus = dbData.status;

        if (currentOverallStatus === 'Watched' && isOngoing) {
          currentOverallStatus = 'Watching';
          setSelectedStatus('Watching');
          setLocalDrama(prev => prev ? { ...prev, status: 'Watching' } : prev);
          await supabase.from('dramas').update({ status: 'Watching' }).eq('id', dbData.id);
        }

        const fetchedSeasons = detailDataFr.seasons || []
        setTmdbSeasons(fetchedSeasons)

        const currentProgress = { ...(dbData.seasons_progress || {}) }
        
        fetchedSeasons.filter(s => s.season_number > 0).forEach(s => {
          if (!currentProgress[s.season_number]) {
            currentProgress[s.season_number] = (currentOverallStatus === 'Watched' || currentOverallStatus === 'Watching') ? currentOverallStatus : 'To Watch'
          }
        })
        setSeasonsProgress(currentProgress)
      }
    } catch (error) {}
    setLoading(false)
  }

  const translateStatus = (status) => {
    const statusMap = { 'Ended': 'Terminé', 'Returning Series': 'En cours de production', 'Canceled': 'Annulé', 'In Production': 'En production', 'Pilot': 'Pilote' }
    return statusMap[status] || status || 'Inconnu'
  }

  const translateAppStatus = (status) => {
    const appStatusMap = { 'To Watch': 'À voir', 'Watching': 'En cours', 'Watched': 'Vu', 'Not Found': 'Introuvable' }
    return appStatusMap[status] || status
  }

  const fetchActorCredits = async (actor) => {
    setSelectedActor(actor)
    setLoadingActor(true)
    setActorCredits([])
    
    try {
      const apiKey = import.meta.env.VITE_TMDB_API_KEY
      
      const res = await fetch(`https://api.themoviedb.org/3/person/${actor.id}/tv_credits?language=fr-FR&api_key=${apiKey}`)
      const data = await res.json()
      
      if (data.cast) {
        const topCredits = data.cast
          .filter(credit => credit.character && !credit.genre_ids.includes(10767))
          .sort((a, b) => b.popularity - a.popularity)
          .slice(0, 20);
        
        const creditsWithDetails = await Promise.all(
          topCredits.map(async (credit) => {
            try {
              const [detailResFr, detailResEn] = await Promise.all([
                fetch(`https://api.themoviedb.org/3/tv/${credit.id}?language=fr-FR&api_key=${apiKey}`),
                fetch(`https://api.themoviedb.org/3/tv/${credit.id}?language=en-US&api_key=${apiKey}`)
              ]);
              
              const detailDataFr = await detailResFr.json();
              const detailDataEn = await detailResEn.json();
              
              const enTitle = detailDataEn.name || detailDataEn.original_name;
              const origTitle = detailDataFr.original_name;
              let frTitle = detailDataFr.name;

              if (!frTitle || frTitle === enTitle || frTitle === origTitle) {
                const textToTranslate = enTitle || origTitle;
                if (textToTranslate) {
                  const forcedFr = await translateLongText(textToTranslate);
                  if (forcedFr) {
                    frTitle = forcedFr;
                  }
                }
              }

              return { 
                ...credit, 
                number_of_seasons: detailDataFr.number_of_seasons,
                total_episodes: detailDataFr.number_of_episodes,
                tmdb_status: detailDataFr.status, 
                title_en: enTitle,
                title_orig: origTitle,
                title_fr: frTitle || enTitle
              };
            } catch (err) {
              return credit; 
            }
          })
        );

        setActorCredits(creditsWithDetails);
      }
    } catch (error) {}
    setLoadingActor(false)
  }

  // --- MISE À JOUR CASCADÉE DES SAISONS AVEC SÉCURITÉ ---
  const handleSeasonStatusChange = async (seasonNum, newStat) => {
    let updatedProgress = { ...seasonsProgress };
    const relevantSeasons = tmdbSeasons.filter(s => s.season_number > 0);
    const maxSeasonNum = relevantSeasons.length > 0 ? Math.max(...relevantSeasons.map(s => s.season_number)) : 0;
    
    const ongoingStatuses = ['Returning Series', 'In Production', 'Pilot', 'Pilote', 'De retour', 'En production'];
    const isOngoing = ongoingStatuses.includes(tmdbData?.status);

    // SECURITÉ : Empêche la dernière saison d'être passée en "Vu" si en production
    if (newStat === 'Watched' && isOngoing && seasonNum === maxSeasonNum) {
      alert("La série est en cours de production. La dernière saison ne peut pas être marquée comme 'Vu'.");
      return;
    }

    relevantSeasons.forEach(s => {
      const i = s.season_number;
      const currentStat = updatedProgress[i] || 'To Watch';

      if (newStat === 'Watched') {
        // Si "Vu" => cette saison et les précédentes en "Vu", les suivantes en "En cours"
        if (i <= seasonNum) {
          updatedProgress[i] = 'Watched';
        } else {
          updatedProgress[i] = 'Watching';
        }
      } else if (newStat === 'Watching') {
        // Si "En cours" =>
        if (i < seasonNum) {
          // Les précédentes passent en "En cours" UNIQUEMENT si elles étaient "À voir"
          if (currentStat === 'To Watch') {
            updatedProgress[i] = 'Watching';
          }
        } else {
          // Cette saison et les suivantes passent en "En cours"
          updatedProgress[i] = 'Watching';
        }
      } else if (newStat === 'To Watch') {
        // Si "À voir" => TOUTES les saisons repassent en "À voir"
        updatedProgress[i] = 'To Watch';
      }
    });

    setSeasonsProgress(updatedProgress);

    // Évaluation du statut global de la série
    const allWatched = relevantSeasons.every(s => updatedProgress[s.season_number] === 'Watched');
    const anyWatching = relevantSeasons.some(s => updatedProgress[s.season_number] === 'Watching' || updatedProgress[s.season_number] === 'Watched');

    let newOverallStatus = 'To Watch';
    if (allWatched) {
      newOverallStatus = isOngoing ? 'Watching' : 'Watched';
    } else if (anyWatching) {
      newOverallStatus = 'Watching';
    }

    setSelectedStatus(newOverallStatus);
    setLocalDrama(prev => ({ ...prev, status: newOverallStatus, seasons_progress: updatedProgress }));

    await supabase.from('dramas').update({
      seasons_progress: updatedProgress,
      status: newOverallStatus
    }).eq('id', localDrama.id);
  }

  const saveSpecificField = async (field) => {
    setSaving(true)
    let updatePayload = {}
    
    if (field === 'status') {
      const ongoingStatuses = ['Returning Series', 'In Production', 'Pilot', 'Pilote', 'De retour', 'En production'];
      const isOngoing = ongoingStatuses.includes(tmdbData?.status);
      
      if (selectedStatus === 'Watched' && isOngoing) {
        alert("Cette série est encore en production. Elle a été placée dans 'En cours'.");
        updatePayload = { status: 'Watching' };
        setSelectedStatus('Watching');
        setLocalDrama(prev => ({ ...prev, status: 'Watching' }));
      } else {
        updatePayload = { status: selectedStatus }
      }
    } else if (field === 'personal_rating') {
      updatePayload = { personal_rating: personalRating ? parseFloat(personalRating) : null }
    } else if (field === 'voirdrama_rating') {
      updatePayload = { voirdrama_rating: voirDramaRating ? parseFloat(voirDramaRating) : null }
    } else if (field === 'comment') {
      updatePayload = { comment: commentText || null }
    } else if (field === 'episode_run_time') {
      updatePayload = { episode_run_time: editRuntime ? parseInt(editRuntime, 10) : 0 }
    }

    const { error } = await supabase.from('dramas').update(updatePayload).eq('id', localDrama.id)

    if (error) {
      alert('Erreur lors de la sauvegarde : ' + error.message)
    } else {
      setEditingField(null)
      setShowRuntimeModal(false)
      await fetchDramaDetails()
    }
    setSaving(false)
  }

  const openRuntimeModal = (e) => {
    e.preventDefault()
    setRuntimeMode('average')
    const baseDuration = localDrama?.episode_run_time || 0
    const h = baseDuration >= 60 ? Math.floor(baseDuration / 60).toString() : ''
    const m = baseDuration > 0 ? (baseDuration % 60).toString() : ''

    setAvgHours(h)
    setAvgMinutes(m)
    setTotalHours('')
    setTotalMinutes('')
    
    const episodesCount = localDrama?.number_of_episodes || tmdbData?.number_of_episodes || 1
    setIndividualRuntimes(Array(episodesCount).fill({ h, m }))
    setRuntimeModalOpen(true)
  }

  const handleIndividualChange = (index, field, value) => {
    const newRuntimes = [...individualRuntimes]
    newRuntimes[index] = { ...newRuntimes[index], [field]: value }
    setIndividualRuntimes(newRuntimes)
  }

  const handleSaveRuntime = async () => {
    if (!localDrama) return

    let calculatedRuntime = 0
    const episodesCount = localDrama.number_of_episodes || tmdbData?.number_of_episodes || 1

    if (runtimeMode === 'average') {
      const h = parseInt(avgHours, 10) || 0
      const m = parseInt(avgMinutes, 10) || 0
      calculatedRuntime = (h * 60) + m
    } else if (runtimeMode === 'individual') {
      const totalMins = individualRuntimes.reduce((acc, val) => {
        const h = parseInt(val.h, 10) || 0
        const m = parseInt(val.m, 10) || 0
        return acc + (h * 60) + m
      }, 0)
      calculatedRuntime = totalMins > 0 ? Math.round(totalMins / episodesCount) : 0
    } else {
      const hours = parseInt(totalHours, 10) || 0
      const minutes = parseInt(totalMinutes, 10) || 0
      const totalMins = (hours * 60) + minutes
      calculatedRuntime = Math.round(totalMins / episodesCount)
    }

    if (isNaN(calculatedRuntime) || calculatedRuntime <= 0) {
      alert("Veuillez entrer une durée valide.")
      return
    }

    const { error } = await supabase.from('dramas').update({ episode_run_time: calculatedRuntime }).eq('id', localDrama.id)

    if (error) {
      alert("Erreur lors de la mise à jour : " + error.message)
    } else {
      setLocalDrama({ ...localDrama, episode_run_time: calculatedRuntime })
      setRuntimeModalOpen(false)
    }
  }

  const getWatchProviders = () => {
    if (!tmdbData?.['watch/providers']?.results?.FR) return []
    const frProviders = tmdbData['watch/providers'].results.FR
    const flatrate = frProviders.flatrate || []
    const free = frProviders.free || []
    const allProviders = [...flatrate, ...free]
    return Array.from(new Map(allProviders.map(item => [item.provider_id, item])).values())
  }

  const { hasNetflix, hasPrimeVideo, hasDisneyPlus } = (() => {
    const providerNames = getWatchProviders().map(p => p.provider_name)
    return {
      hasNetflix: providerNames.includes('Netflix'),
      hasPrimeVideo: providerNames.includes('Amazon Prime Video'),
      hasDisneyPlus: providerNames.includes('Disney Plus')
    }
  })()

  const openLink = (platform) => {
    const title = englishTitle || localDrama?.title || ''
    const encodedTitle = encodeURIComponent(title)
    const slugName = createSlug(title)
    const links = {
      voirDrama: `https://voirdrama.to/drama/${slugName}/`,
      netflix: `https://www.netflix.com/search?q=${encodedTitle}`,
      primeVideo: `https://www.primevideo.com/search?q=${encodedTitle}`,
      disneyPlus: `https://www.disneyplus.com/search?q=${encodedTitle}`
    }
    window.open(links[platform], '_blank', 'noopener,noreferrer')
  }

  const handleCopyAndOpenVoirDrama = () => {
    const titleToCopy = originalTitle || englishTitle || localDrama?.title || ''
    navigator.clipboard.writeText(titleToCopy).catch(err => {})
    window.open('https://voirdrama.to/', '_blank', 'noopener,noreferrer')
  }

  if (loading) return <div style={{ color: '#fff' }}>Chargement...</div>
  if (!localDrama) return <div style={{ color: '#fff' }}>Série introuvable.</div>

  return (
    <div className="detail-container">
      
      <div className="detail-top-section">
        
        <div className="detail-poster-col">
          {localDrama.poster_url ? (
            <img src={localDrama.poster_url} alt={englishTitle} className="glow-poster" />
          ) : (
            <div className="glow-poster" style={{ backgroundColor: '#1b243b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#888' }}>Pas d'image</span>
            </div>
          )}
        </div>

        <div className="detail-info-col">
          
          <div className="detail-header-split">
            
            <div className="detail-header-left">
              <h1 className="detail-title-en">{englishTitle}</h1>
              <h2 className="detail-title-orig">{originalTitle}</h2>
              <h3 className="detail-title-fr">
                {frenchTitle !== englishTitle && frenchTitle !== originalTitle ? frenchTitle : ''}
              </h3>

              <div className="streaming-grid" style={{ marginBottom: 0 }}>
                <div className="streaming-col">
                  <button onClick={() => openLink('voirDrama')} className="streaming-badge">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>
                    VoirDrama
                  </button>
                  <button onClick={handleCopyAndOpenVoirDrama} className="streaming-badge">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    VoirDrama
                  </button>
                </div>

                <div className="streaming-col">
                  <button disabled className="streaming-badge">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    Platform 1
                  </button>
                  <button disabled className="streaming-badge">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    Platform 2
                  </button>
                  <button disabled className="streaming-badge">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    Platform 3
                  </button>
                </div>

                <div className="streaming-col">
                  <button onClick={() => openLink('netflix')} disabled={!hasNetflix} className="streaming-badge">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4v16l7-10 7 10V4"></path></svg>
                    Netflix
                  </button>
                  <button onClick={() => openLink('primeVideo')} disabled={!hasPrimeVideo} className="streaming-badge">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 13.5c3.5 9.5 3.5 13 0"></path><path d="M10.5 10c0 1.5-1.5 1.5-1.5 1.5s-1.5 0-1.5-1.5 1.5-1.5 1.5-1.5 1.5 0 1.5 1.5z"></path></svg>
                    Prime vidéo
                  </button>
                  <button onClick={() => openLink('disneyPlus')} disabled={!hasDisneyPlus} className="streaming-badge">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4c-4.4 0-8 3.6-8 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 14c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"></path><path d="M15 12h-6M12 9v6"></path></svg>
                    Disney plus
                  </button>
                </div>
              </div>
            </div>

            <div className="detail-header-right">
              
              <div className="stat-grid-2x2">
                
                <div className="stat-box">
                  <div className="stat-box-title">Catégorie actuelle</div>
                  {editingField === 'status' ? (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                      <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="status-select" style={{ flex: 1, padding: '8px', fontSize: '0.9rem', borderRadius: '8px' }}>
                        <option value="Not Found">Introuvable</option>
                        <option value="To Watch">À voir</option>
                        <option value="Watching">En cours</option>
                        <option value="Watched">Vu</option>
                      </select>
                      <button onClick={() => saveSpecificField('status')} disabled={saving} className="primary-btn" style={{ padding: '0 10px', borderRadius: '8px' }} title="Valider">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </button>
                      <button onClick={() => setEditingField(null)} disabled={saving} className="secondary-btn" style={{ padding: '0 10px', borderRadius: '8px' }} title="Annuler">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    </div>
                  ) : previewMode ? (
                    <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', gap: '0.5rem' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '500' }}>Non ajouté</div>
                      <button 
                        onClick={handleAddToCatalog} 
                        className="primary-btn" 
                        style={{ padding: '6px 10px', fontSize: '0.85rem', width: '100%' }}
                        disabled={saving}
                      >
                        {saving ? 'Ajout en cours...' : '+ Ajouter au catalogue'}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="stat-box-value">{translateAppStatus(localDrama.status)}</div>
                      <button className="stat-box-edit" onClick={() => { setEditingField('status'); setSelectedStatus(localDrama.status); }}>(édité)</button>
                    </>
                  )}
                </div>

                <div className="stat-box">
              <div className="stat-box-title">Ma note</div>
              {editingField === 'personal_rating' ? (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                  <input type="number" step="0.1" min="0" max="5" value={personalRating} onChange={(e) => setPersonalRating(e.target.value)} className="input-field" style={{ flex: 1, padding: '8px' }} placeholder="Note / 5" />
                  <button onClick={() => saveSpecificField('personal_rating')} disabled={saving} className="primary-btn" style={{ padding: '0 10px', borderRadius: '8px' }} title="Valider">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </button>
                      <button onClick={() => setEditingField(null)} disabled={saving} className="secondary-btn" style={{ padding: '0 10px', borderRadius: '8px' }} title="Annuler">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                </div>
              ) : (
                <>
                  <div className="stat-box-value">{previewMode ? '--' : (localDrama.personal_rating || 'X.XX')} / 5</div>
                  {!previewMode && (
                    <button className="stat-box-edit" onClick={() => { setEditingField('personal_rating'); setPersonalRating(localDrama.personal_rating || ''); }}>(édité)</button>
                  )}
                </>
              )}
            </div>

                <div className="stat-box">
                  <div className="stat-box-title">Note TMDB</div>
                  <div className="stat-box-value">{localDrama.site_rating || 'XX.XX'} / 10</div>
                </div>

                <div className="stat-box">
                  <div className="stat-box-title">Note VoirDrama</div>
                  {editingField === 'voirdrama_rating' ? (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                      <input type="number" step="0.1" min="0" max="5" value={voirDramaRating} onChange={(e) => setVoirDramaRating(e.target.value)} className="input-field" style={{ flex: 1, padding: '8px' }} placeholder="Note / 5" />
                      <button onClick={() => saveSpecificField('voirdrama_rating')} disabled={saving} className="primary-btn" style={{ padding: '0 10px', borderRadius: '8px' }} title="Valider">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </button>
                      <button onClick={() => setEditingField(null)} disabled={saving} className="secondary-btn" style={{ padding: '0 10px', borderRadius: '8px' }} title="Annuler">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="stat-box-value">{previewMode ? '--' : (localDrama.voirdrama_rating || 'X.XX')} / 5</div>
                      {!previewMode && (
                        <button className="stat-box-edit" onClick={() => { setEditingField('voirdrama_rating'); setVoirDramaRating(localDrama.voirdrama_rating || ''); }}>(édité)</button>
                      )}
                    </>
                  )}
                </div>

              </div>
            </div>

          </div> 

          <div className="synopsis-box">
            
            <div className="stat-box-title" style={{ fontSize: '1rem', marginBottom: '1rem' }}>Synopsis</div>
            {synopsisLoading ? (
              <p style={{ color: 'var(--text-muted)' }}>Traduction du synopsis en cours... {synopsisProgress}%</p>
            ) : (
              <p>{tmdbSynopsis || localDrama.synopsis || 'Aucun synopsis disponible.'}</p>
            )}
            
            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)', position: 'relative' }}>
              
              <div className="stat-box-title" style={{ fontSize: '1rem', marginBottom: '1rem' }}>Mon Commentaire</div>
              
              {!previewMode && editingField !== 'comment' && (
                <button 
                  className="stat-box-edit" 
                  style={{ top: '1.5rem', right: '0' }} 
                  onClick={() => { setEditingField('comment'); setCommentText(localDrama.comment || ''); }}
                >
                  (édité)
                </button>
              )}

              {editingField === 'comment' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <textarea 
                    placeholder="Mon avis sur cette série..." 
                    value={commentText} 
                    onChange={(e) => setCommentText(e.target.value)} 
                    className="textarea-field" 
                    style={{ minHeight: '100px', padding: '12px', fontSize: '0.95rem' }} 
                  />
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditingField(null)} disabled={saving} className="secondary-btn" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>Annuler</button>
                    <button onClick={() => saveSpecificField('comment')} disabled={saving} className="primary-btn" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>Enregistrer</button>
                  </div>
                </div>
              ) : (
                <p style={{ fontStyle: 'italic', color: 'var(--primary-color)', opacity: localDrama.comment ? 1 : 0.5 }}>
                  {localDrama.comment ? `"${localDrama.comment}"` : "Aucun commentaire pour le moment."}
                </p>
              )}
              
            </div>
          </div>
        </div>
      </div>

      {/* --- MODULE DE SAISONS INDIVIDUELLES (Prend toute la largeur) --- */}
      {!previewMode && tmdbSeasons.length > 0 && (
        <div className="synopsis-box" style={{ width: '100%', marginBottom: '0' }}>
          <div className="stat-box-title" style={{ fontSize: '1rem', marginBottom: '1rem' }}>Progression des saisons</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {tmdbSeasons.filter(s => s.season_number > 0).map(season => {
              const currentStatus = seasonsProgress[season.season_number] || 'To Watch';
              
              // Détermine si on doit désactiver l'option "Vu"
              const isOngoing = ['Returning Series', 'In Production', 'Pilot', 'Pilote', 'De retour', 'En production'].includes(tmdbData?.status);
              const maxSeasonNum = Math.max(...tmdbSeasons.filter(s => s.season_number > 0).map(s => s.season_number));
              const isLastSeason = season.season_number === maxSeasonNum;
              const disableWatched = isOngoing && isLastSeason;

              return (
                <div key={season.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {season.poster_path && (
                      <img src={`https://image.tmdb.org/t/p/w92${season.poster_path}`} alt={season.name} style={{ width: '40px', borderRadius: '6px' }} />
                    )}
                    <div>
                      <div style={{ fontWeight: '700', color: '#fff', fontSize: '0.95rem' }}>{season.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{season.episode_count} épisodes</div>
                    </div>
                  </div>
                  <select
                    value={currentStatus}
                    onChange={(e) => handleSeasonStatusChange(season.season_number, e.target.value)}
                    className="status-select"
                    style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
                  >
                    <option value="To Watch">À voir</option>
                    <option value="Watching">En cours</option>
                    <option value="Watched" disabled={disableWatched} title={disableWatched ? "La série est toujours en production" : ""}>
                      Vu
                    </option>
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="detail-bottom-grid">
        <div className="stat-box">
          <div className="stat-box-title">Statut</div>
          <div className="stat-box-value">{translateStatus(tmdbData?.status)}</div>
        </div>
        <div className="stat-box">
          <div className="stat-box-title">Saisons</div>
          <div className="stat-box-value">{tmdbData?.number_of_seasons || 'XXX'}</div>
        </div>
        <div className="stat-box">
          <div className="stat-box-title">Épisodes</div>
          <div className="stat-box-value">{tmdbData?.number_of_episodes || 'XXX'}</div>
        </div>
        <div className="stat-box">
          <div className="stat-box-title">Durée Moyenne</div>
          <div className="stat-box-value">
            {localDrama.episode_run_time ? `${localDrama.episode_run_time} min` : '?? min'}
          </div>
          
          {!previewMode && (
            <button 
              className="stat-box-edit" 
              onClick={() => {
                setEditRuntime(localDrama.episode_run_time || 0); 
                setShowRuntimeModal(true); 
              }}
            >
              (édité)
            </button>
          )}
        </div>
        <div className="stat-box">
          <div className="stat-box-title">Date de diffusion</div>
          <div className="stat-box-value">{tmdbData?.first_air_date ? new Date(tmdbData.first_air_date).toLocaleDateString('fr-FR') : 'XX/XX/XXXX'}</div>
        </div>
      </div>

      {tmdbData?.credits?.cast && tmdbData.credits.cast.length > 0 && (
        <div className="cast-section">
          <div className="cast-grid">
            {tmdbData.credits.cast.slice(0, 16).map((actor) => {
              const isSeen = seenActors.has(actor.id);
              const displayName = getCastDisplayName(actor);

              return (
                <div 
                  key={actor.id} 
                  className={`cast-card ${isSeen ? 'actor-seen' : ''}`} 
                  onClick={() => fetchActorCredits(actor)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="cast-img-wrapper">
                    {isSeen && <div className="actor-seen-badge">✓ Déjà vu</div>}
                    {actor.profile_path ? (
                      <img src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`} alt={displayName} className="cast-image" loading="lazy" />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '0.8rem' }}>Pas d'image</div>
                    )}
                  </div>
                  <div className="cast-info">
                    <div className="cast-name" title={displayName}>{displayName}</div>
                    <div className="cast-role" title={actor.character}>Rôle : {actor.character || 'Inconnu'}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}  

      {selectedActor && (
        <div className="actor-modal-overlay" onClick={() => setSelectedActor(null)}>
          <div className="actor-modal-content" onClick={e => e.stopPropagation()}>
            
            <button className="actor-modal-close" onClick={() => setSelectedActor(null)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            <div className="actor-modal-header">
              {selectedActor.profile_path ? (
                <img src={`https://image.tmdb.org/t/p/w185${selectedActor.profile_path}`} alt={selectedActor.name} className="actor-modal-profile" />
              ) : (
                <div className="actor-modal-profile" style={{ backgroundColor: '#1b243b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>Photo</div>
              )}
              
              <div className="actor-modal-info">
                <h2 className="actor-modal-name">{selectedActor.name}</h2>
                <div className="actor-modal-stats">
                  <span>{actorCredits.length > 0 ? `${actorCredits.length} Séries TV` : ''}</span>
                  <span>Rôle actuel : {selectedActor.character}</span>
                </div>
              </div>
            </div>

            <div className="actor-modal-body">
              {loadingActor ? (
                <div style={{ textAlign: 'center', color: 'var(--primary-color)', padding: '2rem' }}>Recherche des séries...</div>
              ) : (
                <div className="actor-credits-grid">
                  {actorCredits.map(credit => {
                    const genreNames = (credit.genre_ids || [])
                      .map(id => TMDB_TV_GENRES[id])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join(', ');

                    const catalogEntry = userDramas.find(d => 
                      (d.tmdb_id && d.tmdb_id === credit.id) || 
                      (createSlug(d.title) === createSlug(credit.name || credit.original_name))
                    );

                    let catalogInfo = null;
                    if (catalogEntry) {
                      switch(catalogEntry.status) {
                        case 'Watched': 
                          catalogInfo = { 
                            icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
                            text: ' Vu', classSuffix: 'watched' 
                          }; 
                          break;
                        case 'Watching': 
                          catalogInfo = { 
                            icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>,
                            text: ' En cours', classSuffix: 'watching' 
                          }; 
                          break;
                        case 'To Watch': 
                          catalogInfo = { 
                            icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>,
                            text: ' À voir', classSuffix: 'towatch' 
                          }; 
                          break;
                        case 'Not Found': 
                          catalogInfo = { 
                            icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
                            text: 'Introuvable', classSuffix: 'notfound' 
                          }; 
                          break;
                        default: break;
                      }
                    }

                    // --- VÉRIFICATION DU STATUT DE LA SÉRIE ---
                    const isEnded = ['Ended', 'Canceled', 'Terminée', 'Annulée'].includes(credit.status) || 
                                    ['Ended', 'Canceled', 'Terminée', 'Annulée'].includes(credit.tmdb_status);

                    return (
                      <a 
                        key={credit.id} 
                        href={catalogEntry ? `#/drama/${createSlug(catalogEntry.title)}` : `#/drama/preview-${credit.id}`} 
                        className={`drama-card ${catalogInfo ? `card-in-catalog status-${catalogInfo.classSuffix}` : ''}`}
                        title={catalogEntry ? "Ouvrir depuis mon catalogue" : "Aperçu de la série"}
                      >
                        <div className="poster-wrapper">
                          
                          {credit.poster_path ? (
                            <img src={`https://image.tmdb.org/t/p/w500${credit.poster_path}`} alt={credit.name} className="drama-poster" loading="lazy" />
                          ) : (
                            <div className="drama-poster" style={{ backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ color: '#c7d0ff' }}>Pas d'image</span>
                            </div>
                          )}
                          
                          {/* NOTE TMDB & STATUT EN HAUT À GAUCHE */}
                          <div className="card-action-btn card-action-left" style={{ width: 'auto', padding: '0 10px', fontSize: '0.9rem', gap: '8px', display: 'flex', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Note TMDB">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="#facc15" stroke="#facc15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                              </svg>
                              <span style={{ fontWeight: 'bold' }}>
                                {credit.vote_average ? credit.vote_average.toFixed(1) : 'N/A'}
                              </span>
                            </div>

                            <div style={{ width: '1px', height: '12px', backgroundColor: 'rgba(255,255,255,0.3)' }}></div>

                            <div title={isEnded ? "Série terminée" : "En cours de production"} style={{ display: 'flex', alignItems: 'center', color: isEnded ? '#a7f3d0' : '#fecdd3' }}>
                              {isEnded ? (
                                <svg width="14" height="10" viewBox="0 0 23 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M15.8565 6.36375L13.2315 8.98875L16.9703 12.7275L14.8493 14.8492L11.1105 11.1105L7.371 14.8492L5.25 12.7282L8.98875 8.9895L6.36375 6.3645L4.24275 8.4855L0 4.24275L4.24275 0L11.1105 6.86775L17.9783 0L22.221 4.24275L17.9783 8.4855L15.8565 6.36375Z" fill="currentColor"/>
                                </svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M6.5 4H4.7C6.2 2.7 8 2 10 2C10.3 2 10.6 2 10.9 2.1C11.4 2.2 11.9 1.8 12 1.2C12.1 0.7 11.7 0.2 11.1 0.0999999C10.7 -9.68576e-08 10.4 0 10 0C7.6 0 5.3 0.9 3.5 2.4V1C3.5 0.4 3.1 0 2.5 0C1.9 0 1.5 0.4 1.5 1V5C1.5 5.6 1.9 6 2.5 6H6.5C7.1 6 7.5 5.6 7.5 5C7.5 4.4 7.1 4 6.5 4ZM5 12.5C4.4 12.5 4 12.9 4 13.5V15.3C2.7 13.8 2 12 2 10C2 9.7 2 9.4 2.1 9.1C2.2 8.6 1.8 8.1 1.2 8C0.7 7.9 0.2 8.3 0.0999999 8.9C-9.68575e-08 9.3 0 9.6 0 10C0 12.4 0.9 14.7 2.4 16.5H1C0.4 16.5 0 16.9 0 17.5C0 18.1 0.4 18.5 1 18.5H5C5.3 18.5 5.6 18.3 5.8 18.1C5.8 18 5.9 17.9 5.9 17.8C5.9 17.7 5.9 17.7 5.9 17.6V17.5V13.5C6 12.9 5.6 12.5 5 12.5ZM19 3.5C19.6 3.5 20 3.1 20 2.5C20 1.9 19.6 1.5 19 1.5H15C14.9 1.5 14.9 1.5 14.8 1.5C14.7 1.5 14.6 1.6 14.5 1.6C14.4 1.7 14.3 1.7 14.3 1.8C14.3 1.9 14.2 2 14.2 2C14.2 2.1 14.2 2.1 14.2 2.2V2.3V6.3C14.2 6.9 14.6 7.3 15.2 7.3C15.8 7.3 16.2 6.9 16.2 6.3V4.7C17.5 6.1 18.2 8 18.2 10C18.2 10.3 18.2 10.6 18.1 10.9C18 11.4 18.4 11.9 19 12H19.1C19.6 12 20 11.6 20.1 11.1C20.1 10.7 20.2 10.4 20.2 10C20.2 7.6 19.3 5.3 17.8 3.5H19ZM18.3 14.5C18.2 14.4 18.1 14.3 18 14.2C17.9 14.1 17.8 14.1 17.7 14.1H17.6H17.5H13.5C12.9 14.1 12.5 14.5 12.5 15.1C12.5 15.7 12.9 16.1 13.5 16.1H15.3C13.9 17.4 12 18.1 10 18.1C9.7 18.1 9.4 18.1 9.1 18C8.6 17.9 8.1 18.3 8 18.9C7.9 19.5 8.3 19.9 8.9 20C9.3 20 9.6 20.1 10 20.1C12.4 20.1 14.7 19.2 16.5 17.7V19C16.5 19.6 16.9 20 17.5 20C18.1 20 18.5 19.6 18.5 19V15C18.5 14.8 18.4 14.6 18.3 14.5Z" fill="currentColor"/>
                                </svg>
                              )}
                            </div>
                          </div>

                          <div 
                            className="card-action-btn card-action-right" 
                            title={catalogEntry ? "Déjà dans le catalogue" : "Ajout rapide à 'À voir'"} 
                            onClick={(e) => {
                              if (!catalogEntry) {
                                handleQuickAdd(e, credit);
                              } else {
                                e.preventDefault();
                                e.stopPropagation();
                              }
                            }}
                            style={{ 
                              color: '#fff', 
                              background: catalogEntry ? 'rgba(0,0,0,0.7)' : 'rgba(160, 116, 255, 0.95)', 
                              borderLeft: '1px solid rgba(255,255,255,0.4)', 
                              borderBottom: '1px solid rgba(255,255,255,0.4)',
                              cursor: catalogEntry ? 'default' : 'pointer'
                            }}
                          >
                            {catalogEntry ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            ) : (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                              </svg>
                            )}
                          </div>

                          {catalogInfo && (
                            <div className={`catalog-status-banner banner-${catalogInfo.classSuffix}`}>
                              {catalogInfo.icon}
                              <span>{catalogInfo.text}</span>
                            </div>
                          )}

                        </div>

                        <div className="drama-info" style={{ padding: '0.8rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                          
                          <h4 className="drama-title-en" style={{ fontSize: '1.05rem', margin: 0, lineHeight: '1.2', textTransform: 'uppercase' }} title={credit.title_en || credit.name}>
                            {credit.title_en || credit.name || credit.original_name}
                          </h4>
                          
                          <div className="drama-title-orig" style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                            {credit.title_orig || credit.original_name} • {credit.first_air_date ? credit.first_air_date.substring(0, 4) : '????'}
                          </div>

                          <div style={{ fontSize: '0.78rem', color: '#c7d0ff', fontStyle: 'italic', opacity: 0.9 }}>
                            FR : {credit.title_fr && credit.title_fr !== (credit.title_en || credit.name) ? `FR : ${credit.title_fr}` : `EN : ${credit.title_en || credit.name}`}
                          </div>

                          <div className="drama-genres" style={{ color: 'var(--primary-color)', fontWeight: '600', fontSize: '0.8rem' }}>
                            {genreNames || 'Genres inconnus'}
                          </div>

                          <div className="drama-genres" style={{ color: 'var(--primary-color)', fontWeight: '700', fontSize: '0.85rem' }}>
                            Rôle : {credit.character || 'Inconnu'}
                          </div>
                          
                          <div style={{ marginTop: 'auto', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                            <span style={{ fontSize: '1.2rem', lineHeight: '1' }}>📑</span>
                            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                              <strong style={{ color: '#fff', fontSize: '0.85rem' }}>
                                {credit.number_of_seasons ? `${credit.number_of_seasons} Saison${credit.number_of_seasons > 1 ? 's' : ''}` : '? Saison'}
                              </strong>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                                {credit.total_episodes 
                                  ? `${credit.total_episodes} épisodes` 
                                  : (credit.episode_count ? `${credit.episode_count} épisodes joués` : '? épisodes')
                                }
                              </span>
                            </div>
                          </div>
                          
                        </div>
                      </a>
                    )
                  })}
                </div>
              )}
              
              {!loadingActor && actorCredits.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Aucune série TV trouvée pour cet acteur.</div>
              )}
            </div>

          </div>
        </div>
      )}

      {showRuntimeModal && (
        <div className="duration-modal-overlay" onClick={() => setShowRuntimeModal(false)}>
          <div className="duration-modal-content" onClick={(e) => e.stopPropagation()}>
            
            <div className="duration-modal-header">
              <svg 
                width="40" height="40" viewBox="0 0 24 24" fill="none" 
                stroke="var(--primary-color)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" 
                style={{ marginBottom: '0.5rem' }}
              >
                <path d="M5 22h14"></path>
                <path d="M5 2h14"></path>
                <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"></path>
                <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"></path>
              </svg>
              <h3 className="duration-modal-title">Durée de l'épisode</h3>
              <p className="duration-modal-subtitle">Ajustez le temps de visionnage moyen.</p>
            </div>

            <div className="duration-modal-body">
              
              <div className="duration-input-wrapper">
                <input 
                  type="number" 
                  className="duration-input" 
                  value={editRuntime} 
                  onChange={(e) => setEditRuntime(e.target.value)}
                  min="0"
                  autoFocus
                />
                <span className="duration-label">minutes</span>
              </div>

              <div className="duration-modal-actions">
                <button 
                  className="secondary-btn" 
                  onClick={() => setShowRuntimeModal(false)}
                  disabled={saving}
                >
                  Annuler
                </button>
                <button 
                  className="primary-btn" 
                  onClick={() => saveSpecificField('episode_run_time')}
                  disabled={saving}
                >
                  {saving ? '...' : 'Valider'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
      
    </div>
  )
}