import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const h = vi.hoisted(() => {
  const state: {
    weeklyCheckins: any[];
    users: Record<string, any>;
    nextId: number;
    aiCalls: number;
    aiHandler: (params: any) => Promise<any>;
    mealRows: any[];
  } = {
    weeklyCheckins: [],
    users: {},
    nextId: 1,
    aiCalls: 0,
    aiHandler: async () => ({
      data: {
        wins: ["nice work"],
        concerns: ["watch sleep"],
        burnoutTrajectory: "stable trajectory",
        suggestions: [
          { title: "Hydrate", body: "Aim for 2L most days", category: "nutrition" },
          { title: "Walk", body: "20-min walk on rest days", category: "recovery" },
        ],
      },
    }),
    mealRows: [],
  };

  const storageMock = {
    getCheckInsInRange: async () => [],
    getUserWorkoutLogs: async () => [],
    getBodyMapLogs: async () => [],
    getSleepEntries: async () => [],
    getStepEntries: async () => [],
    getScheduledWorkoutsInRange: async () => [],
    getUser: async (id: string) => state.users[id],
    getWeeklyCheckin: async (userId: string, weekStart: Date) => {
      return state.weeklyCheckins.find(
        (w) =>
          w.userId === userId &&
          new Date(w.weekStart).getTime() === weekStart.getTime(),
      );
    },
    getWeeklyCheckinById: async (id: number) =>
      state.weeklyCheckins.find((w) => w.id === id),
    getUserWeeklyCheckins: async (userId: string, limit: number = 12) =>
      state.weeklyCheckins
        .filter((w) => w.userId === userId)
        .sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime())
        .slice(0, limit),
    createWeeklyCheckin: async (data: any) => {
      const row = {
        id: state.nextId++,
        userId: data.userId,
        weekStart: data.weekStart,
        payload: data.payload,
        acceptedSuggestions: data.acceptedSuggestions ?? [],
        dismissedSuggestions: data.dismissedSuggestions ?? [],
        pointsAwardedAt: null,
        generatedAt: new Date(),
      };
      state.weeklyCheckins.push(row);
      return row;
    },
    updateWeeklyCheckinSuggestions: async (
      id: number,
      accepted: string[],
      dismissed: string[],
    ) => {
      const row = state.weeklyCheckins.find((w) => w.id === id);
      if (!row) throw new Error("not found");
      row.acceptedSuggestions = accepted;
      row.dismissedSuggestions = dismissed;
      return row;
    },
  };

  return { state, storageMock };
});

vi.mock("../server/storage", () => ({ storage: h.storageMock }));
vi.mock("../server/ai", () => ({
  aiCall: (params: any) => {
    h.state.aiCalls++;
    return h.state.aiHandler(params);
  },
}));
vi.mock("../server/burnoutEngine", () => ({
  computeBurnoutScore: () => ({ score: 50, trajectory: "stable" }),
}));
vi.mock("../server/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(h.state.mealRows),
      }),
    }),
  },
}));

import {
  getOrCreateCurrentWeeklyCheckin,
  generateWeeklyCheckinPayload,
  getIsoWeekStart,
} from "../server/weeklyCheckin";
import { storage } from "../server/storage";
import { z } from "zod";

beforeEach(() => {
  h.state.weeklyCheckins.length = 0;
  h.state.users = {};
  h.state.nextId = 1;
  h.state.aiCalls = 0;
  h.state.mealRows = [];
});

