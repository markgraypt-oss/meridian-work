import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const outcomes: any[] = [
  {
    body_area_id: 12, name: "hip_keep_moving", display_name: "Keep moving",
    priority: 1, is_active: true, severity_min: 1, severity_max: 3,
    training_impact: "normal", movement_impact: "none",
    triggers_follow_up: false, follow_up_question: null, follow_up_answers: null,
    movement_question: null, movement_options: null,
    whats_going_on: "Your hip is flagging some mild discomfort but not enough to slow you down. At this level it is usually some tightness, general irritation from training load, or the joint reacting to sitting for long periods. It is worth paying attention to but it is not a reason to stop training.",
    training_guidance: "Train as normal. Be mindful of how the hip feels at the bottom of squats and during deep lunges. If anything causes a noticeable spike, reduce the depth slightly or the load rather than pushing through. Everything else continues as planned.",
    daily_movement: "Keep moving throughout the day. Long periods of sitting can tighten the hip and make discomfort worse. Get up and walk for a few minutes every hour. Gentle hip circles and walking are your best tools at this level.",
    desk_work_tips: "Check how you are sitting. If you tend to sit with one hip rotated or your weight unevenly distributed, that sustained position builds up over a working day. Try to sit evenly, feet flat on the floor, and change position regularly.",
    things_to_watch: "If the discomfort increases, starts to feel sharp or pinching especially at the front of the hip, begins to radiate into your groin or down your leg, or starts affecting daily movements, update your assessment.",
    check_in_again: "Check back in 7 days, or sooner if things change.",
    show_programme_impact: false, programme_impact_summary: null,
    flagging_movement_patterns: null, flagging_equipment: null, flagging_level: null,
    flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: null, substitution_rules: null,
    recommend_recovery_programme: false, recovery_programme_id: null,
    recovery_programme_reason: null, restore_on_reassessment: true, reassess_in_days: 7,
  },
  {
    body_area_id: 12, name: "hip_flexion_sensitive", display_name: "Deep hip flexion is the problem",
    priority: 4, is_active: true, severity_min: 4, severity_max: 6,
    training_impact: "limited", movement_impact: "slight",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Squatting deep", "High knee movements", "Sitting for long periods"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Squatting deep", "Lunging", "High knee movements", "Sitting for long periods", "Walking up stairs", "Rotating the hip", "All of the above"],
    whats_going_on: "Your hip is uncomfortable specifically when it gets into a deeply bent position. Deep squats, high knee movements, or sitting for a long time are the main triggers. This is a very common pattern in people who train, often related to how the ball and socket joint moves at the end of its range. The important thing is that you can almost certainly continue training with some depth modifications.",
    training_guidance: "Keep squatting but reduce the depth. Stop before the point of discomfort. Box squats where you sit back rather than down are often very well tolerated. Deadlifts and Romanian deadlifts are usually completely fine. Hip thrusts and glute bridges are not only fine but actively beneficial. Upper body training is completely unaffected.",
    daily_movement: "Avoid sitting in very low chairs or on soft sofas where the hip gets deeply bent. When sitting at a desk, try to keep the hip at roughly 90 degrees. Getting up and walking regularly will help significantly.",
    desk_work_tips: "Chair height matters here more than for most injuries. If your chair is too low, your hip is spending the day in the position that aggravates it. Raise your chair if possible so the hip stays at or slightly above 90 degrees. Stand up and move every 45 minutes.",
    things_to_watch: "If the pain starts occurring at shallower ranges that previously felt fine, if it begins radiating into your groin or down your leg, or if you notice a clicking or catching feeling inside the hip joint, update your assessment.",
    check_in_again: "Check back in 5 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "Deep hip flexion movements have been flagged. Hip hinge and upper body training are unaffected.",
    flagging_movement_patterns: ["Squat", "Lunge"],
    flagging_equipment: ["Barbell"], flagging_level: null, flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: "User has hip flexion sensitivity — deep squat and lunge movements flagged",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Hip Hinge", "Hip Extension", "Horizontal Push", "Horizontal Pull", "Vertical Push", "Vertical Pull", "Core Anti-Extension", "Core Anti-Rotation"], substituteExerciseIds: [] }),
    recommend_recovery_programme: false, recovery_programme_id: null,
    recovery_programme_reason: null, restore_on_reassessment: true, reassess_in_days: 5,
  },
  {
    body_area_id: 12, name: "hip_broad_sensitivity", display_name: "Most hip movements are uncomfortable",
    priority: 2, is_active: true, severity_min: 4, severity_max: 6,
    training_impact: "cannot_train", movement_impact: "significant",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Squatting deep", "Lunging", "Rotating the hip", "Walking up stairs"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Squatting deep", "Lunging", "High knee movements", "Sitting for long periods", "Walking up stairs", "Rotating the hip", "All of the above"],
    whats_going_on: "Your hip is uncomfortable across a range of movements right now, not just at the end of its range. This suggests the joint or surrounding muscles are quite irritated and need a proper reduction in loading. It does not mean something is seriously wrong, but modifying depth alone will not be enough. You need to take the hip out of loaded movements for a short period while it settles.",
    training_guidance: "Remove squats and lunges from your training for now. Hip hinge movements like deadlifts should be tested carefully. If they are pain-free, keep them in at a reduced load. If they also cause discomfort, remove them too. Upper body training is completely unaffected and should continue as normal.",
    daily_movement: "Be deliberate about protecting the hip in daily life. Avoid stairs where possible. Avoid sitting in low positions that require a lot of hip flexion to get up from. Walking on flat ground is fine if it does not cause pain.",
    desk_work_tips: "Keep the hip at a comfortable angle when sitting. A slightly raised chair or seat cushion can help. Get up and move gently every 30 to 45 minutes rather than staying in one position.",
    things_to_watch: "If the pain becomes sharp or constant rather than movement-related, if it begins radiating into your groin or down your leg, if the hip feels unstable or gives way, or if walking becomes significantly painful, update your assessment.",
    check_in_again: "Check back in 4 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "Hip loading movements have been flagged. Upper body training is unaffected.",
    flagging_movement_patterns: ["Squat", "Lunge", "Hip Flexion"],
    flagging_equipment: null, flagging_level: null, flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: "User has broad hip sensitivity — all loaded hip flexion movements flagged",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Hip Hinge", "Hip Extension", "Horizontal Push", "Horizontal Pull", "Vertical Push", "Vertical Pull", "Core Anti-Extension", "Core Anti-Rotation", "Core Anti-Lateral Flexion"], substituteExerciseIds: [] }),
    recommend_recovery_programme: false, recovery_programme_id: null,
    recovery_programme_reason: null, restore_on_reassessment: true, reassess_in_days: 4,
  },
  {
    body_area_id: 12, name: "hip_seek_assessment", display_name: "Get this looked at",
    priority: 1, is_active: true, severity_min: 7, severity_max: 10,
    training_impact: "cannot_train", movement_impact: "significant",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Squatting deep", "Lunging", "Rotating the hip", "Walking up stairs", "All of the above"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Squatting deep", "Lunging", "High knee movements", "Sitting for long periods", "Walking up stairs", "Rotating the hip", "All of the above"],
    whats_going_on: "Your hip is reporting significant pain. At this level, particularly if it is affecting everyday movements like walking or getting up from a chair, this needs a proper assessment from a physiotherapist or sports medicine professional. Most hip issues, even significant ones, respond very well to the right treatment. But the right treatment starts with understanding exactly what is going on.",
    training_guidance: "Do not load the hip at all until you have been assessed. Upper body training in seated or supported positions is fine if it does not cause any hip discomfort. The priority right now is getting the hip assessed, not finding training workarounds. Book an appointment as soon as possible.",
    daily_movement: "Move as gently as you can manage. Avoid any movement that causes a significant spike in pain. If walking is painful, minimise it and rest the hip. If the pain came on suddenly from a fall or direct impact, treat it as more urgent.",
    desk_work_tips: "Keep the hip in a comfortable position when sitting. Avoid low surfaces that require a lot of effort to get up from. If sitting is very painful, try to limit it and find a position that is more comfortable.",
    things_to_watch: "Seek urgent assessment if you experience any of the following: pain that came on suddenly from a fall or direct impact to the hip, inability to bear weight on the leg, significant swelling or bruising around the hip joint, pain radiating down the leg past the knee, or the hip feeling completely unstable. These need same-day attention.",
    check_in_again: "Check back in 3 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "Hip loading is on hold until you have been assessed. Upper body training in supported positions is unaffected.",
    flagging_movement_patterns: ["Squat", "Lunge", "Hip Flexion", "Hip Extension", "Hip Hinge"],
    flagging_equipment: null, flagging_level: null, flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: "User has high severity hip pain — all lower body loading flagged, professional assessment recommended",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Horizontal Push", "Horizontal Pull", "Vertical Push", "Vertical Pull", "Core Anti-Extension", "Core Anti-Rotation"], substituteExerciseIds: [] }),
    recommend_recovery_programme: true, recovery_programme_id: null,
    recovery_programme_reason: "High severity hip pain — professional assessment and recovery programme recommended",
    restore_on_reassessment: true, reassess_in_days: 3,
  },
];
async function run() {
  console.log("Starting hip outcomes seed...\n");
  const existing = await pool.query("SELECT name FROM body_map_outcomes WHERE body_area_id = 12");
  const existingNames = existing.rows.map((r: any) => r.name);
  if (existingNames.length > 0) {
    console.log("Existing outcomes found:");
    existingNames.forEach((n: string) => console.log("  - " + n));
    console.log("");
  }
  let inserted = 0; let skipped = 0;
  for (const o of outcomes) {
    if (existingNames.includes(o.name)) { console.log("SKIP: " + o.name); skipped++; continue; }
    await pool.query(
      `INSERT INTO body_map_outcomes (
        body_area_id,name,display_name,priority,is_active,severity_min,severity_max,training_impact,movement_impact,
        triggers_follow_up,follow_up_question,follow_up_answers,movement_question,movement_options,
        whats_going_on,training_guidance,daily_movement,desk_work_tips,things_to_watch,check_in_again,
        show_programme_impact,programme_impact_summary,flagging_movement_patterns,flagging_equipment,flagging_level,
        flagging_mechanics,flagging_muscles,flagging_exclude_tags,flagging_note,substitution_rules,
        recommend_recovery_programme,recovery_programme_id,recovery_programme_reason,restore_on_reassessment,reassess_in_days,
        created_at,updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,NOW(),NOW())`,
      [o.body_area_id,o.name,o.display_name,o.priority,o.is_active,o.severity_min,o.severity_max,o.training_impact,o.movement_impact,
        o.triggers_follow_up,o.follow_up_question,o.follow_up_answers?JSON.stringify(o.follow_up_answers):null,
        o.movement_question,o.movement_options?JSON.stringify(o.movement_options):null,
        o.whats_going_on,o.training_guidance,o.daily_movement,o.desk_work_tips,o.things_to_watch,o.check_in_again,
        o.show_programme_impact,o.programme_impact_summary,o.flagging_movement_patterns,o.flagging_equipment,o.flagging_level,
        o.flagging_mechanics,o.flagging_muscles,o.flagging_exclude_tags,o.flagging_note,o.substitution_rules,
        o.recommend_recovery_programme,o.recovery_programme_id,o.recovery_programme_reason,o.restore_on_reassessment,o.reassess_in_days]
    );
    console.log("INSERTED: " + o.name); inserted++;
  }
  console.log("\nDone. " + inserted + " inserted, " + skipped + " skipped.");
  await pool.end();
}
run().catch(err => { console.error("Error:", err.message); process.exit(1); });
