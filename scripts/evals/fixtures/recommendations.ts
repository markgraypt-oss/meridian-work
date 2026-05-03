import { z } from "zod";
import type { EvalScenario } from "../index";

const Schema = z.object({
  suggestions: z.array(z.object({
    name: z.string(),
    description: z.string(),
    calories: z.number(),
    protein: z.number(),
  })).min(2).max(5),
});
type Out = z.infer<typeof Schema>;

const scenario: EvalScenario<Out> = {
  name: "Recipe recommendations — high-protein breakfast gap",
  feature: "nutrition",
  prompt: `Suggest 3 meal ideas for this user.

USER TARGETS: 2400 cal, 180g protein, 250g carbs, 80g fat
CONSUMED TODAY (so far): 600 cal, 25g protein, 80g carbs, 20g fat
PREFERENCES: no dairy
GAP: needs ~155g protein in remaining meals

Respond ONLY with JSON:
{"suggestions": [{"name": "<short>", "description": "<one sentence>", "calories": <num>, "protein": <num>}]}`,
  schema: Schema,
  maxTokens: 500,
  temperature: 0.5,
  checks: [
    {
      name: "Average suggestion provides ≥30g protein",
      run: ({ data }) => {
        if (!data) return { pass: false };
        const avg = data.suggestions.reduce((s, x) => s + x.protein, 0) / data.suggestions.length;
        return { pass: avg >= 30, message: `avg protein ${avg.toFixed(1)}g` };
      },
    },
  ],
};

export default scenario;
