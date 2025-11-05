import express from 'express';
import { getEnhancedNextUpItems } from '../services/next-enhanced.js';
import { type MoodType, MOOD_PRESETS } from '../services/moods.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const mood = req.query.mood as MoodType | undefined;

    // Validate mood if provided
    if (mood && !MOOD_PRESETS[mood]) {
      return res.status(400).json({ error: 'Invalid mood specified' });
    }

    const nextItems = await getEnhancedNextUpItems(userId, mood);

    return res.json(nextItems);
  } catch (error) {
    console.error('Error getting next up items:', error);
    return res.status(500).json({ error: 'Failed to get next up items' });
  }
});

// Get available moods
router.get('/moods', async (_req, res) => {
  try {
    const moods = Object.entries(MOOD_PRESETS).map(([key, criteria]) => ({
      key,
      name: criteria.name,
      emoji: criteria.emoji,
      description: criteria.description,
      perfect_for: criteria.perfect_for,
    }));

    return res.json(moods);
  } catch (error) {
    console.error('Error getting moods:', error);
    return res.status(500).json({ error: 'Failed to get moods' });
  }
});

export default router;
