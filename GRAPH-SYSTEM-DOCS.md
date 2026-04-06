# Meridian Work --- Graph System Documentation

## Overview

The progress graphs are built using **Recharts** (a React charting library built on D3) with a unified component at `client/src/pages/progress-metric-detail.tsx`. This single page handles 20+ different health metrics, each with its own data endpoint, chart type, and summary statistics.

---

## Architecture

### Route

```
/my-progress/:metricKey
```

The `metricKey` URL parameter determines which metric is displayed. Examples: `steps`, `bodyWeight`, `sleep`, `bodyFat`, `restingHR`, `caloricIntake`, `hydration`, `neck`, `waist`, etc.

### Configuration

Every metric is defined in a `metricConfigs` array at the top of the file:

```typescript
interface MetricConfig {
  key: MetricKey;       // URL param & internal identifier
  label: string;        // Display name (e.g. "Steps")
  icon: typeof Footprints; // Lucide icon component
  unit: string;         // Unit suffix (e.g. "kg", "bpm", "%", "kcal")
  endpoint: string;     // Backend API endpoint for data
  color: string;        // Chart accent colour (hex)
}
```

Example:
```typescript
{ key: "steps", label: "Steps", icon: Footprints, unit: "", endpoint: "/api/progress/steps", color: "#0cc9a9" }
```

The accent colour across most charts is `#0cc9a9` (teal).

---

## Data Flow

### 1. Backend Endpoints

Each metric has a dedicated REST endpoint:

| Metric | Endpoint | Data Shape |
|--------|----------|------------|
| Steps | `GET /api/progress/steps` | `{ date, steps, goal }` |
| Sleep | `GET /api/progress/sleep` | `{ date, hours, quality }` |
| Body Weight | `GET /api/progress/bodyweight` | `{ date, weight }` |
| Body Fat | `GET /api/progress/body-fat` | `{ date, percentage }` |
| Resting HR | `GET /api/progress/resting-hr` | `{ date, bpm }` |
| Caloric Intake | `GET /api/progress/caloric-intake` | `{ date, calories, protein, carbs, fat, goal, proteinGoal, carbsGoal, fatGoal }` |
| Hydration | `GET /api/hydration/history?days=90` | `{ date, totalMl, goalMl }` |
| Measurements | `GET /api/progress/measurements/:type` | `{ date, value }` |

All endpoints require authentication. Data is stored per-user in the PostgreSQL database.

### 2. Frontend Data Fetching

Data is fetched with TanStack Query (React Query):

```typescript
const { data: entries = [], isLoading } = useQuery({
  queryKey: [config.endpoint],
});
```

### 3. Data Transformation for Charts

Raw entries are filtered by the selected time range, then transformed into chart-ready format:

```typescript
const chartData = [...filteredEntries]
  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  .map(entry => ({
    timestamp: parseISO(entry.date).getTime(),  // Unix ms for time-scale X axis
    value: getValueFromEntry(entry, metricKey),   // Normalised Y value
    fullDate: entry.date,                         // Original date string
  }));
```

The `getValueFromEntry()` function extracts the correct numeric value based on metric type (e.g. `entry.steps` for steps, `entry.weight` for bodyWeight, `entry.hours` for sleep).

---

## Chart Types

There are three distinct chart implementations based on metric type:

### 1. Area Chart (Default --- most metrics)

Used for: steps, sleep, bodyWeight, bodyFat, restingHR, bloodPressure, leanBodyMass, caloricBurn, exerciseMinutes, all body measurements.

Built with Recharts `<AreaChart>`:

```
<ResponsiveContainer width="100%" height={220}>
  <AreaChart data={chartData}>
    <defs>
      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#0cc9a9" stopOpacity={0.3}/>
        <stop offset="95%" stopColor="#0cc9a9" stopOpacity={0}/>
      </linearGradient>
    </defs>
    <XAxis dataKey="timestamp" type="number" domain={chartDomain} ticks={chartTicks} ... />
    <YAxis ... />
    <ReferenceLine y={midVal} />
    <Tooltip content={CustomTooltip} />
    <Area type="monotone" dataKey="value" stroke="#0cc9a9" fill="url(#colorValue)" />
  </AreaChart>
</ResponsiveContainer>
```

Key design choices:
- **X axis uses timestamp (number type)** with `scale="time"` --- this gives a true time-proportional scale rather than evenly-spaced categories
- **Teal gradient fill** fading from 30% opacity at top to 0% at bottom
- **Solid teal stroke** (`#0cc9a9`, 2px)
- **Data dots** shown on 1W, 1M, 3M ranges but hidden on 6M/1Y to avoid clutter
- **Reference line** drawn at the midpoint between min and max values
- **Custom tooltip** with dark background (`#1f1f1f`), teal border, showing date + value

### 2. Bar Chart (Caloric Intake)

Used for: caloricIntake only.

Renders as a `<BarChart>` showing 14 days at a time (2-week sliding window). Has additional sub-charts for protein, carbs, and fat macros. Each bar is colour-coded:
- Green if at/under goal
- Red/orange if over goal
- Goal shown as a dashed `<ReferenceLine>`

Also includes a macro distribution pie chart (`<PieChart>`) showing protein/carbs/fat percentages.

### 3. Bar Chart (Hydration)

Used for: hydration only.

Similar bar chart but shows daily water intake in ml. Goal reference line. Days with data highlighted differently.

---

