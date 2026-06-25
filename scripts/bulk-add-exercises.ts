import { db } from "../server/db";
import { exerciseLibrary } from "../shared/schema";
import { sql } from "drizzle-orm";

const BULK_EXERCISES = [
  { name: "Treadmill", mainMuscle: ["Quads", "Hamstrings", "Calves", "Glutes"], equipment: ["Machine"], movement: ["Cardio"], mechanics: ["Compound"], level: "Beginner", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Skillmill", mainMuscle: ["Quads", "Hamstrings", "Calves", "Glutes"], equipment: ["Machine"], movement: ["Cardio"], mechanics: ["Compound"], level: "Beginner", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Assault Bike", mainMuscle: ["Quads", "Hamstrings", "Shoulders", "Lats"], equipment: ["Machine"], movement: ["Cardio"], mechanics: ["Compound"], level: "Beginner", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Echo Bike", mainMuscle: ["Quads", "Hamstrings", "Shoulders", "Lats"], equipment: ["Machine"], movement: ["Cardio"], mechanics: ["Compound"], level: "Beginner", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Rower", mainMuscle: ["Lats", "Middle Back", "Hamstrings", "Glutes", "Quads", "Biceps"], equipment: ["Machine"], movement: ["Cardio"], mechanics: ["Compound"], level: "Beginner", exerciseType: "cardio", laterality: "bilateral" },
  { name: "SkiErg", mainMuscle: ["Lats", "Triceps", "Shoulders", "Abs"], equipment: ["Machine"], movement: ["Cardio"], mechanics: ["Compound"], level: "Beginner", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Stairmaster", mainMuscle: ["Quads", "Glutes", "Calves", "Hamstrings"], equipment: ["Machine"], movement: ["Cardio"], mechanics: ["Compound"], level: "Beginner", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Versaclimber", mainMuscle: ["Quads", "Glutes", "Lats", "Shoulders", "Calves"], equipment: ["Machine"], movement: ["Cardio"], mechanics: ["Compound"], level: "Intermediate", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Spin Bike", mainMuscle: ["Quads", "Hamstrings", "Glutes", "Calves"], equipment: ["Machine"], movement: ["Cardio"], mechanics: ["Compound"], level: "Beginner", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Elliptical", mainMuscle: ["Quads", "Hamstrings", "Glutes", "Calves", "Chest"], equipment: ["Machine"], movement: ["Cardio"], mechanics: ["Compound"], level: "Beginner", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Burpee", mainMuscle: ["Chest", "Triceps", "Quads", "Glutes"], equipment: ["Bodyweight"], movement: ["Cardio", "Plyometrics"], mechanics: ["Compound"], level: "Intermediate", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Burpee Over Bar", mainMuscle: ["Chest", "Triceps", "Quads", "Glutes"], equipment: ["Bodyweight", "Barbell"], movement: ["Cardio", "Plyometrics"], mechanics: ["Compound"], level: "Intermediate", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Jumping Jacks", mainMuscle: ["Shoulders", "Calves", "Quads"], equipment: ["Bodyweight"], movement: ["Cardio"], mechanics: ["Compound"], level: "Beginner", exerciseType: "cardio", laterality: "bilateral" },
  { name: "High Knees", mainMuscle: ["Quads", "Hip Flexor", "Calves"], equipment: ["Bodyweight"], movement: ["Cardio"], mechanics: ["Compound"], level: "Beginner", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Mountain Climbers", mainMuscle: ["Abs", "Hip Flexor", "Shoulders"], equipment: ["Bodyweight"], movement: ["Cardio"], mechanics: ["Compound"], level: "Beginner", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Squat Jumps", mainMuscle: ["Quads", "Glutes", "Calves"], equipment: ["Bodyweight"], movement: ["Cardio", "Plyometrics"], mechanics: ["Compound"], level: "Intermediate", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Tuck Jumps", mainMuscle: ["Quads", "Glutes", "Calves", "Hip Flexor"], equipment: ["Bodyweight"], movement: ["Cardio", "Plyometrics"], mechanics: ["Compound"], level: "Advanced", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Skater Jumps", mainMuscle: ["Quads", "Glutes", "Adductors", "Abductors"], equipment: ["Bodyweight"], movement: ["Cardio", "Plyometrics"], mechanics: ["Compound"], level: "Intermediate", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Star Jumps", mainMuscle: ["Quads", "Shoulders", "Calves"], equipment: ["Bodyweight"], movement: ["Cardio", "Plyometrics"], mechanics: ["Compound"], level: "Intermediate", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Bear Crawl", mainMuscle: ["Shoulders", "Abs", "Quads", "Triceps"], equipment: ["Bodyweight"], movement: ["Cardio"], mechanics: ["Compound"], level: "Intermediate", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Crab Walk", mainMuscle: ["Triceps", "Glutes", "Shoulders", "Hamstrings"], equipment: ["Bodyweight"], movement: ["Cardio"], mechanics: ["Compound"], level: "Intermediate", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Inchworm", mainMuscle: ["Hamstrings", "Shoulders", "Abs"], equipment: ["Bodyweight"], movement: ["Cardio"], mechanics: ["Compound"], level: "Intermediate", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Battle Rope", mainMuscle: ["Shoulders", "Lats", "Forearms", "Abs"], equipment: [], movement: ["Cardio"], mechanics: ["Compound"], level: "Intermediate", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Sled Push", mainMuscle: ["Quads", "Glutes", "Calves", "Shoulders"], equipment: [], movement: ["Cardio"], mechanics: ["Compound"], level: "Intermediate", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Sled Pull", mainMuscle: ["Hamstrings", "Glutes", "Lats", "Forearms"], equipment: [], movement: ["Cardio"], mechanics: ["Compound"], level: "Intermediate", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Sled Drag", mainMuscle: ["Quads", "Glutes", "Hamstrings"], equipment: [], movement: ["Cardio"], mechanics: ["Compound"], level: "Intermediate", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Box Step-Up", mainMuscle: ["Quads", "Glutes", "Hamstrings", "Calves"], equipment: ["Box/Step"], movement: ["Cardio"], mechanics: ["Compound"], level: "Beginner", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Wall Ball", mainMuscle: ["Quads", "Glutes", "Shoulders", "Chest"], equipment: ["Medicine Ball"], movement: ["Cardio"], mechanics: ["Compound"], level: "Intermediate", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Jump Rope Single Under", mainMuscle: ["Calves", "Shoulders", "Forearms"], equipment: [], movement: ["Cardio", "Plyometrics"], mechanics: ["Compound"], level: "Beginner", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Jump Rope Double Under", mainMuscle: ["Calves", "Shoulders", "Forearms"], equipment: [], movement: ["Cardio", "Plyometrics"], mechanics: ["Compound"], level: "Intermediate", exerciseType: "cardio", laterality: "bilateral" },
  { name: "Jump Rope Crossover", mainMuscle: ["Calves", "Shoulders", "Forearms"], equipment: [], movement: ["Cardio", "Plyometrics"], mechanics: ["Compound"], level: "Advanced", exerciseType: "cardio", laterality: "bilateral" },
];

async function main() {
  console.log("Resetting id sequence...");
  await db.execute(sql`SELECT setval('exercise_library_id_seq', (SELECT MAX(id) FROM exercise_library))`);

  const existing = await db.select({ name: exerciseLibrary.name }).from(exerciseLibrary);
  const existingNames = new Set(existing.map(e => e.name.toLowerCase()));

  const toInsert = BULK_EXERCISES.filter(e => !existingNames.has(e.name.toLowerCase()));
  const skipped = BULK_EXERCISES.filter(e => existingNames.has(e.name.toLowerCase()));

  if (skipped.length > 0) {
    console.log(`Skipping ${skipped.length} (already exist):`);
    skipped.forEach(e => console.log(`  - ${e.name}`));
  }

  if (toInsert.length === 0) {
    console.log("Nothing to insert.");
    process.exit(0);
  }

  console.log(`\nInserting ${toInsert.length} exercises...`);
  const inserted = await db.insert(exerciseLibrary).values(toInsert as any).returning({ id: exerciseLibrary.id, name: exerciseLibrary.name });
  console.log(`\nInserted ${inserted.length} exercises successfully.`);
  inserted.forEach(e => console.log(`  - ${e.id}: ${e.name}`));
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
