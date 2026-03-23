import { db } from "./db";
import { programs, programWeeks, programDays, programmeWorkouts, programmeWorkoutBlocks, programmeBlockExercises, exerciseLibrary } from "@shared/schema";
import { eq, asc, inArray } from "drizzle-orm";

export type ProgrammeEquipmentLevel =
  | "no_equipment"
  | "bodyweight"
  | "bands_only"
  | "kettlebell_only"
  | "dumbbell_only"
  | "db_bench_only"
  | "full_gym";

const EQUIPMENT_TIER: Record<string, number> = {
  "Bodyweight": 2,
  "Box/Step": 2,
  "Swiss Ball": 2,
  "TRX": 2,
  "Band": 3,
  "Long Band": 3,
  "Short Band": 3,
  "Kettlebell": 4,
  "Dumbbell": 5,
  "Bench": 6,
  "Cable": 7,
  "Barbell": 7,
  "EZ Bar": 7,
  "Landmine": 7,
  "Medicine Ball": 7,
  "Bosu Ball": 7,
  "Plate": 0,
  "Foam Roller": 0,
  "Lacrosse Ball": 0,
};

const TIER_TO_LEVEL: Record<number, ProgrammeEquipmentLevel> = {
  0: "no_equipment",
  1: "no_equipment",
  2: "bodyweight",
  3: "bands_only",
  4: "kettlebell_only",
  5: "dumbbell_only",
  6: "db_bench_only",
  7: "full_gym",
};

export const EQUIPMENT_LEVEL_LABELS: Record<ProgrammeEquipmentLevel, string> = {
  no_equipment: "No Equipment (At Home)",
  bodyweight: "Bodyweight",
  bands_only: "Bands Only",
  kettlebell_only: "Kettlebell Only",
  dumbbell_only: "Dumbbell Only",
  db_bench_only: "DB/Bench Only",
  full_gym: "Full Gym",
};

export const EQUIPMENT_LEVEL_ORDER: ProgrammeEquipmentLevel[] = [
  "no_equipment",
  "bodyweight",
  "bands_only",
  "kettlebell_only",
  "dumbbell_only",
  "db_bench_only",
  "full_gym",
];

function getEquipmentTier(item: string): number {
  return EQUIPMENT_TIER[item] ?? 7;
}

function tierToLevel(tier: number): ProgrammeEquipmentLevel {
  return TIER_TO_LEVEL[tier] ?? "full_gym";
}

export async function calculateProgramEquipment(programId: number): Promise<{
  level: ProgrammeEquipmentLevel;
  allEquipment: string[];
  highestTier: number;
}> {
  const weeks = await db.select({ id: programWeeks.id })
    .from(programWeeks)
    .where(eq(programWeeks.programId, programId));

  if (weeks.length === 0) {
    return { level: "no_equipment", allEquipment: [], highestTier: 0 };
  }

  const weekIds = weeks.map(w => w.id);

  const days = await db.select({ id: programDays.id })
    .from(programDays)
    .where(inArray(programDays.weekId, weekIds));

  if (days.length === 0) {
    return { level: "no_equipment", allEquipment: [], highestTier: 0 };
  }

  const dayIds = days.map(d => d.id);

  const workouts = await db.select({ id: programmeWorkouts.id })
    .from(programmeWorkouts)
    .where(inArray(programmeWorkouts.dayId, dayIds));

  if (workouts.length === 0) {
    return { level: "no_equipment", allEquipment: [], highestTier: 0 };
  }

  const workoutIds = workouts.map(w => w.id);

  const blocks = await db.select({ id: programmeWorkoutBlocks.id })
    .from(programmeWorkoutBlocks)
    .where(inArray(programmeWorkoutBlocks.workoutId, workoutIds));

  if (blocks.length === 0) {
    return { level: "no_equipment", allEquipment: [], highestTier: 0 };
  }

  const blockIds = blocks.map(b => b.id);

  const exercises = await db.select({
    exerciseLibraryId: programmeBlockExercises.exerciseLibraryId,
  })
    .from(programmeBlockExercises)
    .where(inArray(programmeBlockExercises.blockId, blockIds));

  const exerciseLibIds = exercises
    .map(e => e.exerciseLibraryId)
    .filter((id): id is number => id !== null);

  if (exerciseLibIds.length === 0) {
    return { level: "no_equipment", allEquipment: [], highestTier: 0 };
  }

  const uniqueIds = Array.from(new Set(exerciseLibIds));
  const libraryExercises = await db.select({
    id: exerciseLibrary.id,
    equipment: exerciseLibrary.equipment,
  })
    .from(exerciseLibrary)
    .where(inArray(exerciseLibrary.id, uniqueIds));

  const allEquipmentSet = new Set<string>();
  let highestTier = 0;

  for (const ex of libraryExercises) {
    const equipArray = ex.equipment || [];
    for (const item of equipArray) {
      if (!item) continue;
      allEquipmentSet.add(item);
      const tier = getEquipmentTier(item);
      if (tier > highestTier) {
        highestTier = tier;
      }
    }
  }

  if (allEquipmentSet.size === 0 || highestTier === 0) {
    return { level: "no_equipment", allEquipment: [], highestTier: 0 };
  }

  return {
    level: tierToLevel(highestTier),
    allEquipment: Array.from(allEquipmentSet).sort(),
    highestTier,
  };
}

export async function updateProgramEquipmentAuto(programId: number): Promise<ProgrammeEquipmentLevel | null> {
  const result = await calculateProgramEquipment(programId);
  
  if (result.allEquipment.length === 0) {
    return null;
  }
  
  await db.update(programs)
    .set({ equipment: result.level })
    .where(eq(programs.id, programId));

  return result.level;
}
