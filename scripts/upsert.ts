import { db } from "../server/db";
import { exerciseLibrary } from "../shared/schema";
import { sql, eq } from "drizzle-orm";
import { readFileSync } from "fs";
const EX = JSON.parse(readFileSync("scripts/data.json", "utf-8"));
async function main() {
  const cur = await db.select({ id: exerciseLibrary.id, name: exerciseLibrary.name }).from(exerciseLibrary);
  const byName = new Map(cur.map(e => [e.name.toLowerCase(), e.id]));
  let updated = 0, inserted = 0;
  for (const e of EX) {
    if (!e.name) continue;
    const fields = {
      instructions: e.description || null,
      mainMuscle: e.mainMuscle || [], equipment: e.equipment || [], movement: e.movement || [], mechanics: e.mechanics || [],
      level: e.level || null, exerciseType: e.exerciseType || "strength", laterality: e.laterality || "bilateral",
    };
    const id = byName.get(e.name.toLowerCase());
    if (id) { await db.update(exerciseLibrary).set(fields).where(eq(exerciseLibrary.id, id)); updated++; }
    else { await db.insert(exerciseLibrary).values({ name: e.name, ...fields }); inserted++; }
  }
  console.log(`Updated ${updated}, inserted ${inserted}.`); process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
