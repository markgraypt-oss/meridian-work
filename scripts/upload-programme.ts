import { db } from "../server/db";
import { sql } from "drizzle-orm";

interface SetData { reps: string; duration: string; }
interface ExerciseInput { name: string; libraryId: number; position: number; sets: SetData[]; durationType?: string | null; }
interface BlockInput { section: "warmup" | "main"; blockType: "single" | "superset" | "circuit"; position: number; rest: string; exercises: ExerciseInput[]; }
interface WorkoutInput { name: string; description: string; dayPosition: number; blocks: BlockInput[]; }
interface ProgrammeInput {
  title: string; description: string; weeks: number; daysPerWeek: number;
  goal: string; difficulty: string; category: string[]; tags: string[];
  equipment: string; workouts: WorkoutInput[];
}

async function upload(prog: ProgrammeInput) {
  const t0 = Date.now();
  
  const [{ id: programId }] = (await db.execute(sql`
    INSERT INTO programs (title, description, duration, weeks, training_days_per_week, goal, difficulty, source_type, category, tags, equipment)
    VALUES (${prog.title}, ${prog.description}, ${prog.weeks * 7}, ${prog.weeks}, ${prog.daysPerWeek}, ${prog.goal}, ${prog.difficulty}, 'manual',
    ${sql.raw(`ARRAY[${prog.category.map(c => `'${c}'`).join(',')}]`)},
    ${sql.raw(`ARRAY[${prog.tags.map(t => `'${t}'`).join(',')}]`)},
    ${prog.equipment}) RETURNING id
  `)) as any;

  const weekRows = (await db.execute(sql`
    INSERT INTO program_weeks (program_id, week_number)
    SELECT ${programId}, g FROM generate_series(1, ${prog.weeks}) g RETURNING id, week_number
  `)) as any;
  const weekIds = weekRows.map((w: any) => w.id);

  await db.execute(sql`
    INSERT INTO program_days (week_id, position)
    SELECT w, d FROM unnest(${sql.raw(`ARRAY[${weekIds.join(',')}]::int[]`)}) w, generate_series(0, 6) d
  `);

  const allDays = (await db.execute(sql`
    SELECT id, week_id, position FROM program_days
    WHERE week_id = ANY(${sql.raw(`ARRAY[${weekIds.join(',')}]::int[]`)})
    ORDER BY week_id, position
  `)) as any;

  for (const wo of prog.workouts) {
    const dayIds = allDays.filter((d: any) => d.position === wo.dayPosition).map((d: any) => d.id);
    if (!dayIds.length) continue;

    const woRows = (await db.execute(sql`
      INSERT INTO programme_workouts (day_id, name, description, position, workout_type, category, difficulty)
      SELECT d, ${wo.name}, ${wo.description}, 0, 'regular', 'strength', ${prog.difficulty}
      FROM unnest(${sql.raw(`ARRAY[${dayIds.join(',')}]::int[]`)}) d RETURNING id
    `)) as any;
    const woIds = woRows.map((r: any) => r.id);

    for (const block of wo.blocks) {
      const bRows = (await db.execute(sql`
        INSERT INTO programme_workout_blocks (workout_id, section, block_type, position, rest)
        SELECT w, ${block.section}, ${block.blockType}, ${block.position}, ${block.rest}
        FROM unnest(${sql.raw(`ARRAY[${woIds.join(',')}]::int[]`)}) w RETURNING id
      `)) as any;
      const bIds = bRows.map((r: any) => r.id);

      for (const ex of block.exercises) {
        const setsJson = JSON.stringify(ex.sets);
        await db.execute(sql`
          INSERT INTO programme_block_exercises (block_id, exercise_library_id, position, sets, duration_type)
          SELECT b, ${ex.libraryId}, ${ex.position}, ${setsJson}::jsonb, ${ex.durationType || null}
          FROM unnest(${sql.raw(`ARRAY[${bIds.join(',')}]::int[]`)}) b
        `);
      }
    }
  }

  console.log(`Programme "${prog.title}" uploaded as ID ${programId} in ${Date.now() - t0}ms`);
  return programId;
}

function s(reps: string, count: number): SetData[] {
  return Array.from({ length: count }, () => ({ reps, duration: "" }));
}
function st(duration: string): SetData[] {
  return [{ reps: "", duration }];
}

export { upload, s, st, ProgrammeInput, WorkoutInput, BlockInput, ExerciseInput };
