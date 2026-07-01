import { db } from "../server/db";
import { exerciseLibrary } from "../shared/schema";
import { eq, isNotNull } from "drizzle-orm";
function strip(t: string): string {
  return t.split("\n").map(line =>
    line.replace(/^\s*\d+\s*[\.\)\-:]?\s+/, "").replace(/^\s*\d+\s*$/, "")
  ).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
async function main() {
  const rows = await db.select({ id: exerciseLibrary.id, instructions: exerciseLibrary.instructions })
    .from(exerciseLibrary).where(isNotNull(exerciseLibrary.instructions));
  let changed = 0;
  for (const r of rows) {
    const s = strip(r.instructions || "");
    if (s !== (r.instructions || "")) { await db.update(exerciseLibrary).set({ instructions: s }).where(eq(exerciseLibrary.id, r.id)); changed++; }
  }
  console.log(`Stripped leading numbers on ${changed} exercises.`); process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
