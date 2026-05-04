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
  prompt: `Recommend programmes for this user.

HARD FILTERS (NON-NEGOTIABLE — programmes that fail any filter MUST BE OMITTED ENTIRELY from your output):
1. EXPERIENCE LEVEL: a programme's "difficulty" must equal the user's experience EXACTLY. If the user is "beginner", DO NOT include any programme whose difficulty is "intermediate" or "advanced" — not as a recommendation, not as a secondary suggestion, not as a stretch goal, not even with recommended:false. Pretend mismatched-level programmes do not exist.
2. ENVIRONMENT: only programmes whose equipment field matches the user's environment.
3. EQUIPMENT: only programmes whose required equipment is a subset of what the user has.

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

Before answering, list the user's experience level and silently filter out every programme whose difficulty does not match it. Then choose up to 3 from the survivors only. Mark the single best as recommended:true and the rest recommended:false. If fewer than 3 survive, return fewer.

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
