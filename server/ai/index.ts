import crypto from "crypto";
import { z } from "zod";
import { analyzeText, analyzeVision, getDefaultConfig, getProviderConfig, type AIProviderConfig } from "../aiProvider";

export type ValidationOutcome = "valid" | "repaired" | "invalid" | "no_schema" | "error" | "timeout";

export interface AiCallParams<T> {
  feature: string;
  prompt: string;
  inputs?: Record<string, any>;
  schema?: z.ZodType<T>;
  userId?: string | null;
  provider?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  // Skip wrapper-level safety filtering when the caller manages it (e.g. desk
  // analyzer that needs unfiltered ergonomic terms).
  skipSafetyFilter?: boolean;
  // Allow eval harness to disable persistence.
  skipLogging?: boolean;
}

export interface AiCallResult<T> {
  data: T | null;
  text: string;
  validationOutcome: ValidationOutcome;
  safetyFlags: string[];
  latencyMs: number;
  tokens: { prompt?: number; completion?: number; total?: number };
  promptHash: string;
  logId?: number;
  provider?: string;
  model?: string;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_TOKENS = 1500;
const HARD_TOKEN_CAP = 4000;
const HARD_PROMPT_CHAR_CAP = 60_000;

// Patterns the safety post-filter scans for. We strip / replace rather than
// rejecting: these heuristics catch the most common medical-claim and
// dangerous-advice phrasings without trying to be a full content moderator.
const MEDICAL_CLAIM_PATTERNS: { pattern: RegExp; flag: string }[] = [
  { pattern: /\byou\s+(have|are\s+suffering\s+from|are\s+diagnosed\s+with)\s+[a-z\s]{3,40}(disease|disorder|syndrome|condition)\b/gi, flag: "medical_diagnosis" },
  { pattern: /\bdiagnos(e|ing|is)\b/gi, flag: "medical_diagnosis" },
  { pattern: /\b(prescrib(e|ing|ed)|medical\s+prescription)\b/gi, flag: "medical_prescription" },
  { pattern: /\b(cure|treats?|heals?)\s+(your\s+)?(cancer|diabetes|depression|anxiety|adhd|ptsd|arthritis)\b/gi, flag: "medical_cure_claim" },
];

const DANGEROUS_ADVICE_PATTERNS: { pattern: RegExp; flag: string }[] = [
  { pattern: /\b(stop|quit|discontinue|skip)\s+(taking\s+)?(your\s+)?(medication|meds|prescription|antidepressant|insulin|blood\s+pressure)\b/gi, flag: "stop_medication" },
  { pattern: /\bextreme\s+(fast(ing)?|caloric\s+restriction|deficit)\b/gi, flag: "extreme_diet" },
  { pattern: /\b(under\s+800\s+calories|below\s+1000\s+calories|VLCD|water\s+only\s+for\s+(days|weeks))\b/gi, flag: "extreme_diet" },
  { pattern: /\b(self\s*-?\s*harm|suicide|kill\s+yourself)\b/gi, flag: "self_harm" },
];

const PII_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: "[email]" },
  { pattern: /\b(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3}\)?[\s-]?)\d{3}[\s-]?\d{4}\b/g, replacement: "[phone]" },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[ssn]" },
  { pattern: /\b(?:\d[ -]*?){13,16}\b/g, replacement: "[card]" },
];

export function redactPII(text: string): string {
  let out = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function applySafetyFilter(text: string): { text: string; flags: string[] } {
  const flags: string[] = [];
  let out = text;
  // Always perform the replace and detect a hit by comparing input/output.
  // Avoids the well-known JS pitfall where calling `.test()` on a /g regex
  // mutates `lastIndex` and causes subsequent matches to silently fail.
  for (const { pattern, flag } of MEDICAL_CLAIM_PATTERNS) {
    const before = out;
    out = out.replace(pattern, "[removed: please consult a qualified healthcare professional]");
    if (out !== before) flags.push(flag);
  }
  for (const { pattern, flag } of DANGEROUS_ADVICE_PATTERNS) {
    const before = out;
    out = out.replace(pattern, "[removed: this guidance should come from a qualified professional]");
    if (out !== before) flags.push(flag);
  }
  return { text: out, flags: Array.from(new Set(flags)) };
}

// Recursively walk a parsed object/array, applying the safety filter to every
// string field so structured outputs (e.g. parsed JSON) cannot smuggle unsafe
// guidance past the post-filter via the `data` path.
export function applySafetyFilterDeep(value: any, flags: string[] = []): { value: any; flags: string[] } {
  if (typeof value === "string") {
    const filtered = applySafetyFilter(value);
    if (filtered.flags.length) flags.push(...filtered.flags);
    return { value: filtered.text, flags };
  }
  if (Array.isArray(value)) {
    const next = value.map((item) => applySafetyFilterDeep(item, flags).value);
    return { value: next, flags };
  }
  if (value && typeof value === "object") {
    const next: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      next[k] = applySafetyFilterDeep(v, flags).value;
    }
    return { value: next, flags };
  }
  return { value, flags };
}

