// Model registry: one place that knows which AI models exist, which to use,
// and what to do when one disappears.
//
// Why this exists (23 Oct 2026): claude-sonnet-4-5 was written into the code
// as the default and the only Sonnet in the allow-list. Anthropic stopped
// serving that name overnight; every coach briefing failed with a 404 for
// five hours and nothing told anyone. Three rules now hold:
//   1. No model name is final. Defaults can be changed with a Secret
//      (AI_FLAGSHIP_MODEL, AI_CHEAP_MODEL, AI_MODEL_FALLBACKS) and a restart,
//      no code change.
//   2. Every call has a fallback chain. If the provider rejects a model as
//      unknown, the next model in the chain is tried, then the next.
//   3. Someone is told. A model rejected upstream is emailed to the admin
//      once per model per day, and the defaults are checked against the
//      provider's live model list at boot.
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { renderBrandedEmail, emailParagraph } from "../emailBrand";

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;

function envList(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : fallback;
}

// Current defaults, overridable from Secrets.
export const FLAGSHIP_MODEL: Record<string, string> = {
  anthropic: process.env.AI_FLAGSHIP_MODEL || "claude-sonnet-5-5",
};
export const CHEAP_MODEL: Record<string, string> = {
  anthropic: process.env.AI_CHEAP_MODEL || "claude-haiku-4-5",
};
// Order of models to try when one is rejected. Flagship first, then the
// cheaper ones: a briefing written by Haiku beats no briefing.
const FALLBACKS: Record<string, string[]> = {
  anthropic: envList("AI_MODEL_FALLBACKS", ["claude-sonnet-5-5", "claude-haiku-5-5", "claude-haiku-4-5"]),
  openai: envList("AI_MODEL_FALLBACKS_OPENAI", ["gpt-5.2", "gpt-5.1", "gpt-5-mini", "gpt-4.1"]),
};

/** Candidate models for one call, in order: the configured one, then the chain. */
export function candidateModels(provider: string, configured: string, explicitFallback?: string): string[] {
  const out: string[] = [];
  const push = (m?: string) => { if (m && !out.includes(m) && !isKnownDead(provider, m)) out.push(m); };
  push(configured);
  push(explicitFallback);
  for (const m of FALLBACKS[provider] || []) push(m);
  // If everything was marked dead (unlikely), still try the configured one so
  // a recovered model is noticed rather than skipped forever.
  if (out.length === 0) out.push(configured);
  return out;
}

export function looksLikeUnknownModel(err: any): boolean {
  const status = err?.status ?? err?.statusCode;
  const msg = String(err?.message || err || "").toLowerCase();
  return (status === 404 || status === 400) && msg.includes("model");
}

// Models the provider has rejected recently. A dead model is skipped for an
// hour, then tried again in case it came back.
const deadUntil = new Map<string, number>();
function key(provider: string, model: string) { return `${provider}:${model}`; }
export function isKnownDead(provider: string, model: string): boolean {
  const until = deadUntil.get(key(provider, model));
  return until != null && until > Date.now();
}
export function markDead(provider: string, model: string) {
  deadUntil.set(key(provider, model), Date.now() + ONE_HOUR);
}

// Live model list from Anthropic, cached for an hour. Used by the admin
// model picker and the boot check. Never required for a call to succeed.
let liveCache: { at: number; ids: string[] } | null = null;
export async function listLiveAnthropicModels(): Promise<string[] | null> {
  if (liveCache && Date.now() - liveCache.at < ONE_HOUR) return liveCache.ids;
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    const client = new Anthropic(process.env.ANTHROPIC_API_KEY
      ? { apiKey }
      : { apiKey, baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL });
    const ids: string[] = [];
    for await (const m of client.models.list({ limit: 100 })) ids.push(m.id);
    liveCache = { at: Date.now(), ids };
    return ids;
  } catch (e: any) {
    console.warn("[ai-models] could not list Anthropic models:", e?.message || e);
    return liveCache?.ids ?? null;
  }
}

// Admin alert, once per model per day. Uses the same Resend setup as the
// tester emails. ADMIN_NOTIFICATION_EMAIL decides where it goes.
const alertedAt = new Map<string, number>();
export async function alertModelProblem(provider: string, model: string, context: string, detail: string): Promise<void> {
  const k = key(provider, model);
  const last = alertedAt.get(k);
  if (last != null && Date.now() - last < ONE_DAY) return;
  alertedAt.set(k, Date.now());
  console.error(`[ai-models] ${provider} rejected model ${model} (${context}): ${detail}`);
  try {
    if (!process.env.RESEND_API_KEY) return;
    const to = process.env.ADMIN_NOTIFICATION_EMAIL || "no-reply@meridian.work";
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "MeridianWork <no-reply@meridian.work>",
      to,
      subject: `AI model problem: ${model} rejected by ${provider}`,
      html: renderBrandedEmail({
        eyebrow: "Internal",
        heading: "An AI model stopped working",
        bodyHtml:
          emailParagraph(`<strong>${provider}</strong> rejected the model <strong>${model}</strong> while running <strong>${context}</strong>.`) +
          emailParagraph(`Provider said: ${detail.slice(0, 300)}`) +
          emailParagraph("Calls are falling back to the next model in the chain automatically, so features keep working. To change the defaults without a code change, set AI_FLAGSHIP_MODEL, AI_CHEAP_MODEL or AI_MODEL_FALLBACKS in Replit Secrets and republish.") +
          emailParagraph(new Date().toLocaleString("en-GB", { timeZone: "Europe/Madrid", timeZoneName: "short" })),
        footerNote: "Sent at most once per model per day.",
      }),
    });
  } catch (e: any) {
    console.error("[ai-models] alert email failed:", e?.message || e);
  }
}

// Boot check: are the defaults in the provider's live list? Logs, and emails
// the admin, if not. Does not block startup.
export async function checkDefaultModelsOnBoot(): Promise<void> {
  const live = await listLiveAnthropicModels();
  if (!live) { console.warn("[ai-models] boot check skipped: no live model list"); return; }
  const wanted = Array.from(new Set([FLAGSHIP_MODEL.anthropic, CHEAP_MODEL.anthropic, ...(FALLBACKS.anthropic || [])]));
  const missing = wanted.filter((m) => !live.includes(m));
  if (missing.length === 0) {
    console.log(`[ai-models] boot check ok: ${wanted.join(", ")} all served by Anthropic`);
    return;
  }
  for (const m of missing) {
    markDead("anthropic", m);
    await alertModelProblem("anthropic", m, "boot check", "not in Anthropic's live model list");
  }
  if (missing.includes(FLAGSHIP_MODEL.anthropic)) {
    console.error(`[ai-models] DEFAULT MODEL ${FLAGSHIP_MODEL.anthropic} is not served. Calls will fall back to: ${(FALLBACKS.anthropic || []).filter((m) => live.includes(m)).join(", ") || "nothing available"}`);
  }
}
