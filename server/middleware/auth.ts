import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';

// Augment Express Request type to include a user property
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// JWT secret - in a real app, this should be in an environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'ompt-testing-secret';

// Authentication middleware
export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
    
    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Get the user from the database
    const user = await storage.getUser(decoded.id);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Add user to request object
    req.user = user;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// Generate a JWT token for a user
export const generateToken = (userId: number): string => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '30d' });
}; 