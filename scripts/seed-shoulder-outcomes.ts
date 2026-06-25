import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const outcomes: any[] = [
  {
    body_area_id: 7, name: "shoulder_keep_moving", display_name: "Keep moving",
    priority: 1, is_active: true, severity_min: 1, severity_max: 3,
    training_impact: "normal", movement_impact: "none",
    triggers_follow_up: false, follow_up_question: null, follow_up_answers: null,
    movement_question: null, movement_options: null,
    whats_going_on: "Your shoulder is a little unhappy right now, but not enough to slow you down. This kind of mild discomfort is usually your body flagging some accumulated tension, a slightly overworked muscle, or a movement pattern that needs a small tweak. It is worth paying attention to but it is not a reason to stop.",
    training_guidance: "Train as normal. Stay aware of how the shoulder feels during pressing and overhead movements and if anything causes a noticeable spike in discomfort, reduce the load slightly or shorten the range of motion rather than pushing through it. Everything else can continue as planned.",
    daily_movement: "Keep the shoulder moving. Avoid sitting in the same position for long stretches. If you are desk-based, a few shoulder rolls and slow arm circles every hour will help. The worst thing you can do at this level is baby it completely.",
    desk_work_tips: "Check your workstation. If your screen is off to one side, your mouse arm is reaching forward, or your shoulder is constantly elevated, those small sustained positions add up over a full working day. Try to keep both arms close and your shoulders relaxed.",
    things_to_watch: "If the discomfort gets more intense, starts to feel sharp rather than dull, or begins affecting movements that previously felt fine, update your assessment. That is your signal to step things down.",
    check_in_again: "Check back in 7 days, or sooner if things change.",
    show_programme_impact: false, programme_impact_summary: null,
    flagging_movement_patterns: null, flagging_equipment: null, flagging_level: null,
    flagging_mechanics: null, flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: null, substitution_rules: null,
    recommend_recovery_programme: false, recovery_programme_id: null,
    recovery_programme_reason: null, restore_on_reassessment: true, reassess_in_days: 7,
  },
  {
    body_area_id: 7, name: "shoulder_overhead_only", display_name: "Overhead is the problem",
    priority: 4, is_active: true, severity_min: 4, severity_max: 6,
    training_impact: "limited", movement_impact: "slight",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Reaching overhead", "Pushing movements"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Reaching overhead", "Reaching behind back", "Pushing movements", "Pulling movements", "Lifting objects", "Sleeping on this side"],
    whats_going_on: "Your shoulder is uncomfortable specifically when you reach or push overhead. This is one of the most common shoulder issues in people who train. The joint gets irritated in that overhead position, often from a combination of load, volume, and the way the shoulder blade is moving. The good news is that most other movements are still available to you, and keeping those going is actually part of the solution.",
    training_guidance: "Take overhead pressing and overhead pulling out of your training for now. No shoulder press, no overhead tricep work, no pull-ups or lat pulldowns if they cause discomfort at the top. Everything below shoulder height is likely still fine. Horizontal pressing and rowing movements are not only allowed, they are encouraged. Keep those going and focus on control rather than load this week.",
    daily_movement: "Avoid repeated reaching overhead in daily life where you can. If you need to get something from a high shelf, use a step rather than reaching and straining. Everything else should feel pretty normal.",
    desk_work_tips: "Watch how you are positioning your arm at your desk. If your monitor is too high and you are constantly looking and reaching upward, that sustained elevation can aggravate this. Screen at eye level, arms relaxed and supported.",
    things_to_watch: "If horizontal pressing starts to cause discomfort too, or if the pain begins to feel sharp and pinching rather than a general ache, update your assessment. Your shoulder may need more rest than this outcome allows for.",
    check_in_again: "Check back in 5 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "Overhead movements have been flagged due to your shoulder. Your horizontal pressing and pulling movements are unaffected.",
    flagging_movement_patterns: ["Vertical Push", "Vertical Pull"],
    flagging_equipment: null, flagging_level: null, flagging_mechanics: null,
    flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: "User has overhead shoulder sensitivity — vertical movements flagged",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Horizontal Push", "Horizontal Pull"], substituteExerciseIds: [] }),
    recommend_recovery_programme: false, recovery_programme_id: null,
    recovery_programme_reason: null, restore_on_reassessment: true, reassess_in_days: 5,
  },
  {
    body_area_id: 7, name: "shoulder_push_sensitive", display_name: "Pushing hurts, pulling is fine",
    priority: 3, is_active: true, severity_min: 4, severity_max: 6,
    training_impact: "limited", movement_impact: "slight",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Reaching overhead", "Pushing movements", "Reaching behind back"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Reaching overhead", "Reaching behind back", "Pushing movements", "Pulling movements", "Lifting objects", "Sleeping on this side"],
    whats_going_on: "Your shoulder is struggling with pushing movements, whether overhead or at chest height. This often comes down to an imbalance between how much pushing and pulling you do, with the pushing side getting overloaded and irritated. The pulling side of your shoulder is still working well, which is a good sign and something we can use to your advantage while this settles down.",
    training_guidance: "Remove all pressing movements for now. No overhead pressing, no bench pressing, no pushing variation that loads the shoulder. Pulling movements are your best friend right now. Rows, face pulls, and any horizontal pulling variation are not only safe, they will help address the imbalance contributing to this. Keep those in and keep them consistent.",
    daily_movement: "Pushing movements in daily life — opening heavy doors, pushing yourself up from a chair using that arm — try to minimise these where you can. Being mindful of it helps the shoulder settle faster.",
    desk_work_tips: "If you use a mouse, make sure your arm is not reaching forward and your elbow is supported. A shoulder already irritated on the pushing side will be aggravated by a sustained forward reach all day.",
    things_to_watch: "If pulling movements start to become uncomfortable too, or if the pain intensifies or starts to feel sharp and catching, update your assessment. That is a sign the shoulder needs more rest than this allows.",
    check_in_again: "Check back in 5 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "Pressing movements have been flagged due to your shoulder. Your pulling movements are unaffected and actively encouraged.",
    flagging_movement_patterns: ["Vertical Push", "Horizontal Push"],
    flagging_equipment: null, flagging_level: null, flagging_mechanics: null,
    flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: "User has pushing sensitivity — all pressing movements flagged",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Horizontal Pull", "Vertical Pull", "Squat", "Lunge", "Hip Hinge"], substituteExerciseIds: [] }),
    recommend_recovery_programme: false, recovery_programme_id: null,
    recovery_programme_reason: null, restore_on_reassessment: true, reassess_in_days: 5,
  },
  {
    body_area_id: 7, name: "shoulder_broad_sensitivity", display_name: "Most movements are uncomfortable",
    priority: 2, is_active: true, severity_min: 4, severity_max: 6,
    training_impact: "cannot_train", movement_impact: "significant",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Reaching overhead", "Pushing movements", "Pulling movements", "Lifting objects", "Reaching behind back"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Reaching overhead", "Reaching behind back", "Pushing movements", "Pulling movements", "Lifting objects", "Sleeping on this side"],
    whats_going_on: "Your shoulder is at a level where most movements through the joint are causing discomfort. This suggests the area is quite irritated right now, not necessarily seriously injured, but overloaded to a point where it needs a meaningful rest from loading. This is your body asking you to take your foot off the gas, not slam on the brakes permanently.",
    training_guidance: "Take all direct shoulder loading out of your training this week. No pressing of any kind and no pulling movements that load the shoulder joint. Lower body and core training is completely unaffected — use this as an opportunity to prioritise that. Light pain-free movement through the shoulder like gentle arm circles is fine and helpful, but no loaded work until it settles.",
    daily_movement: "Be deliberate about protecting the shoulder across your day. Avoid carrying bags on the affected side, reaching overhead, or any movement that causes a noticeable increase in pain. Gentle movement is fine but listen to what the shoulder is telling you.",
    desk_work_tips: "Support the arm at your desk wherever possible. An armrest at the right height takes a surprising amount of load off an irritated shoulder over a full working day. Keep the arm close to your body and avoid any sustained reaching.",
    things_to_watch: "If the pain becomes sharp or constant rather than movement-related, if you notice any swelling around the joint, or if it starts affecting your sleep, update your assessment. Those are signs that this needs more attention than self-management alone.",
    check_in_again: "Check back in 4 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "Your shoulder needs a break from loading. All upper body movements have been flagged and lower body alternatives suggested.",
    flagging_movement_patterns: ["Vertical Push", "Vertical Pull", "Horizontal Push", "Horizontal Pull", "Carry"],
    flagging_equipment: null, flagging_level: null, flagging_mechanics: null,
    flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: "User has broad shoulder sensitivity — all upper body loading flagged",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Squat", "Lunge", "Hip Hinge", "Core Anti-Extension", "Core Anti-Rotation", "Core Anti-Lateral Flexion"], substituteExerciseIds: [] }),
    recommend_recovery_programme: false, recovery_programme_id: null,
    recovery_programme_reason: null, restore_on_reassessment: true, reassess_in_days: 4,
  },
  {
    body_area_id: 7, name: "shoulder_pull_back", display_name: "Pull back completely",
    priority: 2, is_active: true, severity_min: 7, severity_max: 9,
    training_impact: "cannot_train", movement_impact: "significant",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Reaching overhead", "Pushing movements", "Pulling movements", "Lifting objects", "Reaching behind back", "Sleeping on this side"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Reaching overhead", "Reaching behind back", "Pushing movements", "Pulling movements", "Lifting objects", "Sleeping on this side"],
    whats_going_on: "Your shoulder is reporting significant pain. At this level the joint is telling you clearly that it has been pushed past what it can currently handle. This is not about being tough and training through it — doing that at this level will make things worse and extend your recovery. The smartest move right now is to take the shoulder completely out of your training and let it settle.",
    training_guidance: "No shoulder loading at all. No pressing, no pulling, no carries, no overhead work. Lower body training is completely fine and encouraged — keep your legs and core work going as normal. If even lower body movements cause referred discomfort into the shoulder, reduce intensity further. Focus on what you can do, not what you cannot.",
    daily_movement: "Be careful in daily life. Avoid carrying anything heavy on the affected side, reaching overhead, or sleeping on that shoulder if it causes pain. Gentle movement within a completely pain-free range is fine, but do not push into discomfort at all.",
    desk_work_tips: "Support the arm fully at your desk. If you do not have an armrest, use a cushion or folded jacket. Keep the arm close to your body throughout the day and avoid any position that increases the pain even slightly.",
    things_to_watch: "If the pain is constant rather than movement-related, if you notice visible swelling or bruising around the shoulder, if you feel weakness in the arm that was not there before, or if the pain is disturbing your sleep significantly — you need to get this looked at by a professional.",
    check_in_again: "Check back in 3 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "Your shoulder needs a complete break from loading. All upper body movements have been flagged and lower body alternatives provided.",
    flagging_movement_patterns: ["Vertical Push", "Vertical Pull", "Horizontal Push", "Horizontal Pull", "Carry"],
    flagging_equipment: null, flagging_level: null, flagging_mechanics: null,
    flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: "User has high severity shoulder pain — all upper body loading flagged",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Squat", "Lunge", "Hip Hinge", "Core Anti-Extension", "Core Anti-Rotation", "Core Anti-Lateral Flexion"], substituteExerciseIds: [] }),
    recommend_recovery_programme: true, recovery_programme_id: null,
    recovery_programme_reason: "High severity shoulder pain — recovery programme recommended",
    restore_on_reassessment: true, reassess_in_days: 3,
  },
  {
    body_area_id: 7, name: "shoulder_seek_assessment", display_name: "Get this looked at",
    priority: 1, is_active: true, severity_min: 9, severity_max: 10,
    training_impact: "cannot_train", movement_impact: "significant",
    triggers_follow_up: true, follow_up_question: "Which movements cause discomfort?",
    follow_up_answers: ["Reaching overhead", "Pushing movements", "Pulling movements", "Lifting objects", "Reaching behind back", "Sleeping on this side"],
    movement_question: "Does this limit how you move?",
    movement_options: ["Reaching overhead", "Reaching behind back", "Pushing movements", "Pulling movements", "Lifting objects", "Sleeping on this side"],
    whats_going_on: "The level of pain you are reporting is beyond what a training modification can address. At this severity there may be something more significant going on with the shoulder that needs a proper hands-on assessment from a physiotherapist or sports medicine professional. This is not alarm — many shoulder issues at this level are very treatable — but they need the right diagnosis first.",
    training_guidance: "Do not train the shoulder in any way. Lower body and core work is fine if it does not cause any discomfort in the shoulder. The priority right now is getting the shoulder properly assessed, not finding workarounds. Book an appointment with a physiotherapist or sports medicine professional as soon as you can.",
    daily_movement: "Protect the shoulder in everything you do. Avoid any movement that increases the pain. If the arm feels weak, if you heard or felt a pop when this started, or if the pain came on suddenly from a fall or direct impact — treat this as urgent and seek same-day assessment.",
    desk_work_tips: "Support the arm fully at all times. If working is causing significant pain it may be worth speaking to your employer about a temporary adjustment. Do not push through a full working day in significant pain — that will slow recovery.",
    things_to_watch: "Seek immediate assessment if you experience any of the following: pain radiating down your arm past the elbow, numbness or tingling in your hand or fingers, visible deformity or significant swelling around the joint, complete inability to lift the arm, or pain that came on suddenly from trauma.",
    check_in_again: "Check back in 3 days, or sooner if things change.",
    show_programme_impact: true,
    programme_impact_summary: "Your shoulder needs to be assessed by a professional before returning to any upper body training. All upper body movements have been flagged.",
    flagging_movement_patterns: ["Vertical Push", "Vertical Pull", "Horizontal Push", "Horizontal Pull", "Carry"],
    flagging_equipment: null, flagging_level: null, flagging_mechanics: null,
    flagging_muscles: null, flagging_exclude_tags: null,
    flagging_note: "User has severe shoulder pain — all upper body loading flagged, professional assessment recommended",
    substitution_rules: JSON.stringify({ allowedPatterns: ["Squat", "Lunge", "Hip Hinge", "Core Anti-Extension", "Core Anti-Rotation", "Core Anti-Lateral Flexion"], substituteExerciseIds: [] }),
    recommend_recovery_programme: true, recovery_programme_id: null,
    recovery_programme_reason: "Severe shoulder pain — professional assessment and recovery programme recommended",
    restore_on_reassessment: true, reassess_in_days: 3,
  },
];
async function run() {
  console.log("Starting shoulder outcomes seed...\n");
  const existing = await pool.query("SELECT name FROM body_map_outcomes WHERE body_area_id = 7");
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
