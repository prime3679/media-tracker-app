/**
 * Mood Selector Component
 *
 * Lets users pick their current vibe to get mood-specific recommendations.
 * Beautiful grid of mood cards with smooth animations.
 */

import { motion } from 'framer-motion';
import { staggerContainer, staggerItem, smooth } from '../animations/transitions';
import './MoodSelector.css';

export type MoodType =
  | 'cozy_evening'
  | 'adrenaline_rush'
  | 'brain_food'
  | 'quick_laugh'
  | 'epic_journey'
  | 'wind_down';

export interface Mood {
  key: MoodType;
  emoji: string;
  name: string;
  description: string;
  perfect_for: string[];
}

interface MoodSelectorProps {
  selectedMood: MoodType | null;
  onMoodSelect: (mood: MoodType | null) => void;
  className?: string;
}

const MOODS: Mood[] = [
  {
    key: 'cozy_evening',
    emoji: '☕',
    name: 'Cozy Evening',
    description: 'Warm, feel-good content to unwind with',
    perfect_for: ['Relaxing after work', 'Cuddling up', 'Winding down'],
  },
  {
    key: 'adrenaline_rush',
    emoji: '⚡',
    name: 'Adrenaline Rush',
    description: 'Intense, fast-paced excitement',
    perfect_for: ['Weekend energy', 'Getting pumped', 'Escaping reality'],
  },
  {
    key: 'brain_food',
    emoji: '🧠',
    name: 'Brain Food',
    description: 'Thought-provoking, mind-expanding',
    perfect_for: ['Learning something new', 'Deep thinking', 'Expanding perspective'],
  },
  {
    key: 'quick_laugh',
    emoji: '😂',
    name: 'Quick Laugh',
    description: 'Short, funny content for instant mood boost',
    perfect_for: ['Lunch break', 'Quick mood lift', 'While cooking'],
  },
  {
    key: 'epic_journey',
    emoji: '🌟',
    name: 'Epic Journey',
    description: 'Grand, immersive storytelling',
    perfect_for: ['Weekend marathons', 'Time to commit', 'Getting lost in a world'],
  },
  {
    key: 'wind_down',
    emoji: '😴',
    name: 'Wind Down',
    description: 'Calm, low-stakes content for sleep',
    perfect_for: ['Before bedtime', 'Calming anxiety', 'Evening ritual'],
  },
];

export default function MoodSelector({
  selectedMood,
  onMoodSelect,
  className,
}: MoodSelectorProps) {
  const handleMoodClick = (mood: MoodType) => {
    if (selectedMood === mood) {
      // Click again to deselect
      onMoodSelect(null);
    } else {
      onMoodSelect(mood);
    }
  };

  return (
    <div className={`mood-selector ${className || ''}`}>
      <div className="mood-header">
        <h2>How are you feeling?</h2>
        {selectedMood && (
          <motion.button
            className="clear-mood-btn"
            onClick={() => onMoodSelect(null)}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={smooth}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            ✕ Clear
          </motion.button>
        )}
      </div>

      <motion.div
        className="mood-grid"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {MOODS.map((mood) => (
          <motion.button
            key={mood.key}
            className={`mood-card ${selectedMood === mood.key ? 'selected' : ''}`}
            onClick={() => handleMoodClick(mood.key)}
            variants={staggerItem}
            whileHover={{ scale: 1.03, y: -4 }}
            whileTap={{ scale: 0.97 }}
            transition={smooth}
          >
            <div className="mood-emoji">{mood.emoji}</div>
            <h3 className="mood-name">{mood.name}</h3>
            <p className="mood-description">{mood.description}</p>
            {selectedMood === mood.key && (
              <motion.div
                className="mood-selected-badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 15, stiffness: 300 }}
              >
                ✓
              </motion.div>
            )}
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
