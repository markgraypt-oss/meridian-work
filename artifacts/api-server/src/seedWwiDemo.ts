/**
 * WWI demo-data seeder.
 *
 * Creates an ISOLATED demo company ("WWI Demo") with 12 users plus check-ins,
 * body-map logs and burnout scores dated in the last ~25 days, so the
 * Workforce Wellbeing Index renders in its FULL state (both domains) on the
 * default "Last 30 days" view. Touches nothing outside the "WWI Demo" cohort.
 *
 * Run (from repo root on the Repl):   cd artifacts/api-server && npx tsx src/seedWwiDemo.ts
 * Remove it again:                    cd artifacts/api-server && npx tsx src/seedWwiDemo.ts --teardown
 *
 * Idempotent: re-running reseeds the same 12 fixed user ids (old demo rows are
 * cleared first). Safe to run repeatedly.
 */

import { inArray } from "drizzle-orm";
import { db } from "./db";
import { users, checkIns, bodyMapLogs, burnoutScores } from "@workspace/db";

const COMPANY = "WWI Demo";
const NUM_USERS = 12;
const TEARDOWN = process.argv.includes("--teardown");

const userIds = Array.from({ length: NUM_USERS }, (_, i) => `wwi-demo-${String(i + 1).padStart(2, "0")}`);

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * DAY);
const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const chance = (p: number) => Math.random() < p;

async function clearDemoData() {
  await db.delete(checkIns).where(inArray(checkIns.userId, userIds));
  await db.delete(bodyMapLogs).where(inArray(bodyMapLogs.userId, userIds));
  await db.delete(burnoutScores).where(inArray(burnoutScores.userId, userIds));
}

async function teardown() {
  console.log(`Tearing down "${COMPANY}" (${NUM_USERS} users + all their data)…`);
  await clearDemoData();
  await db.delete(users).where(inArray(users.id, userIds));
  console.log("Done. WWI Demo removed.");
}

