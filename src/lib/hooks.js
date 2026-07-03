import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Generic fetch hook for a view/table with optional query shaping
export function useQuery(builder, deps = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    builder()
      .then(({ data, error }) => {
        if (!active) return
        if (error) setError(error)
        else setData(data)
        setLoading(false)
      })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, error, loading }
}

// KPI rollup for the dashboard header
export function useKpis() {
  return useQuery(async () => {
    const [eq, maint, gaps] = await Promise.all([
      supabase.from('equipment').select('*', { count: 'exact', head: true }),
      supabase.from('v_maintenance_due').select('due_state'),
      supabase.from('v_data_gaps').select('*', { count: 'exact', head: true }),
    ])
    const maintRows = maint.data || []
    return {
      data: {
        totalEquipment: eq.count ?? 0,
        overdue: maintRows.filter(m => m.due_state === 'Overdue').length,
        dueSoon: maintRows.filter(m => m.due_state === 'Due Soon').length,
        dataGaps: gaps.count ?? 0,
      },
      error: eq.error || maint.error || gaps.error,
    }
  })
}

export function useEquipmentStatus() {
  return useQuery(() =>
    supabase.from('v_equipment_current_status')
      .select('*')
      .eq('is_hours_tracked', true)
      .order('overdue_count', { ascending: false })
  )
}

export function useOverdueMaintenance() {
  return useQuery(() =>
    supabase.from('v_maintenance_due')
      .select('*')
      .eq('due_state', 'Overdue')
      .order('hours_remaining', { ascending: true, nullsFirst: false })
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
