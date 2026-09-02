import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

// Dictionnaire de conversion des genres TV de TMDB
const TMDB_TV_GENRES = {
  10759: "Action & Aventure",
  16: "Animation",
  35: "Comédie",
  80: "Crime",
  99: "Documentaire",
  18: "Drame",
  10751: "Familial",
  10762: "Kids",
  9648: "Mystère",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "Guerre & Politique",
  37: "Western"
};

export default function AddDrama({ session }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState('title') 
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [addingDrama, setAddingDrama] = useState(false)
  const [userDramas, setUserDramas] = useState([])

  const navigate = useNavigate()

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim() !== '') {
        executeSearch(searchQuery)
      } else {
        setSearchResults([])
      }
    }, 500)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery, searchMode])

  useEffect(() => {
    const fetchUserDramas = async () => {
      if (session?.user?.id) {
        const { data } = await supabase
          .from('dramas')
          .select('*')
          .eq('user_id', session.user.id)
        if (data) setUserDramas(data)
      }
    }
    fetchUserDramas()
  }, [session])

  const createSlug = (title) => {
    return title ? title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim() : ''
  }

  // --- RECHERCHE MISE À JOUR (Exclusion des Animés) ---
  const executeSearch = async (query) => {
    setIsSearching(true)
    const apiKey = import.meta.env.VITE_TMDB_API_KEY
    
    try {
      if (searchMode === 'title') {
        const [responseFr, responseEn] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(query)}&language=fr-FR&api_key=${apiKey}`),
          fetch(`https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(query)}&language=en-US&api_key=${apiKey}`)
        ])
        
        const dataFr = await responseFr.json()
        const dataEn = await responseEn.json()
        
        // 1. FILTRE ANTI-ANIMÉ : On exclut toutes les séries ayant le genre 16 (Animation)
        const nonAnimatedResults = (dataFr.results || []).filter(item => !(item.genre_ids && item.genre_ids.includes(16)))

        // On limite aux 12 premiers résultats (parmi les séries non-animées)
        const topResults = nonAnimatedResults.slice(0, 12)

        const detailedResults = await Promise.all(topResults.map(async (frItem) => {
          const detailRes = await fetch(`https://api.themoviedb.org/3/tv/${frItem.id}?language=fr-FR&api_key=${apiKey}`)
          const detailData = await detailRes.json()

          const enItem = (dataEn.results || []).find(item => item.id === frItem.id)
          const isAsian = ['zh', 'ko', 'ja', 'th'].includes(frItem.original_language)
          const isUntranslated = isAsian && frItem.name === frItem.original_name
          const displayName = isUntranslated && enItem ? enItem.name : frItem.name
          
          return {
            ...frItem,
            number_of_seasons: detailData.number_of_seasons,
            number_of_episodes: detailData.number_of_episodes,
            tmdb_status: detailData.status,
            displayName: displayName
          }
        }))
        
        setSearchResults(detailedResults)
      } 
      else if (searchMode === 'actor') {
        const personResponse = await fetch(`https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(query)}&language=en-US&api_key=${apiKey}`)
        const personData = await personResponse.json()

        if (personData.results && personData.results.length > 0) {
          let allDramas = [];

          for (let i = 0; i < Math.min(3, personData.results.length); i++) {
            const actorId = personData.results[i].id;
            const creditsResponse = await fetch(`https://api.themoviedb.org/3/person/${actorId}/tv_credits?language=fr-FR&api_key=${apiKey}`);
            const creditsData = await creditsResponse.json();

            if (creditsData.cast && creditsData.cast.length > 0) {
              
              // 2. FILTRE ANTI-ANIMÉ POUR LES ACTEURS (Exclure le doublage d'animes)
              const nonAnimatedCredits = creditsData.cast.filter(item => !(item.genre_ids && item.genre_ids.includes(16)))

              const topCredits = nonAnimatedCredits
                .sort((a, b) => b.popularity - a.popularity)
                .slice(0, 12);

              const detailedCredits = await Promise.all(topCredits.map(async (item) => {
                const detailRes = await fetch(`https://api.themoviedb.org/3/tv/${item.id}?language=fr-FR&api_key=${apiKey}`)
                const detailData = await detailRes.json()

                return {
                  ...item,
                  number_of_seasons: detailData.number_of_seasons,
                  number_of_episodes: detailData.number_of_episodes,
                  tmdb_status: detailData.status,
                  displayName: item.name || item.original_name
                }
              }))

              allDramas = detailedCredits;
              break; 
            }
          }

          const uniqueDramas = Array.from(new Map(allDramas.map(item => [item.id, item])).values());
          uniqueDramas.sort((a, b) => b.popularity - a.popularity);

          setSearchResults(uniqueDramas);
        } else {
          setSearchResults([]);
        }
      }
    } catch (error) {
      console.error("Erreur lors de la recherche", error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleQuickAdd = async (e, drama) => {
    e.preventDefault()
    e.stopPropagation() 
    
    if (addingDrama) return
    setAddingDrama(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Utilisateur non connecté.')
        setAddingDrama(false)
        return
      }

      const title = drama.displayName || drama.name || drama.original_name || 'Titre inconnu'

      const { data: existing } = await supabase
        .from('dramas')
        .select('id')
        .eq('user_id', user.id)
        .eq('tmdb_id', drama.id)
        .limit(1)

      if (existing && existing.length > 0) {
        alert('Ce drama est déjà présent dans votre liste.')
        setAddingDrama(false)
        return
      }

      const posterUrl = drama.poster_path ? `https://image.tmdb.org/t/p/w500${drama.poster_path}` : null

      const newDrama = {
        user_id: user.id,
        title: title,
        poster_url: posterUrl,
        status: 'To Watch', 
        site_rating: drama.vote_average || null,
        tmdb_id: drama.id,
        episode_run_time: 0
      }

      const { data, error } = await supabase.from('dramas').insert([newDrama]).select()

      if (error) {
        alert("Erreur lors de l'ajout : " + error.message)
      } else if (data && data.length > 0) {
        setUserDramas(prev => [...prev, data[0]])
      }
    } catch (error) {
      console.error("Erreur lors de l'ajout rapide", error)
      alert("Erreur système.")
    }
    
    setAddingDrama(false)
  }

  return (
    <div className="form-container">
      <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Ajouter une nouvelle série</h2>
      
      <div style={{ marginBottom: '1rem', paddingBottom: '0.8rem', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          
          <select 
            value={searchMode} 
            onChange={(e) => setSearchMode(e.target.value)}
            className="status-select"
            style={{ padding: '0.5rem', borderRadius: '8px' }}
          >
            <option value="title">Titre</option>
            <option value="actor">Acteur/Actrice</option>
          </select>

          <input 
            type="text" 
            placeholder={searchMode === 'title' ? "Rechercher un drama avec TMDB..." : "Rechercher un(e) acteur/actrice..."} 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            style={{ flex: 1, minWidth: '200px' }}
            className="input-field"
          />
          
          {isSearching && <span style={{ fontSize: '0.9rem', color: '#c7d0ff', whiteSpace: 'nowrap' }}>Recherche...</span>}
        </div>
        
        {searchResults.length > 0 && (
          <div className="actor-credits-grid" style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
            {searchResults.map((result) => {
              
              const catalogEntry = userDramas.find(d => 
                (d.tmdb_id && d.tmdb_id === result.id) || 
                (createSlug(d.title) === createSlug(result.displayName || result.name || result.original_name))
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

              const genreNames = (result.genre_ids || [])
                .map(id => TMDB_TV_GENRES[id])
                .filter(Boolean)
                .slice(0, 2)
                .join(', ');

              const year = result.first_air_date ? result.first_air_date.substring(0, 4) : '????';
              const frTitle = result.name;
              const enTitle = result.displayName;
              const isEnded = ['Ended', 'Canceled', 'Terminée', 'Annulée'].includes(result.tmdb_status);
              
              return (
                <div 
                  key={result.id} 
                  className={`drama-card ${catalogInfo ? `card-in-catalog status-${catalogInfo.classSuffix}` : ''}`}
                  onClick={() => navigate(catalogEntry ? `/drama/${createSlug(catalogEntry.title)}` : `/drama/preview-${result.id}`)}
                  style={{ cursor: 'pointer' }}
                  title={catalogEntry ? "Ouvrir depuis mon catalogue" : "Cliquez pour voir les détails de la série"}
                >
                  <div className="poster-wrapper">
                    
                    {result.poster_path ? (
                      <img src={`https://image.tmdb.org/t/p/w500${result.poster_path}`} alt={enTitle} className="drama-poster" loading="lazy" />
                    ) : (
                      <div className="drama-poster" style={{ backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#c7d0ff' }}>Pas d'image</span>
                      </div>
                    )}
                    
                    {/* NOTE TMDB & STATUT EN HAUT À GAUCHE */}
                    <div className="card-action-btn card-action-left" style={{ width: 'auto', padding: '0 10px', fontSize: '0.9rem', gap: '8px', display: 'flex', alignItems: 'center' }}>
                      
                      {/* Étoile et Note */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Note TMDB">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#facc15" stroke="#facc15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                        <span style={{ fontWeight: 'bold' }}>
                          {result.vote_average ? result.vote_average.toFixed(1) : 'N/A'}
                        </span>
                      </div>

                      {/* Petite ligne de séparation verticale */}
                      <div style={{ width: '1px', height: '12px', backgroundColor: 'rgba(255,255,255,0.3)' }}></div>

                      {/* Icône de Statut (Terminé ou En cours) */}
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
                          handleQuickAdd(e, result);
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
                    
                    <h4 className="drama-title-en" style={{ fontSize: '1.05rem', margin: 0, lineHeight: '1.2', textTransform: 'uppercase' }} title={enTitle}>
                      {enTitle}
                    </h4>
                    
                    <div className="drama-title-orig" style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                      {result.original_name || result.name} • {year}
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#c7d0ff', fontStyle: 'italic', opacity: 0.9 }}>
                      FR : {frTitle && frTitle !== enTitle ? frTitle : 'Titre identique'}
                    </div>

                    <div className="drama-genres" style={{ color: 'var(--primary-color)', fontWeight: '600', fontSize: '0.8rem' }}>
                      {genreNames || 'Genres inconnus'}
                    </div>

                    {searchMode === 'actor' && (
                      <div className="drama-genres" style={{ color: 'var(--primary-color)', fontWeight: '700', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                        Rôle : {result.character || 'Inconnu'}
                      </div>
                    )}

                    <div style={{ marginTop: 'auto', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                      <span style={{ fontSize: '1.2rem', lineHeight: '1' }}>📑</span>
                      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                        <strong style={{ color: '#fff', fontSize: '0.85rem' }}>
                          {result.number_of_seasons ? `${result.number_of_seasons} Saison${result.number_of_seasons > 1 ? 's' : ''}` : '? Saison'}
                        </strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                          {result.number_of_episodes ? `${result.number_of_episodes} épisodes` : '? épisodes'}
                        </span>
                      </div>
                    </div>
                    
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}