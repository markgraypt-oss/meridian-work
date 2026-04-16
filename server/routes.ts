import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { setupAuth, isAuthenticated, generateResetToken, hashToken, sendUserInviteEmail } from "./replitAuth";
import { eq, and, like, inArray, desc, or, isNull, asc, gte, lte, lt } from "drizzle-orm";
import { users, userProgramEnrollments, programWeeks, programDays, programmeWorkouts, programmeWorkoutBlocks, pathContentItems, topicContentItems, learningPaths, programmeModificationRecords, exerciseSubstitutionMappings, programmeBlockExercises, enrollmentWorkouts, enrollmentWorkoutBlocks, enrollmentBlockExercises, programs, userExtraWorkoutSessions, scheduledWorkouts, workoutLogs, learnContentLibrary, exerciseLibrary, workoutExerciseLogs, workoutSetLogs, aiFeedback, workouts, stepEntries, sleepEntries, bodyweightEntries, bodyFatEntries, restingHREntries, caloricBurnEntries, exerciseMinutesEntries, bloodPressureEntries, leanBodyMassEntries, caloricIntakeEntries, hydrationLogs } from "@shared/schema";
import { calculateProgramEquipment, updateProgramEquipmentAuto } from "./equipmentDetection";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for video uploads
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'videos');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `video-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit for workout videos up to 60 minutes
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

// Configure multer for image uploads
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'images');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `image-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const uploadImage = multer({
  storage: imageStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Configure multer for PDF uploads
const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'pdfs');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `pdf-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const uploadPdf = multer({
  storage: pdfStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Configure multer for document uploads (PDFs, DOC, DOCX, PNG, etc.)
const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'pdfs');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `doc-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const uploadDoc = multer({
  storage: docStorage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
    
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, PNG, and JPG files are allowed'));
    }
  }
});

import { computeBurnoutScore } from './burnoutEngine';
import { trackCalibrationEvent, trackRecoveryModeActivation, generateCalibrationReport } from './burnoutCalibration';
import { burnoutScores, insertCompanySchema, insertCompanyBenefitSchema, checkIns, bodyMapLogs, departments, companyInvites, usageAlerts } from "@shared/schema";

import {
  insertExerciseLibraryItemSchema,
  insertProgramSchema,
  insertProgramExerciseSchema,
  insertVideoSchema,
  insertRecipeSchema,
  insertWorkoutSchema,
  insertUserProgressSchema,
  insertCheckInSchema,
  insertBodyMapLogSchema,
  insertBookmarkSchema,
  insertUserNoteSchema,
  insertInjuryLogSchema,
  insertUserProgramEnrollmentSchema,
  insertDailySeverityLogSchema,
  insertRecoveryActionSchema,
  insertRecoveryComplianceSchema,
  insertRecoveryAlertSchema,
  insertMealSchema,
  insertProgressPhotoSchema,
  insertBodyStatsSchema,
  insertWorkoutSessionSchema,
  insertRecoveryPlanSuggestionSchema,
  insertProgramModificationSuggestionSchema,
  insertBodyMapAreaSchema,
  insertBodyMapQuestionSchema,
  insertBodyMapAnswerOptionSchema,
  insertBodyMapMovementOptionSchema,
  insertBodyMapRecoveryTemplateSchema,
  insertBodyMapTemplateRuleSchema,
  insertBodyMapGuidanceRuleSchema,
  insertBodyMapOutcomeSchema,
  insertHydrationLogSchema,
  insertHydrationGoalSchema,
  insertGoalMilestoneSchema,
  insertGoalSchema,
  insertPathContentItemSchema,
  insertNutritionGoalSchema,
  insertFoodLogSchema,
  insertSupplementSchema,
  insertSupplementLogSchema,
  nutritionGoals,
  foodLogs,
  supplements,
  supplementLogs,
  insertWorkdayPositionSchema,
  insertWorkdayMicroResetSchema,
  insertWorkdayAchesFixSchema,
  insertWorkdayDeskSetupSchema,
  insertWorkdayDeskTipSchema,
  insertWorkdayUserProfileSchema,
  insertWorkdayDeskScanSchema,
  insertMeditationSessionLogSchema,
  insertGratitudeEntrySchema,
  insertMindfulnessToolSchema,
  mindfulnessTools,
} from "@shared/schema";
import { z } from "zod";

async function generateProgramModifications(
  userId: string,
  bodyPart: string,
  severity: number,
  recoveryPlanId: number,
  flaggingMovementPatterns: string[]
) {
  console.log('generateProgramModifications called with patterns:', flaggingMovementPatterns);
  
  // Get user's active program
  const timeline = await storage.getUserProgramTimeline(userId);
  if (!timeline.current) {
    console.log('No active program found');
    return [];
  }

  const enrollment = timeline.current;
  console.log('Enrollment found:', enrollment.id, 'programId:', enrollment.programId);
  
  const programExercises = await storage.getAllProgramExercises(enrollment.programId);
  console.log('Program exercises count:', programExercises.length);

  const modifications = [];

  for (const exercise of programExercises) {
    const exerciseDetails = await storage.getExerciseById(exercise.exerciseLibraryId);
    if (!exerciseDetails) continue;

    // Check if exercise's movement patterns intersect with flagging patterns
    const exerciseMovements = exerciseDetails.movement || [];
    const isAffected = flaggingMovementPatterns.some(pattern => 
      exerciseMovements.includes(pattern)
    );
    
    // Log for debugging
    if (exerciseDetails.name === 'Plate Push Up') {
      console.log('Plate Push Up check:', {
        exerciseMovements,
        flaggingMovementPatterns,
        isAffected
      });
    }

    if (isAffected) {
      let modificationType = "reduce_intensity";
      let reason = `${bodyPart} discomfort`;
      let suggestedSets = exercise.sets;
      let suggestedReps = exercise.reps;
      let suggestedRest = exercise.rest;

      // Determine modification based on severity
      if (severity >= 7) {
        modificationType = "skip";
        reason = `High severity ${bodyPart} pain - temporary rest recommended`;
      } else if (severity >= 5) {
        // Reduce by 50%
        modificationType = "reduce_intensity";
        reason = `Moderate ${bodyPart} discomfort - reducing volume`;
        const currentSets = parseInt(exercise.sets) || 3;
        const currentReps = parseInt(exercise.reps) || 10;
        suggestedSets = Math.max(1, Math.floor(currentSets * 0.5)).toString();
        suggestedReps = Math.max(5, Math.floor(currentReps * 0.5)).toString();
      } else {
        // Reduce by 25%
        modificationType = "modify_reps";
        reason = `Minor ${bodyPart} discomfort - slight reduction`;
        const currentReps = parseInt(exercise.reps) || 10;
        suggestedReps = Math.max(5, Math.floor(currentReps * 0.75)).toString();
      }

      modifications.push({
        recoveryPlanId,
        userId,
        enrollmentId: enrollment.id,
        blockExerciseId: exercise.id,
        modificationType,
        originalExerciseName: exerciseDetails.name,
        suggestedExerciseName: null,
        suggestedSets,
        suggestedReps,
        suggestedRest,
        reason,
        status: "pending",
        week: exercise.week,
        day: exercise.day
      });
    }
  }

  return modifications;
}

const MOVEMENT_SCREENING_FLAG_MAP: Record<string, { movementPatterns: string[]; equipment: string[]; levels: string[] }> = {
  squatPain: { movementPatterns: ['Squat'], equipment: ['Barbell'], levels: ['Advanced'] },
  kneeStairsPain: { movementPatterns: ['Lunge', 'Plyometrics'], equipment: [], levels: ['Advanced'] },
  bendingPain: { movementPatterns: ['Hip Hinge'], equipment: ['Barbell'], levels: [] },
  lowerBackPain: { movementPatterns: ['Hip Hinge', 'Squat'], equipment: ['Barbell'], levels: ['Advanced'] },
  overheadPain: { movementPatterns: ['Vertical Push'], equipment: ['Barbell'], levels: [] },
  pushingShoulderPain: { movementPatterns: ['Horizontal Push'], equipment: ['Barbell'], levels: ['Advanced'] },
  singleLegInstability: { movementPatterns: ['Lunge'], equipment: ['Barbell'], levels: ['Advanced'] },
  neckShoulderTension: { movementPatterns: ['Vertical Pull'], equipment: ['Barbell'], levels: [] },
};

function deriveMovementScreeningFlags(screening: any): {
  flaggedMovementPatterns: string[];
  flaggedEquipment: string[];
  flaggedLevels: string[];
  activeFlags: string[];
  optionalNotes: string;
} {
  if (!screening) return { flaggedMovementPatterns: [], flaggedEquipment: [], flaggedLevels: [], activeFlags: [], optionalNotes: '' };

  const patterns = new Set<string>();
  const equipment = new Set<string>();
  const levels = new Set<string>();
  const activeFlags: string[] = [];

  for (const [key, mapping] of Object.entries(MOVEMENT_SCREENING_FLAG_MAP)) {
    if (screening[key] === true) {
      activeFlags.push(key);
      mapping.movementPatterns.forEach(p => patterns.add(p));
      mapping.equipment.forEach(e => equipment.add(e));
      mapping.levels.forEach(l => levels.add(l));
    }
  }

  return {
    flaggedMovementPatterns: Array.from(patterns),
    flaggedEquipment: Array.from(equipment),
    flaggedLevels: Array.from(levels),
    activeFlags,
    optionalNotes: screening.optionalNotes || '',
  };
}

function buildRecommendationPrompt(intake: any, programs: any[], paths: any[], habits: any[], coachingContext: string = '', successMetrics?: Map<number, { completionRate: number; avgCompletionPercent: number; sampleSize: number }>): string {
  const programSummaries = programs.map(p => {
    let line = `ID:${p.id} "${p.title}" equipment:${p.equipment} difficulty:${p.difficulty} duration:${p.duration}min days/wk:${p.trainingDaysPerWeek} requires:[${(p.requiredEquipment || []).join(',')}]`;
    if (successMetrics) {
      const m = successMetrics.get(p.id);
      if (m && m.sampleSize >= 3) {
        line += ` success_data:{completion_rate:${m.completionRate}%,avg_progress:${m.avgCompletionPercent}%,sample:${m.sampleSize}}`;
      }
    }
    return line;
  }).join('\n');
  const pathSummaries = paths.map(p => `ID:${p.id} "${p.title}" category:${p.category} struggles:${(p.struggles || []).join(',')}`).join('\n');
  const habitSummaries = habits.map(h => `ID:${h.id} "${h.title}" category:${h.category}`).join('\n');

  return `You are recommending a strength training programme for a new user. Strength training is the core purpose of this platform.${coachingContext}

MATCHING RULES (strict priority order):
1. ENVIRONMENT (hard filter): Only recommend programmes matching the user's training environment. "home" users get bodyweight or home_gym programmes. "gym" users get full_gym programmes. "both" users can get any.
2. EXPERIENCE LEVEL (hard filter): Programme difficulty must match user's experience level exactly.
3. FREQUENCY (strong preference): Programme training days/week should be within ±1 of user's chosen frequency. Exact match is best.
4. DURATION (preference): Programme duration per session should fit within the user's available time.
5. EQUIPMENT ACCESS: "Full gym access" means all equipment is available. Otherwise, check the "requires" list for each programme and only recommend it if the user has access to all required equipment. Do not recommend programmes requiring equipment the user does not have.
6. SUCCESS DATA: Some programmes include success_data showing completion rates from similar users. Prefer programmes with higher completion rates when other factors are equal. This data improves over time as more users complete programmes.

USER TRAINING PARAMETERS:
- Experience level: ${intake.experienceLevel || 'unknown'}
- Training environment: ${intake.trainingEnvironment || intake.environment || 'unknown'}
- Equipment access: ${(intake.equipment || []).join(', ') || 'unknown'}
- Time per session: ${intake.timeAvailability || 'unknown'}
- Preferred frequency: ${intake.workoutFrequency || 'unknown'} days/week
${(() => {
  const screeningFlags = deriveMovementScreeningFlags(intake.movementScreening);
  if (screeningFlags.activeFlags.length === 0) return '';
  return `
MOVEMENT SCREENING FLAGS (user reported discomfort):
- Flagged movement patterns to avoid or limit: ${screeningFlags.flaggedMovementPatterns.join(', ')}
- Flagged equipment to limit: ${screeningFlags.flaggedEquipment.join(', ') || 'none'}
- Flagged difficulty levels to avoid: ${screeningFlags.flaggedLevels.join(', ') || 'none'}
${screeningFlags.optionalNotes ? `- User note: "${screeningFlags.optionalNotes}"` : ''}
Prefer programmes that have fewer exercises matching these flagged patterns. Deprioritise programmes heavily reliant on flagged movement patterns or equipment.`;
})()}

AVAILABLE PROGRAMS:
${programSummaries}

AVAILABLE LEARNING PATHS:
${pathSummaries}

AVAILABLE HABITS:
${habitSummaries}

Recommend up to 3 programmes that match the user's training parameters. Mark the single best match as "recommended". If fewer than 3 match well, return fewer. Do not force bad matches.
Also recommend 1 learning path and up to 3 habits.

Respond in this exact JSON format:
{
  "programs": [{"id": <number>, "recommended": <boolean>, "reason": "<short reason>"}],
  "path": {"id": <number>, "reason": "<short reason>"},
  "habits": [{"id": <number>, "reason": "<short reason>"}]
}

Only use IDs from the lists above. Be concise with reasons (1 sentence each).`;
}

function parseAiRecommendations(text: string, programs: any[], paths: any[], habits: any[]): { programs: any[]; path: any; habits: any[] } {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { programs: [], path: null, habits: [] };

    const parsed = JSON.parse(jsonMatch[0]);

    const validPrograms = (parsed.programs || [])
      .filter((p: any) => programs.find(prog => prog.id === p.id))
      .map((p: any) => {
        const full = programs.find(prog => prog.id === p.id);
        return { ...full, recommended: !!p.recommended, reason: p.reason };
      })
      .slice(0, 3);

    let validPath = null;
    if (parsed.path && paths.find(p => p.id === parsed.path.id)) {
      const full = paths.find(p => p.id === parsed.path.id);
      validPath = { ...full, reason: parsed.path.reason };
    }

    const validHabits = (parsed.habits || [])
      .filter((h: any) => habits.find(hab => hab.id === h.id))
      .map((h: any) => {
        const full = habits.find(hab => hab.id === h.id);
        return { ...full, reason: h.reason };
      })
      .slice(0, 3);

    return { programs: validPrograms, path: validPath, habits: validHabits };
  } catch (e) {
    console.error("Failed to parse AI recommendations:", e);
    return { programs: [], path: null, habits: [] };
  }
}

function parseTimeAvailability(time: string): number {
  if (!time) return 60;
  const match = time.match(/(\d+)/);
  if (match) return parseInt(match[1]);
  if (time.includes('30')) return 30;
  if (time.includes('45')) return 45;
  if (time.includes('60') || time.includes('1 hour')) return 60;
  if (time.includes('90')) return 90;
  return 60;
}

function environmentMatches(userEnv: string, programEquipment: string): boolean {
  if (!userEnv || !programEquipment) return true;
  if (userEnv === 'both') return true;
  if (userEnv === 'gym') return programEquipment === 'full_gym' || programEquipment === 'mixed';
  if (userEnv === 'home') return programEquipment === 'bodyweight' || programEquipment === 'home_gym';
  return true;
}

function equipmentAccessMatches(userEquipment: string[], programEquipment: string, requiredEquipment?: string[]): boolean {
  if (!userEquipment || userEquipment.length === 0) return true;
  if (userEquipment.includes('Full gym access')) return true;
  if (programEquipment === 'bodyweight') return true;

  if (requiredEquipment && requiredEquipment.length > 0) {
    const userEquipLower = userEquipment.map(e => e.toLowerCase());
    const equipmentMapping: Record<string, string[]> = {
      'dumbbells': ['dumbbell', 'dumbbells'],
      'barbell': ['barbell', 'bar'],
      'resistance bands': ['resistance band', 'resistance bands', 'band'],
      'kettlebells': ['kettlebell', 'kettlebells'],
      'bench': ['bench', 'flat bench', 'incline bench', 'adjustable bench'],
      'cable machine': ['cable', 'cable machine', 'cables'],
      'pull-up bar': ['pull-up bar', 'pull up bar', 'chin up bar', 'pullup bar'],
      'suspension trainer': ['suspension trainer', 'trx', 'suspension'],
      'swiss ball': ['swiss ball', 'stability ball', 'exercise ball'],
      'foam roller': ['foam roller'],
      'lacrosse ball': ['lacrosse ball'],
      'cardio equipment': ['treadmill', 'bike', 'rower', 'elliptical', 'cardio'],
    };

    const userHas = new Set<string>();
    for (const item of userEquipLower) {
      userHas.add(item);
      for (const [key, aliases] of Object.entries(equipmentMapping)) {
        if (key.toLowerCase() === item) {
          aliases.forEach(a => userHas.add(a));
        }
      }
    }

    const missingEquipment = requiredEquipment.filter(req => {
      const reqLower = req.toLowerCase();
      if (reqLower === 'bodyweight' || reqLower === 'none' || reqLower === 'body weight') return false;
      return !userHas.has(reqLower) && !Array.from(userHas).some(u => reqLower.includes(u) || u.includes(reqLower));
    });

    if (missingEquipment.length > 0) return false;
  } else {
    if (programEquipment === 'full_gym') return false;
    if (programEquipment === 'home_gym') {
      return userEquipment.some(e =>
        ['Dumbbells', 'Barbell', 'Resistance bands', 'Kettlebells', 'Bench'].includes(e)
      );
    }
  }
  return true;
}

function getRuleBasedRecommendations(intake: any, programs: any[], paths: any[], habits: any[], successMetrics?: Map<number, { completionRate: number; avgCompletionPercent: number; sampleSize: number }>): { programs: any[]; path: any; habits: any[] } {
  const env = intake.trainingEnvironment || intake.environment || '';
  const userLevel = intake.experienceLevel || '';
  const userFreq = parseInt(intake.workoutFrequency) || 0;
  const userTime = parseTimeAvailability(intake.timeAvailability);
  const userEquipment = intake.equipment || [];

  let candidates = programs.map(p => {
    let score = 0;
    let eliminated = false;

    const envMatch = environmentMatches(env, p.equipment);
    if (!envMatch) eliminated = true;

    const levelMatch = !userLevel || p.difficulty === userLevel;
    if (!levelMatch) eliminated = true;

    const equipMatch = equipmentAccessMatches(userEquipment, p.equipment, p.requiredEquipment);
    if (!equipMatch) eliminated = true;

    if (!eliminated) {
      if (envMatch) score += 10;

      if (userLevel && p.difficulty === userLevel) score += 10;

      if (userFreq > 0 && p.trainingDaysPerWeek) {
        const diff = Math.abs(userFreq - p.trainingDaysPerWeek);
        if (diff === 0) score += 10;
        else if (diff === 1) score += 5;
        else score -= 5;
      }

      if (userTime > 0 && p.duration) {
        if (p.duration <= userTime) score += 5;
        else if (p.duration <= userTime + 15) score += 2;
        else score -= 3;
      }

      // Boost from historical success metrics (feedback loop)
      if (successMetrics) {
        const metrics = successMetrics.get(p.id);
        if (metrics && metrics.sampleSize >= 3) {
          if (metrics.completionRate >= 70) score += 8;
          else if (metrics.completionRate >= 50) score += 4;
          else if (metrics.completionRate < 30 && metrics.sampleSize >= 5) score -= 3;

          if (metrics.avgCompletionPercent >= 80) score += 3;
          else if (metrics.avgCompletionPercent < 40 && metrics.sampleSize >= 5) score -= 2;
        }
      }

      const screeningFlags = deriveMovementScreeningFlags(intake.movementScreening);
      if (screeningFlags.activeFlags.length > 0) {
        const progMovements = p.exerciseMovementPatterns || [];
        const progEquipment = p.requiredEquipment || [];
        const progLevels = p.exerciseLevels || [];

        let flagOverlap = 0;
        for (const pattern of screeningFlags.flaggedMovementPatterns) {
          if (progMovements.some((m: string) => m.toLowerCase() === pattern.toLowerCase())) flagOverlap++;
        }
        for (const eq of screeningFlags.flaggedEquipment) {
          if (progEquipment.some((e: string) => e.toLowerCase() === eq.toLowerCase())) flagOverlap++;
        }
        for (const lvl of screeningFlags.flaggedLevels) {
          if (progLevels.some((l: string) => l.toLowerCase() === lvl.toLowerCase())) flagOverlap++;
        }

        const totalFlags = screeningFlags.activeFlags.length;
        const severityMultiplier = totalFlags >= 5 ? 2.0 : totalFlags >= 3 ? 1.5 : 1.0;

        let basePenalty = 0;
        if (flagOverlap >= 3) basePenalty = 8;
        else if (flagOverlap >= 2) basePenalty = 5;
        else if (flagOverlap >= 1) basePenalty = 2;

        score -= Math.round(basePenalty * severityMultiplier);
      }
    }

    return { ...p, score, eliminated, recommended: false };
  });

  let eligible = candidates.filter(c => !c.eliminated);

  if (eligible.length === 0) {
    const softCandidates = candidates.map(c => {
      let softScore = 0;
      if (environmentMatches(env, c.equipment)) softScore += 10;
      if (equipmentAccessMatches(userEquipment, c.equipment, c.requiredEquipment)) softScore += 5;
      if (userLevel && c.difficulty === userLevel) softScore += 8;
      if (userFreq > 0 && c.trainingDaysPerWeek) {
        const diff = Math.abs(userFreq - c.trainingDaysPerWeek);
        if (diff <= 1) softScore += 5;
        else if (diff <= 2) softScore += 2;
      }
      return { ...c, score: softScore, eliminated: false };
    });
    softCandidates.sort((a, b) => b.score - a.score);
    eligible = softCandidates.slice(0, 3);
  }

  eligible.sort((a, b) => b.score - a.score);
  const topPrograms = eligible.slice(0, 3);
  if (topPrograms.length > 0) topPrograms[0].recommended = true;

  let matchedPath = null;
  if (intake.primaryGoal) {
    const goalToCategory: Record<string, string[]> = {
      'recovery': ['recovery', 'stress'],
      'general_strength': ['exercise'],
      'hypertrophy': ['exercise', 'nutrition'],
      'conditioning': ['exercise'],
      'mobility': ['recovery', 'exercise'],
      'weight_loss': ['nutrition', 'exercise'],
      'recovery_mobility': ['recovery', 'exercise'],
      'conditioning_endurance': ['exercise'],
      'pain_management': ['recovery'],
      'muscle_building': ['exercise', 'nutrition'],
    };
    const categories = goalToCategory[intake.primaryGoal] || ['exercise'];
    matchedPath = paths.find(p => categories.includes(p.category)) || paths[0] || null;
  } else {
    matchedPath = paths[0] || null;
  }

  let scoredHabits = habits.map(h => {
    let score = 0;
    const cat = (h.category || '').toLowerCase();
    if (intake.primaryGoal === 'weight_loss' && (cat.includes('nutrition') || cat.includes('neat'))) score += 5;
    if (intake.primaryGoal === 'general_strength' && cat.includes('daily')) score += 3;
    if (intake.primaryGoal === 'mobility' && cat.includes('daily')) score += 3;
    if (intake.deskBased === 'yes' && (cat.includes('neat') || cat.includes('daily'))) score += 2;
    if (intake.stressLevel === 'high' || intake.stressLevel === 'very high') {
      if (cat.includes('daily') || cat.includes('maintenance')) score += 2;
    }
    if (intake.sleepHours === 'under 5' || intake.sleepHours === '5-6') {
      if (cat.includes('daily') || cat.includes('maintenance')) score += 1;
    }
    return { ...h, score };
  });
  scoredHabits.sort((a, b) => b.score - a.score);
  const topHabits = scoredHabits.slice(0, 3);

  return { programs: topPrograms, path: matchedPath, habits: topHabits };
}

function parseDurationToSecondsServer(duration?: string | number): number {
  if (!duration) return 0;
  if (typeof duration === 'number') return duration;
  const lower = duration.toLowerCase();
  let total = 0;
  const minMatch = lower.match(/(\d+)\s*min/);
  if (minMatch) total += parseInt(minMatch[1]) * 60;
  const secMatch = lower.match(/(\d+)\s*sec/);
  if (secMatch) total += parseInt(secMatch[1]);
  if (!minMatch && !secMatch) {
    const numMatch = duration.match(/(\d+)/);
    if (numMatch) total = parseInt(numMatch[1]);
  }
  return total;
}

function parseRestServer(rest?: string): number {
  if (!rest) return 0;
  const match = rest.match(/(\d+)/);
  if (!match) return 0;
  const value = parseInt(match[1]);
  if (rest.toLowerCase().includes('min')) return value * 60;
  return value;
}

function calcExerciseTime(exercise: any): number {
  const sets = exercise.sets || [];
  let total = 0;
  for (const set of sets) {
    if (exercise.durationType === 'timer' && set.duration) {
      total += parseDurationToSecondsServer(set.duration);
    } else {
      const reps = parseInt(set.reps || '10') || 10;
      total += reps * 3;
    }
  }
  if (sets.length === 0) {
    if (exercise.durationType === 'timer' && exercise.duration) {
      total = parseDurationToSecondsServer(exercise.duration);
    } else {
      total = 60;
    }
  }
  return total;
}

function calculateServerWorkoutDuration(workout: any): number {
  const workoutType = workout.workoutType || 'regular';
  const rawExercises = workout.exercises || [];
  const isBlockFormat = rawExercises.length > 0 && rawExercises[0]?.exercises;
  const blocks = isBlockFormat ? rawExercises : undefined;
  const flatExercises = isBlockFormat
    ? rawExercises.flatMap((b: any) => (b.exercises || []))
    : rawExercises;

  if (workoutType === 'interval' && blocks && blocks.length > 0) {
    let totalSeconds = 0;
    const isWarmup = (s: string) => s === 'warmup' || s === 'warm_up';
    const warmupBlocks = blocks.filter((b: any) => isWarmup(b.section));
    const mainBlocks = blocks.filter((b: any) => !isWarmup(b.section));

    for (const block of warmupBlocks) {
      for (const ex of (block.exercises || [])) {
        totalSeconds += calcExerciseTime(ex);
      }
      totalSeconds += parseRestServer(block.rest);
    }

    for (const block of mainBlocks) {
      const rounds = block.rounds || 3;
      let blockTime = 0;
      for (const ex of (block.exercises || [])) {
        blockTime += calcExerciseTime(ex);
      }
      totalSeconds += blockTime * rounds;
      totalSeconds += parseRestServer(block.restAfterRound) * (rounds - 1);
      totalSeconds += parseRestServer(block.rest);
    }
    return Math.ceil(totalSeconds / 60);
  }

  if (workoutType === 'circuit') {
    const rounds = workout.intervalRounds || workout.circuitRounds || 3;
    let exTime = 0;
    for (const ex of flatExercises) {
      exTime += calcExerciseTime(ex);
    }
    return Math.ceil((exTime * rounds) / 60);
  }

  let totalSeconds = 0;
  if (blocks && blocks.length > 0) {
    for (const block of blocks) {
      for (const ex of (block.exercises || [])) {
        totalSeconds += calcExerciseTime(ex);
      }
      totalSeconds += parseRestServer(block.rest);
    }
  } else {
    for (const ex of flatExercises) {
      totalSeconds += calcExerciseTime(ex);
    }
  }
  const minutes = Math.ceil(totalSeconds / 60);
  const exerciseCountForMin = isBlockFormat ? rawExercises.length : flatExercises.length;
  return Math.max(minutes, exerciseCountForMin * 2);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Serve attached assets
  app.use(express.static(path.resolve(import.meta.dirname, "..", "attached_assets")));
  
  // Serve uploaded files (try uploads/ first, then public/uploads/ as fallback for deployed images)
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "public", "uploads")));
  
  // Serve videos from uploads/videos at /videos path for legacy video URLs
  app.use("/videos", express.static(path.resolve(process.cwd(), "uploads", "videos")));

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Onboarding routes
  app.patch('/api/onboarding/progress', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { step, data } = req.body;

      if (typeof step !== 'number' || step < 0 || step > 6) {
        return res.status(400).json({ message: "Invalid onboarding step" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const existingData = (user.onboardingData as Record<string, any>) || {};
      const mergedData = { ...existingData, ...data };

      await storage.updateUser(userId, {
        onboardingStep: step,
        onboardingData: mergedData,
      });

      const updatedUser = await storage.getUser(userId);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating onboarding progress:", error);
      res.status(500).json({ message: "Failed to update onboarding progress" });
    }
  });

  app.post('/api/onboarding/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { data } = req.body;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const existingData = (user.onboardingData as Record<string, any>) || {};
      const mergedData = { ...existingData, ...data };

      const profileUpdates: any = {
        onboardingCompleted: true,
        onboardingStep: 6,
        onboardingData: mergedData,
      };

      if (mergedData.profile) {
        if (mergedData.profile.displayName) profileUpdates.displayName = mergedData.profile.displayName;
        if (mergedData.profile.firstName) profileUpdates.firstName = mergedData.profile.firstName;
        if (mergedData.profile.lastName) profileUpdates.lastName = mergedData.profile.lastName;
        if (mergedData.profile.dateOfBirth) profileUpdates.dateOfBirth = mergedData.profile.dateOfBirth;
        if (mergedData.profile.gender) profileUpdates.gender = mergedData.profile.gender;
        if (mergedData.profile.height) profileUpdates.height = mergedData.profile.height;
        if (mergedData.profile.heightUnit) profileUpdates.heightUnit = mergedData.profile.heightUnit;
      }

      if (mergedData.preferences) {
        if (mergedData.preferences.weightUnit) profileUpdates.weightUnit = mergedData.preferences.weightUnit;
        if (mergedData.preferences.distanceUnit) profileUpdates.distanceUnit = mergedData.preferences.distanceUnit;
        if (mergedData.preferences.timeFormat) profileUpdates.timeFormat = mergedData.preferences.timeFormat;
        if (mergedData.preferences.dateFormat) profileUpdates.dateFormat = mergedData.preferences.dateFormat;
      }

      if (mergedData.coaching?.movementScreening) {
        const flags = deriveMovementScreeningFlags(mergedData.coaching.movementScreening);
        profileUpdates.movementScreeningFlags = flags;
      }

      await storage.updateUser(userId, profileUpdates);

      const selectedProgramme = mergedData.recommendations?.selectedProgramme || mergedData.selectedProgramme;
      if (selectedProgramme?.id) {
        try {
          const enrollment = await storage.enrollUserInProgram(userId, selectedProgramme.id, new Date(), 'main');
          // Log enrolled event for feedback loop
          try {
            const onboardingIntake = mergedData.coachingIntake || {};
            await storage.createRecommendationEvent({
              userId,
              programId: selectedProgramme.id,
              eventType: 'enrolled',
              source: 'onboarding',
              intakeSnapshot: {
                trainingEnvironment: onboardingIntake.trainingEnvironment || onboardingIntake.environment,
                experienceLevel: onboardingIntake.experienceLevel,
                frequency: onboardingIntake.workoutFrequency || onboardingIntake.frequency,
                sessionDuration: onboardingIntake.timeAvailability || onboardingIntake.sessionDuration,
                equipment: onboardingIntake.equipment,
              },
              enrollmentId: enrollment?.id,
            });
          } catch (recErr) {
            console.error("Error logging enrollment recommendation event:", recErr);
          }
        } catch (err) {
          console.error("Error enrolling in programme:", err);
        }
      }

      const selectedPath = mergedData.recommendations?.selectedLearningPath || mergedData.selectedLearningPath;
      if (selectedPath?.id) {
        try {
          await storage.createUserPathAssignment(userId, selectedPath.id);
        } catch (err) {
          console.error("Error assigning learning path:", err);
        }
      }

      const selectedHabit = mergedData.recommendations?.selectedHabit || mergedData.selectedHabit;
      if (selectedHabit?.id) {
        try {
          await storage.createHabit({
            userId,
            templateId: selectedHabit.id || null,
            title: selectedHabit.title,
            description: selectedHabit.description || null,
            category: selectedHabit.category || null,
            icon: selectedHabit.icon || null,
            startDate: new Date(),
            duration: 3,
            daysOfWeek: "everyday",
          });
        } catch (err) {
          console.error("Error creating habit:", err);
        }
      }

      if (mergedData.profile?.weight) {
        try {
          const weightVal = parseFloat(mergedData.profile.weight);
          if (!isNaN(weightVal) && weightVal > 0) {
            await storage.createBodyweightEntry({
              userId,
              weight: weightVal,
              date: new Date(),
              notes: "Initial weight from onboarding",
            });
          }
        } catch (err) {
          console.error("Error creating bodyweight entry from onboarding:", err);
        }
      }

      if (mergedData.profile?.profilePhoto) {
        try {
          profileUpdates.profileImageUrl = mergedData.profile.profilePhoto;
          await storage.updateUser(userId, { profileImageUrl: mergedData.profile.profilePhoto });
        } catch (err) {
          console.error("Error saving profile photo from onboarding:", err);
        }
      }

      const weightGoalData = mergedData.recommendations?.weightGoalData;
      if (weightGoalData?.targetWeight && weightGoalData?.currentWeight) {
        try {
          const targetW = parseFloat(weightGoalData.targetWeight);
          const currentW = parseFloat(weightGoalData.currentWeight);
          if (!isNaN(targetW) && !isNaN(currentW) && targetW > 0 && currentW > 0) {
            const isLoss = targetW < currentW;
            await storage.createGoal({
              userId,
              type: "bodyweight",
              title: isLoss ? "Weight loss goal" : "Weight gain goal",
              description: `Target: ${targetW}${weightGoalData.unit || "kg"}`,
              targetValue: targetW,
              currentValue: currentW,
              startingValue: currentW,
              unit: weightGoalData.unit || "kg",
              startDate: new Date(),
              progress: 0,
              isCompleted: false,
            });
          }
        } catch (err) {
          console.error("Error creating weight goal from onboarding:", err);
        }
      }

      const painAreas = mergedData.coaching?.painAreas;
      if (Array.isArray(painAreas) && painAreas.length > 0) {
        const areaToBodyPart: Record<string, string> = {
          head_neck: "Neck",
          shoulders: "Shoulder",
          upper_back: "Upper back",
          lower_back: "Lower back",
          chest: "Upper back",
          arms: "Elbow",
          elbows: "Elbow",
          wrists_hands: "Wrist and hand",
          hips: "Hip",
          knees: "Knee",
          ankles_feet: "Ankle and foot",
          other: "Lower back",
        };

        for (const area of painAreas) {
          try {
            const bodyPart = areaToBodyPart[area.id] || area.label;
            await storage.createBodyMapLog({
              userId,
              bodyPart,
              severity: area.severity || 5,
              type: "sore",
              x: 0,
              y: 0,
              view: "front",
              side: area.side || "both",
              movementImpact: area.movementImpact || "none",
              movementLimitations: area.movementLimitations || [],
              trainingImpact: area.trainingImpact || "normal",
            });
          } catch (err) {
            console.error("Error creating body map log from onboarding:", err);
          }
        }
      }

      const updatedUser = await storage.getUser(userId);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  app.post('/api/onboarding/recommendations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { intake } = req.body;

      if (!intake) {
        return res.status(400).json({ message: "Intake data is required" });
      }

      const allPrograms = await storage.getPrograms();
      const allPaths = await storage.getLearningPaths();
      const allHabitTemplates = await storage.getHabitTemplates();

      const activePrograms = allPrograms.filter((p: any) => p.isActive !== false);
      const activePaths = allPaths.filter((p: any) => p.isActive !== false);
      const activeHabits = allHabitTemplates.filter((h: any) => h.isActive !== false);

      const enrichedPrograms = await Promise.all(activePrograms.map(async (prog: any) => {
        try {
          const weeks = await db.select().from(programWeeks).where(eq(programWeeks.programId, prog.id));
          if (weeks.length === 0) return { ...prog, requiredEquipment: [], exerciseMovementPatterns: [], exerciseLevels: [] };
          const equipmentSet = new Set<string>();
          const movementSet = new Set<string>();
          const levelSet = new Set<string>();
          for (const week of weeks) {
            const days = await db.select().from(programDays).where(eq(programDays.weekId, week.id));
            for (const day of days) {
              const dayWorkouts = await db.select().from(programmeWorkouts).where(eq(programmeWorkouts.dayId, day.id));
              for (const workout of dayWorkouts) {
                const blocks = await storage.getProgrammeWorkoutBlocks(workout.id);
                for (const block of blocks) {
                  for (const ex of (block.exercises || [])) {
                    if (ex.exerciseLibraryId) {
                      const libEntry = await storage.getExerciseById(ex.exerciseLibraryId);
                      if (libEntry?.equipment) {
                        for (const eqItem of libEntry.equipment) {
                          if (eqItem) equipmentSet.add(eqItem);
                        }
                      }
                      if (libEntry?.movement) {
                        for (const m of libEntry.movement) {
                          if (m) movementSet.add(m);
                        }
                      }
                      if (libEntry?.level) {
                        levelSet.add(libEntry.level);
                      }
                    }
                  }
                }
              }
            }
          }
          return { ...prog, requiredEquipment: Array.from(equipmentSet), exerciseMovementPatterns: Array.from(movementSet), exerciseLevels: Array.from(levelSet) };
        } catch {
          return { ...prog, requiredEquipment: [], exerciseMovementPatterns: [], exerciseLevels: [] };
        }
      }));

      let recommendedPrograms: any[] = [];
      let recommendedPath: any = null;
      let recommendedHabits: any[] = [];
      let aiUsed = false;

      // Fetch success metrics for feedback loop
      let successMetricsMap: Map<number, { completionRate: number; avgCompletionPercent: number; sampleSize: number }> | undefined;
      try {
        const programIds = enrichedPrograms.map((p: any) => p.id);
        const intakeBucket = {
          environment: intake.trainingEnvironment || intake.environment,
          experienceLevel: intake.experienceLevel,
        };
        const profileMetrics = await storage.getRecommendationMetricsByProfile(programIds, intakeBucket);
        if (profileMetrics.some(m => m.sampleSize >= 3)) {
          successMetricsMap = new Map();
          for (const m of profileMetrics) {
            successMetricsMap.set(m.programId, m);
          }
        }
      } catch (metricsErr) {
        console.error("Error fetching recommendation metrics:", metricsErr);
      }

      try {
        const { getFeatureConfig, analyzeText, getCoachingContext } = await import('./aiProvider');
        const config = await getFeatureConfig('onboarding_recommendations');

        if (config) {
          const coachingContext = await getCoachingContext('onboarding_recommendations');
          const prompt = buildRecommendationPrompt(intake, enrichedPrograms, activePaths, activeHabits, coachingContext, successMetricsMap);
          const aiResponse = await analyzeText({
            prompt,
            maxTokens: 1500,
          }, config.provider, config.model);

          const parsed = parseAiRecommendations(aiResponse.text, enrichedPrograms, activePaths, activeHabits);
          if (parsed.programs.length > 0) {
            const env = intake.trainingEnvironment || intake.environment || '';
            const userLevel = intake.experienceLevel || '';
            const userEquipment = intake.equipment || [];
            const validated = parsed.programs.filter((p: any) => {
              if (!environmentMatches(env, p.equipment)) return false;
              if (userLevel && p.difficulty !== userLevel) return false;
              if (!equipmentAccessMatches(userEquipment, p.equipment, p.requiredEquipment)) return false;
              return true;
            });
            if (validated.length > 0) {
              validated[0].recommended = true;
              recommendedPrograms = validated.slice(0, 3);
              recommendedPath = parsed.path;
              recommendedHabits = parsed.habits;
              aiUsed = true;
            }
          }
        }
      } catch (aiError) {
        console.error("AI recommendation failed, using rule-based fallback:", aiError);
      }

      if (!aiUsed) {
        const result = getRuleBasedRecommendations(intake, enrichedPrograms, activePaths, activeHabits, successMetricsMap);
        recommendedPrograms = result.programs;
        recommendedPath = result.path;
        recommendedHabits = result.habits;
      }

      // Log recommendation events for feedback loop
      try {
        const intakeSnapshot = {
          trainingEnvironment: intake.trainingEnvironment || intake.environment,
          experienceLevel: intake.experienceLevel,
          frequency: intake.workoutFrequency || intake.frequency,
          sessionDuration: intake.timeAvailability || intake.sessionDuration,
          equipment: intake.equipment,
        };
        const recEvents = recommendedPrograms.map((p: any) => ({
          userId,
          programId: p.id,
          eventType: 'recommended' as const,
          source: aiUsed ? 'ai' : 'rule_based',
          intakeSnapshot,
        }));
        if (recEvents.length > 0) {
          await storage.createRecommendationEvents(recEvents);
        }
      } catch (recErr) {
        console.error("Error logging recommendation events:", recErr);
      }

      res.json({
        programmes: recommendedPrograms,
        learningPaths: recommendedPath ? [recommendedPath] : [],
        habits: recommendedHabits,
        aiPowered: aiUsed,
      });
    } catch (error) {
      console.error("Error generating recommendations:", error);
      res.status(500).json({ message: "Failed to generate recommendations" });
    }
  });

  // Recommendation feedback loop - log skip/event
  app.post('/api/recommendations/event', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { programId, eventType, source, completionPercent, enrollmentId } = req.body;
      if (!programId || !eventType) {
        return res.status(400).json({ message: "programId and eventType are required" });
      }
      const validEvents = ['skipped', 'enrolled', 'abandoned', 'completed'];
      if (!validEvents.includes(eventType)) {
        return res.status(400).json({ message: "Invalid eventType" });
      }
      const event = await storage.createRecommendationEvent({
        userId,
        programId,
        eventType,
        source: source || 'manual',
        completionPercent,
        enrollmentId,
      });
      res.json(event);
    } catch (error) {
      console.error("Error logging recommendation event:", error);
      res.status(500).json({ message: "Failed to log recommendation event" });
    }
  });

  app.post('/api/onboarding/dismiss', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.updateUser(userId, { onboardingDismissed: true });
      res.json({ success: true });
    } catch (error) {
      console.error("Error dismissing onboarding:", error);
      res.status(500).json({ message: "Failed to dismiss onboarding" });
    }
  });

  app.post('/api/onboarding/restart', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.updateUser(userId, {
        onboardingCompleted: false,
        onboardingDismissed: false,
        onboardingStep: 0,
        onboardingData: {},
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error restarting onboarding:", error);
      res.status(500).json({ message: "Failed to restart onboarding" });
    }
  });

  // Admin user management routes
  app.get('/api/admin/users', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const users = await storage.getAllUsers();
      const safeUsers = users.map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        companyName: u.companyName,
        isAdmin: u.isAdmin,
        createdAt: u.createdAt,
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post('/api/admin/users', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { email, firstName, lastName, companyName, isAdmin } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      const newUser = await storage.createUser({
        email,
        firstName,
        lastName,
        companyName,
        isAdmin: isAdmin || false,
      });

      const token = generateResetToken();
      const hashedToken = hashToken(token);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await storage.createPasswordResetToken({
        userId: newUser.id,
        token: hashedToken,
        expiresAt,
      });

      const baseUrl = `https://${req.get("host")}`;
      const emailSent = await sendUserInviteEmail(email, token, baseUrl, firstName || undefined);

      res.status(201).json({
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        companyName: newUser.companyName,
        isAdmin: newUser.isAdmin,
        createdAt: newUser.createdAt,
        inviteSent: emailSent,
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.patch('/api/admin/users/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const targetId = req.params.id;
      const { email, firstName, lastName, companyName, isAdmin } = req.body;

      const updateData: any = {};
      if (email) updateData.email = email;
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (companyName !== undefined) updateData.companyName = companyName;
      if (isAdmin !== undefined) updateData.isAdmin = isAdmin;

      const updatedUser = await storage.updateUser(targetId, updateData);
      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        companyName: updatedUser.companyName,
        isAdmin: updatedUser.isAdmin,
        createdAt: updatedUser.createdAt,
      });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete('/api/admin/users/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const targetId = req.params.id;
      if (targetId === userId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      // Check if target user is an admin - require password verification
      const targetUser = await storage.getUser(targetId);
      if (targetUser?.isAdmin) {
        const { password, confirmText } = req.body || {};
        
        if (!confirmText || confirmText !== "DELETE NOW") {
          return res.status(400).json({ message: "You must type 'DELETE NOW' to confirm admin deletion" });
        }
        
        if (!password) {
          return res.status(400).json({ message: "Password required to delete admin user" });
        }
        
        // Verify current user's password
        if (!currentUser.password) {
          return res.status(400).json({ message: "Password not set for your account" });
        }
        
        const bcrypt = await import("bcrypt");
        const isValidPassword = await bcrypt.compare(password, currentUser.password);
        if (!isValidPassword) {
          return res.status(401).json({ message: "Incorrect password" });
        }
      }

      await storage.deleteUser(targetId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Company management routes
  app.get('/api/admin/companies', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const search = req.query.search as string | undefined;
      const result = await storage.getCompanies(search);
      res.json(result);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.get('/api/admin/companies/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const company = await storage.getCompanyById(parseInt(req.params.id));
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      const companyUsers = await storage.getUsersByCompany(company.id);
      res.json({ ...company, users: companyUsers.map(u => ({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, isAdmin: u.isAdmin, createdAt: u.createdAt })) });
    } catch (error) {
      console.error("Error fetching company:", error);
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  app.post('/api/admin/companies', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const parsed = insertCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid company data", errors: parsed.error.flatten() });
      }
      const company = await storage.createCompany(parsed.data);
      res.json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  app.patch('/api/admin/companies/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const parsed = insertCompanySchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid company data", errors: parsed.error.flatten() });
      }
      const company = await storage.updateCompany(parseInt(req.params.id), parsed.data);
      res.json(company);
    } catch (error) {
      console.error("Error updating company:", error);
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  app.delete('/api/admin/companies/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      await storage.deleteCompany(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting company:", error);
      res.status(500).json({ message: "Failed to delete company" });
    }
  });

  app.post('/api/admin/companies/:id/benefits', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const parsed = insertCompanyBenefitSchema.safeParse({ ...req.body, companyId: parseInt(req.params.id) });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid benefit data", errors: parsed.error.flatten() });
      }
      const benefit = await storage.createCompanyBenefit(parsed.data);
      res.json(benefit);
    } catch (error) {
      console.error("Error creating benefit:", error);
      res.status(500).json({ message: "Failed to create benefit" });
    }
  });

  app.patch('/api/admin/company-benefits/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const parsed = insertCompanyBenefitSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid benefit data", errors: parsed.error.flatten() });
      }
      const benefit = await storage.updateCompanyBenefit(parseInt(req.params.id), parsed.data);
      res.json(benefit);
    } catch (error) {
      console.error("Error updating benefit:", error);
      res.status(500).json({ message: "Failed to update benefit" });
    }
  });

  app.delete('/api/admin/company-benefits/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      await storage.deleteCompanyBenefit(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting benefit:", error);
      res.status(500).json({ message: "Failed to delete benefit" });
    }
  });

  app.post('/api/admin/companies/:id/assign-user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { userId: targetUserId } = req.body;
      await storage.assignUserToCompany(targetUserId, parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error assigning user:", error);
      res.status(500).json({ message: "Failed to assign user" });
    }
  });

  app.post('/api/admin/companies/:id/remove-user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { userId: targetUserId } = req.body;
      await storage.removeUserFromCompany(targetUserId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing user:", error);
      res.status(500).json({ message: "Failed to remove user" });
    }
  });

  app.get('/api/user/company-benefits', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const benefits = await storage.getUserCompanyBenefits(userId);
      res.json(benefits);
    } catch (error) {
      console.error("Error fetching user company benefits:", error);
      res.status(500).json({ message: "Failed to fetch benefits" });
    }
  });

  // Department CRUD routes
  app.get('/api/admin/companies/:id/departments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) return res.status(403).json({ message: "Admin access required" });
      const depts = await storage.getDepartments(parseInt(req.params.id));
      res.json(depts);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ message: "Failed to fetch departments" });
    }
  });

  app.post('/api/admin/companies/:id/departments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) return res.status(403).json({ message: "Admin access required" });
      const { name } = req.body;
      if (!name) return res.status(400).json({ message: "Department name is required" });
      const dept = await storage.createDepartment({ companyId: parseInt(req.params.id), name });
      res.json(dept);
    } catch (error) {
      console.error("Error creating department:", error);
      res.status(500).json({ message: "Failed to create department" });
    }
  });

  app.patch('/api/admin/departments/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) return res.status(403).json({ message: "Admin access required" });
      const { name } = req.body;
      if (!name) return res.status(400).json({ message: "Department name is required" });
      const dept = await storage.updateDepartment(parseInt(req.params.id), name);
      res.json(dept);
    } catch (error) {
      console.error("Error updating department:", error);
      res.status(500).json({ message: "Failed to update department" });
    }
  });

  app.delete('/api/admin/departments/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) return res.status(403).json({ message: "Admin access required" });
      await storage.deleteDepartment(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting department:", error);
      res.status(500).json({ message: "Failed to delete department" });
    }
  });

  app.post('/api/admin/companies/:companyId/departments/:deptId/assign-user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) return res.status(403).json({ message: "Admin access required" });
      const { userId: targetUserId } = req.body;
      await db.update(users).set({ departmentId: parseInt(req.params.deptId) }).where(eq(users.id, targetUserId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error assigning user to department:", error);
      res.status(500).json({ message: "Failed to assign user to department" });
    }
  });

  // Bulk user invite routes
  app.get('/api/admin/companies/:id/invites', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) return res.status(403).json({ message: "Admin access required" });
      const invites = await storage.getCompanyInvites(parseInt(req.params.id));
      res.json(invites);
    } catch (error) {
      console.error("Error fetching invites:", error);
      res.status(500).json({ message: "Failed to fetch invites" });
    }
  });

  app.post('/api/admin/companies/:id/bulk-invite', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) return res.status(403).json({ message: "Admin access required" });
      const { emails } = req.body;
      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ message: "Email list is required" });
      }
      const companyId = parseInt(req.params.id);
      const company = await storage.getCompanyById(companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });
      if (company.maxUsers && (company.userCount + emails.length) > company.maxUsers) {
        return res.status(400).json({ message: `Adding ${emails.length} users would exceed the max user limit of ${company.maxUsers}` });
      }
      const inviteData = emails.map((email: string) => ({ companyId, email: email.trim().toLowerCase(), status: "pending" }));
      const invites = await storage.createCompanyInvites(inviteData);
      res.json({ success: true, count: invites.length, invites });
    } catch (error) {
      console.error("Error bulk inviting:", error);
      res.status(500).json({ message: "Failed to send invites" });
    }
  });

  // Usage alerts
  app.get('/api/admin/companies/:id/alerts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) return res.status(403).json({ message: "Admin access required" });
      const alerts = await storage.getUsageAlerts(parseInt(req.params.id));
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  app.post('/api/admin/alerts/:id/read', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) return res.status(403).json({ message: "Admin access required" });
      await storage.markAlertRead(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking alert read:", error);
      res.status(500).json({ message: "Failed to mark alert read" });
    }
  });

  // Company engagement metrics
  app.get('/api/admin/companies/:id/engagement', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) return res.status(403).json({ message: "Admin access required" });
      const companyId = parseInt(req.params.id);
      const companyUsers = await storage.getUsersByCompany(companyId);
      const userIds = companyUsers.map(u => u.id);
      if (userIds.length === 0) return res.json({ activeUserPercent: 0, avgCheckInsPerWeek: 0, programEnrollmentRate: 0, totalUsers: 0, activeUsers: 0 });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentCheckIns = await db.select({ userId: checkIns.userId }).from(checkIns)
        .where(and(inArray(checkIns.userId, userIds), gte(checkIns.createdAt, thirtyDaysAgo)));
      const activeUserIds = new Set(recentCheckIns.map(c => c.userId));
      const activeUserPercent = Math.round((activeUserIds.size / userIds.length) * 100);

      const weeklyCheckIns = await db.select({ userId: checkIns.userId }).from(checkIns)
        .where(and(inArray(checkIns.userId, userIds), gte(checkIns.createdAt, sevenDaysAgo)));
      const avgCheckInsPerWeek = userIds.length > 0 ? Math.round((weeklyCheckIns.length / userIds.length) * 10) / 10 : 0;

      const enrollments = await db.select({ userId: userProgramEnrollments.userId }).from(userProgramEnrollments)
        .where(inArray(userProgramEnrollments.userId, userIds));
      const enrolledUserIds = new Set(enrollments.map(e => e.userId));
      const programEnrollmentRate = Math.round((enrolledUserIds.size / userIds.length) * 100);

      res.json({
        totalUsers: userIds.length,
        activeUsers: activeUserIds.size,
        activeUserPercent,
        avgCheckInsPerWeek,
        programEnrollmentRate,
      });
    } catch (error) {
      console.error("Error fetching engagement metrics:", error);
      res.status(500).json({ message: "Failed to fetch engagement metrics" });
    }
  });

  // Company wellness snapshot
  app.get('/api/admin/companies/:id/wellness', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) return res.status(403).json({ message: "Admin access required" });
      const companyId = parseInt(req.params.id);
      const companyUsers = await storage.getUsersByCompany(companyId);
      const userIds = companyUsers.map(u => u.id);
      if (userIds.length === 0) return res.json({ avgBurnoutScore: null, topPainAreas: [], trendDirection: null });

      const recentScores = await db.select({ score: burnoutScores.score }).from(burnoutScores)
        .where(inArray(burnoutScores.userId, userIds))
        .orderBy(desc(burnoutScores.createdAt))
        .limit(userIds.length * 2);
      const avgBurnoutScore = recentScores.length > 0
        ? Math.round(recentScores.reduce((sum, s) => sum + s.score, 0) / recentScores.length)
        : null;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentPain = await db.select({ area: bodyMapLogs.bodyPart, severity: bodyMapLogs.severity }).from(bodyMapLogs)
        .where(and(inArray(bodyMapLogs.userId, userIds), gte(bodyMapLogs.createdAt, thirtyDaysAgo)));
      const areaCounts: Record<string, { count: number; totalSeverity: number }> = {};
      for (const log of recentPain) {
        if (!log.area) continue;
        if (!areaCounts[log.area]) areaCounts[log.area] = { count: 0, totalSeverity: 0 };
        areaCounts[log.area].count++;
        areaCounts[log.area].totalSeverity += log.severity || 0;
      }
      const topPainAreas = Object.entries(areaCounts)
        .map(([area, data]) => ({ area, count: data.count, avgSeverity: Math.round((data.totalSeverity / data.count) * 10) / 10 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const olderScores = await db.select({ score: burnoutScores.score }).from(burnoutScores)
        .where(and(inArray(burnoutScores.userId, userIds), gte(burnoutScores.createdAt, sixtyDaysAgo), lt(burnoutScores.createdAt, thirtyDaysAgo)));
      const olderAvg = olderScores.length > 0 ? olderScores.reduce((sum, s) => sum + s.score, 0) / olderScores.length : null;
      let trendDirection: string | null = null;
      if (avgBurnoutScore !== null && olderAvg !== null) {
        const diff = avgBurnoutScore - olderAvg;
        if (diff > 3) trendDirection = "rising";
        else if (diff < -3) trendDirection = "falling";
        else trendDirection = "stable";
      }

      const recentCheckIns = await db.select({ mood: checkIns.moodScore, energy: checkIns.energyLevel, stress: checkIns.stressScore })
        .from(checkIns).where(and(inArray(checkIns.userId, userIds), gte(checkIns.createdAt, thirtyDaysAgo)));
      const avgMood = recentCheckIns.length > 0 ? Math.round(recentCheckIns.reduce((sum, c) => sum + (c.mood || 0), 0) / recentCheckIns.length * 10) / 10 : null;
      const avgEnergy = recentCheckIns.length > 0 ? Math.round(recentCheckIns.reduce((sum, c) => sum + (c.energy || 0), 0) / recentCheckIns.length * 10) / 10 : null;
      const avgStress = recentCheckIns.length > 0 ? Math.round(recentCheckIns.reduce((sum, c) => sum + (c.stress || 0), 0) / recentCheckIns.length * 10) / 10 : null;

      res.json({ avgBurnoutScore, topPainAreas, trendDirection, avgMood, avgEnergy, avgStress });
    } catch (error) {
      console.error("Error fetching wellness snapshot:", error);
      res.status(500).json({ message: "Failed to fetch wellness snapshot" });
    }
  });

  // Company logo upload
  app.post('/api/admin/companies/:id/logo', isAuthenticated, uploadImage.single('logo'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) return res.status(403).json({ message: "Admin access required" });
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const logoUrl = `/uploads/${req.file.filename}`;
      await storage.updateCompany(parseInt(req.params.id), { logoUrl });
      res.json({ logoUrl });
    } catch (error) {
      console.error("Error uploading logo:", error);
      res.status(500).json({ message: "Failed to upload logo" });
    }
  });

  // Video upload route
  app.post('/api/upload/video', isAuthenticated, uploadVideo.single('video'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No video file provided" });
      }

      const videoUrl = `/uploads/videos/${req.file.filename}`;
      res.json({ videoUrl });
    } catch (error) {
      console.error("Video upload error:", error);
      res.status(500).json({ message: "Failed to upload video" });
    }
  });

  // Image upload route
  app.post('/api/upload/image', isAuthenticated, uploadImage.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const imageUrl = `/uploads/images/${req.file.filename}`;
      res.json({ imageUrl });
    } catch (error) {
      console.error("Image upload error:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  // Get user profile data including profile image
  app.get('/api/user/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        height: user.height,
        heightUnit: user.heightUnit,
        profileImageUrl: user.profileImageUrl
      });
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({ message: "Failed to get profile" });
    }
  });

  // Update user profile
  const updateProfileSchema = z.object({
    displayName: z.string().max(100).nullable().optional(),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").nullable().optional(),
    gender: z.enum(["male", "female", "prefer_not_to_say"]).nullable().optional(),
    height: z.number().min(0).max(300).nullable().optional(),
    heightUnit: z.enum(["cm", "ft"]).optional(),
  });

  app.patch('/api/user/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid profile data", errors: parsed.error.errors });
      }
      
      const { displayName, dateOfBirth, gender, height, heightUnit } = parsed.data;
      
      const updates: any = {};
      if (displayName !== undefined) updates.displayName = displayName;
      if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth;
      if (gender !== undefined) updates.gender = gender;
      if (height !== undefined) updates.height = height;
      if (heightUnit !== undefined) updates.heightUnit = heightUnit;
      
      await storage.updateUser(userId, updates);
      const updatedUser = await storage.getUser(userId);
      
      res.json({
        id: updatedUser?.id,
        displayName: updatedUser?.displayName,
        dateOfBirth: updatedUser?.dateOfBirth,
        gender: updatedUser?.gender,
        height: updatedUser?.height,
        heightUnit: updatedUser?.heightUnit,
        profileImageUrl: updatedUser?.profileImageUrl
      });
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Get user preferences
  app.get('/api/user/preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        weightUnit: user.weightUnit || "kg",
        distanceUnit: user.distanceUnit || "km",
        timeFormat: user.timeFormat || "24h",
        dateFormat: user.dateFormat || "DD/MM/YYYY",
        restTimerSounds: user.restTimerSounds ?? true,
        countdownBeeps: user.countdownBeeps ?? true,
      });
    } catch (error) {
      console.error("Get preferences error:", error);
      res.status(500).json({ message: "Failed to get preferences" });
    }
  });

  // Update user preferences
  const updatePreferencesSchema = z.object({
    weightUnit: z.enum(["kg", "lbs"]).optional(),
    distanceUnit: z.enum(["km", "mi"]).optional(),
    timeFormat: z.enum(["12h", "24h"]).optional(),
    dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional(),
    restTimerSounds: z.boolean().optional(),
    countdownBeeps: z.boolean().optional(),
  });

  app.patch('/api/user/preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const parsed = updatePreferencesSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid preferences data", errors: parsed.error.errors });
      }
      
      const updates: any = {};
      if (parsed.data.weightUnit !== undefined) updates.weightUnit = parsed.data.weightUnit;
      if (parsed.data.distanceUnit !== undefined) updates.distanceUnit = parsed.data.distanceUnit;
      if (parsed.data.timeFormat !== undefined) updates.timeFormat = parsed.data.timeFormat;
      if (parsed.data.dateFormat !== undefined) updates.dateFormat = parsed.data.dateFormat;
      if (parsed.data.restTimerSounds !== undefined) updates.restTimerSounds = parsed.data.restTimerSounds;
      if (parsed.data.countdownBeeps !== undefined) updates.countdownBeeps = parsed.data.countdownBeeps;
      
      await storage.updateUser(userId, updates);
      const updatedUser = await storage.getUser(userId);
      
      res.json({
        weightUnit: updatedUser?.weightUnit || "kg",
        distanceUnit: updatedUser?.distanceUnit || "km",
        timeFormat: updatedUser?.timeFormat || "24h",
        dateFormat: updatedUser?.dateFormat || "DD/MM/YYYY",
        restTimerSounds: updatedUser?.restTimerSounds ?? true,
        countdownBeeps: updatedUser?.countdownBeeps ?? true,
      });
    } catch (error) {
      console.error("Update preferences error:", error);
      res.status(500).json({ message: "Failed to update preferences" });
    }
  });

  // Get notification preferences
  app.get('/api/user/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let prefs = await storage.getNotificationPreferences(userId);
      
      if (!prefs) {
        prefs = await storage.upsertNotificationPreferences(userId, {});
      }
      
      res.json(prefs);
    } catch (error) {
      console.error("Get notification preferences error:", error);
      res.status(500).json({ message: "Failed to get notification preferences" });
    }
  });

  // Update notification preferences
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const updateNotificationPreferencesSchema = z.object({
    // Push notifications
    workoutReminders: z.boolean().optional(),
    habitReminders: z.boolean().optional(),
    dailyCheckInPrompts: z.boolean().optional(),
    badgeAlerts: z.boolean().optional(),
    programUpdates: z.boolean().optional(),
    hydrationReminders: z.boolean().optional(),
    supplementReminders: z.boolean().optional(),
    supplementTime: z.string().regex(timeRegex, "Invalid time format").optional(),
    bodyMapReassessment: z.boolean().optional(),
    bodyMapFrequencyDays: z.number().refine(val => [7, 14, 21, 30].includes(val), "Invalid frequency").optional(),
    positionRotation: z.boolean().optional(),
    positionRotationMinutes: z.number().refine(val => [15, 20, 30, 45, 60].includes(val), "Invalid interval").optional(),
    // Email preferences
    emailWorkoutSummary: z.boolean().optional(),
    emailWeeklyProgress: z.boolean().optional(),
    emailProgramReminders: z.boolean().optional(),
    // Quiet hours
    quietHoursEnabled: z.boolean().optional(),
    quietHoursStart: z.string().regex(timeRegex, "Invalid time format").optional(),
    quietHoursEnd: z.string().regex(timeRegex, "Invalid time format").optional(),
  });

  app.patch('/api/user/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = updateNotificationPreferencesSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      
      const updates: Record<string, any> = {};
      const data = parsed.data;
      if (data.workoutReminders !== undefined) updates.workoutReminders = data.workoutReminders;
      if (data.habitReminders !== undefined) updates.habitReminders = data.habitReminders;
      if (data.dailyCheckInPrompts !== undefined) updates.dailyCheckInPrompts = data.dailyCheckInPrompts;
      if (data.badgeAlerts !== undefined) updates.badgeAlerts = data.badgeAlerts;
      if (data.programUpdates !== undefined) updates.programUpdates = data.programUpdates;
      if (data.hydrationReminders !== undefined) updates.hydrationReminders = data.hydrationReminders;
      if (data.supplementReminders !== undefined) updates.supplementReminders = data.supplementReminders;
      if (data.supplementTime !== undefined) updates.supplementTime = data.supplementTime;
      if (data.bodyMapReassessment !== undefined) updates.bodyMapReassessment = data.bodyMapReassessment;
      if (data.bodyMapFrequencyDays !== undefined) updates.bodyMapFrequencyDays = data.bodyMapFrequencyDays;
      if (data.positionRotation !== undefined) updates.positionRotation = data.positionRotation;
      if (data.positionRotationMinutes !== undefined) updates.positionRotationMinutes = data.positionRotationMinutes;
      if (data.emailWorkoutSummary !== undefined) updates.emailWorkoutSummary = data.emailWorkoutSummary;
      if (data.emailWeeklyProgress !== undefined) updates.emailWeeklyProgress = data.emailWeeklyProgress;
      if (data.emailProgramReminders !== undefined) updates.emailProgramReminders = data.emailProgramReminders;
      if (data.quietHoursEnabled !== undefined) updates.quietHoursEnabled = data.quietHoursEnabled;
      if (data.quietHoursStart !== undefined) updates.quietHoursStart = data.quietHoursStart;
      if (data.quietHoursEnd !== undefined) updates.quietHoursEnd = data.quietHoursEnd;
      
      const prefs = await storage.upsertNotificationPreferences(userId, updates);
      res.json(prefs);
    } catch (error) {
      console.error("Update notification preferences error:", error);
      res.status(500).json({ message: "Failed to update notification preferences" });
    }
  });

  // Get user streak
  app.get('/api/user/streak', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const streak = await storage.getUserStreak(userId);
      res.json(streak);
    } catch (error) {
      console.error("Get streak error:", error);
      res.status(500).json({ message: "Failed to get streak" });
    }
  });

  // Update user streak (called after completing qualifying activities)
  app.post('/api/user/streak', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = await storage.updateUserStreak(userId);
      
      // Also check for streak badges
      if (result.isNewDay) {
        await storage.checkUserBadgeEligibility(userId);
      }
      
      res.json(result);
    } catch (error) {
      console.error("Update streak error:", error);
      res.status(500).json({ message: "Failed to update streak" });
    }
  });

  // Profile image upload - stores as base64 data URL in database for persistence across deployments
  const profileImageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    }
  });

  app.post('/api/user/profile-image', isAuthenticated, profileImageUpload.single('profileImage'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const userId = req.user.claims.sub;
      const base64 = req.file.buffer.toString('base64');
      const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

      await storage.updateUser(userId, { profileImageUrl: dataUrl });

      res.json({ profileImageUrl: dataUrl });
    } catch (error) {
      console.error("Profile image upload error:", error);
      res.status(500).json({ message: "Failed to upload profile image" });
    }
  });

  // Exercise Library routes
  app.get('/api/exercises', async (req, res) => {
    try {
      const { mainMuscle, equipment, movement, mechanics, level, limit, offset } = req.query;
      const exercises = await storage.getExercises({
        mainMuscle: mainMuscle ? (typeof mainMuscle === 'string' ? mainMuscle.split(',') : mainMuscle as string[]) : undefined,
        equipment: equipment ? (typeof equipment === 'string' ? equipment.split(',') : equipment as string[]) : undefined,
        movement: movement ? (typeof movement === 'string' ? movement.split(',') : movement as string[]) : undefined,
        mechanics: mechanics ? (typeof mechanics === 'string' ? mechanics.split(',') : mechanics as string[]) : undefined,
        level: level ? (typeof level === 'string' ? level.split(',') : level as string[]) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });
      res.json(exercises);
    } catch (error) {
      console.error("Error fetching exercises:", error);
      res.status(500).json({ message: "Failed to fetch exercises" });
    }
  });

  app.get('/api/exercises/search', async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }
      const exercises = await storage.searchExercises(query);
      res.json(exercises);
    } catch (error) {
      console.error("Error searching exercises:", error);
      res.status(500).json({ message: "Failed to search exercises" });
    }
  });

  app.get('/api/exercises/:id', async (req, res) => {
    try {
      const exercise = await storage.getExerciseById(parseInt(req.params.id));
      if (!exercise) {
        return res.status(404).json({ message: "Exercise not found" });
      }
      res.json(exercise);
    } catch (error) {
      console.error("Error fetching exercise:", error);
      res.status(500).json({ message: "Failed to fetch exercise" });
    }
  });

  app.post('/api/exercises', isAuthenticated, async (req, res) => {
    try {
      const exerciseData = insertExerciseLibraryItemSchema.parse(req.body);
      const exercise = await storage.createExercise(exerciseData);
      res.status(201).json(exercise);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid exercise data", errors: error.errors });
      }
      console.error("Error creating exercise:", error);
      res.status(500).json({ message: "Failed to create exercise" });
    }
  });

  app.put('/api/exercises/:id', isAuthenticated, async (req, res) => {
    try {
      const exerciseData = insertExerciseLibraryItemSchema.partial().parse(req.body);
      const exercise = await storage.updateExercise(parseInt(req.params.id), exerciseData);
      res.json(exercise);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid exercise data", errors: error.errors });
      }
      console.error("Error updating exercise:", error);
      res.status(500).json({ message: "Failed to update exercise" });
    }
  });

  app.delete('/api/exercises/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteExercise(parseInt(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting exercise:", error);
      
      // Check if it's a foreign key constraint error
      if (error.code === '23503') {
        return res.status(400).json({ 
          message: "Cannot delete exercise",
          detail: "This exercise is currently being used in one or more training programs. Please remove it from all programs before deleting."
        });
      }
      
      res.status(500).json({ message: "Failed to delete exercise" });
    }
  });

  // Program routes
  app.get('/api/programs', async (req, res) => {
    try {
      const { goal, equipment, duration, programmeType } = req.query;
      const programs = await storage.getPrograms({
        goal: goal as string,
        equipment: equipment as string,
        duration: duration as string,
        programmeType: programmeType as string,
      });
      res.json(programs);
    } catch (error) {
      console.error("Error fetching programs:", error);
      res.status(500).json({ message: "Failed to fetch programs" });
    }
  });

  app.get('/api/programs/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const program = await storage.getProgramById(id);
      if (!program) {
        return res.status(404).json({ message: "Program not found" });
      }
      res.json(program);
    } catch (error) {
      console.error("Error fetching program:", error);
      res.status(500).json({ message: "Failed to fetch program" });
    }
  });

  app.get('/api/programs/:id/preview', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const program = await storage.getProgramById(id);
      if (!program) {
        return res.status(404).json({ message: "Program not found" });
      }

      const weeks = await db.select().from(programWeeks).where(eq(programWeeks.programId, id)).orderBy(asc(programWeeks.weekNumber));
      if (weeks.length === 0) {
        return res.json({ ...program, workouts: [] });
      }

      const week1 = weeks[0];
      const week1Days = await db.select().from(programDays).where(eq(programDays.weekId, week1.id)).orderBy(asc(programDays.position));

      const workoutsWithExercises: any[] = [];

      for (const day of week1Days) {
        const dayWorkouts = await db.select().from(programmeWorkouts).where(eq(programmeWorkouts.dayId, day.id)).orderBy(asc(programmeWorkouts.position));

        for (const workout of dayWorkouts) {
          const blocks = await storage.getProgrammeWorkoutBlocks(workout.id);

          const enrichedBlocks = [];
          for (const block of blocks) {
            const exercises = block.exercises || [];
            const enrichedExercises = [];
            for (const ex of exercises) {
              let exerciseName = ex.name || "Exercise";
              let imageUrl = ex.imageUrl || null;
              if (ex.exerciseLibraryId) {
                const libEntry = await storage.getExerciseById(ex.exerciseLibraryId);
                if (libEntry) {
                  exerciseName = libEntry.name;
                  imageUrl = libEntry.imageUrl || (libEntry.muxPlaybackId ? `https://image.mux.com/${libEntry.muxPlaybackId}/thumbnail.png?width=200` : null);
                }
              }
              enrichedExercises.push({
                ...ex,
                name: exerciseName,
                imageUrl,
              });
            }
            enrichedBlocks.push({ ...block, exercises: enrichedExercises });
          }

          workoutsWithExercises.push({
            id: workout.id,
            name: workout.name,
            description: workout.description,
            workoutType: workout.workoutType,
            category: workout.category,
            difficulty: workout.difficulty,
            duration: workout.duration,
            dayPosition: day.position,
            blocks: enrichedBlocks,
          });
        }
      }

      res.json({ ...program, workouts: workoutsWithExercises, totalWeeks: weeks.length });
    } catch (error) {
      console.error("Error fetching program preview:", error);
      res.status(500).json({ message: "Failed to fetch program preview" });
    }
  });

  // Workout routes
  app.get('/api/workouts', async (req, res) => {
    try {
      const { category, difficulty, routineType } = req.query;
      const workouts = await storage.getWorkouts({
        category: category as string,
        difficulty: difficulty as string,
        routineType: routineType as string,
      });

      const enriched = await Promise.all(workouts.map(async (w: any) => {
        const est = calculateServerWorkoutDuration(w);
        let imageUrl = w.imageUrl || null;
        if (!imageUrl) {
          imageUrl = await storage.getWorkoutFirstExerciseImage(w.id);
        }
        return { ...w, imageUrl, estimatedDuration: est };
      }));

      res.json(enriched);
    } catch (error) {
      console.error("Error fetching workouts:", error);
      res.status(500).json({ message: "Failed to fetch workouts" });
    }
  });

  // Get user's saved workouts (must be before :id route)
  app.get('/api/workouts/mine', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userWorkouts = await db.select().from(workouts)
        .where(and(eq(workouts.userId, userId), eq(workouts.sourceType, 'user')))
        .orderBy(desc(workouts.createdAt));
      res.json(userWorkouts);
    } catch (error) {
      console.error("Error fetching user workouts:", error);
      res.status(500).json({ message: "Failed to fetch saved workouts" });
    }
  });

  // Delete user's saved workout (must be before :id route)
  app.delete('/api/workouts/mine/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const workoutId = parseInt(req.params.id);
      const workout = await storage.getWorkoutById(workoutId);
      if (!workout || workout.userId !== userId) {
        return res.status(404).json({ message: "Workout not found" });
      }
      await db.delete(workouts).where(eq(workouts.id, workoutId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting saved workout:", error);
      res.status(500).json({ message: "Failed to delete workout" });
    }
  });

  app.get('/api/workouts/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const workout = await storage.getWorkoutById(id);
      if (!workout) {
        return res.status(404).json({ message: "Workout not found" });
      }
      
      // Enrich exercises with muxPlaybackId from exercise library
      if (workout.exercises && Array.isArray(workout.exercises)) {
        const exerciseLibraryIds: number[] = [];
        
        // Collect all exercise library IDs from nested structure
        for (const block of workout.exercises as any[]) {
          if (block.exercises && Array.isArray(block.exercises)) {
            for (const ex of block.exercises) {
              if (ex.exerciseLibraryId) {
                exerciseLibraryIds.push(ex.exerciseLibraryId);
              }
            }
          }
        }
        
        // Fetch exercise library entries to get muxPlaybackId
        if (exerciseLibraryIds.length > 0) {
          const uniqueIds = [...new Set(exerciseLibraryIds)];
          const libraryMap = new Map<number, any>();
          
          // Fetch each exercise from library
          for (const libId of uniqueIds) {
            const libEntry = await storage.getExerciseById(libId);
            if (libEntry) {
              libraryMap.set(libId, libEntry);
            }
          }
          
          // Enrich exercises with muxPlaybackId and imageUrl
          for (const block of workout.exercises as any[]) {
            if (block.exercises && Array.isArray(block.exercises)) {
              for (const ex of block.exercises) {
                if (ex.exerciseLibraryId) {
                  const libEntry = libraryMap.get(ex.exerciseLibraryId);
                  if (libEntry) {
                    ex.muxPlaybackId = libEntry.muxPlaybackId;
                    if (!ex.imageUrl && libEntry.imageUrl) {
                      ex.imageUrl = libEntry.imageUrl;
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      const est = calculateServerWorkoutDuration(workout);
      res.json({ ...workout, estimatedDuration: est });
    } catch (error) {
      console.error("Error fetching workout:", error);
      res.status(500).json({ message: "Failed to fetch workout" });
    }
  });

  app.get('/api/workouts/:id/exercises', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // First try to get blocks (new format)
      const blocks = await storage.getWorkoutBlocks(id);
      if (blocks && blocks.length > 0) {
        // Return full block structure with exercises
        const blocksWithExercises = await Promise.all(
          blocks.map(async (block) => ({
            ...block,
            exercises: await storage.getBlockExercises(block.id),
          }))
        );
        return res.json(blocksWithExercises);
      }
      // Fallback to old format if no blocks
      const exercises = await storage.getWorkoutExercises(id);
      res.json(exercises);
    } catch (error) {
      console.error("Error fetching workout exercises:", error);
      res.status(500).json({ message: "Failed to fetch workout exercises" });
    }
  });

  app.post('/api/workouts', isAuthenticated, async (req, res) => {
    try {
      const blocks = req.body.blocks || [];
      let duration = req.body.duration;
      const muxPlaybackId = req.body.muxPlaybackId || null;
      
      // Auto-fetch duration from Mux for video workouts
      if (req.body.workoutType === 'video' && muxPlaybackId) {
        try {
          const { video } = await import('./mux');
          const assets = await video.assets.list();
          const asset = assets.data.find((a: any) => 
            a.playback_ids?.some((p: any) => p.id === muxPlaybackId)
          );
          if (asset && asset.duration) {
            duration = Math.round(asset.duration / 60); // Convert seconds to minutes
          }
        } catch (muxError) {
          console.log("Could not fetch Mux duration, using provided value:", muxError);
        }
      }
      
      const workoutData = {
        title: req.body.title,
        description: req.body.description || "",
        category: req.body.category,
        difficulty: req.body.difficulty,
        duration,
        equipment: req.body.equipment || [],
        exercises: blocks, // Store blocks in exercises JSONB for backwards compatibility
        imageUrl: req.body.imageUrl || null,
        videoUrl: req.body.videoUrl || null,
        routineType: req.body.routineType || "workout",
        workoutType: req.body.workoutType || "regular",
        intervalRounds: req.body.intervalRounds || 4,
        intervalRestAfterRound: req.body.intervalRestAfterRound || "60 sec",
        muxPlaybackId,
      };
      console.log("Creating workout with data:", JSON.stringify(workoutData, null, 2));
      const workout = await storage.createWorkout(workoutData);
      
      // Also save to normalized block tables
      if (blocks.length > 0) {
        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i];
          const createdBlock = await storage.createWorkoutBlock({
            workoutId: workout.id,
            section: block.section || 'main',
            blockType: block.blockType || 'single',
            position: i,
            rest: block.rest || null,
            rounds: block.rounds || null,
            restAfterRound: block.restAfterRound || null,
          });
          
          // Create block exercises
          if (block.exercises && Array.isArray(block.exercises)) {
            for (let j = 0; j < block.exercises.length; j++) {
              const exercise = block.exercises[j];
              await storage.createBlockExercise({
                blockId: createdBlock.id,
                exerciseLibraryId: exercise.exerciseLibraryId || null,
                position: j,
                sets: exercise.sets || [],
                durationType: exercise.durationType || null,
                tempo: exercise.tempo || null,
                load: exercise.load || null,
                notes: exercise.notes || null,
              });
            }
          }
        }
      }
      
      res.status(201).json(workout);
    } catch (error: any) {
      console.error("Error creating workout:", error?.message || error);
      console.error("Full error:", error);
      res.status(500).json({ message: "Failed to create workout", error: error?.message });
    }
  });

  app.patch('/api/workouts/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const blocks = req.body.blocks || [];
      let duration = req.body.duration;
      
      // Get existing workout to preserve muxPlaybackId if not provided
      const existingWorkout = await storage.getWorkoutById(id);
      const muxPlaybackId = req.body.muxPlaybackId !== undefined 
        ? (req.body.muxPlaybackId || null)
        : (existingWorkout?.muxPlaybackId || null);
      
      // Auto-fetch duration from Mux for video workouts
      if (req.body.workoutType === 'video' && muxPlaybackId) {
        try {
          const { video } = await import('./mux');
          const assets = await video.assets.list();
          const asset = assets.data.find((a: any) => 
            a.playback_ids?.some((p: any) => p.id === muxPlaybackId)
          );
          if (asset && asset.duration) {
            duration = Math.round(asset.duration / 60); // Convert seconds to minutes
          }
        } catch (muxError) {
          console.log("Could not fetch Mux duration, using provided value:", muxError);
        }
      }
      
      const workoutData: Record<string, any> = {
        title: req.body.title,
        description: req.body.description || null,
        category: req.body.category,
        difficulty: req.body.difficulty,
        duration,
        equipment: req.body.equipment || [],
        exercises: blocks,
        imageUrl: req.body.imageUrl !== undefined ? (req.body.imageUrl || null) : (existingWorkout?.imageUrl || null),
        workoutType: req.body.workoutType || existingWorkout?.workoutType || 'regular',
        routineType: req.body.routineType || existingWorkout?.routineType || 'workout',
        intervalRounds: req.body.intervalRounds ?? existingWorkout?.intervalRounds ?? 4,
        intervalRestAfterRound: req.body.intervalRestAfterRound || existingWorkout?.intervalRestAfterRound || '60 sec',
        muxPlaybackId,
      };
      
      // Remove undefined values to prevent Drizzle errors
      Object.keys(workoutData).forEach(key => {
        if (workoutData[key] === undefined) delete workoutData[key];
      });
      
      const workout = await storage.updateWorkout(id, workoutData);
      
      // Delete existing blocks and recreate
      await storage.deleteWorkoutBlocksByWorkoutId(id);
      
      // Create new blocks
      if (blocks.length > 0) {
        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i];
          const createdBlock = await storage.createWorkoutBlock({
            workoutId: id,
            section: block.section || 'main',
            blockType: block.blockType || 'single',
            position: i,
            rest: block.rest || null,
            rounds: block.rounds || null,
            restAfterRound: block.restAfterRound || null,
          });
          
          // Create block exercises
          if (block.exercises && Array.isArray(block.exercises)) {
            for (let j = 0; j < block.exercises.length; j++) {
              const exercise = block.exercises[j];
              await storage.createBlockExercise({
                blockId: createdBlock.id,
                exerciseLibraryId: exercise.exerciseLibraryId || null,
                position: j,
                sets: exercise.sets || [],
                durationType: exercise.durationType || null,
                tempo: exercise.tempo || null,
                load: exercise.load || null,
                notes: exercise.notes || null,
              });
            }
          }
        }
      }
      
      res.json(workout);
    } catch (error) {
      console.error("Error updating workout:", error);
      res.status(500).json({ message: "Failed to update workout" });
    }
  });

  app.delete('/api/workouts/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteWorkout(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting workout:", error);
      res.status(500).json({ message: "Failed to delete workout" });
    }
  });

  // Workout blocks routes (superset, triset, circuit support)
  app.get('/api/workouts/:workoutId/blocks', async (req, res) => {
    try {
      const workoutId = parseInt(req.params.workoutId);
      const result = await storage.getWorkoutWithBlocks(workoutId);
      res.json(result);
    } catch (error) {
      console.error("Error fetching workout blocks:", error);
      res.status(500).json({ message: "Failed to fetch workout blocks" });
    }
  });

  app.post('/api/workouts/:workoutId/blocks', isAuthenticated, async (req, res) => {
    try {
      const workoutId = parseInt(req.params.workoutId);
      const blockData = {
        workoutId,
        section: req.body.section || 'main',
        blockType: req.body.blockType,
        position: req.body.position,
        rest: req.body.rest,
      };
      const block = await storage.createWorkoutBlock(blockData);
      res.status(201).json(block);
    } catch (error) {
      console.error("Error creating workout block:", error);
      res.status(500).json({ message: "Failed to create workout block" });
    }
  });

  app.patch('/api/blocks/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const block = await storage.updateWorkoutBlock(id, req.body);
      res.json(block);
    } catch (error) {
      console.error("Error updating workout block:", error);
      res.status(500).json({ message: "Failed to update workout block" });
    }
  });

  app.delete('/api/blocks/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteWorkoutBlock(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting workout block:", error);
      res.status(500).json({ message: "Failed to delete workout block" });
    }
  });

  // Block exercises routes
  app.post('/api/blocks/:blockId/exercises', isAuthenticated, async (req, res) => {
    try {
      const blockId = parseInt(req.params.blockId);
      const exerciseData = {
        blockId,
        exerciseLibraryId: req.body.exerciseLibraryId,
        position: req.body.position,
        sets: req.body.sets,
        tempo: req.body.tempo,
        load: req.body.load,
        notes: req.body.notes,
      };
      const exercise = await storage.createBlockExercise(exerciseData);
      res.status(201).json(exercise);
    } catch (error) {
      console.error("Error creating block exercise:", error);
      res.status(500).json({ message: "Failed to create block exercise" });
    }
  });

  app.patch('/api/block-exercises/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const exercise = await storage.updateBlockExercise(id, req.body);
      res.json(exercise);
    } catch (error) {
      console.error("Error updating block exercise:", error);
      res.status(500).json({ message: "Failed to update block exercise" });
    }
  });

  app.delete('/api/block-exercises/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBlockExercise(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting block exercise:", error);
      res.status(500).json({ message: "Failed to delete block exercise" });
    }
  });

  // Programme workout routes - template view (admin/library)
  app.get('/api/programme-workouts/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const workout = await storage.getProgrammeWorkoutById(id);
      if (!workout) {
        return res.status(404).json({ message: "Workout not found" });
      }
      
      // Always return template blocks (no substitutions applied)
      const blocks = await storage.getProgrammeWorkoutBlocks(id);
      
      // Get the parent programme to determine if it's main or supplementary and get programId
      let programmeType = 'main';
      let programId: number | null = null;
      const day = await storage.getProgramDayById(workout.dayId);
      if (day) {
        const week = await storage.getProgramWeekById(day.weekId);
        if (week) {
          programId = week.programId;
          const program = await storage.getProgramById(week.programId);
          if (program) {
            programmeType = program.programmeType || 'main';
          }
        }
      }
      
      res.json({
        ...workout,
        blocks,
        programmeType,
        programId,
      });
    } catch (error) {
      console.error("Error fetching programme workout:", error);
      res.status(500).json({ message: "Failed to fetch workout" });
    }
  });
  
  // Enrollment-scoped workout view - applies user-specific substitutions
  app.get('/api/my-programs/:enrollmentId/workouts/:workoutId', isAuthenticated, async (req: any, res) => {
    try {
      const enrollmentId = parseInt(req.params.enrollmentId);
      const workoutId = parseInt(req.params.workoutId);
      const userId = req.user.claims.sub;
      
      // Verify user owns this enrollment
      const enrollments = await storage.getUserEnrolledPrograms(userId);
      const enrollment = enrollments.find(e => e.id === enrollmentId);
      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found" });
      }
      
      const workout = await storage.getProgrammeWorkoutById(workoutId);
      if (!workout) {
        return res.status(404).json({ message: "Workout not found" });
      }
      
      // Get blocks with user-specific substitutions applied
      const blocks = await storage.getProgrammeWorkoutBlocksForEnrollment(workoutId, enrollmentId);
      
      // Get the parent programme type
      let programmeType = 'main';
      const day = await storage.getProgramDayById(workout.dayId);
      if (day) {
        const week = await storage.getProgramWeekById(day.weekId);
        if (week) {
          const program = await storage.getProgramById(week.programId);
          if (program) {
            programmeType = program.programmeType || 'main';
          }
        }
      }
      
      res.json({
        ...workout,
        blocks,
        programmeType,
        enrollmentId,
      });
    } catch (error) {
      console.error("Error fetching enrolled workout:", error);
      res.status(500).json({ message: "Failed to fetch workout" });
    }
  });

  app.get('/api/my-programs/:enrollmentId/enrollment-workouts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const enrollmentId = parseInt(req.params.enrollmentId);
      
      const enrollments = await storage.getUserEnrolledPrograms(userId);
      const enrollment = enrollments.find((e: any) => e.id === enrollmentId);
      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found" });
      }
      
      const workouts = await storage.getEnrollmentWorkoutsForUser(enrollmentId);
      res.json(workouts);
    } catch (error) {
      console.error("Error fetching enrollment workouts:", error);
      res.status(500).json({ message: "Failed to fetch enrollment workouts" });
    }
  });

  app.put('/api/my-programs/:enrollmentId/enrollment-workouts/:workoutId/blocks', isAuthenticated, async (req: any, res) => {
    try {
      const enrollmentId = parseInt(req.params.enrollmentId);
      const workoutId = parseInt(req.params.workoutId);
      const userId = req.user.claims.sub;
      const { title, blocks } = req.body;

      const enrollments = await storage.getUserEnrolledPrograms(userId);
      if (!enrollments.find((e: any) => e.id === enrollmentId)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      // Fetch the target workout so we know its templateWorkoutId and weekNumber
      const [targetWorkout] = await db.select()
        .from(enrollmentWorkouts)
        .where(and(eq(enrollmentWorkouts.id, workoutId), eq(enrollmentWorkouts.enrollmentId, enrollmentId)));

      if (!targetWorkout) {
        return res.status(404).json({ message: 'Workout not found' });
      }

      // Find all future occurrences of the same template workout in this enrollment
      // (same templateWorkoutId, weekNumber >= current week) to propagate changes
      const futureWorkouts = targetWorkout.templateWorkoutId
        ? await db.select()
            .from(enrollmentWorkouts)
            .where(and(
              eq(enrollmentWorkouts.enrollmentId, enrollmentId),
              eq(enrollmentWorkouts.templateWorkoutId, targetWorkout.templateWorkoutId),
              gte(enrollmentWorkouts.weekNumber, targetWorkout.weekNumber)
            ))
        : [targetWorkout];

      const workoutIdsToUpdate = futureWorkouts.map((w: any) => w.id);

      // Helper: apply blocks to a single enrollment workout
      const applyBlocks = async (ewId: number, workoutTitle: string | null) => {
        if (workoutTitle) {
          await db.update(enrollmentWorkouts)
            .set({ name: workoutTitle })
            .where(eq(enrollmentWorkouts.id, ewId));
        }

        const existingBlocks = await db.select().from(enrollmentWorkoutBlocks)
          .where(eq(enrollmentWorkoutBlocks.enrollmentWorkoutId, ewId));
        for (const eb of existingBlocks) {
          await db.delete(enrollmentBlockExercises).where(eq(enrollmentBlockExercises.enrollmentBlockId, eb.id));
        }
        await db.delete(enrollmentWorkoutBlocks).where(eq(enrollmentWorkoutBlocks.enrollmentWorkoutId, ewId));

        if (blocks && Array.isArray(blocks)) {
          for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
            const b = blocks[bIdx];
            const [newBlock] = await db.insert(enrollmentWorkoutBlocks)
              .values({ enrollmentWorkoutId: ewId, section: b.section || 'main', blockType: b.blockType || 'single', position: bIdx, rest: b.rest || null })
              .returning();
            if (b.exercises && Array.isArray(b.exercises)) {
              for (let eIdx = 0; eIdx < b.exercises.length; eIdx++) {
                const ex = b.exercises[eIdx];
                await db.insert(enrollmentBlockExercises)
                  .values({ enrollmentBlockId: newBlock.id, exerciseLibraryId: ex.exerciseLibraryId || null, position: eIdx, sets: ex.sets || [], tempo: ex.tempo || null, load: ex.load || null, notes: ex.notes || null });
              }
            }
          }
        }
      };

      // Apply to all identified workouts (current + future occurrences)
      for (const ewId of workoutIdsToUpdate) {
        await applyBlocks(ewId, ewId === workoutId ? (title || null) : null);
      }

      res.json({ success: true, updatedCount: workoutIdsToUpdate.length });
    } catch (error) {
      console.error('Error updating enrollment workout blocks:', error);
      res.status(500).json({ message: 'Failed to update workout' });
    }
  });

  app.post('/api/my-programs/:enrollmentId/add-exercise-to-workout', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const enrollmentId = parseInt(req.params.enrollmentId);
      const { templateWorkoutId, exerciseLibraryId, sets, durationType, tempo, load, notes, applyScope, currentWeekNumber, currentDayNumber } = req.body;
      
      if (!templateWorkoutId || !exerciseLibraryId || !sets || !applyScope || !currentWeekNumber) {
        return res.status(400).json({ message: "Missing required fields: templateWorkoutId, exerciseLibraryId, sets, applyScope, currentWeekNumber" });
      }
      
      const enrollments = await storage.getUserEnrolledPrograms(userId);
      const enrollment = enrollments.find((e: any) => e.id === enrollmentId);
      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found" });
      }
      
      const exercise = await storage.getExerciseById(exerciseLibraryId);
      if (!exercise) {
        return res.status(404).json({ message: "Exercise not found" });
      }
      
      const result = await storage.addExerciseToEnrollmentWorkouts(
        enrollmentId,
        templateWorkoutId,
        exerciseLibraryId,
        { sets, durationType, tempo, load, notes },
        applyScope,
        currentWeekNumber,
        currentDayNumber || undefined
      );
      
      res.json({ success: true, ...result, exerciseName: exercise.name });
    } catch (error) {
      console.error("Error adding exercise to enrollment workout:", error);
      res.status(500).json({ message: "Failed to add exercise to workout" });
    }
  });

  app.get('/api/programme-workouts/:id/exercises', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const exercises = await storage.getProgramExercises(id);
      res.json(exercises);
    } catch (error) {
      console.error("Error fetching programme workout exercises:", error);
      res.status(500).json({ message: "Failed to fetch exercises" });
    }
  });

  // Programme workout blocks routes
  // If enrollmentId query param is provided, applies user-specific substitutions
  app.get('/api/programme-workouts/:id/blocks', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const enrollmentId = req.query.enrollmentId ? parseInt(req.query.enrollmentId as string) : null;
      
      let blocks;
      if (enrollmentId) {
        // Use enrollment-aware function that applies substitutions
        blocks = await storage.getProgrammeWorkoutBlocksForEnrollment(id, enrollmentId);
      } else {
        // Return the template without substitutions (admin view)
        blocks = await storage.getProgrammeWorkoutBlocks(id);
      }
      res.json(blocks);
    } catch (error) {
      console.error("Error fetching programme workout blocks:", error);
      res.status(500).json({ message: "Failed to fetch blocks" });
    }
  });

  app.post('/api/programme-workouts/:id/blocks', isAuthenticated, async (req, res) => {
    try {
      const workoutId = parseInt(req.params.id);
      const block = await storage.createProgrammeWorkoutBlock({
        workoutId,
        ...req.body,
      });
      res.status(201).json(block);
    } catch (error) {
      console.error("Error creating programme workout block:", error);
      res.status(500).json({ message: "Failed to create block" });
    }
  });

  app.put('/api/programme-blocks/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const block = await storage.updateProgrammeWorkoutBlock(id, req.body);
      res.json(block);
    } catch (error) {
      console.error("Error updating programme block:", error);
      res.status(500).json({ message: "Failed to update block" });
    }
  });

  app.delete('/api/programme-blocks/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProgrammeWorkoutBlock(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting programme block:", error);
      res.status(500).json({ message: "Failed to delete block" });
    }
  });

  app.post('/api/programme-blocks/swap-positions', isAuthenticated, async (req, res) => {
    try {
      const { blockId1, blockId2 } = req.body;
      await storage.swapProgrammeBlockPositions(blockId1, blockId2);
      res.json({ success: true });
    } catch (error) {
      console.error("Error swapping programme block positions:", error);
      res.status(500).json({ message: "Failed to swap positions" });
    }
  });

  app.put('/api/programme-workouts/:workoutId/blocks/batch', isAuthenticated, async (req, res) => {
    try {
      const workoutId = parseInt(req.params.workoutId);
      const { blocks, programId } = req.body;
      
      // Use batch function that saves to ALL workouts with the same name
      const savedBlocks = await storage.batchUpdateAllSameNamedWorkouts(workoutId, programId, blocks);
      
      if (programId) {
        try {
          await updateProgramEquipmentAuto(programId);
        } catch (eqErr) {
          console.error("Auto equipment recalc error:", eqErr);
        }
      }
      
      res.json(savedBlocks);
    } catch (error) {
      console.error("Error batch updating programme blocks:", error);
      res.status(500).json({ message: "Failed to save workout" });
    }
  });

  app.get('/api/programs/:id/equipment-detection', isAuthenticated, async (req, res) => {
    try {
      const programId = parseInt(req.params.id);
      const result = await calculateProgramEquipment(programId);
      res.json(result);
    } catch (error) {
      console.error("Error detecting equipment:", error);
      res.status(500).json({ message: "Failed to detect equipment" });
    }
  });

  app.post('/api/programs/recalculate-all-equipment', isAuthenticated, async (req, res) => {
    try {
      const allPrograms = await db.select({ id: programs.id, title: programs.title }).from(programs);
      const results: Record<number, string> = {};
      for (const prog of allPrograms) {
        try {
          const level = await updateProgramEquipmentAuto(prog.id);
          results[prog.id] = level || 'no_exercises';
        } catch (e) {
          results[prog.id] = 'error';
        }
      }
      res.json({ results });
    } catch (error) {
      console.error("Error recalculating all equipment:", error);
      res.status(500).json({ message: "Failed to recalculate all equipment" });
    }
  });

  app.post('/api/programs/:id/recalculate-equipment', isAuthenticated, async (req, res) => {
    try {
      const programId = parseInt(req.params.id);
      const level = await updateProgramEquipmentAuto(programId);
      res.json({ equipment: level });
    } catch (error) {
      console.error("Error recalculating equipment:", error);
      res.status(500).json({ message: "Failed to recalculate equipment" });
    }
  });

  // Programme block exercises routes
  app.post('/api/programme-blocks/:blockId/exercises', isAuthenticated, async (req, res) => {
    try {
      const blockId = parseInt(req.params.blockId);
      const exercise = await storage.createProgrammeBlockExercise({
        blockId,
        ...req.body,
      });
      res.status(201).json(exercise);
    } catch (error) {
      console.error("Error creating programme block exercise:", error);
      res.status(500).json({ message: "Failed to create exercise" });
    }
  });

  app.put('/api/programme-block-exercises/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const exercise = await storage.updateProgrammeBlockExercise(id, req.body);
      res.json(exercise);
    } catch (error) {
      console.error("Error updating programme block exercise:", error);
      res.status(500).json({ message: "Failed to update exercise" });
    }
  });

  app.delete('/api/programme-block-exercises/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProgrammeBlockExercise(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting programme block exercise:", error);
      res.status(500).json({ message: "Failed to delete exercise" });
    }
  });

  // ============================================
  // Active Workout Log Routes
  // ============================================

  // Start a new workout session
  app.post('/api/workout-logs', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const { workoutId, workoutType, workoutName, programmeId, workoutStyle, intervalRounds, intervalRestAfterRound, enrollmentId, week, day } = req.body;
      
      // Check if there's already an active workout
      const activeLog = await storage.getActiveWorkoutLog(userId);
      if (activeLog) {
        return res.status(400).json({ 
          message: "You already have an active workout in progress",
          activeLogId: activeLog.id 
        });
      }
      
      const log = await storage.createWorkoutLog({
        userId,
        workoutId,
        workoutType,
        workoutName,
        programmeId: programmeId || null,
        enrollmentId: enrollmentId || null,
        week: week || null,
        day: day || null,
        status: 'in_progress',
        startedAt: new Date(),
        workoutStyle: workoutStyle || null,
        intervalRounds: intervalRounds || null,
        intervalRestAfterRound: intervalRestAfterRound || null,
      });
      
      res.status(201).json(log);
    } catch (error) {
      console.error("Error creating workout log:", error);
      res.status(500).json({ message: "Failed to start workout" });
    }
  });

  // Get user's active workout
  app.get('/api/workout-logs/active', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const activeLog = await storage.getActiveWorkoutLog(userId);
      
      if (!activeLog) {
        return res.json(null);
      }
      
      // Get exercise logs with set logs
      const exerciseLogs = await storage.getWorkoutExerciseLogs(activeLog.id);
      const exercisesWithSets = await Promise.all(
        exerciseLogs.map(async (ex) => ({
          ...ex,
          sets: await storage.getWorkoutSetLogs(ex.id),
        }))
      );
      
      res.json({
        ...activeLog,
        exercises: exercisesWithSets,
      });
    } catch (error) {
      console.error("Error fetching active workout:", error);
      res.status(500).json({ message: "Failed to fetch active workout" });
    }
  });

  // NOTE: These context-based routes must come BEFORE /api/workout-logs/:id to avoid being matched by the parameterized route
  // Get completed workout log by context (enrollmentId, week, day) with exercises and sets
  app.get('/api/workout-logs/completed-by-context', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { enrollmentId, week, day } = req.query;
      
      if (!enrollmentId || !week || !day) {
        return res.status(400).json({ message: "Missing required parameters: enrollmentId, week, day" });
      }
      
      const log = await storage.getCompletedWorkoutLogByContext(
        userId,
        parseInt(enrollmentId as string),
        parseInt(week as string),
        parseInt(day as string)
      );
      
      if (!log) {
        return res.json(null);
      }
      
      // Get exercises and sets for the log
      const exerciseLogs = await storage.getWorkoutExerciseLogs(log.id);
      const exercisesWithSets = await Promise.all(
        exerciseLogs.map(async (ex) => ({
          ...ex,
          sets: await storage.getWorkoutSetLogs(ex.id),
        }))
      );
      
      res.json({
        ...log,
        exercises: exercisesWithSets,
      });
    } catch (error) {
      console.error("Error fetching completed workout log:", error);
      res.status(500).json({ message: "Failed to fetch completed workout log" });
    }
  });

  // Get completed workout log by workoutId (for standalone/training workouts)
  // Also supports context-based query for programme workouts (enrollmentId, week, day)
  app.get('/api/workout-logs/completed-by-workout', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { workoutId, enrollmentId, week, day } = req.query;
      
      let log = null;
      
      // First try by workoutId if provided
      if (workoutId) {
        log = await storage.getCompletedWorkoutLogByWorkoutId(
          userId,
          parseInt(workoutId as string)
        );
      }
      
      // If not found by workoutId and context params are provided, try by context
      if (!log && enrollmentId && week && day) {
        log = await storage.getCompletedWorkoutLogByContext(
          userId,
          parseInt(enrollmentId as string),
          parseInt(week as string),
          parseInt(day as string)
        );
      }
      
      if (!log) {
        return res.json(null);
      }
      
      // Get exercises and sets for the log
      const exerciseLogs = await storage.getWorkoutExerciseLogs(log.id);
      const exercisesWithSets = await Promise.all(
        exerciseLogs.map(async (ex) => ({
          ...ex,
          sets: await storage.getWorkoutSetLogs(ex.id),
        }))
      );
      
      res.json({
        ...log,
        exercises: exercisesWithSets,
      });
    } catch (error) {
      console.error("Error fetching completed workout log:", error);
      res.status(500).json({ message: "Failed to fetch completed workout log" });
    }
  });

  // Get workout log by ID with all exercises and sets
  app.get('/api/workout-logs/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const log = await storage.getWorkoutLogById(id);
      
      if (!log) {
        return res.status(404).json({ message: "Workout log not found" });
      }
      
      const exerciseLogs = await storage.getWorkoutExerciseLogs(id);
      const exercisesWithSets = await Promise.all(
        exerciseLogs.map(async (ex) => ({
          ...ex,
          sets: await storage.getWorkoutSetLogs(ex.id),
        }))
      );
      
      // Enrich exercises with muxPlaybackId from exercise library
      const exerciseLibraryIds = exercisesWithSets
        .filter(ex => ex.exerciseLibraryId)
        .map(ex => ex.exerciseLibraryId as number);
      
      if (exerciseLibraryIds.length > 0) {
        const uniqueIds = [...new Set(exerciseLibraryIds)];
        const libraryMap = new Map<number, any>();
        
        for (const libId of uniqueIds) {
          const libEntry = await storage.getExerciseById(libId);
          if (libEntry) {
            libraryMap.set(libId, libEntry);
          }
        }
        
        // Add muxPlaybackId to each exercise
        for (const ex of exercisesWithSets) {
          if (ex.exerciseLibraryId && libraryMap.has(ex.exerciseLibraryId)) {
            const libEntry = libraryMap.get(ex.exerciseLibraryId);
            (ex as any).muxPlaybackId = libEntry.muxPlaybackId || null;
            if (!ex.imageUrl && libEntry.imageUrl) {
              (ex as any).imageUrl = libEntry.imageUrl;
            }
          }
        }
      }
      
      res.json({
        ...log,
        exercises: exercisesWithSets,
      });
    } catch (error) {
      console.error("Error fetching workout log:", error);
      res.status(500).json({ message: "Failed to fetch workout log" });
    }
  });

  // Get user's workout history
  app.get('/api/workout-logs', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await storage.getUserWorkoutLogs(userId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching workout logs:", error);
      res.status(500).json({ message: "Failed to fetch workout history" });
    }
  });

  // Update workout log (notes, etc.)
  app.patch('/api/workout-logs/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = { ...req.body };
      
      // Convert date strings to Date objects
      if (updates.startedAt && typeof updates.startedAt === 'string') {
        updates.startedAt = new Date(updates.startedAt);
      }
      if (updates.completedAt && typeof updates.completedAt === 'string') {
        updates.completedAt = new Date(updates.completedAt);
      }
      
      const updated = await storage.updateWorkoutLog(id, updates);
      res.json(updated);
    } catch (error) {
      console.error("Error updating workout log:", error);
      res.status(500).json({ message: "Failed to update workout log" });
    }
  });

  // Complete a workout with optional rating
  app.post('/api/workout-logs/:id/complete', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const { workoutRating } = req.body;
      
      console.log(`[WORKOUT COMPLETE] Starting completion for workout log id=${id}, rating=${workoutRating}`);
      
      let completed;
      // If rating provided, use the enhanced completion method with PR detection
      if (workoutRating !== undefined) {
        completed = await storage.completeWorkoutLogWithRating(id, workoutRating);
        console.log(`[WORKOUT COMPLETE] Successfully completed workout log id=${id}`);
      } else {
        // Legacy: complete without rating
        completed = await storage.completeWorkoutLog(id);
        console.log(`[WORKOUT COMPLETE] Successfully completed workout log id=${id} (no rating)`);
      }
      
      // Update user streak after workout completion (non-blocking)
      storage.updateUserStreak(userId).catch(err => {
        console.error(`[STREAK] Background update failed, will recalculate on next fetch:`, err?.message);
      });
      
      // Check and award eligible badges after workout completion
      try {
        const newBadges = await storage.checkUserBadgeEligibility(userId);
        if (newBadges.length > 0) {
          console.log(`[BADGE AWARDED] User ${userId} earned ${newBadges.length} badge(s): ${newBadges.map(b => b.name).join(', ')}`);
        }
      } catch (badgeError: any) {
        console.error(`[BADGE CHECK ERROR] Failed to check/award badges:`, badgeError?.message);
      }
      
      res.json(completed);
    } catch (error: any) {
      console.error(`[WORKOUT COMPLETE ERROR] id=${req.params.id}, error:`, error?.message || error);
      console.error("[WORKOUT COMPLETE ERROR] Stack:", error?.stack);
      res.status(500).json({ message: "Failed to complete workout", error: error?.message });
    }
  });

  // Cancel any active workout for the current user (clears stuck workouts)
  // NOTE: This route must come BEFORE /api/workout-logs/:id/cancel to avoid being matched by the parameterized route
  app.post('/api/workout-logs/cancel-active', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const activeLog = await storage.getActiveWorkoutLog(userId);
      
      if (activeLog) {
        await storage.cancelWorkoutLog(activeLog.id);
        res.json({ success: true, cancelledId: activeLog.id });
      } else {
        res.json({ success: true, message: "No active workout to cancel" });
      }
    } catch (error) {
      console.error("Error cancelling active workout:", error);
      res.status(500).json({ message: "Failed to cancel active workout" });
    }
  });

  // Cancel a specific workout by ID
  app.post('/api/workout-logs/:id/cancel', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.cancelWorkoutLog(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error cancelling workout:", error);
      res.status(500).json({ message: "Failed to cancel workout" });
    }
  });

  // Delete a workout log by ID (removes workout and all associated data)
  app.delete('/api/workout-logs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // Verify the log belongs to this user
      const log = await storage.getWorkoutLogById(id);
      if (!log) {
        return res.status(404).json({ message: "Workout log not found" });
      }
      if (log.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this workout log" });
      }
      
      await storage.deleteWorkoutLog(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting workout log:", error);
      res.status(500).json({ message: "Failed to delete workout log" });
    }
  });

  // Create a custom WOD (Workout of the Day)
  app.post('/api/workout-logs/custom', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const { date, workoutType, category, exercises, intervalRounds } = req.body;

      const categoryLabels: Record<string, string> = {
        workout: 'Workout of the Day',
        stretching: 'Stretching & Mobility',
        yoga: 'Yoga Session',
        corrective: 'Corrective Exercise',
      };

      // Calculate estimated duration based on exercises
      let estimatedDuration = 0;
      exercises.forEach((ex: any) => {
        const sets = ex.setsCount || 3;
        const restSeconds = parseInt(ex.restPeriod) || 60;
        estimatedDuration += sets * 45 + sets * restSeconds; // ~45s per set + rest
      });

      // Create the workout log with status 'pending' (not started yet)
      const workoutLog = await storage.createWorkoutLog({
        userId,
        workoutType: 'custom',
        workoutName: categoryLabels[category] || 'Workout of the Day',
        workoutStyle: workoutType || 'regular',
        status: 'pending',
        startedAt: new Date(date),
        duration: Math.round(estimatedDuration / 60), // Store in minutes
        intervalRounds: (workoutType === 'interval' || workoutType === 'circuit') ? (intervalRounds || 3) : null,
      });

      // Create exercise logs with their sets, maintaining section-based ordering
      const warmupExercises = exercises.filter((ex: any) => ex.section === 'warmup');
      const mainExercises = exercises.filter((ex: any) => ex.section !== 'warmup');
      
      // Process warm-up exercises first
      for (let i = 0; i < warmupExercises.length; i++) {
        const exercise = warmupExercises[i];
        
        const isTimedExercise = exercise.exerciseType === 'timed' || 
          exercise.exerciseType === 'timed_strength' || 
          exercise.exerciseType === 'general' || 
          exercise.exerciseType === 'cardio';
        const effectiveReps = isTimedExercise && exercise.exerciseType !== 'timed_strength' ? null : (exercise.targetReps || null);

        const exerciseLog = await storage.createWorkoutExerciseLog({
          workoutLogId: workoutLog.id,
          exerciseLibraryId: exercise.exerciseLibraryId,
          exerciseName: exercise.exerciseName,
          blockType: exercise.blockType || 'single',
          blockGroupId: exercise.blockGroupId || null,
          section: 'warmup',
          position: i,
          restPeriod: exercise.restPeriod || '60 sec',
          durationType: exercise.durationType || 'text',
          exerciseType: exercise.exerciseType || 'strength',
          kind: exercise.kind || 'exercise',
          restDuration: exercise.restDuration || null,
          targetDuration: exercise.targetDuration || null,
          targetReps: effectiveReps,
        });

        // Only create sets for exercises, not rest blocks
        if (exercise.kind !== 'rest') {
          const setsCount = exercise.setsCount || 3;
          for (let setNum = 1; setNum <= setsCount; setNum++) {
            await storage.createWorkoutSetLog({
              exerciseLogId: exerciseLog.id,
              setNumber: setNum,
              targetReps: effectiveReps,
              targetDuration: exercise.targetDuration || null,
            });
          }
        }
      }
      
      // Process main exercises
      // For interval workouts, assign positions so each circuit block gets a separate "block" (multiples of 10)
      // This allows the frontend to group exercises into circuits by Math.floor(position / 10)
      const isIntervalWod = workoutType === 'interval';
      const blockGroupToBlockIndex = new Map<string, number>();
      let currentBlockIndex = 0;
      let withinBlockIndex = 0;
      let lastBlockGroupId: string | null = null;
      
      for (let i = 0; i < mainExercises.length; i++) {
        const exercise = mainExercises[i];
        
        // For interval workouts, calculate position based on block groups
        let position = i;
        if (isIntervalWod) {
          // Use blockGroupId if present; otherwise use "ungrouped" to keep consecutive singles together
          const blockId = exercise.blockGroupId || 'ungrouped';
          
          // If this is a rest block, it starts a new circuit after it
          if (exercise.kind === 'rest') {
            // Rest block gets its own position at end of current block
            position = currentBlockIndex * 10 + withinBlockIndex;
            // Next block starts a new circuit
            currentBlockIndex++;
            withinBlockIndex = 0;
            lastBlockGroupId = null;
            blockGroupToBlockIndex.clear(); // Reset so same blockGroupId after rest starts fresh
          } else if (blockId !== 'ungrouped' && blockGroupToBlockIndex.has(blockId)) {
            // Subsequent exercise in same explicit block group - keep same block index
            position = blockGroupToBlockIndex.get(blockId)! * 10 + withinBlockIndex;
            withinBlockIndex++;
          } else if (blockId !== 'ungrouped') {
            // New explicit block group - check if we need to advance to a new circuit
            // Advance if coming from different explicit group OR from ungrouped exercises
            if (lastBlockGroupId !== null && lastBlockGroupId !== blockId) {
              // Different block group from last (including ungrouped->explicit), start new circuit
              currentBlockIndex++;
              withinBlockIndex = 0;
            }
            
            // First exercise in this explicit block group
            blockGroupToBlockIndex.set(blockId, currentBlockIndex);
            position = currentBlockIndex * 10 + withinBlockIndex;
            withinBlockIndex++;
            lastBlockGroupId = blockId;
          } else {
            // Ungrouped exercise - stays in current block unless previous was an explicit group
            if (lastBlockGroupId !== null && lastBlockGroupId !== 'ungrouped') {
              // Coming from explicit group to ungrouped, start new circuit
              currentBlockIndex++;
              withinBlockIndex = 0;
            }
            
            position = currentBlockIndex * 10 + withinBlockIndex;
            withinBlockIndex++;
            lastBlockGroupId = 'ungrouped';
          }
        }
        
        const isTimedMain = exercise.exerciseType === 'timed' || 
          exercise.exerciseType === 'timed_strength' || 
          exercise.exerciseType === 'general' || 
          exercise.exerciseType === 'cardio';
        const effectiveMainReps = isTimedMain && exercise.exerciseType !== 'timed_strength' ? null : (exercise.targetReps || null);

        const exerciseLog = await storage.createWorkoutExerciseLog({
          workoutLogId: workoutLog.id,
          exerciseLibraryId: exercise.exerciseLibraryId,
          exerciseName: exercise.exerciseName,
          blockType: exercise.blockType || 'single',
          blockGroupId: exercise.blockGroupId || null,
          section: 'main',
          position: position,
          restPeriod: exercise.restPeriod || '60 sec',
          durationType: exercise.durationType || 'text',
          exerciseType: exercise.exerciseType || 'strength',
          kind: exercise.kind || 'exercise',
          restDuration: exercise.restDuration || null,
          targetDuration: exercise.targetDuration || null,
          targetReps: effectiveMainReps,
        });

        // Only create sets for exercises, not rest blocks
        if (exercise.kind !== 'rest') {
          const setsCount = exercise.setsCount || 3;
          for (let setNum = 1; setNum <= setsCount; setNum++) {
            await storage.createWorkoutSetLog({
              exerciseLogId: exerciseLog.id,
              setNumber: setNum,
              targetReps: effectiveMainReps,
              targetDuration: exercise.targetDuration || null,
            });
          }
        }
      }

      res.status(201).json(workoutLog);
    } catch (error) {
      console.error("Error creating custom WOD:", error);
      res.status(500).json({ message: "Failed to create custom workout" });
    }
  });

  // Update a custom WOD
  app.patch('/api/workout-logs/custom/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { date, exercises, intervalRounds } = req.body;

      // Update the workout log date and intervalRounds if provided
      const updateData: any = {};
      if (date) {
        updateData.startedAt = new Date(date);
      }
      if (intervalRounds !== undefined) {
        updateData.intervalRounds = intervalRounds;
      }
      if (Object.keys(updateData).length > 0) {
        await storage.updateWorkoutLog(id, updateData);
      }

      // If exercises provided, delete existing and recreate with section-based ordering
      if (exercises && Array.isArray(exercises)) {
        // Get existing exercise logs and delete them
        const existingExercises = await storage.getWorkoutExerciseLogs(id);
        for (const ex of existingExercises) {
          await storage.deleteWorkoutExerciseLog(ex.id);
        }

        // Separate warm-up and main exercises
        const warmupExercises = exercises.filter((ex: any) => ex.section === 'warmup');
        const mainExercises = exercises.filter((ex: any) => ex.section !== 'warmup');

        // Create warm-up exercise logs
        for (let i = 0; i < warmupExercises.length; i++) {
          const exercise = warmupExercises[i];
          const isTimedWu = exercise.exerciseType === 'timed' || 
            exercise.exerciseType === 'timed_strength' || 
            exercise.exerciseType === 'general' || 
            exercise.exerciseType === 'cardio';
          const effectiveWuReps = isTimedWu && exercise.exerciseType !== 'timed_strength' ? null : (exercise.targetReps || null);
          
          const exerciseLog = await storage.createWorkoutExerciseLog({
            workoutLogId: id,
            exerciseLibraryId: exercise.exerciseLibraryId,
            exerciseName: exercise.exerciseName,
            blockType: exercise.blockType || 'single',
            blockGroupId: exercise.blockGroupId || null,
            section: 'warmup',
            position: i,
            restPeriod: exercise.restPeriod || '60 sec',
            durationType: exercise.durationType || 'text',
            exerciseType: exercise.exerciseType || 'strength',
            kind: exercise.kind || 'exercise',
            restDuration: exercise.restDuration || null,
            targetDuration: exercise.targetDuration || null,
            targetReps: effectiveWuReps,
          });

          if (exercise.kind !== 'rest') {
            const setsCount = exercise.setsCount || 3;
            for (let setNum = 1; setNum <= setsCount; setNum++) {
              await storage.createWorkoutSetLog({
                exerciseLogId: exerciseLog.id,
                setNumber: setNum,
                targetReps: effectiveWuReps,
                targetDuration: exercise.targetDuration || null,
              });
            }
          }
        }

        // Get workout style to determine position calculation
        const workoutLog = await storage.getWorkoutLogById(id);
        const isIntervalWod = workoutLog?.workoutStyle === 'interval';
        const blockGroupToBlockIndex = new Map<string, number>();
        let currentBlockIndex = 0;
        let withinBlockIndex = 0;
        let lastBlockGroupId: string | null = null;
        
        // Create main exercise logs
        for (let i = 0; i < mainExercises.length; i++) {
          const exercise = mainExercises[i];
          
          // For interval workouts, calculate position based on block groups
          let position = i;
          if (isIntervalWod) {
            // Use blockGroupId if present; otherwise use "ungrouped" to keep consecutive singles together
            const blockId = exercise.blockGroupId || 'ungrouped';
            
            // If this is a rest block, it starts a new circuit after it
            if (exercise.kind === 'rest') {
              // Rest block gets its own position at end of current block
              position = currentBlockIndex * 10 + withinBlockIndex;
              // Next block starts a new circuit
              currentBlockIndex++;
              withinBlockIndex = 0;
              lastBlockGroupId = null;
              blockGroupToBlockIndex.clear(); // Reset so same blockGroupId after rest starts fresh
            } else if (blockId !== 'ungrouped' && blockGroupToBlockIndex.has(blockId)) {
              // Subsequent exercise in same explicit block group - keep same block index
              position = blockGroupToBlockIndex.get(blockId)! * 10 + withinBlockIndex;
              withinBlockIndex++;
            } else if (blockId !== 'ungrouped') {
              // New explicit block group - check if we need to advance to a new circuit
              // Advance if coming from different explicit group OR from ungrouped exercises
              if (lastBlockGroupId !== null && lastBlockGroupId !== blockId) {
                // Different block group from last (including ungrouped->explicit), start new circuit
                currentBlockIndex++;
                withinBlockIndex = 0;
              }
              
              // First exercise in this explicit block group
              blockGroupToBlockIndex.set(blockId, currentBlockIndex);
              position = currentBlockIndex * 10 + withinBlockIndex;
              withinBlockIndex++;
              lastBlockGroupId = blockId;
            } else {
              // Ungrouped exercise - stays in current block unless previous was an explicit group
              if (lastBlockGroupId !== null && lastBlockGroupId !== 'ungrouped') {
                // Coming from explicit group to ungrouped, start new circuit
                currentBlockIndex++;
                withinBlockIndex = 0;
              }
              
              position = currentBlockIndex * 10 + withinBlockIndex;
              withinBlockIndex++;
              lastBlockGroupId = 'ungrouped';
            }
          }
          
          const isTimedMn = exercise.exerciseType === 'timed' || 
            exercise.exerciseType === 'timed_strength' || 
            exercise.exerciseType === 'general' || 
            exercise.exerciseType === 'cardio';
          const effectiveMnReps = isTimedMn && exercise.exerciseType !== 'timed_strength' ? null : (exercise.targetReps || null);

          const exerciseLog = await storage.createWorkoutExerciseLog({
            workoutLogId: id,
            exerciseLibraryId: exercise.exerciseLibraryId,
            exerciseName: exercise.exerciseName,
            blockType: exercise.blockType || 'single',
            blockGroupId: exercise.blockGroupId || null,
            section: 'main',
            position: position,
            restPeriod: exercise.restPeriod || '60 sec',
            durationType: exercise.durationType || 'text',
            exerciseType: exercise.exerciseType || 'strength',
            kind: exercise.kind || 'exercise',
            restDuration: exercise.restDuration || null,
            targetDuration: exercise.targetDuration || null,
            targetReps: effectiveMnReps,
          });

          if (exercise.kind !== 'rest') {
            const setsCount = exercise.setsCount || 3;
            for (let setNum = 1; setNum <= setsCount; setNum++) {
              await storage.createWorkoutSetLog({
                exerciseLogId: exerciseLog.id,
                setNumber: setNum,
                targetReps: effectiveMnReps,
                targetDuration: exercise.targetDuration || null,
              });
            }
          }
        }
      }

      const updated = await storage.getWorkoutLogById(id);
      res.json(updated);
    } catch (error) {
      console.error("Error updating custom WOD:", error);
      res.status(500).json({ message: "Failed to update custom workout" });
    }
  });

  // Delete a custom WOD
  app.delete('/api/workout-logs/custom/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.cancelWorkoutLog(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting custom WOD:", error);
      res.status(500).json({ message: "Failed to delete custom workout" });
    }
  });

  // Save a completed custom workout to user's personal library
  app.post('/api/workout-logs/:id/save', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const logId = parseInt(req.params.id);
      const { name } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: "Workout name is required" });
      }
      if (name.trim().length > 100) {
        return res.status(400).json({ message: "Workout name must be 100 characters or less" });
      }

      const workoutLog = await storage.getWorkoutLogById(logId);
      if (!workoutLog) {
        return res.status(404).json({ message: "Workout log not found" });
      }
      if (workoutLog.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (workoutLog.workoutType !== 'custom') {
        return res.status(400).json({ message: "Only custom workouts can be saved" });
      }

      const exerciseLogs = await storage.getWorkoutExerciseLogs(logId);
      const exercisesWithSets = await Promise.all(
        exerciseLogs.map(async (ex: any) => ({
          ...ex,
          sets: await storage.getWorkoutSetLogs(ex.id),
        }))
      );

      const exerciseNames = exercisesWithSets
        .filter((e: any) => e.kind !== 'rest')
        .map((e: any) => e.exerciseName);
      const equipmentSet = new Set<string>();
      for (const ex of exercisesWithSets) {
        if (ex.exerciseLibraryId) {
          try {
            const libEx = await storage.getExerciseById(ex.exerciseLibraryId);
            if (libEx?.equipment) {
              libEx.equipment.forEach((eq: string) => equipmentSet.add(eq));
            }
          } catch {}
        }
      }

      let category = 'strength';
      let difficulty = 'intermediate';
      let duration = workoutLog.duration ? Math.round(workoutLog.duration / 60) : 30;

      try {
        const { getFeatureConfig, analyzeText } = await import('./aiProvider');
        const config = await getFeatureConfig('recovery_coach');
        if (config) {
          const prompt = `Analyze this workout and return ONLY a JSON object with category, difficulty, and estimated duration. No other text.

Exercises: ${exerciseNames.join(', ')}
Workout style: ${workoutLog.workoutStyle || 'regular'}
Total exercises: ${exerciseNames.length}
${workoutLog.duration ? `Actual duration: ${Math.round(workoutLog.duration / 60)} minutes` : ''}

Return format: {"category": "strength|cardio|hiit|mobility|recovery", "difficulty": "beginner|intermediate|advanced", "duration": <minutes>}`;

          const aiResult = await analyzeText({ prompt, maxTokens: 100 }, config.provider, config.model);
          const jsonMatch = aiResult.text.match(/\{[^}]+\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.category) category = parsed.category;
            if (parsed.difficulty) difficulty = parsed.difficulty;
            if (parsed.duration) duration = parsed.duration;
          }
        }
      } catch (aiErr) {
        console.log("AI analysis failed, using defaults:", aiErr);
      }

      const savedWorkout = await storage.createWorkout({
        title: name.trim(),
        category,
        duration,
        difficulty,
        equipment: Array.from(equipmentSet),
        routineType: 'workout',
        workoutType: workoutLog.workoutStyle || 'regular',
        intervalRounds: workoutLog.intervalRounds || null,
        intervalRestAfterRound: workoutLog.intervalRestAfterRound || null,
        userId,
        sourceType: 'user',
      });

      const warmupExercises = exercisesWithSets.filter((e: any) => e.section === 'warmup');
      const mainExercises = exercisesWithSets.filter((e: any) => e.section !== 'warmup');

      const formatRestForBlock = (rest: string | null | undefined): string => {
        if (!rest || rest === 'none') return 'none';
        const match = rest.match(/(\d+)\s*(s|sec|m|min)?/i);
        if (!match) return rest;
        const val = parseInt(match[1]);
        const unit = (match[2] || 's').toLowerCase();
        const seconds = unit.startsWith('m') ? val * 60 : val;
        if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60}m`;
        return `${seconds} sec`;
      };

      const createBlocksFromExercises = async (exercises: any[], section: string) => {
        const orderedItems: { type: 'single', ex: any }[] | { type: 'group', groupId: string, exercises: any[] }[] = [];
        const seenGroups = new Set<string>();
        const tempItems: any[] = [];

        for (const ex of exercises) {
          if (ex.blockType === 'single' || !ex.blockGroupId) {
            tempItems.push({ type: 'single' as const, ex });
          } else {
            if (!seenGroups.has(ex.blockGroupId)) {
              seenGroups.add(ex.blockGroupId);
              const groupExercises = exercises.filter(e => e.blockGroupId === ex.blockGroupId);
              tempItems.push({ type: 'group' as const, groupId: ex.blockGroupId, exercises: groupExercises });
            }
          }
        }

        let blockPos = 0;

        for (const item of tempItems) {
          if (item.type === 'single') {
            const ex = item.ex;
            const block = await storage.createWorkoutBlock({
              workoutId: savedWorkout.id,
              section,
              blockType: 'single',
              position: blockPos++,
              rest: formatRestForBlock(ex.restPeriod),
            });

            const setsData = ex.sets.map((s: any) => ({
              reps: s.targetReps || s.actualReps?.toString() || '10',
              duration: s.targetDuration || undefined,
            }));

            await storage.createBlockExercise({
              blockId: block.id,
              exerciseLibraryId: ex.exerciseLibraryId || null,
              position: 0,
              sets: setsData.length > 0 ? setsData : [{ reps: '10' }],
              durationType: ex.durationType || 'text',
            });
          } else {
            const groupExercises = item.exercises;
            const firstEx = groupExercises[0];
            const block = await storage.createWorkoutBlock({
              workoutId: savedWorkout.id,
              section,
              blockType: firstEx.blockType || 'superset',
              position: blockPos++,
              rest: formatRestForBlock(firstEx.restPeriod),
            });

            for (let i = 0; i < groupExercises.length; i++) {
              const ex = groupExercises[i];
              const setsData = ex.sets.map((s: any) => ({
                reps: s.targetReps || s.actualReps?.toString() || '10',
                duration: s.targetDuration || undefined,
              }));

              await storage.createBlockExercise({
                blockId: block.id,
                exerciseLibraryId: ex.exerciseLibraryId || null,
                position: i,
                sets: setsData.length > 0 ? setsData : [{ reps: '10' }],
                durationType: ex.durationType || 'text',
              });
            }
          }
        }
      };

      await createBlocksFromExercises(warmupExercises, 'warmup');
      await createBlocksFromExercises(mainExercises, 'main');

      res.status(201).json(savedWorkout);
    } catch (error) {
      console.error("Error saving workout:", error);
      res.status(500).json({ message: "Failed to save workout" });
    }
  });

  // Get exercises for a workout log
  app.get('/api/workout-logs/:logId/exercises', isAuthenticated, async (req, res) => {
    try {
      const logId = parseInt(req.params.logId);
      const exerciseLogs = await storage.getWorkoutExerciseLogs(logId);
      const exercisesWithSets = await Promise.all(
        exerciseLogs.map(async (ex) => ({
          ...ex,
          sets: await storage.getWorkoutSetLogs(ex.id),
        }))
      );
      res.json(exercisesWithSets);
    } catch (error) {
      console.error("Error getting workout exercises:", error);
      res.status(500).json({ message: "Failed to get exercises" });
    }
  });

  // Add exercise to workout log
  app.post('/api/workout-logs/:logId/exercises', isAuthenticated, async (req, res) => {
    try {
      const logId = parseInt(req.params.logId);
      const exerciseData = req.body;
      
      const exerciseLog = await storage.createWorkoutExerciseLog({
        workoutLogId: logId,
        ...exerciseData,
      });
      
      // Create set logs based on provided sets
      if (exerciseData.sets && Array.isArray(exerciseData.sets)) {
        const setLogs = await Promise.all(
          exerciseData.sets.map(async (set: any, index: number) => {
            return storage.createWorkoutSetLog({
              exerciseLogId: exerciseLog.id,
              setNumber: index + 1,
              targetReps: set.reps || null,
              targetDuration: set.duration || null,
            });
          })
        );
        
        res.status(201).json({
          ...exerciseLog,
          sets: setLogs,
        });
      } else {
        res.status(201).json(exerciseLog);
      }
    } catch (error) {
      console.error("Error adding exercise to workout log:", error);
      res.status(500).json({ message: "Failed to add exercise" });
    }
  });

  // Update exercise log
  app.patch('/api/exercise-logs/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateWorkoutExerciseLog(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating exercise log:", error);
      res.status(500).json({ message: "Failed to update exercise log" });
    }
  });

  // Delete exercise log
  app.delete('/api/exercise-logs/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteWorkoutExerciseLog(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting exercise log:", error);
      res.status(500).json({ message: "Failed to delete exercise log" });
    }
  });

  // Update a set log (record actual reps/weight/time)
  app.patch('/api/set-logs/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateWorkoutSetLog(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating set log:", error);
      res.status(500).json({ message: "Failed to update set log" });
    }
  });

  // Bulk update set logs
  app.patch('/api/set-logs/bulk', isAuthenticated, async (req, res) => {
    try {
      const { updates } = req.body; // Array of { id, updates }
      const results = await storage.bulkUpdateWorkoutSetLogs(updates);
      res.json(results);
    } catch (error) {
      console.error("Error bulk updating set logs:", error);
      res.status(500).json({ message: "Failed to update sets" });
    }
  });

  // Delete a set log
  app.delete('/api/set-logs/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteWorkoutSetLog(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting set log:", error);
      res.status(500).json({ message: "Failed to delete set" });
    }
  });

  // Add a new set to an exercise
  app.post('/api/exercise-logs/:exerciseLogId/sets', isAuthenticated, async (req, res) => {
    try {
      const exerciseLogId = parseInt(req.params.exerciseLogId);
      const { targetReps, targetDuration, setNumber, initialData } = req.body;
      
      // Get current sets to determine next set number if not provided
      let finalSetNumber = setNumber;
      if (!finalSetNumber) {
        const currentSets = await storage.getWorkoutSetLogs(exerciseLogId);
        finalSetNumber = currentSets.length + 1;
      }
      
      const setLog = await storage.createWorkoutSetLog({
        exerciseLogId,
        setNumber: finalSetNumber,
        targetReps: targetReps || null,
        targetDuration: targetDuration || null,
        actualReps: initialData?.actualReps || null,
        actualWeight: initialData?.actualWeight || null,
        actualDuration: initialData?.actualDuration || null,
      });
      
      res.status(201).json(setLog);
    } catch (error) {
      console.error("Error adding set:", error);
      res.status(500).json({ message: "Failed to add set" });
    }
  });

  // Get previous performance for an exercise
  app.get('/api/exercises/:exerciseId/previous-performance', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const exerciseId = parseInt(req.params.exerciseId);
      const previous = await storage.getPreviousExercisePerformance(userId, exerciseId);
      res.json(previous);
    } catch (error) {
      console.error("Error fetching previous performance:", error);
      res.status(500).json({ message: "Failed to fetch previous performance" });
    }
  });

  // Video routes
  app.get('/api/videos', async (req, res) => {
    try {
      const { category } = req.query;
      const videos = await storage.getVideos(category as string);
      res.json(videos);
    } catch (error) {
      console.error("Error fetching videos:", error);
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  });

  app.get('/api/videos/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const video = await storage.getVideoById(id);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      res.json(video);
    } catch (error) {
      console.error("Error fetching video:", error);
      res.status(500).json({ message: "Failed to fetch video" });
    }
  });

  // Recipe routes
  app.get('/api/recipes', async (req, res) => {
    try {
      const { category } = req.query;
      const recipes = await storage.getRecipes(category as string);
      res.json(recipes);
    } catch (error) {
      console.error("Error fetching recipes:", error);
      res.status(500).json({ message: "Failed to fetch recipes" });
    }
  });

  app.get('/api/recipes/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const recipe = await storage.getRecipeById(id);
      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      res.json(recipe);
    } catch (error) {
      console.error("Error fetching recipe:", error);
      res.status(500).json({ message: "Failed to fetch recipe" });
    }
  });

  // User progress routes
  app.get('/api/progress', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const progress = await storage.getUserProgress(userId);
      res.json(progress);
    } catch (error) {
      console.error("Error fetching progress:", error);
      res.status(500).json({ message: "Failed to fetch progress" });
    }
  });

  app.post('/api/progress', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const progressData = insertUserProgressSchema.parse({
        ...req.body,
        userId,
      });
      const progress = await storage.createUserProgress(progressData);
      res.json(progress);
    } catch (error) {
      console.error("Error creating progress:", error);
      res.status(500).json({ message: "Failed to create progress" });
    }
  });

  app.get('/api/progress/latest', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const progress = await storage.getLatestUserProgress(userId);
      res.json(progress);
    } catch (error) {
      console.error("Error fetching latest progress:", error);
      res.status(500).json({ message: "Failed to fetch latest progress" });
    }
  });

  // Check-in routes
  app.get('/api/check-ins', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const checkIns = await storage.getUserCheckIns(userId);
      res.json(checkIns);
    } catch (error) {
      console.error("Error fetching check-ins:", error);
      res.status(500).json({ message: "Failed to fetch check-ins" });
    }
  });

  app.post('/api/check-ins', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const checkInData = insertCheckInSchema.parse({
        ...req.body,
        userId,
      });
      const checkIn = await storage.createCheckIn(checkInData);
      res.json(checkIn);
    } catch (error) {
      console.error("Error creating check-in:", error);
      res.status(500).json({ message: "Failed to create check-in" });
    }
  });

  app.get('/api/check-ins/latest', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const checkIn = await storage.getLatestCheckIn(userId);
      res.json(checkIn);
    } catch (error) {
      console.error("Error fetching latest check-in:", error);
      res.status(500).json({ message: "Failed to fetch latest check-in" });
    }
  });

  // Body map routes
  app.get('/api/body-map', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const logs = await storage.getBodyMapLogs(userId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching body map logs:", error);
      res.status(500).json({ message: "Failed to fetch body map logs" });
    }
  });

  // Reassessment reminders - get due reminders for dashboard
  app.get('/api/reassessment-reminders/due', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const reminders = await storage.getDueReassessmentReminders(userId);
      res.json(reminders);
    } catch (error) {
      console.error("Error fetching due reminders:", error);
      res.status(500).json({ message: "Failed to fetch due reminders" });
    }
  });

  // Get all scheduled reminders for calendar view
  app.get('/api/reassessment-reminders/all', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const reminders = await storage.getAllReassessmentReminders(userId);
      res.json(reminders);
    } catch (error) {
      console.error("Error fetching all reminders:", error);
      res.status(500).json({ message: "Failed to fetch all reminders" });
    }
  });

  // Get reminders for a specific date (for calendar navigation)
  app.get('/api/reassessment-reminders/on-date', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { date } = req.query;
      
      if (!date) {
        return res.status(400).json({ message: "Date parameter is required" });
      }
      
      const targetDate = new Date(date as string);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      
      const reminders = await storage.getRemindersForDate(userId, targetDate);
      res.json(reminders);
    } catch (error) {
      console.error("Error fetching reminders for date:", error);
      res.status(500).json({ message: "Failed to fetch reminders for date" });
    }
  });

  // Check if user has an active Body Map issue with Programme Impact
  // Used for post-enrolment safety check
  app.get('/api/body-map/active-issue', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get user's latest body map log
      const logs = await storage.getBodyMapLogs(userId);
      if (!logs || logs.length === 0) {
        return res.json({ active: false });
      }
      
      // Get the most recent log
      const latestLog = logs[0];
      
      // Check if the log represents a "cleared" state (severity 0 means cleared)
      if (latestLog.severity === 0) {
        return res.json({ active: false });
      }
      
      // Look up the body area to find the matched outcome
      const bodyArea = await storage.getBodyMapAreaByName(latestLog.bodyPart);
      if (!bodyArea) {
        return res.json({ active: false });
      }
      
      // Find the matching outcome for this body map state
      const matchedOutcome = await storage.findMatchingOutcome(
        bodyArea.id,
        latestLog.severity,
        latestLog.trainingImpact || null,
        latestLog.movementImpact || null
      );
      
      if (!matchedOutcome) {
        return res.json({ active: false });
      }
      
      // Check if the outcome has Programme Impact enabled
      // Programme Impact is shown when: showProgrammeImpact is true AND (flagging patterns exist OR substitute exercises exist)
      const hasFlag = matchedOutcome.showProgrammeImpact === true;
      const flaggingPatterns = matchedOutcome.flaggingMovementPatterns || [];
      const flaggingEquipment = matchedOutcome.flaggingEquipment || [];
      const flaggingLevel = matchedOutcome.flaggingLevel || [];
      const poolData = matchedOutcome.substitutionRules as any;
      const substitutionPool = Array.isArray(poolData) ? poolData[0] : poolData;
      const substituteExerciseIds: number[] = substitutionPool?.substituteExerciseIds || [];
      
      const hasFlaggingRules = flaggingPatterns.length > 0 || flaggingEquipment.length > 0 || flaggingLevel.length > 0;
      const hasSubstituteExercises = substituteExerciseIds.length > 0;
      
      const hasProgrammeImpact = hasFlag && (hasFlaggingRules || hasSubstituteExercises);
      
      if (!hasProgrammeImpact) {
        return res.json({ active: false });
      }
      
      // Active issue found
      return res.json({
        active: true,
        outcomeId: matchedOutcome.id,
        bodyMapLogId: latestLog.id,
        bodyArea: latestLog.bodyPart,
        severity: latestLog.severity
      });
    } catch (error) {
      console.error("Error checking active body map issue:", error);
      res.status(500).json({ message: "Failed to check active body map issue" });
    }
  });

  app.post('/api/body-map', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const logData = insertBodyMapLogSchema.parse({
        ...req.body,
        userId,
      });
      const log = await storage.createBodyMapLog(logData);

      // Look up body area by name to get the ID
      const bodyArea = await storage.getBodyMapAreaByName(log.bodyPart);
      
      // Find matching outcome from database configuration (primary source for flagging patterns)
      let matchedOutcome = null;
      let flaggingMovementPatterns: string[] = [];
      
      if (bodyArea) {
        matchedOutcome = await storage.findMatchingOutcome(
          bodyArea.id,
          log.severity,
          log.trainingImpact || null,
          log.movementImpact || null
        );

        // Get flagging movement patterns from matched outcome
        if (matchedOutcome && matchedOutcome.flaggingMovementPatterns) {
          flaggingMovementPatterns = matchedOutcome.flaggingMovementPatterns as string[];
        }
      }

      // Find matching recovery template from database configuration (for recovery plan content)
      const answers = (log.answers as Record<number, string>) || {};
      const template = await storage.findMatchingRecoveryTemplate(
        log.bodyPart,
        log.severity,
        answers
      );

      // Use template data if found, otherwise use fallback
      let planTitle = "General Recovery Protocol";
      let planDescription = `A recovery plan designed to address discomfort in ${log.bodyPart}.`;
      let rootCauses: string[] = [
        "Muscle imbalance or weakness in surrounding areas",
        "Overuse or excessive training volume",
        "Limited mobility or range of motion"
      ];
      let recommendedStretches: string[] = [
        "Gentle stretching of the affected area - 2x30 seconds",
        "Foam rolling surrounding muscles - 2 minutes",
        "Full body mobility routine daily"
      ];
      let movementsToAvoid: string[] = [
        "Exercises that directly stress the affected area",
        "High-intensity or high-volume training",
        "Movements that cause sharp or shooting pain"
      ];
      let movementsToModify: string[] = [
        "Reduce weight by 30-50% on affected exercises",
        "Limit range of motion to pain-free zone",
        "Focus on controlled, slow tempo movements"
      ];
      let generalRecommendations: string[] = [
        "Monitor symptoms and adjust training accordingly",
        "Apply ice or heat as needed for comfort",
        "Prioritize recovery and sleep",
        "Maintain hydration and proper nutrition"
      ];

      if (template) {
        planTitle = template.planTitle;
        planDescription = template.planDescription;
        rootCauses = template.rootCauses || rootCauses;
        recommendedStretches = template.recommendedStretches || recommendedStretches;
        movementsToAvoid = template.movementsToAvoid || movementsToAvoid;
        movementsToModify = template.movementsToModify || movementsToModify;
        generalRecommendations = template.generalRecommendations || generalRecommendations;
      }

      // Add severity-based recommendations
      const severityRecommendations = [];
      if (log.severity >= 7) {
        severityRecommendations.push("Consider complete rest for 24-48 hours to allow initial healing");
        severityRecommendations.push("Consult with a healthcare professional if pain persists beyond 72 hours");
        severityRecommendations.push("Avoid ALL exercises involving the affected area temporarily");
      } else if (log.severity >= 4) {
        severityRecommendations.push("Reduce training volume by 50% for the next 3-5 days");
        severityRecommendations.push("Focus on pain-free movements only");
      } else {
        severityRecommendations.push("Continue training with modifications listed below");
        severityRecommendations.push("Monitor daily - if pain increases, reduce intensity further");
      }

      const recoveryPlanSuggestion = await storage.createRecoveryPlanSuggestion({
        bodyMapLogId: log.id,
        userId,
        bodyPart: log.bodyPart,
        severity: log.severity,
        planTitle,
        planDescription,
        rootCauses,
        recommendedStretches,
        movementsToAvoid,
        movementsToModify,
        relatedVideoIds: [],
        generalRecommendations: [...severityRecommendations, ...generalRecommendations],
        status: "pending"
      });

      // Generate program modifications if user has an active program and outcome has flagging patterns
      const modifications = await generateProgramModifications(
        userId,
        log.bodyPart,
        log.severity,
        recoveryPlanSuggestion.id,
        flaggingMovementPatterns
      );

      // Save modifications
      for (const mod of modifications) {
        await storage.createProgramModificationSuggestion(mod);
      }

      // Step: Handle reassessment reminders
      // Use normalized body area name (ID format) for consistent matching
      const normalizedAreaName = bodyArea?.name || log.bodyPart.toLowerCase().replace(/\s+/g, '_');
      
      // Store matchedOutcomeId and reassessmentDays on the log for future reference
      const reassessmentDays = matchedOutcome?.reassessInDays || null;
      if (matchedOutcome || reassessmentDays) {
        await storage.updateBodyMapLog(log.id, {
          matchedOutcomeId: matchedOutcome?.id || null,
          reassessmentDays: reassessmentDays,
        });
      }
      
      // 1. Complete any existing reminders for this body area (new assessment = reminder completed)
      await storage.completeReassessmentReminders(userId, normalizedAreaName, log.id);
      
      // 2. Create a new reminder if the matched outcome has reassessInDays set
      let reminderCreated = false;
      if (matchedOutcome?.reassessInDays) {
        const dueAt = new Date();
        dueAt.setDate(dueAt.getDate() + matchedOutcome.reassessInDays);
        
        await storage.createReassessmentReminder({
          userId,
          bodyArea: normalizedAreaName,
          outcomeId: matchedOutcome.id,
          bodyMapLogId: log.id,
          assessedAt: new Date(),
          dueAt,
          status: 'scheduled',
        });
        reminderCreated = true;
      }

      res.json({
        ...log,
        recoveryPlanId: recoveryPlanSuggestion.id,
        hasModifications: modifications.length > 0,
        matchedOutcomeId: matchedOutcome?.id || null,
        reminderCreated,
        reminderDueAt: matchedOutcome?.reassessInDays ? new Date(Date.now() + matchedOutcome.reassessInDays * 24 * 60 * 60 * 1000) : null
      });
    } catch (error) {
      console.error("Error creating body map log:", error);
      res.status(500).json({ message: "Failed to create body map log" });
    }
  });

  app.delete('/api/body-map/:bodyPart', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { bodyPart } = req.params;
      const { view } = req.query;
      
      if (!view) {
        return res.status(400).json({ message: "View parameter is required" });
      }
      
      await storage.deleteBodyMapLog(userId, bodyPart, view as string);
      res.json({ message: "Body map log deleted successfully" });
    } catch (error) {
      console.error("Error deleting body map log:", error);
      res.status(500).json({ message: "Failed to delete body map log" });
    }
  });

  app.delete('/api/body-map/log/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      await storage.deleteBodyMapLogById(userId, id);
      res.json({ message: "Assessment deleted successfully" });
    } catch (error) {
      console.error("Error deleting body map assessment:", error);
      res.status(500).json({ message: "Failed to delete assessment" });
    }
  });

  // Body Map V1 - Simplified assessment endpoint
  app.post('/api/body-map/v1', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const bodyMapV1Schema = insertBodyMapLogSchema.pick({
        bodyPart: true,
        severity: true,
        side: true,
        movementImpact: true,
        trainingImpact: true,
        primaryTrigger: true,
      }).extend({
        duration: z.string().optional(),
      });
      
      const validatedData = bodyMapV1Schema.parse(req.body);
      
      const log = await storage.createBodyMapLog({
        userId,
        bodyPart: validatedData.bodyPart,
        severity: validatedData.severity,
        side: validatedData.side,
        movementImpact: validatedData.movementImpact,
        trainingImpact: validatedData.trainingImpact,
        primaryTrigger: validatedData.primaryTrigger,
        duration: validatedData.duration,
        view: "front",
        x: null,
        y: null,
      });
      
      res.json(log);
    } catch (error: any) {
      console.error("Error creating body map V1 log:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create body map assessment" });
    }
  });

  // Recovery plan routes
  app.get('/api/recovery-plans/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      const plan = await storage.getRecoveryPlanById(parseInt(id));
      if (!plan || plan.userId !== userId) {
        return res.status(404).json({ message: "Recovery plan not found" });
      }

      const modifications = await storage.getProgramModificationsByRecoveryPlan(plan.id);
      
      res.json({
        ...plan,
        modifications
      });
    } catch (error) {
      console.error("Error fetching recovery plan:", error);
      res.status(500).json({ message: "Failed to fetch recovery plan" });
    }
  });

  app.post('/api/recovery-plans/:id/accept-all', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      const plan = await storage.getRecoveryPlanById(parseInt(id));
      if (!plan || plan.userId !== userId) {
        return res.status(404).json({ message: "Recovery plan not found" });
      }

      // Update plan status to accepted
      await storage.updateRecoveryPlanStatus(plan.id, 'accepted');

      // Update all modifications to accepted
      await storage.updateAllModificationStatuses(plan.id, 'accepted');

      // Apply the accepted modifications
      await storage.applyAcceptedModifications(userId, plan.id);

      res.json({ message: "Recovery plan and all modifications accepted and applied" });
    } catch (error) {
      console.error("Error accepting recovery plan:", error);
      res.status(500).json({ message: "Failed to accept recovery plan" });
    }
  });

  app.post('/api/recovery-plans/:id/reject-all', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      const plan = await storage.getRecoveryPlanById(parseInt(id));
      if (!plan || plan.userId !== userId) {
        return res.status(404).json({ message: "Recovery plan not found" });
      }

      // Update plan status to rejected
      await storage.updateRecoveryPlanStatus(plan.id, 'rejected');

      // Update all modifications to rejected
      await storage.updateAllModificationStatuses(plan.id, 'rejected');

      res.json({ message: "Recovery plan and all modifications rejected" });
    } catch (error) {
      console.error("Error rejecting recovery plan:", error);
      res.status(500).json({ message: "Failed to reject recovery plan" });
    }
  });

  // Program modification routes
  app.put('/api/program-modifications/:id/accept', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      const modification = await storage.getProgramModificationById(parseInt(id));
      if (!modification || modification.userId !== userId) {
        return res.status(404).json({ message: "Modification not found" });
      }

      const updated = await storage.updateProgramModificationStatus(modification.id, 'accepted');
      res.json(updated);
    } catch (error) {
      console.error("Error accepting modification:", error);
      res.status(500).json({ message: "Failed to accept modification" });
    }
  });

  app.put('/api/program-modifications/:id/reject', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      const modification = await storage.getProgramModificationById(parseInt(id));
      if (!modification || modification.userId !== userId) {
        return res.status(404).json({ message: "Modification not found" });
      }

      const updated = await storage.updateProgramModificationStatus(modification.id, 'rejected');
      res.json(updated);
    } catch (error) {
      console.error("Error rejecting modification:", error);
      res.status(500).json({ message: "Failed to reject modification" });
    }
  });

  app.post('/api/recovery-plans/:id/apply', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      const plan = await storage.getRecoveryPlanById(parseInt(id));
      if (!plan || plan.userId !== userId) {
        return res.status(404).json({ message: "Recovery plan not found" });
      }

      // Apply accepted modifications
      await storage.applyAcceptedModifications(userId, plan.id);

      // Update plan status
      await storage.updateRecoveryPlanStatus(plan.id, 'accepted');

      res.json({ message: "Accepted modifications applied successfully" });
    } catch (error) {
      console.error("Error applying modifications:", error);
      res.status(500).json({ message: "Failed to apply modifications" });
    }
  });

  // Accept or decline a recovery plan (separate from programme modifications)
  // This only updates the recovery plan status and optionally enrolls in recovery programme
  app.post('/api/recovery-plan-decision', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { recoveryPlanId, decision } = req.body;
      
      if (!recoveryPlanId) {
        return res.status(400).json({ message: "Recovery plan ID is required" });
      }
      
      if (!decision || !['accepted', 'declined'].includes(decision)) {
        return res.status(400).json({ message: "Decision must be 'accepted' or 'declined'" });
      }

      const plan = await storage.getRecoveryPlanById(recoveryPlanId);
      if (!plan || plan.userId !== userId) {
        return res.status(404).json({ message: "Recovery plan not found" });
      }

      // Update plan status
      await storage.updateRecoveryPlanStatus(plan.id, decision);

      // If accepted, enroll in recovery programme if one is recommended
      let recoveryEnrolled = false;
      if (decision === 'accepted') {
        // Look up the matched outcome from the body map log to get the recovery programme
        if (plan.bodyMapLogId) {
          const bodyMapLog = await storage.getBodyMapLogById(plan.bodyMapLogId);
          if (bodyMapLog) {
            const bodyArea = await storage.getBodyMapAreaByName(bodyMapLog.bodyPart);
            if (bodyArea) {
              const matchedOutcome = await storage.findMatchingOutcome(
                bodyArea.id,
                bodyMapLog.severity,
                bodyMapLog.trainingImpact || null,
                bodyMapLog.movementImpact || null
              );
              
              if (matchedOutcome && matchedOutcome.recommendRecoveryProgramme && matchedOutcome.recoveryProgrammeId) {
                // Check if already enrolled
                const allEnrollments = await storage.getUserEnrolledPrograms(userId);
                const existingEnrollment = allEnrollments.find(
                  e => e.programId === matchedOutcome.recoveryProgrammeId && e.status === 'active'
                );
                
                if (!existingEnrollment) {
                  await storage.enrollUserInProgram(
                    userId,
                    matchedOutcome.recoveryProgrammeId,
                    new Date(),
                    'supplementary'
                  );
                  recoveryEnrolled = true;
                }
              }
            }
          }
        }
      }

      res.json({ 
        success: true, 
        status: decision,
        recoveryEnrolled
      });
    } catch (error) {
      console.error("Error processing recovery plan decision:", error);
      res.status(500).json({ message: "Failed to process recovery plan decision" });
    }
  });

  // Get user's latest pending recovery plan with modifications count (for Body Map results page)
  app.get('/api/recovery-plans/pending', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get user's recovery plans that are pending (ordered by most recent)
      const plans = await storage.getRecoveryPlansByUser(userId);
      const pendingPlans = plans.filter(p => p.status === 'pending');
      
      // Find the first pending plan that actually has pending modifications
      for (const plan of pendingPlans) {
        const modifications = await storage.getProgramModificationsByRecoveryPlan(plan.id);
        const pendingModifications = modifications.filter(m => m.status === 'pending');
        
        if (pendingModifications.length > 0) {
          return res.json({
            hasPendingPlan: true,
            recoveryPlanId: plan.id,
            modificationsCount: pendingModifications.length,
            planTitle: plan.planTitle
          });
        }
      }
      
      // No pending plans with pending modifications found
      return res.json({ hasPendingPlan: false, recoveryPlanId: null, modificationsCount: 0 });
    } catch (error) {
      console.error("Error fetching pending recovery plan:", error);
      res.status(500).json({ message: "Failed to fetch pending recovery plan" });
    }
  });

  // Programme Modification Routes - Accept/Decline modifications based on body map outcomes

  // Preview flagged exercises for an outcome (for user selection UI)
  // Supports optional enrollmentId param to target a specific enrollment (used in post-enrolment flow)
  app.post('/api/programme-modifications/preview', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { outcomeId, enrollmentId } = req.body;
      
      if (!outcomeId) {
        return res.status(400).json({ message: "Outcome ID is required" });
      }

      let targetEnrollment;
      
      // If enrollmentId is provided, use that specific enrollment
      // Otherwise, fall back to the user's current active main enrollment (existing behavior)
      if (enrollmentId) {
        const enrollment = await storage.getEnrollmentById(enrollmentId);
        if (!enrollment || enrollment.userId !== userId) {
          return res.status(404).json({ message: "Enrollment not found", flaggedExercises: [], substituteOptions: [] });
        }
        targetEnrollment = enrollment;
      } else {
        // Get the user's main active programme enrollment (existing behavior)
        const enrollments = await storage.getUserEnrolledPrograms(userId);
        const mainEnrollment = enrollments.find(e => e.programType === 'main' && e.status === 'active');
        
        if (!mainEnrollment) {
          return res.status(404).json({ message: "No active main programme found", flaggedExercises: [], substituteOptions: [] });
        }
        targetEnrollment = mainEnrollment;
      }

      // Get the outcome
      const outcome = await storage.getBodyMapOutcomeById(outcomeId);
      if (!outcome) {
        return res.status(404).json({ message: "Outcome not found" });
      }

      // Get the programme
      const program = await storage.getProgramById(targetEnrollment.programId);
      if (!program) {
        return res.status(404).json({ message: "Programme not found" });
      }

      // Get flagging rules
      const flaggingPatterns = outcome.flaggingMovementPatterns || [];
      const flaggingEquipment = outcome.flaggingEquipment || [];
      const flaggingLevel = outcome.flaggingLevel || [];

      // Get substitution pool
      const poolData = outcome.substitutionRules as any;
      const substitutionPool = Array.isArray(poolData) ? poolData[0] : poolData;
      const substituteExerciseIds: number[] = substitutionPool?.substituteExerciseIds || [];

      // Get all exercises
      const allExercises = await storage.getExercises();
      const exerciseMap = new Map(allExercises.map(e => [e.id, e]));

      // Build substitute options (curated list in coach order)
      const substituteOptions = substituteExerciseIds
        .map(id => exerciseMap.get(id))
        .filter((e): e is NonNullable<typeof e> => e !== undefined)
        .map(e => ({
          id: e.id,
          name: e.name,
          movementPatterns: e.movement || [],
          equipment: e.equipment || [],
          imageUrl: e.imageUrl || (e.muxPlaybackId ? `https://image.mux.com/${e.muxPlaybackId}/thumbnail.png?width=200` : null),
        }));

      // Get Week 1 workouts only - these define the template used for enrollment snapshots
      // This ensures exercise instance IDs match between substitution mappings and enrolled exercises
      const weeks = await db.select().from(programWeeks).where(eq(programWeeks.programId, program.id)).orderBy(asc(programWeeks.weekNumber));
      if (weeks.length === 0) {
        return res.json({ flaggedExercises: [], substituteOptions: [], enrollmentId: targetEnrollment.id });
      }
      const week1 = weeks[0];
      const week1Days = await db.select().from(programDays).where(eq(programDays.weekId, week1.id)).orderBy(asc(programDays.position));
      
      const week1Workouts: any[] = [];
      for (const day of week1Days) {
        const dayWorkouts = await db.select().from(programmeWorkouts).where(eq(programmeWorkouts.dayId, day.id));
        for (const w of dayWorkouts) {
          week1Workouts.push({ ...w, weekNumber: week1.weekNumber, dayNumber: day.position + 1 });
        }
      }
      
      const flaggedExercises: Array<{
        exerciseInstanceId: number;
        exerciseId: number;
        exerciseName: string;
        exerciseImageUrl: string | null;
        workoutName: string;
        weekNumber: number;
        dayNumber: number;
        reason: string;
        reasonType: 'movement_pattern' | 'equipment' | 'level';
      }> = [];

      // Process each Week 1 workout to find flagged exercises
      for (const workout of week1Workouts) {
        const blocks = await storage.getProgrammeWorkoutBlocks(workout.id);
        for (const block of blocks) {
          const blockExercises = block.exercises || [];
          
          for (const blockExercise of blockExercises) {
            if (!blockExercise.exerciseLibraryId) continue;
            
            const exercise = exerciseMap.get(blockExercise.exerciseLibraryId);
            if (!exercise) continue;

            let isFlagged = false;
            let reason = '';
            let reasonType: 'movement_pattern' | 'equipment' | 'level' = 'movement_pattern';

            // Check movement patterns first
            if (flaggingPatterns.length > 0 && exercise.movement && exercise.movement.length > 0) {
              const matchingPattern = exercise.movement.find((m: string) => flaggingPatterns.includes(m));
              if (matchingPattern) {
                isFlagged = true;
                reason = `Movement pattern: ${matchingPattern}`;
                reasonType = 'movement_pattern';
              }
            }

            // Check equipment
            if (!isFlagged && flaggingEquipment.length > 0 && exercise.equipment && exercise.equipment.length > 0) {
              const matchingEquipment = exercise.equipment.find((e: string) => flaggingEquipment.includes(e));
              if (matchingEquipment) {
                isFlagged = true;
                reason = `Equipment: ${matchingEquipment}`;
                reasonType = 'equipment';
              }
            }

            // Check level
            if (!isFlagged && flaggingLevel.length > 0 && exercise.level) {
              if (flaggingLevel.includes(exercise.level)) {
                isFlagged = true;
                reason = `Difficulty level: ${exercise.level}`;
                reasonType = 'level';
              }
            }

            if (isFlagged) {
              flaggedExercises.push({
                exerciseInstanceId: blockExercise.id,
                exerciseId: exercise.id,
                exerciseName: exercise.name,
                exerciseImageUrl: exercise.imageUrl || (exercise.muxPlaybackId ? `https://image.mux.com/${exercise.muxPlaybackId}/thumbnail.png?width=200` : null),
                workoutName: workout.name || `Week ${workout.weekNumber} Day ${workout.dayNumber}`,
                weekNumber: workout.weekNumber,
                dayNumber: workout.dayNumber,
                reason,
                reasonType,
              });
            }
          }
        }
      }

      // Group flagged exercises by exerciseId so each unique exercise is shown only once
      // but we track all instance IDs so substitutions apply to all occurrences
      const groupedFlagged = new Map<number, {
        exerciseId: number;
        exerciseName: string;
        exerciseImageUrl: string | null;
        reason: string;
        reasonType: 'movement_pattern' | 'equipment' | 'level';
        instanceIds: number[];
        occurrenceCount: number;
      }>();

      for (const flagged of flaggedExercises) {
        const existing = groupedFlagged.get(flagged.exerciseId);
        if (existing) {
          existing.instanceIds.push(flagged.exerciseInstanceId);
          existing.occurrenceCount++;
        } else {
          groupedFlagged.set(flagged.exerciseId, {
            exerciseId: flagged.exerciseId,
            exerciseName: flagged.exerciseName,
            exerciseImageUrl: flagged.exerciseImageUrl,
            reason: flagged.reason,
            reasonType: flagged.reasonType,
            instanceIds: [flagged.exerciseInstanceId],
            occurrenceCount: 1,
          });
        }
      }

      // Convert to array for response
      const uniqueFlaggedExercises = Array.from(groupedFlagged.values());

      return res.json({
        flaggedExercises: uniqueFlaggedExercises,
        substituteOptions,
        enrollmentId: targetEnrollment.id,
        flaggingCriteria: {
          movementPatterns: flaggingPatterns,
          equipment: flaggingEquipment,
          levels: flaggingLevel,
        },
      });
    } catch (error) {
      console.error("Error previewing modifications:", error);
      res.status(500).json({ message: "Failed to preview modifications" });
    }
  });

  // Accept programme modifications (apply substitutions)
  // Supports optional enrollmentId param to target a specific enrollment (used in post-enrolment flow)
  app.post('/api/programme-modifications/accept', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { outcomeId, bodyMapLogId, selections, enrollmentId } = req.body;
      
      if (!outcomeId) {
        return res.status(400).json({ message: "Outcome ID is required" });
      }

      let targetEnrollment;
      
      // If enrollmentId is provided, use that specific enrollment
      // Otherwise, fall back to the user's current active main enrollment (existing behavior)
      if (enrollmentId) {
        const enrollment = await storage.getEnrollmentById(enrollmentId);
        if (!enrollment || enrollment.userId !== userId) {
          return res.status(404).json({ message: "Enrollment not found" });
        }
        targetEnrollment = enrollment;
      } else {
        // Get the user's main active programme enrollment (existing behavior)
        const enrollments = await storage.getUserEnrolledPrograms(userId);
        const mainEnrollment = enrollments.find(e => e.programType === 'main' && e.status === 'active');
        
        if (!mainEnrollment) {
          return res.status(404).json({ message: "No active main programme found" });
        }
        targetEnrollment = mainEnrollment;
      }

      // Get the outcome to get flagging rules and substitution pool
      const outcome = await storage.getBodyMapOutcomeById(outcomeId);
      if (!outcome) {
        return res.status(404).json({ message: "Outcome not found" });
      }

      // LIFECYCLE: Archive any existing modification records for this enrollment+outcome
      // This ensures only ONE active record exists per body area/outcome
      const existingRecords = await db.select({ id: programmeModificationRecords.id })
        .from(programmeModificationRecords)
        .where(and(
          eq(programmeModificationRecords.userId, userId),
          eq(programmeModificationRecords.mainProgrammeEnrollmentId, targetEnrollment.id),
          eq(programmeModificationRecords.matchedOutcomeId, outcomeId),
          eq(programmeModificationRecords.status, 'accepted'),
          isNull(programmeModificationRecords.clearedAt)
        ));
      
      if (existingRecords.length > 0) {
        const existingRecordIds = existingRecords.map(r => r.id);
        console.log('Archiving prior modification records:', existingRecordIds);
        
        // Mark all prior mappings as restored (they become historical)
        await db.update(exerciseSubstitutionMappings)
          .set({ isRestored: true, restoredAt: new Date() })
          .where(and(
            inArray(exerciseSubstitutionMappings.modificationRecordId, existingRecordIds),
            eq(exerciseSubstitutionMappings.isRestored, false)
          ));
        
        // Mark the old records as cleared/archived
        await db.update(programmeModificationRecords)
          .set({ clearedAt: new Date(), updatedAt: new Date() })
          .where(inArray(programmeModificationRecords.id, existingRecordIds));
      }

      // Create the modification record
      const modificationRecord = await db.insert(programmeModificationRecords).values({
        userId,
        matchedOutcomeId: outcomeId,
        mainProgrammeEnrollmentId: targetEnrollment.id,
        bodyMapLogId: bodyMapLogId || null,
        status: 'accepted',
      }).returning();

      const recordId = modificationRecord[0].id;
      let substitutionsApplied = 0;
      let substitutionsFailed = 0;

      // Get all upcoming workouts in the programme
      const program = await storage.getProgramById(targetEnrollment.programId);
      if (!program) {
        return res.status(404).json({ message: "Programme not found" });
      }

      // Get flagging rules from outcome
      const flaggingPatterns = outcome.flaggingMovementPatterns || [];
      const flaggingMuscles = outcome.flaggingMuscles || [];
      const flaggingEquipment = outcome.flaggingEquipment || [];
      const flaggingLevel = outcome.flaggingLevel || [];
      const flaggingMechanics = outcome.flaggingMechanics || [];

      // Get substitution pool
      const poolData = outcome.substitutionRules as any;
      const substitutionPool = Array.isArray(poolData) ? poolData[0] : poolData;
      const allowedPatterns = substitutionPool?.allowedPatterns || [];
      // substituteExerciseIds is already in coach-defined order (array order = priority)
      const substituteExerciseIds: number[] = substitutionPool?.substituteExerciseIds || [];

      // Get all exercises for pattern matching
      const allExercises = await storage.getExercises();
      const exerciseMap = new Map(allExercises.map(e => [e.id, e]));

      // FIX 1: Option 1B - Coach-ordered substitute selection
      // Build curated substitutes in coach order (array order = priority)
      const curatedSubstitutes = substituteExerciseIds
        .map(id => exerciseMap.get(id))
        .filter((e): e is NonNullable<typeof e> => e !== undefined);
      
      // Pattern-matched substitutes as fallback (only if not in curated list)
      const patternMatchedSubstitutes = allExercises.filter(e => {
        if (substituteExerciseIds.includes(e.id)) return false; // Skip if already in curated
        if (allowedPatterns.length > 0) {
          const exercisePatterns = e.movement || [];
          return exercisePatterns.some(p => allowedPatterns.includes(p));
        }
        return false;
      });

      // Get Week 1 workouts only - these define the template used for enrollment snapshots
      // This ensures exercise instance IDs match between substitution mappings and enrolled exercises
      const weeks = await db.select().from(programWeeks).where(eq(programWeeks.programId, program.id)).orderBy(asc(programWeeks.weekNumber));
      if (weeks.length === 0) {
        return res.json({ success: true, substitutionsApplied: 0, substitutionsFailed: 0 });
      }
      const week1 = weeks[0];
      const week1Days = await db.select().from(programDays).where(eq(programDays.weekId, week1.id)).orderBy(asc(programDays.position));
      
      const week1Workouts: any[] = [];
      for (const day of week1Days) {
        const dayWorkouts = await db.select().from(programmeWorkouts).where(eq(programmeWorkouts.dayId, day.id));
        for (const w of dayWorkouts) {
          week1Workouts.push({ ...w, weekNumber: week1.weekNumber, dayNumber: day.position + 1 });
        }
      }

      // Process each Week 1 workout - uses ONLY block-based exercises (legacy removed)
      for (const workout of week1Workouts) {
          const blocks = await storage.getProgrammeWorkoutBlocks(workout.id);
          for (const block of blocks) {
            // Use block.exercises from getProgrammeWorkoutBlocks (already includes programme_block_exercises)
            const blockExercises = block.exercises || [];
            
            for (const blockExercise of blockExercises) {
              if (!blockExercise.exerciseLibraryId) continue;
              
              const exercise = exerciseMap.get(blockExercise.exerciseLibraryId);
              if (!exercise) continue;

              let isFlagged = false;
              let flagReason = '';

              if (flaggingPatterns.length > 0 && exercise.movement && exercise.movement.length > 0) {
                const matchingPattern = exercise.movement.find((m: string) => flaggingPatterns.includes(m));
                if (matchingPattern) {
                  isFlagged = true;
                  flagReason = `Movement pattern: ${matchingPattern}`;
                }
              }

              if (!isFlagged && flaggingMuscles.length > 0 && exercise.mainMuscle && exercise.mainMuscle.length > 0) {
                const matchingMuscle = exercise.mainMuscle.find((m: string) => flaggingMuscles.includes(m));
                if (matchingMuscle) {
                  isFlagged = true;
                  flagReason = `Muscle: ${matchingMuscle}`;
                }
              }

              if (!isFlagged && flaggingEquipment.length > 0 && exercise.equipment && exercise.equipment.length > 0) {
                const matchingEquipment = exercise.equipment.find((e: string) => flaggingEquipment.includes(e));
                if (matchingEquipment) {
                  isFlagged = true;
                  flagReason = `Equipment: ${matchingEquipment}`;
                }
              }

              if (!isFlagged && flaggingLevel.length > 0 && exercise.level) {
                if (flaggingLevel.includes(exercise.level)) {
                  isFlagged = true;
                  flagReason = `Level: ${exercise.level}`;
                }
              }

              if (!isFlagged && flaggingMechanics.length > 0 && exercise.mechanics && exercise.mechanics.length > 0) {
                const matchingMechanics = exercise.mechanics.find((m: string) => flaggingMechanics.includes(m));
                if (matchingMechanics) {
                  isFlagged = true;
                  flagReason = `Mechanics: ${matchingMechanics}`;
                }
              }

              if (!isFlagged) continue;

              // Check if user provided a selection for this exercise instance
              let substitute: typeof curatedSubstitutes[0] | undefined;
              const userSelection = selections?.find((s: any) => s.exerciseInstanceId === blockExercise.id);
              
              if (userSelection?.chosenSubstituteExerciseId) {
                // Validate the user's choice is in the curated list and not the same as flagged exercise
                const chosenId = userSelection.chosenSubstituteExerciseId;
                if (substituteExerciseIds.includes(chosenId) && chosenId !== exercise.id) {
                  substitute = curatedSubstitutes.find(s => s.id === chosenId);
                }
              }
              
              // Fall back to automatic selection if user didn't select or selection was invalid
              if (!substitute) {
                substitute = curatedSubstitutes.find(s => s.id !== exercise.id);
              }
              if (!substitute) {
                substitute = patternMatchedSubstitutes.find(s => s.id !== exercise.id);
              }
              
              if (!substitute) {
                substitutionsFailed++;
                continue;
              }

              await db.insert(exerciseSubstitutionMappings).values({
                modificationRecordId: recordId,
                mainProgrammeEnrollmentId: targetEnrollment.id,
                workoutId: workout.id,
                exerciseInstanceId: blockExercise.id,
                originalExerciseId: exercise.id,
                substitutedExerciseId: substitute.id,
                matchedOutcomeId: outcomeId,
                flaggingReason: flagReason,
              });

              substitutionsApplied++;
            }
          }
      }

      // Update the modification record with counts
      await db.update(programmeModificationRecords)
        .set({ 
          substitutionsApplied,
          substitutionsFailed,
        })
        .where(eq(programmeModificationRecords.id, recordId));

      // NOTE: Recovery programme enrollment is now handled separately via /api/recovery-plan-decision
      // This endpoint only handles exercise substitutions

      res.json({
        success: true,
        substitutionsApplied,
        substitutionsFailed,
        modificationRecordId: recordId,
      });
    } catch (error) {
      console.error("Error accepting programme modifications:", error);
      res.status(500).json({ message: "Failed to apply programme modifications" });
    }
  });

  // Decline programme modifications (keep programme as is)
  app.post('/api/programme-modifications/decline', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { outcomeId, bodyMapLogId } = req.body;
      
      if (!outcomeId) {
        return res.status(400).json({ message: "Outcome ID is required" });
      }

      // Get the user's main active programme enrollment
      const enrollments = await storage.getUserEnrolledPrograms(userId);
      const mainEnrollment = enrollments.find(e => e.programType === 'main' && e.status === 'active');
      
      if (!mainEnrollment) {
        // Even without an active programme, record the decline
        await db.insert(programmeModificationRecords).values({
          userId,
          matchedOutcomeId: outcomeId,
          mainProgrammeEnrollmentId: 0, // No active programme
          bodyMapLogId: bodyMapLogId || null,
          status: 'declined',
        });
        return res.json({ success: true, message: "No active programme to modify" });
      }

      // Create the declined modification record
      await db.insert(programmeModificationRecords).values({
        userId,
        matchedOutcomeId: outcomeId,
        mainProgrammeEnrollmentId: mainEnrollment.id,
        bodyMapLogId: bodyMapLogId || null,
        status: 'declined',
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error declining programme modifications:", error);
      res.status(500).json({ message: "Failed to decline programme modifications" });
    }
  });

  // Step 5: Get restorable substitutions for a cleared body map issue
  app.get('/api/programme-modifications/restorable', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { bodyArea } = req.query;
      
      if (!bodyArea || typeof bodyArea !== 'string') {
        return res.status(400).json({ message: "Body area is required" });
      }

      const restorable = await storage.getRestorableSubstitutions(userId, bodyArea);
      
      if (!restorable) {
        return res.json({ hasRestorable: false, substitutions: [] });
      }

      res.json({
        hasRestorable: true,
        modificationRecordId: restorable.modificationRecordId,
        matchedOutcomeId: restorable.matchedOutcomeId,
        substitutions: restorable.substitutions,
      });
    } catch (error) {
      console.error("Error fetching restorable substitutions:", error);
      res.status(500).json({ message: "Failed to fetch restorable substitutions" });
    }
  });

  // Step 5: Restore original exercises (undo substitutions) - supports selective restore
  app.post('/api/programme-modifications/restore', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { matchedOutcomeId, bodyMapLogId, mappingIdsToRestore, modificationRecordId } = req.body;
      
      if (!matchedOutcomeId) {
        return res.status(400).json({ message: "Outcome ID is required" });
      }
      if (!bodyMapLogId) {
        return res.status(400).json({ message: "Body map log ID is required" });
      }

      // If mappingIdsToRestore is provided, do selective restore; otherwise restore all
      const result = await storage.restoreSubstitutionsByOutcome(
        userId, 
        matchedOutcomeId, 
        bodyMapLogId, 
        mappingIdsToRestore,
        modificationRecordId
      );
      
      res.json({
        success: true,
        restoredCount: result.restoredCount,
        keptCount: result.keptCount,
        message: result.restoredCount > 0 
          ? `Restored ${result.restoredCount} exercise${result.restoredCount !== 1 ? 's' : ''} to original`
          : "All substitutes have been kept",
      });
    } catch (error) {
      console.error("Error restoring substitutions:", error);
      res.status(500).json({ message: "Failed to restore substitutions" });
    }
  });

  // Step 5: Keep current setup (mark as cleared but don't restore)
  app.post('/api/programme-modifications/keep-current', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { matchedOutcomeId, bodyMapLogId } = req.body;
      
      if (!matchedOutcomeId) {
        return res.status(400).json({ message: "Outcome ID is required" });
      }
      if (!bodyMapLogId) {
        return res.status(400).json({ message: "Body map log ID is required" });
      }

      // Just mark the modification record as cleared without restoring substitutions
      await storage.markModificationRecordCleared(userId, matchedOutcomeId, bodyMapLogId);
      
      res.json({
        success: true,
        message: "Programme modifications kept, issue marked as cleared",
      });
    } catch (error) {
      console.error("Error keeping current setup:", error);
      res.status(500).json({ message: "Failed to keep current setup" });
    }
  });

  // Body Map Configuration Routes - Admin only

  // Body areas
  app.get('/api/body-map-config/areas', async (req, res) => {
    try {
      const areas = await storage.getBodyMapAreas();
      res.json(areas);
    } catch (error) {
      console.error("Error fetching body map areas:", error);
      res.status(500).json({ message: "Failed to fetch body map areas" });
    }
  });

  app.post('/api/body-map-config/areas', isAuthenticated, async (req, res) => {
    try {
      const areaData = insertBodyMapAreaSchema.parse(req.body);
      const area = await storage.createBodyMapArea(areaData);
      res.status(201).json(area);
    } catch (error) {
      console.error("Error creating body map area:", error);
      res.status(500).json({ message: "Failed to create body map area" });
    }
  });

  app.put('/api/body-map-config/areas/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const areaData = insertBodyMapAreaSchema.partial().parse(req.body);
      const area = await storage.updateBodyMapArea(id, areaData);
      res.json(area);
    } catch (error) {
      console.error("Error updating body map area:", error);
      res.status(500).json({ message: "Failed to update body map area" });
    }
  });

  app.delete('/api/body-map-config/areas/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBodyMapArea(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting body map area:", error);
      res.status(500).json({ message: "Failed to delete body map area" });
    }
  });

  // Questions
  app.get('/api/body-map-config/areas/:areaId/questions', async (req, res) => {
    try {
      const areaId = parseInt(req.params.areaId);
      const questions = await storage.getBodyMapQuestionsByArea(areaId);
      res.json(questions);
    } catch (error) {
      console.error("Error fetching body map questions:", error);
      res.status(500).json({ message: "Failed to fetch body map questions" });
    }
  });

  app.post('/api/body-map-config/questions', isAuthenticated, async (req, res) => {
    try {
      const questionData = insertBodyMapQuestionSchema.parse(req.body);
      const question = await storage.createBodyMapQuestion(questionData);
      res.status(201).json(question);
    } catch (error) {
      console.error("Error creating body map question:", error);
      res.status(500).json({ message: "Failed to create body map question" });
    }
  });

  app.put('/api/body-map-config/questions/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const questionData = insertBodyMapQuestionSchema.partial().parse(req.body);
      const question = await storage.updateBodyMapQuestion(id, questionData);
      res.json(question);
    } catch (error) {
      console.error("Error updating body map question:", error);
      res.status(500).json({ message: "Failed to update body map question" });
    }
  });

  app.delete('/api/body-map-config/questions/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBodyMapQuestion(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting body map question:", error);
      res.status(500).json({ message: "Failed to delete body map question" });
    }
  });

  // Answer options
  app.get('/api/body-map-config/questions/:questionId/answers', async (req, res) => {
    try {
      const questionId = parseInt(req.params.questionId);
      const answers = await storage.getBodyMapAnswersByQuestion(questionId);
      res.json(answers);
    } catch (error) {
      console.error("Error fetching body map answers:", error);
      res.status(500).json({ message: "Failed to fetch body map answers" });
    }
  });

  app.post('/api/body-map-config/answers', isAuthenticated, async (req, res) => {
    try {
      const answerData = insertBodyMapAnswerOptionSchema.parse(req.body);
      const answer = await storage.createBodyMapAnswer(answerData);
      res.status(201).json(answer);
    } catch (error) {
      console.error("Error creating body map answer:", error);
      res.status(500).json({ message: "Failed to create body map answer" });
    }
  });

  app.put('/api/body-map-config/answers/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const answerData = insertBodyMapAnswerOptionSchema.partial().parse(req.body);
      const answer = await storage.updateBodyMapAnswer(id, answerData);
      res.json(answer);
    } catch (error) {
      console.error("Error updating body map answer:", error);
      res.status(500).json({ message: "Failed to update body map answer" });
    }
  });

  app.delete('/api/body-map-config/answers/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBodyMapAnswer(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting body map answer:", error);
      res.status(500).json({ message: "Failed to delete body map answer" });
    }
  });

  // Movement limitation options
  app.get('/api/body-map-config/areas/:areaId/movement-options', async (req, res) => {
    try {
      const areaId = parseInt(req.params.areaId);
      const options = await storage.getBodyMapMovementOptionsByArea(areaId);
      res.json(options);
    } catch (error) {
      console.error("Error fetching body map movement options:", error);
      res.status(500).json({ message: "Failed to fetch body map movement options" });
    }
  });

  // Get answer values that trigger follow-up questions for a body area
  app.get('/api/body-map-config/areas/:areaId/followup-triggers', async (req, res) => {
    try {
      const areaId = parseInt(req.params.areaId);
      const triggers = await storage.getFollowUpTriggersByArea(areaId);
      res.json(triggers);
    } catch (error) {
      console.error("Error fetching follow-up triggers:", error);
      res.status(500).json({ message: "Failed to fetch follow-up triggers" });
    }
  });

  app.get('/api/body-map-config/movement-options', async (req, res) => {
    try {
      const options = await storage.getAllBodyMapMovementOptions();
      res.json(options);
    } catch (error) {
      console.error("Error fetching all body map movement options:", error);
      res.status(500).json({ message: "Failed to fetch body map movement options" });
    }
  });

  app.post('/api/body-map-config/movement-options', isAuthenticated, async (req, res) => {
    try {
      const optionData = insertBodyMapMovementOptionSchema.parse(req.body);
      const option = await storage.createBodyMapMovementOption(optionData);
      res.status(201).json(option);
    } catch (error) {
      console.error("Error creating body map movement option:", error);
      res.status(500).json({ message: "Failed to create body map movement option" });
    }
  });

  app.put('/api/body-map-config/movement-options/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const optionData = insertBodyMapMovementOptionSchema.partial().parse(req.body);
      const option = await storage.updateBodyMapMovementOption(id, optionData);
      res.json(option);
    } catch (error) {
      console.error("Error updating body map movement option:", error);
      res.status(500).json({ message: "Failed to update body map movement option" });
    }
  });

  app.delete('/api/body-map-config/movement-options/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBodyMapMovementOption(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting body map movement option:", error);
      res.status(500).json({ message: "Failed to delete body map movement option" });
    }
  });

  // Recovery templates
  app.get('/api/body-map-config/areas/:areaId/templates', async (req, res) => {
    try {
      const areaId = parseInt(req.params.areaId);
      const templates = await storage.getBodyMapTemplatesByArea(areaId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching body map templates:", error);
      res.status(500).json({ message: "Failed to fetch body map templates" });
    }
  });

  app.post('/api/body-map-config/templates', isAuthenticated, async (req, res) => {
    try {
      const templateData = insertBodyMapRecoveryTemplateSchema.parse(req.body);
      const template = await storage.createBodyMapTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating body map template:", error);
      res.status(500).json({ message: "Failed to create body map template" });
    }
  });

  app.put('/api/body-map-config/templates/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const templateData = insertBodyMapRecoveryTemplateSchema.partial().parse(req.body);
      const template = await storage.updateBodyMapTemplate(id, templateData);
      res.json(template);
    } catch (error) {
      console.error("Error updating body map template:", error);
      res.status(500).json({ message: "Failed to update body map template" });
    }
  });

  app.delete('/api/body-map-config/templates/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBodyMapTemplate(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting body map template:", error);
      res.status(500).json({ message: "Failed to delete body map template" });
    }
  });

  // Template rules
  app.get('/api/body-map-config/templates/:templateId/rules', async (req, res) => {
    try {
      const templateId = parseInt(req.params.templateId);
      const rules = await storage.getBodyMapRulesByTemplate(templateId);
      res.json(rules);
    } catch (error) {
      console.error("Error fetching body map rules:", error);
      res.status(500).json({ message: "Failed to fetch body map rules" });
    }
  });

  app.post('/api/body-map-config/rules', isAuthenticated, async (req, res) => {
    try {
      const ruleData = insertBodyMapTemplateRuleSchema.parse(req.body);
      const rule = await storage.createBodyMapRule(ruleData);
      res.status(201).json(rule);
    } catch (error) {
      console.error("Error creating body map rule:", error);
      res.status(500).json({ message: "Failed to create body map rule" });
    }
  });

  app.put('/api/body-map-config/rules/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ruleData = insertBodyMapTemplateRuleSchema.partial().parse(req.body);
      const rule = await storage.updateBodyMapRule(id, ruleData);
      res.json(rule);
    } catch (error) {
      console.error("Error updating body map rule:", error);
      res.status(500).json({ message: "Failed to update body map rule" });
    }
  });

  app.delete('/api/body-map-config/rules/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBodyMapRule(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting body map rule:", error);
      res.status(500).json({ message: "Failed to delete body map rule" });
    }
  });

  // Universal Guidance Rules CRUD
  app.get('/api/body-map-config/guidance-rules', async (req, res) => {
    try {
      const rules = await storage.getBodyMapGuidanceRules();
      res.json(rules);
    } catch (error) {
      console.error("Error fetching guidance rules:", error);
      res.status(500).json({ message: "Failed to fetch guidance rules" });
    }
  });

  app.post('/api/body-map-config/guidance-rules', isAuthenticated, async (req, res) => {
    try {
      const ruleData = insertBodyMapGuidanceRuleSchema.parse(req.body);
      const rule = await storage.createBodyMapGuidanceRule(ruleData);
      res.status(201).json(rule);
    } catch (error) {
      console.error("Error creating guidance rule:", error);
      res.status(500).json({ message: "Failed to create guidance rule" });
    }
  });

  app.put('/api/body-map-config/guidance-rules/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ruleData = insertBodyMapGuidanceRuleSchema.partial().parse(req.body);
      const rule = await storage.updateBodyMapGuidanceRule(id, ruleData);
      res.json(rule);
    } catch (error) {
      console.error("Error updating guidance rule:", error);
      res.status(500).json({ message: "Failed to update guidance rule" });
    }
  });

  app.delete('/api/body-map-config/guidance-rules/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBodyMapGuidanceRule(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting guidance rule:", error);
      res.status(500).json({ message: "Failed to delete guidance rule" });
    }
  });

  // Body Map Outcomes CRUD - outcome-based decision framework
  app.get('/api/body-map-config/areas/:areaId/outcomes', async (req, res) => {
    try {
      const areaId = parseInt(req.params.areaId);
      const outcomes = await storage.getBodyMapOutcomesByArea(areaId);
      res.json(outcomes);
    } catch (error) {
      console.error("Error fetching outcomes:", error);
      res.status(500).json({ message: "Failed to fetch outcomes" });
    }
  });

  app.get('/api/body-map-config/outcomes/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const outcome = await storage.getBodyMapOutcomeById(id);
      if (!outcome) {
        return res.status(404).json({ message: "Outcome not found" });
      }
      res.json(outcome);
    } catch (error) {
      console.error("Error fetching outcome:", error);
      res.status(500).json({ message: "Failed to fetch outcome" });
    }
  });

  app.post('/api/body-map-config/outcomes', isAuthenticated, async (req, res) => {
    try {
      const outcomeData = insertBodyMapOutcomeSchema.parse(req.body);
      const outcome = await storage.createBodyMapOutcome(outcomeData);
      res.status(201).json(outcome);
    } catch (error: any) {
      console.error("Error creating outcome:", error);
      console.error("Request body:", JSON.stringify(req.body, null, 2));
      const message = error?.message || "Failed to create outcome";
      res.status(500).json({ message: `Failed to create outcome: ${message}` });
    }
  });

  app.put('/api/body-map-config/outcomes/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const outcomeData = insertBodyMapOutcomeSchema.partial().parse(req.body);
      const outcome = await storage.updateBodyMapOutcome(id, outcomeData);
      res.json(outcome);
    } catch (error) {
      console.error("Error updating outcome:", error);
      res.status(500).json({ message: "Failed to update outcome" });
    }
  });

  app.delete('/api/body-map-config/outcomes/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBodyMapOutcome(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting outcome:", error);
      res.status(500).json({ message: "Failed to delete outcome" });
    }
  });

  // Preview/simulate outcome matching
  app.post('/api/body-map-config/outcomes/simulate', async (req, res) => {
    try {
      const { bodyAreaId, severity, trainingImpact, movementImpact } = req.body;
      const outcome = await storage.findMatchingOutcome(
        bodyAreaId,
        severity,
        trainingImpact || null,
        movementImpact || null
      );
      res.json({ matchedOutcome: outcome });
    } catch (error) {
      console.error("Error simulating outcome:", error);
      res.status(500).json({ message: "Failed to simulate outcome" });
    }
  });

  // Seed initial body map configuration data (idempotent - can be run multiple times)
  app.post('/api/body-map-config/seed', isAuthenticated, async (req, res) => {
    try {
      // Check if all required areas already exist
      const existingAreas = await storage.getBodyMapAreas();
      const requiredAreas = ["Right Shoulder", "Left Shoulder", "Right Knee", "Left Knee", "Lower Back"];
      const existingNames = existingAreas.map(a => a.name);
      const allAreasExist = requiredAreas.every(name => existingNames.includes(name));
      
      if (allAreasExist && existingAreas.length >= requiredAreas.length) {
        return res.json({ 
          success: true, 
          message: "Body map configuration already seeded",
          alreadyExists: true,
          areas: existingAreas
        });
      }
      
      // If partial data exists, warn but continue (will skip existing areas)
      if (existingAreas.length > 0) {
        console.warn("Partial body map configuration detected. Completing seed...");
      }

      // Helper to get or create area
      const getOrCreateArea = async (areaData: any) => {
        const existing = existingAreas.find(a => a.name === areaData.name);
        if (existing) {
          console.log(`Area ${areaData.name} already exists, skipping...`);
          return existing;
        }
        return await storage.createBodyMapArea(areaData);
      };

      // Create body areas (skips if already exist)
      const rightShoulder = await getOrCreateArea({
        name: "Right Shoulder",
        displayName: "Right Shoulder",
        category: "upper_body",
        orderIndex: 1,
        isActive: true
      });
      
      const leftShoulder = await getOrCreateArea({
        name: "Left Shoulder",
        displayName: "Left Shoulder",
        category: "upper_body",
        orderIndex: 2,
        isActive: true
      });

      const rightKnee = await getOrCreateArea({
        name: "Right Knee",
        displayName: "Right Knee",
        category: "lower_body",
        orderIndex: 3,
        isActive: true
      });

      const leftKnee = await getOrCreateArea({
        name: "Left Knee",
        displayName: "Left Knee",
        category: "lower_body",
        orderIndex: 4,
        isActive: true
      });

      const lowerBack = await getOrCreateArea({
        name: "Lower Back",
        displayName: "Lower Back",
        category: "back",
        orderIndex: 5,
        isActive: true
      });

      // Helper to get existing templates for an area
      const getExistingTemplates = async (areaId: number) => {
        return await storage.getBodyMapTemplatesByArea(areaId);
      };

      // Create shoulder template (skip if already exists)
      let shoulderTemplate;
      const existingShoulderTemplates = await getExistingTemplates(rightShoulder.id);
      if (existingShoulderTemplates.length > 0) {
        console.log(`Template for Right Shoulder already exists, skipping...`);
        shoulderTemplate = existingShoulderTemplates[0];
      } else {
        shoulderTemplate = await storage.createBodyMapTemplate({
        bodyAreaId: rightShoulder.id,
        name: "Shoulder Recovery Protocol",
        planTitle: "Shoulder Recovery Protocol",
        planDescription: "A comprehensive recovery plan designed to reduce shoulder discomfort and restore optimal function.",
        rootCauses: [
          "Tight chest muscles (pectoralis major/minor) pulling shoulder forward",
          "Weak rotator cuff muscles causing instability",
          "Limited thoracic spine mobility restricting overhead movement"
        ],
        recommendedStretches: [
          "Doorway pec stretch - 2x30 seconds each side",
          "Cross-body shoulder stretch - 2x30 seconds",
          "Sleeper stretch for internal rotation - 2x30 seconds",
          "Thread the needle for thoracic mobility - 2x10 reps"
        ],
        movementsToAvoid: [
          "Heavy overhead pressing (military press, overhead press)",
          "Behind-the-neck movements",
          "Upright rows with heavy weight",
          "Bench press with wide grip"
        ],
        movementsToModify: [
          "Replace barbell bench press with dumbbell press (better shoulder position)",
          "Use neutral grip for pressing movements",
          "Limit range of motion on overhead movements to pain-free zone",
          "Reduce weight by 30-50% on all pressing exercises"
        ],
        affectedMovements: ["overhead press", "bench press", "shoulder press", "push-up", "dip"],
        generalRecommendations: [
          "Apply ice for 15 minutes after training to reduce inflammation",
          "Focus on scapular stability exercises (band pull-aparts, face pulls)",
          "Incorporate daily thoracic spine mobility work",
          "Ensure proper shoulder warm-up before training (5-10 minutes)"
        ],
        isActive: true
        });
      }

      // Create rule for shoulder template (all severities) - skip if already exists
      const existingShoulderRules = await storage.getBodyMapRulesByTemplate(shoulderTemplate.id);
      if (existingShoulderRules.length === 0) {
        await storage.createBodyMapRule({
          templateId: shoulderTemplate.id,
          severityMin: 1,
          severityMax: 10,
          requiredAnswers: {},
          priority: 1,
          isActive: true
        });
      }

      // Create left shoulder template (same as right) - skip if already exists
      let leftShoulderTemplate;
      const existingLeftShoulderTemplates = await getExistingTemplates(leftShoulder.id);
      if (existingLeftShoulderTemplates.length > 0) {
        console.log(`Template for Left Shoulder already exists, skipping...`);
        leftShoulderTemplate = existingLeftShoulderTemplates[0];
      } else {
        leftShoulderTemplate = await storage.createBodyMapTemplate({
          bodyAreaId: leftShoulder.id,
          name: "Shoulder Recovery Protocol",
          planTitle: "Shoulder Recovery Protocol",
          planDescription: "A comprehensive recovery plan designed to reduce shoulder discomfort and restore optimal function.",
          rootCauses: shoulderTemplate.rootCauses,
          recommendedStretches: shoulderTemplate.recommendedStretches,
          movementsToAvoid: shoulderTemplate.movementsToAvoid,
          movementsToModify: shoulderTemplate.movementsToModify,
          affectedMovements: shoulderTemplate.affectedMovements,
          generalRecommendations: shoulderTemplate.generalRecommendations,
          isActive: true
        });
      }

      const existingLeftShoulderRules = await storage.getBodyMapRulesByTemplate(leftShoulderTemplate.id);
      if (existingLeftShoulderRules.length === 0) {
        await storage.createBodyMapRule({
          templateId: leftShoulderTemplate.id,
          severityMin: 1,
          severityMax: 10,
          requiredAnswers: {},
          priority: 1,
          isActive: true
        });
      }

      // Create knee template - skip if already exists
      let kneeTemplate;
      const existingKneeTemplates = await getExistingTemplates(rightKnee.id);
      if (existingKneeTemplates.length > 0) {
        console.log(`Template for Right Knee already exists, skipping...`);
        kneeTemplate = existingKneeTemplates[0];
      } else {
        kneeTemplate = await storage.createBodyMapTemplate({
          bodyAreaId: rightKnee.id,
          name: "Knee Recovery Protocol",
          planTitle: "Knee Recovery Protocol",
          planDescription: "A structured recovery plan to reduce knee discomfort and restore healthy movement patterns.",
          rootCauses: [
            "Weak quadriceps and gluteus medius causing poor knee tracking",
            "Tight hip flexors and IT band pulling on kneecap",
            "Limited ankle mobility forcing knee to compensate"
          ],
          recommendedStretches: [
            "Standing quad stretch - 2x30 seconds each side",
            "IT band foam rolling - 2 minutes each side",
            "Calf stretches (gastrocnemius and soleus) - 2x30 seconds each",
            "90/90 hip stretch for mobility - 2x30 seconds each side"
          ],
          movementsToAvoid: [
            "Deep squats below 90 degrees",
            "Jumping and plyometric exercises",
            "Running or high-impact cardio",
            "Leg extensions with heavy weight"
          ],
          movementsToModify: [
            "Limit squat depth to comfortable range (no pain)",
            "Use box squats to control depth",
            "Replace running with cycling or swimming",
            "Focus on terminal knee extension exercises (last 30 degrees)"
          ],
          affectedMovements: ["squat", "lunge", "leg press", "jump", "run", "leg extension"],
          generalRecommendations: [
            "Strengthen glutes and quads with controlled exercises",
            "Use compression sleeve during training for support",
            "Apply ice for 15 minutes after activity",
            "Incorporate single-leg balance work to improve stability"
          ],
          isActive: true
        });
      }

      const existingKneeRules = await storage.getBodyMapRulesByTemplate(kneeTemplate.id);
      if (existingKneeRules.length === 0) {
        await storage.createBodyMapRule({
          templateId: kneeTemplate.id,
          severityMin: 1,
          severityMax: 10,
          requiredAnswers: {},
          priority: 1,
          isActive: true
        });
      }

      // Create left knee template (same as right) - skip if already exists
      let leftKneeTemplate;
      const existingLeftKneeTemplates = await getExistingTemplates(leftKnee.id);
      if (existingLeftKneeTemplates.length > 0) {
        console.log(`Template for Left Knee already exists, skipping...`);
        leftKneeTemplate = existingLeftKneeTemplates[0];
      } else {
        leftKneeTemplate = await storage.createBodyMapTemplate({
          bodyAreaId: leftKnee.id,
          name: "Knee Recovery Protocol",
          planTitle: "Knee Recovery Protocol",
          planDescription: kneeTemplate.planDescription,
          rootCauses: kneeTemplate.rootCauses,
          recommendedStretches: kneeTemplate.recommendedStretches,
          movementsToAvoid: kneeTemplate.movementsToAvoid,
          movementsToModify: kneeTemplate.movementsToModify,
          affectedMovements: kneeTemplate.affectedMovements,
          generalRecommendations: kneeTemplate.generalRecommendations,
          isActive: true
        });
      }

      const existingLeftKneeRules = await storage.getBodyMapRulesByTemplate(leftKneeTemplate.id);
      if (existingLeftKneeRules.length === 0) {
        await storage.createBodyMapRule({
          templateId: leftKneeTemplate.id,
          severityMin: 1,
          severityMax: 10,
          requiredAnswers: {},
          priority: 1,
          isActive: true
        });
      }

      // Create lower back template - skip if already exists
      let lowerBackTemplate;
      const existingLowerBackTemplates = await getExistingTemplates(lowerBack.id);
      if (existingLowerBackTemplates.length > 0) {
        console.log(`Template for Lower Back already exists, skipping...`);
        lowerBackTemplate = existingLowerBackTemplates[0];
      } else {
        lowerBackTemplate = await storage.createBodyMapTemplate({
          bodyAreaId: lowerBack.id,
          name: "Lower Back Recovery Protocol",
          planTitle: "Lower Back Recovery Protocol",
          planDescription: "A targeted recovery plan to alleviate lower back discomfort and prevent further strain.",
          rootCauses: [
            "Weak core muscles failing to stabilize the spine during movement",
            "Tight hip flexors tilting pelvis forward (anterior pelvic tilt)",
            "Limited hip mobility forcing excessive spinal movement"
          ],
          recommendedStretches: [
            "Child's pose for lower back decompression - 2x60 seconds",
            "Hip flexor stretch (half-kneeling) - 2x30 seconds each side",
            "Cat-cow for spinal mobility - 2x10 reps",
            "Figure-4 stretch for hip mobility - 2x30 seconds each side"
          ],
          movementsToAvoid: [
            "Heavy deadlifts and squats",
            "Bent-over rows with excessive forward lean",
            "Good mornings and Romanian deadlifts",
            "Exercises with loaded spinal flexion"
          ],
          movementsToModify: [
            "Replace deadlifts with trap bar deadlifts (more upright position)",
            "Use goblet squats instead of back squats",
            "Perform rows from supported position (chest-supported)",
            "Reduce weight by 40-60% on all lower body compound movements"
          ],
          affectedMovements: ["deadlift", "squat", "bent-over row", "good morning", "romanian deadlift"],
          generalRecommendations: [
            "Practice proper bracing technique before all lifts",
            "Maintain neutral spine positioning during all movements",
            "Strengthen core with planks and dead bugs daily",
            "Use heat therapy before training, ice after if inflamed"
          ],
          isActive: true
        });
      }

      const existingLowerBackRules = await storage.getBodyMapRulesByTemplate(lowerBackTemplate.id);
      if (existingLowerBackRules.length === 0) {
        await storage.createBodyMapRule({
          templateId: lowerBackTemplate.id,
          severityMin: 1,
          severityMax: 10,
          requiredAnswers: {},
          priority: 1,
          isActive: true
        });
      }

      res.json({ 
        success: true, 
        message: "Body map configuration seeded successfully",
        areas: [rightShoulder, leftShoulder, rightKnee, leftKnee, lowerBack],
        templates: [shoulderTemplate, leftShoulderTemplate, kneeTemplate, leftKneeTemplate, lowerBackTemplate]
      });
    } catch (error) {
      console.error("Error seeding body map configuration:", error);
      res.status(500).json({ message: "Failed to seed body map configuration" });
    }
  });

  // Bookmark routes
  app.get('/api/bookmarks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const bookmarks = await storage.getUserBookmarks(userId);
      res.json(bookmarks);
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
      res.status(500).json({ message: "Failed to fetch bookmarks" });
    }
  });

  app.post('/api/bookmarks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const bookmarkData = insertBookmarkSchema.parse({
        ...req.body,
        userId,
      });
      const bookmark = await storage.createBookmark(bookmarkData);
      res.json(bookmark);
    } catch (error) {
      console.error("Error creating bookmark:", error);
      res.status(500).json({ message: "Failed to create bookmark" });
    }
  });

  app.delete('/api/bookmarks/:contentType/:contentId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { contentType, contentId } = req.params;
      await storage.deleteBookmark(userId, contentType, parseInt(contentId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting bookmark:", error);
      res.status(500).json({ message: "Failed to delete bookmark" });
    }
  });

  // Favourites routes (using bookmarks)
  app.get('/api/favorites/programs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const bookmarks = await storage.getUserBookmarksByType(userId, 'program');
      const programIds = bookmarks.map(b => b.contentId);
      
      if (programIds.length === 0) {
        return res.json([]);
      }
      
      const programs = await storage.getProgramsByIds(programIds);
      res.json(programs);
    } catch (error) {
      console.error("Error fetching favorite programs:", error);
      res.status(500).json({ message: "Failed to fetch favorite programs" });
    }
  });

  app.get('/api/favorites/workouts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const bookmarks = await storage.getUserBookmarksByType(userId, 'workout');
      const workoutIds = bookmarks.map(b => b.contentId);
      
      if (workoutIds.length === 0) {
        return res.json([]);
      }
      
      const workouts = await storage.getWorkoutsByIds(workoutIds);
      res.json(workouts);
    } catch (error) {
      console.error("Error fetching favorite workouts:", error);
      res.status(500).json({ message: "Failed to fetch favorite workouts" });
    }
  });

  // User notes routes
  app.get('/api/notes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { contentType, contentId } = req.query;
      const notes = await storage.getUserNotes(
        userId,
        contentType as string,
        contentId ? parseInt(contentId as string) : undefined
      );
      res.json(notes);
    } catch (error) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.post('/api/notes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const noteData = insertUserNoteSchema.parse({
        ...req.body,
        userId,
      });
      const note = await storage.createUserNote(noteData);
      res.json(note);
    } catch (error) {
      console.error("Error creating note:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  });

  app.put('/api/notes/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { note } = req.body;
      const updatedNote = await storage.updateUserNote(id, note);
      res.json(updatedNote);
    } catch (error) {
      console.error("Error updating note:", error);
      res.status(500).json({ message: "Failed to update note" });
    }
  });

  // Search route
  app.get('/api/search', async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ message: "Query parameter 'q' is required" });
      }
      
      const results = await storage.searchContent(q);
      res.json(results);
    } catch (error) {
      console.error("Error searching content:", error);
      res.status(500).json({ message: "Failed to search content" });
    }
  });

  // Injury tracking routes
  app.get("/api/injuries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const injuries = await storage.getInjuryLogs(userId);
      res.json(injuries);
    } catch (error) {
      console.error("Error fetching injuries:", error);
      res.status(500).json({ message: "Failed to fetch injuries" });
    }
  });

  app.get("/api/injuries/:id", isAuthenticated, async (req, res) => {
    try {
      const injury = await storage.getInjuryLogById(parseInt(req.params.id));
      if (!injury) {
        return res.status(404).json({ message: "Injury not found" });
      }
      res.json(injury);
    } catch (error) {
      console.error("Error fetching injury:", error);
      res.status(500).json({ message: "Failed to fetch injury" });
    }
  });

  app.post("/api/injuries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertInjuryLogSchema.parse({
        ...req.body,
        userId
      });
      
      const injury = await storage.createInjuryLog(validatedData);
      res.status(201).json(injury);
    } catch (error) {
      console.error("Error creating injury:", error);
      res.status(500).json({ message: "Failed to create injury" });
    }
  });

  app.put("/api/injuries/:id", isAuthenticated, async (req, res) => {
    try {
      const injury = await storage.updateInjuryLog(parseInt(req.params.id), req.body);
      res.json(injury);
    } catch (error) {
      console.error("Error updating injury:", error);
      res.status(500).json({ message: "Failed to update injury" });
    }
  });

  app.delete("/api/injuries/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteInjuryLog(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting injury:", error);
      res.status(500).json({ message: "Failed to delete injury" });
    }
  });

  // Daily severity tracking routes
  app.get("/api/injuries/:id/severity", isAuthenticated, async (req, res) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const severityLogs = await storage.getDailySeverityLogs(parseInt(req.params.id), days);
      res.json(severityLogs);
    } catch (error) {
      console.error("Error fetching severity logs:", error);
      res.status(500).json({ message: "Failed to fetch severity logs" });
    }
  });

  app.post("/api/injuries/:id/severity", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertDailySeverityLogSchema.parse({
        ...req.body,
        injuryLogId: parseInt(req.params.id)
      });
      
      const severityLog = await storage.createDailySeverityLog(validatedData);
      res.status(201).json(severityLog);
    } catch (error) {
      console.error("Error creating severity log:", error);
      res.status(500).json({ message: "Failed to create severity log" });
    }
  });

  app.get("/api/injuries/:id/severity/latest", isAuthenticated, async (req, res) => {
    try {
      const latestSeverity = await storage.getLatestSeverityForInjury(parseInt(req.params.id));
      res.json(latestSeverity);
    } catch (error) {
      console.error("Error fetching latest severity:", error);
      res.status(500).json({ message: "Failed to fetch latest severity" });
    }
  });

  // Recovery action routes
  app.get("/api/injuries/:id/recovery-actions", isAuthenticated, async (req, res) => {
    try {
      const actions = await storage.getRecoveryActions(parseInt(req.params.id));
      res.json(actions);
    } catch (error) {
      console.error("Error fetching recovery actions:", error);
      res.status(500).json({ message: "Failed to fetch recovery actions" });
    }
  });

  app.post("/api/injuries/:id/recovery-actions", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertRecoveryActionSchema.parse({
        ...req.body,
        injuryLogId: parseInt(req.params.id)
      });
      
      const action = await storage.createRecoveryAction(validatedData);
      res.status(201).json(action);
    } catch (error) {
      console.error("Error creating recovery action:", error);
      res.status(500).json({ message: "Failed to create recovery action" });
    }
  });

  app.put("/api/recovery-actions/:id", isAuthenticated, async (req, res) => {
    try {
      const action = await storage.updateRecoveryAction(parseInt(req.params.id), req.body);
      res.json(action);
    } catch (error) {
      console.error("Error updating recovery action:", error);
      res.status(500).json({ message: "Failed to update recovery action" });
    }
  });

  app.delete("/api/recovery-actions/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteRecoveryAction(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting recovery action:", error);
      res.status(500).json({ message: "Failed to delete recovery action" });
    }
  });

  // Recovery compliance routes
  app.get("/api/recovery-actions/:id/compliance", isAuthenticated, async (req, res) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const compliance = await storage.getRecoveryCompliance(parseInt(req.params.id), days);
      res.json(compliance);
    } catch (error) {
      console.error("Error fetching compliance:", error);
      res.status(500).json({ message: "Failed to fetch compliance" });
    }
  });

  app.post("/api/recovery-actions/:id/compliance", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertRecoveryComplianceSchema.parse({
        ...req.body,
        recoveryActionId: parseInt(req.params.id)
      });
      
      const compliance = await storage.createRecoveryCompliance(validatedData);
      res.status(201).json(compliance);
    } catch (error) {
      console.error("Error creating compliance:", error);
      res.status(500).json({ message: "Failed to create compliance" });
    }
  });

  app.get("/api/recovery-actions/:id/compliance/stats", isAuthenticated, async (req, res) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const stats = await storage.getComplianceStats(parseInt(req.params.id), days);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching compliance stats:", error);
      res.status(500).json({ message: "Failed to fetch compliance stats" });
    }
  });

  // Recovery alerts routes
  app.get("/api/recovery-alerts", isAuthenticated, async (req, res) => {
    try {
      const unreadOnly = req.query.unread === 'true';
      const alerts = await storage.getRecoveryAlerts(req.user.claims.sub, unreadOnly);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching recovery alerts:", error);
      res.status(500).json({ message: "Failed to fetch recovery alerts" });
    }
  });

  app.post("/api/recovery-alerts", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertRecoveryAlertSchema.parse({
        ...req.body,
        userId: req.user.claims.sub
      });
      
      const alert = await storage.createRecoveryAlert(validatedData);
      res.status(201).json(alert);
    } catch (error) {
      console.error("Error creating recovery alert:", error);
      res.status(500).json({ message: "Failed to create recovery alert" });
    }
  });

  app.put("/api/recovery-alerts/:id/read", isAuthenticated, async (req, res) => {
    try {
      await storage.markAlertAsRead(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error("Error marking alert as read:", error);
      res.status(500).json({ message: "Failed to mark alert as read" });
    }
  });

  app.put("/api/recovery-alerts/:id/dismiss", isAuthenticated, async (req, res) => {
    try {
      await storage.dismissAlert(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error("Error dismissing alert:", error);
      res.status(500).json({ message: "Failed to dismiss alert" });
    }
  });

  // Injury analysis route
  app.get("/api/injuries/:id/analysis", isAuthenticated, async (req, res) => {
    try {
      const analysis = await storage.analyzeInjuryProgress(parseInt(req.params.id));
      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing injury progress:", error);
      res.status(500).json({ message: "Failed to analyze injury progress" });
    }
  });

  // Admin routes - Programs
  app.post('/api/programs', isAuthenticated, async (req, res) => {
    try {
      const programData = insertProgramSchema.parse(req.body);
      const program = await storage.createProgram(programData);
      res.status(201).json(program);
    } catch (error) {
      console.error("Error creating program:", error);
      res.status(500).json({ message: "Failed to create program" });
    }
  });

  app.put('/api/programs/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const programData = insertProgramSchema.partial().parse(req.body);
      const program = await storage.updateProgram(id, programData);
      res.json(program);
    } catch (error) {
      console.error("Error updating program:", error);
      res.status(500).json({ message: "Failed to update program" });
    }
  });

  app.delete('/api/programs/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProgram(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting program:", error);
      res.status(500).json({ message: "Failed to delete program" });
    }
  });

  // Program enrollment routes
  app.post('/api/programs/:id/enroll', isAuthenticated, async (req: any, res) => {
    try {
      const programId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const forceReplace = req.body.forceReplace || false;
      
      const enrollment = await storage.enrollUserInProgram(userId, programId, undefined, 'main', forceReplace);
      
      // Log enrolled event for feedback loop
      try {
        await storage.createRecommendationEvent({
          userId,
          programId,
          eventType: 'enrolled',
          source: 'manual_browse',
          enrollmentId: enrollment?.id,
        });
      } catch (recErr) {
        console.error("Error logging enrollment event:", recErr);
      }

      // Check and award eligible badges after program enrollment
      try {
        const newBadges = await storage.checkUserBadgeEligibility(userId);
        if (newBadges.length > 0) {
          console.log(`[BADGE AWARDED] User ${userId} earned ${newBadges.length} badge(s): ${newBadges.map(b => b.name).join(', ')}`);
        }
      } catch (badgeError: any) {
        console.error(`[BADGE CHECK ERROR] Failed to check/award badges:`, badgeError?.message);
      }
      
      res.status(201).json(enrollment);
    } catch (error: any) {
      console.error("Error enrolling in program:", error);
      if (error.code === 'PROGRAMME_CONFLICT') {
        return res.status(409).json({
          code: 'PROGRAMME_CONFLICT',
          message: 'You already have an active programme enrolled',
          existingEnrollment: error.existingEnrollment,
        });
      }
      res.status(500).json({ message: "Failed to enroll in program" });
    }
  });

  app.post('/api/programs/:id/schedule', isAuthenticated, async (req: any, res) => {
    try {
      const programId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const { startDate } = req.body;
      
      if (!startDate) {
        return res.status(400).json({ message: "Start date is required" });
      }

      const enrollment = await storage.scheduleProgram(userId, programId, new Date(startDate));
      res.status(201).json(enrollment);
    } catch (error: any) {
      console.error("Error scheduling program:", error);
      if (error.code === 'PROGRAMME_CONFLICT') {
        return res.status(409).json({
          message: error.message,
          code: error.code,
          existingEnrollment: error.existingEnrollment,
        });
      }
      res.status(500).json({ message: "Failed to schedule program" });
    }
  });

  // ===== User-created programme routes =====
  app.get('/api/user-programmes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userPrograms = await storage.getUserCreatedPrograms(userId);

      const enriched = await Promise.all(userPrograms.map(async (prog) => {
        const weeks = await db.select().from(programWeeks)
          .where(eq(programWeeks.programId, prog.id));
        if (weeks.length === 0) return prog;

        const firstWeek = weeks[0];
        const days = await db.select({ id: programDays.id, position: programDays.position })
          .from(programDays)
          .where(eq(programDays.weekId, firstWeek.id));

        let workoutDayCount = 0;
        for (const day of days) {
          const dayWorkouts = await db.select({ id: programmeWorkouts.id })
            .from(programmeWorkouts)
            .where(eq(programmeWorkouts.dayId, day.id))
            .limit(1);
          if (dayWorkouts.length > 0) workoutDayCount++;
        }

        return { ...prog, trainingDaysPerWeek: workoutDayCount };
      }));

      res.json(enriched);
    } catch (error) {
      console.error("Error fetching user programmes:", error);
      res.status(500).json({ message: "Failed to fetch your programmes" });
    }
  });

  app.post('/api/user-programmes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { title, description, goal, equipment, weeks, difficulty, trainingDaysPerWeek, imageUrl } = req.body;

      if (!title || !description || !goal || !equipment || !weeks || !difficulty) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const program = await storage.createProgram({
        title,
        description,
        goal,
        equipment,
        weeks: parseInt(weeks),
        duration: parseInt(weeks) * 7,
        difficulty,
        trainingDaysPerWeek: trainingDaysPerWeek !== undefined ? trainingDaysPerWeek : 3,
        programmeType: 'main',
        sourceType: 'user_created',
        createdByUserId: userId,
        imageUrl: imageUrl || null,
      });

      // Create week structures
      for (let w = 1; w <= parseInt(weeks); w++) {
        await db.insert(programWeeks).values({
          programId: program.id,
          weekNumber: w,
        });
      }

      res.status(201).json(program);
    } catch (error) {
      console.error("Error creating user programme:", error);
      res.status(500).json({ message: "Failed to create programme" });
    }
  });

  app.get('/api/user-programmes/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const programId = parseInt(req.params.id);
      const program = await storage.getUserCreatedProgramById(userId, programId);
      if (!program) {
        return res.status(404).json({ message: "Programme not found" });
      }
      res.json(program);
    } catch (error) {
      console.error("Error fetching user programme:", error);
      res.status(500).json({ message: "Failed to fetch programme" });
    }
  });

  app.put('/api/user-programmes/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const programId = parseInt(req.params.id);
      const existing = await storage.getUserCreatedProgramById(userId, programId);
      if (!existing) {
        return res.status(404).json({ message: "Programme not found or not yours" });
      }

      const { title, description, goal, equipment, weeks, difficulty, trainingDaysPerWeek, imageUrl } = req.body;
      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (goal !== undefined) updates.goal = goal;
      if (equipment !== undefined) updates.equipment = equipment;
      if (difficulty !== undefined) updates.difficulty = difficulty;
      if (trainingDaysPerWeek !== undefined) updates.trainingDaysPerWeek = trainingDaysPerWeek;
      if (imageUrl !== undefined) updates.imageUrl = imageUrl;

      if (weeks !== undefined && parseInt(weeks) !== existing.weeks) {
        const newWeeks = parseInt(weeks);
        updates.weeks = newWeeks;
        updates.duration = newWeeks * 7;

        const existingWeeks = await db.select().from(programWeeks)
          .where(eq(programWeeks.programId, programId))
          .orderBy(asc(programWeeks.weekNumber));

        if (newWeeks > existingWeeks.length) {
          for (let w = existingWeeks.length + 1; w <= newWeeks; w++) {
            await db.insert(programWeeks).values({ programId, weekNumber: w });
          }
        } else if (newWeeks < existingWeeks.length) {
          const weeksToRemove = existingWeeks.slice(newWeeks);
          for (const week of weeksToRemove) {
            await db.delete(programWeeks).where(eq(programWeeks.id, week.id));
          }
        }
      }

      const updated = await storage.updateProgram(programId, updates);
      res.json(updated);
    } catch (error) {
      console.error("Error updating user programme:", error);
      res.status(500).json({ message: "Failed to update programme" });
    }
  });

  app.delete('/api/user-programmes/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const programId = parseInt(req.params.id);
      const existing = await storage.getUserCreatedProgramById(userId, programId);
      if (!existing) {
        return res.status(404).json({ message: "Programme not found or not yours" });
      }
      await storage.deleteProgram(programId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user programme:", error);
      res.status(500).json({ message: "Failed to delete programme" });
    }
  });

  // Get the full schedule structure for a user programme
  app.get('/api/user-programmes/:id/schedule', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const programId = parseInt(req.params.id);
      const existing = await storage.getUserCreatedProgramById(userId, programId);
      if (!existing) {
        return res.status(404).json({ message: "Programme not found or not yours" });
      }

      const weeks = await db.select().from(programWeeks)
        .where(eq(programWeeks.programId, programId))
        .orderBy(asc(programWeeks.weekNumber));

      const schedule = [];
      for (const week of weeks) {
        const days = await db.select().from(programDays)
          .where(eq(programDays.weekId, week.id))
          .orderBy(asc(programDays.position));

        const weekData: any = { ...week, days: [] };
        for (const day of days) {
          const workouts = await db.select().from(programmeWorkouts)
            .where(eq(programmeWorkouts.dayId, day.id))
            .orderBy(asc(programmeWorkouts.position));

          const workoutsWithBlocks = [];
          for (const workout of workouts) {
            const blocks = await db.select().from(programmeWorkoutBlocks)
              .where(eq(programmeWorkoutBlocks.workoutId, workout.id))
              .orderBy(asc(programmeWorkoutBlocks.position));

            const blocksWithExercises = [];
            for (const block of blocks) {
              const exercises = await db.select().from(programmeBlockExercises)
                .where(eq(programmeBlockExercises.blockId, block.id))
                .orderBy(asc(programmeBlockExercises.position));
              blocksWithExercises.push({ ...block, exercises });
            }
            workoutsWithBlocks.push({ ...workout, blocks: blocksWithExercises });
          }
          weekData.days.push({ ...day, workouts: workoutsWithBlocks });
        }
        schedule.push(weekData);
      }

      res.json(schedule);
    } catch (error) {
      console.error("Error fetching user programme schedule:", error);
      res.status(500).json({ message: "Failed to fetch schedule" });
    }
  });

  // Add a workout to a user programme (to a specific day)
  app.post('/api/user-programmes/:id/workouts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const programId = parseInt(req.params.id);
      const existing = await storage.getUserCreatedProgramById(userId, programId);
      if (!existing) {
        return res.status(404).json({ message: "Programme not found or not yours" });
      }

      const { weekNumber, dayPosition, name, description, workoutType, category, difficulty, duration } = req.body;
      if (!weekNumber || dayPosition === undefined || !name) {
        return res.status(400).json({ message: "weekNumber, dayPosition, and name are required" });
      }

      // Find or create the week
      let [week] = await db.select().from(programWeeks)
        .where(and(
          eq(programWeeks.programId, programId),
          eq(programWeeks.weekNumber, parseInt(weekNumber))
        ));

      if (!week) {
        [week] = await db.insert(programWeeks)
          .values({ programId, weekNumber: parseInt(weekNumber) })
          .returning();
      }

      // Find or create the day
      let [day] = await db.select().from(programDays)
        .where(and(
          eq(programDays.weekId, week.id),
          eq(programDays.position, parseInt(dayPosition))
        ));

      if (!day) {
        [day] = await db.insert(programDays)
          .values({ weekId: week.id, position: parseInt(dayPosition) })
          .returning();
      }

      // Get max position for existing workouts on this day
      const existingWorkouts = await db.select().from(programmeWorkouts)
        .where(eq(programmeWorkouts.dayId, day.id));
      const maxPos = existingWorkouts.length > 0
        ? Math.max(...existingWorkouts.map(w => w.position ?? 0)) + 1
        : 0;

      const [workout] = await db.insert(programmeWorkouts)
        .values({
          dayId: day.id,
          name,
          description: description || null,
          workoutType: workoutType || 'regular',
          category: category || 'strength',
          difficulty: difficulty || 'beginner',
          duration: duration || 30,
          position: maxPos,
        })
        .returning();

      res.status(201).json(workout);
    } catch (error) {
      console.error("Error adding workout to user programme:", error);
      res.status(500).json({ message: "Failed to add workout" });
    }
  });

  // Update a workout in a user programme
  app.put('/api/user-programmes/:id/workouts/:workoutId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const programId = parseInt(req.params.id);
      const workoutId = parseInt(req.params.workoutId);
      const existing = await storage.getUserCreatedProgramById(userId, programId);
      if (!existing) {
        return res.status(404).json({ message: "Programme not found or not yours" });
      }

      const { name, description, workoutType, category, difficulty, duration } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (workoutType !== undefined) updates.workoutType = workoutType;
      if (category !== undefined) updates.category = category;
      if (difficulty !== undefined) updates.difficulty = difficulty;
      if (duration !== undefined) updates.duration = duration;

      const [updated] = await db.update(programmeWorkouts)
        .set(updates)
        .where(eq(programmeWorkouts.id, workoutId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error updating workout:", error);
      res.status(500).json({ message: "Failed to update workout" });
    }
  });

  // Delete a workout from a user programme
  app.delete('/api/user-programmes/:id/workouts/:workoutId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const programId = parseInt(req.params.id);
      const workoutId = parseInt(req.params.workoutId);
      const existing = await storage.getUserCreatedProgramById(userId, programId);
      if (!existing) {
        return res.status(404).json({ message: "Programme not found or not yours" });
      }

      await db.delete(programmeWorkouts).where(eq(programmeWorkouts.id, workoutId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting workout:", error);
      res.status(500).json({ message: "Failed to delete workout" });
    }
  });

  // Add exercise block to a workout in user programme
  app.post('/api/user-programmes/workouts/:workoutId/blocks', isAuthenticated, async (req: any, res) => {
    try {
      const workoutId = parseInt(req.params.workoutId);
      const { section, blockType, position, rest, exercises } = req.body;

      const [block] = await db.insert(programmeWorkoutBlocks)
        .values({
          workoutId,
          section: section || 'main',
          blockType: blockType || 'single',
          position: position || 0,
          rest: rest || '60 sec',
        })
        .returning();

      // Add exercises to the block if provided
      if (exercises && Array.isArray(exercises)) {
        for (let i = 0; i < exercises.length; i++) {
          const ex = exercises[i];
          await db.insert(programmeBlockExercises).values({
            blockId: block.id,
            exerciseLibraryId: ex.exerciseLibraryId || null,
            position: i,
            sets: ex.sets || JSON.stringify([{ reps: '10' }]),
            durationType: ex.durationType || 'text',
            tempo: ex.tempo || null,
            load: ex.load || null,
            notes: ex.notes || null,
          });
        }
      }

      // Fetch block with exercises
      const blockExercises = await db.select().from(programmeBlockExercises)
        .where(eq(programmeBlockExercises.blockId, block.id))
        .orderBy(asc(programmeBlockExercises.position));

      res.status(201).json({ ...block, exercises: blockExercises });
    } catch (error) {
      console.error("Error adding block to workout:", error);
      res.status(500).json({ message: "Failed to add exercise block" });
    }
  });

  // Batch update blocks for a workout in user programme
  app.put('/api/user-programmes/workouts/:workoutId/blocks/batch', isAuthenticated, async (req: any, res) => {
    try {
      const workoutId = parseInt(req.params.workoutId);
      const { blocks } = req.body;

      if (!blocks || !Array.isArray(blocks)) {
        return res.status(400).json({ message: "blocks array is required" });
      }

      // Delete existing blocks for this workout
      const existingBlocks = await db.select().from(programmeWorkoutBlocks)
        .where(eq(programmeWorkoutBlocks.workoutId, workoutId));
      for (const eb of existingBlocks) {
        await db.delete(programmeBlockExercises).where(eq(programmeBlockExercises.blockId, eb.id));
      }
      await db.delete(programmeWorkoutBlocks).where(eq(programmeWorkoutBlocks.workoutId, workoutId));

      // Create new blocks with exercises
      const createdBlocks = [];
      for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
        const b = blocks[bIdx];
        const [newBlock] = await db.insert(programmeWorkoutBlocks)
          .values({
            workoutId,
            section: b.section || 'main',
            blockType: b.blockType || 'single',
            position: bIdx,
            rest: b.rest || '60 sec',
          })
          .returning();

        const blockExercises = [];
        if (b.exercises && Array.isArray(b.exercises)) {
          for (let eIdx = 0; eIdx < b.exercises.length; eIdx++) {
            const ex = b.exercises[eIdx];
            const [newEx] = await db.insert(programmeBlockExercises)
              .values({
                blockId: newBlock.id,
                exerciseLibraryId: ex.exerciseLibraryId || null,
                position: eIdx,
                sets: typeof ex.sets === 'string' ? JSON.parse(ex.sets) : (ex.sets || [{ reps: '10' }]),
                durationType: ex.durationType || 'text',
                tempo: ex.tempo || null,
                load: ex.load || null,
                notes: ex.notes || null,
              })
              .returning();
            blockExercises.push(newEx);
          }
        }
        createdBlocks.push({ ...newBlock, exercises: blockExercises });
      }

      res.json(createdBlocks);
    } catch (error) {
      console.error("Error batch updating blocks:", error);
      res.status(500).json({ message: "Failed to update workout exercises" });
    }
  });

  app.get('/api/my-programs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const enrollments = await storage.getUserEnrolledPrograms(userId);
      res.json(enrollments);
    } catch (error) {
      console.error("Error fetching enrolled programs:", error);
      res.status(500).json({ message: "Failed to fetch enrolled programs" });
    }
  });

  app.delete('/api/my-programs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const enrollmentId = parseInt(req.params.id);
      
      if (isNaN(enrollmentId)) {
        return res.status(400).json({ message: "Invalid enrollment ID" });
      }

      // Get enrollment details before unenrolling for feedback loop
      let enrollmentDetails: any = null;
      try {
        enrollmentDetails = await storage.getEnrollmentById(enrollmentId);
      } catch {}

      await storage.unenrollFromProgram(userId, enrollmentId);

      // Log abandoned event for feedback loop
      if (enrollmentDetails) {
        try {
          const completionPercent = enrollmentDetails.totalWorkouts > 0
            ? Math.round((enrollmentDetails.workoutsCompleted / enrollmentDetails.totalWorkouts) * 100)
            : 0;
          await storage.createRecommendationEvent({
            userId,
            programId: enrollmentDetails.programId,
            eventType: 'abandoned',
            source: 'manual_browse',
            enrollmentId,
            completionPercent,
            weeksCompleted: Math.ceil((enrollmentDetails.workoutsCompleted || 0) / 5),
          });
        } catch (recErr) {
          console.error("Error logging abandonment event:", recErr);
        }
      }

      res.status(200).json({ message: "Successfully unenrolled from programme" });
    } catch (error) {
      console.error("Error unenrolling from program:", error);
      res.status(500).json({ message: "Failed to unenroll from programme" });
    }
  });

  app.patch('/api/enrollments/:id/reschedule', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const enrollmentId = parseInt(req.params.id);
      const { startDate } = req.body;

      if (isNaN(enrollmentId)) {
        return res.status(400).json({ message: "Invalid enrollment ID" });
      }
      if (!startDate) {
        return res.status(400).json({ message: "startDate is required" });
      }

      const newStart = new Date(startDate);
      if (isNaN(newStart.getTime())) {
        return res.status(400).json({ message: "Invalid startDate" });
      }

      const result = await storage.rescheduleEnrollment(userId, enrollmentId, newStart);
      res.json(result);
    } catch (error: any) {
      console.error("Error rescheduling enrollment:", error);
      res.status(500).json({ message: error.message || "Failed to reschedule programme" });
    }
  });

  app.get('/api/my-programs/timeline', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const timeline = await storage.getUserProgramTimeline(userId);
      res.json(timeline);
    } catch (error) {
      console.error("Error fetching program timeline:", error);
      res.status(500).json({ message: "Failed to fetch program timeline" });
    }
  });

  app.get('/api/today-workout', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const date = req.query.date ? new Date(req.query.date) : undefined;
      
      // First check for scheduled workouts - they take priority over programme workouts
      const scheduledForDate = await storage.getScheduledWorkoutsForDate(userId, date || new Date());
      
      if (scheduledForDate.length > 0) {
        // Return the first scheduled workout (scheduled workouts override programme workouts)
        const scheduled = scheduledForDate[0];
        return res.json({
          id: scheduled.id,
          workoutId: scheduled.workoutId,
          workoutName: scheduled.workoutName,
          workoutType: scheduled.workoutType,
          scheduledDate: scheduled.scheduledDate,
          isScheduled: true,
        });
      }
      
      // No scheduled workout - return programme workout instead
      const todayWorkout = await storage.getTodayWorkout(userId, date);
      res.json(todayWorkout);
    } catch (error) {
      console.error("Error fetching today's workout:", error);
      res.status(500).json({ message: "Failed to fetch today's workout" });
    }
  });

  // Get all workouts for today (including extra sessions) - supports multiple workouts per day
  app.get('/api/today-workouts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const queryDate = req.query.date ? new Date(req.query.date) : new Date();
      const workouts: any[] = [];
      
      // Get scheduled standalone workouts
      const scheduledForDate = await storage.getScheduledWorkoutsForDate(userId, queryDate);
      for (const scheduled of scheduledForDate) {
        // For scheduled workouts with workoutId=0, try to find matching programme workout
        let enrollmentInfo: { enrollmentId?: number; week?: number; day?: number } = {};
        if (!scheduled.workoutId || scheduled.workoutId === 0) {
          // Look for an active enrollment and matching workout by name
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
                  eq(enrollmentWorkouts.name, scheduled.workoutName),
                  eq(enrollmentWorkouts.weekNumber, 1)
                )
              )
              .limit(1);
            
            if (matchingWorkout) {
              // Calculate week based on date difference
              const startDate = new Date(activeEnrollment.startDate);
              const scheduledDate = new Date(scheduled.scheduledDate);
              const daysDiff = Math.floor((scheduledDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
              const week = Math.floor(daysDiff / 7) + 1;
              
              enrollmentInfo = {
                enrollmentId: activeEnrollment.id,
                week: week,
                day: matchingWorkout.dayNumber,
              };
            }
          }
        }
        
        // Find the workout log if completed
        let scheduledLogId = null;
        if (scheduled.isCompleted) {
          const [completedLog] = await db
            .select({ id: workoutLogs.id })
            .from(workoutLogs)
            .where(
              and(
                eq(workoutLogs.userId, userId),
                eq(workoutLogs.workoutName, scheduled.workoutName),
                eq(workoutLogs.status, 'completed')
              )
            )
            .orderBy(sql`${workoutLogs.completedAt} DESC`)
            .limit(1);
          scheduledLogId = completedLog?.id || null;
        }
        
        workouts.push({
          id: `scheduled-${scheduled.id}`,
          workoutId: scheduled.workoutId,
          workoutName: scheduled.workoutName,
          workoutType: scheduled.workoutType || 'regular',
          category: scheduled.category || 'strength',
          scheduledDate: scheduled.scheduledDate,
          isScheduled: true,
          isExtra: enrollmentInfo.enrollmentId ? true : false,
          isCompleted: scheduled.isCompleted || false,
          completedAt: scheduled.completedAt,
          logId: scheduledLogId,
          ...enrollmentInfo,
        });
      }
      
      // Get ALL programme workouts for the date (handles multiple workouts on same day)
      const programmeWorkouts = await storage.getAllWorkoutsForDate(userId, queryDate);
      for (const programmeWorkout of programmeWorkouts) {
        // Check if this workout has been completed by looking for a completed workout log
        const [completedLog] = await db
          .select({ id: workoutLogs.id, completedAt: workoutLogs.completedAt })
          .from(workoutLogs)
          .where(
            and(
              eq(workoutLogs.userId, userId),
              eq(workoutLogs.enrollmentId, programmeWorkout.enrollmentId),
              eq(workoutLogs.week, programmeWorkout.week),
              eq(workoutLogs.day, programmeWorkout.day),
              eq(workoutLogs.status, 'completed')
            )
          )
          .limit(1);
        
        workouts.push({
          id: `programme-${programmeWorkout.enrollmentId}-${programmeWorkout.week}-${programmeWorkout.day}-${programmeWorkout.enrollmentWorkoutId}`,
          enrollmentId: programmeWorkout.enrollmentId,
          enrollmentWorkoutId: programmeWorkout.enrollmentWorkoutId,
          week: programmeWorkout.week,
          day: programmeWorkout.day,
          workoutName: programmeWorkout.workoutName,
          workoutType: programmeWorkout.workoutType || 'regular',
          category: programmeWorkout.category || 'strength',
          programName: programmeWorkout.programName,
          isProgramme: true,
          isExtra: false,
          isCompleted: !!completedLog,
          completedAt: completedLog?.completedAt,
          logId: completedLog?.id,
        });
      }
      
      // Get extra sessions for this date
      const dateStr = queryDate.toISOString().split('T')[0];
      const extraSessionsBase = await db
        .select({
          id: userExtraWorkoutSessions.id,
          enrollmentId: userExtraWorkoutSessions.enrollmentId,
          dayPosition: userExtraWorkoutSessions.dayPosition,
          scheduledDate: userExtraWorkoutSessions.scheduledDate,
          programId: userProgramEnrollments.programId,
          startDate: userProgramEnrollments.startDate,
        })
        .from(userExtraWorkoutSessions)
        .innerJoin(userProgramEnrollments, eq(userExtraWorkoutSessions.enrollmentId, userProgramEnrollments.id))
        .where(
          and(
            eq(userProgramEnrollments.userId, userId),
            eq(userExtraWorkoutSessions.completed, false)
          )
        );
      
      // Filter extra sessions for today's date and fetch workout info
      for (const extra of extraSessionsBase) {
        const extraDateStr = extra.scheduledDate.toISOString().split('T')[0];
        if (extraDateStr === dateStr) {
          const startDate = new Date(extra.startDate);
          const sessionDate = new Date(extra.scheduledDate);
          const daysDiff = Math.floor((sessionDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const week = Math.floor(daysDiff / 7) + 1;
          
          // Fetch workout info for this day position from enrollment snapshots
          const workoutInfo = await db
            .select({
              name: enrollmentWorkouts.name,
              workoutType: enrollmentWorkouts.workoutType,
              category: enrollmentWorkouts.category,
            })
            .from(enrollmentWorkouts)
            .where(
              and(
                eq(enrollmentWorkouts.enrollmentId, extra.enrollmentId),
                eq(enrollmentWorkouts.weekNumber, 1),
                eq(enrollmentWorkouts.dayNumber, extra.dayPosition)
              )
            )
            .limit(1);
          
          if (workoutInfo.length > 0) {
            workouts.push({
              id: `extra-${extra.id}`,
              enrollmentId: extra.enrollmentId,
              week: week,
              day: extra.dayPosition,
              workoutName: workoutInfo[0].name,
              workoutType: workoutInfo[0].workoutType || 'regular',
              category: workoutInfo[0].category || 'strength',
              isProgramme: true,
              isExtra: true,
              extraSessionId: extra.id,
            });
          }
        }
      }
      
      res.json(workouts);
    } catch (error) {
      console.error("Error fetching today's workouts:", error);
      res.status(500).json({ message: "Failed to fetch today's workouts" });
    }
  });

  app.get('/api/my-programs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const enrollmentId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      if (!enrollmentId || isNaN(enrollmentId)) {
        return res.status(400).json({ message: "Invalid enrollment ID" });
      }
      
      const programDetails = await storage.getEnrolledProgramDetails(userId, enrollmentId);
      res.json(programDetails);
    } catch (error: any) {
      console.error("Error fetching program details:", error);
      if (error.message?.includes('not found')) {
        return res.status(404).json({ message: "Enrollment not found" });
      }
      res.status(500).json({ message: "Failed to fetch program details" });
    }
  });

  app.get('/api/my-programs/:id/stats', isAuthenticated, async (req: any, res) => {
    try {
      const enrollmentId = parseInt(req.params.id);
      const userId = req.user.claims.sub;

      if (!enrollmentId || isNaN(enrollmentId)) {
        return res.status(400).json({ message: "Invalid enrollment ID" });
      }

      const [enrollment] = await db
        .select({
          id: userProgramEnrollments.id,
          programId: userProgramEnrollments.programId,
          startDate: userProgramEnrollments.startDate,
          endDate: userProgramEnrollments.endDate,
          status: userProgramEnrollments.status,
          workoutsCompleted: userProgramEnrollments.workoutsCompleted,
          totalWorkouts: userProgramEnrollments.totalWorkouts,
          programType: userProgramEnrollments.programType,
          programTitle: programs.title,
          programGoal: programs.goal,
          programWeeks: programs.weeks,
          programDifficulty: programs.difficulty,
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
        return res.status(404).json({ message: "Enrollment not found" });
      }

      const logs = await db
        .select({
          id: workoutLogs.id,
          workoutName: workoutLogs.workoutName,
          startedAt: workoutLogs.startedAt,
          completedAt: workoutLogs.completedAt,
          duration: workoutLogs.duration,
          status: workoutLogs.status,
          workoutRating: workoutLogs.workoutRating,
          autoCalculatedVolume: workoutLogs.autoCalculatedVolume,
          week: workoutLogs.week,
          day: workoutLogs.day,
        })
        .from(workoutLogs)
        .where(
          and(
            eq(workoutLogs.userId, userId),
            eq(workoutLogs.enrollmentId, enrollmentId),
            eq(workoutLogs.status, 'completed')
          )
        )
        .orderBy(workoutLogs.completedAt);

      const totalVolume = logs.reduce((sum, l) => sum + (l.autoCalculatedVolume || 0), 0);
      const totalDuration = logs.reduce((sum, l) => sum + (l.duration || 0), 0);
      const avgSessionLength = logs.length > 0 ? Math.round(totalDuration / logs.length) : 0;
      const ratedLogs = logs.filter(l => l.workoutRating && l.workoutRating > 0);
      const avgRating = ratedLogs.length > 0 ? Math.round(ratedLogs.reduce((sum, l) => sum + (l.workoutRating || 0), 0) / ratedLogs.length * 10) / 10 : null;

      const completionRate = enrollment.totalWorkouts > 0
        ? Math.round((enrollment.workoutsCompleted / enrollment.totalWorkouts) * 100)
        : 0;

      const exerciseLogs = logs.length > 0 ? await db
        .select({
          id: workoutExerciseLogs.id,
          workoutLogId: workoutExerciseLogs.workoutLogId,
          exerciseName: workoutExerciseLogs.exerciseName,
          exerciseLibraryId: workoutExerciseLogs.exerciseLibraryId,
        })
        .from(workoutExerciseLogs)
        .where(
          inArray(workoutExerciseLogs.workoutLogId, logs.map(l => l.id))
        ) : [];

      const setLogs = exerciseLogs.length > 0 ? await db
        .select({
          exerciseLogId: workoutSetLogs.exerciseLogId,
          actualReps: workoutSetLogs.actualReps,
          actualWeight: workoutSetLogs.actualWeight,
          isCompleted: workoutSetLogs.isCompleted,
        })
        .from(workoutSetLogs)
        .where(
          inArray(workoutSetLogs.exerciseLogId, exerciseLogs.map(e => e.id))
        ) : [];

      const totalSets = setLogs.filter(s => s.isCompleted).length;
      const totalReps = setLogs.reduce((sum, s) => sum + (s.actualReps || 0), 0);

      const prMap = new Map<string, { weight: number; reps: number }>();
      for (const el of exerciseLogs) {
        const sets = setLogs.filter(s => s.exerciseLogId === el.id);
        for (const s of sets) {
          if (s.actualWeight && s.actualWeight > 0) {
            const key = el.exerciseName;
            const existing = prMap.get(key);
            if (!existing || s.actualWeight > existing.weight) {
              prMap.set(key, { weight: s.actualWeight, reps: s.actualReps || 0 });
            }
          }
        }
      }
      const personalRecords = Array.from(prMap.entries())
        .map(([name, data]) => ({ exerciseName: name, bestWeight: data.weight, bestReps: data.reps }))
        .sort((a, b) => b.bestWeight - a.bestWeight)
        .slice(0, 10);

      const workoutCalendar = logs.map(l => ({
        date: l.completedAt ? new Date(l.completedAt).toISOString().split('T')[0] : null,
        workoutName: l.workoutName,
        workoutLogId: l.id,
        duration: l.duration,
        volume: l.autoCalculatedVolume,
        rating: l.workoutRating,
        week: l.week,
        day: l.day,
      })).filter(l => l.date);

      const weeklyConsistency: Record<number, number> = {};
      for (const l of logs) {
        if (l.week) {
          weeklyConsistency[l.week] = (weeklyConsistency[l.week] || 0) + 1;
        }
      }

      const scheduledDays: { week: number; dayPosition: number; workoutName: string }[] = [];
      const progWeeks = await db.select({ id: programWeeks.id, weekNumber: programWeeks.weekNumber })
        .from(programWeeks).where(eq(programWeeks.programId, enrollment.programId));
      for (const pw of progWeeks) {
        const days = await db.select({ id: programDays.id, position: programDays.position })
          .from(programDays).where(eq(programDays.weekId, pw.id));
        for (const d of days) {
          const dayWorkouts = await db.select({ name: programmeWorkouts.name })
            .from(programmeWorkouts).where(eq(programmeWorkouts.dayId, d.id));
          for (const dw of dayWorkouts) {
            scheduledDays.push({ week: pw.weekNumber, dayPosition: d.position, workoutName: dw.name });
          }
        }
      }

      const exerciseWeeklyMap = new Map<string, Map<number, { bestWeight: number; bestReps: number; totalVolume: number; totalReps: number }>>();
      const exerciseAggMap = new Map<string, { maxWeight: number; maxReps: number; totalVolume: number; totalReps: number; sessionsCount: number; exerciseLibraryId: number | null; rm1: number | null; rm5: number | null; rm10: number | null }>();

      for (const el of exerciseLogs) {
        const logEntry = logs.find(l => l.id === el.workoutLogId);
        const week = logEntry?.week || 1;
        const sets = setLogs.filter(s => s.exerciseLogId === el.id);

        if (!exerciseWeeklyMap.has(el.exerciseName)) {
          exerciseWeeklyMap.set(el.exerciseName, new Map());
        }
        const weekMap = exerciseWeeklyMap.get(el.exerciseName)!;
        if (!weekMap.has(week)) {
          weekMap.set(week, { bestWeight: 0, bestReps: 0, totalVolume: 0, totalReps: 0 });
        }
        const weekData = weekMap.get(week)!;

        if (!exerciseAggMap.has(el.exerciseName)) {
          exerciseAggMap.set(el.exerciseName, { maxWeight: 0, maxReps: 0, totalVolume: 0, totalReps: 0, sessionsCount: 0, exerciseLibraryId: el.exerciseLibraryId, rm1: null, rm5: null, rm10: null });
        }
        const agg = exerciseAggMap.get(el.exerciseName)!;
        agg.sessionsCount++;

        for (const s of sets) {
          const w = s.actualWeight || 0;
          const r = s.actualReps || 0;
          const vol = w * r;
          weekData.totalVolume += vol;
          weekData.totalReps += r;
          if (w > weekData.bestWeight) { weekData.bestWeight = w; weekData.bestReps = r; }
          agg.totalVolume += vol;
          agg.totalReps += r;
          if (w > agg.maxWeight) { agg.maxWeight = w; }
          if (r > agg.maxReps) { agg.maxReps = r; }
          if (w > 0 && r >= 1 && r <= 1 && (agg.rm1 === null || w > agg.rm1)) { agg.rm1 = w; }
          if (w > 0 && r >= 5 && (agg.rm5 === null || w > agg.rm5)) { agg.rm5 = w; }
          if (w > 0 && r >= 10 && (agg.rm10 === null || w > agg.rm10)) { agg.rm10 = w; }
        }
      }

      const exerciseProgression = Array.from(exerciseWeeklyMap.entries()).map(([name, weekMap]) => {
        const weekly = Array.from(weekMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([week, data]) => ({ week, ...data }));
        return { exerciseName: name, weekly };
      });

      const allExerciseStats = Array.from(exerciseAggMap.entries())
        .map(([name, data]) => ({ exerciseName: name, ...data }))
        .sort((a, b) => b.totalVolume - a.totalVolume);

      let mostImproved: { exerciseName: string; startWeight: number; endWeight: number; improvement: number } | null = null;
      for (const ep of exerciseProgression) {
        if (ep.weekly.length < 2) continue;
        const firstWeek = ep.weekly[0];
        const lastWeek = ep.weekly[ep.weekly.length - 1];
        if (firstWeek.bestWeight > 0 && lastWeek.bestWeight > firstWeek.bestWeight) {
          const improvement = lastWeek.bestWeight - firstWeek.bestWeight;
          if (!mostImproved || improvement > mostImproved.improvement) {
            mostImproved = { exerciseName: ep.exerciseName, startWeight: firstWeek.bestWeight, endWeight: lastWeek.bestWeight, improvement };
          }
        }
      }

      const mostVolumeExercise = allExerciseStats.length > 0 ? allExerciseStats[0] : null;
      const mostRepsExercise = allExerciseStats.length > 0 ? [...allExerciseStats].sort((a, b) => b.totalReps - a.totalReps)[0] : null;
      const biggestSession = logs.length > 0 ? logs.reduce((best, l) => (!best || (l.autoCalculatedVolume || 0) > (best.autoCalculatedVolume || 0)) ? l : best, logs[0]) : null;

      res.json({
        enrollment: {
          id: enrollment.id,
          programId: enrollment.programId,
          programTitle: enrollment.programTitle,
          programGoal: enrollment.programGoal,
          programWeeks: enrollment.programWeeks,
          programDifficulty: enrollment.programDifficulty,
          startDate: enrollment.startDate,
          endDate: enrollment.endDate,
          status: enrollment.status,
          programType: enrollment.programType,
        },
        summary: {
          workoutsCompleted: enrollment.workoutsCompleted,
          totalWorkouts: enrollment.totalWorkouts,
          completionRate,
          totalVolume: Math.round(totalVolume),
          totalDuration,
          avgSessionLength,
          avgRating,
          totalSets,
          totalReps,
        },
        personalRecords,
        exerciseProgression,
        allExerciseStats,
        highlights: {
          mostImproved,
          mostVolumeExercise: mostVolumeExercise ? { exerciseName: mostVolumeExercise.exerciseName, totalVolume: mostVolumeExercise.totalVolume } : null,
          mostRepsExercise: mostRepsExercise ? { exerciseName: mostRepsExercise.exerciseName, totalReps: mostRepsExercise.totalReps } : null,
          biggestSession: biggestSession ? { workoutName: biggestSession.workoutName, volume: biggestSession.autoCalculatedVolume || 0, date: biggestSession.completedAt ? new Date(biggestSession.completedAt).toISOString().split('T')[0] : null, week: biggestSession.week } : null,
        },
        workoutCalendar,
        scheduledDays,
        weeklyConsistency,
      });
    } catch (error) {
      console.error("Error fetching enrollment stats:", error);
      res.status(500).json({ message: "Failed to fetch enrollment stats" });
    }
  });

  app.get('/api/my-programs/:id/ai-summary', isAuthenticated, async (req: any, res) => {
    try {
      const enrollmentId = parseInt(req.params.id);
      const userId = req.user.claims.sub;

      const [enrollment] = await db
        .select({
          id: userProgramEnrollments.id,
          workoutsCompleted: userProgramEnrollments.workoutsCompleted,
          totalWorkouts: userProgramEnrollments.totalWorkouts,
          startDate: userProgramEnrollments.startDate,
          endDate: userProgramEnrollments.endDate,
          programTitle: programs.title,
          programGoal: programs.goal,
          programWeeks: programs.weeks,
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
        return res.status(404).json({ message: "Enrollment not found" });
      }

      const logs = await db
        .select({
          id: workoutLogs.id,
          workoutName: workoutLogs.workoutName,
          completedAt: workoutLogs.completedAt,
          duration: workoutLogs.duration,
          workoutRating: workoutLogs.workoutRating,
          autoCalculatedVolume: workoutLogs.autoCalculatedVolume,
          week: workoutLogs.week,
        })
        .from(workoutLogs)
        .where(
          and(
            eq(workoutLogs.userId, userId),
            eq(workoutLogs.enrollmentId, enrollmentId),
            eq(workoutLogs.status, 'completed')
          )
        )
        .orderBy(workoutLogs.completedAt);

      const exerciseLogs = logs.length > 0 ? await db
        .select({
          id: workoutExerciseLogs.id,
          workoutLogId: workoutExerciseLogs.workoutLogId,
          exerciseName: workoutExerciseLogs.exerciseName,
        })
        .from(workoutExerciseLogs)
        .where(inArray(workoutExerciseLogs.workoutLogId, logs.map(l => l.id))) : [];

      const setLogs = exerciseLogs.length > 0 ? await db
        .select({
          exerciseLogId: workoutSetLogs.exerciseLogId,
          actualReps: workoutSetLogs.actualReps,
          actualWeight: workoutSetLogs.actualWeight,
        })
        .from(workoutSetLogs)
        .where(inArray(workoutSetLogs.exerciseLogId, exerciseLogs.map(e => e.id))) : [];

      const totalVolume = logs.reduce((sum, l) => sum + (l.autoCalculatedVolume || 0), 0);
      const totalDuration = logs.reduce((sum, l) => sum + (l.duration || 0), 0);
      const completionRate = enrollment.totalWorkouts > 0 ? Math.round((enrollment.workoutsCompleted / enrollment.totalWorkouts) * 100) : 0;

      const exerciseProgressMap = new Map<string, { firstWeekWeight: number; lastWeekWeight: number; firstWeek: number; lastWeek: number }>();
      for (const el of exerciseLogs) {
        const logEntry = logs.find(l => l.id === el.workoutLogId);
        const week = logEntry?.week || 1;
        const sets = setLogs.filter(s => s.exerciseLogId === el.id);
        const bestWeight = Math.max(...sets.map(s => s.actualWeight || 0), 0);
        if (bestWeight > 0) {
          const existing = exerciseProgressMap.get(el.exerciseName);
          if (!existing) {
            exerciseProgressMap.set(el.exerciseName, { firstWeekWeight: bestWeight, lastWeekWeight: bestWeight, firstWeek: week, lastWeek: week });
          } else {
            if (week < existing.firstWeek) { existing.firstWeekWeight = bestWeight; existing.firstWeek = week; }
            if (week > existing.lastWeek) { existing.lastWeekWeight = bestWeight; existing.lastWeek = week; }
          }
        }
      }
      const topProgressions = Array.from(exerciseProgressMap.entries())
        .filter(([, d]) => d.lastWeekWeight > d.firstWeekWeight)
        .map(([name, d]) => `${name}: ${d.firstWeekWeight}kg -> ${d.lastWeekWeight}kg (+${d.lastWeekWeight - d.firstWeekWeight}kg)`)
        .slice(0, 5)
        .join(', ');

      const totalReps = setLogs.reduce((sum, s) => sum + (s.actualReps || 0), 0);

      const exerciseVolumeMap = new Map<string, number>();
      const exerciseRepsMap = new Map<string, number>();
      for (const el of exerciseLogs) {
        const sets = setLogs.filter(s => s.exerciseLogId === el.id);
        const vol = sets.reduce((sum, s) => sum + ((s.actualWeight || 0) * (s.actualReps || 0)), 0);
        const reps = sets.reduce((sum, s) => sum + (s.actualReps || 0), 0);
        exerciseVolumeMap.set(el.exerciseName, (exerciseVolumeMap.get(el.exerciseName) || 0) + vol);
        exerciseRepsMap.set(el.exerciseName, (exerciseRepsMap.get(el.exerciseName) || 0) + reps);
      }
      const mostVolumeExercise = Array.from(exerciseVolumeMap.entries()).sort((a, b) => b[1] - a[1])[0];
      const mostRepsExercise = Array.from(exerciseRepsMap.entries()).sort((a, b) => b[1] - a[1])[0];

      const biggestSessionLog = logs.reduce((best, l) => (!best || (l.autoCalculatedVolume || 0) > (best.autoCalculatedVolume || 0)) ? l : best, logs[0]);

      const ratedLogs = logs.filter(l => l.workoutRating && l.workoutRating > 0);
      const avgRating = ratedLogs.length > 0 ? (ratedLogs.reduce((sum, l) => sum + (l.workoutRating || 0), 0) / ratedLogs.length).toFixed(1) : 'N/A';

      const prompt = `You are an expert strength and conditioning coach reviewing a client's completed training programme. Write a brief, personalised summary (4-5 sentences) that praises their effort, includes a creative real-world comparison for one of their stats, and gives one actionable tip for their next programme.

Programme: ${enrollment.programTitle}
Goal: ${enrollment.programGoal}
Duration: ${enrollment.programWeeks} weeks (${enrollment.startDate} to ${enrollment.endDate})
Completion: ${enrollment.workoutsCompleted}/${enrollment.totalWorkouts} workouts (${completionRate}%)
Total Volume: ${Math.round(totalVolume)} kg
Total Reps: ${totalReps}
Total Training Time: ${Math.round(totalDuration / 60)} minutes
Average Difficulty Rating: ${avgRating}/10 (1 = very easy, 10 = extremely hard)
Key Progressions: ${topProgressions || 'No significant weight progressions recorded'}
Most Volume Exercise: ${mostVolumeExercise ? `${mostVolumeExercise[0]} (${Math.round(mostVolumeExercise[1])} kg)` : 'N/A'}
Most Reps Exercise: ${mostRepsExercise ? `${mostRepsExercise[0]} (${mostRepsExercise[1]} reps)` : 'N/A'}
Biggest Session: ${biggestSessionLog ? `${biggestSessionLog.workoutName} (${Math.round(biggestSessionLog.autoCalculatedVolume || 0)} kg, Week ${biggestSessionLog.week})` : 'N/A'}

Rules:
- Be warm but professional. Do not be overly enthusiastic.
- Reference specific numbers from their data.
- Never use em dashes. Use commas or shorter sentences instead.
- Include ONE creative, fun real-world comparison to put their stats in perspective. For example, comparing total volume to the weight of animals (elephants, hippos, blue whales, gorillas), vehicles (cars, buses, Boeing 747s), food (bags of rice, watermelons), buildings, or everyday objects. Be wildly creative and vary this every single time. Never repeat the same comparison. Make the maths roughly accurate.
- Do NOT label it as a "fun fact" or use the word "equivalent". Weave it naturally into your summary, like "That is roughly the same as bench pressing a family car" or "You moved enough weight to fill a shipping container".
- Keep it concise, 4-5 sentences total.
- End with one forward-looking tip for their next programme.
- Interpret the difficulty rating correctly: a low rating means sessions felt easy, a high rating means they were challenging.`;

      const { getFeatureConfig, analyzeText } = await import('./aiProvider');
      const config = await getFeatureConfig('workout_coach');
      if (!config) {
        return res.json({ summary: `Great work completing ${completionRate}% of your ${enrollment.programTitle} programme. You logged ${Math.round(totalVolume)} kg of total volume across ${enrollment.workoutsCompleted} sessions. Keep building on this momentum in your next training block.` });
      }

      const aiResult = await analyzeText({ prompt, maxTokens: 400, temperature: 0.85 }, config.provider, config.model);
      res.json({ summary: aiResult.text || `Great work completing ${completionRate}% of your ${enrollment.programTitle} programme.` });
    } catch (error) {
      console.error("Error generating AI summary:", error);
      res.status(500).json({ summary: "Unable to generate summary at this time." });
    }
  });

  app.patch('/api/my-programs/:id/week-schedule', isAuthenticated, async (req: any, res) => {
    try {
      const enrollmentId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const { week, schedule } = req.body;

      if (!week || !schedule) {
        return res.status(400).json({ message: "Week and schedule are required" });
      }

      // Get enrollment with program details
      const [enrollment] = await db
        .select({
          id: userProgramEnrollments.id,
          programId: userProgramEnrollments.programId,
        })
        .from(userProgramEnrollments)
        .where(
          and(
            eq(userProgramEnrollments.id, enrollmentId),
            eq(userProgramEnrollments.userId, userId)
          )
        );

      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found" });
      }

      // Get all enrollment workouts for this enrollment
      const allEnrollmentWorkouts = await db
        .select()
        .from(enrollmentWorkouts)
        .where(eq(enrollmentWorkouts.enrollmentId, enrollmentId));

      // Build a map from Week 1 workout names to their current day numbers
      const week1Workouts = allEnrollmentWorkouts.filter(w => w.weekNumber === 1);
      const workoutsByName = new Map<string, typeof week1Workouts[0]>();
      for (const workout of week1Workouts) {
        workoutsByName.set(workout.name, workout);
      }

      // Build a map of workout name -> new day number from the schedule
      const nameToNewDay = new Map<string, number>();
      for (const [dayStr, workoutName] of Object.entries(schedule)) {
        const targetDayNum = parseInt(dayStr);
        if (!workoutName || workoutName === 'rest' || workoutName === '') continue;
        nameToNewDay.set(workoutName as string, targetDayNum);
      }

      // Update ALL weeks - the weekly schedule is a repeating pattern
      for (const workout of allEnrollmentWorkouts) {
        const newDayNum = nameToNewDay.get(workout.name);
        if (newDayNum !== undefined && workout.dayNumber !== newDayNum) {
          await db
            .update(enrollmentWorkouts)
            .set({ dayNumber: newDayNum })
            .where(eq(enrollmentWorkouts.id, workout.id));
        }
      }

      res.json({ success: true, message: "Schedule updated successfully" });
    } catch (error: any) {
      console.error("Error updating week schedule:", error);
      res.status(500).json({ message: "Failed to update schedule" });
    }
  });

  // Supplementary program routes
  app.post('/api/programs/:id/enroll-supplementary', isAuthenticated, async (req: any, res) => {
    try {
      const programId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      const enrollment = await storage.enrollUserInProgram(userId, programId, undefined, 'supplementary');
      res.status(201).json(enrollment);
    } catch (error: any) {
      console.error("Error enrolling in supplementary program:", error);
      res.status(error.message.includes('already has') ? 400 : 500).json({ 
        message: error.message || "Failed to enroll in supplementary program" 
      });
    }
  });

  app.post('/api/programs/:id/schedule-supplementary', isAuthenticated, async (req: any, res) => {
    try {
      const programId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const { startDate } = req.body;
      
      if (!startDate) {
        return res.status(400).json({ message: "Start date is required" });
      }

      const enrollment = await storage.scheduleProgram(userId, programId, new Date(startDate), 'supplementary');
      res.status(201).json(enrollment);
    } catch (error: any) {
      console.error("Error scheduling supplementary program:", error);
      res.status(error.message.includes('already has') ? 400 : 500).json({ 
        message: error.message || "Failed to schedule supplementary program" 
      });
    }
  });

  app.delete('/api/my-programs/supplementary', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.removeSupplementaryProgram(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing supplementary program:", error);
      res.status(500).json({ message: "Failed to remove supplementary program" });
    }
  });

  // Get workout schedule dates for a specific workout in a programme enrollment
  app.get('/api/my-programs/:enrollmentId/workout-schedule', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const enrollmentId = parseInt(req.params.enrollmentId);
      const { dayPosition } = req.query;
      
      if (!enrollmentId || !dayPosition) {
        return res.status(400).json({ message: "Enrollment ID and day position are required" });
      }
      
      const dayNum = parseInt(dayPosition as string);
      
      // Get the enrollment with program details
      const [enrollment] = await db
        .select({
          id: userProgramEnrollments.id,
          startDate: userProgramEnrollments.startDate,
          programId: userProgramEnrollments.programId,
        })
        .from(userProgramEnrollments)
        .where(
          and(
            eq(userProgramEnrollments.id, enrollmentId),
            eq(userProgramEnrollments.userId, userId)
          )
        );
      
      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found" });
      }
      
      // Get program weeks count
      const [program] = await db
        .select({ weeks: programs.weeks })
        .from(programs)
        .where(eq(programs.id, enrollment.programId));
      
      const totalWeeks = program?.weeks || 4;
      const startDate = new Date(enrollment.startDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Calculate all dates for this day position across all weeks
      const scheduledDates: string[] = [];
      let upcomingCount = 0;
      
      for (let week = 1; week <= totalWeeks; week++) {
        const daysOffset = ((week - 1) * 7) + (dayNum - 1);
        const workoutDate = new Date(startDate);
        workoutDate.setDate(workoutDate.getDate() + daysOffset);
        workoutDate.setHours(0, 0, 0, 0);
        
        const dateStr = workoutDate.toISOString().split('T')[0];
        scheduledDates.push(dateStr);
        
        if (workoutDate >= today) {
          upcomingCount++;
        }
      }
      
      // Get extra sessions for this day position from userExtraWorkoutSessions
      const extraSessions = await db
        .select({ scheduledDate: userExtraWorkoutSessions.scheduledDate })
        .from(userExtraWorkoutSessions)
        .where(
          and(
            eq(userExtraWorkoutSessions.enrollmentId, enrollmentId),
            eq(userExtraWorkoutSessions.dayPosition, dayNum)
          )
        );
      
      const extraDates = extraSessions.map(s => s.scheduledDate.toISOString().split('T')[0]);
      
      // Count extra sessions that are upcoming
      extraSessions.forEach(s => {
        const extraDate = new Date(s.scheduledDate);
        extraDate.setHours(0, 0, 0, 0);
        if (extraDate >= today) {
          upcomingCount++;
        }
      });
      
      // Also check scheduled_workouts table for legacy extra sessions
      // First get the workout name for this day position
      const [enrollmentWorkout] = await db
        .select({ name: enrollmentWorkouts.name })
        .from(enrollmentWorkouts)
        .where(
          and(
            eq(enrollmentWorkouts.enrollmentId, enrollmentId),
            eq(enrollmentWorkouts.dayNumber, dayNum),
            eq(enrollmentWorkouts.weekNumber, 1)
          )
        )
        .limit(1);
      
      if (enrollmentWorkout) {
        // Query scheduled_workouts for matching workout name (these are legacy extras)
        const programEndDate = new Date(startDate);
        programEndDate.setDate(programEndDate.getDate() + (totalWeeks * 7));
        
        const legacyExtras = await db
          .select({ scheduledDate: scheduledWorkouts.scheduledDate })
          .from(scheduledWorkouts)
          .where(
            and(
              eq(scheduledWorkouts.userId, userId),
              eq(scheduledWorkouts.workoutName, enrollmentWorkout.name),
              eq(scheduledWorkouts.workoutId, 0),
              gte(scheduledWorkouts.scheduledDate, startDate),
              lte(scheduledWorkouts.scheduledDate, programEndDate)
            )
          );
        
        // Add legacy extras (avoiding duplicates with regular scheduled dates)
        legacyExtras.forEach(s => {
          const dateStr = s.scheduledDate.toISOString().split('T')[0];
          if (!scheduledDates.includes(dateStr) && !extraDates.includes(dateStr)) {
            extraDates.push(dateStr);
            const extraDate = new Date(s.scheduledDate);
            extraDate.setHours(0, 0, 0, 0);
            if (extraDate >= today) {
              upcomingCount++;
            }
          }
        });
      }
      
      res.json({
        scheduledDates,
        upcomingCount,
        totalWeeks,
        extraDates,
      });
    } catch (error) {
      console.error("Error fetching workout schedule:", error);
      res.status(500).json({ message: "Failed to fetch workout schedule" });
    }
  });

  // Save extra workout sessions for a specific day position
  app.post('/api/my-programs/:enrollmentId/extra-sessions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const enrollmentId = parseInt(req.params.enrollmentId);
      const { dayPosition, extraDates } = req.body;
      
      if (!enrollmentId || !dayPosition) {
        return res.status(400).json({ message: "Enrollment ID and day position are required" });
      }
      
      const dayNum = parseInt(dayPosition);
      
      // Verify the enrollment belongs to this user
      const [enrollment] = await db
        .select({ id: userProgramEnrollments.id })
        .from(userProgramEnrollments)
        .where(
          and(
            eq(userProgramEnrollments.id, enrollmentId),
            eq(userProgramEnrollments.userId, userId)
          )
        );
      
      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found" });
      }
      
      // Delete existing extra sessions for this day position
      await db
        .delete(userExtraWorkoutSessions)
        .where(
          and(
            eq(userExtraWorkoutSessions.enrollmentId, enrollmentId),
            eq(userExtraWorkoutSessions.dayPosition, dayNum)
          )
        );
      
      // Insert new extra sessions
      if (extraDates && extraDates.length > 0) {
        const sessionsToInsert = extraDates.map((dateStr: string) => ({
          enrollmentId,
          dayPosition: dayNum,
          scheduledDate: new Date(dateStr),
        }));
        
        await db.insert(userExtraWorkoutSessions).values(sessionsToInsert);
      }
      
      res.json({ 
        success: true, 
        message: "Extra sessions saved",
        extraDates: extraDates || []
      });
    } catch (error) {
      console.error("Error saving extra sessions:", error);
      res.status(500).json({ message: "Failed to save extra sessions" });
    }
  });

  // Move a specific workout to a different date (affects only this individual workout instance)
  app.post('/api/my-programs/:enrollmentId/move-workout', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const enrollmentId = parseInt(req.params.enrollmentId);
      const { week, day, position, originalDate, newDate } = req.body;
      
      if (!enrollmentId || !week || !day || !newDate) {
        return res.status(400).json({ message: "Missing required parameters" });
      }
      
      // Verify the enrollment belongs to this user
      const [enrollment] = await db
        .select({ id: userProgramEnrollments.id, startDate: userProgramEnrollments.startDate })
        .from(userProgramEnrollments)
        .where(
          and(
            eq(userProgramEnrollments.id, enrollmentId),
            eq(userProgramEnrollments.userId, userId)
          )
        );
      
      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found" });
      }
      
      // Find the enrollment workout for this week/day/position
      // Position helps uniquely identify when multiple workouts are on the same day
      const conditions = [
        eq(enrollmentWorkouts.enrollmentId, enrollmentId),
        eq(enrollmentWorkouts.weekNumber, parseInt(week)),
        eq(enrollmentWorkouts.dayNumber, parseInt(day))
      ];
      
      if (position !== undefined) {
        conditions.push(eq(enrollmentWorkouts.position, parseInt(position)));
      }
      
      const [enrollmentWorkout] = await db
        .select()
        .from(enrollmentWorkouts)
        .where(and(...conditions))
        .limit(1);
      
      if (!enrollmentWorkout) {
        return res.status(404).json({ message: "Enrollment workout not found for this week/day" });
      }
      
      // Update the scheduled date override for this specific workout instance
      const newDateObj = new Date(newDate);
      const [updated] = await db
        .update(enrollmentWorkouts)
        .set({ scheduledDateOverride: newDateObj })
        .where(eq(enrollmentWorkouts.id, enrollmentWorkout.id))
        .returning();
      
      res.json({ 
        success: true, 
        message: "Workout moved successfully",
        workout: updated
      });
    } catch (error) {
      console.error("Error moving workout:", error);
      res.status(500).json({ message: "Failed to move workout" });
    }
  });

  // Admin routes - Videos
  app.post('/api/videos', isAuthenticated, async (req, res) => {
    try {
      const videoData = insertVideoSchema.parse(req.body);
      const video = await storage.createVideo(videoData);
      res.status(201).json(video);
    } catch (error) {
      console.error("Error creating video:", error);
      res.status(500).json({ message: "Failed to create video" });
    }
  });

  app.put('/api/videos/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const videoData = insertVideoSchema.partial().parse(req.body);
      const video = await storage.updateVideo(id, videoData);
      res.json(video);
    } catch (error) {
      console.error("Error updating video:", error);
      res.status(500).json({ message: "Failed to update video" });
    }
  });

  app.delete('/api/videos/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteVideo(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting video:", error);
      res.status(500).json({ message: "Failed to delete video" });
    }
  });

  // Admin routes - Recipes
  app.post('/api/recipes', isAuthenticated, async (req, res) => {
    try {
      const recipeData = insertRecipeSchema.parse(req.body);
      const recipe = await storage.createRecipe(recipeData);
      res.status(201).json(recipe);
    } catch (error) {
      console.error("Error creating recipe:", error);
      res.status(500).json({ message: "Failed to create recipe" });
    }
  });

  app.put('/api/recipes/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const recipeData = insertRecipeSchema.partial().parse(req.body);
      const recipe = await storage.updateRecipe(id, recipeData);
      res.json(recipe);
    } catch (error) {
      console.error("Error updating recipe:", error);
      res.status(500).json({ message: "Failed to update recipe" });
    }
  });

  app.delete('/api/recipes/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteRecipe(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting recipe:", error);
      res.status(500).json({ message: "Failed to delete recipe" });
    }
  });

  // Admin routes - Exercise Library
  app.post('/api/exercise-library', isAuthenticated, async (req, res) => {
    try {
      const exerciseData = insertExerciseLibraryItemSchema.parse(req.body);
      const exercise = await storage.createExercise(exerciseData);
      res.status(201).json(exercise);
    } catch (error) {
      console.error("Error creating exercise:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create exercise" });
    }
  });

  app.put('/api/exercise-library/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const exerciseData = insertExerciseLibraryItemSchema.partial().parse(req.body);
      const exercise = await storage.updateExercise(id, exerciseData);
      res.json(exercise);
    } catch (error) {
      console.error("Error updating exercise:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update exercise" });
    }
  });

  app.delete('/api/exercise-library/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteExercise(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting exercise:", error);
      res.status(500).json({ message: "Failed to delete exercise" });
    }
  });

  // Program workouts route
  app.get('/api/programs/:programId/workouts', async (req, res) => {
    try {
      const programId = parseInt(req.params.programId);
      const enrollmentId = req.query.enrollmentId ? parseInt(req.query.enrollmentId as string) : null;
      
      let workouts: any[];
      
      if (enrollmentId && !isNaN(enrollmentId)) {
        // Return enrollment-specific workouts with their correct day numbers from week 1
        let enrollmentWorkouts = await storage.getEnrollmentWorkoutsForUser(enrollmentId);
        
        // Add exercise counts for each enrollment workout
        for (const w of enrollmentWorkouts) {
          const blocks = await db.select({ id: enrollmentWorkoutBlocks.id })
            .from(enrollmentWorkoutBlocks)
            .where(eq(enrollmentWorkoutBlocks.enrollmentWorkoutId, w.id));
          let totalCount = 0;
          for (const b of blocks) {
            const exs = await db.select({ id: enrollmentBlockExercises.id })
              .from(enrollmentBlockExercises)
              .where(eq(enrollmentBlockExercises.enrollmentBlockId, b.id));
            totalCount += exs.length;
          }
          w.exerciseCount = totalCount;
          w.estimatedDuration = Math.round(totalCount * 1.75);
        }
        
        workouts = enrollmentWorkouts;
      } else {
        // Return template workouts
        workouts = await storage.getProgrammeWorkouts(programId);
      }

      res.json(workouts);
    } catch (error) {
      console.error("Error fetching program workouts:", error);
      res.status(500).json({ message: "Failed to fetch program workouts" });
    }
  });

  // Programme workout templates route - returns deduplicated workouts grouped by name
  app.get('/api/programs/:programId/workout-templates', async (req, res) => {
    try {
      const programId = parseInt(req.params.programId);
      const templates = await storage.getProgrammeWorkoutTemplates(programId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching workout templates:", error);
      res.status(500).json({ message: "Failed to fetch workout templates" });
    }
  });

  // Create a new programme workout
  app.post('/api/programs/:programId/workouts', isAuthenticated, async (req, res) => {
    try {
      const programId = parseInt(req.params.programId);
      const { name, description, workoutType, category, difficulty, duration, intervalRounds, intervalRestAfterRound, imageUrl, blocks, enrollmentId, targetDayPosition } = req.body;
      
      if (!name || name.trim() === '') {
        return res.status(400).json({ message: "Workout name is required" });
      }
      
      const workout = await storage.createProgrammeWorkout(programId, { 
        name: name.trim(), 
        description,
        workoutType: workoutType || 'regular',
        category: category || 'strength',
        difficulty: difficulty || 'beginner',
        duration: duration || 30,
        intervalRounds: intervalRounds || 4,
        intervalRestAfterRound: intervalRestAfterRound || '60 sec',
        targetDayPosition: targetDayPosition != null ? parseInt(targetDayPosition) : undefined,
      });

      // Track created template blocks/exercises so we can copy to enrollment
      const createdBlocks: Array<{ templateBlock: any; templateExercises: any[] }> = [];

      if (blocks && Array.isArray(blocks) && blocks.length > 0) {
        for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
          const b = blocks[bIdx];
          const [newBlock] = await db.insert(programmeWorkoutBlocks)
            .values({ workoutId: workout.id, section: b.section || 'main', blockType: b.blockType || 'single', position: bIdx, rest: b.rest || null })
            .returning();
          const templateExercises: any[] = [];
          if (b.exercises && Array.isArray(b.exercises)) {
            for (let eIdx = 0; eIdx < b.exercises.length; eIdx++) {
              const ex = b.exercises[eIdx];
              const [newEx] = await db.insert(programmeBlockExercises)
                .values({ blockId: newBlock.id, exerciseLibraryId: ex.exerciseLibraryId || null, position: eIdx, sets: ex.sets || [], tempo: ex.tempo || null, load: ex.load || null, notes: ex.notes || null })
                .returning();
              templateExercises.push(newEx);
            }
          }
          createdBlocks.push({ templateBlock: newBlock, templateExercises });
        }
      }

      // If an enrollmentId was provided, copy the new workout into the enrolled programme for every week
      if (enrollmentId && !isNaN(parseInt(enrollmentId))) {
        const eid = parseInt(enrollmentId);
        const [program] = await db.select().from(programs).where(eq(programs.id, programId));
        const totalWeeks = program?.weeks || 1;

        // Find out which day the template workout landed on
        const [day] = await db.select().from(programDays).where(eq(programDays.id, workout.dayId));
        const dayNumber = day ? day.position + 1 : 1;

        for (let weekNum = 1; weekNum <= totalWeeks; weekNum++) {
          const [ewRow] = await db.insert(enrollmentWorkouts).values({
            enrollmentId: eid,
            templateWorkoutId: workout.id,
            weekNumber: weekNum,
            dayNumber,
            name: workout.name,
            description: workout.description || null,
            workoutType: workout.workoutType || 'regular',
            category: workout.category || 'strength',
            difficulty: workout.difficulty || 'beginner',
            duration: workout.duration || 30,
            position: workout.position ?? 0,
          }).returning();

          for (const { templateBlock, templateExercises } of createdBlocks) {
            const [ewBlock] = await db.insert(enrollmentWorkoutBlocks).values({
              enrollmentWorkoutId: ewRow.id,
              templateBlockId: templateBlock.id,
              section: templateBlock.section,
              blockType: templateBlock.blockType,
              position: templateBlock.position,
              rest: templateBlock.rest || null,
            }).returning();

            for (const tex of templateExercises) {
              await db.insert(enrollmentBlockExercises).values({
                enrollmentBlockId: ewBlock.id,
                templateExerciseId: tex.id,
                exerciseLibraryId: tex.exerciseLibraryId || null,
                position: tex.position,
                sets: tex.sets || [],
                tempo: tex.tempo || null,
                load: tex.load || null,
                notes: tex.notes || null,
              });
            }
          }
        }
      }

      res.status(201).json(workout);
    } catch (error) {
      console.error("Error creating programme workout:", error);
      res.status(500).json({ message: "Failed to create programme workout" });
    }
  });

  // Update a programme workout's details
  app.patch('/api/programme-workouts/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, description, workoutType, category, difficulty, duration, intervalRounds, intervalRestAfterRound, imageUrl } = req.body;
      
      const workout = await storage.updateProgrammeWorkout(id, { 
        name, 
        description, 
        workoutType, 
        category, 
        difficulty, 
        duration,
        intervalRounds,
        intervalRestAfterRound,
        imageUrl,
      });
      res.json(workout);
    } catch (error) {
      console.error("Error updating programme workout:", error);
      res.status(500).json({ message: "Failed to update programme workout" });
    }
  });

  // Delete a programme workout
  app.delete('/api/programme-workouts/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProgrammeWorkout(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting programme workout:", error);
      res.status(500).json({ message: "Failed to delete programme workout" });
    }
  });

  // Program exercises routes (all exercises in a programme)
  app.get('/api/programs/:programId/exercises', async (req, res) => {
    try {
      const programId = parseInt(req.params.programId);
      const exercises = await storage.getAllProgramExercises(programId);
      res.json(exercises);
    } catch (error) {
      console.error("Error fetching program exercises:", error);
      res.status(500).json({ message: "Failed to fetch program exercises" });
    }
  });

  // Get programme schedule (weeks, days, workout assignments)
  app.get('/api/programs/:programId/schedule', isAuthenticated, async (req, res) => {
    try {
      const programId = parseInt(req.params.programId);
      
      // Get all weeks for this programme
      const weeks = await db
        .select()
        .from(programWeeks)
        .where(eq(programWeeks.programId, programId))
        .orderBy(asc(programWeeks.weekNumber));
      
      const schedule: any[] = [];
      
      for (const week of weeks) {
        // Get all days for this week
        const days = await db
          .select()
          .from(programDays)
          .where(eq(programDays.weekId, week.id))
          .orderBy(asc(programDays.position));
        
        const weekSchedule: any = {
          weekId: week.id,
          weekNumber: week.weekNumber,
          days: [],
        };
        
        // Build a map of existing days by position
        const daysByPosition = new Map(days.map(d => [d.position, d]));
        
        // Show all 7 days of the week (positions 0-6), creating empty placeholders for missing days
        for (let pos = 0; pos < 7; pos++) {
          const day = daysByPosition.get(pos);
          
          if (day) {
            const dayWorkouts = await db
              .select({
                id: programmeWorkouts.id,
                name: programmeWorkouts.name,
                workoutType: programmeWorkouts.workoutType,
                category: programmeWorkouts.category,
                duration: programmeWorkouts.duration,
              })
              .from(programmeWorkouts)
              .where(eq(programmeWorkouts.dayId, day.id));
            
            weekSchedule.days.push({
              dayId: day.id,
              position: pos,
              dayName: `Day ${pos + 1}`,
              workouts: dayWorkouts,
            });
          } else {
            // Create the day in the database so workouts can be dropped onto it
            const [newDay] = await db
              .insert(programDays)
              .values({ weekId: week.id, position: pos })
              .returning();
            
            weekSchedule.days.push({
              dayId: newDay.id,
              position: pos,
              dayName: `Day ${pos + 1}`,
              workouts: [],
            });
          }
        }
        
        schedule.push(weekSchedule);
      }
      
      // Get ALL workouts for this programme (including unassigned ones)
      // First, get all day IDs for this programme
      const allDayIds = schedule.flatMap(w => w.days.map((d: any) => d.dayId));
      
      // Get all workouts that have dayId in our programme's days
      let allWorkouts: any[] = [];
      if (allDayIds.length > 0) {
        allWorkouts = await db
          .select({
            id: programmeWorkouts.id,
            name: programmeWorkouts.name,
            dayId: programmeWorkouts.dayId,
            workoutType: programmeWorkouts.workoutType,
            category: programmeWorkouts.category,
            duration: programmeWorkouts.duration,
          })
          .from(programmeWorkouts)
          .where(inArray(programmeWorkouts.dayId, allDayIds));
      }
      
      res.json({ schedule, workouts: allWorkouts });
    } catch (error) {
      console.error("Error fetching programme schedule:", error);
      res.status(500).json({ message: "Failed to fetch programme schedule" });
    }
  });

  // Update a workout's day assignment
  app.patch('/api/programme-workouts/:id/assign-day', isAuthenticated, async (req, res) => {
    try {
      const workoutId = parseInt(req.params.id);
      const { dayId } = req.body;
      
      if (!dayId) {
        return res.status(400).json({ message: "Day ID is required" });
      }
      
      // Get the workout with its current day's programme info
      const [workout] = await db
        .select({
          id: programmeWorkouts.id,
          dayId: programmeWorkouts.dayId,
        })
        .from(programmeWorkouts)
        .where(eq(programmeWorkouts.id, workoutId));
      
      if (!workout) {
        return res.status(404).json({ message: "Workout not found" });
      }
      
      // Get the current workout's programme ID through its day
      const [currentWorkoutDay] = await db
        .select({ programId: programWeeks.programId })
        .from(programDays)
        .innerJoin(programWeeks, eq(programWeeks.id, programDays.weekId))
        .where(eq(programDays.id, workout.dayId));
      
      if (!currentWorkoutDay) {
        return res.status(404).json({ message: "Workout's current day not found" });
      }
      
      // Verify the target day exists and get its programme ID
      const [targetDay] = await db
        .select({
          id: programDays.id,
          weekId: programDays.weekId,
          position: programDays.position,
          programId: programWeeks.programId,
        })
        .from(programDays)
        .innerJoin(programWeeks, eq(programWeeks.id, programDays.weekId))
        .where(eq(programDays.id, dayId));
      
      if (!targetDay) {
        return res.status(404).json({ message: "Day not found" });
      }
      
      // Verify both workout and target day belong to the same programme
      if (currentWorkoutDay.programId !== targetDay.programId) {
        return res.status(400).json({ message: "Cannot assign workout to a day in a different programme" });
      }
      
      // Update the workout's dayId
      const [updated] = await db
        .update(programmeWorkouts)
        .set({ dayId, updatedAt: new Date() })
        .where(eq(programmeWorkouts.id, workoutId))
        .returning();
      
      res.json(updated);
    } catch (error) {
      console.error("Error assigning workout to day:", error);
      res.status(500).json({ message: "Failed to assign workout to day" });
    }
  });

  // Meals routes
  app.get('/api/meals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const meals = await storage.getMeals(userId);
      res.json(meals);
    } catch (error) {
      console.error("Error fetching meals:", error);
      res.status(500).json({ message: "Failed to fetch meals" });
    }
  });

  app.post('/api/meals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const mealData = insertMealSchema.parse({ ...req.body, userId });
      const meal = await storage.createMeal(mealData);
      res.status(201).json(meal);
    } catch (error) {
      console.error("Error creating meal:", error);
      res.status(500).json({ message: "Failed to create meal" });
    }
  });

  app.delete('/api/meals/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteMeal(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting meal:", error);
      res.status(500).json({ message: "Failed to delete meal" });
    }
  });

  // Progress photos routes
  app.get('/api/progress-photos', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const photos = await storage.getProgressPhotos(userId);
      res.json(photos);
    } catch (error) {
      console.error("Error fetching progress photos:", error);
      res.status(500).json({ message: "Failed to fetch progress photos" });
    }
  });

  app.post('/api/progress-photos', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const photoData = insertProgressPhotoSchema.parse({ ...req.body, userId });
      const photo = await storage.createProgressPhoto(photoData);
      res.status(201).json(photo);
    } catch (error) {
      console.error("Error creating progress photo:", error);
      res.status(500).json({ message: "Failed to create progress photo" });
    }
  });

  app.delete('/api/progress-photos/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProgressPhoto(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting progress photo:", error);
      res.status(500).json({ message: "Failed to delete progress photo" });
    }
  });

  // Body stats routes
  app.get('/api/body-stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getBodyStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching body stats:", error);
      res.status(500).json({ message: "Failed to fetch body stats" });
    }
  });

  app.post('/api/body-stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const statsData = insertBodyStatsSchema.parse({ ...req.body, userId });
      const stats = await storage.createBodyStats(statsData);
      res.status(201).json(stats);
    } catch (error) {
      console.error("Error creating body stats:", error);
      res.status(500).json({ message: "Failed to create body stats" });
    }
  });

  app.delete('/api/body-stats/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBodyStats(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting body stats:", error);
      res.status(500).json({ message: "Failed to delete body stats" });
    }
  });

  // Workout sessions routes
  app.get('/api/workout-sessions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessions = await storage.getWorkoutSessions(userId);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching workout sessions:", error);
      res.status(500).json({ message: "Failed to fetch workout sessions" });
    }
  });

  app.post('/api/workout-sessions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessionData = insertWorkoutSessionSchema.parse({ ...req.body, userId });
      const session = await storage.createWorkoutSession(sessionData);
      res.status(201).json(session);
    } catch (error) {
      console.error("Error creating workout session:", error);
      res.status(500).json({ message: "Failed to create workout session" });
    }
  });

  app.delete('/api/workout-sessions/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteWorkoutSession(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting workout session:", error);
      res.status(500).json({ message: "Failed to delete workout session" });
    }
  });

  // Calendar/Activity aggregation route
  app.get('/api/calendar/activities', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { startDate, endDate } = req.query;
      
      const activities = await storage.getActivitiesByDateRange(
        userId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      
      // Prevent caching to ensure fresh data after workout moves
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.json(activities);
    } catch (error) {
      console.error("Error fetching calendar activities:", error);
      res.status(500).json({ message: "Failed to fetch calendar activities" });
    }
  });

  // Goals routes
  app.get('/api/goals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const goals = await storage.getGoals(userId);
      res.json(goals);
    } catch (error) {
      console.error("Error fetching goals:", error);
      res.status(500).json({ message: "Failed to fetch goals" });
    }
  });

  app.post('/api/goals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { milestones: milestonesData, ...goalDataRest } = req.body;
      
      // Check if user already has an active bodyweight goal
      if (goalDataRest.type === 'bodyweight') {
        const existingGoals = await storage.getActiveBodyweightGoals(userId);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Archive any past bodyweight goals (deadline has passed)
        for (const existingGoal of existingGoals) {
          if (existingGoal.deadline) {
            const deadline = new Date(existingGoal.deadline);
            deadline.setHours(0, 0, 0, 0);
            if (deadline < today) {
              await storage.archiveGoal(existingGoal.id);
            }
          }
        }
        
        // Re-check for remaining active goals after archiving past ones
        const remainingActiveGoals = await storage.getActiveBodyweightGoals(userId);
        if (remainingActiveGoals.length > 0) {
          return res.status(400).json({ message: "You can only have one active bodyweight goal at a time. Please complete or delete your existing goal first." });
        }
      }

      // For nutrition goals, archive any existing active nutrition goals
      if (goalDataRest.type === 'nutrition') {
        const existingNutritionGoals = await storage.getActiveNutritionGoals(userId);
        for (const existingGoal of existingNutritionGoals) {
          await storage.archiveGoal(existingGoal.id);
        }
      }
      
      const goalData = { 
        ...goalDataRest, 
        userId,
        startDate: req.body.startDate ? new Date(req.body.startDate) : new Date(),
        deadline: req.body.deadline ? new Date(req.body.deadline) : null
      };
      
      const goal = await storage.createGoal(goalData);
      
      // Save milestones if provided
      if (milestonesData && Array.isArray(milestonesData) && milestonesData.length > 0) {
        for (let i = 0; i < milestonesData.length; i++) {
          const milestone = milestonesData[i];
          if (milestone.targetValue && milestone.dueDate) {
            const milestoneUnit = milestone.unit || goalData.unit;
            await storage.createMilestone({
              goalId: goal.id,
              title: `${milestone.targetValue}${milestoneUnit}`,
              targetValue: parseFloat(milestone.targetValue),
              unit: milestoneUnit,
              dueDate: new Date(milestone.dueDate),
              orderIndex: i,
            } as any);
          }
        }
      }
      
      res.status(201).json(goal);
    } catch (error) {
      console.error("Error creating goal:", error);
      res.status(500).json({ message: "Failed to create goal" });
    }
  });

  // Get single goal by ID
  app.get('/api/goals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const goal = await storage.getGoalById(id);
      if (!goal) {
        return res.status(404).json({ message: "Goal not found" });
      }
      res.json(goal);
    } catch (error) {
      console.error("Error fetching goal:", error);
      res.status(500).json({ message: "Failed to fetch goal" });
    }
  });

  app.patch('/api/goals/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { milestones: milestonesData, ...bodyRest } = req.body;
      const updateData = {
        ...bodyRest,
        startDate: req.body.startDate ? new Date(req.body.startDate) : req.body.startDate === null ? null : undefined,
        deadline: req.body.deadline ? new Date(req.body.deadline) : req.body.deadline === null ? null : undefined
      };
      const goal = await storage.updateGoal(id, updateData);
      
      // Update milestones if provided
      if (milestonesData && Array.isArray(milestonesData)) {
        // Delete existing milestones for this goal
        await storage.deleteMilestonesByGoalId(id);
        
        // Create new milestones if provided
        if (milestonesData.length > 0) {
          for (let i = 0; i < milestonesData.length; i++) {
            const milestone = milestonesData[i];
            if (milestone.targetValue && milestone.dueDate) {
              const milestoneUnit = milestone.unit || goal.unit;
              await storage.createMilestone({
                goalId: goal.id,
                title: `${milestone.targetValue}${milestoneUnit}`,
                targetValue: parseFloat(milestone.targetValue),
                unit: milestoneUnit,
                dueDate: new Date(milestone.dueDate),
                orderIndex: i,
              } as any);
            }
          }
        }
      }
      
      res.json(goal);
    } catch (error) {
      console.error("Error updating goal:", error);
      res.status(500).json({ message: "Failed to update goal" });
    }
  });

  app.delete('/api/goals/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteGoal(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting goal:", error);
      res.status(500).json({ message: "Failed to delete goal" });
    }
  });

  // Goal Milestones routes
  app.get('/api/goals/:id/progress', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const goalId = parseInt(req.params.id);
      const progress = await storage.getGoalProgress(goalId, userId);
      if (!progress) return res.json(null);
      res.json(progress);
    } catch (error) {
      console.error("Error fetching goal progress:", error);
      res.status(500).json({ message: "Failed to fetch goal progress" });
    }
  });

  app.get('/api/goals/:goalId/milestones', isAuthenticated, async (req, res) => {
    try {
      const goalId = parseInt(req.params.goalId);
      const milestones = await storage.getMilestones(goalId);
      res.json(milestones);
    } catch (error) {
      console.error("Error fetching milestones:", error);
      res.status(500).json({ message: "Failed to fetch milestones" });
    }
  });

  app.post('/api/goals/:goalId/milestones', isAuthenticated, async (req: any, res) => {
    try {
      const goalId = parseInt(req.params.goalId);
      const milestoneData = {
        ...req.body,
        goalId,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : new Date(),
      };
      const milestone = await storage.createMilestone(milestoneData);
      res.status(201).json(milestone);
    } catch (error) {
      console.error("Error creating milestone:", error);
      res.status(500).json({ message: "Failed to create milestone" });
    }
  });

  app.patch('/api/milestones/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = {
        ...req.body,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      };
      const milestone = await storage.updateMilestone(id, updateData);
      res.json(milestone);
    } catch (error) {
      console.error("Error updating milestone:", error);
      res.status(500).json({ message: "Failed to update milestone" });
    }
  });

  app.post('/api/milestones/:id/complete', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const milestone = await storage.completeMilestone(id);
      res.json(milestone);
    } catch (error) {
      console.error("Error completing milestone:", error);
      res.status(500).json({ message: "Failed to complete milestone" });
    }
  });

  app.post('/api/milestones/:id/uncomplete', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const milestone = await storage.uncompleteMilestone(id);
      res.json(milestone);
    } catch (error) {
      console.error("Error uncompleting milestone:", error);
      res.status(500).json({ message: "Failed to uncomplete milestone" });
    }
  });

  app.delete('/api/milestones/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteMilestone(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting milestone:", error);
      res.status(500).json({ message: "Failed to delete milestone" });
    }
  });

  // Habit Templates routes
  app.get('/api/habit-templates', isAuthenticated, async (req, res) => {
    try {
      const templates = await storage.getHabitTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching habit templates:", error);
      res.status(500).json({ message: "Failed to fetch habit templates" });
    }
  });

  app.get('/api/habit-templates/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const template = await storage.getHabitTemplateById(id);
      if (!template) {
        return res.status(404).json({ message: "Habit template not found" });
      }
      console.log("=== GET /api/habit-templates/:id ===");
      console.log("Template ID:", id);
      console.log("Template data:", JSON.stringify(template, null, 2));
      res.json(template);
    } catch (error) {
      console.error("Error fetching habit template:", error);
      res.status(500).json({ message: "Failed to fetch habit template" });
    }
  });

  // User Habit Library routes
  app.get('/api/user-habit-library', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const library = await storage.getUserHabitLibrary(userId);
      res.json(library);
    } catch (error) {
      console.error("Error fetching user habit library:", error);
      res.status(500).json({ message: "Failed to fetch habit library" });
    }
  });

  app.post('/api/user-habit-library', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { title, description, icon, category } = req.body;
      if (!title?.trim()) return res.status(400).json({ message: "Title is required" });
      const entry = await storage.createUserHabitLibraryEntry({ userId, title, description, icon, category });
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating user habit library entry:", error);
      res.status(500).json({ message: "Failed to save habit to library" });
    }
  });

  app.put('/api/user-habit-library/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { title, description, icon, category } = req.body;
      if (!title?.trim()) return res.status(400).json({ message: "Title is required" });
      const updated = await storage.updateUserHabitLibraryEntry(id, { title, description, icon, category });
      res.json(updated);
    } catch (error) {
      console.error("Error updating user habit library entry:", error);
      res.status(500).json({ message: "Failed to update habit in library" });
    }
  });

  app.delete('/api/user-habit-library/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteUserHabitLibraryEntry(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user habit library entry:", error);
      res.status(500).json({ message: "Failed to delete habit from library" });
    }
  });

  // Habits routes
  app.get('/api/habits', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const habits = await storage.getHabits(userId);
      
      // If date parameter is provided, include completion status for that date
      const dateParam = req.query.date;
      if (dateParam) {
        const selectedDate = new Date(dateParam as string);
        const completions = await storage.getHabitCompletionsForDate(userId, selectedDate);
        const completionMap = new Set(completions.map(c => c.habitId));
        
        const habitsWithCompletion = habits.map(habit => ({
          ...habit,
          completedOnDate: completionMap.has(habit.id),
        }));
        
        res.json(habitsWithCompletion);
      } else {
        res.json(habits);
      }
    } catch (error) {
      console.error("Error fetching habits:", error);
      res.status(500).json({ message: "Failed to fetch habits" });
    }
  });

  app.post('/api/habits', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log("=== POST /api/habits DEBUG ===");
      console.log("req.body:", JSON.stringify(req.body, null, 2));
      
      const habitData = { 
        ...req.body, 
        userId,
        // Convert startDate string to Date object if present
        startDate: req.body.startDate ? new Date(req.body.startDate) : new Date(),
      };
      
      console.log("habitData before createHabit:", JSON.stringify({
        ...habitData,
        startDate: habitData.startDate.toISOString()
      }, null, 2));
      
      const habit = await storage.createHabit(habitData);

      // If the user added the "Complete Your Check-In" habit, check if they've
      // already done today's check-in and auto-complete the habit if so
      if (habit.templateId === 31) {
        try {
          const todayStr = new Date().toISOString().split('T')[0];
          const allCheckIns = await storage.getUserCheckIns(userId);
          const hasCheckInToday = allCheckIns.some(c => {
            if (!c.checkInDate) return false;
            return new Date(c.checkInDate).toISOString().split('T')[0] === todayStr;
          });
          if (hasCheckInToday) {
            await storage.completeHabit(habit.id, userId);
            console.log('[Habits] Auto-completed check-in habit on add for user:', userId);
          }
        } catch (habitError) {
          console.error('[Habits] Error auto-completing check-in habit on add:', habitError);
        }
      }

      res.status(201).json(habit);
    } catch (error) {
      console.error("Error creating habit:", error);
      res.status(500).json({ message: "Failed to create habit" });
    }
  });

  app.patch('/api/habits/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const habit = await storage.updateHabit(id, req.body);
      res.json(habit);
    } catch (error) {
      console.error("Error updating habit:", error);
      res.status(500).json({ message: "Failed to update habit" });
    }
  });

  app.get('/api/habits/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const habit = await storage.getHabitById(id);
      if (!habit) {
        return res.status(404).json({ message: "Habit not found" });
      }
      res.json(habit);
    } catch (error) {
      console.error("Error fetching habit:", error);
      res.status(500).json({ message: "Failed to fetch habit" });
    }
  });

  app.get('/api/habits/:id/completions', isAuthenticated, async (req, res) => {
    try {
      const habitId = parseInt(req.params.id);
      const completions = await storage.getHabitCompletions(habitId);
      res.json(completions);
    } catch (error) {
      console.error("Error fetching habit completions:", error);
      res.status(500).json({ message: "Failed to fetch habit completions" });
    }
  });

  app.delete('/api/habits/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteHabit(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting habit:", error);
      res.status(500).json({ message: "Failed to delete habit" });
    }
  });

  app.post('/api/habits/:id/complete', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const dateStr = req.query.date as string || req.body.date;
      const date = dateStr ? new Date(dateStr) : new Date();
      const completion = await storage.completeHabit(id, userId, date);
      res.status(201).json(completion);
    } catch (error) {
      console.error("Error completing habit:", error);
      res.status(500).json({ message: "Failed to complete habit" });
    }
  });

  app.delete('/api/habits/:id/complete', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const dateStr = req.query.date as string;
      const date = dateStr ? new Date(dateStr) : new Date();
      await storage.uncompleteHabit(id, userId, date);
      res.json({ success: true });
    } catch (error) {
      console.error("Error uncompleting habit:", error);
      res.status(500).json({ message: "Failed to uncomplete habit" });
    }
  });

  app.get('/api/habits/:id/completions', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const completions = await storage.getHabitCompletions(id);
      res.json(completions);
    } catch (error) {
      console.error("Error fetching habit completions:", error);
      res.status(500).json({ message: "Failed to fetch habit completions" });
    }
  });

  app.post('/api/habits/recalculate-streaks', isAuthenticated, async (req: any, res) => {
    try {
      const habits = await storage.getHabits(req.user.claims.sub);
      for (const habit of habits) {
        await storage.updateHabitStreak(habit.id);
      }
      res.json({ success: true, count: habits.length });
    } catch (error) {
      console.error("Error recalculating habit streaks:", error);
      res.status(500).json({ message: "Failed to recalculate habit streaks" });
    }
  });

  // Learn Topics routes
  app.get('/api/learn-topics', isAuthenticated, async (req, res) => {
    try {
      const topics = await storage.getLearnTopics();
      res.json(topics);
    } catch (error) {
      console.error("Error fetching learn topics:", error);
      res.status(500).json({ message: "Failed to fetch learn topics" });
    }
  });

  app.get('/api/learn-topics/:slug', isAuthenticated, async (req, res) => {
    try {
      const slug = req.params.slug as string;
      const topic = await storage.getLearnTopicBySlug(slug);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }
      res.json(topic);
    } catch (error) {
      console.error("Error fetching learn topic:", error);
      res.status(500).json({ message: "Failed to fetch learn topic" });
    }
  });

  app.get('/api/learn-topics/:id/paths', isAuthenticated, async (req, res) => {
    try {
      const topicId = parseInt(req.params.id);
      const paths = await storage.getLearningPathsByTopic(topicId);
      res.json(paths);
    } catch (error) {
      console.error("Error fetching topic paths:", error);
      res.status(500).json({ message: "Failed to fetch topic paths" });
    }
  });

  app.get('/api/learn-topics/:id/content', isAuthenticated, async (req, res) => {
    try {
      const topicId = parseInt(req.params.id);
      // Fetch content from both learning paths AND direct topic content
      const pathContentItems = await storage.getPathContentItemsByTopic(topicId);
      const directTopicContent = await db.select().from(topicContentItems).where(eq(topicContentItems.topicId, topicId)).orderBy(topicContentItems.orderIndex);
      
      // Combine both sources - direct topic content first, then path content
      const allContent = [
        ...directTopicContent.map(item => ({
          ...item,
          source: 'topic' as const
        })),
        ...pathContentItems.map(item => ({
          ...item,
          source: 'path' as const
        }))
      ];
      
      res.json(allContent);
    } catch (error) {
      console.error("Error fetching topic content:", error);
      res.status(500).json({ message: "Failed to fetch topic content" });
    }
  });

  app.get('/api/learn-topics/:id/stats', isAuthenticated, async (req: any, res) => {
    try {
      const topicId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const stats = await storage.getTopicCompletionStats(userId, topicId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching topic stats:", error);
      res.status(500).json({ message: "Failed to fetch topic stats" });
    }
  });

  // Learning Paths routes
  app.get('/api/learning-paths', isAuthenticated, async (req, res) => {
    try {
      const topicId = req.query.topicId ? parseInt(req.query.topicId as string) : undefined;
      const paths = await storage.getLearningPaths(topicId);
      res.json(paths);
    } catch (error) {
      console.error("Error fetching learning paths:", error);
      res.status(500).json({ message: "Failed to fetch learning paths" });
    }
  });

  app.get('/api/learning-paths/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const path = await storage.getLearningPathById(id);
      if (!path) {
        return res.status(404).json({ message: "Learning path not found" });
      }
      res.json(path);
    } catch (error) {
      console.error("Error fetching learning path:", error);
      res.status(500).json({ message: "Failed to fetch learning path" });
    }
  });

  app.get('/api/learning-paths/:id/content', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const contentItems = await storage.getPathContentItems(id);
      res.json(contentItems);
    } catch (error) {
      console.error("Error fetching path content:", error);
      res.status(500).json({ message: "Failed to fetch path content" });
    }
  });

  // Create learning path
  app.post('/api/learning-paths', isAuthenticated, async (req, res) => {
    try {
      const { title, description, topicId } = req.body;
      
      if (!title || !topicId) {
        return res.status(400).json({ message: "Title and topic are required" });
      }

      // Get the topic to use its category
      const topic = await storage.getLearnTopicById(topicId);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }

      const [newPath] = await db.insert(learningPaths).values({
        title,
        description: description || '',
        topicId,
        category: topic.slug || 'general',
        estimatedDuration: 0, // Will be calculated from content
      }).returning();
      
      res.status(201).json(newPath);
    } catch (error) {
      console.error("Error creating learning path:", error);
      res.status(500).json({ message: "Failed to create learning path" });
    }
  });

  // Update learning path
  app.patch('/api/learning-paths/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { title, description, imageUrl, difficulty, estimatedDuration, isRecommended } = req.body;
      
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
      if (difficulty !== undefined) updateData.difficulty = difficulty;
      if (estimatedDuration !== undefined) updateData.estimatedDuration = estimatedDuration;
      if (isRecommended !== undefined) updateData.isRecommended = isRecommended;
      
      const result = await db.update(learningPaths).set(updateData).where(eq(learningPaths.id, id)).returning();
      
      if (result.length === 0) {
        return res.status(404).json({ message: "Learning path not found" });
      }
      
      res.json(result[0]);
    } catch (error) {
      console.error("Error updating learning path:", error);
      res.status(500).json({ message: "Failed to update learning path" });
    }
  });

  // Delete learning path
  app.delete('/api/learning-paths/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(learningPaths).where(eq(learningPaths.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting learning path:", error);
      res.status(500).json({ message: "Failed to delete learning path" });
    }
  });

  // Delete path content item
  app.delete('/api/learning-paths/content/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(pathContentItems).where(eq(pathContentItems.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting path content item:", error);
      res.status(500).json({ message: "Failed to delete path content item" });
    }
  });

  // Create topic-level content item with Mux video (JSON)
  // Now inserts into learnContentLibrary (unified content library) instead of deprecated topicContentItems
  app.post('/api/learn-topics/:topicId/content', isAuthenticated, async (req, res, next) => {
    // Check if it's a JSON request with muxPlaybackId (no file upload)
    if (req.is('application/json')) {
      try {
        const topicId = parseInt(req.params.topicId);
        const { title, description, contentType: bodyContentType, muxPlaybackId } = req.body;

        if (!title) {
          return res.status(400).json({ message: "Missing title" });
        }

        // Handle Mux video (JSON request with muxPlaybackId)
        if (muxPlaybackId && bodyContentType === 'video') {
          // Fetch duration from Mux API
          let durationSeconds: number | null = null;
          try {
            // Get the asset ID from the playback ID
            const { video } = await import('./mux');
            const assets = await video.assets.list();
            const asset = assets.data?.find(a => 
              a.playback_ids?.some(p => p.id === muxPlaybackId)
            );
            if (asset && asset.duration) {
              durationSeconds = Math.round(asset.duration);
            }
          } catch (muxError) {
            console.error("Could not fetch duration from Mux:", muxError);
            // Continue without duration if Mux API fails
          }

          // Insert into learnContentLibrary (the unified content table)
          const contentData = {
            topicId,
            title,
            description: description || '',
            contentType: 'video',
            contentUrl: `mux:${muxPlaybackId}`,
            muxPlaybackId,
            duration: durationSeconds,
          };

          const result = await db.insert(learnContentLibrary).values(contentData).returning();
          return res.status(201).json(result[0]);
        }

        return res.status(400).json({ message: "Invalid JSON request - missing muxPlaybackId or contentType" });
      } catch (error) {
        console.error("Error creating topic content item:", error);
        return res.status(500).json({ message: "Failed to create topic content item" });
      }
    }
    
    // Otherwise handle file upload
    uploadDoc.single('file')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message || "File upload failed" });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const topicId = parseInt(req.params.topicId);
      const { title, description } = req.body;

      if (!title) {
        return res.status(400).json({ message: "Missing title" });
      }

      // Handle file upload
      if (!req.file) {
        return res.status(400).json({ message: "No file provided" });
      }

      // Determine content type from file mimetype
      let contentType = 'pdf';
      if (req.file.mimetype.startsWith('video/')) {
        contentType = 'video';
      } else if (req.file.mimetype.startsWith('image/')) {
        contentType = 'pdf';
      } else if (req.file.mimetype.includes('word') || req.file.mimetype.includes('document')) {
        contentType = 'pdf';
      }

      const contentUrl = `/uploads/pdfs/${req.file.filename}`;

      // Insert into learnContentLibrary (unified content table)
      const contentData = {
        topicId,
        title,
        description: description || '',
        contentType,
        contentUrl,
      };

      const result = await db.insert(learnContentLibrary).values(contentData).returning();
      res.status(201).json(result[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid content data", errors: error.errors });
      }
      console.error("Error creating topic content item:", error);
      res.status(500).json({ message: "Failed to create topic content item" });
    }
  });

  // Create learning path content item with file upload or muxPlaybackId
  app.post('/api/learning-paths/:pathId/content', isAuthenticated, async (req, res, next) => {
    const pathId = parseInt(req.params.pathId);

    // Handle JSON request with muxPlaybackId for video
    if (req.is('application/json')) {
      try {
        const { title, description, contentType, muxPlaybackId } = req.body;

        if (!title) {
          return res.status(400).json({ message: "Missing title" });
        }

        if (muxPlaybackId && contentType === 'video') {
          const contentData = insertPathContentItemSchema.parse({
            pathId,
            title,
            description: description || '',
            contentType: 'video',
            contentUrl: `mux:${muxPlaybackId}`, // Store Mux reference as URL
            muxPlaybackId,
            orderIndex: 0,
          });

          const result = await db.insert(pathContentItems).values(contentData).returning();
          return res.status(201).json(result[0]);
        }

        return res.status(400).json({ message: "Invalid JSON request - missing muxPlaybackId or contentType" });
      } catch (error) {
        console.error("Error creating content item:", error);
        return res.status(500).json({ message: "Failed to create content item" });
      }
    }

    // Handle file upload - need to parse form data first
    next();
  }, (req, res, next) => {
    const contentType = req.body?.contentType;
    const upload = contentType === 'pdf' ? uploadPdf.single('file') : uploadVideo.single('file');
    upload(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const pathId = parseInt(req.params.pathId);
      const { title, description, contentType } = req.body;

      if (!req.file) {
        return res.status(400).json({ message: "No file provided" });
      }

      if (!title || !contentType) {
        return res.status(400).json({ message: "Missing title or contentType" });
      }

      const contentUrl = contentType === 'pdf' 
        ? `/uploads/pdfs/${req.file.filename}` 
        : `/uploads/videos/${req.file.filename}`;

      const contentData = insertPathContentItemSchema.parse({
        pathId,
        title,
        description: description || '',
        contentType: contentType === 'pdf' ? 'pdf' : 'video',
        contentUrl,
        orderIndex: 0,
      });

      const result = await db.insert(pathContentItems).values(contentData).returning();
      res.status(201).json(result[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid content data", errors: error.errors });
      }
      console.error("Error creating content item:", error);
      res.status(500).json({ message: "Failed to create content item" });
    }
  });

  // Update content item
  app.patch('/api/learning-paths/content/:id', isAuthenticated, (req, res) => {
    const id = parseInt(req.params.id);
    
    // If there's a file, handle multipart form data
    if (req.get('content-type')?.includes('multipart/form-data')) {
      const upload = req.body?.content_type === 'pdf' ? uploadPdf.single('file') : uploadVideo.single('file');
      upload(req, res, async (err) => {
        try {
          if (err) {
            return res.status(400).json({ message: err.message });
          }

          const { title, description, content_type, duration } = req.body;
          const updateData: any = {};
          if (title !== undefined) updateData.title = title;
          if (description !== undefined) updateData.description = description;
          if (content_type !== undefined) updateData.contentType = content_type;
          if (duration !== undefined) updateData.duration = duration;

          if (req.file) {
            const contentUrl = content_type === 'pdf' 
              ? `/uploads/pdfs/${req.file.filename}` 
              : `/uploads/videos/${req.file.filename}`;
            updateData.contentUrl = contentUrl;
          }

          const result = await db
            .update(pathContentItems)
            .set(updateData)
            .where(eq(pathContentItems.id, id))
            .returning();

          if (result.length === 0) {
            return res.status(404).json({ message: "Content item not found" });
          }

          res.json(result[0]);
        } catch (error) {
          console.error("Error updating content item:", error);
          res.status(500).json({ message: "Failed to update content item" });
        }
      });
    } else {
      // No file, just update metadata
      (async () => {
        try {
          const { title, description, content_type, duration, muxPlaybackId } = req.body;
          const updateData: any = {};
          if (title !== undefined) updateData.title = title;
          if (description !== undefined) updateData.description = description;
          if (content_type !== undefined) updateData.contentType = content_type;
          if (duration !== undefined) updateData.duration = duration;
          if (muxPlaybackId !== undefined) updateData.muxPlaybackId = muxPlaybackId;

          const result = await db
            .update(pathContentItems)
            .set(updateData)
            .where(eq(pathContentItems.id, id))
            .returning();

          if (result.length === 0) {
            return res.status(404).json({ message: "Content item not found" });
          }

          // Also update the linked library item if it exists
          const updatedItem = result[0];
          if (updatedItem.libraryItemId) {
            const libraryUpdateData: any = {};
            if (title !== undefined) libraryUpdateData.title = title;
            if (description !== undefined) libraryUpdateData.description = description;
            if (content_type !== undefined) libraryUpdateData.contentType = content_type;
            if (duration !== undefined) libraryUpdateData.duration = duration;
            if (muxPlaybackId !== undefined) libraryUpdateData.muxPlaybackId = muxPlaybackId;
            
            await db
              .update(learnContentLibrary)
              .set(libraryUpdateData)
              .where(eq(learnContentLibrary.id, updatedItem.libraryItemId));
          }

          res.json(result[0]);
        } catch (error) {
          console.error("Error updating content item:", error);
          res.status(500).json({ message: "Failed to update content item" });
        }
      })();
    }
  });

  // Update content library item (for topic content)
  app.patch('/api/content-library/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { title, description, muxPlaybackId } = req.body;
      
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (muxPlaybackId !== undefined) {
        updateData.muxPlaybackId = muxPlaybackId;
        updateData.contentUrl = `mux:${muxPlaybackId}`;
        
        // Fetch duration from Mux
        try {
          const { video } = await import('./mux');
          const assets = await video.assets.list();
          const asset = assets.data?.find(a => 
            a.playback_ids?.some(p => p.id === muxPlaybackId)
          );
          if (asset && asset.duration) {
            updateData.duration = Math.round(asset.duration);
          }
        } catch (muxError) {
          console.error("Could not fetch duration from Mux:", muxError);
        }
      }

      const result = await db
        .update(learnContentLibrary)
        .set(updateData)
        .where(eq(learnContentLibrary.id, id))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ message: "Content item not found" });
      }

      res.json(result[0]);
    } catch (error) {
      console.error("Error updating content library item:", error);
      res.status(500).json({ message: "Failed to update content" });
    }
  });

  // Admin: Sync video durations from Mux for all content without duration
  app.post('/api/admin/sync-mux-durations', isAuthenticated, async (req: any, res) => {
    try {
      // Get all content items with muxPlaybackId but no duration
      const contentWithoutDuration = await db
        .select()
        .from(learnContentLibrary)
        .where(and(
          isNotNull(learnContentLibrary.muxPlaybackId),
          isNull(learnContentLibrary.duration)
        ));

      if (contentWithoutDuration.length === 0) {
        return res.json({ message: "All videos already have durations", updated: 0 });
      }

      // Fetch all Mux assets
      const { video } = await import('./mux');
      const assets = await video.assets.list();
      
      let updatedCount = 0;
      for (const content of contentWithoutDuration) {
        const asset = assets.data?.find(a => 
          a.playback_ids?.some(p => p.id === content.muxPlaybackId)
        );
        if (asset && asset.duration) {
          const durationSeconds = Math.round(asset.duration);
          await db
            .update(learnContentLibrary)
            .set({ duration: durationSeconds })
            .where(eq(learnContentLibrary.id, content.id));
          updatedCount++;
        }
      }

      res.json({ message: `Updated ${updatedCount} video durations`, updated: updatedCount });
    } catch (error) {
      console.error("Error syncing Mux durations:", error);
      res.status(500).json({ message: "Failed to sync Mux durations" });
    }
  });

  // Add existing video to learning path
  app.post('/api/learning-paths/:pathId/add-video', isAuthenticated, async (req: any, res) => {
    try {
      const pathId = parseInt(req.params.pathId);
      const { videoId } = req.body;

      if (!videoId) {
        return res.status(400).json({ message: "Missing videoId" });
      }

      // Get the video to copy its details
      const video = await db.query.videos.findFirst({
        where: eq(videos, { id: videoId })
      });

      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }

      // Get the highest orderIndex for this path
      const existingContent = await db.query.pathContentItems.findMany({
        where: eq(pathContentItems, { pathId })
      });
      const maxOrderIndex = existingContent.length > 0 
        ? Math.max(...existingContent.map(c => c.orderIndex)) 
        : -1;

      // Create new path content item based on video
      const contentData = {
        pathId,
        title: video.title,
        description: video.description,
        contentType: 'video',
        contentUrl: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl,
        duration: Math.floor(video.duration / 60), // convert seconds to minutes
        orderIndex: maxOrderIndex + 1,
        isRequired: true,
      };

      const result = await db.insert(pathContentItems).values(contentData).returning();
      res.status(201).json(result[0]);
    } catch (error) {
      console.error("Error adding video to path:", error);
      res.status(500).json({ message: "Failed to add video to path" });
    }
  });

  // Learning Path Content Progress routes
  app.get('/api/learning-paths/:pathId/progress', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const pathId = parseInt(req.params.pathId);
      const progress = await storage.getPathContentProgress(userId, pathId);
      res.json(progress);
    } catch (error) {
      console.error("Error fetching progress:", error);
      res.status(500).json({ message: "Failed to fetch progress" });
    }
  });

  app.post('/api/learning-paths/:pathId/content/:contentId/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const pathId = parseInt(req.params.pathId);
      const contentId = parseInt(req.params.contentId);
      const progress = await storage.markContentComplete(userId, pathId, contentId);
      
      // Update user streak after completing learning content (non-blocking)
      storage.updateUserStreak(userId).catch(err => {
        console.error(`[STREAK] Background update failed, will recalculate on next fetch:`, err?.message);
      });
      
      res.status(201).json(progress);
    } catch (error) {
      console.error("Error marking content complete:", error);
      res.status(500).json({ message: "Failed to mark content complete" });
    }
  });

  app.delete('/api/learning-paths/:pathId/content/:contentId/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const pathId = parseInt(req.params.pathId);
      const contentId = parseInt(req.params.contentId);
      await storage.markContentIncomplete(userId, pathId, contentId);
      res.status(204).send();
    } catch (error) {
      console.error("Error marking content incomplete:", error);
      res.status(500).json({ message: "Failed to mark content incomplete" });
    }
  });

  // ========== UNIFIED CONTENT LIBRARY ROUTES ==========

  // Get all content for a topic from the library (for "Browse All" sections)
  app.get('/api/content-library/topic/:topicId', isAuthenticated, async (req: any, res) => {
    try {
      const topicId = parseInt(req.params.topicId);
      const content = await storage.getContentLibraryByTopic(topicId);
      res.json(content);
    } catch (error) {
      console.error("Error fetching topic content:", error);
      res.status(500).json({ message: "Failed to fetch topic content" });
    }
  });

  // Get a single library item by ID
  app.get('/api/content-library/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.getContentLibraryItem(id);
      if (!item) {
        return res.status(404).json({ message: "Content not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error fetching library item:", error);
      res.status(500).json({ message: "Failed to fetch content" });
    }
  });

  // Get content items for a learning path from library (new unified structure)
  app.get('/api/learning-paths/:pathId/library-content', isAuthenticated, async (req: any, res) => {
    try {
      const pathId = parseInt(req.params.pathId);
      const items = await storage.getPathContentFromLibrary(pathId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching path library content:", error);
      res.status(500).json({ message: "Failed to fetch path content" });
    }
  });

  // Get user's unified content progress (all completed library items)
  app.get('/api/content-progress', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const progress = await storage.getUserContentProgress(userId);
      res.json(progress);
    } catch (error) {
      console.error("Error fetching content progress:", error);
      res.status(500).json({ message: "Failed to fetch progress" });
    }
  });

  // Get completed library item IDs for user
  app.get('/api/content-progress/completed-ids', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const completedIds = await storage.getCompletedLibraryItemIds(userId);
      res.json(completedIds);
    } catch (error) {
      console.error("Error fetching completed IDs:", error);
      res.status(500).json({ message: "Failed to fetch completed IDs" });
    }
  });

  app.get('/api/content-progress/completed-with-dates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const completedItems = await storage.getCompletedLibraryItemsWithDates(userId);
      res.json(completedItems);
    } catch (error) {
      console.error("Error fetching completed items with dates:", error);
      res.status(500).json({ message: "Failed to fetch completed items" });
    }
  });

  // Update watch progress for a library item
  app.patch('/api/content-library/:libraryItemId/watch-progress', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const libraryItemId = parseInt(req.params.libraryItemId);
      const { progress } = req.body;
      if (typeof progress !== 'number' || progress < 0 || progress > 100) {
        return res.status(400).json({ message: "Progress must be a number between 0 and 100" });
      }
      await storage.updateWatchProgress(userId, libraryItemId, progress);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating watch progress:", error);
      res.status(500).json({ message: "Failed to update watch progress" });
    }
  });

  // Get watch progress map for current user
  app.get('/api/content-progress/watch-progress', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const progressMap = await storage.getWatchProgressMap(userId);
      res.json(progressMap);
    } catch (error) {
      console.error("Error fetching watch progress:", error);
      res.status(500).json({ message: "Failed to fetch watch progress" });
    }
  });

  // Mark library item as complete (unified progress)
  app.post('/api/content-library/:libraryItemId/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const libraryItemId = parseInt(req.params.libraryItemId);
      const progress = await storage.markLibraryContentComplete(userId, libraryItemId);
      res.status(201).json(progress);
    } catch (error) {
      console.error("Error marking library content complete:", error);
      res.status(500).json({ message: "Failed to mark content complete" });
    }
  });

  // Mark library item as incomplete (unified progress)
  app.delete('/api/content-library/:libraryItemId/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const libraryItemId = parseInt(req.params.libraryItemId);
      await storage.markLibraryContentIncomplete(userId, libraryItemId);
      res.status(204).send();
    } catch (error) {
      console.error("Error marking library content incomplete:", error);
      res.status(500).json({ message: "Failed to mark content incomplete" });
    }
  });

  // Create new content library item
  app.post('/api/content-library', isAuthenticated, async (req: any, res) => {
    try {
      const item = await storage.createContentLibraryItem(req.body);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating library item:", error);
      res.status(500).json({ message: "Failed to create content" });
    }
  });

  // Update content library item
  app.patch('/api/content-library/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateContentLibraryItem(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Content not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error updating library item:", error);
      res.status(500).json({ message: "Failed to update content" });
    }
  });

  // Delete content library item
  app.delete('/api/content-library/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteContentLibraryItem(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting library item:", error);
      res.status(500).json({ message: "Failed to delete content" });
    }
  });

  // Add content to learning path
  app.post('/api/learning-paths/:pathId/library-content', isAuthenticated, async (req: any, res) => {
    try {
      const pathId = parseInt(req.params.pathId);
      const { libraryItemId, orderIndex: providedOrderIndex } = req.body;
      
      // Auto-calculate orderIndex if not provided
      let orderIndex = providedOrderIndex;
      if (orderIndex === undefined || orderIndex === null) {
        const existingContent = await storage.getPathContentFromLibrary(pathId);
        orderIndex = existingContent.length;
      }
      
      const item = await storage.addContentToPath(pathId, libraryItemId, orderIndex);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error adding content to path:", error);
      res.status(500).json({ message: "Failed to add content to path" });
    }
  });

  // Remove content from learning path
  app.delete('/api/learning-paths/:pathId/library-content/:libraryItemId', isAuthenticated, async (req: any, res) => {
    try {
      const pathId = parseInt(req.params.pathId);
      const libraryItemId = parseInt(req.params.libraryItemId);
      await storage.removeContentFromPath(pathId, libraryItemId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing content from path:", error);
      res.status(500).json({ message: "Failed to remove content from path" });
    }
  });

  // Reorder content in learning path
  app.put('/api/learning-paths/:pathId/reorder', isAuthenticated, async (req: any, res) => {
    try {
      const pathId = parseInt(req.params.pathId);
      const { itemIds } = req.body;
      if (!Array.isArray(itemIds)) {
        return res.status(400).json({ message: "itemIds must be an array" });
      }
      
      // Validate that all IDs belong to this path
      const existingContent = await storage.getPathContentFromLibrary(pathId);
      const existingIds = new Set(existingContent.map(c => c.id));
      const allIdsValid = itemIds.every((id: number) => existingIds.has(id));
      if (!allIdsValid) {
        return res.status(400).json({ message: "Some item IDs do not belong to this path" });
      }
      
      await storage.reorderPathContent(pathId, itemIds);
      res.status(200).json({ message: "Content reordered successfully" });
    } catch (error) {
      console.error("Error reordering path content:", error);
      res.status(500).json({ message: "Failed to reorder content" });
    }
  });

  // Favourites routes
  app.get('/api/favorites', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const favorites = await storage.getUserFavourites(userId);
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  app.post('/api/favorites', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { contentType, contentId } = req.body;
      
      if (!contentType || !contentId) {
        return res.status(400).json({ message: "Missing contentType or contentId" });
      }

      if (contentType !== 'learning_path' && contentType !== 'content_item') {
        return res.status(400).json({ message: "Invalid contentType" });
      }

      const favorite = await storage.addFavourite(userId, contentType, contentId);
      res.status(201).json(favorite);
    } catch (error) {
      console.error("Error adding favorite:", error);
      res.status(500).json({ message: "Failed to add favorite" });
    }
  });

  app.delete('/api/favorites', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { contentType, contentId } = req.body;
      
      if (!contentType || !contentId) {
        return res.status(400).json({ message: "Missing contentType or contentId" });
      }

      if (contentType !== 'learning_path' && contentType !== 'content_item') {
        return res.status(400).json({ message: "Invalid contentType" });
      }

      await storage.removeFavourite(userId, contentType, contentId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing favorite:", error);
      res.status(500).json({ message: "Failed to remove favorite" });
    }
  });

  app.get('/api/favorites/check', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { contentType, contentId } = req.query;
      
      if (!contentType || !contentId) {
        return res.status(400).json({ message: "Missing contentType or contentId" });
      }

      if (contentType !== 'learning_path' && contentType !== 'content_item') {
        return res.status(400).json({ message: "Invalid contentType" });
      }

      const isFavourited = await storage.isFavourited(userId, contentType as any, parseInt(contentId as string));
      res.json({ isFavourited });
    } catch (error) {
      console.error("Error checking favorite:", error);
      res.status(500).json({ message: "Failed to check favorite status" });
    }
  });

  // Hydration endpoints
  app.get('/api/hydration/today', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      // Support optional date parameter, default to today
      const dateParam = req.query.date as string | undefined;
      const targetDate = dateParam ? new Date(dateParam) : new Date();
      const stats = await storage.getHydrationStatsForDate(userId, targetDate);
      
      // Auto-complete hydration habit if goal is reached today
      const todayStr = new Date().toISOString().split('T')[0];
      const targetDateStr = targetDate.toISOString().split('T')[0];
      if (todayStr === targetDateStr && stats.percentage >= 100) {
        try {
          const userHabits = await storage.getHabits(userId);
          const hydrationHabit = userHabits.find(h => h.templateId === 16);
          if (hydrationHabit) {
            const completions = await storage.getHabitCompletions(hydrationHabit.id);
            const alreadyCompleted = completions.some(c => {
              const completionDate = new Date(c.completedDate).toISOString().split('T')[0];
              return completionDate === todayStr;
            });
            if (!alreadyCompleted) {
              await storage.completeHabit(hydrationHabit.id, userId);
              console.log('Auto-completed hydration habit for user:', userId);
            }
          }
        } catch (habitError) {
          console.error("Error auto-completing hydration habit:", habitError);
        }
      }
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching hydration stats:", error);
      res.status(500).json({ message: "Failed to fetch hydration stats" });
    }
  });

  app.post('/api/hydration/log', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amountMl, timeOfDay, fluidType, notes } = req.body;

      if (!amountMl || typeof amountMl !== 'number' || amountMl <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      const schema = insertHydrationLogSchema;
      const validated = schema.parse({
        userId,
        date: new Date(),
        amountMl,
        timeOfDay: timeOfDay || null,
        fluidType: fluidType || 'water',
        notes: notes || null,
      });

      const log = await storage.createHydrationLog(validated);
      
      // Auto-complete hydration habit if goal is reached
      try {
        const stats = await storage.getHydrationStatsForDate(userId, new Date());
        if (stats.percentage >= 100) {
          // Find hydration habit (templateId 16) for this user
          const userHabits = await storage.getHabits(userId);
          const hydrationHabit = userHabits.find(h => h.templateId === 16);
          if (hydrationHabit) {
            // Check if already completed today
            const completions = await storage.getHabitCompletions(hydrationHabit.id);
            const todayStr = new Date().toISOString().split('T')[0];
            const alreadyCompleted = completions.some(c => {
              const completionDate = new Date(c.completedDate).toISOString().split('T')[0];
              return completionDate === todayStr;
            });
            if (!alreadyCompleted) {
              await storage.completeHabit(hydrationHabit.id, userId);
              console.log('Auto-completed hydration habit for user:', userId);
            }
          }
        }
      } catch (habitError) {
        console.error("Error auto-completing hydration habit:", habitError);
        // Don't fail the hydration log if habit completion fails
      }
      
      res.status(201).json(log);
    } catch (error) {
      console.error("Error creating hydration log:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create hydration log" });
    }
  });

  app.delete('/api/hydration/log/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteHydrationLog(parseInt(id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting hydration log:", error);
      res.status(500).json({ message: "Failed to delete hydration log" });
    }
  });

  app.get('/api/hydration/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const days = parseInt(req.query.days as string) || 14;
      
      const history: { date: string; totalMl: number; goalMl: number }[] = [];
      const today = new Date();
      
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const logs = await storage.getHydrationLogs(userId, date);
        const goal = await storage.getHydrationGoal(userId, date);
        
        const totalMl = logs.reduce((sum, log) => sum + log.amountMl, 0);
        const goalMl = goal?.goalMl || 3000;
        
        history.push({
          date: date.toISOString().split('T')[0],
          totalMl,
          goalMl,
        });
      }
      
      res.json(history);
    } catch (error) {
      console.error("Error fetching hydration history:", error);
      res.status(500).json({ message: "Failed to fetch hydration history" });
    }
  });

  app.post('/api/hydration/goal', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { goalMl, baselineGoal, adjustmentReason, weight, trainingIntensity, climate, isManuallySet } = req.body;

      const schema = insertHydrationGoalSchema;
      const validated = schema.parse({
        userId,
        date: new Date(),
        goalMl: goalMl || 3000,
        baselineGoal: baselineGoal || 3000,
        adjustmentReason: adjustmentReason || null,
        weight: weight || null,
        trainingIntensity: trainingIntensity || null,
        climate: climate || null,
        isManuallySet: isManuallySet || false,
      });

      const goal = await storage.createOrUpdateHydrationGoal(validated);
      res.json(goal);
    } catch (error) {
      console.error("Error setting hydration goal:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to set hydration goal" });
    }
  });

  // ============ NUTRITION TRACKING ENDPOINTS ============

  // Get nutrition data for a specific date (defaults to today)
  app.get('/api/nutrition/today', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const dateParam = req.query.date as string | undefined;
      const today = dateParam ? new Date(dateParam) : new Date();
      today.setHours(0, 0, 0, 0);
      
      const [goal, oldLogs, mealLogs] = await Promise.all([
        storage.getNutritionGoal(userId),
        storage.getFoodLogsForDate(userId, today),
        storage.getMealLogsForDate(userId, today),
      ]);

      // Get food entries from the new meal-based system
      const mealFoodEntries: any[] = [];
      for (const mealLog of mealLogs) {
        const mealData = await storage.getMealLogWithFoods(mealLog.id);
        if (mealData?.foods) {
          for (const food of mealData.foods) {
            mealFoodEntries.push({
              ...food,
              mealCategory: mealLog.mealName.toLowerCase(),
              mealLogId: mealLog.id,
            });
          }
        }
      }

      // Enhance old logs with serving info (try to match by recipe name)
      const allRecipes = await storage.getRecipes();
      const recipeByName = new Map(allRecipes.map(r => [r.title.toLowerCase(), r]));
      
      const enhancedOldLogs = oldLogs.map(log => {
        const matchedRecipe = recipeByName.get(log.foodName.toLowerCase());
        
        // Use stored values if available, otherwise infer/default
        if (log.servingSize != null && log.servingQuantity != null) {
          // Use stored serving values
          return {
            ...log,
            servingSize: log.servingSize,
            servingSizeUnit: log.servingSizeUnit || 'serving',
            servingQuantity: log.servingQuantity,
            sourceType: matchedRecipe ? 'recipe' : 'manual',
            sourceId: matchedRecipe?.id || null,
          };
        }
        
        if (matchedRecipe) {
          // Calculate serving quantity from the ratio of logged calories to base recipe calories
          const baseCalories = matchedRecipe.calories || 1;
          const inferredQuantity = log.calories / baseCalories;
          // Round to 2 decimal places
          const roundedQuantity = Math.round(inferredQuantity * 100) / 100;
          
          return {
            ...log,
            servingSize: 1,
            servingSizeUnit: 'serving',
            servingQuantity: roundedQuantity || 1,
            sourceType: 'recipe',
            sourceId: matchedRecipe.id,
          };
        }
        return {
          ...log,
          servingSize: 100,
          servingSizeUnit: 'g',
          servingQuantity: 1,
          sourceType: 'manual',
          sourceId: null,
        };
      });

      // Combine old logs and new meal food entries
      const allLogs = [
        ...enhancedOldLogs,
        ...mealFoodEntries.map(entry => ({
          id: entry.id,
          userId: entry.userId,
          date: today,
          mealCategory: entry.mealCategory === 'snack' ? 'snacks' : entry.mealCategory,
          foodName: entry.foodName,
          calories: entry.calories || 0,
          protein: entry.protein || 0,
          carbs: entry.carbs || 0,
          fat: entry.fat || 0,
          notes: null,
          servingSize: entry.servingSize,
          servingSizeUnit: entry.servingSizeUnit,
          servingQuantity: entry.servingQuantity,
          brand: entry.brand,
          sourceType: entry.sourceType,
          sourceId: entry.sourceId,
          mealLogId: entry.mealLogId,
        })),
      ];

      const totals = allLogs.reduce((acc, log) => ({
        calories: acc.calories + (log.calories || 0),
        protein: acc.protein + (log.protein || 0),
        carbs: acc.carbs + (log.carbs || 0),
        fat: acc.fat + (log.fat || 0),
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

      // Build dynamic mealBreakdown based on user's meal categories
      const userCategories = await storage.getUserMealCategories(userId);
      const mealBreakdown: Record<string, any[]> = {};
      
      for (const category of userCategories) {
        const categoryKey = category.name.toLowerCase();
        // Handle 'snack' vs 'snacks' variation
        mealBreakdown[categoryKey] = allLogs.filter(l => {
          const logCategory = l.mealCategory?.toLowerCase();
          return logCategory === categoryKey || 
                 (categoryKey === 'snack' && logCategory === 'snacks') ||
                 (categoryKey === 'snacks' && logCategory === 'snack');
        });
      }
      
      // Also include any custom meal categories that have logged foods but aren't in the user's categories yet
      const categoryKeys = new Set(userCategories.map(c => c.name.toLowerCase()));
      for (const log of allLogs) {
        const logCategory = log.mealCategory?.toLowerCase();
        if (logCategory && !categoryKeys.has(logCategory) && !categoryKeys.has(logCategory === 'snack' ? 'snacks' : logCategory)) {
          if (!mealBreakdown[logCategory]) {
            mealBreakdown[logCategory] = [];
          }
          if (!mealBreakdown[logCategory].includes(log)) {
            mealBreakdown[logCategory].push(log);
          }
        }
      }

      res.json({
        goal: goal || { calorieTarget: 2000, proteinTarget: 150, carbsTarget: 200, fatTarget: 65 },
        logs: allLogs,
        totals,
        mealBreakdown,
      });
    } catch (error) {
      console.error("Error fetching nutrition data:", error);
      res.status(500).json({ message: "Failed to fetch nutrition data" });
    }
  });

  // Get nutrition history for trend graphs
  app.get('/api/nutrition/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const days = parseInt(req.query.days as string) || 7;
      
      const history = await storage.getNutritionHistory(userId, days);
      res.json(history);
    } catch (error) {
      console.error("Error fetching nutrition history:", error);
      res.status(500).json({ message: "Failed to fetch nutrition history" });
    }
  });

  // Create/update nutrition goal
  app.post('/api/nutrition/goal', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { calorieTarget, proteinTarget, carbsTarget, fatTarget } = req.body;

      const goal = await storage.createOrUpdateNutritionGoal(userId, {
        calorieTarget: calorieTarget || 2000,
        proteinTarget: proteinTarget || 150,
        carbsTarget: carbsTarget || 200,
        fatTarget: fatTarget || 65,
      });
      res.json(goal);
    } catch (error) {
      console.error("Error setting nutrition goal:", error);
      res.status(500).json({ message: "Failed to set nutrition goal" });
    }
  });

  // Log food
  app.post('/api/nutrition/food', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { mealCategory, foodName, calories, protein, carbs, fat, notes } = req.body;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const validated = insertFoodLogSchema.parse({
        userId,
        date: today,
        mealCategory,
        foodName,
        calories,
        protein: protein || 0,
        carbs: carbs || 0,
        fat: fat || 0,
        notes: notes || null,
      });

      const log = await storage.createFoodLog(validated);
      res.status(201).json(log);
    } catch (error) {
      console.error("Error logging food:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to log food" });
    }
  });

  // Update food log
  app.put('/api/nutrition/food/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { mealCategory, foodName, calories, protein, carbs, fat, notes, servingSize, servingSizeUnit, servingQuantity } = req.body;

      // Try to update in new meal_food_entries table first
      try {
        const entry = await storage.updateMealFoodEntry(parseInt(id), {
          foodName,
          calories,
          protein,
          carbs,
          fat,
          servingSize,
          servingSizeUnit,
          servingQuantity,
        });
        if (entry) {
          return res.json(entry);
        }
      } catch {
        // Entry not in new table, continue to old table
      }
      
      // Update in old food_logs table
      const log = await storage.updateFoodLog(parseInt(id), {
        mealCategory,
        foodName,
        calories,
        protein,
        carbs,
        fat,
        notes,
        servingSize,
        servingSizeUnit,
        servingQuantity,
      });
      res.json(log);
    } catch (error) {
      console.error("Error updating food log:", error);
      res.status(500).json({ message: "Failed to update food log" });
    }
  });

  // Delete food log
  app.delete('/api/nutrition/food/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteFoodLog(parseInt(id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting food log:", error);
      res.status(500).json({ message: "Failed to delete food log" });
    }
  });

  // Seed random nutrition data for the past month (for testing charts)
  app.post('/api/nutrition/seed', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const mealCategories = ['meal 1', 'meal 2', 'meal 3', 'meal 4'];
      const foods = {
        'meal 1': ['Oatmeal with berries', 'Eggs and toast', 'Greek yogurt parfait', 'Protein smoothie', 'Avocado toast'],
        'meal 2': ['Grilled chicken salad', 'Turkey sandwich', 'Quinoa bowl', 'Soup and salad', 'Salmon wrap'],
        'meal 3': ['Steak and vegetables', 'Grilled salmon', 'Chicken stir-fry', 'Pasta with meatballs', 'Fish tacos'],
        'meal 4': ['Protein bar', 'Mixed nuts', 'Apple with peanut butter', 'Cheese and crackers', 'Hummus with veggies']
      };
      
      const createdLogs = [];
      
      // Generate data for the past 30 days
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        // Random number of meals per day (1-4)
        const numMeals = Math.floor(Math.random() * 4) + 1;
        const mealsToday = mealCategories.slice(0, numMeals);
        
        for (const meal of mealsToday) {
          const foodList = foods[meal as keyof typeof foods];
          const foodName = foodList[Math.floor(Math.random() * foodList.length)];
          
          // Random macro values
          const calories = Math.floor(Math.random() * 500) + 200; // 200-700 cal
          const protein = Math.floor(Math.random() * 40) + 10; // 10-50g
          const carbs = Math.floor(Math.random() * 60) + 20; // 20-80g
          const fat = Math.floor(Math.random() * 30) + 5; // 5-35g
          
          const log = await storage.createFoodLog({
            userId,
            date,
            mealCategory: meal,
            foodName,
            calories,
            protein,
            carbs,
            fat,
            notes: null
          });
          createdLogs.push(log);
        }
      }
      
      res.status(201).json({ 
        success: true, 
        message: `Created ${createdLogs.length} food log entries for the past 30 days`,
        count: createdLogs.length
      });
    } catch (error) {
      console.error("Error seeding nutrition data:", error);
      res.status(500).json({ message: "Failed to seed nutrition data" });
    }
  });

  // ============ ENHANCED MEAL/FOOD ENDPOINTS ============

  // Get meals for a specific date with food items
  app.get('/api/nutrition/meals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const dateParam = req.query.date as string;
      const date = dateParam ? new Date(dateParam) : new Date();
      
      const mealLogs = await storage.getMealLogsForDate(userId, date);
      
      // Get food items for each meal
      const mealsWithFoods = await Promise.all(
        mealLogs.map(async (meal) => {
          const mealData = await storage.getMealLogWithFoods(meal.id);
          return {
            ...meal,
            foods: mealData?.foods || [],
            totals: mealData?.foods.reduce((acc, food) => ({
              calories: acc.calories + food.calories,
              protein: acc.protein + (food.protein || 0),
              carbs: acc.carbs + (food.carbs || 0),
              fat: acc.fat + (food.fat || 0),
            }), { calories: 0, protein: 0, carbs: 0, fat: 0 }),
          };
        })
      );
      
      res.json(mealsWithFoods);
    } catch (error) {
      console.error("Error fetching meals:", error);
      res.status(500).json({ message: "Failed to fetch meals" });
    }
  });

  // Get daily totals from new meal system
  app.get('/api/nutrition/meals/totals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const dateParam = req.query.date as string;
      const date = dateParam ? new Date(dateParam) : new Date();
      
      const totals = await storage.getMealDayTotals(userId, date);
      res.json(totals);
    } catch (error) {
      console.error("Error fetching meal totals:", error);
      res.status(500).json({ message: "Failed to fetch totals" });
    }
  });

  // Add food to a meal (creates meal if doesn't exist)
  app.post('/api/nutrition/meals/food', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { mealName, foodName, brand, servingSize, servingSizeUnit, servingQuantity, calories, protein, carbs, fat, date: dateParam } = req.body;
      
      const date = dateParam ? new Date(dateParam) : new Date();
      
      // Get or create the meal log
      const mealLog = await storage.getOrCreateMealLog(userId, date, mealName);
      
      // Add food to the meal
      const foodEntry = await storage.addFoodToMeal({
        mealLogId: mealLog.id,
        userId,
        foodName,
        brand: brand || null,
        servingSize: servingSize || 100,
        servingSizeUnit: servingSizeUnit || 'gram',
        servingQuantity: servingQuantity || 1,
        calories,
        protein: protein || 0,
        carbs: carbs || 0,
        fat: fat || 0,
        sourceType: 'manual',
      });
      
      // Update user streak after food tracking (non-blocking)
      storage.updateUserStreak(userId).catch(err => {
        console.error(`[STREAK] Background update failed, will recalculate on next fetch:`, err?.message);
      });
      
      res.status(201).json(foodEntry);
    } catch (error) {
      console.error("Error adding food to meal:", error);
      res.status(500).json({ message: "Failed to add food to meal" });
    }
  });

  // Update food entry in a meal
  app.put('/api/nutrition/meals/food/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { servingSize, servingSizeUnit, servingQuantity, calories, protein, carbs, fat } = req.body;
      
      const updated = await storage.updateMealFoodEntry(parseInt(id), {
        servingSize,
        servingSizeUnit,
        servingQuantity,
        calories,
        protein,
        carbs,
        fat,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating food entry:", error);
      res.status(500).json({ message: "Failed to update food entry" });
    }
  });

  // Delete food entry from a meal
  app.delete('/api/nutrition/meals/food/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteMealFoodEntry(parseInt(id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting food entry:", error);
      res.status(500).json({ message: "Failed to delete food entry" });
    }
  });

  // Delete entire meal log
  app.delete('/api/nutrition/meals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteMealLog(parseInt(id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting meal:", error);
      res.status(500).json({ message: "Failed to delete meal" });
    }
  });

  // ============ FOOD HISTORY ENDPOINTS ============

  // Get user's food history
  app.get('/api/nutrition/food-history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 50;
      const history = await storage.getUserFoodHistory(userId, limit);
      res.json(history);
    } catch (error) {
      console.error("Error fetching food history:", error);
      res.status(500).json({ message: "Failed to fetch food history" });
    }
  });

  // Search food history
  app.get('/api/nutrition/food-history/search', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const query = req.query.q as string;
      
      if (!query) {
        return res.json([]);
      }
      
      const results = await storage.searchUserFoodHistory(userId, query);
      res.json(results);
    } catch (error) {
      console.error("Error searching food history:", error);
      res.status(500).json({ message: "Failed to search food history" });
    }
  });

  // Delete food history item
  app.delete('/api/nutrition/food-history/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteFoodHistoryItem(parseInt(id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting food history item:", error);
      res.status(500).json({ message: "Failed to delete food history item" });
    }
  });

  // ============ SAVED MEALS ENDPOINTS ============

  // Get user's saved meals
  app.get('/api/nutrition/saved-meals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const savedMeals = await storage.getUserSavedMeals(userId);
      res.json(savedMeals);
    } catch (error) {
      console.error("Error fetching saved meals:", error);
      res.status(500).json({ message: "Failed to fetch saved meals" });
    }
  });

  // Get saved meal with items
  app.get('/api/nutrition/saved-meals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const savedMeal = await storage.getSavedMealWithItems(parseInt(id));
      if (!savedMeal) {
        return res.status(404).json({ message: "Saved meal not found" });
      }
      res.json(savedMeal);
    } catch (error) {
      console.error("Error fetching saved meal:", error);
      res.status(500).json({ message: "Failed to fetch saved meal" });
    }
  });

  // Create saved meal template with items
  app.post('/api/nutrition/saved-meals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, description, items } = req.body;
      
      const template = await storage.createSavedMealTemplate({
        userId,
        name,
        description: description || null,
      });
      
      // Add items if provided
      if (items && Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          await storage.addItemToSavedMeal({
            savedMealId: template.id,
            foodName: item.foodName,
            brand: item.brand || null,
            servingSize: item.servingSize || 100,
            servingSizeUnit: item.servingSizeUnit || 'gram',
            calories: item.calories || 0,
            protein: item.protein || 0,
            carbs: item.carbs || 0,
            fat: item.fat || 0,
          });
        }
      }
      
      // Fetch the updated saved meal with calculated totals
      const savedMealWithItems = await storage.getSavedMealWithItems(template.id);
      res.status(201).json(savedMealWithItems?.template || template);
    } catch (error) {
      console.error("Error creating saved meal:", error);
      res.status(500).json({ message: "Failed to create saved meal" });
    }
  });

  // Update saved meal template
  app.put('/api/nutrition/saved-meals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      
      const updated = await storage.updateSavedMealTemplate(parseInt(id), {
        name,
        description,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating saved meal:", error);
      res.status(500).json({ message: "Failed to update saved meal" });
    }
  });

  // Delete saved meal template
  app.delete('/api/nutrition/saved-meals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteSavedMealTemplate(parseInt(id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting saved meal:", error);
      res.status(500).json({ message: "Failed to delete saved meal" });
    }
  });

  // Add item to saved meal
  app.post('/api/nutrition/saved-meals/:id/items', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { foodName, brand, servingSize, servingSizeUnit, servingQuantity, calories, protein, carbs, fat, recipeId, foodHistoryId } = req.body;
      
      const item = await storage.addItemToSavedMeal({
        savedMealId: parseInt(id),
        foodName,
        brand: brand || null,
        servingSize: servingSize || 100,
        servingSizeUnit: servingSizeUnit || 'gram',
        servingQuantity: servingQuantity || 1,
        calories,
        protein: protein || 0,
        carbs: carbs || 0,
        fat: fat || 0,
        recipeId: recipeId || null,
        foodHistoryId: foodHistoryId || null,
      });
      
      res.status(201).json(item);
    } catch (error) {
      console.error("Error adding item to saved meal:", error);
      res.status(500).json({ message: "Failed to add item to saved meal" });
    }
  });

  // Delete item from saved meal
  app.delete('/api/nutrition/saved-meals/items/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteItemFromSavedMeal(parseInt(id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting item from saved meal:", error);
      res.status(500).json({ message: "Failed to delete item from saved meal" });
    }
  });

  // Add saved meal to log
  app.post('/api/nutrition/saved-meals/:id/log', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { mealName, servings, date: dateParam } = req.body;
      
      const date = dateParam ? new Date(dateParam) : new Date();
      
      // Get or create the meal log
      const mealLog = await storage.getOrCreateMealLog(userId, date, mealName);
      
      // Add saved meal items to the log
      const entries = await storage.addSavedMealToLog(userId, parseInt(id), mealLog.id, servings || 1);
      
      res.status(201).json(entries);
    } catch (error) {
      console.error("Error adding saved meal to log:", error);
      res.status(500).json({ message: "Failed to add saved meal to log" });
    }
  });

  // ============ USER MEAL CATEGORIES ============

  // Get user's meal categories
  app.get('/api/nutrition/meal-categories', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const categories = await storage.getUserMealCategories(userId);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching meal categories:", error);
      res.status(500).json({ message: "Failed to fetch meal categories" });
    }
  });

  // Create new meal category
  app.post('/api/nutrition/meal-categories', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, displayOrder } = req.body;
      
      // Get existing categories to determine next order
      const existing = await storage.getUserMealCategories(userId);
      const nextOrder = displayOrder ?? Math.max(...existing.map(c => c.displayOrder), -1) + 1;
      
      const category = await storage.createUserMealCategory({
        userId,
        name,
        displayOrder: nextOrder,
        isDefault: false,
      });
      
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating meal category:", error);
      res.status(500).json({ message: "Failed to create meal category" });
    }
  });

  // Update meal category
  app.put('/api/nutrition/meal-categories/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { name, displayOrder } = req.body;
      
      const category = await storage.updateUserMealCategory(parseInt(id), { name, displayOrder });
      res.json(category);
    } catch (error) {
      console.error("Error updating meal category:", error);
      res.status(500).json({ message: "Failed to update meal category" });
    }
  });

  // Delete meal category
  app.delete('/api/nutrition/meal-categories/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteUserMealCategory(parseInt(id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting meal category:", error);
      res.status(500).json({ message: "Failed to delete meal category" });
    }
  });

  // ============ RECIPE TO MEAL INTEGRATION ============

  // Add recipe to meal log
  app.post('/api/nutrition/recipes/:recipeId/log', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { recipeId } = req.params;
      const { mealName, servings, date: dateParam } = req.body;
      
      const date = dateParam ? new Date(dateParam) : new Date();
      
      // Get or create the meal log
      const mealLog = await storage.getOrCreateMealLog(userId, date, mealName);
      
      // Add recipe to the meal
      const entry = await storage.addRecipeToMeal(userId, parseInt(recipeId), mealLog.id, servings || 1);
      
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error adding recipe to meal:", error);
      res.status(500).json({ message: "Failed to add recipe to meal" });
    }
  });

  // ============ SUPPLEMENT STACK ENDPOINTS ============

  // Get active supplements
  app.get('/api/supplements/active', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const supplements = await storage.getAllUserSupplements(userId);
      const activeSupplements = supplements.filter(s => s.isActive !== false);
      res.json(activeSupplements);
    } catch (error) {
      console.error("Error fetching active supplements:", error);
      res.status(500).json({ message: "Failed to fetch active supplements" });
    }
  });

  // Get inactive (past) supplements
  app.get('/api/supplements/inactive', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const supplements = await storage.getAllUserSupplements(userId);
      const inactiveSupplements = supplements.filter(s => s.isActive === false);
      res.json(inactiveSupplements);
    } catch (error) {
      console.error("Error fetching inactive supplements:", error);
      res.status(500).json({ message: "Failed to fetch inactive supplements" });
    }
  });

  // Get user's supplements with today's status and last taken date
  app.get('/api/supplements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const supplements = await storage.getUserSupplements(userId);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayLogs = await storage.getSupplementLogsForDate(userId, today);
      
      const supplementsWithStatus = await Promise.all(supplements.map(async supp => {
        const logs = await storage.getSupplementLogs(userId, supp.id);
        const takenLogs = logs.filter(log => log.taken).sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        const lastTakenDate = takenLogs.length > 0 ? takenLogs[0].date : null;
        
        return {
          ...supp,
          takenToday: todayLogs.some(log => log.supplementId === supp.id && log.taken),
          lastTakenDate,
        };
      }));

      res.json(supplementsWithStatus);
    } catch (error) {
      console.error("Error fetching supplements:", error);
      res.status(500).json({ message: "Failed to fetch supplements" });
    }
  });

  // Add supplement
  app.post('/api/supplements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, timeOfDay, notes, dosage, frequency } = req.body;

      const validated = insertSupplementSchema.parse({
        userId,
        name,
        timeOfDay,
        notes: notes || null,
        dosage: dosage || null,
        frequency: frequency || 1,
      });

      const supplement = await storage.createSupplement(validated);
      res.status(201).json(supplement);
    } catch (error) {
      console.error("Error creating supplement:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create supplement" });
    }
  });

  // AI Supplement Stack Recommendations
  app.get('/api/supplements/ai-recommendations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const supplements = await storage.getUserSupplements(userId);
      const currentStack = supplements.map(s => `${s.name} (${s.dosage || 'no dosage'}, ${s.timeOfDay})`).join(', ');

      let bodyMapContext = '';
      try {
        const bodyMapLogs = await storage.getBodyMapLogs(userId);
        if (bodyMapLogs && bodyMapLogs.length > 0) {
          const recent = bodyMapLogs.slice(0, 3);
          bodyMapContext = `Recent body map issues: ${recent.map((l: any) => `${l.bodyPart} (severity ${l.severity}/10)`).join(', ')}`;
        }
      } catch {}

      let goalsContext = '';
      try {
        const goals = await storage.getUserGoals(userId);
        if (goals && goals.length > 0) {
          goalsContext = `User goals: ${goals.map((g: any) => g.title || g.name).join(', ')}`;
        }
      } catch {}

      const { getFeatureConfig, analyzeText } = await import('./aiProvider');
      const config = await getFeatureConfig('nutrition_insights');

      if (!config) {
        return res.json({ recommendations: "AI recommendations are currently unavailable. Please check your AI provider settings." });
      }

      const prompt = `You are a sports nutrition and supplement expert. Analyse this user's current supplement stack and provide personalised recommendations.

Current stack: ${currentStack || 'No supplements added yet'}
${bodyMapContext}
${goalsContext}

Provide:
1. Assessment of their current stack (what is good, what might be missing)
2. 2-3 specific supplement recommendations with dosage and timing
3. Any adjustments to their current stack

Keep your response concise, practical, and evidence-based. Do not use em dashes. Use plain language.`;

      const aiResponse = await analyzeText({ prompt, maxTokens: 800 }, config.provider, config.model);
      res.json({ recommendations: aiResponse.text });
    } catch (error) {
      console.error("Error generating supplement recommendations:", error);
      res.status(500).json({ message: "Failed to generate recommendations" });
    }
  });

  // Supplement Interaction Warnings
  app.get('/api/supplements/interactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const supplements = await storage.getUserSupplements(userId);
      
      if (supplements.length < 2) {
        return res.json({ warnings: [] });
      }

      const KNOWN_INTERACTIONS: Array<{ pair: [string, string]; warning: string; severity: 'low' | 'medium' | 'high' }> = [
        { pair: ['zinc', 'iron'], warning: 'Zinc and iron compete for absorption. Take them at least 2 hours apart.', severity: 'medium' },
        { pair: ['calcium', 'iron'], warning: 'Calcium reduces iron absorption. Take them at different times of day.', severity: 'medium' },
        { pair: ['calcium', 'zinc'], warning: 'Calcium can reduce zinc absorption when taken together. Separate by 2+ hours.', severity: 'low' },
        { pair: ['vitamin d', 'vitamin k2'], warning: 'Vitamin D and K2 work synergistically. Taking them together is beneficial.', severity: 'low' },
        { pair: ['magnesium', 'calcium'], warning: 'High-dose calcium can interfere with magnesium absorption. Consider taking at different times.', severity: 'low' },
        { pair: ['fish oil', 'vitamin e'], warning: 'Fish oil may increase vitamin E requirements. Monitor your intake.', severity: 'low' },
        { pair: ['ashwagandha', 'thyroid medication'], warning: 'Ashwagandha may affect thyroid hormone levels. Consult your doctor if on thyroid medication.', severity: 'high' },
        { pair: ['st john', 'ssri'], warning: 'St John\'s Wort can interact dangerously with antidepressants. Consult your doctor.', severity: 'high' },
        { pair: ['turmeric', 'blood thinner'], warning: 'Turmeric has blood-thinning properties. Use caution if on anticoagulants.', severity: 'high' },
        { pair: ['green tea', 'iron'], warning: 'Green tea extract can reduce iron absorption. Take 2+ hours apart.', severity: 'medium' },
      ];

      const suppNames = supplements.map(s => s.name.toLowerCase());
      const warnings: Array<{ supplements: string[]; warning: string; severity: 'low' | 'medium' | 'high' }> = [];

      for (const interaction of KNOWN_INTERACTIONS) {
        const match0 = suppNames.some(n => n.includes(interaction.pair[0]));
        const match1 = suppNames.some(n => n.includes(interaction.pair[1]));
        if (match0 && match1) {
          const matchedSupps = supplements
            .filter(s => interaction.pair.some(p => s.name.toLowerCase().includes(p)))
            .map(s => s.name);
          warnings.push({
            supplements: matchedSupps,
            warning: interaction.warning,
            severity: interaction.severity,
          });
        }
      }

      res.json({ warnings });
    } catch (error) {
      console.error("Error checking supplement interactions:", error);
      res.status(500).json({ message: "Failed to check interactions" });
    }
  });

  // Get single supplement by ID
  app.get('/api/supplements/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const supplement = await storage.getSupplementById(parseInt(id));
      if (!supplement || supplement.userId !== userId) {
        return res.status(404).json({ message: "Supplement not found" });
      }
      res.json(supplement);
    } catch (error) {
      console.error("Error fetching supplement:", error);
      res.status(500).json({ message: "Failed to fetch supplement" });
    }
  });

  // Get supplement logs
  app.get('/api/supplements/:id/logs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const logs = await storage.getSupplementLogs(userId, parseInt(id));
      res.json(logs);
    } catch (error) {
      console.error("Error fetching supplement logs:", error);
      res.status(500).json({ message: "Failed to fetch supplement logs" });
    }
  });

  // Get supplement stats
  app.get('/api/supplements/:id/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const stats = await storage.getSupplementStats(userId, parseInt(id));
      res.json(stats);
    } catch (error) {
      console.error("Error fetching supplement stats:", error);
      res.status(500).json({ message: "Failed to fetch supplement stats" });
    }
  });

  // Deactivate supplement (move to past)
  app.delete('/api/supplements/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const supplementId = parseInt(id);
      
      const hasLogs = await storage.hasSupplementLogs(supplementId);
      if (!hasLogs) {
        return res.status(400).json({ message: "Cannot archive supplement without any logged entries. Delete it instead." });
      }
      
      await storage.deleteSupplement(supplementId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deactivating supplement:", error);
      res.status(500).json({ message: "Failed to deactivate supplement" });
    }
  });

  // Permanently delete supplement
  app.delete('/api/supplements/:id/permanent', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.permanentlyDeleteSupplement(parseInt(id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error permanently deleting supplement:", error);
      res.status(500).json({ message: "Failed to permanently delete supplement" });
    }
  });

  // Check if supplement has logs
  app.get('/api/supplements/:id/has-logs', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const hasLogs = await storage.hasSupplementLogs(parseInt(id));
      res.json({ hasLogs });
    } catch (error) {
      console.error("Error checking supplement logs:", error);
      res.status(500).json({ message: "Failed to check supplement logs" });
    }
  });

  // Update supplement
  app.patch('/api/supplements/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      const supplement = await storage.getSupplementById(parseInt(id));
      if (!supplement || supplement.userId !== userId) {
        return res.status(404).json({ message: "Supplement not found" });
      }
      
      const updateSchema = insertSupplementSchema.partial().omit({ userId: true });
      const validated = updateSchema.parse({
        name: req.body.name,
        dosage: req.body.dosage || null,
        timeOfDay: req.body.timeOfDay,
        frequency: req.body.frequency ? parseInt(req.body.frequency) : undefined,
      });
      
      const updated = await storage.updateSupplement(parseInt(id), validated);
      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid supplement data", errors: error.errors });
      }
      console.error("Error updating supplement:", error);
      res.status(500).json({ message: "Failed to update supplement" });
    }
  });

  // Toggle supplement taken status
  app.post('/api/supplements/:id/toggle', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const result = await storage.toggleSupplementTaken(userId, parseInt(id), today);
      
      // Update user streak after supplement logging (non-blocking)
      storage.updateUserStreak(userId).catch(err => {
        console.error(`[STREAK] Background update failed, will recalculate on next fetch:`, err?.message);
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error toggling supplement:", error);
      res.status(500).json({ message: "Failed to toggle supplement" });
    }
  });

  // Daily Check-In endpoints
  app.get('/api/check-ins', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const checkIns = await storage.getUserCheckIns(userId);
      res.json(checkIns);
    } catch (error) {
      console.error("Error fetching check-ins:", error);
      res.status(500).json({ message: "Failed to fetch check-ins" });
    }
  });

  app.get('/api/check-ins/today', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const checkIn = await storage.getTodayCheckIn(userId);
      res.json(checkIn || null);
    } catch (error) {
      console.error("Error fetching today's check-in:", error);
      res.status(500).json({ message: "Failed to fetch check-in" });
    }
  });

  app.get('/api/check-ins/date/:date', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const dateStr = req.params.date;
      const checkIns = await storage.getUserCheckIns(userId);
      const checkIn = checkIns.find(c => {
        if (!c.checkInDate) return false;
        const checkInDateStr = new Date(c.checkInDate).toISOString().split('T')[0];
        return checkInDateStr === dateStr;
      });
      res.json(checkIn || null);
    } catch (error) {
      console.error("Error fetching check-in for date:", error);
      res.status(500).json({ message: "Failed to fetch check-in" });
    }
  });

  app.post('/api/check-ins', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const checkInData = insertCheckInSchema.parse({
        ...req.body,
        userId,
        checkInDate: req.body.checkInDate ? new Date(req.body.checkInDate) : new Date(),
      });

      const checkIn = await storage.createCheckIn(checkInData);
      
      // Update user streak after check-in (non-blocking)
      storage.updateUserStreak(userId).catch(err => {
        console.error(`[STREAK] Background update failed, will recalculate on next fetch:`, err?.message);
      });

      // Auto-complete the "Complete Your Check-In" habit (templateId 31) if the user has it
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const userHabits = await storage.getHabits(userId);
        const checkInHabit = userHabits.find(h => h.templateId === 31);
        if (checkInHabit) {
          const completions = await storage.getHabitCompletions(checkInHabit.id);
          const alreadyCompleted = completions.some(c => {
            const completionDate = new Date(c.completedDate).toISOString().split('T')[0];
            return completionDate === todayStr;
          });
          if (!alreadyCompleted) {
            await storage.completeHabit(checkInHabit.id, userId);
            console.log('[Check-In] Auto-completed check-in habit for user:', userId);
          }
        }
      } catch (habitError) {
        console.error('[Check-In] Error auto-completing check-in habit:', habitError);
      }

      res.status(201).json(checkIn);
    } catch (error) {
      console.error("Error creating check-in:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create check-in" });
    }
  });

  // Get recent check-ins for fatigue detection logic
  app.get('/api/check-ins/recent/:count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const count = parseInt(req.params.count) || 3;
      const checkIns = await storage.getUserCheckIns(userId, count);
      res.json(checkIns);
    } catch (error) {
      console.error("Error fetching recent check-ins:", error);
      res.status(500).json({ message: "Failed to fetch recent check-ins" });
    }
  });

  // User Path Assignment endpoints
  app.get('/api/user-path-assignments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const assignments = await storage.getUserPathAssignments(userId);
      
      // Fetch full learning path details for each assignment
      const pathsWithDetails = await Promise.all(
        assignments.map(async (assignment) => {
          const path = await storage.getLearningPathById(assignment.pathId);
          return {
            ...assignment,
            path
          };
        })
      );
      
      res.json(pathsWithDetails);
    } catch (error) {
      console.error("Error fetching user path assignments:", error);
      res.status(500).json({ message: "Failed to fetch enrolled paths" });
    }
  });

  app.post('/api/user-path-assignments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { pathId } = req.body;

      if (!pathId) {
        return res.status(400).json({ message: "Missing pathId" });
      }

      // Check if user already has 3 active learning paths
      const currentAssignments = await storage.getUserPathAssignments(userId);
      if (currentAssignments.length >= 3) {
        return res.status(400).json({ 
          message: "You can only enrol in up to 3 learning paths at the same time. Please complete or remove an existing path to enrol in a new one." 
        });
      }

      const assignment = await storage.createUserPathAssignment(userId, parseInt(pathId));
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error creating path assignment:", error);
      res.status(500).json({ message: "Failed to enrol in learning path" });
    }
  });

  app.delete('/api/user-path-assignments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { pathId } = req.body;

      if (!pathId) {
        return res.status(400).json({ message: "Missing pathId" });
      }

      await storage.deleteUserPathAssignment(userId, parseInt(pathId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting path assignment:", error);
      res.status(500).json({ message: "Failed to leave learning path" });
    }
  });

  // Schedule a workout for a future date
  app.post('/api/workouts/:workoutId/schedule', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { workoutId } = req.params;
      const { scheduledDate, workoutName, workoutType } = req.body;

      if (!scheduledDate || !workoutName) {
        return res.status(400).json({ message: "Missing scheduledDate or workoutName" });
      }

      const scheduled = await storage.scheduleWorkout(
        userId,
        parseInt(workoutId),
        workoutType || 'individual',
        workoutName,
        new Date(scheduledDate)
      );

      res.status(201).json(scheduled);
    } catch (error) {
      console.error("Error scheduling workout:", error);
      res.status(500).json({ message: "Failed to schedule workout" });
    }
  });

  // Get scheduled workouts for a specific date or date range (includes both individual scheduled and programme workouts)
  app.get('/api/scheduled-workouts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { date, startDate, endDate } = req.query;

      // Handle date range query
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        
        // Get individually scheduled workouts in the range
        const scheduledWorkouts = await storage.getScheduledWorkoutsInRange(userId, start, end);
        
        // Get programme workouts in the range
        const programmeWorkouts = await storage.getProgrammeWorkoutsInRange(userId, start, end);
        
        // Combine and return
        const allWorkouts = [...scheduledWorkouts, ...programmeWorkouts];
        return res.json(allWorkouts);
      }

      // Handle single date query
      if (!date) {
        return res.status(400).json({ message: "Missing date or startDate/endDate parameters" });
      }

      const scheduledDate = new Date(date as string);
      
      // Get individually scheduled workouts for this date
      const scheduledWorkouts = await storage.getScheduledWorkoutsForDate(userId, scheduledDate);
      
      // Get programme workouts (active + scheduled enrollments) for this date
      const programmeWorkouts = await storage.getProgrammeWorkoutsInRange(userId, scheduledDate, scheduledDate);
      
      const allWorkouts: any[] = [...scheduledWorkouts, ...programmeWorkouts];

      res.json(allWorkouts);
    } catch (error) {
      console.error("Error fetching scheduled workouts:", error);
      res.status(500).json({ message: "Failed to fetch scheduled workouts" });
    }
  });

  // Move a scheduled workout to a different day (calendar override - does not affect programme template)
  app.patch('/api/scheduled-workouts/:id/move', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const scheduledWorkoutId = parseInt(req.params.id);
      const { newDate } = req.body;

      if (!newDate) {
        return res.status(400).json({ message: "Missing newDate parameter" });
      }

      // Update the scheduled date
      const updated = await storage.moveScheduledWorkout(userId, scheduledWorkoutId, new Date(newDate));
      
      if (!updated) {
        return res.status(404).json({ message: "Scheduled workout not found" });
      }

      res.json({ success: true, workout: updated });
    } catch (error) {
      console.error("Error moving scheduled workout:", error);
      res.status(500).json({ message: "Failed to move scheduled workout" });
    }
  });

  // Delete a scheduled workout
  app.delete('/api/scheduled-workouts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const scheduledWorkoutId = parseInt(req.params.id);

      await storage.deleteScheduledWorkout(userId, scheduledWorkoutId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting scheduled workout:", error);
      res.status(500).json({ message: "Failed to delete scheduled workout" });
    }
  });
  
  // Move an enrollment workout to a different day (individual workout - only affects this specific week)
  app.patch('/api/enrollment-workouts/:id/move', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const enrollmentWorkoutId = parseInt(req.params.id);
      const { newDate } = req.body;

      if (!newDate) {
        return res.status(400).json({ message: "Missing newDate parameter" });
      }

      const updated = await storage.moveEnrollmentWorkout(userId, enrollmentWorkoutId, new Date(newDate));
      
      if (!updated) {
        return res.status(404).json({ message: "Enrollment workout not found" });
      }

      res.json({ success: true, workout: updated });
    } catch (error) {
      console.error("Error moving enrollment workout:", error);
      res.status(500).json({ message: "Failed to move enrollment workout" });
    }
  });
  
  // Revert an enrollment workout move (restore to original schedule)
  app.patch('/api/enrollment-workouts/:id/revert', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const enrollmentWorkoutId = parseInt(req.params.id);

      const updated = await storage.revertEnrollmentWorkoutMove(userId, enrollmentWorkoutId);
      
      if (!updated) {
        return res.status(404).json({ message: "Enrollment workout not found" });
      }

      res.json({ success: true, workout: updated });
    } catch (error) {
      console.error("Error reverting enrollment workout move:", error);
      res.status(500).json({ message: "Failed to revert enrollment workout move" });
    }
  });

  // Video Workout Progress Routes
  app.get('/api/video-workout-progress/:workoutId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const workoutId = parseInt(req.params.workoutId);

      const progress = await storage.getVideoWorkoutProgress(userId, workoutId);
      res.json(progress || null);
    } catch (error) {
      console.error("Error fetching video progress:", error);
      res.status(500).json({ message: "Failed to fetch video progress" });
    }
  });

  app.post('/api/video-workout-progress/:workoutId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const workoutId = parseInt(req.params.workoutId);
      const { progressTime, duration, completed } = req.body;

      if (progressTime === undefined || duration === undefined) {
        return res.status(400).json({ message: "Missing progressTime or duration" });
      }

      const progress = await storage.saveVideoWorkoutProgress(
        userId,
        workoutId,
        progressTime,
        duration,
        completed
      );

      res.json(progress);
    } catch (error) {
      console.error("Error saving video progress:", error);
      res.status(500).json({ message: "Failed to save video progress" });
    }
  });

  // ============================================
  // PROGRESS TRACKING API ENDPOINTS
  // ============================================

  // Workout History - Get completed workouts
  app.get('/api/progress/workouts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const workouts = await storage.getCompletedWorkoutLogs(userId, limit);
      res.json(workouts);
    } catch (error) {
      console.error("Error fetching workout history:", error);
      res.status(500).json({ message: "Failed to fetch workout history" });
    }
  });

  // Exercise PRs - Get all exercise snapshots
  app.get('/api/progress/exercise-prs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const snapshots = await storage.getAllExerciseSnapshots(userId);
      res.json(snapshots);
    } catch (error) {
      console.error("Error fetching exercise PRs:", error);
      res.status(500).json({ message: "Failed to fetch exercise PRs" });
    }
  });

  // Exercise PRs List - Get all exercises with their PR values for the new Exercise PRs screen
  app.get('/api/progress/exercise-prs-list', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get all exercises from library that are strength or endurance type
      const allExercises = await db
        .select({
          id: exerciseLibrary.id,
          name: exerciseLibrary.name,
          exerciseType: exerciseLibrary.exerciseType,
        })
        .from(exerciseLibrary)
        .where(
          or(
            eq(exerciseLibrary.exerciseType, 'strength'),
            eq(exerciseLibrary.exerciseType, 'endurance')
          )
        )
        .orderBy(exerciseLibrary.name);

      // Get all set logs for this user with joins to get exercise info
      const setLogs = await db
        .select({
          exerciseLibraryId: workoutExerciseLogs.exerciseLibraryId,
          actualReps: workoutSetLogs.actualReps,
          actualWeight: workoutSetLogs.actualWeight,
          completedAt: workoutLogs.completedAt,
        })
        .from(workoutSetLogs)
        .innerJoin(workoutExerciseLogs, eq(workoutSetLogs.exerciseLogId, workoutExerciseLogs.id))
        .innerJoin(workoutLogs, eq(workoutExerciseLogs.workoutLogId, workoutLogs.id))
        .where(eq(workoutLogs.userId, userId));

      // Calculate PRs per exercise
      const exercisePRs: Record<number, {
        maxWeight: number | null;
        maxReps: number | null;
        volume: number | null;
        oneRepMax: number | null;
        fiveRepMax: number | null;
        tenRepMax: number | null;
      }> = {};

      // Group sets by workout session and exercise for volume calculation
      const sessionVolumes: Record<string, number> = {};

      for (const log of setLogs) {
        if (!log.exerciseLibraryId) continue;
        
        const exId = log.exerciseLibraryId;
        if (!exercisePRs[exId]) {
          exercisePRs[exId] = {
            maxWeight: null,
            maxReps: null,
            volume: null,
            oneRepMax: null,
            fiveRepMax: null,
            tenRepMax: null,
          };
        }

        const pr = exercisePRs[exId];
        const reps = log.actualReps || 0;
        const weight = log.actualWeight || 0;

        // Max weight
        if (weight > 0 && (pr.maxWeight === null || weight > pr.maxWeight)) {
          pr.maxWeight = weight;
        }

        // Max reps
        if (reps > 0 && (pr.maxReps === null || reps > pr.maxReps)) {
          pr.maxReps = reps;
        }

        // Exact rep maxes
        if (reps === 1 && weight > 0 && (pr.oneRepMax === null || weight > pr.oneRepMax)) {
          pr.oneRepMax = weight;
        }
        if (reps === 5 && weight > 0 && (pr.fiveRepMax === null || weight > pr.fiveRepMax)) {
          pr.fiveRepMax = weight;
        }
        if (reps === 10 && weight > 0 && (pr.tenRepMax === null || weight > pr.tenRepMax)) {
          pr.tenRepMax = weight;
        }

        // Session volume tracking
        const sessionKey = `${exId}-${log.completedAt?.toISOString()}`;
        const setVolume = reps * weight;
        sessionVolumes[sessionKey] = (sessionVolumes[sessionKey] || 0) + setVolume;
      }

      // Calculate best session volume per exercise
      for (const key of Object.keys(sessionVolumes)) {
        const exId = parseInt(key.split('-')[0]);
        if (exercisePRs[exId]) {
          const vol = sessionVolumes[key];
          if (exercisePRs[exId].volume === null || vol > exercisePRs[exId].volume!) {
            exercisePRs[exId].volume = vol;
          }
        }
      }

      // Combine exercises with their PRs
      const result = allExercises.map(ex => ({
        id: ex.id,
        name: ex.name,
        exerciseType: ex.exerciseType,
        ...exercisePRs[ex.id] || {
          maxWeight: null,
          maxReps: null,
          volume: null,
          oneRepMax: null,
          fiveRepMax: null,
          tenRepMax: null,
        }
      }));

      res.json(result);
    } catch (error) {
      console.error("Error fetching exercise PRs list:", error);
      res.status(500).json({ message: "Failed to fetch exercise PRs list" });
    }
  });

  // Exercise PR Detail - Get detailed PR data for a single exercise
  app.get('/api/progress/exercise-pr/:exerciseId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const exerciseId = parseInt(req.params.exerciseId);

      // Get exercise info
      const [exercise] = await db
        .select()
        .from(exerciseLibrary)
        .where(eq(exerciseLibrary.id, exerciseId))
        .limit(1);

      if (!exercise) {
        return res.status(404).json({ message: "Exercise not found" });
      }

      // Get all set logs for this exercise
      const setLogs = await db
        .select({
          actualReps: workoutSetLogs.actualReps,
          actualWeight: workoutSetLogs.actualWeight,
          completedAt: workoutLogs.completedAt,
        })
        .from(workoutSetLogs)
        .innerJoin(workoutExerciseLogs, eq(workoutSetLogs.exerciseLogId, workoutExerciseLogs.id))
        .innerJoin(workoutLogs, eq(workoutExerciseLogs.workoutLogId, workoutLogs.id))
        .where(
          and(
            eq(workoutLogs.userId, userId),
            eq(workoutExerciseLogs.exerciseLibraryId, exerciseId)
          )
        )
        .orderBy(workoutLogs.completedAt);

      // Calculate overall PRs
      let maxWeight: number | null = null;
      let maxReps: number | null = null;
      let oneRepMax: number | null = null;
      let fiveRepMax: number | null = null;
      let tenRepMax: number | null = null;

      // Group by date for volume and history
      const dateData: Record<string, {
        maxWeight: number | null;
        maxReps: number | null;
        volume: number;
        oneRepMax: number | null;
        fiveRepMax: number | null;
        tenRepMax: number | null;
      }> = {};

      for (const log of setLogs) {
        const reps = log.actualReps || 0;
        const weight = log.actualWeight || 0;
        const dateKey = log.completedAt?.toISOString().split('T')[0] || '';

        if (!dateData[dateKey]) {
          dateData[dateKey] = {
            maxWeight: null,
            maxReps: null,
            volume: 0,
            oneRepMax: null,
            fiveRepMax: null,
            tenRepMax: null,
          };
        }

        const dayData = dateData[dateKey];
        const setVolume = reps * weight;
        dayData.volume += setVolume;

        // Per-day PRs
        if (weight > 0 && (dayData.maxWeight === null || weight > dayData.maxWeight)) {
          dayData.maxWeight = weight;
        }
        if (reps > 0 && (dayData.maxReps === null || reps > dayData.maxReps)) {
          dayData.maxReps = reps;
        }
        if (reps === 1 && weight > 0 && (dayData.oneRepMax === null || weight > dayData.oneRepMax)) {
          dayData.oneRepMax = weight;
        }
        if (reps === 5 && weight > 0 && (dayData.fiveRepMax === null || weight > dayData.fiveRepMax)) {
          dayData.fiveRepMax = weight;
        }
        if (reps === 10 && weight > 0 && (dayData.tenRepMax === null || weight > dayData.tenRepMax)) {
          dayData.tenRepMax = weight;
        }

        // Overall PRs
        if (weight > 0 && (maxWeight === null || weight > maxWeight)) {
          maxWeight = weight;
        }
        if (reps > 0 && (maxReps === null || reps > maxReps)) {
          maxReps = reps;
        }
        if (reps === 1 && weight > 0 && (oneRepMax === null || weight > oneRepMax)) {
          oneRepMax = weight;
        }
        if (reps === 5 && weight > 0 && (fiveRepMax === null || weight > fiveRepMax)) {
          fiveRepMax = weight;
        }
        if (reps === 10 && weight > 0 && (tenRepMax === null || weight > tenRepMax)) {
          tenRepMax = weight;
        }
      }

      // Find best session volume
      let bestVolume: number | null = null;
      for (const dateKey of Object.keys(dateData)) {
        if (bestVolume === null || dateData[dateKey].volume > bestVolume) {
          bestVolume = dateData[dateKey].volume;
        }
      }

      // Build history array
      const history = Object.entries(dateData).map(([date, data]) => ({
        date,
        maxWeight: data.maxWeight,
        maxReps: data.maxReps,
        volume: data.volume > 0 ? data.volume : null,
        oneRepMax: data.oneRepMax,
        fiveRepMax: data.fiveRepMax,
        tenRepMax: data.tenRepMax,
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      res.json({
        id: exercise.id,
        name: exercise.name,
        exerciseType: exercise.exerciseType,
        maxWeight,
        maxReps,
        volume: bestVolume,
        oneRepMax,
        fiveRepMax,
        tenRepMax,
        history,
      });
    } catch (error) {
      console.error("Error fetching exercise PR detail:", error);
      res.status(500).json({ message: "Failed to fetch exercise PR detail" });
    }
  });

  // Bodyweight Entries - Get latest entry (for pre-filling goals)
  app.get('/api/progress/bodyweight/latest', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const entries = await storage.getBodyweightEntries(userId, 1);
      if (entries.length > 0) {
        res.json({ weight: entries[0].weight, unit: "kg" });
      } else {
        res.json(null);
      }
    } catch (error) {
      console.error("Error fetching latest bodyweight:", error);
      res.status(500).json({ message: "Failed to fetch latest bodyweight" });
    }
  });

  // Bodyweight Entries
  app.get('/api/progress/bodyweight', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const entries = await storage.getBodyweightEntries(userId, limit);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching bodyweight entries:", error);
      res.status(500).json({ message: "Failed to fetch bodyweight entries" });
    }
  });

  app.post('/api/progress/bodyweight', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { weight, date, notes } = req.body;
      
      if (!weight || !date) {
        return res.status(400).json({ message: "Missing weight or date" });
      }

      const parsedWeight = parseFloat(weight);
      
      const entry = await storage.createBodyweightEntry({
        userId,
        weight: parsedWeight,
        date: new Date(date),
        notes,
      });
      
      // Sync with any active bodyweight goals
      await storage.syncBodyweightGoals(userId, parsedWeight);
      
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating bodyweight entry:", error);
      res.status(500).json({ message: "Failed to create bodyweight entry" });
    }
  });

  app.delete('/api/progress/bodyweight/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await storage.deleteBodyweightEntry(id, userId);
      // Recalculate bodyweight goals after deleting an entry (pass 0 as it recalculates from DB)
      await storage.syncBodyweightGoals(userId, 0);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting bodyweight entry:", error);
      res.status(500).json({ message: "Failed to delete bodyweight entry" });
    }
  });

  // Get single bodyweight entry by ID
  app.get('/api/progress/bodyweight/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const entry = await storage.getBodyweightEntryById(id, userId);
      if (!entry) {
        return res.status(404).json({ message: "Entry not found" });
      }
      res.json(entry);
    } catch (error) {
      console.error("Error fetching bodyweight entry:", error);
      res.status(500).json({ message: "Failed to fetch bodyweight entry" });
    }
  });

  // Update bodyweight entry
  app.patch('/api/progress/bodyweight/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const { weight, date, notes } = req.body;
      
      const updates: any = {};
      if (weight !== undefined) updates.weight = parseFloat(weight);
      if (date !== undefined) updates.date = new Date(date);
      if (notes !== undefined) updates.notes = notes;
      
      const entry = await storage.updateBodyweightEntry(id, userId, updates);
      if (!entry) {
        return res.status(404).json({ message: "Entry not found" });
      }
      
      // If weight was updated, sync with bodyweight goals
      if (weight !== undefined) {
        await storage.syncBodyweightGoals(userId, parseFloat(weight));
      }
      
      res.json(entry);
    } catch (error) {
      console.error("Error updating bodyweight entry:", error);
      res.status(500).json({ message: "Failed to update bodyweight entry" });
    }
  });

  // Body Measurements
  app.get('/api/progress/measurements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const measurements = await storage.getBodyMeasurements(userId, limit);
      res.json(measurements);
    } catch (error) {
      console.error("Error fetching measurements:", error);
      res.status(500).json({ message: "Failed to fetch measurements" });
    }
  });

  app.post('/api/progress/measurements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { date, leftSide, rightSide, notes } = req.body;
      
      if (!date) {
        return res.status(400).json({ message: "Missing date" });
      }

      // Map leftSide/rightSide objects to flat structure
      const measurement = await storage.createBodyMeasurement({
        userId,
        date: new Date(date),
        // Centerline measurements (from leftSide only, no L/R distinction)
        neck: leftSide?.neck ?? null,
        shoulders: leftSide?.shoulders ?? null,
        chest: leftSide?.chest ?? null,
        waist: leftSide?.waist ?? null,
        hips: leftSide?.hips ?? null,
        // Bilateral measurements from leftSide
        leftBicep: leftSide?.bicep ?? null,
        leftForearm: leftSide?.forearm ?? null,
        leftThigh: leftSide?.thigh ?? null,
        leftCalf: leftSide?.calf ?? null,
        // Bilateral measurements from rightSide
        rightBicep: rightSide?.bicep ?? null,
        rightForearm: rightSide?.forearm ?? null,
        rightThigh: rightSide?.thigh ?? null,
        rightCalf: rightSide?.calf ?? null,
        notes,
      });
      res.status(201).json(measurement);
    } catch (error) {
      console.error("Error creating measurement:", error);
      res.status(500).json({ message: "Failed to create measurement" });
    }
  });

  // Individual measurement type endpoints - returns array of {id, date, value} for each field
  const measurementFieldMap: Record<string, string> = {
    'neck': 'neck',
    'shoulder': 'shoulders', // frontend uses 'shoulder', database uses 'shoulders'
    'shoulders': 'shoulders',
    'chest': 'chest',
    'waist': 'waist',
    'hips': 'hips',
    'leftBicep': 'leftBicep',
    'rightBicep': 'rightBicep',
    'leftForearm': 'leftForearm',
    'rightForearm': 'rightForearm',
    'leftThigh': 'leftThigh',
    'rightThigh': 'rightThigh',
    'leftCalf': 'leftCalf',
    'rightCalf': 'rightCalf',
  };

  // Generic endpoint for specific measurement fields
  app.get('/api/progress/measurements/:field', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const field = req.params.field;
      
      // Check if it's a valid measurement field
      const dbField = measurementFieldMap[field];
      if (!dbField) {
        // If not a measurement field, check if it's an ID (number)
        const id = parseInt(field);
        if (!isNaN(id)) {
          // Handle as ID lookup
          const measurement = await storage.getBodyMeasurementById(id, userId);
          if (!measurement) {
            return res.status(404).json({ message: "Measurement not found" });
          }
          return res.json(measurement);
        }
        return res.status(400).json({ message: "Invalid measurement field" });
      }
      
      // Fetch all measurements and extract the specific field
      const measurements = await storage.getBodyMeasurements(userId);
      const fieldData = measurements
        .filter((m: any) => m[dbField] != null)
        .map((m: any) => ({
          id: m.id,
          date: m.date,
          value: m[dbField],
        }));
      
      res.json(fieldData);
    } catch (error) {
      console.error("Error fetching measurement field:", error);
      res.status(500).json({ message: "Failed to fetch measurement" });
    }
  });

  app.delete('/api/progress/measurements/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid measurement ID" });
      }
      await storage.deleteBodyMeasurement(id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting measurement:", error);
      res.status(500).json({ message: "Failed to delete measurement" });
    }
  });

  // Get measurements for a specific date
  app.get('/api/progress/measurements/by-date/:date', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const dateStr = req.params.date;
      const measurements = await storage.getBodyMeasurementsByDate(userId, new Date(dateStr));
      res.json(measurements);
    } catch (error) {
      console.error("Error fetching measurements by date:", error);
      res.status(500).json({ message: "Failed to fetch measurements" });
    }
  });

  // Update measurement
  app.patch('/api/progress/measurements/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const { date, leftSide, rightSide, notes } = req.body;
      
      const updates: any = {};
      if (date !== undefined) updates.date = new Date(date);
      if (notes !== undefined) updates.notes = notes;
      
      // Map leftSide measurements
      if (leftSide) {
        if (leftSide.neck !== undefined) updates.neck = leftSide.neck ?? null;
        if (leftSide.shoulders !== undefined) updates.shoulders = leftSide.shoulders ?? null;
        if (leftSide.chest !== undefined) updates.chest = leftSide.chest ?? null;
        if (leftSide.waist !== undefined) updates.waist = leftSide.waist ?? null;
        if (leftSide.hips !== undefined) updates.hips = leftSide.hips ?? null;
        if (leftSide.bicep !== undefined) updates.leftBicep = leftSide.bicep ?? null;
        if (leftSide.forearm !== undefined) updates.leftForearm = leftSide.forearm ?? null;
        if (leftSide.thigh !== undefined) updates.leftThigh = leftSide.thigh ?? null;
        if (leftSide.calf !== undefined) updates.leftCalf = leftSide.calf ?? null;
      }
      
      // Map rightSide measurements
      if (rightSide) {
        if (rightSide.bicep !== undefined) updates.rightBicep = rightSide.bicep ?? null;
        if (rightSide.forearm !== undefined) updates.rightForearm = rightSide.forearm ?? null;
        if (rightSide.thigh !== undefined) updates.rightThigh = rightSide.thigh ?? null;
        if (rightSide.calf !== undefined) updates.rightCalf = rightSide.calf ?? null;
      }
      
      const measurement = await storage.updateBodyMeasurement(id, userId, updates);
      if (!measurement) {
        return res.status(404).json({ message: "Measurement not found" });
      }
      res.json(measurement);
    } catch (error) {
      console.error("Error updating measurement:", error);
      res.status(500).json({ message: "Failed to update measurement" });
    }
  });

  // Get body fat entry by date
  app.get('/api/progress/body-fat/by-date/:date', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const dateStr = req.params.date;
      const entry = await storage.getBodyFatByDate(userId, new Date(dateStr));
      res.json(entry);
    } catch (error) {
      console.error("Error fetching body fat by date:", error);
      res.status(500).json({ message: "Failed to fetch body fat" });
    }
  });

  // Get lean body mass by date
  app.get('/api/progress/lean-body-mass/by-date/:date', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const dateStr = req.params.date;
      const entry = await storage.getLeanBodyMassByDate(userId, new Date(dateStr));
      res.json(entry);
    } catch (error) {
      console.error("Error fetching lean body mass by date:", error);
      res.status(500).json({ message: "Failed to fetch lean body mass" });
    }
  });

  // Progress Pictures - returns grouped by photoSetId
  app.get('/api/progress/pictures', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const pictures = await storage.getProgressPictures(userId, limit);
      
      // Group pictures by photoSetId
      const groupedMap = new Map<string, {
        photoSetId: string;
        date: string;
        photos: { id: number; category: string; imageUrl: string }[];
      }>();
      
      for (const pic of pictures) {
        const setId = pic.photoSetId || `legacy-${pic.id}`;
        if (!groupedMap.has(setId)) {
          groupedMap.set(setId, {
            photoSetId: setId,
            date: pic.date instanceof Date ? pic.date.toISOString() : String(pic.date),
            photos: [],
          });
        }
        groupedMap.get(setId)!.photos.push({
          id: pic.id,
          category: pic.category || 'front',
          imageUrl: pic.imageUrl,
        });
      }
      
      const grouped = Array.from(groupedMap.values());
      res.json(grouped);
    } catch (error) {
      console.error("Error fetching progress pictures:", error);
      res.status(500).json({ message: "Failed to fetch progress pictures" });
    }
  });

  app.post('/api/progress/pictures', isAuthenticated, uploadImage.single('image'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { date, category, notes, photoSetId, imageUrl: base64Image } = req.body;
      
      let imageUrl: string;
      
      // Support both file upload and base64 image data
      if (req.file) {
        imageUrl = `/uploads/images/${req.file.filename}`;
      } else if (base64Image && base64Image.startsWith('data:image')) {
        // Store base64 image directly for now (in production, you'd save to file)
        imageUrl = base64Image;
      } else {
        return res.status(400).json({ message: "Missing image" });
      }
      
      if (!date) {
        return res.status(400).json({ message: "Missing date" });
      }

      const picture = await storage.createProgressPicture({
        userId,
        date: new Date(date),
        photoSetId: photoSetId || `set-${Date.now()}`,
        imageUrl,
        category: category || 'front',
        notes,
      });
      res.status(201).json(picture);
    } catch (error) {
      console.error("Error creating progress picture:", error);
      res.status(500).json({ message: "Failed to create progress picture" });
    }
  });

  app.delete('/api/progress/pictures/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await storage.deleteProgressPicture(id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting progress picture:", error);
      res.status(500).json({ message: "Failed to delete progress picture" });
    }
  });

  // Sleep Entries
  app.get('/api/progress/sleep', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const entries = await storage.getSleepEntries(userId, limit);
      // Transform to include hours for frontend compatibility
      const transformedEntries = entries.map(entry => ({
        ...entry,
        hours: entry.durationMinutes ? entry.durationMinutes / 60 : 0
      }));
      res.json(transformedEntries);
    } catch (error) {
      console.error("Error fetching sleep entries:", error);
      res.status(500).json({ message: "Failed to fetch sleep entries" });
    }
  });

  app.post('/api/progress/sleep', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { date, durationMinutes, quality, bedTime, wakeTime, notes, deepSleepMinutes, lightSleepMinutes, remSleepMinutes, awakeMinutes, sleepScore } = req.body;
      
      if (!date || durationMinutes === undefined) {
        return res.status(400).json({ message: "Missing date or durationMinutes" });
      }

      const entry = await storage.createSleepEntry({
        userId,
        date: new Date(date),
        durationMinutes: parseInt(durationMinutes),
        quality: quality ? parseInt(quality) : null,
        bedTime,
        wakeTime,
        notes,
        deepSleepMinutes: deepSleepMinutes ? parseInt(deepSleepMinutes) : null,
        lightSleepMinutes: lightSleepMinutes ? parseInt(lightSleepMinutes) : null,
        remSleepMinutes: remSleepMinutes ? parseInt(remSleepMinutes) : null,
        awakeMinutes: awakeMinutes ? parseInt(awakeMinutes) : null,
        sleepScore: sleepScore ? parseInt(sleepScore) : null,
      });
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating sleep entry:", error);
      res.status(500).json({ message: "Failed to create sleep entry" });
    }
  });

  app.delete('/api/progress/sleep/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await storage.deleteSleepEntry(id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting sleep entry:", error);
      res.status(500).json({ message: "Failed to delete sleep entry" });
    }
  });

  // Step Entries
  app.get('/api/progress/steps', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const entries = await storage.getStepEntries(userId, limit);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching step entries:", error);
      res.status(500).json({ message: "Failed to fetch step entries" });
    }
  });

  app.post('/api/progress/steps', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { date, steps, distance, activeMinutes, notes } = req.body;
      
      if (!date || steps === undefined) {
        return res.status(400).json({ message: "Missing date or steps" });
      }

      const entry = await storage.createStepEntry({
        userId,
        date: new Date(date),
        steps: parseInt(steps),
        distance: distance ? parseFloat(distance) : null,
        activeMinutes: activeMinutes ? parseInt(activeMinutes) : null,
        notes,
      });

      // Auto-complete "Hit Your Step Count" habit if the target is met for today
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const entryDateStr = new Date(date).toISOString().split('T')[0];
        if (entryDateStr === todayStr) {
          const userHabits = await storage.getHabits(userId);
          // Find all active step habits (templateId=2) that have a stepTarget configured
          const stepHabits = userHabits.filter(h => h.templateId === 2 && h.settings && (h.settings as any).stepTarget);
          for (const stepHabit of stepHabits) {
            const stepTarget = (stepHabit.settings as any).stepTarget as number;
            const stepsLogged = typeof steps === 'number' ? steps : parseInt(steps);
            console.log(`[Steps] Habit ${stepHabit.id}: target=${stepTarget} logged=${stepsLogged}`);
            if (stepsLogged >= stepTarget) {
              const completions = await storage.getHabitCompletions(stepHabit.id);
              const alreadyCompleted = completions.some(c => {
                return new Date(c.completedDate).toISOString().split('T')[0] === todayStr;
              });
              if (!alreadyCompleted) {
                await storage.completeHabit(stepHabit.id, userId);
                console.log(`[Steps] Auto-completed habit ${stepHabit.id} for user ${userId} (${stepsLogged}/${stepTarget} steps)`);
              }
            }
          }
        }
      } catch (habitError) {
        console.error("Error auto-completing step habit:", habitError);
      }

      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating step entry:", error);
      res.status(500).json({ message: "Failed to create step entry" });
    }
  });

  app.patch('/api/progress/steps/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const { steps, distance, activeMinutes, notes } = req.body;

      const updateData: any = {};
      if (steps !== undefined) updateData.steps = parseInt(steps);
      if (distance !== undefined) updateData.distance = distance ? parseFloat(distance) : null;
      if (activeMinutes !== undefined) updateData.activeMinutes = activeMinutes ? parseInt(activeMinutes) : null;
      if (notes !== undefined) updateData.notes = notes;

      const updated = await storage.updateStepEntry(id, userId, updateData);
      if (!updated) return res.status(404).json({ message: "Entry not found" });

      // Auto-complete step habit if the updated steps meet the target for today
      if (steps !== undefined) {
        try {
          const todayStr = new Date().toISOString().split('T')[0];
          const entryDateStr = new Date(updated.date).toISOString().split('T')[0];
          if (entryDateStr === todayStr) {
            const userHabits = await storage.getHabits(userId);
            const stepHabits = userHabits.filter(h => h.templateId === 2 && h.settings && (h.settings as any).stepTarget);
            for (const stepHabit of stepHabits) {
              const stepTarget = (stepHabit.settings as any).stepTarget as number;
              const stepsLogged = typeof steps === 'number' ? steps : parseInt(steps);
              console.log(`[Steps PATCH] Habit ${stepHabit.id}: target=${stepTarget} logged=${stepsLogged}`);
              if (stepsLogged >= stepTarget) {
                const completions = await storage.getHabitCompletions(stepHabit.id);
                const alreadyCompleted = completions.some(c => {
                  return new Date(c.completedDate).toISOString().split('T')[0] === todayStr;
                });
                if (!alreadyCompleted) {
                  await storage.completeHabit(stepHabit.id, userId);
                  console.log(`[Steps PATCH] Auto-completed habit ${stepHabit.id} for user ${userId} (${stepsLogged}/${stepTarget} steps)`);
                }
              }
            }
          }
        } catch (habitError) {
          console.error("Error auto-completing step habit on PATCH:", habitError);
        }
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating step entry:", error);
      res.status(500).json({ message: "Failed to update step entry" });
    }
  });

  app.delete('/api/progress/steps/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await storage.deleteStepEntry(id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting step entry:", error);
      res.status(500).json({ message: "Failed to delete step entry" });
    }
  });

  // Stress/Burnout Entries
  app.get('/api/progress/stress', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const entries = await storage.getStressEntries(userId, limit);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching stress entries:", error);
      res.status(500).json({ message: "Failed to fetch stress entries" });
    }
  });

  app.post('/api/progress/stress', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { date, stressScore, mood, energyLevel, recoveryScore, notes } = req.body;
      
      if (!date || stressScore === undefined) {
        return res.status(400).json({ message: "Missing date or stressScore" });
      }

      const entry = await storage.createStressEntry({
        userId,
        date: new Date(date),
        stressScore: parseInt(stressScore),
        mood,
        energyLevel: energyLevel ? parseInt(energyLevel) : null,
        recoveryScore: recoveryScore ? parseInt(recoveryScore) : null,
        notes,
      });
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating stress entry:", error);
      res.status(500).json({ message: "Failed to create stress entry" });
    }
  });

  app.delete('/api/progress/stress/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await storage.deleteStressEntry(id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting stress entry:", error);
      res.status(500).json({ message: "Failed to delete stress entry" });
    }
  });

  // ============================================
  // PROGRESS TRACKING - Body Fat
  // ============================================

  app.get('/api/progress/body-fat', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const entries = await storage.getBodyFatEntries(userId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching body fat entries:", error);
      res.status(500).json({ message: "Failed to fetch body fat entries" });
    }
  });

  app.post('/api/progress/body-fat', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { date, percentage, notes } = req.body;
      
      if (!date || percentage === undefined) {
        return res.status(400).json({ message: "Missing date or percentage" });
      }

      const entry = await storage.createBodyFatEntry({
        userId,
        date: new Date(date),
        percentage: parseFloat(percentage),
        notes,
      });
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating body fat entry:", error);
      res.status(500).json({ message: "Failed to create body fat entry" });
    }
  });

  // Get single body fat entry by ID
  app.get('/api/progress/body-fat/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const entry = await storage.getBodyFatEntryById(id, userId);
      if (!entry) {
        return res.status(404).json({ message: "Entry not found" });
      }
      res.json(entry);
    } catch (error) {
      console.error("Error fetching body fat entry:", error);
      res.status(500).json({ message: "Failed to fetch body fat entry" });
    }
  });

  app.delete('/api/progress/body-fat/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await storage.deleteBodyFatEntry(id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting body fat entry:", error);
      res.status(500).json({ message: "Failed to delete body fat entry" });
    }
  });

  // Update body fat entry
  app.patch('/api/progress/body-fat/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const { percentage, date, notes } = req.body;
      
      const updates: any = {};
      if (percentage !== undefined) updates.percentage = parseFloat(percentage);
      if (date !== undefined) updates.date = new Date(date);
      if (notes !== undefined) updates.notes = notes;
      
      const entry = await storage.updateBodyFatEntry(id, userId, updates);
      if (!entry) {
        return res.status(404).json({ message: "Entry not found" });
      }
      res.json(entry);
    } catch (error) {
      console.error("Error updating body fat entry:", error);
      res.status(500).json({ message: "Failed to update body fat entry" });
    }
  });

  // ============================================
  // PROGRESS TRACKING - Resting Heart Rate
  // ============================================

  app.get('/api/progress/resting-hr', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const entries = await storage.getRestingHREntries(userId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching resting HR entries:", error);
      res.status(500).json({ message: "Failed to fetch resting HR entries" });
    }
  });

  app.post('/api/progress/resting-hr', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { date, bpm, notes } = req.body;
      
      if (!date || bpm === undefined) {
        return res.status(400).json({ message: "Missing date or bpm" });
      }

      const entry = await storage.createRestingHREntry({
        userId,
        date: new Date(date),
        bpm: parseInt(bpm),
        notes,
      });
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating resting HR entry:", error);
      res.status(500).json({ message: "Failed to create resting HR entry" });
    }
  });

  app.delete('/api/progress/resting-hr/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await storage.deleteRestingHREntry(id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting resting HR entry:", error);
      res.status(500).json({ message: "Failed to delete resting HR entry" });
    }
  });

  // ============================================
  // PROGRESS TRACKING - Blood Pressure
  // ============================================

  app.get('/api/progress/blood-pressure', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const entries = await storage.getBloodPressureEntries(userId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching blood pressure entries:", error);
      res.status(500).json({ message: "Failed to fetch blood pressure entries" });
    }
  });

  app.post('/api/progress/blood-pressure', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { date, systolic, diastolic, notes } = req.body;
      
      if (!date || systolic === undefined || diastolic === undefined) {
        return res.status(400).json({ message: "Missing date, systolic, or diastolic" });
      }

      const entry = await storage.createBloodPressureEntry({
        userId,
        date: new Date(date),
        systolic: parseInt(systolic),
        diastolic: parseInt(diastolic),
        notes,
      });
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating blood pressure entry:", error);
      res.status(500).json({ message: "Failed to create blood pressure entry" });
    }
  });

  app.delete('/api/progress/blood-pressure/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await storage.deleteBloodPressureEntry(id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting blood pressure entry:", error);
      res.status(500).json({ message: "Failed to delete blood pressure entry" });
    }
  });

  // ============================================
  // PROGRESS TRACKING - Lean Body Mass
  // ============================================

  app.get('/api/progress/lean-body-mass', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const entries = await storage.getLeanBodyMassEntries(userId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching lean body mass entries:", error);
      res.status(500).json({ message: "Failed to fetch lean body mass entries" });
    }
  });

  app.post('/api/progress/lean-body-mass', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { date, mass, notes } = req.body;
      
      if (!date || mass === undefined) {
        return res.status(400).json({ message: "Missing date or mass" });
      }

      const entry = await storage.createLeanBodyMassEntry({
        userId,
        date: new Date(date),
        mass: parseFloat(mass),
        notes,
      });
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating lean body mass entry:", error);
      res.status(500).json({ message: "Failed to create lean body mass entry" });
    }
  });

  app.delete('/api/progress/lean-body-mass/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await storage.deleteLeanBodyMassEntry(id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting lean body mass entry:", error);
      res.status(500).json({ message: "Failed to delete lean body mass entry" });
    }
  });

  // Update lean body mass entry
  app.patch('/api/progress/lean-body-mass/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const { mass, date, notes } = req.body;
      
      const updates: any = {};
      if (mass !== undefined) updates.mass = parseFloat(mass);
      if (date !== undefined) updates.date = new Date(date);
      if (notes !== undefined) updates.notes = notes;
      
      const entry = await storage.updateLeanBodyMassEntry(id, userId, updates);
      if (!entry) {
        return res.status(404).json({ message: "Entry not found" });
      }
      res.json(entry);
    } catch (error) {
      console.error("Error updating lean body mass entry:", error);
      res.status(500).json({ message: "Failed to update lean body mass entry" });
    }
  });

  // ============================================
  // PROGRESS TRACKING - Caloric Intake (synced with nutrition food logs)
  // ============================================

  app.get('/api/progress/caloric-intake', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const days = parseInt(req.query.days as string) || 90;
      
      // Get nutrition history which aggregates food logs by date
      const nutritionHistory = await storage.getNutritionHistory(userId, days);
      const goal = await storage.getNutritionGoal(userId);
      
      // Transform to match expected format for progress metrics
      const entries = nutritionHistory.map((day: any, index: number) => ({
        id: index + 1,
        date: day.date,
        calories: day.calories || 0,
        protein: day.protein || 0,
        carbs: day.carbs || 0,
        fat: day.fat || 0,
        goal: goal?.calorieTarget || 2000,
        proteinGoal: goal?.proteinTarget || 150,
        carbsGoal: goal?.carbsTarget || 200,
        fatGoal: goal?.fatTarget || 65,
      }));
      
      res.json(entries);
    } catch (error) {
      console.error("Error fetching caloric intake entries:", error);
      res.status(500).json({ message: "Failed to fetch caloric intake entries" });
    }
  });

  // Keep POST for backwards compatibility but redirect to nutrition food logging
  app.post('/api/progress/caloric-intake', isAuthenticated, async (req: any, res) => {
    res.status(400).json({ 
      message: "Please use the Nutrition section to log food. Caloric intake is now synced with your food logs." 
    });
  });

  // Keep DELETE for backwards compatibility
  app.delete('/api/progress/caloric-intake/:id', isAuthenticated, async (req: any, res) => {
    res.status(400).json({ 
      message: "Please use the Nutrition section to manage food logs. Caloric intake is now synced with your food logs." 
    });
  });

  // ============================================
  // PROGRESS TRACKING - Caloric Burn
  // ============================================

  app.get('/api/progress/caloric-burn', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const entries = await storage.getCaloricBurnEntries(userId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching caloric burn entries:", error);
      res.status(500).json({ message: "Failed to fetch caloric burn entries" });
    }
  });

  app.post('/api/progress/caloric-burn', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { date, calories, notes } = req.body;
      
      if (!date || calories === undefined) {
        return res.status(400).json({ message: "Missing date or calories" });
      }

      const entry = await storage.createCaloricBurnEntry({
        userId,
        date: new Date(date),
        calories: parseInt(calories),
        notes,
      });
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating caloric burn entry:", error);
      res.status(500).json({ message: "Failed to create caloric burn entry" });
    }
  });

  app.delete('/api/progress/caloric-burn/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await storage.deleteCaloricBurnEntry(id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting caloric burn entry:", error);
      res.status(500).json({ message: "Failed to delete caloric burn entry" });
    }
  });

  // Exercise Minutes
  app.get('/api/progress/exercise-minutes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const entries = await storage.getExerciseMinutesEntries(userId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching exercise minutes entries:", error);
      res.status(500).json({ message: "Failed to fetch exercise minutes entries" });
    }
  });

  app.post('/api/progress/exercise-minutes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { date, minutes, notes } = req.body;
      
      if (!date || minutes === undefined) {
        return res.status(400).json({ message: "Missing date or minutes" });
      }

      const entry = await storage.createExerciseMinutesEntry({
        userId,
        date: new Date(date),
        minutes: parseInt(minutes),
        notes,
      });
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating exercise minutes entry:", error);
      res.status(500).json({ message: "Failed to create exercise minutes entry" });
    }
  });

  app.delete('/api/progress/exercise-minutes/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await storage.deleteExerciseMinutesEntry(id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting exercise minutes entry:", error);
      res.status(500).json({ message: "Failed to delete exercise minutes entry" });
    }
  });

  // ============================================
  // BREATH WORK - Techniques
  // ============================================

  app.get('/api/breathwork/techniques', isAuthenticated, async (req: any, res) => {
    try {
      const techniques = await storage.getBreathTechniques();
      res.json(techniques);
    } catch (error) {
      console.error("Error fetching breath techniques:", error);
      res.status(500).json({ message: "Failed to fetch breath techniques" });
    }
  });

  app.get('/api/breathwork/techniques/by-id/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const technique = await storage.getBreathTechniqueById(id);
      if (!technique) {
        return res.status(404).json({ message: "Technique not found" });
      }
      res.json(technique);
    } catch (error) {
      console.error("Error fetching breath technique by id:", error);
      res.status(500).json({ message: "Failed to fetch breath technique" });
    }
  });

  app.get('/api/breathwork/techniques/:slug', isAuthenticated, async (req: any, res) => {
    try {
      const technique = await storage.getBreathTechniqueBySlug(req.params.slug);
      if (!technique) {
        return res.status(404).json({ message: "Technique not found" });
      }
      res.json(technique);
    } catch (error) {
      console.error("Error fetching breath technique:", error);
      res.status(500).json({ message: "Failed to fetch breath technique" });
    }
  });

  // Admin CRUD for breath techniques
  app.post('/api/admin/breathwork/techniques', isAuthenticated, async (req: any, res) => {
    try {
      const technique = await storage.createBreathTechnique(req.body);
      res.status(201).json(technique);
    } catch (error) {
      console.error("Error creating breath technique:", error);
      res.status(500).json({ message: "Failed to create breath technique" });
    }
  });

  app.patch('/api/admin/breathwork/techniques/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const technique = await storage.updateBreathTechnique(id, req.body);
      res.json(technique);
    } catch (error) {
      console.error("Error updating breath technique:", error);
      res.status(500).json({ message: "Failed to update breath technique" });
    }
  });

  app.delete('/api/admin/breathwork/techniques/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBreathTechnique(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting breath technique:", error);
      res.status(500).json({ message: "Failed to delete breath technique" });
    }
  });

  // ============================================
  // BREATH WORK - Sessions
  // ============================================

  app.get('/api/breathwork/sessions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const sessions = await storage.getBreathWorkSessionLogs(userId, limit);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching breath work sessions:", error);
      res.status(500).json({ message: "Failed to fetch breath work sessions" });
    }
  });

  app.post('/api/breathwork/sessions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { techniqueId, routineId, durationSeconds, roundsCompleted, notes, mood } = req.body;
      
      if (!durationSeconds || !roundsCompleted) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const session = await storage.createBreathWorkSessionLog({
        userId,
        techniqueId: techniqueId || null,
        routineId: routineId || null,
        durationSeconds,
        roundsCompleted,
        completedAt: new Date(),
        notes,
        mood,
      });
      
      // Update user streak after breathwork session (non-blocking)
      storage.updateUserStreak(userId).catch(err => {
        console.error(`[STREAK] Background update failed, will recalculate on next fetch:`, err?.message);
      });
      
      // Check and award eligible badges after breathwork session
      try {
        const newBadges = await storage.checkUserBadgeEligibility(userId);
        if (newBadges.length > 0) {
          console.log(`[BADGE AWARDED] User ${userId} earned ${newBadges.length} badge(s): ${newBadges.map(b => b.name).join(', ')}`);
        }
      } catch (badgeError: any) {
        console.error(`[BADGE CHECK ERROR] Failed to check/award badges:`, badgeError?.message);
      }
      
      res.status(201).json(session);
    } catch (error) {
      console.error("Error creating breath work session:", error);
      res.status(500).json({ message: "Failed to create breath work session" });
    }
  });

  app.get('/api/breathwork/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getBreathWorkStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching breath work stats:", error);
      res.status(500).json({ message: "Failed to fetch breath work stats" });
    }
  });

  // ============================================
  // BREATH WORK - Custom Routines
  // ============================================

  app.get('/api/breathwork/routines', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const routines = await storage.getCustomBreathRoutines(userId);
      
      // Fetch phases for each routine
      const routinesWithPhases = await Promise.all(routines.map(async (routine) => {
        const phases = await storage.getBreathRoutinePhases(routine.id);
        return { ...routine, phases };
      }));
      
      res.json(routinesWithPhases);
    } catch (error) {
      console.error("Error fetching custom breath routines:", error);
      res.status(500).json({ message: "Failed to fetch custom breath routines" });
    }
  });

  app.get('/api/breathwork/routines/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const routine = await storage.getCustomBreathRoutineById(id);
      if (!routine) {
        return res.status(404).json({ message: "Routine not found" });
      }
      const phases = await storage.getBreathRoutinePhases(id);
      res.json({ ...routine, phases });
    } catch (error) {
      console.error("Error fetching custom breath routine:", error);
      res.status(500).json({ message: "Failed to fetch custom breath routine" });
    }
  });

  app.post('/api/breathwork/routines', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, description, totalDurationMinutes, phases } = req.body;
      
      if (!name || !totalDurationMinutes || !phases || phases.length === 0) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const routine = await storage.createCustomBreathRoutine({
        userId,
        name,
        description,
        totalDurationMinutes,
        isPublic: false,
      });

      // Create phases
      for (let i = 0; i < phases.length; i++) {
        const phase = phases[i];
        await storage.createBreathRoutinePhase({
          routineId: routine.id,
          phaseName: phase.phaseName,
          inhaleSeconds: phase.inhaleSeconds,
          holdAfterInhaleSeconds: phase.holdAfterInhaleSeconds || 0,
          exhaleSeconds: phase.exhaleSeconds,
          holdAfterExhaleSeconds: phase.holdAfterExhaleSeconds || 0,
          rounds: phase.rounds,
          restBetweenRoundsSeconds: phase.restBetweenRoundsSeconds || 0,
          position: i,
        });
      }

      const createdPhases = await storage.getBreathRoutinePhases(routine.id);
      res.status(201).json({ ...routine, phases: createdPhases });
    } catch (error) {
      console.error("Error creating custom breath routine:", error);
      res.status(500).json({ message: "Failed to create custom breath routine" });
    }
  });

  app.patch('/api/breathwork/routines/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, description, totalDurationMinutes, phases } = req.body;
      
      const routine = await storage.updateCustomBreathRoutine(id, {
        name,
        description,
        totalDurationMinutes,
      });

      // If phases are provided, replace all phases
      if (phases && phases.length > 0) {
        await storage.deleteBreathRoutinePhasesByRoutineId(id);
        for (let i = 0; i < phases.length; i++) {
          const phase = phases[i];
          await storage.createBreathRoutinePhase({
            routineId: id,
            phaseName: phase.phaseName,
            inhaleSeconds: phase.inhaleSeconds,
            holdAfterInhaleSeconds: phase.holdAfterInhaleSeconds || 0,
            exhaleSeconds: phase.exhaleSeconds,
            holdAfterExhaleSeconds: phase.holdAfterExhaleSeconds || 0,
            rounds: phase.rounds,
            restBetweenRoundsSeconds: phase.restBetweenRoundsSeconds || 0,
            position: i,
          });
        }
      }

      const updatedPhases = await storage.getBreathRoutinePhases(id);
      res.json({ ...routine, phases: updatedPhases });
    } catch (error) {
      console.error("Error updating custom breath routine:", error);
      res.status(500).json({ message: "Failed to update custom breath routine" });
    }
  });

  app.delete('/api/breathwork/routines/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCustomBreathRoutine(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting custom breath routine:", error);
      res.status(500).json({ message: "Failed to delete custom breath routine" });
    }
  });

  // ============================================
  // BREATH WORK - Favourites
  // ============================================

  app.get('/api/breathwork/favourites', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const favourites = await storage.getBreathFavouritesWithTechniques(userId);
      res.json(favourites);
    } catch (error) {
      console.error("Error fetching breath favourites:", error);
      res.status(500).json({ message: "Failed to fetch breath favourites" });
    }
  });

  app.get('/api/breathwork/favourites/:techniqueId/check', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const techniqueId = parseInt(req.params.techniqueId);
      const isFavourite = await storage.isBreathTechniqueFavourite(userId, techniqueId);
      res.json({ isFavourite });
    } catch (error) {
      console.error("Error checking breath favourite:", error);
      res.status(500).json({ message: "Failed to check breath favourite" });
    }
  });

  app.post('/api/breathwork/favourites', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { techniqueId } = req.body;
      
      if (!techniqueId) {
        return res.status(400).json({ message: "Missing techniqueId" });
      }

      // Check if already favourite
      const existing = await storage.isBreathTechniqueFavourite(userId, techniqueId);
      if (existing) {
        return res.status(400).json({ message: "Already in favourites" });
      }

      const favourite = await storage.addBreathFavourite({ userId, techniqueId });
      res.status(201).json(favourite);
    } catch (error) {
      console.error("Error adding breath favourite:", error);
      res.status(500).json({ message: "Failed to add breath favourite" });
    }
  });

  app.delete('/api/breathwork/favourites/:techniqueId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const techniqueId = parseInt(req.params.techniqueId);
      await storage.removeBreathFavourite(userId, techniqueId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing breath favourite:", error);
      res.status(500).json({ message: "Failed to remove breath favourite" });
    }
  });

  // ============================================
  // MEDITATION SESSIONS
  // ============================================

  app.post('/api/meditation/sessions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validated = insertMeditationSessionLogSchema.pick({
        meditationTitle: true,
        category: true,
        durationSeconds: true,
      }).parse(req.body);

      const session = await storage.createMeditationSession({
        userId,
        ...validated,
      });

      storage.updateUserStreak(userId).catch(err => {
        console.error(`[STREAK] Background update failed:`, err?.message);
      });

      res.status(201).json(session);
    } catch (error) {
      console.error("Error creating meditation session:", error);
      res.status(500).json({ message: "Failed to create meditation session" });
    }
  });

  app.get('/api/meditation/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getMeditationStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching meditation stats:", error);
      res.status(500).json({ message: "Failed to fetch meditation stats" });
    }
  });

  app.get('/api/meditation/sessions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const sessions = await storage.getMeditationSessions(userId, limit);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching meditation sessions:", error);
      res.status(500).json({ message: "Failed to fetch meditation sessions" });
    }
  });

  // ============================================
  // GRATITUDE JOURNAL
  // ============================================

  app.post('/api/gratitude/entries', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validated = insertGratitudeEntrySchema.pick({
        content: true,
        prompt: true,
      }).parse(req.body);

      if (!validated.content.trim()) {
        return res.status(400).json({ message: "Content is required" });
      }

      const entry = await storage.createGratitudeEntry({
        userId,
        content: validated.content.trim(),
        prompt: validated.prompt || null,
      });

      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating gratitude entry:", error);
      res.status(500).json({ message: "Failed to create gratitude entry" });
    }
  });

  app.get('/api/gratitude/entries', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const date = req.query.date as string | undefined;
      const entries = await storage.getGratitudeEntries(userId, date);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching gratitude entries:", error);
      res.status(500).json({ message: "Failed to fetch gratitude entries" });
    }
  });

  app.get('/api/gratitude/dates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const dates = await storage.getGratitudeEntryDates(userId);
      res.json(dates);
    } catch (error) {
      console.error("Error fetching gratitude dates:", error);
      res.status(500).json({ message: "Failed to fetch gratitude dates" });
    }
  });

  // ============================================
  // BREATH WORK - Seed Techniques
  // ============================================

  app.post('/api/breathwork/seed', isAuthenticated, async (req: any, res) => {
    try {
      const existingTechniques = await storage.getBreathTechniques();
      if (existingTechniques.length > 0) {
        return res.json({ message: "Techniques already seeded", count: existingTechniques.length });
      }

      const techniques = [
        {
          name: "Box Breathing",
          slug: "box-breathing",
          description: "A powerful stress-relief technique used by Navy SEALs. Equal parts inhale, hold, exhale, and hold create a 'box' pattern that calms the nervous system.",
          category: "relaxation",
          difficulty: "beginner",
          inhaleSeconds: 4,
          holdAfterInhaleSeconds: 4,
          exhaleSeconds: 4,
          holdAfterExhaleSeconds: 4,
          defaultRounds: 4,
          defaultDurationMinutes: 5,
          benefits: ["Reduces stress and anxiety", "Improves focus and concentration", "Lowers blood pressure", "Promotes mental clarity"],
          instructions: ["Find a comfortable seated position", "Breathe in through your nose for 4 seconds", "Hold your breath for 4 seconds", "Exhale slowly for 4 seconds", "Hold empty for 4 seconds", "Repeat the cycle"],
        },
        {
          name: "4-7-8 Breathing",
          slug: "4-7-8-breathing",
          description: "Dr. Andrew Weil's relaxing breath technique, excellent for falling asleep quickly and reducing anxiety.",
          category: "relaxation",
          difficulty: "beginner",
          inhaleSeconds: 4,
          holdAfterInhaleSeconds: 7,
          exhaleSeconds: 8,
          holdAfterExhaleSeconds: 0,
          defaultRounds: 4,
          defaultDurationMinutes: 5,
          benefits: ["Promotes deep relaxation", "Helps with falling asleep", "Reduces anxiety", "Manages cravings"],
          instructions: ["Place tongue behind upper front teeth", "Exhale completely through mouth", "Inhale quietly through nose for 4 seconds", "Hold breath for 7 seconds", "Exhale completely through mouth for 8 seconds"],
        },
        {
          name: "Wim Hof Method",
          slug: "wim-hof",
          description: "An intense breathing technique developed by 'The Iceman'. Increases oxygen levels and energy while building mental resilience.",
          category: "energy",
          difficulty: "advanced",
          inhaleSeconds: 2,
          holdAfterInhaleSeconds: 0,
          exhaleSeconds: 2,
          holdAfterExhaleSeconds: 0,
          defaultRounds: 30,
          defaultDurationMinutes: 10,
          benefits: ["Boosts immune system", "Increases energy", "Reduces inflammation", "Builds mental resilience"],
          instructions: ["Take 30-40 deep breaths", "On the last exhale, hold as long as comfortable", "Take a recovery breath and hold for 15 seconds", "Repeat the cycle 3-4 times"],
        },
        {
          name: "Physiological Sigh",
          slug: "physiological-sigh",
          description: "The fastest way to calm down in real-time. A double inhale followed by a long exhale activates the parasympathetic system.",
          category: "relaxation",
          difficulty: "beginner",
          inhaleSeconds: 2,
          holdAfterInhaleSeconds: 1,
          exhaleSeconds: 6,
          holdAfterExhaleSeconds: 0,
          defaultRounds: 3,
          defaultDurationMinutes: 2,
          benefits: ["Instant stress relief", "Calms nervous system", "Improves emotional regulation", "Enhances focus"],
          instructions: ["Take a deep breath in through nose", "Add a second shorter inhale on top", "Exhale slowly through mouth", "Repeat as needed"],
        },
        {
          name: "Energizing Breath",
          slug: "energizing-breath",
          description: "Also known as Bellows Breath or Bhastrika. A powerful technique to increase alertness and energy levels quickly.",
          category: "energy",
          difficulty: "intermediate",
          inhaleSeconds: 1,
          holdAfterInhaleSeconds: 0,
          exhaleSeconds: 1,
          holdAfterExhaleSeconds: 0,
          defaultRounds: 20,
          defaultDurationMinutes: 3,
          benefits: ["Increases energy", "Improves alertness", "Warms the body", "Clears mental fog"],
          instructions: ["Sit with spine straight", "Breathe rapidly through nose", "Keep inhale and exhale equal", "Pump your belly with each breath"],
        },
        {
          name: "Coherent Breathing",
          slug: "coherent-breathing",
          description: "Breathing at 5 breaths per minute creates heart rate variability coherence, optimizing cardiovascular and nervous system function.",
          category: "recovery",
          difficulty: "beginner",
          inhaleSeconds: 6,
          holdAfterInhaleSeconds: 0,
          exhaleSeconds: 6,
          holdAfterExhaleSeconds: 0,
          defaultRounds: 5,
          defaultDurationMinutes: 10,
          benefits: ["Improves HRV", "Balances nervous system", "Reduces blood pressure", "Enhances emotional stability"],
          instructions: ["Breathe in slowly for 6 seconds", "Breathe out slowly for 6 seconds", "Maintain smooth, continuous flow", "Keep breathing relaxed and natural"],
        },
        {
          name: "Alternate Nostril",
          slug: "alternate-nostril",
          description: "An ancient yogic technique (Nadi Shodhana) that balances the left and right hemispheres of the brain.",
          category: "focus",
          difficulty: "beginner",
          inhaleSeconds: 4,
          holdAfterInhaleSeconds: 0,
          exhaleSeconds: 4,
          holdAfterExhaleSeconds: 0,
          defaultRounds: 10,
          defaultDurationMinutes: 5,
          benefits: ["Balances brain hemispheres", "Reduces anxiety", "Improves focus", "Calms the mind"],
          instructions: ["Close right nostril with thumb", "Inhale through left nostril", "Close left nostril with ring finger", "Exhale through right nostril", "Inhale through right", "Switch and exhale through left"],
        },
        {
          name: "Deep Belly Breathing",
          slug: "deep-belly-breathing",
          description: "Diaphragmatic breathing engages the full lung capacity and activates the parasympathetic nervous system for deep relaxation.",
          category: "relaxation",
          difficulty: "beginner",
          inhaleSeconds: 5,
          holdAfterInhaleSeconds: 0,
          exhaleSeconds: 5,
          holdAfterExhaleSeconds: 0,
          defaultRounds: 6,
          defaultDurationMinutes: 5,
          benefits: ["Activates relaxation response", "Improves digestion", "Reduces cortisol", "Lowers heart rate"],
          instructions: ["Place one hand on chest, one on belly", "Breathe in through nose, expanding belly", "Keep chest relatively still", "Exhale slowly, contracting belly"],
        },
        {
          name: "Power Breathing",
          slug: "power-breathing",
          description: "A pre-workout or pre-performance breathing technique to maximize oxygen intake and prime the body for action.",
          category: "performance",
          difficulty: "intermediate",
          inhaleSeconds: 3,
          holdAfterInhaleSeconds: 2,
          exhaleSeconds: 3,
          holdAfterExhaleSeconds: 0,
          defaultRounds: 10,
          defaultDurationMinutes: 5,
          benefits: ["Increases oxygen levels", "Primes for performance", "Boosts energy", "Enhances focus"],
          instructions: ["Take a powerful breath in through nose", "Hold briefly at the top", "Exhale forcefully", "Build rhythm and intensity"],
        },
        {
          name: "Recovery Breathing",
          slug: "recovery-breathing",
          description: "A post-workout recovery technique that helps clear lactate, reduce heart rate, and initiate the recovery process.",
          category: "recovery",
          difficulty: "beginner",
          inhaleSeconds: 4,
          holdAfterInhaleSeconds: 0,
          exhaleSeconds: 8,
          holdAfterExhaleSeconds: 0,
          defaultRounds: 8,
          defaultDurationMinutes: 6,
          benefits: ["Speeds recovery", "Lowers heart rate", "Clears lactate", "Activates rest mode"],
          instructions: ["Lie down or sit comfortably", "Breathe in through nose for 4 seconds", "Exhale slowly for 8 seconds", "Focus on complete relaxation"],
        },
        {
          name: "Focus Breathing",
          slug: "focus-breathing",
          description: "A technique designed to sharpen mental clarity and enhance concentration before important tasks or decisions.",
          category: "focus",
          difficulty: "beginner",
          inhaleSeconds: 4,
          holdAfterInhaleSeconds: 2,
          exhaleSeconds: 4,
          holdAfterExhaleSeconds: 2,
          defaultRounds: 6,
          defaultDurationMinutes: 4,
          benefits: ["Sharpens mental clarity", "Improves concentration", "Reduces mental chatter", "Enhances decision-making"],
          instructions: ["Sit in an alert but relaxed posture", "Breathe in steadily for 4 seconds", "Hold briefly while focusing attention", "Exhale smoothly", "Hold empty, maintaining focus"],
        },
        {
          name: "Sleep Preparation",
          slug: "sleep-preparation",
          description: "A calming sequence designed to lower arousal levels and prepare the body and mind for restful sleep.",
          category: "relaxation",
          difficulty: "beginner",
          inhaleSeconds: 4,
          holdAfterInhaleSeconds: 0,
          exhaleSeconds: 7,
          holdAfterExhaleSeconds: 1,
          defaultRounds: 8,
          defaultDurationMinutes: 8,
          benefits: ["Promotes sleepiness", "Lowers arousal levels", "Calms racing thoughts", "Prepares body for rest"],
          instructions: ["Lie down comfortably", "Breathe in slowly through nose", "Exhale even more slowly", "Allow body to become heavy with each exhale"],
        },
        {
          name: "NSDR (Non-Sleep Deep Rest)",
          slug: "nsdr",
          description: "A protocol popularized by Dr. Andrew Huberman that induces deep relaxation without sleep. Combines slow breathing with body scanning to restore mental and physical energy.",
          category: "recovery",
          difficulty: "beginner",
          inhaleSeconds: 4,
          holdAfterInhaleSeconds: 0,
          exhaleSeconds: 6,
          holdAfterExhaleSeconds: 2,
          defaultRounds: 10,
          defaultDurationMinutes: 20,
          benefits: ["Restores dopamine levels", "Enhances learning and memory", "Reduces fatigue without sleep", "Promotes deep relaxation", "Improves focus after session"],
          instructions: ["Lie down in a comfortable position", "Close your eyes and relax your body", "Breathe slowly and deeply", "Scan your body from head to toe, releasing tension", "Allow yourself to drift into deep relaxation", "Remain aware but deeply relaxed for 10-20 minutes"],
        },
      ];

      for (const technique of techniques) {
        await storage.createBreathTechnique(technique);
      }

      res.json({ message: "Techniques seeded successfully", count: techniques.length });
    } catch (error) {
      console.error("Error seeding breath techniques:", error);
      res.status(500).json({ message: "Failed to seed breath techniques" });
    }
  });

  // ========================================
  // MEAL PLAN ROUTES
  // ========================================

  app.get('/api/meal-plan', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const plan = await storage.getUserMealPlan(userId);
      if (!plan) return res.json(null);
      const details = await storage.getMealPlanWithDetails(plan.id);
      res.json(details);
    } catch (error) {
      console.error("Error fetching meal plan:", error);
      res.status(500).json({ message: "Failed to fetch meal plan" });
    }
  });

  app.post('/api/meal-plan', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { caloriesPerDay, macroSplit, mealsPerDay, mealSlots, dietaryPreference, excludedIngredients } = req.body;

      // Convert mealSlots to meal entries for generation
      // Each slot becomes one or more meals (main with sides becomes main + side dishes)
      interface MealEntry { type: string; slotIndex: number; isMain: boolean; isSide: boolean; parentIndex?: number; }
      const getMealEntries = (slots: { type: string; sides?: number }[]): MealEntry[] => {
        const entries: MealEntry[] = [];
        slots.forEach((slot, slotIndex) => {
          if (slot.type === 'main') {
            entries.push({ type: 'main', slotIndex, isMain: true, isSide: false });
            const sideCount = slot.sides || 0;
            for (let s = 0; s < sideCount; s++) {
              entries.push({ type: 'side', slotIndex, isMain: false, isSide: true, parentIndex: entries.length - 1 - s });
            }
          } else {
            entries.push({ type: slot.type, slotIndex, isMain: false, isSide: false });
          }
        });
        return entries;
      };

      // Default slots if none provided (backward compatibility)
      const defaultSlots = [{ type: 'breakfast' }, { type: 'main', sides: 0 }, { type: 'main', sides: 0 }];
      const slots = mealSlots && Array.isArray(mealSlots) && mealSlots.length >= 2 ? mealSlots : defaultSlots;

      const plan = await storage.createMealPlan({
        userId, caloriesPerDay, macroSplit, mealsPerDay: slots.length, dietaryPreference,
        excludedIngredients: excludedIngredients || [],
        mealSlots: slots,
      });

      const mealEntries = getMealEntries(slots);
      const usedRecipeIds: number[] = [];

      for (let dayIndex = 1; dayIndex <= 7; dayIndex++) {
        const day = await storage.createMealPlanDay({ mealPlanId: plan.id, dayIndex, totalCalories: 0 });
        let dayCalories = 0;
        const dailyMax = Math.round(caloriesPerDay * 1.10);
        
        for (let i = 0; i < mealEntries.length; i++) {
          const entry = mealEntries[i];
          const mealsRemaining = mealEntries.length - i;
          
          if (dayCalories >= dailyMax) break;
          
          const roomUntilMax = dailyMax - dayCalories;
          if (roomUntilMax < 50) continue;
          
          // Sides get smaller calorie allocation
          const targetCaloriesPerMeal = entry.isSide 
            ? Math.round(roomUntilMax / mealsRemaining * 0.4) 
            : Math.round(roomUntilMax / mealsRemaining);
          const maxCalories = roomUntilMax;
          
          // Map meal type for recipe search - sides search for smaller main dishes
          const mealTypeForSearch = entry.type === 'side' ? 'main' : entry.type;
          
          const recipes = await storage.getRecipesForMealPlan({
            caloriesPerDay, macroSplit, mealsPerDay: slots.length, dietaryPreference,
            excludedIngredients: excludedIngredients || [],
            excludeRecipeIds: usedRecipeIds,
            mealType: mealTypeForSearch,
            targetCaloriesPerMeal,
            maxCalories,
          });

          if (recipes.length > 0) {
            const validRecipe = recipes.find(r => dayCalories + r.calories <= dailyMax);
            
            if (validRecipe) {
              usedRecipeIds.push(validRecipe.id);
              // Include slot index in mealType for proper grouping: type_slotIndex
              const mealTypeWithSlot = entry.isSide 
                ? `side_${entry.slotIndex}` 
                : `${entry.type}_${entry.slotIndex}`;
              await storage.createMealPlanMeal({
                mealPlanDayId: day.id, 
                mealType: mealTypeWithSlot, 
                recipeId: validRecipe.id,
                calories: validRecipe.calories, protein: validRecipe.protein, carbs: validRecipe.carbs, fat: validRecipe.fat,
                position: i,
              });
              dayCalories += validRecipe.calories;
            }
          }
        }
        await storage.updateMealPlanDay(day.id, { totalCalories: dayCalories });
      }

      const details = await storage.getMealPlanWithDetails(plan.id);
      res.json(details);
    } catch (error) {
      console.error("Error creating meal plan:", error);
      res.status(500).json({ message: "Failed to create meal plan" });
    }
  });

  app.patch('/api/meal-plan/:id', isAuthenticated, async (req: any, res) => {
    try {
      const planId = parseInt(req.params.id);
      const updated = await storage.updateMealPlan(planId, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating meal plan:", error);
      res.status(500).json({ message: "Failed to update meal plan" });
    }
  });

  app.delete('/api/meal-plan/:id', isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteMealPlan(parseInt(req.params.id));
      res.json({ message: "Meal plan deleted" });
    } catch (error) {
      console.error("Error deleting meal plan:", error);
      res.status(500).json({ message: "Failed to delete meal plan" });
    }
  });

  app.patch('/api/meal-plan/meal/:mealId/ate', isAuthenticated, async (req: any, res) => {
    try {
      const mealId = parseInt(req.params.mealId);
      const userId = req.user.claims.sub;
      const { ateToday } = req.body;
      
      // Get meal plan details to find the meal and recipe
      const plan = await storage.getUserMealPlan(userId);
      if (!plan) {
        return res.status(404).json({ message: "No meal plan found" });
      }
      
      const fullPlan = await storage.getMealPlanWithDetails(plan.id);
      if (!fullPlan) {
        return res.status(404).json({ message: "Meal plan not found" });
      }

      // Find the meal
      let mealData: any = null;
      for (const day of fullPlan.days) {
        const meal = day.meals.find((m) => m.id === mealId);
        if (meal) {
          mealData = meal;
          break;
        }
      }

      if (!mealData) {
        return res.status(404).json({ message: "Meal not found" });
      }

      // Update the meal plan meal
      const updated = await storage.updateMealPlanMeal(mealId, {
        ateToday, ateTodayDate: ateToday ? new Date() : null,
      });

      // If marking as eaten, also create a food log entry for the macro tracker
      if (ateToday && mealData.recipe) {
        // Convert mealType (e.g., "breakfast_0", "main_1", "dessert_3") to meal slot name
        const slotIndex = parseInt(mealData.mealType.split('_').pop() || '0');
        const mealSlotName = `meal ${slotIndex + 1}`;
        
        await storage.createFoodLog({
          userId,
          date: new Date(),
          mealCategory: mealSlotName,
          foodName: mealData.recipe.title,
          calories: mealData.calories,
          protein: mealData.protein,
          carbs: mealData.carbs,
          fat: mealData.fat,
        });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating meal:", error);
      res.status(500).json({ message: "Failed to update meal" });
    }
  });

  app.post('/api/meal-plan/meal/:mealId/regenerate', isAuthenticated, async (req: any, res) => {
    try {
      const mealId = parseInt(req.params.mealId);
      const planDetails = await storage.getUserMealPlan(req.user.claims.sub);
      if (!planDetails) return res.status(404).json({ message: "No meal plan found" });

      const fullPlan = await storage.getMealPlanWithDetails(planDetails.id);
      if (!fullPlan) return res.status(404).json({ message: "Meal plan not found" });

      let currentMeal: any = null, dayData: any = null;
      for (const day of fullPlan.days) {
        const meal = day.meals.find((m) => m.id === mealId);
        if (meal) { currentMeal = meal; dayData = day; break; }
      }
      if (!currentMeal) return res.status(404).json({ message: "Meal not found" });

      const allUsedIds = fullPlan.days.flatMap((d) => d.meals.map((m) => m.recipeId));
      const recipes = await storage.getRecipesForMealPlan({
        caloriesPerDay: fullPlan.plan.caloriesPerDay, macroSplit: fullPlan.plan.macroSplit,
        mealsPerDay: fullPlan.plan.mealsPerDay, dietaryPreference: fullPlan.plan.dietaryPreference,
        excludedIngredients: fullPlan.plan.excludedIngredients || [],
        excludeRecipeIds: allUsedIds, mealType: currentMeal.mealType,
      });

      let newRecipe;
      if (recipes.length === 0) {
        const fallback = await storage.getRecipesForMealPlan({
          caloriesPerDay: fullPlan.plan.caloriesPerDay, macroSplit: fullPlan.plan.macroSplit,
          mealsPerDay: fullPlan.plan.mealsPerDay, dietaryPreference: fullPlan.plan.dietaryPreference,
          excludedIngredients: fullPlan.plan.excludedIngredients || [],
          excludeRecipeIds: [currentMeal.recipeId], mealType: currentMeal.mealType,
        });
        if (fallback.length === 0) return res.status(400).json({ message: "No alternative available" });
        newRecipe = fallback[Math.floor(Math.random() * fallback.length)];
      } else {
        newRecipe = recipes[Math.floor(Math.random() * recipes.length)];
      }

      await storage.updateMealPlanMeal(mealId, {
        recipeId: newRecipe.id, calories: newRecipe.calories, protein: newRecipe.protein,
        carbs: newRecipe.carbs, fat: newRecipe.fat, ateToday: false, ateTodayDate: null,
      });

      const newDayTotal = dayData.meals.reduce((acc: number, m: any) => 
        acc + (m.id === mealId ? newRecipe.calories : m.calories), 0);
      await storage.updateMealPlanDay(dayData.id, { totalCalories: newDayTotal });

      const updated = await storage.getMealPlanWithDetails(fullPlan.plan.id);
      res.json(updated);
    } catch (error) {
      console.error("Error regenerating meal:", error);
      res.status(500).json({ message: "Failed to regenerate meal" });
    }
  });

  app.post('/api/meal-plan/:id/regenerate', isAuthenticated, async (req: any, res) => {
    try {
      const planId = parseInt(req.params.id);
      const existingPlan = await storage.getUserMealPlan(req.user.claims.sub);
      if (!existingPlan || existingPlan.id !== planId) return res.status(404).json({ message: "Meal plan not found" });

      // Convert mealSlots to meal entries for generation
      interface MealEntry { type: string; slotIndex: number; isMain: boolean; isSide: boolean; parentIndex?: number; }
      const getMealEntries = (slots: { type: string; sides?: number }[]): MealEntry[] => {
        const entries: MealEntry[] = [];
        slots.forEach((slot, slotIndex) => {
          if (slot.type === 'main') {
            entries.push({ type: 'main', slotIndex, isMain: true, isSide: false });
            const sideCount = slot.sides || 0;
            for (let s = 0; s < sideCount; s++) {
              entries.push({ type: 'side', slotIndex, isMain: false, isSide: true, parentIndex: entries.length - 1 - s });
            }
          } else {
            entries.push({ type: slot.type, slotIndex, isMain: false, isSide: false });
          }
        });
        return entries;
      };

      // Default slots if none provided
      const defaultSlots = [{ type: 'breakfast' }, { type: 'main', sides: 0 }, { type: 'main', sides: 0 }];
      const existingSlots = existingPlan.mealSlots as { type: string; sides?: number }[] | null;
      
      // Use new settings from request body, falling back to existing plan values
      const requestSlots = req.body.mealSlots;
      const slots = requestSlots && Array.isArray(requestSlots) && requestSlots.length >= 2 
        ? requestSlots 
        : (existingSlots && existingSlots.length >= 2 ? existingSlots : defaultSlots);

      const settings = {
        caloriesPerDay: req.body.caloriesPerDay ?? existingPlan.caloriesPerDay,
        macroSplit: req.body.macroSplit ?? existingPlan.macroSplit,
        mealsPerDay: slots.length,
        mealSlots: slots,
        dietaryPreference: req.body.dietaryPreference ?? existingPlan.dietaryPreference,
        excludedIngredients: req.body.excludedIngredients ?? existingPlan.excludedIngredients ?? [],
      };

      await storage.deleteMealPlan(planId);
      const newPlan = await storage.createMealPlan({
        userId: req.user.claims.sub, caloriesPerDay: settings.caloriesPerDay, macroSplit: settings.macroSplit,
        mealsPerDay: settings.mealsPerDay, dietaryPreference: settings.dietaryPreference,
        excludedIngredients: settings.excludedIngredients,
        mealSlots: settings.mealSlots,
      });

      const mealEntries = getMealEntries(slots);
      const usedRecipeIds: number[] = [];

      for (let dayIndex = 1; dayIndex <= 7; dayIndex++) {
        const day = await storage.createMealPlanDay({ mealPlanId: newPlan.id, dayIndex, totalCalories: 0 });
        let dayCalories = 0;
        const dailyMax = Math.round(settings.caloriesPerDay * 1.10);
        
        for (let i = 0; i < mealEntries.length; i++) {
          const entry = mealEntries[i];
          const mealsRemaining = mealEntries.length - i;
          
          if (dayCalories >= dailyMax) break;
          
          const roomUntilMax = dailyMax - dayCalories;
          if (roomUntilMax < 50) continue;
          
          // Sides get smaller calorie allocation
          const targetCaloriesPerMeal = entry.isSide 
            ? Math.round(roomUntilMax / mealsRemaining * 0.4) 
            : Math.round(roomUntilMax / mealsRemaining);
          const maxCalories = roomUntilMax;
          
          // Map meal type for recipe search - sides search for smaller main dishes
          const mealTypeForSearch = entry.type === 'side' ? 'main' : entry.type;
          
          const recipes = await storage.getRecipesForMealPlan({
            caloriesPerDay: settings.caloriesPerDay, macroSplit: settings.macroSplit, mealsPerDay: settings.mealsPerDay,
            dietaryPreference: settings.dietaryPreference, excludedIngredients: settings.excludedIngredients,
            excludeRecipeIds: usedRecipeIds, mealType: mealTypeForSearch,
            targetCaloriesPerMeal,
            maxCalories,
          });

          if (recipes.length > 0) {
            const validRecipe = recipes.find(r => dayCalories + r.calories <= dailyMax);
            
            if (validRecipe) {
              usedRecipeIds.push(validRecipe.id);
              // Include slot index in mealType for proper grouping: type_slotIndex
              const mealTypeWithSlot = entry.isSide 
                ? `side_${entry.slotIndex}` 
                : `${entry.type}_${entry.slotIndex}`;
              await storage.createMealPlanMeal({
                mealPlanDayId: day.id, 
                mealType: mealTypeWithSlot, 
                recipeId: validRecipe.id,
                calories: validRecipe.calories, protein: validRecipe.protein, carbs: validRecipe.carbs, fat: validRecipe.fat,
                position: i,
              });
              dayCalories += validRecipe.calories;
            }
          }
        }
        await storage.updateMealPlanDay(day.id, { totalCalories: dayCalories });
      }

      const details = await storage.getMealPlanWithDetails(newPlan.id);
      res.json(details);
    } catch (error) {
      console.error("Error regenerating meal plan:", error);
      res.status(500).json({ message: "Failed to regenerate meal plan" });
    }
  });

  // ============================================
  // WORKDAY ENGINE ROUTES
  // ============================================

  // Workday Positions - Admin CRUD
  app.get('/api/admin/workday/positions', isAuthenticated, async (req: any, res) => {
    try {
      const positions = await storage.getAllWorkdayPositions();
      res.json(positions);
    } catch (error) {
      console.error("Error fetching workday positions:", error);
      res.status(500).json({ message: "Failed to fetch positions" });
    }
  });

  app.get('/api/admin/workday/positions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const position = await storage.getWorkdayPositionById(parseInt(req.params.id));
      if (!position) return res.status(404).json({ message: "Position not found" });
      res.json(position);
    } catch (error) {
      console.error("Error fetching workday position:", error);
      res.status(500).json({ message: "Failed to fetch position" });
    }
  });

  app.post('/api/admin/workday/positions', isAuthenticated, async (req: any, res) => {
    try {
      const validated = insertWorkdayPositionSchema.parse(req.body);
      const position = await storage.createWorkdayPosition(validated);
      res.status(201).json(position);
    } catch (error) {
      console.error("Error creating workday position:", error);
      res.status(500).json({ message: "Failed to create position" });
    }
  });

  app.patch('/api/admin/workday/positions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const position = await storage.updateWorkdayPosition(parseInt(req.params.id), req.body);
      res.json(position);
    } catch (error) {
      console.error("Error updating workday position:", error);
      res.status(500).json({ message: "Failed to update position" });
    }
  });

  app.delete('/api/admin/workday/positions/:id', isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteWorkdayPosition(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting workday position:", error);
      res.status(500).json({ message: "Failed to delete position" });
    }
  });

  // Workday Micro-Resets - Admin CRUD
  app.get('/api/admin/workday/micro-resets', isAuthenticated, async (req: any, res) => {
    try {
      const targetArea = req.query.targetArea as string | undefined;
      const resets = await storage.getWorkdayMicroResets(targetArea);
      res.json(resets);
    } catch (error) {
      console.error("Error fetching micro-resets:", error);
      res.status(500).json({ message: "Failed to fetch micro-resets" });
    }
  });

  app.get('/api/admin/workday/micro-resets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const reset = await storage.getWorkdayMicroResetById(parseInt(req.params.id));
      if (!reset) return res.status(404).json({ message: "Micro-reset not found" });
      res.json(reset);
    } catch (error) {
      console.error("Error fetching micro-reset:", error);
      res.status(500).json({ message: "Failed to fetch micro-reset" });
    }
  });

  app.post('/api/admin/workday/micro-resets', isAuthenticated, async (req: any, res) => {
    try {
      const validated = insertWorkdayMicroResetSchema.parse(req.body);
      const reset = await storage.createWorkdayMicroReset(validated);
      res.status(201).json(reset);
    } catch (error) {
      console.error("Error creating micro-reset:", error);
      res.status(500).json({ message: "Failed to create micro-reset" });
    }
  });

  app.patch('/api/admin/workday/micro-resets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const reset = await storage.updateWorkdayMicroReset(parseInt(req.params.id), req.body);
      res.json(reset);
    } catch (error) {
      console.error("Error updating micro-reset:", error);
      res.status(500).json({ message: "Failed to update micro-reset" });
    }
  });

  app.delete('/api/admin/workday/micro-resets/:id', isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteWorkdayMicroReset(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting micro-reset:", error);
      res.status(500).json({ message: "Failed to delete micro-reset" });
    }
  });

  // Workday Aches & Fixes - Admin CRUD
  app.get('/api/admin/workday/aches-fixes', isAuthenticated, async (req: any, res) => {
    try {
      const fixes = await storage.getWorkdayAchesFixes();
      res.json(fixes);
    } catch (error) {
      console.error("Error fetching aches & fixes:", error);
      res.status(500).json({ message: "Failed to fetch aches & fixes" });
    }
  });

  app.get('/api/admin/workday/aches-fixes/:id', isAuthenticated, async (req: any, res) => {
    try {
      const fix = await storage.getWorkdayAchesFixById(parseInt(req.params.id));
      if (!fix) return res.status(404).json({ message: "Aches & fix not found" });
      res.json(fix);
    } catch (error) {
      console.error("Error fetching aches & fix:", error);
      res.status(500).json({ message: "Failed to fetch aches & fix" });
    }
  });

  app.post('/api/admin/workday/aches-fixes', isAuthenticated, async (req: any, res) => {
    try {
      const validated = insertWorkdayAchesFixSchema.parse(req.body);
      const fix = await storage.createWorkdayAchesFix(validated);
      res.status(201).json(fix);
    } catch (error) {
      console.error("Error creating aches & fix:", error);
      res.status(500).json({ message: "Failed to create aches & fix" });
    }
  });

  app.patch('/api/admin/workday/aches-fixes/:id', isAuthenticated, async (req: any, res) => {
    try {
      const fix = await storage.updateWorkdayAchesFix(parseInt(req.params.id), req.body);
      res.json(fix);
    } catch (error) {
      console.error("Error updating aches & fix:", error);
      res.status(500).json({ message: "Failed to update aches & fix" });
    }
  });

  app.delete('/api/admin/workday/aches-fixes/:id', isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteWorkdayAchesFix(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting aches & fix:", error);
      res.status(500).json({ message: "Failed to delete aches & fix" });
    }
  });

  // Workday Desk Setups - Admin CRUD
  app.get('/api/admin/workday/desk-setups', isAuthenticated, async (req: any, res) => {
    try {
      const deskType = req.query.deskType as string | undefined;
      const positionType = req.query.positionType as string | undefined;
      const setups = await storage.getWorkdayDeskSetups(deskType, positionType);
      res.json(setups);
    } catch (error) {
      console.error("Error fetching desk setups:", error);
      res.status(500).json({ message: "Failed to fetch desk setups" });
    }
  });

  app.get('/api/admin/workday/desk-setups/:id', isAuthenticated, async (req: any, res) => {
    try {
      const setup = await storage.getWorkdayDeskSetupById(parseInt(req.params.id));
      if (!setup) return res.status(404).json({ message: "Desk setup not found" });
      res.json(setup);
    } catch (error) {
      console.error("Error fetching desk setup:", error);
      res.status(500).json({ message: "Failed to fetch desk setup" });
    }
  });

  app.post('/api/admin/workday/desk-setups', isAuthenticated, async (req: any, res) => {
    try {
      const validated = insertWorkdayDeskSetupSchema.parse(req.body);
      const setup = await storage.createWorkdayDeskSetup(validated);
      res.status(201).json(setup);
    } catch (error) {
      console.error("Error creating desk setup:", error);
      res.status(500).json({ message: "Failed to create desk setup" });
    }
  });

  app.patch('/api/admin/workday/desk-setups/:id', isAuthenticated, async (req: any, res) => {
    try {
      const setup = await storage.updateWorkdayDeskSetup(parseInt(req.params.id), req.body);
      res.json(setup);
    } catch (error) {
      console.error("Error updating desk setup:", error);
      res.status(500).json({ message: "Failed to update desk setup" });
    }
  });

  app.delete('/api/admin/workday/desk-setups/:id', isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteWorkdayDeskSetup(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting desk setup:", error);
      res.status(500).json({ message: "Failed to delete desk setup" });
    }
  });

  // Workday Desk Tips - Admin CRUD
  app.get('/api/admin/workday/desk-tips', isAuthenticated, async (req: any, res) => {
    try {
      const tips = await storage.getWorkdayDeskTips();
      res.json(tips);
    } catch (error) {
      console.error("Error fetching desk tips:", error);
      res.status(500).json({ message: "Failed to fetch desk tips" });
    }
  });

  app.get('/api/admin/workday/desk-tips/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tip = await storage.getWorkdayDeskTipById(parseInt(req.params.id));
      if (!tip) return res.status(404).json({ message: "Desk tip not found" });
      res.json(tip);
    } catch (error) {
      console.error("Error fetching desk tip:", error);
      res.status(500).json({ message: "Failed to fetch desk tip" });
    }
  });

  app.post('/api/admin/workday/desk-tips', isAuthenticated, async (req: any, res) => {
    try {
      const validated = insertWorkdayDeskTipSchema.parse(req.body);
      const tip = await storage.createWorkdayDeskTip(validated);
      res.status(201).json(tip);
    } catch (error) {
      console.error("Error creating desk tip:", error);
      res.status(500).json({ message: "Failed to create desk tip" });
    }
  });

  app.patch('/api/admin/workday/desk-tips/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tip = await storage.updateWorkdayDeskTip(parseInt(req.params.id), req.body);
      res.json(tip);
    } catch (error) {
      console.error("Error updating desk tip:", error);
      res.status(500).json({ message: "Failed to update desk tip" });
    }
  });

  app.delete('/api/admin/workday/desk-tips/:id', isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteWorkdayDeskTip(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting desk tip:", error);
      res.status(500).json({ message: "Failed to delete desk tip" });
    }
  });

  // Admin - Backfill enrollment snapshots for existing enrollments
  app.post('/api/admin/backfill-enrollment-snapshots', isAuthenticated, async (req: any, res) => {
    try {
      const result = await storage.backfillEnrollmentSnapshots();
      res.json({
        success: true,
        message: `Backfill complete. Processed: ${result.processed}, Skipped: ${result.skipped}`,
        ...result
      });
    } catch (error) {
      console.error("Error backfilling enrollment snapshots:", error);
      res.status(500).json({ message: "Failed to backfill enrollment snapshots" });
    }
  });
  
  // Admin - Regenerate enrollment snapshots with full multi-week data
  app.post('/api/admin/regenerate-enrollment-snapshots', isAuthenticated, async (req: any, res) => {
    try {
      const result = await storage.regenerateEnrollmentSnapshots();
      res.json({
        success: true,
        message: `Regeneration complete. Processed: ${result.processed}, Errors: ${result.errors}`,
        ...result
      });
    } catch (error) {
      console.error("Error regenerating enrollment snapshots:", error);
      res.status(500).json({ message: "Failed to regenerate enrollment snapshots" });
    }
  });

  // User-facing Workday Engine routes
  app.get('/api/workday/positions', isAuthenticated, async (req: any, res) => {
    try {
      const positions = await storage.getWorkdayPositions();
      res.json(positions);
    } catch (error) {
      console.error("Error fetching workday positions:", error);
      res.status(500).json({ message: "Failed to fetch positions" });
    }
  });

  app.get('/api/workday/micro-resets', isAuthenticated, async (req: any, res) => {
    try {
      const targetArea = req.query.targetArea as string | undefined;
      const resets = await storage.getWorkdayMicroResets(targetArea);
      res.json(resets);
    } catch (error) {
      console.error("Error fetching micro-resets:", error);
      res.status(500).json({ message: "Failed to fetch micro-resets" });
    }
  });

  app.get('/api/workday/aches-fixes', isAuthenticated, async (req: any, res) => {
    try {
      const fixes = await storage.getWorkdayAchesFixes();
      res.json(fixes);
    } catch (error) {
      console.error("Error fetching aches & fixes:", error);
      res.status(500).json({ message: "Failed to fetch aches & fixes" });
    }
  });

  app.get('/api/workday/aches-fixes/:issueType', isAuthenticated, async (req: any, res) => {
    try {
      const fix = await storage.getWorkdayAchesFixByIssueType(req.params.issueType);
      if (!fix) return res.status(404).json({ message: "Aches & fix not found" });
      res.json(fix);
    } catch (error) {
      console.error("Error fetching aches & fix:", error);
      res.status(500).json({ message: "Failed to fetch aches & fix" });
    }
  });

  app.get('/api/workday/desk-setups', isAuthenticated, async (req: any, res) => {
    try {
      const deskType = req.query.deskType as string | undefined;
      const positionType = req.query.positionType as string | undefined;
      const setups = await storage.getWorkdayDeskSetups(deskType, positionType);
      res.json(setups);
    } catch (error) {
      console.error("Error fetching desk setups:", error);
      res.status(500).json({ message: "Failed to fetch desk setups" });
    }
  });

  app.get('/api/workday/desk-tips/:issueCode', isAuthenticated, async (req: any, res) => {
    try {
      const tip = await storage.getWorkdayDeskTipByCode(req.params.issueCode);
      if (!tip) return res.status(404).json({ message: "Desk tip not found" });
      res.json(tip);
    } catch (error) {
      console.error("Error fetching desk tip:", error);
      res.status(500).json({ message: "Failed to fetch desk tip" });
    }
  });

  // User profile and scans
  app.get('/api/workday/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getWorkdayUserProfile(userId);
      res.json(profile || null);
    } catch (error) {
      console.error("Error fetching workday profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.post('/api/workday/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const existing = await storage.getWorkdayUserProfile(userId);
      
      if (existing) {
        const updated = await storage.updateWorkdayUserProfile(userId, req.body);
        res.json(updated);
      } else {
        const validated = insertWorkdayUserProfileSchema.parse({ ...req.body, userId });
        const profile = await storage.createWorkdayUserProfile(validated);
        res.status(201).json(profile);
      }
    } catch (error) {
      console.error("Error saving workday profile:", error);
      res.status(500).json({ message: "Failed to save profile" });
    }
  });

  app.get('/api/workday/scans', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const scans = await storage.getWorkdayDeskScans(userId);
      res.json(scans);
    } catch (error) {
      console.error("Error fetching desk scans:", error);
      res.status(500).json({ message: "Failed to fetch scans" });
    }
  });

  app.post('/api/workday/scans', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validated = insertWorkdayDeskScanSchema.parse({ ...req.body, userId });
      const scan = await storage.createWorkdayDeskScan(validated);
      res.status(201).json(scan);
    } catch (error) {
      console.error("Error creating desk scan:", error);
      res.status(500).json({ message: "Failed to create scan" });
    }
  });

  app.delete('/api/workday/scans/:id', isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteWorkdayDeskScan(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting desk scan:", error);
      res.status(500).json({ message: "Failed to delete scan" });
    }
  });

  // AI Desk Setup Analyzer
  app.post('/api/workday/analyze-desk', isAuthenticated, async (req: any, res) => {
    try {
      const { imageBase64, deskType, positionType } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ message: "Image is required" });
      }

      const { analyzeVision, getProviderConfig, getCoachingContext } = await import('./aiProvider');

      const coachingSettings = await storage.getAiCoachingSetting('desk_scan');
      const providerConfig = getProviderConfig(coachingSettings);
      const coachingContext = await getCoachingContext('desk_scan');

      const prompt = `You are an expert ergonomics consultant analyzing a ${positionType || 'seated'} desk setup. Analyze this workspace image and provide specific, actionable feedback.${coachingContext}

Please evaluate and provide feedback on:
1. **Monitor Position** - Height, distance, and angle (eyes should be level with top third of screen, arm's length away)
2. **Chair Setup** - Height, back support, armrest position (if visible)
3. **Keyboard & Mouse** - Position, height, wrist alignment (elbows at 90°, wrists neutral)
4. **Lighting** - Glare, ambient lighting, screen brightness
5. **Posture Indicators** - Any visible posture concerns based on the setup
6. **Desk Organization** - Clutter, frequently used items within reach

For each issue found, provide:
- What's wrong
- Why it matters for health/productivity
- How to fix it

End with a summary score (1-10) and top 3 priority fixes.

Format your response as JSON with this structure:
{
  "score": number,
  "summary": "brief overall assessment",
  "issues": [
    {
      "category": "category name",
      "status": "good" | "needs_improvement" | "critical",
      "observation": "what you see",
      "recommendation": "how to fix it"
    }
  ],
  "priorityFixes": ["fix 1", "fix 2", "fix 3"]
}`;

      const result = await analyzeVision(providerConfig, {
        imageBase64,
        prompt,
        maxTokens: 2048,
      });

      const responseText = result.text;
      
      let analysis;
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          analysis = { rawResponse: responseText };
        }
      } catch {
        analysis = { rawResponse: responseText };
      }

      const userId = req.user.claims.sub;
      const observations = analysis.issues?.map((i: any) => `${i.category}: ${i.observation}`) || [];
      
      const scan = await storage.createWorkdayDeskScan({
        userId,
        deskType: deskType || 'standard',
        positionType: positionType || 'seated',
        observations,
      });

      // Check and award eligible badges after desk scan
      try {
        const newBadges = await storage.checkUserBadgeEligibility(userId);
        if (newBadges.length > 0) {
          console.log(`[BADGE AWARDED] User ${userId} earned ${newBadges.length} badge(s): ${newBadges.map(b => b.name).join(', ')}`);
        }
      } catch (badgeError: any) {
        console.error(`[BADGE CHECK ERROR] Failed to check/award badges:`, badgeError?.message);
      }

      res.json({ 
        scanId: scan.id,
        analysis 
      });
    } catch (error) {
      console.error("Error analyzing desk setup:", error);
      res.status(500).json({ message: "Failed to analyze desk setup" });
    }
  });

  // AI Coaching Settings CRUD routes (admin only)
  app.get('/api/admin/ai-coaching-settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const settings = await storage.getAllAiCoachingSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching AI coaching settings:", error);
      res.status(500).json({ message: "Failed to fetch AI coaching settings" });
    }
  });

  app.get('/api/admin/ai-coaching-settings/:feature', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const setting = await storage.getAiCoachingSetting(req.params.feature);
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      res.json(setting);
    } catch (error) {
      console.error("Error fetching AI coaching setting:", error);
      res.status(500).json({ message: "Failed to fetch AI coaching setting" });
    }
  });

  app.post('/api/admin/ai-coaching-settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { feature, provider, model, coachingVoice, customGuidelines, priorityFactors, brandRecommendations, coachingRules, thingsToNeverDo, responseStyle, featureContext, isActive } = req.body;
      if (!feature || typeof feature !== 'string') {
        return res.status(400).json({ message: "Feature name is required" });
      }

      const { getAvailableProviders } = await import('./aiProvider');
      const availableProviders = getAvailableProviders();
      const selectedProvider = provider || 'anthropic';
      const providerConfig = availableProviders.find(p => p.provider === selectedProvider);
      if (!providerConfig) {
        return res.status(400).json({ message: `Unsupported provider: ${selectedProvider}` });
      }
      const selectedModel = model || providerConfig.models[0];
      if (!providerConfig.models.includes(selectedModel)) {
        return res.status(400).json({ message: `Model ${selectedModel} is not available for provider ${selectedProvider}` });
      }

      const setting = await storage.upsertAiCoachingSetting({
        feature,
        provider: selectedProvider,
        model: selectedModel,
        coachingVoice: coachingVoice || null,
        customGuidelines: customGuidelines || null,
        priorityFactors: Array.isArray(priorityFactors) ? priorityFactors : null,
        brandRecommendations: brandRecommendations || null,
        coachingRules: coachingRules || null,
        thingsToNeverDo: thingsToNeverDo || null,
        responseStyle: responseStyle || null,
        featureContext: featureContext || null,
        isActive: isActive ?? true,
      });
      res.json(setting);
    } catch (error) {
      console.error("Error saving AI coaching setting:", error);
      res.status(500).json({ message: "Failed to save AI coaching setting" });
    }
  });

  app.get('/api/admin/ai-providers', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { getAvailableProviders } = await import('./aiProvider');
      res.json(getAvailableProviders());
    } catch (error) {
      console.error("Error fetching AI providers:", error);
      res.status(500).json({ message: "Failed to fetch AI providers" });
    }
  });

  app.get('/api/admin/company-names', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const allCompanies = await storage.getCompanies();
      res.json(allCompanies.map(c => c.name));
    } catch (error) {
      console.error("Error fetching company names:", error);
      res.status(500).json({ message: "Failed to fetch company names" });
    }
  });

  // Company Reports API routes (anonymous aggregate reporting)
  const { getCompanySummaries, getCompanyReport } = await import("./reportingEngine");

  app.get('/api/admin/reports/companies', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const companies = await getCompanySummaries();
      res.json(companies);
    } catch (error) {
      console.error("Error fetching company summaries:", error);
      res.status(500).json({ message: "Failed to fetch company summaries" });
    }
  });

  app.get('/api/admin/reports/company/:companyName', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { companyName } = req.params;
      const windowDays = parseInt(req.query.window as string) || 30;
      const month = req.query.month as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
        }
        const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 7) {
          return res.status(400).json({ message: "Date range must be at least 7 days" });
        }
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        const report = await getCompanyReport(decodeURIComponent(companyName), diffDays, month, start, end);
        return res.json(report);
      }

      if (windowDays < 7) {
        return res.status(400).json({ message: "Window must be at least 7 days" });
      }

      const report = await getCompanyReport(decodeURIComponent(companyName), windowDays, month);
      res.json(report);
    } catch (error) {
      console.error("Error fetching company report:", error);
      res.status(500).json({ message: "Failed to fetch company report" });
    }
  });

  // Badges and Milestones API routes
  app.get('/api/badges', async (req, res) => {
    try {
      const allBadges = await storage.getAllBadges();
      res.json(allBadges);
    } catch (error) {
      console.error("Error fetching badges:", error);
      res.status(500).json({ message: "Failed to fetch badges" });
    }
  });

  app.get('/api/badges/category/:category', async (req, res) => {
    try {
      const badges = await storage.getBadgesByCategory(req.params.category);
      res.json(badges);
    } catch (error) {
      console.error("Error fetching badges by category:", error);
      res.status(500).json({ message: "Failed to fetch badges" });
    }
  });

  app.get('/api/user/badges', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const userBadges = await storage.getUserBadges(userId, limit);
      res.json(userBadges);
    } catch (error) {
      console.error("Error fetching user badges:", error);
      res.status(500).json({ message: "Failed to fetch user badges" });
    }
  });

  app.get('/api/user/badges/unnotified', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const unnotifiedBadges = await storage.getUserUnnotifiedBadges(userId);
      res.json(unnotifiedBadges);
    } catch (error) {
      console.error("Error fetching unnotified badges:", error);
      res.status(500).json({ message: "Failed to fetch unnotified badges" });
    }
  });

  app.post('/api/user/badges/check', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const newBadges = await storage.checkUserBadgeEligibility(userId);
      res.json({ newBadges });
    } catch (error) {
      console.error("Error checking badge eligibility:", error);
      res.status(500).json({ message: "Failed to check badge eligibility" });
    }
  });

  app.post('/api/user/badges/:id/notified', isAuthenticated, async (req: any, res) => {
    try {
      const userBadgeId = parseInt(req.params.id);
      await storage.markBadgeNotified(userBadgeId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking badge notified:", error);
      res.status(500).json({ message: "Failed to mark badge notified" });
    }
  });

  app.post('/api/user/badges/mark-all-notified', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.markAllBadgesNotified(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all badges notified:", error);
      res.status(500).json({ message: "Failed to mark all badges notified" });
    }
  });

  app.get('/api/user/badges/progress', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const allBadges = await storage.getAllBadges();
      const userBadges = await storage.getUserBadges(userId);
      const earnedBadgeIds = new Set(userBadges.map(ub => ub.badgeId));
      
      // Group badges by category with earned status
      const badgesByCategory: Record<string, Array<{ badge: any; earned: boolean; earnedAt?: Date }>> = {};
      
      for (const badge of allBadges) {
        const category = badge.category;
        if (!badgesByCategory[category]) {
          badgesByCategory[category] = [];
        }
        
        const userBadge = userBadges.find(ub => ub.badgeId === badge.id);
        badgesByCategory[category].push({
          badge,
          earned: earnedBadgeIds.has(badge.id),
          earnedAt: userBadge?.earnedAt || undefined,
        });
      }
      
      res.json({
        earned: userBadges.length,
        total: allBadges.length,
        badgesByCategory,
      });
    } catch (error) {
      console.error("Error fetching badge progress:", error);
      res.status(500).json({ message: "Failed to fetch badge progress" });
    }
  });

  // Support endpoints
  app.post('/api/support/contact', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { subject, message } = req.body;
      
      if (!subject || !message) {
        return res.status(400).json({ message: "Subject and message are required" });
      }
      
      // Log the support request (in production, this would send an email via Resend)
      console.log(`Support contact from ${userId}: ${subject} - ${message}`);
      
      res.json({ success: true, message: "Support request submitted" });
    } catch (error) {
      console.error("Error submitting support request:", error);
      res.status(500).json({ message: "Failed to submit support request" });
    }
  });

  app.post('/api/support/bug-report', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { description, steps } = req.body;
      
      if (!description) {
        return res.status(400).json({ message: "Description is required" });
      }
      
      // Log the bug report (in production, this would create a ticket or send an email)
      console.log(`Bug report from ${userId}: ${description} - Steps: ${steps || 'Not provided'}`);
      
      res.json({ success: true, message: "Bug report submitted" });
    } catch (error) {
      console.error("Error submitting bug report:", error);
      res.status(500).json({ message: "Failed to submit bug report" });
    }
  });

  app.post('/api/support/feature-request', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { title, description } = req.body;
      
      if (!title || !description) {
        return res.status(400).json({ message: "Title and description are required" });
      }
      
      // Log the feature request (in production, this would create a ticket or send an email)
      console.log(`Feature request from ${userId}: ${title} - ${description}`);
      
      res.json({ success: true, message: "Feature request submitted" });
    } catch (error) {
      console.error("Error submitting feature request:", error);
      res.status(500).json({ message: "Failed to submit feature request" });
    }
  });

  // Export user data
  app.get('/api/user/export-data', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Gather all user data
      const userData = {
        exportDate: new Date().toISOString(),
        userId,
        profile: await storage.getUser(userId),
        workoutLogs: await storage.getWorkoutLogs(userId),
        sleepEntries: await storage.getSleepEntries(userId),
        foodLogs: await storage.getFoodLogs(userId, new Date().toISOString().split('T')[0]),
        bodyMapLogs: await storage.getBodyMapLogs(userId),
        habits: await storage.getHabits(userId),
        goals: await storage.getGoals(userId),
        badges: await storage.getUserBadges(userId),
      };
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="paradigm-data-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(userData);
    } catch (error) {
      console.error("Error exporting user data:", error);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  // Logout all devices (destroy all sessions for user)
  app.post('/api/auth/logout-all', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      // Destroy current session - in a full implementation, you'd also invalidate all stored sessions
      req.session.destroy((err: any) => {
        if (err) {
          console.error("Error destroying session:", err);
          return res.status(500).json({ message: "Failed to logout" });
        }
        res.json({ success: true, message: "Logged out of all devices" });
      });
    } catch (error) {
      console.error("Error logging out all devices:", error);
      res.status(500).json({ message: "Failed to logout all devices" });
    }
  });

  // Delete account
  app.delete('/api/user/account', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // In production, this would delete all user data from all tables
      // For now, we'll just log it
      console.log(`Account deletion requested for user: ${userId}`);
      
      // Destroy session
      req.session.destroy((err: any) => {
        if (err) {
          console.error("Error destroying session:", err);
        }
        res.json({ success: true, message: "Account deleted" });
      });
    } catch (error) {
      console.error("Error deleting account:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  app.post('/api/auth/change-password', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new passwords are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.password) {
        return res.status(400).json({ message: "No password set for this account" });
      }

      const bcrypt = await import("bcrypt");
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(userId, { password: hashedNewPassword });

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // ==========================================
  // AI Coach Chat
  // ==========================================

  app.post('/api/coach/chat', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { message, conversationHistory = [] } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Message is required" });
      }

      if (message.length > 2000) {
        return res.status(400).json({ message: "Message too long (max 2000 characters)" });
      }

      const { getCoachingContext, getUserDataContext, getFeatureConfig, analyzeText, getCrossCoachContext } = await import('./aiProvider');

      const config = await getFeatureConfig('recovery_coach');
      if (!config) {
        return res.status(503).json({ message: "AI coaching is not configured" });
      }

      const coachingContext = await getCoachingContext('recovery_coach');
      const userDataContext = await getUserDataContext(userId, 'coach_chat');
      const crossCoachContext = await getCrossCoachContext(userId, 'coach_chat');

      const user = await storage.getUser(userId);
      const userName = user?.firstName || user?.name?.split(' ')[0] || 'there';

      let onboardingContext = '';
      const onboardingData = user?.onboardingData as any;
      if (onboardingData?.coaching) {
        const c = onboardingData.coaching;
        const parts: string[] = [];
        if (c.experienceLevel) parts.push(`Experience: ${c.experienceLevel}`);
        if (c.trainingEnvironment) parts.push(`Training location: ${c.trainingEnvironment}`);
        if (c.equipment?.length) parts.push(`Equipment: ${c.equipment.join(', ')}`);
        if (c.timeAvailability) parts.push(`Time per session: ${c.timeAvailability}`);
        if (c.workoutFrequency) parts.push(`Workout frequency: ${c.workoutFrequency}`);
        if (c.sleepHours) parts.push(`Sleep: ${c.sleepHours}`);
        if (c.stressLevel) parts.push(`Stress: ${c.stressLevel}`);
        if (c.deskBased) parts.push(`Desk-based work: ${c.deskBased}`);
        if (c.primaryGoal) parts.push(`Primary goal: ${c.primaryGoal}`);
        if (parts.length > 0) {
          onboardingContext = '\n\nUSER PROFILE (from onboarding intake):\n' + parts.join('\n');
        }
      }

      const recentHistory = conversationHistory.slice(-10);
      let historyText = '';
      if (recentHistory.length > 0) {
        historyText = '\n\nCONVERSATION HISTORY:\n' + recentHistory.map((m: any) =>
          `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`
        ).join('\n');
      }

      const systemPrompt = `You are a digital performance coach built into an executive health and wellness platform called The Paradigm Project. You provide personalised guidance based on the user's actual health data, training history, and goals. You have full knowledge of every programme, workout, exercise, recipe, video, and learning path available on the platform.

CORE COACHING RULES (always follow):
- Never give medical advice or diagnose conditions — recommend seeing a professional when appropriate
- Always prioritise pain-free performance over intensity
- Default to minimal effective dose — the simplest change that moves the needle
- Reinforce long-term thinking over quick fixes
- Ask reflective questions when appropriate to help the user think critically about their health
- Avoid absolutes and gimmicks — be evidence-based and measured
- Be warm, direct, and concise — like a trusted advisor, not a chatbot
- Use the user's name naturally
- Keep responses focused and actionable — avoid walls of text
- Never use em dashes. Use commas or shorter sentences instead.

PLATFORM KNOWLEDGE RULES:
- When recommending programmes, workouts, recipes, videos, or learning content, ALWAYS refer to specific items by their exact name from the library data provided
- Explain WHY a specific recommendation suits the user based on their profile, goals, equipment, schedule, and health data
- Reference app features naturally (e.g. "You can find the Bench Press tutorial in the exercise library", "The 8-Week Strength programme would fit your 3-day schedule", "Check out the Sleep topic in your learning paths")
- When asked about nutrition, reference specific recipes with their exact macros (protein, carbs, fat, calories)
- When asked about exercises, reference their target muscles, equipment needed, and movement patterns
- If a user asks for something that does not exist in the library, say so honestly and suggest the closest alternative
- Consider the user's equipment access, experience level, time availability, and any movement screening flags when recommending programmes or workouts
${coachingContext}${userDataContext}${onboardingContext}${crossCoachContext}

The user's name is ${userName}.${historyText}

User: ${message}

Respond as the coach. Be personalised, reference their actual data and specific platform content where relevant, and keep it concise.`;

      const response = await analyzeText({
        prompt: systemPrompt,
        maxTokens: 800,
      }, config.provider, config.model);

      res.json({ response: response.text });
    } catch (error) {
      console.error("Error in coach chat:", error);
      res.status(500).json({ message: "Failed to get coach response" });
    }
  });

  app.get('/api/coach/suggestions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const contextual: string[] = [];
      const general: string[] = [
        "I'm feeling more tired than normal",
        "How can I improve my sleep",
        "Help me manage my stress better",
        "What should I focus on this week",
        "How can I improve my protein intake",
        "Give me a quick energy boost routine",
        "How much water should I be drinking",
        "What are signs I'm overtraining",
        "How can I improve my posture at work",
        "What's a good pre-workout snack",
        "How do I stay consistent with training",
        "What supplements should I consider",
        "How can I recover faster between workouts",
        "Tips for better focus during the day",
        "How do I balance training with a busy schedule",
        "What are the best foods for muscle recovery",
        "How can I reduce sitting-related stiffness",
        "Give me a 5-minute desk stretch routine",
        "How important is sleep for performance",
        "What should I eat after a workout",
        "How do I warm up properly before lifting",
        "What's the best way to cool down after exercise",
        "How can I build a morning routine that sticks",
        "What are good snacks to keep at my desk",
        "How do I avoid the afternoon energy crash",
        "What stretches help with lower back tightness",
        "How can I track my progress more effectively",
        "What's a healthy breakfast for busy mornings",
        "How do I improve my grip strength",
        "What are the benefits of walking after meals",
        "How can I breathe better during workouts",
        "What's the best way to manage work stress",
        "How do I prevent shoulder injuries",
        "What are good mobility exercises for hips",
        "How can I improve my core strength",
        "What does a balanced meal plate look like",
        "How do I know if I need a rest day",
        "What are quick wins for better health this week",
        "How can I improve my squat form",
        "What's the link between hydration and energy",
        "What programme would suit me best",
        "Suggest a high-protein recipe for dinner",
        "What stretching routine should I try",
        "Which videos should I watch first",
        "What exercises target my weak areas",
        "Suggest a workout I can do today",
      ];

      try {
        const recentCheckIns = await storage.getUserCheckIns(userId, 3);
        if (recentCheckIns.length >= 2) {
          contextual.push("Analyse my check-in trends");
          contextual.push("What patterns do you see in my check-ins?");
        }
      } catch {}

      try {
        const bodyMapLogs = await storage.getBodyMapLogs(userId);
        const activePain = bodyMapLogs.filter(l => (l.severity || 0) >= 4);
        if (activePain.length > 0) {
          contextual.push("I have some pain or discomfort");
        }
      } catch {}

      try {
        const workoutLogs = await storage.getUserWorkoutLogs(userId, 3);
        if (workoutLogs.length > 0) {
          contextual.push("Show recent workout trends");
        }
      } catch {}

      try {
        const enrollments = await storage.getUserEnrolledPrograms(userId);
        if (enrollments.length > 0) {
          contextual.push("How is my programme going");
        }
      } catch {}

      for (let i = general.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [general[i], general[j]] = [general[j], general[i]];
      }

      for (let i = contextual.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [contextual[i], contextual[j]] = [contextual[j], contextual[i]];
      }

      const picked: string[] = [];
      for (const s of contextual) {
        if (picked.length >= 2) break;
        picked.push(s);
      }
      for (const s of general) {
        if (picked.length >= 4) break;
        if (!picked.includes(s)) picked.push(s);
      }

      for (let i = picked.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [picked[i], picked[j]] = [picked[j], picked[i]];
      }

      res.json({ suggestions: picked });
    } catch (error) {
      console.error("Error fetching coach suggestions:", error);
      const fallbacks = [
        "I'm feeling more tired than normal",
        "How can I improve my protein intake",
        "Show recent workout trends",
        "Help me manage my stress better",
        "What should I focus on this week",
        "How can I improve my sleep",
        "Give me a quick energy boost routine",
      ];
      for (let i = fallbacks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [fallbacks[i], fallbacks[j]] = [fallbacks[j], fallbacks[i]];
      }
      res.json({ suggestions: fallbacks.slice(0, 4) });
    }
  });

  app.get('/api/coach/proactive-greeting', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { getCoachingContext, getUserDataContext, getFeatureConfig, analyzeText, getCrossCoachContext } = await import('./aiProvider');

      const config = await getFeatureConfig('recovery_coach');
      if (!config) {
        return res.status(503).json({ message: "AI coaching is not configured" });
      }

      const user = await storage.getUser(userId);
      const userName = user?.firstName || user?.name?.split(' ')[0] || 'there';

      const coachingContext = await getCoachingContext('recovery_coach');
      const userDataContext = await getUserDataContext(userId, 'proactive_greeting');
      const crossCoachContext = await getCrossCoachContext(userId, 'coach_chat');

      let onboardingContext = '';
      const onboardingData = user?.onboardingData as any;
      if (onboardingData?.coaching) {
        const c = onboardingData.coaching;
        const parts: string[] = [];
        if (c.experienceLevel) parts.push(`Experience: ${c.experienceLevel}`);
        if (c.trainingEnvironment) parts.push(`Training location: ${c.trainingEnvironment}`);
        if (c.equipment?.length) parts.push(`Equipment: ${c.equipment.join(', ')}`);
        if (c.timeAvailability) parts.push(`Time per session: ${c.timeAvailability}`);
        if (c.sleepHours) parts.push(`Sleep: ${c.sleepHours}`);
        if (c.stressLevel) parts.push(`Stress: ${c.stressLevel}`);
        if (c.deskBased) parts.push(`Desk-based work: ${c.deskBased}`);
        if (c.primaryGoal) parts.push(`Primary goal: ${c.primaryGoal}`);
        if (parts.length > 0) {
          onboardingContext = '\n\nUSER PROFILE (from onboarding intake):\n' + parts.join('\n');
        }
      }

      const now = new Date();
      const hour = now.getHours();
      let timeOfDay = 'morning';
      if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
      else if (hour >= 17) timeOfDay = 'evening';

      const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

      const topicCategories = [
        'Workout progress, training consistency, or today\'s scheduled session',
        'Sleep quality, sleep duration trends, or recovery patterns',
        'Stress levels, energy, or mood patterns from recent check-ins',
        'Positive streaks, consistency, or milestones worth celebrating',
        'Nutrition intake, calorie tracking, or meal habits',
        'Hydration levels and daily water intake',
        'Programme progress, weeks completed, or upcoming workouts',
        'Resting heart rate trends or cardiovascular fitness',
        'Body composition changes or bodyweight trends',
        'Overall wellbeing, work-life balance, or mental clarity scores',
      ];
      const selectedTopic = topicCategories[Math.floor(Math.random() * topicCategories.length)];

      const systemPrompt = `You are a proactive digital performance coach built into an executive health and wellness platform called The Paradigm Project. You are opening the chat with the user and need to deliver a brief, personalised opening message based on their current health data, like a trusted coach who has reviewed their file before a meeting.

MANDATORY TOPIC FOR THIS GREETING: ${selectedTopic}
You MUST talk about this topic. Find relevant data from the user's health context below and build your greeting around it. If there is no data for this topic, pick the closest related observation.

CRITICAL RULES:
- Write exactly 1-3 sentences. No more. Be punchy and direct.
- NEVER use em dashes or the character. Use commas, full stops, or shorter sentences instead.
- Reference their ACTUAL data. Be specific with numbers, trends, or observations you can see.
- CRITICAL: For body map/pain data, ONLY use the values labeled "CURRENT severity". Never reference previous/historical severity values as if they are current.
- End with a simple, low-effort question or offer to help. The user should be able to answer with a yes/no or a single tap. Examples: "Want me to walk you through some options?", "Should we look at that together?", "Want to dig into this?", "Need any tweaks to your plan?"
- NEVER ask the user to think like an expert or reflect deeply. Bad examples: "What do you think made the biggest difference?", "How would you describe your recovery?", "What factors do you attribute this to?"
- Sound warm and human, like "Hey ${userName}, [observation]. [simple offer to help]"
- DO NOT list multiple topics. Stick to the mandatory topic above.
- DO NOT use bullet points, numbered lists, or headers.
- DO NOT be generic. If you have their data, use it.
- DO NOT say "I noticed" or "I see that". Just state the insight directly.
- Never give medical advice.
- It is currently ${timeOfDay} on ${dayOfWeek}.

${coachingContext}${userDataContext}${onboardingContext}${crossCoachContext}

Generate the opening message now. Remember: 1-3 sentences, specific, mandatory topic only, ends with engagement.`;

      const response = await analyzeText({
        prompt: systemPrompt,
        maxTokens: 200,
        temperature: 0.9,
      }, config.provider, config.model);

      res.json({ greeting: response.text });
    } catch (error) {
      console.error("Error generating proactive greeting:", error);
      res.status(500).json({ message: "Failed to generate greeting" });
    }
  });

  // ==========================================
  // Coach Conversation History
  // ==========================================

  app.get('/api/coach/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getCoachConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get('/api/coach/conversations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid conversation ID" });
      const conversation = await storage.getCoachConversation(id, userId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });

  app.post('/api/coach/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { title, messages } = req.body;
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ message: "Messages are required" });
      }
      for (const msg of messages) {
        if (!msg.role || !['user', 'assistant'].includes(msg.role) || typeof msg.content !== 'string') {
          return res.status(400).json({ message: "Each message must have a valid role and content" });
        }
      }
      const conversationTitle = typeof title === 'string' && title.trim()
        ? title.slice(0, 60)
        : (messages[0]?.content?.slice(0, 60) || 'New conversation');
      const conversation = await storage.createCoachConversation(userId, conversationTitle, messages);
      res.json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to save conversation" });
    }
  });

  app.put('/api/coach/conversations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid conversation ID" });
      const { messages, title } = req.body;
      if (messages && (!Array.isArray(messages) || messages.length === 0)) {
        return res.status(400).json({ message: "Messages must be a non-empty array" });
      }
      const updateData: { messages?: any[]; title?: string } = {};
      if (messages) updateData.messages = messages;
      if (typeof title === 'string' && title.trim()) updateData.title = title.slice(0, 60);
      const updated = await storage.updateCoachConversation(id, userId, updateData);
      if (!updated) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating conversation:", error);
      res.status(500).json({ message: "Failed to update conversation" });
    }
  });

  app.delete('/api/coach/conversations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid conversation ID" });
      await storage.deleteCoachConversation(id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ message: "Failed to delete conversation" });
    }
  });

  // ==========================================
  // AI Nutrition Insights
  // ==========================================

  app.post('/api/ai/nutrition-insights', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { mode, message } = req.body;

      if (!mode || !['next_meal', 'end_of_day', 'weekly_patterns', 'recipe_suggestions', 'chat'].includes(mode)) {
        return res.status(400).json({ message: "Valid mode required: next_meal, end_of_day, weekly_patterns, recipe_suggestions, chat" });
      }

      const { getCoachingContext, getUserDataContext, getFeatureConfig, analyzeText } = await import('./aiProvider');

      const config = await getFeatureConfig('nutrition');
      if (!config) {
        return res.status(503).json({ message: "AI nutrition coaching is not configured" });
      }

      const coachingContext = await getCoachingContext('nutrition');
      const userDataContext = await getUserDataContext(userId, 'nutrition');

      const user = await storage.getUser(userId);
      const userName = user?.firstName || user?.name?.split(' ')[0] || 'there';

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const hour = today.getHours();

      const timeOfDay = hour < 10 ? 'morning' : hour < 14 ? 'midday' : hour < 18 ? 'afternoon' : 'evening';

      let modePrompt = '';

      if (mode === 'next_meal') {
        modePrompt = `The user wants to know what they should eat next. It is currently ${timeOfDay} (${hour}:00).

Analyze their food intake so far today vs their daily macro and calorie targets. Identify what's remaining (protein, carbs, fat, calories). Then suggest 1-2 specific, practical meal ideas that would help fill the gap.

Rules:
- Be specific with portion sizes and food items (e.g. "200g grilled chicken breast with 150g sweet potato and mixed greens")
- Consider the time of day — don't suggest a heavy dinner at breakfast time
- If they're close to their targets, acknowledge that and suggest a light option or say they're on track
- If they haven't logged anything today, suggest a balanced first meal for the time of day
- Keep it concise — 3-4 sentences max plus the meal suggestion(s)

Respond in this JSON format:
{"summary": "Brief analysis of where they stand today", "suggestions": [{"meal": "Specific meal description", "approxCalories": 450, "approxProtein": 35, "reason": "Why this fills the gap"}], "remainingMacros": {"calories": 800, "protein": 40, "carbs": 60, "fat": 25}}`;
      } else if (mode === 'end_of_day') {
        modePrompt = `Provide an end-of-day nutrition analysis for ${todayStr}.

Review everything the user ate today against their targets. Give honest, constructive feedback with one specific actionable tip for tomorrow.

Rules:
- Acknowledge what they did well first
- Be honest about gaps but not judgmental
- Connect nutrition to their energy, performance, or goals where possible
- One specific, easy-to-implement tip for tomorrow
- Keep it 4-5 sentences max

Respond in this JSON format:
{"grade": "A/B/C/D", "summary": "Overall assessment", "wins": ["What went well"], "improvements": ["What could be better"], "tip": "One actionable tip for tomorrow"}`;
      } else if (mode === 'weekly_patterns') {
        modePrompt = `Analyze the user's nutrition patterns over the past 7 days. Cross-reference with their check-in data (energy, mood, sleep) and workout logs to find meaningful patterns.

Rules:
- Look for correlations (e.g. "days you hit protein target, your energy was higher")
- Identify consistent gaps (e.g. "you tend to under-eat on weekends")
- Connect nutrition to performance and wellbeing outcomes
- Be specific with data points, not vague
- Maximum 3 key insights, each 1-2 sentences

Respond in this JSON format:
{"patterns": [{"insight": "Pattern description", "impact": "How it affects them", "action": "What to do about it"}], "weeklyAverage": {"calories": 2100, "protein": 120}}`;
      } else if (mode === 'recipe_suggestions') {
        modePrompt = `Based on the user's nutrition goals, eating history, and what they tend to enjoy, suggest 3 meal ideas they should try.

Rules:
- Prioritize meals that fill their most common macro gaps
- Consider their dietary preferences and excluded ingredients
- Each suggestion should be practical and specific
- Include approximate macros for each
- Keep descriptions appetizing but brief

Respond in this JSON format:
{"suggestions": [{"name": "Meal name", "description": "Brief appetizing description", "calories": 500, "protein": 40, "carbs": 45, "fat": 15, "reason": "Why this suits them"}]}`;
      } else if (mode === 'chat') {
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
          return res.status(400).json({ message: "A message is required for chat mode" });
        }
        modePrompt = `The user is asking you a nutrition question directly. Answer it thoughtfully using their actual tracking data and goals.

User's question: "${message.trim()}"

Rules:
- Answer their specific question using their real nutrition data
- Be conversational and helpful
- Keep your response concise but thorough (3-6 sentences)
- If the question is outside nutrition, politely redirect to nutrition topics
- Reference their actual data where relevant

Respond in this JSON format:
{"summary": "Your detailed response to their question"}`;
      }

      const systemPrompt = `You are the AI Nutrition Coach for The Paradigm Project, an executive health platform. You provide personalised nutrition insights based on the user's actual tracking data.

CORE RULES:
- Always respond with valid JSON matching the requested format — no markdown, no code fences, just raw JSON
- Never give medical nutrition advice or prescribe diets for medical conditions
- Be practical and actionable — executives are busy, keep it simple
- Reference their actual data, not generic advice
- Use the user's name naturally in the summary
- Be encouraging but honest
${coachingContext}${userDataContext}

The user's name is ${userName}.

${modePrompt}`;

      const response = await analyzeText({
        prompt: systemPrompt,
        maxTokens: 1000,
      }, config.provider, config.model);

      let parsed;
      try {
        const cleaned = response.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { summary: response.text, raw: true };
      }

      res.json({ mode, data: parsed });
    } catch (error) {
      console.error("Error in AI nutrition insights:", error);
      res.status(500).json({ message: "Failed to generate nutrition insights" });
    }
  });

  // ==========================================
  // AI Workout Coach
  // ==========================================

  app.post('/api/ai/workout-coach', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { mode, workoutId } = req.body;

      if (!mode || !['readiness', 'warmup_tips', 'post_workout', 'recovery_tips'].includes(mode)) {
        return res.status(400).json({ message: "Valid mode required: readiness, warmup_tips, post_workout, recovery_tips" });
      }

      const { getCoachingContext, getUserDataContext, getFeatureConfig, analyzeText, getCrossCoachContext } = await import('./aiProvider');

      const config = await getFeatureConfig('workout_adaptation');
      if (!config) {
        return res.status(503).json({ message: "AI workout coaching is not configured" });
      }

      const coachingContext = await getCoachingContext('workout_adaptation');
      const userDataContext = await getUserDataContext(userId, 'workout_adaptation');
      const crossCoachContext = await getCrossCoachContext(userId, 'workout_adaptation');

      const user = await storage.getUser(userId);
      const userName = user?.firstName || user?.name?.split(' ')[0] || 'there';

      let workoutContext = '';
      if (workoutId) {
        try {
          const workout = await storage.getWorkoutById(workoutId);
          if (workout) {
            workoutContext += `\n\nCURRENT WORKOUT: "${workout.title || workout.name}" (${workout.workoutType || 'regular'})`;
            const blocks = await storage.getWorkoutBlocks(workoutId);
            if (blocks && blocks.length > 0) {
              workoutContext += '\nExercises:';
              for (const block of blocks) {
                const exs = (block as any).exercises || [];
                for (const ex of exs) {
                  const sets = ex.sets ? ex.sets.length : 0;
                  workoutContext += `\n- ${ex.exerciseName}${sets ? ` (${sets} sets)` : ''}`;
                }
              }
            }
          }
        } catch {}
      }

      const recentLogs = await storage.getUserWorkoutLogs(userId, 7);
      const weekCount = recentLogs.length;

      let modePrompt = '';

      if (mode === 'readiness') {
        modePrompt = `Assess the user's readiness to train today. Look at their most recent sleep, stress, energy levels from check-ins, resting heart rate, and any active body map pain areas (severity 4+).
${workoutContext}

Give a readiness score out of 10 and a clear recommendation on how to approach today's session.

Rules:
- If readiness is 7+, encourage full intensity with specific workout tips
- If readiness is 4-6, suggest scaling back (reduce volume, lower weights, or swap exercises)
- If readiness is below 4, recommend active recovery or rest
- Reference specific data points (e.g. "your sleep was only 5hrs" or "your stress score was 8/10")
- If they have active pain areas, flag exercises that may aggravate them
- Keep it concise — 3-5 sentences max
- ${weekCount} workouts logged this week so far

Respond in this JSON format:
{"readinessScore": 7, "status": "good_to_go|scale_back|rest_day", "summary": "Brief readiness assessment referencing their data", "flags": ["Any specific concerns"], "recommendation": "What to do today"}`;
      } else if (mode === 'warmup_tips') {
        modePrompt = `The user is about to start their workout and wants pre-workout preparation tips.
${workoutContext}

Provide targeted warm-up advice and focus areas based on their current health data, body map status, and the specific workout they're about to do.

Rules:
- Give 3-4 specific actionable tips tailored to their workout and current condition
- If they have active pain areas, include relevant mobility work
- Reference the specific exercises in their workout to make tips targeted
- Include focus areas (muscle groups or movement patterns to prioritise)
- Keep each tip to 1-2 sentences
- Be practical and time-efficient — executives are busy

Respond in this JSON format:
{"summary": "Brief pre-workout overview referencing their data", "tips": ["Specific actionable tip 1", "Tip 2", "Tip 3"], "focusAreas": ["Key area 1", "Key area 2"]}`;
      } else if (mode === 'post_workout') {
        modePrompt = `Provide post-workout feedback for the user. Review their recent workout history and give brief, encouraging insights.
${workoutContext}

Rules:
- Acknowledge consistency or improvement trends
- Note workout frequency this week (${weekCount} sessions)
- If they're training heavily, mention recovery importance
- If they have active pain areas, remind them about recovery protocols
- Connect their training to their goals if visible
- Keep it motivating but honest — 3-4 sentences max
- One specific actionable tip for next session

Respond in this JSON format:
{"summary": "Brief post-workout feedback", "weeklyProgress": "${weekCount}/5 sessions this week", "streak": "Consistency note", "tip": "One actionable tip for next time", "recoveryNote": "Recovery suggestion if relevant"}`;
      } else if (mode === 'recovery_tips') {
        modePrompt = `The user has completed their workout and wants recovery guidance tailored to what they just did and their current condition.
${workoutContext}

Provide personalised recovery tips based on their workout, active pain areas, stress levels, sleep quality, and training frequency.

Rules:
- Give 3-4 specific recovery actions ranked by priority
- Consider their body map data — if they have active pain areas, prioritise those
- Include timing guidance (e.g. "within the next 2 hours")
- Reference their training frequency (${weekCount} sessions this week)
- Include focus areas for stretching/mobility
- If they're training heavily, flag overtraining risk
- Keep each tip to 1-2 sentences

Respond in this JSON format:
{"summary": "Brief recovery overview based on their session and data", "tips": ["Recovery tip 1 with timing", "Tip 2", "Tip 3"], "focusAreas": ["Stretch area 1", "Mobility focus 2"]}`;
      }

      const systemPrompt = `You are the AI Workout Coach for The Paradigm Project, an executive health platform. You provide personalised training readiness assessments and exercise modifications based on the user's health data.

CORE RULES:
- Always respond with valid JSON matching the requested format — no markdown, no code fences, just raw JSON
- Never prescribe exercises for medical conditions — suggest they consult their practitioner
- Be practical and actionable — executives are busy
- Reference their actual data points, not generic advice
- Use the user's name naturally
- Be encouraging but honest about limitations
${coachingContext}${userDataContext}${crossCoachContext}

The user's name is ${userName}.

${modePrompt}`;

      const response = await analyzeText({
        prompt: systemPrompt,
        maxTokens: 1000,
      }, config.provider, config.model);

      let parsed;
      try {
        const cleaned = response.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { summary: response.text, raw: true };
      }

      res.json({ mode, data: parsed });
    } catch (error) {
      console.error("Error in AI workout coach:", error);
      res.status(500).json({ message: "Failed to generate workout insights" });
    }
  });

  // ==========================================
  // AI Check-in Insights
  // ==========================================

  app.post('/api/ai/check-in-insights', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { mode } = req.body;

      if (!mode || !['trends', 'correlations', 'recommendations'].includes(mode)) {
        return res.status(400).json({ message: "Valid mode required: trends, correlations, recommendations" });
      }

      const { getCoachingContext, getUserDataContext, getFeatureConfig, analyzeText, getCrossCoachContext } = await import('./aiProvider');

      const config = await getFeatureConfig('check_in_insights');
      if (!config) {
        return res.status(503).json({ message: "AI check-in insights is not configured" });
      }

      const coachingContext = await getCoachingContext('check_in_insights');
      const userDataContext = await getUserDataContext(userId, 'check_in_insights');
      const crossCoachContext = await getCrossCoachContext(userId, 'check_in_insights');

      const user = await storage.getUser(userId);
      const userName = user?.firstName || user?.name?.split(' ')[0] || 'there';

      let modePrompt = '';

      if (mode === 'trends') {
        modePrompt = `Analyse the user's check-in data over the past 7-14 days and identify the most important trends in their mood, energy, stress, sleep quality, and mental clarity.

Rules:
- Identify the clearest trend (improving, declining, stable) for each metric
- Highlight the most significant change — what's getting better or worse
- Use specific data points (e.g. "your energy has dropped from 8 to 5 over 4 days")
- If the user has written notes or reflections in their check-ins, reference them to add context to the trends
- If data is limited, acknowledge that and give what insight you can
- Maximum 3 key trends, each 1-2 sentences
- Be honest but constructive

Respond in this JSON format:
{"overallTrend": "improving|declining|stable|mixed", "summary": "One-sentence overall assessment", "trends": [{"metric": "energy|mood|stress|sleep|clarity", "direction": "up|down|stable", "detail": "Specific trend description with data", "severity": "positive|neutral|concerning"}], "bestMetric": "Which metric is strongest", "watchMetric": "Which needs attention"}`;
      } else if (mode === 'correlations') {
        modePrompt = `Cross-reference the user's check-in data with their workout logs, sleep, nutrition, hydration, and body map entries. Find meaningful correlations between their habits and how they feel.

Rules:
- Look for cause-effect patterns (e.g. "days you sleep 7+ hours, your energy averages 8 vs 5 on low sleep days")
- Connect workouts to mood/energy (e.g. "you feel better on days following a workout")
- Note hydration impact on clarity and energy
- Flag stress triggers if visible from data patterns
- If the user has shared notes or reflections, use them to uncover what they were going through on specific days
- Be specific with numbers and dates where possible
- Maximum 3 correlations, each with clear data evidence

Respond in this JSON format:
{"correlations": [{"finding": "What the pattern shows", "evidence": "The data that supports it", "insight": "What this means for the user", "actionable": "What they can do about it"}], "summary": "One-sentence overview of the strongest correlation"}`;
      } else if (mode === 'recommendations') {
        modePrompt = `Based on the user's check-in patterns, workout data, sleep, stress, and overall health trends, provide 3 personalised recommendations for improving their wellbeing this week.

Rules:
- Each recommendation must be tied to their specific data, not generic advice
- Prioritise the most impactful changes first
- Include one quick win (easy to do today), one habit change (this week), and one longer-term suggestion
- Be specific and actionable (not "sleep more" but "aim for 7+ hours by setting a 10:30pm bedtime alarm")
- Reference what's working and build on it
- Consider their workload/stress patterns
- If the user mentioned specific challenges or wins in their notes, address those directly in your recommendations

Respond in this JSON format:
{"recommendations": [{"title": "Short title", "type": "quick_win|habit_change|long_term", "detail": "Specific actionable recommendation", "reason": "Why this matters based on their data", "impact": "Expected benefit"}], "encouragement": "One motivating sentence about their progress"}`;
      }

      const systemPrompt = `You are the AI Wellness Insights Coach for The Paradigm Project, an executive health platform. You analyse check-in and health data to provide personalised wellbeing insights.

CORE RULES:
- Always respond with valid JSON matching the requested format — no markdown, no code fences, just raw JSON
- Never diagnose medical or mental health conditions
- Be practical and actionable — executives are busy
- Reference their actual data points, not generic advice
- Use the user's name naturally
- Be supportive and constructive, never alarmist
${coachingContext}${userDataContext}${crossCoachContext}

The user's name is ${userName}.

${modePrompt}`;

      const response = await analyzeText({
        prompt: systemPrompt,
        maxTokens: 1000,
      }, config.provider, config.model);

      let parsed;
      try {
        const cleaned = response.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { summary: response.text, raw: true };
      }

      res.json({ mode, data: parsed });
    } catch (error) {
      console.error("Error in AI check-in insights:", error);
      res.status(500).json({ message: "Failed to generate check-in insights" });
    }
  });

  // ==========================================
  // AI Feedback (Thumbs Up/Down)
  // ==========================================

  app.post('/api/ai-feedback', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { feature, rating, aiMessage, userMessage, context } = req.body;

      if (!feature || !rating || !aiMessage) {
        return res.status(400).json({ message: "Missing required fields: feature, rating, aiMessage" });
      }
      if (!['positive', 'negative'].includes(rating)) {
        return res.status(400).json({ message: "Rating must be 'positive' or 'negative'" });
      }

      const result = await db.insert(aiFeedback).values({
        userId,
        feature,
        rating,
        aiMessage,
        userMessage: userMessage || null,
        context: context || null,
      }).returning();

      res.json({ success: true, id: result[0]?.id });
    } catch (error) {
      console.error("Error saving AI feedback:", error);
      res.status(500).json({ message: "Failed to save feedback" });
    }
  });

  app.get('/api/admin/ai-feedback', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { feature, rating, limit: limitStr } = req.query;
      const feedbackLimit = Math.min(parseInt(limitStr as string) || 50, 200);

      let query = db.select().from(aiFeedback).orderBy(desc(aiFeedback.createdAt)).limit(feedbackLimit);

      if (feature) {
        query = query.where(eq(aiFeedback.feature, feature as string)) as any;
      }
      if (rating) {
        query = query.where(eq(aiFeedback.rating, rating as string)) as any;
      }

      const results = await query;
      res.json(results);
    } catch (error) {
      console.error("Error fetching AI feedback:", error);
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  // ==========================================
  // AI Recovery Coach (Assessment-Specific)
  // ==========================================

  app.post('/api/recovery-coach/chat', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { message, assessmentContext, conversationHistory = [] } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Message is required" });
      }
      if (message.length > 2000) {
        return res.status(400).json({ message: "Message too long (max 2000 characters)" });
      }

      const { getCoachingContext, getUserDataContext, getFeatureConfig, analyzeText, getCrossCoachContext } = await import('./aiProvider');

      const config = await getFeatureConfig('recovery_coach');
      if (!config) {
        return res.status(503).json({ message: "AI coaching is not configured" });
      }

      const coachingContext = await getCoachingContext('recovery_coach');
      const userDataContext = await getUserDataContext(userId, 'recovery_coach');
      const crossCoachContext = await getCrossCoachContext(userId, 'recovery_coach');

      const user = await storage.getUser(userId);
      const userName = user?.firstName || user?.displayName?.split(' ')[0] || 'there';

      const recentHistory = conversationHistory.slice(-10);
      let historyText = '';
      if (recentHistory.length > 0) {
        historyText = '\n\nCONVERSATION HISTORY:\n' + recentHistory.map((m: any) =>
          `${m.role === 'user' ? 'User' : 'Recovery Coach'}: ${m.content}`
        ).join('\n');
      }

      let assessmentText = '';
      if (assessmentContext) {
        assessmentText = `\n\nCURRENT ASSESSMENT CONTEXT:
- Body area: ${assessmentContext.bodyArea || 'unknown'}${assessmentContext.side ? ` (${assessmentContext.side})` : ''}
- Severity: ${assessmentContext.severity || 'unknown'}/10
- Movement impact: ${assessmentContext.movementImpact || 'unknown'}
- Training impact: ${assessmentContext.trainingImpact || 'unknown'}
- Primary trigger: ${assessmentContext.trigger || 'unknown'}`;

        if (assessmentContext.guidanceContent) {
          const gc = assessmentContext.guidanceContent;
          assessmentText += `\n\nGUIDANCE ALREADY PROVIDED TO USER:
- What's behind this: ${gc.whatsBehindThis || 'N/A'}
- Training guidance: ${gc.trainingGuidance || 'N/A'}
- Daily movement: ${gc.dailyGuidance || 'N/A'}
- Desk tips: ${gc.deskGuidance || 'N/A'}
- Cautions: ${gc.cautions?.join(', ') || 'N/A'}`;
        }
      }

      const systemPrompt = `You are a Recovery Coach within The Paradigm Project executive health platform. You help users understand their body map assessment results and provide personalised recovery guidance.

CORE RECOVERY COACHING RULES:
- Never diagnose or give medical advice — recommend seeing a professional when pain is severe or persistent
- Always prioritise pain-free performance over pushing through discomfort
- Explain WHY certain exercises or adjustments help — educate the user
- Reference the specific body area, severity, and limitations from their assessment
- Be warm, direct, and evidence-based — like a trusted physiotherapist/coach
- Keep responses concise and actionable (3-5 sentences max unless they ask for detail)
- When suggesting exercises or stretches, be specific about form cues
- Connect their current issue to their broader training context when relevant
- If severity is high (7+), emphasise rest and professional consultation
- Use the user's name naturally
${coachingContext}${userDataContext}${crossCoachContext}${assessmentText}

The user's name is ${userName}.${historyText}

User: ${message}

Respond as the Recovery Coach. Reference their specific assessment data and provide personalised, actionable guidance.`;

      const response = await analyzeText({
        prompt: systemPrompt,
        maxTokens: 600,
      }, config.provider, config.model);

      res.json({ response: response.text });
    } catch (error) {
      console.error("Error in recovery coach chat:", error);
      res.status(500).json({ message: "Failed to get recovery coach response" });
    }
  });

  // ===== Burnout Early Warning Routes =====

  app.get("/api/burnout/current", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existing = await storage.getBurnoutScore(userId);
      if (existing) {
        const existingDate = new Date(existing.computedDate);
        existingDate.setHours(0, 0, 0, 0);
        if (existingDate.getTime() === today.getTime()) {
          return res.json(existing);
        }
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const [checkInData, workoutLogData, bodyMapData, sleepData, stepData] = await Promise.all([
        storage.getCheckInsInRange(userId, startDate, endDate),
        storage.getUserWorkoutLogs(userId, 100),
        storage.getBodyMapLogs(userId),
        storage.getSleepEntries(userId, 60),
        storage.getStepEntries(userId, 60),
      ]);

      const result = computeBurnoutScore({
        checkIns: checkInData,
        workoutLogs: workoutLogData,
        bodyMapLogs: bodyMapData,
        sleepEntries: sleepData,
        stepEntries: stepData,
      });

      const saved = await storage.createBurnoutScore({
        userId,
        score: result.score,
        trajectory: result.trajectory,
        confidence: result.confidence,
        topDrivers: result.topDrivers,
        rollingWindowDays: 30,
        computedDate: new Date(),
        checkInCount: result.checkInCount,
        dataSourceCount: result.dataSourceCount,
      });

      trackCalibrationEvent(userId, result.score, result.trajectory, result.dataSourceCount).catch(() => {});

      res.json(saved);
    } catch (error) {
      console.error("Error computing burnout score:", error);
      res.status(500).json({ message: "Failed to compute burnout score" });
    }
  });

  app.get("/api/burnout/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const range = (req.query.range as string) || '1m';

      const endDate = new Date();
      const startDate = new Date();

      switch (range) {
        case '3m': startDate.setMonth(startDate.getMonth() - 3); break;
        case '6m': startDate.setMonth(startDate.getMonth() - 6); break;
        case '1y': startDate.setFullYear(startDate.getFullYear() - 1); break;
        default: startDate.setMonth(startDate.getMonth() - 1); break;
      }

      const history = await storage.getBurnoutScoreHistory(userId, startDate, endDate);
      const currentScore = await storage.getBurnoutScore(userId);
      if (currentScore) {
        const currentDate = new Date(currentScore.computedDate).getTime();
        const lastHistoryDate = history.length > 0 ? new Date(history[history.length - 1].computedDate).getTime() : 0;
        if (currentDate > lastHistoryDate) {
          history.push(currentScore);
        }
      }
      res.json(history);
    } catch (error) {
      console.error("Error fetching burnout history:", error);
      res.status(500).json({ message: "Failed to fetch burnout history" });
    }
  });

  app.get("/api/burnout/monthly-log", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const monthlyLog = await storage.getMonthlyBurnoutLog(userId);
      res.json(monthlyLog);
    } catch (error) {
      console.error("Error fetching monthly burnout log:", error);
      res.status(500).json({ message: "Failed to fetch monthly burnout log" });
    }
  });

  app.post("/api/burnout/recovery-mode", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ message: "enabled must be a boolean" });
      }

      const data: any = {
        recoveryModeEnabled: enabled,
      };

      if (enabled) {
        data.recoveryModeStartedAt = new Date();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        data.recoveryModeExpiresAt = expiresAt;

        const currentScore = await storage.getBurnoutScore(userId);
        if (currentScore) {
          trackRecoveryModeActivation(userId, currentScore.score).catch(() => {});
        }
      } else {
        data.recoveryModeStartedAt = null;
        data.recoveryModeExpiresAt = null;
      }

      const settings = await storage.upsertBurnoutSettings(userId, data);
      res.json(settings);
    } catch (error) {
      console.error("Error toggling recovery mode:", error);
      res.status(500).json({ message: "Failed to toggle recovery mode" });
    }
  });

  app.get("/api/burnout/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const settings = await storage.getBurnoutSettings(userId);
      res.json(settings || {
        recoveryModeEnabled: false,
        recoveryModeStartedAt: null,
        recoveryModeExpiresAt: null,
        alertDismissedAt: null,
      });
    } catch (error) {
      console.error("Error fetching burnout settings:", error);
      res.status(500).json({ message: "Failed to fetch burnout settings" });
    }
  });

  app.get("/api/health-integrations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const integrations = await storage.getHealthIntegrations(userId);
      res.json(integrations);
    } catch (error) {
      console.error("Error fetching health integrations:", error);
      res.status(500).json({ message: "Failed to fetch health integrations" });
    }
  });

  app.post("/api/health-integrations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { provider } = req.body;

      if (!provider || !['apple_health', 'google_health'].includes(provider)) {
        return res.status(400).json({ message: "provider must be 'apple_health' or 'google_health'" });
      }

      const integration = await storage.upsertHealthIntegration(userId, provider, {
        status: 'pending',
      });

      res.json(integration);
    } catch (error) {
      console.error("Error registering health integration:", error);
      res.status(500).json({ message: "Failed to register health integration" });
    }
  });

  // Burnout AI Performance Insight
  app.get("/api/burnout/insight", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const range = (req.query.range as string) || "3m";

      const currentScore = await storage.getBurnoutScore(userId);
      if (!currentScore) {
        return res.json({ insight: null });
      }

      const { getFeatureConfig, analyzeText, getUserDataContext, getCrossCoachContext, getCoachingContext } = await import('./aiProvider');
      const config = await getFeatureConfig('burnout_insight');
      if (!config) {
        return res.json({ insight: null });
      }

      const userDataContext = await getUserDataContext(userId, 'burnout_insight');
      const crossCoachContext = await getCrossCoachContext(userId, 'burnout_insight');
      const coachingContext = await getCoachingContext('burnout_insight');

      const drivers = Array.isArray(currentScore.topDrivers) ? currentScore.topDrivers : [];
      const driverSummary = (drivers as any[]).map((d: any) => `${d.label}: ${d.explanation} (trend: ${d.trend})`).join('. ');

      const settings = await storage.getBurnoutSettings(userId);
      const recoveryModeActive = settings?.recoveryModeEnabled || false;

      const rangeLabels: Record<string, string> = { '1m': '1 month', '3m': '3 months', '6m': '6 months', '1y': '1 year' };
      const rangeLabel = rangeLabels[range] || '3 months';

      const prompt = `${coachingContext}

You are a burnout prevention and performance specialist for a busy executive. Write a calm, intelligent performance insight based on their burnout data.

BURNOUT DATA:
- Current Score: ${currentScore.score}/100 (higher = more burned out)
- Trajectory: ${currentScore.trajectory}
- Confidence: ${currentScore.confidence}
- Time Period Analysed: ${rangeLabel}
- Top Drivers: ${driverSummary || 'Not enough data yet'}
- Check-in Count: ${currentScore.checkInCount}
- Recovery Mode: ${recoveryModeActive ? 'Active' : 'Not active'}

${userDataContext}
${crossCoachContext}

RULES:
1. Write 2-3 short paragraphs in a calm, supportive tone.
2. Reference specific trends from the data (e.g. sleep duration changes, stress patterns, energy levels).
3. End with 1-2 actionable micro-suggestions that are practical for a busy executive.
4. Never say "you are burnt out", "critical", or "danger". Frame everything as patterns and opportunities.
5. Never use em dashes. Use commas or shorter sentences.
6. If Recovery Mode is active, acknowledge it positively and reinforce recovery priorities.
7. Be specific to their data. Do not give generic advice.
8. Keep the total response under 180 words.
9. Do not use bullet points or lists. Write in natural flowing prose.`;

      const aiResult = await analyzeText({
        prompt,
        maxTokens: 400,
        temperature: 0.7,
      }, config.provider, config.model);

      res.json({ insight: aiResult.text });
    } catch (error) {
      console.error("Error generating burnout insight:", error);
      res.json({ insight: null });
    }
  });

  app.get("/api/admin/burnout/calibration-report", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const report = await generateCalibrationReport();
      res.json(report);
    } catch (error) {
      console.error("Error generating calibration report:", error);
      res.status(500).json({ message: "Failed to generate calibration report" });
    }
  });

  app.get("/api/burnout/level-explanation", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentScore = await storage.getBurnoutScore(userId);
      if (!currentScore) {
        return res.json({ explanation: null });
      }

      const { getFeatureConfig, analyzeText } = await import('./aiProvider');
      const config = await getFeatureConfig('burnout_insight');
      if (!config) {
        return res.json({ explanation: null });
      }

      const drivers = Array.isArray(currentScore.topDrivers) ? currentScore.topDrivers : [];
      const driverSummary = (drivers as any[]).map((d: any) => `${d.label}: ${d.explanation} (trend: ${d.trend})`).join('. ');

      const score = currentScore.score;
      let levelName = 'Optimal';
      if (score > 80) levelName = 'Sustained Overload';
      else if (score > 60) levelName = 'Overloaded';
      else if (score > 40) levelName = 'Strained';
      else if (score > 20) levelName = 'Balanced';

      const prompt = `You are a burnout prevention specialist. Write a single personalized sentence (max 30 words) explaining what this person's burnout level means given their specific data.

SCORE: ${score}/100 (level: ${levelName})
TRAJECTORY: ${currentScore.trajectory}
TOP DRIVERS: ${driverSummary || 'Limited data'}

RULES:
1. Reference their specific top driver(s) by name.
2. Frame as an observation, not a diagnosis. Use "your" not "you are".
3. Never use em dashes. Use commas or shorter sentences.
4. Never say "burnout", "burned out", "danger", or "critical".
5. Keep it calm, specific, and actionable in tone.
6. One sentence only. No greeting, no sign-off.`;

      const aiResult = await analyzeText({
        prompt,
        maxTokens: 80,
        temperature: 0.6,
      }, config.provider, config.model);

      res.json({ explanation: aiResult.text?.trim() || null });
    } catch (error) {
      console.error("Error generating level explanation:", error);
      res.json({ explanation: null });
    }
  });

  // Mindfulness Tools - User-facing routes
  app.get('/api/mindfulness', isAuthenticated, async (req: any, res) => {
    try {
      const tools = await storage.getMindfulnessTools();
      res.json(tools.filter(t => t.isActive));
    } catch (error) {
      console.error("Error fetching mindfulness tools:", error);
      res.status(500).json({ message: "Failed to fetch mindfulness tools" });
    }
  });

  app.get('/api/mindfulness/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tool = await storage.getMindfulnessToolById(parseInt(req.params.id));
      if (!tool) return res.status(404).json({ message: "Mindfulness tool not found" });
      res.json(tool);
    } catch (error) {
      console.error("Error fetching mindfulness tool:", error);
      res.status(500).json({ message: "Failed to fetch mindfulness tool" });
    }
  });

  // Mindfulness Tools - Admin CRUD
  app.get('/api/admin/mindfulness', isAuthenticated, async (req: any, res) => {
    try {
      const tools = await storage.getMindfulnessTools();
      res.json(tools);
    } catch (error) {
      console.error("Error fetching mindfulness tools:", error);
      res.status(500).json({ message: "Failed to fetch mindfulness tools" });
    }
  });

  app.post('/api/admin/mindfulness', isAuthenticated, async (req: any, res) => {
    try {
      const validated = insertMindfulnessToolSchema.parse(req.body);
      const tool = await storage.createMindfulnessTool(validated);
      res.json(tool);
    } catch (error) {
      console.error("Error creating mindfulness tool:", error);
      res.status(500).json({ message: "Failed to create mindfulness tool" });
    }
  });

  app.patch('/api/admin/mindfulness/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tool = await storage.updateMindfulnessTool(parseInt(req.params.id), req.body);
      res.json(tool);
    } catch (error) {
      console.error("Error updating mindfulness tool:", error);
      res.status(500).json({ message: "Failed to update mindfulness tool" });
    }
  });

  app.delete('/api/admin/mindfulness/:id', isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteMindfulnessTool(parseInt(req.params.id));
      res.json({ message: "Mindfulness tool deleted" });
    } catch (error) {
      console.error("Error deleting mindfulness tool:", error);
      res.status(500).json({ message: "Failed to delete mindfulness tool" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
