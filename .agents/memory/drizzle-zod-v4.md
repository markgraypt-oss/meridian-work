---
name: drizzle-zod requires zod/v4 in lib/db schemas
description: Mixing classic zod with drizzle-zod 0.8 schemas breaks at runtime; array params in raw drizzle SQL expand to tuples
---

## drizzle-zod 0.8 + zod imports
drizzle-zod ^0.8 builds zod **v4** schemas. Any file that calls `.extend()` (or otherwise composes) on a `createInsertSchema(...)` result must import `z` from `"zod/v4"`, not `"zod"` (classic v3). Mixing instances typechecks fine but fails at parse time with `Invalid element at key "...": expected a Zod schema`.
**Why:** insertCompanySchema (and every other `.extend`ed insert schema in lib/db) silently 500'd on save until the import was switched.
**How to apply:** In `lib/db/src/schema/*.ts`, always `import { z } from "zod/v4"`. The old gotcha "esbuild can't resolve zod/v4" no longer holds — the api-server esbuild build resolves it fine now; plain server files can still use `"zod"` for standalone schemas.

## Raw drizzle SQL array parameters (node-postgres)
`sql`col = ANY(${ids}::varchar[])`` expands a JS array into a parenthesised tuple `($1,$2,...)`, which is invalid with `ANY(...)::varchar[]`. Build an explicit array literal instead:
```ts
const idArray = sql`ARRAY[${sql.join(ids.map(i => sql`${i}`), sql`, `)}]::varchar[]`;
... sql`col = ANY(${idArray})`
```
**Why:** the admin company engagement report 500'd on every request after the neon→pg migration.
**How to apply:** audit any `db.execute(sql`...ANY(${array})...`)` when porting code written for @neondatabase/serverless.
