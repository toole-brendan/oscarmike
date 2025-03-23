import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertExerciseSchema, insertFormIssueSchema, insertKeyPointsSchema, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // prefix all routes with /api
  const api = "/api";
  
  // User routes
  app.post(`${api}/users`, async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByUsername(userData.username);
      
      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" });
      }
      
      const user = await storage.createUser(userData);
      return res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(`${api}/users/:id`, async (req: Request, res: Response) => {
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
      
      const exercises = await storage.getExercises(userId);
      return res.json(exercises);
    } catch (error) {
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
      
      const formIssues = await storage.getFormIssues(exerciseId);
      return res.json(formIssues);
    } catch (error) {
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
      
      const keyPoints = await storage.getKeyPoints(exerciseId);
      return res.json(keyPoints);
    } catch (error) {
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

  const httpServer = createServer(app);
  return httpServer;
}
