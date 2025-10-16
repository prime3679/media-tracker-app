import type { Request, Response, NextFunction } from 'express';
import { authService, type JWTPayload } from '../services/auth.js';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  if (process.env.BYPASS_AUTH === 'true') {
    req.user = { userId: 1, email: 'test@example.com' };
    next();
    return;
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const payload = authService.verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Access token expired' });
    } else {
      res.status(401).json({ error: 'Invalid access token' });
    }
  }
};
