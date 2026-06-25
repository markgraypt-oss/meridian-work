import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const outcomes: any[] = [
  {
    body_area_id: 7, name: "neck_keep_moving", display_name: "Keep moving",
    priority: 1, is_active: true, severity_min: 1, severity_max: 3,
    training_impact: "normal", movement_impact: "none",
    triggers_follow_up: false, follow_up_question: null, follow_up_answers: null,
    movement_question: null, movement_options: null,
    whats_going_on: "Your neck is flagging some mild discomfort but not enough to change what you are doing. This is extremely common in people who spend time at a desk and also train — the neck carries a lot of tension from both. At this level it is usually muscular tightness or irritation rather than anything structural.",
    training_guidance: "Train as normal. Be mindful of how the neck feels during overhead pressing and any movement that requires you to look up or load the neck. If anything causes a noticeable spike, reduce the load or adjust the position slightly. Everything else continues as planned.",
    daily_movement: "Keep moving. Prolonged static positions — head down at a screen, looking at your phone — are the main driver of neck tension. Try to move the neck gently through its range several times a day. Slow head rolls and chin tucks at your desk are helpful.",
    desk_work_tips: "Check your screen height. If your monitor is too low, you are spending the day with your head dropped forward, which loads the neck significantly over time. Screen at eye level, head balanced over your shoulders rather than jutting forward.",
    things_to_watch: "If the discomfort increases, starts to feel sharp, begins to radiate into your shoulder or down your arm, causes headaches, or you notice any dizziness or weakness in the arm, update your assessment immediately.",
    check_in_again: "Check back in 7 days, or sooner if things change.",
    show_programme_impact: false, programme_impact_summary: null,
    flagging_movement_patterns: null, flagging_equipment: null, flagging_level: null,
    flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: null, substitution_rules: null,
    recommend_recovery_programme: false, recovery_programme_id: null,
    recovery_programme_reason: null, restore_on_reassessment: true, reassess_in_days: 7,
  },
  {
    body_area_id: 7, name: "neck_modify", display_name: "Modify your training",
    priority: 2, is_active: true, severity_min: 4, severity_max: 7,
    training_impact: "limited", movement_impact: "slight",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Turning your head", "Looking up", "Overhead pressing", "Heavy loading on the back"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Turning your head to one side", "Looking up", "Looking down for long periods", "Overhead pressing", "Heavy loading on the back", "All of the above"],
    whats_going_on: "Your neck is uncomfortable enough to need some training adjustments. The neck is heavily involved in stabilising overhead movements and anything that loads the upper back — so those are the main things to modify. Most of your training is still completely available to you.",
    training_guidance: "Remove overhead pressing from your training for now — that includes barbell press, dumbbell press overhead, and any movement that requires you to look up or place significant load through the neck and upper back. Horizontal pressing is usually fine. Lower body training is completely unaffected. Avoid heavy barbell back squats if the bar position aggravates the neck — front squats or goblet squats are better alternatives. Pulling movements like rows are usually well tolerated.",
    daily_movement: "Avoid sustained positions with your head dropped forward or held in one position for long periods. Take regular breaks from screens. Gentle movement of the neck throughout the day is much better than trying to rest it completely still.",
    desk_work_tips: "Screen height and chair setup are critical here. Head forward posture at a desk is one of the biggest drivers of neck pain in working people. Screen at eye level, shoulders relaxed, head balanced. If you are on a laptop, get an external monitor or stand.",
    things_to_watch: "If pain starts radiating down your arm, if you develop numbness or tingling in your hand or fingers, if you get headaches at the base of your skull, or if you notice any weakness in your grip — update your assessment. Those signs need professional attention.",
    check_in_again: "Check back in 5 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "Overhead movements have been flagged due to your neck. Lower body and horizontal movements are unaffected.",
    flagging_movement_patterns: ["Vertical Push", "Vertical Pull"],
    flagging_equipment: ["Barbell"], flagging_level: null, flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: "User has neck pain — overhead loading movements flagged",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Horizontal Push", "Horizontal Pull", "Squat", "Lunge", "Hip Hinge", "Core Anti-Extension", "Core Anti-Rotation"], substituteExerciseIds: [] }),
    recommend_recovery_programme: false, recovery_programme_id: null,
    recovery_programme_reason: null, restore_on_reassessment: true, reassess_in_days: 5,
  },
  {
    body_area_id: 7, name: "neck_seek_assessment", display_name: "Get this looked at",
    priority: 1, is_active: true, severity_min: 8, severity_max: 10,
    training_impact: "cannot_train", movement_impact: "significant",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Turning your head", "Looking up", "Overhead pressing", "Heavy loading on the back", "All of the above"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Turning your head to one side", "Looking up", "Looking down for long periods", "Overhead pressing", "Heavy loading on the back", "All of the above"],
    whats_going_on: "Your neck is reporting significant pain. At this level, and particularly if you have any symptoms travelling into your arm, this needs professional assessment. The neck is a complex area and high-severity pain here should not be managed through training modifications alone — it needs to be properly evaluated first.",
    training_guidance: "Avoid all loading through the neck and upper back until you have been assessed. Lower body training on machines or with minimal upper back loading may be possible if it does not cause any neck discomfort — but getting assessed is the priority. Book an appointment with a physiotherapist as soon as possible.",
    daily_movement: "Move the neck gently within a pain-free range. Do not force movement into painful positions. Keep the neck supported when resting — a supportive pillow matters more than usual right now.",
    desk_work_tips: "If working causes significant neck pain, speak to your employer about a temporary adjustment. Keep your screen at eye level, minimise time looking down, and take frequent short breaks. Working through severe neck pain all day will slow recovery.",
    things_to_watch: "Seek immediate assessment if you experience any of the following: numbness or tingling running down your arm into your hand, significant weakness in your arm or grip, dizziness or balance problems alongside the neck pain, severe headache at the base of the skull, or pain that came on suddenly from trauma or impact. These need same-day attention.",
    check_in_again: "Check back in 3 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "Upper body loading is on hold until your neck has been assessed.",
    flagging_movement_patterns: ["Vertical Push", "Vertical Pull", "Horizontal Push", "Horizontal Pull", "Carry"],
    flagging_equipment: ["Barbell"], flagging_level: null, flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: "User has high severity neck pain — all upper body loading flagged, professional assessment recommended",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Squat", "Lunge", "Hip Hinge", "Core Anti-Extension", "Core Anti-Rotation"], substituteExerciseIds: [] }),
    recommend_recovery_programme: true, recovery_programme_id: null,
    recovery_programme_reason: "High severity neck pain — professional assessment required",
    restore_on_reassessment: true, reassess_in_days: 3,
  },
];
async function run() {
  console.log("Starting neck outcomes seed...\n");
  const existing = await pool.query("SELECT name FROM body_map_outcomes WHERE body_area_id = 7");
  const existingNames = existing.rows.map((r: any) => r.name);
  if (existingNames.length > 0) { console.log("Existing:"); existingNames.forEach((n: string) => console.log("  - " + n)); console.log(""); }
  let inserted = 0; let skipped = 0;
  for (const o of outcomes) {
    if (existingNames.includes(o.name)) { console.log("SKIP: " + o.name); skipped++; continue; }
    await pool.query(
      `INSERT INTO body_map_outcomes (body_area_id,name,display_name,priority,is_active,severity_min,severity_max,training_impact,movement_impact,triggers_follow_up,follow_up_question,follow_up_answers,movement_question,movement_options,whats_going_on,training_guidance,daily_movement,desk_work_tips,things_to_watch,check_in_again,show_programme_impact,programme_impact_summary,flagging_movement_patterns,flagging_equipment,flagging_level,flagging_mechanics,flagging_muscles,flagging_exclude_tags,flagging_note,substitution_rules,recommend_recovery_programme,recovery_programme_id,recovery_programme_reason,restore_on_reassessment,reassess_in_days,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,NOW(),NOW())`,
      [o.body_area_id,o.name,o.display_name,o.priority,o.is_active,o.severity_min,o.severity_max,o.training_impact,o.movement_impact,o.triggers_follow_up,o.follow_up_question,o.follow_up_answers?JSON.stringify(o.follow_up_answers):null,o.movement_question,o.movement_options?JSON.stringify(o.movement_options):null,o.whats_going_on,o.training_guidance,o.daily_movement,o.desk_work_tips,o.things_to_watch,o.check_in_again,o.show_programme_impact,o.programme_impact_summary,o.flagging_movement_patterns,o.flagging_equipment,o.flagging_level,o.flagging_mechanics,o.flagging_muscles,o.flagging_exclude_tags,o.flagging_note,o.substitution_rules,o.recommend_recovery_programme,o.recovery_programme_id,o.recovery_programme_reason,o.restore_on_reassessment,o.reassess_in_days]
    );
    console.log("INSERTED: " + o.name); inserted++;
  }
  console.log("\nDone. " + inserted + " inserted, " + skipped + " skipped.");
  await pool.end();
}
run().catch(err => { console.error("Error:", err.message); process.exit(1); });
