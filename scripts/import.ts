import { db } from "../server/db";
import { exerciseLibrary } from "../shared/schema";
import { sql } from "drizzle-orm";
import { readFileSync } from "fs";
const D = JSON.parse(readFileSync("scripts/data.json", "utf-8"));
const EX = Array.isArray(D) ? D : D.exercises;
async function main() {
  await db.execute(sql`SELECT setval('exercise_library_id_seq', (SELECT MAX(id) FROM exercise_library))`);
  const cur = await db.select({ name: exerciseLibrary.name }).from(exerciseLibrary);
  const have = new Set(cur.map(e => e.name.toLowerCase()));
  const rows = EX.filter((e:any) => e.name && !have.has(e.name.toLowerCase())).map((e:any) => ({
    name: e.name, instructions: e.description || null,
    mainMuscle: e.mainMuscle || [], equipment: e.equipment || [], movement: e.movement || [], mechanics: e.mechanics || [],
    level: e.level || null, exerciseType: e.exerciseType || "strength", laterality: e.laterality || "bilateral",
  }));
  console.log(`${EX.length} in file, inserting ${rows.length}...`);
  if (!rows.length) { console.log("Nothing to insert."); process.exit(0); }
  const ins = await db.insert(exerciseLibrary).values(rows).returning({ id: exerciseLibrary.id });
  console.log(`Inserted ${ins.length} exercises.`); process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
