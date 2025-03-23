import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

// Get rate limit configuration from environment variables
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'); // 15 minutes by default
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '100');
const AUTH_RATE_LIMIT_MAX = parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20');
const HEAVY_OP_RATE_LIMIT_MAX = parseInt(process.env.HEAVY_OP_RATE_LIMIT_MAX || '5');

/**
 * Default rate limit configuration
 */
export const defaultRateLimit = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    status: 429,
    message: 'Too many requests, please try again later'
  },
  skip: (req: Request, res: Response) => {
    // Skip rate limiting in development
    return process.env.NODE_ENV === 'development';
  }
});

/**
 * Stricter rate limit for authentication endpoints
 */
export const authRateLimit = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many login attempts, please try again later'
  },
  skip: (req: Request, res: Response) => {
    // Skip rate limiting in development
    return process.env.NODE_ENV === 'development';
  }
});

/**
 * Heavy operation rate limit
 */
export const heavyOperationRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: HEAVY_OP_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many requests for this operation, please try again later'
  },
  skip: (req: Request, res: Response) => {
    // Skip rate limiting in development
    return process.env.NODE_ENV === 'development';
  }
}); 