/**
 * NextUpView - The Hero Recommendation Experience
 *
 * Shows one beautiful, full-screen recommendation at a time.
 * Users can swipe to skip or tap to mark as "watching tonight".
 *
 * This is where magic happens ✨
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  nextQueryKey,
  mediaApi,
  mediaQueryKey,
  type NextUpItem,
  type UpdateTrackingInput,
} from '../services/api';
import {
  slideUp,
  fadeIn,
  spring,
  smooth,
  heroCardHover,
} from '../animations/transitions';
import SkipReasonModal from '../components/SkipReasonModal';
import TrailerModal from '../components/TrailerModal';
import MoodSelector, { type MoodType } from '../components/MoodSelector';
import './NextUpView.css';

interface NextUpViewProps {
  className?: string;
}

export default function NextUpView({ className }: NextUpViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(() => {
    // Load mood from localStorage on mount
    const saved = localStorage.getItem('nextup-mood');
    return saved ? (saved as MoodType) : null;
  });

  const queryClient = useQueryClient();

  // Persist mood to localStorage whenever it changes
  useEffect(() => {
    if (selectedMood) {
      localStorage.setItem('nextup-mood', selectedMood);
    } else {
      localStorage.removeItem('nextup-mood');
    }
    // Reset to first item when mood changes
    setCurrentIndex(0);
  }, [selectedMood]);

  // Fetch next up recommendations (with mood filter if selected)
  const { data: nextUpItems, isLoading } = useQuery<NextUpItem[]>({
    queryKey: [...nextQueryKey, selectedMood] as const,
    queryFn: (async (context: any) => {
      const params = new URLSearchParams();
      if (selectedMood) {
        params.append('mood', selectedMood);
      }
      const url = `/api/next${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url, { signal: context.signal });
      const data: NextUpItem[] = await response.json();
      return data;
    }) as any,
  });

  // Mutation to mark item as watching
  const markWatchingMutation = useMutation({
    mutationFn: async (item: NextUpItem) => {
      const updateData: UpdateTrackingInput = {
        status: 'watching',
      };
      return mediaApi.updateTracking(item.id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: nextQueryKey });
      queryClient.invalidateQueries({ queryKey: mediaQueryKey });
    },
  });

  if (isLoading) {
    return (
      <div className={`next-up-view ${className || ''}`}>
        <div className="next-up-loading">
          <motion.div
            className="loading-spinner"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            🎬
          </motion.div>
          <motion.p
            variants={slideUp}
            initial="hidden"
            animate="visible"
            transition={smooth}
          >
            Finding something magical for you...
          </motion.p>
        </div>
      </div>
    );
  }

  if (!nextUpItems || nextUpItems.length === 0) {
    return (
      <div className={`next-up-view ${className || ''}`}>
        <motion.div
          className="next-up-empty"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          transition={smooth}
        >
          <motion.div
            className="empty-icon"
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            ✨
          </motion.div>
          <h2>All caught up!</h2>
          <p>You've seen all your recommendations.</p>
          <p className="empty-hint">Add more items to your library to get personalized suggestions.</p>
        </motion.div>
      </div>
    );
  }

  const currentItem = nextUpItems[currentIndex];

  if (!currentItem) {
    return (
      <div className={`next-up-view ${className || ''}`}>
        <div className="next-up-empty">
          <h2>No more recommendations</h2>
          <p>You've gone through all suggestions!</p>
        </div>
      </div>
    );
  }

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 100;
    const velocity = Math.abs(info.velocity.x);

    if (Math.abs(info.offset.x) > threshold || velocity > 500) {
      const direction = info.offset.x > 0 ? 'right' : 'left';
      setExitDirection(direction);

      setTimeout(() => {
        if (currentIndex < nextUpItems.length - 1) {
          setCurrentIndex((prev) => prev + 1);
        }
        setExitDirection(null);
      }, 300);
    }
  };

  const handleSkip = () => {
    // Show skip reason modal
    setShowSkipModal(true);
  };

  const handleSkipSubmit = async (reason: string, feedback?: string) => {
    // TODO: Send skip reason to backend for algorithm learning
    console.log('Skip reason:', reason, feedback);

    // Animate to next item
    setExitDirection('left');
    setTimeout(() => {
      if (currentIndex < nextUpItems.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      }
      setExitDirection(null);
    }, 300);
  };

  const handleWatchTonight = () => {
    setExitDirection('right');
    markWatchingMutation.mutate(currentItem);

    setTimeout(() => {
      if (currentIndex < nextUpItems.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setCurrentIndex(0);
      }
      setExitDirection(null);
    }, 300);
  };

  const handleShare = async () => {
    const shareData = {
      title: currentItem.title,
      text: `Check out ${currentItem.title}${currentItem.matchScore ? ` (${currentItem.matchScore}% match for me!)` : ''}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: Copy to clipboard
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        alert('Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const remainingCount = nextUpItems.length - currentIndex - 1;

  return (
    <div className={`next-up-view ${className || ''}`}>
      {/* Mood Selector */}
      <MoodSelector
        selectedMood={selectedMood}
        onMoodSelect={setSelectedMood}
        className="next-up-mood-selector"
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentItem.id}
          className="next-up-hero"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.7}
          onDragEnd={handleDragEnd}
          variants={fadeIn}
          initial="hidden"
          animate={exitDirection ? 'hidden' : 'visible'}
          exit={{
            x: exitDirection === 'left' ? -400 : exitDirection === 'right' ? 400 : 0,
            opacity: 0,
            transition: smooth,
          }}
          transition={spring}
          whileHover={heroCardHover}
        >
          {/* Backdrop Image */}
          <div className="hero-backdrop">
            {(currentItem.backdropUrl || currentItem.imageUrl) && (
              <motion.img
                src={currentItem.backdropUrl || currentItem.imageUrl || ''}
                alt=""
                className="backdrop-image"
                initial={{ scale: 1 }}
                animate={{ scale: 1.1 }}
                transition={{
                  duration: 20,
                  repeat: Infinity,
                  repeatType: 'reverse',
                  ease: 'linear',
                }}
              />
            )}
            <div className="backdrop-gradient" />
          </div>

          {/* Content */}
          <motion.div
            className="hero-content"
            variants={slideUp}
            initial="hidden"
            animate="visible"
            transition={{ ...smooth, delay: 0.2 }}
          >
            {/* Media type indicator */}
            <div className="media-type-badge">
              {currentItem.mediaType === 'movie' && '🎬'}
              {currentItem.mediaType === 'tv_show' && '📺'}
              {currentItem.mediaType === 'book' && '📚'}
              {' '}
              {currentItem.mediaType.replace('_', ' ')}
            </div>

            <h1 className="hero-title">{currentItem.title}</h1>

            {/* Match score */}
            {currentItem.matchScore !== undefined && currentItem.matchScore > 0 && (
              <div className="hero-match">
                <span className="match-score">{currentItem.matchScore}% Match</span>
                {currentItem.matchedItems && currentItem.matchedItems.length > 0 && (
                  <span className="match-detail">
                    • You loved {currentItem.matchedItems[0]}
                  </span>
                )}
              </div>
            )}

            {/* Context explanation */}
            <p className="hero-context">
              {currentItem.matchReason || getContextExplanation(currentItem)}
              {currentItem.suggestedContext && ` • ${currentItem.suggestedContext}`}
            </p>

            {/* Metadata */}
            <div className="hero-metadata">
              {currentItem.releaseDate && (
                <span className="metadata-item">
                  📅 {new Date(currentItem.releaseDate).getFullYear()}
                </span>
              )}
              {currentItem.estimatedTime && (
                <span className="metadata-item">⏱️ {currentItem.estimatedTime}</span>
              )}
              {currentItem.director && (
                <span className="metadata-item">🎬 {currentItem.director}</span>
              )}
              {currentItem.author && (
                <span className="metadata-item">✍️ {currentItem.author}</span>
              )}
            </div>

            {/* Genre pills */}
            {currentItem.genres && (
              <div className="hero-genres">
                {parseGenres(currentItem.genres).map((genre) => (
                  <span key={genre} className="genre-pill">
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            {currentItem.description && (
              <p className="hero-description">{currentItem.description}</p>
            )}

            {/* Secondary actions */}
            <div className="hero-secondary-actions">
              {currentItem.trailerUrl && (
                <motion.button
                  className="btn-icon"
                  onClick={() => setShowTrailerModal(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Watch Trailer"
                >
                  🎬 Trailer
                </motion.button>
              )}
              <motion.button
                className="btn-icon"
                onClick={handleShare}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Share"
              >
                📤 Share
              </motion.button>
            </div>

            {/* Actions */}
            <div className="hero-actions">
              <motion.button
                className="btn btn-skip"
                onClick={handleSkip}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                ← Skip
              </motion.button>

              <motion.button
                className="btn btn-primary btn-watch"
                onClick={handleWatchTonight}
                disabled={markWatchingMutation.isPending}
                whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(99, 102, 241, 0.5)' }}
                whileTap={{ scale: 0.95 }}
              >
                {markWatchingMutation.isPending ? 'Adding...' : 'Watch Tonight →'}
              </motion.button>
            </div>

            {/* Counter */}
            {remainingCount > 0 && (
              <motion.p
                className="hero-counter"
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.4 }}
              >
                {remainingCount} more recommendation{remainingCount !== 1 ? 's' : ''} after this
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Swipe hint (only show on first card) */}
      {currentIndex === 0 && (
        <motion.div
          className="swipe-hint"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.5 }}
        >
          ← Swipe to browse →
        </motion.div>
      )}

      {/* Modals */}
      <SkipReasonModal
        isOpen={showSkipModal}
        onClose={() => setShowSkipModal(false)}
        onSubmit={handleSkipSubmit}
        itemTitle={currentItem?.title || ''}
      />

      <TrailerModal
        isOpen={showTrailerModal}
        onClose={() => setShowTrailerModal(false)}
        trailerUrl={currentItem?.trailerUrl || null}
        itemTitle={currentItem?.title || ''}
      />
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function parseGenres(genresString: string | null): string[] {
  if (!genresString) return [];

  try {
    const parsed = JSON.parse(genresString);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // If not JSON, try comma-separated
    return genresString.split(',').map((g) => g.trim()).filter(Boolean);
  }

  return [];
}

function getContextExplanation(item: NextUpItem): string {
  // TODO: Make this smarter based on genre gravity and recent activity
  // For now, return a generic but friendly message

  const genres = parseGenres(item.genres);

  if (genres.length > 0) {
    const primaryGenre = genres[0];
    return `Perfect for your ${primaryGenre.toLowerCase()} taste`;
  }

  if (item.mediaType === 'tv_show') {
    return 'A great series to start';
  }

  if (item.mediaType === 'book') {
    return 'A compelling read for you';
  }

  return 'Recommended just for you';
}
