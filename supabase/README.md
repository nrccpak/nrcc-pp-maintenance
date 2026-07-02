# Database migrations

This directory tracks the schema for the `nrcc-power-plant-dashboard` Supabase
project (`tlxljdgkimbcilvhoeji`) in version control, so schema changes go
through code review the same way app code does.

## How this got started

Until 2026-07-02 the schema only existed in the hosted project — there was no
local record of it, and changes (including a couple of bugfixes and a
security lockdown) were applied directly via the Supabase MCP tools with no
corresponding file in the repo. `20260702000000_baseline_schema.sql` is a
hand-reconstructed snapshot of that live schema (tables, indexes, RLS
policies, views, grants), introspected via `information_schema`/`pg_catalog`
since the Supabase CLI wasn't available in the environment that wrote it.
It was validated by applying it inside an isolated schema on the live
project (`CREATE SCHEMA ...; SET LOCAL search_path ...; <migration>;
ROLLBACK;`) to confirm every statement runs without error, then rolled back
so nothing touched the real `public` schema.

**This baseline is not guaranteed byte-for-byte identical to the live
schema** the way a real `supabase db pull` output would be — verify it with
`supabase db diff` against the project once the CLI is available, before
trusting it as the sole source of truth.

## Going forward

- Write new schema changes as new timestamped files in `migrations/`, in the
  same style as `20260702000000_baseline_schema.sql`.
- Apply them with `supabase db push` (once the CLI + project link are set
  up locally) or the Supabase MCP `apply_migration` tool — either way, add
  the matching file to this directory in the same change so the repo stays
  the source of truth.
- **Views used by the app must keep `security_invoker = true`.** Postgres
  resets this flag on `CREATE OR REPLACE VIEW`, even if the view already had
  it set — re-add the `ALTER VIEW ... SET (security_invoker = true);` line
  every time a view's `CREATE OR REPLACE` is edited, or a query will
  silently bypass RLS again (see RECOMMENDATIONS.md finding 5.1).
- This project uses a shared login (one `authenticated` role for everyone,
  no per-user policies) — see RECOMMENDATIONS.md finding 5.3 for the
  follow-up that would change that.
