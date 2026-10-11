import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@workspace/db";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  // The hosted Postgres closes idle connections server-side. Without an idle
  // timeout the pool hands out already-dead sockets, producing the recurring
  // "Failed query: select/update ..." errors — which, when they landed on the
  // token-save step of a WHOOP refresh, lost the freshly rotated token and got
  // the whole token family revoked. Retire idle clients before the server
  // does, keep TCP keepalives on, and never wait forever for a connection.
  //
  // keepAlive alone is not enough: pg defaults keepAliveInitialDelayMillis to
  // 0, which leaves the OS default idle time (often ~2h) in force, so probes
  // never fire on the 30-60s timescale that matters here. Set it explicitly,
  // and retire idle clients well before any plausible server-side cutoff.
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});
pool.on("error", (err) => {
  // Errors on idle clients would otherwise crash the process.
  console.error("[db] idle pool client error:", err?.message || err);
});
export const db = drizzle(pool, { schema });