import express from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.js';

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const result = await authService.login(email, password);

    if (!result) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { user, tokens } = result;

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      tokens,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: error.issues,
      });
    }
    console.error('Error during login:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    const user = await authService.validateRefreshToken(refreshToken);

    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const tokens = await authService.rotateRefreshToken(refreshToken, user);

    return res.json({ tokens });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: error.issues,
      });
    }
    console.error('Error during token refresh:', error);
    return res.status(500).json({ error: 'Token refresh failed' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    await authService.logout(refreshToken);

    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: error.issues,
      });
    }
    console.error('Error during logout:', error);
    return res.status(500).json({ error: 'Logout failed' });
  }
});

export default router;
