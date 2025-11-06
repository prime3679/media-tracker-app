/**
 * Trailer Modal
 *
 * Full-screen YouTube trailer player.
 * Extracts video ID from YouTube URL and embeds with autoplay.
 */

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { modalTransition, backdropTransition } from '../animations/transitions';
import './TrailerModal.css';

interface TrailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  trailerUrl: string | null;
  itemTitle: string;
}

export default function TrailerModal({
  isOpen,
  onClose,
  trailerUrl,
  itemTitle,
}: TrailerModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !trailerUrl) return null;

  // Extract YouTube video ID from URL
  const getYouTubeId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const videoId = getYouTubeId(trailerUrl);

  if (!videoId) {
    return null;
  }

  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;

  return (
    <AnimatePresence>
      <motion.div
        className="trailer-backdrop"
        variants={backdropTransition}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
      >
        <motion.div
          className="trailer-modal"
          variants={modalTransition}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="trailer-header">
            <h3>{itemTitle} - Trailer</h3>
            <button
              className="close-button"
              onClick={onClose}
              aria-label="Close trailer"
            >
              ✕
            </button>
          </div>

          <div className="trailer-container">
            <iframe
              src={embedUrl}
              title={`${itemTitle} Trailer`}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

          <div className="trailer-hint">
            Press Escape to close
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
