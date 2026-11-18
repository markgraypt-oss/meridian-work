/**
 * App demo account: "Sarah" (mark+sarah@meridian.work), for the App page
 * screenshots and the product video.
 *
 * Creates one person in Kestrelmoor Group with about eight weeks of history:
 * daily check-ins, Apple Health data (sleep, HRV, resting heart rate, steps),
 * Daily Readiness, a Burnout Index that climbed to Overloaded, a 30-day
 * Recovery Mode that has just ended (its report is waiting to be seen), habit
 * streaks, the Strength at Home programme in week 6 (goblet squat swapped in),
 * body weight, two Apple Watch runs, the cycle tracker, coach memories, a team
 * step challenge with nine Kestrelmoor colleagues, and the rewards prize draw.
 *
 * Everything the person does live (body map, coach chats, AI Workout Builder,
 * desk scan, recipes) is left for the real app.
 *
 * Keeping it current: the account is topped up every few hours, and whenever
 * the phone tries to sync Apple Health or Health Connect. Missing days get a
 * check-in, habit ticks, wearable data and any programme session that was due,
 * so streaks and charts stay unbroken for as long as the account is used.
 *
 * Phone health data never lands here: the sync routes ignore whatever the phone
 * sends for this account (the phone's "Apple Health connected" flag is
 * device-wide, so whoever signs in on Mark's phone would otherwise get his data).
 *
 * Today's wearable row follows today's check-in: a check-in with poor sleep or
 * low energy gives a short night and a low HRV, so Daily Readiness comes out
 * low ("Keep it easier"). A normal check-in gives a normal score.
 *
 * Live database: seeded by the deployed server on start-up, once per database
 * (system_flags key below). Teardown (dev shell): npx tsx src/appDemoSeed.ts --teardown
 */
import { pool } from "./db";

export const DEMO_SARAH_ID = "demo-sarah";
const EMAIL = "mark+sarah@meridian.work";
const COMPANY = "Kestrelmoor Group";
const SEED_FLAG = "app_demo_sarah_v1";
const DEMO_TAG = "app_demo_sarah";
const DEFAULT_TZ = "Europe/Dublin";
const HISTORY_DAYS = 56;
const CREATED_DAYS_AGO = 58;
const TOP_UP_EVERY_MS = 3 * 60 * 60 * 1000;

// Nine people from the Kestrelmoor showcase company, for the challenge leaderboard.
const COLLEAGUE_IDS = ["kmg-003", "kmg-011", "kmg-017", "kmg-024", "kmg-038", "kmg-052", "kmg-069", "kmg-085", "kmg-101"];
const COLLEAGUE_BASE_STEPS = [12400, 9800, 8600, 11200, 7600, 10300, 13100, 8900, 9400];
const CHALLENGE_TITLE = "8,000 steps a day";
const CHALLENGE_DAILY_TARGET = 8000;

// ---------------------------------------------------------------------------
// Deterministic noise: the same date always gives the same numbers.
// ---------------------------------------------------------------------------
function hash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function gauss(key: string): number {
  const u = Math.max(hash01(key + ":u"), 1e-6);
  const v = hash01(key + ":v");
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ---------------------------------------------------------------------------
// Dates. Keys are local YYYY-MM-DD strings.
// ---------------------------------------------------------------------------
function keyInTz(d: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
function utcMs(key: string): number {
  return Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10));
}
function addDays(key: string, n: number): string {
  return new Date(utcMs(key) + n * 86400000).toISOString().slice(0, 10);
}
function diffDays(a: string, b: string): number {
  return Math.round((utcMs(a) - utcMs(b)) / 86400000);
}
function weekday(key: string): number {
  return new Date(utcMs(key)).getUTCDay(); // 0 Sunday .. 6 Saturday
}
function tzOffsetMinutes(key: string, tz: string): number {
  try {
    const d = new Date(`${key}T12:00:00Z`);
    const f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const q: Record<string, string> = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
    const asUtc = Date.UTC(+q.year, +q.month - 1, +q.day, +q.hour % 24, +q.minute, +q.second);
    return Math.round((asUtc - d.getTime()) / 60000);
  } catch {
    return 0;
  }
}
function localTime(key: string, tz: string, hh: number, mm: number): Date {
  return new Date(utcMs(key) + (hh * 60 + mm) * 60000 - tzOffsetMinutes(key, tz) * 60000);
}
function localHour(now: Date, tz: string): number {
  try {
    const h = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(now);
    return parseInt(h, 10) % 24;
  } catch {
    return now.getUTCHours();
  }
}
function mondayOnOrBefore(key: string): string {
  const wd = weekday(key);
  return addDays(key, -((wd + 6) % 7));
}

// ---------------------------------------------------------------------------
// The story. k = days relative to the seed day (negative = before it).
// Stress climbs to a peak 38 days before the seed day (Recovery Mode goes on),
// then eases over the next month and stays low.
// ---------------------------------------------------------------------------
function stressAt(k: number): number {
  if (k <= -56) return 0.35;
  if (k < -38) return 0.35 + 0.65 * Math.pow((k + 56) / 18, 1.5);
  if (k <= 0) return 0.08 + 0.92 * Math.exp(-(k + 38) / 11);
  return 0.1 + 0.07 * Math.max(0, Math.sin(k / 4.5));
}
function stressOn(key: string, k: number): number {
  return clamp(stressAt(k) + 0.06 * gauss(`${key}|s`), 0, 1);
}

type DayMetrics = {
  sleepMinutes: number; deep: number; rem: number; light: number; awake: number;
  hrv: number; rhr: number; steps: number; activeMinutes: number; kcal: number;
};
function dayMetrics(key: string, k: number, o: { trained: boolean; ran: boolean; poorNight?: boolean; fraction?: number }): DayMetrics {
  const wd = weekday(key);
  const weekend = wd === 0 || wd === 6;
  const s = stressOn(key, k);
  let sleep = 448 - 88 * s + 18 * gauss(`${key}|sleep`) + (weekend ? 18 : 0);
  let hrv = 52 - 14 * s + 3 * gauss(`${key}|hrv`);
  let rhr = 56 + 7 * s + 1.3 * gauss(`${key}|rhr`);
  if (o.poorNight) {
    sleep = 305 + 15 * gauss(`${key}|pn`);
    hrv -= 11;
    rhr += 5;
  }
  const f = o.fraction ?? 1;
  const steps = Math.max(800, (11400 - 3900 * s + 1400 * gauss(`${key}|steps`) - (weekend ? 900 : 0) + (o.ran ? 6200 : 0)) * f);
  const active = Math.max(4, (36 - 14 * s + 6 * gauss(`${key}|act`) + (o.trained ? 26 : 0) + (o.ran ? 31 : 0)) * f);
  const sleepMinutes = Math.round(sleep);
  const deep = Math.round(sleepMinutes * 0.16 + 6 * gauss(`${key}|deep`));
  const rem = Math.round(sleepMinutes * 0.22 + 6 * gauss(`${key}|rem`));
  return {
    sleepMinutes, deep, rem,
    light: sleepMinutes - deep - rem,
    awake: Math.round(16 + 14 * s + 5 * Math.abs(gauss(`${key}|awake`))),
    hrv: Math.round(hrv),
    rhr: Math.round(rhr),
    steps: Math.round(steps),
    activeMinutes: Math.round(active),
    kcal: Math.round(220 * f + steps * 0.028 + active * 4),
  };
}

const CHECK_IN_NOTES: Record<number, string> = {
  [-47]: "Launch date moved forward. Long days again.",
  [-41]: "Up past midnight finishing slides. Back is tight.",
  [-39]: "Wired but exhausted. Couldn't switch off.",
  [-37]: "Turned on Recovery Mode. Doing the 30 minute home sessions instead of the gym.",
  [-29]: "Box breathing before the review meeting helped.",
  [-20]: "Slept properly for the first time in weeks.",
  [-9]: "Back feels fine after a full week at the desk.",
  [-4]: "Good week. Goblet squat felt strong.",
};

