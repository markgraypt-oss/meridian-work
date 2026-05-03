import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const inserts: { table: string; values: any }[] = [];
const enrollmentRows: any[] = []; // empty -> falls back to scheduledWorkouts

function tableName(t: any): string {
  return (
    t?.[Symbol.for("drizzle:Name")] ||
    t?.[Symbol.for("drizzle:BaseName")] ||
    t?._?.name ||
    t?.name ||
    "unknown"
  );
}

function chain(rows: any[]) {
  const obj: any = {
    from: () => obj,
    where: () => obj,
    limit: () => Promise.resolve(rows),
    then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject),
  };
  return obj;
}

let nextId = 1;

vi.mock("../server/db", () => ({
  db: {
    select: (cols?: any) => {
      // First call inside saveGeneratedWorkout asks for exerciseLibrary IDs.
      // Both that and any enrollment lookup are matched here based on
      // the .from(table) call below — we need a chain that varies.
      const obj: any = {
        from: (table: any) => {
          const name = tableName(table);
          if (name.includes("exercise_library") || name === "exercise_library") {
            return chain([{ id: 1 }, { id: 2 }, { id: 3 }]);
          }
          if (name.includes("enrollment") || name.includes("user_program")) {
            return chain(enrollmentRows);
          }
          return chain([]);
        },
      };
      return obj;
    },
    insert: (table: any) => ({
      values: (vals: any) => {
        inserts.push({ table: tableName(table), values: vals });
        const ret = { id: nextId++ };
        return {
          returning: () => Promise.resolve([ret]),
          then: (resolve: any, reject: any) => Promise.resolve([ret]).then(resolve, reject),
        };
      },
    }),
  },
}));

vi.mock("../server/storage", () => ({
  storage: {
    getUser: vi.fn().mockResolvedValue(null),
  },
}));

beforeEach(() => {
  inserts.length = 0;
  enrollmentRows.length = 0;
  nextId = 1;
});

async function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { claims: { sub: "user-test" } };
    next();
  });

  // Mirror the production handler at server/routes.ts for /api/ai/workouts/save.
  app.post("/api/ai/workouts/save", async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { generatedWorkoutSchema, saveGeneratedWorkout } = await import(
        "../server/ai/programmeGenerator"
      );
      const data = generatedWorkoutSchema.parse(req.body.data);
      const inputs = req.body.inputs || { duration: data.duration, difficulty: data.difficulty };
      const workout = await saveGeneratedWorkout({
        inputs,
        data,
        userId,
        aiCallLogId: req.body.logId ? Number(req.body.logId) : undefined,
        scheduleForToday: req.body.scheduleForToday !== false,
      });
      res.status(201).json(workout);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Invalid", errors: error.errors });
      }
      res.status(500).json({ message: error?.message });
    }
  });
  return app;
}

const validPayload = {
  data: {
    name: "Today's session",
    description: "x",
    category: "strength",
    difficulty: "beginner",
    duration: 30,
    blocks: [
      {
        section: "main",
        blockType: "single",
        rest: "60s",
        exercises: [{ exerciseLibraryId: 1, sets: [{ reps: 5 }] }],
      },
    ],
  },
};

describe("POST /api/ai/workouts/save", () => {
  it("writes a scheduledWorkouts row for today when no active enrollment exists", async () => {
    const app = await buildApp();
    const res = await request(app).post("/api/ai/workouts/save").send(validPayload);
    expect(res.status).toBe(201);

    const scheduled = inserts.find((i) => i.table.includes("scheduled_workouts"));
    expect(scheduled, `inserts: ${JSON.stringify(inserts.map((i) => i.table))}`).toBeDefined();
    expect(scheduled!.values.userId).toBe("user-test");
    expect(scheduled!.values.workoutName).toBe("Today's session");
    expect(scheduled!.values.workoutType).toBe("individual");

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const scheduledDate = new Date(scheduled!.values.scheduledDate);
    expect(scheduledDate.getUTCFullYear()).toBe(today.getUTCFullYear());
    expect(scheduledDate.getUTCMonth()).toBe(today.getUTCMonth());
    expect(scheduledDate.getUTCDate()).toBe(today.getUTCDate());
    expect(scheduledDate.getUTCHours()).toBe(0);

    expect(inserts.some((i) => i.table.includes("workouts") && !i.table.includes("scheduled") && !i.table.includes("block"))).toBe(true);
    expect(inserts.some((i) => i.table.includes("program_generations"))).toBe(true);
  });

  it("does NOT write a scheduledWorkouts row when scheduleForToday=false", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/ai/workouts/save")
      .send({ ...validPayload, scheduleForToday: false });
    expect(res.status).toBe(201);
    const scheduled = inserts.find((i) => i.table.includes("scheduled_workouts"));
    expect(scheduled).toBeUndefined();
  });

  it("rejects invalid payloads with 400", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/ai/workouts/save")
      .send({ data: { not: "valid" } });
    expect(res.status).toBe(400);
  });
});
