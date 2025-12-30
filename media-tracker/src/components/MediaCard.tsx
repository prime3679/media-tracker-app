import React from 'react';
import { motion } from 'framer-motion';
import { type DiscoveryCatalogItem } from '../services/api';
import './MediaCard.css';

interface MediaCardProps {
  item: DiscoveryCatalogItem;
  onAdd: (item: DiscoveryCatalogItem) => void;
  isAdding?: boolean;
}

export default function MediaCard({ item, onAdd, isAdding = false }: MediaCardProps) {
  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAdd(item);
  };

  const getYear = (dateString?: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).getFullYear();
  };

  return (
    <motion.div
      className="media-card"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      layoutId={`media-card-${item.id}`}
    >
      <img
        src={item.imageUrl || ''}
        alt={item.title}
        className="media-card-poster"
        loading="lazy"
      />

      <div className="media-card-overlay">
        <h3 className="media-card-title">{item.title}</h3>
        <div className="media-card-meta">
          <span>{getYear(item.releaseDate) || item.releaseYear}</span>
          <span>•</span>
          <span className="media-card-rating">★ {item.tmdbRating ? Number(item.tmdbRating).toFixed(1) : '-'}</span>
        </div>
      </div>

      <div className="media-card-actions">
        <button
          className="btn-icon-mini"
          onClick={handleAddClick}
          disabled={isAdding}
          title="Add to Library"
        >
          {isAdding ? '...' : '+'}
        </button>
      </div>
    </motion.div>
  );
}
