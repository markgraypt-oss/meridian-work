import { db } from "../server/db";
import { exerciseLibrary } from "../shared/schema";

function words(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
}
function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
  return d[m][n];
}

async function main() {
  const rows = await db
    .select({ id: exerciseLibrary.id, name: exerciseLibrary.name, instructions: exerciseLibrary.instructions })
    .from(exerciseLibrary);

  const tag = (r: any) =>
    !r.instructions || String(r.instructions).trim().length === 0 ? "[EMPTY]" : "[ok]";

  // 1. EMPTY DESCRIPTIONS
  const empties = rows.filter((r) => !r.instructions || String(r.instructions).trim().length === 0);
  console.log(`\n===== EMPTY DESCRIPTIONS (${empties.length}) =====`);
  empties.sort((a, b) => a.name.localeCompare(b.name)).forEach((r) => console.log(`  ${r.name}`));

  // 2. NAMES CONTAINING "troep" (almost certainly a Triceps typo)
  const troep = rows.filter((r) => /troep/i.test(r.name));
  console.log(`\n===== NAMES CONTAINING "Troep" (likely Triceps typo) (${troep.length}) =====`);
  troep.sort((a, b) => a.name.localeCompare(b.name)).forEach((r) => console.log(`  ${r.name}  ${tag(r)}`));

  // 3. POTENTIAL DUPLICATE PAIRS
  const seen = new Set<string>();
  const pairs: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const A = rows[i], B = rows[j];
      const wa = new Set(words(A.name)), wb = new Set(words(B.name));
      const ja = [...wa].sort().join(" "), jb = [...wb].sort().join(" ");
      const na = words(A.name).join(" "), nb = words(B.name).join(" ");
      if (na === nb) continue; // identical after normalising, skip (not interesting here)

      let reason = "";
      if (ja === jb) {
        reason = "same words, different order";
      } else {
        const sub = [...wa].every((w) => wb.has(w)) || [...wb].every((w) => wa.has(w));
        const sizeDiff = Math.abs(wa.size - wb.size);
        if (sub && sizeDiff === 1 && Math.min(wa.size, wb.size) >= 3) {
          reason = "one name is the other plus a word";
        } else {
          const d = lev(na, nb);
          const maxlen = Math.max(na.length, nb.length);
          if (d >= 1 && d <= 5 && d / maxlen <= 0.2) reason = "very similar spelling (possible typo)";
        }
      }
      if (!reason) continue;
      const key = [A.id, B.id].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push(`  ${reason}\n     - ${A.name}  ${tag(A)}\n     - ${B.name}  ${tag(B)}`);
    }
  }
  console.log(`\n===== POTENTIAL DUPLICATE PAIRS (${pairs.length}) =====`);
  pairs.forEach((p) => console.log(p));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
