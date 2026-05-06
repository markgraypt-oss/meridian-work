# Meridian Work

Meridian Work is a corporate wellness intelligence platform optimizing health, managing injuries, and enhancing performance for busy executives.

## Run & Operate
- **Run**: `npm run dev`
- **Build**: `npm run build`
- **Typecheck**: `npm run typecheck`
- **Codegen**: `npm run codegen`
- **DB Push**: `npm run db:push` (schema in `shared/schema.ts` is source of truth, no migration files)
- **Required Env Vars**: `OURA_CLIENT_ID/SECRET`, `WHOOP_CLIENT_ID/SECRET`, `GOOGLE_FIT_CLIENT_ID/SECRET`, `WEARABLE_TOKEN_KEY` (or `SESSION_SECRET` as fallback).

## Stack
- **Frontend**: React (Vite), TypeScript, Wouter, TanStack Query, Shadcn/ui (Radix UI), Tailwind CSS
- **Backend**: Express.js, TypeScript, RESTful API
- **Runtime**: Node.js
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL (Neon serverless driver)
- **Validation**: Zod
- **Build Tool**: Vite

## Where things live
- `client/`: Frontend source code
- `server/`: Backend source code
- `shared/`: Shared types and utilities, including `schema.ts` (DB schema source of truth)
- `server/ai/`: AI core logic and `README.md` for full migration guide
- `server/aiProvider.ts`: AI abstraction layer
- `server/wearables/`: Wearables integration logic
- `scripts/`: Utility scripts (e.g., `drizzle-push.py`, `evals/`)
- `.local/eval-reports/`: AI evaluation reports

## Architecture decisions
- **DB Schema Management**: Drizzle-kit `db:push` is the source of truth; direct schema push, no committed migration files. Manual resolution for destructive diffs or renames.
- **AI Architecture**: Model-agnostic abstraction layer (`server/aiProvider.ts`) with configurable providers, layered coaching context, and comprehensive guardrails (PII redaction, token/prompt caps, Zod validation, safety filters, persistent logging).
- **Program Enrollment Snapshot Isolation**: Ensures administrative changes to program templates do not impact currently enrolled user programs.
- **Wearables Integration**: OAuth-based (Oura, WHOOP, Google Fit) and upload-based (Apple Health) with encrypted token storage, prioritized data fetching, and hourly re-syncs.
- **Cross-Coaching Awareness**: All AI coaches share context (recent interactions, advice, user feedback, main conversation history) for a unified coaching experience.

## Product
- Personalized training, educational content, nutrition guidance, and injury tracking.
- Interactive body diagrams and severity sliders for pain/injury assessment.
- Automated recovery plan generation and AI coaching.
- Private video hosting.
- Admin panel for content management and company administration.
- Anonymous aggregate wellness reporting for companies.
- Comprehensive progress tracking with data visualization.
- Smart goal tracking and habit management.
- User onboarding flow with movement screening and AI recommendations.
- AI-powered coaching features: Recovery Coach, Workout Coach, Check-in Insights, and a central AI Coach Chat with full platform content knowledge.

## User preferences
Preferred communication style: Simple, everyday language.

## Gotchas
- **Drizzle DB Push**: If `npm run db:push` prompts for renames, truncations, or "data-loss" warnings, resolve them manually before merging. Do not work around with raw SQL unless it's a one-shot data migration.
- **Exercise PRs Eligibility**: Exercises with `exercise_type = 'general'` or `movement` array containing `Mobility`, `Static Stretches`, or `Cardio` are excluded from PR tracking surfaces. This filter is applied server-side and must be mirrored on mobile.
- **AI Reporting**: Anonymous company reporting requires a minimum of 5 non-admin users to generate valid data.

## Pointers
- **AI Migration Guide**: `server/ai/README.md`
- **Drizzle ORM Documentation**: _Populate as you build_
- **React Documentation**: _Populate as you build_
- **Tailwind CSS Documentation**: _Populate as you build_
- **Replit Auth Documentation**: _Populate as you build_