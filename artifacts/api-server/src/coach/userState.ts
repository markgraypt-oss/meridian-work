import { storage } from "../storage";

// ---------------------------------------------------------------------------
// Per-message user state snapshot for the coach recommendation engine.
//
// One cheap parallel read over existing storage getters, producing a compact
// object that is used three ways:
//   1. Action eligibility  — an action card (e.g. "set up your rotation
//      planner") only enters the shortlist when the user's state says it is
//      actually relevant to them.
//   2. Safety gating       — Recovery Mode and body-map severity hard-filter
//      candidates BEFORE they reach the prompt (never rely on the model to
//      self-censor).
//   3. Prompt block        — a short USER STATE section (~15 lines max) so the
//      coach can explain recommendations in terms of the user's own journey.
//
// Every read fails soft: a failed getter leaves its field null/empty and the
// chat continues.
// ---------------------------------------------------------------------------

export type UserStateSnapshot = {
  workday: {
    hasProfile: boolean;
    hasRotation: boolean; // profile exists AND rotationInterval set
    rotationInterval: number | null;
    deskType: string | null;
    lastDeskScanDaysAgo: number | null;
    lastDeskScanScore: number | null;
  };
  training: {
    activeEnrollment: {
      programId: number;
      title: string;
      status: string;
      workoutsCompleted: number;
      totalWorkouts: number;
    } | null;
    lastWorkoutDaysAgo: number | null;
  };
  pain: {
    // Active issues = logged in the last 14 days, most recent per body part.
    activeIssues: Array<{ bodyPart: string; severity: number; daysAgo: number }>;
    lastLogDaysAgo: number | null;
  };
  checkins: {
    latest: {
      daysAgo: number;
      mood: number | null;
      energy: number | null;
      stress: number | null;
      sleep: number | null;
    } | null;
    weeklyDoneThisWeek: boolean;
  };
  burnout: {
    score: number | null;
    trajectory: string | null;
    recoveryMode: boolean;
  };
  habits: { topStreaks: Array<{ title: string; streak: number }> };
  goals: { activeCount: number };
  recovery: {
    meditationSessions30d: number;
    breathSessionsTotal: number;
  };
  nutrition: { hasActiveMealPlan: boolean };
};

