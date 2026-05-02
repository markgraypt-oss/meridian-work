import type { AiCoachingSetting } from "@shared/schema";

export interface VisionAnalysisRequest {
  imageBase64: string;
  prompt: string;
  maxTokens?: number;
}

export interface VisionAnalysisResponse {
  text: string;
}

export interface AIProviderConfig {
  provider: string;
  model: string;
}

const PROVIDER_MODELS: Record<string, string[]> = {
  anthropic: [
    "claude-sonnet-4-5",
    "claude-haiku-35",
  ],
  openai: [
    "gpt-5.2",
    "gpt-5.1",
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-4o",
    "gpt-4o-mini",
  ],
};

export function getAvailableProviders(): { provider: string; models: string[] }[] {
  return Object.entries(PROVIDER_MODELS).map(([provider, models]) => ({
    provider,
    models,
  }));
}

export function getDefaultConfig(): AIProviderConfig {
  return { provider: "anthropic", model: "claude-sonnet-4-5" };
}

export function getProviderConfig(settings: AiCoachingSetting | null): AIProviderConfig {
  if (!settings || !settings.provider || !settings.model) {
    return getDefaultConfig();
  }
  return { provider: settings.provider, model: settings.model };
}

type SupportedImageMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp";

export function detectImageMediaType(input: string): SupportedImageMediaType {
  const base64Data = input.replace(/^data:image\/\w+;base64,/, "");
  const head = base64Data.slice(0, 16);
  // Magic-byte sniffing wins over the data-url label, because browsers
  // (and macOS screenshots) often hand us a WebP file labeled as something else.
  if (head.startsWith("/9j/")) return "image/jpeg";
  if (head.startsWith("iVBORw0KGgo")) return "image/png";
  if (head.startsWith("R0lGOD")) return "image/gif";
  if (head.startsWith("UklGR")) return "image/webp";
  // Fall back to whatever the data URL claims, then default to jpeg.
  const m = input.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,/);
  if (m) return m[1] as SupportedImageMediaType;
  return "image/jpeg";
}

async function analyzeWithAnthropic(
  request: VisionAnalysisRequest,
  model: string
): Promise<VisionAnalysisResponse> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const anthropic = new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  });

  const mediaType = detectImageMediaType(request.imageBase64);
  const base64Data = request.imageBase64.replace(/^data:image\/\w+;base64,/, "");

  const message = await anthropic.messages.create({
    model,
    max_tokens: request.maxTokens || 2048,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64Data,
            },
          },
          {
            type: "text",
            text: request.prompt,
          },
        ],
      },
    ],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";
  return { text: responseText };
}

async function analyzeWithOpenAI(
  request: VisionAnalysisRequest,
  model: string
): Promise<VisionAnalysisResponse> {
  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });

  const imageUrl = request.imageBase64.startsWith("data:")
    ? request.imageBase64
    : `data:${detectImageMediaType(request.imageBase64)};base64,${request.imageBase64}`;

  const response = await openai.chat.completions.create({
    model,
    max_tokens: request.maxTokens || 2048,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: imageUrl },
          },
          {
            type: "text",
            text: request.prompt,
          },
        ],
      },
    ],
  });

  const responseText = response.choices[0]?.message?.content || "";
  return { text: responseText };
}

export interface TextAnalysisRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

async function textWithAnthropic(prompt: string, model: string, maxTokens: number, temperature?: number): Promise<VisionAnalysisResponse> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const anthropic = new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  });

  const message = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature: temperature ?? undefined,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";
  return { text: responseText };
}

