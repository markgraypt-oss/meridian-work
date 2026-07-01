import { db } from "../server/db";
import { exerciseLibrary } from "../shared/schema";
const STOP = new Set(["w","with","to","the","a","an","of","and","on","for","&"]);
const norm = (s:string)=> s.toLowerCase().replace(/[^a-z0-9]+/g," ").trim().split(/\s+/).filter(t=>t&&!STOP.has(t)).sort().join(" ");
async function main(){
  const rows:any[] = await db.select().from(exerciseLibrary);
  const maxT = Math.max(...rows.map(r=> new Date(r.createdAt).getTime()));
  const cutoff = maxT - 6*3600*1000;
  const recent = (r:any)=> new Date(r.createdAt).getTime() > cutoff;
  const oldKeys = new Set(rows.filter(r=>!recent(r)).map(r=>norm(r.name)));
  const stray = rows.filter(r=>recent(r) && !oldKeys.has(norm(r.name)));
  console.log("Added today with NO older match:", stray.length);
  stray.slice(0,80).forEach(r=>console.log(" -", r.name));
  process.exit(0);
}
main().catch(e=>{console.error(e);process.exit(1);});
