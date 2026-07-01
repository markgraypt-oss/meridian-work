import { db } from "../server/db";
import { exerciseLibrary } from "../shared/schema";
import { sql } from "drizzle-orm";
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
  const data = JSON.parse(
    readFileSync(
      join(process.cwd(), "scripts", "exercise-instructions-cleaned.json"),
      "utf8"
    )
  ) as Record<string, string>;

  const entries = Object.entries(data);
  console.log(`Loaded ${entries.length} cleaned descriptions.`);

  let updated = 0;
  let notFound: string[] = [];

  for (const [name, instructions] of entries) {
    const res = await db
      .update(exerciseLibrary)
      .set({ instructions })
      .where(sql`lower(${exerciseLibrary.name}) = lower(${name})`)
      .returning({ id: exerciseLibrary.id });

    if (res.length > 0) {
      updated += res.length;
    } else {
      notFound.push(name);
    }
  }

  console.log(`Updated ${updated} exercises.`);
  if (notFound.length) {
    console.log(`No match for ${notFound.length} names:`);
    notFound.forEach((n) => console.log("  " + n));
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
