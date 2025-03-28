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
  ExerciseStatus,
  runData,
  insertRunDataSchema
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, count, isNotNull } from "drizzle-orm";
import { cache } from './cache';

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
  updateUserLocation(userId: number, latitude: number, longitude: number): Promise<User | undefined>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  
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
  
  // Local Leaderboard methods
  getLocalLeaderboardByExerciseType(userId: number, type: ExerciseType, radiusMiles?: number, limit?: number): Promise<Exercise[]>;
  getLocalOverallLeaderboard(userId: number, radiusMiles?: number, limit?: number): Promise<{ userId: number, username: string, totalPoints: number, distance: number }[]>;

  // Run data methods
  createRunData(data: typeof insertRunDataSchema._type): Promise<any>;
  getRunDataByExerciseId(exerciseId: number): Promise<any | undefined>;
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

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const results = await db.update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    
    return results[0];
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
    await this.invalidateLeaderboardCaches();
    return results[0];
  }

  async updateExercise(id: number, exercise: Partial<InsertExercise>): Promise<Exercise | undefined> {
    const results = await db.update(exercises)
      .set(exercise)
      .where(eq(exercises.id, id))
      .returning();
    
    await this.invalidateLeaderboardCaches();
    
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
  async getLeaderboardByExerciseType(type: ExerciseType, limit?: number): Promise<Exercise[]> {
    const cacheKey = `leaderboard:${type}:${limit || 10}`;
    
    // Try to get from cache first
    const cachedResult = await cache.get<Exercise[]>(cacheKey);
    if (cachedResult) {
      console.log(`Cache hit for ${cacheKey}`);
      return cachedResult;
    }
    
    // If not in cache, query the database
    console.log(`Cache miss for ${cacheKey}, querying database`);
    
    const result = await db.select({
      id: exercises.id,
      userId: exercises.userId,
      type: exercises.type,
      repCount: exercises.repCount,
      formScore: exercises.formScore,
      runTime: exercises.runTime,
      completedAt: exercises.completedAt,
      points: exercises.points,
      username: users.username,
    })
    .from(exercises)
    .innerJoin(users, eq(exercises.userId, users.id))
    .where(
      and(
        eq(exercises.type, type),
        eq(exercises.status, 'completed'),
        isNotNull(exercises.points)
      )
    )
    .orderBy(desc(exercises.points))
    .limit(limit || 10);
    
    // Store in cache for next time
    await cache.set(cacheKey, result);
    
    return result;
  }
  
  async getOverallLeaderboard(limit?: number): Promise<{ userId: number, username: string, totalPoints: number }[]> {
    const cacheKey = `leaderboard:overall:${limit || 10}`;
    
    // Try to get from cache first
    const cachedResult = await cache.get<{ userId: number, username: string, totalPoints: number }[]>(cacheKey);
    if (cachedResult) {
      console.log(`Cache hit for ${cacheKey}`);
      return cachedResult;
    }
    
    // If not in cache, query the database
    console.log(`Cache miss for ${cacheKey}, querying database`);
    
    const result = await db.select({
      userId: exercises.userId,
      username: users.username,
      totalPoints: sql<number>`sum(${exercises.points})::integer`,
    })
    .from(exercises)
    .innerJoin(users, eq(exercises.userId, users.id))
    .where(
      and(
        eq(exercises.status, 'completed'),
        isNotNull(exercises.points)
      )
    )
    .groupBy(exercises.userId, users.username)
    .orderBy(desc(sql`sum(${exercises.points})`))
    .limit(limit || 10);
    
    // Store in cache for next time
    await cache.set(cacheKey, result);
    
    return result;
  }
  
  async getUserHistory(userId: number, type: ExerciseType, limit: number = 10): Promise<Exercise[]> {
    try {
      // Check if there are any completed exercises for this user and type
      const exerciseCount = await db.select({ count: count() })
        .from(exercises)
        .where(
          and(
            eq(exercises.userId, userId),
            eq(exercises.type, type),
            eq(exercises.status, 'completed')
          )
        );
      
      // If no completed exercises, return empty array
      if (exerciseCount[0].count === 0) {
        return [];
      }
      
      return await db.select()
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
    } catch (error) {
      console.error('Error in getUserHistory:', error);
      // Return empty array on error
      return [];
    }
  }

  // Update user location
  async updateUserLocation(userId: number, latitude: number, longitude: number): Promise<User | undefined> {
    try {
      const results = await db.update(users)
        .set({ latitude, longitude })
        .where(eq(users.id, userId))
        .returning();
      
      return results[0];
    } catch (error) {
      console.error('Error in updateUserLocation:', error);
      return undefined;
    }
  }

  // Calculate distance between two points using Haversine formula
  private calculateDistance(lat1: number | null, lon1: number | null, lat2: number | null, lon2: number | null): number {
    // Check for null values
    if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) {
      return Number.MAX_VALUE; // Return a very large number if any coordinate is null
    }
    
    // Radius of the Earth in miles
    const earthRadiusMiles = 3958.8;
    
    // Convert latitude and longitude from degrees to radians
    const latRad1 = lat1 * (Math.PI / 180);
    const lonRad1 = lon1 * (Math.PI / 180);
    const latRad2 = lat2 * (Math.PI / 180);
    const lonRad2 = lon2 * (Math.PI / 180);
    
    // Difference in coordinates
    const dLat = latRad2 - latRad1;
    const dLon = lonRad2 - lonRad1;
    
    // Haversine formula
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(latRad1) * Math.cos(latRad2) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = earthRadiusMiles * c;
    
    return distance;
  }

  // Get exercises for local leaderboard by type
  async getLocalLeaderboardByExerciseType(
    userId: number, 
    type: ExerciseType, 
    radiusMiles: number = 5, 
    limit: number = 10
  ): Promise<(Exercise & { username: string })[]> {
    try {
      // Get current user's location
      const currentUser = await this.getUser(userId);
      if (!currentUser || !currentUser.latitude || !currentUser.longitude) {
        console.error('User location not available');
        return [];
      }
      
      // Get all completed exercises of this type with valid points
      const allExercises = await db.select({
        ...exercises,
        username: users.username,
        userLatitude: users.latitude,
        userLongitude: users.longitude
      })
      .from(exercises)
      .innerJoin(users, eq(exercises.userId, users.id))
      .where(
        and(
          eq(exercises.type, type),
          eq(exercises.status, 'completed'),
          sql`${exercises.points} IS NOT NULL`,
          // Exclude exercises where user has no location
          sql`${users.latitude} IS NOT NULL`,
          sql`${users.longitude} IS NOT NULL`
        )
      );
      
      // Filter by distance
      const localExercises = allExercises
        .filter(row => {
          if (!row.userLatitude || !row.userLongitude) return false;
          
          const distance = this.calculateDistance(
            currentUser.latitude,
            currentUser.longitude,
            row.userLatitude,
            row.userLongitude
          );
          
          return distance <= radiusMiles;
        });
      
      // Sort by points and limit results
      return localExercises
        .sort((a, b) => (b.points || 0) - (a.points || 0))
        .slice(0, limit);
    } catch (error) {
      console.error('Error in getLocalLeaderboardByExerciseType:', error);
      return [];
    }
  }

  // Get local overall leaderboard
  async getLocalOverallLeaderboard(
    userId: number, 
    radiusMiles: number = 5, 
    limit: number = 10
  ): Promise<{ userId: number, username: string, totalPoints: number, distance: number }[]> {
    try {
      // Get current user's location
      const currentUser = await this.getUser(userId);
      if (!currentUser || !currentUser.latitude || !currentUser.longitude) {
        console.error('User location not available');
        return [];
      }
      
      // Get all users with location
      const usersWithLocation = await db.select().from(users)
        .where(
          and(
            sql`${users.latitude} IS NOT NULL`,
            sql`${users.longitude} IS NOT NULL`
          )
        );
      
      // Calculate distance for each user and filter by radius
      const nearbyUsers = usersWithLocation.map(user => {
        if (!user.latitude || !user.longitude) return null;
        
        const distance = this.calculateDistance(
          currentUser.latitude,
          currentUser.longitude,
          user.latitude,
          user.longitude
        );
        
        return { ...user, distance };
      })
      .filter((user): user is User & { distance: number } => 
        user !== null && user.distance <= radiusMiles
      );
      
      // If no nearby users, return empty array
      if (nearbyUsers.length === 0) {
        return [];
      }
      
      // Get total points for each nearby user
      const userPointsPromises = nearbyUsers.map(async user => {
        // Get sum of points for completed exercises
        const pointsResult = await db.select({
          totalPoints: sql<number>`COALESCE(sum(${exercises.points}), 0)`,
        })
        .from(exercises)
        .where(
          and(
            eq(exercises.userId, user.id),
            eq(exercises.status, 'completed')
          )
        );
        
        const totalPoints = pointsResult[0]?.totalPoints || 0;
        
        return {
          userId: user.id,
          username: user.username,
          totalPoints,
          distance: user.distance
        };
      });
      
      const userPoints = await Promise.all(userPointsPromises);
      
      // Sort by total points and limit
      return userPoints
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .slice(0, limit);
    } catch (error) {
      console.error('Error in getLocalOverallLeaderboard:', error);
      return [];
    }
  }

  // Then add a method to invalidate leaderboard caches when new exercise data is added
  async invalidateLeaderboardCaches(): Promise<void> {
    // Invalidate all leaderboard caches
    await cache.delByPattern('leaderboard:*');
  }

  // Get exercise by ID
  async getExerciseById(id: number): Promise<Exercise | undefined> {
    const result = await db.select().from(exercises).where(eq(exercises.id, id)).limit(1);
    return result[0];
  }

  // Update exercise
  async updateExercise(id: number, data: Partial<Omit<Exercise, 'id'>>): Promise<Exercise | undefined> {
    const results = await db.update(exercises)
      .set(data)
      .where(eq(exercises.id, id))
      .returning();
    
    await this.invalidateLeaderboardCaches();
    
    return results[0];
  }

  // Run data methods
  async createRunData(data: typeof insertRunDataSchema._type): Promise<any> {
    const results = await db.insert(runData).values(data).returning();
    return results[0];
  }

  async getRunDataByExerciseId(exerciseId: number): Promise<any | undefined> {
    const result = await db.select()
      .from(runData)
      .where(eq(runData.exerciseId, exerciseId))
      .limit(1);
    
    return result[0];
  }
}

// Switch from memory storage to database storage
export const storage = new DatabaseStorage();
