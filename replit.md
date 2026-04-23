# Meridian Work

## Overview
Meridian Work is a corporate wellness intelligence platform designed to optimize health, manage injuries, and enhance performance for busy executives. It provides personalized training, educational content, nutrition guidance, and injury tracking, leveraging data-driven insights. The platform aims to deliver comprehensive tools for peak performance and pain/injury management through data-driven executive health optimization.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Frameworks**: React with TypeScript (Vite), Wouter for routing.
- **State Management**: TanStack Query for server state, React hooks for local state.
- **UI/Styling**: Shadcn/ui (Radix UI) with Tailwind CSS, dark theme (charcoal, blue accent `#09b5f9`). Features custom interactive body diagrams and severity sliders.
- **Form Handling**: React Hook Form with Zod validation.
- **Navigation**: Mobile-first floating dock bottom navigation (Home, Movement, Recovery, Perform), fixed top header with sticky fade. AI Coach floating circular button opens bottom sheet chat panel. Movement page uses horizontally scrollable tab bar (My Programme, Programmes, Workouts, Body Map, Exercise Library) with blue underline active indicator and scroll arrow hint.
- **Data Visualization**: Recharts for progress charts.

### Backend
- **Framework**: Express.js with TypeScript, RESTful API.
- **Session Management**: Express-session with PostgreSQL store.
- **File Upload**: Multer for local video storage.

### Database
- **ORM & Database**: Drizzle ORM with PostgreSQL.
- **Schema Design**: Relational schema for users, exercise library, programs, workouts, videos, recipes, body map logs, injury tracking, check-ins, user progress, and learning paths.
- **Migration Strategy**: Drizzle-kit.

### Authentication & Authorization
- **Provider**: Replit Auth (OpenID Connect).
- **Strategy**: Passport.js with custom OIDC.
- **Session Handling**: Server-side sessions in PostgreSQL using secure, HTTP-only cookies.
- **Authorization**: Route-level protection via `isAuthenticated` middleware.

