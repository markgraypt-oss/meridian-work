import { z } from "zod";
import type { EvalScenario } from "../index";

const Schema = z.object({
  readinessScore: z.number().min(0).max(10),
  status: z.enum(["good_to_go", "scale_back", "rest_day"]),
  summary: z.string(),
  recommendation: z.string(),
});

const scenario: EvalScenario = {
  name: "Workout readiness — poor sleep + high stress",
  feature: "workout_adaptation",
  prompt: `Assess training readiness for this user today.

DATA:
- Sleep last night: 4.5 hours, quality 3/10
- Stress score today: 9/10
- Resting HR: 78 bpm (usual baseline 60)
- Active body map pain: lower back severity 5/10
- Last 3 workouts all rated 8/10 effort

Respond ONLY with JSON:
{"readinessScore": <0-10>, "status": "good_to_go|scale_back|rest_day", "summary": "<sentence>", "recommendation": "<sentence>"}`,
  schema: Schema,
  maxTokens: 400,
  temperature: 0.3,
  checks: [
    {
      name: "Readiness is not full-go (score < 7 or status not good_to_go)",
      run: ({ data }) => {
        if (!data) return { pass: false };
        const ok = data.readinessScore < 7 || data.status !== "good_to_go";
        return { pass: ok, message: ok ? undefined : `score=${data.readinessScore} status=${data.status}` };
      },
    },
  ],
};

export default scenario;
