import {
  users,
  passwordResetTokens,
  exerciseLibrary,
  programs,
  programWeeks,
  programDays,
  programExercises,
  programmeWorkouts,
  programmeWorkoutBlocks,
  programmeBlockExercises,
  enrollmentWorkouts,
  enrollmentWorkoutBlocks,
  enrollmentBlockExercises,
  videos,
  recipes,
  workouts,
  userProgress,
  checkIns,
  bodyMapLogs,
  bookmarks,
  userNotes,
  userProgramEnrollments,
  userEnrollmentWorkoutCustomizations,
  userEnrollmentExerciseCustomizations,
  injuryLogs,
  dailySeverityLogs,
  recoveryActions,
  recoveryCompliance,
  recoveryAlerts,
  meals,
  progressPhotos,
  bodyStats,
  workoutSessions,
  recoveryPlanSuggestions,
  programModificationSuggestions,
  bodyMapAreas,
  bodyMapQuestions,
  bodyMapAnswerOptions,
  bodyMapMovementOptions,
  bodyMapRecoveryTemplates,
  bodyMapTemplateRules,
  hydrationLogs,
  hydrationGoals,
  goalMilestones,
  exerciseSubstitutionMappings,
  programmeModificationRecords,
  reassessmentReminders,
  userExtraWorkoutSessions,
  type User,
  type UpsertUser,
  type ExerciseLibraryItem,
  type InsertExerciseLibraryItem,
  type Program,
  type InsertProgram,
  type ProgramWeek,
  type InsertProgramWeek,
  type ProgramDay,
  type InsertProgramDay,
  type ProgramExercise,
  type InsertProgramExercise,
  type ProgrammeWorkout,
  type InsertProgrammeWorkout,
  type Video,
  type InsertVideo,
  type Recipe,
  type InsertRecipe,
  type Workout,
  type InsertWorkout,
  type UserProgress,
  type InsertUserProgress,
  type CheckIn,
  type InsertCheckIn,
  type BodyMapLog,
  type InsertBodyMapLog,
  type ReassessmentReminder,
  type InsertReassessmentReminder,
  type Bookmark,
  type InsertBookmark,
  type UserNote,
  type InsertUserNote,
  type InjuryLog,
  type InsertInjuryLog,
  type DailySeverityLog,
  type InsertDailySeverityLog,
  type RecoveryAction,
  type InsertRecoveryAction,
  type RecoveryCompliance,
  type InsertRecoveryCompliance,
  type RecoveryAlert,
  type InsertRecoveryAlert,
  type Meal,
  type InsertMeal,
  type ProgressPhoto,
  type InsertProgressPhoto,
  type BodyStats,
  type InsertBodyStats,
  type WorkoutSession,
  type InsertWorkoutSession,
  type RecoveryPlanSuggestion,
  type InsertRecoveryPlanSuggestion,
  type ProgramModificationSuggestion,
  type InsertProgramModificationSuggestion,
  type BodyMapArea,
  type InsertBodyMapArea,
  type BodyMapQuestion,
  type InsertBodyMapQuestion,
  type BodyMapAnswerOption,
  type InsertBodyMapAnswerOption,
  type BodyMapMovementOption,
  type InsertBodyMapMovementOption,
  type BodyMapRecoveryTemplate,
  type InsertBodyMapRecoveryTemplate,
  type BodyMapTemplateRule,
  type InsertBodyMapTemplateRule,
  type BodyMapGuidanceRule,
  type InsertBodyMapGuidanceRule,
  bodyMapGuidanceRules,
  bodyMapOutcomes,
  type BodyMapOutcome,
  type InsertBodyMapOutcome,
  goals,
  habitTemplates,
  habits,
  habitCompletions,
  type Goal,
  type InsertGoal,
  type GoalMilestone,
  type InsertGoalMilestone,
  type HabitTemplate,
  type InsertHabitTemplate,
  type Habit,
  type InsertHabit,
  type HabitCompletion,
  type InsertHabitCompletion,
  userHabitLibrary,
  type UserHabitLibraryEntry,
  type InsertUserHabitLibraryEntry,
  learnTopics,
  learningPaths,
  pathContentItems,
  topicContentItems,
  userPathAssignments,
  userFavourites,
  userPathContentProgress,
  learnContentLibrary,
  learningPathContent,
  userContentProgress,
  type LearnTopic,
  type InsertLearnTopic,
  type LearningPath,
  type InsertLearningPath,
  type PathContentItem,
  type InsertPathContentItem,
  type TopicContentItem,
  type InsertTopicContentItem,
  type UserPathAssignment,
  type InsertUserPathAssignment,
  type UserFavourite,
  type InsertUserFavourite,
  type UserPathContentProgress,
  type InsertUserPathContentProgress,
  type LearnContentLibraryItem,
  type InsertLearnContentLibraryItem,
  type LearningPathContentItem,
  type InsertLearningPathContentItem,
  type UserContentProgress,
  type InsertUserContentProgress,
  type HydrationLog,
  type InsertHydrationLog,
  type HydrationGoal,
  type InsertHydrationGoal,
  nutritionGoals,
  foodLogs,
  supplements,
  supplementLogs,
  mealLogs,
  mealFoodEntries,
  userFoodHistory,
  savedMealTemplates,
  savedMealItems,
  userMealCategories,
  type NutritionGoal,
  type InsertNutritionGoal,
  type FoodLog,
  type InsertFoodLog,
  type Supplement,
  type InsertSupplement,
  type SupplementLog,
  type InsertSupplementLog,
  type MealLog,
  type InsertMealLog,
  type MealFoodEntry,
  type InsertMealFoodEntry,
  type UserFoodHistoryItem,
  type InsertUserFoodHistoryItem,
  type SavedMealTemplate,
  type InsertSavedMealTemplate,
  type SavedMealItem,
  type InsertSavedMealItem,
  type UserMealCategory,
  type InsertUserMealCategory,
  type UserEnrollmentWorkoutCustomization,
  badges,
  userBadges,
  type Badge,
  type InsertBadge,
  type UserBadge,
  type InsertUserBadge,
  type InsertUserEnrollmentWorkoutCustomization,
  type UserEnrollmentExerciseCustomization,
  type InsertUserEnrollmentExerciseCustomization,
  scheduledWorkouts,
  type ScheduledWorkout,
  type InsertScheduledWorkout,
  workoutBlocks,
  type WorkoutBlock,
  type InsertWorkoutBlock,
  blockExercises,
  type BlockExercise,
  type InsertBlockExercise,
  workoutLogs,
  workoutExerciseLogs,
  workoutSetLogs,
  exerciseSnapshots,
  type WorkoutLog,
  type InsertWorkoutLog,
  type WorkoutExerciseLog,
  type InsertWorkoutExerciseLog,
  type WorkoutSetLog,
  type InsertWorkoutSetLog,
  type ExerciseSnapshot,
  type InsertExerciseSnapshot,
  videoWorkoutProgress,
  type VideoWorkoutProgress,
  bodyweightEntries,
  bodyMeasurements,
  progressPictures,
  sleepEntries,
  stepEntries,
  stressEntries,
  bodyFatEntries,
  restingHREntries,
  bloodPressureEntries,
  leanBodyMassEntries,
  caloricIntakeEntries,
  caloricBurnEntries,
  exerciseMinutesEntries,
  type BodyweightEntry,
  type InsertBodyweightEntry,
  type BodyMeasurement,
  type InsertBodyMeasurement,
  type ProgressPicture,
  type InsertProgressPicture,
  type SleepEntry,
  type InsertSleepEntry,
  type StepEntry,
  type InsertStepEntry,
  type StressEntry,
  type InsertStressEntry,
  type BodyFatEntry,
  type InsertBodyFatEntry,
  type RestingHREntry,
  type InsertRestingHREntry,
  type BloodPressureEntry,
  type InsertBloodPressureEntry,
  type LeanBodyMassEntry,
  type InsertLeanBodyMassEntry,
  type CaloricIntakeEntry,
  type InsertCaloricIntakeEntry,
  type CaloricBurnEntry,
  type InsertCaloricBurnEntry,
  type ExerciseMinutesEntry,
  type InsertExerciseMinutesEntry,
  breathTechniques,
  breathWorkSessionLogs,
  customBreathRoutines,
  breathRoutinePhases,
  breathFavourites,
  type BreathTechnique,
  type InsertBreathTechnique,
  type BreathWorkSessionLog,
  type InsertBreathWorkSessionLog,
  type CustomBreathRoutine,
  type InsertCustomBreathRoutine,
  type BreathRoutinePhase,
  type InsertBreathRoutinePhase,
  type BreathFavourite,
  type InsertBreathFavourite,
  meditationSessionLogs,
  type MeditationSessionLog,
  type InsertMeditationSessionLog,
  gratitudeEntries,
  type GratitudeEntry,
  type InsertGratitudeEntry,
  mealPlans,
  mealPlanDays,
  mealPlanMeals,
  type MealPlan,
  type InsertMealPlan,
  type MealPlanDay,
  type InsertMealPlanDay,
  type MealPlanMeal,
  type InsertMealPlanMeal,
  workdayPositions,
  workdayMicroResets,
  workdayAchesFixes,
  workdayDeskSetups,
  workdayDeskTips,
  workdayUserProfiles,
  workdayDeskScans,
  type WorkdayPosition,
  type InsertWorkdayPosition,
  type WorkdayMicroReset,
  type InsertWorkdayMicroReset,
  type WorkdayAchesFix,
  type InsertWorkdayAchesFix,
  type WorkdayDeskSetup,
  type InsertWorkdayDeskSetup,
  type WorkdayDeskTip,
  type InsertWorkdayDeskTip,
  type WorkdayUserProfile,
  type InsertWorkdayUserProfile,
  type WorkdayDeskScan,
  type InsertWorkdayDeskScan,
  aiCoachingSettings,
  type AiCoachingSetting,
  type InsertAiCoachingSetting,
  notificationPreferences,
  type NotificationPreferences,
  type InsertNotificationPreferences,
  coachConversations,
  type CoachConversation,
  recommendationEvents,
  type RecommendationEvent,
  type InsertRecommendationEvent,
  burnoutScores,
  burnoutSettings,
  healthIntegrations,
  type BurnoutScore,
  type InsertBurnoutScore,
  type BurnoutSettings,
  type InsertBurnoutSettings,
  type HealthIntegration,
  type InsertHealthIntegration,
  companies,
  companyBenefits,
  type Company,
  type InsertCompany,
  type CompanyBenefit,
  type InsertCompanyBenefit,
  departments,
  insertDepartmentSchema,
  type Department,
  type InsertDepartment,
  companyInvites,
  insertCompanyInviteSchema,
  type CompanyInvite,
  type InsertCompanyInvite,
  usageAlerts,
  insertUsageAlertSchema,
  type UsageAlert,
  type InsertUsageAlert,
  mindfulnessTools,
  type MindfulnessTool,
  type InsertMindfulnessTool,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, ilike, or, gte, lte, inArray, lt, asc, sql, isNull, isNotNull, aliasedTable } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByEmailWithPassword(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: { email: string; password: string; firstName?: string; lastName?: string; isAdmin?: boolean }): Promise<User>;
  updateUser(id: string, data: Partial<{ email: string; password: string; firstName: string; lastName: string; isAdmin: boolean; profileImageUrl: string; firstLoginAt: Date; onboardingCompleted: boolean; onboardingStep: number; onboardingData: any; displayName: string; dateOfBirth: string; gender: string; height: number; heightUnit: string; weightUnit: string; distanceUnit: string; timeFormat: string; dateFormat: string }>): Promise<User>;
  markFirstLogin(userId: string): Promise<boolean>;
  deleteUser(id: string): Promise<void>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Streak operations
  updateUserStreak(userId: string): Promise<{ currentStreak: number; longestStreak: number; isNewDay: boolean }>;
  getUserStreak(userId: string): Promise<{ currentStreak: number; longestStreak: number; lastActivityDate: string | null }>;

  // Password reset operations
  createPasswordResetToken(data: { userId: string; token: string; expiresAt: Date }): Promise<void>;
  getPasswordResetToken(token: string): Promise<{ userId: string; token: string; expiresAt: Date; usedAt: Date | null } | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<void>;

  // Notification preferences operations
  getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined>;
  upsertNotificationPreferences(userId: string, data: Partial<InsertNotificationPreferences>): Promise<NotificationPreferences>;

  // Exercise Library operations
  getExercises(filters?: {
    exerciseType?: string;
    movementPattern?: string;
    difficulty?: string;
    equipment?: string;
  }): Promise<ExerciseLibraryItem[]>;
  getExerciseById(id: number): Promise<ExerciseLibraryItem | undefined>;
  searchExercises(query: string): Promise<ExerciseLibraryItem[]>;
  createExercise(exercise: InsertExerciseLibraryItem): Promise<ExerciseLibraryItem>;
  updateExercise(id: number, exercise: Partial<InsertExerciseLibraryItem>): Promise<ExerciseLibraryItem>;
  deleteExercise(id: number): Promise<void>;

  // Program operations
  getPrograms(filters?: {
    goal?: string;
    equipment?: string;
    duration?: string;
    programmeType?: string;
  }): Promise<Program[]>;
  getProgramById(id: number): Promise<Program | undefined>;
  getProgramsByIds(ids: number[]): Promise<Program[]>;
  createProgram(program: InsertProgram): Promise<Program>;
  updateProgram(id: number, program: Partial<InsertProgram>): Promise<Program>;
  deleteProgram(id: number): Promise<void>;

  // Workout operations
  getWorkouts(filters?: {
    category?: string;
    difficulty?: string;
    routineType?: string;
  }): Promise<Workout[]>;
  getWorkoutById(id: number): Promise<Workout | undefined>;
  getWorkoutFirstExerciseImage(workoutId: number): Promise<string | null>;
  getWorkoutsByIds(ids: number[]): Promise<Workout[]>;
  createWorkout(workout: InsertWorkout): Promise<Workout>;
  updateWorkout(id: number, workout: Partial<InsertWorkout>): Promise<Workout>;
  deleteWorkout(id: number): Promise<void>;

  // Program exercise operations (block-based only)
  getProgramExercises(workoutId: number): Promise<any[]>;
  getAllProgramExercises(programId: number): Promise<any[]>;
  getWorkoutIdsByName(workoutName: string, programId: number): Promise<number[]>;
  getProgramIdFromWorkoutId(workoutId: number): Promise<number | null>;

  // Program week and day lookups
  getProgramWeekById(id: number): Promise<ProgramWeek | undefined>;
  getProgramDayById(id: number): Promise<ProgramDay | undefined>;
  
  // Program workouts operations
  getProgrammeWorkouts(programId: number): Promise<ProgrammeWorkout[]>;
  getProgrammeWorkoutById(id: number): Promise<ProgrammeWorkout | undefined>;
  createProgrammeWorkout(programId: number, workout: { 
    name: string; 
    description?: string;
    workoutType?: string;
    category?: string;
    difficulty?: string;
    duration?: number;
    intervalRounds?: number;
    intervalRestAfterRound?: string;
  }): Promise<ProgrammeWorkout>;
  updateProgrammeWorkout(id: number, workout: { 
    name?: string; 
    description?: string | null;
    workoutType?: string;
    category?: string;
    difficulty?: string;
    duration?: number;
    intervalRounds?: number;
    intervalRestAfterRound?: string;
  }): Promise<ProgrammeWorkout>;
  deleteProgrammeWorkout(workoutId: number): Promise<void>;

  // Program enrollment operations
  enrollUserInProgram(userId: string, programId: number, startDate?: Date, programType?: 'main' | 'supplementary'): Promise<any>;
  scheduleProgram(userId: string, programId: number, startDate: Date, programType?: 'main' | 'supplementary'): Promise<any>;
  getUserEnrolledPrograms(userId: string): Promise<any[]>;
  getEnrollmentById(enrollmentId: number): Promise<any | null>;
  getUserProgramTimeline(userId: string): Promise<any>;
  getEnrolledProgramDetails(userId: string, enrollmentId: number): Promise<any>;
  updateEnrollmentProgress(enrollmentId: number, workoutsCompleted: number): Promise<any>;
  calculateProgramTotalWorkouts(programId: number): Promise<number>;
  removeSupplementaryProgram(userId: string): Promise<void>;
  unenrollFromProgram(userId: string, enrollmentId: number): Promise<void>;
  rescheduleEnrollment(userId: string, enrollmentId: number, newStartDate: Date): Promise<any>;
  getTodayWorkout(userId: string): Promise<any>;
  getAllWorkoutsForDate(userId: string, date: Date): Promise<any[]>;
  backfillEnrollmentSnapshots(): Promise<{ processed: number; skipped: number }>;
  getEnrollmentWorkoutBlocks(enrollmentWorkoutId: number): Promise<any[]>;
  getEnrollmentWorkoutsForUser(enrollmentId: number): Promise<any[]>;
  addExerciseToEnrollmentWorkouts(enrollmentId: number, templateWorkoutId: number, exerciseLibraryId: number, config: { sets: any; durationType?: string; tempo?: string; load?: string; notes?: string; section?: string }, applyScope: 'next' | 'all_future', currentWeekNumber: number, currentDayNumber?: number): Promise<{ added: number }>;

  // Scheduled workout operations
  scheduleWorkout(userId: string, workoutId: number, workoutType: 'individual' | 'programme', workoutName: string, scheduledDate: Date): Promise<ScheduledWorkout>;
  getScheduledWorkouts(userId: string, fromDate?: Date, toDate?: Date): Promise<ScheduledWorkout[]>;
  getScheduledWorkoutsForDate(userId: string, date: Date): Promise<ScheduledWorkout[]>;
  getScheduledWorkoutsInRange(userId: string, startDate: Date, endDate: Date): Promise<ScheduledWorkout[]>;
  getProgrammeWorkoutsInRange(userId: string, startDate: Date, endDate: Date): Promise<any[]>;
  moveScheduledWorkout(userId: string, scheduledWorkoutId: number, newDate: Date): Promise<ScheduledWorkout | null>;
  moveEnrollmentWorkout(userId: string, enrollmentWorkoutId: number, newDate: Date): Promise<any | null>;
  revertEnrollmentWorkoutMove(userId: string, enrollmentWorkoutId: number): Promise<any | null>;
  regenerateEnrollmentSnapshots(): Promise<{ processed: number; errors: number }>;
  deleteScheduledWorkout(userId: string, scheduledWorkoutId: number): Promise<void>;

  // User enrollment customization operations
  createWorkoutCustomization(customization: InsertUserEnrollmentWorkoutCustomization): Promise<UserEnrollmentWorkoutCustomization>;
  getWorkoutCustomizations(enrollmentId: number): Promise<UserEnrollmentWorkoutCustomization[]>;
  updateWorkoutCustomization(id: number, customization: Partial<InsertUserEnrollmentWorkoutCustomization>): Promise<UserEnrollmentWorkoutCustomization>;
  deleteWorkoutCustomization(id: number): Promise<void>;
  
  createExerciseCustomization(customization: InsertUserEnrollmentExerciseCustomization): Promise<UserEnrollmentExerciseCustomization>;
  getExerciseCustomizations(enrollmentId: number): Promise<UserEnrollmentExerciseCustomization[]>;
  updateExerciseCustomization(id: number, customization: Partial<InsertUserEnrollmentExerciseCustomization>): Promise<UserEnrollmentExerciseCustomization>;
  deleteExerciseCustomization(id: number): Promise<void>;

  // Workout block operations (superset, triset, circuit support)
  createWorkoutBlock(block: InsertWorkoutBlock): Promise<WorkoutBlock>;
  getWorkoutBlocks(workoutId: number): Promise<WorkoutBlock[]>;
  updateWorkoutBlock(id: number, block: Partial<InsertWorkoutBlock>): Promise<WorkoutBlock>;
  deleteWorkoutBlock(id: number): Promise<void>;
  deleteWorkoutBlocksByWorkoutId(workoutId: number): Promise<void>;
  
  createBlockExercise(exercise: InsertBlockExercise): Promise<BlockExercise>;
  getBlockExercises(blockId: number): Promise<BlockExercise[]>;
  updateBlockExercise(id: number, exercise: Partial<InsertBlockExercise>): Promise<BlockExercise>;
  deleteBlockExercise(id: number): Promise<void>;

  // Programme workout block operations
  getProgrammeWorkoutBlocks(workoutId: number): Promise<any[]>;
  createProgrammeWorkoutBlock(block: any): Promise<any>;
  updateProgrammeWorkoutBlock(id: number, block: any): Promise<any>;
  deleteProgrammeWorkoutBlock(id: number): Promise<void>;
  swapProgrammeBlockPositions(blockId1: number, blockId2: number): Promise<void>;
  batchUpdateProgrammeWorkoutBlocks(workoutId: number, blocks: any[]): Promise<any[]>;
  createProgrammeBlockExercise(exercise: any): Promise<any>;
  updateProgrammeBlockExercise(id: number, exercise: any): Promise<any>;
  deleteProgrammeBlockExercise(id: number): Promise<void>;
  
  // Enrollment-aware workout blocks (applies user-specific substitutions)
  getProgrammeWorkoutBlocksForEnrollment(workoutId: number, enrollmentId: number): Promise<any[]>;
  getActiveSubstitutionMappings(enrollmentId: number): Promise<Map<number, {substitutedExerciseId: number, exerciseName: string, imageUrl: string | null, muxPlaybackId: string | null}>>;
  
  // Step 5: Restorable substitutions for cleared body map issues
  getRestorableSubstitutions(userId: string, bodyAreaName: string): Promise<{
    modificationRecordId: number;
    matchedOutcomeId: number;
    substitutions: Array<{
      id: number;
      exerciseInstanceId: number;
      originalExerciseId: number;
      originalExerciseName: string;
      originalImageUrl: string | null;
      substitutedExerciseId: number;
      substitutedExerciseName: string;
      substitutedImageUrl: string | null;
      workoutName: string;
    }>;
  } | null>;
  restoreSubstitutionsByOutcome(userId: string, matchedOutcomeId: number, bodyMapLogId: number, mappingIdsToRestore?: number[], modificationRecordId?: number): Promise<{ restoredCount: number; keptCount: number }>;
  markModificationRecordCleared(userId: string, matchedOutcomeId: number, bodyMapLogId: number): Promise<void>;

  // Video operations
  getVideos(category?: string): Promise<Video[]>;
  getVideoById(id: number): Promise<Video | undefined>;
  searchVideos(query: string): Promise<Video[]>;
  createVideo(video: InsertVideo): Promise<Video>;
  updateVideo(id: number, video: Partial<InsertVideo>): Promise<Video>;
  deleteVideo(id: number): Promise<void>;

  // Recipe operations
  getRecipes(category?: string): Promise<Recipe[]>;
  getRecipeById(id: number): Promise<Recipe | undefined>;
  searchRecipes(query: string): Promise<Recipe[]>;
  createRecipe(recipe: InsertRecipe): Promise<Recipe>;
  updateRecipe(id: number, recipe: Partial<InsertRecipe>): Promise<Recipe>;
  deleteRecipe(id: number): Promise<void>;

  // User progress operations
  getUserProgress(userId: string, limit?: number): Promise<UserProgress[]>;
  createUserProgress(progress: InsertUserProgress): Promise<UserProgress>;
  getLatestUserProgress(userId: string): Promise<UserProgress | undefined>;

  // Check-in operations
  getUserCheckIns(userId: string): Promise<CheckIn[]>;
  createCheckIn(checkIn: InsertCheckIn): Promise<CheckIn>;
  getLatestCheckIn(userId: string): Promise<CheckIn | undefined>;

  // Body map operations
  getBodyMapLogs(userId: string): Promise<BodyMapLog[]>;
  getBodyMapLogById(id: number): Promise<BodyMapLog | undefined>;
  createBodyMapLog(log: InsertBodyMapLog): Promise<BodyMapLog>;
  updateBodyMapLog(id: number, updates: Partial<InsertBodyMapLog>): Promise<BodyMapLog>;
  deleteBodyMapLog(userId: string, bodyPart: string, view: string): Promise<void>;
  deleteBodyMapLogById(userId: string, id: number): Promise<void>;

  // Reassessment reminder operations
  createReassessmentReminder(reminder: InsertReassessmentReminder): Promise<ReassessmentReminder>;
  completeReassessmentReminders(userId: string, bodyArea: string, completedByLogId: number): Promise<number>;
  getDueReassessmentReminders(userId: string): Promise<ReassessmentReminder[]>;
  getRemindersForDate(userId: string, date: Date): Promise<ReassessmentReminder[]>;
  getAllReassessmentReminders(userId: string): Promise<ReassessmentReminder[]>;
  getReassessmentRemindersByBodyArea(userId: string, bodyArea: string): Promise<ReassessmentReminder[]>;

  // Bookmark operations (favorites)
  getUserBookmarks(userId: string): Promise<Bookmark[]>;
  getUserBookmarksByType(userId: string, contentType: string): Promise<Bookmark[]>;
  isContentBookmarked(userId: string, contentType: string, contentId: number): Promise<boolean>;
  createBookmark(bookmark: InsertBookmark): Promise<Bookmark>;
  deleteBookmark(userId: string, contentType: string, contentId: number): Promise<void>;

  // User notes operations
  getUserNotes(userId: string, contentType?: string, contentId?: number): Promise<UserNote[]>;
  createUserNote(note: InsertUserNote): Promise<UserNote>;
  updateUserNote(id: number, note: string): Promise<UserNote>;

  // Search operations
  searchContent(query: string): Promise<{
    programs: Program[];
    videos: Video[];
    recipes: Recipe[];
  }>;

  // Injury tracking operations
  getInjuryLogs(userId: string): Promise<InjuryLog[]>;
  getInjuryLogById(id: number): Promise<InjuryLog | undefined>;
  createInjuryLog(log: InsertInjuryLog): Promise<InjuryLog>;
  updateInjuryLog(id: number, updates: Partial<InsertInjuryLog>): Promise<InjuryLog>;
  deleteInjuryLog(id: number): Promise<void>;

  // Daily severity tracking
  getDailySeverityLogs(injuryLogId: number, days?: number): Promise<DailySeverityLog[]>;
  createDailySeverityLog(log: InsertDailySeverityLog): Promise<DailySeverityLog>;
  getLatestSeverityForInjury(injuryLogId: number): Promise<DailySeverityLog | undefined>;

  // Recovery actions
  getRecoveryActions(injuryLogId: number): Promise<RecoveryAction[]>;
  createRecoveryAction(action: InsertRecoveryAction): Promise<RecoveryAction>;
  updateRecoveryAction(id: number, updates: Partial<InsertRecoveryAction>): Promise<RecoveryAction>;
  deleteRecoveryAction(id: number): Promise<void>;

  // Recovery compliance
  getRecoveryCompliance(recoveryActionId: number, days?: number): Promise<RecoveryCompliance[]>;
  createRecoveryCompliance(compliance: InsertRecoveryCompliance): Promise<RecoveryCompliance>;
  getComplianceStats(recoveryActionId: number, days: number): Promise<{ total: number; completed: number; percentage: number }>;

  // Recovery alerts
  getRecoveryAlerts(userId: string, unreadOnly?: boolean): Promise<RecoveryAlert[]>;
  createRecoveryAlert(alert: InsertRecoveryAlert): Promise<RecoveryAlert>;
  markAlertAsRead(id: number): Promise<void>;
  dismissAlert(id: number): Promise<void>;

  // Smart feedback logic
  analyzeInjuryProgress(injuryLogId: number): Promise<{
    trend: 'improving' | 'stable' | 'worsening';
    daysSinceLogged: number;
    averageSeverity: number;
    recommendAction: boolean;
  }>;

  // Meals operations
  getMeals(userId: string): Promise<Meal[]>;
  createMeal(meal: InsertMeal): Promise<Meal>;
  deleteMeal(id: number): Promise<void>;

  // Progress photos operations
  getProgressPhotos(userId: string): Promise<ProgressPhoto[]>;
  createProgressPhoto(photo: InsertProgressPhoto): Promise<ProgressPhoto>;
  deleteProgressPhoto(id: number): Promise<void>;

  // Body stats operations
  getBodyStats(userId: string): Promise<BodyStats[]>;
  createBodyStats(stats: InsertBodyStats): Promise<BodyStats>;
  deleteBodyStats(id: number): Promise<void>;

  // Workout sessions operations
  getWorkoutSessions(userId: string): Promise<WorkoutSession[]>;
  createWorkoutSession(session: InsertWorkoutSession): Promise<WorkoutSession>;
  deleteWorkoutSession(id: number): Promise<void>;

  // Calendar/Activity aggregation
  getActivitiesByDateRange(userId: string, startDate?: Date, endDate?: Date): Promise<any>;

  // Recovery plan suggestions operations
  createRecoveryPlanSuggestion(plan: InsertRecoveryPlanSuggestion): Promise<RecoveryPlanSuggestion>;
  getRecoveryPlansByUser(userId: string): Promise<RecoveryPlanSuggestion[]>;
  getRecoveryPlanById(id: number): Promise<RecoveryPlanSuggestion | undefined>;
  updateRecoveryPlanStatus(id: number, status: string): Promise<RecoveryPlanSuggestion>;

  // Program modification suggestions operations
  createProgramModificationSuggestion(modification: InsertProgramModificationSuggestion): Promise<ProgramModificationSuggestion>;
  getProgramModificationsByRecoveryPlan(recoveryPlanId: number): Promise<ProgramModificationSuggestion[]>;
  getProgramModificationById(id: number): Promise<ProgramModificationSuggestion | undefined>;
  updateProgramModificationStatus(id: number, status: string): Promise<ProgramModificationSuggestion>;
  updateAllModificationStatuses(recoveryPlanId: number, status: string): Promise<void>;
  applyAcceptedModifications(userId: string, recoveryPlanId: number): Promise<void>;

  // Body Map Configuration operations
  getBodyMapAreas(): Promise<BodyMapArea[]>;
  createBodyMapArea(area: InsertBodyMapArea): Promise<BodyMapArea>;
  updateBodyMapArea(id: number, area: Partial<InsertBodyMapArea>): Promise<BodyMapArea>;
  deleteBodyMapArea(id: number): Promise<void>;

  getBodyMapQuestionsByArea(areaId: number): Promise<BodyMapQuestion[]>;
  createBodyMapQuestion(question: InsertBodyMapQuestion): Promise<BodyMapQuestion>;
  updateBodyMapQuestion(id: number, question: Partial<InsertBodyMapQuestion>): Promise<BodyMapQuestion>;
  deleteBodyMapQuestion(id: number): Promise<void>;

  getBodyMapAnswersByQuestion(questionId: number): Promise<BodyMapAnswerOption[]>;
  createBodyMapAnswer(answer: InsertBodyMapAnswerOption): Promise<BodyMapAnswerOption>;
  updateBodyMapAnswer(id: number, answer: Partial<InsertBodyMapAnswerOption>): Promise<BodyMapAnswerOption>;
  deleteBodyMapAnswer(id: number): Promise<void>;
  getFollowUpTriggersByArea(areaId: number): Promise<{ trainingImpact: string | null }[]>;

  getBodyMapMovementOptionsByArea(areaId: number): Promise<BodyMapMovementOption[]>;
  getAllBodyMapMovementOptions(): Promise<BodyMapMovementOption[]>;
  createBodyMapMovementOption(option: InsertBodyMapMovementOption): Promise<BodyMapMovementOption>;
  updateBodyMapMovementOption(id: number, option: Partial<InsertBodyMapMovementOption>): Promise<BodyMapMovementOption>;
  deleteBodyMapMovementOption(id: number): Promise<void>;

  getBodyMapTemplatesByArea(areaId: number): Promise<BodyMapRecoveryTemplate[]>;
  createBodyMapTemplate(template: InsertBodyMapRecoveryTemplate): Promise<BodyMapRecoveryTemplate>;
  updateBodyMapTemplate(id: number, template: Partial<InsertBodyMapRecoveryTemplate>): Promise<BodyMapRecoveryTemplate>;
  deleteBodyMapTemplate(id: number): Promise<void>;

  getBodyMapRulesByTemplate(templateId: number): Promise<BodyMapTemplateRule[]>;
  createBodyMapRule(rule: InsertBodyMapTemplateRule): Promise<BodyMapTemplateRule>;
  updateBodyMapRule(id: number, rule: Partial<InsertBodyMapTemplateRule>): Promise<BodyMapTemplateRule>;
  deleteBodyMapRule(id: number): Promise<void>;

  // Universal guidance rules
  getBodyMapGuidanceRules(): Promise<BodyMapGuidanceRule[]>;
  createBodyMapGuidanceRule(rule: InsertBodyMapGuidanceRule): Promise<BodyMapGuidanceRule>;
  updateBodyMapGuidanceRule(id: number, rule: Partial<InsertBodyMapGuidanceRule>): Promise<BodyMapGuidanceRule>;
  deleteBodyMapGuidanceRule(id: number): Promise<void>;

  // Body Map Outcomes - outcome-based decision framework
  getBodyMapOutcomesByArea(areaId: number): Promise<BodyMapOutcome[]>;
  getBodyMapOutcomeById(id: number): Promise<BodyMapOutcome | undefined>;
  createBodyMapOutcome(outcome: InsertBodyMapOutcome): Promise<BodyMapOutcome>;
  updateBodyMapOutcome(id: number, outcome: Partial<InsertBodyMapOutcome>): Promise<BodyMapOutcome>;
  deleteBodyMapOutcome(id: number): Promise<void>;
  findMatchingOutcome(bodyAreaId: number, severity: number, trainingImpact: string | null, movementImpact: string | null): Promise<BodyMapOutcome | null>;

  // Recovery plan generation from configuration
  findMatchingRecoveryTemplate(bodyPart: string, severity: number, answers: Record<number, string>): Promise<BodyMapRecoveryTemplate | null>;

  // Goals operations
  getGoals(userId: string): Promise<Goal[]>;
  getGoalById(id: number): Promise<Goal | undefined>;
  getActiveBodyweightGoals(userId: string): Promise<Goal[]>;
  getActiveNutritionGoals(userId: string): Promise<Goal[]>;
  createGoal(goal: InsertGoal): Promise<Goal>;
  updateGoal(id: number, goal: Partial<InsertGoal>): Promise<Goal>;
  deleteGoal(id: number): Promise<void>;
  syncBodyweightGoals(userId: string, weight: number): Promise<void>;
  archiveGoal(id: number): Promise<Goal>;
  getGoalProgress(goalId: number, userId: string): Promise<{ current: number; target: number; label: string; percentage: number } | null>;

  // User Habit Library operations
  getUserHabitLibrary(userId: string): Promise<UserHabitLibraryEntry[]>;
  createUserHabitLibraryEntry(entry: InsertUserHabitLibraryEntry): Promise<UserHabitLibraryEntry>;
  updateUserHabitLibraryEntry(id: number, data: Partial<InsertUserHabitLibraryEntry>): Promise<UserHabitLibraryEntry>;
  deleteUserHabitLibraryEntry(id: number): Promise<void>;

  // Habit Templates operations
  getHabitTemplates(): Promise<HabitTemplate[]>;
  getHabitTemplateById(id: number): Promise<HabitTemplate | undefined>;

  // Habits operations
  getHabits(userId: string): Promise<Habit[]>;
  getHabitById(id: number): Promise<Habit | undefined>;
  createHabit(habit: InsertHabit): Promise<Habit>;
  updateHabit(id: number, habit: Partial<InsertHabit>): Promise<Habit>;
  deleteHabit(id: number): Promise<void>;
  completeHabit(habitId: number, userId: string, date?: Date): Promise<HabitCompletion>;
  uncompleteHabit(habitId: number, userId: string, date: Date): Promise<void>;
  getHabitCompletions(habitId: number): Promise<HabitCompletion[]>;
  getHabitCompletionsForDate(userId: string, date: Date): Promise<{ habitId: number; completedDate: Date }[]>;
  updateHabitStreak(habitId: number): Promise<void>;

  // Learn Topics operations
  getLearnTopics(): Promise<LearnTopic[]>;
  getLearnTopicBySlug(slug: string): Promise<LearnTopic | undefined>;
  getLearnTopicById(id: number): Promise<LearnTopic | undefined>;
  getTopicCompletionStats(userId: string, topicId: number): Promise<{ pathsCompleted: number; totalPaths: number; videosWatched: number; totalVideos: number }>;

  // Learning Paths operations
  getLearningPaths(topicId?: number): Promise<LearningPath[]>;
  getLearningPathsByTopic(topicId: number): Promise<LearningPath[]>;
  getLearningPathById(id: number): Promise<LearningPath | undefined>;
  getPathContentItems(pathId: number): Promise<PathContentItem[]>;
  getPathContentItemsByTopic(topicId: number): Promise<PathContentItem[]>;
  
  // Unified Content Library operations
  getContentLibraryByTopic(topicId: number): Promise<LearnContentLibraryItem[]>;
  getPathContentFromLibrary(pathId: number): Promise<(LearnContentLibraryItem & { orderIndex: number; isRequired: boolean | null; pathContentId: number })[]>;
  addContentToPath(pathId: number, libraryItemId: number, orderIndex: number): Promise<LearningPathContentItem>;
  removeContentFromPath(pathId: number, libraryItemId: number): Promise<void>;
  reorderPathContent(pathId: number, orderedLibraryItemIds: number[]): Promise<void>;
  getUserPathAssignments(userId: string): Promise<UserPathAssignment[]>;
  createUserPathAssignment(userId: string, pathId: number): Promise<UserPathAssignment>;
  deleteUserPathAssignment(userId: string, pathId: number): Promise<void>;

  // Learning Path Content Progress operations
  getPathContentProgress(userId: string, pathId: number): Promise<UserPathContentProgress[]>;
  markContentComplete(userId: string, pathId: number, contentItemId: number): Promise<UserPathContentProgress>;
  markContentIncomplete(userId: string, pathId: number, contentItemId: number): Promise<void>;

  // Active Workout Log operations
  createWorkoutLog(log: any): Promise<any>;
  getWorkoutLogById(id: number): Promise<any>;
  getUserWorkoutLogs(userId: string, limit?: number): Promise<any[]>;
  getActiveWorkoutLog(userId: string): Promise<any>;
  getCompletedWorkoutLogByContext(userId: string, enrollmentId: number, week: number, day: number): Promise<any>;
  getCompletedWorkoutLogByWorkoutId(userId: string, workoutId: number): Promise<any>;
  updateWorkoutLog(id: number, updates: any): Promise<any>;
  completeWorkoutLog(id: number): Promise<any>;
  cancelWorkoutLog(id: number): Promise<void>;
  deleteWorkoutLog(id: number): Promise<void>;
  
  // Workout Exercise Log operations
  createWorkoutExerciseLog(log: any): Promise<any>;
  getWorkoutExerciseLogs(workoutLogId: number): Promise<any[]>;
  updateWorkoutExerciseLog(id: number, updates: any): Promise<any>;
  deleteWorkoutExerciseLog(id: number): Promise<void>;
  
  // Workout Set Log operations
  createWorkoutSetLog(log: any): Promise<any>;
  getWorkoutSetLogs(exerciseLogId: number): Promise<any[]>;
  updateWorkoutSetLog(id: number, updates: any): Promise<any>;
  bulkUpdateWorkoutSetLogs(logs: { id: number; updates: any }[]): Promise<any[]>;
  deleteWorkoutSetLog(id: number): Promise<void>;
  
  // Get previous workout performance for an exercise
  getPreviousExercisePerformance(userId: string, exerciseLibraryId: number): Promise<any>;

  // Video workout progress operations
  getVideoWorkoutProgress(userId: string, workoutId: number): Promise<VideoWorkoutProgress | undefined>;
  saveVideoWorkoutProgress(userId: string, workoutId: number, progressTime: number, duration: number, completed?: boolean): Promise<VideoWorkoutProgress>;
  
  // Exercise Snapshot operations (PR and performance tracking)
  getExerciseSnapshot(userId: string, exerciseLibraryId: number): Promise<any>;
  updateExerciseSnapshot(userId: string, exerciseLibraryId: number, setData: { reps?: number; weight?: number; timeSeconds?: number }): Promise<any>;
  getUserExerciseSnapshots(userId: string): Promise<any[]>;
  
  // Enhanced workout completion with auto-calculations
  completeWorkoutLogWithRating(id: number, workoutRating: number): Promise<any>;

  // Nutrition tracking operations
  getNutritionGoal(userId: string): Promise<NutritionGoal | undefined>;
  createOrUpdateNutritionGoal(userId: string, goal: { calorieTarget: number; proteinTarget: number; carbsTarget: number; fatTarget: number }): Promise<NutritionGoal>;
  getFoodLogsForDate(userId: string, date: Date): Promise<FoodLog[]>;
  getNutritionHistory(userId: string, days: number): Promise<{ date: string; calories: number; protein: number; carbs: number; fat: number }[]>;
  createFoodLog(log: InsertFoodLog): Promise<FoodLog>;
  updateFoodLog(id: number, updates: Partial<InsertFoodLog>): Promise<FoodLog>;
  deleteFoodLog(id: number): Promise<void>;

  // Supplement operations
  getUserSupplements(userId: string): Promise<Supplement[]>;
  getAllUserSupplements(userId: string): Promise<Supplement[]>;
  getSupplementById(id: number): Promise<Supplement | null>;
  createSupplement(supplement: InsertSupplement): Promise<Supplement>;
  updateSupplement(id: number, data: Partial<InsertSupplement>): Promise<Supplement>;
  deleteSupplement(id: number): Promise<void>;
  permanentlyDeleteSupplement(id: number): Promise<void>;
  hasSupplementLogs(supplementId: number): Promise<boolean>;
  getSupplementLogsForDate(userId: string, date: Date): Promise<SupplementLog[]>;
  getSupplementLogs(userId: string, supplementId: number): Promise<SupplementLog[]>;
  getSupplementStats(userId: string, supplementId: number): Promise<{ totalLogs: number; currentStreak: number; longestStreak: number; monthlyPercentage: number }>;
  toggleSupplementTaken(userId: string, supplementId: number, date: Date): Promise<{ taken: boolean }>;
  
  // Enhanced Meal/Food operations
  getMealLogsForDate(userId: string, date: Date): Promise<MealLog[]>;
  getMealLogWithFoods(mealLogId: number): Promise<{ mealLog: MealLog; foods: MealFoodEntry[] } | null>;
  createMealLog(log: InsertMealLog): Promise<MealLog>;
  getOrCreateMealLog(userId: string, date: Date, mealName: string): Promise<MealLog>;
  deleteMealLog(id: number): Promise<void>;
  addFoodToMeal(entry: InsertMealFoodEntry): Promise<MealFoodEntry>;
  updateMealFoodEntry(id: number, updates: Partial<InsertMealFoodEntry>): Promise<MealFoodEntry>;
  deleteMealFoodEntry(id: number): Promise<void>;
  getMealDayTotals(userId: string, date: Date): Promise<{ calories: number; protein: number; carbs: number; fat: number }>;
  
  // Food History operations
  getUserFoodHistory(userId: string, limit?: number): Promise<UserFoodHistoryItem[]>;
  searchUserFoodHistory(userId: string, query: string): Promise<UserFoodHistoryItem[]>;
  addOrUpdateFoodHistory(userId: string, food: Omit<InsertUserFoodHistoryItem, 'userId'>): Promise<UserFoodHistoryItem>;
  deleteFoodHistoryItem(id: number): Promise<void>;
  
  // Saved Meal Templates operations
  getUserSavedMeals(userId: string): Promise<SavedMealTemplate[]>;
  getSavedMealWithItems(savedMealId: number): Promise<{ template: SavedMealTemplate; items: SavedMealItem[] } | null>;
  createSavedMealTemplate(template: InsertSavedMealTemplate): Promise<SavedMealTemplate>;
  updateSavedMealTemplate(id: number, updates: Partial<InsertSavedMealTemplate>): Promise<SavedMealTemplate>;
  deleteSavedMealTemplate(id: number): Promise<void>;
  addItemToSavedMeal(item: InsertSavedMealItem): Promise<SavedMealItem>;
  deleteItemFromSavedMeal(id: number): Promise<void>;
  addSavedMealToLog(userId: string, savedMealId: number, mealLogId: number, servings: number): Promise<MealFoodEntry[]>;
  
  // Recipe to Meal integration
  addRecipeToMeal(userId: string, recipeId: number, mealLogId: number, servings: number): Promise<MealFoodEntry>;
  
  // User Meal Categories operations
  getUserMealCategories(userId: string): Promise<UserMealCategory[]>;
  createUserMealCategory(category: InsertUserMealCategory): Promise<UserMealCategory>;
  updateUserMealCategory(id: number, updates: Partial<InsertUserMealCategory>): Promise<UserMealCategory>;
  deleteUserMealCategory(id: number): Promise<void>;
  initializeDefaultMealCategories(userId: string): Promise<UserMealCategory[]>;

  // Breath Work operations
  getBreathTechniques(): Promise<BreathTechnique[]>;
  getBreathTechniqueById(id: number): Promise<BreathTechnique | undefined>;
  getBreathTechniqueBySlug(slug: string): Promise<BreathTechnique | undefined>;
  createBreathTechnique(technique: InsertBreathTechnique): Promise<BreathTechnique>;
  updateBreathTechnique(id: number, technique: Partial<InsertBreathTechnique>): Promise<BreathTechnique>;
  deleteBreathTechnique(id: number): Promise<void>;
  
  getBreathWorkSessionLogs(userId: string, limit?: number): Promise<BreathWorkSessionLog[]>;
  createBreathWorkSessionLog(session: InsertBreathWorkSessionLog): Promise<BreathWorkSessionLog>;
  getBreathWorkStats(userId: string): Promise<{ totalSessions: number; totalMinutes: number; currentStreak: number }>;
  
  getCustomBreathRoutines(userId: string): Promise<CustomBreathRoutine[]>;
  getCustomBreathRoutineById(id: number): Promise<CustomBreathRoutine | undefined>;
  createCustomBreathRoutine(routine: InsertCustomBreathRoutine): Promise<CustomBreathRoutine>;
  updateCustomBreathRoutine(id: number, routine: Partial<InsertCustomBreathRoutine>): Promise<CustomBreathRoutine>;
  deleteCustomBreathRoutine(id: number): Promise<void>;
  
  getBreathRoutinePhases(routineId: number): Promise<BreathRoutinePhase[]>;
  createBreathRoutinePhase(phase: InsertBreathRoutinePhase): Promise<BreathRoutinePhase>;
  updateBreathRoutinePhase(id: number, phase: Partial<InsertBreathRoutinePhase>): Promise<BreathRoutinePhase>;
  deleteBreathRoutinePhase(id: number): Promise<void>;
  deleteBreathRoutinePhasesByRoutineId(routineId: number): Promise<void>;
  
  getBreathFavourites(userId: string): Promise<BreathFavourite[]>;
  getBreathFavouritesWithTechniques(userId: string): Promise<(BreathFavourite & { technique: BreathTechnique })[]>;
  isBreathTechniqueFavourite(userId: string, techniqueId: number): Promise<boolean>;
  addBreathFavourite(favourite: InsertBreathFavourite): Promise<BreathFavourite>;
  removeBreathFavourite(userId: string, techniqueId: number): Promise<void>;

  // Meditation operations
  createMeditationSession(session: InsertMeditationSessionLog): Promise<MeditationSessionLog>;
  getMeditationSessions(userId: string, limit?: number): Promise<MeditationSessionLog[]>;
  getMeditationStats(userId: string): Promise<{ totalSessions: number; totalMinutes: number; currentStreak: number }>;

  // Gratitude Journal operations
  createGratitudeEntry(entry: InsertGratitudeEntry): Promise<GratitudeEntry>;
  getGratitudeEntries(userId: string, date?: string): Promise<GratitudeEntry[]>;
  getGratitudeEntryDates(userId: string): Promise<string[]>;

  // Meal Plan operations
  getUserMealPlan(userId: string): Promise<MealPlan | undefined>;
  getMealPlanWithDetails(mealPlanId: number): Promise<{ plan: MealPlan; days: (MealPlanDay & { meals: (MealPlanMeal & { recipe: Recipe })[] })[] } | undefined>;
  createMealPlan(plan: InsertMealPlan): Promise<MealPlan>;
  updateMealPlan(id: number, plan: Partial<InsertMealPlan>): Promise<MealPlan>;
  deleteMealPlan(id: number): Promise<void>;
  createMealPlanDay(day: InsertMealPlanDay): Promise<MealPlanDay>;
  updateMealPlanDay(id: number, day: Partial<InsertMealPlanDay>): Promise<MealPlanDay>;
  createMealPlanMeal(meal: InsertMealPlanMeal): Promise<MealPlanMeal>;
  updateMealPlanMeal(id: number, meal: Partial<InsertMealPlanMeal>): Promise<MealPlanMeal>;
  deleteMealPlanMeal(id: number): Promise<void>;
  getRecipesForMealPlan(options: {
    caloriesPerDay: number;
    macroSplit: string;
    mealsPerDay: number;
    dietaryPreference: string;
    excludedIngredients: string[];
    excludeRecipeIds?: number[];
    mealType?: string;
    targetCaloriesPerMeal?: number;
    maxCalories?: number;
  }): Promise<Recipe[]>;

  // Workday Engine - Positions operations
  getWorkdayPositions(): Promise<WorkdayPosition[]>;
  getAllWorkdayPositions(): Promise<WorkdayPosition[]>;
  getWorkdayPositionById(id: number): Promise<WorkdayPosition | undefined>;
  createWorkdayPosition(position: InsertWorkdayPosition): Promise<WorkdayPosition>;
  updateWorkdayPosition(id: number, position: Partial<InsertWorkdayPosition>): Promise<WorkdayPosition>;
  deleteWorkdayPosition(id: number): Promise<void>;

  // Workday Engine - Micro-Resets operations
  getWorkdayMicroResets(targetArea?: string): Promise<WorkdayMicroReset[]>;
  getWorkdayMicroResetById(id: number): Promise<WorkdayMicroReset | undefined>;
  createWorkdayMicroReset(reset: InsertWorkdayMicroReset): Promise<WorkdayMicroReset>;
  updateWorkdayMicroReset(id: number, reset: Partial<InsertWorkdayMicroReset>): Promise<WorkdayMicroReset>;
  deleteWorkdayMicroReset(id: number): Promise<void>;

  // Workday Engine - Aches & Fixes operations
  getWorkdayAchesFixes(): Promise<WorkdayAchesFix[]>;
  getWorkdayAchesFixById(id: number): Promise<WorkdayAchesFix | undefined>;
  getWorkdayAchesFixByIssueType(issueType: string): Promise<WorkdayAchesFix | undefined>;
  createWorkdayAchesFix(fix: InsertWorkdayAchesFix): Promise<WorkdayAchesFix>;
  updateWorkdayAchesFix(id: number, fix: Partial<InsertWorkdayAchesFix>): Promise<WorkdayAchesFix>;
  deleteWorkdayAchesFix(id: number): Promise<void>;

  // Workday Engine - Desk Setups operations
  getWorkdayDeskSetups(deskType?: string, positionType?: string): Promise<WorkdayDeskSetup[]>;
  getWorkdayDeskSetupById(id: number): Promise<WorkdayDeskSetup | undefined>;
  createWorkdayDeskSetup(setup: InsertWorkdayDeskSetup): Promise<WorkdayDeskSetup>;
  updateWorkdayDeskSetup(id: number, setup: Partial<InsertWorkdayDeskSetup>): Promise<WorkdayDeskSetup>;
  deleteWorkdayDeskSetup(id: number): Promise<void>;

  // Workday Engine - Desk Tips operations
  getWorkdayDeskTips(): Promise<WorkdayDeskTip[]>;
  getWorkdayDeskTipById(id: number): Promise<WorkdayDeskTip | undefined>;
  getWorkdayDeskTipByCode(issueCode: string): Promise<WorkdayDeskTip | undefined>;
  createWorkdayDeskTip(tip: InsertWorkdayDeskTip): Promise<WorkdayDeskTip>;
  updateWorkdayDeskTip(id: number, tip: Partial<InsertWorkdayDeskTip>): Promise<WorkdayDeskTip>;
  deleteWorkdayDeskTip(id: number): Promise<void>;

  // Workday Engine - User Profile operations
  getWorkdayUserProfile(userId: string): Promise<WorkdayUserProfile | undefined>;
  createWorkdayUserProfile(profile: InsertWorkdayUserProfile): Promise<WorkdayUserProfile>;
  updateWorkdayUserProfile(userId: string, profile: Partial<InsertWorkdayUserProfile>): Promise<WorkdayUserProfile>;

  // Workday Engine - Desk Scans operations
  getWorkdayDeskScans(userId: string): Promise<WorkdayDeskScan[]>;
  createWorkdayDeskScan(scan: InsertWorkdayDeskScan): Promise<WorkdayDeskScan>;
  deleteWorkdayDeskScan(id: number): Promise<void>;

  // AI Coaching Settings operations
  getAiCoachingSetting(feature: string): Promise<AiCoachingSetting | undefined>;
  getAllAiCoachingSettings(): Promise<AiCoachingSetting[]>;
  upsertAiCoachingSetting(setting: InsertAiCoachingSetting): Promise<AiCoachingSetting>;

  // Badges and Milestones operations
  getAllBadges(): Promise<Badge[]>;
  getBadgeById(id: number): Promise<Badge | undefined>;
  getBadgesByCategory(category: string): Promise<Badge[]>;
  getUserBadges(userId: string, limit?: number): Promise<(UserBadge & { badge: Badge })[]>;
  getUserUnnotifiedBadges(userId: string): Promise<(UserBadge & { badge: Badge })[]>;
  awardBadge(userId: string, badgeId: number): Promise<UserBadge | null>;
  markBadgeNotified(userBadgeId: number): Promise<void>;
  markAllBadgesNotified(userId: string): Promise<void>;
  checkUserBadgeEligibility(userId: string): Promise<Badge[]>;

  // Coach Conversation operations
  getCoachConversations(userId: string): Promise<CoachConversation[]>;
  getCoachConversation(id: number, userId: string): Promise<CoachConversation | undefined>;
  createCoachConversation(userId: string, title: string, messages: any[]): Promise<CoachConversation>;
  updateCoachConversation(id: number, userId: string, data: { messages?: any[]; title?: string }): Promise<CoachConversation | undefined>;
  deleteCoachConversation(id: number, userId: string): Promise<void>;

  // Recommendation feedback loop operations
  createRecommendationEvent(event: InsertRecommendationEvent): Promise<RecommendationEvent>;
  createRecommendationEvents(events: InsertRecommendationEvent[]): Promise<RecommendationEvent[]>;
  getRecommendationEventsForUser(userId: string): Promise<RecommendationEvent[]>;
  updateRecommendationEvent(id: number, data: Partial<InsertRecommendationEvent>): Promise<RecommendationEvent | undefined>;
  getRecommendationMetrics(programIds: number[]): Promise<{
    programId: number;
    totalRecommended: number;
    totalEnrolled: number;
    totalCompleted: number;
    totalAbandoned: number;
    avgCompletionPercent: number;
    enrollmentRate: number;
    completionRate: number;
  }[]>;
  getRecommendationMetricsByProfile(programIds: number[], intakeBucket: { environment?: string; experienceLevel?: string }): Promise<{
    programId: number;
    completionRate: number;
    avgCompletionPercent: number;
    sampleSize: number;
  }[]>;

  // Burnout Early Warning operations
  getBurnoutScore(userId: string): Promise<BurnoutScore | undefined>;
  getBurnoutScoreHistory(userId: string, startDate: Date, endDate: Date): Promise<BurnoutScore[]>;
  getMonthlyBurnoutLog(userId: string): Promise<BurnoutScore[]>;
  createBurnoutScore(score: InsertBurnoutScore): Promise<BurnoutScore>;

  // Burnout settings (recovery mode)
  getBurnoutSettings(userId: string): Promise<BurnoutSettings | undefined>;
  upsertBurnoutSettings(userId: string, data: Partial<InsertBurnoutSettings>): Promise<BurnoutSettings>;

  // Health integrations
  getHealthIntegrations(userId: string): Promise<HealthIntegration[]>;
  upsertHealthIntegration(userId: string, provider: string, data: Partial<InsertHealthIntegration>): Promise<HealthIntegration>;

  // Check-in data for burnout computation
  getCheckInsInRange(userId: string, startDate: Date, endDate: Date): Promise<CheckIn[]>;

  // Company management
  getCompanies(search?: string): Promise<(Company & { userCount: number; activeUserCount: number })[]>;
  getCompanyById(id: number): Promise<(Company & { userCount: number; activeUserCount: number; benefits: CompanyBenefit[] }) | undefined>;
  createCompany(data: InsertCompany): Promise<Company>;
  updateCompany(id: number, data: Partial<InsertCompany>): Promise<Company>;
  deleteCompany(id: number): Promise<void>;

  // Company benefits
  getCompanyBenefits(companyId: number): Promise<CompanyBenefit[]>;
  createCompanyBenefit(data: InsertCompanyBenefit): Promise<CompanyBenefit>;
  updateCompanyBenefit(id: number, data: Partial<InsertCompanyBenefit>): Promise<CompanyBenefit>;
  deleteCompanyBenefit(id: number): Promise<void>;

  // User-company linking
  assignUserToCompany(userId: string, companyId: number): Promise<void>;
  removeUserFromCompany(userId: string): Promise<void>;
  getUsersByCompany(companyId: number): Promise<User[]>;
  getUserCompanyBenefits(userId: string): Promise<CompanyBenefit[]>;

  // Departments
  getDepartments(companyId: number): Promise<Department[]>;
  createDepartment(data: InsertDepartment): Promise<Department>;
  updateDepartment(id: number, name: string): Promise<Department>;
  deleteDepartment(id: number): Promise<void>;

  // Company invites
  getCompanyInvites(companyId: number): Promise<CompanyInvite[]>;
  createCompanyInvites(invites: InsertCompanyInvite[]): Promise<CompanyInvite[]>;
  updateInviteStatus(id: number, status: string): Promise<void>;

  // Usage alerts
  getUsageAlerts(companyId: number): Promise<UsageAlert[]>;
  createUsageAlert(data: InsertUsageAlert): Promise<UsageAlert>;
  markAlertRead(id: number): Promise<void>;

  // Mindfulness Tools
  getMindfulnessTools(): Promise<MindfulnessTool[]>;
  getMindfulnessToolById(id: number): Promise<MindfulnessTool | undefined>;
  createMindfulnessTool(tool: InsertMindfulnessTool): Promise<MindfulnessTool>;
  updateMindfulnessTool(id: number, tool: Partial<InsertMindfulnessTool>): Promise<MindfulnessTool>;
  deleteMindfulnessTool(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations - mandatory for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByEmailWithPassword(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users)
      .where(and(eq(users.email, email), isNotNull(users.password)));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async createUser(userData: { email: string; password: string; firstName?: string; lastName?: string; isAdmin?: boolean }): Promise<User> {
    const id = crypto.randomUUID();
    const [user] = await db
      .insert(users)
      .values({
        id,
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName || null,
        lastName: userData.lastName || null,
        isAdmin: userData.isAdmin || false,
      })
      .returning();
    return user;
  }

  async updateUser(id: string, data: Partial<{ email: string; password: string; firstName: string; lastName: string; isAdmin: boolean; profileImageUrl: string; firstLoginAt: Date; onboardingCompleted: boolean; onboardingStep: number; onboardingData: any; displayName: string; dateOfBirth: string; gender: string; height: number; heightUnit: string; weightUnit: string; distanceUnit: string; timeFormat: string; dateFormat: string }>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async markFirstLogin(userId: string): Promise<boolean> {
    const result = await db
      .update(users)
      .set({ firstLoginAt: new Date(), updatedAt: new Date() })
      .where(and(eq(users.id, userId), isNull(users.firstLoginAt)))
      .returning({ id: users.id });
    return result.length > 0;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // Streak operations
  async updateUserStreak(userId: string): Promise<{ currentStreak: number; longestStreak: number; isNewDay: boolean }> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const lastActivityDate = user.lastStreakActivityDate;
    
    console.log(`[STREAK] Updating for user ${userId}: lastActivity=${lastActivityDate}, today=${today}`);
    
    // If already recorded activity today, no change needed
    if (lastActivityDate === today) {
      console.log(`[STREAK] Already recorded today, no update needed`);
      return {
        currentStreak: user.currentStreak || 0,
        longestStreak: user.longestStreak || 0,
        isNewDay: false
      };
    }

    let newStreak = 1;
    
    if (lastActivityDate) {
      const lastDate = new Date(lastActivityDate);
      const todayDate = new Date(today);
      const diffTime = todayDate.getTime() - lastDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      console.log(`[STREAK] Days since last activity: ${diffDays}`);
      
      if (diffDays === 1) {
        // Consecutive day - increment streak
        newStreak = (user.currentStreak || 0) + 1;
      } else if (diffDays > 1) {
        // Streak broken - reset to 1
        newStreak = 1;
      }
    }

    const newLongestStreak = Math.max(newStreak, user.longestStreak || 0);
    
    console.log(`[STREAK] Saving: newStreak=${newStreak}, longestStreak=${newLongestStreak}, date=${today}`);

    // Update with retry logic
    let retries = 3;
    let updateSuccess = false;
    
    while (retries > 0 && !updateSuccess) {
      try {
        await db
          .update(users)
          .set({
            currentStreak: newStreak,
            longestStreak: newLongestStreak,
            lastStreakActivityDate: today,
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));
        
        // Verify the update was saved
        const verifyUser = await this.getUser(userId);
        if (verifyUser?.lastStreakActivityDate === today && verifyUser?.currentStreak === newStreak) {
          updateSuccess = true;
          console.log(`[STREAK] Successfully saved and verified for user ${userId}`);
        } else {
          console.error(`[STREAK] Verification failed - expected date=${today}, streak=${newStreak}, got date=${verifyUser?.lastStreakActivityDate}, streak=${verifyUser?.currentStreak}`);
          retries--;
        }
      } catch (dbError) {
        console.error(`[STREAK] Database error (${retries} retries left):`, dbError);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms before retry
        }
      }
    }
    
    if (!updateSuccess) {
      console.error(`[STREAK] CRITICAL: Failed to save streak after all retries for user ${userId}`);
      throw new Error("Failed to save streak update after multiple attempts");
    }

    // Check and award streak badges
    try {
      const streakBadges = await db
        .select()
        .from(badges)
        .where(eq(badges.category, 'streak'));
      
      for (const badge of streakBadges) {
        const requirement = badge.requirement as { type?: string; target?: number } | null;
        if (requirement?.type === 'streak' && requirement?.target && newStreak >= requirement.target) {
          await this.awardBadge(userId, badge.id);
        }
      }
    } catch (badgeError) {
      console.error(`[STREAK BADGE] Error checking streak badges:`, badgeError);
    }

    return {
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
      isNewDay: true
    };
  }

  async getUserStreak(userId: string): Promise<{ currentStreak: number; longestStreak: number; lastActivityDate: string | null }> {
    // Always recalculate from real data to ensure accuracy
    return this.recalculateUserStreak(userId);
  }

  async recalculateUserStreak(userId: string): Promise<{ currentStreak: number; longestStreak: number; lastActivityDate: string | null }> {
    console.log(`[STREAK RECALC] Starting recalculation for user ${userId}`);
    
    try {
      // Collect all activity dates from various sources
      const activityDates = new Set<string>();
      
      // Get check-in dates
      const userCheckIns = await db
        .select({ date: checkIns.checkInDate })
        .from(checkIns)
        .where(eq(checkIns.userId, userId));
      userCheckIns.forEach(c => {
        if (c.date) {
          const dateStr = new Date(c.date).toISOString().split('T')[0];
          activityDates.add(dateStr);
        }
      });
      
      // Get workout completion dates
      const userWorkouts = await db
        .select({ date: workoutLogs.completedAt })
        .from(workoutLogs)
        .where(and(eq(workoutLogs.userId, userId), eq(workoutLogs.status, "completed")));
      userWorkouts.forEach(w => {
        if (w.date) {
          const dateStr = new Date(w.date).toISOString().split('T')[0];
          activityDates.add(dateStr);
        }
      });
      
      // Get food log dates
      const userFoodLogs = await db
        .select({ date: foodLogs.date })
        .from(foodLogs)
        .where(eq(foodLogs.userId, userId));
      userFoodLogs.forEach(f => {
        if (f.date) {
          const dateStr = new Date(f.date).toISOString().split('T')[0];
          activityDates.add(dateStr);
        }
      });
      
      // Get breathwork session dates
      const userBreathwork = await db
        .select({ date: breathWorkSessionLogs.completedAt })
        .from(breathWorkSessionLogs)
        .where(eq(breathWorkSessionLogs.userId, userId));
      userBreathwork.forEach(b => {
        if (b.date) {
          const dateStr = new Date(b.date).toISOString().split('T')[0];
          activityDates.add(dateStr);
        }
      });
      
      // Get habit completion dates
      const userHabits = await db
        .select({ date: habitCompletions.completedDate })
        .from(habitCompletions)
        .where(eq(habitCompletions.userId, userId));
      userHabits.forEach(h => {
        if (h.date) {
          const dateStr = new Date(h.date).toISOString().split('T')[0];
          activityDates.add(dateStr);
        }
      });
      
      // Get learning content completion dates
      const userLearning = await db
        .select({ date: userContentProgress.completedDate })
        .from(userContentProgress)
        .where(and(eq(userContentProgress.userId, userId), eq(userContentProgress.completed, true)));
      userLearning.forEach(l => {
        if (l.date) {
          const dateStr = new Date(l.date).toISOString().split('T')[0];
          activityDates.add(dateStr);
        }
      });
      
      // Sort dates in descending order (most recent first)
      const sortedDates = Array.from(activityDates).sort((a, b) => b.localeCompare(a));
      
      if (sortedDates.length === 0) {
        console.log(`[STREAK RECALC] No activities found for user ${userId}`);
        return { currentStreak: 0, longestStreak: 0, lastActivityDate: null };
      }
      
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const lastActivityDate = sortedDates[0];
      
      // Calculate current streak (must include today or yesterday)
      let currentStreak = 0;
      if (lastActivityDate === today || lastActivityDate === yesterday) {
        currentStreak = 1;
        let checkDate = new Date(lastActivityDate);
        
        for (let i = 1; i < sortedDates.length; i++) {
          checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
          const expectedDate = checkDate.toISOString().split('T')[0];
          
          if (sortedDates.includes(expectedDate)) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
      
      // Calculate longest streak ever
      let longestStreak = 0;
      let tempStreak = 1;
      const allDatesAsc = sortedDates.slice().sort((a, b) => a.localeCompare(b));
      
      for (let i = 1; i < allDatesAsc.length; i++) {
        const prevDate = new Date(allDatesAsc[i - 1]);
        const currDate = new Date(allDatesAsc[i]);
        const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          tempStreak++;
        } else if (diffDays > 1) {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
        // diffDays === 0 means same day, skip
      }
      longestStreak = Math.max(longestStreak, tempStreak, currentStreak);
      
      // Update user record with recalculated values
      await db
        .update(users)
        .set({
          currentStreak,
          longestStreak,
          lastStreakActivityDate: lastActivityDate,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));
      
      console.log(`[STREAK RECALC] User ${userId}: current=${currentStreak}, longest=${longestStreak}, lastActivity=${lastActivityDate}`);
      
      return { currentStreak, longestStreak, lastActivityDate };
    } catch (error) {
      console.error(`[STREAK RECALC] Error for user ${userId}:`, error);
      // Return safe defaults instead of throwing
      const user = await this.getUser(userId);
      return {
        currentStreak: user?.currentStreak || 0,
        longestStreak: user?.longestStreak || 0,
        lastActivityDate: user?.lastStreakActivityDate || null
      };
    }
  }

  // Password reset operations
  async createPasswordResetToken(data: { userId: string; token: string; expiresAt: Date }): Promise<void> {
    await db.insert(passwordResetTokens).values({
      userId: data.userId,
      token: data.token,
      expiresAt: data.expiresAt,
    });
  }

  async getPasswordResetToken(token: string): Promise<{ userId: string; token: string; expiresAt: Date; usedAt: Date | null } | undefined> {
    const [result] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return result;
  }

  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.token, token));
  }

  // Notification preferences operations
  async getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined> {
    const [result] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);
    return result;
  }

  async upsertNotificationPreferences(userId: string, data: Partial<InsertNotificationPreferences>): Promise<NotificationPreferences> {
    const existing = await this.getNotificationPreferences(userId);
    
    if (existing) {
      const [updated] = await db
        .update(notificationPreferences)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(notificationPreferences.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(notificationPreferences)
        .values({ userId, ...data })
        .returning();
      return created;
    }
  }

  // Exercise Library operations
  async getExercises(filters?: {
    mainMuscle?: string[];
    equipment?: string[];
    movement?: string[];
    mechanics?: string[];
    level?: string[];
    limit?: number;
    offset?: number;
  }): Promise<ExerciseLibraryItem[]> {
    let query = db.select().from(exerciseLibrary);
    
    if (filters) {
      // Filter by main muscle
      if (filters.mainMuscle && filters.mainMuscle.length > 0) {
        query = query.where(
          sql`${exerciseLibrary.mainMuscle} && ARRAY[${sql.join(filters.mainMuscle.map(v => sql`${v}`), sql`, `)}]::text[]`
        );
      }
      
      // Filter by equipment
      if (filters.equipment && filters.equipment.length > 0) {
        query = query.where(
          sql`${exerciseLibrary.equipment} && ARRAY[${sql.join(filters.equipment.map(v => sql`${v}`), sql`, `)}]::text[]`
        );
      }
      
      // Filter by movement
      if (filters.movement && filters.movement.length > 0) {
        query = query.where(
          sql`${exerciseLibrary.movement} && ARRAY[${sql.join(filters.movement.map(v => sql`${v}`), sql`, `)}]::text[]`
        );
      }
      
      // Filter by mechanics
      if (filters.mechanics && filters.mechanics.length > 0) {
        query = query.where(
          sql`${exerciseLibrary.mechanics} && ARRAY[${sql.join(filters.mechanics.map(v => sql`${v}`), sql`, `)}]::text[]`
        );
      }
      
      // Filter by level
      if (filters.level && filters.level.length > 0) {
        query = query.where(
          inArray(exerciseLibrary.level, filters.level)
        );
      }
    }
    
    query = query.orderBy(exerciseLibrary.name);
    
    // Apply pagination
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }
    
    return await query;
  }

  async getExerciseById(id: number): Promise<ExerciseLibraryItem | undefined> {
    const [exercise] = await db.select().from(exerciseLibrary).where(eq(exerciseLibrary.id, id));
    return exercise;
  }

  async searchExercises(query: string): Promise<ExerciseLibraryItem[]> {
    // Shortcut mappings for common exercise terms
    const shortcuts: Record<string, string> = {
      'kb': 'kettlebell',
      'bb': 'barbell',
      'db': 'dumbbell',
      'sa': 'single arm',
      'sl': 'single leg',
      'bw': 'bodyweight',
    };
    
    // Split query into words, expand shortcuts, and require ALL words to match (in any order)
    const words = query.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const expandedWords = words.map(word => shortcuts[word] || word);
    
    if (expandedWords.length === 0) {
      return await db.select().from(exerciseLibrary).orderBy(exerciseLibrary.name);
    }
    
    // Flatten multi-word expansions (e.g., "single arm" becomes ["single", "arm"])
    const allSearchTerms = expandedWords.flatMap(term => term.split(/\s+/));
    
    // Create condition: name must contain ALL words (in any order)
    const nameConditions = allSearchTerms.map(word => ilike(exerciseLibrary.name, `%${word}%`));
    const instructionsConditions = allSearchTerms.map(word => ilike(exerciseLibrary.instructions, `%${word}%`));
    
    return await db
      .select()
      .from(exerciseLibrary)
      .where(
        or(
          and(...nameConditions),
          and(...instructionsConditions)
        )
      )
      .orderBy(exerciseLibrary.name);
  }

  async createExercise(exercise: InsertExerciseLibraryItem): Promise<ExerciseLibraryItem> {
    const [newExercise] = await db.insert(exerciseLibrary).values(exercise).returning();
    return newExercise;
  }

  async updateExercise(id: number, exercise: Partial<InsertExerciseLibraryItem>): Promise<ExerciseLibraryItem> {
    const [updatedExercise] = await db
      .update(exerciseLibrary)
      .set(exercise)
      .where(eq(exerciseLibrary.id, id))
      .returning();
    return updatedExercise;
  }

  async deleteExercise(id: number): Promise<void> {
    await db.delete(exerciseLibrary).where(eq(exerciseLibrary.id, id));
  }

  // Program operations
  async getPrograms(filters?: {
    goal?: string;
    equipment?: string;
    duration?: string;
    programmeType?: string;
    includeUserCreated?: boolean;
  }): Promise<Program[]> {
    const conditions = [];
    
    if (!filters?.includeUserCreated) {
      conditions.push(or(
        eq(programs.sourceType, 'manual'),
        eq(programs.sourceType, 'recovery'),
        isNull(programs.sourceType)
      )!);
    }
    
    if (filters?.goal && filters.goal !== 'All Goals') {
      conditions.push(eq(programs.goal, filters.goal.toLowerCase().replace(' ', '_')));
    }
    
    if (filters?.programmeType) {
      conditions.push(eq(programs.programmeType, filters.programmeType));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(programs)
        .where(and(...conditions))
        .orderBy(desc(programs.createdAt));
    }
    
    return await db.select().from(programs).orderBy(desc(programs.createdAt));
  }

  async getUserCreatedPrograms(userId: string): Promise<Program[]> {
    return await db.select().from(programs)
      .where(and(
        eq(programs.createdByUserId, userId),
        eq(programs.sourceType, 'user_created')
      ))
      .orderBy(desc(programs.createdAt));
  }

  async getUserCreatedProgramById(userId: string, programId: number): Promise<Program | undefined> {
    const [program] = await db.select().from(programs)
      .where(and(
        eq(programs.id, programId),
        eq(programs.createdByUserId, userId),
        eq(programs.sourceType, 'user_created')
      ));
    return program;
  }

  async getProgramById(id: number): Promise<Program | undefined> {
    const [program] = await db.select().from(programs).where(eq(programs.id, id));
    return program;
  }

  async getProgramsByIds(ids: number[]): Promise<Program[]> {
    if (ids.length === 0) return [];
    return await db.select().from(programs).where(inArray(programs.id, ids));
  }

  async createProgram(program: InsertProgram): Promise<Program> {
    const [newProgram] = await db.insert(programs).values(program).returning();
    return newProgram;
  }

  async updateProgram(id: number, program: Partial<InsertProgram>): Promise<Program> {
    const [updatedProgram] = await db
      .update(programs)
      .set(program)
      .where(eq(programs.id, id))
      .returning();
    return updatedProgram;
  }

  async deleteProgram(id: number): Promise<void> {
    await db.delete(programs).where(eq(programs.id, id));
  }

  // Workout operations
  async getWorkouts(filters?: {
    category?: string;
    difficulty?: string;
    routineType?: string;
  }): Promise<Workout[]> {
    let conditions = [];
    
    conditions.push(or(isNull(workouts.sourceType), eq(workouts.sourceType, 'admin')));
    
    if (filters?.category && filters.category !== 'all') {
      conditions.push(eq(workouts.category, filters.category));
    }
    
    if (filters?.difficulty && filters.difficulty !== 'all') {
      conditions.push(eq(workouts.difficulty, filters.difficulty));
    }
    
    if (filters?.routineType) {
      conditions.push(eq(workouts.routineType, filters.routineType));
    }
    
    return await db.select().from(workouts)
      .where(and(...conditions))
      .orderBy(workouts.id);
  }

  async getWorkoutById(id: number): Promise<Workout | undefined> {
    const [workout] = await db.select().from(workouts).where(eq(workouts.id, id));
    return workout;
  }

  async getWorkoutFirstExerciseImage(workoutId: number): Promise<string | null> {
    const blocks = await db.select()
      .from(workoutBlocks)
      .where(eq(workoutBlocks.workoutId, workoutId))
      .orderBy(asc(workoutBlocks.position));

    for (const block of blocks) {
      const exercises = await db.select()
        .from(blockExercises)
        .where(eq(blockExercises.blockId, block.id))
        .orderBy(asc(blockExercises.position))
        .limit(1);

      if (exercises.length > 0 && exercises[0].exerciseLibraryId) {
        const libEntry = await this.getExerciseById(exercises[0].exerciseLibraryId);
        if (libEntry) {
          const img = libEntry.imageUrl || (libEntry.muxPlaybackId ? `https://image.mux.com/${libEntry.muxPlaybackId}/thumbnail.jpg?width=128` : null);
          if (img) return img;
        }
      }
    }
    return null;
  }

  async getWorkoutsByIds(ids: number[]): Promise<Workout[]> {
    if (ids.length === 0) return [];
    return await db.select().from(workouts).where(inArray(workouts.id, ids));
  }

  async createWorkout(workout: any): Promise<Workout> {
    const [newWorkout] = await db.insert(workouts).values(workout).returning();
    return newWorkout;
  }

  async updateWorkout(id: number, workout: any): Promise<Workout> {
    const [updatedWorkout] = await db
      .update(workouts)
      .set(workout)
      .where(eq(workouts.id, id))
      .returning();
    return updatedWorkout;
  }

  async deleteWorkout(id: number): Promise<void> {
    await db.delete(workouts).where(eq(workouts.id, id));
  }

  // Get exercises for standalone workouts (workout library) - uses workout_blocks or exercises JSONB
  async getWorkoutExercises(workoutId: number): Promise<any[]> {
    // First try standalone workout blocks table
    const blocks = await this.getWorkoutBlocks(workoutId);
    if (blocks.length > 0) {
      const exercises: any[] = [];
      for (const block of blocks) {
        const blockExercises = await this.getBlockExercises(block.id);
        for (const ex of blockExercises) {
          exercises.push({
            id: ex.id,
            workoutId: workoutId,
            name: ex.exerciseName || ex.name,
            exerciseLibraryId: ex.exerciseLibraryId,
            sets: Array.isArray(ex.sets) ? ex.sets.length : 0,
            reps: Array.isArray(ex.sets) && ex.sets[0] ? ex.sets[0].reps : null,
            rest: block.rest,
            section: block.section,
            blockType: block.blockType,
            position: ex.position,
            exerciseName: ex.exerciseName || ex.name,
            muxPlaybackId: ex.muxPlaybackId,
          });
        }
      }
      return exercises;
    }
    
    // Fallback: read from workout.exercises JSONB field
    const workout = await this.getWorkoutById(workoutId);
    if (!workout?.exercises) return [];
    
    // exercises JSONB can be either flat array or blocks array
    const exData = workout.exercises as any[];
    if (!Array.isArray(exData) || exData.length === 0) return [];
    
    // Check if it's block format (has exercises property)
    if (exData[0]?.exercises) {
      // Block format - flatten it
      const exercises: any[] = [];
      for (const block of exData) {
        for (const ex of block.exercises || []) {
          exercises.push({
            ...ex,
            section: block.section,
            blockType: block.blockType,
            rest: block.rest,
          });
        }
      }
      return exercises;
    }
    
    // Already flat format
    return exData;
  }

  // Program exercise operations - uses programme_workout_blocks tables
  async getProgramExercises(workoutId: number): Promise<any[]> {
    const blocks = await this.getProgrammeWorkoutBlocks(workoutId);
    const exercises: any[] = [];
    
    for (const block of blocks) {
      for (const ex of block.exercises || []) {
        exercises.push({
          id: ex.id,
          workoutId: workoutId,
          name: ex.exerciseName,
          exerciseLibraryId: ex.exerciseLibraryId,
          sets: Array.isArray(ex.sets) ? ex.sets.length : 0,
          reps: Array.isArray(ex.sets) && ex.sets[0] ? ex.sets[0].reps : null,
          rest: Array.isArray(ex.sets) && ex.sets[0] ? ex.sets[0].rest : null,
          section: block.section,
          blockType: block.blockType,
          tempo: ex.tempo,
          notes: ex.notes,
          position: ex.position,
          exerciseName: ex.exerciseName,
          exerciseType: null,
          muxPlaybackId: ex.muxPlaybackId,
        });
      }
    }
    
    return exercises;
  }

  // Get all exercises for an entire programme (aggregates across all workouts)
  async getAllProgramExercises(programId: number): Promise<any[]> {
    // Get all workouts in the programme
    const workoutsList = await db
      .select({ 
        workoutId: programmeWorkouts.id,
        workoutName: programmeWorkouts.name,
        weekPosition: programWeeks.weekNumber,
        dayPosition: programDays.position,
      })
      .from(programmeWorkouts)
      .innerJoin(programDays, eq(programmeWorkouts.dayId, programDays.id))
      .innerJoin(programWeeks, eq(programDays.weekId, programWeeks.id))
      .where(eq(programWeeks.programId, programId))
      .orderBy(programWeeks.weekNumber, programDays.position);

    const allExercises: any[] = [];
    const seenWorkoutNames = new Set<string>();

    for (const workout of workoutsList) {
      // Only get exercises once per workout name (template sharing)
      if (seenWorkoutNames.has(workout.workoutName)) {
        continue;
      }
      seenWorkoutNames.add(workout.workoutName);

      const exercises = await this.getProgramExercises(workout.workoutId);
      for (const ex of exercises) {
        allExercises.push({
          ...ex,
          week: workout.weekPosition,
          day: workout.dayPosition,
          workoutName: workout.workoutName,
        });
      }
    }

    return allExercises;
  }

  // Get all workout IDs with the same name in a programme
  async getWorkoutIdsByName(workoutName: string, programId: number): Promise<number[]> {
    const workouts = await db
      .select({ workoutId: programmeWorkouts.id })
      .from(programmeWorkouts)
      .innerJoin(programDays, eq(programmeWorkouts.dayId, programDays.id))
      .innerJoin(programWeeks, eq(programDays.weekId, programWeeks.id))
      .where(and(
        eq(programWeeks.programId, programId),
        eq(programmeWorkouts.name, workoutName)
      ));
    return workouts.map(w => w.workoutId);
  }

  // Get programId from a workout ID (traverses workout → day → week → program)
  async getProgramIdFromWorkoutId(workoutId: number): Promise<number | null> {
    const result = await db
      .select({ programId: programWeeks.programId })
      .from(programmeWorkouts)
      .innerJoin(programDays, eq(programmeWorkouts.dayId, programDays.id))
      .innerJoin(programWeeks, eq(programDays.weekId, programWeeks.id))
      .where(eq(programmeWorkouts.id, workoutId))
      .limit(1);
    return result.length > 0 ? result[0].programId : null;
  }

  // Program enrollment operations
  async enrollUserInProgram(userId: string, programId: number, startDate?: Date, programType: 'main' | 'supplementary' = 'main', forceReplace: boolean = false): Promise<any> {
    // Get program details to calculate total workouts and end date
    const [program] = await db.select().from(programs).where(eq(programs.id, programId));
    if (!program) throw new Error('Program not found');

    // If main programme, check if user already has one active/scheduled
    if (programType === 'main') {
      const existingMain = await db
        .select()
        .from(userProgramEnrollments)
        .where(
          and(
            eq(userProgramEnrollments.userId, userId),
            eq(userProgramEnrollments.programType, 'main'),
            or(
              eq(userProgramEnrollments.status, 'active'),
              eq(userProgramEnrollments.status, 'scheduled')
            )
          )
        )
        .limit(1);

      if (existingMain.length > 0 && !forceReplace) {
        const existing = existingMain[0];
        const newStart = startDate ? new Date(startDate) : new Date();
        // Allow scheduling if the new programme starts after the existing one ends
        const noOverlap = existing.endDate && new Date(existing.endDate) < newStart;
        if (!noOverlap) {
          const existingProgram = await this.getProgramById(existing.programId);
          const error: any = new Error('User already has an active or scheduled main program');
          error.code = 'PROGRAMME_CONFLICT';
          error.existingEnrollment = {
            ...existing,
            programme: existingProgram,
          };
          throw error;
        }
      }

      if (existingMain.length > 0 && forceReplace) {
        // Mark the old one as completed
        await db
          .update(userProgramEnrollments)
          .set({ status: 'completed' })
          .where(eq(userProgramEnrollments.id, existingMain[0].id));
      }
    }

    // If supplementary, check if user already has 3 active/scheduled
    if (programType === 'supplementary') {
      const existingSupplementary = await db
        .select()
        .from(userProgramEnrollments)
        .where(
          and(
            eq(userProgramEnrollments.userId, userId),
            eq(userProgramEnrollments.programType, 'supplementary'),
            or(
              eq(userProgramEnrollments.status, 'active'),
              eq(userProgramEnrollments.status, 'scheduled')
            )
          )
        );

      if (existingSupplementary.length >= 3) {
        throw new Error('User already has 3 active or scheduled supplementary programs. Please remove one first.');
      }
    }

    // Calculate total workouts in the program
    const totalWorkouts = await this.calculateProgramTotalWorkouts(programId);

    // Calculate end date (last day of the programme, inclusive)
    // Normalize start to midnight to ensure consistent week/day calculations
    const rawStart = startDate || new Date();
    const start = new Date(rawStart.getFullYear(), rawStart.getMonth(), rawStart.getDate());
    const endDate = new Date(start);
    endDate.setDate(endDate.getDate() + (program.weeks * 7 - 1));

    // Get the highest order index for this user's enrollments
    const [latestEnrollment] = await db
      .select({ orderIndex: userProgramEnrollments.orderIndex })
      .from(userProgramEnrollments)
      .where(eq(userProgramEnrollments.userId, userId))
      .orderBy(desc(userProgramEnrollments.orderIndex))
      .limit(1);

    const nextOrderIndex = latestEnrollment ? latestEnrollment.orderIndex + 1 : 0;

    // Create new enrollment
    const [enrollment] = await db
      .insert(userProgramEnrollments)
      .values({
        userId,
        programId,
        startDate: start,
        endDate,
        status: startDate && startDate > new Date() ? 'scheduled' : 'active',
        programType,
        totalWorkouts,
        workoutsCompleted: 0,
        orderIndex: nextOrderIndex,
      })
      .returning();

    // Deep copy all workout data for this enrollment (snapshot at enrollment time)
    await this.copyProgramWorkoutsToEnrollment(enrollment.id, programId);

    return enrollment;
  }

  // Deep copy programme workouts, blocks, and exercises to enrollment-specific tables
  // This creates separate records for ALL weeks in the programme (not just Week 1)
  // Week 1's schedule is used as the template and replicated for each week
  async copyProgramWorkoutsToEnrollment(enrollmentId: number, programId: number): Promise<void> {
    // Get programme to know total weeks
    const [program] = await db.select().from(programs).where(eq(programs.id, programId));
    if (!program) return;
    
    const totalWeeks = program.weeks || 1;
    
    // Get Week 1 schedule template (the only week with actual schedule data)
    const week1 = await db.select().from(programWeeks)
      .where(and(eq(programWeeks.programId, programId), eq(programWeeks.weekNumber, 1)))
      .limit(1);
    
    if (week1.length === 0) {
      console.log(`No Week 1 found for program ${programId}, skipping enrollment snapshot`);
      return;
    }
    
    // Get Week 1's days and workouts
    const week1Days = await db.select().from(programDays).where(eq(programDays.weekId, week1[0].id));
    
    // Create enrollment workouts for EACH week (1 through totalWeeks)
    for (let weekNum = 1; weekNum <= totalWeeks; weekNum++) {
      for (const day of week1Days) {
        const templateWorkouts = await db
          .select()
          .from(programmeWorkouts)
          .where(eq(programmeWorkouts.dayId, day.id));
        
        for (const templateWorkout of templateWorkouts) {
          // Create enrollment workout copy for this specific week
          const [enrollmentWorkout] = await db
            .insert(enrollmentWorkouts)
            .values({
              enrollmentId,
              templateWorkoutId: templateWorkout.id,
              weekNumber: weekNum, // Use the current week number, not Week 1
              dayNumber: day.position + 1, // Convert 0-indexed position to 1-indexed day number
              name: templateWorkout.name,
              description: templateWorkout.description,
              workoutType: templateWorkout.workoutType,
              category: templateWorkout.category,
              difficulty: templateWorkout.difficulty,
              duration: templateWorkout.duration,
              intervalRounds: templateWorkout.intervalRounds,
              intervalRestAfterRound: templateWorkout.intervalRestAfterRound,
              position: templateWorkout.position,
            })
            .returning();
          
          // Get blocks for this workout (using template sharing logic)
          const templateBlocks = await this.getProgrammeWorkoutBlocks(templateWorkout.id);
          
          for (const templateBlock of templateBlocks) {
            // Create enrollment block copy
            const [enrollmentBlock] = await db
              .insert(enrollmentWorkoutBlocks)
              .values({
                enrollmentWorkoutId: enrollmentWorkout.id,
                templateBlockId: templateBlock.id,
                section: templateBlock.section,
                blockType: templateBlock.blockType,
                position: templateBlock.position,
                rest: templateBlock.rest,
                rounds: templateBlock.rounds,
                restAfterRound: templateBlock.restAfterRound,
              })
              .returning();
            
            // Copy exercises in this block
            for (const templateExercise of (templateBlock.exercises || [])) {
              await db
                .insert(enrollmentBlockExercises)
                .values({
                  enrollmentBlockId: enrollmentBlock.id,
                  templateExerciseId: templateExercise.id,
                  exerciseLibraryId: templateExercise.exerciseLibraryId,
                  position: templateExercise.position,
                  sets: templateExercise.sets,
                  durationType: templateExercise.durationType,
                  tempo: templateExercise.tempo,
                  load: templateExercise.load,
                  notes: templateExercise.notes,
                });
            }
          }
        }
      }
    }
    
    console.log(`Created enrollment snapshot for ${totalWeeks} weeks of program ${programId}`);
  }

  // Backfill existing enrollments that don't have snapshot data
  async backfillEnrollmentSnapshots(): Promise<{ processed: number; skipped: number }> {
    // Get all active or scheduled enrollments
    const enrollments = await db
      .select()
      .from(userProgramEnrollments)
      .where(
        or(
          eq(userProgramEnrollments.status, 'active'),
          eq(userProgramEnrollments.status, 'scheduled')
        )
      );

    let processed = 0;
    let skipped = 0;

    for (const enrollment of enrollments) {
      // Check if this enrollment already has snapshot data
      const hasSnapshot = await db
        .select({ id: enrollmentWorkouts.id })
        .from(enrollmentWorkouts)
        .where(eq(enrollmentWorkouts.enrollmentId, enrollment.id))
        .limit(1);

      if (hasSnapshot.length > 0) {
        skipped++;
        continue;
      }

      // Create snapshot data for this enrollment
      try {
        await this.copyProgramWorkoutsToEnrollment(enrollment.id, enrollment.programId);
        processed++;
        console.log(`Backfilled enrollment ${enrollment.id} for program ${enrollment.programId}`);
      } catch (error) {
        console.error(`Failed to backfill enrollment ${enrollment.id}:`, error);
      }
    }

    return { processed, skipped };
  }
  
  // Regenerate enrollment snapshots with full multi-week data
  // This is needed to upgrade existing enrollments from Week 1 only to full multi-week
  async regenerateEnrollmentSnapshots(): Promise<{ processed: number; errors: number }> {
    const enrollments = await db
      .select()
      .from(userProgramEnrollments)
      .where(
        or(
          eq(userProgramEnrollments.status, 'active'),
          eq(userProgramEnrollments.status, 'scheduled')
        )
      );

    let processed = 0;
    let errors = 0;

    for (const enrollment of enrollments) {
      try {
        // Delete existing snapshot data for this enrollment
        const existingWorkouts = await db
          .select({ id: enrollmentWorkouts.id })
          .from(enrollmentWorkouts)
          .where(eq(enrollmentWorkouts.enrollmentId, enrollment.id));
        
        for (const workout of existingWorkouts) {
          // Delete blocks and exercises first (cascade)
          const blocks = await db
            .select({ id: enrollmentWorkoutBlocks.id })
            .from(enrollmentWorkoutBlocks)
            .where(eq(enrollmentWorkoutBlocks.enrollmentWorkoutId, workout.id));
          
          for (const block of blocks) {
            await db.delete(enrollmentBlockExercises)
              .where(eq(enrollmentBlockExercises.enrollmentBlockId, block.id));
          }
          
          await db.delete(enrollmentWorkoutBlocks)
            .where(eq(enrollmentWorkoutBlocks.enrollmentWorkoutId, workout.id));
        }
        
        await db.delete(enrollmentWorkouts)
          .where(eq(enrollmentWorkouts.enrollmentId, enrollment.id));
        
        // Recreate with full multi-week data
        await this.copyProgramWorkoutsToEnrollment(enrollment.id, enrollment.programId);
        processed++;
        console.log(`Regenerated enrollment ${enrollment.id} with full multi-week data`);
      } catch (error) {
        console.error(`Failed to regenerate enrollment ${enrollment.id}:`, error);
        errors++;
      }
    }

    return { processed, errors };
  }

  async scheduleProgram(userId: string, programId: number, startDate: Date, programType: 'main' | 'supplementary' = 'main', forceReplace: boolean = false): Promise<any> {
    return this.enrollUserInProgram(userId, programId, startDate, programType, forceReplace);
  }

  async calculateProgramTotalWorkouts(programId: number): Promise<number> {
    // Get the programme to know total weeks
    const [program] = await db.select().from(programs).where(eq(programs.id, programId));
    if (!program) return 0;
    
    const totalWeeks = program.weeks || 1;
    
    // Count workouts in Week 1 (the template that repeats for all weeks)
    const week1 = await db.select().from(programWeeks)
      .where(and(eq(programWeeks.programId, programId), eq(programWeeks.weekNumber, 1)))
      .limit(1);
    
    if (week1.length === 0) return 0;
    
    let week1Workouts = 0;
    const days = await db.select().from(programDays).where(eq(programDays.weekId, week1[0].id));
    for (const day of days) {
      const workouts = await db
        .select({ id: programmeWorkouts.id })
        .from(programmeWorkouts)
        .where(eq(programmeWorkouts.dayId, day.id));
      week1Workouts += workouts.length;
    }

    // Total = workouts per week × total weeks
    return week1Workouts * totalWeeks;
  }

  async updateEnrollmentProgress(enrollmentId: number, workoutsCompleted: number): Promise<any> {
    const [enrollment] = await db
      .select()
      .from(userProgramEnrollments)
      .where(eq(userProgramEnrollments.id, enrollmentId));

    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    const safeWorkoutsCompleted = Math.min(
      Math.max(workoutsCompleted, 0),
      enrollment.totalWorkouts
    );

    const updateData: any = { workoutsCompleted: safeWorkoutsCompleted };
    const justCompleted = safeWorkoutsCompleted >= enrollment.totalWorkouts && enrollment.totalWorkouts > 0 && enrollment.status !== 'completed';
    if (justCompleted) {
      updateData.status = 'completed';
    }

    const [updated] = await db
      .update(userProgramEnrollments)
      .set(updateData)
      .where(eq(userProgramEnrollments.id, enrollmentId))
      .returning();

    // Log completed event for recommendation feedback loop
    if (justCompleted) {
      try {
        await this.createRecommendationEvent({
          userId: enrollment.userId,
          programId: enrollment.programId,
          eventType: 'completed',
          source: 'automatic',
          enrollmentId,
          completionPercent: 100,
          weeksCompleted: enrollment.totalWorkouts > 0 ? Math.ceil(enrollment.totalWorkouts / 5) : 0,
        });
      } catch (recErr) {
        console.error("Error logging completion event:", recErr);
      }
    }

    return updated;
  }

  async getUserEnrolledPrograms(userId: string): Promise<any[]> {
    const enrollments = await db
      .select({
        id: userProgramEnrollments.id,
        startDate: userProgramEnrollments.startDate,
        endDate: userProgramEnrollments.endDate,
        status: userProgramEnrollments.status,
        programType: userProgramEnrollments.programType,
        workoutsCompleted: userProgramEnrollments.workoutsCompleted,
        totalWorkouts: userProgramEnrollments.totalWorkouts,
        orderIndex: userProgramEnrollments.orderIndex,
        programId: userProgramEnrollments.programId,
        program: programs,
      })
      .from(userProgramEnrollments)
      .innerJoin(programs, eq(userProgramEnrollments.programId, programs.id))
      .where(eq(userProgramEnrollments.userId, userId))
      .orderBy(desc(userProgramEnrollments.startDate));

    return enrollments;
  }

  async getEnrollmentById(enrollmentId: number): Promise<any | null> {
    const [enrollment] = await db
      .select({
        id: userProgramEnrollments.id,
        userId: userProgramEnrollments.userId,
        programId: userProgramEnrollments.programId,
        startDate: userProgramEnrollments.startDate,
        endDate: userProgramEnrollments.endDate,
        status: userProgramEnrollments.status,
        programType: userProgramEnrollments.programType,
        workoutsCompleted: userProgramEnrollments.workoutsCompleted,
        totalWorkouts: userProgramEnrollments.totalWorkouts,
      })
      .from(userProgramEnrollments)
      .where(eq(userProgramEnrollments.id, enrollmentId));
    
    return enrollment || null;
  }

  async getUserProgramTimeline(userId: string): Promise<any> {
    // Fetch ALL enrollments for the user
    const enrollments = await db
      .select({
        id: userProgramEnrollments.id,
        startDate: userProgramEnrollments.startDate,
        endDate: userProgramEnrollments.endDate,
        status: userProgramEnrollments.status,
        programType: userProgramEnrollments.programType,
        workoutsCompleted: userProgramEnrollments.workoutsCompleted,
        totalWorkouts: userProgramEnrollments.totalWorkouts,
        orderIndex: userProgramEnrollments.orderIndex,
        programId: userProgramEnrollments.programId,
        programTitle: programs.title,
        programDescription: programs.description,
        programGoal: programs.goal,
        programEquipment: programs.equipment,
        programDifficulty: programs.difficulty,
        programWeeks: programs.weeks,
        programImageUrl: programs.imageUrl,
        sourceType: programs.sourceType,
      })
      .from(userProgramEnrollments)
      .innerJoin(programs, eq(userProgramEnrollments.programId, programs.id))
      .where(eq(userProgramEnrollments.userId, userId))
      .orderBy(userProgramEnrollments.orderIndex);

    // Calculate totalWorkouts for enrollments that have 0 (legacy data)
    const enrichedEnrollments = await Promise.all(
      enrollments.map(async (enrollment) => {
        if (enrollment.totalWorkouts === 0) {
          const calculatedTotal = await this.calculateProgramTotalWorkouts(enrollment.programId);
          return { ...enrollment, totalWorkouts: calculatedTotal };
        }
        return enrollment;
      })
    );
    
    // Separate main and supplementary programs
    const mainEnrollments = enrichedEnrollments.filter(e => e.programType === 'main');
    const supplementaryEnrollments = enrichedEnrollments.filter(e => e.programType === 'supplementary');
    
    // Auto-expire enrollments whose end date has passed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const enrollment of enrichedEnrollments) {
      if (enrollment.status === 'active' && enrollment.endDate) {
        const endDate = new Date(enrollment.endDate);
        endDate.setHours(0, 0, 0, 0);
        if (today > endDate) {
          await db.update(userProgramEnrollments)
            .set({ status: 'completed' })
            .where(eq(userProgramEnrollments.id, enrollment.id));
          enrollment.status = 'completed';
        }
      }
    }

    // Find the currently ACTIVE main programme - must be status='active'
    const current = mainEnrollments.find(e => e.status === 'active') || null;
    
    const activeSupplementary = supplementaryEnrollments.filter(e => e.status === 'active');
    
    // Separate active recovery plans from regular supplementary for dashboard tile
    const activeRecoveryPlans = activeSupplementary.filter(e => e.sourceType === 'recovery');
    
    return {
      current,
      scheduled: mainEnrollments.filter(e => e.status === 'scheduled'),
      completed: mainEnrollments.filter(e => e.status === 'completed'),
      currentSupplementary: activeSupplementary,
      scheduledSupplementary: supplementaryEnrollments.filter(e => e.status === 'scheduled'),
      completedSupplementary: supplementaryEnrollments.filter(e => e.status === 'completed'),
      activeRecoveryPlans,
    };
  }

  async getEnrolledProgramDetails(userId: string, enrollmentId: number): Promise<any> {
    try {
      // Get enrollment with program details
      const [enrollment] = await db
        .select({
          id: userProgramEnrollments.id,
          startDate: userProgramEnrollments.startDate,
          status: userProgramEnrollments.status,
          program: programs,
        })
        .from(userProgramEnrollments)
        .innerJoin(programs, eq(userProgramEnrollments.programId, programs.id))
        .where(
          and(
            eq(userProgramEnrollments.id, enrollmentId),
            eq(userProgramEnrollments.userId, userId)
          )
        );

      if (!enrollment) {
        throw new Error('Enrollment not found');
      }

      // Check if this enrollment has data in enrollment-specific tables
      const enrolledWorkoutsExist = await db
        .select({ id: enrollmentWorkouts.id })
        .from(enrollmentWorkouts)
        .where(eq(enrollmentWorkouts.enrollmentId, enrollmentId))
        .limit(1);

      // If enrollment-specific data exists, use it (new behavior)
      if (enrolledWorkoutsExist.length > 0) {
        return this.getEnrolledProgramDetailsFromSnapshot(enrollment, enrollmentId);
      }

      // Fallback to template data for legacy enrollments (before snapshot feature)
      return this.getEnrolledProgramDetailsFromTemplate(enrollment);
    } catch (error) {
      console.error('Error getting enrolled program details:', error);
      throw error;
    }
  }

  // Read enrolled program details from enrollment-specific snapshot tables
  private async getEnrolledProgramDetailsFromSnapshot(enrollment: any, enrollmentId: number): Promise<any> {
    // Get active substitutions for this enrollment
    const substitutions = await this.getActiveSubstitutionMappings(enrollmentId);
    
    // Get all enrollment workouts for this enrollment, joined with template for imageUrl
    const enrolledWorkoutsList = await db
      .select({
        id: enrollmentWorkouts.id,
        enrollmentId: enrollmentWorkouts.enrollmentId,
        templateWorkoutId: enrollmentWorkouts.templateWorkoutId,
        weekNumber: enrollmentWorkouts.weekNumber,
        dayNumber: enrollmentWorkouts.dayNumber,
        scheduledDateOverride: enrollmentWorkouts.scheduledDateOverride,
        name: enrollmentWorkouts.name,
        description: enrollmentWorkouts.description,
        workoutType: enrollmentWorkouts.workoutType,
        category: enrollmentWorkouts.category,
        difficulty: enrollmentWorkouts.difficulty,
        duration: enrollmentWorkouts.duration,
        intervalRounds: enrollmentWorkouts.intervalRounds,
        intervalRestAfterRound: enrollmentWorkouts.intervalRestAfterRound,
        position: enrollmentWorkouts.position,
        imageUrl: programmeWorkouts.imageUrl,
      })
      .from(enrollmentWorkouts)
      .leftJoin(programmeWorkouts, eq(enrollmentWorkouts.templateWorkoutId, programmeWorkouts.id))
      .where(eq(enrollmentWorkouts.enrollmentId, enrollmentId))
      .orderBy(enrollmentWorkouts.weekNumber, enrollmentWorkouts.dayNumber, enrollmentWorkouts.position);

    const workouts: any[] = [];

    for (const ew of enrolledWorkoutsList) {
      // Get blocks for this enrollment workout
      let blocks = await this.getEnrollmentWorkoutBlocks(ew.id);
      
      // Apply substitutions to blocks
      if (substitutions.size > 0) {
        blocks = blocks.map(block => ({
          ...block,
          exercises: (block.exercises || []).map((exercise: any) => {
            // Check by templateExerciseId (the original programme_block_exercise id)
            const exerciseKey = exercise.templateExerciseId || exercise.id;
            const sub = substitutions.get(exerciseKey);
            if (sub) {
              return {
                ...exercise,
                exerciseLibraryId: sub.substitutedExerciseId,
                exerciseName: sub.exerciseName,
                name: sub.exerciseName,
                imageUrl: sub.imageUrl,
                muxPlaybackId: sub.muxPlaybackId,
                isSubstituted: true,
                originalExerciseId: exercise.exerciseLibraryId,
              };
            }
            return exercise;
          }),
        }));
      }
      
      // Flatten exercises from blocks for backward compatibility
      let exercises: any[] = [];
      for (const block of blocks) {
        for (const ex of block.exercises || []) {
          exercises.push({
            ...ex,
            name: ex.exerciseName || ex.name,
            blockId: block.id,
            section: block.section,
            blockType: block.blockType,
            blockPosition: block.position,
            blockRest: block.rest,
            blockRounds: block.rounds,
            blockRestAfterRound: block.restAfterRound,
          });
        }
      }
      
      const mainExerciseCount = exercises.filter((e: any) => e.section === 'main').length;
      const mainExercises = exercises.filter((e: any) => e.section === 'main');
      let derivedImageUrl = ew.imageUrl;
      if (!derivedImageUrl && mainExercises.length > 0) {
        const firstMain = mainExercises[0];
        derivedImageUrl = firstMain.imageUrl || (firstMain.muxPlaybackId ? `https://image.mux.com/${firstMain.muxPlaybackId}/thumbnail.jpg?width=128` : null);
      }
      const workoutObj: any = {
        week: ew.weekNumber,
        day: ew.dayNumber,
        name: ew.name,
        description: ew.description,
        workoutType: ew.workoutType,
        category: ew.category,
        difficulty: ew.difficulty,
        duration: ew.duration,
        intervalRounds: ew.intervalRounds,
        intervalRestAfterRound: ew.intervalRestAfterRound,
        imageUrl: derivedImageUrl,
        enrollmentWorkoutId: ew.id,
        templateWorkoutId: ew.templateWorkoutId,
        exercises,
        blocks: blocks.length > 0 ? blocks : undefined,
        exerciseCount: mainExerciseCount || exercises.length,
        estimatedDuration: Math.round(exercises.length * 1.75),
      };
      workouts.push(workoutObj);
    }

    return {
      ...enrollment,
      workouts,
    };
  }

  // Read enrolled program details from template tables (legacy fallback)
  private async getEnrolledProgramDetailsFromTemplate(enrollment: any): Promise<any> {
    const programId = enrollment.program.id;
    const weeks = await db.select().from(programWeeks).where(eq(programWeeks.programId, programId));
    
    const workouts: any[] = [];
    
    for (const week of weeks) {
      const days = await db.select().from(programDays).where(eq(programDays.weekId, week.id));
      
      for (const day of days) {
        const dayWorkouts = await db
          .select()
          .from(programmeWorkouts)
          .where(eq(programmeWorkouts.dayId, day.id));
        
        for (const workout of dayWorkouts) {
          // Fetch blocks - now uses ONLY block-based tables with template sharing
          const blocks = await this.getProgrammeWorkoutBlocks(workout.id);
          
          // Flatten exercises from blocks for backward compatibility
          let exercises: any[] = [];
          for (const block of blocks) {
            for (const ex of block.exercises || []) {
              exercises.push({
                ...ex,
                name: ex.exerciseName || ex.name,
                blockId: block.id,
                section: block.section,
                blockType: block.blockType,
                blockPosition: block.position,
                blockRest: block.rest,
                blockRounds: block.rounds,
                blockRestAfterRound: block.restAfterRound,
              });
            }
          }
          
          workouts.push({
            week: week.weekNumber,
            day: day.position,
            name: workout.name,
            description: workout.description,
            workoutType: workout.workoutType,
            category: workout.category,
            difficulty: workout.difficulty,
            duration: workout.duration,
            imageUrl: workout.imageUrl, // Cover image
            exercises,
            blocks: blocks.length > 0 ? blocks : undefined,
          });
        }
      }
    }

    return {
      ...enrollment,
      workouts,
    };
  }

  // Get blocks and exercises for an enrollment workout (from snapshot tables)
  async getEnrollmentWorkoutBlocks(enrollmentWorkoutId: number): Promise<any[]> {
    const blocks = await db
      .select()
      .from(enrollmentWorkoutBlocks)
      .where(eq(enrollmentWorkoutBlocks.enrollmentWorkoutId, enrollmentWorkoutId))
      .orderBy(enrollmentWorkoutBlocks.position);

    const blocksWithExercises = await Promise.all(
      blocks.map(async (block) => {
        const exercises = await db
          .select({
            id: enrollmentBlockExercises.id,
            enrollmentBlockId: enrollmentBlockExercises.enrollmentBlockId,
            templateExerciseId: enrollmentBlockExercises.templateExerciseId,
            exerciseLibraryId: enrollmentBlockExercises.exerciseLibraryId,
            position: enrollmentBlockExercises.position,
            sets: enrollmentBlockExercises.sets,
            durationType: enrollmentBlockExercises.durationType,
            tempo: enrollmentBlockExercises.tempo,
            load: enrollmentBlockExercises.load,
            notes: enrollmentBlockExercises.notes,
            exerciseName: exerciseLibrary.name,
            exerciseLevel: exerciseLibrary.level,
            exerciseMuscle: exerciseLibrary.mainMuscle,
            exerciseEquipment: exerciseLibrary.equipment,
            muxPlaybackId: exerciseLibrary.muxPlaybackId,
            imageUrl: exerciseLibrary.imageUrl,
          })
          .from(enrollmentBlockExercises)
          .leftJoin(exerciseLibrary, eq(enrollmentBlockExercises.exerciseLibraryId, exerciseLibrary.id))
          .where(eq(enrollmentBlockExercises.enrollmentBlockId, block.id))
          .orderBy(enrollmentBlockExercises.position);

        return {
          ...block,
          exercises,
        };
      })
    );

    return blocksWithExercises;
  }

  async getEnrollmentWorkoutsForUser(enrollmentId: number): Promise<any[]> {
    // Get unique workouts from Week 1 of the enrollment (use as template for schedule)
    const workouts = await db
      .select({
        id: enrollmentWorkouts.id,
        enrollmentId: enrollmentWorkouts.enrollmentId,
        templateWorkoutId: enrollmentWorkouts.templateWorkoutId,
        weekNumber: enrollmentWorkouts.weekNumber,
        dayNumber: enrollmentWorkouts.dayNumber,
        name: enrollmentWorkouts.name,
        description: enrollmentWorkouts.description,
        workoutType: enrollmentWorkouts.workoutType,
        category: enrollmentWorkouts.category,
        difficulty: enrollmentWorkouts.difficulty,
        duration: enrollmentWorkouts.duration,
      })
      .from(enrollmentWorkouts)
      .where(and(eq(enrollmentWorkouts.enrollmentId, enrollmentId), eq(enrollmentWorkouts.weekNumber, 1)))
      .orderBy(enrollmentWorkouts.dayNumber, enrollmentWorkouts.position);
    
    return workouts;
  }

  async addExerciseToEnrollmentWorkouts(
    enrollmentId: number,
    templateWorkoutId: number,
    exerciseLibraryId: number,
    config: { sets: any; durationType?: string; tempo?: string; load?: string; notes?: string; section?: string },
    applyScope: 'next' | 'all_future',
    currentWeekNumber: number,
    currentDayNumber?: number
  ): Promise<{ added: number }> {
    let targetWorkouts;

    const enrollment = await db
      .select({ startDate: userProgramEnrollments.startDate })
      .from(userProgramEnrollments)
      .where(eq(userProgramEnrollments.id, enrollmentId))
      .limit(1);

    let computedWeek = currentWeekNumber;
    let computedDay = currentDayNumber || 1;

    if (enrollment.length > 0 && enrollment[0].startDate) {
      const start = new Date(enrollment[0].startDate);
      const now = new Date();
      start.setHours(0, 0, 0, 0);
      now.setHours(0, 0, 0, 0);
      const diffMs = now.getTime() - start.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      computedWeek = Math.max(1, Math.floor(diffDays / 7) + 1);
      computedDay = (diffDays % 7) + 1;
    }

    const allCandidates = await db
      .select()
      .from(enrollmentWorkouts)
      .where(
        and(
          eq(enrollmentWorkouts.enrollmentId, enrollmentId),
          eq(enrollmentWorkouts.templateWorkoutId, templateWorkoutId),
          gte(enrollmentWorkouts.weekNumber, computedWeek)
        )
      )
      .orderBy(enrollmentWorkouts.weekNumber, enrollmentWorkouts.dayNumber);

    const futureWorkouts = allCandidates.filter(w =>
      w.weekNumber > computedWeek ||
      (w.weekNumber === computedWeek && w.dayNumber > computedDay)
    );

    if (applyScope === 'next') {
      targetWorkouts = futureWorkouts.length > 0 ? [futureWorkouts[0]] : [];
    } else {
      targetWorkouts = futureWorkouts;
    }

    if (targetWorkouts.length === 0) {
      return { added: 0 };
    }

    let addedCount = 0;
    const section = config.section || 'main';

    for (const workout of targetWorkouts) {
      const existingBlocks = await db
        .select({ position: enrollmentWorkoutBlocks.position })
        .from(enrollmentWorkoutBlocks)
        .where(
          and(
            eq(enrollmentWorkoutBlocks.enrollmentWorkoutId, workout.id),
            eq(enrollmentWorkoutBlocks.section, section)
          )
        )
        .orderBy(desc(enrollmentWorkoutBlocks.position))
        .limit(1);

      const nextPosition = existingBlocks.length > 0 ? existingBlocks[0].position + 1 : 0;

      const [newBlock] = await db.insert(enrollmentWorkoutBlocks).values({
        enrollmentWorkoutId: workout.id,
        templateBlockId: null,
        section,
        blockType: 'single',
        position: nextPosition,
        rest: null,
        rounds: null,
        restAfterRound: null,
      }).returning();

      await db.insert(enrollmentBlockExercises).values({
        enrollmentBlockId: newBlock.id,
        templateExerciseId: null,
        exerciseLibraryId,
        position: 0,
        sets: config.sets,
        durationType: config.durationType || null,
        tempo: config.tempo || null,
        load: config.load || null,
        notes: config.notes || null,
      });

      addedCount++;
    }

    return { added: addedCount };
  }

  async removeSupplementaryProgram(userId: string, enrollmentId?: number): Promise<void> {
    if (enrollmentId) {
      // Delete specific supplementary program enrollment
      await db
        .delete(userProgramEnrollments)
        .where(
          and(
            eq(userProgramEnrollments.id, enrollmentId),
            eq(userProgramEnrollments.userId, userId),
            eq(userProgramEnrollments.programType, 'supplementary')
          )
        );
    } else {
      // Delete all active or scheduled supplementary programs (legacy behavior)
      await db
        .delete(userProgramEnrollments)
        .where(
          and(
            eq(userProgramEnrollments.userId, userId),
            eq(userProgramEnrollments.programType, 'supplementary'),
            or(
              eq(userProgramEnrollments.status, 'active'),
              eq(userProgramEnrollments.status, 'scheduled')
            )
          )
        );
    }
  }

  async unenrollFromProgram(userId: string, enrollmentId: number): Promise<void> {
    await db
      .delete(userProgramEnrollments)
      .where(
        and(
          eq(userProgramEnrollments.id, enrollmentId),
          eq(userProgramEnrollments.userId, userId)
        )
      );
  }

  async rescheduleEnrollment(userId: string, enrollmentId: number, newStartDate: Date): Promise<any> {
    const [enrollment] = await db
      .select()
      .from(userProgramEnrollments)
      .where(and(eq(userProgramEnrollments.id, enrollmentId), eq(userProgramEnrollments.userId, userId)));

    if (!enrollment) throw new Error("Enrollment not found");

    const oldStart = new Date(enrollment.startDate);
    const deltaDays = Math.round((newStartDate.getTime() - oldStart.getTime()) / (1000 * 60 * 60 * 24));

    const [program] = await db.select().from(programs).where(eq(programs.id, enrollment.programId));
    const weeks = program?.weeks || 8;
    const newEndDate = new Date(newStartDate);
    newEndDate.setDate(newEndDate.getDate() + (weeks * 7 - 1));

    const now = new Date();
    const newStatus = newStartDate > now ? 'scheduled' : 'active';

    await db
      .update(userProgramEnrollments)
      .set({ startDate: newStartDate, endDate: newEndDate, status: newStatus })
      .where(eq(userProgramEnrollments.id, enrollmentId));

    if (deltaDays !== 0) {
      const overrideWorkouts = await db
        .select()
        .from(enrollmentWorkouts)
        .where(
          and(
            eq(enrollmentWorkouts.enrollmentId, enrollmentId),
            isNotNull(enrollmentWorkouts.scheduledDateOverride)
          )
        );

      for (const w of overrideWorkouts) {
        if (w.scheduledDateOverride) {
          const shifted = new Date(w.scheduledDateOverride);
          shifted.setDate(shifted.getDate() + deltaDays);
          await db
            .update(enrollmentWorkouts)
            .set({ scheduledDateOverride: shifted })
            .where(eq(enrollmentWorkouts.id, w.id));
        }
      }
    }

    return { id: enrollmentId, startDate: newStartDate, endDate: newEndDate, status: newStatus };
  }

  async getTodayWorkout(userId: string, date?: Date): Promise<any> {
    // Get user's active main program enrollment
    const [activeEnrollment] = await db
      .select()
      .from(userProgramEnrollments)
      .where(
        and(
          eq(userProgramEnrollments.userId, userId),
          eq(userProgramEnrollments.status, 'active'),
          eq(userProgramEnrollments.programType, 'main')
        )
      );

    if (!activeEnrollment) {
      console.log(`getTodayWorkout: No active enrollment for user ${userId}`);
      return null;
    }

    // Use provided date or default to today
    const targetDate = date || new Date();
    const startDate = new Date(activeEnrollment.startDate);
    
    // If the programme has ended, don't show any workout
    if (activeEnrollment.endDate) {
      const endDateOnly = new Date(new Date(activeEnrollment.endDate).getFullYear(), new Date(activeEnrollment.endDate).getMonth(), new Date(activeEnrollment.endDate).getDate());
      const targetDateOnly0 = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      if (targetDateOnly0 > endDateOnly) {
        console.log(`getTodayWorkout: Programme ${activeEnrollment.programId} ended on ${activeEnrollment.endDate}, no workout for ${targetDate.toDateString()}`);
        return null;
      }
    }

    // Calculate days elapsed using date values to avoid timezone issues
    const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const daysElapsed = Math.floor((targetDateOnly.getTime() - startDateOnly.getTime()) / (1000 * 60 * 60 * 24));
    const currentWeek = Math.max(1, Math.floor(daysElapsed / 7) + 1);
    
    // Calculate day within the 7-day programme cycle (Day 1-7), not calendar day of week
    // This ensures workouts are sequential regardless of which day of the week the programme started
    const dayOfCycle = (daysElapsed % 7) + 1;

    console.log(`getTodayWorkout: userId=${userId}, programId=${activeEnrollment.programId}, week=${currentWeek}, day=${dayOfCycle} (daysElapsed=${daysElapsed})`);

    // Check if this enrollment has snapshot data (new behavior)
    // First check if ANY enrollment workout data exists for this enrollment
    const hasSnapshotData = await db
      .select({ id: enrollmentWorkouts.id })
      .from(enrollmentWorkouts)
      .where(eq(enrollmentWorkouts.enrollmentId, activeEnrollment.id))
      .limit(1);

    if (hasSnapshotData.length > 0) {
      // Enrollment has snapshot data - look for today's workout
      // Format target date for comparison with scheduledDateOverride
      const targetDateStr = `${targetDateOnly.getFullYear()}-${String(targetDateOnly.getMonth() + 1).padStart(2, '0')}-${String(targetDateOnly.getDate()).padStart(2, '0')}`;
      
      // First, check if any workout has been moved TO this date via scheduledDateOverride
      const movedWorkoutsToThisDate = await db
        .select()
        .from(enrollmentWorkouts)
        .where(
          and(
            eq(enrollmentWorkouts.enrollmentId, activeEnrollment.id),
            isNotNull(enrollmentWorkouts.scheduledDateOverride),
            sql`DATE(${enrollmentWorkouts.scheduledDateOverride}) = ${targetDateStr}`
          )
        );
      
      if (movedWorkoutsToThisDate.length > 0) {
        // A workout was moved to this date - return that workout
        console.log(`getTodayWorkout (snapshot): Found workout moved to ${targetDateStr}: "${movedWorkoutsToThisDate[0].name}"`);
        return this.getTodayWorkoutFromSnapshot(activeEnrollment, movedWorkoutsToThisDate[0], currentWeek, dayOfCycle, daysElapsed);
      }
      
      // Check if a workout EXISTS for this week/day (including moved workouts)
      const anyWorkoutForThisWeekDay = await db
        .select()
        .from(enrollmentWorkouts)
        .where(
          and(
            eq(enrollmentWorkouts.enrollmentId, activeEnrollment.id),
            eq(enrollmentWorkouts.weekNumber, currentWeek),
            eq(enrollmentWorkouts.dayNumber, dayOfCycle)
          )
        )
        .limit(1);
      
      // If a workout exists for this week/day but has been moved away, treat as rest day for original date
      if (anyWorkoutForThisWeekDay.length > 0) {
        const workout = anyWorkoutForThisWeekDay[0];
        if (workout.scheduledDateOverride) {
          // This workout has been moved to a different date - original slot is now "empty"
          console.log(`getTodayWorkout (snapshot): Workout "${workout.name}" was moved away from week ${currentWeek}, day ${dayOfCycle}`);
          return {
            enrollmentId: activeEnrollment.id,
            programId: activeEnrollment.programId,
            week: currentWeek,
            day: dayOfCycle,
            isRestDay: true,
            workoutName: 'Rest Day',
            exercises: [],
          };
        }
        // Workout exists and hasn't been moved - return it
        return this.getTodayWorkoutFromSnapshot(activeEnrollment, workout, currentWeek, dayOfCycle, daysElapsed);
      }
      
      // No workout found for this specific week/day - check if this is a legacy enrollment with only week 1 data
      if (currentWeek > 1) {
        // Only fall back to week 1 if no workout exists AT ALL for this week (legacy enrollment scenario)
        const anyWorkoutForCurrentWeek = await db
          .select({ id: enrollmentWorkouts.id })
          .from(enrollmentWorkouts)
          .where(
            and(
              eq(enrollmentWorkouts.enrollmentId, activeEnrollment.id),
              eq(enrollmentWorkouts.weekNumber, currentWeek)
            )
          )
          .limit(1);
        
        // If no data for this week at all, it's a legacy enrollment - use week 1 pattern
        if (anyWorkoutForCurrentWeek.length === 0) {
          const week1Workout = await db
            .select()
            .from(enrollmentWorkouts)
            .where(
              and(
                eq(enrollmentWorkouts.enrollmentId, activeEnrollment.id),
                eq(enrollmentWorkouts.weekNumber, 1),
                eq(enrollmentWorkouts.dayNumber, dayOfCycle),
                isNull(enrollmentWorkouts.scheduledDateOverride)
              )
            )
            .limit(1);
          
          if (week1Workout.length > 0) {
            console.log(`getTodayWorkout (snapshot): Using week 1 template for week ${currentWeek}, day ${dayOfCycle}`);
            return this.getTodayWorkoutFromSnapshot(activeEnrollment, week1Workout[0], currentWeek, dayOfCycle, daysElapsed);
          }
        }
      }

      // No workout for this day = rest day
      console.log(`getTodayWorkout (snapshot): No workout scheduled for week ${currentWeek}, day ${dayOfCycle} (rest day)`);
      return {
        enrollmentId: activeEnrollment.id,
        programId: activeEnrollment.programId,
        week: currentWeek,
        day: dayOfCycle,
        isRestDay: true,
        workoutName: 'Rest Day',
        exercises: [],
      };
    }

    // Fallback to template data for legacy enrollments
    return this.getTodayWorkoutFromTemplate(activeEnrollment, currentWeek, dayOfCycle, daysElapsed);
  }

  // Get ALL workouts for a specific date (handles multiple workouts on same date)
  async getAllWorkoutsForDate(userId: string, date: Date): Promise<any[]> {
    const results: any[] = [];

    const targetDate = new Date(date);
    const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const targetDateStr = `${targetDateOnly.getFullYear()}-${String(targetDateOnly.getMonth() + 1).padStart(2, '0')}-${String(targetDateOnly.getDate()).padStart(2, '0')}`;

    // Get all active AND scheduled main enrollments
    const allEnrollments = await db
      .select()
      .from(userProgramEnrollments)
      .where(
        and(
          eq(userProgramEnrollments.userId, userId),
          inArray(userProgramEnrollments.status, ['active', 'scheduled']),
          eq(userProgramEnrollments.programType, 'main')
        )
      );

    console.log(`getAllWorkoutsForDate: userId=${userId}, date=${date}, enrollments=${allEnrollments.map(e => e.id).join(',')}`);
    if (allEnrollments.length === 0) return results;

    for (const enrollment of allEnrollments) {
      if (!enrollment.startDate) continue;

      const startDate = new Date(enrollment.startDate);
      const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

      // Skip if target date is before the enrollment starts
      if (targetDateOnly < startDateOnly) continue;

      // Skip if the programme has ended
      if (enrollment.endDate) {
        const endDate = new Date(enrollment.endDate);
        const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        if (targetDateOnly > endDateOnly) {
          console.log(`getAllWorkoutsForDate: Enrollment ${enrollment.id} ended on ${enrollment.endDate}, skipping`);
          continue;
        }
      }

      const daysElapsed = Math.floor((targetDateOnly.getTime() - startDateOnly.getTime()) / (1000 * 60 * 60 * 24));
      const currentWeek = Math.max(1, Math.floor(daysElapsed / 7) + 1);
      const dayOfCycle = (daysElapsed % 7) + 1;

      console.log(`getAllWorkoutsForDate: enrollment=${enrollment.id}, week=${currentWeek}, day=${dayOfCycle}, targetDateStr=${targetDateStr}`);

      // Get program info
      const program = await this.getProgramById(enrollment.programId);

      // 1. Workouts moved TO this date via scheduledDateOverride
      const movedWorkouts = await db
        .select()
        .from(enrollmentWorkouts)
        .where(
          and(
            eq(enrollmentWorkouts.enrollmentId, enrollment.id),
            isNotNull(enrollmentWorkouts.scheduledDateOverride),
            sql`DATE(${enrollmentWorkouts.scheduledDateOverride}) = ${targetDateStr}`
          )
        );

      // 2. Original workout for this week/day (if not moved away)
      const originalWorkout = await db
        .select()
        .from(enrollmentWorkouts)
        .where(
          and(
            eq(enrollmentWorkouts.enrollmentId, enrollment.id),
            eq(enrollmentWorkouts.weekNumber, currentWeek),
            eq(enrollmentWorkouts.dayNumber, dayOfCycle),
            isNull(enrollmentWorkouts.scheduledDateOverride)
          )
        )
        .limit(1);

      const allWorkouts = [...movedWorkouts];
      if (originalWorkout.length > 0) allWorkouts.push(originalWorkout[0]);

      console.log(`getAllWorkoutsForDate: enrollment=${enrollment.id} workouts found=${allWorkouts.length}, name=${allWorkouts[0]?.name}`);

      // Build result for each workout
      for (const workout of allWorkouts) {
        const blocks = await this.getEnrollmentWorkoutBlocks(workout.id);
        const exercises: any[] = [];
        for (const block of blocks) {
          for (const ex of block.exercises || []) {
            exercises.push({
              ...ex,
              name: ex.exerciseName || ex.name,
              blockId: block.id,
              section: block.section,
              blockType: block.blockType,
            });
          }
        }

        results.push({
          enrollmentId: enrollment.id,
          programId: enrollment.programId,
          programName: program?.title,
          workoutName: workout.name,
          workoutType: workout.workoutType || 'regular',
          category: workout.category || 'strength',
          week: workout.weekNumber,
          day: workout.dayNumber,
          isRestDay: false,
          isProgramme: true,
          exercises,
          enrollmentWorkoutId: workout.id,
        });
      }

      // Legacy fallback: only for active enrollments where week data is missing (single-week imports)
      if (results.length === 0 && enrollment.status === 'active') {
        const anyWorkoutForCurrentWeek = await db
          .select({ id: enrollmentWorkouts.id })
          .from(enrollmentWorkouts)
          .where(
            and(
              eq(enrollmentWorkouts.enrollmentId, enrollment.id),
              eq(enrollmentWorkouts.weekNumber, currentWeek)
            )
          )
          .limit(1);

        if (anyWorkoutForCurrentWeek.length === 0 && currentWeek > 1) {
          const week1Workout = await db
            .select()
            .from(enrollmentWorkouts)
            .where(
              and(
                eq(enrollmentWorkouts.enrollmentId, enrollment.id),
                eq(enrollmentWorkouts.weekNumber, 1),
                eq(enrollmentWorkouts.dayNumber, dayOfCycle),
                isNull(enrollmentWorkouts.scheduledDateOverride)
              )
            )
            .limit(1);

          if (week1Workout.length > 0) {
            const blocks = await this.getEnrollmentWorkoutBlocks(week1Workout[0].id);
            const exercises: any[] = [];
            for (const block of blocks) {
              for (const ex of block.exercises || []) {
                exercises.push({ ...ex, name: ex.exerciseName || ex.name, blockId: block.id });
              }
            }
            results.push({
              enrollmentId: enrollment.id,
              programId: enrollment.programId,
              programName: program?.title,
              workoutName: week1Workout[0].name,
              workoutType: week1Workout[0].workoutType || 'regular',
              category: week1Workout[0].category || 'strength',
              week: currentWeek,
              day: dayOfCycle,
              isRestDay: false,
              isProgramme: true,
              exercises,
              enrollmentWorkoutId: week1Workout[0].id,
            });
          }
        }
      }
    }

    console.log(`getAllWorkoutsForDate: total workouts=${results.length}`);
    return results;
  }

  // Get today's workout from enrollment snapshot tables
  private async getTodayWorkoutFromSnapshot(activeEnrollment: any, enrolledWorkout: any, currentWeek: number, dayOfCycle: number, daysElapsed: number): Promise<any> {
    const program = await this.getProgramById(activeEnrollment.programId);
    
    // Get blocks and exercises for this enrollment workout
    const blocks = await this.getEnrollmentWorkoutBlocks(enrolledWorkout.id);
    
    // Flatten exercises from blocks
    const exercises: any[] = [];
    for (const block of blocks) {
      for (const ex of block.exercises || []) {
        exercises.push({
          ...ex,
          name: ex.exerciseName || ex.name,
          blockId: block.id,
          section: block.section,
          blockType: block.blockType,
          blockPosition: block.position,
          blockRest: block.rest,
          blockRounds: block.rounds,
          blockRestAfterRound: block.restAfterRound,
        });
      }
    }

    console.log(`getTodayWorkout (snapshot): Found ${exercises.length} exercises for workout "${enrolledWorkout.name}"`);

    const result = {
      enrollmentId: activeEnrollment.id,
      programId: activeEnrollment.programId,
      programName: program?.title,
      workoutName: enrolledWorkout.name,
      week: currentWeek,
      day: dayOfCycle,
      isRestDay: false,
      exercises,
      daysElapsed,
      enrollmentWorkoutId: enrolledWorkout.id,
    };
    
    console.log(`getTodayWorkout (snapshot): Returning workout "${enrolledWorkout.name}" with ${exercises.length} exercises for ${program?.title}`);
    return result;
  }

  // Get today's workout from template tables (legacy fallback)
  private async getTodayWorkoutFromTemplate(activeEnrollment: any, currentWeek: number, dayOfCycle: number, daysElapsed: number): Promise<any> {
    // Query hierarchical structure: program → week → day → workout → exercises
    const programWeek = await db
      .select()
      .from(programWeeks)
      .where(
        and(
          eq(programWeeks.programId, activeEnrollment.programId),
          eq(programWeeks.weekNumber, currentWeek)
        )
      )
      .limit(1);

    if (!programWeek || programWeek.length === 0) {
      console.log(`getTodayWorkout: Week ${currentWeek} not found`);
      return null;
    }

    // Get the day within this week
    const day = await db
      .select()
      .from(programDays)
      .where(
        and(
          eq(programDays.weekId, programWeek[0].id),
          eq(programDays.position, dayOfCycle)
        )
      )
      .limit(1);

    if (!day || day.length === 0) {
      console.log(`getTodayWorkout: Day ${dayOfCycle} not found in week ${currentWeek}`);
      return null; // This day doesn't exist (shouldn't happen)
    }

    // Get workouts scheduled for this day
    const workouts = await db
      .select()
      .from(programmeWorkouts)
      .where(eq(programmeWorkouts.dayId, day[0].id));

    if (workouts.length === 0) {
      console.log(`getTodayWorkout: No workout scheduled for week ${currentWeek}, day ${dayOfCycle} (rest day)`);
      return {
        enrollmentId: activeEnrollment.id,
        programId: activeEnrollment.programId,
        week: currentWeek,
        day: dayOfCycle,
        isRestDay: true,
        workoutName: 'Rest Day',
        exercises: [],
      };
    }

    // Get exercises for this workout (now using block-based structure)
    const workout = workouts[0];
    const exercises = await this.getWorkoutExercises(workout.id);

    console.log(`getTodayWorkout: Found ${exercises.length} exercises for workout "${workout.name}"`);

    const program = await this.getProgramById(activeEnrollment.programId);

    const result = {
      enrollmentId: activeEnrollment.id,
      programId: activeEnrollment.programId,
      programName: program?.title,
      workoutName: workout.name,
      week: currentWeek,
      day: dayOfCycle,
      isRestDay: false,
      exercises: exercises.map(ex => ({
        ...ex,
        name: ex.exerciseName || ex.name,
      })),
      daysElapsed,
    };
    
    console.log(`getTodayWorkout: Returning workout "${workout.name}" with ${exercises.length} exercises for ${program?.title}`);
    return result;
  }

  // Video operations
  async getVideos(category?: string): Promise<Video[]> {
    if (category && category !== 'All') {
      return await db.select().from(videos)
        .where(eq(videos.category, category.toLowerCase()))
        .orderBy(desc(videos.createdAt));
    }
    
    return await db.select().from(videos).orderBy(desc(videos.createdAt));
  }

  async getVideoById(id: number): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video;
  }

  async searchVideos(query: string): Promise<Video[]> {
    return await db
      .select()
      .from(videos)
      .where(
        or(
          ilike(videos.title, `%${query}%`),
          ilike(videos.description, `%${query}%`)
        )
      );
  }

  async createVideo(video: InsertVideo): Promise<Video> {
    const [newVideo] = await db.insert(videos).values(video).returning();
    return newVideo;
  }

  async updateVideo(id: number, video: Partial<InsertVideo>): Promise<Video> {
    const [updatedVideo] = await db
      .update(videos)
      .set(video)
      .where(eq(videos.id, id))
      .returning();
    return updatedVideo;
  }

  async deleteVideo(id: number): Promise<void> {
    await db.delete(videos).where(eq(videos.id, id));
  }

  // Recipe operations
  async getRecipes(category?: string): Promise<Recipe[]> {
    if (category) {
      return await db.select().from(recipes)
        .where(eq(recipes.category, category))
        .orderBy(desc(recipes.createdAt));
    }
    
    return await db.select().from(recipes).orderBy(desc(recipes.createdAt));
  }

  async getRecipeById(id: number): Promise<Recipe | undefined> {
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id));
    return recipe;
  }

  async searchRecipes(query: string): Promise<Recipe[]> {
    return await db
      .select()
      .from(recipes)
      .where(
        or(
          ilike(recipes.title, `%${query}%`),
          ilike(recipes.description, `%${query}%`)
        )
      );
  }

  async createRecipe(recipe: InsertRecipe): Promise<Recipe> {
    const [newRecipe] = await db.insert(recipes).values(recipe).returning();
    return newRecipe;
  }

  async updateRecipe(id: number, recipe: Partial<InsertRecipe>): Promise<Recipe> {
    const [updatedRecipe] = await db
      .update(recipes)
      .set(recipe)
      .where(eq(recipes.id, id))
      .returning();
    return updatedRecipe;
  }

  async deleteRecipe(id: number): Promise<void> {
    await db.delete(recipes).where(eq(recipes.id, id));
  }

  // User progress operations
  async getUserProgress(userId: string, limit = 30): Promise<UserProgress[]> {
    return await db
      .select()
      .from(userProgress)
      .where(eq(userProgress.userId, userId))
      .orderBy(desc(userProgress.date))
      .limit(limit);
  }

  async createUserProgress(progress: InsertUserProgress): Promise<UserProgress> {
    const [newProgress] = await db.insert(userProgress).values(progress).returning();
    return newProgress;
  }

  async getLatestUserProgress(userId: string): Promise<UserProgress | undefined> {
    const [progress] = await db
      .select()
      .from(userProgress)
      .where(eq(userProgress.userId, userId))
      .orderBy(desc(userProgress.date))
      .limit(1);
    return progress;
  }

  // Check-in operations
  async getUserCheckIns(userId: string, limit = 30): Promise<CheckIn[]> {
    return await db
      .select()
      .from(checkIns)
      .where(eq(checkIns.userId, userId))
      .orderBy(desc(checkIns.checkInDate))
      .limit(limit);
  }

  async createCheckIn(checkIn: InsertCheckIn): Promise<CheckIn> {
    const [newCheckIn] = await db.insert(checkIns).values(checkIn).returning();
    return newCheckIn;
  }

  async getLatestCheckIn(userId: string): Promise<CheckIn | undefined> {
    const [checkIn] = await db
      .select()
      .from(checkIns)
      .where(eq(checkIns.userId, userId))
      .orderBy(desc(checkIns.checkInDate))
      .limit(1);
    return checkIn;
  }

  async getTodayCheckIn(userId: string): Promise<CheckIn | undefined> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [checkIn] = await db
      .select()
      .from(checkIns)
      .where(
        and(
          eq(checkIns.userId, userId),
          gte(checkIns.checkInDate, today),
          lt(checkIns.checkInDate, tomorrow)
        )
      );
    return checkIn;
  }

  // Body map operations
  async getBodyMapLogs(userId: string): Promise<BodyMapLog[]> {
    return await db
      .select()
      .from(bodyMapLogs)
      .where(eq(bodyMapLogs.userId, userId))
      .orderBy(desc(bodyMapLogs.createdAt));
  }

  async getBodyMapLogById(id: number): Promise<BodyMapLog | undefined> {
    const [log] = await db
      .select()
      .from(bodyMapLogs)
      .where(eq(bodyMapLogs.id, id));
    return log;
  }

  async createBodyMapLog(log: InsertBodyMapLog): Promise<BodyMapLog> {
    // Create new entry - keep all assessments as history
    const [newLog] = await db.insert(bodyMapLogs).values(log).returning();
    return newLog;
  }

  async updateBodyMapLog(id: number, updates: Partial<InsertBodyMapLog>): Promise<BodyMapLog> {
    const [updatedLog] = await db.update(bodyMapLogs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bodyMapLogs.id, id))
      .returning();
    return updatedLog;
  }

  async deleteBodyMapLog(userId: string, bodyPart: string, view: string): Promise<void> {
    await db.delete(bodyMapLogs)
      .where(
        and(
          eq(bodyMapLogs.userId, userId),
          eq(bodyMapLogs.bodyPart, bodyPart),
          eq(bodyMapLogs.view, view)
        )
      );
  }

  async deleteBodyMapLogById(userId: string, id: number): Promise<void> {
    await db.delete(bodyMapLogs)
      .where(
        and(
          eq(bodyMapLogs.userId, userId),
          eq(bodyMapLogs.id, id)
        )
      );
  }

  // Reassessment reminder operations
  async createReassessmentReminder(reminder: InsertReassessmentReminder): Promise<ReassessmentReminder> {
    const [newReminder] = await db.insert(reassessmentReminders).values(reminder).returning();
    return newReminder;
  }

  async completeReassessmentReminders(userId: string, bodyArea: string, completedByLogId: number): Promise<number> {
    const result = await db.update(reassessmentReminders)
      .set({
        status: 'completed',
        completedAt: new Date(),
        completedByLogId: completedByLogId,
      })
      .where(
        and(
          eq(reassessmentReminders.userId, userId),
          eq(reassessmentReminders.bodyArea, bodyArea),
          or(
            eq(reassessmentReminders.status, 'scheduled'),
            eq(reassessmentReminders.status, 'due')
          )
        )
      )
      .returning();
    return result.length;
  }

  async getDueReassessmentReminders(userId: string): Promise<ReassessmentReminder[]> {
    const now = new Date();
    return await db
      .select()
      .from(reassessmentReminders)
      .where(
        and(
          eq(reassessmentReminders.userId, userId),
          or(
            eq(reassessmentReminders.status, 'due'),
            and(
              eq(reassessmentReminders.status, 'scheduled'),
              lte(reassessmentReminders.dueAt, now)
            )
          )
        )
      )
      .orderBy(asc(reassessmentReminders.dueAt));
  }

  async getRemindersForDate(userId: string, date: Date): Promise<ReassessmentReminder[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    const now = new Date();
    
    return await db
      .select()
      .from(reassessmentReminders)
      .where(
        and(
          eq(reassessmentReminders.userId, userId),
          or(
            // Reminders that are due on this specific date
            and(
              or(
                eq(reassessmentReminders.status, 'scheduled'),
                eq(reassessmentReminders.status, 'due')
              ),
              gte(reassessmentReminders.dueAt, startOfDay),
              lte(reassessmentReminders.dueAt, endOfDay)
            ),
            // If viewing today or past, also include overdue reminders
            and(
              lte(startOfDay, now),
              or(
                eq(reassessmentReminders.status, 'due'),
                and(
                  eq(reassessmentReminders.status, 'scheduled'),
                  lte(reassessmentReminders.dueAt, now)
                )
              )
            )
          )
        )
      )
      .orderBy(asc(reassessmentReminders.dueAt));
  }

  async getReassessmentRemindersByBodyArea(userId: string, bodyArea: string): Promise<ReassessmentReminder[]> {
    return await db
      .select()
      .from(reassessmentReminders)
      .where(
        and(
          eq(reassessmentReminders.userId, userId),
          eq(reassessmentReminders.bodyArea, bodyArea)
        )
      )
      .orderBy(desc(reassessmentReminders.createdAt));
  }

  async getAllReassessmentReminders(userId: string): Promise<ReassessmentReminder[]> {
    return await db
      .select()
      .from(reassessmentReminders)
      .where(
        and(
          eq(reassessmentReminders.userId, userId),
          or(
            eq(reassessmentReminders.status, 'scheduled'),
            eq(reassessmentReminders.status, 'due')
          )
        )
      )
      .orderBy(asc(reassessmentReminders.dueAt));
  }

  // Bookmark operations (favorites)
  async getUserBookmarks(userId: string): Promise<Bookmark[]> {
    return await db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.createdAt));
  }

  async getUserBookmarksByType(userId: string, contentType: string): Promise<Bookmark[]> {
    return await db
      .select()
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.userId, userId),
          eq(bookmarks.contentType, contentType)
        )
      )
      .orderBy(desc(bookmarks.createdAt));
  }

  async isContentBookmarked(userId: string, contentType: string, contentId: number): Promise<boolean> {
    const result = await db
      .select()
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.userId, userId),
          eq(bookmarks.contentType, contentType),
          eq(bookmarks.contentId, contentId)
        )
      )
      .limit(1);
    
    return result.length > 0;
  }

  async createBookmark(bookmark: InsertBookmark): Promise<Bookmark> {
    const [newBookmark] = await db.insert(bookmarks).values(bookmark).returning();
    return newBookmark;
  }

  async deleteBookmark(userId: string, contentType: string, contentId: number): Promise<void> {
    await db
      .delete(bookmarks)
      .where(
        and(
          eq(bookmarks.userId, userId),
          eq(bookmarks.contentType, contentType),
          eq(bookmarks.contentId, contentId)
        )
      );
  }

  // User notes operations
  async getUserNotes(userId: string, contentType?: string, contentId?: number): Promise<UserNote[]> {
    let conditions = [eq(userNotes.userId, userId)];
    
    if (contentType && contentId) {
      conditions.push(eq(userNotes.contentType, contentType));
      conditions.push(eq(userNotes.contentId, contentId));
    }
    
    return await db.select().from(userNotes)
      .where(and(...conditions))
      .orderBy(desc(userNotes.updatedAt));
  }

  async createUserNote(note: InsertUserNote): Promise<UserNote> {
    const [newNote] = await db.insert(userNotes).values(note).returning();
    return newNote;
  }

  async updateUserNote(id: number, note: string): Promise<UserNote> {
    const [updatedNote] = await db
      .update(userNotes)
      .set({ note, updatedAt: new Date() })
      .where(eq(userNotes.id, id))
      .returning();
    return updatedNote;
  }

  // Search operations
  async searchContent(query: string): Promise<{
    programs: Program[];
    videos: Video[];
    recipes: Recipe[];
  }> {
    const [programResults, videoResults, recipeResults] = await Promise.all([
      db
        .select()
        .from(programs)
        .where(
          or(
            ilike(programs.title, `%${query}%`),
            ilike(programs.description, `%${query}%`)
          )
        ),
      this.searchVideos(query),
      this.searchRecipes(query),
    ]);

    return {
      programs: programResults,
      videos: videoResults,
      recipes: recipeResults,
    };
  }

  // Injury tracking operations
  async getInjuryLogs(userId: string): Promise<InjuryLog[]> {
    return await db.select().from(injuryLogs)
      .where(eq(injuryLogs.userId, userId))
      .orderBy(desc(injuryLogs.lastUpdatedAt));
  }

  async getInjuryLogById(id: number): Promise<InjuryLog | undefined> {
    const [log] = await db.select().from(injuryLogs).where(eq(injuryLogs.id, id));
    return log || undefined;
  }

  async createInjuryLog(log: InsertInjuryLog): Promise<InjuryLog> {
    const [created] = await db.insert(injuryLogs).values(log).returning();
    return created;
  }

  async updateInjuryLog(id: number, updates: Partial<InsertInjuryLog>): Promise<InjuryLog> {
    const [updated] = await db.update(injuryLogs)
      .set({ ...updates, lastUpdatedAt: new Date() })
      .where(eq(injuryLogs.id, id))
      .returning();
    return updated;
  }

  async deleteInjuryLog(id: number): Promise<void> {
    await db.delete(injuryLogs).where(eq(injuryLogs.id, id));
  }

  // Daily severity tracking
  async getDailySeverityLogs(injuryLogId: number, days: number = 30): Promise<DailySeverityLog[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return await db.select().from(dailySeverityLogs)
      .where(
        and(
          eq(dailySeverityLogs.injuryLogId, injuryLogId),
          gte(dailySeverityLogs.logDate, cutoffDate)
        )
      )
      .orderBy(desc(dailySeverityLogs.logDate));
  }

  async createDailySeverityLog(log: InsertDailySeverityLog): Promise<DailySeverityLog> {
    const [created] = await db.insert(dailySeverityLogs).values(log).returning();
    return created;
  }

  async getLatestSeverityForInjury(injuryLogId: number): Promise<DailySeverityLog | undefined> {
    const [latest] = await db.select().from(dailySeverityLogs)
      .where(eq(dailySeverityLogs.injuryLogId, injuryLogId))
      .orderBy(desc(dailySeverityLogs.logDate))
      .limit(1);
    return latest || undefined;
  }

  // Recovery actions
  async getRecoveryActions(injuryLogId: number): Promise<RecoveryAction[]> {
    return await db.select().from(recoveryActions)
      .where(eq(recoveryActions.injuryLogId, injuryLogId))
      .orderBy(desc(recoveryActions.createdAt));
  }

  async createRecoveryAction(action: InsertRecoveryAction): Promise<RecoveryAction> {
    const [created] = await db.insert(recoveryActions).values(action).returning();
    return created;
  }

  async updateRecoveryAction(id: number, updates: Partial<InsertRecoveryAction>): Promise<RecoveryAction> {
    const [updated] = await db.update(recoveryActions)
      .set(updates)
      .where(eq(recoveryActions.id, id))
      .returning();
    return updated;
  }

  async deleteRecoveryAction(id: number): Promise<void> {
    await db.delete(recoveryActions).where(eq(recoveryActions.id, id));
  }

  // Recovery compliance
  async getRecoveryCompliance(recoveryActionId: number, days: number = 30): Promise<RecoveryCompliance[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return await db.select().from(recoveryCompliance)
      .where(
        and(
          eq(recoveryCompliance.recoveryActionId, recoveryActionId),
          gte(recoveryCompliance.completedDate, cutoffDate)
        )
      )
      .orderBy(desc(recoveryCompliance.completedDate));
  }

  async createRecoveryCompliance(compliance: InsertRecoveryCompliance): Promise<RecoveryCompliance> {
    const [created] = await db.insert(recoveryCompliance).values(compliance).returning();
    return created;
  }

  async getComplianceStats(recoveryActionId: number, days: number): Promise<{ total: number; completed: number; percentage: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const [action] = await db.select().from(recoveryActions)
      .where(eq(recoveryActions.id, recoveryActionId));
    
    if (!action) {
      return { total: 0, completed: 0, percentage: 0 };
    }
    
    const completed = await db.select().from(recoveryCompliance)
      .where(
        and(
          eq(recoveryCompliance.recoveryActionId, recoveryActionId),
          gte(recoveryCompliance.completedDate, cutoffDate)
        )
      );
    
    // Calculate expected sessions based on frequency
    let expectedSessions = 0;
    if (action.frequency === 'daily') {
      expectedSessions = days;
    } else if (action.frequency === '3x_week') {
      expectedSessions = Math.floor((days / 7) * 3);
    } else if (action.frequency === 'every_other_day') {
      expectedSessions = Math.floor(days / 2);
    }
    
    const completedCount = completed.length;
    const percentage = expectedSessions > 0 ? (completedCount / expectedSessions) * 100 : 0;
    
    return {
      total: expectedSessions,
      completed: completedCount,
      percentage: Math.round(percentage)
    };
  }

  // Recovery alerts
  async getRecoveryAlerts(userId: string, unreadOnly: boolean = false): Promise<RecoveryAlert[]> {
    let whereConditions = [eq(recoveryAlerts.userId, userId)];
    
    if (unreadOnly) {
      whereConditions.push(eq(recoveryAlerts.isRead, false));
    }
    
    return await db.select().from(recoveryAlerts)
      .where(and(...whereConditions))
      .orderBy(desc(recoveryAlerts.triggeredAt));
  }

  async createRecoveryAlert(alert: InsertRecoveryAlert): Promise<RecoveryAlert> {
    const [created] = await db.insert(recoveryAlerts).values(alert).returning();
    return created;
  }

  async markAlertAsRead(id: number): Promise<void> {
    await db.update(recoveryAlerts)
      .set({ isRead: true })
      .where(eq(recoveryAlerts.id, id));
  }

  async dismissAlert(id: number): Promise<void> {
    await db.update(recoveryAlerts)
      .set({ isDismissed: true })
      .where(eq(recoveryAlerts.id, id));
  }

  // Smart feedback logic
  async analyzeInjuryProgress(injuryLogId: number): Promise<{
    trend: 'improving' | 'stable' | 'worsening';
    daysSinceLogged: number;
    averageSeverity: number;
    recommendAction: boolean;
  }> {
    const [injuryLog] = await db.select().from(injuryLogs)
      .where(eq(injuryLogs.id, injuryLogId));
    
    if (!injuryLog) {
      throw new Error('Injury log not found');
    }
    
    const severityLogs = await this.getDailySeverityLogs(injuryLogId, 14);
    
    const daysSinceLogged = Math.floor(
      (Date.now() - new Date(injuryLog.firstLoggedAt!).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (severityLogs.length === 0) {
      return {
        trend: 'stable',
        daysSinceLogged,
        averageSeverity: injuryLog.currentSeverity,
        recommendAction: daysSinceLogged > 10 && injuryLog.currentSeverity >= 7
      };
    }
    
    const averageSeverity = severityLogs.reduce((sum, log) => sum + log.severity, 0) / severityLogs.length;
    
    // Analyze trend over last 7 days vs previous 7 days
    const recent = severityLogs.slice(0, 7);
    const previous = severityLogs.slice(7, 14);
    
    const recentAvg = recent.length > 0 ? recent.reduce((sum, log) => sum + log.severity, 0) / recent.length : injuryLog.currentSeverity;
    const previousAvg = previous.length > 0 ? previous.reduce((sum, log) => sum + log.severity, 0) / previous.length : injuryLog.initialSeverity;
    
    let trend: 'improving' | 'stable' | 'worsening' = 'stable';
    const difference = recentAvg - previousAvg;
    
    if (difference < -1) {
      trend = 'improving';
    } else if (difference > 1) {
      trend = 'worsening';
    }
    
    const recommendAction = (
      (trend === 'worsening') ||
      (daysSinceLogged > 10 && recentAvg >= 7) ||
      (daysSinceLogged > 21 && recentAvg >= 5)
    );
    
    return {
      trend,
      daysSinceLogged,
      averageSeverity: Math.round(averageSeverity * 10) / 10,
      recommendAction
    };
  }

  // Meals operations
  async getMeals(userId: string): Promise<Meal[]> {
    return await db.select().from(meals)
      .where(eq(meals.userId, userId))
      .orderBy(desc(meals.date));
  }

  async createMeal(meal: InsertMeal): Promise<Meal> {
    const [created] = await db.insert(meals).values(meal).returning();
    return created;
  }

  async deleteMeal(id: number): Promise<void> {
    await db.delete(meals).where(eq(meals.id, id));
  }

  // Progress photos operations
  async getProgressPhotos(userId: string): Promise<ProgressPhoto[]> {
    return await db.select().from(progressPhotos)
      .where(eq(progressPhotos.userId, userId))
      .orderBy(desc(progressPhotos.date));
  }

  async createProgressPhoto(photo: InsertProgressPhoto): Promise<ProgressPhoto> {
    const [created] = await db.insert(progressPhotos).values(photo).returning();
    return created;
  }

  async deleteProgressPhoto(id: number): Promise<void> {
    await db.delete(progressPhotos).where(eq(progressPhotos.id, id));
  }

  // Body stats operations
  async getBodyStats(userId: string): Promise<BodyStats[]> {
    return await db.select().from(bodyStats)
      .where(eq(bodyStats.userId, userId))
      .orderBy(desc(bodyStats.date));
  }

  async createBodyStats(stats: InsertBodyStats): Promise<BodyStats> {
    const [created] = await db.insert(bodyStats).values(stats).returning();
    return created;
  }

  async deleteBodyStats(id: number): Promise<void> {
    await db.delete(bodyStats).where(eq(bodyStats.id, id));
  }

  // Workout sessions operations
  async getWorkoutSessions(userId: string): Promise<WorkoutSession[]> {
    return await db.select().from(workoutSessions)
      .where(eq(workoutSessions.userId, userId))
      .orderBy(desc(workoutSessions.date));
  }

  async createWorkoutSession(session: InsertWorkoutSession): Promise<WorkoutSession> {
    const [created] = await db.insert(workoutSessions).values(session).returning();
    return created;
  }

  async deleteWorkoutSession(id: number): Promise<void> {
    await db.delete(workoutSessions).where(eq(workoutSessions.id, id));
  }

  // Calendar/Activity aggregation
  async getActivitiesByDateRange(userId: string, startDate?: Date, endDate?: Date): Promise<any> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const end = endDate || new Date();

    // Fetch all activity types for the user within date range
    // Note: Meals/nutrition are intentionally excluded - tracked separately in nutrition section
    const [photosData, statsData, sessionsData, habitsData, habitCompletionsData, enrollmentsData, scheduledWorkoutsData, completedWorkoutLogsData] = await Promise.all([
      db.select().from(progressPhotos).where(and(eq(progressPhotos.userId, userId), gte(progressPhotos.date, start))),
      db.select().from(bodyStats).where(and(eq(bodyStats.userId, userId), gte(bodyStats.date, start))),
      db.select().from(workoutSessions).where(and(eq(workoutSessions.userId, userId), gte(workoutSessions.date, start))),
      db.select().from(habits).where(and(eq(habits.userId, userId), eq(habits.isActive, true))),
      db.select().from(habitCompletions).where(and(eq(habitCompletions.userId, userId), gte(habitCompletions.completedDate, start))),
      db.select({
        enrollment: userProgramEnrollments,
        program: programs
      })
        .from(userProgramEnrollments)
        .innerJoin(programs, eq(userProgramEnrollments.programId, programs.id))
        .where(and(
          eq(userProgramEnrollments.userId, userId),
          inArray(userProgramEnrollments.status, ['active', 'scheduled'])
        )),
      db.select().from(scheduledWorkouts).where(and(eq(scheduledWorkouts.userId, userId), gte(scheduledWorkouts.scheduledDate, start))),
      db.select().from(workoutLogs).where(and(eq(workoutLogs.userId, userId), eq(workoutLogs.status, 'completed'), gte(workoutLogs.completedAt, start)))
    ]);

    // Transform into unified activity format grouped by date
    const activities: { [key: string]: any[] } = {};

    // Meals/nutrition are intentionally excluded from calendar view
    // They are tracked separately in the nutrition section

    photosData.forEach(photo => {
      const dateKey = new Date(photo.date).toISOString().split('T')[0];
      if (!activities[dateKey]) activities[dateKey] = [];
      activities[dateKey].push({
        type: 'photo',
        id: photo.id,
        photoType: photo.photoType,
        imageUrl: photo.imageUrl,
        notes: photo.notes,
        date: photo.date
      });
    });

    statsData.forEach(stat => {
      const dateKey = new Date(stat.date).toISOString().split('T')[0];
      if (!activities[dateKey]) activities[dateKey] = [];
      activities[dateKey].push({
        type: 'bodyStats',
        id: stat.id,
        weight: stat.weight,
        bodyFat: stat.bodyFat,
        notes: stat.notes,
        date: stat.date
      });
    });

    sessionsData.forEach(session => {
      const dateKey = new Date(session.date).toISOString().split('T')[0];
      if (!activities[dateKey]) activities[dateKey] = [];
      activities[dateKey].push({
        type: 'workout',
        id: session.id,
        title: session.title,
        duration: session.duration,
        exercisesCompleted: session.exercisesCompleted,
        notes: session.notes,
        date: session.date
      });
    });

    // Process completed workout logs (programme workouts and logged workouts)
    completedWorkoutLogsData.forEach(log => {
      if (!log.completedAt) return;
      // Use UTC date to ensure consistency with how dates are stored and queried
      const completedDate = log.completedAt instanceof Date ? log.completedAt : new Date(log.completedAt);
      const dateKey = completedDate.toISOString().split('T')[0];
      if (!activities[dateKey]) activities[dateKey] = [];
      activities[dateKey].push({
        type: 'completedWorkout',
        id: log.id,
        title: log.workoutName || 'Workout',
        duration: log.duration,
        workoutType: log.workoutType,
        enrollmentId: log.enrollmentId,
        week: log.week,
        day: log.day,
        workoutId: log.workoutId,
        workoutRating: log.workoutRating,
        date: log.completedAt,
        status: 'completed'
      });
    });

    // Process habits - check if they're scheduled for dates in range
    habitsData.forEach(habit => {
      const habitStart = new Date(habit.startDate);
      const habitEnd = new Date(habitStart);
      habitEnd.setDate(habitEnd.getDate() + ((habit.duration || 4) * 7)); // duration is in weeks, default 4

      // Check each day in the date range
      const currentDate = new Date(Math.max(start.getTime(), habitStart.getTime()));
      const endDate = new Date(Math.min(end.getTime(), habitEnd.getTime()));

      while (currentDate <= endDate) {
        const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
        const daysOfWeek = habit.daysOfWeek?.toLowerCase() || 'everyday';
        
        let shouldShow = false;
        if (daysOfWeek === 'everyday') {
          shouldShow = true;
        } else if (daysOfWeek === 'weekdays' && !['Saturday', 'Sunday'].includes(dayName)) {
          shouldShow = true;
        } else if (daysOfWeek === 'weekends' && ['Saturday', 'Sunday'].includes(dayName)) {
          shouldShow = true;
        } else if (daysOfWeek.includes(dayName.toLowerCase())) {
          shouldShow = true;
        }

        if (shouldShow) {
          const dateKey = currentDate.toISOString().split('T')[0];
          if (!activities[dateKey]) activities[dateKey] = [];
          
          // Check if this habit was completed on this date
          const isCompleted = habitCompletionsData.some(completion => 
            completion.habitId === habit.id &&
            new Date(completion.completedDate).toISOString().split('T')[0] === dateKey
          );
          
          // Determine if this is missed (date is in the past and not completed)
          const now = new Date();
          const habitDate = new Date(dateKey);
          const isMissed = habitDate < new Date(now.toISOString().split('T')[0]) && !isCompleted;
          
          activities[dateKey].push({
            type: 'habit',
            id: habit.id,
            title: habit.title,
            category: habit.category,
            icon: habit.icon,
            date: dateKey,
            completed: isCompleted,
            missed: isMissed
          });
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    // Process scheduled workouts (from schedule workout dialog)
    for (const scheduledWorkout of scheduledWorkoutsData) {
      const dateKey = new Date(scheduledWorkout.scheduledDate).toISOString().split('T')[0];
      if (!activities[dateKey]) activities[dateKey] = [];
      
      // Determine if this is missed (date is in the past and not completed)
      const now = new Date();
      const scheduledDate = new Date(dateKey);
      const isMissed = scheduledDate < new Date(now.toISOString().split('T')[0]) && !scheduledWorkout.isCompleted;
      
      // For scheduled workouts with workoutId=0 (programme extras), look up enrollment info
      let enrollmentInfo: { workoutType?: string; enrollmentId?: number; week?: number; day?: number } = {};
      if (!scheduledWorkout.workoutId || scheduledWorkout.workoutId === 0) {
        // Find matching active enrollment
        const [activeEnrollment] = await db
          .select({
            id: userProgramEnrollments.id,
            startDate: userProgramEnrollments.startDate,
          })
          .from(userProgramEnrollments)
          .where(
            and(
              eq(userProgramEnrollments.userId, userId),
              eq(userProgramEnrollments.status, 'active'),
              eq(userProgramEnrollments.programType, 'main')
            )
          )
          .limit(1);
        
        if (activeEnrollment) {
          // Find matching enrollment workout by name
          const [matchingWorkout] = await db
            .select({
              dayNumber: enrollmentWorkouts.dayNumber,
            })
            .from(enrollmentWorkouts)
            .where(
              and(
                eq(enrollmentWorkouts.enrollmentId, activeEnrollment.id),
                eq(enrollmentWorkouts.name, scheduledWorkout.workoutName),
                eq(enrollmentWorkouts.weekNumber, 1)
              )
            )
            .limit(1);
          
          if (matchingWorkout) {
            // Calculate week based on date difference
            const startDate = new Date(activeEnrollment.startDate);
            const workoutDate = new Date(scheduledWorkout.scheduledDate);
            const daysDiff = Math.floor((workoutDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            const week = Math.floor(daysDiff / 7) + 1;
            
            enrollmentInfo = {
              workoutType: 'programme',
              enrollmentId: activeEnrollment.id,
              week: week,
              day: matchingWorkout.dayNumber,
            };
          }
        }
      }
      
      activities[dateKey].push({
        type: 'scheduledWorkout',
        id: scheduledWorkout.id,
        title: scheduledWorkout.workoutName,
        workoutId: scheduledWorkout.workoutId,
        date: dateKey,
        completed: scheduledWorkout.isCompleted || false,
        missed: isMissed,
        ...enrollmentInfo,
      });
    }

    // Process program enrollments - add scheduled workouts from enrollmentWorkouts table
    // Uses scheduledDateOverride when workouts have been moved
    for (const { enrollment, program } of enrollmentsData) {
      const enrollmentStart = new Date(enrollment.startDate);
      
      // Fetch ALL enrollment workouts for this enrollment (all weeks)
      const enrollmentWorkoutsData = await db.select()
        .from(enrollmentWorkouts)
        .where(eq(enrollmentWorkouts.enrollmentId, enrollment.id));

      // Process each workout and calculate its actual date
      for (const workout of enrollmentWorkoutsData) {
        if (!workout.dayNumber || !workout.weekNumber) continue;
        
        // Use scheduledDateOverride if present, otherwise calculate from week/day
        let workoutDate: Date;
        if (workout.scheduledDateOverride) {
          workoutDate = new Date(workout.scheduledDateOverride);
        } else {
          const dayOffset = (workout.weekNumber - 1) * 7 + (workout.dayNumber - 1);
          workoutDate = new Date(enrollmentStart);
          workoutDate.setDate(workoutDate.getDate() + dayOffset);
        }
        
        workoutDate.setHours(0, 0, 0, 0);

        // Only include if within the query range
        if (workoutDate >= start && workoutDate <= end) {
          const dateKey = workoutDate.toISOString().split('T')[0];
          if (!activities[dateKey]) activities[dateKey] = [];
          
          // Check if this workout was already completed (in either workoutSessions or workoutLogs)
          const alreadyCompletedInSessions = sessionsData.some(s => 
            new Date(s.date).toISOString().split('T')[0] === dateKey &&
            s.title?.includes(program.title)
          );
          
          // Also check completed workout logs for programme workouts
          const alreadyCompletedInLogs = completedWorkoutLogsData.some(log => {
            if (!log.completedAt) return false;
            const logDateKey = (log.completedAt instanceof Date ? log.completedAt : new Date(log.completedAt)).toISOString().split('T')[0];
            // Match by enrollmentId, week, and day OR by workout name
            return logDateKey === dateKey && (
              (log.enrollmentId === enrollment.id && log.week === workout.weekNumber && log.day === workout.dayNumber) ||
              (log.workoutName === workout.name)
            );
          });

          if (!alreadyCompletedInSessions && !alreadyCompletedInLogs) {
            // Determine if this is missed (date is in the past and not completed)
            const now = new Date();
            const scheduledDate = new Date(dateKey);
            const isMissed = scheduledDate < new Date(now.toISOString().split('T')[0]);
            
            activities[dateKey].push({
              type: 'scheduledWorkout',
              id: `programme-${enrollment.id}-${workout.id}`,
              title: workout.name || `${program.title} - Week ${workout.weekNumber} Day ${workout.dayNumber}`,
              programId: program.id,
              programTitle: program.title,
              enrollmentId: enrollment.id,
              enrollmentWorkoutId: workout.id,
              workoutType: 'programme',
              week: workout.weekNumber,
              day: workout.dayNumber,
              date: dateKey,
              completed: false,
              missed: isMissed
            });
          }
        }
      }
    }

    return activities;
  }

  // Recovery plan suggestions operations
  async createRecoveryPlanSuggestion(plan: InsertRecoveryPlanSuggestion): Promise<RecoveryPlanSuggestion> {
    const [created] = await db.insert(recoveryPlanSuggestions).values(plan).returning();
    return created;
  }

  async getRecoveryPlansByUser(userId: string): Promise<RecoveryPlanSuggestion[]> {
    return await db.select().from(recoveryPlanSuggestions)
      .where(eq(recoveryPlanSuggestions.userId, userId))
      .orderBy(desc(recoveryPlanSuggestions.createdAt));
  }

  async getRecoveryPlanById(id: number): Promise<RecoveryPlanSuggestion | undefined> {
    const [plan] = await db.select().from(recoveryPlanSuggestions)
      .where(eq(recoveryPlanSuggestions.id, id));
    return plan || undefined;
  }

  async updateRecoveryPlanStatus(id: number, status: string): Promise<RecoveryPlanSuggestion> {
    const [updated] = await db.update(recoveryPlanSuggestions)
      .set({ status, updatedAt: new Date() })
      .where(eq(recoveryPlanSuggestions.id, id))
      .returning();
    return updated;
  }

  // Program modification suggestions operations
  async createProgramModificationSuggestion(modification: InsertProgramModificationSuggestion): Promise<ProgramModificationSuggestion> {
    const [created] = await db.insert(programModificationSuggestions).values(modification).returning();
    return created;
  }

  async getProgramModificationsByRecoveryPlan(recoveryPlanId: number): Promise<ProgramModificationSuggestion[]> {
    return await db.select().from(programModificationSuggestions)
      .where(eq(programModificationSuggestions.recoveryPlanId, recoveryPlanId))
      .orderBy(programModificationSuggestions.week, programModificationSuggestions.day);
  }

  async getProgramModificationById(id: number): Promise<ProgramModificationSuggestion | undefined> {
    const [modification] = await db.select().from(programModificationSuggestions)
      .where(eq(programModificationSuggestions.id, id));
    return modification || undefined;
  }

  async updateProgramModificationStatus(id: number, status: string): Promise<ProgramModificationSuggestion> {
    const [updated] = await db.update(programModificationSuggestions)
      .set({ status, updatedAt: new Date() })
      .where(eq(programModificationSuggestions.id, id))
      .returning();
    return updated;
  }

  async updateAllModificationStatuses(recoveryPlanId: number, status: string): Promise<void> {
    await db.update(programModificationSuggestions)
      .set({ status, updatedAt: new Date() })
      .where(eq(programModificationSuggestions.recoveryPlanId, recoveryPlanId));
  }

  async applyAcceptedModifications(userId: string, recoveryPlanId: number): Promise<void> {
    // Get all accepted modifications for this recovery plan
    const modifications = await db.select().from(programModificationSuggestions)
      .where(
        and(
          eq(programModificationSuggestions.recoveryPlanId, recoveryPlanId),
          eq(programModificationSuggestions.status, 'accepted')
        )
      );

    // Apply each modification to the block exercises
    for (const mod of modifications) {
      const blockExerciseId = mod.blockExerciseId;
      if (blockExerciseId) {
        const updates: any = {};
        
        // For block exercises, sets are stored as JSON array
        if (mod.suggestedSets || mod.suggestedReps || mod.suggestedRest) {
          const [exercise] = await db.select().from(programmeBlockExercises)
            .where(eq(programmeBlockExercises.id, blockExerciseId));
          
          if (exercise) {
            const currentSets = Array.isArray(exercise.sets) ? exercise.sets : [];
            const updatedSets = currentSets.map((set: any) => ({
              ...set,
              reps: mod.suggestedReps || set.reps,
              rest: mod.suggestedRest || set.rest,
            }));
            
            if (mod.suggestedSets && mod.suggestedSets !== currentSets.length) {
              while (updatedSets.length < mod.suggestedSets) {
                updatedSets.push({ reps: mod.suggestedReps || '10', rest: mod.suggestedRest || 'No Rest' });
              }
              while (updatedSets.length > mod.suggestedSets) {
                updatedSets.pop();
              }
            }
            
            const modNote = `Modified due to ${mod.reason}`;
            updates.sets = updatedSets;
            updates.notes = exercise.notes ? `${exercise.notes}\n${modNote}` : modNote;
            
            await db.update(programmeBlockExercises)
              .set(updates)
              .where(eq(programmeBlockExercises.id, blockExerciseId));
          }
        }
      }
    }
  }

  // Body Map Configuration operations
  async getBodyMapAreas(): Promise<BodyMapArea[]> {
    return await db.select().from(bodyMapAreas)
      .where(eq(bodyMapAreas.isActive, true))
      .orderBy(bodyMapAreas.orderIndex, bodyMapAreas.name);
  }

  async getBodyMapAreaByName(name: string): Promise<BodyMapArea | null> {
    const [area] = await db.select().from(bodyMapAreas)
      .where(eq(bodyMapAreas.name, name.toLowerCase()));
    return area || null;
  }

  async createBodyMapArea(area: InsertBodyMapArea): Promise<BodyMapArea> {
    const [created] = await db.insert(bodyMapAreas).values(area).returning();
    return created;
  }

  async updateBodyMapArea(id: number, area: Partial<InsertBodyMapArea>): Promise<BodyMapArea> {
    const [updated] = await db.update(bodyMapAreas)
      .set({ ...area, updatedAt: new Date() })
      .where(eq(bodyMapAreas.id, id))
      .returning();
    return updated;
  }

  async deleteBodyMapArea(id: number): Promise<void> {
    await db.delete(bodyMapAreas).where(eq(bodyMapAreas.id, id));
  }

  async getBodyMapQuestionsByArea(areaId: number): Promise<BodyMapQuestion[]> {
    return await db.select().from(bodyMapQuestions)
      .where(and(
        eq(bodyMapQuestions.bodyAreaId, areaId),
        eq(bodyMapQuestions.isActive, true)
      ))
      .orderBy(bodyMapQuestions.orderIndex);
  }

  async createBodyMapQuestion(question: InsertBodyMapQuestion): Promise<BodyMapQuestion> {
    const [created] = await db.insert(bodyMapQuestions).values(question).returning();
    return created;
  }

  async updateBodyMapQuestion(id: number, question: Partial<InsertBodyMapQuestion>): Promise<BodyMapQuestion> {
    const [updated] = await db.update(bodyMapQuestions)
      .set({ ...question, updatedAt: new Date() })
      .where(eq(bodyMapQuestions.id, id))
      .returning();
    return updated;
  }

  async deleteBodyMapQuestion(id: number): Promise<void> {
    await db.delete(bodyMapQuestions).where(eq(bodyMapQuestions.id, id));
  }

  async getBodyMapAnswersByQuestion(questionId: number): Promise<BodyMapAnswerOption[]> {
    return await db.select().from(bodyMapAnswerOptions)
      .where(and(
        eq(bodyMapAnswerOptions.questionId, questionId),
        eq(bodyMapAnswerOptions.isActive, true)
      ))
      .orderBy(bodyMapAnswerOptions.orderIndex);
  }

  async createBodyMapAnswer(answer: InsertBodyMapAnswerOption): Promise<BodyMapAnswerOption> {
    const [created] = await db.insert(bodyMapAnswerOptions).values(answer).returning();
    return created;
  }

  async updateBodyMapAnswer(id: number, answer: Partial<InsertBodyMapAnswerOption>): Promise<BodyMapAnswerOption> {
    const [updated] = await db.update(bodyMapAnswerOptions)
      .set(answer)
      .where(eq(bodyMapAnswerOptions.id, id))
      .returning();
    return updated;
  }

  async deleteBodyMapAnswer(id: number): Promise<void> {
    await db.delete(bodyMapAnswerOptions).where(eq(bodyMapAnswerOptions.id, id));
  }

  async getFollowUpTriggersByArea(areaId: number): Promise<{ trainingImpact: string | null }[]> {
    // Get outcomes that trigger follow-up for this area
    const result = await db
      .select({ trainingImpact: bodyMapOutcomes.trainingImpact })
      .from(bodyMapOutcomes)
      .where(and(
        eq(bodyMapOutcomes.bodyAreaId, areaId),
        eq(bodyMapOutcomes.isActive, true),
        eq(bodyMapOutcomes.triggersFollowUp, true)
      ));
    
    return result;
  }

  async getBodyMapMovementOptionsByArea(areaId: number): Promise<BodyMapMovementOption[]> {
    return await db.select().from(bodyMapMovementOptions)
      .where(and(
        eq(bodyMapMovementOptions.bodyAreaId, areaId),
        eq(bodyMapMovementOptions.isActive, true)
      ))
      .orderBy(bodyMapMovementOptions.orderIndex);
  }

  async getAllBodyMapMovementOptions(): Promise<BodyMapMovementOption[]> {
    return await db.select().from(bodyMapMovementOptions)
      .where(eq(bodyMapMovementOptions.isActive, true))
      .orderBy(bodyMapMovementOptions.bodyAreaId, bodyMapMovementOptions.orderIndex);
  }

  async createBodyMapMovementOption(option: InsertBodyMapMovementOption): Promise<BodyMapMovementOption> {
    const [created] = await db.insert(bodyMapMovementOptions).values(option).returning();
    return created;
  }

  async updateBodyMapMovementOption(id: number, option: Partial<InsertBodyMapMovementOption>): Promise<BodyMapMovementOption> {
    const [updated] = await db.update(bodyMapMovementOptions)
      .set(option)
      .where(eq(bodyMapMovementOptions.id, id))
      .returning();
    return updated;
  }

  async deleteBodyMapMovementOption(id: number): Promise<void> {
    await db.delete(bodyMapMovementOptions).where(eq(bodyMapMovementOptions.id, id));
  }

  async getBodyMapTemplatesByArea(areaId: number): Promise<BodyMapRecoveryTemplate[]> {
    return await db.select().from(bodyMapRecoveryTemplates)
      .where(and(
        eq(bodyMapRecoveryTemplates.bodyAreaId, areaId),
        eq(bodyMapRecoveryTemplates.isActive, true)
      ))
      .orderBy(bodyMapRecoveryTemplates.name);
  }

  async createBodyMapTemplate(template: InsertBodyMapRecoveryTemplate): Promise<BodyMapRecoveryTemplate> {
    const [created] = await db.insert(bodyMapRecoveryTemplates).values(template).returning();
    return created;
  }

  async updateBodyMapTemplate(id: number, template: Partial<InsertBodyMapRecoveryTemplate>): Promise<BodyMapRecoveryTemplate> {
    const [updated] = await db.update(bodyMapRecoveryTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(bodyMapRecoveryTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteBodyMapTemplate(id: number): Promise<void> {
    await db.delete(bodyMapRecoveryTemplates).where(eq(bodyMapRecoveryTemplates.id, id));
  }

  async getBodyMapRulesByTemplate(templateId: number): Promise<BodyMapTemplateRule[]> {
    return await db.select().from(bodyMapTemplateRules)
      .where(and(
        eq(bodyMapTemplateRules.templateId, templateId),
        eq(bodyMapTemplateRules.isActive, true)
      ))
      .orderBy(desc(bodyMapTemplateRules.priority));
  }

  async createBodyMapRule(rule: InsertBodyMapTemplateRule): Promise<BodyMapTemplateRule> {
    const [created] = await db.insert(bodyMapTemplateRules).values(rule).returning();
    return created;
  }

  async updateBodyMapRule(id: number, rule: Partial<InsertBodyMapTemplateRule>): Promise<BodyMapTemplateRule> {
    const [updated] = await db.update(bodyMapTemplateRules)
      .set({ ...rule, updatedAt: new Date() })
      .where(eq(bodyMapTemplateRules.id, id))
      .returning();
    return updated;
  }

  async deleteBodyMapRule(id: number): Promise<void> {
    await db.delete(bodyMapTemplateRules).where(eq(bodyMapTemplateRules.id, id));
  }

  // Universal guidance rules
  async getBodyMapGuidanceRules(): Promise<BodyMapGuidanceRule[]> {
    return await db.select().from(bodyMapGuidanceRules)
      .where(eq(bodyMapGuidanceRules.isActive, true))
      .orderBy(bodyMapGuidanceRules.ruleType, desc(bodyMapGuidanceRules.priority));
  }

  async createBodyMapGuidanceRule(rule: InsertBodyMapGuidanceRule): Promise<BodyMapGuidanceRule> {
    const [created] = await db.insert(bodyMapGuidanceRules).values(rule).returning();
    return created;
  }

  async updateBodyMapGuidanceRule(id: number, rule: Partial<InsertBodyMapGuidanceRule>): Promise<BodyMapGuidanceRule> {
    const [updated] = await db.update(bodyMapGuidanceRules)
      .set(rule)
      .where(eq(bodyMapGuidanceRules.id, id))
      .returning();
    return updated;
  }

  async deleteBodyMapGuidanceRule(id: number): Promise<void> {
    await db.delete(bodyMapGuidanceRules).where(eq(bodyMapGuidanceRules.id, id));
  }

  // Body Map Outcomes - outcome-based decision framework
  async getBodyMapOutcomesByArea(areaId: number): Promise<BodyMapOutcome[]> {
    return await db.select().from(bodyMapOutcomes)
      .where(eq(bodyMapOutcomes.bodyAreaId, areaId))
      .orderBy(desc(bodyMapOutcomes.priority), bodyMapOutcomes.name);
  }

  async getBodyMapOutcomeById(id: number): Promise<BodyMapOutcome | undefined> {
    const [outcome] = await db.select().from(bodyMapOutcomes)
      .where(eq(bodyMapOutcomes.id, id));
    return outcome;
  }

  async createBodyMapOutcome(outcome: InsertBodyMapOutcome): Promise<BodyMapOutcome> {
    const [created] = await db.insert(bodyMapOutcomes).values(outcome).returning();
    return created;
  }

  async updateBodyMapOutcome(id: number, outcome: Partial<InsertBodyMapOutcome>): Promise<BodyMapOutcome> {
    const [updated] = await db.update(bodyMapOutcomes)
      .set({ ...outcome, updatedAt: new Date() })
      .where(eq(bodyMapOutcomes.id, id))
      .returning();
    return updated;
  }

  async deleteBodyMapOutcome(id: number): Promise<void> {
    await db.delete(bodyMapOutcomes).where(eq(bodyMapOutcomes.id, id));
  }

  async findMatchingOutcome(
    bodyAreaId: number,
    severity: number,
    trainingImpact: string | null,
    movementImpact: string | null
  ): Promise<BodyMapOutcome | null> {
    // Get all active outcomes for this body area, ordered by priority
    const outcomes = await db.select().from(bodyMapOutcomes)
      .where(and(
        eq(bodyMapOutcomes.bodyAreaId, bodyAreaId),
        eq(bodyMapOutcomes.isActive, true)
      ))
      .orderBy(desc(bodyMapOutcomes.priority));

    // Find the first matching outcome based on conditions (AND logic)
    for (const outcome of outcomes) {
      let matches = true;

      // Check severity range
      if (outcome.severityMin !== null && severity < outcome.severityMin) {
        matches = false;
      }
      if (outcome.severityMax !== null && severity > outcome.severityMax) {
        matches = false;
      }

      // Check training impact (null in outcome means "any")
      if (outcome.trainingImpact !== null && trainingImpact !== null && outcome.trainingImpact !== trainingImpact) {
        matches = false;
      }

      // Check movement impact (null in outcome means "any")
      if (outcome.movementImpact !== null && movementImpact !== null && outcome.movementImpact !== movementImpact) {
        matches = false;
      }

      if (matches) {
        return outcome;
      }
    }

    return null;
  }

  async findMatchingRecoveryTemplate(
    bodyPart: string, 
    severity: number, 
    answers: Record<number, any>
  ): Promise<BodyMapRecoveryTemplate | null> {
    const [area] = await db.select().from(bodyMapAreas).where(and(
      eq(bodyMapAreas.name, bodyPart),
      eq(bodyMapAreas.isActive, true)
    ));
    if (!area) return null;

    const templates = await db.select().from(bodyMapRecoveryTemplates).where(and(
      eq(bodyMapRecoveryTemplates.bodyAreaId, area.id),
      eq(bodyMapRecoveryTemplates.isActive, true)
    ));
    if (templates.length === 0) return null;

    const candidates: {
      template: typeof templates[0];
      score: number;
      priority: number;
    }[] = [];

    for (const template of templates) {
      const rules = await db.select().from(bodyMapTemplateRules).where(and(
        eq(bodyMapTemplateRules.templateId, template.id),
        eq(bodyMapTemplateRules.isActive, true)
      )).orderBy(desc(bodyMapTemplateRules.priority));

      for (const rule of rules) {
        const matchesSeverity =
          (rule.severityMin === null || severity >= rule.severityMin) &&
          (rule.severityMax === null || severity <= rule.severityMax);

        if (!matchesSeverity) continue;

        let score = 0;
        if (rule.requiredAnswers &&
            Object.keys(rule.requiredAnswers).length > 0) {
          for (const [questionId, expectedValue] of
               Object.entries(rule.requiredAnswers)) {
            const userAnswer = answers[parseInt(questionId)];
            if (userAnswer === expectedValue) {
              score += 1;
            }
          }
        }

        candidates.push({
          template,
          score,
          priority: rule.priority ?? 0
        });

        break;
      }
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.priority - a.priority;
    });

    return candidates[0].template;
  }

  // Goals operations
  async getGoals(userId: string): Promise<Goal[]> {
    return await db
      .select()
      .from(goals)
      .where(eq(goals.userId, userId))
      .orderBy(desc(goals.createdAt));
  }

  async getGoalById(id: number): Promise<Goal | undefined> {
    const [goal] = await db.select().from(goals).where(eq(goals.id, id));
    return goal;
  }

  async createGoal(goal: InsertGoal): Promise<Goal> {
    const [newGoal] = await db.insert(goals).values(goal).returning();
    return newGoal;
  }

  async updateGoal(id: number, goal: Partial<InsertGoal>): Promise<Goal> {
    const [updated] = await db
      .update(goals)
      .set({ ...goal, updatedAt: new Date() })
      .where(eq(goals.id, id))
      .returning();
    return updated;
  }

  async deleteGoal(id: number): Promise<void> {
    await db.delete(goals).where(eq(goals.id, id));
  }

  async getActiveBodyweightGoals(userId: string): Promise<Goal[]> {
    return await db
      .select()
      .from(goals)
      .where(
        and(
          eq(goals.userId, userId),
          eq(goals.type, "bodyweight"),
          eq(goals.isCompleted, false)
        )
      );
  }

  async getActiveNutritionGoals(userId: string): Promise<Goal[]> {
    return await db
      .select()
      .from(goals)
      .where(
        and(
          eq(goals.userId, userId),
          eq(goals.type, "nutrition"),
          eq(goals.isCompleted, false)
        )
      );
  }

  async archiveGoal(id: number): Promise<Goal> {
    const [archived] = await db
      .update(goals)
      .set({ isCompleted: true, updatedAt: new Date() })
      .where(eq(goals.id, id))
      .returning();
    return archived;
  }

  private countCurrentStreak(sortedAscDates: string[]): number {
    if (sortedAscDates.length === 0) return 0;
    const unique = [...new Set(sortedAscDates)].sort().reverse();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    const yestStr = new Date(today.getTime() - 86400000).toISOString().split('T')[0];
    if (unique[0] !== todayStr && unique[0] !== yestStr) return 0;
    let streak = 1;
    for (let i = 1; i < unique.length; i++) {
      const diff = Math.round((new Date(unique[i-1]+'T12:00:00').getTime() - new Date(unique[i]+'T12:00:00').getTime()) / 86400000);
      if (diff === 1) streak++; else break;
    }
    return streak;
  }

  async getGoalProgress(goalId: number, userId: string): Promise<{ current: number; target: number; label: string; percentage: number } | null> {
    const goal = await this.getGoalById(goalId);
    if (!goal?.templateId) return null;
    const templateId = goal.templateId;
    const startDate = new Date(goal.startDate);
    const endDate = goal.deadline ? new Date(goal.deadline) : new Date();

    if (templateId === "36-workouts-90-days") {
      const [r] = await db.select({ count: sql<number>`count(*)` }).from(workoutLogs)
        .where(and(eq(workoutLogs.userId, userId), eq(workoutLogs.status, 'completed'),
          gte(workoutLogs.completedAt, startDate), lte(workoutLogs.completedAt, endDate)));
      const current = Number(r?.count || 0);
      return { current, target: 36, label: "workouts", percentage: Math.min((current / 36) * 100, 100) };
    }

    if (templateId === "30-day-checkin-streak") {
      const rows = await db.select({ date: checkIns.checkInDate }).from(checkIns)
        .where(and(eq(checkIns.userId, userId), gte(checkIns.checkInDate, startDate.toISOString().split('T')[0])))
        .orderBy(asc(checkIns.checkInDate));
      const current = this.countCurrentStreak(rows.map(r => r.date));
      return { current, target: 30, label: "day streak", percentage: Math.min((current / 30) * 100, 100) };
    }

    if (templateId === "track-meals-4-weeks") {
      const rows = await db.selectDistinct({ date: mealLogs.date }).from(mealLogs)
        .where(and(eq(mealLogs.userId, userId),
          gte(mealLogs.date, startDate.toISOString().split('T')[0]),
          lte(mealLogs.date, endDate.toISOString().split('T')[0])));
      const current = rows.length;
      return { current, target: 28, label: "days logged", percentage: Math.min((current / 28) * 100, 100) };
    }

    if (templateId === "protein-30-days") {
      const [nutritionGoal] = await db.select().from(goals)
        .where(and(eq(goals.userId, userId), eq(goals.type, 'nutrition'), eq(goals.isCompleted, false))).limit(1);
      const proteinTarget = nutritionGoal?.proteinGrams || 0;
      if (!proteinTarget) return { current: 0, target: 30, label: "day streak", percentage: 0 };
      const dailyProtein = await db.select({ date: mealLogs.date, total: sql<number>`sum(${mealFoodEntries.protein})` })
        .from(mealLogs).innerJoin(mealFoodEntries, eq(mealFoodEntries.mealLogId, mealLogs.id))
        .where(and(eq(mealLogs.userId, userId), gte(mealLogs.date, startDate.toISOString().split('T')[0])))
        .groupBy(mealLogs.date).orderBy(asc(mealLogs.date));
      const metDays = dailyProtein.filter(d => Number(d.total) >= proteinTarget).map(d => d.date);
      const current = this.countCurrentStreak(metDays);
      return { current, target: 30, label: "day streak", percentage: Math.min((current / 30) * 100, 100) };
    }

    if (templateId === "all-habits-14-days") {
      const userHabits = await db.select({ id: habits.id }).from(habits).where(eq(habits.userId, userId));
      if (userHabits.length === 0) return { current: 0, target: 14, label: "day streak", percentage: 0 };
      const habitCount = userHabits.length;
      const habitIds = userHabits.map(h => h.id);
      const byDay = await db.select({ date: habitCompletions.completedDate, cnt: sql<number>`count(*)` })
        .from(habitCompletions)
        .where(and(eq(habitCompletions.userId, userId), gte(habitCompletions.completedDate, startDate.toISOString().split('T')[0]), inArray(habitCompletions.habitId, habitIds)))
        .groupBy(habitCompletions.completedDate).orderBy(asc(habitCompletions.completedDate));
      const fullDays = byDay.filter(d => Number(d.cnt) >= habitCount).map(d => d.date);
      const current = this.countCurrentStreak(fullDays);
      return { current, target: 14, label: "day streak", percentage: Math.min((current / 14) * 100, 100) };
    }

    if (templateId === "walk-450k-steps" && goal.trackingMode === "cumulative") {
      const now = new Date();
      const queryEnd = endDate > now ? now : endDate;
      const [result] = await db.select({ total: sql<number>`coalesce(sum(${stepEntries.steps}), 0)` })
        .from(stepEntries)
        .where(and(
          eq(stepEntries.userId, userId),
          gte(stepEntries.date, startDate),
          lte(stepEntries.date, queryEnd)
        ));
      const current = Number(result?.total || 0);
      const target = 450000;
      return { current, target, label: "steps", percentage: Math.min((current / target) * 100, 100) };
    }

    if (templateId === "walk-450k-steps" && goal.trackingMode !== "cumulative") {
      const habitName = "Hit Your Step Count";
      const [habit] = await db.select().from(habits).where(and(eq(habits.userId, userId), eq(habits.title, habitName))).orderBy(desc(habits.id)).limit(1);
      if (!habit) return { current: 0, target: 45, label: "days", percentage: 0 };
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      const [result] = await db.select({ count: sql<number>`count(distinct ${habitCompletions.completedDate}::date)` })
        .from(habitCompletions)
        .where(and(
          eq(habitCompletions.habitId, habit.id),
          eq(habitCompletions.userId, userId),
          sql`${habitCompletions.completedDate}::date >= ${startStr}`,
          sql`${habitCompletions.completedDate}::date <= ${endStr}`
        ));
      const current = Number(result?.count || 0);
      return { current, target: 45, label: "days", percentage: Math.min((current / 45) * 100, 100) };
    }

    const companionMap: Record<string, { name: string; target: number }> = {
      "30-day-alcohol-free": { name: "Avoided Alcohol", target: 30 },
      "30-day-stretch": { name: "Evening Stretch", target: 30 },
      "consistent-wake-time-30-days": { name: "Set a Consistent Wake Time", target: 30 },
    };
    if (companionMap[templateId]) {
      const { name, target } = companionMap[templateId];
      const [habit] = await db.select().from(habits).where(and(eq(habits.userId, userId), eq(habits.title, name))).orderBy(desc(habits.id)).limit(1);
      const current = habit?.currentStreak || 0;
      return { current, target, label: "day streak", percentage: Math.min((current / target) * 100, 100) };
    }

    return null;
  }

  async syncBodyweightGoals(userId: string, _weight: number): Promise<void> {
    console.log(`syncBodyweightGoals called: userId=${userId}`);
    
    // ALWAYS get the most recent weight entry by date (closest to today)
    const entries = await this.getBodyweightEntries(userId);
    if (entries.length === 0) {
      console.log('No bodyweight entries found, skipping sync');
      return;
    }
    
    // Sort by date descending and get the most recent entry
    const sortedEntries = entries.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });
    
    const latestWeight = sortedEntries[0].weight;
    console.log(`Using latest weight by date: ${latestWeight}kg from ${sortedEntries[0].date}`);
    
    const activeGoals = await this.getActiveBodyweightGoals(userId);
    console.log(`Found ${activeGoals.length} active bodyweight goals for user`);
    
    for (const goal of activeGoals) {
      console.log(`Processing goal ${goal.id}: target=${goal.targetValue}, current=${goal.currentValue}, starting=${goal.startingValue}`);
      if (goal.targetValue) {
        // Calculate progress percentage based on starting value vs target
        const startWeight = goal.startingValue || goal.currentValue || latestWeight;
        const targetWeight = goal.targetValue;
        const totalDifference = Math.abs(startWeight - targetWeight);
        const currentDifference = Math.abs(latestWeight - targetWeight);
        
        let progress = 0;
        if (totalDifference > 0) {
          progress = Math.round(((totalDifference - currentDifference) / totalDifference) * 100);
          progress = Math.max(0, Math.min(100, progress)); // Clamp between 0-100
        }
        
        // Check if goal is completed based on goal direction
        const isWeightLoss = startWeight > targetWeight;
        let isCompleted = false;
        if (isWeightLoss) {
          // Weight loss goal: completed when at or below target
          isCompleted = latestWeight <= targetWeight;
        } else {
          // Weight gain goal: completed when at or above target
          isCompleted = latestWeight >= targetWeight;
        }
        
        // Only set completedAt when transitioning to completed state
        // Use the date of the bodyweight entry that triggered completion
        const latestEntryDate = new Date(sortedEntries[0].date);
        const updateData: any = { 
          currentValue: latestWeight, 
          progress,
          isCompleted,
          updatedAt: new Date() 
        };
        
        if (isCompleted && !goal.isCompleted) {
          updateData.completedAt = latestEntryDate;
        } else if (!isCompleted && goal.isCompleted) {
          updateData.completedAt = null;
        }
        
        await db
          .update(goals)
          .set(updateData)
          .where(eq(goals.id, goal.id));

        // Check and auto-complete milestones
        const milestones = await this.getMilestones(goal.id);
        const isWeightLossGoal = startWeight > targetWeight;
        
        for (const milestone of milestones) {
          if (milestone.completed) continue; // Skip already completed
          
          const milestoneTarget = milestone.targetValue;
          let milestoneAchieved = false;
          
          if (isWeightLossGoal) {
            // Weight loss: milestone achieved when weight is at or below target
            milestoneAchieved = latestWeight <= milestoneTarget;
          } else {
            // Weight gain: milestone achieved when weight is at or above target
            milestoneAchieved = latestWeight >= milestoneTarget;
          }
          
          if (milestoneAchieved) {
            await this.completeMilestone(milestone.id);
          }
        }
      }
    }
  }

  // Goal Milestones operations
  async getMilestones(goalId: number): Promise<GoalMilestone[]> {
    return await db
      .select()
      .from(goalMilestones)
      .where(eq(goalMilestones.goalId, goalId))
      .orderBy(asc(goalMilestones.orderIndex));
  }

  async createMilestone(milestone: InsertGoalMilestone): Promise<GoalMilestone> {
    const [newMilestone] = await db.insert(goalMilestones).values(milestone).returning();
    return newMilestone;
  }

  async updateMilestone(id: number, milestone: Partial<InsertGoalMilestone>): Promise<GoalMilestone> {
    const [updated] = await db
      .update(goalMilestones)
      .set({ ...milestone, updatedAt: new Date() })
      .where(eq(goalMilestones.id, id))
      .returning();
    return updated;
  }

  async deleteMilestone(id: number): Promise<void> {
    await db.delete(goalMilestones).where(eq(goalMilestones.id, id));
  }

  async deleteMilestonesByGoalId(goalId: number): Promise<void> {
    await db.delete(goalMilestones).where(eq(goalMilestones.goalId, goalId));
  }

  async completeMilestone(id: number): Promise<GoalMilestone> {
    const [updated] = await db
      .update(goalMilestones)
      .set({ completed: true, completedDate: new Date(), updatedAt: new Date() })
      .where(eq(goalMilestones.id, id))
      .returning();
    return updated;
  }

  async uncompleteMilestone(id: number): Promise<GoalMilestone> {
    const [updated] = await db
      .update(goalMilestones)
      .set({ completed: false, completedDate: null, updatedAt: new Date() })
      .where(eq(goalMilestones.id, id))
      .returning();
    return updated;
  }

  // Habit Templates operations
  async getUserHabitLibrary(userId: string): Promise<UserHabitLibraryEntry[]> {
    return await db
      .select()
      .from(userHabitLibrary)
      .where(eq(userHabitLibrary.userId, userId))
      .orderBy(userHabitLibrary.createdAt);
  }

  async createUserHabitLibraryEntry(entry: InsertUserHabitLibraryEntry): Promise<UserHabitLibraryEntry> {
    const [created] = await db.insert(userHabitLibrary).values(entry).returning();
    return created;
  }

  async updateUserHabitLibraryEntry(id: number, data: Partial<InsertUserHabitLibraryEntry>): Promise<UserHabitLibraryEntry> {
    const [updated] = await db.update(userHabitLibrary).set(data).where(eq(userHabitLibrary.id, id)).returning();
    return updated;
  }

  async deleteUserHabitLibraryEntry(id: number): Promise<void> {
    await db.delete(userHabitLibrary).where(eq(userHabitLibrary.id, id));
  }

  async getHabitTemplates(): Promise<HabitTemplate[]> {
    return await db
      .select()
      .from(habitTemplates)
      .where(eq(habitTemplates.isActive, true))
      .orderBy(habitTemplates.category, habitTemplates.orderIndex);
  }

  async getHabitTemplateById(id: number): Promise<HabitTemplate | undefined> {
    const [template] = await db
      .select()
      .from(habitTemplates)
      .where(eq(habitTemplates.id, id));
    return template;
  }

  // Habits operations
  async getHabits(userId: string): Promise<Habit[]> {
    const userHabits = await db
      .select()
      .from(habits)
      .where(and(eq(habits.userId, userId), eq(habits.isActive, true)))
      .orderBy(desc(habits.createdAt));
    
    // Validate and update streaks for each habit (streaks become stale when days pass)
    const validatedHabits: Habit[] = [];
    for (const habit of userHabits) {
      const validatedStreak = await this.getValidatedHabitStreak(habit.id);
      if (validatedStreak !== habit.currentStreak) {
        // Update the stale streak in database
        await db.update(habits).set({ currentStreak: validatedStreak }).where(eq(habits.id, habit.id));
      }
      validatedHabits.push({ ...habit, currentStreak: validatedStreak });
    }
    
    return validatedHabits;
  }
  
  async getValidatedHabitStreak(habitId: number): Promise<number> {
    const completions = await this.getHabitCompletions(habitId);
    if (completions.length === 0) return 0;
    
    const uniqueDates = [...new Set(
      completions.map(c => {
        const d = new Date(c.completedDate);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
    )].sort((a, b) => b - a);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayTime = yesterday.getTime();
    
    let currentStreak = 0;
    if (uniqueDates.includes(todayTime)) {
      currentStreak = 1;
      let checkDate = yesterdayTime;
      for (let i = 1; i < uniqueDates.length; i++) {
        if (uniqueDates[i] === checkDate) {
          currentStreak++;
          checkDate -= 86400000;
        } else if (uniqueDates[i] < checkDate) {
          break;
        }
      }
    } else if (uniqueDates.includes(yesterdayTime)) {
      currentStreak = 1;
      let checkDate = yesterdayTime - 86400000;
      for (let i = 0; i < uniqueDates.length; i++) {
        if (uniqueDates[i] === yesterdayTime) continue;
        if (uniqueDates[i] === checkDate) {
          currentStreak++;
          checkDate -= 86400000;
        } else if (uniqueDates[i] < checkDate) {
          break;
        }
      }
    }
    
    return currentStreak;
  }

  async getHabitById(id: number): Promise<Habit | undefined> {
    const [habit] = await db.select().from(habits).where(eq(habits.id, id));
    return habit;
  }

  async createHabit(habit: InsertHabit): Promise<Habit> {
    const [newHabit] = await db.insert(habits).values(habit).returning();
    return newHabit;
  }

  async updateHabit(id: number, habit: Partial<InsertHabit>): Promise<Habit> {
    const [updated] = await db
      .update(habits)
      .set(habit)
      .where(eq(habits.id, id))
      .returning();
    return updated;
  }

  async deleteHabit(id: number): Promise<void> {
    await db.update(habits).set({ isActive: false }).where(eq(habits.id, id));
  }

  async completeHabit(habitId: number, userId: string, date?: Date): Promise<HabitCompletion> {
    const completedDate = date || new Date();
    const [completion] = await db
      .insert(habitCompletions)
      .values({ habitId, userId, completedDate })
      .returning();
    
    // Update habit streak
    await this.updateHabitStreak(habitId);
    
    return completion;
  }

  async uncompleteHabit(habitId: number, userId: string, date: Date): Promise<void> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    await db
      .delete(habitCompletions)
      .where(
        and(
          eq(habitCompletions.habitId, habitId),
          eq(habitCompletions.userId, userId),
          gte(habitCompletions.completedDate, startOfDay),
          lte(habitCompletions.completedDate, endOfDay)
        )
      );
    
    // Update habit streak
    await this.updateHabitStreak(habitId);
  }

  async getHabitCompletions(habitId: number): Promise<HabitCompletion[]> {
    return await db
      .select()
      .from(habitCompletions)
      .where(eq(habitCompletions.habitId, habitId))
      .orderBy(desc(habitCompletions.completedDate));
  }

  async getHabitCompletionsForDate(userId: string, date: Date): Promise<{ habitId: number; completedDate: Date }[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const completions = await db
      .select({
        habitId: habitCompletions.habitId,
        completedDate: habitCompletions.completedDate,
      })
      .from(habitCompletions)
      .where(
        and(
          eq(habitCompletions.userId, userId),
          gte(habitCompletions.completedDate, startOfDay),
          lte(habitCompletions.completedDate, endOfDay)
        )
      );
    
    return completions;
  }

  async updateHabitStreak(habitId: number): Promise<void> {
    const habit = await this.getHabitById(habitId);
    if (!habit) return;

    const completions = await this.getHabitCompletions(habitId);
    
    // No completions = no streaks
    if (completions.length === 0) {
      await db
        .update(habits)
        .set({ currentStreak: 0, longestStreak: 0 })
        .where(eq(habits.id, habitId));
      return;
    }

    // Get unique completion dates, sorted from newest to oldest
    const uniqueDates = [...new Set(
      completions.map(c => {
        const d = new Date(c.completedDate);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
    )].sort((a, b) => b - a);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayTime = yesterday.getTime();

    // Calculate CURRENT streak - must include today or yesterday
    let currentStreak = 0;
    if (uniqueDates.includes(todayTime)) {
      currentStreak = 1;
      let checkDate = yesterdayTime;
      for (let i = 1; i < uniqueDates.length; i++) {
        if (uniqueDates[i] === checkDate) {
          currentStreak++;
          checkDate -= 86400000; // subtract one day in ms
        } else if (uniqueDates[i] < checkDate) {
          break;
        }
      }
    } else if (uniqueDates.includes(yesterdayTime)) {
      // If not completed today but completed yesterday, streak continues from yesterday
      currentStreak = 1;
      let checkDate = yesterdayTime - 86400000;
      for (let i = 0; i < uniqueDates.length; i++) {
        if (uniqueDates[i] === yesterdayTime) continue;
        if (uniqueDates[i] === checkDate) {
          currentStreak++;
          checkDate -= 86400000;
        } else if (uniqueDates[i] < checkDate) {
          break;
        }
      }
    }
    // If neither today nor yesterday is completed, currentStreak = 0

    // Calculate LONGEST streak ever by checking all consecutive sequences
    let longestStreak = 0;
    let tempStreak = 1;
    const sortedDatesAsc = [...uniqueDates].sort((a, b) => a - b);
    
    for (let i = 1; i < sortedDatesAsc.length; i++) {
      const diff = sortedDatesAsc[i] - sortedDatesAsc[i - 1];
      if (diff === 86400000) { // exactly one day apart
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);
    
    await db
      .update(habits)
      .set({
        currentStreak,
        longestStreak,
        lastCompletedDate: completions[0]?.completedDate || null,
      })
      .where(eq(habits.id, habitId));
  }

  // Learn Topics operations
  async getLearnTopics(): Promise<LearnTopic[]> {
    return await db
      .select()
      .from(learnTopics)
      .where(eq(learnTopics.isActive, true))
      .orderBy(learnTopics.orderIndex);
  }

  async getLearnTopicBySlug(slug: string): Promise<LearnTopic | undefined> {
    const [topic] = await db
      .select()
      .from(learnTopics)
      .where(and(eq(learnTopics.slug, slug), eq(learnTopics.isActive, true)));
    return topic;
  }

  async getLearnTopicById(id: number): Promise<LearnTopic | undefined> {
    const [topic] = await db
      .select()
      .from(learnTopics)
      .where(eq(learnTopics.id, id));
    return topic;
  }

  async getTopicCompletionStats(userId: string, topicId: number): Promise<{ pathsCompleted: number; totalPaths: number; videosWatched: number; totalVideos: number }> {
    // Get all learning paths for this topic
    const allPaths = await db
      .select()
      .from(learningPaths)
      .where(eq(learningPaths.topicId, topicId));

    // Get all videos in the unified content library for this topic
    const allLibraryVideos = await db
      .select({ id: learnContentLibrary.id })
      .from(learnContentLibrary)
      .where(eq(learnContentLibrary.topicId, topicId));

    const allLibraryIds = allLibraryVideos.map(v => v.id);

    // Get user's completed content from unified progress table
    const completedContent = allLibraryIds.length > 0 ? await db
      .select({ libraryItemId: userContentProgress.libraryItemId })
      .from(userContentProgress)
      .where(
        and(
          eq(userContentProgress.userId, userId),
          inArray(userContentProgress.libraryItemId, allLibraryIds)
        )
      ) : [];

    const completedIds = new Set(completedContent.map(c => c.libraryItemId));

    // Count completed paths (all videos in path are completed)
    let pathsCompleted = 0;
    for (const path of allPaths) {
      const pathItems = await db
        .select({ libraryItemId: learningPathContent.libraryItemId })
        .from(learningPathContent)
        .where(eq(learningPathContent.pathId, path.id));

      if (pathItems.length === 0) continue;

      const allItemsCompleted = pathItems.every(item => completedIds.has(item.libraryItemId));
      if (allItemsCompleted) {
        pathsCompleted++;
      }
    }

    return {
      pathsCompleted,
      totalPaths: allPaths.length,
      videosWatched: completedContent.length,
      totalVideos: allLibraryVideos.length,
    };
  }

  // Learning Paths operations
  async getLearningPaths(topicId?: number): Promise<LearningPath[]> {
    if (topicId) {
      return await db
        .select()
        .from(learningPaths)
        .where(eq(learningPaths.topicId, topicId))
        .orderBy(learningPaths.orderIndex, learningPaths.id);
    }
    return await db.select().from(learningPaths).orderBy(learningPaths.orderIndex, learningPaths.id);
  }

  async getLearningPathsByTopic(topicId: number): Promise<LearningPath[]> {
    return await db
      .select()
      .from(learningPaths)
      .where(eq(learningPaths.topicId, topicId))
      .orderBy(learningPaths.orderIndex, learningPaths.id);
  }

  async getLearningPathById(id: number): Promise<LearningPath | undefined> {
    const [path] = await db.select().from(learningPaths).where(eq(learningPaths.id, id));
    return path;
  }

  async getPathContentItems(pathId: number): Promise<PathContentItem[]> {
    return await db
      .select({
        id: pathContentItems.id,
        pathId: pathContentItems.pathId,
        title: pathContentItems.title,
        description: pathContentItems.description,
        contentType: pathContentItems.contentType,
        contentUrl: pathContentItems.contentUrl,
        thumbnailUrl: pathContentItems.thumbnailUrl,
        muxPlaybackId: pathContentItems.muxPlaybackId,
        duration: pathContentItems.duration,
        orderIndex: pathContentItems.orderIndex,
        isRequired: pathContentItems.isRequired,
        tags: pathContentItems.tags,
        libraryItemId: pathContentItems.libraryItemId,
        createdAt: pathContentItems.createdAt,
      })
      .from(pathContentItems)
      .where(eq(pathContentItems.pathId, pathId))
      .orderBy(pathContentItems.orderIndex);
  }

  async getPathContentItemsByTopic(topicId: number): Promise<PathContentItem[]> {
    return await db
      .select({
        id: pathContentItems.id,
        pathId: pathContentItems.pathId,
        title: pathContentItems.title,
        description: pathContentItems.description,
        contentType: pathContentItems.contentType,
        contentUrl: pathContentItems.contentUrl,
        thumbnailUrl: pathContentItems.thumbnailUrl,
        duration: pathContentItems.duration,
        orderIndex: pathContentItems.orderIndex,
        isRequired: pathContentItems.isRequired,
        createdAt: pathContentItems.createdAt,
      })
      .from(pathContentItems)
      .innerJoin(learningPaths, eq(pathContentItems.pathId, learningPaths.id))
      .where(eq(learningPaths.topicId, topicId))
      .orderBy(pathContentItems.orderIndex);
  }

  async getUserPathAssignments(userId: string): Promise<UserPathAssignment[]> {
    return await db
      .select()
      .from(userPathAssignments)
      .where(eq(userPathAssignments.userId, userId))
      .orderBy(desc(userPathAssignments.assignedDate));
  }

  async createUserPathAssignment(userId: string, pathId: number): Promise<UserPathAssignment> {
    const [assignment] = await db
      .insert(userPathAssignments)
      .values({ userId, pathId })
      .returning();
    return assignment;
  }

  async deleteUserPathAssignment(userId: string, pathId: number): Promise<void> {
    await db
      .delete(userPathAssignments)
      .where(
        and(
          eq(userPathAssignments.userId, userId),
          eq(userPathAssignments.pathId, pathId)
        )
      );
  }

  // Learning Path Content Progress operations
  async getPathContentProgress(userId: string, pathId: number): Promise<UserPathContentProgress[]> {
    return await db
      .select()
      .from(userPathContentProgress)
      .where(
        and(
          eq(userPathContentProgress.userId, userId),
          eq(userPathContentProgress.pathId, pathId)
        )
      );
  }

  async markContentComplete(userId: string, pathId: number, contentItemId: number): Promise<UserPathContentProgress> {
    const existing = await db
      .select()
      .from(userPathContentProgress)
      .where(
        and(
          eq(userPathContentProgress.userId, userId),
          eq(userPathContentProgress.pathId, pathId),
          eq(userPathContentProgress.contentItemId, contentItemId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(userPathContentProgress)
        .set({ completed: true, completedDate: new Date() })
        .where(eq(userPathContentProgress.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(userPathContentProgress)
      .values({
        userId,
        pathId,
        contentItemId,
        completed: true,
        completedDate: new Date(),
      })
      .returning();
    return created;
  }

  async markContentIncomplete(userId: string, pathId: number, contentItemId: number): Promise<void> {
    await db
      .delete(userPathContentProgress)
      .where(
        and(
          eq(userPathContentProgress.userId, userId),
          eq(userPathContentProgress.pathId, pathId),
          eq(userPathContentProgress.contentItemId, contentItemId)
        )
      );
  }

  // ========== UNIFIED CONTENT LIBRARY OPERATIONS ==========
  
  // Get all content from library by topic (for "Browse All" sections)
  // Order by id DESC so newest content appears first
  async getContentLibraryByTopic(topicId: number): Promise<LearnContentLibraryItem[]> {
    return await db
      .select()
      .from(learnContentLibrary)
      .where(eq(learnContentLibrary.topicId, topicId))
      .orderBy(desc(learnContentLibrary.id));
  }

  // Get a single library item by ID
  async getContentLibraryItem(id: number): Promise<LearnContentLibraryItem | undefined> {
    const [item] = await db
      .select()
      .from(learnContentLibrary)
      .where(eq(learnContentLibrary.id, id));
    return item;
  }

  // Get content items for a learning path (from join table)
  async getPathContentFromLibrary(pathId: number): Promise<(LearnContentLibraryItem & { orderIndex: number; isRequired: boolean | null; pathContentId: number })[]> {
    const items = await db
      .select({
        id: learnContentLibrary.id,
        title: learnContentLibrary.title,
        description: learnContentLibrary.description,
        contentType: learnContentLibrary.contentType,
        contentUrl: learnContentLibrary.contentUrl,
        thumbnailUrl: learnContentLibrary.thumbnailUrl,
        muxPlaybackId: learnContentLibrary.muxPlaybackId,
        duration: learnContentLibrary.duration,
        topicId: learnContentLibrary.topicId,
        tags: learnContentLibrary.tags,
        createdAt: learnContentLibrary.createdAt,
        orderIndex: learningPathContent.orderIndex,
        isRequired: learningPathContent.isRequired,
        pathContentId: learningPathContent.id,
      })
      .from(learningPathContent)
      .innerJoin(learnContentLibrary, eq(learningPathContent.libraryItemId, learnContentLibrary.id))
      .where(eq(learningPathContent.pathId, pathId))
      .orderBy(learningPathContent.orderIndex);
    return items;
  }

  // Get unified user content progress for a user (all completed content)
  async getUserContentProgress(userId: string): Promise<UserContentProgress[]> {
    return await db
      .select()
      .from(userContentProgress)
      .where(eq(userContentProgress.userId, userId));
  }

  // Check if a specific library item is completed by user
  async isLibraryItemCompleted(userId: string, libraryItemId: number): Promise<boolean> {
    const [result] = await db
      .select()
      .from(userContentProgress)
      .where(
        and(
          eq(userContentProgress.userId, userId),
          eq(userContentProgress.libraryItemId, libraryItemId),
          eq(userContentProgress.completed, true)
        )
      );
    return !!result;
  }

  // Mark library item as complete (unified progress)
  async markLibraryContentComplete(userId: string, libraryItemId: number): Promise<UserContentProgress> {
    const existing = await db
      .select()
      .from(userContentProgress)
      .where(
        and(
          eq(userContentProgress.userId, userId),
          eq(userContentProgress.libraryItemId, libraryItemId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(userContentProgress)
        .set({ completed: true, completedDate: new Date(), updatedAt: new Date() })
        .where(eq(userContentProgress.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(userContentProgress)
      .values({
        userId,
        libraryItemId,
        completed: true,
        completedDate: new Date(),
      })
      .returning();
    return created;
  }

  async updateWatchProgress(userId: string, libraryItemId: number, progress: number): Promise<void> {
    const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));
    const existing = await db
      .select()
      .from(userContentProgress)
      .where(
        and(
          eq(userContentProgress.userId, userId),
          eq(userContentProgress.libraryItemId, libraryItemId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const updateData: any = { watchProgress: clampedProgress, updatedAt: new Date() };
      if (clampedProgress >= 95 && !existing[0].completed) {
        updateData.completed = true;
        updateData.completedDate = new Date();
      }
      await db
        .update(userContentProgress)
        .set(updateData)
        .where(eq(userContentProgress.id, existing[0].id));
    } else {
      const isComplete = clampedProgress >= 95;
      await db
        .insert(userContentProgress)
        .values({
          userId,
          libraryItemId,
          watchProgress: clampedProgress,
          completed: isComplete,
          completedDate: isComplete ? new Date() : null,
        });
    }
  }

  async getWatchProgressMap(userId: string): Promise<Record<number, number>> {
    const results = await db
      .select({
        libraryItemId: userContentProgress.libraryItemId,
        watchProgress: userContentProgress.watchProgress,
      })
      .from(userContentProgress)
      .where(eq(userContentProgress.userId, userId));
    
    const map: Record<number, number> = {};
    for (const r of results) {
      map[r.libraryItemId] = r.watchProgress ?? 0;
    }
    return map;
  }

  // Mark library item as incomplete (unified progress)
  async markLibraryContentIncomplete(userId: string, libraryItemId: number): Promise<void> {
    await db
      .delete(userContentProgress)
      .where(
        and(
          eq(userContentProgress.userId, userId),
          eq(userContentProgress.libraryItemId, libraryItemId)
        )
      );
  }

  // Get completed library item IDs for a user
  async getCompletedLibraryItemIds(userId: string): Promise<number[]> {
    const results = await db
      .select({ libraryItemId: userContentProgress.libraryItemId })
      .from(userContentProgress)
      .where(
        and(
          eq(userContentProgress.userId, userId),
          eq(userContentProgress.completed, true)
        )
      );
    return results.map(r => r.libraryItemId);
  }

  async getCompletedLibraryItemsWithDates(userId: string): Promise<{ libraryItemId: number; completedDate: Date | null }[]> {
    const results = await db
      .select({ 
        libraryItemId: userContentProgress.libraryItemId,
        completedDate: userContentProgress.completedDate
      })
      .from(userContentProgress)
      .where(
        and(
          eq(userContentProgress.userId, userId),
          eq(userContentProgress.completed, true)
        )
      );
    return results;
  }

  // Create new content library item
  async createContentLibraryItem(item: InsertLearnContentLibraryItem): Promise<LearnContentLibraryItem> {
    const [created] = await db
      .insert(learnContentLibrary)
      .values(item)
      .returning();
    return created;
  }

  // Update content library item
  async updateContentLibraryItem(id: number, updates: Partial<InsertLearnContentLibraryItem>): Promise<LearnContentLibraryItem | undefined> {
    const [updated] = await db
      .update(learnContentLibrary)
      .set(updates)
      .where(eq(learnContentLibrary.id, id))
      .returning();
    return updated;
  }

  // Delete content library item
  async deleteContentLibraryItem(id: number): Promise<void> {
    await db.delete(learnContentLibrary).where(eq(learnContentLibrary.id, id));
  }

  // Add content item to learning path
  async addContentToPath(pathId: number, libraryItemId: number, orderIndex: number): Promise<LearningPathContentItem> {
    const [created] = await db
      .insert(learningPathContent)
      .values({ pathId, libraryItemId, orderIndex })
      .returning();
    return created;
  }

  // Remove content item from learning path
  async removeContentFromPath(pathId: number, libraryItemId: number): Promise<void> {
    await db
      .delete(learningPathContent)
      .where(
        and(
          eq(learningPathContent.pathId, pathId),
          eq(learningPathContent.libraryItemId, libraryItemId)
        )
      );
  }

  // Reorder content items in learning path
  async reorderPathContent(pathId: number, orderedLibraryItemIds: number[]): Promise<void> {
    for (let i = 0; i < orderedLibraryItemIds.length; i++) {
      await db
        .update(learningPathContent)
        .set({ orderIndex: i })
        .where(
          and(
            eq(learningPathContent.pathId, pathId),
            eq(learningPathContent.libraryItemId, orderedLibraryItemIds[i])
          )
        );
    }
  }

  // Favourites operations
  async addFavourite(userId: string, contentType: 'learning_path' | 'content_item', contentId: number): Promise<UserFavourite> {
    const favoriteData = {
      userId,
      contentType,
      learningPathId: contentType === 'learning_path' ? contentId : null,
      contentItemId: contentType === 'content_item' ? contentId : null,
    };

    const [favorite] = await db.insert(userFavourites).values(favoriteData).returning();
    return favorite;
  }

  async removeFavourite(userId: string, contentType: 'learning_path' | 'content_item', contentId: number): Promise<void> {
    if (contentType === 'learning_path') {
      await db
        .delete(userFavourites)
        .where(
          and(
            eq(userFavourites.userId, userId),
            eq(userFavourites.contentType, 'learning_path'),
            eq(userFavourites.learningPathId, contentId)
          )
        );
    } else {
      await db
        .delete(userFavourites)
        .where(
          and(
            eq(userFavourites.userId, userId),
            eq(userFavourites.contentType, 'content_item'),
            eq(userFavourites.contentItemId, contentId)
          )
        );
    }
  }

  async getUserFavourites(userId: string): Promise<UserFavourite[]> {
    return await db
      .select()
      .from(userFavourites)
      .where(eq(userFavourites.userId, userId))
      .orderBy(desc(userFavourites.createdAt));
  }

  async isFavourited(userId: string, contentType: 'learning_path' | 'content_item', contentId: number): Promise<boolean> {
    let query;
    if (contentType === 'learning_path') {
      query = db
        .select()
        .from(userFavourites)
        .where(
          and(
            eq(userFavourites.userId, userId),
            eq(userFavourites.contentType, 'learning_path'),
            eq(userFavourites.learningPathId, contentId)
          )
        );
    } else {
      query = db
        .select()
        .from(userFavourites)
        .where(
          and(
            eq(userFavourites.userId, userId),
            eq(userFavourites.contentType, 'content_item'),
            eq(userFavourites.contentItemId, contentId)
          )
        );
    }
    
    const results = await query;
    return results.length > 0;
  }

  // Hydration operations
  async getHydrationLogsInRange(userId: string, startDate: Date, endDate: Date): Promise<HydrationLog[]> {
    return await db
      .select()
      .from(hydrationLogs)
      .where(
        and(
          eq(hydrationLogs.userId, userId),
          gte(hydrationLogs.date, startDate),
          lte(hydrationLogs.date, endDate)
        )
      )
      .orderBy(hydrationLogs.createdAt);
  }

  async getHydrationLogs(userId: string, date: Date): Promise<HydrationLog[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await db
      .select()
      .from(hydrationLogs)
      .where(
        and(
          eq(hydrationLogs.userId, userId),
          gte(hydrationLogs.date, startOfDay),
          lte(hydrationLogs.date, endOfDay)
        )
      )
      .orderBy(hydrationLogs.createdAt);
  }

  async createHydrationLog(log: InsertHydrationLog): Promise<HydrationLog> {
    const [result] = await db
      .insert(hydrationLogs)
      .values(log)
      .returning();
    return result;
  }

  async deleteHydrationLog(id: number): Promise<void> {
    await db.delete(hydrationLogs).where(eq(hydrationLogs.id, id));
  }

  async getHydrationGoal(userId: string, date: Date): Promise<HydrationGoal | undefined> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const [goal] = await db
      .select()
      .from(hydrationGoals)
      .where(
        and(
          eq(hydrationGoals.userId, userId),
          gte(hydrationGoals.date, startOfDay),
          lte(hydrationGoals.date, endOfDay)
        )
      );
    return goal;
  }

  async createOrUpdateHydrationGoal(goal: InsertHydrationGoal): Promise<HydrationGoal> {
    const startOfDay = new Date(goal.date as Date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(goal.date as Date);
    endOfDay.setHours(23, 59, 59, 999);

    const existing = await db
      .select()
      .from(hydrationGoals)
      .where(
        and(
          eq(hydrationGoals.userId, goal.userId),
          gte(hydrationGoals.date, startOfDay),
          lte(hydrationGoals.date, endOfDay)
        )
      );

    if (existing.length > 0) {
      const [updated] = await db
        .update(hydrationGoals)
        .set(goal)
        .where(eq(hydrationGoals.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(hydrationGoals)
      .values(goal)
      .returning();
    return created;
  }

  async getTodayHydrationStats(userId: string): Promise<{
    totalMl: number;
    goalMl: number;
    percentage: number;
    logs: HydrationLog[];
    goal: HydrationGoal | undefined;
  }> {
    return this.getHydrationStatsForDate(userId, new Date());
  }

  async getHydrationStatsForDate(userId: string, date: Date): Promise<{
    totalMl: number;
    goalMl: number;
    percentage: number;
    logs: HydrationLog[];
    goal: HydrationGoal | undefined;
  }> {
    const logs = await this.getHydrationLogs(userId, date);
    const goal = await this.getHydrationGoal(userId, date);

    const totalMl = logs.reduce((sum, log) => sum + log.amountMl, 0);
    const goalMl = goal?.goalMl ?? 3000;
    const percentage = Math.round((totalMl / goalMl) * 100);

    return { totalMl, goalMl, percentage, logs, goal };
  }

  // User enrollment customization operations
  async createWorkoutCustomization(customization: InsertUserEnrollmentWorkoutCustomization): Promise<UserEnrollmentWorkoutCustomization> {
    const [created] = await db
      .insert(userEnrollmentWorkoutCustomizations)
      .values(customization)
      .returning();
    return created;
  }

  async getWorkoutCustomizations(enrollmentId: number): Promise<UserEnrollmentWorkoutCustomization[]> {
    return db
      .select()
      .from(userEnrollmentWorkoutCustomizations)
      .where(eq(userEnrollmentWorkoutCustomizations.enrollmentId, enrollmentId));
  }

  async updateWorkoutCustomization(id: number, customization: Partial<InsertUserEnrollmentWorkoutCustomization>): Promise<UserEnrollmentWorkoutCustomization> {
    const [updated] = await db
      .update(userEnrollmentWorkoutCustomizations)
      .set(customization)
      .where(eq(userEnrollmentWorkoutCustomizations.id, id))
      .returning();
    return updated;
  }

  async deleteWorkoutCustomization(id: number): Promise<void> {
    await db
      .delete(userEnrollmentWorkoutCustomizations)
      .where(eq(userEnrollmentWorkoutCustomizations.id, id));
  }

  async createExerciseCustomization(customization: InsertUserEnrollmentExerciseCustomization): Promise<UserEnrollmentExerciseCustomization> {
    const [created] = await db
      .insert(userEnrollmentExerciseCustomizations)
      .values(customization)
      .returning();
    return created;
  }

  async getExerciseCustomizations(enrollmentId: number): Promise<UserEnrollmentExerciseCustomization[]> {
    return db
      .select()
      .from(userEnrollmentExerciseCustomizations)
      .where(eq(userEnrollmentExerciseCustomizations.enrollmentId, enrollmentId));
  }

  async updateExerciseCustomization(id: number, customization: Partial<InsertUserEnrollmentExerciseCustomization>): Promise<UserEnrollmentExerciseCustomization> {
    const [updated] = await db
      .update(userEnrollmentExerciseCustomizations)
      .set(customization)
      .where(eq(userEnrollmentExerciseCustomizations.id, id))
      .returning();
    return updated;
  }

  async deleteExerciseCustomization(id: number): Promise<void> {
    await db
      .delete(userEnrollmentExerciseCustomizations)
      .where(eq(userEnrollmentExerciseCustomizations.id, id));
  }

  // Get a program week by ID
  async getProgramWeekById(id: number): Promise<ProgramWeek | undefined> {
    const [week] = await db
      .select()
      .from(programWeeks)
      .where(eq(programWeeks.id, id));
    return week;
  }

  // Get a program day by ID
  async getProgramDayById(id: number): Promise<ProgramDay | undefined> {
    const [day] = await db
      .select()
      .from(programDays)
      .where(eq(programDays.id, id));
    return day;
  }

  // Get all programme workouts for a programme (across all weeks and days)
  // Uses ONLY block-based tables (legacy removed)
  async getProgrammeWorkouts(programId: number): Promise<any[]> {
    const results = await db
      .select({
        workout: programmeWorkouts,
        weekNumber: programWeeks.weekNumber,
        dayPosition: programDays.position,
      })
      .from(programmeWorkouts)
      .innerJoin(programDays, eq(programmeWorkouts.dayId, programDays.id))
      .innerJoin(programWeeks, eq(programDays.weekId, programWeeks.id))
      .where(eq(programWeeks.programId, programId))
      .orderBy(asc(programWeeks.weekNumber), asc(programDays.position));
    
    const templateExerciseCounts = new Map<string, number>();
    const templateTotalExerciseCounts = new Map<string, number>();
    const templateFirstMainImage = new Map<string, string>();
    
    for (const { workout } of results) {
      const allBlocks = await db
        .select({ id: programmeWorkoutBlocks.id, section: programmeWorkoutBlocks.section, position: programmeWorkoutBlocks.position })
        .from(programmeWorkoutBlocks)
        .where(eq(programmeWorkoutBlocks.workoutId, workout.id))
        .orderBy(asc(programmeWorkoutBlocks.position));
      
      let mainCount = 0;
      let totalCount = 0;
      for (const block of allBlocks) {
        const exercises = await db
          .select({
            id: programmeBlockExercises.id,
            position: programmeBlockExercises.position,
            exerciseLibraryId: programmeBlockExercises.exerciseLibraryId,
          })
          .from(programmeBlockExercises)
          .where(eq(programmeBlockExercises.blockId, block.id))
          .orderBy(asc(programmeBlockExercises.position));
        totalCount += exercises.length;
        if (block.section === 'main') {
          mainCount += exercises.length;
          if (!templateFirstMainImage.has(workout.name) && exercises.length > 0) {
            const firstEx = exercises[0];
            if (firstEx.exerciseLibraryId) {
              const libEntry = await this.getExerciseById(firstEx.exerciseLibraryId);
              if (libEntry) {
                const img = libEntry.imageUrl || (libEntry.muxPlaybackId ? `https://image.mux.com/${libEntry.muxPlaybackId}/thumbnail.jpg?width=128` : null);
                if (img) {
                  templateFirstMainImage.set(workout.name, img);
                }
              }
            }
          }
        }
      }
      
      const currentMainMax = templateExerciseCounts.get(workout.name) || 0;
      templateExerciseCounts.set(workout.name, Math.max(currentMainMax, mainCount));
      const currentTotalMax = templateTotalExerciseCounts.get(workout.name) || 0;
      templateTotalExerciseCounts.set(workout.name, Math.max(currentTotalMax, totalCount));
    }
    
    const workoutsWithDetails = results.map(({ workout, weekNumber, dayPosition }) => {
      const exerciseCount = templateExerciseCounts.get(workout.name) || 0;
      const totalExercises = templateTotalExerciseCounts.get(workout.name) || 0;
      const estimatedDuration = Math.round(totalExercises * 1.75);
      const firstMainExerciseImage = templateFirstMainImage.get(workout.name) || null;
      
      return {
        ...workout,
        weekNumber,
        dayNumber: dayPosition + 1,
        exerciseCount,
        estimatedDuration,
        imageUrl: firstMainExerciseImage || workout.imageUrl,
      };
    });
    
    return workoutsWithDetails;
  }

  // Helper to update programme's trainingDaysPerWeek based on unique workout names
  private async updateProgrammeTrainingDays(programId: number): Promise<void> {
    // Count unique occupied day positions in week 1 (days that have at least one workout)
    const week1 = await db
      .select({ id: programWeeks.id })
      .from(programWeeks)
      .where(and(eq(programWeeks.programId, programId), eq(programWeeks.weekNumber, 1)))
      .limit(1);
    
    let trainingDaysPerWeek = 0;
    if (week1.length > 0) {
      const days = await db
        .select({ id: programDays.id, position: programDays.position })
        .from(programDays)
        .where(eq(programDays.weekId, week1[0].id));
      
      const occupiedPositions = new Set<number>();
      for (const d of days) {
        const wos = await db.select({ id: programmeWorkouts.id })
          .from(programmeWorkouts)
          .where(eq(programmeWorkouts.dayId, d.id))
          .limit(1);
        if (wos.length > 0) occupiedPositions.add(d.position);
      }
      trainingDaysPerWeek = occupiedPositions.size;
    }
    
    await db
      .update(programs)
      .set({ trainingDaysPerWeek })
      .where(eq(programs.id, programId));
  }

  // Create a new programme workout - places it on the same day as the original (targetDayPosition)
  // so it doesn't add a new training day to the schedule.
  async createProgrammeWorkout(programId: number, workout: { 
    name: string; 
    description?: string;
    workoutType?: string;
    category?: string;
    difficulty?: string;
    duration?: number;
    intervalRounds?: number;
    intervalRestAfterRound?: string;
    targetDayPosition?: number; // day position to place the workout (same as original)
  }): Promise<any> {
    // Get all weeks for this programme
    const weeks = await db
      .select()
      .from(programWeeks)
      .where(eq(programWeeks.programId, programId))
      .orderBy(asc(programWeeks.weekNumber));
    
    if (weeks.length === 0) {
      const [newWeek] = await db
        .insert(programWeeks)
        .values({ programId, weekNumber: 1 })
        .returning();
      weeks.push(newWeek);
    }

    // Use the provided targetDayPosition, or fall back to the first occupied day in week 1
    let targetDayPos = workout.targetDayPosition ?? null;
    if (targetDayPos === null) {
      const week1Days = await db
        .select({ id: programDays.id, position: programDays.position })
        .from(programDays)
        .where(eq(programDays.weekId, weeks[0].id))
        .orderBy(asc(programDays.position));
      for (const d of week1Days) {
        const wos = await db.select({ id: programmeWorkouts.id })
          .from(programmeWorkouts).where(eq(programmeWorkouts.dayId, d.id));
        if (wos.length > 0) { targetDayPos = d.position; break; }
      }
      targetDayPos = targetDayPos ?? 1;
    }

    let firstCreated: any = null;

    for (const week of weeks) {
      // Find the day at targetDayPos in this week
      const weekDays = await db
        .select({ id: programDays.id, position: programDays.position })
        .from(programDays)
        .where(eq(programDays.weekId, week.id))
        .orderBy(asc(programDays.position));

      let targetDay = weekDays.find(d => d.position === targetDayPos);
      if (!targetDay) {
        // Create day at this position if missing
        const [newDay] = await db.insert(programDays)
          .values({ weekId: week.id, position: targetDayPos! })
          .returning();
        targetDay = newDay;
      }

      // Find max position among existing workouts on this day to avoid conflicts
      const existingOnDay = await db.select({ position: programmeWorkouts.position })
        .from(programmeWorkouts).where(eq(programmeWorkouts.dayId, targetDay.id));
      const nextPos = existingOnDay.length > 0
        ? Math.max(...existingOnDay.map(w => w.position ?? 0)) + 1
        : 0;

      const [created] = await db
        .insert(programmeWorkouts)
        .values({
          dayId: targetDay.id,
          name: workout.name,
          description: workout.description || null,
          workoutType: workout.workoutType || 'regular',
          category: workout.category || 'strength',
          difficulty: workout.difficulty || 'beginner',
          duration: workout.duration || 30,
          intervalRounds: workout.intervalRounds || 4,
          intervalRestAfterRound: workout.intervalRestAfterRound || '60 sec',
          position: nextPos,
        })
        .returning();

      if (!firstCreated) firstCreated = { ...created, dayId: targetDay.id, dayPosition: targetDay.position };
    }

    // Update the programme's trainingDaysPerWeek
    await this.updateProgrammeTrainingDays(programId);
    
    return firstCreated;
  }

  // Get a single programme workout by ID
  async getProgrammeWorkoutById(id: number): Promise<ProgrammeWorkout | undefined> {
    const [workout] = await db
      .select()
      .from(programmeWorkouts)
      .where(eq(programmeWorkouts.id, id));
    return workout;
  }

  // Update a programme workout's details
  async updateProgrammeWorkout(id: number, updates: { 
    name?: string; 
    description?: string | null;
    workoutType?: string;
    category?: string;
    difficulty?: string;
    duration?: number;
    intervalRounds?: number;
    intervalRestAfterRound?: string;
  }): Promise<ProgrammeWorkout> {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.workoutType !== undefined) updateData.workoutType = updates.workoutType;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.difficulty !== undefined) updateData.difficulty = updates.difficulty;
    if (updates.duration !== undefined) updateData.duration = updates.duration;
    if (updates.intervalRounds !== undefined) updateData.intervalRounds = updates.intervalRounds;
    if (updates.intervalRestAfterRound !== undefined) updateData.intervalRestAfterRound = updates.intervalRestAfterRound;
    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(programmeWorkouts)
      .set(updateData)
      .where(eq(programmeWorkouts.id, id))
      .returning();
    return updated;
  }

  // Delete a programme workout and all its blocks/exercises
  async deleteProgrammeWorkout(workoutId: number): Promise<void> {
    // First, get the programId from the workout
    const [workout] = await db
      .select()
      .from(programmeWorkouts)
      .where(eq(programmeWorkouts.id, workoutId));
    
    if (!workout) return;
    
    // Get the day to find the week
    const [day] = await db
      .select()
      .from(programDays)
      .where(eq(programDays.id, workout.dayId));
    
    if (!day) return;
    
    // Get the week to find the programId
    const [week] = await db
      .select()
      .from(programWeeks)
      .where(eq(programWeeks.id, day.weekId));
    
    if (!week) return;
    
    const programId = week.programId;
    
    // The cascade will handle blocks and exercises due to schema constraints
    await db
      .delete(programmeWorkouts)
      .where(eq(programmeWorkouts.id, workoutId));
    
    // Update the programme's trainingDaysPerWeek
    await this.updateProgrammeTrainingDays(programId);
  }

  // Get workout templates grouped by name for a programme
  async getProgrammeWorkoutTemplates(programId: number): Promise<any[]> {
    const allWorkouts = await this.getProgrammeWorkouts(programId);
    
    // Group by name
    const templateMap = new Map<string, any>();
    
    for (const workout of allWorkouts) {
      if (!templateMap.has(workout.name)) {
        templateMap.set(workout.name, {
          name: workout.name,
          canonicalWorkoutId: workout.id,
          allWorkoutIds: [workout.id],
          exerciseCount: workout.exerciseCount,
          instances: [{
            workoutId: workout.id,
            weekNumber: workout.weekNumber,
            dayNumber: workout.dayNumber,
          }],
        });
      } else {
        const template = templateMap.get(workout.name)!;
        template.allWorkoutIds.push(workout.id);
        template.instances.push({
          workoutId: workout.id,
          weekNumber: workout.weekNumber,
          dayNumber: workout.dayNumber,
        });
        // Use the max exercise count from any instance
        if (workout.exerciseCount > template.exerciseCount) {
          template.exerciseCount = workout.exerciseCount;
          template.canonicalWorkoutId = workout.id;
        }
      }
    }
    
    return Array.from(templateMap.values());
  }

  // Save blocks to ALL workouts with the same name in one transaction
  async batchUpdateAllSameNamedWorkouts(workoutId: number, programId: number, blocks: any[]): Promise<any[]> {
    // Get the source workout name
    const [sourceWorkout] = await db
      .select()
      .from(programmeWorkouts)
      .where(eq(programmeWorkouts.id, workoutId));
    
    if (!sourceWorkout) {
      throw new Error('Workout not found');
    }
    
    // Get all workouts in this programme with the same name
    const allWorkouts = await db
      .select({ workout: programmeWorkouts })
      .from(programmeWorkouts)
      .innerJoin(programDays, eq(programmeWorkouts.dayId, programDays.id))
      .innerJoin(programWeeks, eq(programDays.weekId, programWeeks.id))
      .where(eq(programWeeks.programId, programId));
    
    const sameNamedWorkouts = allWorkouts
      .filter(w => w.workout.name === sourceWorkout.name)
      .map(w => w.workout);
    
    let savedBlocks: any[] = [];
    
    // Process each workout and collect all operations
    for (const targetWorkout of sameNamedWorkouts) {
      // Delete existing blocks for this workout
      const existingBlocks = await db
        .select({ id: programmeWorkoutBlocks.id })
        .from(programmeWorkoutBlocks)
        .where(eq(programmeWorkoutBlocks.workoutId, targetWorkout.id));
      
      for (const existingBlock of existingBlocks) {
        await db.delete(programmeBlockExercises).where(eq(programmeBlockExercises.blockId, existingBlock.id));
      }
      await db.delete(programmeWorkoutBlocks).where(eq(programmeWorkoutBlocks.workoutId, targetWorkout.id));
      
      // Create new blocks
      const createdBlocks: any[] = [];
      for (const block of blocks) {
        const [createdBlock] = await db.insert(programmeWorkoutBlocks).values({
          workoutId: targetWorkout.id,
          blockType: block.blockType,
          section: block.section,
          position: block.position,
          rest: block.rest || 'No Rest',
          rounds: block.rounds,
          restAfterRound: block.restAfterRound,
        }).returning();
        
        const createdExercises: any[] = [];
        for (const exercise of block.exercises || []) {
          const [createdExercise] = await db.insert(programmeBlockExercises).values({
            blockId: createdBlock.id,
            exerciseLibraryId: exercise.exerciseLibraryId,
            position: exercise.position,
            sets: exercise.sets || [{ reps: '8-12', rest: 'No Rest' }],
            durationType: exercise.durationType || 'text',
            tempo: exercise.tempo,
            load: exercise.load,
            notes: exercise.notes,
          }).returning();
          
          createdExercises.push({
            ...createdExercise,
            exerciseName: exercise.exerciseName,
            imageUrl: exercise.imageUrl,
          });
        }
        
        createdBlocks.push({
          ...createdBlock,
          exercises: createdExercises,
        });
      }
      
      // Return the blocks from the original workout
      if (targetWorkout.id === workoutId) {
        savedBlocks = createdBlocks;
      }
    }
    
    console.log(`Synced ${blocks.length} blocks to ${sameNamedWorkouts.length} workouts named "${sourceWorkout.name}"`);
    return savedBlocks;
  }

  // Get a single programme workout by ID
  async getProgrammeWorkoutById(id: number): Promise<ProgrammeWorkout | undefined> {
    const [workout] = await db.select().from(programmeWorkouts).where(eq(programmeWorkouts.id, id));
    return workout;
  }

  // Schedule a workout for a future date
  async scheduleWorkout(userId: string, workoutId: number, workoutType: 'individual' | 'programme', workoutName: string, scheduledDate: Date): Promise<ScheduledWorkout> {
    const [scheduled] = await db
      .insert(scheduledWorkouts)
      .values({
        userId,
        workoutId,
        workoutType,
        workoutName,
        scheduledDate,
      })
      .returning();
    return scheduled;
  }

  // Get scheduled workouts for a user within a date range
  async getScheduledWorkouts(userId: string, fromDate?: Date, toDate?: Date): Promise<ScheduledWorkout[]> {
    let query = db.select().from(scheduledWorkouts).where(eq(scheduledWorkouts.userId, userId));
    
    if (fromDate && toDate) {
      query = query.where(and(gte(scheduledWorkouts.scheduledDate, fromDate), lte(scheduledWorkouts.scheduledDate, toDate)));
    }
    
    return await query.orderBy(asc(scheduledWorkouts.scheduledDate));
  }

  // Get scheduled workouts for a specific date
  async getScheduledWorkoutsForDate(userId: string, date: Date): Promise<ScheduledWorkout[]> {
    // Normalize to UTC midnight to handle timezones properly
    const targetDate = new Date(date);
    targetDate.setUTCHours(0, 0, 0, 0);
    
    const dayStart = targetDate;
    const dayEnd = new Date(targetDate);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    
    return await db
      .select()
      .from(scheduledWorkouts)
      .where(
        and(
          eq(scheduledWorkouts.userId, userId),
          gte(scheduledWorkouts.scheduledDate, dayStart),
          lt(scheduledWorkouts.scheduledDate, dayEnd)
        )
      );
  }

  // Get scheduled workouts within a date range
  async getScheduledWorkoutsInRange(userId: string, startDate: Date, endDate: Date): Promise<ScheduledWorkout[]> {
    const start = new Date(startDate);
    start.setUTCHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);
    
    return await db
      .select()
      .from(scheduledWorkouts)
      .where(
        and(
          eq(scheduledWorkouts.userId, userId),
          gte(scheduledWorkouts.scheduledDate, start),
          lte(scheduledWorkouts.scheduledDate, end)
        )
      );
  }

  // Get programme workouts within a date range - unified method for all calendar views
  // This queries actual multi-week enrollment data and handles date overrides
  async getProgrammeWorkoutsInRange(userId: string, startDate: Date, endDate: Date): Promise<any[]> {
    // Get user's active and scheduled enrollments
    const enrollments = await db
      .select()
      .from(userProgramEnrollments)
      .where(
        and(
          eq(userProgramEnrollments.userId, userId),
          inArray(userProgramEnrollments.status, ['active', 'scheduled'])
        )
      );
    
    if (enrollments.length === 0) return [];
    
    const results: any[] = [];
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    for (const enrollment of enrollments) {
      if (!enrollment.startDate) continue;
      
      const enrollmentStart = new Date(enrollment.startDate);
      
      // Get program details
      const [program] = await db
        .select({ weeks: programs.weeks, name: programs.title })
        .from(programs)
        .where(eq(programs.id, enrollment.programId));
      
      if (!program) continue;
      
      // Get ALL enrollment workouts for this enrollment (all weeks)
      const workouts = await db
        .select()
        .from(enrollmentWorkouts)
        .where(eq(enrollmentWorkouts.enrollmentId, enrollment.id));
      
      // Process each workout and calculate its date
      for (const workout of workouts) {
        if (!workout.dayNumber || !workout.weekNumber) continue;
        
        // Use scheduledDateOverride if present, otherwise calculate from week/day
        let workoutDate: Date;
        if (workout.scheduledDateOverride) {
          workoutDate = new Date(workout.scheduledDateOverride);
        } else {
          const dayOffset = (workout.weekNumber - 1) * 7 + (workout.dayNumber - 1);
          workoutDate = new Date(enrollmentStart);
          workoutDate.setDate(workoutDate.getDate() + dayOffset);
        }
        
        workoutDate.setHours(0, 0, 0, 0);
        
        if (workoutDate >= start && workoutDate <= end) {
          results.push({
            id: workout.id,
            enrollmentId: enrollment.id,
            enrollmentWorkoutId: workout.id,
            scheduledDate: workoutDate.toISOString(),
            workoutName: workout.name,
            workoutType: 'programme',
            isProgrammeWorkout: true,
            programName: program.name,
            week: workout.weekNumber,
            day: workout.dayNumber,
            category: workout.category,
            difficulty: workout.difficulty,
            duration: workout.duration,
          });
        }
      }
      
      // Also include extra sessions
      const extraSessions = await db
        .select()
        .from(userExtraWorkoutSessions)
        .where(
          and(
            eq(userExtraWorkoutSessions.enrollmentId, enrollment.id),
            gte(userExtraWorkoutSessions.scheduledDate, start),
            lte(userExtraWorkoutSessions.scheduledDate, end)
          )
        );
      
      for (const extra of extraSessions) {
        // Find the corresponding workout to get its name
        const [templateWorkout] = await db
          .select()
          .from(enrollmentWorkouts)
          .where(
            and(
              eq(enrollmentWorkouts.enrollmentId, enrollment.id),
              eq(enrollmentWorkouts.dayNumber, extra.dayPosition),
              eq(enrollmentWorkouts.weekNumber, 1)
            )
          )
          .limit(1);
        
        results.push({
          id: `extra-${extra.id}`,
          enrollmentId: enrollment.id,
          extraSessionId: extra.id,
          scheduledDate: extra.scheduledDate.toISOString(),
          workoutName: templateWorkout?.name || 'Extra Session',
          workoutType: 'programme',
          isProgrammeWorkout: true,
          isExtraSession: true,
          programName: program.name,
          week: null,
          day: extra.dayPosition,
        });
      }
    }
    
    return results;
  }

  // Move a scheduled workout to a different date (calendar override only - does not affect programme template)
  async moveScheduledWorkout(userId: string, scheduledWorkoutId: number, newDate: Date): Promise<ScheduledWorkout | null> {
    // First verify the workout belongs to this user
    const [existing] = await db
      .select()
      .from(scheduledWorkouts)
      .where(
        and(
          eq(scheduledWorkouts.id, scheduledWorkoutId),
          eq(scheduledWorkouts.userId, userId)
        )
      );
    
    if (!existing) return null;
    
    // Update the scheduled date
    const [updated] = await db
      .update(scheduledWorkouts)
      .set({ scheduledDate: newDate })
      .where(eq(scheduledWorkouts.id, scheduledWorkoutId))
      .returning();
    
    return updated;
  }
  
  // Move an enrollment workout to a different date (individual workout move - only affects this specific week)
  async moveEnrollmentWorkout(userId: string, enrollmentWorkoutId: number, newDate: Date): Promise<any | null> {
    // First verify the enrollment workout belongs to this user
    const [enrollmentWorkout] = await db
      .select({
        id: enrollmentWorkouts.id,
        enrollmentId: enrollmentWorkouts.enrollmentId,
        name: enrollmentWorkouts.name,
        weekNumber: enrollmentWorkouts.weekNumber,
        dayNumber: enrollmentWorkouts.dayNumber,
      })
      .from(enrollmentWorkouts)
      .where(eq(enrollmentWorkouts.id, enrollmentWorkoutId));
    
    if (!enrollmentWorkout) return null;
    
    // Verify the enrollment belongs to this user
    const [enrollment] = await db
      .select()
      .from(userProgramEnrollments)
      .where(
        and(
          eq(userProgramEnrollments.id, enrollmentWorkout.enrollmentId),
          eq(userProgramEnrollments.userId, userId)
        )
      );
    
    if (!enrollment) return null;
    
    // Update only the scheduledDateOverride - this moves just this specific workout instance
    const [updated] = await db
      .update(enrollmentWorkouts)
      .set({ scheduledDateOverride: newDate })
      .where(eq(enrollmentWorkouts.id, enrollmentWorkoutId))
      .returning();
    
    return updated;
  }
  
  // Clear the date override for an enrollment workout (revert to original schedule)
  async revertEnrollmentWorkoutMove(userId: string, enrollmentWorkoutId: number): Promise<any | null> {
    const [enrollmentWorkout] = await db
      .select({
        id: enrollmentWorkouts.id,
        enrollmentId: enrollmentWorkouts.enrollmentId,
      })
      .from(enrollmentWorkouts)
      .where(eq(enrollmentWorkouts.id, enrollmentWorkoutId));
    
    if (!enrollmentWorkout) return null;
    
    const [enrollment] = await db
      .select()
      .from(userProgramEnrollments)
      .where(
        and(
          eq(userProgramEnrollments.id, enrollmentWorkout.enrollmentId),
          eq(userProgramEnrollments.userId, userId)
        )
      );
    
    if (!enrollment) return null;
    
    const [updated] = await db
      .update(enrollmentWorkouts)
      .set({ scheduledDateOverride: null })
      .where(eq(enrollmentWorkouts.id, enrollmentWorkoutId))
      .returning();
    
    return updated;
  }

  // Delete a scheduled workout
  async deleteScheduledWorkout(userId: string, scheduledWorkoutId: number): Promise<void> {
    await db
      .delete(scheduledWorkouts)
      .where(
        and(
          eq(scheduledWorkouts.id, scheduledWorkoutId),
          eq(scheduledWorkouts.userId, userId)
        )
      );
  }

  // ============================================
  // Workout Block Operations (superset, triset, circuit)
  // ============================================

  async createWorkoutBlock(block: InsertWorkoutBlock): Promise<WorkoutBlock> {
    const [created] = await db.insert(workoutBlocks).values(block).returning();
    return created;
  }

  async getWorkoutBlocks(workoutId: number): Promise<WorkoutBlock[]> {
    return await db
      .select()
      .from(workoutBlocks)
      .where(eq(workoutBlocks.workoutId, workoutId))
      .orderBy(asc(workoutBlocks.position));
  }

  async updateWorkoutBlock(id: number, block: Partial<InsertWorkoutBlock>): Promise<WorkoutBlock> {
    const [updated] = await db
      .update(workoutBlocks)
      .set(block)
      .where(eq(workoutBlocks.id, id))
      .returning();
    return updated;
  }

  async deleteWorkoutBlock(id: number): Promise<void> {
    await db.delete(workoutBlocks).where(eq(workoutBlocks.id, id));
  }

  async deleteWorkoutBlocksByWorkoutId(workoutId: number): Promise<void> {
    await db.delete(workoutBlocks).where(eq(workoutBlocks.workoutId, workoutId));
  }

  // Programme workout block methods - uses ONLY block-based tables (legacy removed)
  async getProgrammeWorkoutBlocks(workoutId: number): Promise<any[]> {
    // Helper function to get blocks with exercises for a workout
    const getBlocksWithExercises = async (wId: number) => {
      const blocks = await db
        .select()
        .from(programmeWorkoutBlocks)
        .where(eq(programmeWorkoutBlocks.workoutId, wId))
        .orderBy(asc(programmeWorkoutBlocks.position));
      
      if (blocks.length === 0) return [];
      
      const blocksWithExercises = await Promise.all(
        blocks.map(async (block) => {
          const exercises = await db
            .select({
              id: programmeBlockExercises.id,
              blockId: programmeBlockExercises.blockId,
              exerciseLibraryId: programmeBlockExercises.exerciseLibraryId,
              position: programmeBlockExercises.position,
              sets: programmeBlockExercises.sets,
              durationType: programmeBlockExercises.durationType,
              tempo: programmeBlockExercises.tempo,
              load: programmeBlockExercises.load,
              notes: programmeBlockExercises.notes,
              exerciseName: exerciseLibrary.name,
              imageUrl: exerciseLibrary.imageUrl,
              muxPlaybackId: exerciseLibrary.muxPlaybackId,
              equipment: exerciseLibrary.equipment,
            })
            .from(programmeBlockExercises)
            .leftJoin(exerciseLibrary, eq(programmeBlockExercises.exerciseLibraryId, exerciseLibrary.id))
            .where(eq(programmeBlockExercises.blockId, block.id))
            .orderBy(asc(programmeBlockExercises.position));
          
          return { ...block, exercises };
        })
      );
      
      return blocksWithExercises;
    };
    
    // First try this specific workout instance
    let blocksWithExercises = await getBlocksWithExercises(workoutId);
    const hasExercises = blocksWithExercises.some(b => b.exercises.length > 0);
    
    if (hasExercises) {
      return blocksWithExercises;
    }
    
    // If this instance has no exercises, look for blocks in other workouts with the same template name
    const workout = await db.select().from(programmeWorkouts).where(eq(programmeWorkouts.id, workoutId)).limit(1);
    if (workout.length === 0) return [];
    
    const workoutName = workout[0].name;
    const day = await db.select().from(programDays).where(eq(programDays.id, workout[0].dayId)).limit(1);
    if (day.length === 0) return [];
    
    const week = await db.select().from(programWeeks).where(eq(programWeeks.id, day[0].weekId)).limit(1);
    if (week.length === 0) return [];
    
    // Find all workouts with the same name in this program
    const allWorkoutsWithName = await db
      .select({ id: programmeWorkouts.id })
      .from(programmeWorkouts)
      .innerJoin(programDays, eq(programmeWorkouts.dayId, programDays.id))
      .innerJoin(programWeeks, eq(programDays.weekId, programWeeks.id))
      .where(and(
        eq(programWeeks.programId, week[0].programId),
        eq(programmeWorkouts.name, workoutName)
      ));
    
    // Look for block exercises in any sibling workout
    for (const w of allWorkoutsWithName) {
      if (w.id === workoutId) continue; // Skip current workout, already checked
      
      const siblingBlocks = await getBlocksWithExercises(w.id);
      const siblingHasExercises = siblingBlocks.some(b => b.exercises.length > 0);
      
      if (siblingHasExercises) {
        return siblingBlocks;
      }
    }
    
    return [];
  }

  // Get active substitution mappings for an enrollment (for applying at read-time)
  // Aggregates all accepted modifications, using the most recent substitution per exercise instance
  async getActiveSubstitutionMappings(enrollmentId: number): Promise<Map<number, {substitutedExerciseId: number, exerciseName: string, imageUrl: string | null, muxPlaybackId: string | null}>> {
    // Get all active (non-archived) accepted modification records for this enrollment
    // Records with clearedAt set are considered archived/historical
    const acceptedRecords = await db
      .select({ id: programmeModificationRecords.id })
      .from(programmeModificationRecords)
      .where(and(
        eq(programmeModificationRecords.mainProgrammeEnrollmentId, enrollmentId),
        eq(programmeModificationRecords.status, 'accepted'),
        isNull(programmeModificationRecords.clearedAt) // Only active records
      ));
    
    if (acceptedRecords.length === 0) {
      return new Map();
    }
    
    const recordIds = acceptedRecords.map(r => r.id);
    
    // Get all substitution mappings for all accepted records (exclude restored ones)
    // Order by createdAt desc so we can use the most recent per exercise instance
    const mappings = await db
      .select({
        exerciseInstanceId: exerciseSubstitutionMappings.exerciseInstanceId,
        substitutedExerciseId: exerciseSubstitutionMappings.substitutedExerciseId,
        createdAt: exerciseSubstitutionMappings.createdAt,
        exerciseName: exerciseLibrary.name,
        imageUrl: exerciseLibrary.imageUrl,
        muxPlaybackId: exerciseLibrary.muxPlaybackId,
      })
      .from(exerciseSubstitutionMappings)
      .leftJoin(exerciseLibrary, eq(exerciseSubstitutionMappings.substitutedExerciseId, exerciseLibrary.id))
      .where(and(
        inArray(exerciseSubstitutionMappings.modificationRecordId, recordIds),
        eq(exerciseSubstitutionMappings.isRestored, false) // Exclude restored substitutions
      ))
      .orderBy(desc(exerciseSubstitutionMappings.createdAt));
    
    // Use Map to keep only the most recent substitution per exercise instance
    const result = new Map<number, {substitutedExerciseId: number, exerciseName: string, imageUrl: string | null, muxPlaybackId: string | null}>();
    for (const m of mappings) {
      // Only set if not already in map (first occurrence is most recent due to desc ordering)
      if (!result.has(m.exerciseInstanceId)) {
        result.set(m.exerciseInstanceId, {
          substitutedExerciseId: m.substitutedExerciseId,
          exerciseName: m.exerciseName || '',
          imageUrl: m.imageUrl,
          muxPlaybackId: m.muxPlaybackId,
        });
      }
    }
    return result;
  }

  // Step 5: Get restorable substitutions for a user based on body area
  // Returns substitutions that were applied due to a body map outcome for this body area
  // and are not yet restored
  async getRestorableSubstitutions(userId: string, bodyAreaName: string): Promise<{
    modificationRecordId: number;
    matchedOutcomeId: number;
    substitutions: Array<{
      id: number;
      exerciseInstanceId: number;
      originalExerciseId: number;
      originalExerciseName: string;
      originalImageUrl: string | null;
      substitutedExerciseId: number;
      substitutedExerciseName: string;
      substitutedImageUrl: string | null;
      workoutName: string;
    }>;
  } | null> {
    // Find body area by name
    const [area] = await db.select().from(bodyMapAreas).where(eq(bodyMapAreas.name, bodyAreaName)).limit(1);
    if (!area) return null;

    // Find outcomes for this body area that have programme impact
    const areaOutcomes = await db.select({ id: bodyMapOutcomes.id })
      .from(bodyMapOutcomes)
      .where(eq(bodyMapOutcomes.bodyAreaId, area.id));
    
    if (areaOutcomes.length === 0) return null;
    const outcomeIds = areaOutcomes.map(o => o.id);

    // Find the user's active programme enrollment
    const enrollments = await this.getUserEnrolledPrograms(userId);
    const mainEnrollment = enrollments.find(e => e.programType === 'main' && e.status === 'active');
    if (!mainEnrollment) return null;

    // Find accepted modification records for this user/enrollment that match these outcomes
    // and are not yet cleared
    const records = await db.select()
      .from(programmeModificationRecords)
      .where(and(
        eq(programmeModificationRecords.userId, userId),
        eq(programmeModificationRecords.mainProgrammeEnrollmentId, mainEnrollment.id),
        eq(programmeModificationRecords.status, 'accepted'),
        inArray(programmeModificationRecords.matchedOutcomeId, outcomeIds),
        isNull(programmeModificationRecords.clearedAt) // Not yet cleared
      ))
      .orderBy(desc(programmeModificationRecords.createdAt))
      .limit(1);

    if (records.length === 0) return null;
    const record = records[0];

    // Get non-restored substitution mappings for this modification record
    // Filter to only week 1 exercises by joining with enrollmentWorkouts
    const originalExerciseAlias = aliasedTable(exerciseLibrary, 'original_exercise');
    const substitutedExerciseAlias = aliasedTable(exerciseLibrary, 'substituted_exercise');
    
    const mappings = await db
      .select({
        id: exerciseSubstitutionMappings.id,
        exerciseInstanceId: exerciseSubstitutionMappings.exerciseInstanceId,
        originalExerciseId: exerciseSubstitutionMappings.originalExerciseId,
        originalExerciseName: originalExerciseAlias.name,
        originalImageUrl: originalExerciseAlias.imageUrl,
        originalMuxPlaybackId: originalExerciseAlias.muxPlaybackId,
        substitutedExerciseId: exerciseSubstitutionMappings.substitutedExerciseId,
        substitutedExerciseName: substitutedExerciseAlias.name,
        substitutedImageUrl: substitutedExerciseAlias.imageUrl,
        substitutedMuxPlaybackId: substitutedExerciseAlias.muxPlaybackId,
        workoutId: exerciseSubstitutionMappings.workoutId,
        workoutName: enrollmentWorkouts.name,
      })
      .from(exerciseSubstitutionMappings)
      .innerJoin(enrollmentWorkouts, and(
        eq(exerciseSubstitutionMappings.workoutId, enrollmentWorkouts.templateWorkoutId),
        eq(enrollmentWorkouts.enrollmentId, mainEnrollment.id),
        eq(enrollmentWorkouts.weekNumber, 1) // Only week 1
      ))
      .leftJoin(originalExerciseAlias, eq(exerciseSubstitutionMappings.originalExerciseId, originalExerciseAlias.id))
      .leftJoin(substitutedExerciseAlias, eq(exerciseSubstitutionMappings.substitutedExerciseId, substitutedExerciseAlias.id))
      .where(and(
        eq(exerciseSubstitutionMappings.modificationRecordId, record.id),
        eq(exerciseSubstitutionMappings.isRestored, false)
      ));

    if (mappings.length === 0) return null;

    // Helper to get thumbnail URL - prefer imageUrl, fallback to Mux thumbnail
    const getThumbnailUrl = (imageUrl: string | null, muxPlaybackId: string | null): string | null => {
      if (imageUrl) return imageUrl;
      if (muxPlaybackId) return `https://image.mux.com/${muxPlaybackId}/thumbnail.jpg?width=200&height=200&fit_mode=smartcrop`;
      return null;
    };

    return {
      modificationRecordId: record.id,
      matchedOutcomeId: record.matchedOutcomeId,
      substitutions: mappings.map(m => ({
        id: m.id,
        exerciseInstanceId: m.exerciseInstanceId,
        originalExerciseId: m.originalExerciseId,
        originalExerciseName: m.originalExerciseName || 'Unknown',
        originalImageUrl: getThumbnailUrl(m.originalImageUrl, m.originalMuxPlaybackId),
        substitutedExerciseId: m.substitutedExerciseId,
        substitutedExerciseName: m.substitutedExerciseName || 'Unknown',
        substitutedImageUrl: getThumbnailUrl(m.substitutedImageUrl, m.substitutedMuxPlaybackId),
        workoutName: m.workoutName || 'Unknown Workout',
      })),
    };
  }

  // Step 5: Restore substitutions by marking them as restored (supports selective restore)
  async restoreSubstitutionsByOutcome(
    userId: string, 
    matchedOutcomeId: number, 
    bodyMapLogId: number,
    mappingIdsToRestore?: number[],
    modificationRecordId?: number
  ): Promise<{ restoredCount: number; keptCount: number }> {
    console.log('restoreSubstitutionsByOutcome called:', { userId, matchedOutcomeId, bodyMapLogId, mappingIdsToRestore, modificationRecordId });
    
    // Find the user's active programme enrollment
    const enrollments = await this.getUserEnrolledPrograms(userId);
    const mainEnrollment = enrollments.find(e => e.programType === 'main' && e.status === 'active');
    if (!mainEnrollment) {
      console.log('No active main enrollment found');
      return { restoredCount: 0, keptCount: 0 };
    }

    let record;
    
    // If modificationRecordId is provided, use it directly (more reliable)
    if (modificationRecordId) {
      const [directRecord] = await db.select()
        .from(programmeModificationRecords)
        .where(and(
          eq(programmeModificationRecords.id, modificationRecordId),
          eq(programmeModificationRecords.userId, userId),
          eq(programmeModificationRecords.status, 'accepted')
        ))
        .limit(1);
      record = directRecord;
      console.log('Using direct record ID:', modificationRecordId, 'found:', !!record);
    }
    
    // Fallback to finding by outcome ID
    if (!record) {
      const records = await db.select()
        .from(programmeModificationRecords)
        .where(and(
          eq(programmeModificationRecords.userId, userId),
          eq(programmeModificationRecords.mainProgrammeEnrollmentId, mainEnrollment.id),
          eq(programmeModificationRecords.matchedOutcomeId, matchedOutcomeId),
          eq(programmeModificationRecords.status, 'accepted')
        ))
        .orderBy(desc(programmeModificationRecords.createdAt))
        .limit(1);

      if (records.length === 0) {
        console.log('No modification records found');
        return { restoredCount: 0, keptCount: 0 };
      }
      record = records[0];
    }
    
    console.log('Using record:', record.id, 'cleared:', record.clearedAt);

    // Get all non-restored mappings for this record
    const allMappings = await db.select({ id: exerciseSubstitutionMappings.id })
      .from(exerciseSubstitutionMappings)
      .where(and(
        eq(exerciseSubstitutionMappings.modificationRecordId, record.id),
        eq(exerciseSubstitutionMappings.isRestored, false)
      ));
    console.log('All non-restored mappings for record:', allMappings.map(m => m.id));

    let restoredCount = 0;
    let keptCount = 0;

    if (mappingIdsToRestore && mappingIdsToRestore.length > 0) {
      console.log('Selective restore - requested mapping IDs:', mappingIdsToRestore);
      
      // Get the original exercise IDs from the selected mappings
      // We'll restore ALL mappings for these exercises across ALL weeks AND ALL modification records
      const selectedMappings = await db.select({
        originalExerciseId: exerciseSubstitutionMappings.originalExerciseId
      })
        .from(exerciseSubstitutionMappings)
        .where(inArray(exerciseSubstitutionMappings.id, mappingIdsToRestore));
      
      const originalExerciseIds = [...new Set(selectedMappings.map(m => m.originalExerciseId))];
      console.log('Original exercise IDs to restore across all weeks and records:', originalExerciseIds);
      
      // Get ALL modification record IDs for this enrollment (not just the current one)
      const allRecordsForEnrollment = await db.select({ id: programmeModificationRecords.id })
        .from(programmeModificationRecords)
        .where(and(
          eq(programmeModificationRecords.mainProgrammeEnrollmentId, mainEnrollment.id),
          eq(programmeModificationRecords.status, 'accepted')
        ));
      const allRecordIds = allRecordsForEnrollment.map(r => r.id);
      console.log('All modification record IDs for enrollment:', allRecordIds);
      
      // Restore ALL mappings for these original exercises across ALL modification records
      const result = await db.update(exerciseSubstitutionMappings)
        .set({ 
          isRestored: true, 
          restoredAt: new Date() 
        })
        .where(and(
          inArray(exerciseSubstitutionMappings.modificationRecordId, allRecordIds),
          eq(exerciseSubstitutionMappings.isRestored, false),
          inArray(exerciseSubstitutionMappings.originalExerciseId, originalExerciseIds)
        ))
        .returning();
      
      console.log('Updated mappings result:', result.length, 'rows (across all weeks and records)');
      restoredCount = result.length;
      
      // Re-check how many active mappings remain for this record after restoration
      const remainingMappings = await db.select({ id: exerciseSubstitutionMappings.id })
        .from(exerciseSubstitutionMappings)
        .where(and(
          eq(exerciseSubstitutionMappings.modificationRecordId, record.id),
          eq(exerciseSubstitutionMappings.isRestored, false)
        ));
      keptCount = remainingMappings.length;
      
      // Only mark record as cleared if ALL mappings are restored (no active substitutions remain)
      if (remainingMappings.length === 0) {
        console.log('All mappings restored - marking record as cleared');
        await this.markModificationRecordCleared(userId, matchedOutcomeId, bodyMapLogId);
      } else {
        console.log(`${remainingMappings.length} mappings still active - record stays open`);
      }
    } else if (mappingIdsToRestore && mappingIdsToRestore.length === 0) {
      // Empty array means keep all substitutes (don't restore any)
      keptCount = allMappings.length;
      // Don't mark as cleared - substitutions are still active
      console.log('User chose to keep all substitutes - record stays open');
      return { restoredCount: 0, keptCount };
    } else {
      // No mappingIdsToRestore provided - restore all (legacy behavior)
      const result = await db.update(exerciseSubstitutionMappings)
        .set({ 
          isRestored: true, 
          restoredAt: new Date() 
        })
        .where(and(
          eq(exerciseSubstitutionMappings.modificationRecordId, record.id),
          eq(exerciseSubstitutionMappings.isRestored, false)
        ))
        .returning();
      
      restoredCount = result.length;
      // All restored - mark as cleared
      await this.markModificationRecordCleared(userId, matchedOutcomeId, bodyMapLogId);
    }

    return { restoredCount, keptCount };
  }

  // Step 5: Mark a modification record as cleared by reassessment
  async markModificationRecordCleared(userId: string, matchedOutcomeId: number, bodyMapLogId: number): Promise<void> {
    // Find the user's active programme enrollment
    const enrollments = await this.getUserEnrolledPrograms(userId);
    const mainEnrollment = enrollments.find(e => e.programType === 'main' && e.status === 'active');
    if (!mainEnrollment) return;

    await db.update(programmeModificationRecords)
      .set({ 
        clearedAt: new Date(),
        clearedByBodyMapLogId: bodyMapLogId,
        updatedAt: new Date()
      })
      .where(and(
        eq(programmeModificationRecords.userId, userId),
        eq(programmeModificationRecords.mainProgrammeEnrollmentId, mainEnrollment.id),
        eq(programmeModificationRecords.matchedOutcomeId, matchedOutcomeId),
        eq(programmeModificationRecords.status, 'accepted'),
        isNull(programmeModificationRecords.clearedAt)
      ));
  }

  // Get programme workout blocks with user-specific substitutions applied
  async getProgrammeWorkoutBlocksForEnrollment(workoutId: number, enrollmentId: number): Promise<any[]> {
    // Check if this enrollment has snapshot data
    const enrolledWorkout = await db
      .select()
      .from(enrollmentWorkouts)
      .where(
        and(
          eq(enrollmentWorkouts.enrollmentId, enrollmentId),
          eq(enrollmentWorkouts.templateWorkoutId, workoutId)
        )
      )
      .limit(1);

    let blocks: any[];
    
    if (enrolledWorkout.length > 0) {
      // Use enrollment-specific snapshot data
      blocks = await this.getEnrollmentWorkoutBlocks(enrolledWorkout[0].id);
    } else {
      // Fallback to template for legacy enrollments
      blocks = await this.getProgrammeWorkoutBlocks(workoutId);
    }
    
    // Get active substitutions for this enrollment
    const substitutions = await this.getActiveSubstitutionMappings(enrollmentId);
    
    if (substitutions.size === 0) {
      return blocks;
    }
    
    // Apply substitutions to exercises
    return blocks.map(block => ({
      ...block,
      exercises: block.exercises.map((exercise: any) => {
        // For snapshot data, check by templateExerciseId; for template data, check by id
        const exerciseKey = exercise.templateExerciseId || exercise.id;
        const sub = substitutions.get(exerciseKey);
        if (sub) {
          return {
            ...exercise,
            exerciseLibraryId: sub.substitutedExerciseId,
            exerciseName: sub.exerciseName,
            imageUrl: sub.imageUrl,
            muxPlaybackId: sub.muxPlaybackId,
            isSubstituted: true,
            originalExerciseId: exercise.exerciseLibraryId,
          };
        }
        return exercise;
      }),
    }));
  }

  async createProgrammeWorkoutBlock(block: any): Promise<any> {
    const existingBlocks = await db
      .select({ position: programmeWorkoutBlocks.position })
      .from(programmeWorkoutBlocks)
      .where(and(
        eq(programmeWorkoutBlocks.workoutId, block.workoutId),
        eq(programmeWorkoutBlocks.section, block.section)
      ))
      .orderBy(desc(programmeWorkoutBlocks.position))
      .limit(1);
    
    const nextPosition = existingBlocks.length > 0 ? existingBlocks[0].position + 1 : 0;
    const [created] = await db.insert(programmeWorkoutBlocks).values({
      ...block,
      position: nextPosition,
    }).returning();
    return created;
  }

  async updateProgrammeWorkoutBlock(id: number, block: any): Promise<any> {
    const [updated] = await db
      .update(programmeWorkoutBlocks)
      .set(block)
      .where(eq(programmeWorkoutBlocks.id, id))
      .returning();
    return updated;
  }

  async deleteProgrammeWorkoutBlock(id: number): Promise<void> {
    await db.delete(programmeWorkoutBlocks).where(eq(programmeWorkoutBlocks.id, id));
  }

  async swapProgrammeBlockPositions(blockId1: number, blockId2: number): Promise<void> {
    const blocks = await db
      .select({ id: programmeWorkoutBlocks.id, position: programmeWorkoutBlocks.position })
      .from(programmeWorkoutBlocks)
      .where(or(
        eq(programmeWorkoutBlocks.id, blockId1),
        eq(programmeWorkoutBlocks.id, blockId2)
      ));
    
    if (blocks.length !== 2) {
      throw new Error('Could not find both blocks to swap');
    }
    
    const block1 = blocks.find(b => b.id === blockId1);
    const block2 = blocks.find(b => b.id === blockId2);
    
    if (!block1 || !block2) {
      throw new Error('Could not find both blocks to swap');
    }
    
    await db.update(programmeWorkoutBlocks)
      .set({ position: block2.position })
      .where(eq(programmeWorkoutBlocks.id, blockId1));
    await db.update(programmeWorkoutBlocks)
      .set({ position: block1.position })
      .where(eq(programmeWorkoutBlocks.id, blockId2));
  }

  async batchUpdateProgrammeWorkoutBlocks(workoutId: number, blocks: any[]): Promise<any[]> {
    const existingBlocks = await db
      .select({ id: programmeWorkoutBlocks.id })
      .from(programmeWorkoutBlocks)
      .where(eq(programmeWorkoutBlocks.workoutId, workoutId));
    
    for (const existingBlock of existingBlocks) {
      await db.delete(programmeBlockExercises).where(eq(programmeBlockExercises.blockId, existingBlock.id));
    }
    await db.delete(programmeWorkoutBlocks).where(eq(programmeWorkoutBlocks.workoutId, workoutId));
    
    const createdBlocks: any[] = [];
    
    for (const block of blocks) {
      const [createdBlock] = await db.insert(programmeWorkoutBlocks).values({
        workoutId,
        blockType: block.blockType,
        section: block.section,
        position: block.position,
        rest: block.rest || 'No Rest',
      }).returning();
      
      const createdExercises: any[] = [];
      for (const exercise of block.exercises || []) {
        const [createdExercise] = await db.insert(programmeBlockExercises).values({
          blockId: createdBlock.id,
          exerciseLibraryId: exercise.exerciseLibraryId,
          position: exercise.position,
          sets: exercise.sets || [{ reps: '8-12', rest: 'No Rest' }],
          durationType: exercise.durationType || 'text',
          tempo: exercise.tempo,
          load: exercise.load,
          notes: exercise.notes,
        }).returning();
        
        createdExercises.push({
          ...createdExercise,
          exerciseName: exercise.exerciseName,
          imageUrl: exercise.imageUrl,
        });
      }
      
      createdBlocks.push({
        ...createdBlock,
        exercises: createdExercises,
      });
    }
    
    return createdBlocks;
  }

  async syncBlocksToSameNamedWorkouts(sourceWorkoutId: number, programId: number): Promise<void> {
    // Get the source workout to find its name
    const [sourceWorkout] = await db
      .select()
      .from(programmeWorkouts)
      .where(eq(programmeWorkouts.id, sourceWorkoutId));
    
    if (!sourceWorkout) return;
    
    // Get all workouts in this programme with the same name
    const allWorkouts = await db
      .select({ workout: programmeWorkouts })
      .from(programmeWorkouts)
      .innerJoin(programDays, eq(programmeWorkouts.dayId, programDays.id))
      .innerJoin(programWeeks, eq(programDays.weekId, programWeeks.id))
      .where(eq(programWeeks.programId, programId));
    
    const sameNamedWorkouts = allWorkouts
      .filter(w => w.workout.name === sourceWorkout.name && w.workout.id !== sourceWorkoutId)
      .map(w => w.workout);
    
    if (sameNamedWorkouts.length === 0) return;
    
    // Get the source blocks with exercises
    const sourceBlocks = await db
      .select()
      .from(programmeWorkoutBlocks)
      .where(eq(programmeWorkoutBlocks.workoutId, sourceWorkoutId))
      .orderBy(asc(programmeWorkoutBlocks.position));
    
    const sourceBlocksWithExercises = await Promise.all(
      sourceBlocks.map(async (block) => {
        const exercises = await db
          .select()
          .from(programmeBlockExercises)
          .where(eq(programmeBlockExercises.blockId, block.id))
          .orderBy(asc(programmeBlockExercises.position));
        return { ...block, exercises };
      })
    );
    
    // Copy blocks to each same-named workout
    for (const targetWorkout of sameNamedWorkouts) {
      // Delete existing blocks for this workout
      const existingBlocks = await db
        .select({ id: programmeWorkoutBlocks.id })
        .from(programmeWorkoutBlocks)
        .where(eq(programmeWorkoutBlocks.workoutId, targetWorkout.id));
      
      for (const existingBlock of existingBlocks) {
        await db.delete(programmeBlockExercises).where(eq(programmeBlockExercises.blockId, existingBlock.id));
      }
      await db.delete(programmeWorkoutBlocks).where(eq(programmeWorkoutBlocks.workoutId, targetWorkout.id));
      
      // Copy source blocks to target
      for (const sourceBlock of sourceBlocksWithExercises) {
        const [newBlock] = await db.insert(programmeWorkoutBlocks).values({
          workoutId: targetWorkout.id,
          blockType: sourceBlock.blockType,
          section: sourceBlock.section,
          position: sourceBlock.position,
          rest: sourceBlock.rest,
          rounds: sourceBlock.rounds,
          restAfterRound: sourceBlock.restAfterRound,
        }).returning();
        
        for (const exercise of sourceBlock.exercises) {
          await db.insert(programmeBlockExercises).values({
            blockId: newBlock.id,
            exerciseLibraryId: exercise.exerciseLibraryId,
            position: exercise.position,
            sets: exercise.sets,
            durationType: exercise.durationType,
            tempo: exercise.tempo,
            load: exercise.load,
            notes: exercise.notes,
          });
        }
      }
    }
  }

  async createProgrammeBlockExercise(exercise: any): Promise<any> {
    const existingExercises = await db
      .select({ position: programmeBlockExercises.position })
      .from(programmeBlockExercises)
      .where(eq(programmeBlockExercises.blockId, exercise.blockId))
      .orderBy(desc(programmeBlockExercises.position))
      .limit(1);
    
    const nextPosition = existingExercises.length > 0 ? existingExercises[0].position + 1 : 0;
    const [created] = await db.insert(programmeBlockExercises).values({
      ...exercise,
      position: nextPosition,
    }).returning();
    return created;
  }

  async updateProgrammeBlockExercise(id: number, exercise: any): Promise<any> {
    const [updated] = await db
      .update(programmeBlockExercises)
      .set(exercise)
      .where(eq(programmeBlockExercises.id, id))
      .returning();
    return updated;
  }

  async deleteProgrammeBlockExercise(id: number): Promise<void> {
    await db.delete(programmeBlockExercises).where(eq(programmeBlockExercises.id, id));
  }

  async createBlockExercise(exercise: InsertBlockExercise): Promise<BlockExercise> {
    const [created] = await db.insert(blockExercises).values(exercise).returning();
    return created;
  }

  async getBlockExercises(blockId: number): Promise<any[]> {
    return await db
      .select({
        id: blockExercises.id,
        blockId: blockExercises.blockId,
        exerciseLibraryId: blockExercises.exerciseLibraryId,
        position: blockExercises.position,
        sets: blockExercises.sets,
        durationType: blockExercises.durationType,
        tempo: blockExercises.tempo,
        load: blockExercises.load,
        notes: blockExercises.notes,
        exerciseName: exerciseLibrary.name,
        exerciseType: exerciseLibrary.exerciseType,
        imageUrl: exerciseLibrary.imageUrl,
        muxPlaybackId: exerciseLibrary.muxPlaybackId,
        equipment: exerciseLibrary.equipment,
      })
      .from(blockExercises)
      .leftJoin(exerciseLibrary, eq(blockExercises.exerciseLibraryId, exerciseLibrary.id))
      .where(eq(blockExercises.blockId, blockId))
      .orderBy(asc(blockExercises.position));
  }

  async updateBlockExercise(id: number, exercise: Partial<InsertBlockExercise>): Promise<BlockExercise> {
    const [updated] = await db
      .update(blockExercises)
      .set(exercise)
      .where(eq(blockExercises.id, id))
      .returning();
    return updated;
  }

  async deleteBlockExercise(id: number): Promise<void> {
    await db.delete(blockExercises).where(eq(blockExercises.id, id));
  }

  // Get workout with all blocks and exercises (full nested structure)
  async getWorkoutWithBlocks(workoutId: number): Promise<{
    workout: Workout | undefined;
    blocks: Array<WorkoutBlock & { exercises: BlockExercise[] }>;
  }> {
    const workout = await this.getWorkoutById(workoutId);
    if (!workout) {
      return { workout: undefined, blocks: [] };
    }
    
    const blocks = await this.getWorkoutBlocks(workoutId);
    const blocksWithExercises = await Promise.all(
      blocks.map(async (block) => ({
        ...block,
        exercises: await this.getBlockExercises(block.id),
      }))
    );
    
    return { workout, blocks: blocksWithExercises };
  }

  // ============================================
  // Active Workout Log Operations
  // ============================================

  async createWorkoutLog(log: InsertWorkoutLog): Promise<WorkoutLog> {
    const [created] = await db
      .insert(workoutLogs)
      .values(log)
      .returning();
    return created;
  }

  async getWorkoutLogById(id: number): Promise<WorkoutLog | undefined> {
    const [log] = await db
      .select()
      .from(workoutLogs)
      .where(eq(workoutLogs.id, id));
    return log;
  }

  async getUserWorkoutLogs(userId: string, limit: number = 50): Promise<WorkoutLog[]> {
    return await db
      .select()
      .from(workoutLogs)
      .where(eq(workoutLogs.userId, userId))
      .orderBy(desc(workoutLogs.startedAt))
      .limit(limit);
  }

  async getActiveWorkoutLog(userId: string): Promise<WorkoutLog | undefined> {
    const [log] = await db
      .select()
      .from(workoutLogs)
      .where(and(
        eq(workoutLogs.userId, userId),
        eq(workoutLogs.status, 'in_progress')
      ))
      .orderBy(desc(workoutLogs.startedAt))
      .limit(1);
    return log;
  }

  async updateWorkoutLog(id: number, updates: Partial<InsertWorkoutLog>): Promise<WorkoutLog> {
    const [updated] = await db
      .update(workoutLogs)
      .set(updates)
      .where(eq(workoutLogs.id, id))
      .returning();
    return updated;
  }

  async completeWorkoutLog(id: number): Promise<WorkoutLog> {
    const log = await this.getWorkoutLogById(id);
    if (!log) throw new Error('Workout log not found');
    
    const now = new Date();
    const startedAt = new Date(log.startedAt);
    const durationSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
    
    const [updated] = await db
      .update(workoutLogs)
      .set({
        status: 'completed',
        completedAt: now,
        duration: durationSeconds,
      })
      .where(eq(workoutLogs.id, id))
      .returning();
    return updated;
  }

  async cancelWorkoutLog(id: number): Promise<void> {
    // Get all exercise logs for this workout
    const exerciseLogs = await db
      .select()
      .from(workoutExerciseLogs)
      .where(eq(workoutExerciseLogs.workoutLogId, id));
    
    // Delete all set logs for each exercise log
    for (const exerciseLog of exerciseLogs) {
      await db
        .delete(workoutSetLogs)
        .where(eq(workoutSetLogs.exerciseLogId, exerciseLog.id));
    }
    
    // Delete all exercise logs
    await db
      .delete(workoutExerciseLogs)
      .where(eq(workoutExerciseLogs.workoutLogId, id));
    
    // Delete the workout log itself
    await db
      .delete(workoutLogs)
      .where(eq(workoutLogs.id, id));
  }

  async deleteWorkoutLog(id: number): Promise<void> {
    // Same as cancel - delete all related data
    await this.cancelWorkoutLog(id);
  }

  async getCompletedWorkoutLogByContext(userId: string, enrollmentId: number, week: number, day: number): Promise<WorkoutLog | undefined> {
    const [log] = await db
      .select()
      .from(workoutLogs)
      .where(and(
        eq(workoutLogs.userId, userId),
        eq(workoutLogs.enrollmentId, enrollmentId),
        eq(workoutLogs.week, week),
        eq(workoutLogs.day, day),
        eq(workoutLogs.status, 'completed')
      ))
      .orderBy(desc(workoutLogs.completedAt))
      .limit(1);
    return log;
  }

  async getCompletedWorkoutLogByWorkoutId(userId: string, workoutId: number): Promise<WorkoutLog | undefined> {
    const [log] = await db
      .select()
      .from(workoutLogs)
      .where(and(
        eq(workoutLogs.userId, userId),
        eq(workoutLogs.workoutId, workoutId),
        eq(workoutLogs.status, 'completed')
      ))
      .orderBy(desc(workoutLogs.completedAt))
      .limit(1);
    return log;
  }

  // ============================================
  // Workout Exercise Log Operations
  // ============================================

  async createWorkoutExerciseLog(log: InsertWorkoutExerciseLog): Promise<WorkoutExerciseLog> {
    // If exerciseLibraryId is provided and exerciseType is 'strength' (default), fetch from library
    let logWithCorrectType = { ...log };
    if (log.exerciseLibraryId && (!log.exerciseType || log.exerciseType === 'strength')) {
      const [libExercise] = await db
        .select({ exerciseType: exerciseLibrary.exerciseType })
        .from(exerciseLibrary)
        .where(eq(exerciseLibrary.id, log.exerciseLibraryId));
      if (libExercise?.exerciseType) {
        logWithCorrectType.exerciseType = libExercise.exerciseType;
      }
    }
    
    const [created] = await db
      .insert(workoutExerciseLogs)
      .values(logWithCorrectType)
      .returning();
    return created;
  }

  async getWorkoutExerciseLogs(workoutLogId: number): Promise<any[]> {
    return await db
      .select({
        id: workoutExerciseLogs.id,
        workoutLogId: workoutExerciseLogs.workoutLogId,
        exerciseLibraryId: workoutExerciseLogs.exerciseLibraryId,
        exerciseName: workoutExerciseLogs.exerciseName,
        blockType: workoutExerciseLogs.blockType,
        blockGroupId: workoutExerciseLogs.blockGroupId,
        section: workoutExerciseLogs.section,
        position: workoutExerciseLogs.position,
        restPeriod: workoutExerciseLogs.restPeriod,
        durationType: workoutExerciseLogs.durationType,
        exerciseType: sql`COALESCE(${workoutExerciseLogs.exerciseType}, ${exerciseLibrary.exerciseType}, 'strength')`.as('exerciseType'),
        kind: workoutExerciseLogs.kind,
        restDuration: workoutExerciseLogs.restDuration,
        targetDuration: workoutExerciseLogs.targetDuration,
        targetReps: workoutExerciseLogs.targetReps,
        imageUrl: exerciseLibrary.imageUrl,
        createdAt: workoutExerciseLogs.createdAt,
      })
      .from(workoutExerciseLogs)
      .leftJoin(exerciseLibrary, eq(workoutExerciseLogs.exerciseLibraryId, exerciseLibrary.id))
      .where(eq(workoutExerciseLogs.workoutLogId, workoutLogId))
      .orderBy(asc(workoutExerciseLogs.position));
  }

  async updateWorkoutExerciseLog(id: number, updates: Partial<InsertWorkoutExerciseLog>): Promise<WorkoutExerciseLog> {
    const [updated] = await db
      .update(workoutExerciseLogs)
      .set(updates)
      .where(eq(workoutExerciseLogs.id, id))
      .returning();
    return updated;
  }

  async deleteWorkoutExerciseLog(id: number): Promise<void> {
    // First delete all associated set logs
    await db.delete(workoutSetLogs).where(eq(workoutSetLogs.exerciseLogId, id));
    // Then delete the exercise log
    await db.delete(workoutExerciseLogs).where(eq(workoutExerciseLogs.id, id));
  }

  // ============================================
  // Workout Set Log Operations
  // ============================================

  async createWorkoutSetLog(log: InsertWorkoutSetLog): Promise<WorkoutSetLog> {
    const [created] = await db
      .insert(workoutSetLogs)
      .values(log)
      .returning();
    return created;
  }

  async getWorkoutSetLogs(exerciseLogId: number): Promise<WorkoutSetLog[]> {
    return await db
      .select()
      .from(workoutSetLogs)
      .where(eq(workoutSetLogs.exerciseLogId, exerciseLogId))
      .orderBy(asc(workoutSetLogs.setNumber));
  }

  async updateWorkoutSetLog(id: number, updates: Partial<InsertWorkoutSetLog>): Promise<WorkoutSetLog> {
    const [updated] = await db
      .update(workoutSetLogs)
      .set(updates)
      .where(eq(workoutSetLogs.id, id))
      .returning();
    return updated;
  }

  async bulkUpdateWorkoutSetLogs(logs: { id: number; updates: Partial<InsertWorkoutSetLog> }[]): Promise<WorkoutSetLog[]> {
    const results: WorkoutSetLog[] = [];
    for (const log of logs) {
      const updated = await this.updateWorkoutSetLog(log.id, log.updates);
      results.push(updated);
    }
    return results;
  }

  async deleteWorkoutSetLog(id: number): Promise<void> {
    await db.delete(workoutSetLogs).where(eq(workoutSetLogs.id, id));
  }

  // ============================================
  // Previous Exercise Performance
  // ============================================

  async getPreviousExercisePerformance(userId: string, exerciseLibraryId: number): Promise<{
    sets: { setNumber: number; reps: number | null; weight: number | null; durationMinutes: number | null; durationSeconds: number | null }[];
  } | null> {
    // Find the most recent completed workout log that contains this exercise
    const exerciseLogs = await db
      .select({
        exerciseLog: workoutExerciseLogs,
        workoutLog: workoutLogs,
      })
      .from(workoutExerciseLogs)
      .innerJoin(workoutLogs, eq(workoutExerciseLogs.workoutLogId, workoutLogs.id))
      .where(and(
        eq(workoutLogs.userId, userId),
        eq(workoutLogs.status, 'completed'),
        eq(workoutExerciseLogs.exerciseLibraryId, exerciseLibraryId)
      ))
      .orderBy(desc(workoutLogs.completedAt))
      .limit(1);

    if (exerciseLogs.length === 0) {
      return null;
    }

    const exerciseLogId = exerciseLogs[0].exerciseLog.id;
    const setLogs = await this.getWorkoutSetLogs(exerciseLogId);

    return {
      sets: setLogs.map(s => ({
        setNumber: s.setNumber,
        reps: s.actualReps,
        weight: s.actualWeight,
        durationMinutes: s.actualDurationMinutes,
        durationSeconds: s.actualDurationSeconds,
      })),
    };
  }

  // ============================================
  // Video Workout Progress
  // ============================================

  async getVideoWorkoutProgress(userId: string, workoutId: number): Promise<VideoWorkoutProgress | undefined> {
    const [progress] = await db
      .select()
      .from(videoWorkoutProgress)
      .where(and(
        eq(videoWorkoutProgress.userId, userId),
        eq(videoWorkoutProgress.workoutId, workoutId)
      ));
    return progress;
  }

  async saveVideoWorkoutProgress(
    userId: string,
    workoutId: number,
    progressTime: number,
    duration: number,
    completed?: boolean
  ): Promise<VideoWorkoutProgress> {
    const [existing] = await db
      .select()
      .from(videoWorkoutProgress)
      .where(and(
        eq(videoWorkoutProgress.userId, userId),
        eq(videoWorkoutProgress.workoutId, workoutId)
      ));

    if (existing) {
      const [updated] = await db
        .update(videoWorkoutProgress)
        .set({
          progressTime,
          duration,
          completed: completed ?? existing.completed,
          lastWatchedAt: new Date(),
        })
        .where(eq(videoWorkoutProgress.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(videoWorkoutProgress)
      .values({
        userId,
        workoutId,
        progressTime,
        duration,
        completed: completed ?? false,
        lastWatchedAt: new Date(),
      })
      .returning();
    return created;
  }

  // ============================================
  // Exercise Snapshots (PR and Performance Tracking)
  // ============================================

  async getExerciseSnapshot(userId: string, exerciseLibraryId: number): Promise<ExerciseSnapshot | undefined> {
    const [snapshot] = await db
      .select()
      .from(exerciseSnapshots)
      .where(and(
        eq(exerciseSnapshots.userId, userId),
        eq(exerciseSnapshots.exerciseLibraryId, exerciseLibraryId)
      ));
    return snapshot;
  }

  async getUserExerciseSnapshots(userId: string): Promise<ExerciseSnapshot[]> {
    return await db
      .select()
      .from(exerciseSnapshots)
      .where(eq(exerciseSnapshots.userId, userId))
      .orderBy(desc(exerciseSnapshots.lastPerformedAt));
  }

  async updateExerciseSnapshot(
    userId: string, 
    exerciseLibraryId: number, 
    setData: { reps?: number; weight?: number; timeSeconds?: number }
  ): Promise<ExerciseSnapshot> {
    const existing = await this.getExerciseSnapshot(userId, exerciseLibraryId);
    const now = new Date();
    
    // Calculate volume for this set (weight x reps)
    const setVolume = (setData.weight || 0) * (setData.reps || 0);
    
    if (existing) {
      // Update existing snapshot with new performance data
      const updates: Partial<InsertExerciseSnapshot> = {
        lastPerformedAt: now,
        updatedAt: now,
      };
      
      // Update last performance
      if (setData.reps !== undefined) updates.lastReps = setData.reps;
      if (setData.weight !== undefined) updates.lastWeight = setData.weight;
      if (setData.timeSeconds !== undefined) updates.lastTimeSeconds = setData.timeSeconds;
      
      // Update personal bests if exceeded
      if (setData.reps !== undefined && (existing.bestReps === null || setData.reps > existing.bestReps)) {
        updates.bestReps = setData.reps;
      }
      if (setData.weight !== undefined && (existing.bestWeight === null || setData.weight > existing.bestWeight)) {
        updates.bestWeight = setData.weight;
      }
      if (setVolume > 0 && (existing.bestVolume === null || setVolume > existing.bestVolume)) {
        updates.bestVolume = setVolume;
      }
      if (setData.timeSeconds !== undefined && (existing.bestTimeSeconds === null || setData.timeSeconds > existing.bestTimeSeconds)) {
        updates.bestTimeSeconds = setData.timeSeconds;
      }
      
      // Increment totals
      updates.totalSets = (existing.totalSets || 0) + 1;
      updates.totalReps = (existing.totalReps || 0) + (setData.reps || 0);
      updates.totalVolume = (existing.totalVolume || 0) + setVolume;
      
      const [updated] = await db
        .update(exerciseSnapshots)
        .set(updates)
        .where(eq(exerciseSnapshots.id, existing.id))
        .returning();
      return updated;
    }
    
    // Create new snapshot
    const [created] = await db
      .insert(exerciseSnapshots)
      .values({
        userId,
        exerciseLibraryId,
        lastReps: setData.reps || null,
        lastWeight: setData.weight || null,
        lastTimeSeconds: setData.timeSeconds || null,
        lastPerformedAt: now,
        bestReps: setData.reps || null,
        bestWeight: setData.weight || null,
        bestVolume: setVolume > 0 ? setVolume : null,
        bestTimeSeconds: setData.timeSeconds || null,
        totalSets: 1,
        totalReps: setData.reps || 0,
        totalVolume: setVolume,
        frequencyCount7Days: 1,
        frequencyCount30Days: 1,
      })
      .returning();
    return created;
  }

  // ============================================
  // Enhanced Workout Completion with Rating
  // ============================================

  async completeWorkoutLogWithRating(id: number, workoutRating: number): Promise<WorkoutLog & { prs: any[]; summary: any }> {
    console.log(`[completeWorkoutLogWithRating] Starting for id=${id}, rating=${workoutRating}`);
    
    const log = await this.getWorkoutLogById(id);
    if (!log) {
      console.error(`[completeWorkoutLogWithRating] Workout log id=${id} not found`);
      throw new Error('Workout log not found');
    }
    
    // Check if already completed to prevent double-counting
    const wasAlreadyCompleted = log.status === 'completed';
    console.log(`[completeWorkoutLogWithRating] Found log: userId=${log.userId}, status=${log.status}, wasAlreadyCompleted=${wasAlreadyCompleted}`);
    
    const now = new Date();
    const startedAt = log.startedAt ? new Date(log.startedAt) : now;
    const durationSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
    
    // Get all exercise logs for this workout
    const exerciseLogs = await this.getWorkoutExerciseLogs(id);
    
    // Calculate totals and detect PRs
    let totalVolume = 0;
    let totalTimeSeconds = 0;
    const prs: any[] = [];
    
    for (const exerciseLog of exerciseLogs) {
      const setLogs = await this.getWorkoutSetLogs(exerciseLog.id);
      
      for (const setLog of setLogs) {
        // Calculate volume (weight x reps)
        const setVolume = (setLog.actualWeight || 0) * (setLog.actualReps || 0);
        totalVolume += setVolume;
        
        // Calculate time
        const setTimeSeconds = (setLog.actualDurationMinutes || 0) * 60 + (setLog.actualDurationSeconds || 0);
        totalTimeSeconds += setTimeSeconds;
        
        // Update exercise snapshot and check for PRs
        if (exerciseLog.exerciseLibraryId && (setLog.actualReps || setLog.actualWeight || setTimeSeconds > 0)) {
          const existingSnapshot = await this.getExerciseSnapshot(log.userId, exerciseLog.exerciseLibraryId);
          
          // Check for PRs before updating
          if (existingSnapshot) {
            if (setLog.actualWeight && existingSnapshot.bestWeight && setLog.actualWeight > existingSnapshot.bestWeight) {
              prs.push({ type: 'weight', exerciseName: exerciseLog.exerciseName, value: setLog.actualWeight, previous: existingSnapshot.bestWeight });
            }
            if (setLog.actualReps && existingSnapshot.bestReps && setLog.actualReps > existingSnapshot.bestReps) {
              prs.push({ type: 'reps', exerciseName: exerciseLog.exerciseName, value: setLog.actualReps, previous: existingSnapshot.bestReps });
            }
            if (setVolume > 0 && existingSnapshot.bestVolume && setVolume > existingSnapshot.bestVolume) {
              prs.push({ type: 'volume', exerciseName: exerciseLog.exerciseName, value: setVolume, previous: existingSnapshot.bestVolume });
            }
          } else if (setLog.actualReps || setLog.actualWeight) {
            // First time doing this exercise - could be considered a PR
            prs.push({ type: 'first', exerciseName: exerciseLog.exerciseName, reps: setLog.actualReps, weight: setLog.actualWeight });
          }
          
          // Update snapshot
          await this.updateExerciseSnapshot(log.userId, exerciseLog.exerciseLibraryId, {
            reps: setLog.actualReps || undefined,
            weight: setLog.actualWeight || undefined,
            timeSeconds: setTimeSeconds > 0 ? setTimeSeconds : undefined,
          });
        }
      }
    }
    
    // Update the workout log with completion data
    const [updated] = await db
      .update(workoutLogs)
      .set({
        status: 'completed',
        completedAt: now,
        duration: durationSeconds,
        workoutRating,
        autoCalculatedVolume: totalVolume,
        autoCalculatedTime: totalTimeSeconds,
      })
      .where(eq(workoutLogs.id, id))
      .returning();
    
    console.log(`[completeWorkoutLogWithRating] Updated workout log. enrollmentId=${log.enrollmentId}, week=${log.week}, day=${log.day}, workoutId=${log.workoutId}`);
    
    // Only update enrollment stats and scheduled workouts if this is a NEW completion
    if (!wasAlreadyCompleted) {
      // Mark the related enrollment workout as completed (if this is a programme workout)
      if (log.enrollmentId && log.week && log.day) {
        // Find the enrollment workout by matching enrollment + week + day
        const [enrollmentWorkout] = await db
          .select()
          .from(enrollmentWorkouts)
          .where(
            and(
              eq(enrollmentWorkouts.enrollmentId, log.enrollmentId),
              eq(enrollmentWorkouts.weekNumber, log.week),
              eq(enrollmentWorkouts.dayNumber, log.day)
            )
          );
        
        if (enrollmentWorkout) {
          console.log(`[completeWorkoutLogWithRating] Found enrollment workout id=${enrollmentWorkout.id}`);
          
          // Increment the workoutsCompleted counter on the enrollment (only on first completion)
          const [enrollment] = await db
            .select({ workoutsCompleted: userProgramEnrollments.workoutsCompleted })
            .from(userProgramEnrollments)
            .where(eq(userProgramEnrollments.id, log.enrollmentId));
          
          if (enrollment) {
            const newCount = (enrollment.workoutsCompleted || 0) + 1;
            console.log(`[completeWorkoutLogWithRating] Incrementing workoutsCompleted from ${enrollment.workoutsCompleted || 0} to ${newCount}`);
            await db
              .update(userProgramEnrollments)
              .set({ workoutsCompleted: newCount })
              .where(eq(userProgramEnrollments.id, log.enrollmentId));
          }
          
          // Mark any related scheduled workout as completed (match by workout name for programme workouts)
          const matchingScheduled = await db
            .select()
            .from(scheduledWorkouts)
            .where(
              and(
                eq(scheduledWorkouts.userId, log.userId),
                eq(scheduledWorkouts.workoutName, log.workoutName),
                eq(scheduledWorkouts.isCompleted, false)
              )
            )
            .limit(1);
          
          if (matchingScheduled.length > 0) {
            console.log(`[completeWorkoutLogWithRating] Marking scheduled workout id=${matchingScheduled[0].id} as completed (by name match)`);
            await db
              .update(scheduledWorkouts)
              .set({
                isCompleted: true,
                completedAt: now,
              })
              .where(eq(scheduledWorkouts.id, matchingScheduled[0].id));
          }
        }
      } else if (log.workoutId) {
        // For standalone workouts, find by workoutId
        const matchingScheduled = await db
          .select()
          .from(scheduledWorkouts)
          .where(
            and(
              eq(scheduledWorkouts.userId, log.userId),
              eq(scheduledWorkouts.workoutId, log.workoutId),
              eq(scheduledWorkouts.isCompleted, false)
            )
          )
          .limit(1);
        
        if (matchingScheduled.length > 0) {
          console.log(`[completeWorkoutLogWithRating] Marking scheduled workout id=${matchingScheduled[0].id} as completed`);
          await db
            .update(scheduledWorkouts)
            .set({
              isCompleted: true,
              completedAt: now,
            })
            .where(eq(scheduledWorkouts.id, matchingScheduled[0].id));
        }
      }
    }
    
    return {
      ...updated,
      prs,
      summary: {
        totalVolume,
        totalTimeSeconds,
        durationSeconds,
        exerciseCount: exerciseLogs.length,
        workoutRating,
      },
    };
  }

  // ============================================
  // PROGRESS TRACKING - Bodyweight
  // ============================================

  async getBodyweightEntries(userId: string, limit?: number): Promise<BodyweightEntry[]> {
    const query = db
      .select()
      .from(bodyweightEntries)
      .where(eq(bodyweightEntries.userId, userId))
      .orderBy(desc(bodyweightEntries.date));
    
    if (limit) {
      return query.limit(limit);
    }
    return query;
  }

  async createBodyweightEntry(entry: InsertBodyweightEntry): Promise<BodyweightEntry> {
    const [created] = await db
      .insert(bodyweightEntries)
      .values(entry)
      .returning();
    return created;
  }

  async deleteBodyweightEntry(id: number, userId: string): Promise<void> {
    await db
      .delete(bodyweightEntries)
      .where(and(eq(bodyweightEntries.id, id), eq(bodyweightEntries.userId, userId)));
  }

  async getBodyweightEntryById(id: number, userId: string): Promise<BodyweightEntry | null> {
    const [entry] = await db
      .select()
      .from(bodyweightEntries)
      .where(and(eq(bodyweightEntries.id, id), eq(bodyweightEntries.userId, userId)))
      .limit(1);
    return entry || null;
  }

  async updateBodyweightEntry(id: number, userId: string, updates: Partial<InsertBodyweightEntry>): Promise<BodyweightEntry | null> {
    const [updated] = await db
      .update(bodyweightEntries)
      .set(updates)
      .where(and(eq(bodyweightEntries.id, id), eq(bodyweightEntries.userId, userId)))
      .returning();
    return updated || null;
  }

  // ============================================
  // PROGRESS TRACKING - Body Measurements
  // ============================================

  async getBodyMeasurements(userId: string, limit?: number): Promise<BodyMeasurement[]> {
    const query = db
      .select()
      .from(bodyMeasurements)
      .where(eq(bodyMeasurements.userId, userId))
      .orderBy(desc(bodyMeasurements.date));
    
    if (limit) {
      return query.limit(limit);
    }
    return query;
  }

  async getBodyMeasurementById(id: number, userId: string): Promise<BodyMeasurement | null> {
    const [measurement] = await db
      .select()
      .from(bodyMeasurements)
      .where(and(eq(bodyMeasurements.id, id), eq(bodyMeasurements.userId, userId)))
      .limit(1);
    return measurement || null;
  }

  async createBodyMeasurement(measurement: InsertBodyMeasurement): Promise<BodyMeasurement> {
    const [created] = await db
      .insert(bodyMeasurements)
      .values(measurement)
      .returning();
    return created;
  }

  async deleteBodyMeasurement(id: number, userId: string): Promise<void> {
    await db
      .delete(bodyMeasurements)
      .where(and(eq(bodyMeasurements.id, id), eq(bodyMeasurements.userId, userId)));
  }

  async getBodyMeasurementsByDate(userId: string, date: Date): Promise<BodyMeasurement | null> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const [measurement] = await db
      .select()
      .from(bodyMeasurements)
      .where(and(
        eq(bodyMeasurements.userId, userId),
        gte(bodyMeasurements.date, startOfDay),
        lte(bodyMeasurements.date, endOfDay)
      ))
      .limit(1);
    return measurement || null;
  }

  async updateBodyMeasurement(id: number, userId: string, updates: Partial<InsertBodyMeasurement>): Promise<BodyMeasurement | null> {
    const [updated] = await db
      .update(bodyMeasurements)
      .set(updates)
      .where(and(eq(bodyMeasurements.id, id), eq(bodyMeasurements.userId, userId)))
      .returning();
    return updated || null;
  }

  // ============================================
  // PROGRESS TRACKING - Progress Pictures
  // ============================================

  async getProgressPictures(userId: string, limit?: number): Promise<ProgressPicture[]> {
    const query = db
      .select()
      .from(progressPictures)
      .where(eq(progressPictures.userId, userId))
      .orderBy(desc(progressPictures.date));
    
    if (limit) {
      return query.limit(limit);
    }
    return query;
  }

  async createProgressPicture(picture: InsertProgressPicture): Promise<ProgressPicture> {
    const [created] = await db
      .insert(progressPictures)
      .values(picture)
      .returning();
    return created;
  }

  async deleteProgressPicture(id: number, userId: string): Promise<void> {
    await db
      .delete(progressPictures)
      .where(and(eq(progressPictures.id, id), eq(progressPictures.userId, userId)));
  }

  // ============================================
  // PROGRESS TRACKING - Sleep
  // ============================================

  async getSleepEntries(userId: string, limit?: number): Promise<SleepEntry[]> {
    const query = db
      .select()
      .from(sleepEntries)
      .where(eq(sleepEntries.userId, userId))
      .orderBy(desc(sleepEntries.date));
    
    if (limit) {
      return query.limit(limit);
    }
    return query;
  }

  async createSleepEntry(entry: InsertSleepEntry): Promise<SleepEntry> {
    const [created] = await db
      .insert(sleepEntries)
      .values(entry)
      .returning();
    return created;
  }

  async deleteSleepEntry(id: number, userId: string): Promise<void> {
    await db
      .delete(sleepEntries)
      .where(and(eq(sleepEntries.id, id), eq(sleepEntries.userId, userId)));
  }

  // ============================================
  // PROGRESS TRACKING - Steps
  // ============================================

  async getStepEntries(userId: string, limit?: number): Promise<StepEntry[]> {
    const query = db
      .select()
      .from(stepEntries)
      .where(eq(stepEntries.userId, userId))
      .orderBy(desc(stepEntries.date));
    
    if (limit) {
      return query.limit(limit);
    }
    return query;
  }

  async createStepEntry(entry: InsertStepEntry): Promise<StepEntry> {
    const [created] = await db
      .insert(stepEntries)
      .values(entry)
      .returning();
    return created;
  }

  async updateStepEntry(id: number, userId: string, data: Partial<{ steps: number; distance: number | null; activeMinutes: number | null; notes: string | null }>): Promise<StepEntry | undefined> {
    const [updated] = await db
      .update(stepEntries)
      .set(data)
      .where(and(eq(stepEntries.id, id), eq(stepEntries.userId, userId)))
      .returning();
    return updated;
  }

  async deleteStepEntry(id: number, userId: string): Promise<void> {
    await db
      .delete(stepEntries)
      .where(and(eq(stepEntries.id, id), eq(stepEntries.userId, userId)));
  }

  // ============================================
  // PROGRESS TRACKING - Stress/Burnout
  // ============================================

  async getStressEntries(userId: string, limit?: number): Promise<StressEntry[]> {
    const query = db
      .select()
      .from(stressEntries)
      .where(eq(stressEntries.userId, userId))
      .orderBy(desc(stressEntries.date));
    
    if (limit) {
      return query.limit(limit);
    }
    return query;
  }

  async createStressEntry(entry: InsertStressEntry): Promise<StressEntry> {
    const [created] = await db
      .insert(stressEntries)
      .values(entry)
      .returning();
    return created;
  }

  async deleteStressEntry(id: number, userId: string): Promise<void> {
    await db
      .delete(stressEntries)
      .where(and(eq(stressEntries.id, id), eq(stressEntries.userId, userId)));
  }

  // ============================================
  // PROGRESS TRACKING - Workout History
  // ============================================

  async getCompletedWorkoutLogs(userId: string, limit?: number): Promise<WorkoutLog[]> {
    const query = db
      .select()
      .from(workoutLogs)
      .where(and(
        eq(workoutLogs.userId, userId),
        eq(workoutLogs.status, 'completed')
      ))
      .orderBy(desc(workoutLogs.completedAt));
    
    if (limit) {
      return query.limit(limit);
    }
    return query;
  }

  // ============================================
  // PROGRESS TRACKING - Exercise Snapshots (PRs)
  // ============================================

  async getAllExerciseSnapshots(userId: string): Promise<ExerciseSnapshot[]> {
    return db
      .select()
      .from(exerciseSnapshots)
      .where(eq(exerciseSnapshots.userId, userId))
      .orderBy(desc(exerciseSnapshots.updatedAt));
  }

  // ============================================
  // PROGRESS TRACKING - Body Fat
  // ============================================

  async getBodyFatEntries(userId: string, limit?: number): Promise<BodyFatEntry[]> {
    const query = db
      .select()
      .from(bodyFatEntries)
      .where(eq(bodyFatEntries.userId, userId))
      .orderBy(desc(bodyFatEntries.date));
    
    if (limit) {
      return query.limit(limit);
    }
    return query;
  }

  async getBodyFatEntryById(id: number, userId: string): Promise<BodyFatEntry | null> {
    const [entry] = await db
      .select()
      .from(bodyFatEntries)
      .where(and(eq(bodyFatEntries.id, id), eq(bodyFatEntries.userId, userId)))
      .limit(1);
    return entry || null;
  }

  async createBodyFatEntry(entry: InsertBodyFatEntry): Promise<BodyFatEntry> {
    const [created] = await db
      .insert(bodyFatEntries)
      .values(entry)
      .returning();
    return created;
  }

  async deleteBodyFatEntry(id: number, userId: string): Promise<void> {
    await db
      .delete(bodyFatEntries)
      .where(and(eq(bodyFatEntries.id, id), eq(bodyFatEntries.userId, userId)));
  }

  async getBodyFatByDate(userId: string, date: Date): Promise<BodyFatEntry | null> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const [entry] = await db
      .select()
      .from(bodyFatEntries)
      .where(and(
        eq(bodyFatEntries.userId, userId),
        gte(bodyFatEntries.date, startOfDay),
        lte(bodyFatEntries.date, endOfDay)
      ))
      .limit(1);
    return entry || null;
  }

  async updateBodyFatEntry(id: number, userId: string, updates: Partial<InsertBodyFatEntry>): Promise<BodyFatEntry | null> {
    const [updated] = await db
      .update(bodyFatEntries)
      .set(updates)
      .where(and(eq(bodyFatEntries.id, id), eq(bodyFatEntries.userId, userId)))
      .returning();
    return updated || null;
  }

  // ============================================
  // PROGRESS TRACKING - Resting Heart Rate
  // ============================================

  async getRestingHREntries(userId: string, limit?: number): Promise<RestingHREntry[]> {
    const query = db
      .select()
      .from(restingHREntries)
      .where(eq(restingHREntries.userId, userId))
      .orderBy(desc(restingHREntries.date));
    
    if (limit) {
      return query.limit(limit);
    }
    return query;
  }

  async createRestingHREntry(entry: InsertRestingHREntry): Promise<RestingHREntry> {
    const [created] = await db
      .insert(restingHREntries)
      .values(entry)
      .returning();
    return created;
  }

  async deleteRestingHREntry(id: number, userId: string): Promise<void> {
    await db
      .delete(restingHREntries)
      .where(and(eq(restingHREntries.id, id), eq(restingHREntries.userId, userId)));
  }

  // ============================================
  // PROGRESS TRACKING - Blood Pressure
  // ============================================

  async getBloodPressureEntries(userId: string, limit?: number): Promise<BloodPressureEntry[]> {
    const query = db
      .select()
      .from(bloodPressureEntries)
      .where(eq(bloodPressureEntries.userId, userId))
      .orderBy(desc(bloodPressureEntries.date));
    
    if (limit) {
      return query.limit(limit);
    }
    return query;
  }

  async createBloodPressureEntry(entry: InsertBloodPressureEntry): Promise<BloodPressureEntry> {
    const [created] = await db
      .insert(bloodPressureEntries)
      .values(entry)
      .returning();
    return created;
  }

  async deleteBloodPressureEntry(id: number, userId: string): Promise<void> {
    await db
      .delete(bloodPressureEntries)
      .where(and(eq(bloodPressureEntries.id, id), eq(bloodPressureEntries.userId, userId)));
  }

  // ============================================
  // PROGRESS TRACKING - Lean Body Mass
  // ============================================

  async getLeanBodyMassEntries(userId: string, limit?: number): Promise<LeanBodyMassEntry[]> {
    const query = db
      .select()
      .from(leanBodyMassEntries)
      .where(eq(leanBodyMassEntries.userId, userId))
      .orderBy(desc(leanBodyMassEntries.date));
    
    if (limit) {
      return query.limit(limit);
    }
    return query;
  }

  async createLeanBodyMassEntry(entry: InsertLeanBodyMassEntry): Promise<LeanBodyMassEntry> {
    const [created] = await db
      .insert(leanBodyMassEntries)
      .values(entry)
      .returning();
    return created;
  }

  async deleteLeanBodyMassEntry(id: number, userId: string): Promise<void> {
    await db
      .delete(leanBodyMassEntries)
      .where(and(eq(leanBodyMassEntries.id, id), eq(leanBodyMassEntries.userId, userId)));
  }

  async getLeanBodyMassByDate(userId: string, date: Date): Promise<LeanBodyMassEntry | null> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const [entry] = await db
      .select()
      .from(leanBodyMassEntries)
      .where(and(
        eq(leanBodyMassEntries.userId, userId),
        gte(leanBodyMassEntries.date, startOfDay),
        lte(leanBodyMassEntries.date, endOfDay)
      ))
      .limit(1);
    return entry || null;
  }

  async updateLeanBodyMassEntry(id: number, userId: string, updates: Partial<InsertLeanBodyMassEntry>): Promise<LeanBodyMassEntry | null> {
    const [updated] = await db
      .update(leanBodyMassEntries)
      .set(updates)
      .where(and(eq(leanBodyMassEntries.id, id), eq(leanBodyMassEntries.userId, userId)))
      .returning();
    return updated || null;
  }

  // ============================================
  // PROGRESS TRACKING - Caloric Intake
  // ============================================

  async getCaloricIntakeEntries(userId: string, limit?: number): Promise<CaloricIntakeEntry[]> {
    const query = db
      .select()
      .from(caloricIntakeEntries)
      .where(eq(caloricIntakeEntries.userId, userId))
      .orderBy(desc(caloricIntakeEntries.date));
    
    if (limit) {
      return query.limit(limit);
    }
    return query;
  }

  async createCaloricIntakeEntry(entry: InsertCaloricIntakeEntry): Promise<CaloricIntakeEntry> {
    const [created] = await db
      .insert(caloricIntakeEntries)
      .values(entry)
      .returning();
    return created;
  }

  async deleteCaloricIntakeEntry(id: number, userId: string): Promise<void> {
    await db
      .delete(caloricIntakeEntries)
      .where(and(eq(caloricIntakeEntries.id, id), eq(caloricIntakeEntries.userId, userId)));
  }

  // ============================================
  // PROGRESS TRACKING - Caloric Burn
  // ============================================

  async getCaloricBurnEntries(userId: string, limit?: number): Promise<CaloricBurnEntry[]> {
    const query = db
      .select()
      .from(caloricBurnEntries)
      .where(eq(caloricBurnEntries.userId, userId))
      .orderBy(desc(caloricBurnEntries.date));
    
    if (limit) {
      return query.limit(limit);
    }
    return query;
  }

  async createCaloricBurnEntry(entry: InsertCaloricBurnEntry): Promise<CaloricBurnEntry> {
    const [created] = await db
      .insert(caloricBurnEntries)
      .values(entry)
      .returning();
    return created;
  }

  async deleteCaloricBurnEntry(id: number, userId: string): Promise<void> {
    await db
      .delete(caloricBurnEntries)
      .where(and(eq(caloricBurnEntries.id, id), eq(caloricBurnEntries.userId, userId)));
  }

  // ============================================
  // EXERCISE MINUTES
  // ============================================

  async getExerciseMinutesEntries(userId: string, limit?: number): Promise<ExerciseMinutesEntry[]> {
    const query = db
      .select()
      .from(exerciseMinutesEntries)
      .where(eq(exerciseMinutesEntries.userId, userId))
      .orderBy(desc(exerciseMinutesEntries.date));
    
    if (limit) {
      return query.limit(limit);
    }
    return query;
  }

  async createExerciseMinutesEntry(entry: InsertExerciseMinutesEntry): Promise<ExerciseMinutesEntry> {
    const [created] = await db
      .insert(exerciseMinutesEntries)
      .values(entry)
      .returning();
    return created;
  }

  async deleteExerciseMinutesEntry(id: number, userId: string): Promise<void> {
    await db
      .delete(exerciseMinutesEntries)
      .where(and(eq(exerciseMinutesEntries.id, id), eq(exerciseMinutesEntries.userId, userId)));
  }

  // ============================================
  // NUTRITION TRACKING
  // ============================================

  async getNutritionGoal(userId: string): Promise<NutritionGoal | undefined> {
    const [goal] = await db
      .select()
      .from(nutritionGoals)
      .where(and(eq(nutritionGoals.userId, userId), eq(nutritionGoals.isActive, true)))
      .limit(1);
    return goal;
  }

  async createOrUpdateNutritionGoal(userId: string, goal: { calorieTarget: number; proteinTarget: number; carbsTarget: number; fatTarget: number }): Promise<NutritionGoal> {
    const existing = await this.getNutritionGoal(userId);
    
    if (existing) {
      const [updated] = await db
        .update(nutritionGoals)
        .set({
          ...goal,
          updatedAt: new Date(),
        })
        .where(eq(nutritionGoals.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(nutritionGoals)
        .values({
          userId,
          ...goal,
        })
        .returning();
      return created;
    }
  }

  async getFoodLogsForDate(userId: string, date: Date): Promise<FoodLog[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return db
      .select()
      .from(foodLogs)
      .where(
        and(
          eq(foodLogs.userId, userId),
          gte(foodLogs.date, startOfDay),
          lte(foodLogs.date, endOfDay)
        )
      )
      .orderBy(desc(foodLogs.createdAt));
  }

  async getNutritionHistory(userId: string, days: number): Promise<{ date: string; calories: number; protein: number; carbs: number; fat: number }[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Fetch from old foodLogs table
    const oldLogs = await db
      .select()
      .from(foodLogs)
      .where(
        and(
          eq(foodLogs.userId, userId),
          gte(foodLogs.date, startDate),
          lte(foodLogs.date, endDate)
        )
      );

    // Fetch from new meal-based system (mealLogs + mealFoodEntries)
    const mealLogsData = await db
      .select()
      .from(mealLogs)
      .where(
        and(
          eq(mealLogs.userId, userId),
          gte(mealLogs.date, startDate),
          lte(mealLogs.date, endDate)
        )
      );

    const mealLogIds = mealLogsData.map(ml => ml.id);
    let mealFoodEntriesData: any[] = [];
    if (mealLogIds.length > 0) {
      mealFoodEntriesData = await db
        .select({
          mealLogId: mealFoodEntries.mealLogId,
          calories: mealFoodEntries.calories,
          protein: mealFoodEntries.protein,
          carbs: mealFoodEntries.carbs,
          fat: mealFoodEntries.fat,
          mealDate: mealLogs.date,
        })
        .from(mealFoodEntries)
        .innerJoin(mealLogs, eq(mealFoodEntries.mealLogId, mealLogs.id))
        .where(inArray(mealFoodEntries.mealLogId, mealLogIds));
    }

    // Group by date and sum
    const grouped: Record<string, { calories: number; protein: number; carbs: number; fat: number }> = {};
    
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      grouped[key] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }

    // Add old food logs
    for (const log of oldLogs) {
      const key = new Date(log.date).toISOString().split('T')[0];
      if (grouped[key]) {
        grouped[key].calories += log.calories || 0;
        grouped[key].protein += log.protein || 0;
        grouped[key].carbs += log.carbs || 0;
        grouped[key].fat += log.fat || 0;
      }
    }

    // Add new meal food entries
    for (const entry of mealFoodEntriesData) {
      const key = new Date(entry.mealDate).toISOString().split('T')[0];
      if (grouped[key]) {
        grouped[key].calories += entry.calories || 0;
        grouped[key].protein += entry.protein || 0;
        grouped[key].carbs += entry.carbs || 0;
        grouped[key].fat += entry.fat || 0;
      }
    }

    return Object.entries(grouped)
      .map(([date, totals]) => ({ date, ...totals }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async createFoodLog(log: InsertFoodLog): Promise<FoodLog> {
    const [created] = await db
      .insert(foodLogs)
      .values(log)
      .returning();
    return created;
  }

  async updateFoodLog(id: number, updates: Partial<InsertFoodLog>): Promise<FoodLog> {
    const [updated] = await db
      .update(foodLogs)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(foodLogs.id, id))
      .returning();
    return updated;
  }

  async deleteFoodLog(id: number): Promise<void> {
    await db.delete(foodLogs).where(eq(foodLogs.id, id));
  }

  // ============================================
  // SUPPLEMENT STACK
  // ============================================

  async getUserSupplements(userId: string): Promise<Supplement[]> {
    return db
      .select()
      .from(supplements)
      .where(and(eq(supplements.userId, userId), eq(supplements.isActive, true)))
      .orderBy(supplements.timeOfDay, supplements.name);
  }

  async getAllUserSupplements(userId: string): Promise<Supplement[]> {
    return db
      .select()
      .from(supplements)
      .where(eq(supplements.userId, userId))
      .orderBy(supplements.timeOfDay, supplements.name);
  }

  async createSupplement(supplement: InsertSupplement): Promise<Supplement> {
    const [created] = await db
      .insert(supplements)
      .values(supplement)
      .returning();
    return created;
  }

  async updateSupplement(id: number, data: Partial<InsertSupplement>): Promise<Supplement> {
    const [updated] = await db
      .update(supplements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(supplements.id, id))
      .returning();
    return updated;
  }

  async deleteSupplement(id: number): Promise<void> {
    await db
      .update(supplements)
      .set({ isActive: false })
      .where(eq(supplements.id, id));
  }

  async permanentlyDeleteSupplement(id: number): Promise<void> {
    await db.delete(supplementLogs).where(eq(supplementLogs.supplementId, id));
    await db.delete(supplements).where(eq(supplements.id, id));
  }

  async hasSupplementLogs(supplementId: number): Promise<boolean> {
    const logs = await db
      .select()
      .from(supplementLogs)
      .where(
        and(
          eq(supplementLogs.supplementId, supplementId),
          eq(supplementLogs.taken, true)
        )
      )
      .limit(1);
    return logs.length > 0;
  }

  async getSupplementById(id: number): Promise<Supplement | null> {
    const [supplement] = await db
      .select()
      .from(supplements)
      .where(eq(supplements.id, id));
    return supplement || null;
  }

  async getSupplementLogs(userId: string, supplementId: number): Promise<SupplementLog[]> {
    return db
      .select()
      .from(supplementLogs)
      .where(
        and(
          eq(supplementLogs.userId, userId),
          eq(supplementLogs.supplementId, supplementId),
          eq(supplementLogs.taken, true)
        )
      )
      .orderBy(desc(supplementLogs.date));
  }

  async getSupplementStats(userId: string, supplementId: number): Promise<{ totalLogs: number; currentStreak: number; longestStreak: number; monthlyPercentage: number }> {
    // Get the supplement to check its frequency
    const supplement = await this.getSupplementById(supplementId);
    const frequency = supplement?.frequency || 1; // Default to daily if not set

    const logs = await db
      .select()
      .from(supplementLogs)
      .where(
        and(
          eq(supplementLogs.userId, userId),
          eq(supplementLogs.supplementId, supplementId),
          eq(supplementLogs.taken, true)
        )
      )
      .orderBy(desc(supplementLogs.date));

    const totalLogs = logs.length;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Calculate current streak (accounting for frequency)
    let currentStreak = 0;
    let expectedDate = new Date(today);
    
    for (let i = 0; i < logs.length; i++) {
      const logDate = new Date(logs[i].date);
      logDate.setHours(0, 0, 0, 0);
      
      // Allow for some flexibility: log can be within frequency days of expected date
      const daysDiff = Math.abs((expectedDate.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= frequency) {
        currentStreak++;
        // Move expected date back by frequency days from the log date
        expectedDate = new Date(logDate);
        expectedDate.setDate(expectedDate.getDate() - frequency);
      } else {
        break;
      }
    }
    
    // Calculate longest streak (accounting for frequency)
    let longestStreak = 0;
    let tempStreak = 0;
    let prevDate: Date | null = null;
    
    for (const log of logs) {
      const logDate = new Date(log.date);
      logDate.setHours(0, 0, 0, 0);
      
      if (prevDate) {
        const dayDiff = (prevDate.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24);
        // For frequency-based supplements, consecutive is within frequency+1 days
        if (dayDiff <= frequency + 1) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      } else {
        tempStreak = 1;
      }
      prevDate = logDate;
    }
    longestStreak = Math.max(longestStreak, tempStreak);
    
    // Calculate monthly percentage (accounting for frequency)
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const daysInMonth = today.getDate();
    const expectedLogsThisMonth = Math.ceil(daysInMonth / frequency);
    const logsThisMonth = logs.filter(log => {
      const logDate = new Date(log.date);
      return logDate >= monthStart && logDate <= today;
    }).length;
    const monthlyPercentage = expectedLogsThisMonth > 0 ? Math.min(100, Math.round((logsThisMonth / expectedLogsThisMonth) * 100)) : 0;
    
    return { totalLogs, currentStreak, longestStreak, monthlyPercentage };
  }

  async getSupplementLogsForDate(userId: string, date: Date): Promise<SupplementLog[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return db
      .select()
      .from(supplementLogs)
      .where(
        and(
          eq(supplementLogs.userId, userId),
          gte(supplementLogs.date, startOfDay),
          lte(supplementLogs.date, endOfDay)
        )
      );
  }

  async toggleSupplementTaken(userId: string, supplementId: number, date: Date): Promise<{ taken: boolean }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Check if log exists for today
    const [existingLog] = await db
      .select()
      .from(supplementLogs)
      .where(
        and(
          eq(supplementLogs.userId, userId),
          eq(supplementLogs.supplementId, supplementId),
          gte(supplementLogs.date, startOfDay),
          lte(supplementLogs.date, endOfDay)
        )
      );

    if (existingLog) {
      // Toggle existing
      const newTaken = !existingLog.taken;
      await db
        .update(supplementLogs)
        .set({
          taken: newTaken,
          takenAt: newTaken ? new Date() : null,
        })
        .where(eq(supplementLogs.id, existingLog.id));
      return { taken: newTaken };
    } else {
      // Create new log as taken
      await db
        .insert(supplementLogs)
        .values({
          userId,
          supplementId,
          date: startOfDay,
          taken: true,
          takenAt: new Date(),
        });
      return { taken: true };
    }
  }

  // ============================================
  // Enhanced Meal/Food Operations
  // ============================================

  async getMealLogsForDate(userId: string, date: Date): Promise<MealLog[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return db
      .select()
      .from(mealLogs)
      .where(
        and(
          eq(mealLogs.userId, userId),
          gte(mealLogs.date, startOfDay),
          lte(mealLogs.date, endOfDay)
        )
      )
      .orderBy(mealLogs.mealTime);
  }

  async getMealLogWithFoods(mealLogId: number): Promise<{ mealLog: MealLog; foods: MealFoodEntry[] } | null> {
    const [mealLog] = await db.select().from(mealLogs).where(eq(mealLogs.id, mealLogId));
    if (!mealLog) return null;
    
    const foods = await db
      .select()
      .from(mealFoodEntries)
      .where(eq(mealFoodEntries.mealLogId, mealLogId))
      .orderBy(mealFoodEntries.createdAt);
    
    return { mealLog, foods };
  }

  async createMealLog(log: InsertMealLog): Promise<MealLog> {
    const [created] = await db.insert(mealLogs).values(log).returning();
    return created;
  }

  async getOrCreateMealLog(userId: string, date: Date, mealName: string): Promise<MealLog> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Check if meal log already exists for this date and meal name
    const [existing] = await db
      .select()
      .from(mealLogs)
      .where(
        and(
          eq(mealLogs.userId, userId),
          eq(mealLogs.mealName, mealName),
          gte(mealLogs.date, startOfDay),
          lte(mealLogs.date, endOfDay)
        )
      );

    if (existing) return existing;

    // Create new meal log
    const [created] = await db
      .insert(mealLogs)
      .values({
        userId,
        date: startOfDay,
        mealName,
      })
      .returning();
    
    return created;
  }

  async deleteMealLog(id: number): Promise<void> {
    await db.delete(mealLogs).where(eq(mealLogs.id, id));
  }

  async addFoodToMeal(entry: InsertMealFoodEntry): Promise<MealFoodEntry> {
    const [created] = await db.insert(mealFoodEntries).values(entry).returning();
    
    // Also add/update food history
    const servingSize = entry.servingSize || 100;
    const servingQuantity = entry.servingQuantity || 1;
    const totalAmount = servingSize * servingQuantity;
    await this.addOrUpdateFoodHistory(entry.userId, {
      foodName: entry.foodName,
      brand: entry.brand || undefined,
      defaultServingSize: servingSize,
      defaultServingSizeUnit: entry.servingSizeUnit || 'gram',
      caloriesPer100: totalAmount > 0 ? Math.round((entry.calories / totalAmount) * 100) : entry.calories,
      proteinPer100: entry.protein && totalAmount > 0 ? (entry.protein / totalAmount) * 100 : 0,
      carbsPer100: entry.carbs && totalAmount > 0 ? (entry.carbs / totalAmount) * 100 : 0,
      fatPer100: entry.fat && totalAmount > 0 ? (entry.fat / totalAmount) * 100 : 0,
    });
    
    return created;
  }

  async updateMealFoodEntry(id: number, updates: Partial<InsertMealFoodEntry>): Promise<MealFoodEntry> {
    const [updated] = await db
      .update(mealFoodEntries)
      .set(updates)
      .where(eq(mealFoodEntries.id, id))
      .returning();
    return updated;
  }

  async deleteMealFoodEntry(id: number): Promise<void> {
    await db.delete(mealFoodEntries).where(eq(mealFoodEntries.id, id));
  }

  async getMealDayTotals(userId: string, date: Date): Promise<{ calories: number; protein: number; carbs: number; fat: number }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await db
      .select({
        totalCalories: sql<number>`COALESCE(SUM(${mealFoodEntries.calories}), 0)`,
        totalProtein: sql<number>`COALESCE(SUM(${mealFoodEntries.protein}), 0)`,
        totalCarbs: sql<number>`COALESCE(SUM(${mealFoodEntries.carbs}), 0)`,
        totalFat: sql<number>`COALESCE(SUM(${mealFoodEntries.fat}), 0)`,
      })
      .from(mealFoodEntries)
      .innerJoin(mealLogs, eq(mealFoodEntries.mealLogId, mealLogs.id))
      .where(
        and(
          eq(mealFoodEntries.userId, userId),
          gte(mealLogs.date, startOfDay),
          lte(mealLogs.date, endOfDay)
        )
      );

    return {
      calories: Number(result[0]?.totalCalories || 0),
      protein: Number(result[0]?.totalProtein || 0),
      carbs: Number(result[0]?.totalCarbs || 0),
      fat: Number(result[0]?.totalFat || 0),
    };
  }

  // ============================================
  // Food History Operations
  // ============================================

  async getUserFoodHistory(userId: string, limit: number = 50): Promise<UserFoodHistoryItem[]> {
    return db
      .select()
      .from(userFoodHistory)
      .where(eq(userFoodHistory.userId, userId))
      .orderBy(desc(userFoodHistory.lastUsedAt))
      .limit(limit);
  }

  async searchUserFoodHistory(userId: string, query: string): Promise<UserFoodHistoryItem[]> {
    return db
      .select()
      .from(userFoodHistory)
      .where(
        and(
          eq(userFoodHistory.userId, userId),
          or(
            ilike(userFoodHistory.foodName, `%${query}%`),
            ilike(userFoodHistory.brand, `%${query}%`)
          )
        )
      )
      .orderBy(desc(userFoodHistory.timesUsed))
      .limit(20);
  }

  async addOrUpdateFoodHistory(userId: string, food: Omit<InsertUserFoodHistoryItem, 'userId'>): Promise<UserFoodHistoryItem> {
    // Check if similar food already exists
    const [existing] = await db
      .select()
      .from(userFoodHistory)
      .where(
        and(
          eq(userFoodHistory.userId, userId),
          eq(userFoodHistory.foodName, food.foodName),
          food.brand ? eq(userFoodHistory.brand, food.brand) : sql`${userFoodHistory.brand} IS NULL`
        )
      );

    if (existing) {
      // Update times used and last used timestamp
      const [updated] = await db
        .update(userFoodHistory)
        .set({
          timesUsed: (existing.timesUsed || 1) + 1,
          lastUsedAt: new Date(),
        })
        .where(eq(userFoodHistory.id, existing.id))
        .returning();
      return updated;
    }

    // Create new history item
    const [created] = await db
      .insert(userFoodHistory)
      .values({
        userId,
        ...food,
      })
      .returning();
    return created;
  }

  async deleteFoodHistoryItem(id: number): Promise<void> {
    await db.delete(userFoodHistory).where(eq(userFoodHistory.id, id));
  }

  // ============================================
  // Saved Meal Templates Operations
  // ============================================

  async getUserSavedMeals(userId: string): Promise<SavedMealTemplate[]> {
    return db
      .select()
      .from(savedMealTemplates)
      .where(eq(savedMealTemplates.userId, userId))
      .orderBy(desc(savedMealTemplates.updatedAt));
  }

  async getSavedMealWithItems(savedMealId: number): Promise<{ template: SavedMealTemplate; items: SavedMealItem[] } | null> {
    const [template] = await db.select().from(savedMealTemplates).where(eq(savedMealTemplates.id, savedMealId));
    if (!template) return null;
    
    const items = await db
      .select()
      .from(savedMealItems)
      .where(eq(savedMealItems.savedMealId, savedMealId));
    
    return { template, items };
  }

  async createSavedMealTemplate(template: InsertSavedMealTemplate): Promise<SavedMealTemplate> {
    const [created] = await db.insert(savedMealTemplates).values(template).returning();
    return created;
  }

  async updateSavedMealTemplate(id: number, updates: Partial<InsertSavedMealTemplate>): Promise<SavedMealTemplate> {
    const [updated] = await db
      .update(savedMealTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(savedMealTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteSavedMealTemplate(id: number): Promise<void> {
    await db.delete(savedMealTemplates).where(eq(savedMealTemplates.id, id));
  }

  async addItemToSavedMeal(item: InsertSavedMealItem): Promise<SavedMealItem> {
    const [created] = await db.insert(savedMealItems).values(item).returning();
    
    // Recalculate template totals
    await this.recalculateSavedMealTotals(item.savedMealId);
    
    return created;
  }

  async deleteItemFromSavedMeal(id: number): Promise<void> {
    // Get the saved meal ID before deleting
    const [item] = await db.select().from(savedMealItems).where(eq(savedMealItems.id, id));
    if (item) {
      await db.delete(savedMealItems).where(eq(savedMealItems.id, id));
      await this.recalculateSavedMealTotals(item.savedMealId);
    }
  }

  private async recalculateSavedMealTotals(savedMealId: number): Promise<void> {
    const items = await db.select().from(savedMealItems).where(eq(savedMealItems.savedMealId, savedMealId));
    
    const totals = items.reduce((acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + (item.protein || 0),
      carbs: acc.carbs + (item.carbs || 0),
      fat: acc.fat + (item.fat || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    await db
      .update(savedMealTemplates)
      .set({
        totalCalories: totals.calories,
        totalProtein: totals.protein,
        totalCarbs: totals.carbs,
        totalFat: totals.fat,
        updatedAt: new Date(),
      })
      .where(eq(savedMealTemplates.id, savedMealId));
  }

  async addSavedMealToLog(userId: string, savedMealId: number, mealLogId: number, servings: number): Promise<MealFoodEntry[]> {
    const savedMeal = await this.getSavedMealWithItems(savedMealId);
    if (!savedMeal) return [];

    const entries: MealFoodEntry[] = [];
    for (const item of savedMeal.items) {
      const [entry] = await db
        .insert(mealFoodEntries)
        .values({
          mealLogId,
          userId,
          foodName: item.foodName,
          brand: item.brand,
          servingSize: item.servingSize,
          servingSizeUnit: item.servingSizeUnit,
          servingQuantity: item.servingQuantity * servings,
          calories: Math.round(item.calories * servings),
          protein: (item.protein || 0) * servings,
          carbs: (item.carbs || 0) * servings,
          fat: (item.fat || 0) * servings,
          sourceType: 'saved_meal',
          sourceId: savedMealId,
        })
        .returning();
      entries.push(entry);
    }

    // Update times used
    await db
      .update(savedMealTemplates)
      .set({ timesUsed: sql`${savedMealTemplates.timesUsed} + 1` })
      .where(eq(savedMealTemplates.id, savedMealId));

    return entries;
  }

  // ============================================
  // Recipe to Meal Integration
  // ============================================

  async addRecipeToMeal(userId: string, recipeId: number, mealLogId: number, servings: number): Promise<MealFoodEntry> {
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
    if (!recipe) throw new Error('Recipe not found');

    const multiplier = servings / recipe.servings;
    
    const [entry] = await db
      .insert(mealFoodEntries)
      .values({
        mealLogId,
        userId,
        foodName: recipe.title,
        servingSize: 1,
        servingSizeUnit: 'serving',
        servingQuantity: servings,
        calories: Math.round(recipe.calories * multiplier),
        protein: recipe.protein * multiplier,
        carbs: recipe.carbs * multiplier,
        fat: recipe.fat * multiplier,
        sourceType: 'recipe',
        sourceId: recipeId,
      })
      .returning();
    
    return entry;
  }

  // ============================================
  // User Meal Categories
  // ============================================

  async getUserMealCategories(userId: string): Promise<UserMealCategory[]> {
    const categories = await db
      .select()
      .from(userMealCategories)
      .where(eq(userMealCategories.userId, userId))
      .orderBy(asc(userMealCategories.displayOrder));
    
    // If no categories exist, initialize defaults
    if (categories.length === 0) {
      return this.initializeDefaultMealCategories(userId);
    }
    
    return categories;
  }

  async createUserMealCategory(category: InsertUserMealCategory): Promise<UserMealCategory> {
    const [created] = await db.insert(userMealCategories).values(category).returning();
    return created;
  }

  async updateUserMealCategory(id: number, updates: Partial<InsertUserMealCategory>): Promise<UserMealCategory> {
    const [updated] = await db
      .update(userMealCategories)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userMealCategories.id, id))
      .returning();
    return updated;
  }

  async deleteUserMealCategory(id: number): Promise<void> {
    await db.delete(userMealCategories).where(eq(userMealCategories.id, id));
  }

  async initializeDefaultMealCategories(userId: string): Promise<UserMealCategory[]> {
    // Double-check to prevent race condition duplicates
    const existing = await db
      .select()
      .from(userMealCategories)
      .where(eq(userMealCategories.userId, userId));
    
    if (existing.length > 0) {
      return existing;
    }
    
    const defaults = [
      { userId, name: 'Breakfast', displayOrder: 0, isDefault: true },
      { userId, name: 'Lunch', displayOrder: 1, isDefault: true },
      { userId, name: 'Dinner', displayOrder: 2, isDefault: true },
      { userId, name: 'Snack', displayOrder: 3, isDefault: true },
    ];
    
    const created = await db.insert(userMealCategories).values(defaults).returning();
    return created;
  }

  // ============================================
  // Breath Work Operations
  // ============================================

  async getBreathTechniques(): Promise<BreathTechnique[]> {
    return await db
      .select()
      .from(breathTechniques)
      .where(eq(breathTechniques.isActive, true))
      .orderBy(asc(breathTechniques.sortOrder));
  }

  async getBreathTechniqueById(id: number): Promise<BreathTechnique | undefined> {
    const [technique] = await db.select().from(breathTechniques).where(eq(breathTechniques.id, id));
    return technique;
  }

  async getBreathTechniqueBySlug(slug: string): Promise<BreathTechnique | undefined> {
    const [technique] = await db.select().from(breathTechniques).where(eq(breathTechniques.slug, slug));
    return technique;
  }

  async createBreathTechnique(technique: InsertBreathTechnique): Promise<BreathTechnique> {
    const [created] = await db.insert(breathTechniques).values(technique).returning();
    return created;
  }

  async updateBreathTechnique(id: number, technique: Partial<InsertBreathTechnique>): Promise<BreathTechnique> {
    const [updated] = await db.update(breathTechniques).set(technique).where(eq(breathTechniques.id, id)).returning();
    return updated;
  }

  async deleteBreathTechnique(id: number): Promise<void> {
    await db.delete(breathTechniques).where(eq(breathTechniques.id, id));
  }

  async getBreathWorkSessionLogs(userId: string, limit?: number): Promise<BreathWorkSessionLog[]> {
    if (limit) {
      return await db
        .select()
        .from(breathWorkSessionLogs)
        .where(eq(breathWorkSessionLogs.userId, userId))
        .orderBy(desc(breathWorkSessionLogs.completedAt))
        .limit(limit);
    }
    
    return await db
      .select()
      .from(breathWorkSessionLogs)
      .where(eq(breathWorkSessionLogs.userId, userId))
      .orderBy(desc(breathWorkSessionLogs.completedAt));
  }

  async createBreathWorkSessionLog(session: InsertBreathWorkSessionLog): Promise<BreathWorkSessionLog> {
    const [created] = await db.insert(breathWorkSessionLogs).values(session).returning();
    return created;
  }

  async getBreathWorkStats(userId: string): Promise<{ totalSessions: number; totalMinutes: number; currentStreak: number }> {
    const sessions = await db
      .select()
      .from(breathWorkSessionLogs)
      .where(eq(breathWorkSessionLogs.userId, userId))
      .orderBy(desc(breathWorkSessionLogs.completedAt));

    const totalSessions = sessions.length;
    const totalMinutes = Math.round(sessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60);

    // Calculate streak - count consecutive days with sessions
    let currentStreak = 0;
    if (sessions.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const sessionDates = [...new Set(sessions.map(s => {
        const date = new Date(s.completedAt);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
      }))].sort((a, b) => b - a);

      const todayTime = today.getTime();
      const oneDayMs = 24 * 60 * 60 * 1000;
      
      // Check if there's a session today or yesterday (streak continues)
      if (sessionDates.length > 0 && (sessionDates[0] === todayTime || sessionDates[0] === todayTime - oneDayMs)) {
        let expectedDate = sessionDates[0];
        for (const dateTime of sessionDates) {
          if (dateTime === expectedDate) {
            currentStreak++;
            expectedDate -= oneDayMs;
          } else {
            break;
          }
        }
      }
    }

    return { totalSessions, totalMinutes, currentStreak };
  }

  async getCustomBreathRoutines(userId: string): Promise<CustomBreathRoutine[]> {
    return await db
      .select()
      .from(customBreathRoutines)
      .where(eq(customBreathRoutines.userId, userId))
      .orderBy(desc(customBreathRoutines.createdAt));
  }

  async getCustomBreathRoutineById(id: number): Promise<CustomBreathRoutine | undefined> {
    const [routine] = await db.select().from(customBreathRoutines).where(eq(customBreathRoutines.id, id));
    return routine;
  }

  async createCustomBreathRoutine(routine: InsertCustomBreathRoutine): Promise<CustomBreathRoutine> {
    const [created] = await db.insert(customBreathRoutines).values(routine).returning();
    return created;
  }

  async updateCustomBreathRoutine(id: number, routine: Partial<InsertCustomBreathRoutine>): Promise<CustomBreathRoutine> {
    const [updated] = await db
      .update(customBreathRoutines)
      .set({ ...routine, updatedAt: new Date() })
      .where(eq(customBreathRoutines.id, id))
      .returning();
    return updated;
  }

  async deleteCustomBreathRoutine(id: number): Promise<void> {
    await db.delete(customBreathRoutines).where(eq(customBreathRoutines.id, id));
  }

  async getBreathRoutinePhases(routineId: number): Promise<BreathRoutinePhase[]> {
    return await db
      .select()
      .from(breathRoutinePhases)
      .where(eq(breathRoutinePhases.routineId, routineId))
      .orderBy(asc(breathRoutinePhases.position));
  }

  async createBreathRoutinePhase(phase: InsertBreathRoutinePhase): Promise<BreathRoutinePhase> {
    const [created] = await db.insert(breathRoutinePhases).values(phase).returning();
    return created;
  }

  async updateBreathRoutinePhase(id: number, phase: Partial<InsertBreathRoutinePhase>): Promise<BreathRoutinePhase> {
    const [updated] = await db
      .update(breathRoutinePhases)
      .set(phase)
      .where(eq(breathRoutinePhases.id, id))
      .returning();
    return updated;
  }

  async deleteBreathRoutinePhase(id: number): Promise<void> {
    await db.delete(breathRoutinePhases).where(eq(breathRoutinePhases.id, id));
  }

  async deleteBreathRoutinePhasesByRoutineId(routineId: number): Promise<void> {
    await db.delete(breathRoutinePhases).where(eq(breathRoutinePhases.routineId, routineId));
  }

  async getBreathFavourites(userId: string): Promise<BreathFavourite[]> {
    return await db
      .select()
      .from(breathFavourites)
      .where(eq(breathFavourites.userId, userId))
      .orderBy(desc(breathFavourites.createdAt));
  }

  async getBreathFavouritesWithTechniques(userId: string): Promise<(BreathFavourite & { technique: BreathTechnique })[]> {
    const results = await db
      .select()
      .from(breathFavourites)
      .innerJoin(breathTechniques, eq(breathFavourites.techniqueId, breathTechniques.id))
      .where(eq(breathFavourites.userId, userId))
      .orderBy(desc(breathFavourites.createdAt));
    
    return results.map(r => ({
      ...r.breath_favourites,
      technique: r.breath_techniques,
    }));
  }

  async isBreathTechniqueFavourite(userId: string, techniqueId: number): Promise<boolean> {
    const [fav] = await db
      .select()
      .from(breathFavourites)
      .where(and(
        eq(breathFavourites.userId, userId),
        eq(breathFavourites.techniqueId, techniqueId)
      ));
    return !!fav;
  }

  async addBreathFavourite(favourite: InsertBreathFavourite): Promise<BreathFavourite> {
    const [created] = await db.insert(breathFavourites).values(favourite).returning();
    return created;
  }

  async removeBreathFavourite(userId: string, techniqueId: number): Promise<void> {
    await db
      .delete(breathFavourites)
      .where(and(
        eq(breathFavourites.userId, userId),
        eq(breathFavourites.techniqueId, techniqueId)
      ));
  }

  // Meditation operations
  async createMeditationSession(session: InsertMeditationSessionLog): Promise<MeditationSessionLog> {
    const [created] = await db.insert(meditationSessionLogs).values(session).returning();
    return created;
  }

  async getMeditationSessions(userId: string, limit?: number): Promise<MeditationSessionLog[]> {
    const query = db
      .select()
      .from(meditationSessionLogs)
      .where(eq(meditationSessionLogs.userId, userId))
      .orderBy(desc(meditationSessionLogs.completedAt));
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async getMeditationStats(userId: string): Promise<{ totalSessions: number; totalMinutes: number; currentStreak: number }> {
    const sessions = await db
      .select()
      .from(meditationSessionLogs)
      .where(eq(meditationSessionLogs.userId, userId))
      .orderBy(desc(meditationSessionLogs.completedAt));

    const totalSessions = sessions.length;
    const totalMinutes = Math.round(sessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60);

    let currentStreak = 0;
    if (sessions.length > 0) {
      const uniqueDates = [...new Set(sessions.map(s => {
        const d = s.completedAt ? new Date(s.completedAt) : new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }))].sort().reverse();

      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

      if (uniqueDates[0] === todayStr || uniqueDates[0] === yesterdayStr) {
        currentStreak = 1;
        for (let i = 1; i < uniqueDates.length; i++) {
          const prev = new Date(uniqueDates[i - 1]);
          const curr = new Date(uniqueDates[i]);
          const diffMs = prev.getTime() - curr.getTime();
          const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
    }

    return { totalSessions, totalMinutes, currentStreak };
  }

  // Gratitude Journal operations
  async createGratitudeEntry(entry: InsertGratitudeEntry): Promise<GratitudeEntry> {
    const [created] = await db.insert(gratitudeEntries).values(entry).returning();
    return created;
  }

  async getGratitudeEntries(userId: string, date?: string): Promise<GratitudeEntry[]> {
    if (date) {
      const startOfDay = new Date(date + 'T00:00:00.000Z');
      const endOfDay = new Date(date + 'T23:59:59.999Z');
      return await db
        .select()
        .from(gratitudeEntries)
        .where(and(
          eq(gratitudeEntries.userId, userId),
          gte(gratitudeEntries.createdAt, startOfDay),
          lte(gratitudeEntries.createdAt, endOfDay)
        ))
        .orderBy(desc(gratitudeEntries.createdAt));
    }
    return await db
      .select()
      .from(gratitudeEntries)
      .where(eq(gratitudeEntries.userId, userId))
      .orderBy(desc(gratitudeEntries.createdAt));
  }

  async getGratitudeEntryDates(userId: string): Promise<string[]> {
    const entries = await db
      .select({ createdAt: gratitudeEntries.createdAt })
      .from(gratitudeEntries)
      .where(eq(gratitudeEntries.userId, userId))
      .orderBy(desc(gratitudeEntries.createdAt));
    const dates = [...new Set(entries.map(e => {
      const d = e.createdAt ? new Date(e.createdAt) : new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }))];
    return dates;
  }

  // Meal Plan operations
  async getUserMealPlan(userId: string): Promise<MealPlan | undefined> {
    const [plan] = await db
      .select()
      .from(mealPlans)
      .where(and(eq(mealPlans.userId, userId), eq(mealPlans.isActive, true)))
      .orderBy(desc(mealPlans.createdAt))
      .limit(1);
    return plan;
  }

  async getMealPlanWithDetails(mealPlanId: number): Promise<{ plan: MealPlan; days: (MealPlanDay & { meals: (MealPlanMeal & { recipe: Recipe })[] })[] } | undefined> {
    const [plan] = await db.select().from(mealPlans).where(eq(mealPlans.id, mealPlanId));
    if (!plan) return undefined;

    const days = await db
      .select()
      .from(mealPlanDays)
      .where(eq(mealPlanDays.mealPlanId, mealPlanId))
      .orderBy(asc(mealPlanDays.dayIndex));

    const daysWithMeals = await Promise.all(
      days.map(async (day) => {
        const mealsData = await db
          .select()
          .from(mealPlanMeals)
          .innerJoin(recipes, eq(mealPlanMeals.recipeId, recipes.id))
          .where(eq(mealPlanMeals.mealPlanDayId, day.id))
          .orderBy(asc(mealPlanMeals.position));

        const meals = mealsData.map((m) => ({
          ...m.meal_plan_meals,
          recipe: m.recipes,
        }));

        return { ...day, meals };
      })
    );

    return { plan, days: daysWithMeals };
  }

  async createMealPlan(plan: InsertMealPlan): Promise<MealPlan> {
    await db.update(mealPlans).set({ isActive: false }).where(eq(mealPlans.userId, plan.userId));
    const [created] = await db.insert(mealPlans).values(plan).returning();
    return created;
  }

  async updateMealPlan(id: number, plan: Partial<InsertMealPlan>): Promise<MealPlan> {
    const [updated] = await db
      .update(mealPlans)
      .set({ ...plan, updatedAt: new Date() })
      .where(eq(mealPlans.id, id))
      .returning();
    return updated;
  }

  async deleteMealPlan(id: number): Promise<void> {
    await db.delete(mealPlans).where(eq(mealPlans.id, id));
  }

  async createMealPlanDay(day: InsertMealPlanDay): Promise<MealPlanDay> {
    const [created] = await db.insert(mealPlanDays).values(day).returning();
    return created;
  }

  async updateMealPlanDay(id: number, day: Partial<InsertMealPlanDay>): Promise<MealPlanDay> {
    const [updated] = await db
      .update(mealPlanDays)
      .set(day)
      .where(eq(mealPlanDays.id, id))
      .returning();
    return updated;
  }

  async createMealPlanMeal(meal: InsertMealPlanMeal): Promise<MealPlanMeal> {
    const [created] = await db.insert(mealPlanMeals).values(meal).returning();
    return created;
  }

  async updateMealPlanMeal(id: number, meal: Partial<InsertMealPlanMeal>): Promise<MealPlanMeal> {
    const [updated] = await db
      .update(mealPlanMeals)
      .set(meal)
      .where(eq(mealPlanMeals.id, id))
      .returning();
    return updated;
  }

  async deleteMealPlanMeal(id: number): Promise<void> {
    await db.delete(mealPlanMeals).where(eq(mealPlanMeals.id, id));
  }

  async getRecipesForMealPlan(options: {
    caloriesPerDay: number;
    macroSplit: string;
    mealsPerDay: number;
    dietaryPreference: string;
    excludedIngredients: string[];
    excludeRecipeIds?: number[];
    mealType?: string;
    targetCaloriesPerMeal?: number;
    maxCalories?: number;
  }): Promise<Recipe[]> {
    const conditions: any[] = [];

    if (options.mealType) {
      const category = options.mealType === 'snack' ? 'snacks' : options.mealType;
      conditions.push(eq(recipes.category, category));
    }

    if (options.dietaryPreference && options.dietaryPreference !== 'no_preference') {
      conditions.push(
        sql`${recipes.dietaryPreferences} @> ARRAY[${options.dietaryPreference}]::text[]`
      );
    }

    let allRecipes: Recipe[];
    if (conditions.length > 0) {
      allRecipes = await db.select().from(recipes).where(and(...conditions));
    } else {
      allRecipes = await db.select().from(recipes);
    }

    if (options.excludedIngredients && options.excludedIngredients.length > 0) {
      allRecipes = allRecipes.filter((recipe) => {
        const allergens = recipe.allergens || [];
        const keyIngredients = recipe.keyIngredients || [];
        const combined = [...allergens, ...keyIngredients].map((i) => i?.toLowerCase());
        return !options.excludedIngredients.some((excluded) =>
          combined.includes(excluded.toLowerCase())
        );
      });
    }

    if (options.excludeRecipeIds && options.excludeRecipeIds.length > 0) {
      allRecipes = allRecipes.filter((r) => !options.excludeRecipeIds!.includes(r.id));
    }

    // Score and sort recipes by how well they match calorie and macro targets
    if (options.targetCaloriesPerMeal && allRecipes.length > 0) {
      const targetCals = options.targetCaloriesPerMeal;
      const maxAllowedCals = options.maxCalories || targetCals * 1.5; // Hard cap
      
      // Define ideal macro ratios based on macro split (in caloric percentages)
      const macroTargets: { protein: number; carbs: number; fat: number } = {
        balanced: { protein: 0.30, carbs: 0.40, fat: 0.30 },
        high_protein: { protein: 0.40, carbs: 0.35, fat: 0.25 },
        low_carb: { protein: 0.35, carbs: 0.25, fat: 0.40 },
        high_carb: { protein: 0.25, carbs: 0.50, fat: 0.25 },
      }[options.macroSplit] || { protein: 0.30, carbs: 0.40, fat: 0.30 };

      // Hard filter: never exceed max allowed calories
      let filteredRecipes = allRecipes.filter(r => r.calories <= maxAllowedCals);
      
      // If no recipes under max, return empty to skip this meal
      // This ensures strict calorie budget enforcement
      if (filteredRecipes.length === 0) {
        return [];
      }

      // Then prefer recipes within ±20% of target
      const minCals = targetCals * 0.80;
      const maxCals = targetCals * 1.20;
      const preferredRecipes = filteredRecipes.filter(r => r.calories >= minCals && r.calories <= maxCals);
      
      // Use preferred if available, otherwise use all filtered
      const recipesToScore = preferredRecipes.length > 0 ? preferredRecipes : filteredRecipes;

      // Score each recipe
      const scoredRecipes = recipesToScore.map((recipe) => {
        // Calorie score: how close to target (0-100, higher is better)
        const calorieDiff = Math.abs(recipe.calories - targetCals);
        const calorieScore = Math.max(0, 100 - (calorieDiff / targetCals) * 100);
        
        // Macro score: use CALORIC ratios, not gram ratios
        // Protein: 4 cal/g, Carbs: 4 cal/g, Fat: 9 cal/g
        const proteinCals = recipe.protein * 4;
        const carbsCals = recipe.carbs * 4;
        const fatCals = recipe.fat * 9;
        const totalMacroCals = proteinCals + carbsCals + fatCals;
        
        if (totalMacroCals === 0) {
          return { recipe, score: calorieScore };
        }
        
        const actualProteinRatio = proteinCals / totalMacroCals;
        const actualCarbsRatio = carbsCals / totalMacroCals;
        const actualFatRatio = fatCals / totalMacroCals;
        
        const proteinDiff = Math.abs(actualProteinRatio - macroTargets.protein);
        const carbsDiff = Math.abs(actualCarbsRatio - macroTargets.carbs);
        const fatDiff = Math.abs(actualFatRatio - macroTargets.fat);
        
        const macroScore = Math.max(0, 100 - (proteinDiff + carbsDiff + fatDiff) * 100);
        
        // Combined score: 60% calorie match, 40% macro match
        const totalScore = calorieScore * 0.6 + macroScore * 0.4;
        
        return { recipe, score: totalScore };
      });

      // Sort by score descending and return recipes
      scoredRecipes.sort((a, b) => b.score - a.score);
      return scoredRecipes.map((sr) => sr.recipe);
    }

    return allRecipes;
  }

  // Workday Engine - Positions operations
  async getWorkdayPositions(): Promise<WorkdayPosition[]> {
    return await db.select().from(workdayPositions)
      .where(eq(workdayPositions.isActive, true))
      .orderBy(asc(workdayPositions.orderIndex));
  }

  async getAllWorkdayPositions(): Promise<WorkdayPosition[]> {
    return await db.select().from(workdayPositions)
      .orderBy(asc(workdayPositions.orderIndex));
  }

  async getWorkdayPositionById(id: number): Promise<WorkdayPosition | undefined> {
    const [position] = await db.select().from(workdayPositions).where(eq(workdayPositions.id, id));
    return position;
  }

  async createWorkdayPosition(position: InsertWorkdayPosition): Promise<WorkdayPosition> {
    const [created] = await db.insert(workdayPositions).values(position).returning();
    return created;
  }

  async updateWorkdayPosition(id: number, position: Partial<InsertWorkdayPosition>): Promise<WorkdayPosition> {
    const [updated] = await db
      .update(workdayPositions)
      .set({ ...position, updatedAt: new Date() })
      .where(eq(workdayPositions.id, id))
      .returning();
    return updated;
  }

  async deleteWorkdayPosition(id: number): Promise<void> {
    await db.delete(workdayPositions).where(eq(workdayPositions.id, id));
  }

  // Workday Engine - Micro-Resets operations
  async getWorkdayMicroResets(targetArea?: string): Promise<WorkdayMicroReset[]> {
    if (targetArea) {
      return await db.select().from(workdayMicroResets)
        .where(and(eq(workdayMicroResets.isActive, true), eq(workdayMicroResets.targetArea, targetArea)))
        .orderBy(asc(workdayMicroResets.orderIndex));
    }
    return await db.select().from(workdayMicroResets)
      .where(eq(workdayMicroResets.isActive, true))
      .orderBy(asc(workdayMicroResets.orderIndex));
  }

  async getWorkdayMicroResetById(id: number): Promise<WorkdayMicroReset | undefined> {
    const [reset] = await db.select().from(workdayMicroResets).where(eq(workdayMicroResets.id, id));
    return reset;
  }

  async createWorkdayMicroReset(reset: InsertWorkdayMicroReset): Promise<WorkdayMicroReset> {
    const [created] = await db.insert(workdayMicroResets).values(reset).returning();
    return created;
  }

  async updateWorkdayMicroReset(id: number, reset: Partial<InsertWorkdayMicroReset>): Promise<WorkdayMicroReset> {
    const [updated] = await db
      .update(workdayMicroResets)
      .set({ ...reset, updatedAt: new Date() })
      .where(eq(workdayMicroResets.id, id))
      .returning();
    return updated;
  }

  async deleteWorkdayMicroReset(id: number): Promise<void> {
    await db.delete(workdayMicroResets).where(eq(workdayMicroResets.id, id));
  }

  // Workday Engine - Aches & Fixes operations
  async getWorkdayAchesFixes(): Promise<WorkdayAchesFix[]> {
    return await db.select().from(workdayAchesFixes)
      .where(eq(workdayAchesFixes.isActive, true))
      .orderBy(asc(workdayAchesFixes.orderIndex));
  }

  async getWorkdayAchesFixById(id: number): Promise<WorkdayAchesFix | undefined> {
    const [fix] = await db.select().from(workdayAchesFixes).where(eq(workdayAchesFixes.id, id));
    return fix;
  }

  async getWorkdayAchesFixByIssueType(issueType: string): Promise<WorkdayAchesFix | undefined> {
    const [fix] = await db.select().from(workdayAchesFixes)
      .where(and(eq(workdayAchesFixes.issueType, issueType), eq(workdayAchesFixes.isActive, true)));
    return fix;
  }

  async createWorkdayAchesFix(fix: InsertWorkdayAchesFix): Promise<WorkdayAchesFix> {
    const [created] = await db.insert(workdayAchesFixes).values(fix).returning();
    return created;
  }

  async updateWorkdayAchesFix(id: number, fix: Partial<InsertWorkdayAchesFix>): Promise<WorkdayAchesFix> {
    const [updated] = await db
      .update(workdayAchesFixes)
      .set({ ...fix, updatedAt: new Date() })
      .where(eq(workdayAchesFixes.id, id))
      .returning();
    return updated;
  }

  async deleteWorkdayAchesFix(id: number): Promise<void> {
    await db.delete(workdayAchesFixes).where(eq(workdayAchesFixes.id, id));
  }

  // Workday Engine - Desk Setups operations
  async getWorkdayDeskSetups(deskType?: string, positionType?: string): Promise<WorkdayDeskSetup[]> {
    const conditions = [eq(workdayDeskSetups.isActive, true)];
    if (deskType) conditions.push(eq(workdayDeskSetups.deskType, deskType));
    if (positionType) conditions.push(eq(workdayDeskSetups.positionType, positionType));
    
    return await db.select().from(workdayDeskSetups)
      .where(and(...conditions))
      .orderBy(asc(workdayDeskSetups.orderIndex));
  }

  async getWorkdayDeskSetupById(id: number): Promise<WorkdayDeskSetup | undefined> {
    const [setup] = await db.select().from(workdayDeskSetups).where(eq(workdayDeskSetups.id, id));
    return setup;
  }

  async createWorkdayDeskSetup(setup: InsertWorkdayDeskSetup): Promise<WorkdayDeskSetup> {
    const [created] = await db.insert(workdayDeskSetups).values(setup).returning();
    return created;
  }

  async updateWorkdayDeskSetup(id: number, setup: Partial<InsertWorkdayDeskSetup>): Promise<WorkdayDeskSetup> {
    const [updated] = await db
      .update(workdayDeskSetups)
      .set({ ...setup, updatedAt: new Date() })
      .where(eq(workdayDeskSetups.id, id))
      .returning();
    return updated;
  }

  async deleteWorkdayDeskSetup(id: number): Promise<void> {
    await db.delete(workdayDeskSetups).where(eq(workdayDeskSetups.id, id));
  }

  // Workday Engine - Desk Tips operations
  async getWorkdayDeskTips(): Promise<WorkdayDeskTip[]> {
    return await db.select().from(workdayDeskTips)
      .where(eq(workdayDeskTips.isActive, true))
      .orderBy(asc(workdayDeskTips.priority));
  }

  async getWorkdayDeskTipById(id: number): Promise<WorkdayDeskTip | undefined> {
    const [tip] = await db.select().from(workdayDeskTips).where(eq(workdayDeskTips.id, id));
    return tip;
  }

  async getWorkdayDeskTipByCode(issueCode: string): Promise<WorkdayDeskTip | undefined> {
    const [tip] = await db.select().from(workdayDeskTips)
      .where(and(eq(workdayDeskTips.issueCode, issueCode), eq(workdayDeskTips.isActive, true)));
    return tip;
  }

  async createWorkdayDeskTip(tip: InsertWorkdayDeskTip): Promise<WorkdayDeskTip> {
    const [created] = await db.insert(workdayDeskTips).values(tip).returning();
    return created;
  }

  async updateWorkdayDeskTip(id: number, tip: Partial<InsertWorkdayDeskTip>): Promise<WorkdayDeskTip> {
    const [updated] = await db
      .update(workdayDeskTips)
      .set({ ...tip, updatedAt: new Date() })
      .where(eq(workdayDeskTips.id, id))
      .returning();
    return updated;
  }

  async deleteWorkdayDeskTip(id: number): Promise<void> {
    await db.delete(workdayDeskTips).where(eq(workdayDeskTips.id, id));
  }

  // Workday Engine - User Profile operations
  async getWorkdayUserProfile(userId: string): Promise<WorkdayUserProfile | undefined> {
    const [profile] = await db.select().from(workdayUserProfiles).where(eq(workdayUserProfiles.userId, userId));
    return profile;
  }

  async createWorkdayUserProfile(profile: InsertWorkdayUserProfile): Promise<WorkdayUserProfile> {
    const [created] = await db.insert(workdayUserProfiles).values(profile).returning();
    return created;
  }

  async updateWorkdayUserProfile(userId: string, profile: Partial<InsertWorkdayUserProfile>): Promise<WorkdayUserProfile> {
    const [updated] = await db
      .update(workdayUserProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(workdayUserProfiles.userId, userId))
      .returning();
    return updated;
  }

  // Workday Engine - Desk Scans operations
  async getWorkdayDeskScans(userId: string): Promise<WorkdayDeskScan[]> {
    return await db.select().from(workdayDeskScans)
      .where(eq(workdayDeskScans.userId, userId))
      .orderBy(desc(workdayDeskScans.scanDate));
  }

  async createWorkdayDeskScan(scan: InsertWorkdayDeskScan): Promise<WorkdayDeskScan> {
    const [created] = await db.insert(workdayDeskScans).values(scan).returning();
    return created;
  }

  async deleteWorkdayDeskScan(id: number): Promise<void> {
    await db.delete(workdayDeskScans).where(eq(workdayDeskScans.id, id));
  }

  // AI Coaching Settings operations
  async getAiCoachingSetting(feature: string): Promise<AiCoachingSetting | undefined> {
    const [setting] = await db.select().from(aiCoachingSettings).where(eq(aiCoachingSettings.feature, feature));
    return setting;
  }

  async getAllAiCoachingSettings(): Promise<AiCoachingSetting[]> {
    return await db.select().from(aiCoachingSettings).orderBy(aiCoachingSettings.feature);
  }

  async upsertAiCoachingSetting(setting: InsertAiCoachingSetting): Promise<AiCoachingSetting> {
    const [result] = await db
      .insert(aiCoachingSettings)
      .values(setting)
      .onConflictDoUpdate({
        target: aiCoachingSettings.feature,
        set: {
          ...setting,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  // Badges and Milestones operations
  async getAllBadges(): Promise<Badge[]> {
    return await db.select().from(badges).where(eq(badges.isActive, true)).orderBy(badges.sortOrder);
  }

  async getBadgeById(id: number): Promise<Badge | undefined> {
    const [badge] = await db.select().from(badges).where(eq(badges.id, id));
    return badge;
  }

  async getBadgesByCategory(category: string): Promise<Badge[]> {
    return await db.select().from(badges)
      .where(and(eq(badges.category, category), eq(badges.isActive, true)))
      .orderBy(badges.sortOrder);
  }

  async getUserBadges(userId: string, limit?: number): Promise<(UserBadge & { badge: Badge })[]> {
    let query = db
      .select({
        id: userBadges.id,
        userId: userBadges.userId,
        badgeId: userBadges.badgeId,
        earnedAt: userBadges.earnedAt,
        notified: userBadges.notified,
        badge: badges,
      })
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeId, badges.id))
      .where(eq(userBadges.userId, userId))
      .orderBy(desc(userBadges.earnedAt));
    
    if (limit) {
      query = query.limit(limit) as typeof query;
    }
    
    const results = await query;
    
    return results.map(r => ({
      id: r.id,
      userId: r.userId,
      badgeId: r.badgeId,
      earnedAt: r.earnedAt,
      notified: r.notified,
      badge: r.badge,
    }));
  }

  async getUserUnnotifiedBadges(userId: string): Promise<(UserBadge & { badge: Badge })[]> {
    const results = await db
      .select({
        id: userBadges.id,
        userId: userBadges.userId,
        badgeId: userBadges.badgeId,
        earnedAt: userBadges.earnedAt,
        notified: userBadges.notified,
        badge: badges,
      })
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeId, badges.id))
      .where(and(eq(userBadges.userId, userId), eq(userBadges.notified, false)))
      .orderBy(desc(userBadges.earnedAt));
    
    return results.map(r => ({
      id: r.id,
      userId: r.userId,
      badgeId: r.badgeId,
      earnedAt: r.earnedAt,
      notified: r.notified,
      badge: r.badge,
    }));
  }

  async awardBadge(userId: string, badgeId: number): Promise<UserBadge | null> {
    // Check if user already has this badge
    const [existing] = await db
      .select()
      .from(userBadges)
      .where(and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badgeId)));
    
    if (existing) return null; // Already has badge
    
    const [result] = await db.insert(userBadges).values({ userId, badgeId }).returning();
    return result;
  }

  async markBadgeNotified(userBadgeId: number): Promise<void> {
    await db.update(userBadges).set({ notified: true }).where(eq(userBadges.id, userBadgeId));
  }

  async markAllBadgesNotified(userId: string): Promise<void> {
    await db.update(userBadges).set({ notified: true }).where(eq(userBadges.userId, userId));
  }

  async checkUserBadgeEligibility(userId: string): Promise<Badge[]> {
    // Get all badges and user's current badges
    const allBadges = await this.getAllBadges();
    const userBadgesList = await this.getUserBadges(userId);
    const earnedBadgeIds = new Set(userBadgesList.map(ub => ub.badgeId));
    
    // Get user stats for eligibility checking
    const stats = await this.getUserBadgeStats(userId);
    
    const newlyEligible: Badge[] = [];
    
    for (const badge of allBadges) {
      if (earnedBadgeIds.has(badge.id)) continue; // Already earned
      
      try {
        const requirement = JSON.parse(badge.requirement);
        const isEligible = this.checkBadgeRequirement(requirement, stats);
        
        if (isEligible) {
          // Award the badge
          await this.awardBadge(userId, badge.id);
          newlyEligible.push(badge);
        }
      } catch (e) {
        console.error(`Error parsing badge requirement for badge ${badge.id}:`, e);
      }
    }
    
    return newlyEligible;
  }

  private async getUserBadgeStats(userId: string): Promise<Record<string, number>> {
    const stats: Record<string, number> = {};
    
    // Workout count - use workout_logs (completed) as the primary workout tracking table
    const [workoutCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workoutLogs)
      .where(and(eq(workoutLogs.userId, userId), eq(workoutLogs.status, 'completed')));
    stats.workouts = Number(workoutCount?.count || 0);
    
    // Video workout count (check workoutStyle = 'video')
    const [videoWorkoutCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workoutLogs)
      .where(and(
        eq(workoutLogs.userId, userId), 
        eq(workoutLogs.status, 'completed'),
        eq(workoutLogs.workoutStyle, 'video')
      ));
    stats.video_workouts = Number(videoWorkoutCount?.count || 0);
    
    // Stretching workout count (check workoutName for stretching keywords)
    const [stretchingCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workoutLogs)
      .where(and(
        eq(workoutLogs.userId, userId),
        eq(workoutLogs.status, 'completed'),
        sql`${workoutLogs.workoutName} ILIKE '%stretch%' OR ${workoutLogs.workoutName} ILIKE '%mobility%'`
      ));
    stats.stretching_workouts = Number(stretchingCount?.count || 0);
    
    // Breathwork sessions count
    const [breathworkCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(breathWorkSessionLogs)
      .where(eq(breathWorkSessionLogs.userId, userId));
    stats.breathwork_sessions = Number(breathworkCount?.count || 0);
    
    // Breathwork total minutes
    const [breathworkMinutes] = await db
      .select({ total: sql<number>`COALESCE(SUM(duration_seconds), 0) / 60` })
      .from(breathWorkSessionLogs)
      .where(eq(breathWorkSessionLogs.userId, userId));
    stats.breathwork_minutes = Number(breathworkMinutes?.total || 0);
    
    // Programme enrollments
    const [enrollmentCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userProgramEnrollments)
      .where(eq(userProgramEnrollments.userId, userId));
    stats.programme_enrollments = Number(enrollmentCount?.count || 0);
    
    // Completed programmes
    const [completedCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userProgramEnrollments)
      .where(and(eq(userProgramEnrollments.userId, userId), eq(userProgramEnrollments.status, 'completed')));
    stats.programmes_completed = Number(completedCount?.count || 0);
    
    // Programme completion rate
    const totalEnrollments = Number(enrollmentCount?.count || 0);
    const completed = Number(completedCount?.count || 0);
    stats.programme_completion_rate = totalEnrollments > 0 ? (completed / totalEnrollments) * 100 : 0;
    
    // Videos watched (learning)
    const [videosWatched] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userContentProgress)
      .where(and(eq(userContentProgress.userId, userId), eq(userContentProgress.completed, true)));
    stats.videos_watched = Number(videosWatched?.count || 0);
    
    // Learning paths completed (check completedDate is not null)
    const [pathsCompleted] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userPathAssignments)
      .where(and(eq(userPathAssignments.userId, userId), sql`${userPathAssignments.completedDate} IS NOT NULL`));
    stats.learning_paths_completed = Number(pathsCompleted?.count || 0);
    
    // Desk scans
    const [deskScans] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workdayDeskScans)
      .where(eq(workdayDeskScans.userId, userId));
    stats.desk_scans = Number(deskScans?.count || 0);
    
    // Body map assessments
    const [bodyMapCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bodyMapLogs)
      .where(eq(bodyMapLogs.userId, userId));
    stats.body_map_assessments = Number(bodyMapCount?.count || 0);
    
    return stats;
  }

  private checkBadgeRequirement(requirement: { type: string; metric: string; target: number }, stats: Record<string, number>): boolean {
    const value = stats[requirement.metric] || 0;
    
    switch (requirement.type) {
      case 'count':
      case 'duration':
      case 'streak':
        return value >= requirement.target;
      case 'percentage':
        return value >= requirement.target;
      case 'achievement':
        return value >= requirement.target;
      default:
        return false;
    }
  }

  async getCoachConversations(userId: string): Promise<CoachConversation[]> {
    return db.select({
      id: coachConversations.id,
      userId: coachConversations.userId,
      title: coachConversations.title,
      messages: coachConversations.messages,
      createdAt: coachConversations.createdAt,
      updatedAt: coachConversations.updatedAt,
    }).from(coachConversations)
      .where(eq(coachConversations.userId, userId))
      .orderBy(desc(coachConversations.updatedAt));
  }

  async getCoachConversation(id: number, userId: string): Promise<CoachConversation | undefined> {
    const [conversation] = await db.select().from(coachConversations)
      .where(and(eq(coachConversations.id, id), eq(coachConversations.userId, userId)));
    return conversation;
  }

  async createCoachConversation(userId: string, title: string, messages: any[]): Promise<CoachConversation> {
    const [conversation] = await db.insert(coachConversations).values({
      userId,
      title: title || 'New conversation',
      messages,
    }).returning();
    return conversation;
  }

  async updateCoachConversation(id: number, userId: string, data: { messages?: any[]; title?: string }): Promise<CoachConversation | undefined> {
    const updateData: any = { updatedAt: new Date() };
    if (data.messages) updateData.messages = data.messages;
    if (data.title) updateData.title = data.title;
    const [updated] = await db.update(coachConversations)
      .set(updateData)
      .where(and(eq(coachConversations.id, id), eq(coachConversations.userId, userId)))
      .returning();
    return updated;
  }

  async deleteCoachConversation(id: number, userId: string): Promise<void> {
    await db.delete(coachConversations)
      .where(and(eq(coachConversations.id, id), eq(coachConversations.userId, userId)));
  }

  // Recommendation feedback loop implementations
  async createRecommendationEvent(event: InsertRecommendationEvent): Promise<RecommendationEvent> {
    const [created] = await db.insert(recommendationEvents).values(event).returning();
    return created;
  }

  async createRecommendationEvents(events: InsertRecommendationEvent[]): Promise<RecommendationEvent[]> {
    if (events.length === 0) return [];
    const created = await db.insert(recommendationEvents).values(events).returning();
    return created;
  }

  async getRecommendationEventsForUser(userId: string): Promise<RecommendationEvent[]> {
    return await db.select().from(recommendationEvents)
      .where(eq(recommendationEvents.userId, userId))
      .orderBy(desc(recommendationEvents.createdAt));
  }

  async updateRecommendationEvent(id: number, data: Partial<InsertRecommendationEvent>): Promise<RecommendationEvent | undefined> {
    const [updated] = await db.update(recommendationEvents)
      .set(data)
      .where(eq(recommendationEvents.id, id))
      .returning();
    return updated;
  }

  async getRecommendationMetrics(programIds: number[]): Promise<{
    programId: number;
    totalRecommended: number;
    totalEnrolled: number;
    totalCompleted: number;
    totalAbandoned: number;
    avgCompletionPercent: number;
    enrollmentRate: number;
    completionRate: number;
  }[]> {
    if (programIds.length === 0) return [];
    const results = await db.select({
      programId: recommendationEvents.programId,
      eventType: recommendationEvents.eventType,
      completionPercent: recommendationEvents.completionPercent,
    }).from(recommendationEvents)
      .where(inArray(recommendationEvents.programId, programIds));

    const metricsMap = new Map<number, { recommended: number; enrolled: number; completed: number; abandoned: number; completionSum: number; completionCount: number }>();
    for (const pid of programIds) {
      metricsMap.set(pid, { recommended: 0, enrolled: 0, completed: 0, abandoned: 0, completionSum: 0, completionCount: 0 });
    }
    for (const r of results) {
      const m = metricsMap.get(r.programId);
      if (!m) continue;
      if (r.eventType === 'recommended') m.recommended++;
      else if (r.eventType === 'enrolled') m.enrolled++;
      else if (r.eventType === 'completed') { m.completed++; if (r.completionPercent != null) { m.completionSum += r.completionPercent; m.completionCount++; } }
      else if (r.eventType === 'abandoned') { m.abandoned++; if (r.completionPercent != null) { m.completionSum += r.completionPercent; m.completionCount++; } }
    }

    return programIds.map(pid => {
      const m = metricsMap.get(pid)!;
      const enrolledTotal = m.enrolled + m.completed + m.abandoned;
      return {
        programId: pid,
        totalRecommended: m.recommended,
        totalEnrolled: enrolledTotal,
        totalCompleted: m.completed,
        totalAbandoned: m.abandoned,
        avgCompletionPercent: m.completionCount > 0 ? Math.round(m.completionSum / m.completionCount) : 0,
        enrollmentRate: m.recommended > 0 ? Math.round((enrolledTotal / m.recommended) * 100) : 0,
        completionRate: enrolledTotal > 0 ? Math.round((m.completed / enrolledTotal) * 100) : 0,
      };
    });
  }

  async getRecommendationMetricsByProfile(programIds: number[], intakeBucket: { environment?: string; experienceLevel?: string }): Promise<{
    programId: number;
    completionRate: number;
    avgCompletionPercent: number;
    sampleSize: number;
  }[]> {
    if (programIds.length === 0) return [];
    const allEvents = await db.select().from(recommendationEvents)
      .where(and(
        inArray(recommendationEvents.programId, programIds),
        inArray(recommendationEvents.eventType, ['enrolled', 'completed', 'abandoned'])
      ));

    const filtered = allEvents.filter(e => {
      const snapshot = e.intakeSnapshot as any;
      if (!snapshot) return true;
      if (intakeBucket.environment && snapshot.trainingEnvironment && snapshot.trainingEnvironment !== intakeBucket.environment) return false;
      if (intakeBucket.experienceLevel && snapshot.experienceLevel && snapshot.experienceLevel !== intakeBucket.experienceLevel) return false;
      return true;
    });

    const metricsMap = new Map<number, { completed: number; total: number; completionSum: number; completionCount: number }>();
    for (const pid of programIds) {
      metricsMap.set(pid, { completed: 0, total: 0, completionSum: 0, completionCount: 0 });
    }
    for (const e of filtered) {
      const m = metricsMap.get(e.programId);
      if (!m) continue;
      m.total++;
      if (e.eventType === 'completed') m.completed++;
      if (e.completionPercent != null) { m.completionSum += e.completionPercent; m.completionCount++; }
    }

    return programIds.map(pid => {
      const m = metricsMap.get(pid)!;
      return {
        programId: pid,
        completionRate: m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0,
        avgCompletionPercent: m.completionCount > 0 ? Math.round(m.completionSum / m.completionCount) : 0,
        sampleSize: m.total,
      };
    });
  }

  // Burnout Early Warning operations
  async getBurnoutScore(userId: string): Promise<BurnoutScore | undefined> {
    const [score] = await db.select().from(burnoutScores)
      .where(eq(burnoutScores.userId, userId))
      .orderBy(desc(burnoutScores.computedDate))
      .limit(1);
    return score;
  }

  async getBurnoutScoreHistory(userId: string, startDate: Date, endDate: Date): Promise<BurnoutScore[]> {
    return await db.select().from(burnoutScores)
      .where(and(
        eq(burnoutScores.userId, userId),
        gte(burnoutScores.computedDate, startDate),
        lte(burnoutScores.computedDate, endDate),
      ))
      .orderBy(asc(burnoutScores.computedDate));
  }

  async getMonthlyBurnoutLog(userId: string): Promise<BurnoutScore[]> {
    const allScores = await db.select().from(burnoutScores)
      .where(eq(burnoutScores.userId, userId))
      .orderBy(desc(burnoutScores.computedDate));

    const monthMap = new Map<string, BurnoutScore>();
    for (const score of allScores) {
      const date = new Date(score.computedDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap.has(key)) {
        monthMap.set(key, score);
      }
    }

    return Array.from(monthMap.values()).sort((a, b) =>
      new Date(a.computedDate).getTime() - new Date(b.computedDate).getTime()
    );
  }

  async createBurnoutScore(score: InsertBurnoutScore): Promise<BurnoutScore> {
    const [created] = await db.insert(burnoutScores).values(score).returning();
    return created;
  }

  async getBurnoutSettings(userId: string): Promise<BurnoutSettings | undefined> {
    const [settings] = await db.select().from(burnoutSettings)
      .where(eq(burnoutSettings.userId, userId));
    return settings;
  }

  async upsertBurnoutSettings(userId: string, data: Partial<InsertBurnoutSettings>): Promise<BurnoutSettings> {
    const existing = await this.getBurnoutSettings(userId);
    if (existing) {
      const [updated] = await db.update(burnoutSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(burnoutSettings.userId, userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(burnoutSettings)
      .values({ userId, ...data })
      .returning();
    return created;
  }

  async getHealthIntegrations(userId: string): Promise<HealthIntegration[]> {
    return await db.select().from(healthIntegrations)
      .where(eq(healthIntegrations.userId, userId));
  }

  async upsertHealthIntegration(userId: string, provider: string, data: Partial<InsertHealthIntegration>): Promise<HealthIntegration> {
    const [existing] = await db.select().from(healthIntegrations)
      .where(and(
        eq(healthIntegrations.userId, userId),
        eq(healthIntegrations.provider, provider),
      ));
    if (existing) {
      const [updated] = await db.update(healthIntegrations)
        .set(data)
        .where(and(
          eq(healthIntegrations.userId, userId),
          eq(healthIntegrations.provider, provider),
        ))
        .returning();
      return updated;
    }
    const [created] = await db.insert(healthIntegrations)
      .values({ userId, provider, ...data })
      .returning();
    return created;
  }

  async getCheckInsInRange(userId: string, startDate: Date, endDate: Date): Promise<CheckIn[]> {
    return await db.select().from(checkIns)
      .where(and(
        eq(checkIns.userId, userId),
        gte(checkIns.checkInDate, startDate),
        lte(checkIns.checkInDate, endDate),
      ))
      .orderBy(desc(checkIns.checkInDate));
  }

  async getCompanies(search?: string): Promise<(Company & { userCount: number; activeUserCount: number })[]> {
    const allCompanies = search
      ? await db.select().from(companies).where(ilike(companies.name, `%${search}%`)).orderBy(asc(companies.name))
      : await db.select().from(companies).orderBy(asc(companies.name));

    const result = [];
    for (const company of allCompanies) {
      const companyUsers = await db.select().from(users).where(eq(users.companyId, company.id));
      const activeCount = companyUsers.filter(u => u.password != null).length;
      result.push({ ...company, userCount: companyUsers.length, activeUserCount: activeCount });
    }
    return result;
  }

  async getCompanyById(id: number): Promise<(Company & { userCount: number; activeUserCount: number; benefits: CompanyBenefit[] }) | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    if (!company) return undefined;
    const companyUsers = await db.select().from(users).where(eq(users.companyId, id));
    const activeCount = companyUsers.filter(u => u.password != null).length;
    const benefits = await db.select().from(companyBenefits).where(eq(companyBenefits.companyId, id)).orderBy(asc(companyBenefits.category));
    return { ...company, userCount: companyUsers.length, activeUserCount: activeCount, benefits };
  }

  async createCompany(data: InsertCompany): Promise<Company> {
    const [company] = await db.insert(companies).values(data).returning();
    return company;
  }

  async updateCompany(id: number, data: Partial<InsertCompany>): Promise<Company> {
    const [company] = await db.update(companies).set({ ...data, updatedAt: new Date() }).where(eq(companies.id, id)).returning();
    return company;
  }

  async deleteCompany(id: number): Promise<void> {
    await db.update(users).set({ companyId: null }).where(eq(users.companyId, id));
    await db.delete(companies).where(eq(companies.id, id));
  }

  async getCompanyBenefits(companyId: number): Promise<CompanyBenefit[]> {
    return await db.select().from(companyBenefits).where(eq(companyBenefits.companyId, companyId)).orderBy(asc(companyBenefits.category));
  }

  async createCompanyBenefit(data: InsertCompanyBenefit): Promise<CompanyBenefit> {
    const [benefit] = await db.insert(companyBenefits).values(data).returning();
    return benefit;
  }

  async updateCompanyBenefit(id: number, data: Partial<InsertCompanyBenefit>): Promise<CompanyBenefit> {
    const [benefit] = await db.update(companyBenefits).set(data).where(eq(companyBenefits.id, id)).returning();
    return benefit;
  }

  async deleteCompanyBenefit(id: number): Promise<void> {
    await db.delete(companyBenefits).where(eq(companyBenefits.id, id));
  }

  async assignUserToCompany(userId: string, companyId: number): Promise<void> {
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    await db.update(users).set({ companyId, companyName: company?.name || null }).where(eq(users.id, userId));
  }

  async removeUserFromCompany(userId: string): Promise<void> {
    await db.update(users).set({ companyId: null, companyName: null }).where(eq(users.id, userId));
  }

  async getUsersByCompany(companyId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.companyId, companyId)).orderBy(asc(users.email));
  }

  async getUserCompanyBenefits(userId: string): Promise<CompanyBenefit[]> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user?.companyId) return [];
    return await db.select().from(companyBenefits).where(eq(companyBenefits.companyId, user.companyId)).orderBy(asc(companyBenefits.category));
  }

  async getDepartments(companyId: number): Promise<Department[]> {
    return await db.select().from(departments).where(eq(departments.companyId, companyId)).orderBy(asc(departments.name));
  }

  async createDepartment(data: InsertDepartment): Promise<Department> {
    const [dept] = await db.insert(departments).values(data).returning();
    return dept;
  }

  async updateDepartment(id: number, name: string): Promise<Department> {
    const [dept] = await db.update(departments).set({ name }).where(eq(departments.id, id)).returning();
    return dept;
  }

  async deleteDepartment(id: number): Promise<void> {
    await db.update(users).set({ departmentId: null }).where(eq(users.departmentId, id));
    await db.delete(departments).where(eq(departments.id, id));
  }

  async getCompanyInvites(companyId: number): Promise<CompanyInvite[]> {
    return await db.select().from(companyInvites).where(eq(companyInvites.companyId, companyId)).orderBy(desc(companyInvites.invitedAt));
  }

  async createCompanyInvites(invites: InsertCompanyInvite[]): Promise<CompanyInvite[]> {
    if (invites.length === 0) return [];
    return await db.insert(companyInvites).values(invites).returning();
  }

  async updateInviteStatus(id: number, status: string): Promise<void> {
    const updateData: any = { status };
    if (status === 'accepted') updateData.acceptedAt = new Date();
    await db.update(companyInvites).set(updateData).where(eq(companyInvites.id, id));
  }

  async getUsageAlerts(companyId: number): Promise<UsageAlert[]> {
    return await db.select().from(usageAlerts).where(eq(usageAlerts.companyId, companyId)).orderBy(desc(usageAlerts.createdAt));
  }

  async createUsageAlert(data: InsertUsageAlert): Promise<UsageAlert> {
    const [alert] = await db.insert(usageAlerts).values(data).returning();
    return alert;
  }

  async markAlertRead(id: number): Promise<void> {
    await db.update(usageAlerts).set({ isRead: true }).where(eq(usageAlerts.id, id));
  }

  async getMindfulnessTools(): Promise<MindfulnessTool[]> {
    return await db.select().from(mindfulnessTools).orderBy(asc(mindfulnessTools.orderIndex));
  }

  async getMindfulnessToolById(id: number): Promise<MindfulnessTool | undefined> {
    const [tool] = await db.select().from(mindfulnessTools).where(eq(mindfulnessTools.id, id));
    return tool;
  }

  async createMindfulnessTool(tool: InsertMindfulnessTool): Promise<MindfulnessTool> {
    const [created] = await db.insert(mindfulnessTools).values(tool).returning();
    return created;
  }

  async updateMindfulnessTool(id: number, tool: Partial<InsertMindfulnessTool>): Promise<MindfulnessTool> {
    const [updated] = await db.update(mindfulnessTools)
      .set({ ...tool, updatedAt: new Date() })
      .where(eq(mindfulnessTools.id, id))
      .returning();
    return updated;
  }

  async deleteMindfulnessTool(id: number): Promise<void> {
    await db.delete(mindfulnessTools).where(eq(mindfulnessTools.id, id));
  }
}

export const storage = new DatabaseStorage();
