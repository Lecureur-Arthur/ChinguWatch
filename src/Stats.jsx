import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Stats({ session }) {
  const [stats, setStats] = useState({
    categories: {
      'Not Found': { count: 0, minutes: 0 },
      'To Watch': { count: 0, minutes: 0 },
      'Watching': { count: 0, minutes: 0 },
      'Watched': { count: 0, minutes: 0 }
    }
  })

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    const { data, error } = await supabase
      .from('dramas')
      .select('status, number_of_episodes, episode_run_time')
      .eq('user_id', session.user.id)

    if (data) {
      let newStats = {
        'Not Found': { count: 0, minutes: 0 },
        'To Watch': { count: 0, minutes: 0 },
        'Watching': { count: 0, minutes: 0 },
        'Watched': { count: 0, minutes: 0 }
      }
      
      data.forEach(d => {
        const cat = d.status
        if (newStats[cat]) {
          newStats[cat].count += 1
          if (d.number_of_episodes && d.episode_run_time) {
            newStats[cat].minutes += (d.number_of_episodes * d.episode_run_time)
          }
        }
      })

      setStats({ categories: newStats })
    }
  }

  const formatDuration = (min) => {
    if (min === 0) return '0m'
    const hours = Math.floor(min / 60)
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    return `${days > 0 ? days + 'j ' : ''}${remainingHours}h ${min % 60}m`
  }

  return (
    <div className="panel-card" style={{ marginTop: '2rem' }}>
      <h3 className="profile-section-title">Mes Statistiques par Catégorie</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
        
        {/* Catégorie À Voir */}
        <div className="panel-card" style={{ padding: '1rem', borderLeft: '4px solid var(--primary-color)' }}>
            <span className="panel-label">À voir</span>
            <div className="panel-value" style={{ fontSize: '1.2rem', margin: '0.5rem 0' }}>{stats.categories['To Watch'].count} séries</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--secondary-text)' }}>Temps estimé : {formatDuration(stats.categories['To Watch'].minutes)}</div>
        </div>

        {/* Catégorie En cours */}
        <div className="panel-card" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-color)' }}>
            <span className="panel-label">En cours</span>
            <div className="panel-value" style={{ fontSize: '1.2rem', margin: '0.5rem 0' }}>{stats.categories['Watching'].count} séries</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--secondary-text)' }}>Temps consommé : {formatDuration(stats.categories['Watching'].minutes)}</div>
        </div>

        {/* Catégorie Terminés */}
        <div className="panel-card" style={{ padding: '1rem', borderLeft: '4px solid #4caf50' }}>
            <span className="panel-label">Terminés (Vu)</span>
            <div className="panel-value" style={{ fontSize: '1.2rem', margin: '0.5rem 0' }}>{stats.categories['Watched'].count} séries</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--secondary-text)' }}>Temps total : {formatDuration(stats.categories['Watched'].minutes)}</div>
        </div>
        
        {/* Catégorie À Voir */}
        <div className="panel-card" style={{ padding: '1rem', borderLeft: '4px solid #af4c4c' }}>
            <span className="panel-label">Streaming non trouvé</span>
            <div className="panel-value" style={{ fontSize: '1.2rem', margin: '0.5rem 0' }}>{stats.categories['Not Found'].count} séries</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--secondary-text)' }}>Temps estimé : {formatDuration(stats.categories['Not Found'].minutes)}</div>
        </div>

      </div>
    </div>
  )
}