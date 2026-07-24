---
name: Meridian port gotchas
description: Fixes applied when porting Meridian from migration-backup to pnpm workspace
---

## Key fixes applied

**Why:** These are non-obvious issues that would recur if code is copied from .migration-backup again.

### 1. `zod/v4` not resolvable by esbuild
Use `from 'zod'` not `from 'zod/v4'` in all server files. esbuild cannot resolve the `zod/v4` subpath even with zod ^3.25.x installed. Fix: `find src/ -name "*.ts" -exec sed -i "s/from ['\"]zod\/v4['\"]/from 'zod'/g" {} +`

### 2. Express 5 wildcard route syntax
`app.get('/objects/:param(*)', ...)` → `app.get('/objects/*param', ...)`. Express 4 `/:param(*)` syntax throws an unhandled rejection in Express 5 at startup.

### 3. `@neondatabase/serverless` → standard `pg`
The copied db.ts used neon serverless. Replace with `import { Pool } from 'pg'` and `drizzle(pool, { schema })` (node-postgres style).

### 4. Dynamic imports in routes.ts needed `../` prefix
routes.ts lives in `src/routes/` but was copied from `server/` where `./ai` etc. were siblings. Static imports were fixed by copy script but dynamic `await import('./ai')` needed manual fix to `await import('../ai')`.

### 5. `@shared/` vite alias for frontend
Create `artifacts/meridian/src/shared/` with:
- `schema.ts` — re-exports from `../../../../lib/db/src/schema/schema` and models (NOT from @workspace/db index which has the pg connection)
- `bodyMapDefaults.ts` and `weightLossCalculator.ts` — copied from `.migration-backup/shared/`
Add vite alias: `"@shared": path.resolve(import.meta.dirname, "src", "shared")`

### 6. DB push command
`cd lib/db && npx drizzle-kit push --config ./drizzle.config.ts --force` — must run directly with npx, not via pnpm script, to pass `--force` without `--` separator issues.

**How to apply:** Any time files are re-copied from .migration-backup, re-apply these fixes.
