import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const outcomes: any[] = [
  {
    body_area_id: 16, name: "calf_keep_moving", display_name: "Keep moving",
    priority: 1, is_active: true, severity_min: 1, severity_max: 3,
    training_impact: "normal", movement_impact: "none",
    triggers_follow_up: false, follow_up_question: null, follow_up_answers: null,
    movement_question: null, movement_options: null,
    whats_going_on: "Your calf is flagging some mild discomfort but not enough to change your training. This is common after higher volume leg work or a change in training load. At this level it is usually muscular fatigue or mild Achilles tendon irritation rather than anything structural.",
    training_guidance: "Train as normal. Be mindful during any calf-intensive movements or anything that loads the Achilles tendon. If anything causes a noticeable spike, reduce volume or load. Everything else continues as planned.",
    daily_movement: "Keep moving normally. Walking is fine and helpful. Avoid sudden explosive push-offs or sprinting until the discomfort settles. Morning stiffness in the calf is common with Achilles irritation and usually loosens up after a few minutes of walking.",
    desk_work_tips: "If you sit for long periods, the calf and Achilles can stiffen up. Stand up and do a few gentle calf raises or ankle circles periodically throughout the day.",
    things_to_watch: "If the discomfort increases, starts to feel sharp, causes stiffness or pain first thing in the morning that does not settle quickly, or if you notice any swelling along the Achilles tendon, update your assessment.",
    check_in_again: "Check back in 7 days, or sooner if things change.",
    show_programme_impact: false, programme_impact_summary: null,
    flagging_movement_patterns: null, flagging_equipment: null, flagging_level: null,
    flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: null, substitution_rules: null,
    recommend_recovery_programme: false, recovery_programme_id: null,
    recovery_programme_reason: null, restore_on_reassessment: true, reassess_in_days: 7,
  },
  {
    body_area_id: 16, name: "calf_modify", display_name: "Modify your training",
    priority: 2, is_active: true, severity_min: 4, severity_max: 7,
    training_impact: "limited", movement_impact: "slight",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Pushing up onto toes", "Running or walking fast", "Going up stairs"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Pushing up onto toes", "Running or walking fast", "Going up stairs", "Lunging", "Deep squatting", "All of the above"],
    whats_going_on: "Your calf is uncomfortable enough to need some training adjustment. Pain in the calf or along the Achilles tendon during loading is usually the tendon or muscle reacting to too much too soon. The good news is that upper body training and most seated or machine-based lower body work is completely unaffected.",
    training_guidance: "Remove calf raises and any exercise that requires you to push up on to your toes under load. Avoid lunges that place a lot of demand through the calf and Achilles. Squats can usually be kept in if you keep heels firmly planted and do not go on to your toes. Deadlifts and hip hinge movements are fine as long as they do not aggravate the calf. Upper body training is completely unaffected.",
    daily_movement: "Walk at a comfortable pace on flat ground. Avoid running, jumping, or any explosive push-off from the foot. Stairs are usually manageable if done slowly. Morning stiffness that settles after a few minutes of walking is normal at this level.",
    desk_work_tips: "If you sit for long periods, the calf and Achilles stiffen. Stand up and do gentle ankle circles and non-weighted heel raises periodically. Avoid sitting with the ankle in a dropped position for extended periods.",
    things_to_watch: "If the pain becomes sharp rather than achy, if the Achilles tendon feels thickened or swollen compared to the other side, if you experience sudden severe pain in the calf during activity, or if the morning stiffness is not settling after walking, update your assessment.",
    check_in_again: "Check back in 5 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "Calf and Achilles loading movements have been flagged. Upper body and hip hinge training are unaffected.",
    flagging_movement_patterns: ["Lunge"],
    flagging_equipment: null, flagging_level: null, flagging_mechanics: null, flagging_muscles: ["Calf"], flagging_exclude_tags: null,
    flagging_note: "User has calf pain - calf loading and Achilles-intensive movements flagged",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Hip Hinge", "Squat", "Horizontal Push", "Horizontal Pull", "Vertical Push", "Vertical Pull", "Core Anti-Extension", "Core Anti-Rotation"], substituteExerciseIds: [] }),
    recommend_recovery_programme: false, recovery_programme_id: null,
    recovery_programme_reason: null, restore_on_reassessment: true, reassess_in_days: 5,
  },
  {
    body_area_id: 16, name: "calf_seek_assessment", display_name: "Get this looked at",
    priority: 1, is_active: true, severity_min: 8, severity_max: 10,
    training_impact: "cannot_train", movement_impact: "significant",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Pushing up onto toes", "Running or walking fast", "Going up stairs", "Walking", "All of the above"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Pushing up onto toes", "Running or walking fast", "Going up stairs", "Lunging", "Deep squatting", "Walking", "All of the above"],
    whats_going_on: "Your calf is reporting significant pain. At this level, particularly if it came on suddenly during activity or if you are struggling to walk normally, this needs professional assessment. A significant calf strain or Achilles tendon problem at this severity needs proper evaluation before any return to training.",
    training_guidance: "Do not load the calf or Achilles at all until you have been assessed. Upper body training in seated positions is completely fine. Walking should be kept to a minimum if it is painful. Book an appointment as soon as possible.",
    daily_movement: "Keep weight-bearing to a minimum if it causes significant pain. Walk only as much as necessary at a slow comfortable pace. If the pain came on suddenly during a sprint or explosive movement, treat it as urgent.",
    desk_work_tips: "Keep the ankle in a comfortable neutral position when sitting. Elevating the leg when resting will help if there is any swelling present.",
    things_to_watch: "Seek urgent assessment if you experience any of the following: sudden severe pain in the calf during activity that felt like being kicked or a snap, significant swelling or bruising along the calf or Achilles, inability to push up onto your toes at all, or a visible gap or lump in the calf muscle. These are signs of a serious strain or potential Achilles rupture that need same-day attention.",
    check_in_again: "Check back in 3 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "All calf and lower leg loading is on hold until you have been assessed. Upper body training in seated positions is unaffected.",
    flagging_movement_patterns: ["Lunge", "Squat"],
    flagging_equipment: null, flagging_level: null, flagging_mechanics: null, flagging_muscles: ["Calf"], flagging_exclude_tags: null,
    flagging_note: "User has high severity calf pain - all lower leg loading flagged",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Horizontal Push", "Horizontal Pull", "Vertical Push", "Vertical Pull", "Core Anti-Extension", "Core Anti-Rotation", "Hip Hinge"], substituteExerciseIds: [] }),
    recommend_recovery_programme: true, recovery_programme_id: null,
    recovery_programme_reason: "High severity calf pain - professional assessment required",
    restore_on_reassessment: true, reassess_in_days: 3,
  },
];
async function run() {
  console.log("Starting calf outcomes seed...\n");
  const existing = await pool.query("SELECT name FROM body_map_outcomes WHERE body_area_id = 16");
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
