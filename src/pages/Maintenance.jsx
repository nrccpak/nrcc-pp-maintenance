import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ErrorBanner } from '../components/ui'

/* ── helpers ──────────────────────────────────────────────────────────── */
function urgencyDisplay(task) {
  if (task.hours_remaining !== null) {
    const hrs = Math.abs(Math.round(task.hours_remaining))
    return task.hours_remaining < 0
      ? `${hrs.toLocaleString()} hrs overdue`
      : `${hrs.toLocaleString()} hrs remaining`
  }
  if (task.days_remaining !== null) {
    const days = Math.abs(task.days_remaining)
    return task.days_remaining < 0
      ? `${days} days overdue`
      : `${days} days remaining`
  }
  return 'No baseline'
}

function normalizeState(s) {
  return s?.startsWith('Unknown') ? 'Unknown' : (s || 'Unknown')
}

const STATE_ORDER = ['Overdue', 'Due Soon', 'Scheduled', 'Unknown']
const HIST_PAGE_SIZE = 25

const COLORS = {
  'Overdue':  {
    pill:  'bg-st-over/10 text-st-over border border-st-over/40',
    hdr:   'text-st-over',
    dot:   'bg-st-over',
    sel:   'border-l-st-over',
    urg:   'text-st-over',
  },
  'Due Soon': {
    pill:  'bg-st-warn/10 text-st-warn border border-st-warn/40',
    hdr:   'text-st-warn',
    dot:   'bg-st-warn',
    sel:   'border-l-st-warn',
    urg:   'text-st-warn',
  },
  'Scheduled':{
    pill:  'bg-panel-raised text-ink-mid border border-panel-line2',
    hdr:   'text-ink-mid',
    dot:   'bg-ink-lo',
    sel:   'border-l-panel-line2',
    urg:   'text-ink-mid',
  },
  'Unknown':  {
    pill:  'bg-panel-raised text-ink-lo border border-panel-line2',
    hdr:   'text-ink-lo',
    dot:   'bg-st-idle',
    sel:   'border-l-panel-line2',
    urg:   'text-ink-lo',
  },
}

