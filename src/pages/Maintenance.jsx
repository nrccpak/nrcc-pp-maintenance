import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { PageHeader, PageLoader } from '../components/ui'
import { fmtHoursUnit as fmtHours, todayStr } from '../lib/format'
import { HIST_PAGE_SIZE, SERVICE_TIER_CHAIN, normalizeState } from './maintenance/constants'
import TaskBoardTab from './maintenance/TaskBoardTab'
import HistoryTab from './maintenance/HistoryTab'
import TaskDetailPanel from './maintenance/TaskDetailPanel'
import LogCompletionModal from './maintenance/LogCompletionModal'

/* ── main component ───────────────────────────────────────────────────── */
export default function Maintenance() {

  /* ── state ──────────────────────────────────────────────────────── */
  const [tasks,    setTasks]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [loadError,setLoadError]= useState('')
  const [collapsed,setCollapsed]= useState({})   // { Overdue: false, … }

  const [search,      setSearch]      = useState('')
  const [filterLine,  setFilterLine]  = useState('')
  const [filterBasis, setFilterBasis] = useState('')

  const [selected,       setSelected]       = useState(null)
  const [taskDetail,     setTaskDetail]     = useState(null)  // full maintenance_status row
  const [history,        setHistory]        = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // log completion modal
  const [modal,      setModal]      = useState(false)
  const [logHours,   setLogHours]   = useState('')
  const [logDate,    setLogDate]    = useState(todayStr())
  const [logDesc,    setLogDesc]    = useState('')
  const [logSaving,  setLogSaving]  = useState(false)
  const [logError,   setLogError]   = useState('')

  // nested PM interval sweep-in candidates (lower-tier tasks due to be
  // closed alongside a higher-tier Engine service)
  const [sweepCandidates, setSweepCandidates] = useState([])
  const [sweepChecked,    setSweepChecked]    = useState({})
  const [sweepLoading,    setSweepLoading]    = useState(false)

  // history log tab
  const [activeTab,          setActiveTab]          = useState('tasks')   // 'tasks' | 'history'
  const [allHistory,         setAllHistory]         = useState([])
  const [historyListLoading, setHistoryListLoading] = useState(false)
  const [histSearch,         setHistSearch]         = useState('')
  const [histFilterLine,     setHistFilterLine]     = useState('')
  const [histFilterCategory, setHistFilterCategory] = useState('')
  const [histPage,           setHistPage]           = useState(1)
  const [expandedHistId,     setExpandedHistId]     = useState(null)
  const [histLoadError,      setHistLoadError]      = useState('')

  /* ── data loading ───────────────────────────────────────────────── */
  async function loadTasks() {
    setLoading(true)
    setLoadError('')
    const { data, error } = await supabase
      .from('v_maintenance_due')
      .select('*')
    if (error) { setLoadError(error.message); setLoading(false); return [] }
    const rows = data || []
    setTasks(rows)
    setLoading(false)
    return rows
  }

  useEffect(() => { loadTasks() }, [])

  useEffect(() => {
    if (!selected) { setTaskDetail(null); setHistory([]); return }

    supabase.from('maintenance_status').select('*').eq('id', selected.id).single()
      .then(({ data }) => setTaskDetail(data || null))

    setHistoryLoading(true)
    supabase
      .from('maintenance_history')
      .select('*')
      .eq('line',           selected.line)
      .eq('equipment',      selected.equipment)
      .eq('component_type', selected.component_type)
      .order('work_date', { ascending: false })
      .then(({ data }) => { setHistory(data || []); setHistoryLoading(false) })
  }, [selected])

  async function loadAllHistory() {
    setHistoryListLoading(true)
    setHistLoadError('')
    const { data, error } = await supabase
      .from('maintenance_history')
      .select('*')
      .order('work_date', { ascending: false })
    if (error) { setHistLoadError(error.message); setHistoryListLoading(false); return }
    setAllHistory(data || [])
    setHistoryListLoading(false)
  }

  useEffect(() => {
    if (activeTab === 'history') loadAllHistory()
  }, [activeTab])

  useEffect(() => { setHistPage(1) }, [histSearch, histFilterLine, histFilterCategory])

  /* ── derived / filter / group ───────────────────────────────────── */
  const filtered = tasks.filter(t => {
    if (filterLine  && t.line           !== filterLine)  return false
    if (filterBasis && t.interval_basis !== filterBasis) return false
    if (search) {
      const q = search.toLowerCase()
      return (t.equipment      || '').toLowerCase().includes(q)
          || (t.component_type || '').toLowerCase().includes(q)
          || (t.task_name      || '').toLowerCase().includes(q)
    }
    return true
  })

  const counts = {}
  tasks.forEach(t => {
    const key = normalizeState(t.due_state)
    counts[key] = (counts[key] || 0) + 1
  })

  const toggleGroup = key =>
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))

  const histFiltered = allHistory.filter(h => {
    if (histFilterLine     && h.line          !== histFilterLine)     return false
    if (histFilterCategory && h.work_category !== histFilterCategory) return false
    if (histSearch) {
      const q = histSearch.toLowerCase()
      return (h.equipment        || '').toLowerCase().includes(q)
          || (h.component_type   || '').toLowerCase().includes(q)
          || (h.work_description || '').toLowerCase().includes(q)
    }
    return true
  })

  const histTotalPages  = Math.max(1, Math.ceil(histFiltered.length / HIST_PAGE_SIZE))
  const histPageClamped = Math.min(histPage, histTotalPages)
  const histPageItems   = histFiltered.slice(
    (histPageClamped - 1) * HIST_PAGE_SIZE,
    histPageClamped * HIST_PAGE_SIZE
  )

  /* ── log completion ─────────────────────────────────────────────── */

  // When the modal opens on a higher-tier Engine service, find sibling
  // tasks on the same equipment (any component) that are at or below this
  // tier and currently due — candidates to sweep-close alongside it.
  useEffect(() => {
    if (!modal || !selected) { setSweepCandidates([]); setSweepChecked({}); return }

    const isTrigger = selected.component_type === 'Engine'
      && selected.interval_basis === 'Hours'
      && SERVICE_TIER_CHAIN.includes(selected.task_name)

    if (!isTrigger) { setSweepCandidates([]); setSweepChecked({}); return }

    setSweepLoading(true)
    Promise.all([
      supabase.from('maintenance_status')
        .select('id, interval_hours')
        .eq('line', selected.line)
        .eq('equipment', selected.equipment)
        .eq('interval_basis', 'Hours'),
      supabase.from('v_maintenance_due')
        .select('*')
        .eq('line', selected.line)
        .eq('equipment', selected.equipment)
        .eq('interval_basis', 'Hours'),
    ]).then(([{ data: statusRows }, { data: dueRows }]) => {
      const intervalById = Object.fromEntries((statusRows || []).map(r => [r.id, Number(r.interval_hours)]))
      const triggerInterval = intervalById[selected.id]
      const siblings = (dueRows || []).filter(t =>
        t.id !== selected.id &&
        triggerInterval != null &&
        intervalById[t.id] != null &&
        intervalById[t.id] <= triggerInterval &&
        (t.due_state === 'Overdue' || t.due_state === 'Due Soon')
      )
      setSweepCandidates(siblings)
      setSweepChecked(Object.fromEntries(siblings.map(s => [s.id, true])))
      setSweepLoading(false)
    })
  }, [modal, selected])

  function computeNextDue() {
    if (!taskDetail) return null
    if (taskDetail.interval_basis === 'Hours') {
      const h = parseFloat(logHours)
      if (isNaN(h) || !taskDetail.interval_hours) return null
      return { next_due_hours: h + Number(taskDetail.interval_hours), next_due_hours_fmt: fmtHours(h + Number(taskDetail.interval_hours)) }
    }
    // Calendar
    if (!logDate || !taskDetail.interval_days) return null
    const d = new Date(logDate)
    d.setDate(d.getDate() + taskDetail.interval_days)
    const s = d.toISOString().slice(0, 10)
    return { next_due_date: s, next_due_date_fmt: s }
  }

  const nextDue = computeNextDue()

  const canSave = () => {
    if (!taskDetail) return false
    if (taskDetail.interval_basis === 'Hours') return !!logHours && !isNaN(parseFloat(logHours))
    return !!logDate
  }

  async function handleLogSave() {
    setLogSaving(true)
    setLogError('')

    // next_due_hours/next_due_date are DB-generated columns (last_done + interval) —
    // only the "last done" baseline is writable; the DB recomputes the rest.
    const updateData = {
      updated_at: new Date().toISOString(),
      ...(taskDetail.interval_basis === 'Hours'
        ? { last_done_hours: parseFloat(logHours) }
        : { last_done_date: logDate }),
    }

    const { error: updErr } = await supabase
      .from('maintenance_status')
      .update(updateData)
      .eq('id', selected.id)

    if (updErr) {
      setLogError(updErr.code === '42501'
        ? 'Write access requires authentication. Auth setup is scheduled for a later phase.'
        : updErr.message)
      setLogSaving(false)
      return
    }

    const { error: histErr } = await supabase.from('maintenance_history').insert({
      line:             selected.line,
      equipment:        selected.equipment,
      component_type:   selected.component_type,
      work_date:        logDate,
      run_hours:        taskDetail.interval_basis === 'Hours' ? parseFloat(logHours) : null,
      work_description: logDesc.trim() || `PM completed: ${selected.task_name}`,
      work_category:    'PMS',
      linked_task_id:   selected.id,
      source:           'Manual entry',
    })

    if (histErr) {
      setLogError(`Completion saved, but the history record failed to save: ${histErr.message}`)
      setLogSaving(false)
      await loadTasks()
      return
    }

    // nested PM interval rule: close confirmed lower-tier siblings alongside
    // this higher-tier service (same equipment, same completion date)
    const confirmedSweeps = sweepCandidates.filter(c => sweepChecked[c.id])
    for (const c of confirmedSweeps) {
      const sameMeterAsTrigger = c.component_type === 'Engine' // shares the engine's physical hour meter
      const closeNote = `Closed as part of ${selected.task_name} performed on ${logDate} — not independently serviced.`

      await supabase.from('maintenance_status').update({
        last_done_date: logDate,
        ...(sameMeterAsTrigger ? { last_done_hours: parseFloat(logHours) } : {}),
        remarks: closeNote,
        updated_at: new Date().toISOString(),
      }).eq('id', c.id)

      await supabase.from('maintenance_history').insert({
        line:             selected.line,
        equipment:        selected.equipment,
        component_type:   c.component_type,
        work_date:        logDate,
        run_hours:        sameMeterAsTrigger ? parseFloat(logHours) : null,
        work_description: closeNote,
        work_category:    'PMS',
        linked_task_id:   c.id,
        source:           'Auto-closed via nested PM rule',
      })
    }

    // refresh tasks + history
    const freshTasks = await loadTasks()
    const { data: hist } = await supabase
      .from('maintenance_history').select('*')
      .eq('line', selected.line).eq('equipment', selected.equipment).eq('component_type', selected.component_type)
      .order('work_date', { ascending: false })
    setHistory(hist || [])

    // re-select updated task from the freshly loaded list
    setSelected(prev => freshTasks.find(t => t.id === prev.id) || prev)

    // reset modal
    setModal(false)
    setLogHours('')
    setLogDate(todayStr())
    setLogDesc('')
    setLogSaving(false)
    setSweepCandidates([])
    setSweepChecked({})
  }

  /* ── render ──────────────────────────────────────────────────────── */
  if (loading) return <PageLoader label="Loading maintenance tasks" />

  return (
    <div className="flex h-full">

      {/* ── MAIN COLUMN ──────────────────────────────────────────────── */}
      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-200 ${selected && activeTab === 'tasks' ? 'pr-[26rem]' : ''}`}>

        <PageHeader
          title="Maintenance Board"
          subtitle={activeTab === 'tasks'
            ? `${tasks.length} scheduled tasks · hours-based and calendar-based`
            : `${allHistory.length} history records · search across all equipment`}
        />

        {/* tab switcher */}
        <div className="flex gap-1 mb-5 bg-panel-surface border border-panel-line rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-3.5 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'tasks' ? 'bg-st-standby/10 text-st-standby' : 'text-ink-mid hover:text-ink-hi'
            }`}>
            Maintenance Board
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'history' ? 'bg-st-standby/10 text-st-standby' : 'text-ink-mid hover:text-ink-hi'
            }`}>
            History Log
          </button>
        </div>

        {activeTab === 'tasks' && (
          <TaskBoardTab
            filtered={filtered}
            counts={counts}
            collapsed={collapsed}
            toggleGroup={toggleGroup}
            search={search} setSearch={setSearch}
            filterLine={filterLine} setFilterLine={setFilterLine}
            filterBasis={filterBasis} setFilterBasis={setFilterBasis}
            selected={selected} setSelected={setSelected}
            loadError={loadError} loadTasks={loadTasks} loading={loading}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab
            histFiltered={histFiltered}
            histPageItems={histPageItems}
            histTotalPages={histTotalPages}
            histPageClamped={histPageClamped}
            setHistPage={setHistPage}
            histSearch={histSearch} setHistSearch={setHistSearch}
            histFilterLine={histFilterLine} setHistFilterLine={setHistFilterLine}
            histFilterCategory={histFilterCategory} setHistFilterCategory={setHistFilterCategory}
            expandedHistId={expandedHistId} setExpandedHistId={setExpandedHistId}
            historyListLoading={historyListLoading} histLoadError={histLoadError}
            loadAllHistory={loadAllHistory}
          />
        )}
      </div>

      {/* ── DETAIL PANEL ─────────────────────────────────────────────── */}
      {selected && activeTab === 'tasks' && (
        <TaskDetailPanel
          selected={selected}
          taskDetail={taskDetail}
          history={history}
          historyLoading={historyLoading}
          onClose={() => setSelected(null)}
          onLogCompletion={() => { setModal(true); setLogError('') }}
        />
      )}

      {/* ── LOG COMPLETION MODAL ─────────────────────────────────────── */}
      {modal && selected && (
        <LogCompletionModal
          selected={selected}
          logHours={logHours} setLogHours={setLogHours}
          logDate={logDate} setLogDate={setLogDate}
          logDesc={logDesc} setLogDesc={setLogDesc}
          nextDue={nextDue}
          sweepLoading={sweepLoading}
          sweepCandidates={sweepCandidates}
          sweepChecked={sweepChecked} setSweepChecked={setSweepChecked}
          logError={logError} logSaving={logSaving} canSave={canSave}
          onSave={handleLogSave}
          onClose={() => { setModal(false); setLogError('') }}
        />
      )}
    </div>
  )
}
