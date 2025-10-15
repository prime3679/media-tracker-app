import express from 'express';
import { getNextUpItems } from '../services/next.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const nextItems = await getNextUpItems(userId);
    
    return res.json(nextItems);
  } catch (error) {
    console.error('Error getting next up items:', error);
    return res.status(500).json({ error: 'Failed to get next up items' });
  }
});

export default router;
