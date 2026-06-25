import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const outcomes: any[] = [
  {
    body_area_id: 15, name: "knee_keep_moving", display_name: "Keep moving",
    priority: 1, is_active: true, severity_min: 1, severity_max: 3,
    training_impact: "normal", movement_impact: "none",
    triggers_follow_up: false, follow_up_question: null, follow_up_answers: null,
    movement_question: null, movement_options: null,
    whats_going_on: "Your knee is flagging some mild discomfort but not enough to slow you down. At this level it is usually some general irritation — a bit of tightness, mild achiness after activity, or the joint reacting to a change in training load. It does not mean something is wrong structurally. The knee responds well to continued movement and loading, so keeping active is the right call.",
    training_guidance: "Train as normal. Pay attention to how the knee feels during squatting and lunging movements — if anything causes a noticeable spike in discomfort, reduce the depth slightly or drop the load rather than pushing through it. Everything else continues as planned.",
    daily_movement: "Keep moving throughout the day. Prolonged sitting with the knee bent can cause stiffness — if you are desk-based, try to straighten the leg and stand up every hour or so. Short walks are helpful. Avoid sitting with the knee in a fully bent position for long stretches.",
    desk_work_tips: "If you sit for long periods, make a habit of straightening your knee and doing a few gentle quad contractions at your desk. Getting up and walking for two to three minutes every hour will keep the joint mobile and reduce stiffness.",
    things_to_watch: "If the discomfort increases in intensity, starts to feel sharp or catching rather than a dull ache, if the knee begins to swell, or if it starts to feel unstable or give way — update your assessment immediately. Those signs need closer attention.",
    check_in_again: "Check back in 7 days, or sooner if things change.",
    show_programme_impact: false, programme_impact_summary: null,
    flagging_movement_patterns: null, flagging_equipment: null, flagging_level: null,
    flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: null, substitution_rules: null,
    recommend_recovery_programme: false, recovery_programme_id: null,
    recovery_programme_reason: null, restore_on_reassessment: true, reassess_in_days: 7,
  },
  {
    body_area_id: 15, name: "knee_front_pain", display_name: "Front of the knee is the problem",
    priority: 4, is_active: true, severity_min: 4, severity_max: 6,
    training_impact: "limited", movement_impact: "slight",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Squatting", "Going up or down stairs", "Kneeling"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Squatting", "Going up or down stairs", "Kneeling", "Running or walking fast", "Sitting for long periods with knees bent", "Straightening the knee fully", "All of the above"],
    whats_going_on: "The discomfort you are feeling is at the front of the knee and gets worse when you bend the knee under load — squatting deep, going down stairs, or sitting with the knee bent for a long time. This is a very common pattern in people who train, often related to how the kneecap is tracking or how much load the tendon below it is taking. The good news is that hip hinge movements like deadlifts and most upper body training are completely unaffected.",
    training_guidance: "Modify your squatting depth rather than removing squats entirely. Shallow squats — stopping before the point of discomfort — are much better than no squats. Box squats where you sit back rather than down can help reduce stress on the front of the knee. Avoid full deep squats under load for now. Leg press is usually well tolerated at a limited range. Hip hinge movements like deadlifts and Romanian deadlifts are fine — keep those in. Upper body training is completely unaffected.",
    daily_movement: "Avoid prolonged sitting with the knee bent past 90 degrees where possible — this position loads the front of the knee even without any weight. When going up and down stairs, lead with your stronger leg. Short regular walks on flat ground are fine and helpful.",
    desk_work_tips: "If you sit at a desk, try to keep the knee at roughly 90 degrees rather than bent further. Getting up and straightening the leg regularly will reduce the cumulative load on the front of the knee over a working day. Avoid low chairs or sofas that put the knee in a deeply bent position for long periods.",
    things_to_watch: "If the pain becomes sharp and constant rather than load-related, if you notice swelling around the kneecap, if the knee starts to give way or feel unstable, or if the pain starts spreading to other parts of the knee — update your assessment. Those signs need closer attention.",
    check_in_again: "Check back in 5 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "Deep knee flexion movements have been flagged. Hip hinge and upper body training are unaffected.",
    flagging_movement_patterns: ["Squat", "Lunge"],
    flagging_equipment: ["Barbell"],
    flagging_level: null, flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: "User has anterior knee pain — deep loaded squat and lunge movements flagged",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Hip Hinge", "Horizontal Push", "Horizontal Pull", "Vertical Push", "Vertical Pull", "Core Anti-Extension", "Core Anti-Rotation"], substituteExerciseIds: [] }),
    recommend_recovery_programme: false, recovery_programme_id: null,
    recovery_programme_reason: null, restore_on_reassessment: true, reassess_in_days: 5,
  },
  {
    body_area_id: 15, name: "knee_general_pain", display_name: "Most knee movements are uncomfortable",
    priority: 2, is_active: true, severity_min: 4, severity_max: 6,
    training_impact: "cannot_train", movement_impact: "significant",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Squatting", "Running or walking fast", "Going up or down stairs", "Straightening the knee fully"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Squatting", "Going up or down stairs", "Kneeling", "Running or walking fast", "Sitting for long periods with knees bent", "Straightening the knee fully", "All of the above"],
    whats_going_on: "Your knee is uncomfortable across a range of movements right now, not just in one specific position. This suggests the joint is quite irritated and needs a meaningful reduction in loading across the board. It does not necessarily mean something is seriously wrong, but it does mean the knee needs more than just a depth modification — it needs a proper break from loading.",
    training_guidance: "Remove all direct knee loading from your training for now. That means no squats, lunges, leg press, or any movement that bends the knee under load. Upper body training is completely fine and should continue as normal. Hip hinge movements like deadlifts can usually be kept in if they do not cause knee discomfort — test them carefully. Focus on upper body and core work while the knee settles.",
    daily_movement: "Keep movement gentle. Short flat walks are fine if they do not increase the pain. Avoid stairs where possible, especially going down which tends to be harder on the knee. Avoid prolonged sitting with the knee in a bent position. Do not push into discomfort in daily activities.",
    desk_work_tips: "Try to keep the knee relatively straight when sitting rather than bent back under your chair. Getting up and walking briefly every 30 to 45 minutes will prevent stiffness from building up. If the knee is uncomfortable at your desk, a footrest that lets you keep the leg slightly elevated can help.",
    things_to_watch: "If you notice any swelling around the knee joint, if the knee gives way or feels like it might collapse, if it locks and will not straighten fully, or if the pain becomes constant rather than movement-related — update your assessment. Any of those signs need professional review.",
    check_in_again: "Check back in 4 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "Knee loading movements have been flagged. Upper body and hip hinge training are unaffected.",
    flagging_movement_patterns: ["Squat", "Lunge", "Knee Flexion", "Knee Extension"],
    flagging_equipment: null, flagging_level: null, flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: "User has general knee pain — all knee loading movements flagged",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Hip Hinge", "Horizontal Push", "Horizontal Pull", "Vertical Push", "Vertical Pull", "Core Anti-Extension", "Core Anti-Rotation", "Core Anti-Lateral Flexion"], substituteExerciseIds: [] }),
    recommend_recovery_programme: false, recovery_programme_id: null,
    recovery_programme_reason: null, restore_on_reassessment: true, reassess_in_days: 4,
  },
  {
    body_area_id: 15, name: "knee_seek_assessment", display_name: "Get this looked at",
    priority: 1, is_active: true, severity_min: 7, severity_max: 10,
    training_impact: "cannot_train", movement_impact: "significant",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Squatting", "Going up or down stairs", "Running or walking fast", "Straightening the knee fully", "All of the above"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Squatting", "Going up or down stairs", "Kneeling", "Running or walking fast", "Sitting for long periods with knees bent", "Straightening the knee fully", "All of the above"],
    whats_going_on: "Your knee is reporting significant pain. At this level, particularly if you have any swelling, instability, or the knee is giving way, this needs a proper hands-on assessment rather than training modifications. A physiotherapist or sports medicine professional can tell you exactly what is going on and give you a plan that is specific to your situation. Most knee issues, even at high severity, are very manageable with the right approach.",
    training_guidance: "Do not load the knee at all until you have been assessed. Upper body training in seated or supported positions is fine if it does not cause any knee discomfort. The priority right now is getting the knee looked at, not finding training workarounds. Book an appointment as soon as you can.",
    daily_movement: "Move as gently as you can within a pain-free range. If the knee is swollen, keeping it elevated when resting will help. Avoid any activity that significantly increases the pain. If you cannot bear weight on the leg comfortably, that is an additional sign this needs urgent attention.",
    desk_work_tips: "If working at a desk, keep the knee in a comfortable position — slightly elevated if it helps. Avoid positions that increase swelling or pain. Short gentle movements every 30 minutes are better than staying completely still.",
    things_to_watch: "Seek urgent assessment if you experience any of the following: significant swelling that appeared quickly after an injury, the knee giving way completely or feeling very unstable, inability to bear weight on the leg, the knee locking and being unable to straighten, or pain that came on suddenly from a direct impact or twist. These need same-day attention.",
    check_in_again: "Check back in 3 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "Knee loading is on hold until you have been assessed. Upper body training in supported positions is unaffected.",
    flagging_movement_patterns: ["Squat", "Lunge", "Knee Flexion", "Knee Extension"],
    flagging_equipment: null, flagging_level: null, flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: "User has high severity knee pain — all knee loading flagged, professional assessment recommended",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Horizontal Push", "Horizontal Pull", "Vertical Push", "Vertical Pull", "Core Anti-Extension", "Core Anti-Rotation"], substituteExerciseIds: [] }),
    recommend_recovery_programme: true, recovery_programme_id: null,
    recovery_programme_reason: "High severity knee pain — professional assessment and recovery programme recommended",
    restore_on_reassessment: true, reassess_in_days: 3,
  },
];
async function run() {
  console.log("Starting knee outcomes seed...\n");
  const existing = await pool.query("SELECT name FROM body_map_outcomes WHERE body_area_id = 15");
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
