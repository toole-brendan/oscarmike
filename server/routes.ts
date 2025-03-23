import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, type PaginationParams } from "./storage";
import { ExerciseType, insertExerciseSchema, insertFormIssueSchema, insertKeyPointsSchema, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { comparePassword, generateToken, hashPassword } from "./auth";
import { authenticateJWT, requireAuth } from "./middleware";
import { authRateLimit, defaultRateLimit, heavyOperationRateLimit } from "./ratelimit";

// Login schema for validating login requests
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Helper to extract pagination parameters from request
const getPaginationParams = (req: Request): PaginationParams => {
  const page = req.query.page ? parseInt(req.query.page as string) : undefined;
  const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined;
  const sortBy = req.query.sortBy as string | undefined;
  const sortDirection = (req.query.sortDirection as 'asc' | 'desc' | undefined);
  
  return {
    page: !isNaN(page as number) ? page : undefined,
    pageSize: !isNaN(pageSize as number) ? pageSize : undefined,
    sortBy,
    sortDirection: (sortDirection === 'asc' || sortDirection === 'desc') 
      ? sortDirection 
      : undefined
  };
};

export async function registerRoutes(app: Express): Promise<Server> {
  // prefix all routes with /api
  const api = "/api";
  
  // Add rate limiting to all API routes
  app.use(`${api}`, defaultRateLimit);
  
  // Add JWT authentication middleware to all routes
  app.use(`${api}`, authenticateJWT);
  
  // Login route with stricter rate limiting
  app.post(`${api}/login`, authRateLimit, async (req: Request, res: Response) => {
    try {
      const loginData = loginSchema.parse(req.body);
      const user = await storage.getUserByUsername(loginData.username);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Compare password with hash
      const isValidPassword = await comparePassword(loginData.password, user.password);
      
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Generate JWT token
      const token = generateToken({ id: user.id, username: user.username });
      
      // Return user data and token
      const { password, ...userData } = user;
      return res.status(200).json({ 
        user: userData,
        token 
      });
    } catch (error) {
      console.error('Error during login:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // User creation with stricter rate limiting
  app.post(`${api}/users`, authRateLimit, async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByUsername(userData.username);
      
      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" });
      }
      
      // Hash the password before storing
      const hashedPassword = await hashPassword(userData.password);
      
      // Create user with hashed password
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword
      });
      
      // Generate JWT token
      const token = generateToken({ id: user.id, username: user.username });
      
      // Return user data (except password) and token
      const { password, ...userResponse } = user;
      return res.status(201).json({
        user: userResponse,
        token
      });
    } catch (error) {
      console.error('Error creating user:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      
      // Provide more detailed error information
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({ 
        message: "Internal server error", 
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      });
    }
  });

  // Protected routes
  app.get(`${api}/users`, requireAuth, async (req: Request, res: Response) => {
    try {
      const paginationParams = getPaginationParams(req);
      const users = await storage.getUsers(paginationParams);
      return res.json(users);
    } catch (error) {
      console.error('Error getting users:', error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(`${api}/users/:id`, requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      return res.json(user);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Exercise routes
  app.get(`${api}/users/:userId/exercises`, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const paginationParams = getPaginationParams(req);
      const exercises = await storage.getExercises(userId, paginationParams);
      return res.json(exercises);
    } catch (error) {
      console.error('Error getting exercises:', error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(`${api}/users/:userId/exercises/:type`, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const type = req.params.type as ExerciseType;
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      if (!['pushups', 'pullups', 'situps', 'run'].includes(type)) {
        return res.status(400).json({ message: "Invalid exercise type" });
      }
      
      const paginationParams = getPaginationParams(req);
      const exercises = await storage.getExercisesByType(userId, type, paginationParams);
      return res.json(exercises);
    } catch (error) {
      console.error('Error getting exercises by type:', error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(`${api}/exercises/:id`, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid exercise ID" });
      }
      
      const exercise = await storage.getExercise(id);
      
      if (!exercise) {
        return res.status(404).json({ message: "Exercise not found" });
      }
      
      return res.json(exercise);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(`${api}/exercises`, async (req: Request, res: Response) => {
    try {
      console.log("Creating exercise with data:", JSON.stringify(req.body));
      const exerciseData = insertExerciseSchema.parse(req.body);
      const exercise = await storage.createExercise(exerciseData);
      return res.status(201).json(exercise);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.format());
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error creating exercise:", error);
      return res.status(500).json({ message: "Internal server error", error: (error as Error).message });
    }
  });

  app.patch(`${api}/exercises/:id`, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid exercise ID" });
      }
      
      const exerciseData = req.body;
      const exercise = await storage.updateExercise(id, exerciseData);
      
      if (!exercise) {
        return res.status(404).json({ message: "Exercise not found" });
      }
      
      return res.json(exercise);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Form issues routes
  app.get(`${api}/exercises/:exerciseId/form-issues`, async (req: Request, res: Response) => {
    try {
      const exerciseId = parseInt(req.params.exerciseId);
      
      if (isNaN(exerciseId)) {
        return res.status(400).json({ message: "Invalid exercise ID" });
      }
      
      const paginationParams = getPaginationParams(req);
      const formIssues = await storage.getFormIssues(exerciseId, paginationParams);
      return res.json(formIssues);
    } catch (error) {
      console.error('Error getting form issues:', error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(`${api}/form-issues`, async (req: Request, res: Response) => {
    try {
      const formIssueData = insertFormIssueSchema.parse(req.body);
      const formIssue = await storage.createFormIssue(formIssueData);
      return res.status(201).json(formIssue);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Key points routes
  app.get(`${api}/exercises/:exerciseId/key-points`, async (req: Request, res: Response) => {
    try {
      const exerciseId = parseInt(req.params.exerciseId);
      
      if (isNaN(exerciseId)) {
        return res.status(400).json({ message: "Invalid exercise ID" });
      }
      
      const paginationParams = getPaginationParams(req);
      const keyPoints = await storage.getKeyPoints(exerciseId, paginationParams);
      return res.json(keyPoints);
    } catch (error) {
      console.error('Error getting key points:', error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(`${api}/key-points`, async (req: Request, res: Response) => {
    try {
      const keyPointsData = insertKeyPointsSchema.parse(req.body);
      const keyPoints = await storage.createKeyPoints(keyPointsData);
      return res.status(201).json(keyPoints);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Leaderboard routes
  app.get(`${api}/leaderboard/:type`, heavyOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const type = req.params.type as ExerciseType;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      if (!['pushups', 'pullups', 'situps', 'run'].includes(type)) {
        return res.status(400).json({ message: "Invalid exercise type" });
      }
      
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({ message: "Invalid limit parameter" });
      }
      
      const leaderboard = await storage.getLeaderboardByExerciseType(type, limit);
      return res.json(leaderboard);
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(`${api}/leaderboard`, heavyOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({ message: "Invalid limit parameter" });
      }
      
      const overallLeaderboard = await storage.getOverallLeaderboard(limit);
      return res.json(overallLeaderboard);
    } catch (error) {
      console.error('Error getting overall leaderboard:', error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Local leaderboard routes
  app.get(`${api}/local-leaderboard/:type`, heavyOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const type = req.params.type as ExerciseType;
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      const radius = req.query.radius ? parseFloat(req.query.radius as string) : 5; // Default 5 miles
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      if (!['pushups', 'pullups', 'situps', 'run'].includes(type)) {
        return res.status(400).json({ message: "Invalid exercise type" });
      }
      
      if (isNaN(radius) || radius < 0.1 || radius > 50) {
        return res.status(400).json({ message: "Invalid radius parameter (must be between 0.1 and 50 miles)" });
      }
      
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({ message: "Invalid limit parameter" });
      }
      
      const leaderboard = await storage.getLocalLeaderboardByExerciseType(userId, type, radius, limit);
      return res.json(leaderboard);
    } catch (error) {
      console.error('Error getting local leaderboard:', error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(`${api}/local-leaderboard`, heavyOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      const radius = req.query.radius ? parseFloat(req.query.radius as string) : 5; // Default 5 miles
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      if (isNaN(radius) || radius < 0.1 || radius > 50) {
        return res.status(400).json({ message: "Invalid radius parameter (must be between 0.1 and 50 miles)" });
      }
      
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({ message: "Invalid limit parameter" });
      }
      
      const overallLeaderboard = await storage.getLocalOverallLeaderboard(userId, radius, limit);
      return res.json(overallLeaderboard);
    } catch (error) {
      console.error('Error getting local overall leaderboard:', error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Update user location
  app.patch(`${api}/users/:userId/location`, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const { latitude, longitude } = req.body;
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return res.status(400).json({ message: "Latitude and longitude must be numbers" });
      }
      
      // Validate latitude and longitude ranges
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({ message: "Invalid latitude or longitude values" });
      }
      
      const updatedUser = await storage.updateUserLocation(userId, latitude, longitude);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      return res.json({
        userId: updatedUser.id,
        username: updatedUser.username,
        latitude: updatedUser.latitude,
        longitude: updatedUser.longitude
      });
    } catch (error) {
      console.error('Error updating user location:', error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(`${api}/users/:userId/history/:type`, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const type = req.params.type as ExerciseType;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      if (!['pushups', 'pullups', 'situps', 'run'].includes(type)) {
        return res.status(400).json({ message: "Invalid exercise type" });
      }
      
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({ message: "Invalid limit parameter" });
      }
      
      const history = await storage.getUserHistory(userId, type, limit);
      return res.json(history);
    } catch (error) {
      console.error('Error getting user history:', error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