/* ── sub-components ───────────────────────────────────────────────────── */
function InfoTile({ label, value, mono = true }) {
  return (
    <div className="bg-panel-bg rounded-lg p-3 border border-panel-line">
      <div className="text-[9px] text-ink-lo uppercase tracking-widest mb-1">{label}</div>
      <div className={`text-ink-hi text-sm ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</div>
    </div>
  )
}

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

  /* ── helpers ────────────────────────────────────────────────────── */
  function todayStr() { return new Date().toISOString().slice(0, 10) }

  function fmtHours(n) {
    if (n == null) return '—'
    return Number(n).toLocaleString() + ' hrs'
  }

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

  const grouped = {}
  filtered.forEach(t => {
    const key = normalizeState(t.due_state)
    ;(grouped[key] = grouped[key] || []).push(t)
  })
  // sort each group: most urgent first (most negative hours_remaining)
  Object.values(grouped).forEach(arr =>
    arr.sort((a, b) => (a.hours_remaining ?? 0) - (b.hours_remaining ?? 0))
  )

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
  }

  /* ── render ──────────────────────────────────────────────────────── */
  if (loading) return (
    <div className="flex items-center justify-center h-64 text-ink-lo">
      <div className="text-center">
        <div className="w-6 h-6 border-2 border-panel-line2 border-t-ink-mid rounded-full animate-spin mx-auto mb-3" />
        <div className="text-sm">Loading maintenance tasks…</div>
      </div>
    </div>
  )

  return (
    <div className="flex h-full">

      {/* ── MAIN COLUMN ──────────────────────────────────────────────── */}
      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-200 ${selected && activeTab === 'tasks' ? 'pr-[26rem]' : ''}`}>

        <div className="mb-5">
          <h1 className="text-2xl font-bold text-ink-hi tracking-tight">Maintenance Board</h1>
          <p className="text-ink-mid text-sm mt-0.5">
            {activeTab === 'tasks'
              ? `${tasks.length} scheduled tasks · hours-based and calendar-based`
              : `${allHistory.length} history records · search across all equipment`}
          </p>
        </div>

        {/* tab switcher */}
        <div className="flex gap-1 mb-5 bg-panel-surface border border-panel-line2 rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-3.5 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'tasks' ? 'bg-[#0d1b2a] text-blue-400' : 'text-ink-mid hover:text-ink-hi'
            }`}>
            Maintenance Board
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'history' ? 'bg-[#0d1b2a] text-blue-400' : 'text-ink-mid hover:text-ink-hi'
            }`}>
            History Log
          </button>
        </div>

        {activeTab === 'tasks' && (
        <>
        {/* summary pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {STATE_ORDER.map(key => counts[key] ? (
            <div key={key} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border ${COLORS[key].pill}`}>
              <span className="font-bold text-sm">{counts[key]}</span>
              {key}
            </div>
          ) : null)}
        </div>

        {/* filter bar */}
        <div className="flex flex-wrap gap-2 mb-5 items-center">
          <input
            type="text"
            placeholder="Search equipment, component, task…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-panel-surface border border-panel-line2 text-ink-hi placeholder-ink-lo
                       rounded px-3 py-1.5 text-sm w-72 focus:outline-none focus:border-blue-500/70"
          />
          <select value={filterLine} onChange={e => setFilterLine(e.target.value)}
            className="bg-panel-surface border border-panel-line2 text-ink-mid rounded px-3 py-1.5 text-sm">
            <option value="">All Lines</option>
            {['Line-1', 'Line-2', 'Common'].map(l => <option key={l}>{l}</option>)}
          </select>
          <select value={filterBasis} onChange={e => setFilterBasis(e.target.value)}
            className="bg-panel-surface border border-panel-line2 text-ink-mid rounded px-3 py-1.5 text-sm">
            <option value="">All Intervals</option>
            <option value="Hours">Hours-based</option>
            <option value="Calendar">Calendar-based</option>
          </select>
          {(search || filterLine || filterBasis) && (
            <button
              onClick={() => { setSearch(''); setFilterLine(''); setFilterBasis('') }}
              className="text-xs text-ink-lo hover:text-ink-hi underline underline-offset-2">
              Clear
            </button>
          )}
        </div>

        {/* grouped sections */}
        <div className="space-y-3">
          {STATE_ORDER.map(key => {
            const items = grouped[key]
            if (!items?.length) return null
            const c = COLORS[key]
            const open = !collapsed[key]
            return (
              <div key={key} className="bg-panel-surface border border-panel-line2 rounded-lg overflow-hidden">

                {/* section header */}
                <button
                  onClick={() => toggleGroup(key)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-panel-raised transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                    <span className={`text-sm font-semibold ${c.hdr}`}>{key}</span>
                    <span className="text-xs text-ink-lo font-mono">
                      {items.length} task{items.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="text-ink-lo text-xs">{open ? '▾' : '▸'}</span>
                </button>

                {/* section rows */}
                {open && (
                  <div className="border-t border-panel-line2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] text-ink-lo uppercase tracking-widest border-b border-panel-line">
                          <th className="text-left px-4 py-2 font-medium">Equipment</th>
                          <th className="text-left px-4 py-2 font-medium">Task</th>
                          <th className="text-left px-4 py-2 font-medium w-24">Interval</th>
                          <th className="text-left px-4 py-2 font-medium w-40">Urgency</th>
                          <th className="text-left px-4 py-2 font-medium w-32">Next Due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((t, i) => {
                          const isSel = selected?.id === t.id
                          return (
                            <tr
                              key={t.id}
                              onClick={() => setSelected(isSel ? null : t)}
                              className={`border-b border-panel-line cursor-pointer transition-colors border-l-2
                                ${isSel
                                  ? `bg-panel-raised ${c.sel}`
                                  : `border-l-transparent ${i % 2 === 0 ? 'hover:bg-panel-raised' : 'bg-panel-bg/40 hover:bg-panel-raised'}`
                                }`}
                            >
                              <td className="px-4 py-2.5">
                                <div className="text-ink-hi font-medium text-sm leading-tight">{t.equipment}</div>
                                <div className="text-ink-lo text-[10px] font-mono mt-0.5">{t.line} · {t.component_type}</div>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="text-ink-mid text-sm truncate max-w-[220px]" title={t.task_name}>{t.task_name}</div>
                              </td>
                              <td className="px-4 py-2.5 text-ink-lo text-xs">{t.interval_basis}</td>
                              <td className="px-4 py-2.5">
                                <span className={`text-xs font-mono ${c.urg}`}>{urgencyDisplay(t)}</span>
                              </td>
                              <td className="px-4 py-2.5 text-ink-mid text-xs font-mono whitespace-nowrap">
                                {t.next_due_hours
                                  ? `${Number(t.next_due_hours).toLocaleString()} hrs`
                                  : t.next_due_date || '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}

          {loadError && !loading && (
            <ErrorBanner message={loadError} onRetry={loadTasks} />
          )}

          {!loadError && filtered.length === 0 && !loading && (
            <div className="text-center py-16 text-ink-lo text-sm">
              No tasks match your filters.
            </div>
          )}
        </div>
        </>
        )}

        {activeTab === 'history' && (
          <div>
            {/* history filter bar */}
            <div className="flex flex-wrap gap-2 mb-5 items-center">
              <input
                type="text"
                placeholder="Search equipment, component, description…"
                value={histSearch}
                onChange={e => setHistSearch(e.target.value)}
                className="bg-panel-surface border border-panel-line2 text-ink-hi placeholder-ink-lo
                           rounded px-3 py-1.5 text-sm w-72 focus:outline-none focus:border-blue-500/70"
              />
              <select value={histFilterLine} onChange={e => setHistFilterLine(e.target.value)}
                className="bg-panel-surface border border-panel-line2 text-ink-mid rounded px-3 py-1.5 text-sm">
                <option value="">All Lines</option>
                {['Line-1', 'Line-2', 'Common'].map(l => <option key={l}>{l}</option>)}
              </select>
              <select value={histFilterCategory} onChange={e => setHistFilterCategory(e.target.value)}
                className="bg-panel-surface border border-panel-line2 text-ink-mid rounded px-3 py-1.5 text-sm">
                <option value="">All Categories</option>
                {['Routine Maintenance', 'Defect', 'PMS', 'CBM', 'Routine analysis', 'Weekly', 'Overhaul', 'Other'].map(c => <option key={c}>{c}</option>)}
              </select>
              {(histSearch || histFilterLine || histFilterCategory) && (
                <button
                  onClick={() => { setHistSearch(''); setHistFilterLine(''); setHistFilterCategory('') }}
                  className="text-xs text-ink-lo hover:text-ink-hi underline underline-offset-2">
                  Clear
                </button>
              )}
            </div>

            {/* history table */}
            {historyListLoading ? (
              <div className="flex items-center justify-center h-48 text-ink-lo">
                <div className="text-center">
                  <div className="w-6 h-6 border-2 border-panel-line2 border-t-ink-mid rounded-full animate-spin mx-auto mb-3" />
                  <div className="text-sm">Loading history…</div>
                </div>
              </div>
            ) : histLoadError ? (
              <ErrorBanner message={histLoadError} onRetry={loadAllHistory} />
            ) : histFiltered.length === 0 ? (
              <div className="text-center py-16 text-ink-lo text-sm">
                No history records match your filters.
              </div>
            ) : (
              <>
                <div className="bg-panel-surface border border-panel-line2 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] text-ink-lo uppercase tracking-widest border-b border-panel-line">
                        <th className="text-left px-4 py-2 font-medium w-28">Date</th>
                        <th className="text-left px-4 py-2 font-medium">Equipment</th>
                        <th className="text-left px-4 py-2 font-medium w-24">Run Hrs</th>
                        <th className="text-left px-4 py-2 font-medium w-36">Category</th>
                        <th className="text-left px-4 py-2 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {histPageItems.map((h, i) => {
                        const isOpen = expandedHistId === h.id
                        return (
                          <tr
                            key={h.id}
                            onClick={() => setExpandedHistId(isOpen ? null : h.id)}
                            className={`border-b border-panel-line cursor-pointer transition-colors
                              ${isOpen ? 'bg-panel-raised' : i % 2 === 0 ? 'hover:bg-panel-raised' : 'bg-panel-bg/40 hover:bg-panel-raised'}`}
                          >
                            <td className="px-4 py-2.5 text-ink-lo text-xs font-mono whitespace-nowrap">
                              {h.work_date || h.work_date_text || '—'}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="text-ink-hi font-medium text-sm leading-tight">{h.equipment || '—'}</div>
                              <div className="text-ink-lo text-[10px] font-mono mt-0.5">{h.line} · {h.component_type}</div>
                            </td>
                            <td className="px-4 py-2.5 text-ink-mid text-xs font-mono">
                              {h.run_hours ? Number(h.run_hours).toLocaleString() : '—'}
                            </td>
                            <td className="px-4 py-2.5">
                              {h.work_category && (
                                <span className="text-[9px] bg-panel-raised text-ink-lo px-1.5 py-0.5 rounded font-mono">
                                  {h.work_category}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-ink-mid text-xs leading-relaxed">
                              <div className={isOpen ? '' : 'truncate max-w-[420px]'} title={isOpen ? undefined : h.work_description}>
                                {h.work_description}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* pagination */}
                <div className="flex items-center justify-between mt-4 text-xs text-ink-lo">
                  <div>
                    Showing {(histPageClamped - 1) * HIST_PAGE_SIZE + 1}
                    –{Math.min(histPageClamped * HIST_PAGE_SIZE, histFiltered.length)} of {histFiltered.length}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setHistPage(p => Math.max(1, p - 1))}
                      disabled={histPageClamped <= 1}
                      className="px-2.5 py-1 border border-panel-line2 rounded hover:border-ink-lo hover:text-ink-hi disabled:opacity-30 disabled:cursor-not-allowed">
                      ← Prev
                    </button>
                    <span className="font-mono">Page {histPageClamped} of {histTotalPages}</span>
                    <button
                      onClick={() => setHistPage(p => Math.min(histTotalPages, p + 1))}
                      disabled={histPageClamped >= histTotalPages}
                      className="px-2.5 py-1 border border-panel-line2 rounded hover:border-ink-lo hover:text-ink-hi disabled:opacity-30 disabled:cursor-not-allowed">
                      Next →
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── DETAIL PANEL ─────────────────────────────────────────────── */}
      {selected && activeTab === 'tasks' && (
        <div className="fixed right-0 top-0 h-full w-[26rem] bg-panel-surface border-l border-panel-line2 flex flex-col z-20 shadow-2xl">

          {/* header */}
          <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-panel-line2 sticky top-0 bg-panel-surface">
            <div className="flex-1 min-w-0 pr-3">
              <div className="text-[10px] text-ink-lo font-mono uppercase tracking-widest mb-1">
                {selected.line} · {selected.component_type}
              </div>
              <div className="text-ink-hi font-semibold text-lg leading-tight">{selected.equipment}</div>
              <div className="text-ink-mid text-sm mt-1 leading-snug">{selected.task_name}</div>
            </div>
            <button onClick={() => setSelected(null)}
              className="text-ink-lo hover:text-ink-hi text-2xl leading-none mt-0.5 flex-shrink-0">
              ×
            </button>
          </div>

          {/* body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* urgency banner */}
            <div className={`rounded-lg px-4 py-3 border ${
              normalizeState(selected.due_state) === 'Overdue'  ? 'bg-st-over/20  border-st-over/40' :
              normalizeState(selected.due_state) === 'Due Soon' ? 'bg-st-warn/20 border-st-warn/40' :
              normalizeState(selected.due_state) === 'Scheduled'? 'bg-panel-raised border-panel-line2' :
              'bg-panel-raised border-panel-line2'
            }`}>
              <div className="text-[9px] text-ink-lo uppercase tracking-widest mb-1">Urgency</div>
              <div className={`font-mono font-bold text-base ${COLORS[normalizeState(selected.due_state)].urg}`}>
                {urgencyDisplay(selected)}
              </div>
            </div>

            {/* stats grid */}
            <div className="grid grid-cols-2 gap-2">
              <InfoTile label="Current Hours"
                value={selected.current_hours ? fmtHours(selected.current_hours) : '—'} />
              <InfoTile label="Next Due"
                value={selected.next_due_hours
                  ? fmtHours(selected.next_due_hours)
                  : selected.next_due_date || '—'} />
              <InfoTile label="Interval"
                value={taskDetail
                  ? (taskDetail.interval_hours ? fmtHours(taskDetail.interval_hours) : `${taskDetail.interval_days} days`)
                  : '…'} />
              <InfoTile label="Basis"    value={selected.interval_basis} />
            </div>

            {/* last done */}
            {taskDetail && (taskDetail.last_done_hours || taskDetail.last_done_date) && (
              <div>
                <div className="text-[10px] text-ink-lo uppercase tracking-widest mb-1">Last Done</div>
                <div className="text-ink-mid text-sm font-mono">
                  {taskDetail.last_done_hours ? fmtHours(taskDetail.last_done_hours) : ''}
                  {taskDetail.last_done_date  ? ` · ${taskDetail.last_done_date}` : ''}
                </div>
              </div>
            )}

            {taskDetail?.remarks && (
              <div>
                <div className="text-[10px] text-ink-lo uppercase tracking-widest mb-1">Remarks</div>
                <div className="text-ink-mid text-sm">{taskDetail.remarks}</div>
              </div>
            )}

            <div className="border-t border-panel-line my-1" />

            {/* maintenance history */}
            <div>
              <div className="text-[10px] text-ink-lo uppercase tracking-widest mb-3">
                Maintenance History{history.length > 0 ? ` (${history.length})` : ''}
              </div>

              {historyLoading ? (
                <div className="text-xs text-ink-lo text-center py-6">Loading history…</div>
              ) : history.length === 0 ? (
                <div className="text-xs text-ink-lo italic text-center py-6">
                  No history records for this component.
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map(h => (
                    <div key={h.id} className="bg-panel-bg rounded-lg p-3 border border-panel-line">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-ink-lo font-mono">
                          {h.work_date}
                          {h.run_hours ? ` · ${Number(h.run_hours).toLocaleString()} hrs` : ''}
                        </span>
                        {h.work_category && (
                          <span className="text-[9px] bg-panel-raised text-ink-lo px-1.5 py-0.5 rounded font-mono">
                            {h.work_category}
                          </span>
                        )}
                      </div>
                      <div className="text-ink-mid text-xs leading-relaxed">{h.work_description}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* footer */}
          <div className="px-5 py-4 border-t border-panel-line2 sticky bottom-0 bg-panel-surface">
            <button
              onClick={() => { setModal(true); setLogError('') }}
              className="w-full bg-st-run/10 hover:bg-st-run/20 border border-st-run/40
                         hover:border-st-run/60 text-st-run
                         text-sm font-medium py-2.5 rounded transition-colors">
              ✓ Log Completion
            </button>
          </div>
        </div>
      )}

      {/* ── LOG COMPLETION MODAL ─────────────────────────────────────── */}
      {modal && selected && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={e => { if (e.target === e.currentTarget) { setModal(false); setLogError('') } }}
        >
          <div className="bg-panel-surface border border-panel-line2 rounded-xl w-full max-w-md mx-4 shadow-2xl">

            <div className="px-6 pt-6 pb-4 border-b border-panel-line2">
              <div className="text-ink-hi font-semibold text-base">Log Completion</div>
              <div className="text-ink-mid text-sm mt-0.5 leading-snug">
                {selected.equipment} · {selected.task_name}
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">

              {/* hours or date input */}
              {selected.interval_basis === 'Hours' ? (
                <div>
                  <label className="block text-[10px] text-ink-lo uppercase tracking-widest mb-2">
                    Run Hours at Completion
                  </label>
                  <input
                    type="number"
                    value={logHours}
                    onChange={e => setLogHours(e.target.value)}
                    placeholder={selected.current_hours
                      ? `Current reading: ${Number(selected.current_hours).toLocaleString()}`
                      : 'Enter run hours…'}
                    className="w-full bg-panel-bg border border-panel-line2 text-ink-hi rounded
                               px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500/70"
                  />
                  {nextDue && (
                    <div className="mt-2 text-xs text-ink-lo">
                      Next due will be set to{' '}
                      <span className="text-blue-400 font-mono">{nextDue.next_due_hours_fmt}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] text-ink-lo uppercase tracking-widest mb-2">
                    Completion Date
                  </label>
                  <input
                    type="date"
                    value={logDate}
                    onChange={e => setLogDate(e.target.value)}
                    className="w-full bg-panel-bg border border-panel-line2 text-ink-hi rounded
                               px-3 py-2 text-sm focus:outline-none focus:border-blue-500/70"
                  />
                  {nextDue && (
                    <div className="mt-2 text-xs text-ink-lo">
                      Next due will be set to{' '}
                      <span className="text-blue-400 font-mono">{nextDue.next_due_date_fmt}</span>
                    </div>
                  )}
                </div>
              )}

              {/* date field for hours-based tasks */}
              {selected.interval_basis === 'Hours' && (
                <div>
                  <label className="block text-[10px] text-ink-lo uppercase tracking-widest mb-2">
                    Completion Date
                  </label>
                  <input
                    type="date"
                    value={logDate}
                    onChange={e => setLogDate(e.target.value)}
                    className="w-full bg-panel-bg border border-panel-line2 text-ink-hi rounded
                               px-3 py-2 text-sm focus:outline-none focus:border-blue-500/70"
                  />
                </div>
              )}

              {/* work description */}
              <div>
                <label className="block text-[10px] text-ink-lo uppercase tracking-widest mb-2">
                  Work Description{' '}
                  <span className="text-ink-lo normal-case">(optional)</span>
                </label>
                <textarea
                  value={logDesc}
                  onChange={e => setLogDesc(e.target.value)}
                  rows={3}
                  placeholder="Describe the work performed…"
                  className="w-full bg-panel-bg border border-panel-line2 text-ink-hi rounded
                             px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500/70"
                />
              </div>

              {logError && (
                <div className="text-xs text-st-over bg-st-over/10 border border-st-over/40 rounded px-3 py-2.5">
                  {logError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-panel-line2 flex gap-2">
              <button
                onClick={handleLogSave}
                disabled={logSaving || !canSave()}
                className="flex-1 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40
                           disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded transition-colors">
                {logSaving ? 'Saving…' : 'Confirm Completion'}
              </button>
              <button
                onClick={() => { setModal(false); setLogError('') }}
                className="px-4 text-sm text-ink-mid hover:text-ink-hi
                           border border-panel-line2 hover:border-ink-lo rounded transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