function checkInModel(key: string, k: number, exercisedYesterday: boolean) {
  const s = stressOn(key, k);
  const wd = weekday(key);
  const sc = (base: number, slope: number, salt: string) => clamp(Math.round(base + slope * s + 0.55 * gauss(`${key}|${salt}`)), 1, 5);
  const h = (salt: string) => hash01(`${key}|${salt}`);
  const stress = sc(1.5, 3.4, "cst");
  const sleepScore = sc(4.5, -2.8, "csl");
  const energy = sc(4.3, -2.6, "cen");
  const mood = sc(4.3, -2.2, "cmo");
  const clarity = sc(4.2, -2.4, "ccl");
  const overwhelmed = s > 0.65 && h("ov") < 0.6;
  const anxious = s > 0.55 && h("an") < 0.45;
  const weekend = wd === 0 || wd === 6;
  const alcohol = weekend ? h("alc") < 0.35 : h("alc") < 0.05;
  const controlAsked = stress >= 4 || overwhelmed || anxious;
  const fatigueAsked = energy <= 2;
  return {
    moodScore: mood, energyScore: energy, stressScore: stress, sleepScore, clarityScore: clarity,
    headache: s > 0.7 && h("hd") < 0.3,
    alcohol,
    alcoholCount: alcohol ? 1 + Math.floor(h("alcn") * 2) : null,
    sick: false,
    painOrInjury: s > 0.6 && h("pain") < 0.35,
    emotionallyStable: !(s > 0.8 && h("es") < 0.5),
    anxious, overwhelmed,
    exercisedYesterday,
    caffeineAfter2pm: s > 0.55 ? h("caf") < 0.55 : h("caf") < 0.12,
    practicedMindfulness: k >= -37 ? h("mind") < 0.75 : h("mind") < 0.1,
    fatigue: fatigueAsked ? true : null,
    fatigueTriggerMet: fatigueAsked,
    perceivedControlScore: controlAsked ? clamp(Math.round(3.6 - 2.2 * s + 0.5 * gauss(`${key}|pc`)), 1, 5) : null,
    perceivedControlTriggerMet: controlAsked,
    notes: CHECK_IN_NOTES[k] ?? null,
  };
}

// Working weights (kg) by week for the Strength at Home exercises.
const WEIGHTS: Record<number, number[]> = {
  345: [12, 14, 14, 16, 18, 20, 20, 22], // Dumbbell Goblet Squat (swapped in for Dumbbell Front Squat)
  394: [8, 8, 10, 10, 10, 12, 12, 12],   // Flat Dumbbell Press
  277: [10, 10, 12, 12, 12, 14, 14, 14], // Chest Supported Dumbbell Row
  352: [6, 6, 8, 8, 8, 10, 10, 10],      // Dumbbell Rear Foot Elevated Split Squat
  772: [12, 12, 14, 14, 16, 16, 16, 18], // Standing Dumbbell Calf Raise
  351: [14, 14, 16, 16, 18, 20, 20, 22], // Dumbbell RDL
  678: [6, 6, 7, 7, 8, 8, 9, 9],         // Seated Dumbbell Shoulder Press
  707: [12, 12, 14, 14, 14, 16, 16, 16], // Single Arm Dumbbell Row
  1082: [2, 2, 2, 3, 3, 3, 3, 3],        // Dumbbell I, Y, T
};
function weightFor(libId: number | null, name: string, week: number): number | null {
  const w = Math.max(0, Math.min(7, week - 1));
  if (libId != null && WEIGHTS[libId]) return WEIGHTS[libId][w];
  if (/dumbbell|kettlebell/i.test(name)) return [6, 6, 8, 8, 8, 10, 10, 10][w];
  return null;
}
function repsFor(raw: any, week: number): number | null {
  const s = String(raw ?? "");
  const m = s.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (m) {
    const lo = +m[1], hi = +m[2];
    return week <= 2 ? lo : week <= 4 ? Math.round((lo + hi) / 2) : hi;
  }
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}
function secondsFor(raw: any): number | null {
  const s = String(raw ?? "");
  const mm = s.match(/(\d+)\s*(min|m\b)/i);
  if (mm) return +mm[1] * 60;
  const n = s.match(/(\d+)/);
  return n ? +n[1] : null;
}

const COACH_MEMORIES: { key: string; value: string; category: string; importance: number; daysAgo: number }[] = [
  { key: "preferred_session_length", value: "Prefers 30-minute sessions at home before work", category: "preference", importance: 4, daysAgo: 37 },
  { key: "home_equipment", value: "Trains at home with adjustable dumbbells up to 24 kg, a bench and resistance bands", category: "constraint", importance: 4, daysAgo: 37 },
  { key: "lower_back_desk", value: "Lower back tightens after long days at the desk, usually late in the week", category: "constraint", importance: 5, daysAgo: 41 },
  { key: "late_caffeine_sleep", value: "Sleeps worse when she has coffee after 2pm", category: "tried", importance: 3, daysAgo: 30 },
  { key: "box_breathing_meetings", value: "Box breathing before big meetings helps her settle", category: "tried", importance: 3, daysAgo: 29 },
  { key: "strength_goal", value: "Wants to get stronger and keep her back pain-free. Aiming for a 24 kg goblet squat", category: "goal", importance: 4, daysAgo: 22 },
  { key: "work_launch_deadline", value: "Product launch at work at the end of November, so long days until then", category: "general", importance: 3, daysAgo: 12 },
];

// Habits from the library: template id, first day (k), days missed.
const HABIT_PLAN: { templateId: number; startK: number; misses: number[]; hh: number; mm: number }[] = [
  { templateId: 31, startK: -56, misses: [-51, -44], hh: 7, mm: 40 }, // Complete Your Check-In (ticked by the check-in)
  { templateId: 25, startK: -37, misses: [], hh: 20, mm: 30 },        // Digital Detox Before Bed
  { templateId: 36, startK: -50, misses: [-44, -39, -33, -22], hh: 17, mm: 45 }, // Stay Hydrated
  { templateId: 30, startK: -37, misses: [-31, -26, -18, -12], hh: 7, mm: 25 },  // Practise Mindfulness
];
const CHECK_IN_MISSES = new Set([-51, -44]);

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
async function resyncSequences(): Promise<void> {
  const tables = [
    "check_ins", "wearable_connections", "wearable_metrics_daily", "wearable_workouts", "habits", "habit_completions",
    "goals", "bodyweight_entries", "user_program_enrollments", "enrollment_workouts", "enrollment_workout_blocks",
    "enrollment_block_exercises", "workout_logs", "workout_exercise_logs", "workout_set_logs", "exercise_snapshots",
    "burnout_scores", "burnout_settings", "recovery_mode_periods", "physiological_snapshots", "daily_readiness_history",
    "user_physiological_baselines", "cycle_settings", "cycle_logs", "coach_memory", "user_track_streaks",
    "engagement_activity_log", "companies", "community_challenges", "community_challenge_participants",
    "community_challenge_scores", "reward_programs", "reward_consent", "reward_period_results", "user_badges", "notifications",
  ];
  for (const t of tables) {
    try {
      await pool.query(`SELECT setval(pg_get_serial_sequence('${t}','id'), (SELECT COALESCE(MAX(id),1) FROM ${t}))`);
    } catch {
      // table missing on this install, or no serial id: nothing to resync
    }
  }
}

type Ctx = { userId: string; tz: string; t0: string; today: string };

async function loadCtx(): Promise<Ctx | null> {
  const { rows } = await pool.query(`SELECT id, timezone, created_at FROM users WHERE id = $1`, [DEMO_SARAH_ID]);
  if (!rows[0]) return null;
  const tz = rows[0].timezone || DEFAULT_TZ;
  const t0 = addDays(keyInTz(new Date(rows[0].created_at), DEFAULT_TZ), CREATED_DAYS_AGO);
  return { userId: DEMO_SARAH_ID, tz, t0, today: keyInTz(new Date(), tz) };
}

