---
name: Typecheck baseline + zod pairing
description: lib/db, meridian, admin-portal typecheck clean; api-server has pre-existing errors. Critical zod v4 pairing rule.
---
lib/db, meridian, and admin-portal now typecheck cleanly (validation command `typecheck-clean`). `pnpm run typecheck` still fails only from pre-existing api-server errors (mostly TS7030 missing-return in Express handlers in routes.ts), covered by a separate task. Any error in the three clean packages is a new regression.

**Zod pairing rule:** `lib/db/src/schema/schema.ts` imports `z` from `zod/v4` (zod pinned at classic 3.25, which ships the v4 subpath). Therefore:
- drizzle-zod must stay on 0.8.x (expects v4 schemas). Downgrading to 0.7.x flips the errors, it doesn't fix them.
- `@hookform/resolvers` must be v5+ in frontends whose forms use drizzle-zod-derived or v4 schemas; v3 resolvers only accept classic v3 ZodType.
- Forms with `.default()` fields need `useForm<z.input<S>, any, z.output<S>>` under resolvers v5, since input/output types diverge.
- The "never use zod/v4 in server files" gotcha in replit.md applies to api-server source, not lib/db (which bundles fine).

**Also beware:** admin-portal contains near-identical copies of meridian's admin pages — fixes must be applied to both, and a stale `.tsbuildinfo` can mask errors; use `tsc -b --force` / delete `.tsbuildinfo` when results look suspicious.
