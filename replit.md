# Meridian Work

Corporate wellness intelligence platform — health/fitness app for employees with coaching, training, nutrition, and analytics.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/meridian run dev` — run the frontend (Vite, auto-assigned port)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `cd lib/db && npx drizzle-kit push --config ./drizzle.config.ts --force` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS v3 + wouter (routing) + TanStack Query
- API: Express 5, pino logging
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (server files use `zod` — NOT `zod/v4`)
- Build: esbuild (ESM bundle, ~6.6MB)

## Where things live

- `artifacts/meridian/` — React frontend (previewPath `/`)
- `artifacts/api-server/` — Express 5 API server (port 8080, path prefix `/api`)
- `lib/db/` — shared DB schema + Drizzle ORM (`@workspace/db`)
- `artifacts/api-server/src/routes/routes.ts` — main routes file (~22k lines)
- `artifacts/api-server/src/storage.ts` — data access layer (~13k lines)
- `lib/db/src/schema/schema.ts` — all Drizzle table definitions and Zod schemas
- `artifacts/meridian/src/shared/` — client-side re-exports: `schema.ts` (from lib/db), `bodyMapDefaults.ts`, `weightLossCalculator.ts`

## Architecture decisions

- No OpenAPI spec/codegen — the app uses its own hand-written fetch layer (`artifacts/meridian/src/lib/queryClient.ts`)
- `registerRoutes(app)` in routes.ts creates and returns an HTTP server; `index.ts` uses the returned server to start schedulers
- `@shared/*` Vite alias → `artifacts/meridian/src/shared/` (schema types re-exported from lib/db schema files, NOT the db connection)
- Server uses standard `pg` Pool (not `@neondatabase/serverless`) via `artifacts/api-server/src/db.ts`
- Express 5 wildcard routes must use `/*name` syntax (NOT `/:param(*)` which is Express 4)

## Product

Meridian Work is a corporate wellness platform for employees. Features include: workout tracking, training programs, nutrition/meal planning, habit tracking, breathwork/meditation, body map, goals, coaching AI, weekly check-ins, wearables integration, learning content, and admin tools.

## Gotchas

- **zod imports**: plain server files use `import { z } from 'zod'`. But `lib/db` schema files that `.extend()` drizzle-zod schemas MUST use `import { z } from 'zod/v4'` — drizzle-zod ^0.8 builds zod v4 schemas and mixing classic zod fails at parse time ("expected a Zod schema"). esbuild resolves `zod/v4` fine.
- **Raw drizzle SQL + arrays**: `sql\`ANY(${ids}::varchar[])\`` expands to a tuple under node-postgres and fails; build `ARRAY[...]` via `sql.join` (see engagementEngine.ts).
- **Express 5 wildcard routes**: use `app.get('/path/*name', ...)` not `app.get('/path/:name(*)', ...)`
- **DB push**: run `cd lib/db && npx drizzle-kit push --config ./drizzle.config.ts --force` (not pnpm script, to pass `--force` directly)
- **Dynamic imports in routes.ts** were adjusted from `./file` to `../file` since routes.ts lives in `src/routes/` subdirectory
- **Never use `console.log` in server code** — use `req.log` in route handlers and the singleton `logger` for non-request code

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
