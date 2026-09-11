import crypto from "crypto";
import { z } from 'zod';
import { analyzeText, analyzeVision, getDefaultConfig, getProviderConfig, type AIProviderConfig } from "../aiProvider";

export type ValidationOutcome = "valid" | "repaired" | "invalid" | "no_schema" | "error" | "timeout";

export interface AiCallParams<T> {
  feature: string;
  prompt: string;
  // Stable prefix blocks (system prompt) that are cached provider-side. Put
  // everything identical across calls here (voice, rules, output shape) and
  // per-call data in `prompt`. See TextAnalysisRequest.system in aiProvider.
  system?: string[];
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
  // Optional transform applied to the parsed JSON BEFORE schema validation, so a
  // near-miss shape from the model can be coerced without spending a repair leg.
  // Must be pure and never throw (wrapped defensively at the call site).
  preValidate?: (obj: any) => any;
}

export interface AiCallResult<T> {
  data: T | null;
  text: string;
  validationOutcome: ValidationOutcome;
  safetyFlags: string[];
  latencyMs: number;
  tokens: { prompt?: number; completion?: number; total?: number; cacheRead?: number; cacheWrite?: number };
  promptHash: string;
  logId?: number;
  provider?: string;
  model?: string;
  error?: string;
}

// Features whose output is short, structured, or classification-shaped and
// does not need the flagship model. When the resolved config is Anthropic's
// default Sonnet, these run on Haiku 4.5 (~1/3 the price) instead. An explicit
// per-feature row in ai_coaching_settings (admin AI Coaching page) still wins,
// so any of these can be pinned back to Sonnet without a deploy. If the
// upstream does not know the cheaper model, aiCall falls back to the original
// model once and logs it.
const CHEAP_TIER_FEATURES = new Set<string>([
  "proactive_greeting",      // one-line greeting
  "coach_content_search",    // chat intent extraction (JSON)
  "coach_memory_extraction", // durable-fact extraction (JSON)
  "content_tagging",         // classification
  "workout_categorize",      // classification
]);
const CHEAP_TIER_MODEL: Record<string, string> = {
  anthropic: "claude-haiku-4-5",
};
const DEFAULT_FLAGSHIP: Record<string, string> = {
  anthropic: "claude-sonnet-4-5",
};

