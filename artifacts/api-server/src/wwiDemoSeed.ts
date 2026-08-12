import { pool } from "./db";

/**
 * One-time demo-data seeder for the Workforce Wellbeing Index.
 *
 * Creates an isolated "WWI Demo" company (12 people) with check-ins, body-map
 * logs and burnout scores across the CURRENT window (last ~24 days) AND a PRIOR
 * window (~32-56 days ago), so the page renders in its FULL state and the
 * vs-last-period trend indicators have a baseline to compare against.
 *
 * Runs against whatever database the deployed server is on (i.e. production).
 * Guarded by a persistent system_flags marker so it runs exactly once per
 * database, even after the cohort already exists (lets this v2 replace v1).
 *
 * To remove the demo cohort later: delete the "WWI Demo" users (their check-in,
 * body-map and burnout rows go with them) and delete the system_flags row.
 */

let hasRunWwiDemoSeed = false;

const COMPANY = "WWI Demo";
const SEED_FLAG = "wwi_demo_seed_v2";
const IDS = Array.from({ length: 12 }, (_, i) => `wwi-demo-${String(i + 1).padStart(2, "0")}`);

const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const ch = (p: number) => Math.random() < p;

const CHECKIN_COLS = `(user_id,check_in_date,week,mood_score,energy_score,stress_score,sleep_score,clarity_score,
  headache,alcohol,alcohol_count,sick,pain_or_injury,emotionally_stable,anxious,overwhelmed,
  fatigue,fatigue_trigger_met,exercised_yesterday,caffeine_after_2pm,practiced_mindfulness,
  energy_level,stress_management,completed)`;
const CHECKIN_VALS = `VALUES ($1, NOW() - make_interval(days => $2), 0, $3,$4,$5,$6,$7,
  $8,$9,$10,$11,$12,$13,$14,$15,
  $16,$17,$18,$19,$20,
  $21,'',true)`;

// Insert one check-in for a user on a given day-offset. `bias` nudges the
// positive metrics down and stress up, used for the prior window so the current
// window generally reads as an improvement.
async function insertCheckIn(id: string, dayOffset: number, bias: boolean) {
  const hi = bias ? 4 : 5;
  const stress = bias ? ri(3, 5) : ri(2, 5);
  const drink = ch(0.25);
  const overwhelmed = (stress >= 4 && ch(0.5)) || ch(0.15);
  await pool.query(
    `INSERT INTO check_ins ${CHECKIN_COLS} ${CHECKIN_VALS}`,
    [id, dayOffset, ri(2, hi), ri(2, hi), stress, ri(2, hi), ri(2, hi),
      ch(0.2), drink, (drink ? ri(1, 3) : null), ch(0.08), ch(0.3), ch(0.7), ch(0.3), overwhelmed,
      ch(0.35), ch(0.35), ch(0.5), ch(0.4), ch(0.3),
      ri(2, hi)]
  );
}

const DRIVERS = [["workload", "Workload"], ["sleep", "Sleep debt"], ["stress", "Sustained stress"], ["recovery", "Low recovery"], ["control", "Low perceived control"]];
const TRAJ = ["stable", "rising", "elevated", "recovering"];

function driverJson(): string {
  const a = DRIVERS[ri(0, 4)];
  let b = DRIVERS[ri(0, 4)];
  if (b[0] === a[0]) b = DRIVERS[(DRIVERS.indexOf(a) + 1) % DRIVERS.length];
  return JSON.stringify([a, b].map(([key, label]) => ({ key, label, explanation: `${label} trending up`, trend: "up", weight: 0.3 })));
}

async function insertBurnout(id: string, score: number, dayOffset: number) {
  await pool.query(
    `INSERT INTO burnout_scores (user_id,score,trajectory,confidence,top_drivers,rolling_window_days,computed_date,check_in_count,data_source_count)
     VALUES ($1,$2,$3,$4,$5::jsonb,30, NOW() - make_interval(days => $6), $7,1)`,
    [id, score, TRAJ[ri(0, 3)], ch(0.6) ? "high" : "medium", driverJson(), dayOffset, ri(6, 10)]
  );
}

