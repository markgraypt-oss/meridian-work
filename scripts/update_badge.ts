import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from "ws";
import { eq, desc, and } from "drizzle-orm";

neonConfig.webSocketConstructor = ws;

// Production DB connection string
const prodUrl = process.env.DATABASE_URL!;

async function main() {
  const pool = new Pool({ connectionString: prodUrl });
  const db = pool;
  const userId = "d6932281-15e3-4266-851c-5c8e9b12268c";
  
  // Find most recent badge for user
  const res = await db.query(`
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
  
  const updateRes = await db.query(`
    UPDATE user_badges SET notified = false WHERE id = $1 RETURNING *
  `, [row.id]);
  
  console.log("\nAFTER:");
  console.log(JSON.stringify(updateRes.rows[0], null, 2));
  
  await pool.end();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
