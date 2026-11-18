/**
 * Workouts done OUTSIDE the app.
 *
 * Two kinds, read together as one list:
 *   - "manual": typed in by the person afterwards (manual_workouts).
 *   - "device": recorded on a watch or phone and synced in (wearable_workouts).
 *
 * Workouts done in the app stay in workout_logs and are not touched here.
 * Nothing that counts in-app workouts (workout badges, rewards, the Workforce
 * Wellbeing Index) reads this list unless it calls listLoggedWorkouts() itself.
 *
 * Rules for device workouts (agreed with Mark, 15 Nov 2026):
 *   1. Never walks. Everything else a person starts on purpose counts.
 *   2. At least 10 minutes.
 *   3. Left out when it overlaps a workout done in the app.
 *   4. Left out when it overlaps one the person typed in (theirs stands).
 *   5. Two devices recording the same workout show once.
 *   6. Left out when the person removed it.
 * The rules are applied on read, not on save, so they can change later
 * without touching stored data.
 */
import type { Express } from "express";
import { z } from "zod";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "./db";
import { manualWorkouts, dismissedDeviceWorkouts, users, wearableWorkouts, workoutLogs } from "@workspace/db";
import { isAuthenticated } from "./replitAuth";

export const ACTIVITY_TYPES = ["run", "cycle", "swim", "gym", "yoga", "pilates", "stretching", "class", "sport", "other"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  run: "Run", cycle: "Cycle", swim: "Swim", gym: "Gym workout", yoga: "Yoga",
  pilates: "Pilates", stretching: "Stretching", class: "Class", sport: "Sport", other: "Workout",
};

export type LoggedWorkout = {
  /** "m-12" for a manual workout, "d-12" for a device workout. */
  key: string;
  source: "manual" | "device";
  /** "Logged by you", or where the device workout came from ("Apple Watch"). */
  sourceLabel: string;
  activityType: ActivityType;
  /** "Run", "Spin class", "Strength training". The app adds the distance. */
  name: string;
  startedAt: string;
  durationSeconds: number;
  distanceMeters: number | null;
  activeEnergyKcal: number | null;
  averageHeartRate: number | null;
  effort: number | null;
  notes: string | null;
  exerciseCount: number;
  /** Only on the single-workout read. */
  exercises?: unknown[] | null;
  /** Only on the single-workout read of a device workout: what the app needs for splits and intervals. */
  detail?: WorkoutDetail | null;
};

/**
 * Inside a workout from a watch (iPhone sends it from 18 Nov 2026; checked in
 * wearables/routes.ts and kept in wearable_workouts.raw.detail). Times are
 * seconds of the workout with pauses taken out. The app works out the splits
 * in the person's own unit.
 */
export type WorkoutDetail = {
  v: 1;
  activeSeconds: number;
  distance?: number[][];
  heartRate?: number[][];
  intervals?: { start: number; end: number; kind: "warmup" | "work" | "recovery" | "cooldown" | null; metres?: number }[];
};

