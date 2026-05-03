import { z } from "zod";
import { storage } from "../storage";
import { aiCall } from "../ai";
import { getFeatureConfig } from "../aiProvider";

const extractionSchema = z.object({
  memories: z.array(z.object({
    key: z.string().min(1).max(60),
    value: z.string().min(1).max(280),
    category: z.enum(["preference", "constraint", "tried", "goal", "general"]).default("general"),
    importance: z.number().int().min(1).max(5).default(3),
  })).max(6),
});

const KEY_RE = /^[a-z0-9_]+$/;

function slugifyKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
}

export async function getTopMemoriesText(userId: string, n: number = 8): Promise<string> {
  try {
    const rows = await storage.getTopCoachMemory(userId, n);
    if (!rows.length) return "";
    return rows.map((m) => `- (${m.category}) ${m.value}`).join("\n");
  } catch {
    return "";
  }
}

export async function getTopMemoriesWithRows(
  userId: string,
  n: number = 8,
): Promise<{ text: string; rows: Awaited<ReturnType<typeof storage.getTopCoachMemory>> }> {
  try {
    const rows = await storage.getTopCoachMemory(userId, n);
    if (!rows.length) return { text: "", rows: [] };
    const text = rows.map((m) => `- (${m.category}) ${m.value}`).join("\n");
    return { text, rows };
  } catch {
    return { text: "", rows: [] };
  }
}

/**
 * Extract durable facts from a single chat exchange and upsert them.
 * Fire-and-forget from the chat route; never throws to the caller.
 */
export async function extractAndStoreMemories(
  userId: string,
  userMessage: string,
  assistantMessage: string,
): Promise<void> {
  try {
    const config = await getFeatureConfig("recovery_coach");
    if (!config) return;

    const prompt = `You extract durable facts about a user from a single coaching exchange. Output JSON only.

Output shape:
{ "memories": [ { "key": "snake_case_short_id", "value": "human readable fact <= 240 chars", "category": "preference" | "constraint" | "tried" | "goal" | "general", "importance": 1-5 } ] }

RULES:
- Only include facts that will still be useful in 2 weeks. No transient mood, no one-off questions.
- Examples to keep: dietary restrictions, equipment access, schedule constraints, recurring injuries, preferred training time, named goals, things the user said do not work for them.
- Examples to skip: today's weather, what they had for lunch yesterday, the model's recommendations.
- Importance 5 = critical safety/medical context, 4 = strong stated preference or goal, 3 = useful preference, 1-2 = mild.
- Up to 6 memories. Return [] if nothing durable was shared.
- key must be snake_case, <=60 chars, descriptive (e.g. "lactose_intolerant", "preferred_training_time", "knee_pain_history").
- Do not include any prose outside the JSON.

USER MESSAGE:
"""${userMessage.slice(0, 1500)}"""

COACH REPLY:
"""${assistantMessage.slice(0, 1500)}"""

Return only the JSON object now.`;

    const result = await aiCall({
      feature: "coach_memory_extraction",
      userId,
      prompt,
      maxTokens: 400,
      provider: config.provider,
      model: config.model,
      schema: extractionSchema,
      temperature: 0,
    });

    if (!result.data?.memories?.length) return;

    for (const m of result.data.memories) {
      const key = KEY_RE.test(m.key) ? m.key : slugifyKey(m.key);
      if (!key) continue;
      try {
        await storage.upsertCoachMemory(userId, key, m.value, {
          category: m.category,
          source: "chat",
          importance: m.importance,
        });
      } catch (e) {
        console.error("[coach-memory] upsert failed:", e);
      }
    }
  } catch (e) {
    console.error("[coach-memory] extraction failed:", e);
  }
}
