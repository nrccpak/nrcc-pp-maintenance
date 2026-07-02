import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { ErrorBanner } from '../components/ui'

const DATA_STATUS_STYLES = {
  'Confirmed':    'bg-st-run/10 text-st-run border border-st-run/40',
  'Field-verify': 'bg-st-warn/10  text-st-warn  border border-st-warn/40',
  'GAP':          'bg-st-over/10    text-st-over    border border-st-over/40',
  'Partial-GAP':  'bg-orange-900/30 text-orange-400 border border-orange-800/60',
}

function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono whitespace-nowrap ${DATA_STATUS_STYLES[status] || 'bg-panel-raised text-ink-mid'}`}>
      {status}
    </span>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[10px] text-ink-lo uppercase tracking-widest mb-1">{label}</div>
      <div className="text-ink-hi text-sm leading-snug">
        {value || <span className="text-ink-lo italic">—</span>}
      </div>
    </div>
  )
}

const PAGE_SIZE = 25

const LINE_OPTIONS   = ['Line-1', 'Line-2', 'Common']
const STATUS_OPTIONS = ['Confirmed', 'Field-verify', 'GAP', 'Partial-GAP']

export default function EquipmentRegistry() {
  /* ── data ─────────────────────────────────────────────────── */
  const [rows,      setRows]      = useState([])
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState('')
  const [systems,   setSystems]   = useState([])
  const [summary,   setSummary]   = useState({})

  /* ── filters ──────────────────────────────────────────────── */
  const [search,       setSearch]       = useState('')
  const [filterLine,   setFilterLine]   = useState('')
  const [filterSystem, setFilterSystem] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page,         setPage]         = useState(0)

  /* ── detail panel ─────────────────────────────────────────── */
  const [selected,    setSelected]    = useState(null)
  const [editing,     setEditing]     = useState(false)
  const [editStatus,  setEditStatus]  = useState('')
  const [editRemarks, setEditRemarks] = useState('')
  const [saving,      setSaving]      = useState(false)
  const [saveError,   setSaveError]   = useState('')

  /* ── load reference data ──────────────────────────────────── */
  useEffect(() => {
    supabase.from('systems').select('system_name').order('system_name')
      .then(({ data }) => setSystems((data || []).map(r => r.system_name)))

    // status summary counts
    supabase.from('equipment').select('data_status')
      .then(({ data }) => {
        if (!data) return
        const counts = {}
        data.forEach(r => { counts[r.data_status] = (counts[r.data_status] || 0) + 1 })
        setSummary(counts)
      })
  }, [])

  /* ── load filtered table ──────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    let q = supabase
      .from('equipment')
      .select('*', { count: 'exact' })
      .order('line').order('equipment').order('component_type')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (search)       q = q.or(`description.ilike.%${search}%,equipment.ilike.%${search}%,component_type.ilike.%${search}%,location.ilike.%${search}%,specification.ilike.%${search}%`)
    if (filterLine)   q = q.eq('line',        filterLine)
    if (filterSystem) q = q.eq('system',      filterSystem)
    if (filterStatus) q = q.eq('data_status', filterStatus)

    const { data, count, error } = await q
    if (error) setLoadError(error.message)
    else { setRows(data || []); setTotal(count || 0) }
    setLoading(false)
  }, [search, filterLine, filterSystem, filterStatus, page])

  // reset to page 0 whenever filters change
  useEffect(() => { setPage(0) }, [search, filterLine, filterSystem, filterStatus])
  useEffect(() => { load() }, [load])

  /* ── detail panel helpers ─────────────────────────────────── */
  const openDetail = (row) => {
    setSelected(row)
    setEditing(false)
    setSaveError('')
    setEditStatus(row.data_status)
    setEditRemarks(row.remarks || '')
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    const { error } = await supabase
      .from('equipment')
      .update({ data_status: editStatus, remarks: editRemarks })
      .eq('line',           selected.line)
      .eq('equipment',      selected.equipment)
      .eq('component_type', selected.component_type)

    if (error) {
      setSaveError(error.code === '42501'
        ? 'Write access requires login. Auth setup is in a later phase.'
        : error.message)
    } else {
      const updated = { ...selected, data_status: editStatus, remarks: editRemarks }
      setSelected(updated)
      setRows(prev => prev.map(r =>
        r.line === selected.line && r.equipment === selected.equipment && r.component_type === selected.component_type
          ? updated : r
      ))
      // refresh summary counts
      supabase.from('equipment').select('data_status').then(({ data }) => {
        if (!data) return
        const counts = {}
        data.forEach(r => { counts[r.data_status] = (counts[r.data_status] || 0) + 1 })
        setSummary(counts)
      })
      setEditing(false)
    }
    setSaving(false)
  }

  /* ── derived ──────────────────────────────────────────────── */
  const totalPages   = Math.ceil(total / PAGE_SIZE)
  const hasFilters   = search || filterLine || filterSystem || filterStatus
  const clearFilters = () => { setSearch(''); setFilterLine(''); setFilterSystem(''); setFilterStatus('') }

  /* ── render ───────────────────────────────────────────────── */
  return (
    <div className="flex h-full">

      {/* ── MAIN COLUMN ────────────────────────────────────── */}
      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-200 ${selected ? 'pr-[26rem]' : ''}`}>

        {/* header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-ink-hi tracking-tight">Equipment Registry</h1>
          <p className="text-ink-mid text-sm mt-0.5">
            {total} component{total !== 1 ? 's' : ''} · component-level granularity
          </p>
        </div>

        {/* status summary pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border transition-all
                ${filterStatus === s
                  ? DATA_STATUS_STYLES[s]
                  : 'bg-panel-surface border-panel-line2 text-ink-mid hover:border-ink-lo'
                }`}
            >
              <span className="font-bold text-sm">{summary[s] ?? '…'}</span>
              {s}
            </button>
          ))}
        </div>

        {/* filter bar */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <input
            type="text"
            placeholder="Search equipment, component, description, location…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-panel-surface border border-panel-line2 text-ink-hi placeholder-ink-lo
                       rounded px-3 py-1.5 text-sm w-80 focus:outline-none focus:border-blue-500/70"
          />

          <select value={filterLine} onChange={e => setFilterLine(e.target.value)}
            className="bg-panel-surface border border-panel-line2 text-ink-mid rounded px-3 py-1.5 text-sm">
            <option value="">All Lines</option>
            {LINE_OPTIONS.map(l => <option key={l}>{l}</option>)}
          </select>

          <select value={filterSystem} onChange={e => setFilterSystem(e.target.value)}
            className="bg-panel-surface border border-panel-line2 text-ink-mid rounded px-3 py-1.5 text-sm">
            <option value="">All Systems</option>
            {systems.map(s => <option key={s}>{s}</option>)}
          </select>

          {hasFilters && (
            <button onClick={clearFilters}
              className="text-xs text-ink-lo hover:text-ink-hi underline underline-offset-2 ml-1">
              Clear filters
            </button>
          )}
        </div>

        {/* table */}
        <div className="bg-panel-surface border border-panel-line2 rounded-lg overflow-hidden flex-1 flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm min-w-[780px]">
              <thead>
                <tr className="border-b border-panel-line2 text-[10px] text-ink-lo uppercase tracking-widest">
                  <th className="text-left px-4 py-3 font-medium">Line</th>
                  <th className="text-left px-4 py-3 font-medium">Equipment</th>
                  <th className="text-left px-4 py-3 font-medium">Component</th>
                  <th className="text-left px-4 py-3 font-medium">System</th>
                  <th className="text-left px-4 py-3 font-medium">Description</th>
                  <th className="text-left px-4 py-3 font-medium">Location</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-ink-lo">
                      <div className="inline-block w-5 h-5 border-2 border-panel-line2 border-t-ink-mid rounded-full animate-spin mb-2" />
                      <div className="text-xs">Loading equipment…</div>
                    </td>
                  </tr>
                ) : loadError ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6">
                      <ErrorBanner message={loadError} onRetry={load} />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-ink-lo text-sm">
                      No equipment matches your filters.
                    </td>
                  </tr>
                ) : rows.map((row, i) => {
                  const isSelected = selected?.line === row.line
                    && selected?.equipment === row.equipment
                    && selected?.component_type === row.component_type
                  return (
                    <tr
                      key={`${row.line}|${row.equipment}|${row.component_type}`}
                      onClick={() => openDetail(row)}
                      className={`border-b border-panel-line cursor-pointer transition-colors
                        ${isSelected
                          ? 'bg-panel-raised border-l-2 border-l-blue-500'
                          : i % 2 === 0
                            ? 'hover:bg-panel-raised'
                            : 'bg-panel-bg/40 hover:bg-panel-raised'
                        }`}
                    >
                      <td className="px-4 py-2.5 text-ink-lo text-xs font-mono whitespace-nowrap">{row.line}</td>
                      <td className="px-4 py-2.5 text-ink-hi font-medium whitespace-nowrap">{row.equipment}</td>
                      <td className="px-4 py-2.5 text-ink-mid whitespace-nowrap">{row.component_type}</td>
                      <td className="px-4 py-2.5 text-ink-mid text-xs whitespace-nowrap">{row.system}</td>
                      <td className="px-4 py-2.5 text-ink-mid max-w-[220px] truncate" title={row.description}>{row.description}</td>
                      <td className="px-4 py-2.5 text-ink-lo text-xs whitespace-nowrap">{row.location}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={row.data_status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-panel-line2 text-xs text-ink-lo">
              <span>
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total} components
              </span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
                  className="px-3 py-1 rounded bg-panel-line text-ink-mid disabled:opacity-30 hover:bg-panel-line2">
                  ← Prev
                </button>
                {(() => {
                  // show up to 7 page buttons centred around current page
                  const range = []
                  const start = Math.max(0, Math.min(page - 3, totalPages - 7))
                  const end   = Math.min(totalPages - 1, start + 6)
                  for (let p = start; p <= end; p++) range.push(p)
                  return range.map(p => (
                    <button key={p} onClick={() => setPage(p)}
                      className={`px-3 py-1 rounded text-xs
                        ${p === page ? 'bg-blue-600 text-white' : 'bg-panel-line text-ink-mid hover:bg-panel-line2'}`}>
                      {p + 1}
                    </button>
                  ))
                })()}
                <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages - 1}
                  className="px-3 py-1 rounded bg-panel-line text-ink-mid disabled:opacity-30 hover:bg-panel-line2">
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── DETAIL PANEL ────────────────────────────────────── */}
      {selected && (
        <div className="fixed right-0 top-0 h-full w-[26rem] bg-panel-surface border-l border-panel-line2
                        flex flex-col z-20 shadow-2xl">

          {/* panel header */}
          <div className="flex items-start justify-between px-5 pt-5 pb-4
                          border-b border-panel-line2 sticky top-0 bg-panel-surface z-10">
            <div className="flex-1 min-w-0 pr-3">
              <div className="text-[10px] text-ink-lo font-mono uppercase tracking-widest mb-1">{selected.line}</div>
              <div className="text-ink-hi font-semibold text-lg leading-tight truncate">{selected.equipment}</div>
              <div className="text-ink-mid text-sm mt-0.5">{selected.component_type}</div>
            </div>
            <button onClick={() => setSelected(null)}
              className="text-ink-lo hover:text-ink-hi text-2xl leading-none mt-0.5 flex-shrink-0">
              ×
            </button>
          </div>

          {/* panel body — scrollable */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

            {/* data status */}
            <div>
              <div className="text-[10px] text-ink-lo uppercase tracking-widest mb-2">Data Status</div>
              {editing ? (
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                  className="bg-panel-bg border border-panel-line2 text-ink-hi rounded
                             px-3 py-1.5 text-sm w-full focus:outline-none focus:border-blue-500/70">
                  {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              ) : (
                <StatusBadge status={selected.data_status} />
              )}
            </div>

            <div className="border-t border-panel-line" />

            <Field label="System"        value={selected.system} />
            <Field label="Description"   value={selected.description} />
            <Field label="Location"      value={selected.location} />
            <Field label="Specification" value={selected.specification} />

            {/* remarks */}
            <div>
              <div className="text-[10px] text-ink-lo uppercase tracking-widest mb-2">Remarks</div>
              {editing ? (
                <textarea
                  value={editRemarks}
                  onChange={e => setEditRemarks(e.target.value)}
                  rows={3}
                  placeholder="Add a remark…"
                  className="w-full bg-panel-bg border border-panel-line2 text-ink-hi rounded
                             px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500/70"
                />
              ) : (
                <div className="text-ink-mid text-sm leading-relaxed">
                  {selected.remarks || <span className="text-ink-lo italic">—</span>}
                </div>
              )}
            </div>

            {saveError && (
              <div className="text-xs text-st-over bg-st-over/10 border border-st-over/40 rounded px-3 py-2">
                {saveError}
              </div>
            )}
          </div>

          {/* panel footer */}
          <div className="px-5 py-4 border-t border-panel-line2 sticky bottom-0 bg-panel-surface">
            {editing ? (
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                             text-white text-sm font-medium py-2 rounded transition-colors">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button onClick={() => { setEditing(false); setSaveError('') }}
                  className="px-4 text-sm text-ink-mid hover:text-ink-hi
                             border border-panel-line2 hover:border-ink-lo rounded transition-colors">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setEditing(true)}
                className="w-full border border-panel-line2 hover:border-blue-500/60
                           text-ink-mid hover:text-ink-hi text-sm py-2 rounded transition-colors">
                Edit Status / Remarks
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