async function upsertWearableRow(userId: string, key: string, m: DayMetrics, raw: any): Promise<void> {
  await pool.query(
    `INSERT INTO wearable_metrics_daily
       (user_id, provider, date, sleep_minutes, sleep_deep_minutes, sleep_rem_minutes, sleep_light_minutes, sleep_awake_minutes,
        hrv_ms, resting_hr_bpm, steps, active_minutes, calories_burned, raw, created_at, updated_at)
     VALUES ($1,'apple_health',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now(), now())
     ON CONFLICT (user_id, date, provider) DO UPDATE SET
       sleep_minutes = EXCLUDED.sleep_minutes, sleep_deep_minutes = EXCLUDED.sleep_deep_minutes,
       sleep_rem_minutes = EXCLUDED.sleep_rem_minutes, sleep_light_minutes = EXCLUDED.sleep_light_minutes,
       sleep_awake_minutes = EXCLUDED.sleep_awake_minutes, hrv_ms = EXCLUDED.hrv_ms, resting_hr_bpm = EXCLUDED.resting_hr_bpm,
       steps = EXCLUDED.steps, active_minutes = EXCLUDED.active_minutes, calories_burned = EXCLUDED.calories_burned,
       raw = EXCLUDED.raw, updated_at = now()`,
    [userId, key, m.sleepMinutes, m.deep, m.rem, m.light, m.awake, m.hrv, m.rhr, m.steps, m.activeMinutes, m.kcal, JSON.stringify(raw)],
  );
}

async function upsertColleagueSteps(key: string, fraction: number): Promise<void> {
  const wd = weekday(key);
  const weekend = wd === 0 || wd === 6;
  for (let i = 0; i < COLLEAGUE_IDS.length; i++) {
    const id = COLLEAGUE_IDS[i];
    const steps = Math.round(Math.max(1500, COLLEAGUE_BASE_STEPS[i] + 1700 * gauss(`${id}|${key}`) - (weekend ? 1200 : 0)) * fraction);
    await pool.query(
      `INSERT INTO wearable_metrics_daily (user_id, provider, date, steps, active_minutes, raw, created_at, updated_at)
       SELECT $1::varchar, 'apple_health', $2::text, $3::int, $4::int, $5::jsonb, now(), now()
       WHERE EXISTS (SELECT 1 FROM users WHERE id = $1::varchar)
       ON CONFLICT (user_id, date, provider) DO UPDATE SET steps = EXCLUDED.steps, active_minutes = EXCLUDED.active_minutes,
         raw = EXCLUDED.raw, updated_at = now()`,
      [id, key, steps, Math.round(steps / 280), JSON.stringify({ demoSeed: DEMO_TAG, partial: fraction < 1 })],
    );
  }
}

async function completedWorkoutDays(c: Ctx): Promise<Set<string>> {
  const { rows } = await pool.query(`SELECT completed_at FROM workout_logs WHERE user_id = $1 AND status = 'completed' AND completed_at IS NOT NULL`, [c.userId]);
  return new Set(rows.map((r: any) => keyInTz(new Date(r.completed_at), c.tz)));
}
async function runDays(c: Ctx): Promise<Set<string>> {
  const { rows } = await pool.query(`SELECT started_at FROM wearable_workouts WHERE user_id = $1`, [c.userId]);
  return new Set(rows.map((r: any) => keyInTz(new Date(r.started_at), c.tz)));
}

