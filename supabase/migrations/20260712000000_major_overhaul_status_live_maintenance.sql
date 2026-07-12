-- v_major_overhaul_status previously only flagged a DG as "Under Maintenance"
-- via maintenance_status.workflow_status = 'In Progress' -- a field nothing
-- in the app UI ever sets (it can only be edited directly in the DB). In
-- practice, operators mark equipment under maintenance through the Log
-- Readings page, which writes equipment_status_log.status instead, so the
-- two fields drift: DG-8's Engine/Turbocharger were logged 'Under
-- Maintenance' but their 12K Major Overhaul rows stayed 'Scheduled',
-- making the Major Maintenance page disagree with the Dashboard KPI tiles.
--
-- Surface the same live status the Dashboard already reads (resolved from
-- the parent DG's Engine, same convention v_maintenance_due/eng already use
-- for Turbocharger rows, which have no independent hour meter or status log).
CREATE OR REPLACE VIEW v_major_overhaul_status AS
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
    eng.running_hours - ms.next_due_hours AS overdue_hours,
    sl.status AS current_status
   FROM maintenance_status ms
     JOIN v_latest_hours eng
       ON eng.line = ms.line AND eng.equipment = ms.equipment AND eng.component_type = 'Engine'::text
     LEFT JOIN LATERAL (
       SELECT s.status
         FROM equipment_status_log s
        WHERE s.line = ms.line AND s.equipment = ms.equipment AND s.component_type = 'Engine'::text
        ORDER BY s.recorded_at DESC
        LIMIT 1
     ) sl ON true
  WHERE ms.task_name = '12K Major Overhaul'::text;

ALTER VIEW v_major_overhaul_status SET (security_invoker = true);
