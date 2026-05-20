import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

async function main() {
  const prodUrl = process.env.NEON_DATABASE_URL!;
  const pool = new Pool({ connectionString: prodUrl });
  const client = await pool.connect();
  
  try {
    const r1 = await client.query('SELECT COUNT(*) as cnt FROM badges');
    console.log("Total badges:", r1.rows[0].cnt);
    
    const r2 = await client.query('SELECT COUNT(*) as cnt FROM user_badges');
    console.log("Total user_badges:", r2.rows[0].cnt);
    
    const r3 = await client.query('SELECT COUNT(*) as cnt FROM user_badges WHERE user_id = $1', ['d6932281-15e3-4266-851c-5c8e9b12268c']);
    console.log("User badges:", r3.rows[0].cnt);
    
    const r4 = await client.query('SELECT * FROM user_badges LIMIT 3');
    console.log("Sample user_badges:", JSON.stringify(r4.rows, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
