# server/ai — Shared AI Wrapper & Eval Harness

Every AI call in this app routes through `aiCall()` so we get consistent
guardrails, observability, and cost tracking. Prompt or model changes can
silently regress quality, so we also keep a small offline eval harness.

## Quick start

```ts
import { z } from "zod";
import { aiCall } from "./ai";

const SummarySchema = z.object({
  summary: z.string(),
  tip: z.string(),
});

const result = await aiCall({
  feature: "weekly_summary",   // logical feature key (used for routing + logs)
  userId: req.user.claims.sub, // optional, null for system jobs / evals
  schema: SummarySchema,       // optional Zod schema → enables JSON validation + 1 repair retry
  prompt: "...",               // your fully-built prompt string
  maxTokens: 800,
  temperature: 0.6,
});

if (result.data) {
  // structured output
  res.json(result.data);
} else {
  // raw text fallback
  res.json({ text: result.text });
}
```

## What `aiCall()` enforces

- **Provider/model selection** — looks up the per-feature config from
  `ai_coaching_settings`, falling back to the global setting then the
  hard-coded default. Override with `provider`/`model` if needed.
- **PII redaction** — emails, phone numbers, SSNs, and card numbers are
  replaced with placeholders before the prompt leaves the server.
- **Token + char caps** — prompts are clipped to 60 000 chars and
  `maxTokens` is bounded to 4000 to prevent runaway cost.
- **Timeout** — 30 s by default, configurable per call.
- **Structured output** — when `schema` is supplied the response is parsed
  out of the model output and validated. On failure the wrapper makes
  exactly one repair retry asking for raw JSON only.
- **Safety post-filter** — strips medical-diagnosis claims and dangerous
  advice (stop medication, extreme fasts, self-harm). Set
  `skipSafetyFilter: true` if your feature genuinely needs unfiltered text.
- **Logging** — every call is recorded in `ai_call_logs` (feature, model,
  prompt hash, latency, tokens, validation outcome, safety flags). Visible
  in the admin "AI activity" page at `/admin/ai-activity`.

## Adding a new feature that uses AI

1. Pick a stable `feature` key (snake_case). Reuse an existing one if your
   call belongs to the same coaching surface.
2. Build the prompt as you would normally. If you want structured output,
   define a Zod schema for it.
3. Call `aiCall({ feature, userId, schema, prompt })`.
4. Don't call `analyzeText()`, `analyzeVision()`, or the OpenAI/Anthropic SDKs directly — that bypasses logging. Use `aiCall()` for text, `aiVisionCall()` for image analysis, and `aiSpeechCall()` for TTS
   and guardrails.

## Adding eval coverage

1. Add a fixture file under `scripts/evals/fixtures/<feature>.ts` exporting
   a default `EvalScenario` (or array). Each scenario provides a `prompt`,
   optional `schema`, and a list of `checks` — small functions returning
   `{ pass: boolean, message?: string }`.
2. Re-run the evals (`npm run evals` once the script is wired into
   `package.json`; until then run `npx tsx scripts/evals/index.ts`). The
   runner invokes every fixture through
   `aiCall()` (with logging disabled) and writes a markdown report under
   `.local/eval-reports/`.
3. Wire the new fixture into `scripts/evals/index.ts` if it's not picked up
   automatically — the runner globs `scripts/evals/fixtures/*.ts`.

The harness intentionally stays simple: schema validation + a few rubric
checks per scenario. It's a regression net, not a benchmark.

## Files

- `server/ai/index.ts` — the `aiCall()` wrapper, redaction, safety filter.
- `shared/schema.ts` — `aiCallLogs` table.
- `scripts/evals/` — runner, fixtures, output goes to `.local/eval-reports/`.
- `client/src/pages/admin/AdminAiActivity.tsx` — admin observability page.
