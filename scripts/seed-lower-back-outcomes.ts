import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const outcomes: any[] = [
  {
    body_area_id: 11, name: "lower_back_keep_moving", display_name: "Keep moving",
    priority: 1, is_active: true, severity_min: 1, severity_max: 3,
    training_impact: "normal", movement_impact: "none",
    triggers_follow_up: false, follow_up_question: null, follow_up_answers: null,
    movement_question: null, movement_options: null,
    whats_going_on: "Your lower back is flagging some mild discomfort, but nothing that needs to slow you down. This level of background ache is extremely common in people who sit for long periods, train regularly, or do both. It usually means the area is a little irritated or tight rather than injured. The worst thing you can do is stop moving — staying active is the most important thing right now.",
    training_guidance: "Train as normal. Be mindful of how the lower back feels during heavy hip hinge movements like deadlifts and rows — if anything causes a noticeable spike in discomfort, reduce the load or shorten the range of motion rather than pushing through it. Everything else can continue as planned. Core work is actively encouraged.",
    daily_movement: "Keep moving throughout the day. If you are desk-based, try to get up and walk for a few minutes every hour. Short walks, gentle movement, and avoiding long static positions are your best tools at this level. Do not baby the back — it responds well to movement.",
    desk_work_tips: "Check your sitting position. Your lower back should have a gentle natural curve — if you are slumped or your chair is not supporting you properly, that sustained posture will aggravate mild back discomfort over a full working day. A lumbar support or rolled towel behind the lower back can make a big difference.",
    things_to_watch: "If the discomfort increases in intensity, starts to feel sharp rather than dull, begins to radiate into your buttock or leg, or starts affecting daily movements that previously felt fine — update your assessment. That is your signal to step things down.",
    check_in_again: "Check back in 7 days, or sooner if things change.",
    show_programme_impact: false, programme_impact_summary: null,
    flagging_movement_patterns: null, flagging_equipment: null, flagging_level: null,
    flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: null, substitution_rules: null,
    recommend_recovery_programme: false, recovery_programme_id: null,
    recovery_programme_reason: null, restore_on_reassessment: true, reassess_in_days: 7,
  },
  {
    body_area_id: 11, name: "lower_back_flexion_sensitive", display_name: "Bending forward is the problem",
    priority: 4, is_active: true, severity_min: 4, severity_max: 6,
    training_impact: "limited", movement_impact: "slight",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Bending forward", "Lifting objects", "Twisting or rotating"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Bending forward", "Standing up from sitting", "Twisting or rotating", "Lifting objects", "Sitting for long periods", "Walking", "All of the above"],
    whats_going_on: "Your lower back is struggling specifically with bending forward and loading through that position. This is one of the most common presentations in people who train — the tissues around the lower back get irritated when placed under load in a flexed position, often from heavy deadlifts, bent-over rows, or a lot of time sitting in a poor position. Most training movements are still available to you — it is mainly the heavy loaded hinge that needs to change right now.",
    training_guidance: "Keep training but modify your hip hinge movements. Swap barbell deadlifts for trap bar, Romanian deadlift with lighter load, or elevated deadlifts that reduce how far you have to bend. Avoid heavy bent-over rows and replace with supported variations like chest-supported rows or cable rows where your spine is not loaded in a bent position. Squats are usually fine — keep them in. Upper body training is completely unaffected. Core work, particularly anti-rotation and anti-extension exercises, is encouraged.",
    daily_movement: "Be mindful of how you bend to pick things up. Use your legs and hinge at the hips rather than rounding your lower back, especially for anything heavier than light objects. Avoid prolonged forward-bent positions like leaning over a desk or sink. Short regular walks are helpful.",
    desk_work_tips: "Avoid slumping forward at your desk. The lower back needs its natural curve when sitting — a lumbar support helps. Keep your screen at eye level so you are not leaning forward. Stand up and walk every 45 to 60 minutes.",
    things_to_watch: "If pain starts radiating into your buttock or down your leg, if it becomes sharp or constant rather than movement-related, or if it significantly worsens after sessions that previously felt manageable — update your assessment. Those are signs the back needs more rest than this outcome allows.",
    check_in_again: "Check back in 5 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "Some exercises have been flagged due to your lower back. Modifications are available to keep you training safely.",
    flagging_movement_patterns: ["Hip Hinge"],
    flagging_equipment: ["Barbell"],
    flagging_level: null, flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: "User has lower back flexion sensitivity — heavy barbell hip hinge movements flagged",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Hip Hinge", "Squat", "Lunge", "Horizontal Push", "Horizontal Pull", "Vertical Pull"], substituteExerciseIds: [] }),
    recommend_recovery_programme: false, recovery_programme_id: null,
    recovery_programme_reason: null, restore_on_reassessment: true, reassess_in_days: 5,
  },
  {
    body_area_id: 11, name: "lower_back_posture_sensitive", display_name: "Sitting and staying still is the problem",
    priority: 3, is_active: true, severity_min: 4, severity_max: 6,
    training_impact: "limited", movement_impact: "slight",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Sitting for long periods", "Standing up from sitting"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Bending forward", "Standing up from sitting", "Twisting or rotating", "Lifting objects", "Sitting for long periods", "Walking", "All of the above"],
    whats_going_on: "Your lower back is most uncomfortable after sitting for long periods or when you first stand up. This is a very common pattern and is usually related to sustained posture and reduced movement throughout the day rather than a specific training injury. Exercise is actually one of the best things for this — your back tends to feel better when you are moving than when you are static.",
    training_guidance: "Training is largely fine and is likely to make your back feel better rather than worse. Avoid sitting for long periods directly before training — try to walk or move gently for 10 minutes before your session to get the back loosened up. Heavy bilateral loading like barbell back squats and deadlifts may feel stiff at the start — warm up thoroughly and reduce load slightly if needed. Everything else should be manageable.",
    daily_movement: "Movement is the medicine here. Break up sitting as much as possible — stand up, walk, do a few hip circles every 45 minutes. The longer you sit without moving, the worse the back will feel. Try to alternate between sitting and standing throughout the working day if possible.",
    desk_work_tips: "This is likely a workstation issue as much as a training issue. Review your chair height, lumbar support, and screen position. Your feet should be flat on the floor, your lower back supported, and your screen at eye level. Working from a sofa or a low surface will be making this significantly worse.",
    things_to_watch: "If the pain starts to appear during training rather than just after sitting, if it begins radiating into your leg, or if it becomes difficult to stand upright when you first get up in the morning — update your assessment. Those are signs this needs more than posture management.",
    check_in_again: "Check back in 5 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "Training is largely unaffected. Some heavier spinal loading movements have been flagged as a precaution.",
    flagging_movement_patterns: ["Hip Hinge"],
    flagging_equipment: ["Barbell"],
    flagging_level: ["Advanced"],
    flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: "User has posture-related lower back sensitivity — heavy bilateral loading flagged as precaution",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Hip Hinge", "Squat", "Lunge", "Horizontal Push", "Horizontal Pull", "Vertical Push", "Vertical Pull"], substituteExerciseIds: [] }),
    recommend_recovery_programme: false, recovery_programme_id: null,
    recovery_programme_reason: null, restore_on_reassessment: true, reassess_in_days: 5,
  },
  {
    body_area_id: 11, name: "lower_back_pull_back", display_name: "Pull back and rest it",
    priority: 2, is_active: true, severity_min: 7, severity_max: 9,
    training_impact: "cannot_train", movement_impact: "significant",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Bending forward", "Lifting objects", "Twisting or rotating", "Standing up from sitting", "Walking"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Bending forward", "Standing up from sitting", "Twisting or rotating", "Lifting objects", "Sitting for long periods", "Walking", "All of the above"],
    whats_going_on: "Your lower back is in a significant flare right now. At this level, the area is telling you it has been pushed past what it can handle and it needs a proper rest from loading. This does not mean something is seriously wrong — most acute back flares settle significantly within a few days when managed well. But trying to push through training at this level will slow that process down, not speed it up.",
    training_guidance: "Remove all spinal loading from your training for now. That means no deadlifts, no squats with a barbell, no bent-over rows, and no carries. Upper body training on machines or in supported positions is fine if it does not cause any back discomfort. Focus on whatever you can do pain-free — even if that is just light upper body machine work or walking. Keeping some movement going is better than stopping completely.",
    daily_movement: "Move gently and deliberately. Short walks are very helpful even at this level — they keep circulation moving and prevent the back from seizing up further. Avoid prolonged sitting or lying down in one position. Change position regularly and find the posture that feels most comfortable, whether that is standing, gentle walking, or lying with your knees bent.",
    desk_work_tips: "If working at a desk, limit sessions to 20 to 30 minutes before getting up and moving. Support the lower back fully — a firm lumbar cushion or a rolled towel can help significantly. Avoid sitting on soft or low surfaces. Standing for short periods throughout the day is helpful if you can manage it comfortably.",
    things_to_watch: "If pain starts shooting down one or both legs, if you feel numbness or tingling in your legs or feet, if the pain becomes constant and severe rather than coming and going, or if you have any difficulty with bladder or bowel control — seek immediate professional assessment. These are signs that go well beyond a standard back flare and need urgent attention.",
    check_in_again: "Check back in 3 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "Your lower back needs a break from spinal loading. Affected exercises have been flagged and upper body alternatives suggested where possible.",
    flagging_movement_patterns: ["Hip Hinge", "Squat", "Lunge", "Core Anti-Extension", "Core Anti-Flexion", "Core Rotation"],
    flagging_equipment: ["Barbell"],
    flagging_level: null, flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: "User has high severity lower back pain — all spinal loading flagged",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Horizontal Push", "Horizontal Pull", "Vertical Push", "Vertical Pull", "Elbow Flexion", "Elbow Extension"], substituteExerciseIds: [] }),
    recommend_recovery_programme: true, recovery_programme_id: null,
    recovery_programme_reason: "High severity lower back pain — recovery programme recommended",
    restore_on_reassessment: true, reassess_in_days: 3,
  },
  {
    body_area_id: 11, name: "lower_back_seek_assessment", display_name: "Get this looked at now",
    priority: 1, is_active: true, severity_min: 9, severity_max: 10,
    training_impact: "cannot_train", movement_impact: "significant",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Bending forward", "Lifting objects", "Twisting or rotating", "Standing up from sitting", "Walking", "All of the above"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Bending forward", "Standing up from sitting", "Twisting or rotating", "Lifting objects", "Sitting for long periods", "Walking", "All of the above"],
    whats_going_on: "The level of pain you are reporting needs professional attention. At this severity — particularly if you have any pain, numbness, or tingling running into your legs — this goes beyond what self-management can safely address. This is not about scaring you. Most back issues at even high severity are very manageable with the right support. But the right support here means getting a proper assessment from a physiotherapist or sports medicine professional, not training modifications.",
    training_guidance: "Do not train at all until you have been assessed. This is not permanent — it is a short-term hold while you get the right information about what is actually going on. Once you have been assessed and have a clearer picture, you will be in a much better position to know what is safe and what is not. Book an appointment as soon as possible.",
    daily_movement: "Move as gently as you can manage within a pain-free range. Short slow walks are fine if they do not increase the pain. Avoid any movement that causes a significant spike. Find your most comfortable position and change it regularly — staying completely still for hours is not helpful. If getting out of bed or walking is extremely difficult, that is an additional sign this needs urgent professional review.",
    desk_work_tips: "If you need to work, do so in short sessions with frequent position changes. Support the lower back fully. If pain is making it very difficult to sit or concentrate, speak to your employer about taking a short period of rest — pushing through a full working day at this pain level is not helpful for recovery.",
    things_to_watch: "Seek emergency assessment immediately if you experience any of the following: numbness or tingling in your groin, inner thighs, or around your backside, any difficulty controlling your bladder or bowel, sudden severe weakness in one or both legs, or pain that came on suddenly after trauma. These are rare but serious signs that need same-day medical attention — do not wait.",
    check_in_again: "Check back in 3 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "Training is on hold until your lower back has been assessed. All spinal loading has been flagged.",
    flagging_movement_patterns: ["Hip Hinge", "Squat", "Lunge", "Core Anti-Extension", "Core Anti-Flexion", "Core Rotation", "Carry"],
    flagging_equipment: ["Barbell", "Dumbbell", "Kettlebell"],
    flagging_level: null, flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: "User has severe lower back pain — all loading flagged, professional assessment required",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Horizontal Push", "Horizontal Pull", "Vertical Push", "Vertical Pull"], substituteExerciseIds: [] }),
    recommend_recovery_programme: true, recovery_programme_id: null,
    recovery_programme_reason: "Severe lower back pain — professional assessment required before any training resumes",
    restore_on_reassessment: true, reassess_in_days: 3,
  },
];
async function run() {
  console.log("Starting lower back outcomes seed...\n");
  const existing = await pool.query("SELECT name FROM body_map_outcomes WHERE body_area_id = 11");
  const existingNames = existing.rows.map((r: any) => r.name);
  if (existingNames.length > 0) {
    console.log("Existing outcomes found:");
    existingNames.forEach((n: string) => console.log("  - " + n));
    console.log("");
  }
  let inserted = 0;
  let skipped = 0;
  for (const o of outcomes) {
    if (existingNames.includes(o.name)) {
      console.log("SKIP: " + o.name);
      skipped++;
      continue;
    }
    await pool.query(
      `INSERT INTO body_map_outcomes (
        body_area_id,name,display_name,priority,is_active,
        severity_min,severity_max,training_impact,movement_impact,
        triggers_follow_up,follow_up_question,follow_up_answers,
        movement_question,movement_options,
        whats_going_on,training_guidance,daily_movement,
        desk_work_tips,things_to_watch,check_in_again,
        show_programme_impact,programme_impact_summary,
        flagging_movement_patterns,flagging_equipment,flagging_level,
        flagging_mechanics,flagging_muscles,flagging_exclude_tags,
        flagging_note,substitution_rules,
        recommend_recovery_programme,recovery_programme_id,
        recovery_programme_reason,restore_on_reassessment,reassess_in_days,
        created_at,updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
        $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,
        NOW(),NOW()
      )`,
      [
        o.body_area_id,o.name,o.display_name,o.priority,o.is_active,
        o.severity_min,o.severity_max,o.training_impact,o.movement_impact,
        o.triggers_follow_up,o.follow_up_question,
        o.follow_up_answers ? JSON.stringify(o.follow_up_answers) : null,
        o.movement_question,
        o.movement_options ? JSON.stringify(o.movement_options) : null,
        o.whats_going_on,o.training_guidance,o.daily_movement,
        o.desk_work_tips,o.things_to_watch,o.check_in_again,
        o.show_programme_impact,o.programme_impact_summary,
        o.flagging_movement_patterns,o.flagging_equipment,o.flagging_level,
        o.flagging_mechanics,o.flagging_muscles,o.flagging_exclude_tags,
        o.flagging_note,o.substitution_rules,
        o.recommend_recovery_programme,o.recovery_programme_id,
        o.recovery_programme_reason,o.restore_on_reassessment,o.reassess_in_days,
      ]
    );
    console.log("INSERTED: " + o.name);
    inserted++;
  }
  console.log("\nDone. " + inserted + " inserted, " + skipped + " skipped.");
  await pool.end();
}
run().catch(err => { console.error("Error:", err.message); process.exit(1); });