function readDetail(raw: any): WorkoutDetail | null {
  const d = raw?.detail;
  if (!d || d.v !== 1 || typeof d.activeSeconds !== "number") return null;
  const series = (x: unknown) => (Array.isArray(x) ? x.filter((p) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number")) : undefined);
  const out: WorkoutDetail = { v: 1, activeSeconds: d.activeSeconds };
  const distance = series(d.distance);
  const heartRate = series(d.heartRate);
  if (distance && distance.length > 1) out.distance = distance as number[][];
  if (heartRate && heartRate.length > 0) out.heartRate = heartRate as number[][];
  if (Array.isArray(d.intervals) && d.intervals.length > 1) out.intervals = d.intervals;
  return out.distance || out.heartRate || out.intervals ? out : null;
}

const MIN_DEVICE_MINUTES = 10;
/** Two workouts are "the same one" when this share of the shorter one overlaps. */
const SAME_WORKOUT_OVERLAP = 0.5;

// ── Device workout types ────────────────────────────────────────────────────
// The phone sends Apple's and Google's own names ("traditionalStrengthTraining",
// "highIntensityIntervalTraining"); older rows use snake_case. Compare on
// letters only so every spelling lands in the same place.
const norm = (t: string | null | undefined) => (t || "").toLowerCase().replace(/[^a-z]/g, "");

// Never shown: walks (rule 1), and records that are not a workout in themselves.
const NEVER = new Set(["walking", "walk", "wheelchairwalkpace", "cooldown", "transition", "play", "fishing", "hunting", "guidedbreathing"]);

const KNOWN: Record<string, [ActivityType, string]> = {
  running: ["run", "Run"], run: ["run", "Run"], wheelchairrunpace: ["run", "Wheelchair run"],
  cycling: ["cycle", "Cycle"], biking: ["cycle", "Cycle"], cyclingstationary: ["cycle", "Indoor cycle"], handcycling: ["cycle", "Hand cycle"],
  swimming: ["swim", "Swim"], swim: ["swim", "Swim"],
  traditionalstrengthtraining: ["gym", "Strength training"], functionalstrengthtraining: ["gym", "Strength training"],
  strengthtraining: ["gym", "Strength training"], weightlifting: ["gym", "Strength training"],
  benchpress: ["gym", "Strength training"], deadlift: ["gym", "Strength training"], backextension: ["gym", "Strength training"],
  coretraining: ["gym", "Core training"], crosstraining: ["gym", "Cross training"], calisthenics: ["gym", "Calisthenics"],
  yoga: ["yoga", "Yoga"],
  pilates: ["pilates", "Pilates"],
  flexibility: ["stretching", "Stretching"], stretching: ["stretching", "Stretching"], preparationandrecovery: ["stretching", "Recovery"],
  highintensityintervaltraining: ["class", "HIIT"], hiit: ["class", "HIIT"], bootcamp: ["class", "Boot camp"],
  exerciseclass: ["class", "Exercise class"], dance: ["class", "Dance"], cardiodance: ["class", "Dance"], socialdance: ["class", "Dance"],
  danceinspiredtraining: ["class", "Dance"], barre: ["class", "Barre"], steptraining: ["class", "Step"],
  mixedcardio: ["class", "Cardio"], mixedmetaboliccardiotraining: ["class", "Cardio"], kickboxing: ["class", "Kickboxing"],
  waterfitness: ["class", "Water fitness"], fitnessgaming: ["class", "Fitness gaming"], jumprope: ["class", "Jump rope"],
  taichi: ["class", "Tai chi"], mindandbody: ["class", "Mind and body"],
  soccer: ["sport", "Football"], swimbikerun: ["sport", "Triathlon"], hockey: ["sport", "Hockey"],
  hiking: ["other", "Hike"], rowing: ["other", "Rowing"], elliptical: ["other", "Elliptical"],
  stairclimbing: ["other", "Stair climbing"], stairs: ["other", "Stair climbing"], climbing: ["other", "Climbing"],
  other: ["other", "Workout"],
};

const SPORTS = new Set([
  "americanfootball", "australianfootball", "badminton", "baseball", "basketball", "bowling", "boxing", "cricket", "curling",
  "fencing", "golf", "gymnastics", "handball", "lacrosse", "martialarts", "racquetball", "rugby", "softball", "squash",
  "tabletennis", "tennis", "volleyball", "waterpolo", "pickleball", "discsports", "archery", "equestriansports", "sailing",
  "surfingsports", "watersports", "paddlesports", "snowsports", "skatingsports", "crosscountryskiing", "downhillskiing",
  "snowboarding", "wrestling", "trackandfield", "underwaterdiving", "paragliding",
]);

/** "americanFootball" / "table_tennis" -> "American football" / "Table tennis". */
function humanise(raw: string): string {
  const words = raw.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Workout";
}

/** What a device's workout type is in the app, or null when it never shows. */
export function classifyDeviceType(rawType: string | null | undefined): { activityType: ActivityType; name: string } | null {
  const t = norm(rawType);
  if (!t || NEVER.has(t) || t.startsWith("unknown")) return null;
  const known = KNOWN[t];
  if (known) return { activityType: known[0], name: known[1] };
  if (SPORTS.has(t)) return { activityType: "sport", name: humanise(rawType || "") };
  return { activityType: "other", name: humanise(rawType || "") };
}

const PROVIDER_LABEL: Record<string, string> = {
  apple_health: "Apple Health", health_connect: "Health Connect", google_fit: "Google Fit",
  garmin: "Garmin", whoop: "WHOOP", oura: "Oura",
};

/** "Mark's Apple Watch" -> "Apple Watch". Falls back to the provider's name. */
function deviceSourceLabel(provider: string, raw: any): string {
  const name = typeof raw?.sourceName === "string" ? raw.sourceName.trim() : "";
  if (/apple\s*watch/i.test(name)) return "Apple Watch";
  if (/iphone/i.test(name)) return "iPhone";
  if (name) return name.length > 24 ? name.slice(0, 24).trim() : name;
  return PROVIDER_LABEL[provider] || humanise(provider);
}

type Span = { start: number; end: number };

/** Share of the SHORTER of two spans that the other one covers (0 to 1). */
function overlapShare(a: Span, b: Span): number {
  const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start);
  if (overlap <= 0) return 0;
  const shorter = Math.min(a.end - a.start, b.end - b.start);
  return shorter > 0 ? overlap / shorter : 0;
}

const FOUR_HOURS = 4 * 60 * 60 * 1000;

/** When an in-app workout was really under way. A log left open for a day must not hide a day of device workouts. */
function appLogSpan(log: { startedAt: Date; completedAt: Date | null; duration: number | null }): Span | null {
  if (!log.completedAt) return null;
  const end = log.completedAt.getTime();
  let start = log.duration && log.duration > 0 ? end - log.duration * 1000 : log.startedAt.getTime();
  if (end - start > FOUR_HOURS) start = end - FOUR_HOURS;
  return end > start ? { start, end } : null;
}

function manualToItem(m: typeof manualWorkouts.$inferSelect, withExercises: boolean): LoggedWorkout {
  const exercises = Array.isArray(m.exercises) ? (m.exercises as unknown[]) : null;
  const activityType = (ACTIVITY_TYPES as readonly string[]).includes(m.activityType) ? (m.activityType as ActivityType) : "other";
  return {
    key: `m-${m.id}`,
    source: "manual",
    sourceLabel: "Logged by you",
    activityType,
    name: m.name,
    startedAt: m.startedAt.toISOString(),
    durationSeconds: m.durationSeconds,
    distanceMeters: m.distanceMeters ?? null,
    activeEnergyKcal: null,
    averageHeartRate: null,
    effort: m.effort ?? null,
    notes: m.notes ?? null,
    exerciseCount: exercises ? exercises.length : 0,
    ...(withExercises ? { exercises } : {}),
  };
}

type DeviceFull = typeof wearableWorkouts.$inferSelect;

/**
 * The device columns the rules and the list need. `raw` is the device's
 * original record, kept for audit: it is only read for the source label
 * ("Apple Watch"), and is left out of the all-time read for the running badges.
 */
type DeviceRow = Pick<
  DeviceFull,
  "id" | "provider" | "type" | "startedAt" | "endedAt" | "durationMinutes" | "distanceMeters" | "activeEnergyKcal" | "averageHeartRate"
> & { raw?: unknown };

const DEVICE_COLUMNS_WITHOUT_RAW = {
  id: wearableWorkouts.id,
  provider: wearableWorkouts.provider,
  type: wearableWorkouts.type,
  startedAt: wearableWorkouts.startedAt,
  endedAt: wearableWorkouts.endedAt,
  durationMinutes: wearableWorkouts.durationMinutes,
  distanceMeters: wearableWorkouts.distanceMeters,
  activeEnergyKcal: wearableWorkouts.activeEnergyKcal,
  averageHeartRate: wearableWorkouts.averageHeartRate,
};

function deviceDurationSeconds(w: Pick<DeviceFull, "durationMinutes" | "endedAt" | "startedAt">): number {
  if (w.durationMinutes && w.durationMinutes > 0) return w.durationMinutes * 60;
  if (w.endedAt) return Math.max(0, Math.round((w.endedAt.getTime() - w.startedAt.getTime()) / 1000));
  return 0;
}

function deviceToItem(w: DeviceRow, kind: { activityType: ActivityType; name: string }): LoggedWorkout {
  return {
    key: `d-${w.id}`,
    source: "device",
    sourceLabel: deviceSourceLabel(w.provider, w.raw),
    activityType: kind.activityType,
    name: kind.name,
    startedAt: w.startedAt.toISOString(),
    durationSeconds: deviceDurationSeconds(w),
    distanceMeters: w.distanceMeters && w.distanceMeters > 0 ? w.distanceMeters : null,
    activeEnergyKcal: w.activeEnergyKcal && w.activeEnergyKcal > 0 ? w.activeEnergyKcal : null,
    averageHeartRate: w.averageHeartRate && w.averageHeartRate > 0 ? w.averageHeartRate : null,
    effort: null,
    notes: null,
    exerciseCount: 0,
  };
}

/**
 * Every workout done outside the app that started in [from, to), newest first,
 * with the rules at the top of this file applied.
 *
 * `withoutRaw` skips each device workout's original record. The list is the
 * same, but a device workout's source label is then only the provider's name.
 * Used for the all-time read behind the running badges.
 */
export async function listLoggedWorkouts(userId: string, from: Date, to: Date, opts: { withoutRaw?: boolean } = {}): Promise<LoggedWorkout[]> {
  // In-app logs are fetched a little wider than the window: one that started
  // before `from` can still overlap a device workout inside it.
  const widerFrom = new Date(from.getTime() - FOUR_HOURS);
  const deviceRows = async (): Promise<DeviceRow[]> => {
    const inWindow = and(eq(wearableWorkouts.userId, userId), gte(wearableWorkouts.startedAt, from), lt(wearableWorkouts.startedAt, to));
    if (opts.withoutRaw) return db.select(DEVICE_COLUMNS_WITHOUT_RAW).from(wearableWorkouts).where(inWindow);
    // Only the source name from the original record: since 18 Nov 2026 it can
    // also hold a workout's splits and heart rate, which the list never needs.
    return db.select({
      ...DEVICE_COLUMNS_WITHOUT_RAW,
      raw: sql<unknown>`jsonb_build_object('sourceName', ${wearableWorkouts.raw}->>'sourceName')`,
    }).from(wearableWorkouts).where(inWindow);
  };
  const [manual, device, dismissed, appLogs] = await Promise.all([
    db.select().from(manualWorkouts)
      .where(and(eq(manualWorkouts.userId, userId), gte(manualWorkouts.startedAt, from), lt(manualWorkouts.startedAt, to))),
    deviceRows(),
    db.select({ id: dismissedDeviceWorkouts.wearableWorkoutId }).from(dismissedDeviceWorkouts)
      .where(eq(dismissedDeviceWorkouts.userId, userId)),
    db.select({ startedAt: workoutLogs.startedAt, completedAt: workoutLogs.completedAt, duration: workoutLogs.duration }).from(workoutLogs)
      .where(and(eq(workoutLogs.userId, userId), eq(workoutLogs.status, "completed"), gte(workoutLogs.startedAt, widerFrom), lt(workoutLogs.startedAt, to))),
  ]);

  const removed = new Set(dismissed.map((d) => d.id));
  const taken: Span[] = [];
  for (const log of appLogs) {
    const span = appLogSpan(log);
    if (span) taken.push(span);
  }
  for (const m of manual) {
    const start = m.startedAt.getTime();
    taken.push({ start, end: start + m.durationSeconds * 1000 });
  }

  // When two records are the same workout the fuller one wins: one with a
  // distance first (a watch's run beats another app's copy of it with no
  // distance, seen 18 Nov 2026), then the longer.
  const hasDistance = (w: DeviceRow) => (w.distanceMeters && w.distanceMeters > 0 ? 1 : 0);
  const candidates = device
    .map((w) => ({ w, kind: classifyDeviceType(w.type), seconds: deviceDurationSeconds(w) }))
    .filter((c) => c.kind && !removed.has(c.w.id) && c.seconds >= MIN_DEVICE_MINUTES * 60)
    .sort((a, b) => hasDistance(b.w) - hasDistance(a.w) || b.seconds - a.seconds);

  const items: LoggedWorkout[] = manual.map((m) => manualToItem(m, false));
  for (const c of candidates) {
    const start = c.w.startedAt.getTime();
    const span = { start, end: start + c.seconds * 1000 };
    if (taken.some((t) => overlapShare(span, t) >= SAME_WORKOUT_OVERLAP)) continue;
    taken.push(span);
    items.push(deviceToItem(c.w, c.kind!));
  }
  return items.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

// The running badges only count runs done from this day on. For the first half
// hour they were live they counted a person's whole synced history, so opening
// the app handed out badges for runs imported from a watch months earlier.
// Mark, 15 Nov 2026: "imported workouts should not count towards any badges".
const RUNNING_BADGES_START = new Date("2026-11-15T00:00:00Z");

/**
 * Running distance for the running badges (storage.ts, getUserBadgeStats): the
 * longest single run and the total, in metres.
 *
 * Only runs that started on or after RUNNING_BADGES_START count, and never runs
 * from before the person joined, so a history imported from a watch earns
 * nothing. From then on, runs typed in and runs recorded on a device both
 * count, with the same rules as the list (a run recorded by two devices is
 * counted once).
 */
export async function getRunningTotals(userId: string): Promise<{ longestMeters: number; totalMeters: number }> {
  const [owner] = await db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1);
  const joined = owner?.createdAt ? owner.createdAt.getTime() : 0;
  const from = new Date(Math.max(RUNNING_BADGES_START.getTime(), joined));
  const all = await listLoggedWorkouts(userId, from, new Date(Date.now() + 24 * 60 * 60 * 1000), { withoutRaw: true });
  let longestMeters = 0;
  let totalMeters = 0;
  for (const w of all) {
    if (w.activityType !== "run" || !w.distanceMeters || w.distanceMeters <= 0) continue;
    totalMeters += w.distanceMeters;
    if (w.distanceMeters > longestMeters) longestMeters = w.distanceMeters;
  }
  return { longestMeters, totalMeters };
}

/** One workout by its key, only if it belongs to this person. Device workouts are returned even when a rule would hide them from the list. */
export async function getLoggedWorkout(userId: string, key: string): Promise<LoggedWorkout | null> {
  const match = /^([md])-(\d+)$/.exec(key);
  if (!match) return null;
  const id = parseInt(match[2], 10);
  if (match[1] === "m") {
    const [row] = await db.select().from(manualWorkouts).where(and(eq(manualWorkouts.id, id), eq(manualWorkouts.userId, userId))).limit(1);
    return row ? manualToItem(row, true) : null;
  }
  const [row] = await db.select().from(wearableWorkouts).where(and(eq(wearableWorkouts.id, id), eq(wearableWorkouts.userId, userId))).limit(1);
  if (!row) return null;
  const kind = classifyDeviceType(row.type);
  return kind ? { ...deviceToItem(row, kind), detail: readDetail(row.raw) } : null;
}

// ── Input ───────────────────────────────────────────────────────────────────
const setSchema = z.object({
  reps: z.number().int().min(0).max(10000).nullable().optional(),
  weightKg: z.number().min(0).max(2000).nullable().optional(),
  durationSeconds: z.number().int().min(0).max(86400).nullable().optional(),
  speed: z.number().min(0).max(1000).nullable().optional(),
});

const exerciseSchema = z.object({
  exerciseLibraryId: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(1).max(120),
  exerciseType: z.string().max(40).nullable().optional(),
  blockType: z.enum(["single", "superset", "triset", "circuit"]).optional(),
  blockGroupId: z.string().max(60).nullable().optional(),
  sets: z.array(setSchema).max(30),
});

const createSchema = z.object({
  activityType: z.enum(ACTIVITY_TYPES),
  name: z.string().trim().max(80).nullable().optional(),
  startedAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "startedAt must be a date"),
  durationSeconds: z.number().int().min(60).max(24 * 60 * 60),
  distanceMeters: z.number().int().min(1).max(1_000_000).nullable().optional(),
  effort: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  exercises: z.array(exerciseSchema).max(60).nullable().optional(),
});

