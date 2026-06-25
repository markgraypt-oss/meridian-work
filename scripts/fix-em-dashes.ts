import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  const fields = ["whats_going_on","training_guidance","daily_movement","desk_work_tips","things_to_watch","check_in_again","programme_impact_summary","flagging_note","recovery_programme_reason"];
  let total = 0;
  for (const field of fields) {
    const r = await pool.query(
      `UPDATE body_map_outcomes SET ${field} = REPLACE(${field}, '\u2014', '-') WHERE ${field} LIKE '%\u2014%' RETURNING id`
    );
    if (r.rowCount && r.rowCount > 0) {
      console.log(`Fixed ${r.rowCount} rows in ${field}`);
      total += r.rowCount;
    }
  }
  console.log("\nTotal updates: " + total);
  await pool.end();
}
run().catch(err => { console.error("Error:", err.message); process.exit(1); });
