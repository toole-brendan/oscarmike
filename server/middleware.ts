import { Request, Response, NextFunction } from 'express';
import { extractTokenFromHeader, verifyToken } from './auth';
import { storage } from './storage';
import { httpLogger } from './logger';
import { v4 as uuidv4 } from 'uuid';

// Extend the Express Request interface to include a user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
      };
      id?: string; // Add request ID
      startTime?: [number, number]; // Add startTime for measuring duration
    }
  }
}

/**
 * Middleware to generate a unique ID for each request
 */
export function requestId(req: Request, res: Response, next: NextFunction) {
  req.id = uuidv4();
  next();
}

/**
 * HTTP request logger middleware
 */
export function httpLogging(req: Request, res: Response, next: NextFunction) {
  // Generate a unique ID for the request if not already set
  if (!req.id) {
    req.id = uuidv4();
  }
  
  // Record start time for duration calculation
  req.startTime = process.hrtime();
  
  // Log request information
  httpLogger.http(JSON.stringify({
    requestId: req.id,
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  }));
  
  // Log response information when request is complete
  res.on('finish', () => {
    // Calculate duration
    const hrTimeDiff = process.hrtime(req.startTime);
    const durationMs = hrTimeDiff[0] * 1000 + hrTimeDiff[1] / 1000000;
    
    httpLogger.http(JSON.stringify({
      requestId: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs)
    }));
  });
  
  next();
}

/**
 * Middleware to authenticate requests using JWT
 * If token is valid, adds user info to request object
 */
export async function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  try {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      return next(); // No token, but proceed (unauthenticated)
    }
    
    // Verify the token
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return next(); // Invalid token, but proceed (unauthenticated)
    }
    
    // Get the user from the database
    const user = await storage.getUser(decoded.id);
    
    if (!user) {
      return next(); // User not found, but proceed (unauthenticated)
    }
    
    // Add user info to request
    req.user = {
      id: user.id,
      username: user.username
    };
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    next();
  }
}

/**
 * Middleware to require authentication
 * Must be used after authenticateJWT middleware
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
} 