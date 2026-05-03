import { z } from "zod";
import type { EvalScenario } from "../index";

const BriefingSchema = z.object({
  summary: z.string().min(20),
  highlights: z.array(z.string()).min(1).max(5),
  recommendation: z.string().min(10),
});

const scenario: EvalScenario = {
  name: "Daily briefing — typical executive day",
  feature: "weekly_summary",
  prompt: `You are a wellness briefing generator. Summarise the user's day below.

USER DATA:
- Sleep last night: 6.2 hours, quality 6/10
- Steps yesterday: 7400
- Stress score: 6/10
- Workout: 35min strength, rated 7/10
- Hydration: 1.4L of 2.5L target

Respond in this exact JSON format:
{"summary": "<1-2 sentence overview>", "highlights": ["<short bullet>", ...], "recommendation": "<one practical tip for today>"}

No markdown, no code fences, just raw JSON.`,
  schema: BriefingSchema,
  maxTokens: 600,
  temperature: 0.5,
  checks: [
    {
      name: "Summary mentions sleep, workout, or stress",
      run: ({ data }) => {
        if (!data) return { pass: false, message: "no parsed data" };
        const s = (data.summary || "").toLowerCase();
        const ok = ["sleep", "workout", "stress", "training", "energy"].some((k) => s.includes(k));
        return { pass: ok, message: ok ? undefined : `summary did not mention key signal: "${s}"` };
      },
    },
    {
      name: "Recommendation is actionable (not generic)",
      run: ({ data }) => {
        if (!data) return { pass: false };
        const r = (data.recommendation || "").trim();
        return { pass: r.length >= 15 && r.length <= 400 };
      },
    },
  ],
};

export default scenario;
