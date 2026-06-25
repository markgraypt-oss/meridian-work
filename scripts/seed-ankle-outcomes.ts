import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const outcomes: any[] = [
  {
    body_area_id: 17, name: "ankle_keep_moving", display_name: "Keep moving",
    priority: 1, is_active: true, severity_min: 1, severity_max: 3,
    training_impact: "normal", movement_impact: "none",
    triggers_follow_up: false, follow_up_question: null, follow_up_answers: null,
    movement_question: null, movement_options: null,
    whats_going_on: "Your ankle or foot is flagging some mild discomfort but not enough to change your training. At this level it is usually general irritation from loading or a minor reaction to a change in footwear or training surface. Nothing that needs to slow you down.",
    training_guidance: "Train as normal. Be mindful during squats and lunges if the ankle is stiff or uncomfortable at the bottom range. If anything causes a noticeable spike, reduce depth slightly. Everything else continues as planned.",
    daily_movement: "Keep moving normally. Walking is fine and actually helpful for mild ankle and foot complaints. Avoid prolonged standing on hard surfaces without supportive footwear.",
    desk_work_tips: "If you sit for long periods, do a few ankle circles when you stand up to keep the joint mobile. Avoid sitting with the foot in an awkward position for extended periods.",
    things_to_watch: "If the discomfort increases, starts to feel sharp, causes any visible swelling around the ankle, or begins to affect your walking pattern, update your assessment.",
    check_in_again: "Check back in 7 days, or sooner if things change.",
    show_programme_impact: false, programme_impact_summary: null,
    flagging_movement_patterns: null, flagging_equipment: null, flagging_level: null,
    flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: null, substitution_rules: null,
    recommend_recovery_programme: false, recovery_programme_id: null,
    recovery_programme_reason: null, restore_on_reassessment: true, reassess_in_days: 7,
  },
  {
    body_area_id: 17, name: "ankle_modify", display_name: "Modify your training",
    priority: 2, is_active: true, severity_min: 4, severity_max: 7,
    training_impact: "limited", movement_impact: "slight",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Squatting or lunging", "Walking or standing for long periods", "Going up or down stairs"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Squatting or lunging", "Walking or standing for long periods", "Going up or down stairs", "Pushing up onto toes", "Rotating the ankle", "All of the above"],
    whats_going_on: "Your ankle or foot is uncomfortable enough to need some training adjustment. Pain in the ankle or foot during weight-bearing and lower body movements is usually the joint or surrounding tendons reacting to load. Most upper body training and seated work is completely unaffected.",
    training_guidance: "Reduce weight-bearing lower body movements. Squats and lunges should be modified or removed depending on how the ankle responds. Deadlifts can usually be kept in if they do not aggravate the ankle. Upper body training is completely unaffected and should continue as normal. Seated machine-based lower body work may be possible if it does not load the ankle directly.",
    daily_movement: "Walk at a comfortable pace on flat ground. Avoid prolonged standing on hard surfaces. Stairs are manageable if done carefully. Supportive footwear makes a significant difference at this level.",
    desk_work_tips: "Keep the foot in a comfortable position when sitting. Avoid letting the ankle hang unsupported for long periods. Elevating the foot slightly when seated can reduce any minor swelling.",
    things_to_watch: "If the ankle becomes visibly swollen, if the pain becomes sharp and constant, if you cannot put your full weight through the foot comfortably, or if the ankle feels unstable or gives way, update your assessment.",
    check_in_again: "Check back in 5 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "Weight-bearing lower body movements have been flagged. Upper body training is completely unaffected.",
    flagging_movement_patterns: ["Squat", "Lunge"],
    flagging_equipment: null, flagging_level: null, flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: "User has ankle pain - weight-bearing lower body movements flagged",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Hip Hinge", "Horizontal Push", "Horizontal Pull", "Vertical Push", "Vertical Pull", "Core Anti-Extension", "Core Anti-Rotation"], substituteExerciseIds: [] }),
    recommend_recovery_programme: false, recovery_programme_id: null,
    recovery_programme_reason: null, restore_on_reassessment: true, reassess_in_days: 5,
  },
  {
    body_area_id: 17, name: "ankle_seek_assessment", display_name: "Get this looked at",
    priority: 1, is_active: true, severity_min: 8, severity_max: 10,
    training_impact: "cannot_train", movement_impact: "significant",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Squatting or lunging", "Walking or standing for long periods", "Going up or down stairs", "Pushing up onto toes", "All of the above"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Squatting or lunging", "Walking or standing for long periods", "Going up or down stairs", "Pushing up onto toes", "Rotating the ankle", "All of the above"],
    whats_going_on: "Your ankle or foot is reporting significant pain. At this level, particularly if it is affecting your ability to walk normally, this needs professional assessment before returning to any lower body training. Most ankle and foot issues respond well to the right treatment.",
    training_guidance: "Do not load the ankle or foot at all until you have been assessed. Upper body training in seated positions is completely fine. Walking should be minimised if it is painful. Book an appointment as soon as possible.",
    daily_movement: "Keep weight-bearing to a minimum if it causes significant pain. If the ankle is swollen, keep it elevated when resting. Use supportive footwear for any walking you need to do.",
    desk_work_tips: "Keep the foot elevated when sitting if there is any swelling present. Avoid prolonged standing. If you need to be on your feet for work, speak to your employer about a temporary adjustment.",
    things_to_watch: "Seek urgent assessment if you experience any of the following: significant swelling or bruising around the ankle that appeared quickly, inability to bear weight on the foot at all, a snap or pop sensation when the injury occurred, visible deformity around the ankle joint, or pain that came on suddenly from a fall or twist. These need same-day attention.",
    check_in_again: "Check back in 3 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "All lower body loading is on hold until you have been assessed. Upper body training in seated positions is unaffected.",
    flagging_movement_patterns: ["Squat", "Lunge", "Hip Hinge"],
    flagging_equipment: null, flagging_level: null, flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: "User has high severity ankle pain - all lower body loading flagged",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Horizontal Push", "Horizontal Pull", "Vertical Push", "Vertical Pull", "Core Anti-Extension", "Core Anti-Rotation"], substituteExerciseIds: [] }),
    recommend_recovery_programme: true, recovery_programme_id: null,
    recovery_programme_reason: "High severity ankle pain - professional assessment required",
    restore_on_reassessment: true, reassess_in_days: 3,
  },
];
async function run() {
  console.log("Starting ankle outcomes seed...\n");
  const existing = await pool.query("SELECT name FROM body_map_outcomes WHERE body_area_id = 17");
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
