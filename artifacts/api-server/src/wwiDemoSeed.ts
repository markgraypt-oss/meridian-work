import { pool } from "./db";

/**
 * One-time demo-data seeder for the Workforce Wellbeing Index.
 *
 * Creates an isolated "WWI Demo" company (12 people) with check-ins, body-map
 * logs and burnout scores dated in the last ~24 days, so the WWI page renders
 * in its FULL state on the default "Last 30 days" view. Runs against whatever
 * database the deployed server is on (i.e. production). Idempotent: it skips
 * if the demo cohort already exists, so it is safe on every boot.
 *
 * To remove the demo cohort later: delete the "WWI Demo" users (their check-in,
 * body-map and burnout rows go with them).
 */

let hasRunWwiDemoSeed = false;

const COMPANY = "WWI Demo";
const IDS = Array.from({ length: 12 }, (_, i) => `wwi-demo-${String(i + 1).padStart(2, "0")}`);

const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const ch = (p: number) => Math.random() < p;

export async function seedWwiDemoOnce(): Promise<void> {
  if (hasRunWwiDemoSeed) return;
  hasRunWwiDemoSeed = true;

  try {
    const existing = await pool.query(
      `SELECT COUNT(*)::int AS c FROM users WHERE company_name = $1`,
      [COMPANY]
    );
    if (Number(existing.rows[0]?.c) >= 12) {
      console.log("[startup-migration] wwi-demo: already seeded, skipping");
      return;
    }

    // Clear any partial previous demo rows (makes this self-correcting).
    await pool.query(`DELETE FROM check_ins      WHERE user_id = ANY($1)`, [IDS]);
    await pool.query(`DELETE FROM body_map_logs  WHERE user_id = ANY($1)`, [IDS]);
    await pool.query(`DELETE FROM burnout_scores WHERE user_id = ANY($1)`, [IDS]);
    await pool.query(`DELETE FROM users WHERE company_name = $1`, [COMPANY]);

    // Keep serial id sequences ahead of MAX(id) (prod-safety: some prod tables
    // have a stale sequence from past imports).
    for (const t of ["check_ins", "body_map_logs", "burnout_scores"]) {
      await pool.query(
        `SELECT setval(pg_get_serial_sequence('${t}','id'), (SELECT COALESCE(MAX(id),1) FROM ${t}))`
      );
    }

    // 12 demo people
    for (let i = 0; i < IDS.length; i++) {
      await pool.query(
        `INSERT INTO users (id,email,first_name,last_name,display_name,company_name,is_admin,role,onboarding_completed)
         VALUES ($1,$2,'Demo',$3,$4,$5,false,'user',true) ON CONFLICT (id) DO NOTHING`,
        [IDS[i], `${IDS[i]}@demo.invalid`, `User ${String(i + 1).padStart(2, "0")}`, `Demo User ${i + 1}`, COMPANY]
      );
    }

    // Check-ins (drives the Mental Wellbeing domain)
    let ci = 0;
    for (const id of IDS) {
      const n = ri(6, 10);
      const used = new Set<number>();
      for (let k = 0; k < n; k++) {
        let d = ri(1, 24);
        while (used.has(d)) d = ri(1, 24);
        used.add(d);
        const stress = ri(2, 5);
        const drink = ch(0.25);
        const overwhelmed = (stress >= 4 && ch(0.5)) || ch(0.15);
        await pool.query(
          `INSERT INTO check_ins
             (user_id,check_in_date,week,mood_score,energy_score,stress_score,sleep_score,clarity_score,
              headache,alcohol,alcohol_count,sick,pain_or_injury,emotionally_stable,anxious,overwhelmed,
              fatigue,fatigue_trigger_met,exercised_yesterday,caffeine_after_2pm,practiced_mindfulness,
              energy_level,stress_management,completed)
           VALUES ($1, NOW() - make_interval(days => $2), 0, $3,$4,$5,$6,$7,
                   $8,$9,$10,$11,$12,$13,$14,$15,
                   $16,$17,$18,$19,$20,
                   $21,'',true)`,
          [id, d, ri(2, 5), ri(2, 5), stress, ri(2, 5), ri(2, 5),
            ch(0.2), drink, (drink ? ri(1, 3) : null), ch(0.08), ch(0.3), ch(0.7), ch(0.3), overwhelmed,
            ch(0.35), ch(0.35), ch(0.5), ch(0.4), ch(0.3),
            ri(2, 5)]
        );
        ci++;
      }
    }

    // Body-map logs (drives the Physical Strain domain). Guarantee two areas
    // clear the 5-distinct-reporter floor at severity >= 4.
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
    for (const id of contrib.slice(0, 5)) { await bmInsert(id, "lower_back", ri(3, 5), "both", "back", null, ri(31, 52)); bm++; }

    // Burnout scores (>=10 needed to make the burnout block reportable, which
    // lifts Mental Wellbeing to its full state).
    const plan = [15, 22, 31, 38, 45, 52, 58, 64, 71, 78, 85, 91];
    const trajs = ["stable", "rising", "elevated", "recovering"];
    const drivers = [["workload", "Workload"], ["sleep", "Sleep debt"], ["stress", "Sustained stress"], ["recovery", "Low recovery"], ["control", "Low perceived control"]];
    for (let i = 0; i < IDS.length; i++) {
      const a = drivers[ri(0, 4)];
      let b = drivers[ri(0, 4)];
      if (b[0] === a[0]) b = drivers[(drivers.indexOf(a) + 1) % drivers.length];
      const top = JSON.stringify([a, b].map(([key, label]) => ({ key, label, explanation: `${label} trending up`, trend: "up", weight: 0.3 })));
      await pool.query(
        `INSERT INTO burnout_scores (user_id,score,trajectory,confidence,top_drivers,rolling_window_days,computed_date,check_in_count,data_source_count)
         VALUES ($1,$2,$3,$4,$5::jsonb,30, NOW() - make_interval(days => $6), $7,1)`,
        [IDS[i], plan[i], trajs[ri(0, 3)], ch(0.6) ? "high" : "medium", top, ri(1, 6), ri(6, 10)]
      );
    }

    console.log(`[startup-migration] wwi-demo: seeded 12 users, ${ci} check-ins, ${bm} body-map logs, 12 burnout scores`);
  } catch (e: any) {
    console.error("[startup-migration] wwi-demo failed:", e?.message || e);
  }
}
