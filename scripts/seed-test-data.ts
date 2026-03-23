import { db } from "../server/db";
import { users, checkIns, bodyMapLogs } from "../shared/schema";
import { sql } from "drizzle-orm";

const COMPANIES = [
  { name: "TechFlow Solutions", userCount: 10 },
  { name: "Meridian Capital Group", userCount: 25 },
  { name: "Horizon Health Partners", userCount: 50 },
];

const FIRST_NAMES = [
  "James", "Sarah", "Michael", "Emma", "Daniel", "Olivia", "Robert", "Sophia",
  "William", "Isabella", "David", "Mia", "Thomas", "Charlotte", "Richard",
  "Amelia", "Joseph", "Harper", "Charles", "Evelyn", "Christopher", "Abigail",
  "Andrew", "Emily", "Matthew", "Elizabeth", "Joshua", "Sofia", "Anthony",
  "Avery", "Mark", "Ella", "Steven", "Scarlett", "Paul", "Grace", "Kevin",
  "Chloe", "Brian", "Victoria", "George", "Riley", "Edward", "Aria", "Jason",
  "Lily", "Ryan", "Aurora", "Timothy", "Zoey", "Nathan", "Penelope", "Gary",
  "Layla", "Peter", "Nora", "Henry", "Hannah", "Frank", "Lillian", "Jack",
  "Addison", "Dennis", "Eleanor", "Jerry", "Natalie", "Alexander", "Luna",
  "Samuel", "Savannah", "Patrick", "Brooklyn", "Raymond", "Leah", "Gregory",
  "Zoe", "Benjamin", "Stella", "Donald", "Hazel", "Kenneth", "Ellie",
  "Eugene", "Paisley"
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
  "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
  "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark",
  "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King",
  "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green",
  "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
  "Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner", "Diaz",
  "Parker", "Cruz", "Edwards", "Collins", "Reyes", "Stewart", "Morris",
  "Morales", "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan",
  "Cooper", "Peterson", "Bailey", "Reed", "Kelly", "Howard", "Ramos",
  "Kim", "Cox", "Ward", "Richardson", "Watson", "Brooks", "Chavez", "Wood"
];

const BODY_PARTS = [
  "lower_back", "neck", "right_shoulder", "left_shoulder", "right_knee",
  "left_knee", "upper_back", "right_hip", "left_hip", "right_wrist",
  "left_wrist", "right_ankle", "left_ankle", "right_elbow", "left_elbow"
];