### Key Design Decisions
- **Exercise & Workout Display**: Standardized exercise card format; consistent workout detail block layout with circular set number badges. Circuit workouts have a distinct blue banner layout.
- **Exercise PRs eligibility (Mark's rule)**: The Exercise PRs page (`/progress/exercise-prs-list`) and any future PR-tracking surface MUST exclude exercises with `exercise_type = 'general'` AND any exercise whose `movement` array contains `Mobility`, `Static Stretches`, or `Cardio` (case-insensitive). Filter is applied server-side in `server/routes.ts` `/api/progress/exercise-prs-list`. Mobile port must apply the same exclusion. Note: schema field is `movement` (text array on `exercise_library`), referred to in admin UI as "Movement Type".
- **Perform Section**: Unified hub for nutrition, goals/habits, and hydration tracking.
- **Body Map System**: Interactive pain/injury assessment with conditional branching, automated recovery plan generation, and an outcomes-based decision framework.
- **Recovery Plan System**: Automated generation of personalized recovery plans based on body map assessments.
- **Video Platform**: Private video hosting with local storage and integrated player.
- **Content Management**: Admin panel for CRUD operations across content types (exercise library, multi-week programs, workout scheduling).
- **Program Enrollment Snapshot Isolation**: Ensures admin edits to templates do not affect active user programs.
- **Post-Enrollment Body Map Safety Check**: Modal for suggesting exercise substitutions based on active Body Map issues.
- **Workout Types**: Supports Regular, Interval, Circuit, and Video workouts, including specialized stretching and corrective routines.
- **Progress Page System**: Centralized hub for tracking workouts, PRs, bodyweight, measurements, pictures, sleep, steps, and burnout with data visualization via Recharts.
- **Enhanced Food Tracking**: Comprehensive meal logging with macro auto-calculation, quick add, history, and saved meals/recipes.
- **Smart Daily Tiles**: Homepage section with modular tiles for daily tasks.
- **Company Management System**: Admin section for managing companies (CRUD), assigning users to companies, and managing company benefits (physio, therapy, EAP, mental health, fitness, nutrition). Benefits auto-display to company users in burnout "Your Company Support" section. Companies have: name, industry, plan/rate, primary contact, join date, reporting date, max users, status (active/inactive). Users linked via `companyId` foreign key.
- **Anonymous Company Reporting**: Wellness intelligence engine for aggregate reporting (averages, trends, risk signals, participation, musculoskeletal pain, burnout index) from daily check-in, body map, and burnout score data. Burnout section includes avg score, risk band distribution, trajectory breakdown, top drivers, period-over-period trends, and confidence indicator (coverage + avg assessments per user). MSK pain section includes period-over-period trend indicators on pain%, severity, and individual body areas. Participation section includes quality flag (High/Medium/Low) with amber notice when below 60%. Risk signals section followed by contextual recommended actions. Protective behaviours section includes weighted composite score (exercise 30%, emotional stability 30%, mindfulness 25%, low caffeine 15%) with progress bar. All new data included in Excel/HTML export. Requires a minimum of 5 non-admin users. Admin-only access.
- **Mindfulness Tools System**: Recovery section feature with three sub-features: (1) Guided Meditations — category-filtered meditation cards, dedicated player page with circular progress timer, complete/finish button, session logging, streak tracking via `meditation_session_logs` table. (2) Gratitude Journal — daily prompts, persistent entries via `gratitude_entries` table, date-based navigation for viewing past entries. (3) Soundscapes — ambient sound selection (placeholder). Recovery page card uses rotating feature preview with swipe navigation.
- **Mobile-First Design**: Responsive and touch-friendly dark theme.
- **Model-Agnostic AI Architecture**: AI features use an abstraction layer (`server/aiProvider.ts`) supporting multiple providers (Anthropic Claude, OpenAI GPT) configurable per-feature via admin settings. Includes a layered coaching context system.
- **AI Recovery Coach**: Assessment-specific AI coaching on body map results page with contextual suggestion chips. Feedback system (thumbs up/down) for AI responses.
- **AI Workout Coach**: Pre-workout readiness assessment (score/10 with status), exercise substitution suggestions based on body map pain areas, and post-workout feedback. Collapsible card on workout detail page with 3 contextual chips and thumbs up/down feedback.
- **AI Check-in Insights (Wellness Insights)**: Trend analysis across mood/energy/stress/sleep/clarity, cross-data correlations (habits vs. how you feel), and personalised improvement recommendations (quick wins, habit changes, long-term). Collapsible card on check-in page with 3 contextual chips and thumbs up/down feedback.
- **AI Feedback System**: Thumbs up/down rating for all AI responses, saved to `ai_feedback` table. Admin review section available.
- **AI Coach Chat**: Floating coach button opens a bottom sheet chat drawer. Provides personalized health/training advice using coaching identity, rules, user health data, and conversation history. Contextual prompt chips based on user data. Has full knowledge of ALL platform content (programmes, workouts, exercises, recipes, videos, learning paths) and can recommend specific items by name with personalised reasoning.
- **Cross-Coaching Awareness System**: All AI coaches (Main Coach, Workout Coach, Check-in Insights, Recovery Coach) share context via `getCrossCoachContext()` in `server/aiProvider.ts`. Each coach sees recent interactions, advice, and user feedback (thumbs up/down) from other coaching features, plus recent main coach conversation history. This creates a unified coaching experience where coaches build on each other's advice and adapt based on user feedback.
- **AI User Data Context System**: `getUserDataContext(userId, feature)` fetches and formats relevant user health data for each AI feature based on predefined data domains (e.g., body map, workout logs, check-ins, sleep, stress).
- **User Onboarding System**: Optional 6-phase onboarding flow for new users covering safety, profile, coaching intake (10 questions + movement screening), AI recommendations, integrations, and preferences. Progress is saved per-step. Admin users bypass.
- **Movement Screening System**: 8 yes/no questions in onboarding (2 screens: lower body/spine + upper body/stability) with optional notes. Each "yes" maps to exercise filter combinations (movement pattern + equipment + difficulty level) stored in `users.movementScreeningFlags` jsonb. Flags penalise matching programmes in rule-based scoring and are included in AI recommendation prompts. All AI coaches (via `getUserDataContext`) receive movement screening context for body_map or programs domains. Flag mapping defined in `MOVEMENT_SCREENING_FLAG_MAP` in `server/routes.ts`.
- **Programme Library Structure**: Two-tier filtering system. **Categories** (primary navigation tabs): All Programmes, Gym, Home, Great for Travel, Female Specific — stored in `programs.category` text array column (`gym`, `home`, `travel`, `female_specific`). **Tags** (secondary filter chips): Beginner, Intermediate, Advanced, Full Body, Upper Body, Lower Body, Time Efficient, Free Weights Only, Cardio — stored in `programs.tags` text array. Goals (power, max_strength, conditioning, etc.) remain unchanged with existing rules for corrective/mobility/yoga programme types.
- **Equipment Auto-Detection System**: Programme equipment level is automatically determined by scanning all exercises in the programme's workouts (`server/equipmentDetection.ts`). Uses a "highest wins" tier hierarchy: No Equipment (tier 1) < Bodyweight/TRX/Box/Step/Swiss Ball (tier 2) < Bands Only (tier 3) < Kettlebell Only (tier 4) < Dumbbell Only (tier 5) < DB/Bench Only (tier 6) < Full Gym/Cable/Barbell/EZ Bar/Landmine/Medicine Ball/Bosu Ball (tier 7). Ignored items: Foam Roller, Lacrosse Ball, Plate. Auto-recalculates on every exercise batch save. Equipment filter available in "View All" programmes section. Values: `no_equipment`, `bodyweight`, `bands_only`, `kettlebell_only`, `dumbbell_only`, `db_bench_only`, `full_gym`.
- **Smart Goal Tracking System**: Template goals (created via Goal Templates) store a `templateId` in the `goals` table. Auto-tracked templates (`36-workouts-90-days`, `30-day-checkin-streak`, `track-meals-4-weeks`, `protein-30-days`, `all-habits-14-days`) pull live progress from the database via `GET /api/goals/:id/progress`. Habit-linked templates (`30-day-alcohol-free`, `30-day-stretch`, `consistent-wake-time-30-days`) read the companion habit's `currentStreak`. The `walk-450k-steps` goal supports two tracking modes via the `trackingMode` column: `"habit"` (default, 45-day streak from companion habit) or `"cumulative"` (sums total steps from `step_entries` table between start and end dates, target 450,000). Milestone templates are manual. GoalCard shows a live progress bar and counter for template goals; cumulative step goals format numbers with `toLocaleString()`. Template data lives in `client/src/pages/goals-habit-data.tsx`; the detail page (`goals-habit-detail.tsx`) prompts to add the companion habit after creating a habit-linked goal, or goes straight to goals page for cumulative mode.
- **Recommendation Feedback Loop**: Tracks all recommendation outcomes (recommended, enrolled, skipped, abandoned, completed) via `recommendation_events` table. Aggregates success metrics by programme and user profile bucket (environment + experience level). Feeds completion rates into both rule-based scoring (+8 for high completion, -3 for low) and AI prompt context. All AI coaches receive user adherence history (completed vs abandoned count, adherence rate) via `getUserDataContext`. Requires minimum 3 samples before influencing recommendations. Frontend logs skip events from onboarding.

## External Dependencies

### Core Infrastructure
- **PostgreSQL Database**: Accessed via Neon serverless driver.
- **Drizzle ORM**: Type-safe database interactions.

### Authentication
- **Passport.js**: Session-based authentication middleware.

### Frontend Libraries
- **React**: UI framework.
- **TanStack Query**: Data fetching and caching.
- **Wouter**: Client-side routing.
- **React Hook Form**: Form management.
- **Zod**: Schema validation.
- **Shadcn/ui & Radix UI**: UI component libraries.
- **Tailwind CSS**: Utility-first CSS framework.
- **date-fns**: Date manipulation.
- **Recharts**: Charting library.

### Backend Libraries
- **Express.js**: Web application framework.
- **Multer**: Handling `multipart/form-data`.
- **Express-session**: Session management.
- **connect-pg-simple**: PostgreSQL session store.
- **ws**: WebSocket implementation.