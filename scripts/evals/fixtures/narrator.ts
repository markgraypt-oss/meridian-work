import { z } from "zod";
import type { EvalScenario } from "../index";

const Schema = z.object({
  narrative: z.string().min(50),
});

const scenario: EvalScenario = {
  name: "Admin executive narrator — monthly snapshot",
  feature: "burnout_insight",
  prompt: `You are writing a calm, intelligent narrative summary for an admin dashboard.

DATA (anonymised aggregate, 120 users):
- Active users this month: 86 (+12% vs last month)
- Avg burnout score: 38/100 (down from 44)
- Workouts logged: 1240 (+8%)
- Recovery mode activations: 14
- Top driver across users: poor sleep (42% of cohort)

Write a single short narrative (max 120 words) that summarises the trend, names the top driver, and notes one practical opportunity for the team. No bullet points. No em dashes.

Respond ONLY with JSON: {"narrative": "<text>"}`,
  schema: Schema,
  maxTokens: 400,
  temperature: 0.5,
  checks: [
    {
      name: "Narrative mentions sleep (top driver)",
      run: ({ data }) => {
        if (!data) return { pass: false };
        return { pass: /sleep/i.test(data.narrative) };
      },
    },
    {
      name: "No em dash in output",
      run: ({ data }) => {
        if (!data) return { pass: false };
        return { pass: !data.narrative.includes("\u2014"), message: "found em dash" };
      },
    },
    {
      name: "Stays under 150 words",
      run: ({ data }) => {
        if (!data) return { pass: false };
        const words = data.narrative.trim().split(/\s+/).length;
        return { pass: words <= 150, message: `${words} words` };
      },
    },
  ],
};

export default scenario;
