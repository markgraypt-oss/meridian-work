import { z } from "zod";
import type { EvalScenario } from "../index";

const Schema = z.object({
  programs: z.array(z.object({
    id: z.number(),
    recommended: z.boolean(),
    reason: z.string(),
  })),
});
type Out = z.infer<typeof Schema>;

const scenario: EvalScenario<Out> = {
  name: "Programme recommendation — beginner home",
  feature: "onboarding_recommendations",
  prompt: `Recommend up to 3 programmes for this user.

USER:
- Experience: beginner
- Environment: home
- Equipment: dumbbells, resistance bands
- Time per session: 30 minutes
- Frequency: 3 days/week

PROGRAMMES:
ID:1 "Foundations Bodyweight" equipment:bodyweight difficulty:beginner duration:25 days/wk:3 requires:[]
ID:2 "Home Strength Starter" equipment:home_gym difficulty:beginner duration:30 days/wk:3 requires:[dumbbells]
ID:3 "Advanced Powerlifting" equipment:full_gym difficulty:advanced duration:75 days/wk:5 requires:[barbell,rack]
ID:4 "Office Mobility" equipment:bodyweight difficulty:beginner duration:15 days/wk:5 requires:[]

Respond ONLY with JSON:
{"programs": [{"id": <number>, "recommended": <boolean>, "reason": "<short>"}]}`,
  schema: Schema,
  maxTokens: 500,
  temperature: 0.3,
  checks: [
    {
      name: "Does not recommend the advanced programme",
      run: ({ data }) => {
        if (!data) return { pass: false };
        const advanced = data.programs.find((p) => p.id === 3);
        return { pass: !advanced, message: advanced ? "advanced programme was suggested" : undefined };
      },
    },
    {
      name: "At least one home/bodyweight programme recommended",
      run: ({ data }) => {
        if (!data) return { pass: false };
        const ok = data.programs.some((p) => p.id === 1 || p.id === 2);
        return { pass: ok };
      },
    },
  ],
};

export default scenario;
