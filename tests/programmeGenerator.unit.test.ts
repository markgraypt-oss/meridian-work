import { describe, it, expect, vi } from "vitest";

// programmeGenerator imports ../db at module load, which throws when
// DATABASE_URL is unset. Stub the module so these pure-function tests
// stay environment-independent.
vi.mock("../server/db", () => ({ db: {} }));
vi.mock("../server/storage", () => ({ storage: {} }));

import {
  pruneProgramme,
  pruneWorkout,
  filterCatalogueByContraindications,
} from "../server/ai/programmeGenerator";

const cat = [
  { id: 1, name: "Squat", mainMuscle: ["quads"], equipment: ["barbell"] },
  { id: 2, name: "Bench Press", mainMuscle: ["chest"], equipment: ["barbell"] },
  { id: 3, name: "Push-up", mainMuscle: ["chest"], equipment: ["bodyweight"] },
  { id: 4, name: "Bird Dog", mainMuscle: ["lower back"], equipment: ["bodyweight"] },
  { id: 5, name: "Plank", mainMuscle: ["core"], equipment: ["bodyweight"] },
];

describe("filterCatalogueByContraindications", () => {
  it("returns the same catalogue when no contraindications/avoid IDs are supplied", () => {
    const out = filterCatalogueByContraindications(cat, [], []);
    expect(out).toHaveLength(cat.length);
  });

  it("removes entries whose mainMuscle matches an avoid muscle (case-insensitive)", () => {
    const out = filterCatalogueByContraindications(cat, ["Lower Back"], []);
    expect(out.find((e) => e.id === 4)).toBeUndefined();
    expect(out.map((e) => e.id).sort()).toEqual([1, 2, 3, 5]);
  });

  it("removes entries whose id is in the avoid list", () => {
    const out = filterCatalogueByContraindications(cat, [], [2, 5]);
    expect(out.map((e) => e.id).sort()).toEqual([1, 3, 4]);
  });

  it("combines muscle + id filters", () => {
    const out = filterCatalogueByContraindications(cat, ["chest"], [1]);
    expect(out.map((e) => e.id).sort()).toEqual([4, 5]);
  });
});

describe("pruneWorkout", () => {
  const workout = {
    name: "Test",
    description: null,
    category: "strength" as const,
    difficulty: "beginner" as const,
    duration: 30,
    blocks: [
      {
        section: "main" as const,
        blockType: "single" as const,
        rest: null,
        exercises: [
          { exerciseLibraryId: 1, sets: [{ reps: 5 }] },
          { exerciseLibraryId: 999, sets: [{ reps: 5 }] }, // unknown
        ],
      },
      {
        section: "main" as const,
        blockType: "single" as const,
        rest: null,
        exercises: [
          { exerciseLibraryId: 1234, sets: [{ reps: 5 }] }, // unknown -> empty -> dropped
        ],
      },
    ],
  };

  it("drops unknown exercise ids and removes empty blocks", () => {
    const out = pruneWorkout(workout, cat);
    expect(out.blocks).toHaveLength(1);
    expect(out.blocks[0].exercises).toHaveLength(1);
    expect(out.blocks[0].exercises[0].exerciseLibraryId).toBe(1);
  });

  it("does not mutate exercises that are all valid", () => {
    const ok = {
      ...workout,
      blocks: [
        {
          section: "main" as const,
          blockType: "single" as const,
          rest: null,
          exercises: [{ exerciseLibraryId: 2, sets: [{ reps: 8 }] }],
        },
      ],
    };
    const out = pruneWorkout(ok, cat);
    expect(out.blocks).toHaveLength(1);
    expect(out.blocks[0].exercises).toHaveLength(1);
  });
});

describe("pruneProgramme", () => {
  it("removes unknown ids, empty blocks, empty workouts and empty days", () => {
    const programme = {
      title: "P",
      description: "d",
      goal: "g",
      difficulty: "beginner" as const,
      weeks: [
        {
          weekNumber: 1,
          days: [
            {
              position: 1,
              workouts: [
                {
                  name: "W1",
                  description: null,
                  category: "strength" as const,
                  difficulty: "beginner" as const,
                  duration: 30,
                  blocks: [
                    {
                      section: "main" as const,
                      blockType: "single" as const,
                      rest: null,
                      exercises: [
                        { exerciseLibraryId: 1, sets: [{ reps: 5 }] },
                        { exerciseLibraryId: 9999, sets: [{ reps: 5 }] },
                      ],
                    },
                  ],
                },
                {
                  name: "W-empty",
                  description: null,
                  category: "strength" as const,
                  difficulty: "beginner" as const,
                  duration: 30,
                  blocks: [
                    {
                      section: "main" as const,
                      blockType: "single" as const,
                      rest: null,
                      exercises: [
                        { exerciseLibraryId: 9999, sets: [{ reps: 5 }] },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              position: 2,
              workouts: [
                {
                  name: "W-all-bad",
                  description: null,
                  category: "strength" as const,
                  difficulty: "beginner" as const,
                  duration: 30,
                  blocks: [
                    {
                      section: "main" as const,
                      blockType: "single" as const,
                      rest: null,
                      exercises: [
                        { exerciseLibraryId: 7777, sets: [{ reps: 5 }] },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const out = pruneProgramme(programme, cat);
    expect(out.weeks).toHaveLength(1);
    expect(out.weeks[0].days).toHaveLength(1);
    expect(out.weeks[0].days[0].workouts).toHaveLength(1);
    expect(out.weeks[0].days[0].workouts[0].name).toBe("W1");
    expect(out.weeks[0].days[0].workouts[0].blocks[0].exercises).toHaveLength(1);
    expect(out.weeks[0].days[0].workouts[0].blocks[0].exercises[0].exerciseLibraryId).toBe(1);
  });
});
