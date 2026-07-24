export const MAIN_MUSCLE_OPTIONS = [
  "Abs", "Abductors", "Adductors", "Ankle & Foot", "Biceps", "Calves",
  "Chest", "Forearms", "Glutes", "Hamstrings", "Hip Flexor", "Lats",
  "Lower Back", "Middle Back", "Neck", "Neck & Jaw", "Obliques",
  "Posterior Shoulder", "Quads", "Rotator Cuff", "Shoulders", "Traps", "Triceps", "Wrist & Hands"
];

export const EQUIPMENT_OPTIONS = [
  "Band", "Barbell", "Bench", "Bosu Ball", "Box/Step", "Bodyweight", "Cable",
  "Dumbbell", "EZ Bar", "Foam Roller", "Hyper Extension", "Kettlebell", "Lacrosse Ball",
  "Landmine", "Long Band", "Machine", "Massage Gun", "Medicine Ball", "Plate", "Short Band", "Swiss Ball", "TRX"
];

// Movement Pattern - core movement patterns for exercises
export const MOVEMENT_PATTERN_OPTIONS = [
  "Squat", "Hip Hinge", "Lunge", "Horizontal Push", "Vertical Push",
  "Horizontal Pull", "Vertical Pull", "Carry", "Core Anti-Extension",
  "Core Anti-Flexion", "Core Anti-Rotation", "Core Anti-Lateral Flexion",
  "Core Rotation", "Core Flexion", "Core Extension",
  "Elbow Flexion", "Elbow Extension", "Hip Extension", "Hip Flexion", "Knee Flexion", "Knee Extension"
];

// Movement Type - additional movement classifications
export const MOVEMENT_TYPE_OPTIONS = [
  "Alternating", "Bilateral (2 Arms and/or 2 Legs)", "Cardio",
  "Contralateral (Opposite Side Arm & Leg)", "Core", "General Conditioning",
  "Ipsilateral (Same Side Arm & Leg)", "Mobility", "Plyometrics", "Rotation", "Static Stretches", "Unilateral (Single Arm or Leg)"
];

// Combined for backward compatibility
export const MOVEMENT_OPTIONS = [...MOVEMENT_PATTERN_OPTIONS, ...MOVEMENT_TYPE_OPTIONS];

export const MECHANICS_OPTIONS = ["Compound", "Isolation"];

export const LEVEL_OPTIONS = ["Beginner", "Intermediate", "Advanced"];
