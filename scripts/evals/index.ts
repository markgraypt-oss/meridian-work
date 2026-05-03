/**
 * Eval harness — runs a fixed set of scenarios through aiCall() and writes a
 * pass/fail markdown report under .local/eval-reports/.
 *
 * Usage:
 *   npm run evals               # if the script is wired into package.json
 *   npx tsx scripts/evals/index.ts            # always works
 *   npx tsx scripts/evals/index.ts briefing   # filter by name/feature substring
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { z } from "zod";
import { aiCall } from "../../server/ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface EvalCheck<T = unknown> {
  name: string;
  run: (output: { data: T | null; text: string }) => { pass: boolean; message?: string } | Promise<{ pass: boolean; message?: string }>;
}

export interface EvalScenario<T = unknown> {
  name: string;
  feature: string;
  prompt: string;
  schema?: z.ZodType<T>;
  maxTokens?: number;
  temperature?: number;
  checks: EvalCheck<T>[];
}

interface ScenarioResult {
  scenario: EvalScenario<unknown>;
  passed: boolean;
  validationOutcome: string;
  latencyMs: number;
  totalTokens: number;
  safetyFlags: string[];
  checkResults: { name: string; pass: boolean; message?: string }[];
  error?: string;
  rawSnippet: string;
}

async function loadFixtures(filter?: string): Promise<EvalScenario<unknown>[]> {
  const fixturesDir = path.join(__dirname, "fixtures");
  const files = fs.readdirSync(fixturesDir).filter((f) => f.endsWith(".ts") || f.endsWith(".js"));
  const scenarios: EvalScenario<unknown>[] = [];
  for (const file of files) {
    const url = pathToFileURL(path.join(fixturesDir, file)).href;
    const mod = await import(url);
    const exported = mod.default;
    if (!exported) continue;
    const arr = Array.isArray(exported) ? exported : [exported];
    for (const s of arr as EvalScenario<unknown>[]) {
      if (!filter || s.feature.includes(filter) || s.name.toLowerCase().includes(filter.toLowerCase())) {
        scenarios.push(s);
      }
    }
  }
  return scenarios;
}

async function runScenario(scenario: EvalScenario<unknown>): Promise<ScenarioResult> {
  const result = await aiCall<unknown>({
    feature: scenario.feature,
    prompt: scenario.prompt,
    schema: scenario.schema,
    maxTokens: scenario.maxTokens,
    temperature: scenario.temperature,
    skipLogging: true,
  });

  const checkResults: { name: string; pass: boolean; message?: string }[] = [];
  for (const check of scenario.checks) {
    try {
      const r = await check.run({ data: result.data, text: result.text });
      checkResults.push({ name: check.name, pass: r.pass, message: r.message });
    } catch (err: any) {
      checkResults.push({ name: check.name, pass: false, message: `threw: ${err?.message}` });
    }
  }

  // Schema validation is the bedrock check when a schema was provided.
  const schemaPass = !scenario.schema || result.validationOutcome === "valid" || result.validationOutcome === "repaired";
  const passed = schemaPass && checkResults.every((c) => c.pass) && !result.error;

  return {
    scenario,
    passed,
    validationOutcome: result.validationOutcome,
    latencyMs: result.latencyMs,
    totalTokens: result.tokens.total ?? 0,
    safetyFlags: result.safetyFlags,
    checkResults,
    error: result.error,
    rawSnippet: (result.text || "").slice(0, 240),
  };
}

function renderReport(results: ScenarioResult[]): string {
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  const totalTokens = results.reduce((s, r) => s + r.totalTokens, 0);
  const totalLatency = results.reduce((s, r) => s + r.latencyMs, 0);

  const lines: string[] = [];
  lines.push(`# Eval Report — ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`**Summary:** ${passed}/${total} passed (${failed} failed)`);
  lines.push(`**Total tokens:** ${totalTokens} | **Total latency:** ${totalLatency}ms`);
  lines.push("");
  lines.push("| Scenario | Feature | Result | Schema | Latency | Tokens | Flags |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const r of results) {
    const status = r.passed ? "✅ PASS" : "❌ FAIL";
    const flags = r.safetyFlags.join(",") || "-";
    lines.push(`| ${r.scenario.name} | ${r.scenario.feature} | ${status} | ${r.validationOutcome} | ${r.latencyMs}ms | ${r.totalTokens} | ${flags} |`);
  }
  lines.push("");

  for (const r of results) {
    lines.push(`## ${r.passed ? "✅" : "❌"} ${r.scenario.name} (${r.scenario.feature})`);
    if (r.error) lines.push(`- **Error:** ${r.error}`);
    lines.push(`- **Validation:** ${r.validationOutcome}`);
    lines.push(`- **Latency:** ${r.latencyMs}ms, **Tokens:** ${r.totalTokens}`);
    if (r.safetyFlags.length) lines.push(`- **Safety flags:** ${r.safetyFlags.join(", ")}`);
    lines.push("- **Checks:**");
    for (const c of r.checkResults) {
      lines.push(`  - ${c.pass ? "✅" : "❌"} ${c.name}${c.message ? ` — ${c.message}` : ""}`);
    }
    if (r.rawSnippet) {
      lines.push("- **Output (truncated):**");
      lines.push("  ```");
      lines.push(`  ${r.rawSnippet.replace(/\n/g, "\n  ")}`);
      lines.push("  ```");
    }
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  const filter = process.argv[2];
  console.log(`[evals] Loading fixtures${filter ? ` (filter: ${filter})` : ""}...`);
  const scenarios = await loadFixtures(filter);
  if (scenarios.length === 0) {
    console.error("[evals] No fixtures matched.");
    process.exit(1);
  }

  console.log(`[evals] Running ${scenarios.length} scenario(s)...`);
  const results: ScenarioResult[] = [];
  for (const scenario of scenarios) {
    process.stdout.write(`  - ${scenario.name} ... `);
    try {
      const r = await runScenario(scenario);
      results.push(r);
      console.log(r.passed ? "PASS" : "FAIL");
    } catch (err: any) {
      console.log(`ERROR: ${err?.message}`);
      results.push({
        scenario,
        passed: false,
        validationOutcome: "error",
        latencyMs: 0,
        totalTokens: 0,
        safetyFlags: [],
        checkResults: [],
        error: err?.message,
        rawSnippet: "",
      });
    }
  }

  const reportDir = path.resolve(__dirname, "../../.local/eval-reports");
  fs.mkdirSync(reportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(reportDir, `eval-${stamp}.md`);
  fs.writeFileSync(reportPath, renderReport(results), "utf-8");

  const passed = results.filter((r) => r.passed).length;
  console.log(`\n[evals] ${passed}/${results.length} passed`);
  console.log(`[evals] Report: ${reportPath}`);

  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error("[evals] Fatal:", err);
  process.exit(1);
});
