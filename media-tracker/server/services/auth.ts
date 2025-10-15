import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../storage.js';
import type { User } from '../../shared/schema.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export interface JWTPayload {
  userId: number;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  generateAccessToken(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  }

  generateRefreshToken(): string {
    return uuidv4();
  }

  verifyAccessToken(token: string): JWTPayload {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  }

  async createRefreshToken(userId: number): Promise<string> {
    const token = this.generateRefreshToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await storage.createRefreshToken({
      userId,
      token,
      expiresAt,
    });

    return token;
  }

  async validateRefreshToken(token: string): Promise<User | null> {
    const refreshToken = await storage.getRefreshToken(token);

    if (!refreshToken) {
      return null;
    }

    if (refreshToken.revokedAt) {
      await this.handleTokenReuse(refreshToken.userId);
      return null;
    }

    if (new Date() > refreshToken.expiresAt) {
      return null;
    }

    const user = await storage.getUser(refreshToken.userId);
    return user || null;
  }

  async handleTokenReuse(userId: number): Promise<void> {
    console.warn(`Potential token reuse detected for user ${userId}. Revoking all tokens.`);
    await storage.revokeAllUserRefreshTokens(userId);
  }

  async rotateRefreshToken(oldToken: string, user: User): Promise<AuthTokens> {
    await storage.revokeRefreshToken(oldToken);
    
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id);

    return { accessToken, refreshToken };
  }

  async login(email: string, password: string): Promise<{ user: User; tokens: AuthTokens } | null> {
    const user = await storage.getUserByEmail(email);

    if (!user) {
      return null;
    }

    const isValidPassword = await this.verifyPassword(password, user.password);

    if (!isValidPassword) {
      return null;
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      user,
      tokens: { accessToken, refreshToken },
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await storage.revokeRefreshToken(refreshToken);
  }

  async cleanupExpiredTokens(): Promise<void> {
    await storage.deleteExpiredRefreshTokens();
  }
}

export const authService = new AuthService();