const DAY = 24 * 60 * 60 * 1000;

export function registerLoggedWorkoutRoutes(app: Express) {
  // The list. `from` and `to` are instants (the app sends the edges of the
  // person's own day or week, so "today" is their today, not the server's).
  app.get("/api/logged-workouts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const now = Date.now();
      const fromMs = req.query.from ? Date.parse(String(req.query.from)) : now - 90 * DAY;
      const toMs = req.query.to ? Date.parse(String(req.query.to)) : now + DAY;
      if (Number.isNaN(fromMs) || Number.isNaN(toMs) || toMs <= fromMs) {
        return res.status(400).json({ message: "from and to must be dates, with to after from" });
      }
      // Never more than a year in one read.
      const from = new Date(Math.max(fromMs, toMs - 366 * DAY));
      return res.json(await listLoggedWorkouts(userId, from, new Date(toMs)));
    } catch (error) {
      console.error("[logged-workouts] list failed:", error);
      return res.status(500).json({ message: "Failed to load workouts" });
    }
  });

  app.get("/api/logged-workouts/:key", isAuthenticated, async (req: any, res) => {
    try {
      const item = await getLoggedWorkout(req.user.claims.sub, String(req.params.key));
      if (!item) return res.status(404).json({ message: "Workout not found" });
      return res.json(item);
    } catch (error) {
      console.error("[logged-workouts] read failed:", error);
      return res.status(500).json({ message: "Failed to load workout" });
    }
  });

  // Type in a workout done outside the app.
  app.post("/api/logged-workouts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "That workout could not be saved. Check the details and try again." });
      }
      const input = parsed.data;
      const startedAt = new Date(input.startedAt);
      const now = Date.now();
      if (startedAt.getTime() > now + 5 * 60 * 1000) {
        return res.status(400).json({ message: "A workout cannot start in the future." });
      }
      if (startedAt.getTime() < now - 366 * DAY) {
        return res.status(400).json({ message: "A workout can be logged up to a year back." });
      }
      const isGym = input.activityType === "gym";
      const [row] = await db.insert(manualWorkouts).values({
        userId,
        activityType: input.activityType,
        name: input.name || ACTIVITY_LABEL[input.activityType],
        startedAt,
        durationSeconds: input.durationSeconds,
        distanceMeters: input.distanceMeters ?? null,
        effort: input.effort ?? null,
        notes: input.notes || null,
        exercises: isGym && input.exercises && input.exercises.length > 0 ? input.exercises : null,
      }).returning();
      return res.status(201).json(manualToItem(row, true));
    } catch (error) {
      console.error("[logged-workouts] create failed:", error);
      return res.status(500).json({ message: "Failed to save workout" });
    }
  });

  // Manual: deletes it. Device: takes it off the person's list and leaves the
  // device record alone, so a later sync does not bring it back.
  app.delete("/api/logged-workouts/:key", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const match = /^([md])-(\d+)$/.exec(String(req.params.key));
      if (!match) return res.status(404).json({ message: "Workout not found" });
      const id = parseInt(match[2], 10);
      if (match[1] === "m") {
        const gone = await db.delete(manualWorkouts).where(and(eq(manualWorkouts.id, id), eq(manualWorkouts.userId, userId))).returning({ id: manualWorkouts.id });
        if (gone.length === 0) return res.status(404).json({ message: "Workout not found" });
        return res.json({ message: "Workout deleted" });
      }
      const [row] = await db.select({ id: wearableWorkouts.id }).from(wearableWorkouts)
        .where(and(eq(wearableWorkouts.id, id), eq(wearableWorkouts.userId, userId))).limit(1);
      if (!row) return res.status(404).json({ message: "Workout not found" });
      await db.insert(dismissedDeviceWorkouts).values({ userId, wearableWorkoutId: id }).onConflictDoNothing();
      return res.json({ message: "Workout removed" });
    } catch (error) {
      console.error("[logged-workouts] delete failed:", error);
      return res.status(500).json({ message: "Failed to remove workout" });
    }
  });
}
