import { useState, useEffect } from 'react'
import { mediaAPI } from './services/api.js'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('library')
  const [mediaItems, setMediaItems] = useState([])
  const [stats, setStats] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [formData, setFormData] = useState({
    title: '',
    mediaType: 'movie',
    status: 'to_watch',
    rating: '',
    notes: ''
  })

  // Load data on component mount
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [mediaData, statsData] = await Promise.all([
        mediaAPI.getMediaItems(),
        mediaAPI.getStats()
      ])
      
      setMediaItems(mediaData)
      setStats(statsData)
    } catch (err) {
      console.error('Failed to load data:', err)
      setError('Failed to load data. Please try refreshing the page.')
    } finally {
      setLoading(false)
    }
  }

  const addMediaItem = async (e) => {
    e.preventDefault()
    
    try {
      setError(null)
      
      const newItem = await mediaAPI.addMediaItem(formData)
      
      // Add to local state
      setMediaItems(prev => [...prev, newItem])
      
      // Reset form
      setFormData({ 
        title: '', 
        mediaType: 'movie', 
        status: 'to_watch', 
        rating: '', 
        notes: '' 
      })
      setShowAddForm(false)
      
      // Reload stats
      const newStats = await mediaAPI.getStats()
      setStats(newStats)
      
    } catch (err) {
      console.error('Failed to add media item:', err)
      setError('Failed to add media item. Please try again.')
    }
  }

  const updateItemStatus = async (mediaItem, newStatus) => {
    try {
      setError(null)
      
      const updatedTracking = await mediaAPI.updateTracking(mediaItem.id, {
        status: newStatus,
        rating: mediaItem.tracking?.rating || null,
        notes: mediaItem.tracking?.notes || null,
        progress: mediaItem.tracking?.progress || 0
      })
      
      // Update local state
      setMediaItems(items => items.map(item => 
        item.id === mediaItem.id 
          ? { ...item, tracking: updatedTracking }
          : item
      ))
      
      // Reload stats
      const newStats = await mediaAPI.getStats()
      setStats(newStats)
      
    } catch (err) {
      console.error('Failed to update status:', err)
      setError('Failed to update status. Please try again.')
    }
  }

  const updateItemRating = async (mediaItem, newRating) => {
    try {
      setError(null)
      
      const updatedTracking = await mediaAPI.updateTracking(mediaItem.id, {
        status: mediaItem.tracking?.status || 'to_watch',
        rating: newRating || null,
        notes: mediaItem.tracking?.notes || null,
        progress: mediaItem.tracking?.progress || 0
      })
      
      // Update local state
      setMediaItems(items => items.map(item => 
        item.id === mediaItem.id 
          ? { ...item, tracking: updatedTracking }
          : item
      ))
      
    } catch (err) {
      console.error('Failed to update rating:', err)
      setError('Failed to update rating. Please try again.')
    }
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'completed': return '#4CAF50'
      case 'watching': return '#2196F3'
      case 'to_watch': return '#FF9800'
      case 'dropped': return '#f44336'
      case 'on_hold': return '#9E9E9E'
      default: return '#9E9E9E'
    }
  }

  const getMediaIcon = (type) => {
    switch(type) {
      case 'movie': return '🎬'
      case 'tv_show': return '📺'
      case 'book': return '📚'
      default: return '🎬'
    }
  }

  const formatStatus = (status) => {
    return status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown'
  }

  const filteredMediaItems = mediaItems.filter(item => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    // Search filter
    const matchesSearch = normalizedQuery === '' ||
      (item.title ?? '').toLowerCase().includes(normalizedQuery) ||
      (item.author ?? '').toLowerCase().includes(normalizedQuery) ||
      (item.director ?? '').toLowerCase().includes(normalizedQuery)
    
    // Status filter
    const matchesStatus = filterStatus === 'all' || item.tracking?.status === filterStatus
    
    // Type filter
    const matchesType = filterType === 'all' || item.mediaType === filterType
    
    return matchesSearch && matchesStatus && matchesType
  })

  if (loading) {
    return (
      <div className="app">
        <header className="header">
          <h1>📱 Media Tracker</h1>
        </header>
        <div className="loading">
          <p>Loading your media library...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <h1>📱 Media Tracker</h1>
      </header>

      {error && (
        <div className="error-banner">
          <p>{error}</p>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <nav className="tabs">
        <button 
          className={activeTab === 'library' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('library')}
        >
          📚 Library
        </button>
        <button 
          className={activeTab === 'stats' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('stats')}
        >
          📊 Stats
        </button>
      </nav>

      {activeTab === 'library' && (
        <main className="main">
          <div className="add-section">
            <button 
              className="add-button"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              {showAddForm ? '✕ Cancel' : '+ Add Media'}
            </button>
          </div>

          {/* Search and Filters */}
          <div className="search-section">
            <input
              type="text"
              className="search-input"
              placeholder="🔍 Search by title, author, or director..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            
            <div className="filter-row">
              <select
                className="filter-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="to_watch">To Watch/Read</option>
                <option value="watching">Currently Watching/Reading</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
                <option value="dropped">Dropped</option>
              </select>
              
              <select
                className="filter-select"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="movie">🎬 Movies</option>
                <option value="tv_show">📺 TV Shows</option>
                <option value="book">📚 Books</option>
              </select>
            </div>
          </div>

          {showAddForm && (
            <form className="add-form" onSubmit={addMediaItem}>
              <input
                type="text"
                placeholder="Title"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                required
              />
              
              <select
                value={formData.mediaType}
                onChange={(e) => setFormData({...formData, mediaType: e.target.value})}
              >
                <option value="movie">🎬 Movie</option>
                <option value="tv_show">📺 TV Show</option>
                <option value="book">📚 Book</option>
              </select>

              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
              >
                <option value="to_watch">To Watch/Read</option>
                <option value="watching">Currently Watching/Reading</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
                <option value="dropped">Dropped</option>
              </select>

              <input
                type="number"
                placeholder="Rating (1-10)"
                value={formData.rating}
                onChange={(e) => setFormData({...formData, rating: e.target.value})}
                min="1"
                max="10"
                step="0.1"
              />

              <textarea
                placeholder="Notes (optional)"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                rows="3"
              ></textarea>

              <button type="submit" className="submit-button">Add to Library</button>
            </form>
          )}

          <div className="media-list">
            {filteredMediaItems.length === 0 ? (
              mediaItems.length === 0 ? (
                <div className="empty-state">
                  <p>📚 Your media library is empty</p>
                  <p>Add some movies, TV shows, or books to get started!</p>
                </div>
              ) : (
                <div className="empty-state">
                  <p>🔍 No matches found</p>
                  <p>Try adjusting your search or filters</p>
                </div>
              )
            ) : (
              filteredMediaItems.map(item => (
                <div key={item.id} className="media-item">
                  <div className="media-header">
                    <span className="media-icon">{getMediaIcon(item.mediaType)}</span>
                    <h3>{item.title}</h3>
                  </div>
                  
                  <div className="media-details">
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(item.tracking?.status) }}
                    >
                      {formatStatus(item.tracking?.status)}
                    </span>
                    {item.tracking?.rating && (
                      <span className="rating">⭐ {item.tracking.rating}/10</span>
                    )}
                  </div>

                  {item.tracking?.notes && (
                    <p className="notes">{item.tracking.notes}</p>
                  )}

                  <div className="item-actions">
                    <select
                      value={item.tracking?.status || 'to_watch'}
                      onChange={(e) => updateItemStatus(item, e.target.value)}
                      className="status-select"
                    >
                      <option value="to_watch">To Watch/Read</option>
                      <option value="watching">Currently Watching/Reading</option>
                      <option value="completed">Completed</option>
                      <option value="on_hold">On Hold</option>
                      <option value="dropped">Dropped</option>
                    </select>
                    
                    <input
                      type="number"
                      placeholder="Rate 1-10"
                      value={item.tracking?.rating || ''}
                      onChange={(e) => updateItemRating(item, e.target.value)}
                      min="1"
                      max="10"
                      step="0.1"
                      className="rating-input"
                    />
                  </div>

                  <small className="date">
                    Added: {new Date(item.createdAt).toLocaleDateString()}
                  </small>
                </div>
              ))
            )}
          </div>
        </main>
      )}

      {activeTab === 'stats' && (
        <main className="main">
          <div className="stats">
            <h2>📊 Your Stats</h2>
            {stats ? (
              <div className="stats-grid">
                <div className="stat-card">
                  <h3>{stats.totalItems}</h3>
                  <p>Total Items</p>
                </div>
                <div className="stat-card">
                  <h3>{stats.completed}</h3>
                  <p>Completed</p>
                </div>
                <div className="stat-card">
                  <h3>{stats.watching}</h3>
                  <p>Currently Watching/Reading</p>
                </div>
                <div className="stat-card">
                  <h3>{stats.movies}</h3>
                  <p>Movies</p>
                </div>
                <div className="stat-card">
                  <h3>{stats.tvShows}</h3>
                  <p>TV Shows</p>
                </div>
                <div className="stat-card">
                  <h3>{stats.books}</h3>
                  <p>Books</p>
                </div>
              </div>
            ) : (
              <p>Loading statistics...</p>
            )}
          </div>
        </main>
      )}
    </div>
  )
}

export default App