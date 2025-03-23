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
import { eq, and, desc, asc, sql, count } from "drizzle-orm";

// Define pagination interface for API responses
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
  }
}

// Define parameters for paginated queries
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(params?: PaginationParams): Promise<PaginatedResult<User>>;
  
  // Exercise methods
  getExercises(userId: number, params?: PaginationParams): Promise<PaginatedResult<Exercise>>;
  getExercise(id: number): Promise<Exercise | undefined>;
  getExercisesByType(userId: number, type: ExerciseType, params?: PaginationParams): Promise<PaginatedResult<Exercise>>;
  createExercise(exercise: InsertExercise): Promise<Exercise>;
  updateExercise(id: number, exercise: Partial<InsertExercise>): Promise<Exercise | undefined>;
  
  // Form issues methods
  getFormIssues(exerciseId: number, params?: PaginationParams): Promise<PaginatedResult<FormIssue>>;
  createFormIssue(formIssue: InsertFormIssue): Promise<FormIssue>;
  
  // Key points methods
  getKeyPoints(exerciseId: number, params?: PaginationParams): Promise<PaginatedResult<KeyPoints>>;
  createKeyPoints(keyPoints: InsertKeyPoints): Promise<KeyPoints>;
  
  // Leaderboard methods
  getLeaderboardByExerciseType(type: ExerciseType, limit?: number): Promise<Exercise[]>;
  getOverallLeaderboard(limit?: number): Promise<{ userId: number, username: string, totalPoints: number }[]>;
  getUserHistory(userId: number, type: ExerciseType, limit?: number): Promise<Exercise[]>;
}

export class DatabaseStorage implements IStorage {
  // Helper method for pagination
  private async paginateQuery<T>(
    query: any,
    countQuery: any,
    params?: PaginationParams
  ): Promise<PaginatedResult<T>> {
    // Set default pagination parameters
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 20;
    const offset = (page - 1) * pageSize;
    
    // Execute count query to get total
    const totalResult = await countQuery;
    const total = Number(totalResult[0]?.count || 0);
    
    // Execute main query with pagination
    const data = await query.limit(pageSize).offset(offset);
    
    // Calculate page count
    const pageCount = Math.ceil(total / pageSize);
    
    return {
      data,
      meta: {
        total,
        page,
        pageSize,
        pageCount
      }
    };
  }

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
  
  async getUsers(params?: PaginationParams): Promise<PaginatedResult<User>> {
    // Build query based on sort parameters
    let query = db.select().from(users);
    
    if (params?.sortBy) {
      const column = params.sortBy === 'username' ? users.username : users.id;
      query = params.sortDirection === 'desc' 
        ? query.orderBy(desc(column)) 
        : query.orderBy(asc(column));
    } else {
      // Default sort by id
      query = query.orderBy(asc(users.id));
    }
    
    // Get total count
    const countQuery = db.select({ count: count() }).from(users);
    
    return this.paginateQuery<User>(query, countQuery, params);
  }

  // Exercise methods
  async getExercises(userId: number, params?: PaginationParams): Promise<PaginatedResult<Exercise>> {
    // Build query based on sort parameters
    let query = db.select().from(exercises).where(eq(exercises.userId, userId));
    
    if (params?.sortBy) {
      if (params.sortBy === 'createdAt') {
        query = params.sortDirection === 'desc' 
          ? query.orderBy(desc(exercises.createdAt))
          : query.orderBy(asc(exercises.createdAt));
      } else if (params.sortBy === 'completedAt') {
        query = params.sortDirection === 'desc'
          ? query.orderBy(desc(exercises.completedAt))
          : query.orderBy(asc(exercises.completedAt));
      } else if (params.sortBy === 'points') {
        query = params.sortDirection === 'desc'
          ? query.orderBy(desc(exercises.points))
          : query.orderBy(asc(exercises.points));
      }
    } else {
      // Default sort by createdAt desc (newest first)
      query = query.orderBy(desc(exercises.createdAt));
    }
    
    // Get total count
    const countQuery = db.select({ count: count() }).from(exercises)
      .where(eq(exercises.userId, userId));
    
    return this.paginateQuery<Exercise>(query, countQuery, params);
  }

  async getExercise(id: number): Promise<Exercise | undefined> {
    const results = await db.select().from(exercises).where(eq(exercises.id, id));
    return results[0];
  }

