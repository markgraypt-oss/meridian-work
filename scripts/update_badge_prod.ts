import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

async function main() {
  const prodUrl = process.env.NEON_DATABASE_URL!;
  const pool = new Pool({ connectionString: prodUrl });
  const client = await pool.connect();
  const userId = "d6932281-15e3-4266-851c-5c8e9b12268c";
  
  try {
    const res = await client.query(`
      SELECT ub.id, ub.badge_id, ub.earned_at, ub.notified, b.name, b.description, b.category, b.tier
      FROM user_badges ub
      JOIN badges b ON ub.badge_id = b.id
      WHERE ub.user_id = $1
      ORDER BY ub.earned_at DESC
      LIMIT 1
    `, [userId]);
    
    if (res.rows.length === 0) { console.log("No badges found"); process.exit(1); }
    
    const row = res.rows[0];
    console.log("BEFORE:");
    console.log(JSON.stringify(row, null, 2));
    
    const updateRes = await client.query(`
      UPDATE user_badges SET notified = false WHERE id = $1 RETURNING *
    `, [row.id]);
    
    console.log("\nAFTER:");
    console.log(JSON.stringify(updateRes.rows[0], null, 2));
  } finally {
    client.release();
    await pool.end();
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