async function insertCheckIn(c: Ctx, key: string, exercisedYesterday: boolean): Promise<number | null> {
  const k = diffDays(key, c.t0);
  const m = checkInModel(key, k, exercisedYesterday);
  const at = localTime(key, c.tz, 12, 0);
  const submitted = localTime(key, c.tz, 7, 35 + Math.floor(hash01(`${key}|cit`) * 20));
  const { rows } = await pool.query(
    `INSERT INTO check_ins
       (user_id, check_in_date, week, mood_score, energy_score, stress_score, sleep_score, clarity_score,
        headache, alcohol, alcohol_count, sick, pain_or_injury, emotionally_stable, anxious, overwhelmed,
        exercised_yesterday, caffeine_after_2pm, practiced_mindfulness, fatigue, fatigue_trigger_met,
        perceived_control_score, perceived_control_trigger_met, energy_level, stress_management, completed, notes, created_at)
     VALUES ($1,$2,0,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,'',true,$24,$25)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      c.userId, at, m.moodScore, m.energyScore, m.stressScore, m.sleepScore, m.clarityScore,
      m.headache, m.alcohol, m.alcoholCount, m.sick, m.painOrInjury, m.emotionallyStable, m.anxious, m.overwhelmed,
      m.exercisedYesterday, m.caffeineAfter2pm, m.practicedMindfulness, m.fatigue, m.fatigueTriggerMet,
      m.perceivedControlScore, m.perceivedControlTriggerMet, m.energyScore, m.notes, submitted,
    ],
  );
  const id = rows[0]?.id ?? null;
  if (id) {
    await pool.query(
      `INSERT INTO engagement_activity_log (user_id, activity_type, metadata, created_at) VALUES ($1,'daily_checkin',$2,$3)`,
      [c.userId, JSON.stringify({ checkInId: id }), submitted],
    ).catch(() => {});
  }
  return id;
}

async function tickHabits(c: Ctx, key: string, history: boolean): Promise<void> {
  const k = diffDays(key, c.t0);
  const { rows: habitRows } = await pool.query(
    `SELECT id, template_id AS "templateId" FROM habits WHERE user_id = $1 AND is_active = true`,
    [c.userId],
  );
  for (const h of habitRows) {
    const plan = HABIT_PLAN.find((p) => p.templateId === h.templateId);
    if (!plan) continue;
    if (history && (k < plan.startK || plan.misses.includes(k))) continue;
    const { rows: already } = await pool.query(
      `SELECT 1 FROM habit_completions WHERE habit_id = $1 AND completed_date >= $2 AND completed_date < $3 LIMIT 1`,
      [h.id, localTime(key, c.tz, 0, 0), localTime(addDays(key, 1), c.tz, 0, 0)],
    );
    if (already.length) continue;
    const at = localTime(key, c.tz, plan.hh, plan.mm + Math.floor(hash01(`${key}|h${plan.templateId}`) * 12));
    await pool.query(
      `INSERT INTO habit_completions (habit_id, user_id, completed_date, created_at) VALUES ($1,$2,$3,$3)`,
      [h.id, c.userId, at],
    );
    await pool.query(`UPDATE habits SET last_completed_date = GREATEST(COALESCE(last_completed_date, $2), $2) WHERE id = $1`, [h.id, at]);
  }
}

async function getEnrollment(c: Ctx): Promise<{ id: number; startKey: string; programId: number } | null> {
  const { rows } = await pool.query(
    `SELECT id, start_date, program_id FROM user_program_enrollments
     WHERE user_id = $1 AND program_type = 'main' AND status = 'active' ORDER BY id DESC LIMIT 1`,
    [c.userId],
  );
  if (!rows[0]) return null;
  return { id: rows[0].id, startKey: new Date(rows[0].start_date).toISOString().slice(0, 10), programId: rows[0].program_id };
}

type Session = { id: number; templateWorkoutId: number; week: number; day: number; name: string; duration: number; workoutType: string; date: string };
async function programmeSessions(enrollmentId: number, startKey: string): Promise<Session[]> {
  const { rows } = await pool.query(
    `SELECT id, template_workout_id AS "templateWorkoutId", week_number AS week, day_number AS day, name,
            duration, workout_type AS "workoutType", position
     FROM enrollment_workouts WHERE enrollment_id = $1
     ORDER BY week_number, day_number, position`,
    [enrollmentId],
  );
  const seen = new Set<string>();
  const out: Session[] = [];
  for (const r of rows) {
    const slot = `${r.week}:${r.day}`;
    if (seen.has(slot)) continue;
    seen.add(slot);
    out.push({ ...r, date: addDays(startKey, (r.week - 1) * 7 + (r.day - 1)) });
  }
  return out;
}

async function logProgrammeSession(c: Ctx, enrollment: { id: number; programId: number }, s: Session): Promise<boolean> {
  const { rows: done } = await pool.query(
    `SELECT 1 FROM workout_logs WHERE enrollment_id = $1 AND week = $2 AND day = $3 AND status = 'completed' LIMIT 1`,
    [enrollment.id, s.week, s.day],
  );
  if (done.length) return false;

  const { storage } = await import("./storage");
  const startedAt = localTime(s.date, c.tz, 7, 2 + Math.floor(hash01(`${s.date}|wst`) * 20));
  const durationSec = Math.round((s.duration || 30) * 60 + 90 + 110 * gauss(`${s.date}|wdur`));
  const rating = 6 + Math.floor(hash01(`${s.date}|wr`) * 3);

  const { rows: logRows } = await pool.query(
    `INSERT INTO workout_logs (user_id, workout_id, workout_type, workout_name, programme_id, enrollment_id, week, day,
                               started_at, status, workout_style, created_at)
     VALUES ($1,$2,'programme',$3,$4,$5,$6,$7,$8,'in_progress',$9,$8) RETURNING id`,
    [c.userId, s.templateWorkoutId, s.name, enrollment.programId, enrollment.id, s.week, s.day, startedAt, s.workoutType || "regular"],
  );
  const logId = logRows[0].id as number;

  const { rows: exRows } = await pool.query(
    `SELECT b.id AS "blockId", b.section, b.block_type AS "blockType", b.rest,
            e.exercise_library_id AS "libId", e.sets, e.duration_type AS "durationType",
            el.name, el.exercise_type AS "exerciseType",
            (SELECT count(*) FROM enrollment_block_exercises e2 WHERE e2.enrollment_block_id = b.id)::int AS "blockSize"
     FROM enrollment_workout_blocks b
     JOIN enrollment_block_exercises e ON e.enrollment_block_id = b.id
     LEFT JOIN exercise_library el ON el.id = e.exercise_library_id
     WHERE b.enrollment_workout_id = $1 AND COALESCE(b.section, 'main') <> 'warmup'
     ORDER BY b.position, e.position`,
    [s.id],
  );

  let position = 0;
  for (const ex of exRows) {
    const name = ex.name || "Exercise";
    const timed = ex.durationType === "timer" || ex.durationType === "time" || /timed/.test(String(ex.exerciseType || ""));
    const { rows: elRows } = await pool.query(
      `INSERT INTO workout_exercise_logs (workout_log_id, exercise_library_id, exercise_name, block_type, block_group_id, section,
                                          position, rest_period, duration_type, exercise_type, kind, created_at)
       VALUES ($1,$2,$3,$4,$5,'main',$6,$7,$8,$9,'exercise',$10) RETURNING id`,
      [
        logId, ex.libId, name, ex.blockType || "single", ex.blockSize > 1 ? `block-${ex.blockId}` : null,
        position++, ex.rest || null, timed ? "timer" : "text", ex.exerciseType || "strength", startedAt,
      ],
    );
    const exLogId = elRows[0].id as number;
    const sets: any[] = Array.isArray(ex.sets) && ex.sets.length ? ex.sets : [{ reps: "10" }, { reps: "10" }, { reps: "10" }];
    const weight = timed ? null : weightFor(ex.libId, name, s.week);
    for (let i = 0; i < sets.length; i++) {
      const set = sets[i] || {};
      const secs = timed ? secondsFor(set.duration || set.reps) : null;
      const reps = timed ? null : repsFor(set.reps, s.week);
      const hard = i === sets.length - 1 && hash01(`${s.date}|${exLogId}|${i}`) < 0.4;
      await pool.query(
        `INSERT INTO workout_set_logs (exercise_log_id, set_number, target_reps, actual_reps, actual_weight, target_duration,
                                       actual_duration, actual_duration_seconds, is_completed, side, set_difficulty_rating, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,'bilateral',$9,$10)`,
        [
          exLogId, i + 1, set.reps != null ? String(set.reps) : null, reps, weight,
          timed ? String(set.duration || set.reps || "") : null, secs != null ? `${secs}sec` : null, secs,
          hard ? "hard" : "medium", startedAt,
        ],
      );
    }
  }

  await storage.completeWorkoutLogWithRating(logId, rating, durationSec);
  const completedAt = new Date(startedAt.getTime() + durationSec * 1000);
  await pool.query(`UPDATE workout_logs SET completed_at = $2 WHERE id = $1`, [logId, completedAt]);
  await pool.query(
    `INSERT INTO engagement_activity_log (user_id, activity_type, metadata, created_at) VALUES ($1,'workout',$2,$3)`,
    [c.userId, JSON.stringify({ workoutLogId: logId }), completedAt],
  ).catch(() => {});
  return true;
}

async function fixExerciseSnapshots(c: Ctx): Promise<void> {
  await pool.query(
    `UPDATE exercise_snapshots es SET
       last_performed_at = sub.last_at,
       frequency_count_7_days = sub.n7,
       frequency_count_30_days = sub.n30,
       updated_at = now()
     FROM (
       SELECT wel.exercise_library_id AS lib, MAX(wl.completed_at) AS last_at,
              COUNT(DISTINCT wl.id) FILTER (WHERE wl.completed_at >= now() - interval '7 days')::int AS n7,
              COUNT(DISTINCT wl.id) FILTER (WHERE wl.completed_at >= now() - interval '30 days')::int AS n30
       FROM workout_logs wl JOIN workout_exercise_logs wel ON wel.workout_log_id = wl.id
       WHERE wl.user_id = $1 AND wl.status = 'completed' AND wel.exercise_library_id IS NOT NULL
       GROUP BY wel.exercise_library_id
     ) sub
     WHERE es.user_id = $1 AND es.exercise_library_id = sub.lib`,
    [c.userId],
  );
}

function streakEnding(days: Set<string>, endKey: string): { current: number; longest: number; last: string | null } {
  const sorted = [...days].sort();
  let longest = 0, run = 0, prev: string | null = null;
  for (const d of sorted) {
    run = prev && diffDays(d, prev) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  let current = 0;
  let cursor = days.has(endKey) ? endKey : addDays(endKey, -1);
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, longest: Math.max(longest, current), last: sorted.length ? sorted[sorted.length - 1] : null };
}

async function refreshStreaks(c: Ctx): Promise<void> {
  const { storage } = await import("./storage");
  const { rows: ci } = await pool.query(`SELECT check_in_date FROM check_ins WHERE user_id = $1`, [c.userId]);
  const ciDays = new Set<string>(ci.map((r: any) => keyInTz(new Date(r.check_in_date), c.tz)));
  const wDays = await completedWorkoutDays(c);
  for (const [track, days] of [["checkin", ciDays], ["movement", wDays]] as const) {
    const st = streakEnding(days, c.today);
    await pool.query(
      `INSERT INTO user_track_streaks (user_id, track, current_streak, longest_streak, last_activity_date, freezes_available, updated_at)
       VALUES ($1,$2,$3,$4,$5,0,now())
       ON CONFLICT (user_id, track) DO UPDATE SET current_streak = EXCLUDED.current_streak,
         longest_streak = GREATEST(user_track_streaks.longest_streak, EXCLUDED.longest_streak),
         last_activity_date = EXCLUDED.last_activity_date, updated_at = now()`,
      [c.userId, track, st.current, st.longest, st.last],
    );
  }
  const { rows: habitRows } = await pool.query(`SELECT id FROM habits WHERE user_id = $1`, [c.userId]);
  for (const h of habitRows) await storage.updateHabitStreak(h.id);
  await storage.recalculateUserStreak(c.userId);
}

// ---------------------------------------------------------------------------
// Today's wearable row. Called by the top-up and by Daily Readiness before it
// scores today, so a poor check-in gives a poor night.
// ---------------------------------------------------------------------------
export async function syncDemoTodayWearable(userId: string, dateKey: string): Promise<void> {
  if (userId !== DEMO_SARAH_ID) return;
  const c = await loadCtx();
  if (!c) return;
  const k = diffDays(dateKey, c.t0);
  const { rows: ci } = await pool.query(
    `SELECT sleep_score, energy_score FROM check_ins WHERE user_id = $1 AND check_in_date >= $2 AND check_in_date < $3
     ORDER BY check_in_date DESC LIMIT 1`,
    [userId, localTime(dateKey, c.tz, 0, 0), localTime(addDays(dateKey, 1), c.tz, 0, 0)],
  );
  const poorNight = !!ci[0] && ((ci[0].sleep_score ?? 3) <= 2 || (ci[0].energy_score ?? 3) <= 2);
  const isToday = dateKey === c.today;
  const fraction = isToday ? clamp((localHour(new Date(), c.tz) - 6.5) / 15, 0.05, 1) : 1;
  const trained = (await completedWorkoutDays(c)).has(dateKey);
  const ran = (await runDays(c)).has(dateKey);
  await upsertWearableRow(userId, dateKey, dayMetrics(dateKey, k, { trained, ran, poorNight, fraction }), {
    demoSeed: DEMO_TAG, poorNight, partial: isToday,
  });
  if (isToday) {
    await pool.query(
      `UPDATE wearable_connections SET last_sync_at = now(), last_sync_status = 'ok', updated_at = now()
       WHERE user_id = $1 AND provider = 'apple_health'`,
      [userId],
    );
    const ch = await demoChallengeWindow();
    if (ch && dateKey >= ch.start && dateKey <= ch.end) await upsertColleagueSteps(dateKey, fraction);
  }
}

// ---------------------------------------------------------------------------
// Top-up: fill every day since the last one, so nothing goes stale.
// ---------------------------------------------------------------------------
let topUpRunning: Promise<{ daysFilled: number; latestKey: string | null }> | null = null;

export function topUpSarahDemo(reason: string): Promise<{ daysFilled: number; latestKey: string | null }> {
  if (!topUpRunning) {
    topUpRunning = doTopUp(reason)
      .catch((e: any) => {
        console.error(`[app-demo] top-up (${reason}) failed:`, e?.message || e);
        return { daysFilled: 0, latestKey: null };
      })
      .finally(() => { topUpRunning = null; });
  }
  return topUpRunning;
}

async function doTopUp(reason: string): Promise<{ daysFilled: number; latestKey: string | null }> {
  const c = await loadCtx();
  if (!c) return { daysFilled: 0, latestKey: null };
  const yesterday = addDays(c.today, -1);
  // Only days from the seed day on are filled; the seeded history stays as it is.
  const windowStart = [addDays(c.today, -21), c.t0].sort()[1];
  const touched = new Set<string>();

  // Programme sessions that were due and not done.
  const enrollment = await getEnrollment(c);
  if (enrollment) {
    const due = (await programmeSessions(enrollment.id, enrollment.startKey))
      .filter((s) => s.date >= windowStart && s.date <= yesterday);
    for (const s of due) if (await logProgrammeSession(c, enrollment, s)) touched.add(s.date);
  }

  // A check-in for every day without one; habit ticks for the last week.
  const { rows: ciRows } = await pool.query(
    `SELECT check_in_date FROM check_ins WHERE user_id = $1 AND check_in_date >= $2`,
    [c.userId, localTime(windowStart, c.tz, 0, 0)],
  );
  const ciDays = new Set<string>(ciRows.map((r: any) => keyInTz(new Date(r.check_in_date), c.tz)));
  const wDays = await completedWorkoutDays(c);
  let filled = 0;
  for (let key = windowStart; key <= yesterday; key = addDays(key, 1)) {
    if (!ciDays.has(key)) {
      if (await insertCheckIn(c, key, wDays.has(addDays(key, -1)))) filled++;
      touched.add(key);
    }
    if (key >= addDays(c.today, -7)) await tickHabits(c, key, false);
  }

  // Wearable rows: any missing or part-day row before today, then today.
  const { rows: wRows } = await pool.query(
    `SELECT date, raw->>'partial' AS partial FROM wearable_metrics_daily
     WHERE user_id = $1 AND provider = 'apple_health' AND date >= $2`,
    [c.userId, windowStart],
  );
  const have = new Map<string, boolean>(wRows.map((r: any) => [r.date, r.partial === "true"]));
  for (let key = windowStart; key < c.today; key = addDays(key, 1)) {
    if (!have.has(key) || have.get(key) || touched.has(key)) {
      await syncDemoTodayWearable(c.userId, key);
      touched.add(key);
    }
  }
  await syncDemoTodayWearable(c.userId, c.today);

  // Colleagues' steps for the challenge days.
  const ch = await demoChallengeWindow();
  if (ch) {
    const from = [windowStart, ch.start].sort()[1];
    const to = [yesterday, ch.end].sort()[0];
    const { rows: cRows } = await pool.query(
      `SELECT date, COUNT(*) FILTER (WHERE COALESCE(raw->>'partial','false') <> 'true')::int AS full
       FROM wearable_metrics_daily WHERE user_id = ANY($1::varchar[]) AND raw->>'demoSeed' = $2 AND date >= $3
       GROUP BY date`,
      [COLLEAGUE_IDS, DEMO_TAG, from],
    );
    const fullDays = new Map<string, number>(cRows.map((r: any) => [r.date, r.full]));
    for (let key = from; key <= to; key = addDays(key, 1)) {
      if ((fullDays.get(key) ?? 0) < COLLEAGUE_IDS.length) await upsertColleagueSteps(key, 1);
    }
  }

  if (touched.size > 0) {
    const { updateUserBaselines } = await import("./baselineEngine");
    await updateUserBaselines(c.userId).catch(() => {});
    const dr = await import("./dailyReadiness");
    for (const key of [...touched].filter((k) => k < c.today).sort()) {
      await dr.computeAndStoreForUserDay(c.userId, key, { tz: c.tz }).catch(() => {});
    }
    await fixExerciseSnapshots(c);
    await refreshStreaks(c);
  }
  console.log(`[app-demo] top-up (${reason}): ${filled} check-in(s) filled, ${touched.size} day(s) touched, wearables to ${c.today}`);
  return { daysFilled: Math.max(filled, touched.size), latestKey: c.today };
}

async function demoChallengeWindow(): Promise<{ start: string; end: string } | null> {
  try {
    const { rows } = await pool.query(
      `SELECT start_date, end_date FROM community_challenges
       WHERE title = $1 AND created_by = ANY($2::varchar[]) AND is_hidden = false ORDER BY id DESC LIMIT 1`,
      [CHALLENGE_TITLE, COLLEAGUE_IDS],
    );
    return rows[0] ? { start: rows[0].start_date, end: rows[0].end_date } : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// The one-off seed.
// ---------------------------------------------------------------------------
async function seedAll(): Promise<void> {
  const { storage } = await import("./storage");
  const tz = DEFAULT_TZ;
  const t0 = keyInTz(new Date(), tz);
  const kOf = (key: string) => diffDays(key, t0);
  const keyOf = (k: number) => addDays(t0, k);

  await resyncSequences();
  try {
    const { ensureActivityLogOnce } = await import("./engagementEngine");
    await ensureActivityLogOnce();
  } catch {
    // engagement log is optional for the demo
  }

  // --- Company row (needed for company-only challenges) ---
  let companyId: number | null = null;
  const { rows: co } = await pool.query(`SELECT id FROM companies WHERE name = $1 ORDER BY id LIMIT 1`, [COMPANY]);
  if (co[0]) companyId = co[0].id;
  else {
    const { rows: ins } = await pool.query(
      `INSERT INTO companies (name, industry, status, notes, join_date) VALUES ($1,'Professional services','active',$2, now()) RETURNING id`,
      [COMPANY, "Demo company for website screenshots (seeded). Not a customer."],
    );
    companyId = ins[0].id;
  }

  // --- Sarah ---
  const createdAt = localTime(keyOf(-CREATED_DAYS_AGO), tz, 9, 12);
  await pool.query(
    `INSERT INTO users (id, email, password, first_name, last_name, company_name, company_id, display_name, date_of_birth, gender,
                        height, height_unit, role, is_admin, weight_unit, distance_unit, onboarding_completed, onboarding_data,
                        welcome_seen_at, dismissed_connect_nudge, timezone, signup_source, created_at, updated_at)
     VALUES ($1,$2,NULL,'Sarah','Brennan',$3,$4,'Sarah Brennan','1988-04-21','female',167,'cm','user',false,'kg','km',true,$5,$6,true,$7,'demo-seed',$6,$6)`,
    [
      DEMO_SARAH_ID, EMAIL, COMPANY, companyId,
      JSON.stringify({
        coaching: {
          experienceLevel: "intermediate", trainingEnvironment: "Home", equipment: ["Dumbbells", "Bench", "Resistance bands"],
          timeAvailability: "15-30 min", workoutFrequency: "3 days", sleepHours: "6–7 hours", stressLevel: "High",
          deskBased: "Yes", hasPainOrInjury: true, painAreas: ["lower_back"], primaryGoal: "general_strength",
        },
        demoSeed: DEMO_TAG,
      }),
      createdAt, tz,
    ],
  );

  // --- Programme: Strength at Home, started on the Monday about five weeks ago ---
  const { rows: prog } = await pool.query(`SELECT id FROM programs WHERE title = 'Strength at Home' AND archived = false ORDER BY id LIMIT 1`);
  const programId: number | null = prog[0]?.id ?? null;
  let sessions: Session[] = [];
  let enrollment: { id: number; startKey: string; programId: number } | null = null;
  if (programId) {
    const startKey = mondayOnOrBefore(keyOf(-37));
    const e = await storage.enrollUserInProgram(DEMO_SARAH_ID, programId, new Date(`${startKey}T12:00:00Z`));
    enrollment = { id: e.id, startKey: new Date(e.startDate).toISOString().slice(0, 10), programId };
    // Her own copy uses the goblet squat in place of the dumbbell front squat.
    await pool.query(
      `UPDATE enrollment_block_exercises SET exercise_library_id = (SELECT id FROM exercise_library WHERE name = 'Dumbbell Goblet Squat' LIMIT 1)
       WHERE exercise_library_id = (SELECT id FROM exercise_library WHERE name = 'Dumbbell Front Squat' LIMIT 1)
         AND EXISTS (SELECT 1 FROM exercise_library WHERE name = 'Dumbbell Goblet Squat')
         AND enrollment_block_id IN (
           SELECT b.id FROM enrollment_workout_blocks b JOIN enrollment_workouts w ON w.id = b.enrollment_workout_id
           WHERE w.enrollment_id = $1)`,
      [enrollment.id],
    );
    sessions = await programmeSessions(enrollment.id, enrollment.startKey);
  }
  // One missed session (week 2, last day) during the worst week.
  const week2Days = sessions.filter((s) => s.week === 2).map((s) => s.day);
  const skipSlot = week2Days.length ? `2:${Math.max(...week2Days)}` : "";
  const pastSessions = sessions.filter((s) => s.date < t0 && `${s.week}:${s.day}` !== skipSlot);
  const trainingDays = new Set(pastSessions.map((s) => s.date));

  // --- Apple Watch runs: the last two Saturdays ---
  const runKeys: string[] = [];
  for (let k = -14; k <= -1; k++) if (weekday(keyOf(k)) === 6) runKeys.push(keyOf(k));
  const runDaysSet = new Set(runKeys);

  // --- Apple Health connection + daily data ---
  await pool.query(
    `INSERT INTO wearable_connections (user_id, provider, status, connected_at, last_sync_at, last_sync_status, created_at, updated_at)
     VALUES ($1,'apple_health','connected',$2,now(),'ok',$2,now())`,
    [DEMO_SARAH_ID, localTime(keyOf(-HISTORY_DAYS - 1), tz, 9, 30)],
  );
  for (let k = -HISTORY_DAYS; k <= -1; k++) {
    const key = keyOf(k);
    await upsertWearableRow(DEMO_SARAH_ID, key, dayMetrics(key, k, { trained: trainingDays.has(key), ran: runDaysSet.has(key) }), { demoSeed: DEMO_TAG });
  }
  for (const [i, key] of runKeys.entries()) {
    const start = localTime(key, tz, 9, 20 + i * 7);
    const minutes = 29 + i * 2;
    await pool.query(
      `INSERT INTO wearable_workouts (user_id, provider, started_at, ended_at, type, duration_minutes, distance_meters,
                                      active_energy_kcal, average_heart_rate, raw, created_at, updated_at)
       VALUES ($1,'apple_health',$2,$3,'running',$4,$5,$6,$7,$8,now(),now()) ON CONFLICT DO NOTHING`,
      [DEMO_SARAH_ID, start, new Date(start.getTime() + minutes * 60000), minutes, 4800 + i * 550, 300 + i * 30, 154 - i * 2,
        JSON.stringify({ demoSeed: DEMO_TAG, sourceName: "Apple Watch" })],
    );
  }

  const ctx: Ctx = { userId: DEMO_SARAH_ID, tz, t0, today: t0 };

  // --- Programme sessions done so far ---
  if (enrollment) {
    for (const s of pastSessions) await logProgrammeSession(ctx, enrollment, s);
    await fixExerciseSnapshots(ctx);
  }

  // --- Habits (from the library) ---
  const { rows: templates } = await pool.query(
    `SELECT id, title, COALESCE(short_description, description) AS description, category, icon FROM habit_templates WHERE id = ANY($1::int[])`,
    [HABIT_PLAN.map((p) => p.templateId)],
  );
  for (const plan of HABIT_PLAN) {
    const t = templates.find((x: any) => x.id === plan.templateId);
    if (!t) continue;
    const start = localTime(keyOf(plan.startK), tz, 7, 0);
    await pool.query(
      `INSERT INTO habits (user_id, template_id, title, description, category, icon, start_date, duration, days_of_week,
                           is_custom, is_active, current_streak, longest_streak, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,26,'Everyday',false,true,0,0,$7)`,
      [DEMO_SARAH_ID, t.id, t.title, t.description, t.category, t.icon, start],
    );
  }

  // --- Daily check-ins, habit ticks ---
  for (let k = -HISTORY_DAYS; k <= -1; k++) {
    const key = keyOf(k);
    if (!CHECK_IN_MISSES.has(k)) await insertCheckIn(ctx, key, trainingDays.has(addDays(key, -1)));
    await tickHabits(ctx, key, true);
  }

  // --- Body weight and a weight goal ---
  const weightKs: number[] = [];
  for (let k = -HISTORY_DAYS; k <= -4; k += 4) weightKs.push(k);
  weightKs.push(-1);
  let latestWeight = 72.8;
  for (const k of weightKs) {
    const key = keyOf(k);
    const p = (k + HISTORY_DAYS) / (HISTORY_DAYS - 1);
    latestWeight = Math.round((72.8 - 3.1 * p + 0.18 * gauss(`${key}|kg`)) * 10) / 10;
    await pool.query(
      `INSERT INTO bodyweight_entries (user_id, weight, date, notes, created_at) VALUES ($1,$2,$3,NULL,$3)`,
      [DEMO_SARAH_ID, latestWeight, localTime(key, tz, 7, 10)],
    );
  }
  await pool.query(
    `INSERT INTO goals (user_id, type, title, description, target_value, current_value, starting_value, unit, start_date, deadline,
                        progress, is_completed, template_id, created_at, updated_at)
     VALUES ($1,'bodyweight','Lose Weight',$2,69,$3,72.8,'kg',$4,$5,$6,false,'weight-loss',$4,now())`,
    [
      DEMO_SARAH_ID, "Build a sustainable approach to body composition through training, nutrition and daily movement.",
      latestWeight, localTime(keyOf(-HISTORY_DAYS), tz, 7, 0), localTime(keyOf(40), tz, 12, 0),
      Math.round(clamp(((72.8 - latestWeight) / (72.8 - 69)) * 100, 0, 100)),
    ],
  );

  // --- Cycle tracker ---
  await pool.query(
    `INSERT INTO cycle_settings (user_id, enabled, avg_cycle_length, avg_period_length, updated_at) VALUES ($1,true,29,5,now())`,
    [DEMO_SARAH_ID],
  );
  const periods: { k: number; len: number; flow: string; symptoms: string[] }[] = [
    { k: -73, len: 5, flow: "medium", symptoms: ["Cramps", "Fatigue"] },
    { k: -45, len: 5, flow: "heavy", symptoms: ["Cramps", "Back pain", "Bloating", "Insomnia"] },
    { k: -16, len: 4, flow: "medium", symptoms: ["Cramps", "Fatigue"] },
  ];
  for (const p of periods) {
    await pool.query(
      `INSERT INTO cycle_logs (user_id, period_start, period_end, flow, symptoms, notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,NULL,$6,$6)`,
      [DEMO_SARAH_ID, keyOf(p.k), keyOf(p.k + p.len - 1), p.flow, p.symptoms, localTime(keyOf(Math.max(p.k, -CREATED_DAYS_AGO)), tz, 8, 0)],
    );
  }

  // --- Coach memories ---
  for (const m of COACH_MEMORIES) {
    const at = localTime(keyOf(-m.daysAgo), tz, 19, 5);
    await pool.query(
      `INSERT INTO coach_memory (user_id, key, value, category, source, importance, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'chat',$5,$6,$6) ON CONFLICT DO NOTHING`,
      [DEMO_SARAH_ID, m.key, m.value, m.category, m.importance, at],
    );
  }

  // --- Baselines, then Daily Readiness for every past day ---
  const { updateUserBaselines } = await import("./baselineEngine");
  await updateUserBaselines(DEMO_SARAH_ID);
  const dr = await import("./dailyReadiness");
  for (let k = -HISTORY_DAYS; k <= -1; k++) {
    await dr.computeAndStoreForUserDay(DEMO_SARAH_ID, keyOf(k), { tz }).catch((e: any) =>
      console.warn(`[app-demo] readiness ${keyOf(k)} failed:`, e?.message));
  }

  // --- Burnout Index history, physiological snapshots, Recovery Mode ---
  // Where today's live score will land, so the history runs into it smoothly.
  let liveScore: number | null = null;
  let liveDrivers: any[] = [];
  try {
    const { computeBurnoutScore } = await import("./burnoutEngine");
    const { getRecentWearableMetrics } = await import("./wearables");
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const [checkInData, workoutLogData, bodyMapData, sleepData, stepData, wearable, baselines] = await Promise.all([
      storage.getCheckInsInRange(DEMO_SARAH_ID, start, end),
      storage.getUserWorkoutLogs(DEMO_SARAH_ID, 100),
      storage.getBodyMapLogs(DEMO_SARAH_ID),
      storage.getSleepEntries(DEMO_SARAH_ID, 60),
      storage.getStepEntries(DEMO_SARAH_ID, 60),
      getRecentWearableMetrics(DEMO_SARAH_ID, 30),
      storage.getUserPhysiologicalBaselines(DEMO_SARAH_ID),
    ]);
    const result = computeBurnoutScore({
      checkIns: checkInData, workoutLogs: workoutLogData, bodyMapLogs: bodyMapData, sleepEntries: sleepData,
      stepEntries: stepData, wearableMetrics: wearable.rows, baselines: baselines ?? null, notesAggregate: null,
    } as any);
    liveScore = result.score;
    liveDrivers = result.topDrivers as any[];
  } catch (e: any) {
    console.warn("[app-demo] live burnout preview failed:", e?.message || e);
  }
  const { getLevel } = await import("./burnoutCalibration");
  const rawScore = (k: number) => clamp(Math.round(31 + 35 * stressOn(keyOf(k), k) + 1.5 * gauss(`${keyOf(k)}|b`)), 5, 95);
  const lastRaw = rawScore(-1);
  const scoreAt = (k: number) => {
    const base = rawScore(k);
    if (liveScore == null || k < -8) return base;
    const w = (k + 8) / 8; // 0 at k=-8, almost 1 at k=-1
    return clamp(Math.round(base + (liveScore - lastRaw) * w), 5, 95);
  };
  const { rows: ciDates } = await pool.query(`SELECT check_in_date FROM check_ins WHERE user_id = $1`, [DEMO_SARAH_ID]);
  const ciTimes = ciDates.map((r: any) => new Date(r.check_in_date).getTime());
  for (let k = -HISTORY_DAYS + 2; k <= -1; k++) {
    const key = keyOf(k);
    const s = stressOn(key, k);
    const score = scoreAt(k);
    const at = localTime(key, tz, 8, 15);
    const trajectory = k < -42 ? "rising" : k <= -36 ? "elevated" : k <= -10 ? "recovering" : "stable";
    const windowStart = at.getTime() - 30 * 86400000;
    const checkInCount = ciTimes.filter((t: number) => t >= windowStart && t <= at.getTime()).length;
    await pool.query(
      `INSERT INTO burnout_scores (user_id, score, trajectory, confidence, top_drivers, rolling_window_days, computed_date,
                                   check_in_count, data_source_count, created_at)
       VALUES ($1,$2,$3,$4,$5,30,$6,$7,3,$6)`,
      [DEMO_SARAH_ID, score, trajectory, k < -45 ? "medium" : "high", JSON.stringify(liveDrivers), at, checkInCount],
    );
    const hrvZ = Math.round((0.4 - 2.1 * s + 0.2 * gauss(`${key}|hz`)) * 100) / 100;
    const rhrZ = Math.round((-0.3 + 1.9 * s + 0.2 * gauss(`${key}|rz`)) * 100) / 100;
    const flags = [...(hrvZ < -1.2 ? ["hrv_suppressed"] : []), ...(rhrZ > 1.2 ? ["rhr_elevated"] : [])];
    await pool.query(
      `INSERT INTO physiological_snapshots (user_id, computed_at, hrv_z_score, rhr_z_score, baseline_calibrated, warning_fired,
                                            warning_flags, score, tier, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$2)`,
      [DEMO_SARAH_ID, at, hrvZ, rhrZ, k >= -42, flags.length > 0, JSON.stringify(flags), score, getLevel(score)],
    );
  }
  const rmStart = localTime(keyOf(-38), tz, 21, 10);
  const rmEnd = new Date(rmStart.getTime() + 30 * 86400000);
  const startScore = scoreAt(-38);
  await pool.query(
    `INSERT INTO recovery_mode_periods (user_id, started_at, scheduled_end_at, ended_at, end_reason, score_at_start, tier_at_start, created_at)
     VALUES ($1,$2,$3,$3,'expired',$4,$5,$2)`,
    [DEMO_SARAH_ID, rmStart, rmEnd, startScore, getLevel(startScore)],
  );
  await storage.upsertBurnoutSettings(DEMO_SARAH_ID, {
    recoveryModeEnabled: false,
    recoveryModeStartedAt: null,
    recoveryModeExpiresAt: null,
  } as any);

  // --- Team step challenge with nine colleagues ---
  try {
    const { rows: colleagues } = await pool.query(
      `SELECT id, first_name, last_name FROM users WHERE id = ANY($1::varchar[])`,
      [COLLEAGUE_IDS],
    );
    if (colleagues.length >= 4) {
      const chStart = mondayOnOrBefore(keyOf(-14));
      const chEnd = addDays(chStart, 27);
      for (const col of colleagues) {
        await pool.query(
          `INSERT INTO community_profiles (user_id, display_name, share_activity, terms_version, terms_accepted_at)
           VALUES ($1,$2,false,'1.0',$3) ON CONFLICT (user_id) DO NOTHING`,
          [col.id, `${col.first_name} ${String(col.last_name || "").charAt(0)}.`, localTime(addDays(chStart, -6), tz, 12, 0)],
        );
      }
      await pool.query(
        `INSERT INTO community_profiles (user_id, display_name, share_activity, terms_version, terms_accepted_at)
         VALUES ($1,'Sarah B.',false,'1.0',$2) ON CONFLICT (user_id) DO NOTHING`,
        [DEMO_SARAH_ID, localTime(addDays(chStart, -4), tz, 12, 30)],
      );
      const creator = colleagues[0].id;
      const { rows: chRows } = await pool.query(
        `INSERT INTO community_challenges
           (title, description, type, metric, goal_mode, daily_target, allow_personal_target, start_date, end_date,
            grace_days, results_final_hours, prize_text, is_published, company_id, created_by, source, is_hidden, created_at)
         VALUES ($1,$2,'metric','steps','daily_target',$3,false,$4,$5,2,48,$6,true,$7,$8,'staff',false,$9)
         RETURNING id`,
        [
          CHALLENGE_TITLE,
          "Four weeks. Hit 8,000 steps a day and see how the team stacks up. Most days on target wins.",
          CHALLENGE_DAILY_TARGET, chStart, chEnd, "Winner picks the next team lunch spot",
          companyId, creator, localTime(addDays(chStart, -7), tz, 11, 0),
        ],
      );
      const challengeId = chRows[0].id;
      for (const id of [creator, ...colleagues.slice(1).map((x: any) => x.id), DEMO_SARAH_ID]) {
        await pool.query(
          `INSERT INTO community_challenge_participants (challenge_id, user_id, timezone, show_on_leaderboard, joined_at)
           VALUES ($1,$2,$3,true,$4) ON CONFLICT ON CONSTRAINT uq_community_participant DO NOTHING`,
          [challengeId, id, tz, localTime(addDays(chStart, -2 - Math.floor(hash01(id) * 4)), tz, 13, 0)],
        );
      }
      for (let key = chStart; key < t0; key = addDays(key, 1)) await upsertColleagueSteps(key, 1);
      // Scores up to yesterday; the community scheduler keeps them current from here.
      const { rows: stepRows } = await pool.query(
        `SELECT user_id, date, MAX(COALESCE(steps,0))::float AS v FROM wearable_metrics_daily
         WHERE user_id = ANY($1::varchar[]) AND date >= $2 AND date < $3 GROUP BY user_id, date`,
        [[...COLLEAGUE_IDS, DEMO_SARAH_ID], chStart, t0],
      );
      for (const r of stepRows) {
        await pool.query(
          `INSERT INTO community_challenge_scores (challenge_id, user_id, date_key, value, on_target, source, updated_at)
           VALUES ($1,$2,$3,$4,$5,'wearable',now())
           ON CONFLICT ON CONSTRAINT uq_community_score DO UPDATE SET value = EXCLUDED.value, on_target = EXCLUDED.on_target, updated_at = now()`,
          [challengeId, r.user_id, r.date, r.v, r.v >= CHALLENGE_DAILY_TARGET],
        );
      }
    } else {
      console.warn("[app-demo] Kestrelmoor colleagues not found, skipping the step challenge");
    }
  } catch (e: any) {
    console.warn("[app-demo] step challenge failed (continuing):", e?.message || e);
  }

  // --- Rewards prize draw: enrolled, steps counted this month ---
  try {
    const rewards = await import("./rewardsEngine");
    await rewards.setConsent(DEMO_SARAH_ID, COMPANY, { enrolled: true, stepAccessGranted: true, consentIdentityOnWin: true });
    const now = new Date();
    await rewards.evaluateCompanyFully(COMPANY, now.toISOString().slice(0, 7), now);
  } catch (e: any) {
    console.warn("[app-demo] rewards failed (continuing):", e?.message || e);
  }

  // --- Streaks, badges, today's wearable row ---
  await refreshStreaks(ctx);
  try {
    await storage.checkUserBadgeEligibility(DEMO_SARAH_ID);
  } catch (e: any) {
    console.warn("[app-demo] badges failed (continuing):", e?.message || e);
  }
  await syncDemoTodayWearable(DEMO_SARAH_ID, t0);

  console.log(
    `[app-demo] seeded Sarah: ${pastSessions.length} programme sessions, ${HISTORY_DAYS} days of data, ` +
    `live burnout preview ${liveScore ?? "n/a"} (Recovery Mode started at ${startScore})`,
  );
}

// ---------------------------------------------------------------------------
// Teardown: removes Sarah, her company row, the challenge and the colleagues'
// step rows. Leaves the Kestrelmoor showcase people themselves alone.
// ---------------------------------------------------------------------------
export async function teardownSarahDemo(opts: { keepFlag?: boolean } = {}): Promise<void> {
  const id = DEMO_SARAH_ID;
  const q = async (sql: string, params: any[] = []) => {
    try { await pool.query(sql, params); } catch (e: any) { console.warn("[app-demo] teardown step failed:", e?.message); }
  };
  await q(`DELETE FROM workout_set_logs WHERE exercise_log_id IN (
             SELECT wel.id FROM workout_exercise_logs wel JOIN workout_logs wl ON wl.id = wel.workout_log_id WHERE wl.user_id = $1)`, [id]);
  await q(`DELETE FROM workout_exercise_logs WHERE workout_log_id IN (SELECT id FROM workout_logs WHERE user_id = $1)`, [id]);
  await q(`DELETE FROM workout_logs WHERE user_id = $1`, [id]);
  await q(`DELETE FROM exercise_snapshots WHERE user_id = $1`, [id]);
  await q(`DELETE FROM bodyweight_entries WHERE user_id = $1`, [id]);
  const { rows: co } = await pool.query(`SELECT id FROM companies WHERE name = $1 AND notes LIKE 'Demo company for website screenshots%'`, [COMPANY]).catch(() => ({ rows: [] as any[] }));
  const companyIds = co.map((r: any) => r.id);
  if (companyIds.length) {
    await q(`DELETE FROM community_challenge_scores WHERE challenge_id IN (SELECT id FROM community_challenges WHERE company_id = ANY($1::int[]))`, [companyIds]);
    await q(`DELETE FROM community_challenge_participants WHERE challenge_id IN (SELECT id FROM community_challenges WHERE company_id = ANY($1::int[]))`, [companyIds]);
    await q(`DELETE FROM community_posts WHERE challenge_id IN (SELECT id FROM community_challenges WHERE company_id = ANY($1::int[]))`, [companyIds]);
    await q(`DELETE FROM community_challenges WHERE company_id = ANY($1::int[])`, [companyIds]);
  }
  await q(`DELETE FROM community_profiles WHERE user_id = ANY($1::varchar[])`, [[...COLLEAGUE_IDS, id]]);
  await q(`DELETE FROM community_challenge_scores WHERE user_id = $1`, [id]);
  await q(`DELETE FROM community_challenge_participants WHERE user_id = $1`, [id]);
  await q(`DELETE FROM wearable_metrics_daily WHERE user_id = ANY($1::varchar[]) AND raw->>'demoSeed' = $2`, [COLLEAGUE_IDS, DEMO_TAG]);
  await q(`DELETE FROM reward_programs WHERE company_name = $1`, [COMPANY]);
  await q(`DELETE FROM users WHERE id = $1`, [id]);
  if (companyIds.length) await q(`DELETE FROM companies WHERE id = ANY($1::int[])`, [companyIds]);
  if (!opts.keepFlag) await q(`DELETE FROM system_flags WHERE key = $1`, [SEED_FLAG]);
}

// ---------------------------------------------------------------------------
// Start-up: seed once, then keep the account current.
// ---------------------------------------------------------------------------
let started = false;
export async function startSarahDemo(): Promise<void> {
  if (started) return;
  started = true;
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS system_flags (key text PRIMARY KEY, created_at timestamp DEFAULT now())`);
    const flag = await pool.query(`SELECT 1 FROM system_flags WHERE key = $1 LIMIT 1`, [SEED_FLAG]);
    if ((flag.rowCount ?? 0) === 0) {
      const existing = await pool.query(`SELECT 1 FROM users WHERE id = $1`, [DEMO_SARAH_ID]);
      if ((existing.rowCount ?? 0) > 0) {
        console.log("[app-demo] found a half-finished seed, clearing it first");
        await teardownSarahDemo({ keepFlag: true });
      }
      const emailTaken = await pool.query(`SELECT 1 FROM users WHERE lower(email) = lower($1)`, [EMAIL]);
      if ((emailTaken.rowCount ?? 0) > 0) {
        console.warn(`[app-demo] ${EMAIL} already belongs to another account, not seeding`);
        return;
      }
      await seedAll();
      await pool.query(`INSERT INTO system_flags (key) VALUES ($1) ON CONFLICT (key) DO NOTHING`, [SEED_FLAG]);
    } else {
      await topUpSarahDemo("startup");
    }
    const timer = setInterval(() => { topUpSarahDemo("timer"); }, TOP_UP_EVERY_MS);
    (timer as any).unref?.();
  } catch (e: any) {
    console.error("[app-demo] start failed:", e?.message || e);
  }
}

// Command-line use (dev shell only; the live database is handled on start-up).
if (process.argv[1] && /appDemoSeed\.ts$/.test(process.argv[1])) {
  (async () => {
    try {
      if (process.argv.includes("--teardown")) {
        await teardownSarahDemo();
        console.log("Sarah demo account removed.");
      } else if (process.argv.includes("--topup")) {
        console.log(await topUpSarahDemo("cli"));
      } else {
        await startSarahDemo();
      }
      process.exit(0);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  })();
}
