/**
 * WWI showcase company seeder.
 *
 * Creates a fictional 200-person company, "Kestrelmoor Group", with six months of
 * check-ins, body-map logs and burnout scores, so the Workforce Wellbeing Index
 * shows a believable picture for website screenshots: a team that started Strained
 * in June and has improved to Mixed by November.
 *
 * Touches nothing outside its own 200 user ids (kmg-001 to kmg-200).
 * The users have no lastActiveAt, no firstLoginAt and .invalid emails, so no
 * briefings, push notifications, weekly check-in emails or AI generation run for them.
 *
 * Live database: seeded automatically by the deployed server on start-up
 * (seedWwiShowcaseOnce, called from index.ts), once per database.
 * Preview numbers only:  cd artifacts/api-server && npx tsx src/seedWwiShowcase.ts --dry-run
 *
 * Deterministic: a fixed random seed means every run produces the same people and
 * the same pattern. Re-running clears the company's old activity first.
 */

const COMPANY = "Kestrelmoor Group";
const NUM_USERS = 200;
const DAYS = 183; // about six months back from today
const DRY_RUN = process.argv.includes("--dry-run");
const TEARDOWN = process.argv.includes("--teardown");

// ---- Deterministic random ----
let seed = 20261114;
function rand(): number {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const chance = (p: number) => rand() < p;
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]!;
function gauss(mean = 0, sd = 1): number {
  const u = Math.max(rand(), 1e-9), v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function weighted<T>(items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of items) { if ((r -= w) <= 0) return v; }
  return items[items.length - 1]![0];
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ---- Time ----
const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
function daysAgo(d: number, hour = 9): Date {
  const x = new Date(now.getTime() - d * DAY);
  x.setHours(hour, ri(0, 59), 0, 0);
  return x;
}
// 0 at the start of the six months, 1 today.
const progress = (d: number) => 1 - d / DAYS;

// Team health on a 0-100 scale, d days ago. Rises from about 49 to 66, with a
// small dip in early September.
function teamHealth(d: number): number {
  const p = progress(d);
  const dip = -3 * Math.exp(-Math.pow((d - 70) / 12, 2));
  return 49 + 17 * p + dip;
}

// ---- People ----
const FIRST = ["Oliver", "Amelia", "George", "Isla", "Harry", "Ava", "Jack", "Mia", "Charlie", "Grace", "Thomas", "Sophie", "James", "Emily", "William", "Lucy", "Henry", "Ella", "Daniel", "Chloe", "Samuel", "Hannah", "Joseph", "Ruby", "Matthew", "Freya", "Ryan", "Holly", "Conor", "Aoife", "Sean", "Niamh", "Liam", "Ciara", "Patrick", "Siobhan", "Priya", "Arjun", "Fatima", "Omar", "Zara", "Yusuf", "Anna", "Tom", "Katie", "Ben", "Laura", "Adam", "Rachel", "Michael"];
const LAST = ["Smith", "Jones", "Taylor", "Brown", "Williams", "Wilson", "Evans", "Thomas", "Roberts", "Walker", "Wright", "Hughes", "Green", "Hall", "Wood", "Clarke", "Murphy", "Kelly", "O'Brien", "Byrne", "Ryan", "Walsh", "Doyle", "McCarthy", "Patel", "Khan", "Shah", "Ali", "Campbell", "Stewart", "Morris", "Cooper", "Ward", "King", "Baker", "Turner", "Hill", "Moore", "Lewis", "Harris"];

type Person = {
  id: string; firstName: string; lastName: string;
  offset: number;           // personal health offset, in health points
  checkInRate: number;      // chance of a weekday check-in when active
  logsBodyMap: boolean;
  chronicPain: boolean;
  area: string;
  burnoutBase: number;
  phase: number;            // day offset for fortnightly burnout scores
};

const AREAS: [string, number][] = [["lower_back", 35], ["neck", 20], ["shoulder", 15], ["upper_back", 10], ["wrist", 8], ["knee", 7], ["hip", 5]];
const VIEW: Record<string, string> = { lower_back: "back", neck: "back", upper_back: "back", shoulder: "front", wrist: "front", knee: "front", hip: "front" };

const people: Person[] = Array.from({ length: NUM_USERS }, (_, i) => {
  const burnoutGroup = weighted<[number, number]>([[[36, 12], 70], [[56, 9], 21], [[70, 7], 9]]);
  return {
    id: `kmg-${String(i + 1).padStart(3, "0")}`,
    firstName: pick(FIRST),
    lastName: pick(LAST),
    offset: gauss(0, 6),
    checkInRate: 0.22 + rand() * 0.38,
    logsBodyMap: chance(0.68),
    chronicPain: chance(0.4),
    area: weighted(AREAS),
    burnoutBase: gauss(burnoutGroup[0], burnoutGroup[1]),
    phase: ri(0, 13),
  };
});

// ---- Generate activity ----
const score15 = (target: number) => clamp(Math.round(target + gauss(0, 0.75)), 1, 5);
const pos = (h: number) => 1 + 4 * clamp(h, 0, 100) / 100;      // higher is better
const neg = (h: number) => 5 - 4 * clamp(h, 0, 100) / 100;      // lower is better (stress)

const checkInRows: any[] = [];
const bodyRows: any[] = [];
const burnoutRows: any[] = [];

const DRIVERS: [{ key: string; label: string }, number][] = [
  [{ key: "workload", label: "Workload" }, 35],
  [{ key: "sleep", label: "Sleep debt" }, 25],
  [{ key: "stress", label: "Sustained stress" }, 20],
  [{ key: "recovery", label: "Low recovery" }, 10],
  [{ key: "control", label: "Low perceived control" }, 10],
];

for (const p of people) {
  // Each person is active in most months, not all.
  const activeMonth = Array.from({ length: 7 }, () => chance(0.74));

  for (let d = DAYS; d >= 0; d--) {
    const date = new Date(now.getTime() - d * DAY);
    const weekday = date.getDay() !== 0 && date.getDay() !== 6;
    if (!weekday || !activeMonth[Math.floor(d / 30)] || !chance(p.checkInRate)) continue;

    const h = teamHealth(d) + p.offset;
    const stress = score15(neg(h - 6));
    checkInRows.push({
      userId: p.id,
      checkInDate: daysAgo(d, ri(7, 10)),
      week: 0,
      moodScore: score15(pos(h + 4)),
      energyScore: score15(pos(h - 4)),
      stressScore: stress,
      sleepScore: score15(pos(h - 3)),
      clarityScore: score15(pos(h + 2)),
      headache: chance(0.12),
      alcohol: false,
      alcoholCount: null,
      sick: chance(0.04),
      painOrInjury: chance(0.18),
      emotionallyStable: chance(0.4 + h / 150),
      anxious: chance(clamp(0.55 - 0.006 * h, 0.05, 0.6)),
      overwhelmed: stress >= 4 ? chance(0.45) : chance(0.08),
      fatigue: chance(clamp(0.65 - 0.007 * h, 0.05, 0.6)),
      fatigueTriggerMet: chance(0.2),
      exercisedYesterday: chance(0.45),
      caffeineAfter2pm: chance(0.35),
      practicedMindfulness: chance(0.2 + 0.15 * progress(d)),
      energyLevel: score15(pos(h - 4)),
      stressManagement: "",
      completed: true,
    });
  }

  // Body-map logs: about one every 12 days for people who use it.
  if (p.logsBodyMap) {
    for (let d = DAYS - ri(0, 11); d >= 0; d -= ri(8, 16)) {
      const pr = progress(d);
      const painP = p.chronicPain ? 0.8 - 0.25 * pr : 0.22 - 0.12 * pr;
      const inPain = chance(painP);
      const part = inPain ? p.area : weighted(AREAS);
      const severity = inPain ? clamp(Math.round(gauss(5.6 - 1.0 * pr, 0.9)), 4, 8) : ri(1, 3);
      bodyRows.push({
        userId: p.id,
        bodyPart: part,
        severity,
        side: pick(["left", "right", "both"]),
        view: VIEW[part] ?? "front",
        trainingImpact: severity >= 6 ? "modify_avoid" : severity >= 4 ? "careful" : "none",
        createdAt: daysAgo(d, ri(12, 20)),
      });
    }
  }

  // Burnout scores: fortnightly, improving over the six months. Nobody sits in the
  // severe band (over 80) in the last 30 days.
  for (let d = DAYS - p.phase; d >= 0; d -= 14) {
    const pr = progress(d);
    let score = Math.round(p.burnoutBase - 13 * pr + gauss(0, 4));
    score = clamp(score, 4, d <= 30 ? 79 : 95);
    const n = score >= 60 ? 3 : score >= 40 ? 2 : 1;
    const drivers: { key: string; label: string }[] = [];
    while (drivers.length < n) {
      const dr = weighted(DRIVERS);
      if (!drivers.some((x) => x.key === dr.key)) drivers.push(dr);
    }
    burnoutRows.push({
      userId: p.id,
      score,
      trajectory: pr > 0.5 ? weighted([["recovering", 4], ["stable", 5], ["rising", 1]]) : weighted([["stable", 4], ["rising", 3], ["elevated", 2]]),
      confidence: chance(0.7) ? "high" : "medium",
      topDrivers: drivers.map((x) => ({ key: x.key, label: x.label, explanation: `${x.label} is above this person's normal level`, trend: "up", weight: 0.3 })),
      rollingWindowDays: 30,
      computedDate: daysAgo(d, 4),
      checkInCount: ri(6, 14),
      dataSourceCount: 1,
    });
  }
}

// ---- Preview: what the Wellbeing Index will show, month by month ----
function preview() {
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const months: { label: string; start: Date; end: Date }[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const last = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    months.push({ label: start.toLocaleString("en-GB", { month: "short" }), start, end: last > now ? now : last });
  }
  months.push({ label: "Last 30 days", start: new Date(now.getTime() - 30 * DAY), end: now });
  for (const m of months) {
    const ci = checkInRows.filter((c) => c.checkInDate >= m.start && c.checkInDate <= m.end);
    const avg = (k: string) => ci.reduce((s, c) => s + c[k], 0) / ci.length;
    const contrib = [(avg("moodScore") - 1) / 4, (avg("energyScore") - 1) / 4, (5 - avg("stressScore")) / 4, (avg("clarityScore") - 1) / 4].map((x) => x * 100);
    const mental = contrib.reduce((a, b) => a + b, 0) / 4;
    const bm = bodyRows.filter((b) => b.createdAt >= m.start && b.createdAt <= m.end);
    const contributors = new Set(bm.map((b) => b.userId)).size;
    const inPain = new Set(bm.filter((b) => b.severity >= 4).map((b) => b.userId)).size;
    const prevalence = (inPain / contributors) * 100;
    const sev = bm.reduce((s, b) => s + b.severity, 0) / bm.length;
    const physical = ((100 - prevalence) + (100 - sev * 10)) / 2;
    const latest = new Map<string, number>();
    burnoutRows.filter((b) => b.computedDate >= m.start && b.computedDate <= m.end)
      .sort((a, b) => a.computedDate - b.computedDate).forEach((b) => latest.set(b.userId, b.score));
    const s = [...latest.values()];
    const bands = [s.filter((x) => x <= 20).length, s.filter((x) => x > 20 && x <= 40).length, s.filter((x) => x > 40 && x <= 60).length, s.filter((x) => x > 60 && x <= 80).length, s.filter((x) => x > 80).length];
    console.log(`${m.label.padEnd(13)} active ${String(new Set(ci.map((c) => c.userId)).size).padStart(3)}  mental ${r1(mental)}  physical ${r1(physical)} (pain ${r1(prevalence)}% of ${contributors}, sev ${r1(sev)})  burnout avg ${r1(s.reduce((a, b) => a + b, 0) / s.length)} bands ${bands.join("/")}`);
  }
  console.log(`Rows: ${checkInRows.length} check-ins, ${bodyRows.length} body-map logs, ${burnoutRows.length} burnout scores.`);
}

// ---- Write ----
async function insertInChunks(db: any, table: any, rows: any[]) {
  for (let i = 0; i < rows.length; i += 500) await db.insert(table).values(rows.slice(i, i + 500));
}

async function writeAll(): Promise<void> {
  const { db, pool } = await import("./db");
  const { inArray } = await import("drizzle-orm");
  const { users, checkIns, bodyMapLogs, burnoutScores } = await import("@workspace/db");
  const ids = people.map((p) => p.id);

  await db.insert(users).values(people.map((p) => ({
    id: p.id,
    email: `${p.firstName.toLowerCase().replace(/[^a-z]/g, "")}.${p.lastName.toLowerCase().replace(/[^a-z]/g, "")}.${p.id}@kestrelmoor.invalid`,
    firstName: p.firstName,
    lastName: p.lastName,
    displayName: `${p.firstName} ${p.lastName}`,
    companyName: COMPANY,
    isAdmin: false,
    role: "user",
    onboardingCompleted: true,
  }))).onConflictDoNothing();

  await db.delete(checkIns).where(inArray(checkIns.userId, ids));
  await db.delete(bodyMapLogs).where(inArray(bodyMapLogs.userId, ids));
  await db.delete(burnoutScores).where(inArray(burnoutScores.userId, ids));

  // Keep serial id sequences ahead of MAX(id) (prod-safety, same as wwiDemoSeed).
  for (const t of ["check_ins", "body_map_logs", "burnout_scores"]) {
    await pool.query(`SELECT setval(pg_get_serial_sequence('${t}','id'), (SELECT COALESCE(MAX(id),1) FROM ${t}))`);
  }

  await insertInChunks(db, checkIns, checkInRows);
  await insertInChunks(db, bodyMapLogs, bodyRows);
  await insertInChunks(db, burnoutScores, burnoutRows);
}

// Startup seeder: runs on the deployed server, so it writes to the live database.
// Guarded by a system_flags marker so it runs exactly once per database.
const SEED_FLAG = "wwi_showcase_kestrelmoor_v1";
let hasRunShowcaseSeed = false;

export async function seedWwiShowcaseOnce(): Promise<void> {
  if (hasRunShowcaseSeed) return;
  hasRunShowcaseSeed = true;
  try {
    const { pool } = await import("./db");
    await pool.query(`CREATE TABLE IF NOT EXISTS system_flags (key text PRIMARY KEY, created_at timestamp DEFAULT now())`);
    const flag = await pool.query(`SELECT 1 FROM system_flags WHERE key = $1 LIMIT 1`, [SEED_FLAG]);
    if ((flag.rowCount ?? 0) > 0) {
      console.log("[startup-migration] wwi-showcase: already seeded, skipping");
      return;
    }
    await writeAll();
    await pool.query(`INSERT INTO system_flags (key) VALUES ($1) ON CONFLICT (key) DO NOTHING`, [SEED_FLAG]);
    console.log(`[startup-migration] wwi-showcase: seeded "${COMPANY}", ${NUM_USERS} users, ${checkInRows.length} check-ins, ${bodyRows.length} body-map logs, ${burnoutRows.length} burnout scores`);
  } catch (e: any) {
    console.error("[startup-migration] wwi-showcase failed:", e?.message || e);
  }
}

// Command-line use (dry run, manual seed or teardown). Only runs when this file
// is executed directly, never when the server imports it.
if (process.argv[1] && /seedWwiShowcase\.ts$/.test(process.argv[1])) {
  (async () => {
    try {
      if (DRY_RUN) { preview(); process.exit(0); }
      if (TEARDOWN) {
        const { db, pool } = await import("./db");
        const { inArray } = await import("drizzle-orm");
        const { users } = await import("@workspace/db");
        console.log(`Removing "${COMPANY}" (${NUM_USERS} users and all their data)…`);
        await db.delete(users).where(inArray(users.id, people.map((p) => p.id)));
        await pool.query(`DELETE FROM system_flags WHERE key = $1`, [SEED_FLAG]);
        console.log("Done.");
        process.exit(0);
      }
      console.log(`Seeding "${COMPANY}" with ${NUM_USERS} people…`);
      await writeAll();
      preview();
      console.log(`Done. Open the admin portal, Wellbeing Index, and select "${COMPANY}".`);
      process.exit(0);
    } catch (e) {
      console.error("Seed failed:", e);
      process.exit(1);
    }
  })();
}