  async getExercisesByType(
    userId: number, 
    type: ExerciseType, 
    params?: PaginationParams
  ): Promise<PaginatedResult<Exercise>> {
    // Build query with filters
    let query = db.select().from(exercises).where(
      and(
        eq(exercises.userId, userId),
        eq(exercises.type, type)
      )
    );
    
    // Add sorting
    if (params?.sortBy) {
      if (params.sortBy === 'createdAt') {
        query = params.sortDirection === 'desc'
          ? query.orderBy(desc(exercises.createdAt))
          : query.orderBy(asc(exercises.createdAt));
      } else if (params.sortBy === 'completedAt') {
        query = params.sortDirection === 'desc'
          ? query.orderBy(desc(exercises.completedAt))
          : query.orderBy(asc(exercises.completedAt));
      } else if (params.sortBy === 'points') {
        query = params.sortDirection === 'desc'
          ? query.orderBy(desc(exercises.points))
          : query.orderBy(asc(exercises.points));
      }
    } else {
      // Default sort by completedAt desc (newest first)
      query = query.orderBy(desc(exercises.completedAt));
    }
    
    // Get total count
    const countQuery = db.select({ count: count() }).from(exercises)
      .where(
        and(
          eq(exercises.userId, userId),
          eq(exercises.type, type)
        )
      );
    
    return this.paginateQuery<Exercise>(query, countQuery, params);
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
  async getFormIssues(exerciseId: number, params?: PaginationParams): Promise<PaginatedResult<FormIssue>> {
    // Build query
    let query = db.select().from(formIssues).where(eq(formIssues.exerciseId, exerciseId));
    
    // Add sorting
    if (params?.sortBy) {
      if (params.sortBy === 'timestamp') {
        query = params.sortDirection === 'desc'
          ? query.orderBy(desc(formIssues.timestamp))
          : query.orderBy(asc(formIssues.timestamp));
      } else if (params.sortBy === 'severity') {
        query = params.sortDirection === 'desc'
          ? query.orderBy(desc(formIssues.severity))
          : query.orderBy(asc(formIssues.severity));
      }
    } else {
      // Default sort by timestamp
      query = query.orderBy(asc(formIssues.timestamp));
    }
    
    // Get total count
    const countQuery = db.select({ count: count() }).from(formIssues)
      .where(eq(formIssues.exerciseId, exerciseId));
    
    return this.paginateQuery<FormIssue>(query, countQuery, params);
  }

  async createFormIssue(insertFormIssue: InsertFormIssue): Promise<FormIssue> {
    const results = await db.insert(formIssues).values(insertFormIssue).returning();
    return results[0];
  }

  // Key points methods
  async getKeyPoints(exerciseId: number, params?: PaginationParams): Promise<PaginatedResult<KeyPoints>> {
    // Build query
    let query = db.select().from(keyPoints).where(eq(keyPoints.exerciseId, exerciseId));
    
    // Add sorting
    if (params?.sortBy === 'timestamp') {
      query = params.sortDirection === 'desc'
        ? query.orderBy(desc(keyPoints.timestamp))
        : query.orderBy(asc(keyPoints.timestamp));
    } else {
      // Default sort by timestamp ascending
      query = query.orderBy(asc(keyPoints.timestamp));
    }
    
    // Get total count
    const countQuery = db.select({ count: count() }).from(keyPoints)
      .where(eq(keyPoints.exerciseId, exerciseId));
    
    return this.paginateQuery<KeyPoints>(query, countQuery, params);
  }

  async createKeyPoints(insertKeyPoints: InsertKeyPoints): Promise<KeyPoints> {
    const results = await db.insert(keyPoints).values(insertKeyPoints).returning();
    return results[0];
  }
  
  // Leaderboard methods
  async getLeaderboardByExerciseType(type: ExerciseType, limit: number = 10): Promise<Exercise[]> {
    return db.select()
      .from(exercises)
      .where(eq(exercises.type, type))
      .where(eq(exercises.status, 'completed'))
      .orderBy(desc(exercises.points))
      .limit(limit);
  }
  
  async getOverallLeaderboard(limit: number = 10): Promise<{ userId: number, username: string, totalPoints: number }[]> {
    const result = await db.select({
      userId: exercises.userId,
      totalPoints: sql<number>`sum(${exercises.points})`,
    })
    .from(exercises)
    .where(eq(exercises.status, 'completed'))
    .groupBy(exercises.userId)
    .orderBy(desc(sql<number>`sum(${exercises.points})`))
    .limit(limit);
    
    // Get usernames for the results
    const userIds = result.map(r => r.userId);
    const userRecords = await db.select().from(users)
      .where(sql`${users.id} IN (${userIds.join(',')})`);
    
    // Create a map of userId to username
    const usernameMap = Object.fromEntries(
      userRecords.map(user => [user.id, user.username])
    );
    
    // Add username to each result
    return result.map(r => ({
      userId: r.userId,
      username: usernameMap[r.userId] || 'Unknown User',
      totalPoints: r.totalPoints
    }));
  }
  
  async getUserHistory(userId: number, type: ExerciseType, limit: number = 10): Promise<Exercise[]> {
    return db.select()
      .from(exercises)
      .where(
        and(
          eq(exercises.userId, userId),
          eq(exercises.type, type),
          eq(exercises.status, 'completed')
        )
      )
      .orderBy(desc(exercises.completedAt))
      .limit(limit);
  }
}

// Switch from memory storage to database storage
export const storage = new DatabaseStorage();
