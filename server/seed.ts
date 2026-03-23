import { db } from "./db";
import { programs, videos, recipes, exerciseLibrary, programExercises, users, companies, checkIns, bodyMapLogs, burnoutScores } from "@shared/schema";
import { v4 as uuidv4 } from "uuid";

async function seedDatabase() {
  console.log("Seeding database...");

  // Seed programs
  const programsData = [
    {
      title: "Executive Strength Building",
      description: "A comprehensive strength training program designed for busy executives. Build muscle and increase power with time-efficient workouts.",
      goal: "performance",
      equipment: "full_gym",
      duration: 45,
      weeks: 12,
      difficulty: "intermediate",
      imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400",
      tags: ["strength", "muscle building", "executive"]
    },
    {
      title: "Fat Loss Protocol",
      description: "High-intensity interval training specifically designed for rapid fat loss while maintaining muscle mass.",
      goal: "fat_loss",
      equipment: "home_gym",
      duration: 30, 
      weeks: 8,
      difficulty: "advanced",
      imageUrl: "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=400",
      tags: ["fat loss", "HIIT", "cardio"]
    },
    {
      title: "Mobility & Recovery",
      description: "Essential mobility work and recovery protocols to keep you performing at your peak.",
      goal: "pain_free",
      equipment: "bodyweight",
      duration: 20,
      weeks: 4,
      difficulty: "beginner",
      imageUrl: "https://images.unsplash.com/photo-1506629905607-24530e9e5a17?w=400",
      tags: ["mobility", "recovery", "flexibility"]
    },
    {
      title: "Executive Performance",
      description: "Build cardiovascular endurance and mental resilience with structured training protocols.",
      goal: "performance",
      equipment: "full_gym",
      duration: 40,
      weeks: 16,
      difficulty: "intermediate",
      imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400",
      tags: ["endurance", "performance", "cardio"]
    }
  ];

  // Seed exercises
  const exercisesData = [
    // Strength exercises
    {
      name: "Barbell Back Squat",
      instructions: "Position bar on shoulders, squat down with controlled tempo, drive through heels to return to standing.",
      mainMuscle: ["quadriceps", "glutes", "hamstrings"],
      equipment: ["barbell", "rack"],
      movement: ["lower body"],
      mechanics: ["compound"],
      level: "intermediate"
    },
    {
      name: "Bench Press",
      instructions: "Lower bar to chest with control, drive explosively back up.",
      mainMuscle: ["chest", "triceps", "shoulders"],
      equipment: ["barbell", "bench"],
      movement: ["upper body", "push"],
      mechanics: ["compound"],
      level: "intermediate"
    },
    {
      name: "Deadlift",
      instructions: "Position feet under bar, keep back flat and core engaged. Drive through heels.",
      mainMuscle: ["hamstrings", "glutes", "back"],
      equipment: ["barbell"],
      movement: ["full body", "lower body"],
      mechanics: ["compound"],
      level: "advanced"
    },
    {
      name: "Weighted Pull-ups",
      instructions: "Using weight belt, pull yourself up with control. Focus on pulling elbows down.",
      mainMuscle: ["back", "biceps", "lats"],
      equipment: ["pull-up bar", "weight belt"],
      movement: ["upper body", "pull"],
      mechanics: ["compound"],
      level: "advanced"
    },
    {
      name: "Overhead Press",
      instructions: "Press barbell overhead from shoulder height with controlled tempo.",
      mainMuscle: ["shoulders", "triceps", "chest"],
      equipment: ["barbell"],
      movement: ["upper body", "push"],
      mechanics: ["compound"],
      level: "intermediate"
    },
    {
      name: "Incline Dumbbell Press",
      instructions: "Press dumbbells upward from incline bench position. Control the descent.",
      mainMuscle: ["chest", "shoulders", "triceps"],
      equipment: ["dumbbells", "incline bench"],
      movement: ["upper body", "push"],
      mechanics: ["compound"],
      level: "intermediate"
    },
    {
      name: "Barbell Bent Row",
      instructions: "Bend at hips with flat back, row barbell to chest explosively.",
      mainMuscle: ["back", "lats", "biceps"],
      equipment: ["barbell"],
      movement: ["upper body", "pull"],
      mechanics: ["compound"],
      level: "intermediate"
    },
    {
      name: "Dumbbell Flyes",
      instructions: "Lie on bench, lower dumbbells in arc motion with slight bend in elbows.",
      mainMuscle: ["chest", "shoulders"],
      equipment: ["dumbbells", "bench"],
      movement: ["upper body", "push"],
      mechanics: ["isolation"],
      level: "intermediate"
    },
    // HIIT exercises
    {
      name: "Burpees",
      instructions: "Squat down, kick feet back, perform push-up, return to squat, jump explosively.",
      mainMuscle: ["full body"],
      equipment: [],
      movement: ["full body"],
      mechanics: ["compound"],
      level: "advanced"
    },
    {
      name: "Mountain Climbers",
      instructions: "From plank position, drive knees explosively toward chest alternating legs.",
      mainMuscle: ["core", "chest", "shoulders"],
      equipment: [],
      movement: ["full body"],
      mechanics: ["compound"],
      level: "intermediate"
    },
    {
      name: "Jump Squats",
      instructions: "Squat down then explode upward with maximum power. Land softly.",
      mainMuscle: ["quadriceps", "glutes", "calves"],
      equipment: [],
      movement: ["lower body", "plyometric"],
      mechanics: ["compound"],
      level: "advanced"
    },
    {
      name: "High Knees Sprint",
      instructions: "Run in place driving knees up to hip height as fast as possible.",
      mainMuscle: ["quadriceps", "hip flexors", "calves"],
      equipment: [],
      movement: ["lower body", "cardio"],
      mechanics: ["isolation"],
      level: "intermediate"
    },
    {
      name: "Push-up to T-Rotation",
      instructions: "Perform push-up, at top rotate to side plank extending arm to sky.",
      mainMuscle: ["chest", "core", "shoulders"],
      equipment: [],
      movement: ["upper body", "core"],
      mechanics: ["compound"],
      level: "advanced"
    },
    {
      name: "Battle Ropes",
      instructions: "Hold ropes, alternate lifting arms explosively while maintaining intensity.",
      mainMuscle: ["shoulders", "core", "arms"],
      equipment: ["battle ropes"],
      movement: ["upper body"],
      mechanics: ["compound"],
      level: "advanced"
    },
    {
      name: "Box Jumps",
      instructions: "Jump explosively onto box, step down controlled. Focus on power and landing.",
      mainMuscle: ["quadriceps", "glutes", "calves"],
      equipment: ["box"],
      movement: ["lower body", "plyometric"],
      mechanics: ["compound"],
      level: "advanced"
    }
  ];

  // Seed videos
  const videosData = [
    {
      title: "Morning Mobility Routine",
      description: "Start your day with this 10-minute mobility sequence to improve range of motion and reduce stiffness.",
      category: "training",
      instructor: "Dr. Sarah Mitchell",
      duration: 600,
      thumbnailUrl: "https://images.unsplash.com/photo-1506629905607-24530e9e5a17?w=400",
      videoUrl: "https://example.com/mobility1",
      tags: ["mobility", "morning", "stretching"]
    },
    {
      title: "Power Lifting Fundamentals",
      description: "Master the basics of powerlifting with proper form and technique for maximum strength gains.",
      category: "training",
      instructor: "Coach Marcus Rodriguez",
      duration: 1500,
      thumbnailUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400",
      videoUrl: "https://example.com/strength1",
      tags: ["strength", "powerlifting", "technique"]
    },
    {
      title: "HIIT Fat Burner",
      description: "Intense 15-minute workout designed to maximize fat burning and boost metabolism.",
      category: "training",
      instructor: "Fitness Pro Amy Chen",
      duration: 900,
      thumbnailUrl: "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=400",
      videoUrl: "https://example.com/cardio1",
      tags: ["HIIT", "fat loss", "cardio"]
    },
    {
      title: "Stress Relief & Recovery",
      description: "Gentle movement flow to reduce stress and improve mental clarity after long workdays.",
      category: "recovery",
      instructor: "Wellness Expert Lisa Park",
      duration: 1200,
      thumbnailUrl: "https://images.unsplash.com/photo-1506629905607-24530e9e5a17?w=400",
      videoUrl: "https://example.com/recovery1",
      tags: ["recovery", "stress relief", "mindfulness"]
    },
    {
      title: "Advanced Compound Movements",
      description: "Take your strength training to the next level with complex multi-joint exercises.",
      category: "training",
      instructor: "Strength Coach David Kim",
      duration: 2100,
      thumbnailUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400",
      videoUrl: "https://example.com/strength2",
      tags: ["advanced", "compound", "strength"]
    }
  ];

  // Seed recipes
  const recipesData = [
    {
      title: "Power Breakfast Bowl",
      description: "High-protein breakfast to fuel your morning with sustained energy.",
      category: "breakfast",
      difficulty: "easy",
      totalTime: 15,
      servings: 1,
      calories: 450,
      protein: 32,
      carbs: 35,
      fat: 18,
      ingredients: ["2 eggs", "1/2 cup oats", "1 banana", "1 tbsp almond butter", "1 cup spinach", "1/4 cup berries"],
      instructions: ["Cook oats with water", "Scramble eggs with spinach", "Slice banana", "Combine in bowl", "Top with almond butter and berries"],
      imageUrl: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400"
    },
    {
      title: "Executive Lunch Salad",
      description: "Nutrient-dense salad perfect for maintaining energy during busy workdays.",
      category: "lunch",
      difficulty: "easy",
      totalTime: 15,
      servings: 1,
      calories: 380,
      protein: 28,
      carbs: 25,
      fat: 20,
      ingredients: ["6 oz chicken breast", "mixed greens", "cherry tomatoes", "avocado", "quinoa", "olive oil", "lemon"],
      instructions: ["Cook chicken breast", "Prepare quinoa", "Chop vegetables", "Combine all ingredients", "Dress with olive oil and lemon"],
      imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400"
    },
    {
      title: "Recovery Protein Smoothie",
      description: "Post-workout smoothie designed for optimal muscle recovery and growth.",
      category: "snacks",
      difficulty: "easy", 
      totalTime: 5,
      servings: 1,
      calories: 320,
      protein: 35,
      carbs: 28,
      fat: 8,
      ingredients: ["1 scoop protein powder", "1 banana", "1 cup almond milk", "1 tbsp peanut butter", "ice"],
      instructions: ["Add all ingredients to blender", "Blend until smooth", "Serve immediately"],
      imageUrl: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400"
    },
    {
      title: "High-Performance Dinner",
      description: "Balanced dinner optimized for recovery and preparation for the next day.",
      category: "dinner",
      difficulty: "medium",
      totalTime: 45,
      servings: 2,
      calories: 520,
      protein: 42,
      carbs: 35,
      fat: 22,
      ingredients: ["8 oz salmon", "sweet potato", "broccoli", "olive oil", "garlic", "herbs"],
      instructions: ["Preheat oven to 400°F", "Season salmon", "Roast sweet potato", "Steam broccoli", "Serve together"],
      imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400"
    }
  ];

  try {
    // Insert programs
    const insertedPrograms = await db.insert(programs).values(programsData).returning();
    console.log("Programs seeded successfully");

    // Insert exercises
    const insertedExercises = await db.insert(exerciseLibrary).values(exercisesData).returning();
    console.log("Exercises seeded successfully");

    // Insert videos  
    await db.insert(videos).values(videosData);
    console.log("Videos seeded successfully");

    // Insert recipes
    await db.insert(recipes).values(recipesData);
    console.log("Recipes seeded successfully");

    const executiveStrengthProgramId = insertedPrograms[0].id;
    const fatLossProtocolProgramId = insertedPrograms[1].id;

    // Program exercises - 5 separate workouts for Executive Strength Building
    const programExercisesData = [
      // ===== EXECUTIVE STRENGTH BUILDING - WORKOUT 1 (Week 1, Day 1): Lower Power =====
      {
        programId: executiveStrengthProgramId,
        exerciseLibraryId: insertedExercises[0].id, // Barbell Back Squat
        week: 1,
        day: 1,
        orderIndex: 1,
        sets: "4",
        reps: "6-8",
        rest: "2 min",
        tempo: "3-1-2-0",
        notes: "Primary lower body strength builder."
      },
      {
        programId: executiveStrengthProgramId,
        exerciseLibraryId: insertedExercises[4].id, // Overhead Press
        week: 1,
        day: 1,
        orderIndex: 2,
        sets: "3",
        reps: "8-10",
        rest: "90 sec",
        tempo: "2-0-2-0",
        notes: "Shoulder stability work."
      },
      {
        programId: executiveStrengthProgramId,
        exerciseLibraryId: insertedExercises[7].id, // Dumbbell Flyes
        week: 1,
        day: 1,
        orderIndex: 3,
        sets: "3",
        reps: "10-12",
        rest: "60 sec",
        tempo: "2-1-2-1",
        notes: "Isolation work for chest."
      },
      // ===== EXECUTIVE STRENGTH BUILDING - WORKOUT 2 (Week 1, Day 3): Upper Push =====
      {
        programId: executiveStrengthProgramId,
        exerciseLibraryId: insertedExercises[1].id, // Bench Press
        week: 1,
        day: 3,
        orderIndex: 1,
        sets: "4",
        reps: "6-8",
        rest: "2 min",
        tempo: "3-1-2-0",
        notes: "Primary upper body pressing pattern."
      },
      {
        programId: executiveStrengthProgramId,
        exerciseLibraryId: insertedExercises[5].id, // Incline Dumbbell Press
        week: 1,
        day: 3,
        orderIndex: 2,
        sets: "3",
        reps: "8-10",
        rest: "90 sec",
        tempo: "2-0-2-0",
        notes: "Upper chest emphasis."
      },
      {
        programId: executiveStrengthProgramId,
        exerciseLibraryId: insertedExercises[4].id, // Overhead Press
        week: 1,
        day: 3,
        orderIndex: 3,
        sets: "3",
        reps: "6-8",
        rest: "90 sec",
        tempo: "2-0-2-0",
        notes: "Secondary pressing work."
      },
      // ===== EXECUTIVE STRENGTH BUILDING - WORKOUT 3 (Week 2, Day 1): Upper Pull =====
      {
        programId: executiveStrengthProgramId,
        exerciseLibraryId: insertedExercises[3].id, // Weighted Pull-ups
        week: 2,
        day: 1,
        orderIndex: 1,
        sets: "4",
        reps: "5-8",
        rest: "2 min",
        tempo: "2-1-2-1",
        notes: "Essential for back strength."
      },
      {
        programId: executiveStrengthProgramId,
        exerciseLibraryId: insertedExercises[6].id, // Barbell Bent Row
        week: 2,
        day: 1,
        orderIndex: 2,
        sets: "3",
        reps: "8-10",
        rest: "90 sec",
        tempo: "2-1-2-1",
        notes: "Horizontal pulling pattern."
      },
      {
        programId: executiveStrengthProgramId,
        exerciseLibraryId: insertedExercises[7].id, // Dumbbell Flyes
        week: 2,
        day: 1,
        orderIndex: 3,
        sets: "3",
        reps: "12-15",
        rest: "60 sec",
        tempo: "2-1-2-1",
        notes: "Finishing isolation work."
      },
      // ===== EXECUTIVE STRENGTH BUILDING - WORKOUT 4 (Week 2, Day 3): Full Body Strength =====
      {
        programId: executiveStrengthProgramId,
        exerciseLibraryId: insertedExercises[2].id, // Deadlift
        week: 2,
        day: 3,
        orderIndex: 1,
        sets: "3",
        reps: "3-5",
        rest: "3 min",
        tempo: "2-0-2-0",
        notes: "Ultimate full body strength exercise."
      },
      {
        programId: executiveStrengthProgramId,
        exerciseLibraryId: insertedExercises[0].id, // Barbell Back Squat
        week: 2,
        day: 3,
        orderIndex: 2,
        sets: "3",
        reps: "8-10",
        rest: "2 min",
        tempo: "2-1-2-0",
        notes: "Secondary lower body work."
      },
      {
        programId: executiveStrengthProgramId,
        exerciseLibraryId: insertedExercises[6].id, // Barbell Bent Row
        week: 2,
        day: 3,
        orderIndex: 3,
        sets: "3",
        reps: "8-10",
        rest: "90 sec",
        tempo: "2-1-2-1",
        notes: "Back thickness work."
      },
      {
        programId: executiveStrengthProgramId,
        exerciseLibraryId: insertedExercises[5].id, // Incline Dumbbell Press
        week: 2,
        day: 3,
        orderIndex: 4,
        sets: "3",
        reps: "10-12",
        rest: "60 sec",
        tempo: "2-0-2-0",
        notes: "Upper chest finisher."
      },
      // ===== EXECUTIVE STRENGTH BUILDING - WORKOUT 5 (Week 3, Day 2): Power & Hypertrophy =====
      {
        programId: executiveStrengthProgramId,
        exerciseLibraryId: insertedExercises[1].id, // Bench Press
        week: 3,
        day: 2,
        orderIndex: 1,
        sets: "3",
        reps: "8-10",
        rest: "90 sec",
        tempo: "2-1-2-0",
        notes: "Hypertrophy focus."
      },
      {
        programId: executiveStrengthProgramId,
        exerciseLibraryId: insertedExercises[3].id, // Weighted Pull-ups
        week: 3,
        day: 2,
        orderIndex: 2,
        sets: "3",
        reps: "8-10",
        rest: "90 sec",
        tempo: "2-1-2-1",
        notes: "Back hypertrophy work."
      },
      {
        programId: executiveStrengthProgramId,
        exerciseLibraryId: insertedExercises[4].id, // Overhead Press
        week: 3,
        day: 2,
        orderIndex: 3,
        sets: "3",
        reps: "8-10",
        rest: "90 sec",
        tempo: "2-0-2-0",
        notes: "Shoulder hypertrophy."
      },
      {
        programId: executiveStrengthProgramId,
        exerciseLibraryId: insertedExercises[0].id, // Barbell Back Squat
        week: 3,
        day: 2,
        orderIndex: 4,
        sets: "3",
        reps: "10-12",
        rest: "90 sec",
        tempo: "2-1-2-0",
        notes: "Lower body hypertrophy."
      },

      // ===== FAT LOSS PROTOCOL - WORKOUT 1 (Week 1, Day 1): Lower HIIT Burst =====
      {
        programId: fatLossProtocolProgramId,
        exerciseLibraryId: insertedExercises[11].id, // Jump Squats
        week: 1,
        day: 1,
        orderIndex: 1,
        sets: "AMRAP",
        reps: "20 sec",
        rest: "10 sec",
        tempo: "explosive",
        notes: "Maximum fat loss lower body."
      },
      {
        programId: fatLossProtocolProgramId,
        exerciseLibraryId: insertedExercises[12].id, // High Knees Sprint
        week: 1,
        day: 1,
        orderIndex: 2,
        sets: "AMRAP",
        reps: "20 sec",
        rest: "10 sec",
        tempo: "explosive",
        notes: "Cardio elevation."
      },
      {
        programId: fatLossProtocolProgramId,
        exerciseLibraryId: insertedExercises[8].id, // Burpees
        week: 1,
        day: 1,
        orderIndex: 3,
        sets: "AMRAP",
        reps: "20 sec",
        rest: "10 sec",
        tempo: "explosive",
        notes: "Full body intensity."
      },
      {
        programId: fatLossProtocolProgramId,
        exerciseLibraryId: insertedExercises[14].id, // Box Jumps
        week: 1,
        day: 1,
        orderIndex: 4,
        sets: "AMRAP",
        reps: "20 sec",
        rest: "10 sec",
        tempo: "explosive",
        notes: "Explosive power finisher."
      },
      // ===== FAT LOSS PROTOCOL - WORKOUT 2 (Week 1, Day 3): Total Body Metabolic =====
      {
        programId: fatLossProtocolProgramId,
        exerciseLibraryId: insertedExercises[9].id, // Mountain Climbers
        week: 1,
        day: 3,
        orderIndex: 1,
        sets: "AMRAP",
        reps: "30 sec",
        rest: "15 sec",
        tempo: "explosive",
        notes: "Core and cardio blast."
      },
      {
        programId: fatLossProtocolProgramId,
        exerciseLibraryId: insertedExercises[13].id, // Battle Ropes
        week: 1,
        day: 3,
        orderIndex: 2,
        sets: "AMRAP",
        reps: "30 sec",
        rest: "15 sec",
        tempo: "explosive",
        notes: "Shoulder and cardio intensity."
      },
      {
        programId: fatLossProtocolProgramId,
        exerciseLibraryId: insertedExercises[10].id, // Push-up to T-Rotation
        week: 1,
        day: 3,
        orderIndex: 3,
        sets: "AMRAP",
        reps: "20 sec",
        rest: "10 sec",
        tempo: "explosive",
        notes: "Core stability and upper body."
      },
      {
        programId: fatLossProtocolProgramId,
        exerciseLibraryId: insertedExercises[11].id, // Jump Squats
        week: 1,
        day: 3,
        orderIndex: 4,
        sets: "AMRAP",
        reps: "20 sec",
        rest: "10 sec",
        tempo: "explosive",
        notes: "Finisher lower body work."
      },
      // ===== FAT LOSS PROTOCOL - WORKOUT 3 (Week 2, Day 1): Upper Body HIIT =====
      {
        programId: fatLossProtocolProgramId,
        exerciseLibraryId: insertedExercises[13].id, // Battle Ropes
        week: 2,
        day: 1,
        orderIndex: 1,
        sets: "AMRAP",
        reps: "30 sec",
        rest: "15 sec",
        tempo: "explosive",
        notes: "Shoulder endurance and heat."
      },
      {
        programId: fatLossProtocolProgramId,
        exerciseLibraryId: insertedExercises[8].id, // Burpees
        week: 2,
        day: 1,
        orderIndex: 2,
        sets: "AMRAP",
        reps: "20 sec",
        rest: "10 sec",
        tempo: "explosive",
        notes: "Full body metabolic boost."
      },
      {
        programId: fatLossProtocolProgramId,
        exerciseLibraryId: insertedExercises[10].id, // Push-up to T-Rotation
        week: 2,
        day: 1,
        orderIndex: 3,
        sets: "AMRAP",
        reps: "20 sec",
        rest: "10 sec",
        tempo: "explosive",
        notes: "Core and upper body."
      },
      {
        programId: fatLossProtocolProgramId,
        exerciseLibraryId: insertedExercises[9].id, // Mountain Climbers
        week: 2,
        day: 1,
        orderIndex: 4,
        sets: "AMRAP",
        reps: "30 sec",
        rest: "15 sec",
        tempo: "explosive",
        notes: "Finishing cardio core work."
      },
      // ===== FAT LOSS PROTOCOL - WORKOUT 4 (Week 2, Day 3): Mixed Modal HIIT =====
      {
        programId: fatLossProtocolProgramId,
        exerciseLibraryId: insertedExercises[12].id, // High Knees Sprint
        week: 2,
        day: 3,
        orderIndex: 1,
        sets: "AMRAP",
        reps: "30 sec",
        rest: "15 sec",
        tempo: "explosive",
        notes: "Cardio lower body focus."
      },
      {
        programId: fatLossProtocolProgramId,
        exerciseLibraryId: insertedExercises[14].id, // Box Jumps
        week: 2,
        day: 3,
        orderIndex: 2,
        sets: "AMRAP",
        reps: "20 sec",
        rest: "10 sec",
        tempo: "explosive",
        notes: "Explosive lower body."
      },
      {
        programId: fatLossProtocolProgramId,
        exerciseLibraryId: insertedExercises[13].id, // Battle Ropes
        week: 2,
        day: 3,
        orderIndex: 3,
        sets: "AMRAP",
        reps: "30 sec",
        rest: "15 sec",
        tempo: "explosive",
        notes: "Upper body shoulder work."
      },
      {
        programId: fatLossProtocolProgramId,
        exerciseLibraryId: insertedExercises[8].id, // Burpees
        week: 2,
        day: 3,
        orderIndex: 4,
        sets: "AMRAP",
        reps: "20 sec",
        rest: "10 sec",
        tempo: "explosive",
        notes: "Maximum intensity finisher."
      },
      // ===== FAT LOSS PROTOCOL - WORKOUT 5 (Week 3, Day 2): Power Endurance Circuit =====
      {
        programId: fatLossProtocolProgramId,
        exerciseLibraryId: insertedExercises[11].id, // Jump Squats
        week: 3,
        day: 2,
        orderIndex: 1,
        sets: "AMRAP",
        reps: "30 sec",
        rest: "15 sec",
        tempo: "explosive",
        notes: "Lower body power endurance."
      },
      {
        programId: fatLossProtocolProgramId,
        exerciseLibraryId: insertedExercises[10].id, // Push-up to T-Rotation
        week: 3,
        day: 2,
        orderIndex: 2,
        sets: "AMRAP",
        reps: "30 sec",
        rest: "15 sec",
        tempo: "explosive",
        notes: "Upper body and core work."
      },
      {
        programId: fatLossProtocolProgramId,
        exerciseLibraryId: insertedExercises[9].id, // Mountain Climbers
        week: 3,
        day: 2,
        orderIndex: 3,
        sets: "AMRAP",
        reps: "30 sec",
        rest: "15 sec",
        tempo: "explosive",
        notes: "Core and cardiovascular intensity."
      },
      {
        programId: fatLossProtocolProgramId,
        exerciseLibraryId: insertedExercises[12].id, // High Knees Sprint
        week: 3,
        day: 2,
        orderIndex: 4,
        sets: "AMRAP",
        reps: "30 sec",
        rest: "15 sec",
        tempo: "explosive",
        notes: "Final cardio burst for metabolic effect."
      }
    ];

    await db.insert(programExercises).values(programExercisesData);
    console.log("Program exercises linked successfully");

    // Seed test company and users for reporting
    const companyName = "Horizon Health Partners";
    const [insertedCompany] = await db.insert(companies).values({
      name: companyName,
      industry: "Healthcare",
      primaryContactName: "Sarah Johnson",
      primaryContactEmail: "sarah@horizonhealth.com",
      maxUsers: 100,
      status: "active",
    }).returning({ id: companies.id });
    console.log("Test company created with id:", insertedCompany.id);

    // Create 50 test users
    const userIds: string[] = [];
    const usersData = Array.from({ length: 50 }).map((_, i) => {
      const userId = uuidv4();
      userIds.push(userId);
      return {
        id: userId,
        email: `user${i + 1}@horizonhealth.com`,
        password: "$2b$10$fake",
        firstName: `User`,
        lastName: `${i + 1}`,
        companyName,
        companyId: insertedCompany.id,
        isAdmin: false,
      };
    });
    await db.insert(users).values(usersData);
    console.log("50 test users created");

    // Create check-in data for last 90 days
    const checkInData = [];
    for (let i = 0; i < 90; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      for (let j = 0; j < 15; j++) {
        const scoreVariation = Math.sin((i + j) / 10) * 0.5 + 0.5;
        checkInData.push({
          userId: userIds[j],
          checkInDate: date,
          week: Math.floor(i / 7) + 1,
          moodScore: Math.round(3 + scoreVariation * 2),
          energyScore: Math.round(3 + scoreVariation * 1.5),
          stressScore: Math.round(3 - scoreVariation * 1),
          sleepScore: Math.round(3 + scoreVariation * 1.8),
          clarityScore: Math.round(3 + scoreVariation * 1.5),
          headache: Math.random() > 0.8,
          alcohol: Math.random() > 0.85,
          sick: Math.random() > 0.9,
          painOrInjury: Math.random() > 0.75,
          anxious: Math.random() > 0.7,
          overwhelmed: Math.random() > 0.75,
          fatigue: Math.random() > 0.6,
          fatigueTriggerMet: Math.random() > 0.7,
          exercisedYesterday: Math.random() > 0.4,
          caffeineAfter2pm: Math.random() > 0.5,
          practicedMindfulness: Math.random() > 0.7,
          emotionallyStable: Math.random() > 0.3,
          energyLevel: 4,
          stressManagement: "",
        });
      }
    }
    for (let batch = 0; batch < checkInData.length; batch += 200) {
      await db.insert(checkIns).values(checkInData.slice(batch, batch + 200));
    }
    console.log(`Check-in data created (${checkInData.length} entries)`);

    // Create body map logs for MSK trends
    const bodyParts = ["neck", "upper_back", "lower_back", "left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist", "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle"];
    const bodyMapData = [];
    for (let i = 0; i < 60; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      for (let j = 0; j < 8; j++) {
        bodyMapData.push({
          userId: userIds[j],
          createdAt: date,
          bodyPart: bodyParts[Math.floor(Math.random() * bodyParts.length)],
          severity: Math.floor(Math.random() * 10) + 1,
          view: "front",
        });
      }
    }
    for (let batch = 0; batch < bodyMapData.length; batch += 200) {
      await db.insert(bodyMapLogs).values(bodyMapData.slice(batch, batch + 200));
    }
    console.log(`Body map logs created (${bodyMapData.length} entries)`);

    // Create burnout scores for confidence indicator
    const burnoutData = [];
    for (let i = 0; i < 90; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      for (let j = 0; j < 12; j++) {
        const baseScore = 35 + Math.sin((i + j) / 15) * 20;
        burnoutData.push({
          userId: userIds[j],
          score: Math.round(baseScore),
          trajectory: baseScore > 50 ? "elevated" : baseScore < 30 ? "recovering" : "stable",
          confidence: "medium",
          topDrivers: [
            { key: "workload", label: "High workload", explanation: "Consistently high workload", trend: "stable", weight: 0.4 },
            { key: "recovery", label: "Insufficient recovery", explanation: "Low recovery scores", trend: "stable", weight: 0.35 },
            { key: "autonomy", label: "Low autonomy", explanation: "Limited autonomy reported", trend: "stable", weight: 0.25 },
          ],
          rollingWindowDays: 30,
          checkInCount: 15 + Math.floor(Math.random() * 10),
          computedDate: date,
        });
      }
    }
    for (let batch = 0; batch < burnoutData.length; batch += 200) {
      await db.insert(burnoutScores).values(burnoutData.slice(batch, batch + 200));
    }
    console.log(`Burnout scores created (${burnoutData.length} entries)`);

    console.log("Database seeding completed!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seedDatabase();
