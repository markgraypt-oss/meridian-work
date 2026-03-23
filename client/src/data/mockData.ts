import type { Programme, Video, Recipe } from "@shared/schema";

export const mockProgrammes: Omit<Programme, 'id' | 'createdAt'>[] = [
  {
    title: "Executive HIIT Circuit",
    description: "High-intensity interval training designed for busy executives. Maximize results in minimal time.",
    goal: "fat_loss",
    equipment: "full_gym",
    duration: 30,
    weeks: 4,
    difficulty: "intermediate",
    imageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
    tags: ["hiit", "fat loss", "executive", "time efficient"]
  },
  {
    title: "Peak Performance Protocol",
    description: "Advanced strength and conditioning program for maximum performance gains.",
    goal: "performance",
    equipment: "full_gym",
    duration: 45,
    weeks: 8,
    difficulty: "advanced",
    imageUrl: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
    tags: ["strength", "performance", "conditioning", "advanced"]
  },
  {
    title: "Mobility & Recovery",
    description: "Comprehensive mobility program to address common executive pain points.",
    goal: "pain_free",
    equipment: "bodyweight",
    duration: 25,
    weeks: 6,
    difficulty: "beginner",
    imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
    tags: ["mobility", "recovery", "pain relief", "flexibility"]
  },
  {
    title: "Home Office Fitness",
    description: "Perfect for executives working from home. No equipment needed.",
    goal: "fat_loss",
    equipment: "bodyweight",
    duration: 20,
    weeks: 4,
    difficulty: "beginner",
    imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
    tags: ["bodyweight", "home workout", "convenient", "no equipment"]
  },
  {
    title: "Executive Strength Foundation",
    description: "Build a strong foundation with fundamental movement patterns.",
    goal: "performance",
    equipment: "home_gym",
    duration: 40,
    weeks: 6,
    difficulty: "intermediate",
    imageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
    tags: ["strength", "foundation", "home gym", "fundamentals"]
  }
];

export const mockVideos: Omit<Video, 'id' | 'createdAt'>[] = [
  {
    title: "Zone 2 Cardio for Executives",
    description: "Learn how to optimize your cardio training for maximum fat burning and endurance.",
    category: "training",
    instructor: "Dr. Sarah Johnson",
    duration: 750, // 12:30 in seconds
    thumbnailUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300",
    videoUrl: "#",
    views: 2100,
    tags: ["zone 2", "cardio", "fat burning", "endurance"]
  },
  {
    title: "Stress Management Breathing",
    description: "Science-backed breathing techniques for managing executive stress and improving focus.",
    category: "breathwork",
    instructor: "James Rodriguez",
    duration: 525, // 8:45 in seconds
    thumbnailUrl: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300",
    videoUrl: "#",
    views: 3500,
    tags: ["stress management", "breathing", "focus", "executive"]
  },
  {
    title: "Executive Meal Prep Mastery",
    description: "Time-efficient meal prep strategies for busy professionals focused on performance nutrition.",
    category: "nutrition",
    instructor: "Chef Michael Chen",
    duration: 920, // 15:20 in seconds
    thumbnailUrl: "https://images.unsplash.com/photo-1546548970-71785318a17b?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300",
    videoUrl: "#",
    views: 1800,
    tags: ["meal prep", "nutrition", "time efficient", "executive"]
  },
  {
    title: "Sleep Optimization for Peak Performance",
    description: "Strategies to improve sleep quality and duration for better recovery and performance.",
    category: "recovery",
    instructor: "Dr. Lisa Martinez",
    duration: 1080, // 18:00 in seconds
    thumbnailUrl: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300",
    videoUrl: "#",
    views: 2900,
    tags: ["sleep", "recovery", "performance", "optimization"]
  },
  {
    title: "Executive Supplement Stack",
    description: "Evidence-based supplement recommendations for busy professionals.",
    category: "supplements",
    instructor: "Dr. Robert Kim",
    duration: 660, // 11:00 in seconds
    thumbnailUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300",
    videoUrl: "#",
    views: 1500,
    tags: ["supplements", "executive", "evidence-based", "performance"]
  }
];

export const mockRecipes: Omit<Recipe, 'id' | 'createdAt'>[] = [
  {
    title: "Power Breakfast Bowl",
    description: "High-protein breakfast to fuel your morning and maintain energy levels.",
    totalTime: 12,
    calories: 480,
    protein: 35,
    carbs: 45,
    fat: 18,
    imageUrl: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200",
    ingredients: [
      "2 large eggs",
      "1/2 cup rolled oats",
      "1 scoop protein powder",
      "1/2 banana",
      "1 tbsp almond butter",
      "1/4 cup blueberries",
      "1 tbsp chia seeds"
    ],
    instructions: [
      "Cook oats according to package instructions",
      "Scramble eggs in a non-stick pan",
      "Mix protein powder into cooked oats",
      "Top with sliced banana, blueberries, and chia seeds",
      "Serve with scrambled eggs and almond butter"
    ],
    tags: ["high protein", "breakfast", "energy", "quick"],
    category: "breakfast"
  },
  {
    title: "Executive Salad",
    description: "Nutrient-dense salad perfect for a working lunch.",
    totalTime: 8,
    calories: 380,
    protein: 28,
    carbs: 15,
    fat: 22,
    imageUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200",
    ingredients: [
      "4 oz grilled chicken breast",
      "2 cups mixed greens",
      "1/4 avocado",
      "1/4 cup cherry tomatoes",
      "2 tbsp olive oil",
      "1 tbsp balsamic vinegar",
      "1/4 cup walnuts",
      "2 tbsp feta cheese"
    ],
    instructions: [
      "Grill chicken breast and slice",
      "Combine mixed greens in a bowl",
      "Add cherry tomatoes and avocado",
      "Top with grilled chicken and walnuts",
      "Drizzle with olive oil and balsamic vinegar",
      "Sprinkle with feta cheese"
    ],
    tags: ["low carb", "protein", "lunch", "quick"],
    category: "lunch"
  },
  {
    title: "Recovery Dinner",
    description: "Anti-inflammatory dinner to support recovery and sleep.",
    totalTime: 25,
    calories: 520,
    protein: 42,
    carbs: 35,
    fat: 24,
    imageUrl: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200",
    ingredients: [
      "6 oz salmon fillet",
      "1 cup quinoa",
      "2 cups steamed broccoli",
      "1 tbsp olive oil",
      "1 tsp turmeric",
      "2 cloves garlic",
      "1 lemon",
      "Fresh herbs"
    ],
    instructions: [
      "Cook quinoa according to package instructions",
      "Season salmon with turmeric and garlic",
      "Pan-sear salmon in olive oil",
      "Steam broccoli until tender",
      "Plate quinoa, top with salmon and broccoli",
      "Finish with lemon juice and fresh herbs"
    ],
    tags: ["anti-inflammatory", "recovery", "omega-3", "dinner"],
    category: "dinner"
  },
  {
    title: "Energy Protein Smoothie",
    description: "Quick post-workout smoothie for recovery and energy.",
    totalTime: 5,
    calories: 320,
    protein: 25,
    carbs: 28,
    fat: 12,
    imageUrl: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200",
    ingredients: [
      "1 scoop whey protein",
      "1 cup almond milk",
      "1/2 banana",
      "1 tbsp almond butter",
      "1/2 cup spinach",
      "1 tsp honey",
      "Ice cubes"
    ],
    instructions: [
      "Add all ingredients to blender",
      "Blend until smooth",
      "Add ice for desired consistency",
      "Serve immediately"
    ],
    tags: ["post-workout", "protein", "quick", "energy"],
    category: "snack"
  }
];
