import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Generic fetch hook for a view/table with optional query shaping.
// Pass { refetchInterval: ms } to poll in the background (e.g. a wall display).
export function useQuery(builder, deps = [], { refetchInterval } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    builder()
      .then(({ data, error }) => {
        if (!active) return
        if (error) setError(error)
        else setData(data)
        setLoading(false)
      })
      .catch(err => {
        if (!active) return
        setError(err)
        setLoading(false)
      })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey])

  useEffect(() => {
    if (!refetchInterval) return
    const id = setInterval(() => setReloadKey(k => k + 1), refetchInterval)
    return () => clearInterval(id)
  }, [refetchInterval])

  const refetch = () => setReloadKey(k => k + 1)

  return { data, error, loading, refetch }
}

// Dashboard data refreshes on its own every minute, since it's meant to be
// left open on a wall display rather than manually reloaded.
const DASHBOARD_REFRESH_MS = 60_000

// KPI rollup for the dashboard header
export function useKpis() {
  return useQuery(async () => {
    const [eq, status, maint, gaps] = await Promise.all([
      supabase.from('equipment').select('*', { count: 'exact', head: true }),
      supabase.from('v_equipment_current_status').select('current_status, overdue_count'),
      supabase.from('v_maintenance_due').select('due_state'),
      supabase.from('v_data_gaps').select('*', { count: 'exact', head: true }),
    ])
    const statuses = status.data || []
    const maintRows = maint.data || []
    return {
      data: {
        totalEquipment: eq.count ?? 0,
        running: statuses.filter(s => s.current_status === 'Running').length,
        standby: statuses.filter(s => s.current_status === 'Standby').length,
        overdue: maintRows.filter(m => m.due_state === 'Overdue').length,
        dueSoon: maintRows.filter(m => m.due_state === 'Due Soon').length,
        dataGaps: gaps.count ?? 0,
      },
      error: eq.error || status.error || maint.error || gaps.error,
    }
  }, [], { refetchInterval: DASHBOARD_REFRESH_MS })
}

export function useEquipmentStatus() {
  return useQuery(() =>
    supabase.from('v_equipment_current_status')
      .select('*')
      .eq('is_hours_tracked', true)
      .order('overdue_count', { ascending: false })
  , [], { refetchInterval: DASHBOARD_REFRESH_MS })
}

export function useOverdueMaintenance() {
  return useQuery(() =>
    supabase.from('v_maintenance_due')
      .select('*')
      .eq('due_state', 'Overdue')
      .order('hours_remaining', { ascending: true, nullsFirst: false })
  , [], { refetchInterval: DASHBOARD_REFRESH_MS })
}

// Ordered checklist of every hour-tracked item, for the readings entry form.
export function useHoursTrackedEquipment() {
  return useQuery(() =>
    supabase.from('v_equipment_current_status')
      .select('*')
      .eq('is_hours_tracked', true)
      .order('line').order('equipment').order('component_type')
  )
}

// Tasks for one specific piece of equipment, filtered to a single due_state
// (e.g. the "2 overdue" badge on a single DG's card)
export function useEquipmentTasks(criteria) {
  return useQuery(() => {
    if (!criteria) return Promise.resolve({ data: [], error: null })
    return supabase
      .from('v_maintenance_due')
      .select('*')
      .eq('line', criteria.line)
      .eq('equipment', criteria.equipment)
      .eq('component_type', criteria.component_type)
      .eq('due_state', criteria.dueState)
      .order('hours_remaining', { ascending: true, nullsFirst: false })
  }, [criteria?.line, criteria?.equipment, criteria?.component_type, criteria?.dueState])
}
