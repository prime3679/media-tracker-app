/**
 * CatalogCard - Individual catalog item poster card
 *
 * Netflix-style poster card with hover effects, rating badge, and add button.
 */

import { motion } from 'framer-motion';
import { useState } from 'react';
import { type CatalogItem } from '../services/api';
import './CatalogCard.css';

interface CatalogCardProps {
  item: CatalogItem;
  onAdd: (item: CatalogItem) => void;
  isAdding?: boolean;
}

export default function CatalogCard({ item, onAdd, isAdding = false }: CatalogCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAdd(item);
  };

  const parseGenres = (): string[] => {
    if (!item.genres) return [];
    try {
      const parsed = JSON.parse(item.genres);
      return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
    } catch {
      return [];
    }
  };

  const genres = parseGenres();
  const rating = item.tmdbRating ? parseFloat(item.tmdbRating) : null;
  const displayRating = rating ? (rating * 10).toFixed(0) : null;

  return (
    <motion.div
      className="catalog-card"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ scale: 1.05, zIndex: 10 }}
      transition={{ duration: 0.2 }}
    >
      {/* Poster Image */}
      <div className="catalog-card-poster">
        {!imageError && item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.title}
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="catalog-card-poster-placeholder">
            <span className="placeholder-icon">
              {item.mediaType === 'movie' && '🎬'}
              {item.mediaType === 'tv_show' && '📺'}
              {item.mediaType === 'book' && '📚'}
            </span>
            <span className="placeholder-title">{item.title}</span>
          </div>
        )}

        {/* Rating Badge */}
        {displayRating && (
          <div className="catalog-card-rating">
            <span className="rating-score">{displayRating}%</span>
          </div>
        )}
      </div>

      {/* Hover Overlay */}
      <motion.div
        className="catalog-card-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="overlay-content">
          {/* Title */}
          <h3 className="overlay-title">{item.title}</h3>

          {/* Year */}
          {item.releaseYear && (
            <p className="overlay-year">{item.releaseYear}</p>
          )}

          {/* Genres */}
          {genres.length > 0 && (
            <div className="overlay-genres">
              {genres.map((genre) => (
                <span key={genre} className="overlay-genre-pill">
                  {genre}
                </span>
              ))}
            </div>
          )}

          {/* Runtime/Seasons */}
          {item.mediaType === 'movie' && item.runtime && (
            <p className="overlay-meta">{item.runtime} min</p>
          )}
          {item.mediaType === 'tv_show' && item.totalSeasons && (
            <p className="overlay-meta">
              {item.totalSeasons} season{item.totalSeasons !== 1 ? 's' : ''}
            </p>
          )}

          {/* Add Button */}
          <motion.button
            className="overlay-add-btn"
            onClick={handleAddClick}
            disabled={isAdding}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isAdding ? (
              <>
                <span className="btn-spinner">⏳</span>
                Adding...
              </>
            ) : (
              <>
                <span className="btn-icon">+</span>
                Add to Library
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
