import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const outcomes: any[] = [
  {
    body_area_id: 9, name: "wrist_keep_moving", display_name: "Keep moving",
    priority: 1, is_active: true, severity_min: 1, severity_max: 3,
    training_impact: "normal", movement_impact: "none",
    triggers_follow_up: false, follow_up_question: null, follow_up_answers: null,
    movement_question: null, movement_options: null,
    whats_going_on: "Your wrist or hand is flagging some mild discomfort but not enough to change your training. At this level it is usually tendon irritation or general fatigue from gripping and loading. Common in people who do a lot of pulling, pressing, or keyboard-heavy work.",
    training_guidance: "Train as normal. Monitor how the wrist feels during pressing and gripping movements. If anything causes a noticeable spike, adjust your grip angle slightly or reduce load. Everything else continues as planned.",
    daily_movement: "Keep the wrist mobile throughout the day. Avoid prolonged static positions with the wrist bent or extended. A few gentle wrist circles and finger stretches during the day helps keep the tendons moving freely.",
    desk_work_tips: "Check your wrist position at your desk. The wrist should be relatively neutral when typing and using a mouse. A wrist rest can help if you tend to bend the wrist up or down all day.",
    things_to_watch: "If the discomfort increases, starts to feel sharp, affects your grip strength, causes any numbness or tingling in the fingers, or spreads up the forearm, update your assessment.",
    check_in_again: "Check back in 7 days, or sooner if things change.",
    show_programme_impact: false, programme_impact_summary: null,
    flagging_movement_patterns: null, flagging_equipment: null, flagging_level: null,
    flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: null, substitution_rules: null,
    recommend_recovery_programme: false, recovery_programme_id: null,
    recovery_programme_reason: null, restore_on_reassessment: true, reassess_in_days: 7,
  },
  {
    body_area_id: 9, name: "wrist_modify", display_name: "Modify your training",
    priority: 2, is_active: true, severity_min: 4, severity_max: 7,
    training_impact: "limited", movement_impact: "slight",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Gripping or holding weight", "Bending the wrist back", "Pushing movements", "Pulling movements"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Gripping or holding weight", "Bending the wrist back", "Bending the wrist forward", "Pushing movements", "Pulling movements", "Typing or using a mouse", "All of the above"],
    whats_going_on: "Your wrist or hand is uncomfortable enough to need some training adjustments. Wrist pain during training usually comes from the position the wrist is placed in under load. Changing grip angle or using straps can often keep most of your training intact while the area settles.",
    training_guidance: "Use lifting straps on deadlifts and rows to offload the wrist and grip. For pressing movements, try a neutral grip if possible as this is usually more comfortable than a standard overhand grip. Avoid any exercise that requires bending the wrist back under load such as barbell front squats or wrist curls. Lower body training is completely unaffected. Core work with neutral wrist positions is fine.",
    daily_movement: "Avoid repetitive wrist-intensive tasks in daily life where possible. Take regular breaks from typing and mouse use. Keep the wrist in a neutral position as much as you can.",
    desk_work_tips: "Keyboard and mouse position are important here. The wrist should be neutral when typing, not bent up or down. A gel wrist rest can help. If you use a mouse for long periods, try switching to a vertical mouse which keeps the wrist in a more neutral position.",
    things_to_watch: "If pain becomes sharp or constant, if your grip strength drops noticeably, if you develop numbness or tingling in any fingers, or if the wrist becomes swollen or warm to the touch, update your assessment.",
    check_in_again: "Check back in 5 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "Grip and wrist loading movements have been flagged. Lower body training is completely unaffected.",
    flagging_movement_patterns: ["Horizontal Pull", "Vertical Pull", "Elbow Flexion"],
    flagging_equipment: ["Barbell"], flagging_level: null, flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: "User has wrist pain - grip intensive movements flagged",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Squat", "Lunge", "Hip Hinge", "Core Anti-Extension", "Core Anti-Rotation", "Core Anti-Lateral Flexion"], substituteExerciseIds: [] }),
    recommend_recovery_programme: false, recovery_programme_id: null,
    recovery_programme_reason: null, restore_on_reassessment: true, reassess_in_days: 5,
  },
  {
    body_area_id: 9, name: "wrist_seek_assessment", display_name: "Get this looked at",
    priority: 1, is_active: true, severity_min: 8, severity_max: 10,
    training_impact: "cannot_train", movement_impact: "significant",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Gripping or holding weight", "Bending the wrist back", "Pushing movements", "Pulling movements", "All of the above"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Gripping or holding weight", "Bending the wrist back", "Bending the wrist forward", "Pushing movements", "Pulling movements", "Typing or using a mouse", "All of the above"],
    whats_going_on: "Your wrist or hand is reporting significant pain. At this level, particularly if it is affecting everyday tasks like gripping or typing, this needs professional assessment before returning to any loaded upper body training.",
    training_guidance: "Avoid all loaded work through the wrist and hand until you have been assessed. Lower body training that does not require gripping is fine. Get the wrist assessed as soon as possible.",
    daily_movement: "Protect the wrist in daily life. Avoid heavy gripping, carrying, or any position that increases the pain. If the wrist is swollen or there is visible bruising, get it assessed urgently.",
    desk_work_tips: "Minimise typing and mouse use if these aggravate the wrist. Use voice-to-text where possible. Keep the wrist supported and in a neutral position.",
    things_to_watch: "Seek urgent assessment if you experience any of the following: significant swelling or bruising around the wrist, inability to move the wrist or grip at all, numbness or tingling in multiple fingers, or pain that came on suddenly from a fall or impact on the hand.",
    check_in_again: "Check back in 3 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "All wrist and grip loading is on hold until you have been assessed. Lower body training without gripping is unaffected.",
    flagging_movement_patterns: ["Horizontal Pull", "Vertical Pull", "Horizontal Push", "Vertical Push", "Elbow Flexion", "Elbow Extension"],
    flagging_equipment: null, flagging_level: null, flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: "User has high severity wrist pain - all upper body loading flagged",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Squat", "Lunge", "Hip Hinge", "Core Anti-Extension", "Core Anti-Rotation"], substituteExerciseIds: [] }),
    recommend_recovery_programme: true, recovery_programme_id: null,
    recovery_programme_reason: "High severity wrist pain - professional assessment required",
    restore_on_reassessment: true, reassess_in_days: 3,
  },
];
async function run() {
  console.log("Starting wrist outcomes seed...\n");
  const existing = await pool.query("SELECT name FROM body_map_outcomes WHERE body_area_id = 9");
  const existingNames = existing.rows.map((r: any) => r.name);
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
