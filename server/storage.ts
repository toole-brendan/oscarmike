import { 
  users, 
  type User, 
  type InsertUser,
  exercises,
  type Exercise,
  type InsertExercise,
  formIssues,
  type FormIssue,
  type InsertFormIssue,
  keyPoints,
  type KeyPoints,
  type InsertKeyPoints,
  ExerciseType,
  ExerciseStatus
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Exercise methods
  getExercises(userId: number): Promise<Exercise[]>;
  getExercise(id: number): Promise<Exercise | undefined>;
  getExercisesByType(userId: number, type: ExerciseType): Promise<Exercise[]>;
  createExercise(exercise: InsertExercise): Promise<Exercise>;
  updateExercise(id: number, exercise: Partial<InsertExercise>): Promise<Exercise | undefined>;
  
  // Form issues methods
  getFormIssues(exerciseId: number): Promise<FormIssue[]>;
  createFormIssue(formIssue: InsertFormIssue): Promise<FormIssue>;
  
  // Key points methods
  getKeyPoints(exerciseId: number): Promise<KeyPoints[]>;
  createKeyPoints(keyPoints: InsertKeyPoints): Promise<KeyPoints>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const results = await db.select().from(users).where(eq(users.id, id));
    return results[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const results = await db.select().from(users).where(eq(users.username, username));
    return results[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const results = await db.insert(users).values(insertUser).returning();
    return results[0];
  }

  // Exercise methods
  async getExercises(userId: number): Promise<Exercise[]> {
    return await db.select().from(exercises).where(eq(exercises.userId, userId));
  }

  async getExercise(id: number): Promise<Exercise | undefined> {
    const results = await db.select().from(exercises).where(eq(exercises.id, id));
    return results[0];
  }

  async getExercisesByType(userId: number, type: ExerciseType): Promise<Exercise[]> {
    return await db.select().from(exercises).where(
      and(
        eq(exercises.userId, userId),
        eq(exercises.type, type)
      )
    );
  }

  async createExercise(insertExercise: InsertExercise): Promise<Exercise> {
    const results = await db.insert(exercises).values(insertExercise).returning();
    return results[0];
  }

  async updateExercise(id: number, exercise: Partial<InsertExercise>): Promise<Exercise | undefined> {
    const results = await db.update(exercises)
      .set(exercise)
      .where(eq(exercises.id, id))
      .returning();
    
    return results[0];
  }

  // Form issues methods
  async getFormIssues(exerciseId: number): Promise<FormIssue[]> {
    return await db.select().from(formIssues).where(eq(formIssues.exerciseId, exerciseId));
  }

  async createFormIssue(insertFormIssue: InsertFormIssue): Promise<FormIssue> {
    const results = await db.insert(formIssues).values(insertFormIssue).returning();
    return results[0];
  }

  // Key points methods
  async getKeyPoints(exerciseId: number): Promise<KeyPoints[]> {
    return await db.select().from(keyPoints).where(eq(keyPoints.exerciseId, exerciseId));
  }

  async createKeyPoints(insertKeyPoints: InsertKeyPoints): Promise<KeyPoints> {
    const results = await db.insert(keyPoints).values(insertKeyPoints).returning();
    return results[0];
  }
}

// Switch from memory storage to database storage
export const storage = new DatabaseStorage();
