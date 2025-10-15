import { Request, Response, NextFunction } from 'express';
import { db } from '../db.js';
import { idempotencyKeys } from '../../shared/schema.js';
import { eq, and, lt } from 'drizzle-orm';

const IDEMPOTENCY_TTL_HOURS = 24;

export const idempotencyMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const idempotencyKey = req.headers['idempotency-key'] as string;
  
  if (!idempotencyKey) {
    return next();
  }

  if (!req.user?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = req.user.userId;
  const endpoint = `${req.method} ${req.path}`;

  try {
    const existingKey = await db
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.key, idempotencyKey),
          eq(idempotencyKeys.userId, userId)
        )
      )
      .limit(1);

    if (existingKey.length > 0) {
      const key = existingKey[0];
      
      if (new Date() > key.expiresAt) {
        await db
          .delete(idempotencyKeys)
          .where(eq(idempotencyKeys.id, key.id));
        return next();
      }

      if (key.responseStatus && key.responseBody) {
        return res.status(key.responseStatus).json(JSON.parse(key.responseBody));
      }
    }

    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);
    let statusCode = 200;

    res.status = function (code: number) {
      statusCode = code;
      return originalStatus(code);
    };

    res.json = function (body: unknown) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + IDEMPOTENCY_TTL_HOURS);

      db.insert(idempotencyKeys)
        .values({
          key: idempotencyKey,
          userId,
          endpoint,
          responseStatus: statusCode,
          responseBody: JSON.stringify(body),
          expiresAt,
        })
        .onConflictDoNothing()
        .execute()
        .catch(err => console.error('Error storing idempotency key:', err));

      return originalJson(body);
    };

    next();
  } catch (error) {
    console.error('Idempotency middleware error:', error);
    next();
  }
};

export const cleanupExpiredIdempotencyKeys = async () => {
  try {
    await db
      .delete(idempotencyKeys)
      .where(lt(idempotencyKeys.expiresAt, new Date()));
  } catch (error) {
    console.error('Error cleaning up expired idempotency keys:', error);
  }
};
