import { db } from "../server/db";
import { exerciseLibrary } from "../shared/schema";
import { sql, eq } from "drizzle-orm";
import { readFileSync } from "fs";
import { join } from "path";

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2013\u2014\u2212]/g, "-") // en/em/minus dashes -> hyphen
    .replace(/[''‘’`"]/g, "")             // quotes/apostrophes
    .replace(/\*/g, "")                    // asterisks
    .replace(/\bw\/?\b/g, "with")          // w or w/ -> with
    .replace(/[\/\-]/g, " ")               // slashes & hyphens -> space
    .replace(/[.]/g, "")                   // dots
    .replace(/[^a-z0-9 ]/g, "")            // any other punctuation
    .replace(/\s+/g, " ")                   // collapse whitespace
    .trim();
}

async function main() {
  const data = JSON.parse(
    readFileSync(
      join(process.cwd(), "scripts", "exercise-instructions-cleaned.json"),
      "utf8"
    )
  ) as Record<string, string>;

  // pull every name+id from the DB once
  const all = await db
    .select({ id: exerciseLibrary.id, name: exerciseLibrary.name })
    .from(exerciseLibrary);

  const byNorm = new Map<string, { id: any; name: string }[]>();
  for (const row of all) {
    const k = norm(row.name);
    if (!byNorm.has(k)) byNorm.set(k, []);
    byNorm.get(k)!.push(row);
  }

  let updated = 0;
  const ambiguous: string[] = [];
  const stillMissing: string[] = [];

  for (const [name, instructions] of Object.entries(data)) {
    const matches = byNorm.get(norm(name)) || [];
    if (matches.length === 1) {
      await db
        .update(exerciseLibrary)
        .set({ instructions })
        .where(eq(exerciseLibrary.id, matches[0].id));
      updated++;
    } else if (matches.length > 1) {
      ambiguous.push(name + "  ->  " + matches.map((m) => m.name).join(" | "));
    } else {
      stillMissing.push(name);
    }
  }

  console.log(`Updated ${updated} exercises.`);
  if (ambiguous.length) {
    console.log(`\nAmbiguous (more than one possible match), skipped:`);
    ambiguous.forEach((a) => console.log("  " + a));
  }
  if (stillMissing.length) {
    console.log(`\nStill no match in your database:`);
    stillMissing.forEach((n) => console.log("  " + n));
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
