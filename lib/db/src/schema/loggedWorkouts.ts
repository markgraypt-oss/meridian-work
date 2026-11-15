import { pgTable, serial, integer, text, varchar, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./schema";

// Workouts a person did outside the app and typed in afterwards: a run, a gym
// workout, a class. They live in their own table, NOT in workout_logs, so that
// nothing which counts in-app workouts (workout badges, rewards, the Workforce
// Wellbeing Index) picks them up by accident. Whatever should count them asks
// for them by name through artifacts/api-server/src/loggedWorkouts.ts.
//
// Every schema change here needs its IF NOT EXISTS twin in SELF_HEAL_DDL
// (artifacts/api-server/src/startupMigrations.ts).
export const manualWorkouts = pgTable("manual_workouts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // 'run' | 'cycle' | 'swim' | 'gym' | 'yoga' | 'pilates' | 'stretching' | 'class' | 'sport' | 'other'
  activityType: text("activity_type").notNull(),
  name: text("name").notNull(),
  startedAt: timestamp("started_at").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  distanceMeters: integer("distance_meters"),
  effort: integer("effort"), // 1-10, the same scale as workout_logs.workout_rating
  notes: text("notes"),
  // Gym workouts only: [{ exerciseLibraryId, name, exerciseType, blockType, blockGroupId, sets: [{ reps, weightKg, durationSeconds, speed }] }]
  exercises: jsonb("exercises"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  userStarted: index("manual_workouts_user_started_idx").on(t.userId, t.startedAt),
}));

export type ManualWorkout = typeof manualWorkouts.$inferSelect;
export type InsertManualWorkout = typeof manualWorkouts.$inferInsert;

// A workout that arrived from a watch or phone (wearable_workouts) and that the
// person removed from their own list ("This was not a workout. Remove it.").
// The device row itself is left alone, so a later sync cannot bring it back and
// nothing that reads device data directly is affected.
export const dismissedDeviceWorkouts = pgTable("dismissed_device_workouts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  wearableWorkoutId: integer("wearable_workout_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  userWorkout: uniqueIndex("dismissed_device_workouts_user_workout_idx").on(t.userId, t.wearableWorkoutId),
}));

export type DismissedDeviceWorkout = typeof dismissedDeviceWorkouts.$inferSelect;
