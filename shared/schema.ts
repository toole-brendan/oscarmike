import { pgTable, text, serial, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const exerciseTypes = ['pushups', 'pullups', 'situps', 'run'] as const;
export type ExerciseType = typeof exerciseTypes[number];

export const exerciseStatus = ['not_started', 'in_progress', 'completed'] as const;
export type ExerciseStatus = typeof exerciseStatus[number];

export const exercises = pgTable("exercises", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type", { enum: exerciseTypes }).notNull(),
  status: text("status", { enum: exerciseStatus }).notNull().default('not_started'),
  repCount: integer("rep_count"),
  formScore: integer("form_score"),
  runTime: integer("run_time"),
  completedAt: timestamp("completed_at"),
  points: integer("points"),
});

export const insertExerciseSchema = createInsertSchema(exercises).pick({
  userId: true,
  type: true,
  status: true,
  repCount: true,
  formScore: true,
  runTime: true,
  completedAt: true,
  points: true,
});

export const formIssues = pgTable("form_issues", {
  id: serial("id").primaryKey(),
  exerciseId: integer("exercise_id").notNull().references(() => exercises.id),
  issue: text("issue").notNull(),
  severity: text("severity").notNull(),
  timestamp: timestamp("timestamp").notNull(),
});

export const insertFormIssueSchema = createInsertSchema(formIssues).pick({
  exerciseId: true,
  issue: true,
  severity: true,
  timestamp: true,
});

export const keyPoints = pgTable("key_points", {
  id: serial("id").primaryKey(),
  exerciseId: integer("exercise_id").notNull().references(() => exercises.id),
  timestamp: timestamp("timestamp").notNull(),
  data: text("data").notNull(),
});

export const insertKeyPointsSchema = createInsertSchema(keyPoints).pick({
  exerciseId: true,
  timestamp: true,
  data: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Exercise = typeof exercises.$inferSelect;
export type InsertExercise = z.infer<typeof insertExerciseSchema>;
export type FormIssue = typeof formIssues.$inferSelect;
export type InsertFormIssue = z.infer<typeof insertFormIssueSchema>;
export type KeyPoints = typeof keyPoints.$inferSelect;
export type InsertKeyPoints = z.infer<typeof insertKeyPointsSchema>;

export const exerciseInfo = {
  pushups: {
    title: "Push-ups",
    description: "Max reps in 2 minutes",
    image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80"
  },
  pullups: {
    title: "Pull-ups",
    description: "Max reps in 2 minutes",
    image: "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80"
  },
  situps: {
    title: "Sit-ups",
    description: "Max reps in 2 minutes",
    image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80"
  },
  run: {
    title: "2-Mile Run",
    description: "Best completion time",
    image: "https://images.unsplash.com/photo-1486218119243-13883505764c?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80"
  }
};

export type ExerciseInfo = typeof exerciseInfo;
