// Per-model price table. Prices are USD per 1,000,000 tokens, split into
// prompt (input) and completion (output) rates. Sourced from public provider
// pricing pages — keep in sync when providers change rates. Used as a
// directional cost signal on /admin/ai-activity, not for invoicing.
//
// When usage isn't broken out (TTS, unknown models), we fall back to a blended
// per-million-token rate.
export interface ModelPrice {
  promptPerMTok: number;
  completionPerMTok: number;
  // Prompt-caching multipliers on the prompt rate. Anthropic: reads 0.1x,
  // 5-minute cache writes 1.25x. OpenAI: cached input 0.5x (GPT-4.1/4o) or
  // 0.1x (GPT-5 family), no write premium. Defaults below when absent.
  cacheReadMult?: number;
  cacheWriteMult?: number;
}

const ANTHROPIC_CACHE = { cacheReadMult: 0.1, cacheWriteMult: 1.25 };
const OPENAI_CACHE_GPT5 = { cacheReadMult: 0.1, cacheWriteMult: 1 };
const OPENAI_CACHE_GPT4 = { cacheReadMult: 0.5, cacheWriteMult: 1 };

const FALLBACK_PRICE: ModelPrice = { promptPerMTok: 3, completionPerMTok: 6 };

const MODEL_PRICES: Record<string, ModelPrice> = {
  // Anthropic
  "claude-sonnet-4-5": { promptPerMTok: 3, completionPerMTok: 15, ...ANTHROPIC_CACHE },
  "claude-haiku-4-5": { promptPerMTok: 1, completionPerMTok: 5, ...ANTHROPIC_CACHE },
  "claude-opus-4": { promptPerMTok: 15, completionPerMTok: 75, ...ANTHROPIC_CACHE },
  "claude-haiku-35": { promptPerMTok: 0.8, completionPerMTok: 4, ...ANTHROPIC_CACHE },
  "claude-3-5-haiku": { promptPerMTok: 0.8, completionPerMTok: 4, ...ANTHROPIC_CACHE },
  "claude-3-5-sonnet": { promptPerMTok: 3, completionPerMTok: 15, ...ANTHROPIC_CACHE },
  "claude-3-opus": { promptPerMTok: 15, completionPerMTok: 75, ...ANTHROPIC_CACHE },

  // OpenAI GPT-5 family
  "gpt-5.2": { promptPerMTok: 2.5, completionPerMTok: 10, ...OPENAI_CACHE_GPT5 },
  "gpt-5.1": { promptPerMTok: 2.5, completionPerMTok: 10, ...OPENAI_CACHE_GPT5 },
  "gpt-5": { promptPerMTok: 2.5, completionPerMTok: 10, ...OPENAI_CACHE_GPT5 },
  "gpt-5-mini": { promptPerMTok: 0.25, completionPerMTok: 2, ...OPENAI_CACHE_GPT5 },
  "gpt-5-nano": { promptPerMTok: 0.05, completionPerMTok: 0.4, ...OPENAI_CACHE_GPT5 },

  // OpenAI GPT-4.1 family
  "gpt-4.1": { promptPerMTok: 2, completionPerMTok: 8, ...OPENAI_CACHE_GPT4 },
  "gpt-4.1-mini": { promptPerMTok: 0.4, completionPerMTok: 1.6, ...OPENAI_CACHE_GPT4 },
  "gpt-4.1-nano": { promptPerMTok: 0.1, completionPerMTok: 0.4, ...OPENAI_CACHE_GPT4 },

  // OpenAI GPT-4o family
  "gpt-4o": { promptPerMTok: 2.5, completionPerMTok: 10, ...OPENAI_CACHE_GPT4 },
  "gpt-4o-mini": { promptPerMTok: 0.15, completionPerMTok: 0.6, ...OPENAI_CACHE_GPT4 },

  // OpenAI TTS — priced per 1M characters of input; we approximate by treating
  // promptTokens as character count divided by 4 (matches our estimator).
  // gpt-4o-mini-tts is ~$0.60 per 1M input chars => ~$2.40 per 1M tokens.
  "gpt-4o-mini-tts": { promptPerMTok: 2.4, completionPerMTok: 0 },
  "tts-1": { promptPerMTok: 60, completionPerMTok: 0 },
  "tts-1-hd": { promptPerMTok: 120, completionPerMTok: 0 },
};

export function getModelPrice(model: string | null | undefined): ModelPrice {
  if (!model) return FALLBACK_PRICE;
  return MODEL_PRICES[model] ?? FALLBACK_PRICE;
}

// promptTokens is the TOTAL input (uncached + cached reads + cache writes);
// cachedReadTokens / cacheWriteTokens are the subsets billed at the cache
// rates. Rows logged before caching existed have both at 0 and price exactly
// as before.
export function calcCostUsd(
  model: string | null | undefined,
  promptTokens: number,
  completionTokens: number,
  cachedReadTokens = 0,
  cacheWriteTokens = 0,
): number {
  const price = getModelPrice(model);
  const read = Math.min(Math.max(cachedReadTokens, 0), promptTokens);
  const write = Math.min(Math.max(cacheWriteTokens, 0), promptTokens - read);
  const uncached = promptTokens - read - write;
  const readMult = price.cacheReadMult ?? 1;
  const writeMult = price.cacheWriteMult ?? 1;
  return (
    (uncached / 1_000_000) * price.promptPerMTok +
    (read / 1_000_000) * price.promptPerMTok * readMult +
    (write / 1_000_000) * price.promptPerMTok * writeMult +
    (completionTokens / 1_000_000) * price.completionPerMTok
  );
}

// What the same call would have cost with no caching at all — used to show
// the saving on the admin AI activity page.
export function calcUncachedCostUsd(
  model: string | null | undefined,
  promptTokens: number,
  completionTokens: number,
): number {
  const price = getModelPrice(model);
  return (
    (promptTokens / 1_000_000) * price.promptPerMTok +
    (completionTokens / 1_000_000) * price.completionPerMTok
  );
}

export function getKnownModelPrices(): Record<string, ModelPrice> {
  return { ...MODEL_PRICES };
}