## Time Range System

Five time ranges, selectable via tabs: `1W | 1M | 3M | 6M | 1Y`

Each range controls:
1. **Date cutoff** --- filters entries to the selected period
2. **X axis ticks** --- generated dynamically based on range
3. **Tick labels** --- formatted differently per range

```typescript
function getDateCutoff(range: TimeRange): Date {
  switch (range) {
    case "1W": return startOfWeek(now);
    case "1M": return subMonths(now, 1);
    case "3M": return subMonths(now, 3);
    case "6M": return subMonths(now, 6);
    case "1Y": return subMonths(now, 12);
  }
}
```

Tick generation:
- **1W**: One tick per day (Mon-Sun labels)
- **1M**: One tick per week (e.g. "06 Mar", "13 Mar")
- **3M**: One tick every 2 weeks
- **6M**: One tick per month
- **1Y**: One tick every 2 months

The 1W range also has **week navigation** (left/right arrows) to step through historical weeks.

---

## Summary Statistics Cards

Below the chart, metric-specific stat cards are shown. Each metric type has its own stats:

### Steps
3 cards: Average, Highest, Lowest (calculated from `filteredEntries` in the selected time range)

### Body Weight
4 cards: Current, Change (vs first entry), Lowest, Highest

### Sleep
3 cards: Average hours, Best night, Worst night

### Other metrics
Typically show Average, Highest, Lowest or Current, Change patterns.

These are rendered as a CSS grid of `<Card>` components with icons, values, and labels.

---

## Entry History List

Below the stats cards, all entries are shown in a scrollable list, grouped by month:

```typescript
const allGroupedByMonth = entries.reduce((acc, entry) => {
  const monthKey = format(parseISO(entry.date), "MMMM yyyy");
  acc[monthKey].push(entry);
  return acc;
}, {});
```

Each month is a collapsible section. Individual entries show the date, value, and a delete button (swipe-to-delete pattern or icon).

---

## Metric Dropdown Switcher

The metric title in the header is tappable --- it opens a dropdown overlay that lets users switch between metrics without going back. Metrics are grouped into categories:

- **Biometrics**: bodyWeight, bodyFat, leanBodyMass, restingHR, bloodPressure, caloricBurn, exerciseMinutes
- **Body Measurements**: neck, chest, shoulder, biceps, forearms, waist, hips, thighs, calves
- **Activity**: steps, sleep, caloricIntake, hydration

Each category is collapsible. The current metric shows a green checkmark.

---

## Add Entry Flow

The `+ Add` button in the header opens an inline form (or redirects to `/my-progress/add` for body metrics). Each metric has a Zod validation schema:

```typescript
const addEntrySchemas: Record<MetricKey, z.ZodObject<any>> = {
  steps: z.object({ date: z.string(), steps: z.coerce.number().min(0) }),
  sleep: z.object({ date: z.string(), hours: z.coerce.number().min(0).max(24) }),
  // ... etc
};
```

On submit, data is POSTed to the metric's endpoint, the query cache is invalidated, and the chart updates automatically.

---

## Dashboard Mini Graphs

The home dashboard (`dashboard-executive.tsx`) shows small sparkline-style graphs in the "My Progress" section. These are handled by `client/src/components/dashboard/MyProgressSection.tsx`.

Each mini graph:
- Fetches the same backend endpoints as the detail page
- Renders a tiny `<AreaChart>` or `<BarChart>` (approx 80px tall)
- Shows only the most recent data points
- Clicking navigates to `/my-progress/:metricKey` for the full detail view

---

## Styling Conventions

| Element | Value |
|---------|-------|
| Chart accent/stroke | `#0cc9a9` (teal) |
| Gradient fill | `#0cc9a9` at 30% opacity, fading to 0% |
| Tooltip background | `#1f1f1f` |
| Tooltip border | `2px solid #0cc9a9` |
| Tooltip value colour | `#0cc9a9` |
| Axis text colour | `#888` |
| Grid lines | `#333` dashed |
| Reference line | `#444` at 40% opacity |
| Card background | Uses `bg-card` (CSS variable, `#141920`) |
| Page background | Uses `bg-background` (CSS variable, `#0e1114`) |

---

## Key Files

| File | Purpose |
|------|---------|
| `client/src/pages/progress-metric-detail.tsx` | Main graph page (2600 lines) |
| `client/src/components/dashboard/MyProgressSection.tsx` | Dashboard mini graphs |
| `server/routes.ts` | All `/api/progress/*` endpoints |
| `server/storage.ts` | Database queries for each metric |
| `shared/schema.ts` | Table definitions for step_entries, sleep_entries, bodyweight_entries, etc. |

---

## Adding a New Metric

1. **Schema**: Add a new table in `shared/schema.ts` (e.g. `vo2MaxEntries`)
2. **Storage**: Add CRUD methods to `IStorage` interface and `DatabaseStorage` class in `server/storage.ts`
3. **Routes**: Add GET/POST/DELETE endpoints in `server/routes.ts`
4. **Config**: Add entry to `metricConfigs` array in `progress-metric-detail.tsx`
5. **Value extractor**: Add case to `getValueFromEntry()` function
6. **Form schema**: Add Zod schema to `addEntrySchemas`
7. **Form fields**: Add form fields in `AddEntryForm` component
8. **Stats cards**: Add stat card rendering block (optional)
9. **Category**: Add to appropriate category in `metricCategories` array
