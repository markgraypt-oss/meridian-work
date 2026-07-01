import { db } from "../server/db";
import { exerciseLibrary } from "../shared/schema";
import { sql } from "drizzle-orm";

async function main() {
  const rows = await db
    .select({ name: exerciseLibrary.name })
    .from(exerciseLibrary)
    .where(sql`(${exerciseLibrary.instructions} IS NULL OR trim(${exerciseLibrary.instructions}) = '')
              AND ${exerciseLibrary.muxPlaybackId} IS NOT NULL
              AND trim(${exerciseLibrary.muxPlaybackId}) <> ''`);
  console.log(`EMPTY DESCRIPTION BUT HAS VIDEO: ${rows.length}\n`);
  rows.sort((a, b) => a.name.localeCompare(b.name)).forEach((r) => console.log(r.name));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
