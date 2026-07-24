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
}

const FALLBACK_PRICE: ModelPrice = { promptPerMTok: 3, completionPerMTok: 6 };

const MODEL_PRICES: Record<string, ModelPrice> = {
  // Anthropic
  "claude-sonnet-4-5": { promptPerMTok: 3, completionPerMTok: 15 },
  "claude-opus-4": { promptPerMTok: 15, completionPerMTok: 75 },
  "claude-haiku-35": { promptPerMTok: 0.8, completionPerMTok: 4 },
  "claude-3-5-haiku": { promptPerMTok: 0.8, completionPerMTok: 4 },
  "claude-3-5-sonnet": { promptPerMTok: 3, completionPerMTok: 15 },
  "claude-3-opus": { promptPerMTok: 15, completionPerMTok: 75 },

  // OpenAI GPT-5 family
  "gpt-5.2": { promptPerMTok: 2.5, completionPerMTok: 10 },
  "gpt-5.1": { promptPerMTok: 2.5, completionPerMTok: 10 },
  "gpt-5": { promptPerMTok: 2.5, completionPerMTok: 10 },
  "gpt-5-mini": { promptPerMTok: 0.25, completionPerMTok: 2 },
  "gpt-5-nano": { promptPerMTok: 0.05, completionPerMTok: 0.4 },

  // OpenAI GPT-4.1 family
  "gpt-4.1": { promptPerMTok: 2, completionPerMTok: 8 },
  "gpt-4.1-mini": { promptPerMTok: 0.4, completionPerMTok: 1.6 },
  "gpt-4.1-nano": { promptPerMTok: 0.1, completionPerMTok: 0.4 },

  // OpenAI GPT-4o family
  "gpt-4o": { promptPerMTok: 2.5, completionPerMTok: 10 },
  "gpt-4o-mini": { promptPerMTok: 0.15, completionPerMTok: 0.6 },

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

export function calcCostUsd(
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
