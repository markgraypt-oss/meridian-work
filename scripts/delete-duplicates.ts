import { db } from "../server/db";
import { exerciseLibrary } from "../shared/schema";
import { sql } from "drizzle-orm";

// First name in each group = preferred spelling (tie-break only).
// Script keeps the most complete row (description + video), re-points any
// programme/workout references onto it, then deletes the rest.
const groups: string[][] = [
  ["Seated Dumbbell Triceps Extension", "Seated Dumbbell Troep Extension"],
  ["Seated Dumbbell Triceps Extension - Pronating", "Seated Dumbbell Troep Extension - Pronating"],
  ["Seated EZ Bar Triceps Extension", "Seated EZ Bar Troep Extension"],
  ["Banded Clamshell", "Banded Clam Shell"],
  ["Clamshell", "Clam Shell"],
  ["Dumbbell Farmers Carry", "Dumbbell Formers Carry"],
  ["Dumbbell Front Rack Carry", "Dumbbell Front Rock Cory"],
  ["Erector Spinae Stretch", "Erector Spinne Stretch"],
  ["EZ Bar Cuban Press", "EZ Bar Cubon Press"],
  ["Feet Elevated Glute Bridge w Band", "Feet Elevated Glute Bridge w Bond"],
  ["Flat EZ Bar Accentuated Eccentric Press", "Flat EZ Bar Accumulated Eccentric Press"],
  ["Floor Seated Rope Face Pull", "Floor Seated Rope Facet Pull"],
  ["McGill Curl Up", "McGil Curl Up"],
  ["Ipsilateral Dead Bug", "Ispilateral Dead Bug"],
  ["Ipsilateral Knee Bent Dead Bug", "Ispilateral Knee Bent Dead Bug"],
  ["Landmine B-Stance Hip Thrust", "Landmine D Stance Hip Thrust"],
  ["Mini Band Bodyweight Bench Press", "Mini Blind Bodyweight Bench Press"],
  ["Mini Band Leg Extension", "Mini Blind Leg Extension"],
  ["Myotatic Crunch", "Mystic Crunch"],
  ["Posterior Chain Mob", "Posterior Chain Moh"],
  ["Prone 'T' - Elbows 90 Degrees", "Prone TT - Elbows 90 Degrees"],
  ["Seated Chin Retractions", "Seated Chain Retractions"],
  ["Shoulder Stretch", "Shoulder Scretch"],
  ["Side Hip Smash - Lacrosse Ball", "Side Hip Snatch - Lacrosse Ball"],
  ["Side Plank Clamshell", "Side Plank Claimshelf"],
  ["Supine Biceps Femoris Stretch", "Supine Biceps Femouris Stretch"],
  ["Toes Elevated Kettlebell RDL", "Toe Elevated Kettlebell RDL"],
  ["Towel Squeezes", "Towel Sequences"],
  ["Trunk Stability Rotation Knees Flexed", "Trunk Stability Rotation Knees Fixed"],
  ["B-Stance Barbell Hip Thrust with Mini Band", "B-Stance BB Hip Thrust with Mini Band"],
  ["Banded Elbow Flexion", "Banded Elbox Flexion"],
  ["Single-Leg RDL - Shin On Bench", "Single Leg RDL - Skin On Bench"],
  ["Single Kettlebell Rack Carry", "Single Kettlebell Rock Carry"],
  ["Kettlebell Suitcase Carry", "Kettlebell Subroos Carry"],
  ["Kettlebell Suitcase Hold", "Kettlebell Subroos Hold"],
  ["Split Stance Cable Single Chest Press", "Split Suance Cable Single Crab Press"],
  ["Sprinter Calf Stretch", "Splitter Calf Stretch"],
  ["Decline EZ Bar Triceps Extension", "Decline E-Z Bar Triceps Extension"],
  ["Heel Elevated Kettlebell Rack Squat", "Heels Elevated Kettlebell Rack Squat"],
  ["Foam Roller - Angles", "Foam Roller - Angels"],
  ["Prone Shoulder External Rotation At 90 Degree", "Prone Shoulder External Rotation At 90 Degrees"],
  ["Overhead Distraction with External Bias", "Overhead Distribution with External"],
  ["Knee Scissor Stack and Smash - Lacrosse", "Knee Scissor Slack and Smash - Lacrosse"],
  ["Barbell Calf Mobilisation", "Barbell Calf Mobilization"],
  ["Dowel Hip Hinge", "Dowell Hip Hinge"],
  ["Dowel Thoracic Extension Rockback", "Dowell Thoracic Extension Rockback"],
  ["Plank Extra-Range Side-Lying Hip Abduction", "Plank Ext Range Side Lying Hip Abduction", "Plank Ext Plank Side Lying Hip"],
  ["Seated One Arm Band Row", "Seated Band One Arm Row"],
  ["Split Stance Single Arm Band Row", "Split Stance Band Single Arm Row"],
  ["Banded Superfrog", "Banded Super Frog"],
  ["Squat Jump", "Squat Jumps"],
  ["Ski Erg", "SkiErg"],
  ["Seated Alternating Neutral Dumbbell Curl", "Seated Alternating Dumbbell Neutral"],
  ["Side Plank"],
  ["Tibialis Raise"],
];