function looksLikeUnknownModel(err: any): boolean {
  const status = err?.status ?? err?.statusCode;
  const msg = String(err?.message || err || "").toLowerCase();
  return (status === 404 || status === 400) && msg.includes("model");
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_TOKENS = 1500;
const HARD_TOKEN_CAP = 4000;
// Cap on the per-call user prompt. The system blocks (stable, cached prefix)
// are capped separately and generously: the exercise catalogue alone is
// ~90k chars, and slicing it (or letting it eat the user prompt's budget, as
// an earlier version did) silently removed the output-shape instructions and
// produced invalid JSON on every workout generation (8 Sep 2026 storm).
const HARD_PROMPT_CHAR_CAP = 60_000;
const HARD_SYSTEM_CHAR_CAP = 400_000;

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

async function resolveConfig(feature: string, override?: { provider?: string; model?: string }): Promise<AiCallConfig> {
  // Precedence: explicit per-feature admin row > caller override > global row
  // > default. Most callers pass the shared `recovery_coach` config as the
  // override, so the per-feature row is how an individual feature is pinned
  // to a different model from the admin AI Coaching page.
  let base: AIProviderConfig | null = null;
  let pinnedByAdmin = false;
  try {
    const { storage } = await import("../storage");
    const settings = await storage.getAllAiCoachingSettings();
    const featureSetting = settings.find((s: any) => s.feature === feature && s.isActive && s.provider && s.model);
    if (featureSetting) {
      base = getProviderConfig(featureSetting);
      pinnedByAdmin = true;
    } else if (override?.provider && override?.model) {
      base = { provider: override.provider, model: override.model };
    } else {
      const globalSetting = settings.find((s: any) => (s.feature === "global" || s.feature === "general") && s.isActive);
      if (globalSetting) base = getProviderConfig(globalSetting);
    }
  } catch {
    if (override?.provider && override?.model) base = { provider: override.provider, model: override.model };
  }
  if (!base) base = getDefaultConfig();

  // Cheap tier: only when nobody pinned the feature and the base is the
  // provider's flagship default (so a deliberate choice of another model is
  // never overridden).
  if (
    !pinnedByAdmin &&
    CHEAP_TIER_FEATURES.has(feature) &&
    CHEAP_TIER_MODEL[base.provider] &&
    base.model === DEFAULT_FLAGSHIP[base.provider]
  ) {
    return { provider: base.provider, model: CHEAP_TIER_MODEL[base.provider], fallbackModel: base.model };
  }
  return base;
}

interface AiCallConfig extends AIProviderConfig {
  // Set when the cheap tier substituted the model; used for a one-shot
  // fallback if the upstream rejects the cheaper model.
  fallbackModel?: string;
}

async function persistLog(entry: {
  userId?: string | null;
  feature: string;
  config: AIProviderConfig;
  promptHash: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cachedPromptTokens?: number;
  cacheWriteTokens?: number;
  latencyMs: number;
  validationOutcome: ValidationOutcome;
  safetyFlags: string[];
  errorMessage?: string;
}): Promise<number | undefined> {
  try {
    const { db } = await import("../db");
    const { aiCallLogs } = await import("@workspace/db");
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
        cachedPromptTokens: entry.cachedPromptTokens ?? 0,
        cacheWriteTokens: entry.cacheWriteTokens ?? 0,
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

// One line per provider leg in the Repl logs, so cache behaviour can be read
// without opening the admin page: `in` is uncached input, `read`/`write` the
// prompt-cache split. A second leg showing `write` instead of `read` means
// the cached prefix did not match the first leg.
function logLegUsage(feature: string, leg: number, usage?: { promptTokens?: number; completionTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number }): void {
  if (!usage) return;
  const read = usage.cacheReadTokens ?? 0;
  const write = usage.cacheWriteTokens ?? 0;
  const uncached = Math.max(0, (usage.promptTokens ?? 0) - read - write);
  console.log(`[aiCall] ${feature} leg=${leg} in=${uncached} cache_read=${read} cache_write=${write} out=${usage.completionTokens ?? 0}`);
}

export async function aiCall<T = unknown>(params: AiCallParams<T>): Promise<AiCallResult<T>> {
  const startedAt = Date.now();
  const safeMaxTokens = Math.min(params.maxTokens ?? DEFAULT_MAX_TOKENS, HARD_TOKEN_CAP);
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // The system blocks are the stable, cached prefix; the char cap applies to
  // the combined text so the total request size stays bounded as before.
  const systemBlocks = (params.system || []).map((b) => redactPII(b));
  const systemChars = systemBlocks.reduce((n, b) => n + b.length, 0);
  if (systemChars > HARD_SYSTEM_CHAR_CAP) {
    console.warn(`[aiCall] ${params.feature}: system blocks are ${systemChars} chars (> ${HARD_SYSTEM_CHAR_CAP}); trimming the LAST block. Reduce what the caller puts in system.`);
    const over = systemChars - HARD_SYSTEM_CHAR_CAP;
    const last = systemBlocks.length - 1;
    systemBlocks[last] = systemBlocks[last].slice(0, Math.max(0, systemBlocks[last].length - over));
  }
  if (params.prompt.length > HARD_PROMPT_CHAR_CAP) {
    console.warn(`[aiCall] ${params.feature}: prompt is ${params.prompt.length} chars (> ${HARD_PROMPT_CHAR_CAP}); truncating. Move stable content into system blocks.`);
  }
  const redactedPrompt = redactPII(params.prompt).slice(0, HARD_PROMPT_CHAR_CAP);
  const promptHash = hashPrompt(systemBlocks.join("\n") + "\n" + redactedPrompt);

  const config = await resolveConfig(params.feature, { provider: params.provider, model: params.model });

  let validationOutcome: ValidationOutcome = params.schema ? "invalid" : "no_schema";
  let safetyFlags: string[] = [];
  let rawText = "";
  let parsed: T | null = null;
  let errorMessage: string | undefined;
  // Track per-leg usage so we can estimate any missing leg independently
  // (avoids undercount when only one of first/repair returns provider usage).
  type Leg = {
    promptTokens?: number;
    completionTokens?: number;
    cacheRead?: number;
    cacheWrite?: number;
    promptText: string;
    completionText: string;
  };
  const legs: Leg[] = [];
  const systemText = systemBlocks.join("\n");

  // One call to the provider with the cheap-tier fallback: if the substituted
  // cheaper model is unknown upstream, retry once on the original model and
  // keep using it for the rest of this aiCall.
  const callProvider = async (prompt: string, temperature: number | undefined) => {
    try {
      return await withTimeout(
        analyzeText(
          { prompt, system: systemBlocks.length ? systemBlocks : undefined, maxTokens: safeMaxTokens, temperature },
          config.provider,
          config.model,
        ),
        timeoutMs,
      );
    } catch (err: any) {
      if (config.fallbackModel && looksLikeUnknownModel(err)) {
        console.warn(`[aiCall] ${params.feature}: model ${config.model} rejected upstream, falling back to ${config.fallbackModel}:`, err?.message);
        config.model = config.fallbackModel;
        config.fallbackModel = undefined;
        return await withTimeout(
          analyzeText(
            { prompt, system: systemBlocks.length ? systemBlocks : undefined, maxTokens: safeMaxTokens, temperature },
            config.provider,
            config.model,
          ),
          timeoutMs,
        );
      }
      throw err;
    }
  };

  try {
    const first = await callProvider(redactedPrompt, params.temperature);
    rawText = first.text || "";
    logLegUsage(params.feature, 1, first.usage);
    legs.push({
      promptTokens: first.usage?.promptTokens,
      completionTokens: first.usage?.completionTokens,
      cacheRead: first.usage?.cacheReadTokens,
      cacheWrite: first.usage?.cacheWriteTokens,
      promptText: systemText + redactedPrompt,
      completionText: rawText,
    });

    const applyPre = (obj: any) => {
      if (!params.preValidate) return obj;
      try { return params.preValidate(obj); } catch { return obj; }
    };

    if (params.schema) {
      const jsonStr = extractJson(rawText);
      if (jsonStr) {
        try {
          const obj = JSON.parse(jsonStr);
          const result = params.schema.safeParse(applyPre(obj));
          if (result.success) {
            parsed = result.data;
            validationOutcome = "valid";
          }
        } catch {}
      }

      if (!parsed) {
        // One repair retry: ask the model to return only valid JSON matching the
        // schema. Keep the retry tight to avoid runaway cost.
        // The repair leg re-sends the same system blocks, so with caching on
        // it pays the cached rate for the prefix rather than the full price.
        const repairPrompt = `${redactedPrompt}\n\nIMPORTANT: Your previous response did not return valid JSON. Respond ONLY with raw JSON. No prose, no code fences.`;
        try {
          const second = await callProvider(repairPrompt, 0);
          const secondText = second.text || "";
          logLegUsage(params.feature, 2, second.usage);
          rawText = secondText || rawText;
          legs.push({
            promptTokens: second.usage?.promptTokens,
            completionTokens: second.usage?.completionTokens,
            cacheRead: second.usage?.cacheReadTokens,
            cacheWrite: second.usage?.cacheWriteTokens,
            promptText: systemText + repairPrompt,
            completionText: secondText,
          });
          const jsonStr2 = extractJson(rawText);
          if (jsonStr2) {
            try {
              const obj = JSON.parse(jsonStr2);
              const result = params.schema.safeParse(applyPre(obj));
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
  // On a schema failure keep a short preview of what the model actually sent,
  // so the admin AI Activity page shows WHY instead of a bare "invalid".
  if (params.schema && parsed === null && !errorMessage && rawText) {
    const flat = rawText.replace(/\s+/g, " ").trim();
    const preview = flat.length > 300 ? `${flat.slice(0, 180)} … ${flat.slice(-100)}` : flat;
    errorMessage = `invalid_json_preview: ${preview}`;
  }
  // Prefer real provider usage per leg; fall back to ~chars/4 estimate
  // for whichever leg the provider didn't report. Ensures totals don't
  // undercount when only one of first/repair returned usage.
  let promptTokens = 0;
  let completionTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  if (legs.length === 0) {
    promptTokens = estimateTokens(systemText + redactedPrompt);
    completionTokens = estimateTokens(rawText);
  } else {
    for (const leg of legs) {
      promptTokens += leg.promptTokens ?? estimateTokens(leg.promptText);
      completionTokens += leg.completionTokens ?? estimateTokens(leg.completionText);
      cacheReadTokens += leg.cacheRead ?? 0;
      cacheWriteTokens += leg.cacheWrite ?? 0;
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
      cachedPromptTokens: cacheReadTokens,
      cacheWriteTokens,
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
    tokens: { prompt: promptTokens, completion: completionTokens, total: totalTokens, cacheRead: cacheReadTokens, cacheWrite: cacheWriteTokens },
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
