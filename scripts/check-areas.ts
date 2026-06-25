import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  const r = await pool.query("SELECT id, name, display_name FROM body_map_areas ORDER BY id");
  r.rows.forEach((x: any) => console.log(x.id, x.name, x.display_name));
  await pool.end();
}
run().catch(err => { console.error("Error:", err.message); process.exit(1); });