function score(r: { instructions: any; mux: any }): number {
  const t = r.instructions && String(r.instructions).trim().length > 0 ? 1 : 0;
  const v = r.mux && String(r.mux).trim().length > 0 ? 1 : 0;
  return t + v;
}

async function main() {
  // discover every table/column that references exercise_library(id)
  const fkRes: any = await db.execute(sql`
    SELECT tc.table_name AS child_table, kcu.column_name AS child_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'exercise_library' AND ccu.column_name = 'id'
  `);
  const refs: { table: string; column: string }[] = (fkRes.rows ?? fkRes).map((r: any) => ({
    table: r.child_table, column: r.child_column,
  }));
  console.log("Tables referencing exercise_library:", refs.map((r) => `${r.table}.${r.column}`).join(", ") || "(none)");
  console.log("");

  let deleted = 0, repointed = 0;
  const log: string[] = [];
  const failed: string[] = [];

  for (const group of groups) {
    const rows: { id: number; name: string; instructions: any; mux: any }[] = [];
    const seen = new Set<number>();
    for (const n of group) {
      const found = await db
        .select({ id: exerciseLibrary.id, name: exerciseLibrary.name, instructions: exerciseLibrary.instructions, mux: exerciseLibrary.muxPlaybackId })
        .from(exerciseLibrary)
        .where(sql`lower(${exerciseLibrary.name}) = lower(${n})`);
      for (const r of found) if (!seen.has(r.id)) { seen.add(r.id); rows.push(r); }
    }
    if (rows.length <= 1) continue;

    const prefLower = group[0].toLowerCase();
    rows.sort((a, b) => {
      const sd = score(b) - score(a); if (sd !== 0) return sd;
      const pa = a.name.toLowerCase() === prefLower ? 1 : 0;
      const pb = b.name.toLowerCase() === prefLower ? 1 : 0;
      if (pb - pa !== 0) return pb - pa;
      return a.id - b.id;
    });
    const keep = rows[0];
    const remove = rows.slice(1);

    try {
      for (const r of remove) {
        for (const ref of refs) {
          const upd: any = await db.execute(sql`
            UPDATE ${sql.identifier(ref.table)} SET ${sql.identifier(ref.column)} = ${keep.id}
            WHERE ${sql.identifier(ref.column)} = ${r.id}
          `);
          const n = (upd.rowCount ?? upd.rowsAffected ?? 0) as number;
          if (n) repointed += n;
        }
        await db.execute(sql`DELETE FROM exercise_library WHERE id = ${r.id}`);
        deleted++;
      }
      log.push(`KEPT   : ${keep.name}  (desc:${keep.instructions ? "y" : "n"} vid:${keep.mux ? "y" : "n"})`);
      remove.forEach((r) => log.push(`DELETED: ${r.name}  (desc:${r.instructions ? "y" : "n"} vid:${r.mux ? "y" : "n"})`));
      log.push("");
    } catch (e: any) {
      failed.push(`${group.join(" / ")}  ->  ${e.message || e}`);
    }
  }

  log.forEach((l) => console.log(l));
  console.log(`Total deleted: ${deleted}`);
  console.log(`References moved onto kept copies: ${repointed}`);
  if (failed.length) {
    console.log(`\nSkipped (kept both, needs a manual look):`);
    failed.forEach((f) => console.log("  " + f));
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
