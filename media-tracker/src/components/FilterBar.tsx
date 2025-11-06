/**
 * FilterBar - Filters for catalog browsing
 *
 * Mood, decade, genre, and search filters
 */

import { motion } from 'framer-motion';
import { type MoodType } from './MoodSelector';
import './FilterBar.css';

interface FilterBarProps {
  selectedMood: MoodType | null;
  onMoodChange: (mood: MoodType | null) => void;
  selectedDecade: number | null;
  onDecadeChange: (decade: number | null) => void;
  selectedGenre: string | null;
  onGenreChange: (genre: string | null) => void;
  selectedMediaType: 'movie' | 'tv_show' | null;
  onMediaTypeChange: (type: 'movie' | 'tv_show' | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  availableGenres: string[];
  availableDecades: number[];
}

const MOODS: { key: MoodType; emoji: string; name: string }[] = [
  { key: 'cozy_evening', emoji: '☕', name: 'Cozy' },
  { key: 'adrenaline_rush', emoji: '⚡', name: 'Thrills' },
  { key: 'brain_food', emoji: '🧠', name: 'Thoughtful' },
  { key: 'quick_laugh', emoji: '😂', name: 'Comedy' },
  { key: 'epic_journey', emoji: '🌟', name: 'Epic' },
  { key: 'wind_down', emoji: '😴', name: 'Relaxing' },
];

export default function FilterBar({
  selectedMood,
  onMoodChange,
  selectedDecade,
  onDecadeChange,
  selectedGenre,
  onGenreChange,
  selectedMediaType,
  onMediaTypeChange,
  searchQuery,
  onSearchChange,
  availableGenres,
  availableDecades,
}: FilterBarProps) {
  const handleMoodClick = (mood: MoodType) => {
    onMoodChange(selectedMood === mood ? null : mood);
  };

  const handleDecadeClick = (decade: number) => {
    onDecadeChange(selectedDecade === decade ? null : decade);
  };

  const handleGenreClick = (genre: string) => {
    onGenreChange(selectedGenre === genre ? null : genre);
  };

  const handleMediaTypeClick = (type: 'movie' | 'tv_show') => {
    onMediaTypeChange(selectedMediaType === type ? null : type);
  };

  const hasActiveFilters = selectedMood || selectedDecade || selectedGenre || selectedMediaType || searchQuery;

  const clearAllFilters = () => {
    onMoodChange(null);
    onDecadeChange(null);
    onGenreChange(null);
    onMediaTypeChange(null);
    onSearchChange('');
  };

  return (
    <div className="filter-bar">
      {/* Search */}
      <div className="filter-section">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search titles, directors..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button
              className="search-clear"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Media Type Filter */}
      <div className="filter-section">
        <h3 className="filter-label">Type</h3>
        <div className="filter-chips">
          <motion.button
            className={`filter-chip ${selectedMediaType === 'movie' ? 'active' : ''}`}
            onClick={() => handleMediaTypeClick('movie')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            🎬 Movies
          </motion.button>
          <motion.button
            className={`filter-chip ${selectedMediaType === 'tv_show' ? 'active' : ''}`}
            onClick={() => handleMediaTypeClick('tv_show')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            📺 TV Shows
          </motion.button>
        </div>
      </div>

      {/* Mood Filter */}
      <div className="filter-section">
        <h3 className="filter-label">Mood</h3>
        <div className="filter-chips">
          {MOODS.map((mood) => (
            <motion.button
              key={mood.key}
              className={`filter-chip ${selectedMood === mood.key ? 'active' : ''}`}
              onClick={() => handleMoodClick(mood.key)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="chip-emoji">{mood.emoji}</span>
              {mood.name}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Decade Filter */}
      {availableDecades.length > 0 && (
        <div className="filter-section">
          <h3 className="filter-label">Decade</h3>
          <div className="filter-chips">
            {availableDecades.map((decade) => (
              <motion.button
                key={decade}
                className={`filter-chip ${selectedDecade === decade ? 'active' : ''}`}
                onClick={() => handleDecadeClick(decade)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {decade}s
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Genre Filter */}
      {availableGenres.length > 0 && (
        <div className="filter-section">
          <h3 className="filter-label">Genre</h3>
          <div className="filter-chips">
            {availableGenres.slice(0, 15).map((genre) => (
              <motion.button
                key={genre}
                className={`filter-chip ${selectedGenre === genre ? 'active' : ''}`}
                onClick={() => handleGenreClick(genre)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {genre}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Clear Filters */}
      {hasActiveFilters && (
        <div className="filter-section">
          <motion.button
            className="clear-filters-btn"
            onClick={clearAllFilters}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Clear All Filters
          </motion.button>
        </div>
      )}
    </div>
  );
}
