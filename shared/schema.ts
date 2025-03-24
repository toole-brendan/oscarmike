import { pgTable, text, serial, integer, boolean, timestamp, real, index, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  latitude: true,
  longitude: true,
});

export const exerciseTypes = ['pushups', 'pullups', 'situps', 'run'] as const;
export type ExerciseType = typeof exerciseTypes[number];

export const exerciseStatus = ['not_started', 'in_progress', 'completed'] as const;
export type ExerciseStatus = typeof exerciseStatus[number];

export const exercises = pgTable(
  "exercises", 
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id),
    type: text("type", { enum: exerciseTypes }).notNull(),
    status: text("status", { enum: exerciseStatus }).notNull().default('not_started'),
    repCount: integer("rep_count"),
    formScore: integer("form_score"),
    runTime: integer("run_time"),
    completedAt: timestamp("completed_at"),
    points: integer("points"),
    verified: boolean("verified").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      userIdIdx: index("user_id_idx").on(table.userId),
      userTypeIdx: index("user_type_idx").on(table.userId, table.type),
      typeIdx: index("type_idx").on(table.type),
      completedAtIdx: index("completed_at_idx").on(table.completedAt),
      leaderboardIdx: index("leaderboard_idx").on(table.type, table.points),
    };
  }
);

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

export const formIssues = pgTable(
  "form_issues", 
  {
    id: serial("id").primaryKey(),
    exerciseId: integer("exercise_id").notNull().references(() => exercises.id),
    issue: text("issue").notNull(),
    severity: text("severity").notNull(),
    timestamp: timestamp("timestamp").notNull(),
  },
  (table) => {
    return {
      exerciseIdIdx: index("form_issues_exercise_id_idx").on(table.exerciseId),
      timestampIdx: index("form_issues_timestamp_idx").on(table.timestamp),
    };
  }
);

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

export const runData = pgTable(
  "run_data",
  {
    id: serial("id").primaryKey(),
    exerciseId: integer("exercise_id").notNull().references(() => exercises.id),
    deviceType: text("device_type").notNull(),
    deviceName: text("device_name").notNull(),
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time").notNull(),
    totalDistance: numeric("total_distance").notNull(),
    avgPace: integer("avg_pace").notNull(),
    avgHeartRate: integer("avg_heart_rate"),
    maxHeartRate: integer("max_heart_rate"),
    calories: integer("calories"),
    elevationGain: integer("elevation_gain"),
    gpsData: text("gps_data"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      exerciseIdIdx: index("run_data_exercise_id_idx").on(table.exerciseId),
      startTimeIdx: index("run_data_start_time_idx").on(table.startTime),
    };
  }
);

export const insertRunDataSchema = createInsertSchema(runData).pick({
  exerciseId: true,
  deviceType: true,
  deviceName: true,
  startTime: true,
  endTime: true,
  totalDistance: true,
  avgPace: true,
  avgHeartRate: true,
  maxHeartRate: true,
  calories: true,
  elevationGain: true,
  gpsData: true,
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
    image: "/images/push_up.png"
  },
  pullups: {
    title: "Pull-ups",
    description: "Max reps in 2 minutes",
    image: "/images/Pull_up.png"
  },
  situps: {
    title: "Sit-ups",
    description: "Max reps in 2 minutes",
    image: "/images/sit_up.png"
  },
  run: {
    title: "2-Mile Run",
    description: "Best completion time",
    image: "/images/running.png"
  }
};

export type ExerciseInfo = typeof exerciseInfo;
