import { executeSql } from "@replit/ai";

async function main() {
  const userId = "d6932281-15e3-4266-851c-5c8e9b12268c";
  const r = await executeSql({
    sqlQuery: `
      SELECT ub.id, ub.badge_id, ub.earned_at, ub.notified, b.name, b.description, b.category, b.tier
      FROM user_badges ub
      JOIN badges b ON ub.badge_id = b.id
      WHERE ub.user_id = $1
      ORDER BY ub.earned_at DESC
      LIMIT 1
    `,
    params: [userId],
    environment: "production"
  });
  console.log("RESULT:\n" + r.output);
}
main().catch(console.error);
