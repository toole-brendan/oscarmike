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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private exercises: Map<number, Exercise>;
  private formIssues: Map<number, FormIssue>;
  private keyPoints: Map<number, KeyPoints>;
  
  private userIdCounter: number;
  private exerciseIdCounter: number;
  private formIssueIdCounter: number;
  private keyPointsIdCounter: number;

  constructor() {
    this.users = new Map();
    this.exercises = new Map();
    this.formIssues = new Map();
    this.keyPoints = new Map();
    
    this.userIdCounter = 1;
    this.exerciseIdCounter = 1;
    this.formIssueIdCounter = 1;
    this.keyPointsIdCounter = 1;
    
    // Add test user
    this.createUser({
      username: "test",
      password: "password"
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Exercise methods
  async getExercises(userId: number): Promise<Exercise[]> {
    return Array.from(this.exercises.values()).filter(
      (exercise) => exercise.userId === userId
    );
  }

  async getExercise(id: number): Promise<Exercise | undefined> {
    return this.exercises.get(id);
  }

  async getExercisesByType(userId: number, type: ExerciseType): Promise<Exercise[]> {
    return Array.from(this.exercises.values()).filter(
      (exercise) => exercise.userId === userId && exercise.type === type
    );
  }

  async createExercise(insertExercise: InsertExercise): Promise<Exercise> {
    const id = this.exerciseIdCounter++;
    const exercise: Exercise = { ...insertExercise, id };
    this.exercises.set(id, exercise);
    return exercise;
  }

  async updateExercise(id: number, exercise: Partial<InsertExercise>): Promise<Exercise | undefined> {
    const existingExercise = this.exercises.get(id);
    
    if (!existingExercise) {
      return undefined;
    }
    
    const updatedExercise: Exercise = { ...existingExercise, ...exercise };
    this.exercises.set(id, updatedExercise);
    
    return updatedExercise;
  }

  // Form issues methods
  async getFormIssues(exerciseId: number): Promise<FormIssue[]> {
    return Array.from(this.formIssues.values()).filter(
      (issue) => issue.exerciseId === exerciseId
    );
  }

  async createFormIssue(insertFormIssue: InsertFormIssue): Promise<FormIssue> {
    const id = this.formIssueIdCounter++;
    const formIssue: FormIssue = { ...insertFormIssue, id };
    this.formIssues.set(id, formIssue);
    return formIssue;
  }

  // Key points methods
  async getKeyPoints(exerciseId: number): Promise<KeyPoints[]> {
    return Array.from(this.keyPoints.values()).filter(
      (keyPoint) => keyPoint.exerciseId === exerciseId
    );
  }

  async createKeyPoints(insertKeyPoints: InsertKeyPoints): Promise<KeyPoints> {
    const id = this.keyPointsIdCounter++;
    const keyPoints: KeyPoints = { ...insertKeyPoints, id };
    this.keyPoints.set(id, keyPoints);
    return keyPoints;
  }
}

export const storage = new MemStorage();
