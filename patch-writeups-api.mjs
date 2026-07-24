import {promises as fs} from 'node:fs';
import path from 'node:path';
const ROOT=process.cwd();
const SKIP=new Set(['node_modules','.git','dist','build','.next','.expo','.turbo','coverage','.cache','tmp']);
async function walk(d,o=[]){let e;try{e=await fs.readdir(d,{withFileTypes:true})}catch{return o}for(const x of e){if(x.name.startsWith('.bak'))continue;const f=path.join(d,x.name);if(x.isDirectory()){if(SKIP.has(x.name))continue;await walk(f,o)}else if(x.isFile()&&x.name.endsWith('.ts'))o.push(f)}return o}
async function backup(f){const b=f+'.bak-writeups';try{await fs.access(b)}catch{await fs.copyFile(f,b)}}
const lw=l=>(l.match(/^(\s*)/)||['',''])[1];
async function patchSchema(f){
 const lines=(await fs.readFile(f,'utf8')).split('\n');
 const s=lines.findIndex(l=>/learnContentLibrary\s*=\s*pgTable\(\s*["']learn_content_library["']/.test(l));
 if(s===-1)return'no-table';
 let e=-1;for(let i=s;i<lines.length;i++){if(/^\s*\}\);\s*$/.test(lines[i])){e=i;break}}
 if(e===-1)return'no-end';
 if(/summary:\s*text\(\s*["']summary["']/.test(lines.slice(s,e+1).join('\n')))return'already';
 let a=-1;for(let i=s;i<=e;i++){if(/tags:\s*text\(\s*["']tags["']\s*\)\.array\(\)/.test(lines[i])){a=i;break}}
 const ind=a!==-1?lw(lines[a]):lw(lines[s+1]||'  ');
 const ins=[ind+'summary: text("summary"),',ind+'keyTakeaways: text("key_takeaways").array(),',ind+'transcript: text("transcript"),'];
 if(a!==-1)lines.splice(a+1,0,...ins);else lines.splice(e,0,...ins);
 await backup(f);await fs.writeFile(f,lines.join('\n'));return'patched';
}
async function patchStorage(f){
 const lines=(await fs.readFile(f,'utf8')).split('\n');
 const idxs=[];lines.forEach((l,i)=>{if(/getPathContentFromLibrary\s*\(/.test(l))idxs.push(i)});
 if(!idxs.length)return'no-fn';
 let a=-1;
 for(const idx of idxs){const we=Math.min(lines.length,idx+120);
  if(/keyTakeaways:\s*learnContentLibrary\.keyTakeaways/.test(lines.slice(idx,we).join('\n')))return'already';
  for(let i=idx;i<we;i++){if(/tags:\s*learnContentLibrary\.tags\s*,/.test(lines[i])){a=i;break}}
  if(a!==-1)break;}
 if(a===-1)return'no-anchor';
 const ind=lw(lines[a]);
 const ins=[ind+'summary: learnContentLibrary.summary,',ind+'keyTakeaways: learnContentLibrary.keyTakeaways,',ind+'transcript: learnContentLibrary.transcript,'];
 lines.splice(a+1,0,...ins);
 await backup(f);await fs.writeFile(f,lines.join('\n'));return'patched';
}
const files=await walk(ROOT);const sch=[],sto=[];
for(const f of files){const t=await fs.readFile(f,'utf8');if(/learnContentLibrary\s*=\s*pgTable\(/.test(t))sch.push(f);if(/getPathContentFromLibrary\s*\(/.test(t))sto.push(f);}
console.log('schema files:',sch.map(f=>path.relative(ROOT,f)).join(', ')||'(none)');
console.log('storage files:',sto.map(f=>path.relative(ROOT,f)).join(', ')||'(none)');
let ok=true;
for(const f of sch){const r=await patchSchema(f);console.log((r==='patched'?'  OK patched':r==='already'?'  - already has it':'  ! FAIL '+r),path.relative(ROOT,f));if(r!=='patched'&&r!=='already')ok=false;}
if(!sch.length){console.log('  ! no schema file found');ok=false;}
for(const f of sto){const r=await patchStorage(f);console.log((r==='patched'?'  OK patched':r==='already'?'  - already has it':'  ! FAIL '+r),path.relative(ROOT,f));if(r!=='patched'&&r!=='already')ok=false;}
if(!sto.length){console.log('  ! no storage file found');ok=false;}
console.log(ok?'\nDONE. Now REPUBLISH the Repl so the API reloads the schema.':'\nDONE WITH WARNINGS — check the ! lines above.');
