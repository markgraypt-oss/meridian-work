import { pool } from './db';

async function migrateToHierarchical() {
  console.log('Starting hierarchical migration...');
  
  try {
    // Get all programs
    const programsResult = await pool.query('SELECT id, title, weeks FROM programs');
    const programs = programsResult.rows;
    console.log(`Found ${programs.length} programs to migrate`);
    
    for (const program of programs) {
      console.log(`\nMigrating program: ${program.title} (ID: ${program.id})`);
      
      // Create weeks for this program
      const weekIds: number[] = [];
      for (let weekNum = 1; weekNum <= program.weeks; weekNum++) {
        const weekResult = await pool.query(
          'INSERT INTO program_weeks (program_id, week_number) VALUES ($1, $2) RETURNING id',
          [program.id, weekNum]
        );
        weekIds.push(weekResult.rows[0].id);
      }
      console.log(`  Created ${weekIds.length} weeks`);
      
      // For each week, create days
      for (let weekIdx = 0; weekIdx < weekIds.length; weekIdx++) {
        const weekId = weekIds[weekIdx];
        const dayIds: number[] = [];
        
        for (let dayPos = 1; dayPos <= 7; dayPos++) {
          const dayResult = await pool.query(
            'INSERT INTO program_days (week_id, position) VALUES ($1, $2) RETURNING id',
            [weekId, dayPos]
          );
          dayIds.push(dayResult.rows[0].id);
        }
        
        const weekNum = weekIdx + 1;
        
        // Get exercises for this week from old program_exercises table
        const exercisesResult = await pool.query(
          'SELECT id, exercise_library_id, day, order_index, sets, reps, rest, tempo, notes FROM program_exercises WHERE program_id = $1 AND week = $2 ORDER BY day, order_index',
          [program.id, weekNum]
        );
        const exercises = exercisesResult.rows;
        
        if (exercises.length === 0) {
          console.log(`    Week ${weekNum}: No exercises found`);
          continue;
        }
        
        // Group exercises by day
        const exercisesByDay: Map<number, any[]> = new Map();
        for (const exercise of exercises) {
          const day = exercise.day;
          if (!exercisesByDay.has(day)) {
            exercisesByDay.set(day, []);
          }
          exercisesByDay.get(day)!.push(exercise);
        }
        
        // Create workouts and exercises
        let totalExercises = 0;
        for (const [dayPos, dayExercises] of exercisesByDay) {
          if (dayPos >= 1 && dayPos <= 7) {
            const dayId = dayIds[dayPos - 1];
            
            // Create workout for this day
            const workoutResult = await pool.query(
              'INSERT INTO programme_workouts (day_id, name, position) VALUES ($1, $2, $3) RETURNING id',
              [dayId, `Day ${dayPos} Workout`, 1]
            );
            const workoutId = workoutResult.rows[0].id;
            
            // Add exercises to workout
            for (const exercise of dayExercises) {
              await pool.query(
                `INSERT INTO programme_exercises 
                (workout_id, exercise_library_id, position, sets, reps, rest, tempo, notes) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                  workoutId,
                  exercise.exercise_library_id,
                  exercise.order_index,
                  exercise.sets,
                  exercise.reps,
                  exercise.rest,
                  exercise.tempo || null,
                  exercise.notes || null,
                ]
              );
            }
            
            totalExercises += dayExercises.length;
            console.log(`    Week ${weekNum} Day ${dayPos}: ${dayExercises.length} exercises`);
          }
        }
        
        if (totalExercises === 0) {
          console.log(`    Week ${weekNum}: No workouts created`);
        }
      }
    }
    
    console.log('\n✓ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateToHierarchical();
