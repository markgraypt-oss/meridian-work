import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  boolean,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - mandatory for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email"),
  password: varchar("password"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  companyName: varchar("company_name"),
  companyId: integer("company_id"),
  departmentId: integer("department_id"),
  displayName: varchar("display_name"),
  dateOfBirth: varchar("date_of_birth"),
  gender: varchar("gender"),
  height: real("height"),
  heightUnit: varchar("height_unit").default("cm"),
  profileImageUrl: varchar("profile_image_url"),
  isAdmin: boolean("is_admin").default(false),
  currentStreak: integer("current_streak").default(0),
  longestStreak: integer("longest_streak").default(0),
  lastStreakActivityDate: varchar("last_streak_activity_date"),
  weightUnit: varchar("weight_unit").default("kg"),
  distanceUnit: varchar("distance_unit").default("km"),
  timeFormat: varchar("time_format").default("24h"),
  dateFormat: varchar("date_format").default("DD/MM/YYYY"),
  restTimerSounds: boolean("rest_timer_sounds").default(true),
  countdownBeeps: boolean("countdown_beeps").default(true),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  onboardingDismissed: boolean("onboarding_dismissed").default(false),
  onboardingStep: integer("onboarding_step").default(0),
  onboardingData: jsonb("onboarding_data"),
  movementScreeningFlags: jsonb("movement_screening_flags"),
  firstLoginAt: timestamp("first_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Password reset tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notification Preferences
export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Push notification toggles
  workoutReminders: boolean("workout_reminders").default(true),
  habitReminders: boolean("habit_reminders").default(true),
  dailyCheckInPrompts: boolean("daily_check_in_prompts").default(true),
  badgeAlerts: boolean("badge_alerts").default(true),
  programUpdates: boolean("program_updates").default(true),
  hydrationReminders: boolean("hydration_reminders").default(true),
  supplementReminders: boolean("supplement_reminders").default(false),
  supplementTime: varchar("supplement_time").default("08:00"),
  bodyMapReassessment: boolean("body_map_reassessment").default(false),
  bodyMapFrequencyDays: integer("body_map_frequency_days").default(14),
  positionRotation: boolean("position_rotation").default(false),
  positionRotationMinutes: integer("position_rotation_minutes").default(30),
  // Email notification preferences
  emailWorkoutSummary: boolean("email_workout_summary").default(true),
  emailWeeklyProgress: boolean("email_weekly_progress").default(true),
  emailProgramReminders: boolean("email_program_reminders").default(true),
  // Quiet hours
  quietHoursEnabled: boolean("quiet_hours_enabled").default(false),
  quietHoursStart: varchar("quiet_hours_start").default("22:00"),
  quietHoursEnd: varchar("quiet_hours_end").default("07:00"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = typeof notificationPreferences.$inferInsert;

// Master Exercise Library
export const exerciseLibrary = pgTable("exercise_library", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  instructions: text("instructions"), // Exercise coaching cues
  muxPlaybackId: text("mux_playback_id"), // Mux video playback ID
  imageUrl: text("image_url"),
  // Tag categories for filtering
  mainMuscle: text("main_muscle").array(), // Primary muscles targeted
  equipment: text("equipment").array(), // Equipment needed
  movement: text("movement").array(), // Movement patterns
  mechanics: text("mechanics").array(), // Exercise mechanics (compound/isolation)
  level: text("level"), // Difficulty level (single value)
  exerciseType: text("exercise_type").default("strength"), // 'general', 'endurance', 'strength', 'cardio', 'timed', 'timed_strength'
  laterality: text("laterality").default("bilateral"), // 'unilateral' or 'bilateral' - for exercises that need left/right tracking
  createdAt: timestamp("created_at").defaultNow(),
});

// Training programs
export const programs = pgTable("programs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  whoItsFor: text("who_its_for"), // Target audience description
  goal: text("goal").notNull(), // 'power', 'max_strength', 'conditioning', 'hiit', 'muscular_endurance', 'active_recovery', 'mobility_stretching', 'recovery', 'hypertrophy', 'general_strength', 'corrective', 'mobility', 'yoga'
  equipment: text("equipment").notNull(), // 'home_gym', 'full_gym', 'bodyweight'
  duration: integer("duration").notNull(), // minutes
  weeks: integer("weeks").notNull(),
  trainingDaysPerWeek: integer("training_days_per_week").notNull().default(3), // how many training days per week (e.g., 3, 5, 7)
  difficulty: text("difficulty").notNull(), // 'beginner', 'intermediate', 'advanced'
  programmeType: text("programme_type").notNull().default("main"), // 'main', 'supplementary', 'stretching', 'corrective'
  sourceType: text("source_type").notNull().default("manual"), // 'manual' (created by admin), 'recovery' (generated from body map), 'user_created' (created by user)
  createdByUserId: varchar("created_by_user_id").references(() => users.id, { onDelete: "cascade" }),
  imageUrl: text("image_url"),
  category: text("category").array(),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Programme weeks - container for each week of the programme
export const programWeeks = pgTable("program_weeks", {
  id: serial("id").primaryKey(),
  programId: integer("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
  weekNumber: integer("week_number").notNull(), // 1-based week number
  createdAt: timestamp("created_at").defaultNow(),
});

// Programme days - each day within a week (position 1-7 for Mon-Sun)
export const programDays = pgTable("program_days", {
  id: serial("id").primaryKey(),
  weekId: integer("week_id").notNull().references(() => programWeeks.id, { onDelete: "cascade" }),
  position: integer("position").notNull(), // 1-7 (Monday-Sunday)
  createdAt: timestamp("created_at").defaultNow(),
});

// Programme workouts - workouts assigned to specific days
export const programmeWorkouts = pgTable("programme_workouts", {
  id: serial("id").primaryKey(),
  dayId: integer("day_id").notNull().references(() => programDays.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g., "Chest & Back"
  description: text("description"), // Workout notes/description
  workoutType: text("workout_type").notNull().default("regular"), // 'regular', 'interval', 'circuit', 'video'
  category: text("category").notNull().default("strength"), // 'strength', 'cardio', 'hiit', 'mobility', 'recovery'
  difficulty: text("difficulty").notNull().default("beginner"), // 'beginner', 'intermediate', 'advanced'
  duration: integer("duration").notNull().default(30), // estimated duration in minutes
  intervalRounds: integer("interval_rounds").default(4), // number of rounds for interval workouts
  intervalRestAfterRound: text("interval_rest_after_round").default("60 sec"), // rest duration after each round
  imageUrl: text("image_url"), // Cover image URL for the workout
  position: integer("position").notNull(), // order within the day (in case multiple workouts per day)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Programme exercises - exercises within a workout (legacy flat structure)
export const programExercises = pgTable("programme_exercises", {
  id: serial("id").primaryKey(),
  workoutId: integer("workout_id").notNull().references(() => programmeWorkouts.id, { onDelete: "cascade" }),
  exerciseLibraryId: integer("exercise_library_id").references(() => exerciseLibrary.id, { onDelete: "restrict" }),
  name: text("name"), // optional: can store exercise name directly for custom exercises
  position: integer("position").notNull(), // order within the workout
  sets: text("sets").notNull(), // e.g., "3", "3-4", "AMRAP"
  reps: text("reps").notNull(), // e.g., "8-12", "20", "30 sec"
  rest: text("rest").notNull(), // e.g., "60 sec", "90 sec", "2 min"
  tempo: text("tempo"), // e.g., "3-1-1-0" (eccentric-pause-concentric-pause)
  notes: text("notes"), // additional instructions or coaching cues
  createdAt: timestamp("created_at").defaultNow(),
});

// Programme workout blocks - containers for exercises (single, superset, triset, circuit)
export const programmeWorkoutBlocks = pgTable("programme_workout_blocks", {
  id: serial("id").primaryKey(),
  workoutId: integer("workout_id").notNull().references(() => programmeWorkouts.id, { onDelete: "cascade" }),
  section: text("section").notNull().default('main'), // 'warmup' or 'main'
  blockType: text("block_type").notNull(), // 'single', 'superset', 'triset', 'circuit'
  position: integer("position").notNull(), // order within the workout
  rest: text("rest"), // rest period after the block (e.g., "60 sec", "90 sec")
  rounds: integer("rounds"), // number of rounds for interval mini-circuits
  restAfterRound: text("rest_after_round"), // rest after completing all exercises in mini-circuit (for interval workouts)
  createdAt: timestamp("created_at").defaultNow(),
});

// Programme block exercises - exercises within a block
export const programmeBlockExercises = pgTable("programme_block_exercises", {
  id: serial("id").primaryKey(),
  blockId: integer("block_id").notNull().references(() => programmeWorkoutBlocks.id, { onDelete: "cascade" }),
  exerciseLibraryId: integer("exercise_library_id").references(() => exerciseLibrary.id, { onDelete: "restrict" }),
  position: integer("position").notNull(), // order within the block
  sets: jsonb("sets").notNull(), // array of set objects: [{reps, duration?, rest?}, ...]
  durationType: text("duration_type"), // 'text' for reps only, 'timer' for time-based
  tempo: text("tempo"), // e.g., "3-1-1-0"
  load: text("load"), // e.g., "30kg", "50lbs", "bodyweight"
  notes: text("notes"), // additional instructions
  createdAt: timestamp("created_at").defaultNow(),
});

// Educational videos
export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // 'training', 'nutrition', 'breathwork', 'recovery', 'supplements'
  instructor: text("instructor").notNull(),
  duration: integer("duration").notNull(), // seconds
  thumbnailUrl: text("thumbnail_url"),
  muxPlaybackId: text("mux_playback_id"),
  views: integer("views").default(0),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Recipes
export const recipes = pgTable("recipes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // 'breakfast', 'lunch', 'dinner', 'snack'
  totalTime: integer("total_time").notNull(), // minutes
  servings: integer("servings").notNull(),
  calories: integer("calories").notNull(),
  protein: real("protein").notNull(),
  carbs: real("carbs").notNull(),
  fat: real("fat").notNull(),
  imageUrl: text("image_url"),
  ingredients: text("ingredients").array(),
  instructions: text("instructions").array(),
  tags: text("tags").array(),
  allergens: text("allergens").array(),
  dietaryPreferences: text("dietary_preferences").array(),
  keyIngredients: text("key_ingredients").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Workout Library - individual workouts (not programs)
export const workouts = pgTable("workouts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(), // 'strength', 'cardio', 'hiit', 'mobility', 'recovery'
  duration: integer("duration").notNull(), // minutes
  difficulty: text("difficulty").notNull(), // 'beginner', 'intermediate', 'advanced'
  equipment: text("equipment").array(), // array of equipment needed
  imageUrl: text("image_url"),
  muxPlaybackId: text("mux_playback_id"), // main workout video for video workout type
  exercises: jsonb("exercises"), // array of exercise objects with details (legacy - for migration)
  routineType: text("routine_type").notNull().default("workout"), // 'workout', 'stretching', 'corrective'
  workoutType: text("workout_type").notNull().default("regular"), // 'regular', 'interval', 'circuit', 'video'
  intervalRounds: integer("interval_rounds").default(4), // number of rounds for interval workouts
  intervalRestAfterRound: text("interval_rest_after_round").default("60 sec"), // rest duration after each round
  userId: text("user_id"), // null = admin-created library workout, set = user-saved personal workout
  sourceType: text("source_type").default("admin"), // 'admin' (library), 'user' (saved from custom WOD)
  createdAt: timestamp("created_at").defaultNow(),
});

// Workout blocks - containers for exercises (single, superset, triset, circuit)
export const workoutBlocks = pgTable("workout_blocks", {
  id: serial("id").primaryKey(),
  workoutId: integer("workout_id").notNull().references(() => workouts.id, { onDelete: "cascade" }),
  section: text("section").notNull().default('main'), // 'warmup' or 'main'
  blockType: text("block_type").notNull(), // 'single', 'superset', 'triset', 'circuit'
  position: integer("position").notNull(), // order within the workout
  rest: text("rest"), // rest period after the block (e.g., "60 sec", "90 sec")
  rounds: integer("rounds"), // number of rounds for interval mini-circuits
  restAfterRound: text("rest_after_round"), // rest after completing all exercises in mini-circuit (for interval workouts)
  createdAt: timestamp("created_at").defaultNow(),
});

// Exercises within a block
export const blockExercises = pgTable("block_exercises", {
  id: serial("id").primaryKey(),
  blockId: integer("block_id").notNull().references(() => workoutBlocks.id, { onDelete: "cascade" }),
  exerciseLibraryId: integer("exercise_library_id").references(() => exerciseLibrary.id, { onDelete: "restrict" }),
  position: integer("position").notNull(), // order within the block
  sets: jsonb("sets").notNull(), // array of set objects: [{reps, duration?}, ...]
  durationType: text("duration_type"), // 'text' for reps only, 'timer' for time-based
  tempo: text("tempo"), // e.g., "3-1-1-0"
  load: text("load"), // e.g., "30kg", "50lbs", "bodyweight"
  notes: text("notes"), // additional instructions
  createdAt: timestamp("created_at").defaultNow(),
});

// User progress tracking
export const userProgress = pgTable("user_progress", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: timestamp("date").notNull(),
  workoutsCompleted: integer("workouts_completed").default(0),
  sleepHours: real("sleep_hours"),
  stressLevel: integer("stress_level"), // 1-5 scale
  energyLevel: integer("energy_level"), // 1-5 scale
  healthScore: integer("health_score"), // calculated score
  hrv: real("hrv"), // heart rate variability
  rhr: integer("rhr"), // resting heart rate
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Daily check-ins
export const checkIns = pgTable("check_ins", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  checkInDate: timestamp("check_in_date").notNull(),
  week: integer("week").notNull().default(0),
  // Slider scores (1-5 scale)
  moodScore: integer("mood_score").default(3),
  energyScore: integer("energy_score").default(3),
  stressScore: integer("stress_score").default(3),
  sleepScore: integer("sleep_score").default(3),
  clarityScore: integer("clarity_score").default(3),
  // Yes/No questions
  headache: boolean("headache").default(false),
  alcohol: boolean("alcohol").default(false),
  alcoholCount: integer("alcohol_count"),
  sick: boolean("sick").default(false),
  painOrInjury: boolean("pain_or_injury").default(false),
  emotionallyStable: boolean("emotionally_stable").default(true),
  anxious: boolean("anxious").default(false),
  overwhelmed: boolean("overwhelmed").default(false),
  exercisedYesterday: boolean("exercised_yesterday").default(false),
  caffeineAfter2pm: boolean("caffeine_after_2pm").default(false),
  practicedMindfulness: boolean("practiced_mindfulness").default(false),
  // Conditional fatigue question
  fatigue: boolean("fatigue"),
  fatigueTriggerMet: boolean("fatigue_trigger_met").default(false),
  // Legacy fields (kept for backwards compatibility)
  energyLevel: integer("energy_level").notNull().default(4),
  stressManagement: text("stress_management").notNull().default(""),
  goalsProgress: text("goals_progress").array(),
  completed: boolean("completed").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Body map logs - simplified for everyday users
export const bodyMapLogs = pgTable("body_map_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  bodyPart: text("body_part").notNull(),
  severity: integer("severity").notNull(), // 1-10 scale
  type: text("type"), // optional: "sore" or "stiff"
  x: real("x"), // coordinate on body map (optional for V1 text-based selection)
  y: real("y"), // coordinate on body map (optional for V1 text-based selection)
  view: text("view").notNull().default("front"), // front or back
  answers: jsonb("answers"), // User's answers to diagnostic questions: { questionId: answerValue }
  // V1 Assessment fields
  side: text("side"), // 'left', 'right', 'both'
  movementImpact: text("movement_impact"), // 'none', 'slight', 'significant'
  movementLimitations: text("movement_limitations").array(), // Body area-specific movements that cause discomfort
  trainingImpact: text("training_impact"), // 'none', 'careful', 'modify_avoid'
  primaryTrigger: text("primary_trigger"), // 'rest', 'during_day', 'during_exercise', 'after_sitting', 'all_time'
  duration: text("duration_category"), // 'today', 'few_days', 'one_two_weeks', 'more_than_two_weeks'
  matchedOutcomeId: integer("matched_outcome_id"), // ID of the matched outcome at assessment time
  reassessmentDays: integer("reassessment_days"), // Number of days until reassessment (stored at creation time)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User favourites (bookmarks)
export const bookmarks = pgTable("bookmarks", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  contentType: text("content_type").notNull(), // 'program', 'video', 'recipe', 'workout'
  contentId: integer("content_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Video workout progress - track where users left off in video workouts
export const videoWorkoutProgress = pgTable("video_workout_progress", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  workoutId: integer("workout_id").notNull().references(() => workouts.id, { onDelete: "cascade" }),
  progressTime: real("progress_time").notNull().default(0), // seconds into the video
  duration: real("duration"), // total video duration in seconds
  completed: boolean("completed").default(false), // whether they've finished watching
  lastWatchedAt: timestamp("last_watched_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// User notes
export const userNotes = pgTable("user_notes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  contentType: text("content_type").notNull(),
  contentId: integer("content_id").notNull(),
  note: text("note").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User program enrollments - track which programs users have enrolled in
export const userProgramEnrollments = pgTable("user_program_enrollments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  programId: integer("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"), // calculated from start + program weeks, or custom
  status: text("status").notNull().default("scheduled"), // 'scheduled', 'active', 'completed', 'paused'
  programType: text("program_type").notNull().default("main"), // 'main' or 'supplementary'
  workoutsCompleted: integer("workouts_completed").notNull().default(0), // track progress
  totalWorkouts: integer("total_workouts").notNull().default(0), // cached from program
  orderIndex: integer("order_index").notNull().default(0), // for sequencing multiple enrollments
  createdAt: timestamp("created_at").defaultNow(),
});

// Extra workout sessions - user-added sessions beyond the regular schedule
export const userExtraWorkoutSessions = pgTable("user_extra_workout_sessions", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollment_id").notNull().references(() => userProgramEnrollments.id, { onDelete: "cascade" }),
  dayPosition: integer("day_position").notNull(), // Which day template this refers to (1-7)
  scheduledDate: timestamp("scheduled_date").notNull(), // The date for the extra session
  completed: boolean("completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// User enrollment workout customizations - stores user-specific workout modifications
// This allows users to customize their enrolled programme without affecting the global template
export const userEnrollmentWorkoutCustomizations = pgTable("user_enrollment_workout_customizations", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollment_id").notNull().references(() => userProgramEnrollments.id, { onDelete: "cascade" }),
  templateWorkoutId: integer("template_workout_id").notNull().references(() => programmeWorkouts.id, { onDelete: "cascade" }),
  customName: text("custom_name"), // Override workout name
  customDescription: text("custom_description"), // Override workout description
  isRemoved: boolean("is_removed").default(false), // Mark as removed without deleting
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User enrollment exercise customizations - stores user-specific exercise modifications
export const userEnrollmentExerciseCustomizations = pgTable("user_enrollment_exercise_customizations", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollment_id").notNull().references(() => userProgramEnrollments.id, { onDelete: "cascade" }),
  templateExerciseId: integer("template_exercise_id").notNull().references(() => programExercises.id, { onDelete: "cascade" }),
  customSets: text("custom_sets"), // Override sets
  customReps: text("custom_reps"), // Override reps
  customRest: text("custom_rest"), // Override rest period
  customNotes: text("custom_notes"), // Override exercise notes
  isRemoved: boolean("is_removed").default(false), // Mark as removed without deleting
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enrollment workout snapshots - copies of workout metadata at enrollment time
// These are independent copies that don't change when the template is edited
export const enrollmentWorkouts = pgTable("enrollment_workouts", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollment_id").notNull().references(() => userProgramEnrollments.id, { onDelete: "cascade" }),
  templateWorkoutId: integer("template_workout_id").notNull().references(() => programmeWorkouts.id, { onDelete: "cascade" }),
  weekNumber: integer("week_number").notNull(),
  dayNumber: integer("day_number").notNull(),
  scheduledDateOverride: timestamp("scheduled_date_override"), // Override date when workout is moved
  name: text("name").notNull(),
  description: text("description"),
  workoutType: text("workout_type").notNull().default("regular"),
  category: text("category").notNull().default("strength"),
  difficulty: text("difficulty").notNull().default("beginner"),
  duration: integer("duration").notNull().default(30),
  intervalRounds: integer("interval_rounds").default(4),
  intervalRestAfterRound: text("interval_rest_after_round").default("60 sec"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Enrollment workout blocks - copies of blocks at enrollment time
export const enrollmentWorkoutBlocks = pgTable("enrollment_workout_blocks", {
  id: serial("id").primaryKey(),
  enrollmentWorkoutId: integer("enrollment_workout_id").notNull().references(() => enrollmentWorkouts.id, { onDelete: "cascade" }),
  templateBlockId: integer("template_block_id"), // reference to original for tracking
  section: text("section").notNull().default('main'),
  blockType: text("block_type").notNull(),
  position: integer("position").notNull(),
  rest: text("rest"),
  rounds: integer("rounds"),
  restAfterRound: text("rest_after_round"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Enrollment block exercises - copies of exercises at enrollment time
export const enrollmentBlockExercises = pgTable("enrollment_block_exercises", {
  id: serial("id").primaryKey(),
  enrollmentBlockId: integer("enrollment_block_id").notNull().references(() => enrollmentWorkoutBlocks.id, { onDelete: "cascade" }),
  templateExerciseId: integer("template_exercise_id"), // reference to original for tracking
  exerciseLibraryId: integer("exercise_library_id").references(() => exerciseLibrary.id, { onDelete: "restrict" }),
  position: integer("position").notNull(),
  sets: jsonb("sets").notNull(),
  durationType: text("duration_type"),
  tempo: text("tempo"),
  load: text("load"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Injury logs - comprehensive tracking per body part
export const injuryLogs = pgTable("injury_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  bodyPart: text("body_part").notNull(),
  side: text("side"), // "left", "right", or null for central areas
  type: text("type").notNull(), // "sore", "stiff", "pain", "injury"
  initialSeverity: integer("initial_severity").notNull(), // 1-10 scale
  currentSeverity: integer("current_severity").notNull(), // 1-10 scale
  currentPlan: text("current_plan").notNull(), // recovery plan/action
  notes: text("notes"),
  x: real("x").notNull(), // coordinate on body map
  y: real("y").notNull(), // coordinate on body map
  view: text("view").notNull().default("front"), // front or back
  status: text("status").notNull().default("active"), // "active", "recovering", "resolved"
  firstLoggedAt: timestamp("first_logged_at").defaultNow(),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Daily severity check-ins
export const dailySeverityLogs = pgTable("daily_severity_logs", {
  id: serial("id").primaryKey(),
  injuryLogId: integer("injury_log_id").notNull().references(() => injuryLogs.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  severity: integer("severity").notNull(), // 1-10 scale
  notes: text("notes"),
  logDate: timestamp("log_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Recovery exercises/actions assigned to injury areas
export const recoveryActions = pgTable("recovery_actions", {
  id: serial("id").primaryKey(),
  injuryLogId: integer("injury_log_id").notNull().references(() => injuryLogs.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  actionName: text("action_name").notNull(),
  actionType: text("action_type").notNull(), // "exercise", "stretch", "therapy", "rest"
  frequency: text("frequency").notNull(), // "daily", "3x_week", "every_other_day"
  reminderDays: text("reminder_days").array(), // ["monday", "wednesday", "friday"]
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Recovery action compliance tracking
export const recoveryCompliance = pgTable("recovery_compliance", {
  id: serial("id").primaryKey(),
  recoveryActionId: integer("recovery_action_id").notNull().references(() => recoveryActions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  completedDate: timestamp("completed_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Smart feedback triggers and alerts
export const recoveryAlerts = pgTable("recovery_alerts", {
  id: serial("id").primaryKey(),
  injuryLogId: integer("injury_log_id").notNull().references(() => injuryLogs.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  alertType: text("alert_type").notNull(), // "no_improvement", "worsening", "positive_progress"
  alertMessage: text("alert_message").notNull(),
  isRead: boolean("is_read").default(false),
  isDismissed: boolean("is_dismissed").default(false),
  triggeredAt: timestamp("triggered_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Meals/Nutrition tracking
export const meals = pgTable("meals", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: timestamp("date").notNull(),
  mealType: text("meal_type").notNull(), // 'breakfast', 'lunch', 'dinner', 'snack'
  title: text("title").notNull(),
  description: text("description"),
  calories: integer("calories"),
  protein: real("protein"),
  carbs: real("carbs"),
  fat: real("fat"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Progress photos tracking
export const progressPhotos = pgTable("progress_photos", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: timestamp("date").notNull(),
  photoType: text("photo_type").notNull(), // 'front', 'side', 'back', 'other'
  imageUrl: text("image_url").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Body stats tracking (weight, measurements, etc.)
export const bodyStats = pgTable("body_stats", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: timestamp("date").notNull(),
  weight: real("weight"), // kg or lbs
  bodyFat: real("body_fat"), // percentage
  muscleMass: real("muscle_mass"), // kg or lbs
  waist: real("waist"), // cm or inches
  chest: real("chest"), // cm or inches
  arms: real("arms"), // cm or inches
  legs: real("legs"), // cm or inches
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Workout sessions (completed workouts)
export const workoutSessions = pgTable("workout_sessions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: timestamp("date").notNull(),
  programId: integer("program_id").references(() => programs.id),
  enrollmentId: integer("enrollment_id").references(() => userProgramEnrollments.id, { onDelete: "set null" }), // link to specific enrollment
  workoutId: integer("workout_id").references(() => workouts.id), // link to individual workout
  title: text("title").notNull(),
  duration: integer("duration"), // minutes
  exercisesCompleted: integer("exercises_completed"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Recovery plan suggestions - generated from body map assessments
export const recoveryPlanSuggestions = pgTable("recovery_plan_suggestions", {
  id: serial("id").primaryKey(),
  bodyMapLogId: integer("body_map_log_id").references(() => bodyMapLogs.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  bodyPart: text("body_part").notNull(),
  severity: integer("severity").notNull(),
  planTitle: text("plan_title").notNull(),
  planDescription: text("plan_description").notNull(),
  rootCauses: text("root_causes").array(), // 2-3 diagnostic root causes (e.g., "Tight right pec causing shoulder pain")
  recommendedStretches: text("recommended_stretches").array(), // Specific stretches to perform
  movementsToAvoid: text("movements_to_avoid").array(), // Movements that may aggravate the issue
  movementsToModify: text("movements_to_modify").array(), // Movements that need modifications
  relatedVideoIds: integer("related_video_ids").array(), // IDs of helpful educational videos
  generalRecommendations: text("general_recommendations").array(), // General recovery advice
  status: text("status").notNull().default("pending"), // 'pending', 'accepted', 'rejected'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Program modification suggestions - specific exercise changes based on recovery plan
export const programModificationSuggestions = pgTable("program_modification_suggestions", {
  id: serial("id").primaryKey(),
  recoveryPlanId: integer("recovery_plan_id").notNull().references(() => recoveryPlanSuggestions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  enrollmentId: integer("enrollment_id").notNull().references(() => userProgramEnrollments.id, { onDelete: "cascade" }),
  programExerciseId: integer("program_exercise_id").references(() => programExercises.id, { onDelete: "set null" }), // DEPRECATED: legacy column
  blockExerciseId: integer("block_exercise_id").references(() => programmeBlockExercises.id, { onDelete: "set null" }), // New: references block exercises
  modificationType: text("modification_type").notNull(), // 'replace', 'reduce_intensity', 'skip', 'modify_reps', 'modify_sets'
  originalExerciseName: text("original_exercise_name").notNull(),
  suggestedExerciseName: text("suggested_exercise_name"), // for replacements
  suggestedSets: text("suggested_sets"),
  suggestedReps: text("suggested_reps"),
  suggestedRest: text("suggested_rest"),
  reason: text("reason").notNull(), // explanation for the modification
  status: text("status").notNull().default("pending"), // 'pending', 'accepted', 'rejected'
  week: integer("week"),
  day: integer("day"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Schema exports
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type ExerciseLibraryItem = typeof exerciseLibrary.$inferSelect;
export type InsertExerciseLibraryItem = typeof exerciseLibrary.$inferInsert;

export type Program = typeof programs.$inferSelect;
export type InsertProgram = typeof programs.$inferInsert;

export type ProgramWeek = typeof programWeeks.$inferSelect;
export type InsertProgramWeek = typeof programWeeks.$inferInsert;

export type ProgramDay = typeof programDays.$inferSelect;
export type InsertProgramDay = typeof programDays.$inferInsert;

export type ProgramExercise = typeof programExercises.$inferSelect;
export type InsertProgramExercise = typeof programExercises.$inferInsert;

export type ProgrammeWorkoutBlock = typeof programmeWorkoutBlocks.$inferSelect;
export type InsertProgrammeWorkoutBlock = typeof programmeWorkoutBlocks.$inferInsert;

export type ProgrammeBlockExercise = typeof programmeBlockExercises.$inferSelect;
export type InsertProgrammeBlockExercise = typeof programmeBlockExercises.$inferInsert;

export type ProgrammeWorkout = typeof programmeWorkouts.$inferSelect;
export type InsertProgrammeWorkout = typeof programmeWorkouts.$inferInsert;

export type Video = typeof videos.$inferSelect;
export type InsertVideo = typeof videos.$inferInsert;

export type Recipe = typeof recipes.$inferSelect;
export type InsertRecipe = typeof recipes.$inferInsert;

export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = typeof userProgress.$inferInsert;

export type CheckIn = typeof checkIns.$inferSelect;
export type InsertCheckIn = typeof checkIns.$inferInsert;

export type BodyMapLog = typeof bodyMapLogs.$inferSelect;
export type InsertBodyMapLog = typeof bodyMapLogs.$inferInsert;

export type Bookmark = typeof bookmarks.$inferSelect;
export type InsertBookmark = typeof bookmarks.$inferInsert;

export type UserNote = typeof userNotes.$inferSelect;
export type InsertUserNote = typeof userNotes.$inferInsert;

export type UserProgramEnrollment = typeof userProgramEnrollments.$inferSelect;
export type InsertUserProgramEnrollment = typeof userProgramEnrollments.$inferInsert;

export type EnrollmentWorkout = typeof enrollmentWorkouts.$inferSelect;
export type InsertEnrollmentWorkout = typeof enrollmentWorkouts.$inferInsert;

export type EnrollmentWorkoutBlock = typeof enrollmentWorkoutBlocks.$inferSelect;
export type InsertEnrollmentWorkoutBlock = typeof enrollmentWorkoutBlocks.$inferInsert;

export type EnrollmentBlockExercise = typeof enrollmentBlockExercises.$inferSelect;
export type InsertEnrollmentBlockExercise = typeof enrollmentBlockExercises.$inferInsert;

export type Workout = typeof workouts.$inferSelect;
export type InsertWorkout = typeof workouts.$inferInsert;

// Insert schemas
// Injury tracking types
export type InjuryLog = typeof injuryLogs.$inferSelect;
export type InsertInjuryLog = typeof injuryLogs.$inferInsert;

export type DailySeverityLog = typeof dailySeverityLogs.$inferSelect;
export type InsertDailySeverityLog = typeof dailySeverityLogs.$inferInsert;

export type RecoveryAction = typeof recoveryActions.$inferSelect;
export type InsertRecoveryAction = typeof recoveryActions.$inferInsert;

export type RecoveryCompliance = typeof recoveryCompliance.$inferSelect;
export type InsertRecoveryCompliance = typeof recoveryCompliance.$inferInsert;

export type RecoveryAlert = typeof recoveryAlerts.$inferSelect;
export type InsertRecoveryAlert = typeof recoveryAlerts.$inferInsert;

export type Meal = typeof meals.$inferSelect;
export type InsertMeal = typeof meals.$inferInsert;

export type ProgressPhoto = typeof progressPhotos.$inferSelect;
export type InsertProgressPhoto = typeof progressPhotos.$inferInsert;

export type BodyStats = typeof bodyStats.$inferSelect;
export type InsertBodyStats = typeof bodyStats.$inferInsert;

export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type InsertWorkoutSession = typeof workoutSessions.$inferInsert;

export type RecoveryPlanSuggestion = typeof recoveryPlanSuggestions.$inferSelect;
export type InsertRecoveryPlanSuggestion = typeof recoveryPlanSuggestions.$inferInsert;

export type ProgramModificationSuggestion = typeof programModificationSuggestions.$inferSelect;
export type InsertProgramModificationSuggestion = typeof programModificationSuggestions.$inferInsert;

// UK English type aliases for backwards compatibility
export type Programme = Program;
export type InsertProgramme = InsertProgram;
export type ProgrammeExercise = ProgramExercise;
export type InsertProgrammeExercise = InsertProgramExercise;
export type ProgrammeModificationSuggestion = ProgramModificationSuggestion;
export type InsertProgrammeModificationSuggestion = InsertProgramModificationSuggestion;

export const insertExerciseLibraryItemSchema = createInsertSchema(exerciseLibrary);
export const insertProgramSchema = createInsertSchema(programs);
export const insertProgramWeekSchema = createInsertSchema(programWeeks).omit({ id: true, createdAt: true });
export const insertProgramDaySchema = createInsertSchema(programDays).omit({ id: true, createdAt: true });
export const insertProgramExerciseSchema = createInsertSchema(programExercises).omit({ id: true, createdAt: true });
export const insertProgrammeWorkoutBlockSchema = createInsertSchema(programmeWorkoutBlocks).omit({ id: true, createdAt: true });
export const insertProgrammeBlockExerciseSchema = createInsertSchema(programmeBlockExercises).omit({ id: true, createdAt: true });
export const insertProgrammeWorkoutSchema = createInsertSchema(programmeWorkouts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVideoSchema = createInsertSchema(videos);
export const insertRecipeSchema = createInsertSchema(recipes);
export const insertWorkoutSchema = createInsertSchema(workouts).omit({ id: true, createdAt: true });
export const insertUserProgressSchema = createInsertSchema(userProgress);
export const insertCheckInSchema = createInsertSchema(checkIns).omit({ id: true, createdAt: true }).extend({
  checkInDate: z.string().or(z.date()).transform(val => typeof val === 'string' ? new Date(val) : val)
});
export const insertBodyMapLogSchema = createInsertSchema(bodyMapLogs);
export const insertBookmarkSchema = createInsertSchema(bookmarks);
export const insertVideoWorkoutProgressSchema = createInsertSchema(videoWorkoutProgress).omit({ id: true, createdAt: true });
export type VideoWorkoutProgress = typeof videoWorkoutProgress.$inferSelect;
export type InsertVideoWorkoutProgress = z.infer<typeof insertVideoWorkoutProgressSchema>;
export const insertUserNoteSchema = createInsertSchema(userNotes);
export const insertInjuryLogSchema = createInsertSchema(injuryLogs);
export const insertDailySeverityLogSchema = createInsertSchema(dailySeverityLogs);
export const insertRecoveryActionSchema = createInsertSchema(recoveryActions);
export const insertRecoveryComplianceSchema = createInsertSchema(recoveryCompliance);
export const insertRecoveryAlertSchema = createInsertSchema(recoveryAlerts);
export const insertUserProgramEnrollmentSchema = createInsertSchema(userProgramEnrollments).omit({ id: true, createdAt: true });
export const insertMealSchema = createInsertSchema(meals).omit({ id: true, createdAt: true }).extend({
  date: z.string().or(z.date()).transform(val => typeof val === 'string' ? new Date(val) : val)
});
export const insertProgressPhotoSchema = createInsertSchema(progressPhotos).omit({ id: true, createdAt: true }).extend({
  date: z.string().or(z.date()).transform(val => typeof val === 'string' ? new Date(val) : val)
});
export const insertBodyStatsSchema = createInsertSchema(bodyStats).omit({ id: true, createdAt: true }).extend({
  date: z.string().or(z.date()).transform(val => typeof val === 'string' ? new Date(val) : val)
});
export const insertWorkoutSessionSchema = createInsertSchema(workoutSessions).omit({ id: true, createdAt: true }).extend({
  date: z.string().or(z.date()).transform(val => typeof val === 'string' ? new Date(val) : val)
});
export const insertRecoveryPlanSuggestionSchema = createInsertSchema(recoveryPlanSuggestions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProgramModificationSuggestionSchema = createInsertSchema(programModificationSuggestions).omit({ id: true, createdAt: true, updatedAt: true });

// Programme modification records - tracks user consent for body map outcome modifications
export const programmeModificationRecords = pgTable("programme_modification_records", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  matchedOutcomeId: integer("matched_outcome_id").notNull(), // References body_map_outcomes.id
  mainProgrammeEnrollmentId: integer("main_programme_enrollment_id").notNull().references(() => userProgramEnrollments.id, { onDelete: "cascade" }),
  bodyMapLogId: integer("body_map_log_id").references(() => bodyMapLogs.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"), // 'pending', 'accepted', 'declined'
  substitutionsApplied: integer("substitutions_applied").notNull().default(0),
  substitutionsFailed: integer("substitutions_failed").notNull().default(0), // No valid substitute found
  recoveryProgrammeEnrolled: boolean("recovery_programme_enrolled").notNull().default(false),
  recoveryProgrammeEnrollmentId: integer("recovery_programme_enrollment_id").references(() => userProgramEnrollments.id, { onDelete: "set null" }),
  clearedAt: timestamp("cleared_at"), // Step 5: When the issue was cleared by reassessment
  clearedByBodyMapLogId: integer("cleared_by_body_map_log_id").references(() => bodyMapLogs.id, { onDelete: "set null" }), // The reassessment that cleared this
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Exercise substitution mappings - reversible mappings for Step 5 restore
export const exerciseSubstitutionMappings = pgTable("exercise_substitution_mappings", {
  id: serial("id").primaryKey(),
  modificationRecordId: integer("modification_record_id").notNull().references(() => programmeModificationRecords.id, { onDelete: "cascade" }),
  mainProgrammeEnrollmentId: integer("main_programme_enrollment_id").notNull().references(() => userProgramEnrollments.id, { onDelete: "cascade" }),
  workoutId: integer("workout_id").notNull().references(() => programmeWorkouts.id, { onDelete: "cascade" }),
  exerciseInstanceId: integer("exercise_instance_id").notNull(), // References programme_block_exercises.id (the slot)
  originalExerciseId: integer("original_exercise_id").notNull().references(() => exerciseLibrary.id, { onDelete: "cascade" }),
  substitutedExerciseId: integer("substituted_exercise_id").notNull().references(() => exerciseLibrary.id, { onDelete: "cascade" }),
  matchedOutcomeId: integer("matched_outcome_id").notNull(), // References body_map_outcomes.id
  flaggingReason: text("flagging_reason"), // Why this exercise was flagged (movement pattern, muscle, etc.)
  isRestored: boolean("is_restored").notNull().default(false), // For Step 5 reassessment restore
  restoredAt: timestamp("restored_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ProgrammeModificationRecord = typeof programmeModificationRecords.$inferSelect;
export type InsertProgrammeModificationRecord = typeof programmeModificationRecords.$inferInsert;
export type ExerciseSubstitutionMapping = typeof exerciseSubstitutionMappings.$inferSelect;
export type InsertExerciseSubstitutionMapping = typeof exerciseSubstitutionMappings.$inferInsert;

export const insertProgrammeModificationRecordSchema = createInsertSchema(programmeModificationRecords).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExerciseSubstitutionMappingSchema = createInsertSchema(exerciseSubstitutionMappings).omit({ id: true, createdAt: true });

// Body Map Configuration Tables - Admin-configurable logic for body assessments

// Body areas/parts configuration
export const bodyMapAreas = pgTable("body_map_areas", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // e.g., "neck", "shoulder" - internal ID
  displayName: text("display_name").notNull(), // User-friendly display name
  category: text("category").notNull(), // e.g., "upper_body", "lower_body", "core"
  description: text("description"), // "What's behind this" explanation text
  orderIndex: integer("order_index").notNull().default(0), // For sorting in UI
  isActive: boolean("is_active").notNull().default(true),
  movementQuestion: text("movement_question"), // Configurable Question 2 text, e.g., "Does this limit how you move?"
  movementOptions: jsonb("movement_options"), // Array of {id, label, orderIndex} for Question 2 answers
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Universal guidance rules - apply to all areas based on conditions
export const bodyMapGuidanceRules = pgTable("body_map_guidance_rules", {
  id: serial("id").primaryKey(),
  ruleType: text("rule_type").notNull(), // "training", "daily", "desk", "caution"
  conditionField: text("condition_field").notNull(), // "severity", "trainingImpact", "movementImpact", "trigger", "duration"
  conditionOperator: text("condition_operator").notNull(), // "equals", "min", "max", "range"
  conditionValue: text("condition_value").notNull(), // e.g., "3" for severity, "careful" for trainingImpact
  conditionValueMax: text("condition_value_max"), // For range operator
  guidanceText: text("guidance_text").notNull(),
  priority: integer("priority").notNull().default(0), // Higher priority rules override lower ones
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Diagnostic questions for each body area
export const bodyMapQuestions = pgTable("body_map_questions", {
  id: serial("id").primaryKey(),
  bodyAreaId: integer("body_area_id").notNull().references(() => bodyMapAreas.id, { onDelete: "cascade" }),
  questionText: text("question_text").notNull(),
  questionType: text("question_type").notNull().default("multiple_choice"), // "multiple_choice", "yes_no", "text"
  orderIndex: integer("order_index").notNull().default(0), // Order of questions
  isRequired: boolean("is_required").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Answer options for questions
export const bodyMapAnswerOptions = pgTable("body_map_answer_options", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").notNull().references(() => bodyMapQuestions.id, { onDelete: "cascade" }),
  answerText: text("answer_text").notNull(),
  answerValue: text("answer_value").notNull(), // Value used in logic rules
  orderIndex: integer("order_index").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  triggersFollowUp: boolean("triggers_follow_up").notNull().default(false), // Shows movement limitation follow-up (Question 2b)
  createdAt: timestamp("created_at").defaultNow(),
});

// Movement limitation options per body area - for follow-up questions
export const bodyMapMovementOptions = pgTable("body_map_movement_options", {
  id: serial("id").primaryKey(),
  bodyAreaId: integer("body_area_id").notNull().references(() => bodyMapAreas.id, { onDelete: "cascade" }),
  value: text("value").notNull(), // Internal value e.g., "squatting", "climbing_stairs"
  label: text("label").notNull(), // User-facing label e.g., "Squatting", "Climbing stairs"
  orderIndex: integer("order_index").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Recovery plan templates
export const bodyMapRecoveryTemplates = pgTable("body_map_recovery_templates", {
  id: serial("id").primaryKey(),
  bodyAreaId: integer("body_area_id").notNull().references(() => bodyMapAreas.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // Internal name for the template
  planTitle: text("plan_title").notNull(), // User-facing title
  planDescription: text("plan_description").notNull(),
  rootCauses: text("root_causes").array(), // Array of root cause explanations
  recommendedStretches: text("recommended_stretches").array(),
  movementsToAvoid: text("movements_to_avoid").array(),
  movementsToModify: text("movements_to_modify").array(),
  affectedMovements: text("affected_movements").array(), // Movement patterns to check (e.g., "overhead press")
  relatedVideoIds: integer("related_video_ids").array(), // IDs of helpful videos
  generalRecommendations: text("general_recommendations").array(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Rules for when to apply templates (based on severity and answers)
export const bodyMapTemplateRules = pgTable("body_map_template_rules", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => bodyMapRecoveryTemplates.id, { onDelete: "cascade" }),
  severityMin: integer("severity_min"), // null = no min
  severityMax: integer("severity_max"), // null = no max
  requiredAnswers: jsonb("required_answers"), // {"question_id": "answer_value"} pairs
  priority: integer("priority").notNull().default(0), // Higher priority rules matched first
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Body Map Outcomes - Outcome-based decision framework (replaces scattered rule logic)
// Each outcome represents a coaching scenario a user can land in
export const bodyMapOutcomes = pgTable("body_map_outcomes", {
  id: serial("id").primaryKey(),
  bodyAreaId: integer("body_area_id").notNull().references(() => bodyMapAreas.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // Internal name e.g., "shoulder_manageable", "shoulder_needs_modification"
  displayName: text("display_name").notNull(), // Admin-friendly display name
  priority: integer("priority").notNull().default(0), // Higher priority resolves conflicts when multiple match
  isActive: boolean("is_active").notNull().default(true),
  
  // Conditions - all combined with AND logic
  severityMin: integer("severity_min"), // null = no min
  severityMax: integer("severity_max"), // null = no max
  trainingImpact: text("training_impact"), // "none", "modified", "stopped" - null means any
  triggersFollowUp: boolean("triggers_follow_up").notNull().default(false), // Show Question 2b
  followUpQuestion: text("follow_up_question"), // The follow-up question text when triggersFollowUp is true
  followUpAnswers: jsonb("follow_up_answers"), // Array of answer options: [{value, label, orderIndex}]
  movementImpact: text("movement_impact"), // "none", "some", "significant" - null means any
  duration: text("duration"), // "today", "few_days", "one_two_weeks", "more_than_two_weeks" - null means any
  
  // Content fields - the 6 fixed output sections
  whatsGoingOn: text("whats_going_on"), // "What's going on" explanation
  trainingGuidance: text("training_guidance"), // Training recommendations
  dailyMovement: text("daily_movement"), // Daily movement guidance
  deskWorkTips: text("desk_work_tips"), // Desk and work tips
  thingsToWatch: text("things_to_watch"), // Warning signs to monitor
  checkInAgain: text("check_in_again"), // Legacy: When to reassess (deprecated, use reassessInDays)
  reassessInDays: integer("reassess_in_days"), // 1-30 days for reassessment reminder, null = no reminder
  
  // Programme Impact - controls whether Programme Impact section appears on results page
  showProgrammeImpact: boolean("show_programme_impact").notNull().default(false),
  programmeImpactSummary: text("programme_impact_summary"), // Coach-written summary line
  
  // Flagging rules - define what exercises should be flagged for substitution
  flaggingMovementPatterns: text("flagging_movement_patterns").array(), // Movement patterns to flag
  flaggingEquipment: text("flagging_equipment").array(), // Equipment types to flag
  flaggingLevel: text("flagging_level").array(), // Difficulty levels to flag
  flaggingMechanics: text("flagging_mechanics").array(), // Mechanics to flag
  flaggingMuscles: text("flagging_muscles").array(), // Muscles to flag
  flaggingExcludeTags: text("flagging_exclude_tags").array(), // Tags to exclude from flagging
  flaggingNote: text("flagging_note"), // Optional plain language note
  
  // Substitution rules - JSON array of substitution rule objects
  // Each rule: { triggerPattern, allowedPatterns[], substituteExerciseIds[], coachingNote }
  substitutionRules: jsonb("substitution_rules"),
  
  // Recovery programme recommendation
  recommendRecoveryProgramme: boolean("recommend_recovery_programme").notNull().default(false),
  recoveryProgrammeId: integer("recovery_programme_id").references(() => programs.id, { onDelete: "set null" }),
  recoveryProgrammeReason: text("recovery_programme_reason"),
  
  // Reassessment preference (store only)
  restoreOnReassessment: boolean("restore_on_reassessment").notNull().default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Type exports for body map configuration
export type BodyMapArea = typeof bodyMapAreas.$inferSelect;
export type InsertBodyMapArea = typeof bodyMapAreas.$inferInsert;

export type BodyMapQuestion = typeof bodyMapQuestions.$inferSelect;
export type InsertBodyMapQuestion = typeof bodyMapQuestions.$inferInsert;

export type BodyMapAnswerOption = typeof bodyMapAnswerOptions.$inferSelect;
export type InsertBodyMapAnswerOption = typeof bodyMapAnswerOptions.$inferInsert;

export type BodyMapMovementOption = typeof bodyMapMovementOptions.$inferSelect;
export type InsertBodyMapMovementOption = typeof bodyMapMovementOptions.$inferInsert;

export type BodyMapRecoveryTemplate = typeof bodyMapRecoveryTemplates.$inferSelect;
export type InsertBodyMapRecoveryTemplate = typeof bodyMapRecoveryTemplates.$inferInsert;

export type BodyMapTemplateRule = typeof bodyMapTemplateRules.$inferSelect;
export type InsertBodyMapTemplateRule = typeof bodyMapTemplateRules.$inferInsert;

export type BodyMapGuidanceRule = typeof bodyMapGuidanceRules.$inferSelect;
export type InsertBodyMapGuidanceRule = typeof bodyMapGuidanceRules.$inferInsert;

export type BodyMapOutcome = typeof bodyMapOutcomes.$inferSelect;
export type InsertBodyMapOutcome = typeof bodyMapOutcomes.$inferInsert;

// Reassessment Reminders - in-app reminders for body map reassessment
export const reassessmentReminders = pgTable("reassessment_reminders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bodyArea: text("body_area").notNull(), // The body area to reassess (e.g., "shoulder", "knee")
  outcomeId: integer("outcome_id").references(() => bodyMapOutcomes.id, { onDelete: "set null" }),
  bodyMapLogId: integer("body_map_log_id").references(() => bodyMapLogs.id, { onDelete: "set null" }), // The assessment that created this reminder
  assessedAt: timestamp("assessed_at").notNull(), // When the original assessment was completed
  dueAt: timestamp("due_at").notNull(), // When the reassessment is due
  status: text("status").notNull().default("scheduled"), // 'scheduled', 'due', 'completed'
  completedAt: timestamp("completed_at"), // When the reminder was completed (new assessment done)
  completedByLogId: integer("completed_by_log_id").references(() => bodyMapLogs.id, { onDelete: "set null" }), // The new assessment that completed this reminder
  createdAt: timestamp("created_at").defaultNow(),
});

export type ReassessmentReminder = typeof reassessmentReminders.$inferSelect;
export type InsertReassessmentReminder = typeof reassessmentReminders.$inferInsert;
export const insertReassessmentReminderSchema = createInsertSchema(reassessmentReminders).omit({ id: true, createdAt: true });

// Insert schemas for body map configuration
export const insertBodyMapAreaSchema = createInsertSchema(bodyMapAreas).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBodyMapQuestionSchema = createInsertSchema(bodyMapQuestions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBodyMapAnswerOptionSchema = createInsertSchema(bodyMapAnswerOptions).omit({ id: true, createdAt: true });
export const insertBodyMapMovementOptionSchema = createInsertSchema(bodyMapMovementOptions).omit({ id: true, createdAt: true });
export const insertBodyMapRecoveryTemplateSchema = createInsertSchema(bodyMapRecoveryTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBodyMapTemplateRuleSchema = createInsertSchema(bodyMapTemplateRules).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBodyMapGuidanceRuleSchema = createInsertSchema(bodyMapGuidanceRules).omit({ id: true, createdAt: true });
export const insertBodyMapOutcomeSchema = createInsertSchema(bodyMapOutcomes).omit({ id: true, createdAt: true, updatedAt: true });

// Goals - user goals (bodyweight, custom, nutrition)
export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'bodyweight', 'custom', 'nutrition'
  title: text("title").notNull(),
  description: text("description"),
  targetValue: real("target_value"), // For bodyweight goals
  currentValue: real("current_value"), // For bodyweight goals
  startingValue: real("starting_value"), // Initial value when goal was created (for calculating weight loss progress)
  unit: text("unit"), // 'kg', 'lbs', etc.
  startDate: timestamp("start_date").notNull().defaultNow(), // When the goal starts
  deadline: timestamp("deadline"),
  progress: integer("progress").default(0), // Percentage (0-100)
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"), // When the goal was completed
  // Nutrition goal fields
  nutritionCalories: integer("nutrition_calories"), // Daily calorie target
  calorieGoalType: text("calorie_goal_type"), // 'mild_deficit', 'moderate_deficit', 'maintenance', 'mild_surplus', 'moderate_surplus', 'custom'
  macroPreset: text("macro_preset"), // 'balanced', 'high_protein', 'low_carb', 'low_fat', 'custom'
  proteinPercent: integer("protein_percent"), // Protein percentage (0-100)
  carbPercent: integer("carb_percent"), // Carbs percentage (0-100)
  fatPercent: integer("fat_percent"), // Fat percentage (0-100)
  proteinGrams: integer("protein_grams"), // Calculated protein in grams
  carbsGrams: integer("carbs_grams"), // Calculated carbs in grams
  fatGrams: integer("fat_grams"), // Calculated fat in grams
  templateId: text("template_id"), // Links to a goal template (for auto-tracking and habit suggestions)
  trackingMode: text("tracking_mode"), // 'habit' (streak-based) or 'cumulative' (total steps from progress entries)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Goal Milestones - track progress checkpoints within a goal
export const goalMilestones = pgTable("goal_milestones", {
  id: serial("id").primaryKey(),
  goalId: integer("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  targetValue: real("target_value").notNull(),
  unit: text("unit"), // e.g., 'kg', 'lbs' - inherited from goal if not specified
  dueDate: timestamp("due_date").notNull(),
  completed: boolean("completed").default(false),
  completedDate: timestamp("completed_date"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Habit Templates - Library of available habits
export const habitTemplates = pgTable("habit_templates", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(), // e.g., "Eat protein", "Abstain from alcohol"
  description: text("description").notNull(),
  shortDescription: text("short_description"), // One-line summary shown on the tracking page
  category: text("category").notNull(), // 'NEAT', 'NUTRITION 1', 'DAILY MAINTENANCE', 'NUTRITION PORTION GUIDES', 'NUTRITION', 'CUSTOM'
  icon: text("icon"), // Icon name for the list
  hasVideo: boolean("has_video").default(false), // Whether this habit has a video
  videoId: integer("video_id").references(() => videos.id), // Reference to video if hasVideo is true
  hasPortionGuide: boolean("has_portion_guide").default(false), // For nutrition portion guides
  orderIndex: integer("order_index").default(0), // Display order within category
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Habits - user habits (from templates or custom)
export const habits = pgTable("habits", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  templateId: integer("template_id").references(() => habitTemplates.id), // null for custom habits
  goalId: integer("goal_id").references(() => goals.id, { onDelete: "set null" }), // Optional: Link to a goal this habit supports
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"), // Category from template or custom
  icon: text("icon"), // Icon name or emoji
  // "When to Practice" fields
  startDate: timestamp("start_date").notNull().defaultNow(),
  duration: integer("duration").default(3), // Duration in weeks
  daysOfWeek: text("days_of_week").default("everyday"), // 'everyday' or comma-separated days
  // Settings for habit-specific configuration (e.g., portion guide settings, number of meals)
  settings: jsonb("settings"), // Flexible JSON for habit-specific settings
  // Tracking fields
  isCustom: boolean("is_custom").default(false),
  isActive: boolean("is_active").default(true),
  currentStreak: integer("current_streak").default(0), // Days
  longestStreak: integer("longest_streak").default(0),
  lastCompletedDate: timestamp("last_completed_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Habit Library - personal library of custom habits for reuse
export const userHabitLibrary = pgTable("user_habit_library", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  icon: text("icon"),
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type UserHabitLibraryEntry = typeof userHabitLibrary.$inferSelect;
export type InsertUserHabitLibraryEntry = typeof userHabitLibrary.$inferInsert;

// Habit Completions - tracking when habits are completed
export const habitCompletions = pgTable("habit_completions", {
  id: serial("id").primaryKey(),
  habitId: integer("habit_id").notNull().references(() => habits.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  completedDate: timestamp("completed_date").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Type exports for goals and habits
export type Goal = typeof goals.$inferSelect;
export type InsertGoal = typeof goals.$inferInsert;

export type HabitTemplate = typeof habitTemplates.$inferSelect;
export type InsertHabitTemplate = typeof habitTemplates.$inferInsert;

export type Habit = typeof habits.$inferSelect;
export type InsertHabit = typeof habits.$inferInsert;

export type HabitCompletion = typeof habitCompletions.$inferSelect;
export type InsertHabitCompletion = typeof habitCompletions.$inferInsert;

export type GoalMilestone = typeof goalMilestones.$inferSelect;
export type InsertGoalMilestone = typeof goalMilestones.$inferInsert;

// Insert schemas for goals and habits
export const insertGoalSchema = createInsertSchema(goals).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGoalMilestoneSchema = createInsertSchema(goalMilestones).omit({ id: true, createdAt: true, updatedAt: true });
export const insertHabitTemplateSchema = createInsertSchema(habitTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertHabitSchema = createInsertSchema(habits).omit({ id: true, createdAt: true });
export const insertHabitCompletionSchema = createInsertSchema(habitCompletions).omit({ id: true, createdAt: true });

// Learn Topics - main topics for browsing
export const learnTopics = pgTable("learn_topics", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(), // e.g., "Sleep", "Stress", "Movement"
  slug: text("slug").notNull().unique(), // URL-friendly slug
  description: text("description"),
  icon: text("icon"), // Icon name or emoji
  imageUrl: text("image_url"),
  orderIndex: integer("order_index").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Learn Content Library - canonical source for all educational content
// Videos/PDFs are created once here and can be added to topics and paths
export const learnContentLibrary = pgTable("learn_content_library", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  contentType: text("content_type").notNull(), // 'video', 'pdf', 'swipe_file', 'article'
  contentUrl: text("content_url").notNull(), // URL or path to content
  thumbnailUrl: text("thumbnail_url"),
  muxPlaybackId: text("mux_playback_id"), // Mux video playback ID for video content
  duration: integer("duration"), // seconds (for videos)
  topicId: integer("topic_id").notNull().references(() => learnTopics.id, { onDelete: "cascade" }), // Primary topic for browsing
  tags: text("tags").array(), // Tags for filtering/categorization
  createdAt: timestamp("created_at").defaultNow(),
});

// Learning Paths - curated educational content paths
export const learningPaths = pgTable("learning_paths", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(), // e.g., "Fix Your Sleep", "Combat Emotional Eating"
  description: text("description").notNull(),
  topicId: integer("topic_id").notNull().references(() => learnTopics.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // 'nutrition', 'mindset', 'exercise', 'stress', 'recovery', 'lifestyle'
  struggles: text("struggles").array(), // e.g., ["insomnia", "emotional eating", "low energy"]
  systems: text("systems").array(), // e.g., ["nervous system", "digestive system", "hormonal"]
  imageUrl: text("image_url"),
  estimatedDuration: integer("estimated_duration"), // minutes to complete
  difficulty: text("difficulty"), // 'beginner', 'intermediate', 'advanced'
  isRecommended: boolean("is_recommended").default(false), // Featured/recommended paths
  orderIndex: integer("order_index").default(0), // order within topic for display
  createdAt: timestamp("created_at").defaultNow(),
});

// Topic Content Items - DEPRECATED: Use learnContentLibrary directly (topicId)
// Kept for migration purposes only
export const topicContentItems = pgTable("topic_content_items", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").notNull().references(() => learnTopics.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  contentType: text("content_type").notNull(), // 'video', 'pdf', 'swipe_file', 'article'
  contentUrl: text("content_url").notNull(), // URL or path to content
  thumbnailUrl: text("thumbnail_url"),
  muxPlaybackId: text("mux_playback_id"), // Mux video playback ID for video content
  duration: integer("duration"), // minutes (for videos)
  orderIndex: integer("order_index").notNull().default(0), // order within the topic
  tags: text("tags").array(), // Tags for this content item
  libraryItemId: integer("library_item_id").references(() => learnContentLibrary.id, { onDelete: "set null" }), // Link to canonical library item
  createdAt: timestamp("created_at").defaultNow(),
});

// Learning Path Content - join table linking paths to library content items
export const learningPathContent = pgTable("learning_path_content", {
  id: serial("id").primaryKey(),
  pathId: integer("path_id").notNull().references(() => learningPaths.id, { onDelete: "cascade" }),
  libraryItemId: integer("library_item_id").notNull().references(() => learnContentLibrary.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(), // order within the path
  isRequired: boolean("is_required").default(true), // required to complete path
  createdAt: timestamp("created_at").defaultNow(),
});

// Path Content Items - LEGACY: Kept for backward compatibility during migration
export const pathContentItems = pgTable("path_content_items", {
  id: serial("id").primaryKey(),
  pathId: integer("path_id").notNull().references(() => learningPaths.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  contentType: text("content_type").notNull(), // 'video', 'pdf', 'swipe_file', 'article'
  contentUrl: text("content_url").notNull(), // URL or path to content
  thumbnailUrl: text("thumbnail_url"),
  muxPlaybackId: text("mux_playback_id"), // Mux video playback ID for video content
  duration: integer("duration"), // minutes (for videos)
  orderIndex: integer("order_index").notNull(), // order within the path
  isRequired: boolean("is_required").default(true), // required to complete path
  tags: text("tags").array(), // Tags for this content item for topic browsing
  libraryItemId: integer("library_item_id").references(() => learnContentLibrary.id, { onDelete: "set null" }), // Link to canonical library item
  createdAt: timestamp("created_at").defaultNow(),
});

// User Path Assignments - which paths are assigned to users
export const userPathAssignments = pgTable("user_path_assignments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  pathId: integer("path_id").notNull().references(() => learningPaths.id, { onDelete: "cascade" }),
  assignedDate: timestamp("assigned_date").defaultNow(),
  startedDate: timestamp("started_date"),
  completedDate: timestamp("completed_date"),
  progress: integer("progress").default(0), // percentage 0-100
  lastAccessedDate: timestamp("last_accessed_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Path Content Progress - LEGACY: tracking individual content item completion
// This tracks completion by pathContentItem id (old structure)
export const userPathContentProgress = pgTable("user_path_content_progress", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  pathId: integer("path_id").notNull().references(() => learningPaths.id, { onDelete: "cascade" }),
  contentItemId: integer("content_item_id").notNull().references(() => pathContentItems.id, { onDelete: "cascade" }),
  completed: boolean("completed").default(false),
  completedDate: timestamp("completed_date"),
  notes: text("notes"), // user notes on the content
  createdAt: timestamp("created_at").defaultNow(),
});

// User Content Progress - UNIFIED completion tracking by library item
// Completion is tracked ONCE per video, shared across all views (topics, paths)
export const userContentProgress = pgTable("user_content_progress", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  libraryItemId: integer("library_item_id").notNull().references(() => learnContentLibrary.id, { onDelete: "cascade" }),
  completed: boolean("completed").default(false),
  completedDate: timestamp("completed_date"),
  watchProgress: integer("watch_progress").default(0), // percentage watched (0-100)
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Type exports for learn content library
export type LearnContentLibraryItem = typeof learnContentLibrary.$inferSelect;
export type InsertLearnContentLibraryItem = typeof learnContentLibrary.$inferInsert;

// Type exports for learning path content (join table)
export type LearningPathContentItem = typeof learningPathContent.$inferSelect;
export type InsertLearningPathContentItem = typeof learningPathContent.$inferInsert;

// Type exports for user content progress (unified)
export type UserContentProgress = typeof userContentProgress.$inferSelect;
export type InsertUserContentProgress = typeof userContentProgress.$inferInsert;

// Type exports for topic content items
export type TopicContentItem = typeof topicContentItems.$inferSelect;
export type InsertTopicContentItem = typeof topicContentItems.$inferInsert;

// Type exports for learn topics
export type LearnTopic = typeof learnTopics.$inferSelect;
export type InsertLearnTopic = typeof learnTopics.$inferInsert;

// Type exports for learning paths
export type LearningPath = typeof learningPaths.$inferSelect;
export type InsertLearningPath = typeof learningPaths.$inferInsert;

export type PathContentItem = typeof pathContentItems.$inferSelect;
export type InsertPathContentItem = typeof pathContentItems.$inferInsert;

export type UserPathAssignment = typeof userPathAssignments.$inferSelect;
export type InsertUserPathAssignment = typeof userPathAssignments.$inferInsert;

export type UserPathContentProgress = typeof userPathContentProgress.$inferSelect;
export type InsertUserPathContentProgress = typeof userPathContentProgress.$inferInsert;

// Insert schemas for learn topics and learning paths
export const insertLearnTopicSchema = createInsertSchema(learnTopics).omit({ id: true, createdAt: true });
export const insertLearningPathSchema = createInsertSchema(learningPaths).omit({ id: true, createdAt: true });
export const insertTopicContentItemSchema = createInsertSchema(topicContentItems).omit({ id: true, createdAt: true });
export const insertPathContentItemSchema = createInsertSchema(pathContentItems).omit({ id: true, createdAt: true });
export const insertUserPathAssignmentSchema = createInsertSchema(userPathAssignments).omit({ id: true, createdAt: true });
export const insertUserPathContentProgressSchema = createInsertSchema(userPathContentProgress).omit({ id: true, createdAt: true });

// Insert schemas for new content library system
export const insertLearnContentLibrarySchema = createInsertSchema(learnContentLibrary).omit({ id: true, createdAt: true });
export const insertLearningPathContentSchema = createInsertSchema(learningPathContent).omit({ id: true, createdAt: true });
export const insertUserContentProgressSchema = createInsertSchema(userContentProgress).omit({ id: true, createdAt: true, updatedAt: true });

// User Favorites - bookmarked learning paths and content items
export const userFavourites = pgTable("user_favorites", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(), // 'learning_path' or 'content_item'
  learningPathId: integer("learning_path_id").references(() => learningPaths.id, { onDelete: "cascade" }),
  contentItemId: integer("content_item_id").references(() => pathContentItems.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Type exports for favourites
export type UserFavourite = typeof userFavourites.$inferSelect;
export type InsertUserFavourite = typeof userFavourites.$inferInsert;

// Insert schema for favourites
export const insertUserFavouriteSchema = createInsertSchema(userFavourites).omit({ id: true, createdAt: true });

// Hydration Tracker - daily water intake logging
export const hydrationLogs = pgTable("hydration_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(), // Date of the log (set to start of day)
  amountMl: integer("amount_ml").notNull(), // Amount in milliliters
  timeOfDay: text("time_of_day"), // 'morning', 'afternoon', 'evening' (optional)
  fluidType: text("fluid_type").default("water"), // 'water', 'tea', 'coffee', 'electrolyte', 'other'
  notes: text("notes"), // User notes (e.g., "green tea", "electrolyte drink")
  source: text("source").default("manual"), // 'manual', 'wearable', 'apple_health'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Hydration Goals - user's daily hydration targets
export const hydrationGoals = pgTable("hydration_goals", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(), // Date the goal is for
  goalMl: integer("goal_ml").notNull(), // Daily goal in milliliters
  baselineGoal: integer("baseline_goal").default(3000), // Default 3L
  adjustmentReason: text("adjustment_reason"), // 'weight', 'training', 'travel', 'climate', 'manual'
  weight: real("weight"), // User weight in kg (for calculation)
  trainingIntensity: text("training_intensity"), // 'light', 'moderate', 'intense', 'none'
  climate: text("climate"), // 'hot', 'temperate', 'cold'
  isManuallySet: boolean("is_manually_set").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Type exports for hydration
export type HydrationLog = typeof hydrationLogs.$inferSelect;
export type InsertHydrationLog = typeof hydrationLogs.$inferInsert;

export type HydrationGoal = typeof hydrationGoals.$inferSelect;
export type InsertHydrationGoal = typeof hydrationGoals.$inferInsert;

// Insert schemas for hydration
export const insertHydrationLogSchema = createInsertSchema(hydrationLogs).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  date: z.string().or(z.date()).transform(val => typeof val === 'string' ? new Date(val) : val)
});

export const insertHydrationGoalSchema = createInsertSchema(hydrationGoals).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  date: z.string().or(z.date()).transform(val => typeof val === 'string' ? new Date(val) : val)
});

// Nutrition Goals - user's daily calorie and macro targets
export const nutritionGoals = pgTable("nutrition_goals", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  calorieTarget: integer("calorie_target").notNull().default(2000),
  proteinTarget: integer("protein_target").notNull().default(150), // grams
  carbsTarget: integer("carbs_target").notNull().default(200), // grams
  fatTarget: integer("fat_target").notNull().default(65), // grams
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Food Logs - daily food entries
export const foodLogs = pgTable("food_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(),
  mealCategory: text("meal_category").notNull(), // 'breakfast', 'lunch', 'dinner', 'snacks'
  foodName: text("food_name").notNull(),
  calories: integer("calories").notNull(),
  protein: real("protein").default(0), // grams
  carbs: real("carbs").default(0), // grams
  fat: real("fat").default(0), // grams
  servingSize: real("serving_size"), // serving size per portion
  servingSizeUnit: text("serving_size_unit"), // 'serving', 'g', 'oz', etc.
  servingQuantity: real("serving_quantity"), // number of portions
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Supplements - user's supplement definitions (persist)
export const supplements = pgTable("supplements", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dosage: text("dosage"), // e.g., '5g', '1000mg', '2 capsules'
  timeOfDay: text("time_of_day").notNull(), // 'morning', 'afternoon', 'evening'
  frequency: integer("frequency").default(1), // 1=daily, 2=every 2 days, up to 7=once per week
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Supplement Logs - daily supplement taken status (resets daily)
export const supplementLogs = pgTable("supplement_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  supplementId: integer("supplement_id").notNull().references(() => supplements.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(),
  taken: boolean("taken").default(false),
  takenAt: timestamp("taken_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Meal Logs - tracks meals per day with time (Breakfast, Lunch, Dinner, Snack, or custom Meal 1, Meal 2, etc.)
export const mealLogs = pgTable("meal_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(),
  mealName: text("meal_name").notNull(), // 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Meal 1', etc.
  mealTime: text("meal_time"), // '08:30', '12:00', etc.
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Meal Food Entries - individual food items within a meal
export const mealFoodEntries = pgTable("meal_food_entries", {
  id: serial("id").primaryKey(),
  mealLogId: integer("meal_log_id").notNull().references(() => mealLogs.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  foodName: text("food_name").notNull(),
  brand: text("brand"), // e.g., 'M&S', 'Sainsbury's'
  servingSize: real("serving_size").notNull().default(100), // base serving size
  servingSizeUnit: text("serving_size_unit").notNull().default('gram'), // 'gram', 'ml', 'piece', 'container', 'cup', 'tablespoon', etc.
  servingQuantity: real("serving_quantity").notNull().default(1), // number of servings (supports fractions like 1.75)
  calories: integer("calories").notNull(), // per total servings
  protein: real("protein").default(0), // grams per total servings
  carbs: real("carbs").default(0), // grams per total servings
  fat: real("fat").default(0), // grams per total servings
  sourceType: text("source_type").default('manual'), // 'manual', 'history', 'recipe', 'saved_meal'
  sourceId: integer("source_id"), // reference to recipe.id or savedMealTemplate.id if applicable
  createdAt: timestamp("created_at").defaultNow(),
});

// User Food History - foods users have logged for quick re-use
export const userFoodHistory = pgTable("user_food_history", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  foodName: text("food_name").notNull(),
  brand: text("brand"),
  defaultServingSize: real("default_serving_size").notNull().default(100),
  defaultServingSizeUnit: text("default_serving_size_unit").notNull().default('gram'),
  caloriesPer100: integer("calories_per_100").notNull(), // calories per 100g/ml for scaling
  proteinPer100: real("protein_per_100").default(0),
  carbsPer100: real("carbs_per_100").default(0),
  fatPer100: real("fat_per_100").default(0),
  timesUsed: integer("times_used").default(1),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Saved Meal Templates - user's custom saved meals for quick logging
export const savedMealTemplates = pgTable("saved_meal_templates", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g., 'My Breakfast Bowl', 'Post-Workout Shake'
  description: text("description"),
  defaultServings: real("default_servings").default(1),
  totalCalories: integer("total_calories").default(0), // calculated sum
  totalProtein: real("total_protein").default(0),
  totalCarbs: real("total_carbs").default(0),
  totalFat: real("total_fat").default(0),
  timesUsed: integer("times_used").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Saved Meal Items - individual food items within a saved meal template
export const savedMealItems = pgTable("saved_meal_items", {
  id: serial("id").primaryKey(),
  savedMealId: integer("saved_meal_id").notNull().references(() => savedMealTemplates.id, { onDelete: "cascade" }),
  foodName: text("food_name").notNull(),
  brand: text("brand"),
  servingSize: real("serving_size").notNull().default(100),
  servingSizeUnit: text("serving_size_unit").notNull().default('gram'),
  servingQuantity: real("serving_quantity").notNull().default(1),
  calories: integer("calories").notNull(),
  protein: real("protein").default(0),
  carbs: real("carbs").default(0),
  fat: real("fat").default(0),
  recipeId: integer("recipe_id").references(() => recipes.id, { onDelete: "set null" }), // optional link to recipe
  foodHistoryId: integer("food_history_id").references(() => userFoodHistory.id, { onDelete: "set null" }), // optional link to food history
  createdAt: timestamp("created_at").defaultNow(),
});

// User Meal Categories - customizable meal slots (Breakfast, Lunch, etc.)
export const userMealCategories = pgTable("user_meal_categories", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Meal 1', etc.
  displayOrder: integer("display_order").notNull().default(0), // order to show in UI
  isDefault: boolean("is_default").default(false), // true for the 4 default categories
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Type exports for enhanced nutrition
export type MealLog = typeof mealLogs.$inferSelect;
export type InsertMealLog = typeof mealLogs.$inferInsert;
export type MealFoodEntry = typeof mealFoodEntries.$inferSelect;
export type InsertMealFoodEntry = typeof mealFoodEntries.$inferInsert;
export type UserFoodHistoryItem = typeof userFoodHistory.$inferSelect;
export type InsertUserFoodHistoryItem = typeof userFoodHistory.$inferInsert;
export type SavedMealTemplate = typeof savedMealTemplates.$inferSelect;
export type InsertSavedMealTemplate = typeof savedMealTemplates.$inferInsert;
export type SavedMealItem = typeof savedMealItems.$inferSelect;
export type InsertSavedMealItem = typeof savedMealItems.$inferInsert;
export type UserMealCategory = typeof userMealCategories.$inferSelect;
export type InsertUserMealCategory = typeof userMealCategories.$inferInsert;

// Insert schemas for enhanced nutrition
export const insertMealLogSchema = createInsertSchema(mealLogs).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  date: z.string().or(z.date()).transform(val => typeof val === 'string' ? new Date(val) : val)
});
export const insertMealFoodEntrySchema = createInsertSchema(mealFoodEntries).omit({ id: true, createdAt: true });
export const insertUserFoodHistorySchema = createInsertSchema(userFoodHistory).omit({ id: true, createdAt: true, lastUsedAt: true });
export const insertSavedMealTemplateSchema = createInsertSchema(savedMealTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSavedMealItemSchema = createInsertSchema(savedMealItems).omit({ id: true, createdAt: true });
export const insertUserMealCategorySchema = createInsertSchema(userMealCategories).omit({ id: true, createdAt: true, updatedAt: true });

// Type exports for nutrition (legacy)
export type NutritionGoal = typeof nutritionGoals.$inferSelect;
export type InsertNutritionGoal = typeof nutritionGoals.$inferInsert;
export type FoodLog = typeof foodLogs.$inferSelect;
export type InsertFoodLog = typeof foodLogs.$inferInsert;
export type Supplement = typeof supplements.$inferSelect;
export type InsertSupplement = typeof supplements.$inferInsert;
export type SupplementLog = typeof supplementLogs.$inferSelect;
export type InsertSupplementLog = typeof supplementLogs.$inferInsert;

// Insert schemas for nutrition (legacy)
export const insertNutritionGoalSchema = createInsertSchema(nutritionGoals).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFoodLogSchema = createInsertSchema(foodLogs).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  date: z.string().or(z.date()).transform(val => typeof val === 'string' ? new Date(val) : val)
});
export const insertSupplementSchema = createInsertSchema(supplements).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSupplementLogSchema = createInsertSchema(supplementLogs).omit({ id: true, createdAt: true }).extend({
  date: z.string().or(z.date()).transform(val => typeof val === 'string' ? new Date(val) : val)
});

// Audio Sessions - "Coach Says" audio tracking
export const audioSessions = pgTable("audio_sessions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  audioUrl: text("audio_url").notNull(),
  duration: integer("duration").notNull(), // seconds
  category: text("category").notNull(), // 'motivation', 'coaching', 'recovery'
  isPlayed: boolean("is_played").default(false),
  playedAt: timestamp("played_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Video Progress - track watch percentage for videos
export const videoProgress = pgTable("video_progress", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
  watchedPercentage: integer("watched_percentage").default(0), // 0-100
  lastWatchedAt: timestamp("last_watched_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Breath Sessions - daily breath work tracking
export const breathSessions = pgTable("breath_sessions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  duration: integer("duration").notNull(), // seconds
  category: text("category").notNull(), // 'stress', 'focus', 'sleep', 'energy'
  scheduledDate: timestamp("scheduled_date"), // Date scheduled for (null = not scheduled)
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Daily Quotes
export const dailyQuotes = pgTable("daily_quotes", {
  id: serial("id").primaryKey(),
  quote: text("quote").notNull(),
  author: text("author"),
  category: text("category").notNull(), // 'motivation', 'mindset', 'recovery', 'performance'
  date: timestamp("date").notNull(), // Date the quote is for
  createdAt: timestamp("created_at").defaultNow(),
});

// Check-in Schedule - when users have scheduled check-ins
export const checkInSchedules = pgTable("check_in_schedules", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dayOfWeek: text("day_of_week").notNull(), // 'monday', 'tuesday', etc.
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Scheduled Workouts - when users schedule individual or programme workouts for future dates
export const scheduledWorkouts = pgTable("scheduled_workouts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  workoutId: integer("workout_id").notNull(), // ID of the workout being scheduled
  workoutType: text("workout_type").notNull(), // 'individual' or 'programme'
  workoutName: text("workout_name").notNull(), // Store workout name for display
  scheduledDate: timestamp("scheduled_date").notNull(), // Date scheduled for
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Block-based workout types
export type WorkoutBlock = typeof workoutBlocks.$inferSelect;
export type InsertWorkoutBlock = typeof workoutBlocks.$inferInsert;

export type BlockExercise = typeof blockExercises.$inferSelect;
export type InsertBlockExercise = typeof blockExercises.$inferInsert;

// Insert schemas for blocks
export const insertWorkoutBlockSchema = createInsertSchema(workoutBlocks).omit({ id: true, createdAt: true });
export type InsertWorkoutBlockInput = z.infer<typeof insertWorkoutBlockSchema>;

export const insertBlockExerciseSchema = createInsertSchema(blockExercises).omit({ id: true, createdAt: true });
export type InsertBlockExerciseInput = z.infer<typeof insertBlockExerciseSchema>;

// Type exports
export type AudioSession = typeof audioSessions.$inferSelect;
export type InsertAudioSession = typeof audioSessions.$inferInsert;

export type VideoProgress = typeof videoProgress.$inferSelect;
export type InsertVideoProgress = typeof videoProgress.$inferInsert;

export type BreathSession = typeof breathSessions.$inferSelect;
export type InsertBreathSession = typeof breathSessions.$inferInsert;

export type DailyQuote = typeof dailyQuotes.$inferSelect;
export type InsertDailyQuote = typeof dailyQuotes.$inferInsert;

export type CheckInSchedule = typeof checkInSchedules.$inferSelect;
export type InsertCheckInSchedule = typeof checkInSchedules.$inferInsert;

export type ScheduledWorkout = typeof scheduledWorkouts.$inferSelect;
export type InsertScheduledWorkout = typeof scheduledWorkouts.$inferInsert;

// Insert schemas
export const insertAudioSessionSchema = createInsertSchema(audioSessions).omit({ id: true, createdAt: true });
export const insertVideoProgressSchema = createInsertSchema(videoProgress).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBreathSessionSchema = createInsertSchema(breathSessions).omit({ id: true, createdAt: true });
export const insertDailyQuoteSchema = createInsertSchema(dailyQuotes).omit({ id: true, createdAt: true });
export const insertCheckInScheduleSchema = createInsertSchema(checkInSchedules).omit({ id: true, createdAt: true, updatedAt: true });
export const insertScheduledWorkoutSchema = createInsertSchema(scheduledWorkouts).omit({ id: true, createdAt: true, updatedAt: true });

// Workout Logs - tracks actual workout sessions performed by users
export const workoutLogs = pgTable("workout_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  workoutId: integer("workout_id"),
  workoutType: text("workout_type").notNull(), // 'individual' or 'programme'
  workoutName: text("workout_name").notNull(),
  programmeId: integer("programme_id"),
  enrollmentId: integer("enrollment_id"), // Link to user's programme enrollment
  week: integer("week"), // Week number if from a programme
  day: integer("day"), // Day number if from a programme
  notes: text("notes"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  duration: integer("duration"), // in seconds
  status: text("status").notNull().default("in_progress"), // 'in_progress', 'completed', 'cancelled'
  createdAt: timestamp("created_at").defaultNow(),
  // Circuit workout fields
  workoutStyle: text("workout_style"), // 'regular', 'circuit', 'interval', 'video'
  intervalRounds: integer("interval_rounds"),
  intervalRestAfterRound: text("interval_rest_after_round"),
  // Post-workout rating and auto-calculated fields
  workoutRating: integer("workout_rating"), // 1-10 subjective difficulty rating
  autoCalculatedVolume: real("auto_calculated_volume"), // Total volume (weight x reps) in kg
  autoCalculatedTime: integer("auto_calculated_time"), // Total time under tension in seconds
});

// Workout Exercise Logs - tracks each exercise performed in a workout session
export const workoutExerciseLogs = pgTable("workout_exercise_logs", {
  id: serial("id").primaryKey(),
  workoutLogId: integer("workout_log_id").notNull(),
  exerciseLibraryId: integer("exercise_library_id"),
  exerciseName: text("exercise_name").notNull(),
  blockType: text("block_type").default("single"), // 'single', 'superset', 'triset', 'circuit'
  blockGroupId: text("block_group_id"), // Groups exercises in the same superset/triset/circuit block
  section: text("section").default("main"), // 'warmup', 'main'
  position: integer("position").notNull().default(0),
  restPeriod: text("rest_period").default("60 sec"),
  durationType: text("duration_type").default("text"), // 'text' (weight) or 'timer' (time)
  exerciseType: text("exercise_type").default("strength"), // 'general', 'endurance', 'strength', 'cardio', 'timed', 'timed_strength'
  kind: text("kind").default("exercise"), // 'exercise' or 'rest' - distinguishes rest blocks from exercises
  restDuration: integer("rest_duration"), // Duration in seconds for rest blocks
  targetDuration: text("target_duration"), // Duration for interval exercises
  targetReps: text("target_reps"), // Target reps for interval exercises
  createdAt: timestamp("created_at").defaultNow(),
});

// Workout Set Logs - tracks each set performed with actual reps, weight, time
export const workoutSetLogs = pgTable("workout_set_logs", {
  id: serial("id").primaryKey(),
  exerciseLogId: integer("exercise_log_id").notNull(),
  setNumber: integer("set_number").notNull(),
  targetReps: text("target_reps"), // From workout template (e.g., "8-12")
  actualReps: integer("actual_reps"),
  targetWeight: real("target_weight"), // Optional preset weight
  actualWeight: real("actual_weight"), // User's actual weight in kg
  targetDuration: text("target_duration"), // For timer exercises (e.g., "30 sec")
  actualDuration: text("actual_duration"), // User's actual duration (e.g., "30sec", "45sec")
  actualDurationMinutes: integer("actual_duration_minutes"),
  actualDurationSeconds: integer("actual_duration_seconds"),
  isCompleted: boolean("is_completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  // Enhanced logging fields
  side: text("side").default("bilateral"), // 'left', 'right', 'bilateral' for unilateral exercises
  setDifficultyRating: text("set_difficulty_rating"), // 'easy', 'medium', 'hard' - one-tap rating
  painFlag: boolean("pain_flag").default(false), // Did user experience pain during this set?
  failureFlag: boolean("failure_flag").default(false), // Did user reach muscular failure?
});

// Exercise Snapshots - stores latest and best performance per user/exercise for quick access
export const exerciseSnapshots = pgTable("exercise_snapshots", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  exerciseLibraryId: integer("exercise_library_id").notNull(),
  // Last performance (most recent)
  lastReps: integer("last_reps"),
  lastWeight: real("last_weight"),
  lastTimeSeconds: integer("last_time_seconds"),
  lastPerformedAt: timestamp("last_performed_at"),
  // Personal bests
  bestReps: integer("best_reps"),
  bestWeight: real("best_weight"),
  bestVolume: real("best_volume"), // Best single set volume (weight x reps)
  bestTimeSeconds: integer("best_time_seconds"),
  // Frequency tracking
  totalSets: integer("total_sets").default(0),
  totalReps: integer("total_reps").default(0),
  totalVolume: real("total_volume").default(0), // Lifetime volume
  frequencyCount7Days: integer("frequency_count_7_days").default(0),
  frequencyCount30Days: integer("frequency_count_30_days").default(0),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Workout log types
export type WorkoutLog = typeof workoutLogs.$inferSelect;
export type InsertWorkoutLog = typeof workoutLogs.$inferInsert;
export type WorkoutExerciseLog = typeof workoutExerciseLogs.$inferSelect;
export type InsertWorkoutExerciseLog = typeof workoutExerciseLogs.$inferInsert;
export type WorkoutSetLog = typeof workoutSetLogs.$inferSelect;
export type InsertWorkoutSetLog = typeof workoutSetLogs.$inferInsert;
export type ExerciseSnapshot = typeof exerciseSnapshots.$inferSelect;
export type InsertExerciseSnapshot = typeof exerciseSnapshots.$inferInsert;

export const insertWorkoutLogSchema = createInsertSchema(workoutLogs).omit({ id: true, createdAt: true });
export const insertWorkoutExerciseLogSchema = createInsertSchema(workoutExerciseLogs).omit({ id: true, createdAt: true });
export const insertWorkoutSetLogSchema = createInsertSchema(workoutSetLogs).omit({ id: true, createdAt: true });
export const insertExerciseSnapshotSchema = createInsertSchema(exerciseSnapshots).omit({ id: true, createdAt: true, updatedAt: true });

// =====================================================
// PROGRESS TRACKING TABLES
// =====================================================

// Bodyweight Entries - historical weight tracking
export const bodyweightEntries = pgTable("bodyweight_entries", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  weight: real("weight").notNull(), // Weight in kg
  date: timestamp("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Body Measurements - tracking body circumferences
export const bodyMeasurements = pgTable("body_measurements", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: timestamp("date").notNull(),
  neck: real("neck"), // centerline measurements (no L/R)
  shoulders: real("shoulders"),
  chest: real("chest"),
  waist: real("waist"), // in cm
  hips: real("hips"),
  leftBicep: real("left_bicep"), // bilateral measurements
  rightBicep: real("right_bicep"),
  leftForearm: real("left_forearm"),
  rightForearm: real("right_forearm"),
  leftThigh: real("left_thigh"),
  rightThigh: real("right_thigh"),
  leftCalf: real("left_calf"),
  rightCalf: real("right_calf"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Progress Pictures - photo timeline (3 linked angles per set)
export const progressPictures = pgTable("progress_pictures", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: timestamp("date").notNull(),
  photoSetId: text("photo_set_id").notNull(), // Groups front/side/back photos together
  imageUrl: text("image_url").notNull(),
  category: text("category").default("front").notNull(), // 'front', 'side', 'back'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Sleep Entries - sleep duration and quality tracking
export const sleepEntries = pgTable("sleep_entries", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: timestamp("date").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  quality: integer("quality"),
  bedTime: text("bed_time"),
  wakeTime: text("wake_time"),
  deepSleepMinutes: integer("deep_sleep_minutes"),
  lightSleepMinutes: integer("light_sleep_minutes"),
  remSleepMinutes: integer("rem_sleep_minutes"),
  awakeMinutes: integer("awake_minutes"),
  sleepScore: integer("sleep_score"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Step Entries - daily step count
export const stepEntries = pgTable("step_entries", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: timestamp("date").notNull(),
  steps: integer("steps").notNull(),
  distance: real("distance"), // Optional: distance in km
  activeMinutes: integer("active_minutes"), // Optional
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Stress/Burnout Entries - weekly stress and mood tracking
export const stressEntries = pgTable("stress_entries", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: timestamp("date").notNull(),
  stressScore: integer("stress_score").notNull(), // 1-10 scale (1=low stress, 10=high stress)
  mood: text("mood"), // 'great', 'good', 'okay', 'poor', 'bad'
  energyLevel: integer("energy_level"), // 1-10
  recoveryScore: integer("recovery_score"), // 1-10 (how recovered do they feel?)
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Body Fat Percentage tracking
export const bodyFatEntries = pgTable("body_fat_entries", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: timestamp("date").notNull(),
  percentage: real("percentage").notNull(), // Body fat percentage
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Resting Heart Rate tracking
export const restingHREntries = pgTable("resting_hr_entries", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: timestamp("date").notNull(),
  bpm: integer("bpm").notNull(), // Beats per minute
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Blood Pressure tracking
export const bloodPressureEntries = pgTable("blood_pressure_entries", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: timestamp("date").notNull(),
  systolic: integer("systolic").notNull(), // Top number (mmHg)
  diastolic: integer("diastolic").notNull(), // Bottom number (mmHg)
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Lean Body Mass tracking
export const leanBodyMassEntries = pgTable("lean_body_mass_entries", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: timestamp("date").notNull(),
  mass: real("mass").notNull(), // Lean body mass in kg
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Caloric Intake tracking
export const caloricIntakeEntries = pgTable("caloric_intake_entries", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: timestamp("date").notNull(),
  calories: integer("calories").notNull(), // Total calories consumed
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Caloric Burn tracking
export const caloricBurnEntries = pgTable("caloric_burn_entries", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: timestamp("date").notNull(),
  calories: integer("calories").notNull(), // Total calories burned
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Exercise Minutes tracking
export const exerciseMinutesEntries = pgTable("exercise_minutes_entries", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: timestamp("date").notNull(),
  minutes: integer("minutes").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Progress tracking types
export type BodyweightEntry = typeof bodyweightEntries.$inferSelect;
export type InsertBodyweightEntry = typeof bodyweightEntries.$inferInsert;
export type BodyMeasurement = typeof bodyMeasurements.$inferSelect;
export type InsertBodyMeasurement = typeof bodyMeasurements.$inferInsert;
export type ProgressPicture = typeof progressPictures.$inferSelect;
export type InsertProgressPicture = typeof progressPictures.$inferInsert;
export type SleepEntry = typeof sleepEntries.$inferSelect;
export type InsertSleepEntry = typeof sleepEntries.$inferInsert;
export type StepEntry = typeof stepEntries.$inferSelect;
export type InsertStepEntry = typeof stepEntries.$inferInsert;
export type StressEntry = typeof stressEntries.$inferSelect;
export type InsertStressEntry = typeof stressEntries.$inferInsert;
export type BodyFatEntry = typeof bodyFatEntries.$inferSelect;
export type InsertBodyFatEntry = typeof bodyFatEntries.$inferInsert;
export type RestingHREntry = typeof restingHREntries.$inferSelect;
export type InsertRestingHREntry = typeof restingHREntries.$inferInsert;
export type BloodPressureEntry = typeof bloodPressureEntries.$inferSelect;
export type InsertBloodPressureEntry = typeof bloodPressureEntries.$inferInsert;
export type LeanBodyMassEntry = typeof leanBodyMassEntries.$inferSelect;
export type InsertLeanBodyMassEntry = typeof leanBodyMassEntries.$inferInsert;
export type CaloricIntakeEntry = typeof caloricIntakeEntries.$inferSelect;
export type InsertCaloricIntakeEntry = typeof caloricIntakeEntries.$inferInsert;
export type CaloricBurnEntry = typeof caloricBurnEntries.$inferSelect;
export type InsertCaloricBurnEntry = typeof caloricBurnEntries.$inferInsert;
export type ExerciseMinutesEntry = typeof exerciseMinutesEntries.$inferSelect;
export type InsertExerciseMinutesEntry = typeof exerciseMinutesEntries.$inferInsert;

export const insertBodyweightEntrySchema = createInsertSchema(bodyweightEntries).omit({ id: true, createdAt: true });
export const insertBodyMeasurementSchema = createInsertSchema(bodyMeasurements).omit({ id: true, createdAt: true });
export const insertProgressPictureSchema = createInsertSchema(progressPictures).omit({ id: true, createdAt: true });
export const insertSleepEntrySchema = createInsertSchema(sleepEntries).omit({ id: true, createdAt: true });
export const insertStepEntrySchema = createInsertSchema(stepEntries).omit({ id: true, createdAt: true });
export const insertStressEntrySchema = createInsertSchema(stressEntries).omit({ id: true, createdAt: true });
export const insertBodyFatEntrySchema = createInsertSchema(bodyFatEntries).omit({ id: true, createdAt: true });
export const insertRestingHREntrySchema = createInsertSchema(restingHREntries).omit({ id: true, createdAt: true });
export const insertBloodPressureEntrySchema = createInsertSchema(bloodPressureEntries).omit({ id: true, createdAt: true });
export const insertLeanBodyMassEntrySchema = createInsertSchema(leanBodyMassEntries).omit({ id: true, createdAt: true });
export const insertCaloricIntakeEntrySchema = createInsertSchema(caloricIntakeEntries).omit({ id: true, createdAt: true });
export const insertCaloricBurnEntrySchema = createInsertSchema(caloricBurnEntries).omit({ id: true, createdAt: true });
export const insertExerciseMinutesEntrySchema = createInsertSchema(exerciseMinutesEntries).omit({ id: true, createdAt: true });

// ============================================
// BREATH WORK TABLES
// ============================================

// Breath Techniques - pre-seeded with 12 techniques
export const breathTechniques = pgTable("breath_techniques", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  benefits: text("benefits").array(),
  category: text("category").notNull(), // 'relaxation', 'energy', 'focus', 'recovery', 'performance'
  difficulty: text("difficulty").notNull(), // 'beginner', 'intermediate', 'advanced'
  defaultDurationMinutes: integer("default_duration_minutes").notNull().default(5),
  inhaleSeconds: integer("inhale_seconds").notNull(),
  holdAfterInhaleSeconds: integer("hold_after_inhale_seconds").notNull().default(0),
  exhaleSeconds: integer("exhale_seconds").notNull(),
  holdAfterExhaleSeconds: integer("hold_after_exhale_seconds").notNull().default(0),
  defaultRounds: integer("default_rounds").notNull().default(4),
  instructions: text("instructions").array(),
  tips: text("tips").array(),
  iconName: text("icon_name"), // lucide icon name
  gradientColors: text("gradient_colors").array(), // [inhale start, inhale end, exhale start, exhale end]
  muxPlaybackId: text("mux_playback_id"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Breath Work Session Logs - track user completed breathing sessions
export const breathWorkSessionLogs = pgTable("breath_work_session_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  techniqueId: integer("technique_id").references(() => breathTechniques.id, { onDelete: "set null" }),
  routineId: integer("routine_id"), // references custom routine if used
  durationSeconds: integer("duration_seconds").notNull(),
  roundsCompleted: integer("rounds_completed").notNull(),
  completedAt: timestamp("completed_at").notNull(),
  notes: text("notes"),
  mood: text("mood"), // 'calm', 'energized', 'focused', 'relaxed', 'neutral'
  createdAt: timestamp("created_at").defaultNow(),
});

// Custom Breath Routines - user-created breathing routines
export const customBreathRoutines = pgTable("custom_breath_routines", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  totalDurationMinutes: integer("total_duration_minutes").notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Breath Routine Phases - individual phases within a custom routine
export const breathRoutinePhases = pgTable("breath_routine_phases", {
  id: serial("id").primaryKey(),
  routineId: integer("routine_id").notNull().references(() => customBreathRoutines.id, { onDelete: "cascade" }),
  phaseName: text("phase_name").notNull(),
  inhaleSeconds: integer("inhale_seconds").notNull(),
  holdAfterInhaleSeconds: integer("hold_after_inhale_seconds").notNull().default(0),
  exhaleSeconds: integer("exhale_seconds").notNull(),
  holdAfterExhaleSeconds: integer("hold_after_exhale_seconds").notNull().default(0),
  rounds: integer("rounds").notNull(),
  restBetweenRoundsSeconds: integer("rest_between_rounds_seconds").notNull().default(0),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Breath Favourites - bookmarked techniques
export const breathFavourites = pgTable("breath_favourites", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  techniqueId: integer("technique_id").notNull().references(() => breathTechniques.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Breath Work Types
export type BreathTechnique = typeof breathTechniques.$inferSelect;
export type InsertBreathTechnique = typeof breathTechniques.$inferInsert;
export type BreathWorkSessionLog = typeof breathWorkSessionLogs.$inferSelect;
export type InsertBreathWorkSessionLog = typeof breathWorkSessionLogs.$inferInsert;
export type CustomBreathRoutine = typeof customBreathRoutines.$inferSelect;
export type InsertCustomBreathRoutine = typeof customBreathRoutines.$inferInsert;
export type BreathRoutinePhase = typeof breathRoutinePhases.$inferSelect;
export type InsertBreathRoutinePhase = typeof breathRoutinePhases.$inferInsert;
export type BreathFavourite = typeof breathFavourites.$inferSelect;
export type InsertBreathFavourite = typeof breathFavourites.$inferInsert;

// Breath Work Insert Schemas
export const insertBreathTechniqueSchema = createInsertSchema(breathTechniques).omit({ id: true, createdAt: true });
export const insertBreathWorkSessionLogSchema = createInsertSchema(breathWorkSessionLogs).omit({ id: true, createdAt: true });
export const insertCustomBreathRoutineSchema = createInsertSchema(customBreathRoutines).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBreathRoutinePhaseSchema = createInsertSchema(breathRoutinePhases).omit({ id: true, createdAt: true });
export const insertBreathFavouriteSchema = createInsertSchema(breathFavourites).omit({ id: true, createdAt: true });

// ============================================
// MEDITATION & GRATITUDE TABLES
// ============================================

export const meditationSessionLogs = pgTable("meditation_session_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  meditationTitle: text("meditation_title").notNull(),
  category: text("category").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const gratitudeEntries = pgTable("gratitude_entries", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  prompt: text("prompt"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type MeditationSessionLog = typeof meditationSessionLogs.$inferSelect;
export type InsertMeditationSessionLog = typeof meditationSessionLogs.$inferInsert;
export type GratitudeEntry = typeof gratitudeEntries.$inferSelect;
export type InsertGratitudeEntry = typeof gratitudeEntries.$inferInsert;

export const insertMeditationSessionLogSchema = createInsertSchema(meditationSessionLogs).omit({ id: true, completedAt: true });
export const insertGratitudeEntrySchema = createInsertSchema(gratitudeEntries).omit({ id: true, createdAt: true });

// ============================================
// MEAL PLAN TABLES
// ============================================

// Meal slot type: { type: 'breakfast'|'main'|'snack', sides?: 0|1|2 }
// For 'main' type meals, sides indicates how many side dishes (0-2)
export const mealPlans = pgTable("meal_plans", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  caloriesPerDay: integer("calories_per_day").notNull(),
  macroSplit: text("macro_split").notNull(), // 'balanced', 'low_carb', 'low_fat', 'high_protein'
  mealsPerDay: integer("meals_per_day").notNull().default(4), // 2-5 meals (legacy, derived from mealSlots.length)
  mealSlots: jsonb("meal_slots").$type<{ type: string; sides?: number }[]>(), // Array of meal slot configurations
  dietaryPreference: text("dietary_preference").notNull().default("no_preference"), // 'no_preference', 'vegan', 'vegetarian', 'pescatarian', 'paleo'
  excludedIngredients: text("excluded_ingredients").array(), // ['fish', 'shellfish', 'soy', 'dairy', etc.]
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Meal Plan Days - each day in the 3-day plan
export const mealPlanDays = pgTable("meal_plan_days", {
  id: serial("id").primaryKey(),
  mealPlanId: integer("meal_plan_id").notNull().references(() => mealPlans.id, { onDelete: "cascade" }),
  dayIndex: integer("day_index").notNull(), // 1, 2, or 3
  totalCalories: integer("total_calories").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Meal Plan Meals - individual meals assigned to each day
export const mealPlanMeals = pgTable("meal_plan_meals", {
  id: serial("id").primaryKey(),
  mealPlanDayId: integer("meal_plan_day_id").notNull().references(() => mealPlanDays.id, { onDelete: "cascade" }),
  mealType: text("meal_type").notNull(), // 'breakfast', 'lunch', 'dinner', 'snack'
  recipeId: integer("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  calories: integer("calories").notNull(),
  protein: real("protein").notNull(),
  carbs: real("carbs").notNull(),
  fat: real("fat").notNull(),
  ateToday: boolean("ate_today").notNull().default(false),
  ateTodayDate: timestamp("ate_today_date"),
  position: integer("position").notNull().default(0), // for ordering within day
  createdAt: timestamp("created_at").defaultNow(),
});

// Meal Plan Types
export type MealPlan = typeof mealPlans.$inferSelect;
export type InsertMealPlan = typeof mealPlans.$inferInsert;
export type MealPlanDay = typeof mealPlanDays.$inferSelect;
export type InsertMealPlanDay = typeof mealPlanDays.$inferInsert;
export type MealPlanMeal = typeof mealPlanMeals.$inferSelect;
export type InsertMealPlanMeal = typeof mealPlanMeals.$inferInsert;

// Meal Plan Insert Schemas
export const insertMealPlanSchema = createInsertSchema(mealPlans).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMealPlanDaySchema = createInsertSchema(mealPlanDays).omit({ id: true, createdAt: true });
export const insertMealPlanMealSchema = createInsertSchema(mealPlanMeals).omit({ id: true, createdAt: true });

// ============================================
// WORKDAY ENGINE TABLES
// ============================================

// Working Positions Library - admin managed
export const workdayPositions = pgTable("workday_positions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // 'Seated', 'Standing', 'Kneeling', etc.
  description: text("description").notNull(), // When to use this position
  imageUrl: text("image_url"), // Visual representation
  setupCues: text("setup_cues").array(), // Key setup cues
  minDuration: integer("min_duration").default(30), // Suggested min duration in minutes
  maxDuration: integer("max_duration").default(90), // Suggested max duration in minutes
  orderIndex: integer("order_index").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Desk Micro-Resets - admin managed movement library
export const workdayMicroResets = pgTable("workday_micro_resets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  targetArea: text("target_area").notNull(), // 'neck', 'upper_back', 'lower_back', 'hips', 'wrists'
  duration: integer("duration").notNull().default(60), // Duration in seconds
  steps: text("steps").array(), // Movement steps/instructions
  imageUrl: text("image_url"),
  muxPlaybackId: text("mux_playback_id"),
  orderIndex: integer("order_index").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Desk Aches & Fixes - admin managed guidance
export const workdayAchesFixes = pgTable("workday_aches_fixes", {
  id: serial("id").primaryKey(),
  issueType: text("issue_type").notNull(), // 'lower_back', 'neck', 'shoulder', 'wrist', 'hip'
  title: text("title").notNull(), // e.g., 'Lower Back Stiffness'
  description: text("description").notNull(),
  contributors: text("contributors").array(), // Likely desk-related contributors
  setupFactors: text("setup_factors").array(), // Setup factors that may help
  positionChanges: text("position_changes").array(), // Position changes that may help
  movementOptions: text("movement_options").array(), // Movement-based options
  imageUrl: text("image_url"),
  orderIndex: integer("order_index").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Desk Setup Gallery - visual reference images
export const workdayDeskSetups = pgTable("workday_desk_setups", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(), // e.g., 'Seated Desk Setup'
  deskType: text("desk_type").notNull(), // 'fixed', 'sit_stand', 'laptop_only', 'external_monitor', 'dual_monitor'
  positionType: text("position_type").notNull(), // 'seated', 'standing', 'alternative'
  description: text("description"),
  imageUrl: text("image_url").notNull(),
  keyAdjustments: text("key_adjustments").array(), // Key adjustment tips
  orderIndex: integer("order_index").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Desk Setup Tips - editable feedback messages for analysis
export const workdayDeskTips = pgTable("workday_desk_tips", {
  id: serial("id").primaryKey(),
  issueCode: text("issue_code").notNull().unique(), // e.g., 'monitor_low', 'shoulder_elevated', 'hip_angle_tight'
  title: text("title").notNull(), // Short issue title
  feedbackMessage: text("feedback_message").notNull(), // The feedback shown to users
  recommendation: text("recommendation"), // Additional recommendation
  priority: integer("priority").default(1), // 1=high, 2=medium, 3=low
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User's Workday Engine Profile - stores preferences
export const workdayUserProfiles = pgTable("workday_user_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  deskType: text("desk_type"), // 'fixed', 'sit_stand', 'laptop_only', 'external_monitor', 'dual_monitor'
  preferredPositions: text("preferred_positions").array(), // Array of position IDs
  rotationInterval: integer("rotation_interval").default(60), // Minutes between position changes
  notificationsEnabled: boolean("notifications_enabled").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User's Desk Scans - history of desk setup analysis
export const workdayDeskScans = pgTable("workday_desk_scans", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deskType: text("desk_type").notNull(),
  positionType: text("position_type").notNull(), // 'seated', 'standing', 'alternative'
  imageUrl: text("image_url"), // Captured image
  observations: text("observations").array(), // Key observations/feedback
  scanDate: timestamp("scan_date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Workday Engine Types
export type WorkdayPosition = typeof workdayPositions.$inferSelect;
export type InsertWorkdayPosition = typeof workdayPositions.$inferInsert;
export type WorkdayMicroReset = typeof workdayMicroResets.$inferSelect;
export type InsertWorkdayMicroReset = typeof workdayMicroResets.$inferInsert;
export type WorkdayAchesFix = typeof workdayAchesFixes.$inferSelect;
export type InsertWorkdayAchesFix = typeof workdayAchesFixes.$inferInsert;
export type WorkdayDeskSetup = typeof workdayDeskSetups.$inferSelect;
export type InsertWorkdayDeskSetup = typeof workdayDeskSetups.$inferInsert;
export type WorkdayDeskTip = typeof workdayDeskTips.$inferSelect;
export type InsertWorkdayDeskTip = typeof workdayDeskTips.$inferInsert;
export type WorkdayUserProfile = typeof workdayUserProfiles.$inferSelect;
export type InsertWorkdayUserProfile = typeof workdayUserProfiles.$inferInsert;
export type WorkdayDeskScan = typeof workdayDeskScans.$inferSelect;
export type InsertWorkdayDeskScan = typeof workdayDeskScans.$inferInsert;

// Workday Engine Insert Schemas
export const insertWorkdayPositionSchema = createInsertSchema(workdayPositions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWorkdayMicroResetSchema = createInsertSchema(workdayMicroResets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWorkdayAchesFixSchema = createInsertSchema(workdayAchesFixes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWorkdayDeskSetupSchema = createInsertSchema(workdayDeskSetups).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWorkdayDeskTipSchema = createInsertSchema(workdayDeskTips).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWorkdayUserProfileSchema = createInsertSchema(workdayUserProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWorkdayDeskScanSchema = createInsertSchema(workdayDeskScans).omit({ id: true, createdAt: true });

// AI Coaching Settings - admin-configurable prompts for AI features
export const aiCoachingSettings = pgTable("ai_coaching_settings", {
  id: serial("id").primaryKey(),
  feature: text("feature").notNull().unique(),
  provider: text("provider").default("anthropic"),
  model: text("model").default("claude-sonnet-4-5"),
  coachingVoice: text("coaching_voice"),
  customGuidelines: text("custom_guidelines"),
  priorityFactors: text("priority_factors").array(),
  brandRecommendations: text("brand_recommendations"),
  coachingRules: text("coaching_rules"),
  thingsToNeverDo: text("things_to_never_do"),
  responseStyle: text("response_style"),
  featureContext: text("feature_context"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type AiCoachingSetting = typeof aiCoachingSettings.$inferSelect;
export type InsertAiCoachingSetting = typeof aiCoachingSettings.$inferInsert;
export const insertAiCoachingSettingSchema = createInsertSchema(aiCoachingSettings).omit({ id: true, createdAt: true, updatedAt: true });

// Badges and Milestones System
export const badges = pgTable("badges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // 'workout', 'supplement', 'breathwork', 'checkin', 'hydration', 'nutrition', 'streak'
  tier: text("tier").notNull().default("bronze"), // 'bronze', 'silver', 'gold', 'platinum'
  icon: text("icon").notNull(), // Emoji or icon identifier
  requirement: text("requirement").notNull(), // JSON string with criteria e.g. {"type": "count", "target": 10, "metric": "workouts"}
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userBadges = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  badgeId: integer("badge_id").notNull().references(() => badges.id, { onDelete: "cascade" }),
  earnedAt: timestamp("earned_at").defaultNow(),
  notified: boolean("notified").default(false), // Whether user has seen the notification
});

export type Badge = typeof badges.$inferSelect;
export type InsertBadge = typeof badges.$inferInsert;
export const insertBadgeSchema = createInsertSchema(badges).omit({ id: true, createdAt: true });

export type UserBadge = typeof userBadges.$inferSelect;
export type InsertUserBadge = typeof userBadges.$inferInsert;
export const insertUserBadgeSchema = createInsertSchema(userBadges).omit({ id: true, earnedAt: true });

// AI Feedback - thumbs up/down on AI responses across all features
export const aiFeedback = pgTable("ai_feedback", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  feature: text("feature").notNull(), // "recovery_coach", "coach_chat", "desk_analyzer"
  rating: text("rating").notNull(), // "positive" or "negative"
  aiMessage: text("ai_message").notNull(),
  userMessage: text("user_message"),
  context: jsonb("context"), // additional context like assessment data, outcome ID, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

export type AiFeedback = typeof aiFeedback.$inferSelect;
export type InsertAiFeedback = typeof aiFeedback.$inferInsert;
export const insertAiFeedbackSchema = createInsertSchema(aiFeedback).omit({ id: true, createdAt: true });

// Coach conversation history
export const coachConversations = pgTable("coach_conversations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  messages: jsonb("messages").notNull(), // Array of {role, content}
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type CoachConversation = typeof coachConversations.$inferSelect;
export type InsertCoachConversation = typeof coachConversations.$inferInsert;

// Recommendation feedback loop - tracks recommendation outcomes for AI learning
export const recommendationEvents = pgTable("recommendation_events", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  programId: integer("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // 'recommended', 'enrolled', 'skipped', 'abandoned', 'completed'
  source: text("source"), // 'rule_based', 'ai', 'manual_browse'
  intakeSnapshot: jsonb("intake_snapshot"), // user's training params at time of recommendation
  completionPercent: integer("completion_percent"), // 0-100, updated on abandon/complete
  weeksCompleted: integer("weeks_completed"),
  totalWeeks: integer("total_weeks"),
  enrollmentId: integer("enrollment_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type RecommendationEvent = typeof recommendationEvents.$inferSelect;
export type InsertRecommendationEvent = typeof recommendationEvents.$inferInsert;
export const insertRecommendationEventSchema = createInsertSchema(recommendationEvents).omit({ id: true, createdAt: true });

// Burnout Early Warning - daily computed scores
export const burnoutScores = pgTable("burnout_scores", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  score: integer("score").notNull(), // 0-100
  trajectory: text("trajectory").notNull(), // 'stable', 'rising', 'elevated', 'recovering'
  confidence: text("confidence").notNull(), // 'low', 'medium', 'high'
  topDrivers: jsonb("top_drivers").notNull(), // [{key, label, explanation, trend, weight}]
  rollingWindowDays: integer("rolling_window_days").notNull().default(30),
  computedDate: timestamp("computed_date").notNull(),
  checkInCount: integer("check_in_count").notNull().default(0),
  dataSourceCount: integer("data_source_count").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export type BurnoutScore = typeof burnoutScores.$inferSelect;
export type InsertBurnoutScore = typeof burnoutScores.$inferInsert;
export const insertBurnoutScoreSchema = createInsertSchema(burnoutScores).omit({ id: true, createdAt: true });

// Burnout settings - recovery mode and preferences
export const burnoutSettings = pgTable("burnout_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recoveryModeEnabled: boolean("recovery_mode_enabled").default(false),
  recoveryModeStartedAt: timestamp("recovery_mode_started_at"),
  recoveryModeExpiresAt: timestamp("recovery_mode_expires_at"),
  alertDismissedAt: timestamp("alert_dismissed_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type BurnoutSettings = typeof burnoutSettings.$inferSelect;
export type InsertBurnoutSettings = typeof burnoutSettings.$inferInsert;

// Health integration status - ready for mobile day-one
export const healthIntegrations = pgTable("health_integrations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // 'apple_health', 'google_health'
  status: text("status").notNull().default("disconnected"), // 'disconnected', 'pending', 'connected'
  connectedAt: timestamp("connected_at"),
  lastSyncAt: timestamp("last_sync_at"),
  scopes: jsonb("scopes"), // requested data scopes
  createdAt: timestamp("created_at").defaultNow(),
});

export type HealthIntegration = typeof healthIntegrations.$inferSelect;
export type InsertHealthIntegration = typeof healthIntegrations.$inferInsert;

// Companies
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  industry: varchar("industry"),
  planRate: varchar("plan_rate"),
  primaryContactEmail: varchar("primary_contact_email"),
  primaryContactName: varchar("primary_contact_name"),
  joinDate: timestamp("join_date").defaultNow(),
  desiredReportingDate: varchar("desired_reporting_date"),
  notes: text("notes"),
  status: varchar("status").notNull().default("active"),
  maxUsers: integer("max_users"),
  contractStartDate: timestamp("contract_start_date"),
  contractEndDate: timestamp("contract_end_date"),
  renewalDate: timestamp("renewal_date"),
  billingCycle: varchar("billing_cycle"),
  accountManagerName: varchar("account_manager_name"),
  accountManagerEmail: varchar("account_manager_email"),
  logoUrl: varchar("logo_url"),
  reportingCadence: varchar("reporting_cadence"),
  lastReportSentAt: timestamp("last_report_sent_at"),
  engagementAlertThreshold: integer("engagement_alert_threshold"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

// Company Departments
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDepartmentSchema = createInsertSchema(departments).omit({ id: true, createdAt: true });
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departments.$inferSelect;

// Company Invites (for bulk user onboarding)
export const companyInvites = pgTable("company_invites", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  email: varchar("email").notNull(),
  status: varchar("status").notNull().default("pending"),
  invitedAt: timestamp("invited_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
});

export const insertCompanyInviteSchema = createInsertSchema(companyInvites).omit({ id: true, invitedAt: true, acceptedAt: true });
export type InsertCompanyInvite = z.infer<typeof insertCompanyInviteSchema>;
export type CompanyInvite = typeof companyInvites.$inferSelect;

// Usage Alerts
export const usageAlerts = pgTable("usage_alerts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  type: varchar("type").notNull(),
  message: text("message"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUsageAlertSchema = createInsertSchema(usageAlerts).omit({ id: true, createdAt: true });
export type InsertUsageAlert = z.infer<typeof insertUsageAlertSchema>;
export type UsageAlert = typeof usageAlerts.$inferSelect;

// Company Benefits
export const companyBenefits = pgTable("company_benefits", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  title: varchar("title").notNull(),
  description: text("description"),
  category: varchar("category").notNull(),
  link: varchar("link"),
  contactInfo: varchar("contact_info"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCompanyBenefitSchema = createInsertSchema(companyBenefits).omit({ id: true, createdAt: true });
export type InsertCompanyBenefit = z.infer<typeof insertCompanyBenefitSchema>;
export type CompanyBenefit = typeof companyBenefits.$inferSelect;

// Burnout Calibration Events - tracks outcome signals for threshold validation
// Each event records a user's score transition, enabling automated analysis of
// whether our threshold bands (Optimal/Balanced/Strained/Overloaded/Sustained Overload)
// correctly predict real-world burnout trajectories.
export const burnoutCalibrationEvents = pgTable("burnout_calibration_events", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // 'level_transition', 'recovery_mode_activated', 'sustained_high', 'rapid_improvement'
  fromLevel: text("from_level"), // 'optimal', 'balanced', 'strained', 'overloaded', 'sustained_overload'
  toLevel: text("to_level"),
  fromScore: integer("from_score"),
  toScore: integer("to_score"),
  daysInLevel: integer("days_in_level"), // how long user stayed in the fromLevel before transitioning
  metadata: jsonb("metadata"), // additional context (e.g., recovery mode active, data source count)
  createdAt: timestamp("created_at").defaultNow(),
});

export type BurnoutCalibrationEvent = typeof burnoutCalibrationEvents.$inferSelect;
export type InsertBurnoutCalibrationEvent = typeof burnoutCalibrationEvents.$inferInsert;
export const insertBurnoutCalibrationEventSchema = createInsertSchema(burnoutCalibrationEvents).omit({ id: true, createdAt: true });

// Chat models for AI conversations
export * from "./models/chat";
