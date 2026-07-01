import { db } from "../server/db";
import { exerciseLibrary } from "../shared/schema";

const targets = [
  "B-Stance BB Glute Bridge w Mini Band",
  "B-Stance Glute Bridge w Mini Band",
  "B-Stance Hip Thrust w Mini Band",
  "Band Bent Over Row - Neutral",
  "Band Bent Over Row - Pronated",
  "Band Bent Over Row - Supinated",
  "Band Seated One Arm Row",
  "Band Split Stance Single Arm Curl",
  "Band Split Stance Single Arm Row",
  "Band Split Stance Single Triceps Extension",
  "Barbell Glute Bridge w Mini Band",
  "Barbell Hip Thrust with Mini Band",
  "Barbell Paused Back Squat",
  "Bosu Ball Frog Pump w Mini Band",
  "Decline Alternating Dumbbell Press",
  "Deficit Barbell Deadlift",
  "Dumbbell Alternating Lunge",
  "Dumbbell Goblet Paused Box Squat",
  "Overhand Machine Row",
  "Quadruped Band Kickback",
  "Seated Alternating Dumbbell Neutral Curl",
  "Side Plank With Cable/Band Row",
  "Straight Arm Side Plank with Band Hold",
];

function tokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
}

async function main() {
  const all = await db
    .select({ name: exerciseLibrary.name })
    .from(exerciseLibrary);

  for (const t of targets) {
    const tt = new Set(tokens(t));
    const scored = all
      .map((r) => {
        const rt = tokens(r.name);
        const overlap = rt.filter((w) => tt.has(w)).length;
        return { name: r.name, score: overlap };
      })
      .filter((x) => x.score >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    console.log("\n" + t);
    if (scored.length === 0) {
      console.log("   (no close match in database)");
    } else {
      scored.forEach((s) => console.log("   => " + s.name));
    }
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