function buildApp(userId: string) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { claims: { sub: userId } };
    next();
  });

  app.get("/api/weekly-checkins/current", async (req: any, res) => {
    try {
      const uid = req.user.claims.sub;
      const weekly = await getOrCreateCurrentWeeklyCheckin(uid);
      res.json(weekly);
    } catch (e: any) {
      res.status(500).json({ message: e?.message });
    }
  });

  app.get("/api/weekly-checkins", async (req: any, res) => {
    const uid = req.user.claims.sub;
    const limit = Math.min(Number(req.query.limit) || 12, 52);
    res.json(await storage.getUserWeeklyCheckins(uid, limit));
  });

  app.get("/api/weekly-checkins/:id", async (req: any, res) => {
    const uid = req.user.claims.sub;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const row = await storage.getWeeklyCheckinById(id);
    if (!row) return res.status(404).json({ message: "Not found" });
    if (row.userId !== uid) return res.status(403).json({ message: "Forbidden" });
    res.json(row);
  });

  const suggestionActionSchema = z.object({
    suggestionId: z.string().min(1).max(64),
    action: z.enum(["accept", "dismiss", "reset"]),
  });

  app.post("/api/weekly-checkins/:id/suggestion", async (req: any, res) => {
    const uid = req.user.claims.sub;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const row = await storage.getWeeklyCheckinById(id);
    if (!row) return res.status(404).json({ message: "Not found" });
    if (row.userId !== uid) return res.status(403).json({ message: "Forbidden" });
    const parsed = suggestionActionSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid body", errors: parsed.error.flatten() });
    const { suggestionId, action } = parsed.data;
    const payload = row.payload as { suggestions?: { id: string }[] } | null;
    const validIds = new Set((payload?.suggestions || []).map((s) => s.id));
    if (!validIds.has(suggestionId))
      return res.status(400).json({ message: "Unknown suggestionId for this check-in" });
    const accepted = new Set(row.acceptedSuggestions || []);
    const dismissed = new Set(row.dismissedSuggestions || []);
    accepted.delete(suggestionId);
    dismissed.delete(suggestionId);
    if (action === "accept") accepted.add(suggestionId);
    if (action === "dismiss") dismissed.add(suggestionId);
    const updated = await storage.updateWeeklyCheckinSuggestions(
      id,
      Array.from(accepted) as string[],
      Array.from(dismissed) as string[],
    );
    res.json(updated);
  });

  app.post("/api/admin/weekly-checkins/preview/:userId", async (req: any, res) => {
    const callerId = req.user.claims.sub;
    const me = await storage.getUser(callerId);
    if (!me?.isAdmin) return res.status(403).json({ message: "Admin only" });
    const targetUserId = req.params.userId;
    if (!targetUserId) return res.status(400).json({ message: "userId required" });
    const target = await storage.getUser(targetUserId);
    if (!target) return res.status(404).json({ message: "User not found" });
    const weekStart = getIsoWeekStart();
    const payload = await generateWeeklyCheckinPayload(targetUserId, weekStart);
    res.json({
      userId: targetUserId,
      weekStart: weekStart.toISOString(),
      persisted: false,
      payload,
    });
  });

  return app;
}

describe("GET /api/weekly-checkins/current", () => {
  it("creates the current-week check-in on first call", async () => {
    const app = buildApp("user-A");
    const res = await request(app).get("/api/weekly-checkins/current");
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe("user-A");
    expect(res.body.payload.summary.wins).toEqual(["nice work"]);
    expect(res.body.payload.suggestions).toHaveLength(2);
    expect(h.state.aiCalls).toBe(1);
    expect(h.state.weeklyCheckins).toHaveLength(1);

    const stored = h.state.weeklyCheckins[0];
    const expected = getIsoWeekStart();
    expect(new Date(stored.weekStart).getTime()).toBe(expected.getTime());
  });

  it("is idempotent: a second call within the same ISO week returns the same row and does not re-invoke AI", async () => {
    const app = buildApp("user-A");
    const first = await request(app).get("/api/weekly-checkins/current");
    expect(first.status).toBe(200);

    const second = await request(app).get("/api/weekly-checkins/current");
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(h.state.aiCalls).toBe(1);
    expect(h.state.weeklyCheckins).toHaveLength(1);
  });
});

describe("GET /api/weekly-checkins (history)", () => {
  it("returns the user's check-ins ordered by week start desc and respects limit", async () => {
    const userId = "user-history";
    const week1 = new Date(Date.UTC(2025, 3, 21));
    const week2 = new Date(Date.UTC(2025, 3, 28));
    const week3 = new Date(Date.UTC(2025, 4, 5));
    h.state.weeklyCheckins.push(
      { id: 1, userId, weekStart: week1, payload: { suggestions: [] }, acceptedSuggestions: [], dismissedSuggestions: [], pointsAwardedAt: null, generatedAt: new Date() },
      { id: 2, userId, weekStart: week2, payload: { suggestions: [] }, acceptedSuggestions: [], dismissedSuggestions: [], pointsAwardedAt: null, generatedAt: new Date() },
      { id: 3, userId, weekStart: week3, payload: { suggestions: [] }, acceptedSuggestions: [], dismissedSuggestions: [], pointsAwardedAt: null, generatedAt: new Date() },
      { id: 4, userId: "other", weekStart: week3, payload: { suggestions: [] }, acceptedSuggestions: [], dismissedSuggestions: [], pointsAwardedAt: null, generatedAt: new Date() },
    );

    const app = buildApp(userId);
    const res = await request(app).get("/api/weekly-checkins?limit=2");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe(3);
    expect(res.body[1].id).toBe(2);
    expect(res.body.every((r: any) => r.userId === userId)).toBe(true);
  });
});

