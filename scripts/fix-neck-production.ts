import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  const result = await pool.query(`
    WITH new_area AS (
      INSERT INTO body_map_areas (name, display_name, category, order_index, is_active, created_at, updated_at)
      VALUES ('neck', 'Neck', 'upper_body', 1, true, NOW(), NOW())
      RETURNING id
    )
    UPDATE body_map_outcomes
    SET body_area_id = new_area.id
    FROM new_area
    WHERE body_map_outcomes.name IN ('neck_keep_moving', 'neck_modify', 'neck_seek_assessment')
    RETURNING body_map_outcomes.name, body_map_outcomes.body_area_id
  `);
  console.log("Fixed outcomes:");
  result.rows.forEach((r: any) => console.log(" ", r.name, "-> body_area_id:", r.body_area_id));
  await pool.end();
}
run().catch(err => { console.error("Error:", err.message); process.exit(1); });