const BODY_PART_TYPES = ["sore", "stiff"];
const MOVEMENT_IMPACTS = ["none", "slight", "significant"];
const TRAINING_IMPACTS = ["none", "careful", "modify_avoid"];
const PRIMARY_TRIGGERS = ["rest", "during_day", "during_exercise", "after_sitting", "all_time"];
const DURATIONS = ["today", "few_days", "one_two_weeks", "more_than_two_weeks"];

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals: number = 1): number {
  const val = Math.random() * (max - min) + min;
  return Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBool(probability: number = 0.5): boolean {
  return Math.random() < probability;
}

async function seedTestData() {
  console.log("Starting test data seeding...");
  
  let nameIndex = 0;
  const allTestUserIds: string[] = [];
  
  for (const company of COMPANIES) {
    console.log(`\nCreating ${company.userCount} users for ${company.name}...`);
    
    for (let i = 0; i < company.userCount; i++) {
      const firstName = FIRST_NAMES[nameIndex % FIRST_NAMES.length];
      const lastName = LAST_NAMES[nameIndex % LAST_NAMES.length];
      const userId = `test-${company.name.replace(/\s+/g, '-').toLowerCase()}-${i + 1}`;
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${nameIndex}@${company.name.replace(/\s+/g, '').toLowerCase()}.test`;
      
      allTestUserIds.push(userId);
      nameIndex++;
      
      await db.insert(users).values({
        id: userId,
        email,
        firstName,
        lastName,
        companyName: company.name,
        isAdmin: false,
        password: "$2b$10$placeholder_not_real_hash_for_test_data",
      }).onConflictDoNothing();
    }
    
    console.log(`Created ${company.userCount} users for ${company.name}`);
  }
  
  console.log("\n--- Generating check-in data (last 90 days) ---");
  
  const now = new Date();
  const checkInValues: any[] = [];
  const bodyMapValues: any[] = [];
  
  for (const userId of allTestUserIds) {
    const daysActive = rand(15, 85);
    const activeDays = new Set<number>();
    
    while (activeDays.size < daysActive) {
      activeDays.add(rand(0, 89));
    }
    
    for (const dayOffset of activeDays) {
      const checkInDate = new Date(now);
      checkInDate.setDate(checkInDate.getDate() - dayOffset);
      checkInDate.setHours(rand(6, 10), rand(0, 59), 0, 0);
      
      const moodScore = rand(1, 5);
      const energyScore = rand(1, 5);
      const stressScore = rand(1, 5);
      const sleepScore = rand(1, 5);
      const clarityScore = rand(1, 5);
      
      checkInValues.push({
        userId,
        checkInDate,
        week: Math.floor(dayOffset / 7),
        moodScore,
        energyScore,
        stressScore,
        sleepScore,
        clarityScore,
        headache: randomBool(0.15),
        alcohol: randomBool(0.25),
        alcoholCount: randomBool(0.25) ? rand(1, 6) : null,
        sick: randomBool(0.08),
        painOrInjury: randomBool(0.2),
        emotionallyStable: randomBool(0.7),
        anxious: randomBool(0.2),
        overwhelmed: randomBool(0.18),
        exercisedYesterday: randomBool(0.45),
        caffeineAfter2pm: randomBool(0.35),
        practicedMindfulness: randomBool(0.25),
        fatigue: randomBool(0.3),
        fatigueTriggerMet: randomBool(0.15),
        energyLevel: energyScore,
        stressManagement: "",
        completed: true,
      });
    }
    
    const bodyMapEntryCount = rand(0, 4);
    for (let b = 0; b < bodyMapEntryCount; b++) {
      const dayOffset = rand(0, 89);
      const createdAt = new Date(now);
      createdAt.setDate(createdAt.getDate() - dayOffset);
      createdAt.setHours(rand(7, 18), rand(0, 59), 0, 0);
      
      bodyMapValues.push({
        userId,
        bodyPart: pickRandom(BODY_PARTS),
        severity: rand(1, 10),
        type: pickRandom(BODY_PART_TYPES),
        view: randomBool(0.6) ? "front" : "back",
        side: pickRandom(["left", "right", "both"]),
        movementImpact: pickRandom(MOVEMENT_IMPACTS),
        trainingImpact: pickRandom(TRAINING_IMPACTS),
        primaryTrigger: pickRandom(PRIMARY_TRIGGERS),
        duration: pickRandom(DURATIONS),
        createdAt,
      });
    }
  }
  
  console.log(`Inserting ${checkInValues.length} check-ins...`);
  const BATCH_SIZE = 100;
  for (let i = 0; i < checkInValues.length; i += BATCH_SIZE) {
    const batch = checkInValues.slice(i, i + BATCH_SIZE);
    await db.insert(checkIns).values(batch);
  }
  console.log("Check-ins inserted.");
  
  if (bodyMapValues.length > 0) {
    console.log(`Inserting ${bodyMapValues.length} body map assessments...`);
    for (let i = 0; i < bodyMapValues.length; i += BATCH_SIZE) {
      const batch = bodyMapValues.slice(i, i + BATCH_SIZE);
      await db.insert(bodyMapLogs).values(batch);
    }
    console.log("Body map assessments inserted.");
  }
  
  console.log("\n=== Seeding complete! ===");
  console.log(`Total users created: ${allTestUserIds.length}`);
  console.log(`Total check-ins: ${checkInValues.length}`);
  console.log(`Total body map assessments: ${bodyMapValues.length}`);
  
  for (const company of COMPANIES) {
    const count = allTestUserIds.filter(id => id.includes(company.name.replace(/\s+/g, '-').toLowerCase())).length;
    console.log(`  ${company.name}: ${count} users`);
  }
  
  process.exit(0);
}

seedTestData().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
