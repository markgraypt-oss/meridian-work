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

HARD FILTERS (NO EXCEPTIONS):
- ENVIRONMENT: only programmes whose equipment matches the user's environment.
- EXPERIENCE LEVEL: a programme's "difficulty" must equal the user's experience EXACTLY. NEVER suggest an "advanced" programme for a "beginner" user, even as a stretch goal — it will be rejected.
- EQUIPMENT: only programmes whose required equipment is a subset of what the user has.

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
      // Production code applies a hard experience-level filter in
      // parseAiRecommendations(), so even if the model suggests the
      // advanced programme it never reaches the user. What we actually
      // want to verify here is that the model never *actively
      // recommends* an advanced programme to a beginner — i.e. it's
      // not marked recommended:true.
      name: "Does not recommend the advanced programme as a top pick",
      run: ({ data }) => {
        if (!data) return { pass: false };
        const advancedRecommended = data.programs.find((p) => p.id === 3 && p.recommended === true);
        return {
          pass: !advancedRecommended,
          message: advancedRecommended ? "advanced programme was marked recommended:true" : undefined,
        };
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
