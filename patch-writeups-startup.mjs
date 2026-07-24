import {promises as fs} from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const SKIP = new Set(['node_modules','.git','dist','build','.next','.expo','.turbo','coverage','.cache','tmp','.migration-backup']);

async function walk(d,o=[]){let e;try{e=await fs.readdir(d,{withFileTypes:true})}catch{return o}for(const x of e){if(x.name.startsWith('.bak'))continue;const f=path.join(d,x.name);if(x.isDirectory()){if(SKIP.has(x.name))continue;await walk(f,o)}else if(x.isFile()&&x.name.endsWith('.ts'))o.push(f)}return o}
async function backup(f){const b=f+'.bak-writeups2';try{await fs.access(b)}catch{await fs.copyFile(f,b)}}

const FN = `
// ------------------------------------------------------------------------------
// Content write-ups backfill (description + summary + key takeaways +
// transcript for Mux lab videos). The earlier manual run only reached the DEV
// database; this runs on the DEPLOYED server so PRODUCTION gets the data.
// Columns are ensured every boot (cheap, idempotent) so an API that selects
// them never 500s on a DB missing them; the expensive AI backfill runs once
// per database, guarded by a persistent system_flags marker.
// ---------------------------------------------------------------------------
let hasRunWriteupsBackfill = false;
const CONTENT_WRITEUPS_BACKFILL_FLAG = "content_writeups_backfill_v1";

export async function backfillWriteupsOnce(): Promise<void> {
  if (hasRunWriteupsBackfill) return;
  hasRunWriteupsBackfill = true;

  try {
    // Ensure the columns exist EVERY boot so a patched API that selects
    // summary/key_takeaways/transcript never errors on a DB missing them.
    await pool.query(\`ALTER TABLE learn_content_library ADD COLUMN IF NOT EXISTS summary text\`);
    await pool.query(\`ALTER TABLE learn_content_library ADD COLUMN IF NOT EXISTS key_takeaways text[]\`);
    await pool.query(\`ALTER TABLE learn_content_library ADD COLUMN IF NOT EXISTS transcript text\`);

    await pool.query(\`
      CREATE TABLE IF NOT EXISTS system_flags (
        key text PRIMARY KEY,
        created_at timestamp DEFAULT now()
      )
    \`);
    const existing = await pool.query(
      \`SELECT 1 FROM system_flags WHERE key = $1 LIMIT 1\`,
      [CONTENT_WRITEUPS_BACKFILL_FLAG],
    );
    if ((existing.rowCount ?? 0) > 0) return; // already done in this database

    console.log("[startup-migration] content write-ups backfill starting (once per database)...");
    const { runWriteupBackfill } = await import("./contentWriteups");
    const r: any = await runWriteupBackfill({ dryRun: false });
    const wrote = r?.wrote ?? 0;
    const failed = Array.isArray(r?.failed) ? r.failed.length : 0;
    console.log(\`[startup-migration] content write-ups backfill complete: wrote \${wrote}, failed \${failed}\`);

    // Record the flag unless the whole run failed (so a transient outage retries next boot).
    if (failed < wrote + 1) {
      await pool.query(
        \`INSERT INTO system_flags (key) VALUES ($1) ON CONFLICT (key) DO NOTHING\`,
        [CONTENT_WRITEUPS_BACKFILL_FLAG],
      );
    }
  } catch (e: any) {
    console.error("[startup-migration] content write-ups backfill failed:", e?.message || e);
  }
}
`;

const CALL = `    // Content write-ups backfill: description + summary/takeaways/transcript for
    // Mux lab videos, once per database (production included). Ensures the columns
    // exist so the patched API never errors, then populates them via AI.
    import("./startupMigrations").then(({ backfillWriteupsOnce }) => {
      backfillWriteupsOnce().catch((e) => {
        console.error("[startup-migration] content write-ups backfill failed:", e);
      });
    }).catch((e) => console.error("[startup-migration] content write-ups import failed:", e));
`;

async function patchStartup(f){
  let src = await fs.readFile(f,'utf8');
  if (src.includes('backfillWriteupsOnce')) return 'already';
  if (!/export\s+async\s+function\s+backfillContentTagsOnce/.test(src)) return 'no-marker';
  src = src.replace(/\s*$/,'') + '\n' + FN + '\n';
  await backup(f); await fs.writeFile(f, src); return 'patched';
}

async function patchIndex(f){
  const src = await fs.readFile(f,'utf8');
  if (src.includes('backfillWriteupsOnce')) return 'already';
  const lines = src.split('\n');
  const anchor = lines.findIndex(l => /import\(\s*["']\.\/aiGeneratorMigration["']\s*\)/.test(l));
  if (anchor === -1) return 'no-anchor';
  lines.splice(anchor, 0, CALL.replace(/\n$/,''));
  await backup(f); await fs.writeFile(f, lines.join('\n')); return 'patched';
}

const files = await walk(ROOT);
const starts=[], indexes=[];
for (const f of files){
  const t = await fs.readFile(f,'utf8');
  if (/export\s+async\s+function\s+backfillContentTagsOnce/.test(t)) starts.push(f);
  if (/import\(\s*["']\.\/aiGeneratorMigration["']\s*\)/.test(t) && /runSchemaSelfHealOnce/.test(t)) indexes.push(f);
}
console.log('startupMigrations file(s):', starts.map(f=>path.relative(ROOT,f)).join(', ')||'(none)');
console.log('index file(s):', indexes.map(f=>path.relative(ROOT,f)).join(', ')||'(none)');
let ok=true;
for (const f of starts){ const r=await patchStartup(f); console.log((r==='patched'?'  OK added backfillWriteupsOnce to':r==='already'?'  - already present in':'  ! FAIL '+r),path.relative(ROOT,f)); if(r!=='patched'&&r!=='already')ok=false; }
if(!starts.length){console.log('  ! no startupMigrations file found');ok=false;}
for (const f of indexes){ const r=await patchIndex(f); console.log((r==='patched'?'  OK wired the call into':r==='already'?'  - already wired in':'  ! FAIL '+r),path.relative(ROOT,f)); if(r!=='patched'&&r!=='already')ok=false; }
if(!indexes.length){console.log('  ! no index/startup-chain file found');ok=false;}
console.log(ok ? '\nDONE. Now REDEPLOY the Repl — it runs on production boot and fills the descriptions.' : '\nDONE WITH WARNINGS — check the ! lines above.');
