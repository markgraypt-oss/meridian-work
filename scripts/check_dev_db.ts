import { db } from "../server/db";
import { users, userBadges, badges } from "@shared/schema";
import { eq, count, desc } from "drizzle-orm";

async function main() {
  const userId = "d6932281-15e3-4266-851c-5c8e9b12268c";
  
  const userRes = await db.select().from(users).where(eq(users.id, userId));
  console.log("User exists:", userRes.length > 0 ? "YES" : "NO");
  
  const ubCount = await db.select({ count: count() }).from(userBadges).where(eq(userBadges.userId, userId));
  console.log("User badges count:", ubCount[0].count);
  
  const allUb = await db.select().from(userBadges).where(eq(userBadges.userId, userId)).orderBy(desc(userBadges.earnedAt)).limit(3);
  console.log("Recent user badges:", JSON.stringify(allUb, null, 2));
  
  const totalBadges = await db.select({ count: count() }).from(badges);
  console.log("Total badges in DB:", totalBadges[0].count);
  
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