async function seed() {
  console.log(`Seeding "${COMPANY}" with ${NUM_USERS} users…`);

  // 1) Users (upsert — keep ids stable, refresh company/name).
  await db
    .insert(users)
    .values(
      userIds.map((id, i) => ({
        id,
        email: `${id}@demo.invalid`,
        firstName: "Demo",
        lastName: `User ${String(i + 1).padStart(2, "0")}`,
        displayName: `Demo User ${i + 1}`,
        companyName: COMPANY,
        isAdmin: false,
        role: "user",
        onboardingCompleted: true,
      }))
    )
    .onConflictDoNothing();

  // Clear any prior demo activity so re-runs are clean.
  await clearDemoData();

  // 2) Check-ins — ~8 per user across the last 24 days (drives Mental Wellbeing).
  const checkInRows: any[] = [];
  for (const id of userIds) {
    const n = randInt(6, 10);
    const used = new Set<number>();
    for (let k = 0; k < n; k++) {
      let d = randInt(1, 24);
      while (used.has(d)) d = randInt(1, 24);
      used.add(d);
      const stress = randInt(2, 5);
      checkInRows.push({
        userId: id,
        checkInDate: daysAgo(d),
        week: 0,
        moodScore: randInt(2, 5),
        energyScore: randInt(2, 5),
        stressScore: stress,
        sleepScore: randInt(2, 5),
        clarityScore: randInt(2, 5),
        headache: chance(0.2),
        alcohol: chance(0.25),
        alcoholCount: chance(0.25) ? randInt(1, 3) : null,
        sick: chance(0.08),
        painOrInjury: chance(0.3),
        emotionallyStable: chance(0.7),
        anxious: chance(0.3),
        overwhelmed: stress >= 4 ? chance(0.5) : chance(0.15),
        fatigue: chance(0.35),
        fatigueTriggerMet: chance(0.35),
        exercisedYesterday: chance(0.5),
        caffeineAfter2pm: chance(0.4),
        practicedMindfulness: chance(0.3),
        energyLevel: randInt(2, 5),
        stressManagement: "",
        completed: true,
      });
    }
  }
  await db.insert(checkIns).values(checkInRows);

  // 3) Body-map logs — 11 of 12 users log musculoskeletal data (drives Physical
  //    Strain). Guarantee at least two areas clear the 5-distinct-reporter floor
  //    at severity >= 4 so "top areas" show.
  const bodyRows: any[] = [];
  const contributors = userIds.slice(0, 11); // 11 distinct contributors
  const lowerBack = contributors.slice(0, 6); // 6 reporters
  const neck = contributors.slice(3, 8); // 5 reporters (overlap is fine — distinct per area)
  const shoulders = contributors.slice(8, 11); // 3 reporters (below floor, stays hidden)

  for (const id of lowerBack) {
    bodyRows.push({
      userId: id, bodyPart: "lower_back", severity: randInt(5, 7),
      side: pick(["left", "right", "both"]), view: "back",
      trainingImpact: pick(["careful", "modify_avoid"]),
      createdAt: daysAgo(randInt(1, 22)),
    });
  }
  for (const id of neck) {
    bodyRows.push({
      userId: id, bodyPart: "neck", severity: randInt(4, 6),
      side: pick(["left", "right"]), view: "back",
      trainingImpact: "careful",
      createdAt: daysAgo(randInt(1, 22)),
    });
  }
  for (const id of shoulders) {
    bodyRows.push({
      userId: id, bodyPart: "shoulder", severity: randInt(3, 6),
      side: pick(["left", "right"]), view: "front",
      createdAt: daysAgo(randInt(1, 22)),
    });
  }
  // Previous-window logs (31–52 days ago) so worsening/severity trend pills
  // have a real prior value to compare against.
  for (const id of contributors.slice(0, 5)) {
    bodyRows.push({
      userId: id, bodyPart: "lower_back", severity: randInt(3, 5),
      side: "both", view: "back", createdAt: daysAgo(randInt(31, 52)),
    });
  }
  await db.insert(bodyMapLogs).values(bodyRows);

  // 4) Burnout scores — one recent score per user (>=10 needed to make the
  //    burnout block reportable, which lifts Mental Wellbeing to full state).
  const trajectories = ["stable", "rising", "elevated", "recovering"];
  const driverPool = [
    { key: "workload", label: "Workload" },
    { key: "sleep", label: "Sleep debt" },
    { key: "stress", label: "Sustained stress" },
    { key: "recovery", label: "Low recovery" },
    { key: "control", label: "Low perceived control" },
  ];
  // Spread across bands [20,40,60,80]: a couple optimal, some mid, a couple severe.
  const scorePlan = [15, 22, 31, 38, 45, 52, 58, 64, 71, 78, 85, 91];
  const burnoutRows = userIds.map((id, i) => {
    const drivers = [pick(driverPool), pick(driverPool)]
      .filter((d, idx, a) => a.findIndex((x) => x.key === d.key) === idx)
      .map((d) => ({ key: d.key, label: d.label, explanation: `${d.label} trending up`, trend: "up", weight: 0.3 }));
    return {
      userId: id,
      score: scorePlan[i] ?? randInt(20, 80),
      trajectory: pick(trajectories),
      confidence: chance(0.6) ? "high" : "medium",
      topDrivers: drivers,
      rollingWindowDays: 30,
      computedDate: daysAgo(randInt(1, 6)),
      checkInCount: randInt(6, 10),
      dataSourceCount: 1,
    };
  });
  await db.insert(burnoutScores).values(burnoutRows);

  console.log(
    `Done. ${NUM_USERS} users, ${checkInRows.length} check-ins, ${bodyRows.length} body-map logs, ${burnoutRows.length} burnout scores.`
  );
  console.log(`Open the admin portal → Analytics → Wellbeing Index → select "${COMPANY}".`);
}

(async () => {
  try {
    if (TEARDOWN) await teardown();
    else await seed();
    process.exit(0);
  } catch (e) {
    console.error("Seed failed:", e);
    process.exit(1);
  }
})();