function hashPrompt(prompt: string): string {
  return crypto.createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}

function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return match ? match[0] : null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`AI call timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

async function resolveConfig(feature: string, override?: { provider?: string; model?: string }): Promise<AIProviderConfig> {
  if (override?.provider && override?.model) {
    return { provider: override.provider, model: override.model };
  }
  try {
    const { storage } = await import("../storage");
    const settings = await storage.getAllAiCoachingSettings();
    const featureSetting = settings.find((s: any) => s.feature === feature && s.isActive);
    if (featureSetting) return getProviderConfig(featureSetting);
    const globalSetting = settings.find((s: any) => (s.feature === "global" || s.feature === "general") && s.isActive);
    if (globalSetting) return getProviderConfig(globalSetting);
  } catch {}
  return getDefaultConfig();
}

async function persistLog(entry: {
  userId?: string | null;
  feature: string;
  config: AIProviderConfig;
  promptHash: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs: number;
  validationOutcome: ValidationOutcome;
  safetyFlags: string[];
  errorMessage?: string;
}): Promise<number | undefined> {
  try {
    const { db } = await import("../db");
    const { aiCallLogs } = await import("../../shared/schema");
    const [row] = await db
      .insert(aiCallLogs)
      .values({
        userId: entry.userId ?? null,
        feature: entry.feature,
        provider: entry.config.provider,
        model: entry.config.model,
        promptHash: entry.promptHash,
        promptTokens: entry.promptTokens,
        completionTokens: entry.completionTokens,
        totalTokens: entry.totalTokens,
        latencyMs: entry.latencyMs,
        validationOutcome: entry.validationOutcome,
        safetyFlags: entry.safetyFlags.length ? entry.safetyFlags : null,
        errorMessage: entry.errorMessage ?? null,
      })
      .returning({ id: aiCallLogs.id });
    return row?.id;
  } catch (err: any) {
    console.error("[aiCall] Failed to persist call log:", err?.message);
    return undefined;
  }
}

// Rough token estimate (~4 chars / token) used when the provider does not
// return usage data. Good enough for cost dashboards / aggregate reporting.
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function aiCall<T = unknown>(params: AiCallParams<T>): Promise<AiCallResult<T>> {
  const startedAt = Date.now();
  const safeMaxTokens = Math.min(params.maxTokens ?? DEFAULT_MAX_TOKENS, HARD_TOKEN_CAP);
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const redactedPrompt = redactPII(params.prompt).slice(0, HARD_PROMPT_CHAR_CAP);
  const promptHash = hashPrompt(redactedPrompt);

  const config = await resolveConfig(params.feature, { provider: params.provider, model: params.model });

  let validationOutcome: ValidationOutcome = params.schema ? "invalid" : "no_schema";
  let safetyFlags: string[] = [];
  let rawText = "";
  let parsed: T | null = null;
  let errorMessage: string | undefined;
  // Track per-leg usage so we can estimate any missing leg independently
  // (avoids undercount when only one of first/repair returns provider usage).
  type Leg = { promptTokens?: number; completionTokens?: number; promptText: string; completionText: string };
  const legs: Leg[] = [];

  try {
    const first = await withTimeout(
      analyzeText(
        { prompt: redactedPrompt, maxTokens: safeMaxTokens, temperature: params.temperature },
        config.provider,
        config.model,
      ),
      timeoutMs,
    );
    rawText = first.text || "";
    legs.push({
      promptTokens: first.usage?.promptTokens,
      completionTokens: first.usage?.completionTokens,
      promptText: redactedPrompt,
      completionText: rawText,
    });

    if (params.schema) {
      const jsonStr = extractJson(rawText);
      if (jsonStr) {
        try {
          const obj = JSON.parse(jsonStr);
          const result = params.schema.safeParse(obj);
          if (result.success) {
            parsed = result.data;
            validationOutcome = "valid";
          }
        } catch {}
      }

      if (!parsed) {
        // One repair retry: ask the model to return only valid JSON matching the
        // schema. Keep the retry tight to avoid runaway cost.
        const repairPrompt = `${redactedPrompt}\n\nIMPORTANT: Your previous response did not return valid JSON. Respond ONLY with raw JSON. No prose, no code fences.`;
        try {
          const second = await withTimeout(
            analyzeText(
              { prompt: repairPrompt, maxTokens: safeMaxTokens, temperature: 0 },
              config.provider,
              config.model,
            ),
            timeoutMs,
          );
          const secondText = second.text || "";
          rawText = secondText || rawText;
          legs.push({
            promptTokens: second.usage?.promptTokens,
            completionTokens: second.usage?.completionTokens,
            promptText: repairPrompt,
            completionText: secondText,
          });
          const jsonStr2 = extractJson(rawText);
          if (jsonStr2) {
            try {
              const obj = JSON.parse(jsonStr2);
              const result = params.schema.safeParse(obj);
              if (result.success) {
                parsed = result.data;
                validationOutcome = "repaired";
              }
            } catch {}
          }
        } catch (repairErr: any) {
          errorMessage = `repair_failed: ${repairErr?.message || "unknown"}`;
        }
      }
    }

    if (!params.skipSafetyFilter && rawText) {
      const filtered = applySafetyFilter(rawText);
      rawText = filtered.text;
      safetyFlags = filtered.flags;
    }
    if (!params.skipSafetyFilter && parsed !== null && typeof parsed === "object") {
      const deep = applySafetyFilterDeep(parsed);
      parsed = deep.value as T;
      if (deep.flags.length) {
        safetyFlags = Array.from(new Set([...safetyFlags, ...deep.flags]));
      }
    }
  } catch (err: any) {
    errorMessage = err?.message || String(err);
    validationOutcome = (errorMessage || "").includes("timed out") ? "timeout" : "error";
  }

  const latencyMs = Date.now() - startedAt;
  // Prefer real provider usage per leg; fall back to ~chars/4 estimate
  // for whichever leg the provider didn't report. Ensures totals don't
  // undercount when only one of first/repair returned usage.
  let promptTokens = 0;
  let completionTokens = 0;
  if (legs.length === 0) {
    promptTokens = estimateTokens(redactedPrompt);
    completionTokens = estimateTokens(rawText);
  } else {
    for (const leg of legs) {
      promptTokens += leg.promptTokens ?? estimateTokens(leg.promptText);
      completionTokens += leg.completionTokens ?? estimateTokens(leg.completionText);
    }
  }
  const totalTokens = promptTokens + completionTokens;

  let logId: number | undefined;
  if (!params.skipLogging) {
    logId = await persistLog({
      userId: params.userId,
      feature: params.feature,
      config,
      promptHash,
      promptTokens,
      completionTokens,
      totalTokens,
      latencyMs,
      validationOutcome,
      safetyFlags,
      errorMessage,
    });
  }

  return {
    data: parsed,
    text: rawText,
    validationOutcome,
    safetyFlags,
    latencyMs,
    tokens: { prompt: promptTokens, completion: completionTokens, total: totalTokens },
    promptHash,
    logId,
    provider: config.provider,
    model: config.model,
    error: errorMessage,
  };
}

export { resolveConfig };

// ============================================================================
// Vision wrapper — same guardrails (timeout, char cap, logging, safety filter)
// applied to multimodal image analysis.
// ============================================================================

export interface AiVisionCallParams {
  feature: string;
  prompt: string;
  imageBase64: string;
  userId?: string | null;
  provider?: string;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
  skipSafetyFilter?: boolean;
  skipLogging?: boolean;
}

export async function aiVisionCall(params: AiVisionCallParams): Promise<AiCallResult<null>> {
  const startedAt = Date.now();
  const safeMaxTokens = Math.min(params.maxTokens ?? DEFAULT_MAX_TOKENS, HARD_TOKEN_CAP);
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const redactedPrompt = redactPII(params.prompt).slice(0, HARD_PROMPT_CHAR_CAP);
  const promptHash = hashPrompt(redactedPrompt);
  const config = await resolveConfig(params.feature, { provider: params.provider, model: params.model });

  let validationOutcome: ValidationOutcome = "no_schema";
  let safetyFlags: string[] = [];
  let rawText = "";
  let errorMessage: string | undefined;
  let providerPromptTokens: number | undefined;
  let providerCompletionTokens: number | undefined;

  try {
    const result = await withTimeout(
      analyzeVision(config, {
        imageBase64: params.imageBase64,
        prompt: redactedPrompt,
        maxTokens: safeMaxTokens,
      }),
      timeoutMs,
    );
    rawText = result.text || "";
    providerPromptTokens = result.usage?.promptTokens;
    providerCompletionTokens = result.usage?.completionTokens;
    if (!params.skipSafetyFilter && rawText) {
      const filtered = applySafetyFilter(rawText);
      rawText = filtered.text;
      safetyFlags = filtered.flags;
    }
  } catch (err: any) {
    errorMessage = err?.message || String(err);
    validationOutcome = (errorMessage || "").includes("timed out") ? "timeout" : "error";
  }

  const latencyMs = Date.now() - startedAt;
  const promptTokens = providerPromptTokens ?? estimateTokens(redactedPrompt);
  const completionTokens = providerCompletionTokens ?? estimateTokens(rawText);
  const totalTokens = promptTokens + completionTokens;

  let logId: number | undefined;
  if (!params.skipLogging) {
    logId = await persistLog({
      userId: params.userId,
      feature: params.feature,
      config,
      promptHash,
      promptTokens,
      completionTokens,
      totalTokens,
      latencyMs,
      validationOutcome,
      safetyFlags,
      errorMessage,
    });
  }

  return {
    data: null,
    text: rawText,
    validationOutcome,
    safetyFlags,
    latencyMs,
    tokens: { prompt: promptTokens, completion: completionTokens, total: totalTokens },
    promptHash,
    logId,
    error: errorMessage,
  };
}

// ============================================================================
// Speech (TTS) wrapper — caps input length, applies timeout and logging so TTS
// usage shows up alongside text/vision in /admin/ai-activity.
// ============================================================================

export interface AiSpeechCallParams {
  feature: string;
  input: string;
  userId?: string | null;
  model?: string;
  voice?: string;
  responseFormat?: "mp3" | "wav" | "opus" | "aac" | "flac" | "pcm";
  timeoutMs?: number;
  skipLogging?: boolean;
}

export interface AiSpeechCallResult {
  audio: Buffer | null;
  latencyMs: number;
  tokens: { prompt?: number; completion?: number; total?: number };
  promptHash: string;
  logId?: number;
  error?: string;
}

const HARD_TTS_CHAR_CAP = 4000;

export async function aiSpeechCall(params: AiSpeechCallParams): Promise<AiSpeechCallResult> {
  const startedAt = Date.now();
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const redactedInput = redactPII(params.input).slice(0, HARD_TTS_CHAR_CAP);
  const promptHash = hashPrompt(redactedInput);
  const model = params.model || "gpt-4o-mini-tts";
  const voice = params.voice || "alloy";
  const responseFormat = params.responseFormat || "mp3";

  let audio: Buffer | null = null;
  let errorMessage: string | undefined;
  let validationOutcome: ValidationOutcome = "no_schema";

  try {
    // The Replit AI Integrations proxy does NOT support /v1/audio/speech,
    // so TTS must go directly to OpenAI. Require a direct OPENAI_API_KEY.
    const directKey = process.env.OPENAI_API_KEY;
    if (!directKey) {
      throw new Error(
        "Voice walkthrough is not configured. An OPENAI_API_KEY secret is required for text-to-speech (the AI integrations proxy does not support audio endpoints)."
      );
    }
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey: directKey });
    const speech = await withTimeout(
      client.audio.speech.create({
        model,
        voice: voice as any,
        input: redactedInput,
        response_format: responseFormat,
      }),
      timeoutMs,
    );
    audio = Buffer.from(await speech.arrayBuffer());
  } catch (err: any) {
    errorMessage = err?.message || String(err);
    validationOutcome = (errorMessage || "").includes("timed out") ? "timeout" : "error";
  }

  const latencyMs = Date.now() - startedAt;
  const promptTokens = estimateTokens(redactedInput);

  let logId: number | undefined;
  if (!params.skipLogging) {
    logId = await persistLog({
      userId: params.userId,
      feature: params.feature,
      config: { provider: "openai", model },
      promptHash,
      promptTokens,
      completionTokens: 0,
      totalTokens: promptTokens,
      latencyMs,
      validationOutcome,
      safetyFlags: [],
      errorMessage,
    });
  }

  return {
    audio,
    latencyMs,
    tokens: { prompt: promptTokens, completion: 0, total: promptTokens },
    promptHash,
    logId,
    error: errorMessage,
  };
}
