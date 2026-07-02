# NRCC Power Plant Dashboard — Project Review & Recommendations

*Full assessment of code, schema, live data, and UI — July 2026.*
*Findings marked **[verified]** were reproduced against the live Supabase project or the running app, not just inferred from reading code.*

---

## Progress log

- **✅ Done (2026-07-01):** 5.1, 5.2, 5.3 — security lockdown applied directly to the live Supabase
  project via three migrations (`security_views_use_invoker_rls`, `security_revoke_anon_table_grants`,
  `security_scope_authenticated_policies`). Verified by role-impersonation: `anon` is now denied on all
  5 views + all 5 base tables; `authenticated` still has every read/write path the app actually uses
  (equipment status/remarks update, maintenance task completion update, history insert); DELETE/TRUNCATE
  are now blocked for `authenticated` on all tables. Re-ran the security advisor: all 5 "Security Definer
  View" ERRORs are gone; remaining WARNs are the accepted shared-login trade-off (see below). No app code
  changed — this was DB-only.
  - **Not done (needs Dashboard access, no MCP tool for it):** enabling leaked-password protection
    (Auth setting), and the medium-term "per-user accounts" half of 5.3 (still one shared login, so the
    `USING(true)`/`WITH CHECK(true)` WARNs on INSERT/UPDATE remain — fixing those for real requires
    `auth.uid()`-based ownership, which doesn't exist in this schema yet).

- **✅ Done (2026-07-02):** 1.1, 1.2, 1.3, 2.1, 3.2, 3.4 — verified bug fixes.
  - **1.1** `Maintenance.jsx` no longer writes `next_due_hours`/`next_due_date` (DB-generated columns) in
    the completion update; also surfaces a history-insert failure instead of ignoring it, and fixes the
    related stale-closure bug (1.8) so the detail panel re-selects from the freshly loaded task list.
  - **1.2** `Equipment.jsx` now selects `system_name` (was `name`) — the System filter dropdown is populated.
  - **1.3** Dashboard header date is now derived from the live data (`max(status_as_of)`), not hardcoded;
    also removed a duplicate `useEquipmentStatus()` fetch by lifting it to the parent component.
  - **2.1** DB migration `map_lube_oil_separator_hours_to_engine`: `v_maintenance_due` now maps
    `Lube Oil Separator → Engine` the same way it already did for `Turbocharger`. All 9 previously-"Unknown"
    Lube Oil Separator tasks now resolve correctly.
    - **Caught in verification:** `CREATE OR REPLACE VIEW` silently reset `v_maintenance_due`'s
      `security_invoker` flag from Step 1 back to default. Restored it immediately
      (`restore_security_invoker_after_view_replace`) and re-verified anon-denied/authenticated-OK on all
      5 views before moving on. Worth remembering for any future view migration: `security_invoker` does
      not survive `CREATE OR REPLACE VIEW` and must be re-applied every time.
  - **3.2** Sign-out moved from a floating `position:fixed` button (which sat on top of every detail
    panel's close button) into the sidebar footer next to "Connected".
  - **3.4** Line filter options are now `Line-1 / Line-2 / Common` everywhere (Equipment, Maintenance ×2,
    Data Gaps) — "Black Start" (which matched zero rows) removed, "Common" added where missing.
  - All verified via Playwright against the running app: real DOM options, an actual completion-flow
    round-trip with the network payload captured and asserted (confirms the old bug would have failed the
    same check), and the header date changing when the underlying mock data changes.
  - **Not done:** the field-data collection half of 6.1 (16 tasks still need real baselines from
    logbooks) and 6.2/6.3 (data corrections) — those need the ops team, not just code/schema changes.

- **✅ Done (2026-07-02):** 1.4, 1.11, 2.8/7.2 — foundations.
  - **1.4** Every page now surfaces query failures instead of rendering a silent empty state (worst case
    was Data Gaps: a failed load rendered as "All gaps cleared ✓"). Added a shared `ErrorBanner` component
    and a `refetch()` on the `useQuery` hook; `useQuery` also now catches thrown exceptions, not just
    `{error}` results. Verified across all 5 pages by injecting simulated backend failures for every query
    — each now shows a clear message with a working Retry button.
  - **1.11** Added `.github/workflows/ci.yml`: runs `oxlint` + `vite build` on every PR into `main` (and
    on push to `main`). Vitest/Playwright test suites are still open — this is the "PR gate" half of the
    suggested approach, not full coverage.
  - **2.8 / 7.2** Added `supabase/migrations/20260702000000_baseline_schema.sql`, a hand-reconstructed
    snapshot of the live schema (tables, indexes, RLS policies, views, grants) as of today, since the
    Supabase CLI wasn't available to run a real `db pull`. Validated by applying it inside an isolated
    schema on the live project and rolling back (see `supabase/README.md` for the exact method and the
    caveat that it should still be checked with `supabase db diff` once the CLI is available). Going
    forward, schema changes should be written as new files here instead of ad hoc `apply_migration` calls.
  - **Not done:** 7.3 (error monitoring / Sentry) needs an external account and DSN — no MCP tool can
    create one. Full Vitest/Playwright coverage for 1.11 also remains open.

- **✅ Done (2026-07-02):** 4.5, 7.1 — product.
  - **4.5** Dashboard data (KPIs, equipment grid, overdue panel) now polls every 60s via a
    `refetchInterval` option added to `useQuery`, since it's meant to be left open on a wall display
    rather than manually reloaded. Everything else stays fetch-on-navigate, as before.
  - **7.1** New **Log Readings** page (`/log-readings`, in the nav right after Dashboard): a checklist of
    every hour-tracked item grouped by line, showing each one's previous reading/date for reference, with
    an hours input and a status dropdown per row. Submits all filled rows as a single batch insert into
    `equipment_status_log`. Flags (but doesn't block) a reading that's lower than the previous one, per
    finding 2.3's "warn, don't hard-reject" guidance — meter replacements happen. This was the biggest
    product gap in the review: previously the only way to log a reading was the Supabase SQL console.
    Verified with Playwright: entered readings produce the exact expected batch-insert payload, the
    lower-reading warning fires correctly, and the form clears and shows a success message after submit
    (carrying the just-submitted status forward as the new default for the next round).
  - **Not started:** 1.5/3.1 (token consolidation → theme presets) — this is the largest remaining item
    and involves real design decisions (color values for two new themes), so it's paused for a check-in
    rather than assumed.

---

## Executive summary — start here

The project is in good shape for its age: sensible schema with real constraints and comments, consistent
component-level equipment modeling, decent indexing, working deploy pipeline, and a coherent visual
identity. The highest-value fixes are a handful of verified bugs and one genuine security hole:

| # | Finding | Area | Priority |
|---|---------|------|----------|
| 1 | ✅ *Fixed* — All 5 views are readable by `anon` — the entire dataset is public despite the login page | Security | **High** |
| 2 | ✅ *Fixed* — "Log Completion" on the Maintenance Board always fails (writes to generated DB columns) | Code | **High** |
| 3 | ✅ *Fixed* — Equipment page "System" filter is permanently empty (`select('name')` vs column `system_name`) | Code | **High** |
| 4 | ✅ *Fixed* — 9 Lube Oil Separator tasks stuck in "Unknown" — view doesn't map their hours to the parent engine | Database | **High** |
| 5 | ✅ *Fixed* — Sign-out button overlaps and blocks the close button of every detail panel on 3 pages | UI/UX | **High** |
| 6 | ✅ *Fixed* — Dashboard header date "readings as of 29 Jun 2026" is hardcoded and will silently go stale | Code | **High** |
| 7 | 25 maintenance tasks in "Unknown" state from missing baselines; 5 hour-meter regressions in the log | Data quality | **High** |
| 8 | ✅ *Fixed* — Schema has no committed migration history — the DB is unreproducible from the repo | Other | Medium |
| 9 | Theme: consolidate the two coexisting styling systems first, then yes — offer 2–3 preset themes | UI/UX | Medium |
| 10 | ✅ *Fixed* — No error surfacing anywhere — failed queries render as convincing empty states | Code | Medium |

---

## 1. Code architecture & logic

### 1.1 "Log Completion" is broken — writes to generated columns **[verified]** ✅ Fixed 2026-07-02
- **Area:** Code architecture & logic (also Database)
- **Issue:** `maintenance_status.next_due_hours` and `next_due_date` are **generated (STORED) columns**
  (`last_done_hours + interval_hours` / `last_done_date + interval_days`). `Maintenance.jsx`'s
  `handleLogSave` includes `next_due_hours` (or `next_due_date`) in its `update()` payload. Postgres
  rejects any non-DEFAULT write to a generated column — verified directly: `ERROR 428C9: column
  "next_due_hours" can only be updated to DEFAULT`. Every completion attempt fails; the modal shows a raw
  DB error. The follow-on history insert never runs, which is also why `linked_task_id` is still NULL on
  all 2,065 history rows.
- **Suggested approach:** Stop sending `next_due_*` from the client — update only `last_done_hours` /
  `last_done_date` (+`updated_at`) and let the DB recompute. Keep the modal's "next due will be" text as a
  display-only preview. Also check the history-insert error (currently ignored) and surface it.
- **Effort:** Small
- **Priority:** **High**

### 1.2 Equipment page "System" filter is permanently empty **[verified]** ✅ Fixed 2026-07-02
- **Area:** Code architecture & logic
- **Issue:** `Equipment.jsx` runs `supabase.from('systems').select('name').order('name')`, but the table's
  column is `system_name` (verified against the live schema). The query errors, the error is discarded,
  and the "All Systems" dropdown renders with zero options — silently.
- **Suggested approach:** `select('system_name')` (or alias: `select('name:system_name')`). This bug is a
  poster child for finding 1.4 — with error surfacing it would have been caught on day one.
- **Effort:** Small
- **Priority:** **High**

### 1.3 Hardcoded "readings as of 29 Jun 2026" in the Dashboard header ✅ Fixed 2026-07-02
- **Area:** Code architecture & logic
- **Issue:** The date is a string literal in `Dashboard.jsx`. It happens to match the latest reading today;
  after the next meter reading it will be silently wrong — worse than no date on an ops dashboard.
- **Suggested approach:** Derive from data already fetched: `max(status_as_of)` across
  `v_equipment_current_status` rows (or a tiny `select max(recorded_at) from equipment_status_log` view).
- **Effort:** Small
- **Priority:** **High**

### 1.4 Query errors are swallowed everywhere ✅ Fixed 2026-07-02
- **Area:** Code architecture & logic
- **Issue:** Nearly every fetch destructures only `data` (`const { data } = await supabase...`). RLS
  denials, network failures, and schema mismatches (see 1.2) all render as plausible empty states
  ("No tasks match your filters"). The `useQuery` hook captures `error` but no page consumes it; an
  exception thrown inside a builder leaves `loading` true forever (no `.catch`).
- **Suggested approach:** Add a `.catch` in `useQuery`; render a shared `<ErrorBanner>` when `error` is
  set; distinguish "no rows" from "failed to load" in every empty state.
- **Effort:** Small–Medium
- **Priority:** Medium (High leverage — it converts every future silent bug into a visible one)

### 1.5 Two coexisting design systems
- **Area:** Code architecture & logic (also UI/UX — see 3.1)
- **Issue:** `Dashboard`, `Layout`, `Login`, and `ui.jsx` use the semantic Tailwind tokens defined in
  `tailwind.config.js` (`panel-*`, `ink-*`, `st-*`). `Equipment`, `Maintenance`, `DataGaps`, and
  `MajorMaintenance` use hardcoded GitHub-palette hexes (`#161b22`, `#30363d`, `bg-[#0d1b2a]`) plus raw
  `gray-*`/`red-400`/`amber-400` utilities. Visually close, but they drift (two different reds, two
  different panel greys) and make any theming impossible.
- **Suggested approach:** Migrate the four hex-based pages onto the semantic tokens. This is the
  prerequisite for user-selectable themes (3.1).
- **Effort:** Medium
- **Priority:** Medium

### 1.6 Duplicated primitives across pages
- **Area:** Code architecture & logic
- **Issue:** `fmtHours` is defined three times (Dashboard, Maintenance, MajorMaintenance) with slightly
  different formats; `StatusBadge` exists twice (Equipment, DataGaps) with diverging style maps; the
  loading spinner is a shared `Spinner` component on Dashboard but copy-pasted inline markup on three other
  pages; the filter bar and the right-hand detail panel are near-identical 60–100-line blocks in three
  pages.
- **Suggested approach:** Extract `lib/format.js` (hours/date helpers) and shared `FilterBar`,
  `DetailPanel`, `StatusBadge` components into `components/`. Do it opportunistically as pages get touched.
- **Effort:** Medium
- **Priority:** Medium

### 1.7 Inconsistent data-fetching patterns + no caching
- **Area:** Code architecture & logic
- **Issue:** Dashboard uses the `useQuery` hook; the other pages hand-roll `useState`/`useEffect`/loaders.
  Nothing is cached, so every route change refetches everything; there's no refetch-after-mutation
  primitive (which caused the stale-closure bug in 1.8).
- **Suggested approach:** Either extend `useQuery` (refetch function, error handling) and use it everywhere,
  or adopt TanStack Query (small dependency, gives caching/staleTime/invalidation for free and would
  noticeably improve perceived navigation speed).
- **Effort:** Medium
- **Priority:** Medium

### 1.8 Stale-closure bug when re-selecting a task after completion ✅ Fixed 2026-07-02 (fixed alongside 1.1)
- **Area:** Code architecture & logic
- **Issue:** In `Maintenance.jsx` `handleLogSave`, after `await loadTasks()` the code runs
  `setSelected(prev => tasks.find(t => t.id === prev.id) || prev)` — but `tasks` is the array captured at
  render time, not the freshly loaded one, so the detail panel keeps showing pre-completion values.
  (Currently unreachable because of 1.1, but it will surface the moment 1.1 is fixed.)
- **Suggested approach:** Have `loadTasks` return the fresh array and select from that, or move re-selection
  into an effect keyed on `tasks`.
- **Effort:** Small
- **Priority:** Medium

### 1.9 PostgREST filter breakage via search-input interpolation
- **Area:** Code architecture & logic
- **Issue:** `Equipment.jsx` builds
  `q.or(\`description.ilike.%${search}%,equipment.ilike.%${search}%,...\`)`. A search containing `,`, `(`,
  `)` or `.` corrupts the PostgREST filter grammar → request error (silently swallowed per 1.4, so the
  table just shows nothing). Not SQL injection, but a reliability/robustness hole in the most-typed-into
  box in the app.
- **Suggested approach:** Escape/strip PostgREST-reserved characters, or move search server-side into a
  view exposing a single concatenated `search_text` column filtered with one `ilike`.
- **Effort:** Small
- **Priority:** Medium

### 1.10 822-line `Maintenance.jsx`
- **Area:** Code architecture & logic
- **Issue:** Tasks board, history log, detail panel, and completion modal all live in one file with ~20
  `useState` hooks. Hard to review and a merge-conflict magnet.
- **Suggested approach:** Split by concern: `TasksBoard`, `HistoryLog`, `TaskDetailPanel`,
  `LogCompletionModal`, colocated in `pages/maintenance/`.
- **Effort:** Medium
- **Priority:** Low

### 1.11 No tests and no CI quality gate ⚠️ Partially fixed 2026-07-02 (CI lint/build gate added; Vitest/Playwright still open)
- **Area:** Code architecture & logic
- **Issue:** Zero test files; the only workflow deploys `main`. PRs get no lint/build check — 1.2 would
  have been caught by even a smoke test that renders each page against a mocked client.
- **Suggested approach:** Add a PR workflow running `oxlint` + `vite build`, then Vitest for pure logic
  (urgency/format helpers, due-state expectations) and one Playwright smoke test per page with a stubbed
  Supabase. The Playwright + mock-injection pattern already used during this project's development is a
  ready-made starting point.
- **Effort:** Medium
- **Priority:** Medium

### 1.12 Leftover template artifacts & metadata
- **Area:** Code architecture & logic
- **Issue:** `src/assets/react.svg`, `vite.svg`, `hero.png` are unreferenced Vite-template leftovers;
  `public/icons.svg` is unreferenced; `index.html` title is the package name "nrcc-dashboard"; README
  still calls Equipment/Maintenance/DataGaps "stubs for later phases" and documents the anon-read
  dev-stage remnant (see 5.1).
- **Suggested approach:** Delete unused assets, set a proper `<title>` (e.g. "NRCC Power Plant Ops"),
  refresh the README (also its claim that `.env` "already holds" credentials — a fresh clone has none).
- **Effort:** Small
- **Priority:** Low

### 1.13 Consider TypeScript (or JSDoc types) for the view row shapes
- **Area:** Code architecture & logic
- **Issue:** The app is stringly-typed against five view schemas. Column renames (see 1.2!) and nullable
  numeric fields (`hours_remaining`) are invisible until runtime. Supabase can generate types
  (`supabase gen types typescript`) that would make every `.select()` checked.
- **Suggested approach:** Incremental TS adoption (`allowJs`), starting with `lib/` and generated DB types;
  or, cheaper, JSDoc `@typedef` blocks for the five view row shapes.
- **Effort:** Large (full TS) / Small (JSDoc)
- **Priority:** Low–Medium

---

## 2. Database & data model

### 2.1 Lube Oil Separator tasks permanently "Unknown" — missing hours mapping **[verified]** ✅ Fixed 2026-07-02
- **Area:** Database & data model
- **Issue:** The schema comment on `equipment_status_log` says *"Lube Oil Separator hours mirror the parent
  DG engine and are not logged separately"* — exactly like turbochargers. But `v_maintenance_due` only maps
  `Turbocharger → Engine` when joining `v_latest_hours`. Result: all **9 "Lube Oil Separator / 1K Service"
  tasks have baselines but sit in `Unknown (missing baseline/reading)` forever** (verified in live data).
  Same class of bug as the turbocharger issue fixed earlier — the mapping fix just didn't cover this
  component type.
- **Suggested approach:** Extend the CASE in `v_maintenance_due`'s join to
  `WHEN component_type IN ('Turbocharger','Lube Oil Separator') THEN 'Engine'`. Better: create a small
  `component_hours_source(component_type, source_component_type)` mapping table so the next mirrored
  component doesn't require a view migration.
- **Effort:** Small
- **Priority:** **High**

### 2.2 Composite natural key repeated through every child table
- **Area:** Database & data model
- **Issue:** `(line, equipment, component_type)` — three text columns — is the PK of `equipment` and is
  copied as the FK into `equipment_status_log`, `maintenance_status`, and `maintenance_history`. It works
  and is human-readable, but: renaming a component cascades through 4 tables; every join carries 3 text
  comparisons; and the UI treats the triple as identity in a dozen places (`r.line === x && r.equipment
  === y && ...`).
- **Suggested approach:** Not urgent at this scale. If the registry grows or renames become common, add a
  surrogate `equipment_id bigint identity` PK with a unique constraint on the natural triple, and migrate
  FKs. Otherwise, document the triple as immutable-once-created.
- **Effort:** Large
- **Priority:** Low

### 2.3 No integrity guards on hour-meter readings **[verified data impact]**
- **Area:** Database & data model
- **Issue:** `equipment_status_log` allows hours to go backwards (5 regressions found in only 38 rows —
  see 6.2), duplicate readings for the same equipment+timestamp, and negative values. Nothing enforces the
  "18 hour-tracked component types" rule the table comment describes ("Not DB-enforced — the UI should
  restrict entry").
- **Suggested approach:** Add `CHECK (running_hours >= 0)`; a unique index on
  `(line, equipment, component_type, recorded_at)`; and a trigger (or app-side confirmation) warning when a
  new reading is lower than the previous one — meter replacements happen, so warn/annotate rather than
  hard-reject.
- **Effort:** Medium
- **Priority:** Medium

### 2.4 `updated_at` only maintained by the client
- **Area:** Database & data model
- **Issue:** `maintenance_status.updated_at` is set in JS by the update payload; `equipment` updates from
  the Equipment/DataGaps pages don't set it at all, so `equipment.updated_at` is frozen at import time.
- **Suggested approach:** `moddatetime` trigger (extension ships with Supabase) on both tables; remove the
  client-side timestamp.
- **Effort:** Small
- **Priority:** Medium

### 2.5 History records unlinkable to the tasks they satisfied
- **Area:** Database & data model
- **Issue:** `linked_task_id` is NULL on 100% of the 2,065 history rows (verified). Expected for the bulk
  import, but the one flow that would populate it going forward is broken (1.1). Without links, "when was
  this task last actually done" requires fuzzy text matching.
- **Suggested approach:** Fix 1.1 first. Optionally backfill obvious matches (e.g. rows whose
  `work_description` starts with "PM completed:" or matches a task name for the same equipment).
- **Effort:** Small (fix) / Medium (backfill)
- **Priority:** Medium

### 2.6 12K Major Overhaul tasks counted in two surfaces
- **Area:** Database & data model
- **Issue:** The 18 "12K Major Overhaul" rows feed both `v_major_overhaul_status` (dedicated page) and
  `v_maintenance_due` (Maintenance Board + all Dashboard KPIs). Keeping them in both was a deliberate
  choice, but note the consequence: the Dashboard "Overdue" KPI includes up to 18 major-overhaul tasks, so
  it will read dramatically higher than what operators think of as day-to-day overdue PMs.
- **Suggested approach:** No change required; consider labeling ("overdue tasks incl. major O/H") or a
  `task_class` column (`'PM' | 'Major'`) to allow filtered KPIs later.
- **Effort:** Small
- **Priority:** Low

### 2.7 Advisor-flagged index hygiene
- **Area:** Database & data model
- **Issue:** Supabase performance advisor flags: unindexed FK `maintenance_history.linked_task_id`; unused
  indexes `idx_equipment_location`, `idx_equipment_system`, `maintenance_status_workflow_idx`. All trivial
  at current row counts.
- **Suggested approach:** Add the FK index when 2.5 starts producing links; leave the "unused" ones until
  the usage pattern settles.
- **Effort:** Small
- **Priority:** Low

### 2.8 Schema lives only in the hosted DB (no migrations in repo) ✅ Fixed 2026-07-02
- **Area:** Database & data model (also Other)
- **Issue:** There is no `supabase/` directory; tables, views, RLS, and the two hotfix migrations applied
  via MCP exist only in the cloud project. The repo cannot rebuild its own backend; view changes (like the
  turbocharger fix) have no code review trail.
- **Suggested approach:** `supabase init` + `supabase db pull` to capture the current schema as a baseline
  migration; commit it; make all future DDL flow through committed migrations (branch DBs become possible
  too).
- **Effort:** Medium
- **Priority:** Medium–High

---

## 3. UI/UX & visual design

### 3.1 Should the theme be user-selectable? — Yes, after token consolidation
- **Area:** UI/UX & visual design
- **Issue / opportunity:** Today theming is impossible: four pages hardcode hex values (see 1.5), so
  there is effectively one theme implemented two different ways. But the user base genuinely spans two
  environments — a dim control room and daylight office/field use — which is the textbook case for
  preset themes.
- **Suggested approach:** Two steps.
  1. Convert `tailwind.config.js` colors to CSS custom properties (`panel.bg: 'rgb(var(--panel-bg))'`,
     etc.) and migrate the hex-based pages onto the tokens (1.5).
  2. Add a `data-theme` attribute on `<html>`, a small toggle in the sidebar footer, persisted to
     `localStorage`. Ship **three presets**:
     - **Control Room (default)** — the current dark slate (`#0e1116` base, existing status hues).
     - **Night / High-contrast** — near-black background, brighter `ink` values, heavier status colors and
       thicker overdue accents; targets glare-free night-shift viewing and doubles as the accessibility
       theme (fixes the contrast issues in 3.3 by construction).
     - **Daylight** — light theme (paper-white panels, dark ink, same status hue family) for office review
       and printing/screenshots into reports.
  Status colors (`st-run/warn/over/...`) should stay recognizably green/amber/red across all three — only
  their exact values shift per theme.
- **Effort:** Medium (step 1 is most of it; step 2 is small)
- **Priority:** Medium

### 3.2 Sign-out button blocks every detail panel's close button **[verified]** ✅ Fixed 2026-07-02
- **Area:** UI/UX & visual design
- **Issue:** The fixed `Sign out` button (`z-50`, top-right) sits directly on top of the `×` close button
  of the `z-20` detail panels on Equipment, Maintenance, and Data Gaps. Verified during automated testing:
  clicks aimed at `×` are intercepted by "Sign out" — worst case a user trying to close a panel logs
  themselves out. The Dashboard's newer panel already works around this with `z-[60]`.
- **Suggested approach:** Move Sign out into the sidebar footer (next to "Connected") instead of floating
  over content — it's currently also overlapping page headers on scroll. If it must stay floating, raise
  all panels above it and give the button a safe corner.
- **Effort:** Small
- **Priority:** **High**

### 3.3 Accessibility gaps
- **Area:** UI/UX & visual design
- **Issue:**
  - Interactive table rows are `<tr onClick>` with no `tabIndex`, `role`, or keyboard handler — the app is
    largely unusable by keyboard.
  - Icon-only buttons (`×`, `▸/▾`) lack `aria-label`s.
  - Status is conveyed by color-only dots in several places.
  - `ink-lo` (#5f6b7c) on `panel-bg` (#0e1116) is ≈3.9:1 — below WCAG AA for the 9–11px text it's used on;
    `text-gray-600` on the dark pages is worse.
  - Remarks on Major Maintenance (and truncated text elsewhere) are exposed only via `title` tooltips —
    invisible on touch devices, which matters for tablets in the field.
- **Suggested approach:** Keyboard/ARIA pass on shared row & button components (cheap once 1.6 extracts
  them); bump the smallest text a size and lighten `ink-lo`; pair dots with text (mostly already done);
  replace `title` with a click-to-expand row or small popover for remarks.
- **Effort:** Medium
- **Priority:** Medium–High

### 3.4 Line filter options don't match the data **[verified]** ✅ Fixed 2026-07-02
- **Area:** UI/UX & visual design
- **Issue:** Live data contains exactly three lines: `Line-1` (218 rows), `Line-2` (109), `Common` (25).
  The Black Start DG lives under `Common`. Yet filter dropdowns offer a **"Black Start" option that matches
  zero rows** on Equipment, Data Gaps, and Maintenance-history — and the Maintenance tasks-tab filter
  offers *only* `Line-1/Line-2/Black Start`, omitting `Common`, so Black Start DG's weekly trial-run task
  and all common-aux tasks can never be reached via that filter.
- **Suggested approach:** Derive line options from the data (`select distinct line`) or a shared constant
  that matches reality (`Line-1, Line-2, Common`), used by all four pages.
- **Effort:** Small
- **Priority:** Medium–High

### 3.5 Responsiveness limits
- **Area:** UI/UX & visual design
- **Issue:** The sidebar is a fixed 224px with no collapse; detail panels are fixed `26rem` overlays that
  cover a phone screen with no close affordance visible without scrolling; Maintenance and Major
  Maintenance tables have no `overflow-x` wrapper (Equipment does), so they crush on narrow viewports.
- **Suggested approach:** Add `overflow-x-auto` wrappers (trivial); collapse the sidebar to icons below
  `lg`; make detail panels full-screen sheets below `sm`.
- **Effort:** Medium
- **Priority:** Medium

### 3.6 Small UX polish items
- **Area:** UI/UX & visual design
- **Issue / opportunity:**
  - Data Gaps "Mark as Confirmed" instantly removes the row with no undo.
  - Equipment status-pill counts show `…` forever for statuses with zero rows (`Field-verify`,
    `Partial-GAP` currently have none) instead of `0`.
  - Document `<title>` never changes per route.
  - Dashboard "Data Gaps" KPI tile could deep-link to the Data Gaps page the same way "Overdue" now
    expands the overdue panel.
  - Major Maintenance KPI tiles use a different width/composition than the Dashboard KPI strip — minor
    inconsistency once both are token-based.
- **Suggested approach:** Batch as a polish pass: undo toast, `?? 0`, `document.title` effect per route,
  `<Link>` on the tile.
- **Effort:** Small
- **Priority:** Low

---

## 4. Performance

### 4.1 Single 504 kB JS chunk
- **Area:** Performance
- **Issue:** `vite build` outputs one 504 kB bundle (139 kB gzip). Fine on plant LAN, slower on mobile
  links; Vite itself warns about it.
- **Suggested approach:** `React.lazy` per route (the five pages are naturally independent), which also
  keeps the login screen minimal. Optional: `manualChunks` for `@supabase/supabase-js`.
- **Effort:** Small–Medium
- **Priority:** Low–Medium

### 4.2 Blocking Google Fonts import
- **Area:** Performance
- **Issue:** `index.css` starts with `@import url('https://fonts.googleapis.com/...')` — a render-blocking
  request chain (CSS → font CSS → font files) to a third party; also a privacy consideration.
- **Suggested approach:** Self-host Inter + JetBrains Mono WOFF2 (e.g. Fontsource) or at minimum move to
  `<link rel="preconnect">` + `<link>` in `index.html` with `font-display: swap`.
- **Effort:** Small
- **Priority:** Low–Medium

### 4.3 History tab fetches all 2,065 rows at once
- **Area:** Performance
- **Issue:** `loadAllHistory()` pulls the entire `maintenance_history` table into memory and paginates
  client-side. At 2k rows this is ~1–2 MB of JSON and will grow monotonically forever (the table is
  append-only by design).
- **Suggested approach:** Server-side pagination with `.range()` + `count: 'exact'`, exactly as
  `Equipment.jsx` already does; move the text search server-side at the same time (see 1.9).
- **Effort:** Small–Medium
- **Priority:** Medium

### 4.4 Refetch-everything navigation
- **Area:** Performance
- **Issue:** No client cache: switching Dashboard → Maintenance → Dashboard refires every query and shows
  spinners each time (four parallel queries on the Dashboard alone).
- **Suggested approach:** Covered by 1.7 (TanStack Query with a 30–60s `staleTime` makes navigation
  instant while staying fresh enough for ops data).
- **Effort:** Medium
- **Priority:** Medium

### 4.5 No live/auto refresh ✅ Fixed 2026-07-02
- **Area:** Performance (product behavior)
- **Issue:** A control-room dashboard left open on a wall screen shows frozen data until manually reloaded.
- **Suggested approach:** Cheap: `refetchInterval` (60s) once 1.7 lands. Fancier: Supabase Realtime
  subscription on `equipment_status_log` + `maintenance_status` to invalidate queries on change.
- **Effort:** Small (poll) / Medium (realtime)
- **Priority:** Medium

---

## 5. Security

### 5.1 Entire dataset readable without login through the views **[verified — advisor ERROR ×5]** ✅ Fixed 2026-07-01
- **Area:** Security
- **Issue:** All five views (`v_equipment_current_status`, `v_maintenance_due`, `v_data_gaps`,
  `v_latest_hours`, `v_major_overhaul_status`) are owned by `postgres` **without `security_invoker`**, and
  `anon` holds SELECT grants on all of them. Postgres views execute with the owner's privileges, so they
  bypass the base tables' RLS entirely: anyone with the publishable key — which is baked into the public
  GitHub Pages bundle by design — can read all plant data with a plain REST call, no login. The Supabase
  security advisor flags all five as ERROR-level "Security Definer View". The login page currently
  protects writes only. (README even notes the dev-stage anon read was to be tightened "when auth is
  added" — auth landed, the tightening didn't.)
- **Suggested approach:**
  1. `ALTER VIEW ... SET (security_invoker = true);` for all five views — then RLS on the base tables
     governs view access too.
  2. `REVOKE ALL ON <each view> FROM anon;` (and add explicit SELECT policies for `authenticated` — the
     existing `ALL USING(true)` policies already cover this).
  3. Re-run the advisor to confirm zero ERRORs; smoke-test the app logged-in.
- **Effort:** Small
- **Priority:** **High** (the single most important item in this review)

### 5.2 Default grants left on base tables for `anon` ✅ Fixed 2026-07-01
- **Area:** Security
- **Issue:** `anon` also holds INSERT/UPDATE/DELETE/TRUNCATE grants on every base table (Supabase's default
  grants). RLS currently blocks these (no anon policies), so it's defense-in-depth rather than an active
  hole — but one accidental `TO public` policy away from being one.
- **Suggested approach:** `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;` and
  `ALTER DEFAULT PRIVILEGES ... REVOKE ... FROM anon;` if anonymous access is never intended.
- **Effort:** Small
- **Priority:** Medium

### 5.3 Shared login + `USING (true)` write policies = no least privilege, no audit trail ⚠️ Partially fixed 2026-07-01 (policy split done; per-user accounts still open)
- **Area:** Security
- **Issue:** One shared account (verified: exactly 1 auth user); every authenticated session has
  unrestricted ALL (including DELETE) on all tables — advisor WARNs on all five policies. Any operator can
  irreversibly modify anything, and `maintenance_history.source`/`created_at` are the only breadcrumbs of
  who did what (they identify nothing with a shared login).
- **Suggested approach:** Near-term: split policies into SELECT-for-authenticated plus scoped
  INSERT/UPDATE (no DELETE) on the tables the UI actually writes (`equipment.data_status/remarks`,
  `maintenance_status.last_done_*`, `maintenance_history` insert). Medium-term: individual operator
  accounts (email or magic link), a `created_by uuid default auth.uid()` column on writes, and an
  `app_role` claim if an admin/viewer split emerges. Also enable the leaked-password protection the
  advisor flags, since password auth is in use.
- **Effort:** Medium
- **Priority:** High (policy split: small and immediate; per-user accounts: as staffing allows)

### 5.4 Public repo + public site — data sensitivity check
- **Area:** Security
- **Issue:** The repository is public and the GH Pages site is public; with 5.1 fixed, the *app* requires
  login, but PR bodies/screenshots in the repo history contain real hour-meter and maintenance data. Worth
  a conscious decision on whether NRCC considers plant maintenance backlog sensitive.
- **Suggested approach:** If sensitive: make the repo private (Pages can stay, or move behind auth). If
  not: no action, but decide deliberately.
- **Effort:** Small
- **Priority:** Medium

---

## 6. Data quality

*(Verified directly against live tables on 2026-07-01.)*

### 6.1 25 maintenance tasks stuck in "Unknown" state **[verified]**
- **Area:** Data quality
- **Issue:** Breakdown of `due_state like 'Unknown%'`:
  - **9× Lube Oil Separator "1K Service"** — have baselines; blocked by the view mapping gap (2.1).
  - **10× Engine hours-based** — missing `last_done_hours` baselines: 500hr Schedule Service ×3, 1K ×2,
    2K ×2, 6K ×2, Peak Pressure Recording ×1.
  - **2× Engine calendar** — missing `last_done_date`: Cooling Water Nitrite Test, Lube Oil Sample Analysis.
  - **4× HFO Separator #1–#4 "1K Service"** — separators have hour readings, but these tasks lack
    baselines.
  These 25 tasks are invisible to every overdue/due-soon count on the Dashboard.
- **Suggested approach:** 2.1 clears nine instantly. The remaining 16 need field data — the last service
  hours/dates from unit logbooks. Track them as a checklist; the Data Gaps page pattern would suit a
  "maintenance baselines" variant.
- **Effort:** Small (DB) + field-data collection
- **Priority:** **High**

### 6.2 Hour-meter regressions in the readings log **[verified]**
- **Area:** Data quality
- **Issue:** 5 of 38 readings show running-hours *decreasing* vs the prior reading for the same equipment:
  HFO Separator #2 (×1), #3 (×1), Starting Air Compressor #1 (×2), #2 (×1). Either meter
  replacements/resets (should be annotated) or data-entry errors (should be corrected). Every derived
  hours-remaining figure for these units is suspect.
- **Suggested approach:** Review these five readings against logbooks; correct or annotate via `remarks`;
  then add the guard from 2.3 so future regressions are flagged at entry.
- **Effort:** Small
- **Priority:** Medium–High

### 6.3 Black Start DG is under-tracked **[verified]**
- **Area:** Data quality
- **Issue:** The Black Start DG (line `Common`) has exactly **one** hours reading — dated 2026-04-30, two
  months stale (every other tracked unit was read 2026-06-29) — and exactly **one** maintenance task
  (Weekly Trial Run). For emergency-start equipment, staleness is itself a risk signal. It's also
  invisible via the broken "Black Start" line filters (3.4).
- **Suggested approach:** Include it in the routine meter-reading round; define its PM tasks (oil change,
  battery check, load test — per OEM schedule); consider a "stale reading" indicator on the Dashboard
  (reading older than N days) so this class of gap self-reports.
- **Effort:** Small (app indicator) + operational process
- **Priority:** Medium–High

### 6.4 History dates: 84 undated + ~180 unparsed date ranges **[verified]**
- **Area:** Data quality
- **Issue:** 84 history rows have neither `work_date` nor `work_date_text`; ~180 more carry only text
  ranges ("06-24 Dec 2025", "27-29 Jun 2026") with `work_date` NULL. PostgREST's descending sort puts
  NULLs first by default, so the History tab leads with undated records; date filters and any future
  "last done" inference skip them entirely.
- **Suggested approach:** Backfill `work_date` from the range start (a parse of the ~25 distinct range
  formats covers most rows); keep `work_date_text` for display. For the 84 fully undated rows, mark
  explicitly ("date unknown") so they stop looking like a parsing bug. Add `nullsFirst: false` to the
  history sort meanwhile.
- **Effort:** Medium
- **Priority:** Medium

### 6.5 `data_status` taxonomy barely used
- **Area:** Data quality
- **Issue:** Live counts: 315 Confirmed, 37 GAP, 0 Field-verify, 0 Partial-GAP. Either the field
  verification campaign is complete (then the two intermediate statuses and their UI affordances are dead
  weight), or intermediate statuses aren't being used as designed.
- **Suggested approach:** Confirm with the ops team which it is; either retire the unused statuses or start
  using them. No code change required either way.
- **Effort:** Small
- **Priority:** Low

---

## 7. Anything else worth flagging

### 7.1 No data-entry path for hour readings — the biggest workflow gap ✅ Fixed 2026-07-02
- **Area:** Other (product)
- **Issue:** The freshness of *everything* (due states, overdue hours, major overhaul tracking) depends on
  `equipment_status_log`, which has no UI — its 38 rows were seeded manually. Today someone must use the
  Supabase console to log a meter reading, which won't survive contact with a night shift.
- **Suggested approach:** A "Log Readings" page/modal: pick date, enter hours+status for the 18 tracked
  items in one grid, validate against previous reading (ties into 2.3), insert as a batch. This single
  feature turns the dashboard from a snapshot into a living system.
- **Effort:** Medium
- **Priority:** **High** (product-wise; nothing else stays accurate without it)

### 7.2 Commit the backend: migrations + seed in repo ✅ Fixed 2026-07-02 (migrations; seed/data export still open)
- **Area:** Other
- **Issue:** Same as 2.8, elevated here because it also affects disaster recovery: today a lost Supabase
  project = a lost backend. There is also no documented backup story beyond Supabase's own PITR tier.
- **Suggested approach:** `supabase db pull` baseline into `supabase/migrations/`; a `pg_dump --data-only`
  snapshot (or scheduled export) for the reference data (`equipment`, `systems`, task definitions).
- **Effort:** Medium
- **Priority:** Medium–High

### 7.3 No error monitoring
- **Area:** Other
- **Issue:** Client errors die in users' consoles (and per 1.4, often invisibly). Nobody will know the app
  is broken until an operator mentions it.
- **Suggested approach:** Sentry (or GlitchTip) free tier: one-line Vite plugin + DSN; wire `useQuery`'s
  error path into it.
- **Effort:** Small
- **Priority:** Medium

### 7.4 CSV/print export for reports
- **Area:** Other
- **Issue:** Ops teams inevitably need the maintenance board and history in monthly-report form; today
  that's manual screenshots.
- **Suggested approach:** Client-side CSV export buttons on Maintenance history and Major Maintenance
  tables (data is already in memory); a `@media print` stylesheet for the Dashboard (pairs nicely with the
  Daylight theme from 3.1).
- **Effort:** Small
- **Priority:** Low–Medium

### 7.5 Timezone note on due-date math
- **Area:** Other
- **Issue:** Calendar due-state uses `CURRENT_DATE` in the DB (UTC). Pakistan is UTC+5, so a task "due
  today" flips to overdue at 05:00 local rather than midnight. Harmless at day granularity, worth a
  comment so nobody debugs it later.
- **Suggested approach:** Either accept and document, or use `(now() at time zone 'Asia/Karachi')::date`
  in `v_maintenance_due`.
- **Effort:** Small
- **Priority:** Low

### 7.6 PWA / kiosk hardening (idea)
- **Area:** Other
- **Issue / opportunity:** If the dashboard runs on a wall display or field tablets, brief network blips
  currently blank it.
- **Suggested approach:** Add a manifest + minimal service worker (cache-first shell, network-first data)
  so the last-known state persists through blips; pairs with auto-refresh (4.5).
- **Effort:** Medium
- **Priority:** Low

---

## Suggested sequencing (if everything above were accepted)

1. **Security first (one sitting):** 5.1 view lockdown → 5.2 grant revoke → 5.3 policy split.
2. **Verified bug fixes (one sitting):** 1.1 log completion, 1.2 systems filter, 1.3 header date,
   2.1 LO Separator mapping, 3.2 sign-out overlap, 3.4 line filters.
3. **Data repair (with ops team):** 6.1 baselines, 6.2 meter regressions, 6.3 Black Start DG, 6.4 dates.
4. **Foundations:** 2.8/7.2 migrations in repo, 1.4 error surfacing, 1.11 CI gate, 7.3 monitoring.
5. **Product:** 7.1 readings entry, 4.5 auto-refresh, 1.5+3.1 token consolidation → theme presets.
6. **Everything else** opportunistically.