describe("POST /api/weekly-checkins/:id/suggestion", () => {
  function seed(userId: string) {
    const row = {
      id: 42,
      userId,
      weekStart: getIsoWeekStart(),
      payload: {
        suggestions: [
          { id: "s1", title: "A", body: "aaa", category: "general" },
          { id: "s2", title: "B", body: "bbb", category: "recovery" },
        ],
      },
      acceptedSuggestions: [],
      dismissedSuggestions: [],
      pointsAwardedAt: null,
      generatedAt: new Date(),
    };
    h.state.weeklyCheckins.push(row);
    return row;
  }

  it("accepts a suggestion and persists it", async () => {
    seed("user-S");
    const app = buildApp("user-S");
    const res = await request(app)
      .post("/api/weekly-checkins/42/suggestion")
      .send({ suggestionId: "s1", action: "accept" });
    expect(res.status).toBe(200);
    expect(res.body.acceptedSuggestions).toEqual(["s1"]);
    expect(res.body.dismissedSuggestions).toEqual([]);
  });

  it("dismiss then reset clears both lists", async () => {
    seed("user-S");
    const app = buildApp("user-S");
    await request(app)
      .post("/api/weekly-checkins/42/suggestion")
      .send({ suggestionId: "s2", action: "dismiss" });
    const res = await request(app)
      .post("/api/weekly-checkins/42/suggestion")
      .send({ suggestionId: "s2", action: "reset" });
    expect(res.status).toBe(200);
    expect(res.body.acceptedSuggestions).toEqual([]);
    expect(res.body.dismissedSuggestions).toEqual([]);
  });

  it("rejects unknown suggestion ids with 400", async () => {
    seed("user-S");
    const app = buildApp("user-S");
    const res = await request(app)
      .post("/api/weekly-checkins/42/suggestion")
      .send({ suggestionId: "does-not-exist", action: "accept" });
    expect(res.status).toBe(400);
  });

  it("rejects invalid bodies with 400", async () => {
    seed("user-S");
    const app = buildApp("user-S");
    const res = await request(app)
      .post("/api/weekly-checkins/42/suggestion")
      .send({ suggestionId: "s1", action: "bogus" });
    expect(res.status).toBe(400);
  });

  it("returns 403 when accessing another user's check-in", async () => {
    seed("user-S");
    const app = buildApp("user-OTHER");
    const res = await request(app)
      .post("/api/weekly-checkins/42/suggestion")
      .send({ suggestionId: "s1", action: "accept" });
    expect(res.status).toBe(403);
  });

  it("returns 404 when the check-in does not exist", async () => {
    const app = buildApp("user-S");
    const res = await request(app)
      .post("/api/weekly-checkins/9999/suggestion")
      .send({ suggestionId: "s1", action: "accept" });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/admin/weekly-checkins/preview/:userId", () => {
  it("rejects non-admin callers with 403", async () => {
    h.state.users["caller"] = { id: "caller", isAdmin: false };
    h.state.users["target"] = { id: "target", isAdmin: false };
    const app = buildApp("caller");
    const res = await request(app)
      .post("/api/admin/weekly-checkins/preview/target")
      .send({});
    expect(res.status).toBe(403);
  });

  it("returns the generated payload without persisting when caller is admin", async () => {
    h.state.users["admin"] = { id: "admin", isAdmin: true };
    h.state.users["target"] = { id: "target", isAdmin: false };
    const app = buildApp("admin");
    const res = await request(app)
      .post("/api/admin/weekly-checkins/preview/target")
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.persisted).toBe(false);
    expect(res.body.userId).toBe("target");
    expect(res.body.payload.summary.wins).toEqual(["nice work"]);
    // no row was persisted in the in-memory store
    expect(h.state.weeklyCheckins).toHaveLength(0);
  });

  it("returns 404 when the target user does not exist", async () => {
    h.state.users["admin"] = { id: "admin", isAdmin: true };
    const app = buildApp("admin");
    const res = await request(app)
      .post("/api/admin/weekly-checkins/preview/missing")
      .send({});
    expect(res.status).toBe(404);
  });
});
