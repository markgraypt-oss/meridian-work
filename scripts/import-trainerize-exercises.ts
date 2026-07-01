import { db } from "../server/db";
import { exerciseLibrary } from "../shared/schema";
import { sql } from "drizzle-orm";
import { readFileSync } from "fs";
import { join } from "path";

type Row = { name: string; description?: string; exerciseType?: string; level?: string; laterality?: string; mainMuscle?: string[]; equipment?: string[]; movement?: string[]; mechanics?: string[]; };

const DATA: Row[] = JSON.parse(readFileSync(join(process.cwd(), "scripts/meridian-exercises-tagged.json"), "utf-8"));

async function main() {
  await db.execute(sql`SELECT setval('exercise_library_id_seq', (SELECT MAX(id) FROM exercise_library))`);
  const existing = await db.select({ name: exerciseLibrary.name }).from(exerciseLibrary);
  const existingNames = new Set(existing.map(e => e.name.toLowerCase()));
  const toInsert = DATA.filter(e => e.name && !existingNames.has(e.name.toLowerCase())).map(e => ({
    name: e.name, instructions: e.description || null,
    mainMuscle: e.mainMuscle || [], equipment: e.equipment || [], movement: e.movement || [], mechanics: e.mechanics || [],
    level: e.level || null, exerciseType: e.exerciseType || "strength", laterality: e.laterality || "bilateral",
  }));
  console.log(`${DATA.length} in file, ${DATA.length - toInsert.length} skipped, inserting ${toInsert.length}...`);
  if (toInsert.length === 0) { console.log("Nothing to insert."); process.exit(0); }
  const inserted = await db.insert(exerciseLibrary).values(toInsert as any).returning({ id: exerciseLibrary.id, name: exerciseLibrary.name });
  console.log(`Inserted ${inserted.length} exercises successfully.`);
  process.exit(0);
}
main().catch(err => { console.error(err); process.exit(1); });