export async function seedWwiDemoOnce(): Promise<void> {
  if (hasRunWwiDemoSeed) return;
  hasRunWwiDemoSeed = true;

  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS system_flags (key text PRIMARY KEY, created_at timestamp DEFAULT now())`);
    const flag = await pool.query(`SELECT 1 FROM system_flags WHERE key = $1 LIMIT 1`, [SEED_FLAG]);
    if ((flag.rowCount ?? 0) > 0) {
      console.log("[startup-migration] wwi-demo: v2 already seeded, skipping");
      return;
    }

    // Clear any previous demo rows (also clears v1's current-window-only data).
    await pool.query(`DELETE FROM check_ins      WHERE user_id = ANY($1)`, [IDS]);
    await pool.query(`DELETE FROM body_map_logs  WHERE user_id = ANY($1)`, [IDS]);
    await pool.query(`DELETE FROM burnout_scores WHERE user_id = ANY($1)`, [IDS]);
    await pool.query(`DELETE FROM users WHERE company_name = $1`, [COMPANY]);

    // Keep serial id sequences ahead of MAX(id) (prod-safety).
    for (const t of ["check_ins", "body_map_logs", "burnout_scores"]) {
      await pool.query(`SELECT setval(pg_get_serial_sequence('${t}','id'), (SELECT COALESCE(MAX(id),1) FROM ${t}))`);
    }

    // 12 demo people
    for (let i = 0; i < IDS.length; i++) {
      await pool.query(
        `INSERT INTO users (id,email,first_name,last_name,display_name,company_name,is_admin,role,onboarding_completed)
         VALUES ($1,$2,'Demo',$3,$4,$5,false,'user',true) ON CONFLICT (id) DO NOTHING`,
        [IDS[i], `${IDS[i]}@demo.invalid`, `User ${String(i + 1).padStart(2, "0")}`, `Demo User ${i + 1}`, COMPANY]
      );
    }

    // Check-ins — current window (last 24 days) + prior window (32-56 days ago).
    let ci = 0;
    for (const id of IDS) {
      const usedCur = new Set<number>();
      for (let k = 0, n = ri(6, 10); k < n; k++) {
        let d = ri(1, 24); while (usedCur.has(d)) d = ri(1, 24); usedCur.add(d);
        await insertCheckIn(id, d, false); ci++;
      }
      const usedPrev = new Set<number>();
      for (let k = 0, n = ri(5, 8); k < n; k++) {
        let d = ri(32, 56); while (usedPrev.has(d)) d = ri(32, 56); usedPrev.add(d);
        await insertCheckIn(id, d, true); ci++;
      }
    }

    // Body-map logs — current window, with two areas over the 5-reporter floor,
    // plus a prior-window set so severity/prevalence trends have a baseline.
    const contrib = IDS.slice(0, 11);
    const bmInsert = (id: string, part: string, sev: number, side: string, view: string, ti: string | null, d: number) =>
      pool.query(
        `INSERT INTO body_map_logs (user_id,body_part,severity,side,view,training_impact,created_at)
         VALUES ($1,$2,$3,$4,$5,$6, NOW() - make_interval(days => $7))`,
        [id, part, sev, side, view, ti, d]
      );
    let bm = 0;
    for (const id of contrib.slice(0, 6)) { await bmInsert(id, "lower_back", ri(5, 7), ["left", "right", "both"][ri(0, 2)], "back", ch(0.5) ? "careful" : "modify_avoid", ri(1, 22)); bm++; }
    for (const id of contrib.slice(3, 8)) { await bmInsert(id, "neck", ri(4, 6), ["left", "right"][ri(0, 1)], "back", "careful", ri(1, 22)); bm++; }
    for (const id of contrib.slice(8, 11)) { await bmInsert(id, "shoulder", ri(3, 6), ["left", "right"][ri(0, 1)], "front", null, ri(1, 22)); bm++; }
    for (const id of contrib.slice(0, 6)) { await bmInsert(id, "lower_back", ri(4, 6), "both", "back", null, ri(34, 56)); bm++; }

    // Burnout — current (better) + prior (slightly worse) so the trend reads.
    const plan = [15, 22, 31, 38, 45, 52, 58, 64, 71, 78, 85, 91];
    for (let i = 0; i < IDS.length; i++) {
      await insertBurnout(IDS[i], plan[i], ri(1, 6));                                  // current window
      await insertBurnout(IDS[i], Math.min(100, plan[i] + ri(3, 12)), ri(34, 56));     // prior window (worse)
    }

    await pool.query(`INSERT INTO system_flags (key) VALUES ($1) ON CONFLICT (key) DO NOTHING`, [SEED_FLAG]);
    console.log(`[startup-migration] wwi-demo: seeded 12 users, ${ci} check-ins (current+prior), ${bm} body-map logs, 24 burnout scores`);
  } catch (e: any) {
    console.error("[startup-migration] wwi-demo failed:", e?.message || e);
  }
}