async function textWithOpenAI(prompt: string, model: string, maxTokens: number, temperature?: number): Promise<VisionAnalysisResponse> {
  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });

  const response = await openai.chat.completions.create({
    model,
    max_tokens: maxTokens,
    temperature: temperature ?? undefined,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = response.choices[0]?.message?.content || "";
  return { text: responseText };
}

export async function analyzeText(
  request: TextAnalysisRequest,
  provider: string,
  model: string
): Promise<VisionAnalysisResponse> {
  const maxTokens = request.maxTokens || 2048;
  const temperature = request.temperature;
  switch (provider) {
    case "anthropic":
      return textWithAnthropic(request.prompt, model, maxTokens, temperature);
    case "openai":
      return textWithOpenAI(request.prompt, model, maxTokens, temperature);
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

export type DataDomain =
  | 'body_map'
  | 'programs'
  | 'workouts'
  | 'workout_logs'
  | 'exercises'
  | 'learning_paths'
  | 'check_ins'
  | 'sleep'
  | 'steps'
  | 'resting_hr'
  | 'stress'
  | 'bodyweight'
  | 'body_fat'
  | 'blood_pressure'
  | 'hydration'
  | 'nutrition'
  | 'goals'
  | 'habits'
  | 'programme_library'
  | 'workout_library'
  | 'recipe_library'
  | 'video_library'
  | 'learn_library'
  | 'exercise_library';

export const FEATURE_DATA_SOURCES: Record<string, { domains: DataDomain[]; description: string }> = {
  recovery_coach: {
    domains: ['body_map', 'programs', 'workouts', 'workout_logs', 'exercises', 'check_ins', 'sleep', 'steps', 'resting_hr', 'stress', 'bodyweight'],
    description: 'Full body map history, current programs/workouts, workout completion logs, exercise library for substitutions, check-in trends (mood/energy/stress), sleep quality, step counts, resting heart rate, stress/burnout scores, and bodyweight trends',
  },
  workout_adaptation: {
    domains: ['body_map', 'programs', 'workouts', 'workout_logs', 'exercises', 'sleep', 'stress', 'resting_hr'],
    description: 'Active body map issues (severity 4+), enrolled programs with upcoming workouts, exercise library for substitutions, recent workout logs, sleep quality, stress levels, and resting heart rate for readiness assessment',
  },
  check_in_insights: {
    domains: ['check_ins', 'sleep', 'steps', 'resting_hr', 'stress', 'body_map', 'workout_logs', 'hydration', 'bodyweight'],
    description: 'Full check-in history with mood/energy/stress/sleep/clarity scores, sleep tracking, step counts, resting heart rate trends, stress/burnout scores, body map pain reports, workout frequency, hydration logs, and bodyweight changes',
  },
  nutrition: {
    domains: ['nutrition', 'bodyweight', 'body_fat', 'goals', 'check_ins', 'workout_logs', 'hydration', 'steps'],
    description: 'Meal logs with macros, bodyweight and body fat trends, active goals (especially weight goals), check-in energy/mood patterns, workout activity levels, hydration status, and daily step counts for caloric needs',
  },
  desk_scan: {
    domains: [],
    description: 'Image-based analysis only — no user health data needed',
  },
  onboarding_recommendations: {
    domains: [],
    description: 'Uses intake questionnaire data passed directly — no historical data needed',
  },
  weekly_summary: {
    domains: ['check_ins', 'workout_logs', 'hydration', 'sleep', 'steps', 'resting_hr', 'stress', 'body_map', 'habits', 'goals', 'nutrition', 'bodyweight'],
    description: 'Comprehensive weekly digest pulling from all tracked data: check-in scores, workout completions, hydration, sleep, steps, heart rate, stress, body map status, habit streaks, goal progress, nutrition, and weight trends',
  },
  desk_followup: {
    domains: ['check_ins', 'stress', 'body_map'],
    description: 'Check-in trends (especially headache, posture-related pain), stress patterns, and body map entries for neck/shoulder/back areas to track desk setup improvement over time',
  },
  burnout_insight: {
    domains: ['check_ins', 'sleep', 'stress', 'workout_logs', 'body_map', 'hydration', 'habits', 'goals'],
    description: 'Check-in history (mood/energy/stress/sleep/clarity), sleep trends, stress patterns, workout frequency, body map pain reports, hydration logs, habit compliance, and goal progress for burnout trajectory analysis',
  },
  proactive_greeting: {
    domains: ['body_map', 'programs', 'workout_logs', 'check_ins', 'sleep', 'steps', 'resting_hr', 'stress', 'bodyweight', 'hydration', 'nutrition', 'habits', 'goals'],
    description: 'Comprehensive health snapshot for proactive greeting: body map pain, program progress, workout history, check-in trends, sleep, steps, heart rate, stress, bodyweight, hydration, nutrition, habits, and goals',
  },
  coach_chat: {
    domains: ['body_map', 'programs', 'workouts', 'workout_logs', 'exercises', 'learning_paths', 'check_ins', 'sleep', 'steps', 'resting_hr', 'stress', 'bodyweight', 'body_fat', 'blood_pressure', 'hydration', 'nutrition', 'goals', 'habits', 'programme_library', 'workout_library', 'recipe_library', 'video_library', 'learn_library', 'exercise_library'],
    description: 'Complete platform knowledge: all user health data plus full content libraries (programmes, workouts, exercises, recipes, videos, learning paths) for personalised recommendations',
  },
};

export async function getUserDataContext(userId: string, feature: string): Promise<string> {
  const featureConfig = FEATURE_DATA_SOURCES[feature];
  if (!featureConfig || featureConfig.domains.length === 0) {
    return '';
  }

  const { storage } = await import('./storage');
  const domains = featureConfig.domains;
  let context = '\n\nUSER HEALTH DATA CONTEXT:';

  try {
    if (domains.includes('body_map')) {
      const logs = await storage.getBodyMapLogs(userId);
      if (logs.length > 0) {
        const normalizeArea = (bodyPart: string, side?: string | null): string => {
          let base = bodyPart.toLowerCase()
            .replace(/^(left|right)\s+/i, '')
            .replace(/\s*\((left|right)\)\s*/i, '')
            .trim();
          const s = (side || '').toLowerCase().trim();
          if (s === 'left' || s === 'right') {
            return `${base}_${s}`;
          }
          return base;
        };

        const byArea = new Map<string, typeof logs>();
        for (const log of logs) {
          const key = normalizeArea(log.bodyPart || 'unknown', log.side);
          if (!byArea.has(key)) byArea.set(key, []);
          byArea.get(key)!.push(log);
        }

        context += '\n\n--- Body Map (Pain/Injury Assessments) ---';
        context += '\nCURRENT STATUS (most recent assessment per body area):';
        const currentEntries: typeof logs = [];
        for (const [area, areaLogs] of Array.from(byArea.entries())) {
          const latest = areaLogs[0];
          currentEntries.push(latest);
          const severity = latest.severity || 0;
          const sideLabel = latest.side ? ` (${latest.side})` : '';
          const displayName = `${latest.bodyPart || area}${sideLabel}`;
          const date = latest.createdAt ? new Date(latest.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'unknown';
          context += `\n- ${displayName}: CURRENT severity ${severity}/10 (as of ${date})${latest.type ? `, type: ${latest.type}` : ''}${latest.movementLimitations && latest.movementLimitations.length > 0 ? ', has movement limitations' : ''}${latest.movementImpact ? `, impact: ${latest.movementImpact}` : ''}`;
          if (areaLogs.length > 1) {
            const prev = areaLogs[1];
            const prevDate = prev.createdAt ? new Date(prev.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'unknown';
            context += ` (previous: ${prev.severity || 0}/10 on ${prevDate})`;
          }
        }
        const activePain = currentEntries.filter(l => (l.severity || 0) >= 4);
        if (activePain.length > 0) {
          context += `\n[!] ${activePain.length} body areas CURRENTLY at severity 4+ requiring attention`;
        }
        context += '\nIMPORTANT: Only reference CURRENT severity values when discussing pain levels. Previous values are for trend context only.';
      }
    }

    if (domains.includes('body_map') || domains.includes('programs')) {
      const user = await storage.getUser(userId);
      const screeningFlags = user?.movementScreeningFlags as any;
      if (screeningFlags && screeningFlags.activeFlags && screeningFlags.activeFlags.length > 0) {
        const flagLabels: Record<string, string> = {
          squatPain: 'Squat to chair height causes pain',
          kneeStairsPain: 'Stairs/downhill causes knee pain',
          bendingPain: 'Bending forward causes discomfort',
          lowerBackPain: 'Lower back discomfort after sitting/exercise',
          overheadPain: 'Overhead arm movement causes discomfort',
          pushingShoulderPain: 'Push-up/pressing causes shoulder pain',
          singleLegInstability: 'Single-leg movements feel unstable/painful',
          neckShoulderTension: 'Frequent neck/upper shoulder tension',
        };
        context += '\n\n--- Movement Screening (from onboarding) ---';
        context += '\nThe user reported the following movement concerns:';
        for (const flag of screeningFlags.activeFlags) {
          context += `\n- ${flagLabels[flag] || flag}`;
        }
        if (screeningFlags.flaggedMovementPatterns?.length > 0) {
          context += `\nFlagged movement patterns: ${screeningFlags.flaggedMovementPatterns.join(', ')}`;
        }
        if (screeningFlags.optionalNotes) {
          context += `\nUser note: "${screeningFlags.optionalNotes}"`;
        }
        context += '\nConsider these limitations when recommending exercises or discussing training. Suggest safer alternatives where relevant.';
      }
    }

    if (domains.includes('programs')) {
      const enrollments = await storage.getUserEnrolledPrograms(userId);
      if (enrollments.length > 0) {
        context += '\n\n--- Program Enrollments ---';
        for (const e of enrollments.slice(0, 5)) {
          context += `\n- "${e.programTitle || 'Untitled'}" (${e.status || 'active'}), week ${e.currentWeek || 1}/${e.totalWeeks || '?'}, started: ${e.startDate ? new Date(e.startDate).toLocaleDateString() : 'unknown'}`;
        }
      }

      // Adherence signals from recommendation feedback loop
      try {
        const recEvents = await storage.getRecommendationEventsForUser(userId);
        if (recEvents.length > 0) {
          const completed = recEvents.filter(e => e.eventType === 'completed');
          const abandoned = recEvents.filter(e => e.eventType === 'abandoned');
          if (completed.length > 0 || abandoned.length > 0) {
            context += '\n\n--- Programme Adherence History ---';
            context += `\nCompleted programmes: ${completed.length}`;
            context += `\nAbandoned programmes: ${abandoned.length}`;
            if (abandoned.length > 0) {
              const avgAbandonPercent = Math.round(abandoned.reduce((s, e) => s + (e.completionPercent || 0), 0) / abandoned.length);
              context += `\nAverage progress before abandoning: ${avgAbandonPercent}%`;
            }
            const adherenceRate = completed.length + abandoned.length > 0
              ? Math.round((completed.length / (completed.length + abandoned.length)) * 100)
              : 0;
            context += `\nAdherence rate: ${adherenceRate}%`;
            if (adherenceRate < 50 && abandoned.length >= 2) {
              context += '\n[!] User has a pattern of abandoning programmes early. Consider addressing motivation, programme difficulty, or time commitment in coaching.';
            }
          }
        }
      } catch (recErr) {
        // Silently skip if recommendation events not available
      }
    }

    if (domains.includes('workout_logs')) {
      const logs = await storage.getUserWorkoutLogs(userId, 20);
      if (logs.length > 0) {
        context += '\n\n--- Recent Workout History ---';
        context += `\nTotal logged: ${logs.length} recent workouts`;
        for (const log of logs.slice(0, 10)) {
          const date = log.completedAt ? new Date(log.completedAt).toLocaleDateString() : 'unknown';
          const durationMin = log.duration ? Math.round(log.duration / 60) : '?';
          context += `\n- ${date}: ${log.workoutName || 'Workout'}, duration: ${durationMin}min${log.workoutRating ? `, rating: ${log.workoutRating}/10` : ''}`;
        }
        const logsWithNotes = logs.filter((l: any) => l.notes && l.notes.trim().length > 0).slice(0, 8);
        if (logsWithNotes.length > 0) {
          context += '\n\nWorkout coaching notes from the user (use these to personalise advice, spot patterns, and improve recommendations):';
          for (const log of logsWithNotes) {
            const date = log.completedAt ? new Date(log.completedAt).toLocaleDateString() : 'unknown';
            context += `\n- [${date}] ${log.workoutName || 'Workout'}: "${(log as any).notes}"`;
          }
        }
      }
    }

    if (domains.includes('learning_paths')) {
      const assignments = await storage.getUserPathAssignments(userId);
      if (assignments.length > 0) {
        context += '\n\n--- Learning Path Progress ---';
        for (const a of assignments) {
          const started = a.startedDate ? 'in progress' : 'assigned';
          const completed = a.completedDate ? 'completed' : started;
          context += `\n- Path ID ${a.pathId}, status: ${completed}, progress: ${a.progress || 0}%`;
        }
      }
    }

    if (domains.includes('check_ins')) {
      const checkIns = await storage.getUserCheckIns(userId);
      const recent = checkIns.slice(0, 14);
      if (recent.length > 0) {
        context += '\n\n--- Daily Check-in Trends (last 14 days) ---';
        const avgMood = recent.reduce((s, c) => s + (c.moodScore || 3), 0) / recent.length;
        const avgEnergy = recent.reduce((s, c) => s + (c.energyScore || 3), 0) / recent.length;
        const avgStress = recent.reduce((s, c) => s + (c.stressScore || 3), 0) / recent.length;
        const avgSleep = recent.reduce((s, c) => s + (c.sleepScore || 3), 0) / recent.length;
        const avgClarity = recent.reduce((s, c) => s + (c.clarityScore || 3), 0) / recent.length;
        context += `\nAverages (1-5 scale): Mood ${avgMood.toFixed(1)}, Energy ${avgEnergy.toFixed(1)}, Stress ${avgStress.toFixed(1)}, Sleep ${avgSleep.toFixed(1)}, Clarity ${avgClarity.toFixed(1)}`;
        const headacheDays = recent.filter(c => c.headache).length;
        const anxiousDays = recent.filter(c => c.anxious).length;
        const overwhelmedDays = recent.filter(c => c.overwhelmed).length;
        const fatigueDays = recent.filter(c => c.fatigue).length;
        if (headacheDays > 0) context += `\nHeadaches: ${headacheDays} of ${recent.length} days`;
        if (anxiousDays > 0) context += `\nAnxiety reported: ${anxiousDays} of ${recent.length} days`;
        if (overwhelmedDays > 0) context += `\nFeeling overwhelmed: ${overwhelmedDays} of ${recent.length} days`;
        if (fatigueDays > 0) context += `\nFatigue: ${fatigueDays} of ${recent.length} days`;
        const notesEntries = recent.filter(c => c.notes && c.notes.trim().length > 0).slice(0, 5);
        if (notesEntries.length > 0) {
          context += '\n\nRecent check-in notes/reflections from the user:';
          for (const entry of notesEntries) {
            const dateStr = entry.checkInDate ? new Date(entry.checkInDate).toLocaleDateString() : 'unknown date';
            context += `\n- [${dateStr}]: "${entry.notes}"`;
          }
        }
      }
    }

    if (domains.includes('sleep')) {
      const sleepEntries = await storage.getSleepEntries(userId, 14);
      if (sleepEntries.length > 0) {
        context += '\n\n--- Sleep Tracking (last 14 entries) ---';
        const avgDuration = sleepEntries.reduce((s, e) => s + (e.durationMinutes || 0), 0) / sleepEntries.length;
        const avgQuality = sleepEntries.filter(e => e.quality).reduce((s, e) => s + (e.quality || 0), 0) / (sleepEntries.filter(e => e.quality).length || 1);
        context += `\nAvg duration: ${(avgDuration / 60).toFixed(1)} hours, Avg quality: ${avgQuality.toFixed(1)}/10`;
        const latest = sleepEntries[0];
        if (latest) {
          context += `\nMost recent: ${(latest.durationMinutes / 60).toFixed(1)} hours${latest.quality ? `, quality ${latest.quality}/10` : ''}${latest.bedTime ? `, bed: ${latest.bedTime}` : ''}${latest.wakeTime ? `, wake: ${latest.wakeTime}` : ''}`;
        }
      }
    }

    if (domains.includes('steps')) {
      const stepEntries = await storage.getStepEntries(userId, 14);
      if (stepEntries.length > 0) {
        context += '\n\n--- Step Tracking (last 14 entries) ---';
        const avgSteps = stepEntries.reduce((s, e) => s + (e.steps || 0), 0) / stepEntries.length;
        context += `\nAvg daily steps: ${Math.round(avgSteps).toLocaleString()}`;
        const latest = stepEntries[0];
        if (latest) {
          context += `\nMost recent: ${latest.steps.toLocaleString()} steps${latest.activeMinutes ? `, ${latest.activeMinutes} active minutes` : ''}`;
        }
      }
    }

    if (domains.includes('resting_hr')) {
      const hrEntries = await storage.getRestingHREntries(userId, 14);
      if (hrEntries.length > 0) {
        context += '\n\n--- Resting Heart Rate (last 14 entries) ---';
        const avgBpm = hrEntries.reduce((s, e) => s + (e.bpm || 0), 0) / hrEntries.length;
        context += `\nAvg resting HR: ${Math.round(avgBpm)} bpm`;
        const latest = hrEntries[0];
        if (latest) context += `\nMost recent: ${latest.bpm} bpm`;
        if (hrEntries.length >= 7) {
          const recentAvg = hrEntries.slice(0, 7).reduce((s, e) => s + e.bpm, 0) / 7;
          const olderAvg = hrEntries.slice(7).reduce((s, e) => s + e.bpm, 0) / (hrEntries.length - 7);
          const trend = recentAvg - olderAvg;
          if (Math.abs(trend) > 2) {
            context += `\nTrend: ${trend > 0 ? 'increasing' : 'decreasing'} by ~${Math.abs(Math.round(trend))} bpm`;
          }
        }
      }
    }

    if (domains.includes('stress')) {
      const stressEntries = await storage.getStressEntries(userId, 14);
      if (stressEntries.length > 0) {
        context += '\n\n--- Stress/Burnout Tracking (last 14 entries) ---';
        const avgStress = stressEntries.reduce((s, e) => s + (e.stressScore || 0), 0) / stressEntries.length;
        const avgRecovery = stressEntries.filter(e => e.recoveryScore).reduce((s, e) => s + (e.recoveryScore || 0), 0) / (stressEntries.filter(e => e.recoveryScore).length || 1);
        context += `\nAvg stress: ${avgStress.toFixed(1)}/10, Avg recovery: ${avgRecovery.toFixed(1)}/10`;
      }
    }

    if (domains.includes('bodyweight')) {
      const entries = await storage.getBodyweightEntries(userId, 10);
      if (entries.length > 0) {
        context += '\n\n--- Bodyweight Trend ---';
        const latest = entries[0];
        context += `\nCurrent: ${latest.weight}kg`;
        if (entries.length >= 2) {
          const oldest = entries[entries.length - 1];
          const change = latest.weight - oldest.weight;
          context += `, Change over ${entries.length} entries: ${change > 0 ? '+' : ''}${change.toFixed(1)}kg`;
        }
      }
    }

    if (domains.includes('body_fat')) {
      const entries = await storage.getBodyFatEntries(userId, 5);
      if (entries.length > 0) {
        context += '\n\n--- Body Fat ---';
        context += `\nCurrent: ${entries[0].percentage}%`;
        if (entries.length >= 2) {
          const change = entries[0].percentage - entries[entries.length - 1].percentage;
          context += `, Trend: ${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
        }
      }
    }

    if (domains.includes('blood_pressure')) {
      const entries = await storage.getBloodPressureEntries(userId, 5);
      if (entries.length > 0) {
        context += '\n\n--- Blood Pressure ---';
        context += `\nLatest: ${entries[0].systolic}/${entries[0].diastolic} mmHg`;
      }
    }

    if (domains.includes('hydration')) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const logs = await storage.getHydrationLogs(userId, today);
      const goal = await storage.getHydrationGoal(userId, today);
      if (logs.length > 0 || goal) {
        context += '\n\n--- Hydration ---';
        const totalMl = logs.reduce((s, l) => s + (l.amountMl || 0), 0);
        context += `\nToday: ${totalMl}ml consumed`;
        if (goal) context += ` / ${goal.goalMl}ml target (${Math.round(totalMl / goal.goalMl * 100)}%)`;
      }
    }

    if (domains.includes('goals')) {
      try {
        const goals = await storage.getGoals(userId);
        const activeGoals = goals.filter((g: any) => g.status === 'active');
        if (activeGoals.length > 0) {
          context += '\n\n--- Active Goals ---';
          for (const g of activeGoals) {
            context += `\n- "${g.title}" (${g.type || 'general'})${g.targetValue ? `, target: ${g.targetValue}` : ''}${g.currentValue ? `, current: ${g.currentValue}` : ''}`;
          }
        }
      } catch {}
    }

    if (domains.includes('habits')) {
      try {
        const habits = await storage.getHabits(userId);
        if (habits.length > 0) {
          context += '\n\n--- Active Habits ---';
          for (const h of habits.slice(0, 10)) {
            context += `\n- "${h.title}" (${h.category || 'general'})${h.currentStreak ? `, streak: ${h.currentStreak} days` : ''}`;
          }
        }
      } catch {}
    }

    if (domains.includes('nutrition')) {
      try {
        const today = new Date();
        const foodLogs = await storage.getFoodLogsForDate(userId, today);
        if (foodLogs.length > 0) {
          context += '\n\n--- Today\'s Nutrition ---';
          let totalCals = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
          for (const f of foodLogs) {
            totalCals += f.calories || 0;
            totalProtein += (f.protein as number) || 0;
            totalCarbs += (f.carbs as number) || 0;
            totalFat += (f.fat as number) || 0;
            context += `\n- ${f.foodName}: ${f.calories} cal, ${f.protein || 0}g P, ${f.carbs || 0}g C, ${f.fat || 0}g F (${f.mealCategory || 'uncategorised'})`;
          }
          context += `\nTotal today: ${totalCals} cal, ${totalProtein}g protein, ${totalCarbs}g carbs, ${totalFat}g fat`;
        } else {
          context += '\n\n--- Today\'s Nutrition ---\nNo food logged yet today.';
        }

        const goal = await storage.getNutritionGoal(userId);
        if (goal) {
          context += `\nDaily targets: ${goal.calorieTarget} cal, ${goal.proteinTarget}g protein, ${goal.carbsTarget}g carbs, ${goal.fatTarget}g fat`;
        }

        const history = await storage.getNutritionHistory(userId, 7);
        if (history.length > 0) {
          context += '\n\n--- Past 7 Days Nutrition ---';
          for (const day of history) {
            context += `\n- ${day.date}: ${day.calories} cal, ${day.protein}g P, ${day.carbs}g C, ${day.fat}g F`;
          }
        }
      } catch {}
    }

    if (domains.includes('programme_library')) {
      try {
        const allPrograms = await storage.getPrograms();
        if (allPrograms.length > 0) {
          context += `\n\n--- AVAILABLE PROGRAMMES (${allPrograms.length} total) ---`;
          for (const p of allPrograms) {
            context += `\n- "${p.title}" | ${p.difficulty} | ${p.goal} | ${p.duration}min/session | ${p.trainingDaysPerWeek}x/week | ${p.weeks} weeks | equipment: ${p.equipment} | type: ${p.programmeType}`;
            if (p.description) context += ` | ${p.description.substring(0, 120)}`;
            if (p.whoItsFor) context += ` | for: ${p.whoItsFor.substring(0, 80)}`;
          }
        }
      } catch {}
    }

    if (domains.includes('workout_library')) {
      try {
        const allWorkouts = await storage.getWorkouts();
        if (allWorkouts.length > 0) {
          context += `\n\n--- AVAILABLE WORKOUTS (${allWorkouts.length} total) ---`;
          for (const w of allWorkouts) {
            context += `\n- "${w.title}" | ${w.category} | ${w.difficulty} | ${w.duration}min | type: ${w.routineType}/${w.workoutType}`;
            if (w.equipment && w.equipment.length > 0) context += ` | equipment: ${w.equipment.join(', ')}`;
            if (w.description) context += ` | ${w.description.substring(0, 80)}`;
          }
        }
      } catch {}
    }

    if (domains.includes('exercise_library')) {
      try {
        const allExercises = await storage.getExercises();
        if (allExercises.length > 0) {
          const cap = 150;
          const shown = allExercises.slice(0, cap);
          context += `\n\n--- EXERCISE LIBRARY (${allExercises.length} total${allExercises.length > cap ? `, showing first ${cap}` : ''}) ---`;
          for (const e of shown) {
            const muscles = e.mainMuscle?.join(', ') || '';
            const equip = e.equipment?.join(', ') || 'bodyweight';
            context += `\n- "${e.name}" | ${muscles} | ${equip} | ${e.level || 'all levels'}`;
          }
        }
      } catch {}
    }

    if (domains.includes('recipe_library')) {
      try {
        const allRecipes = await storage.getRecipes();
        if (allRecipes.length > 0) {
          context += `\n\n--- RECIPE LIBRARY (${allRecipes.length} total) ---`;
          for (const r of allRecipes) {
            context += `\n- "${r.title}" | ${r.category} | ${r.calories} cal | P:${r.protein}g C:${r.carbs}g F:${r.fat}g | ${r.totalTime}min | ${r.servings} servings`;
            if (r.dietaryPreferences?.length) context += ` | ${r.dietaryPreferences.join(', ')}`;
            if (r.allergens?.length) context += ` | allergens: ${r.allergens.join(', ')}`;
          }
        }
      } catch {}
    }

    if (domains.includes('video_library')) {
      try {
        const allVideos = await storage.getVideos();
        if (allVideos.length > 0) {
          context += `\n\n--- VIDEO/LEARN CONTENT LIBRARY (${allVideos.length} total) ---`;
          for (const v of allVideos) {
            const durationMin = v.duration ? Math.round(v.duration / 60) : '?';
            context += `\n- "${v.title}" | ${v.category} | ${durationMin}min | by ${v.instructor}`;
            if (v.tags?.length) context += ` | tags: ${v.tags.join(', ')}`;
          }
        }
      } catch {}
    }

    if (domains.includes('learn_library')) {
      try {
        const topics = await storage.getLearnTopics();
        const paths = await storage.getLearningPaths();
        if (topics.length > 0 || paths.length > 0) {
          context += '\n\n--- LEARNING PATHS & TOPICS ---';
          if (topics.length > 0) {
            context += '\nTopics:';
            for (const t of topics) {
              if (!t.isActive) continue;
              context += `\n- "${t.title}"${t.description ? `: ${t.description.substring(0, 80)}` : ''}`;
            }
          }
          if (paths.length > 0) {
            context += '\nLearning Paths:';
            for (const p of paths) {
              context += `\n- "${p.title}" | ${p.category} | ${p.difficulty || 'all levels'}${p.estimatedDuration ? ` | ~${p.estimatedDuration}min` : ''}`;
              if (p.struggles?.length) context += ` | helps with: ${p.struggles.join(', ')}`;
            }
          }
        }
      } catch {}
    }

  } catch (err) {
    context += '\n[Some user data could not be retrieved]';
  }

  return context;
}

export async function getCrossCoachContext(userId: string, currentFeature: string): Promise<string> {
  try {
    const { db } = await import('./db');
    const { aiFeedback, coachConversations } = await import('@shared/schema');
    const { eq, desc } = await import('drizzle-orm');

    let context = '\n\nCROSS-COACHING AWARENESS (recent advice & feedback from other coaching features):';
    let hasContent = false;

    const recentFeedback = await db.select({
      feature: aiFeedback.feature,
      rating: aiFeedback.rating,
      aiMessage: aiFeedback.aiMessage,
      userMessage: aiFeedback.userMessage,
      createdAt: aiFeedback.createdAt,
    })
      .from(aiFeedback)
      .where(eq(aiFeedback.userId, userId))
      .orderBy(desc(aiFeedback.createdAt))
      .limit(15);

    const otherFeatureFeedback = recentFeedback.filter(f => f.feature !== currentFeature);

    if (otherFeatureFeedback.length > 0) {
      hasContent = true;
      const featureLabels: Record<string, string> = {
        workout_adaptation: 'Workout Coach',
        check_in_insights: 'Wellness Insights',
        recovery_coach: 'Recovery Coach',
        coach_chat: 'Main Coach Chat',
        desk_analyzer: 'Desk Setup Analyzer',
        nutrition: 'Nutrition Coach',
        burnout_insight: 'Burnout Early Warning',
      };

      const grouped = new Map<string, typeof otherFeatureFeedback>();
      for (const f of otherFeatureFeedback) {
        const key = f.feature;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(f);
      }

      context += '\n\n--- Recent AI Coaching Interactions & User Feedback ---';
      const groupKeys = Array.from(grouped.keys());
      for (const gKey of groupKeys) {
        const items = grouped.get(gKey)!;
        const label = featureLabels[gKey] || gKey;
        const positiveCount = items.filter((i: any) => i.rating === 'positive').length;
        const negativeCount = items.filter((i: any) => i.rating === 'negative').length;
        context += `\n\n[${label}] (${positiveCount} positive, ${negativeCount} negative ratings):`;
        for (const item of items.slice(0, 3)) {
          const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'recent';
          const snippet = item.aiMessage.length > 200 ? item.aiMessage.substring(0, 200) + '...' : item.aiMessage;
          context += `\n- ${date} [${item.rating}]: ${snippet}`;
          if (item.userMessage) {
            context += `\n  User asked: "${item.userMessage.substring(0, 100)}"`;
          }
        }
      }
    }

    if (currentFeature !== 'coach_chat') {
      const recentConvos = await db.select({
        title: coachConversations.title,
        messages: coachConversations.messages,
        updatedAt: coachConversations.updatedAt,
      })
        .from(coachConversations)
        .where(eq(coachConversations.userId, userId))
        .orderBy(desc(coachConversations.updatedAt))
        .limit(3);

      if (recentConvos.length > 0) {
        hasContent = true;
        context += '\n\n--- Recent Main Coach Conversations ---';
        for (const convo of recentConvos) {
          const date = convo.updatedAt ? new Date(convo.updatedAt).toLocaleDateString() : 'recent';
          const msgs = Array.isArray(convo.messages) ? convo.messages as any[] : [];
          const lastFew = msgs.slice(-4);
          context += `\n\nTopic: "${convo.title}" (${date}):`;
          for (const m of lastFew) {
            const role = m.role === 'user' ? 'User' : 'Coach';
            const content = typeof m.content === 'string' ? m.content : '';
            const snippet = content.length > 150 ? content.substring(0, 150) + '...' : content;
            context += `\n  ${role}: ${snippet}`;
          }
        }
      }
    }

    if (!hasContent) {
      return '';
    }

    try {
      const { burnoutSettings } = await import('@shared/schema');
      const recoverySettings = await db.select()
        .from(burnoutSettings)
        .where(eq(burnoutSettings.userId, userId))
        .limit(1);
      if (recoverySettings.length > 0 && recoverySettings[0].recoveryModeEnabled) {
        hasContent = true;
        const expiresAt = recoverySettings[0].recoveryModeExpiresAt;
        const expiresStr = expiresAt ? ` (expires ${new Date(expiresAt).toLocaleDateString()})` : '';
        context += `\n\n--- RECOVERY MODE ACTIVE${expiresStr} ---`;
        context += '\nThe user has activated Recovery Mode due to elevated burnout risk. Prioritise recovery-focused advice: lighter training loads, better sleep habits, stress reduction techniques, and rest days. Avoid pushing high-intensity training or adding new commitments.';
      }
    } catch {}

    context += '\n\nIMPORTANT: Use this cross-coaching context to provide consistent, connected advice. If the user received advice from another coaching feature, build on it rather than contradicting it. If they gave negative feedback on something, adjust your approach. You are all part of one unified coaching experience.';

    return context;
  } catch (err) {
    return '';
  }
}

export async function getCoachingContext(feature: string): Promise<string> {
  try {
    const { storage } = await import('./storage');
    const globalSettings = await storage.getAiCoachingSetting('global');
    const featureSettings = await storage.getAiCoachingSetting(feature);

    let context = '\nFORMATTING RULE: Never use em dashes or the character in any response. Use commas, full stops, or shorter sentences instead.\n';

    if (globalSettings && globalSettings.isActive) {
      if (globalSettings.coachingVoice) {
        context += `\n\nCOACHING VOICE & PERSONA (apply to all responses):\n${globalSettings.coachingVoice}\n`;
      }
      if (globalSettings.customGuidelines) {
        context += `\nCORE COACHING PRINCIPLES (apply to all responses):\n${globalSettings.customGuidelines}\n`;
      }
      if (globalSettings.coachingRules) {
        context += `\nRULES & CONSTRAINTS (you must always follow these):\n${globalSettings.coachingRules}\n`;
      }
      if (globalSettings.thingsToNeverDo) {
        context += `\nTHINGS TO NEVER DO (strict boundaries — never violate these):\n${globalSettings.thingsToNeverDo}\n`;
      }
      if (globalSettings.responseStyle) {
        context += `\nRESPONSE STYLE & FORMAT:\n${globalSettings.responseStyle}\n`;
      }
    }

    if (featureSettings && featureSettings.isActive) {
      if (featureSettings.customGuidelines) {
        context += `\nFEATURE-SPECIFIC EXPERTISE:\n${featureSettings.customGuidelines}\n`;
      }
      if (featureSettings.featureContext) {
        context += `\nFEATURE-SPECIFIC CONTEXT & KNOWLEDGE:\n${featureSettings.featureContext}\n`;
      }
      if (featureSettings.coachingRules) {
        context += `\nFEATURE-SPECIFIC RULES:\n${featureSettings.coachingRules}\n`;
      }
      if (featureSettings.thingsToNeverDo) {
        context += `\nFEATURE-SPECIFIC THINGS TO NEVER DO:\n${featureSettings.thingsToNeverDo}\n`;
      }
    }

    const feedbackContext = await getRecentFeedbackContext(feature);
    if (feedbackContext) {
      context += feedbackContext;
    }

    return context;
  } catch {
    return '';
  }
}

async function getRecentFeedbackContext(feature: string): Promise<string> {
  try {
    const { db } = await import('./db');
    const { aiFeedback } = await import('../shared/schema');
    const { eq, desc, and } = await import('drizzle-orm');

    const mapFeature = feature === 'desk_scan' ? 'desk_analyzer' : feature;

    const recentPositive = await db
      .select()
      .from(aiFeedback)
      .where(and(eq(aiFeedback.feature, mapFeature), eq(aiFeedback.rating, 'positive')))
      .orderBy(desc(aiFeedback.createdAt))
      .limit(5);

    const recentNegative = await db
      .select()
      .from(aiFeedback)
      .where(and(eq(aiFeedback.feature, mapFeature), eq(aiFeedback.rating, 'negative')))
      .orderBy(desc(aiFeedback.createdAt))
      .limit(5);

    if (recentPositive.length === 0 && recentNegative.length === 0) return '';

    let feedbackSection = '\n\nUSER FEEDBACK LEARNING (use this to improve your responses):\n';
    const MAX_FEEDBACK_CHARS = 1500;

    if (recentPositive.length > 0) {
      feedbackSection += '\nUsers LIKED these types of responses (do more of this):\n';
      for (const fb of recentPositive) {
        if (feedbackSection.length > MAX_FEEDBACK_CHARS) break;
        const q = fb.userMessage ? `Q: "${fb.userMessage.slice(0, 80)}" → ` : '';
        feedbackSection += `- ${q}Response style that worked: "${fb.aiMessage.slice(0, 120)}..."\n`;
      }
    }

    if (recentNegative.length > 0) {
      feedbackSection += '\nUsers DISLIKED these types of responses (avoid this approach):\n';
      for (const fb of recentNegative) {
        if (feedbackSection.length > MAX_FEEDBACK_CHARS) break;
        const q = fb.userMessage ? `Q: "${fb.userMessage.slice(0, 80)}" → ` : '';
        feedbackSection += `- ${q}Response style to avoid: "${fb.aiMessage.slice(0, 120)}..."\n`;
      }
    }

    return feedbackSection.slice(0, MAX_FEEDBACK_CHARS + 200);
  } catch {
    return '';
  }
}

export async function getFeatureConfig(feature: string): Promise<AIProviderConfig | null> {
  try {
    const { storage } = await import('./storage');
    const settings = await storage.getAllAiCoachingSettings();
    const featureSetting = settings.find((s: any) => s.feature === feature && s.isActive);
    if (featureSetting) {
      return getProviderConfig(featureSetting);
    }
    const globalSetting = settings.find((s: any) => (s.feature === 'global' || s.feature === 'general') && s.isActive);
    if (globalSetting) {
      return getProviderConfig(globalSetting);
    }
    return getDefaultConfig();
  } catch {
    return getDefaultConfig();
  }
}

export async function analyzeVision(
  config: AIProviderConfig,
  request: VisionAnalysisRequest
): Promise<VisionAnalysisResponse> {
  switch (config.provider) {
    case "anthropic":
      return analyzeWithAnthropic(request, config.model);
    case "openai":
      return analyzeWithOpenAI(request, config.model);
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
}
