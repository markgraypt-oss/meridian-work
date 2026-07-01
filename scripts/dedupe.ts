import { db } from "../server/db";
import { exerciseLibrary } from "../shared/schema";
import { eq } from "drizzle-orm";
import { writeFileSync, readFileSync } from "fs";
const STOP = new Set(["w","with","to","the","a","an","of","and","on","for","&"]);
const norm = (s:string)=> s.toLowerCase().replace(/[^a-z0-9]+/g," ").trim().split(/\s+/).filter(t=>t&&!STOP.has(t)).sort().join(" ");
const apply = process.argv[2] === "apply";
async function main(){
  const rows:any[] = await db.select().from(exerciseLibrary);
  const maxT = Math.max(...rows.map(r=> new Date(r.createdAt).getTime()));
  const cutoff = maxT - 6*3600*1000;
  const recent = (r:any)=> new Date(r.createdAt).getTime() > cutoff;
  const groups = new Map<string,any[]>();
  for(const r of rows){ const k=norm(r.name); if(!groups.has(k))groups.set(k,[]); groups.get(k)!.push(r); }
  const hasVid = (r:any)=> !!(r.muxPlaybackId || r.imageUrl);
  const coalesce = (a:any,b:any)=> (a!=null && !(Array.isArray(a)&&a.length===0) && a!=="") ? a : b;
  const updates:any[] = []; const deletes:number[] = []; const samples:string[] = [];
  for(const [k,g] of groups){
    if(g.length<2) continue;
    const olds = g.filter(r=>!recent(r)); const news = g.filter(recent);
    if(news.length===0) continue;
    let keeper, donor;
    if(olds.length>0){ keeper = olds.find(hasVid) || olds[0]; donor = news.find(hasVid) || news[0]; deletes.push(...news.map(r=>r.id)); }
    else { keeper = g.find(hasVid) || g[0]; donor = keeper; deletes.push(...g.filter(r=>r.id!==keeper.id).map(r=>r.id)); }
    updates.push({ id: keeper.id, set: {
      instructions: coalesce(keeper.instructions, donor.instructions),
      mainMuscle: coalesce(keeper.mainMuscle, donor.mainMuscle),
      equipment: coalesce(keeper.equipment, donor.equipment),
      movement: coalesce(keeper.movement, donor.movement),
      mechanics: coalesce(keeper.mechanics, donor.mechanics),
      level: coalesce(keeper.level, donor.level),
      exerciseType: coalesce(keeper.exerciseType, donor.exerciseType),
      laterality: coalesce(keeper.laterality, donor.laterality),
    }});
    if(samples.length<30) samples.push(`KEEP "${keeper.name}"  <-  DELETE ${news.filter(r=>r.id!==keeper.id).map(r=>`"${r.name}"`).join(", ")}`);
  }
  console.log("Total rows:", rows.length, "| added today:", rows.filter(recent).length);
  console.log("Duplicate groups:", updates.length, "| rows to delete:", deletes.length);
  console.log("Rows after cleanup:", rows.length - deletes.length);
  console.log("--- sample ---"); samples.forEach(s=>console.log(s));
  writeFileSync("scripts/dedupe-plan.json", JSON.stringify({updates,deletes}));
  if(!apply){ console.log("\nDRY RUN. Nothing changed. Run again with: npx tsx scripts/dedupe.ts apply"); process.exit(0); }
  console.log("\nAPPLYING...");
  for(const u of updates) await db.update(exerciseLibrary).set(u.set).where(eq(exerciseLibrary.id,u.id));
  let del=0, skip=0;
  for(const id of deletes){ try{ await db.delete(exerciseLibrary).where(eq(exerciseLibrary.id,id)); del++; }catch(e){ skip++; } }
  console.log(`Deleted ${del}, skipped ${skip} (in use), updated ${updates.length} keepers.`);
  process.exit(0);
}
main().catch(e=>{console.error(e);process.exit(1);});
