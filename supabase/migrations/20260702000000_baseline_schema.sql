-- Baseline schema for nrcc-power-plant-dashboard, captured 2026-07-02.
--
-- This is a hand-reconstructed snapshot of the live project (introspected via
-- information_schema/pg_catalog), not a `supabase db pull` output — the
-- Supabase CLI wasn't available in the environment that authored this file.
-- It reflects the schema as it exists in production *after* the security
-- lockdown and bugfix migrations already applied directly to the project
-- (see supabase/README.md for the full list and rationale). Treat this as
-- the starting point for all *future* schema changes, which should from now
-- on be written as new files in this directory and applied via
-- `supabase db push` (or the Supabase MCP `apply_migration` tool) instead of
-- ad hoc changes.

-- ── tables ──────────────────────────────────────────────────────────────

CREATE TABLE systems (
  system_name text PRIMARY KEY,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE systems IS
  'Plant system categories used to group/filter equipment (e.g. Power Generation, Fuel System).';

CREATE TABLE equipment (
  line           text NOT NULL,
  equipment      text NOT NULL,
  component_type text NOT NULL,
  system         text NOT NULL REFERENCES systems (system_name) ON UPDATE CASCADE,
  description    text,
  location       text,
  specification  text,
  data_status    text NOT NULL DEFAULT 'Confirmed'
                   CHECK (data_status IN ('Confirmed', 'Field-verify', 'GAP', 'Partial-GAP')),
  remarks        text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (line, equipment, component_type)
);

COMMENT ON TABLE equipment IS
  'All plant equipment at component level. One row per physically distinct, individually identifiable item.';
COMMENT ON COLUMN equipment.line IS
  'Line-1 / Line-2 / Common / Black Start - source provenance grouping; also part of the natural key.';
COMMENT ON COLUMN equipment.equipment IS
  'Parent equipment tag (e.g. DG-1, TR-1, BAO901). Not unique alone - combine with line + component_type.';
COMMENT ON COLUMN equipment.component_type IS
  'Specific component/sub-part name (e.g. Engine, Radiator Motor R1#1, HFO Transfer Pump #1).';
COMMENT ON COLUMN equipment.specification IS
  'Raw pipe-delimited nameplate/spec text as captured from the field, not parsed into structured fields.';

CREATE TABLE equipment_status_log (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  line           text NOT NULL,
  equipment      text NOT NULL,
  component_type text NOT NULL,
  recorded_at    timestamptz NOT NULL DEFAULT now(),
  running_hours  numeric(10, 1),
  status         text NOT NULL
                   CHECK (status IN ('Running', 'Standby', 'Shutdown', 'Tripped', 'Under Maintenance')),
  remarks        text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (line, equipment, component_type) REFERENCES equipment (line, equipment, component_type)
);

COMMENT ON TABLE equipment_status_log IS
  'Running-hours and status readings over time. Scoped to equipment where hours-based maintenance is '
  'operationally meaningful and not inferable from a parent: Engines, Compressors, HFO Separators (18 of '
  '348 equipment rows). Lube Oil Separator hours mirror the parent DG engine and are not logged '
  'separately. Not DB-enforced -- the UI should restrict entry to these component types.';

CREATE TABLE maintenance_status (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  line            text NOT NULL,
  equipment       text NOT NULL,
  component_type  text NOT NULL,
  task_name       text NOT NULL,
  interval_basis  text NOT NULL CHECK (interval_basis IN ('Hours', 'Calendar')),
  interval_hours  numeric(10, 1),
  interval_days   integer,
  last_done_hours numeric(10, 1),
  last_done_date  date,
  next_due_hours  numeric(10, 1) GENERATED ALWAYS AS (
                    CASE WHEN interval_basis = 'Hours' THEN last_done_hours + interval_hours ELSE NULL END
                  ) STORED,
  next_due_date   date GENERATED ALWAYS AS (
                    CASE WHEN interval_basis = 'Calendar' THEN last_done_date + interval_days ELSE NULL END
                  ) STORED,
  workflow_status text NOT NULL DEFAULT 'Scheduled'
                    CHECK (workflow_status IN ('Scheduled', 'In Progress', 'Completed', 'Cancelled')),
  priority        text CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  remarks         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (line, equipment, component_type) REFERENCES equipment (line, equipment, component_type),
  CONSTRAINT maintenance_status_interval_check CHECK (
    (interval_basis = 'Hours'    AND interval_hours IS NOT NULL AND interval_days  IS NULL) OR
    (interval_basis = 'Calendar' AND interval_days  IS NOT NULL AND interval_hours IS NULL)
  )
);

COMMENT ON TABLE maintenance_status IS
  'Maintenance tasks per equipment, one row per task (an equipment can have several, e.g. Oil Change + '
  'Top Overhaul). Hours-based tasks apply to the 18 hour-tracked items; everything else uses '
  'calendar-based intervals. Due/overdue computed in v_maintenance_due, not stored.';

CREATE TABLE maintenance_history (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  line             text NOT NULL,
  equipment        text NOT NULL,
  component_type   text NOT NULL,
  work_date        date,
  work_date_text   text,
  run_hours        numeric(10, 1),
  work_description text NOT NULL,
  work_category    text CHECK (work_category IN (
                     'Routine Maintenance', 'Defect', 'PMS', 'CBM', 'Routine analysis', 'Weekly',
                     'Overhaul', 'Other'
                   )),
  linked_task_id   bigint REFERENCES maintenance_status (id),
  source           text DEFAULT 'Imported: 6-mo report',
  created_at       timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (line, equipment, component_type) REFERENCES equipment (line, equipment, component_type)
);

COMMENT ON TABLE maintenance_history IS
  'Completed maintenance work log. Initially populated from the Dec2025-May2026 consolidated report; '
  'appended going forward. work_category mirrors the Remarks column of the source report. '
  'linked_task_id optionally ties a record to the recurring PM task it satisfied.';

-- ── indexes ─────────────────────────────────────────────────────────────
-- (primary keys already create their own unique indexes)

CREATE INDEX idx_equipment_data_status ON equipment (data_status);
CREATE INDEX idx_equipment_equipment   ON equipment (equipment);
CREATE INDEX idx_equipment_location    ON equipment (location);
CREATE INDEX idx_equipment_system      ON equipment (system);

CREATE INDEX equipment_status_log_latest_idx
  ON equipment_status_log (line, equipment, component_type, recorded_at DESC);

CREATE INDEX maintenance_history_category_idx  ON maintenance_history (work_category);
CREATE INDEX maintenance_history_date_idx      ON maintenance_history (work_date DESC);
CREATE INDEX maintenance_history_equipment_idx ON maintenance_history (line, equipment, component_type);

CREATE INDEX maintenance_status_equipment_idx ON maintenance_status (line, equipment, component_type);
CREATE INDEX maintenance_status_workflow_idx  ON maintenance_status (workflow_status);

-- ── row level security ──────────────────────────────────────────────────
-- Shared-login model: any authenticated session gets full read + (mostly)
-- write access; anon gets nothing. See RECOMMENDATIONS.md finding 5.3 for
-- the tracked follow-up (per-user accounts) this doesn't yet cover.

ALTER TABLE systems               ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment              ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_status_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_status     ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_history    ENABLE ROW LEVEL SECURITY;

-- systems: pure reference data, read-only from the app
CREATE POLICY authenticated_select ON systems FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON systems FROM authenticated;

-- equipment: Equipment Registry / Data Gaps update data_status + remarks
CREATE POLICY authenticated_select ON equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_insert ON equipment FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY authenticated_update ON equipment FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
REVOKE DELETE, TRUNCATE ON equipment FROM authenticated;

-- equipment_status_log: no UI writer yet (see RECOMMENDATIONS.md 7.1), but
-- keep insert/update available for when the "log readings" feature lands
CREATE POLICY authenticated_select ON equipment_status_log FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_insert ON equipment_status_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY authenticated_update ON equipment_status_log FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
REVOKE DELETE, TRUNCATE ON equipment_status_log FROM authenticated;

-- maintenance_status: Maintenance Board completion flow updates last_done_*
CREATE POLICY authenticated_select ON maintenance_status FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_insert ON maintenance_status FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY authenticated_update ON maintenance_status FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
REVOKE DELETE, TRUNCATE ON maintenance_status FROM authenticated;

-- maintenance_history: append-only log, never updated or deleted by the app
CREATE POLICY authenticated_select ON maintenance_history FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_insert ON maintenance_history FOR INSERT TO authenticated WITH CHECK (true);
REVOKE UPDATE, DELETE, TRUNCATE ON maintenance_history FROM authenticated;

-- anon has no business reading or writing any of this — the app requires login
REVOKE ALL ON systems, equipment, equipment_status_log, maintenance_status, maintenance_history FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

-- ── views ───────────────────────────────────────────────────────────────

-- Most recent hours/status reading per (line, equipment, component_type).
CREATE VIEW v_latest_hours AS
 SELECT DISTINCT ON (line, equipment, component_type)
    line, equipment, component_type, running_hours, recorded_at
   FROM equipment_status_log
  WHERE running_hours IS NOT NULL
  ORDER BY line, equipment, component_type, recorded_at DESC;

-- Every maintenance task with its computed due state. Turbocharger and Lube
-- Oil Separator tasks resolve their current hours from the parent DG's
-- Engine reading, since neither has its own hour meter.
CREATE VIEW v_maintenance_due AS
 SELECT m.id,
    m.line,
    m.equipment,
    m.component_type,
    m.task_name,
    m.interval_basis,
    m.workflow_status,
    m.priority,
    m.next_due_hours,
    m.next_due_date,
    lh.running_hours AS current_hours,
    lh.recorded_at AS hours_as_of,
    CASE
      WHEN m.interval_basis = 'Hours' AND m.next_due_hours IS NOT NULL AND lh.running_hours IS NOT NULL
        THEN m.next_due_hours - lh.running_hours
      ELSE NULL::numeric
    END AS hours_remaining,
    CASE
      WHEN m.interval_basis = 'Calendar' AND m.next_due_date IS NOT NULL
        THEN m.next_due_date - CURRENT_DATE
      ELSE NULL::integer
    END AS days_remaining,
    CASE
      WHEN m.workflow_status = ANY (ARRAY['Completed'::text, 'Cancelled'::text]) THEN m.workflow_status
      WHEN m.interval_basis = 'Hours' THEN
        CASE
          WHEN m.next_due_hours IS NULL OR lh.running_hours IS NULL THEN 'Unknown (missing baseline/reading)'::text
          WHEN lh.running_hours >= m.next_due_hours THEN 'Overdue'::text
          WHEN lh.running_hours >= (m.next_due_hours - m.interval_hours * 0.1) THEN 'Due Soon'::text
          ELSE 'Scheduled'::text
        END
      WHEN m.interval_basis = 'Calendar' THEN
        CASE
          WHEN m.next_due_date IS NULL THEN 'Unknown (missing baseline)'::text
          WHEN m.next_due_date < CURRENT_DATE THEN 'Overdue'::text
          WHEN m.next_due_date <= (CURRENT_DATE + (GREATEST(m.interval_days, 1)::numeric * 0.1)::integer) THEN 'Due Soon'::text
          ELSE 'Scheduled'::text
        END
      ELSE NULL::text
    END AS due_state
   FROM maintenance_status m
     LEFT JOIN v_latest_hours lh
       ON lh.line = m.line
      AND lh.equipment = m.equipment
      AND lh.component_type = (
            CASE
              WHEN m.component_type IN ('Turbocharger', 'Lube Oil Separator') THEN 'Engine'::text
              ELSE m.component_type
            END
          );

-- Per-equipment rollup: current status/hours + overdue/due-soon/task counts.
CREATE VIEW v_equipment_current_status AS
 SELECT e.line,
    e.equipment,
    e.component_type,
    e.system,
    e.description,
    e.location,
    e.data_status,
    sl.status AS current_status,
    sl.running_hours AS current_hours,
    sl.recorded_at AS status_as_of,
    COALESCE(md.overdue_count, 0::bigint) AS overdue_count,
    COALESCE(md.due_soon_count, 0::bigint) AS due_soon_count,
    COALESCE(md.task_count, 0::bigint) AS maintenance_task_count,
    sl.recorded_at IS NOT NULL AS is_hours_tracked
   FROM equipment e
     LEFT JOIN LATERAL (
       SELECT s.status, s.running_hours, s.recorded_at
         FROM equipment_status_log s
        WHERE s.line = e.line AND s.equipment = e.equipment AND s.component_type = e.component_type
        ORDER BY s.recorded_at DESC
        LIMIT 1
     ) sl ON true
     LEFT JOIN (
       SELECT v_maintenance_due.line,
          v_maintenance_due.equipment,
          v_maintenance_due.component_type,
          count(*) AS task_count,
          count(*) FILTER (WHERE v_maintenance_due.due_state = 'Overdue'::text) AS overdue_count,
          count(*) FILTER (WHERE v_maintenance_due.due_state = 'Due Soon'::text) AS due_soon_count
         FROM v_maintenance_due
        GROUP BY v_maintenance_due.line, v_maintenance_due.equipment, v_maintenance_due.component_type
     ) md ON md.line = e.line AND md.equipment = e.equipment AND md.component_type = e.component_type;

-- Equipment whose data_status isn't yet Confirmed, worst-first.
CREATE VIEW v_data_gaps AS
 SELECT line,
    equipment,
    component_type,
    system,
    description,
    location,
    data_status,
    remarks,
    CASE data_status
      WHEN 'GAP'::text THEN 1
      WHEN 'Partial-GAP'::text THEN 2
      WHEN 'Field-verify'::text THEN 3
      ELSE 4
    END AS severity_rank
   FROM equipment e
  WHERE data_status <> 'Confirmed'::text
  ORDER BY (
      CASE data_status
        WHEN 'GAP'::text THEN 1
        WHEN 'Partial-GAP'::text THEN 2
        WHEN 'Field-verify'::text THEN 3
        ELSE 4
      END), system, line, equipment, component_type;

-- 12K-hour major overhaul tracking, one row per Engine/Turbocharger task,
-- always resolved against the parent DG's Engine hours.
CREATE VIEW v_major_overhaul_status AS
 SELECT ms.id,
    ms.line,
    ms.equipment,
    ms.component_type,
    ms.task_name,
    ms.last_done_hours,
    ms.last_done_date,
    ms.next_due_hours,
    ms.workflow_status,
    ms.priority,
    ms.remarks,
    eng.running_hours AS current_running_hours,
    eng.recorded_at AS hours_recorded_at,
    eng.running_hours - ms.next_due_hours AS overdue_hours
   FROM maintenance_status ms
     JOIN v_latest_hours eng
       ON eng.line = ms.line AND eng.equipment = ms.equipment AND eng.component_type = 'Engine'::text
  WHERE ms.task_name = '12K Major Overhaul'::text;

-- Views must run with the querying user's own privileges, not the view
-- owner's — otherwise they silently bypass RLS entirely (see
-- RECOMMENDATIONS.md finding 5.1). NOTE: `CREATE OR REPLACE VIEW` resets
-- this flag to its default (false) even when the view already had it set —
-- it must be re-applied after every future change to any of these views.
ALTER VIEW v_latest_hours              SET (security_invoker = true);
ALTER VIEW v_maintenance_due           SET (security_invoker = true);
ALTER VIEW v_equipment_current_status  SET (security_invoker = true);
ALTER VIEW v_data_gaps                 SET (security_invoker = true);
ALTER VIEW v_major_overhaul_status     SET (security_invoker = true);

REVOKE ALL ON v_latest_hours, v_maintenance_due, v_equipment_current_status, v_data_gaps, v_major_overhaul_status
  FROM anon, authenticated;
GRANT SELECT ON v_latest_hours, v_maintenance_due, v_equipment_current_status, v_data_gaps, v_major_overhaul_status
  TO authenticated;
