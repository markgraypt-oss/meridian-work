import { describe, it, expect, vi, beforeEach } from "vitest";

const catalogue = [
  { id: 1, name: "Squat", mainMuscle: ["quads"], equipment: ["barbell"] },
  { id: 2, name: "Bench", mainMuscle: ["chest"], equipment: ["barbell"] },
  { id: 3, name: "Push-up", mainMuscle: ["chest"], equipment: ["bodyweight"] },
];

// Chainable db mock — only what programmeGenerator's read paths need.
function chain(rows: any[]) {
  const obj: any = {
    from: () => obj,
    where: () => obj,
    limit: () => Promise.resolve(rows),
    then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject),
  };
  return obj;
}

vi.mock("../server/db", () => ({
  db: {
    select: () => chain(catalogue),
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([{ id: 1 }]) }) }),
  },
}));

vi.mock("../server/storage", () => ({
  storage: {
    getUser: vi.fn().mockResolvedValue(null),
    getBurnoutScore: vi.fn().mockResolvedValue(null),
    getBodyMapLogs: vi.fn().mockResolvedValue([]),
  },
}));

const aiCallMock = vi.fn();
vi.mock("../server/ai/index", () => ({
  aiCall: (...args: any[]) => aiCallMock(...args),
}));

beforeEach(() => {
  aiCallMock.mockReset();
});

const goodWorkout = {
  name: "Test session",
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
};

const badWorkout = {
  ...goodWorkout,
  blocks: [
    {
      ...goodWorkout.blocks[0],
      exercises: [{ exerciseLibraryId: 9999, sets: [{ reps: 5 }] }],
    },
  ],
};

describe("generateWorkoutWithAI repair retry", () => {
  it("re-invokes aiCall with a repair hint when the first response uses an unknown exercise id", async () => {
    aiCallMock
      .mockResolvedValueOnce({
        data: badWorkout,
        text: "",
        validationOutcome: "valid",
        safetyFlags: [],
        latencyMs: 5,
        tokens: {},
        promptHash: "h",
        logId: 1,
      })
      .mockResolvedValueOnce({
        data: goodWorkout,
        text: "",
        validationOutcome: "valid",
        safetyFlags: [],
        latencyMs: 5,
        tokens: {},
        promptHash: "h",
        logId: 2,
      });

    const { generateWorkoutWithAI } = await import("../server/ai/programmeGenerator");
    const result = await generateWorkoutWithAI(
      { duration: 30, difficulty: "beginner", equipment: "full_gym" },
      "user-1",
    );

    expect(aiCallMock).toHaveBeenCalledTimes(2);
    const firstPrompt = aiCallMock.mock.calls[0][0].prompt as string;
    const secondPrompt = aiCallMock.mock.calls[1][0].prompt as string;
    expect(firstPrompt).not.toMatch(/exerciseLibraryId values not in the catalogue/);
    expect(secondPrompt).toMatch(/9999/);
    expect(secondPrompt).toMatch(/exerciseLibraryId values not in the catalogue/);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks[0].exercises[0].exerciseLibraryId).toBe(1);
    }
  });

  it("returns an error when the repair retry still emits unknown ids", async () => {
    aiCallMock
      .mockResolvedValueOnce({
        data: badWorkout,
        text: "",
        validationOutcome: "valid",
        safetyFlags: [],
        latencyMs: 5,
        tokens: {},
        promptHash: "h",
        logId: 1,
      })
      .mockResolvedValueOnce({
        data: badWorkout,
        text: "",
        validationOutcome: "valid",
        safetyFlags: [],
        latencyMs: 5,
        tokens: {},
        promptHash: "h",
        logId: 2,
      });

    const { generateWorkoutWithAI } = await import("../server/ai/programmeGenerator");
    const result = await generateWorkoutWithAI(
      { duration: 30, difficulty: "beginner", equipment: "full_gym" },
      "user-1",
    );

    expect(aiCallMock).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/after one repair attempt/);
    }
  });

  it("does not retry when the first response uses only valid catalogue ids", async () => {
    aiCallMock.mockResolvedValueOnce({
      data: goodWorkout,
      text: "",
      validationOutcome: "valid",
      safetyFlags: [],
      latencyMs: 5,
      tokens: {},
      promptHash: "h",
      logId: 1,
    });

    const { generateWorkoutWithAI } = await import("../server/ai/programmeGenerator");
    const result = await generateWorkoutWithAI(
      { duration: 30, difficulty: "beginner", equipment: "full_gym" },
      "user-1",
    );
    expect(aiCallMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
  });
});
