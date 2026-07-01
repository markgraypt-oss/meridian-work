import { db } from "../server/db";
import { exerciseLibrary } from "../shared/schema";
import { sql } from "drizzle-orm";

async function main() {
  const rows = await db
    .select({ name: exerciseLibrary.name, mux: exerciseLibrary.muxPlaybackId })
    .from(exerciseLibrary)
    .where(sql`${exerciseLibrary.instructions} IS NULL OR trim(${exerciseLibrary.instructions}) = ''`);

  // bucket by keyword. first match wins, order matters.
  const buckets: [string, RegExp][] = [
    ["Cardio machines", /\b(treadmill|deadmill|assault bike|echo bike|spin bike|elliptical|rower|row erg|sit erg|ski ?erg|stairmaster|versaclimber|skillmill|battle rope)\b/i],
    ["Foam roller", /foam roller/i],
    ["Lacrosse ball / soft-tissue release", /lacrosse|smash|floss|scrub|smr|manual release|peanut|tack and twist/i],
    ["Stretches", /stretch|mobilis|mobiliz|opener|couch|pigeon|cobra|cat cow|brettzel|figure 4|figure four|frog|hip flexor|thread the needle|salutation|worlds greatest/i],
    ["Plyometric / jumps", /jump|hop|pogo|skater|burpee|bound|depth drop|box jump|ball slam|wall ball/i],
    ["Core / planks / crunches", /plank|crunch|dead bug|deadbug|flutter|hollow|russian twist|bicycle|knee to elbow|sit ?up|leg raise|knees to/i],
    ["Carries & holds", /carry|hold|suitcase|farmer|former|rack carry|subroos|front rack/i],
    ["Calf / ankle / foot", /calf|ankle|tibialis|talus|foot doming|heel raise|plantar|dorsiflex/i],
    ["Bands / mini-band drills", /band|mini blind|clam|w's/i],
    ["Pull-ups / dips / bodyweight", /pull up|pull-up|chin up|chin-up|dip|dead hang|inchworm|bear crawl|crab walk|monkey bar|push-?up|push up/i],
    ["Kettlebell", /kettlebell|\bkb\b/i],
    ["Barbell", /barbell|trap bar|\bbb\b/i],
    ["Dumbbell", /dumbbell|\bdb\b/i],
    ["Cable / machine / TRX", /cable|machine|trx|pulldown|pulley|lat pulldown|hack squat|leg press|smith/i],
    ["Neck / wrist / shoulder small drills", /neck|wrist|shoulder|scapular|chin tuck|retraction|cuban|serratus|raise/i],
  ];

  const out = new Map<string, { name: string; mux: any }[]>();
  const other: { name: string; mux: any }[] = [];
  for (const r of rows) {
    let placed = false;
    for (const [label, re] of buckets) {
      if (re.test(r.name)) { (out.get(label) ?? out.set(label, []).get(label)!).push(r); placed = true; break; }
    }
    if (!placed) other.push(r);
  }

  const order = buckets.map((b) => b[0]);
  console.log(`TOTAL EMPTY: ${rows.length}\n`);
  for (const label of order) {
    const list = out.get(label);
    if (!list || !list.length) continue;
    const withVid = list.filter((x) => x.mux).length;
    console.log(`\n### ${label}  (${list.length}, ${withVid} have a video)`);
    list.sort((a, b) => a.name.localeCompare(b.name)).forEach((x) => console.log(`   ${x.mux ? "[video] " : "        "}${x.name}`));
  }
  if (other.length) {
    const withVid = other.filter((x) => x.mux).length;
    console.log(`\n### Other / uncategorised  (${other.length}, ${withVid} have a video)`);
    other.sort((a, b) => a.name.localeCompare(b.name)).forEach((x) => console.log(`   ${x.mux ? "[video] " : "        "}${x.name}`));
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
