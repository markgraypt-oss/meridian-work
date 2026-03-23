import { db } from "./db";
import { sql } from "drizzle-orm";

interface SetData {
  reps: string;
  duration: string;
}

interface ExerciseData {
  exerciseLibraryId: number;
  position: number;
  sets: SetData[];
  durationType?: string | null;
}

interface BlockData {
  section: "warmup" | "main";
  blockType: "single" | "superset" | "circuit";
  position: number;
  rest: string;
  exercises: ExerciseData[];
}

interface WorkoutData {
  name: string;
  description: string;
  dayPosition: number;
  workoutType?: string;
  category?: string;
  difficulty?: string;
  blocks: BlockData[];
}

interface ProgrammeData {
  title: string;
  description: string;
  weeks: number;
  trainingDaysPerWeek: number;
  goal: string;
  difficulty: string;
  sourceType: string;
  category: string[];
  tags: string[];
  equipment: string;
  workouts: WorkoutData[];
}

export async function uploadProgramme(data: ProgrammeData): Promise<{ programId: number }> {
  const result = await db.execute(sql`
    INSERT INTO programs (title, description, duration, weeks, training_days_per_week, goal, difficulty, source_type, category, tags, equipment)
    VALUES (${data.title}, ${data.description}, ${data.weeks * 7}, ${data.weeks}, ${data.trainingDaysPerWeek}, ${data.goal}, ${data.difficulty}, ${data.sourceType},
    ${sql.raw(`ARRAY[${data.category.map(c => `'${c}'`).join(',')}]`)},
    ${sql.raw(`ARRAY[${data.tags.map(t => `'${t}'`).join(',')}]`)},
    ${data.equipment})
    RETURNING id
  `);
  const programId = (result as any).rows?.[0]?.id ?? (result as any)[0]?.id;

  const weekRows = await db.execute(sql`
    INSERT INTO program_weeks (program_id, week_number)
    SELECT ${programId}, generate_series(1, ${data.weeks})
    RETURNING id, week_number
  `);
  const weeks = (weekRows as any).rows ?? weekRows;

  const weekIds = weeks.map((w: any) => w.id);

  await db.execute(sql`
    INSERT INTO program_days (week_id, position)
    SELECT w.id, d.pos
    FROM unnest(${sql.raw(`ARRAY[${weekIds.join(',')}]::int[]`)} ) AS w(id),
    generate_series(0, 6) AS d(pos)
  `);

  const dayRows = await db.execute(sql`
    SELECT pd.id, pd.week_id, pd.position
    FROM program_days pd
    WHERE pd.week_id = ANY(${sql.raw(`ARRAY[${weekIds.join(',')}]::int[]`)})
    ORDER BY pd.week_id, pd.position
  `);
  const days = (dayRows as any).rows ?? dayRows;

  for (const workout of data.workouts) {
    const workoutDays = days.filter((d: any) => d.position === workout.dayPosition);

    if (workoutDays.length === 0) continue;

    const dayIdList = workoutDays.map((d: any) => d.id);

    const woRows = await db.execute(sql`
      INSERT INTO programme_workouts (day_id, name, description, position, workout_type, category, difficulty)
      SELECT d.id, ${workout.name}, ${workout.description}, 0,
        ${workout.workoutType || 'regular'}, ${workout.category || 'strength'}, ${workout.difficulty || data.difficulty}
      FROM unnest(${sql.raw(`ARRAY[${dayIdList.join(',')}]::int[]`)}) AS d(id)
      RETURNING id, day_id
    `);
    const workoutRows = (woRows as any).rows ?? woRows;
    const workoutIds = workoutRows.map((w: any) => w.id);

    for (const block of workout.blocks) {
      const blockRows = await db.execute(sql`
        INSERT INTO programme_workout_blocks (workout_id, section, block_type, position, rest)
        SELECT w.id, ${block.section}, ${block.blockType}, ${block.position}, ${block.rest}
        FROM unnest(${sql.raw(`ARRAY[${workoutIds.join(',')}]::int[]`)}) AS w(id)
        RETURNING id, workout_id
      `);
      const blocks = (blockRows as any).rows ?? blockRows;
      const blockIds = blocks.map((b: any) => b.id);

      for (const exercise of block.exercises) {
        const setsJson = JSON.stringify(exercise.sets);
        await db.execute(sql`
          INSERT INTO programme_block_exercises (block_id, exercise_library_id, position, sets, duration_type)
          SELECT b.id, ${exercise.exerciseLibraryId}, ${exercise.position}, ${setsJson}::jsonb, ${exercise.durationType || null}
          FROM unnest(${sql.raw(`ARRAY[${blockIds.join(',')}]::int[]`)}) AS b(id)
        `);
      }
    }
  }

  return { programId };
}
