/**
 * Seed realistic test data for admin-001 (dev profile) so the Insight Card
 * and Daily Readiness v2 can be visualised end-to-end.
 *
 * Run: npx tsx scripts/seed-admin-test-data.ts
 */
import { db } from "../server/db";
import { eq } from "drizzle-orm";
import {
  weeklyCheckins,
  wearableMetricsDaily,
  workoutLogs,
  sleepEntries,
  restingHREntries,
  checkIns,
  stepEntries,
  dailyReadinessHistory,
} from "../shared/schema";
import { toDateKey, gatherInputsForDay, computeDailyReadinessV1 } from "../server/dailyReadiness";

const USER_ID = "admin-001";
const DAYS = 30;

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, d = 1): number {
  const v = Math.random() * (max - min) + min;
  return Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
}

function dateKey(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return toDateKey(d);
}

function dateTime(offsetDays: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  d.setHours(hour, rand(0, 59), 0, 0);
  return d;
}

async function main() {
  console.log(`Seeding test data for ${USER_ID} ...\n`);

  const today = new Date();

  // 1. Weekly check-ins (4 weeks, V2 payload — full shape so detail page renders)
  const TRAJECTORIES = ["trending up", "holding steady", "declining"] as const;
  const wcValues = [];
  for (let w = 0; w < 4; w++) {
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - w * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const sessionsCompleted = rand(3, 5);
    const sessionsPlanned = 5;
    const adherencePct = Math.round((sessionsCompleted / sessionsPlanned) * 100);
    const checkInCount = rand(5, 7);
    const roughDaysCount = rand(0, 2);
    const avgMood = rand(3, 5);
    const avgEnergy = rand(3, 5);
    const avgStress = rand(1, 3);
    const avgSleepHours = Math.round((rand(390, 510) / 60) * 10) / 10;
    const avgSteps = rand(8500, 12500);
    const bestSteps = avgSteps + rand(1500, 4000);
    const trajectoryLabel = w === 0 ? "trending up" : TRAJECTORIES[rand(0, 2)];

    wcValues.push({
      userId: USER_ID,
      weekStart,
      payload: {
        _v: 5,
        weekStart: toDateKey(weekStart),
        weekEnd: toDateKey(weekEnd),
        hero:
          w === 0
            ? `Strong recovery week. Resting HR trended down, you logged ${checkInCount} check-ins, completed ${sessionsCompleted} of ${sessionsPlanned} sessions, and averaged ${avgSleepHours}h sleep.`
            : `Week of ${toDateKey(weekStart)}: ${sessionsCompleted}/${sessionsPlanned} sessions, ${avgSleepHours}h avg sleep, energy felt ${avgEnergy >= 4 ? "high" : "steady"}.`,
        trajectoryLabel,
        cards: {
          howYouFelt: {
            checkInCount,
            avgMood,
            avgEnergy,
            avgStress,
            roughDaysCount,
          },
          howYouMoved: {
            sessionsCompleted,
            sessionsPlanned,
            adherencePct,
            steps: {
              avg: avgSteps,
              bestDay: { dayLabel: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][rand(0, 6)], steps: bestSteps },
              source: "wearable" as const,
            },
          },
          goals: {
            items: [
              { title: "Hit 10k steps 5×/week", progressPct: rand(60, 100), isCompleted: false },
              { title: "Sleep ≥ 7h nightly", progressPct: rand(50, 95), isCompleted: false },
            ],
          },
          habits: {
            items: [
              {
                title: "Morning mobility",
                completionsThisWeek: rand(3, 7),
                targetDaysThisWeek: 7,
                weekDays: Array.from({ length: 7 }, () => rand(0, 10) > 3),
              },
              {
                title: "Hydration goal",
                completionsThisWeek: rand(4, 7),
                targetDaysThisWeek: 7,
                weekDays: Array.from({ length: 7 }, () => rand(0, 10) > 2),
              },
            ],
          },
          lifestyle: {
            avgSleepHours,
            sleepSource: "wearable" as const,
            roughDaysCount,
          },
          patterns: {
            narrative:
              w === 0
                ? "Your recovery markers improved meaningfully this week. Resting HR trended down and sleep duration held above 7 hours on most nights. Training volume was consistent without spiking strain."
                : "A steady week overall. Sleep was the main lever — nights above 7h coincided with your highest energy ratings the next day.",
            bulletPoints: [
              `Sleep averaged ${avgSleepHours}h — ${avgSleepHours >= 7.25 ? "above" : "near"} your target`,
              `${sessionsCompleted} of ${sessionsPlanned} planned sessions completed (${adherencePct}% adherence)`,
              `Energy averaged ${avgEnergy}/5 across ${checkInCount} check-ins`,
            ],
            isAI: true,
            generatedAt: new Date().toISOString(),
          },
          nutrition: {
            daysTracked: rand(4, 7),
            mealsLogged: rand(12, 21),
          },
        },
        metrics: {},
      },
    });
  }
  // Delete existing rows for this user so seeded hero text always wins
  await db.delete(weeklyCheckins).where(eq(weeklyCheckins.userId, USER_ID));
  await db.insert(weeklyCheckins).values(wcValues);
  console.log(`  ✓ ${wcValues.length} weekly check-ins (replaced)`);

  // 2. Wearable daily metrics (30 days, whoop provider)
  const wearValues = [];
  for (let i = 0; i < DAYS; i++) {
    const dk = dateKey(i);
    const hrvMs = rand(55, 92);
    const restingHrBpm = rand(48, 62);
    const sleepScore = rand(68, 88);
    const strainScore = rand(60, 150);
    const steps = rand(7000, 14500);
    const activeMinutes = rand(25, 95);
    const caloriesBurned = rand(320, 620);
    wearValues.push({
      userId: USER_ID,
      provider: "whoop",
      date: dk,
      hrvMs,
      restingHrBpm,
      sleepScore,
      strainScore,
      steps,
      activeMinutes,
      caloriesBurned,
      totalSleepMinutes: rand(390, 510),
      deepSleepMinutes: rand(60, 110),
      lightSleepMinutes: rand(180, 260),
      remSleepMinutes: rand(60, 110),
      readinessScore: rand(65, 85),
      workoutCount: rand(0, 2),
      updatedAt: new Date(),
    });
  }
  for (const batch of chunk(wearValues, 50)) {
    await db.insert(wearableMetricsDaily).values(batch).onConflictDoNothing();
  }
  console.log(`  ✓ ${wearValues.length} wearable daily rows`);

  // 3. Workout logs (yesterday + 4 past)
  const woValues = [
    { userId: USER_ID, workoutName: "Strength — Upper Body", workoutType: "individual" as const, startedAt: dateTime(1, 6), completedAt: dateTime(1, 7), duration: rand(2400, 4200), status: "completed" as const },
    { userId: USER_ID, workoutName: "Zone 2 Cardio", workoutType: "individual" as const, startedAt: dateTime(3, 6), completedAt: dateTime(3, 7), duration: rand(1800, 3600), status: "completed" as const },
    { userId: USER_ID, workoutName: "Mobility Flow", workoutType: "individual" as const, startedAt: dateTime(5, 6), completedAt: dateTime(5, 7), duration: rand(1200, 2400), status: "completed" as const },
    { userId: USER_ID, workoutName: "HIIT Session", workoutType: "individual" as const, startedAt: dateTime(8, 6), completedAt: dateTime(8, 7), duration: rand(1800, 2700), status: "completed" as const },
    { userId: USER_ID, workoutName: "Recovery Walk", workoutType: "individual" as const, startedAt: dateTime(12, 6), completedAt: dateTime(12, 7), duration: rand(1800, 3000), status: "completed" as const },
  ];
  await db.insert(workoutLogs).values(woValues).onConflictDoNothing();
  console.log(`  ✓ ${woValues.length} workout logs`);

  // 4. Sleep entries (14 days)
  const sleepValues = [];
  for (let i = 0; i < 14; i++) {
    const mins = rand(390, 510);
    sleepValues.push({
      userId: USER_ID,
      date: dateTime(i, 23),
      durationMinutes: mins,
      sleepScore: Math.min(100, Math.round((mins / 480) * 80 + rand(-5, 5))),
      quality: rand(3, 5),
    });
  }
  for (const batch of chunk(sleepValues, 50)) {
    await db.insert(sleepEntries).values(batch).onConflictDoNothing();
  }
  console.log(`  ✓ ${sleepValues.length} sleep entries`);

  // 5. Resting HR entries (45 days, declining trend 58 → 52)
  const rhrValues = [];
  for (let i = 0; i < 45; i++) {
    const baseline = 58 - (i / 45) * 6;
    const bpm = Math.round(baseline + randFloat(-1.5, 1.5, 1));
    rhrValues.push({
      userId: USER_ID,
      date: dateTime(i, 6),
      bpm,
    });
  }
  for (const batch of chunk(rhrValues, 50)) {
    await db.insert(restingHREntries).values(batch).onConflictDoNothing();
  }
  console.log(`  ✓ ${rhrValues.length} resting HR entries`);

  // 6. Check-ins (14 days)
  const ciValues = [];
  for (let i = 0; i < 14; i++) {
    ciValues.push({
      userId: USER_ID,
      checkInDate: dateTime(i, 8),
      week: Math.floor(i / 7),
      moodScore: rand(3, 5),
      energyScore: rand(3, 5),
      stressScore: rand(1, 4),
      sleepScore: rand(3, 5),
      clarityScore: rand(3, 5),
      headache: false,
      alcohol: rand(0, 10) < 3,
      alcoholCount: null,
      sick: false,
      painOrInjury: false,
      emotionallyStable: true,
      anxious: false,
      overwhelmed: false,
      exercisedYesterday: true,
      caffeineAfter2pm: rand(0, 10) < 4,
      practicedMindfulness: rand(0, 10) < 4,
      fatigue: false,
      fatigueTriggerMet: false,
      energyLevel: rand(3, 5),
      stressManagement: "",
      completed: true,
    });
  }
  for (const batch of chunk(ciValues, 50)) {
    await db.insert(checkIns).values(batch).onConflictDoNothing();
  }
  console.log(`  ✓ ${ciValues.length} check-ins`);

  // 7. Step entries (7 days)
  const stepValues = [];
  for (let i = 0; i < 7; i++) {
    stepValues.push({
      userId: USER_ID,
      date: dateTime(i, 20),
      steps: rand(8000, 13000),
    });
  }
  for (const batch of chunk(stepValues, 50)) {
    await db.insert(stepEntries).values(batch).onConflictDoNothing();
  }
  console.log(`  ✓ ${stepValues.length} step entries`);

  // 8. Pre-compute readiness history (30 days) via v2 algorithm
  let histInserted = 0;
  for (let i = 0; i < DAYS; i++) {
    const dk = dateKey(i);
    const { inputs } = await gatherInputsForDay(USER_ID, dk);
    const result = computeDailyReadinessV1(inputs);
    if (result.score != null) {
      await db
        .insert(dailyReadinessHistory)
        .values({
          userId: USER_ID,
          date: dk,
          sleepInput: inputs.sleep,
          energyInput: inputs.energy,
          trainingLoadInput: inputs.trainingLoad,
          hrvInput: inputs.hrv,
          rhrInput: inputs.rhr,
          inputCount: result.inputCount,
          score: result.score,
          algorithmVersion: "v2",
        })
        .onConflictDoUpdate({
          target: [dailyReadinessHistory.userId, dailyReadinessHistory.date],
          set: {
            sleepInput: inputs.sleep,
            energyInput: inputs.energy,
            trainingLoadInput: inputs.trainingLoad,
            hrvInput: inputs.hrv,
            rhrInput: inputs.rhr,
            inputCount: result.inputCount,
            score: result.score,
            algorithmVersion: "v2",
            updatedAt: new Date(),
          },
        });
      histInserted++;
    }
  }
  console.log(`  ✓ ${histInserted} readiness history rows with scores`);

  console.log("\n=== Done! Reload the dashboard to see data ===");
  process.exit(0);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
