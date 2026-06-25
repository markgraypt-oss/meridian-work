import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const outcomes: any[] = [
  {
    body_area_id: 8, name: "elbow_keep_moving", display_name: "Keep moving",
    priority: 1, is_active: true, severity_min: 1, severity_max: 3,
    training_impact: "normal", movement_impact: "none",
    triggers_follow_up: false, follow_up_question: null, follow_up_answers: null,
    movement_question: null, movement_options: null,
    whats_going_on: "Your elbow is flagging some mild discomfort but not enough to change your training. Mild elbow achiness is common in people who do a lot of pulling, gripping, or pressing work. At this level it is usually the tendons reacting to load rather than anything more serious.",
    training_guidance: "Train as normal. Monitor how the elbow feels during pulling movements and anything that involves gripping under load. If anything causes a noticeable spike, reduce the load slightly or adjust your grip. Everything else continues as planned.",
    daily_movement: "Keep the elbow moving normally. Avoid sustained positions with the elbow fully bent for long periods, like sleeping with the arm tucked under your head, as this can aggravate mild elbow irritation overnight.",
    desk_work_tips: "Check your elbow position at your desk. If your elbow is unsupported and hanging or pressed against a hard surface all day, that sustained pressure builds up. An armrest at the right height keeps the elbow comfortable.",
    things_to_watch: "If the discomfort increases, starts to feel sharp rather than achy, begins to affect your grip strength, or spreads further up or down the arm, update your assessment.",
    check_in_again: "Check back in 7 days, or sooner if things change.",
    show_programme_impact: false, programme_impact_summary: null,
    flagging_movement_patterns: null, flagging_equipment: null, flagging_level: null,
    flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: null, substitution_rules: null,
    recommend_recovery_programme: false, recovery_programme_id: null,
    recovery_programme_reason: null, restore_on_reassessment: true, reassess_in_days: 7,
  },
  {
    body_area_id: 8, name: "elbow_modify", display_name: "Modify your training",
    priority: 2, is_active: true, severity_min: 4, severity_max: 7,
    training_impact: "limited", movement_impact: "slight",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Gripping or holding weight", "Pulling movements", "Pushing movements", "Bending or straightening the elbow"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Gripping or holding weight", "Pulling movements", "Pushing movements", "Bending the elbow fully", "Straightening the elbow fully", "All of the above"],
    whats_going_on: "Your elbow is uncomfortable enough to need some training adjustments. Elbow pain at this level is often related to tendon irritation from repeated loading, either on the outer side from too much wrist extension and gripping, or the inner side from pulling and gripping work. The good news is that lower body training and most pushing or pulling can continue with modifications.",
    training_guidance: "Reduce grip-intensive work for now. Use lifting straps on deadlifts and rows to offload the forearm and elbow. Avoid exercises that cause direct pain at the elbow. If pulling movements are painful, try neutral grip variations which tend to be gentler on the elbow. If pushing is the issue, reduce load and avoid locking out fully. Lower body and core work are completely unaffected.",
    daily_movement: "Avoid repetitive gripping and forearm-intensive tasks in daily life where you can. Typing and mouse use can aggravate elbow tendons over a long day. Stretch the forearm gently by straightening the arm and bending the wrist up and down a few times throughout the day.",
    desk_work_tips: "Mouse and keyboard position matter here. If your wrist is extended or your elbow is at an awkward angle all day, that sustained load through the forearm and elbow tendon adds up. Keep the forearm supported and the wrist relatively neutral.",
    things_to_watch: "If the pain becomes sharp and constant rather than load-related, if your grip strength noticeably drops, or if the pain spreads significantly up the forearm or into the wrist, update your assessment.",
    check_in_again: "Check back in 5 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "Grip-intensive and elbow-loading movements have been flagged. Lower body training is completely unaffected.",
    flagging_movement_patterns: ["Elbow Flexion", "Elbow Extension"],
    flagging_equipment: ["Barbell"], flagging_level: ["Advanced"], flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: "User has elbow pain - heavy grip and elbow loading movements flagged",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Squat", "Lunge", "Hip Hinge", "Core Anti-Extension", "Core Anti-Rotation", "Core Anti-Lateral Flexion"], substituteExerciseIds: [] }),
    recommend_recovery_programme: false, recovery_programme_id: null,
    recovery_programme_reason: null, restore_on_reassessment: true, reassess_in_days: 5,
  },
  {
    body_area_id: 8, name: "elbow_seek_assessment", display_name: "Get this looked at",
    priority: 1, is_active: true, severity_min: 8, severity_max: 10,
    training_impact: "cannot_train", movement_impact: "significant",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Gripping or holding weight", "Pulling movements", "Pushing movements", "Bending or straightening the elbow", "All of the above"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Gripping or holding weight", "Pulling movements", "Pushing movements", "Bending the elbow fully", "Straightening the elbow fully", "All of the above"],
    whats_going_on: "Your elbow is reporting significant pain. At this level, particularly if it is affecting your grip or daily tasks, this needs professional assessment before returning to any loaded upper body training. Most elbow conditions respond very well to the right treatment.",
    training_guidance: "Avoid all loaded work through the elbow and forearm until you have been assessed. Lower body training that does not require gripping is completely fine. Focus on what you can do pain-free and get the elbow looked at as soon as possible.",
    daily_movement: "Be mindful of gripping and carrying in daily life. Avoid any sustained position that increases the pain. If the elbow is swollen or feels warm to the touch, rest it and get assessed sooner rather than later.",
    desk_work_tips: "Minimise typing and mouse use if these aggravate the elbow. Use voice-to-text where possible. Keep the arm supported and avoid any sustained awkward position.",
    things_to_watch: "Seek prompt assessment if you experience any of the following: significant swelling around the elbow joint, inability to fully straighten or bend the arm, numbness or tingling running into the hand or fingers, or pain that came on suddenly from a direct impact or fall.",
    check_in_again: "Check back in 3 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "All elbow and grip loading is on hold until you have been assessed. Lower body training without gripping is unaffected.",
    flagging_movement_patterns: ["Elbow Flexion", "Elbow Extension", "Horizontal Pull", "Vertical Pull", "Horizontal Push", "Vertical Push"],
    flagging_equipment: null, flagging_level: null, flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: "User has high severity elbow pain - all upper body loading flagged",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Squat", "Lunge", "Hip Hinge", "Core Anti-Extension", "Core Anti-Rotation"], substituteExerciseIds: [] }),
    recommend_recovery_programme: true, recovery_programme_id: null,
    recovery_programme_reason: "High severity elbow pain - professional assessment required",
    restore_on_reassessment: true, reassess_in_days: 3,
  },
];
async function run() {
  console.log("Starting elbow outcomes seed...\n");
  const existing = await pool.query("SELECT name FROM body_map_outcomes WHERE body_area_id = 8");
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
