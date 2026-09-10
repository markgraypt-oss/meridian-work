#!/usr/bin/env node
/**
 * Apply the app's schema self-heal to whatever DATABASE_URL points at.
 *
 * WHY THIS EXISTS. The self-heal DDL normally runs when the SERVER BOOTS. That
 * is fine for production, which reboots on every Republish, but the Replit
 * workspace's development database only catches up when the dev server happens
 * to restart. Replit's publish step compares dev against production and
 * generates SQL to make production match dev — so a dev database that has not
 * caught up makes production look like it has columns that "should not exist",
 * and the migration it offers you is a DROP.
 *
 * That is how a warning offering to delete primary_muscle from 1014 exercises
 * appeared for a column that was correctly declared in the schema and present in
 * both databases minutes later.
 *
 * So: run this after pulling and BEFORE republishing. It is additive only —
 * every statement is IF NOT EXISTS — so it can never remove anything, and it is
 * safe to run as many times as you like.
 *
 *   pnpm db:sync
 */
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(here, "..", "artifacts", "api-server", "src", "startupMigrations.ts");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run this in the Repl Shell.");
  process.exit(1);
}

// Read the statements straight out of the TypeScript source rather than
// importing it, so this needs no build step and cannot drift from what the
// server actually runs.
const text = readFileSync(source, "utf8");
const start = text.indexOf("export const SELF_HEAL_DDL: string[] = [");
if (start === -1) {
  console.error("Could not find SELF_HEAL_DDL in startupMigrations.ts");
  process.exit(1);
}
const end = text.indexOf("\n];", start);
const body = text.slice(text.indexOf("[", start) + 1, end);

// Statements are backtick template literals, one per entry.
const statements = [...body.matchAll(/`([\s\S]*?)`/g)]
  .map((m) => m[1].trim())
  .filter(Boolean);

if (statements.length === 0) {
  console.error("No statements parsed — aborting rather than guessing.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

let ok = 0;
let skipped = 0;
const failures = [];

for (const sql of statements) {
  // Refuse anything that could destroy schema or data, even if it gets added to
  // the list by mistake. This script exists to prevent data loss, not enable it.
  //
  // The test is deliberately SPECIFIC. A blunt /DROP|DELETE/ match flags 18 of
  // the 108 statements here, and every one of those is harmless: 13 are
  // `ON DELETE CASCADE` clauses inside CREATE TABLE, and 2 are `DROP NOT NULL`,
  // which relaxes a constraint rather than removing anything.
  if (/\bDROP\s+(COLUMN|TABLE|DATABASE|SCHEMA)\b/i.test(sql) || /\bTRUNCATE\b/i.test(sql)) {
    console.warn(`REFUSED (destructive): ${sql.slice(0, 90)}`);
    skipped++;
    continue;
  }

  // Row cleanups (de-duplicating weekly check-ins and wearable connections).
  // Real app behaviour, and the server runs them itself on every boot — but a
  // hand-run sync tool has no business deleting rows, so leave them to it.
  if (/\bDELETE\s+FROM\b/i.test(sql)) {
    console.log(`skipped (row cleanup, runs on server boot): ${sql.split('\n')[0].slice(0, 70)}`);
    skipped++;
    continue;
  }
  try {
    await client.query(sql);
    ok++;
  } catch (e) {
    failures.push({ sql: sql.slice(0, 100), message: e.message });
  }
}

await client.end();

console.log(`\ndb:sync complete — ${ok} applied, ${skipped} skipped, ${failures.length} failed`);
for (const f of failures) console.error(`  FAILED: ${f.sql}\n          ${f.message}`);
process.exit(failures.length > 0 ? 1 : 0);
