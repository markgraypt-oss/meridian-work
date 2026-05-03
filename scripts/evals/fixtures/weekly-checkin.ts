import { z } from "zod";
import type { EvalScenario } from "../index";

const Schema = z.object({
  overallTrend: z.enum(["improving", "declining", "stable", "mixed"]),
  summary: z.string(),
  trends: z.array(z.object({
    metric: z.string(),
    direction: z.enum(["up", "down", "stable"]),
    detail: z.string(),
  })).min(1),
});
type Out = z.infer<typeof Schema>;

const scenario: EvalScenario<Out> = {
  name: "Weekly check-in — declining sleep trend",
  feature: "check_in_insights",
  prompt: `Analyse the user's check-ins from the past 7 days and identify trends.

DATA (averaged 1-5 unless noted):
- Day 1: mood 4, energy 4, stress 3, sleep 4 (7.2h), clarity 4
- Day 2: mood 4, energy 3, stress 3, sleep 3 (6.5h), clarity 3
- Day 3: mood 3, energy 3, stress 4, sleep 3 (6.0h), clarity 3
- Day 4: mood 3, energy 2, stress 4, sleep 2 (5.5h), clarity 3
- Day 5: mood 2, energy 2, stress 5, sleep 2 (5.2h), clarity 2
- Day 6: mood 3, energy 2, stress 4, sleep 2 (5.4h), clarity 2
- Day 7: mood 3, energy 3, stress 4, sleep 3 (6.1h), clarity 3

Respond ONLY in this JSON format:
{"overallTrend": "improving|declining|stable|mixed", "summary": "<one sentence>", "trends": [{"metric": "<name>", "direction": "up|down|stable", "detail": "<specific>"}]}`,
  schema: Schema,
  maxTokens: 600,
  temperature: 0.4,
  checks: [
    {
      name: "Recognises sleep is trending down",
      run: ({ data }) => {
        if (!data) return { pass: false };
        const sleepTrend = data.trends.find((t) => /sleep/i.test(t.metric));
        if (!sleepTrend) return { pass: false, message: "no sleep trend in output" };
        return { pass: sleepTrend.direction === "down", message: `sleep direction was ${sleepTrend.direction}` };
      },
    },
  ],
};

export default scenario;