function daysAgo(d: Date | string | null | undefined): number | null {
  if (!d) return null;
  const t = new Date(d).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

/** Monday 00:00 UTC of the current week (matches weekly_checkins.weekStart, which is Monday 00:00 UTC). */
function startOfWeek(): Date {
  const now = new Date();
  const day = (now.getUTCDay() + 6) % 7; // 0 = Monday
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
}

export async function getUserStateSnapshot(userId: string): Promise<UserStateSnapshot> {
  const [
    workdayProfile,
    deskScans,
    enrollments,
    workoutLogs,
    bodyMapLogs,
    latestCheckIn,
    weeklyCheckins,
    burnoutScore,
    burnoutSettings,
    habits,
    goals,
    meditationSessions,
    breathLogs,
    mealPlan,
  ] = await Promise.all([
    storage.getWorkdayUserProfile(userId).catch(() => undefined),
    storage.getWorkdayDeskScans(userId).catch(() => []),
    storage.getUserEnrolledPrograms(userId).catch(() => []),
    storage.getUserWorkoutLogs(userId, 5).catch(() => []),
    storage.getBodyMapLogs(userId).catch(() => []),
    storage.getLatestCheckIn(userId).catch(() => undefined),
    storage.getUserWeeklyCheckins(userId, 2).catch(() => []),
    storage.getBurnoutScore(userId).catch(() => undefined),
    storage.getBurnoutSettings(userId).catch(() => undefined),
    storage.getHabits(userId).catch(() => []),
    storage.getGoals(userId).catch(() => []),
    storage.getMeditationSessions(userId, 50).catch(() => []),
    storage.getBreathWorkSessionLogs(userId, 1_000).catch(() => []),
    storage.getUserMealPlan(userId).catch(() => undefined),
  ]);

  // Workday
  const latestScan = (deskScans || [])[0] as any;
  const workday: UserStateSnapshot["workday"] = {
    hasProfile: !!workdayProfile,
    hasRotation: !!(workdayProfile && workdayProfile.rotationInterval && (workdayProfile.preferredPositions?.length || workdayProfile.scheduleBlocks?.length)),
    rotationInterval: workdayProfile?.rotationInterval ?? null,
    deskType: workdayProfile?.deskType ?? null,
    lastDeskScanDaysAgo: daysAgo(latestScan?.scanDate ?? latestScan?.createdAt),
    lastDeskScanScore: latestScan?.score ?? null,
  };

  // Training
  const active = (enrollments || []).find((e: any) => e.status === "active");
  const lastLog = (workoutLogs || [])[0] as any;
  const training: UserStateSnapshot["training"] = {
    activeEnrollment: active
      ? {
          programId: active.programId,
          title: active.program?.title ?? active.programTitle ?? active.title ?? "programme",
          status: active.status,
          workoutsCompleted: active.workoutsCompleted ?? 0,
          totalWorkouts: active.totalWorkouts ?? 0,
        }
      : null,
    lastWorkoutDaysAgo: daysAgo(lastLog?.completedAt ?? lastLog?.startedAt ?? lastLog?.createdAt),
  };

  // Pain: most recent log per body part within 14 days.
  const recentByPart = new Map<string, { bodyPart: string; severity: number; daysAgo: number }>();
  let lastLogDays: number | null = null;
  for (const log of bodyMapLogs || []) {
    const d = daysAgo((log as any).createdAt);
    if (d === null) continue;
    if (lastLogDays === null || d < lastLogDays) lastLogDays = d;
    if (d > 14) continue;
    const existing = recentByPart.get(log.bodyPart);
    if (!existing || d < existing.daysAgo) {
      recentByPart.set(log.bodyPart, { bodyPart: log.bodyPart, severity: log.severity, daysAgo: d });
    }
  }
  const pain: UserStateSnapshot["pain"] = {
    activeIssues: [...recentByPart.values()].sort((a, b) => b.severity - a.severity).slice(0, 4),
    lastLogDaysAgo: lastLogDays,
  };

  // Check-ins
  const weekStart = startOfWeek().getTime();
  const weeklyDoneThisWeek = (weeklyCheckins || []).some((w: any) => {
    const t = new Date(w.weekStart).getTime();
    return Number.isFinite(t) && t >= weekStart;
  });
  const checkins: UserStateSnapshot["checkins"] = {
    latest: latestCheckIn
      ? {
          daysAgo: daysAgo(latestCheckIn.checkInDate) ?? 0,
          mood: latestCheckIn.moodScore ?? null,
          energy: latestCheckIn.energyScore ?? null,
          stress: latestCheckIn.stressScore ?? null,
          sleep: latestCheckIn.sleepScore ?? null,
        }
      : null,
    weeklyDoneThisWeek,
  };

  // Burnout / recovery mode (respect expiry)
  const recoveryMode = !!(
    burnoutSettings?.recoveryModeEnabled &&
    (!burnoutSettings.recoveryModeExpiresAt || new Date(burnoutSettings.recoveryModeExpiresAt).getTime() > Date.now())
  );
  const burnout: UserStateSnapshot["burnout"] = {
    score: burnoutScore?.score ?? null,
    trajectory: burnoutScore?.trajectory ?? null,
    recoveryMode,
  };

  const habitState: UserStateSnapshot["habits"] = {
    topStreaks: (habits || [])
      .filter((h: any) => (h.currentStreak ?? 0) > 0)
      .sort((a: any, b: any) => (b.currentStreak ?? 0) - (a.currentStreak ?? 0))
      .slice(0, 3)
      .map((h: any) => ({ title: h.title, streak: h.currentStreak ?? 0 })),
  };

  const goalState: UserStateSnapshot["goals"] = {
    activeCount: (goals || []).filter((g: any) => !g.isCompleted).length,
  };

  const meditation30d = (meditationSessions || []).filter((s: any) => {
    const d = daysAgo(s.completedAt ?? s.createdAt);
    return d !== null && d <= 30;
  }).length;

  return {
    workday,
    training,
    pain,
    checkins,
    burnout,
    habits: habitState,
    goals: goalState,
    recovery: {
      meditationSessions30d: meditation30d,
      breathSessionsTotal: (breathLogs || []).length,
    },
    nutrition: { hasActiveMealPlan: !!mealPlan },
  };
}

/** Compact USER STATE block for the coach prompt (~15 lines, no bulk dumps). */
export function formatUserStateBlock(s: UserStateSnapshot): string {
  const lines: string[] = [];

  if (s.workday.hasProfile) {
    lines.push(
      `- Workday setup: ${s.workday.deskType || "desk"} | rotation ${s.workday.hasRotation ? `every ${s.workday.rotationInterval} min` : "NOT set up"}`,
    );
  } else {
    lines.push("- Workday setup: none yet (no positions or rotation configured)");
  }
  if (s.workday.lastDeskScanDaysAgo !== null) {
    lines.push(`- Last desk scan: ${s.workday.lastDeskScanDaysAgo}d ago${s.workday.lastDeskScanScore ? `, score ${s.workday.lastDeskScanScore}/10` : ""}`);
  }

  if (s.training.activeEnrollment) {
    const e = s.training.activeEnrollment;
    lines.push(`- Active programme: "${e.title}" (${e.workoutsCompleted}/${e.totalWorkouts} workouts done)`);
  } else {
    lines.push("- Active programme: none");
  }
  if (s.training.lastWorkoutDaysAgo !== null) lines.push(`- Last logged workout: ${s.training.lastWorkoutDaysAgo}d ago`);

  if (s.pain.activeIssues.length > 0) {
    lines.push(
      `- Current pain/stiffness (body map, last 14d): ${s.pain.activeIssues.map((i) => `${i.bodyPart} ${i.severity}/10 (${i.daysAgo}d ago)`).join("; ")}`,
    );
  }

  if (s.checkins.latest) {
    const c = s.checkins.latest;
    lines.push(`- Latest daily check-in (${c.daysAgo}d ago): mood ${c.mood}/5, energy ${c.energy}/5, stress ${c.stress}/5, sleep ${c.sleep}/5`);
  }
  lines.push(`- Weekly check-in this week: ${s.checkins.weeklyDoneThisWeek ? "done" : "not yet"}`);

  if (s.burnout.score !== null) {
    lines.push(`- Burnout score: ${s.burnout.score}/100 (${s.burnout.trajectory})${s.burnout.recoveryMode ? " | RECOVERY MODE ACTIVE" : ""}`);
  } else if (s.burnout.recoveryMode) {
    lines.push("- RECOVERY MODE ACTIVE");
  }

  if (s.habits.topStreaks.length > 0) {
    lines.push(`- Habit streaks: ${s.habits.topStreaks.map((h) => `${h.title} (${h.streak}d)`).join(", ")}`);
  }
  if (s.goals.activeCount > 0) lines.push(`- Active goals: ${s.goals.activeCount}`);
  if (s.recovery.meditationSessions30d > 0) lines.push(`- Meditation sessions last 30d: ${s.recovery.meditationSessions30d}`);
  if (s.recovery.breathSessionsTotal > 0) lines.push(`- Breathwork sessions logged: ${s.recovery.breathSessionsTotal}`);
  if (s.nutrition.hasActiveMealPlan) lines.push(`- Active meal plan: yes`);

  return lines.join("\n");
}
