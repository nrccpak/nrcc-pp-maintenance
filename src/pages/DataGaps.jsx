import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ErrorBanner, PageHeader, PageLoader } from '../components/ui'

/* ── constants ────────────────────────────────────────────────────────── */
const STATUS_ORDER = ['GAP', 'Partial-GAP', 'Field-verify']

const STATUS_META = {
  'GAP': {
    pill:  'bg-red-50 text-red-700 border border-red-200',
    hdr:   'text-red-700',
    dot:   'bg-red-500',
    sel:   'border-l-red-700',
    badge: 'bg-red-50 text-red-700 border border-red-200',
    desc:  'No data available — field measurement required',
  },
  'Partial-GAP': {
    pill:  'bg-orange-50 text-orange-700 border border-orange-200',
    hdr:   'text-orange-700',
    dot:   'bg-orange-500',
    sel:   'border-l-orange-700',
    badge: 'bg-orange-50 text-orange-700 border border-orange-200',
    desc:  'Partial data present — complete the missing fields in the field',
  },
  'Field-verify': {
    pill:  'bg-amber-50 text-amber-700 border border-amber-200',
    hdr:   'text-amber-700',
    dot:   'bg-amber-500',
    sel:   'border-l-amber-700',
    badge: 'bg-amber-50 text-amber-700 border border-amber-200',
    desc:  'Data recorded — confirm on-site that it matches the actual asset',
  },
}

function StatusBadge({ status }) {
  const s = STATUS_META[status]
  if (!s) return <span className="text-ink-lo text-xs font-mono">{status}</span>
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono whitespace-nowrap border ${s.badge}`}>
      {status}
    </span>
  )
}

/* ── main component ───────────────────────────────────────────────────── */
export default function DataGaps() {

  /* ── state ──────────────────────────────────────────────────────── */
  const [gaps,     setGaps]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [loadError,setLoadError]= useState('')
  const [collapsed,setCollapsed]= useState({})

  const [search,       setSearch]       = useState('')
  const [filterSystem, setFilterSystem] = useState('')
  const [filterLine,   setFilterLine]   = useState('')

  const [selected,     setSelected]     = useState(null)
  const [editStatus,   setEditStatus]   = useState('')
  const [editRemarks,  setEditRemarks]  = useState('')
  const [saving,       setSaving]       = useState(false)
  const [saveError,    setSaveError]    = useState('')
  const [confirmed,    setConfirmed]    = useState(0) // running tally for session

  /* ── load ───────────────────────────────────────────────────────── */
  async function loadGaps() {
    setLoading(true)
    setLoadError('')
    const { data, error } = await supabase
      .from('v_data_gaps')
      .select('*')
    if (error) { setLoadError(error.message); setLoading(false); return }
    setGaps(data || [])
    setLoading(false)
  }

  useEffect(() => { loadGaps() }, [])

  /* ── open detail ─────────────────────────────────────────────────── */
  function openDetail(row) {
    setSelected(row)
    setEditStatus(row.data_status)
    setEditRemarks(row.remarks || '')
    setSaveError('')
  }

  /* ── save ────────────────────────────────────────────────────────── */
  async function handleSave(forceStatus) {
    setSaving(true)
    setSaveError('')
    const newStatus  = forceStatus || editStatus
    const newRemarks = editRemarks

    const { error } = await supabase
      .from('equipment')
      .update({ data_status: newStatus, remarks: newRemarks })
      .eq('line',           selected.line)
      .eq('equipment',      selected.equipment)
      .eq('component_type', selected.component_type)

    if (error) {
      setSaveError(error.code === '42501'
        ? 'Write access requires authentication. Auth setup is in a later phase.'
        : error.message)
      setSaving(false)
      return
    }

    if (newStatus === 'Confirmed') {
      // remove from list, close panel
      setGaps(prev => prev.filter(g =>
        !(g.line === selected.line &&
          g.equipment === selected.equipment &&
          g.component_type === selected.component_type)
      ))
      setConfirmed(n => n + 1)
      setSelected(null)
    } else {
      // update in-place and refresh
      setGaps(prev => prev.map(g =>
        g.line === selected.line &&
        g.equipment === selected.equipment &&
        g.component_type === selected.component_type
          ? { ...g, data_status: newStatus, remarks: newRemarks }
          : g
      ))
      setSelected(prev => ({ ...prev, data_status: newStatus, remarks: newRemarks }))
      setEditStatus(newStatus)
    }
    setSaving(false)
  }

  /* ── derived / filter / group ───────────────────────────────────── */
  const systems = [...new Set(gaps.map(g => g.system).filter(Boolean))].sort()

  const filtered = gaps.filter(g => {
    if (filterSystem && g.system !== filterSystem) return false
    if (filterLine   && g.line   !== filterLine)   return false
    if (search) {
      const q = search.toLowerCase()
      return (g.equipment      || '').toLowerCase().includes(q)
          || (g.component_type || '').toLowerCase().includes(q)
          || (g.description    || '').toLowerCase().includes(q)
          || (g.location       || '').toLowerCase().includes(q)
          || (g.remarks        || '').toLowerCase().includes(q)
    }
    return true
  })

  const grouped = {}
  filtered.forEach(g => {
    ;(grouped[g.data_status] = grouped[g.data_status] || []).push(g)
  })

  const counts = {}
  gaps.forEach(g => { counts[g.data_status] = (counts[g.data_status] || 0) + 1 })

  const toggleGroup = key =>
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))

  const totalGaps   = gaps.length
  const totalFiltered = filtered.length

  /* ── render ──────────────────────────────────────────────────────── */
  if (loading) return <PageLoader label="Loading data gaps" />

  if (loadError) return (
    <div className="max-w-2xl">
      <ErrorBanner message={loadError} onRetry={loadGaps} />
    </div>
  )

  return (
    <div className="flex h-full">

      {/* ── MAIN COLUMN ──────────────────────────────────────────────── */}
      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-200 ${selected ? 'pr-[26rem]' : ''}`}>

        <PageHeader
          title="Data Gaps"
          subtitle={
            <>
              {totalGaps} component{totalGaps !== 1 ? 's' : ''} need field verification
              {confirmed > 0 && (
                <span className="ml-2 font-mono text-emerald-700">
                  · {confirmed} confirmed this session ✓
                </span>
              )}
            </>
          }
        />

        {/* summary pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {STATUS_ORDER.map(key => counts[key] ? (
            <div key={key} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border ${STATUS_META[key].pill}`}>
              <span className="font-bold text-sm">{counts[key]}</span>
              {key}
            </div>
          ) : null)}
        </div>

        {/* legend */}
        <div className="bg-panel-surface border border-panel-line rounded-lg px-4 py-3 mb-4">
          <div className="text-[10px] text-ink-lo uppercase tracking-widest mb-2">Status Guide</div>
          <div className="grid grid-cols-1 gap-1.5">
            {STATUS_ORDER.map(key => STATUS_META[key] ? (
              <div key={key} className="flex items-start gap-2.5 text-xs">
                <div className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${STATUS_META[key].dot}`} />
                <div>
                  <span className={`font-mono font-semibold ${STATUS_META[key].hdr}`}>{key}</span>
                  <span className="text-ink-lo ml-2">{STATUS_META[key].desc}</span>
                </div>
              </div>
            ) : null)}
          </div>
        </div>

        {/* filter bar */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <input
            type="text"
            placeholder="Search equipment, component, description, remarks…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-panel-surface border border-panel-line text-ink-hi placeholder-ink-lo
                       rounded px-3 py-1.5 text-sm w-80 focus:outline-none focus:border-blue-500/70"
          />
          <select value={filterLine} onChange={e => setFilterLine(e.target.value)}
            className="bg-panel-surface border border-panel-line text-ink-mid rounded px-3 py-1.5 text-sm">
            <option value="">All Lines</option>
            {['Line-1', 'Line-2', 'Common'].map(l => <option key={l}>{l}</option>)}
          </select>
          <select value={filterSystem} onChange={e => setFilterSystem(e.target.value)}
            className="bg-panel-surface border border-panel-line text-ink-mid rounded px-3 py-1.5 text-sm">
            <option value="">All Systems</option>
            {systems.map(s => <option key={s}>{s}</option>)}
          </select>
          {(search || filterLine || filterSystem) && (
            <button
              onClick={() => { setSearch(''); setFilterLine(''); setFilterSystem('') }}
              className="text-xs text-ink-lo hover:text-ink-hi underline underline-offset-2">
              Clear
            </button>
          )}
          {(search || filterLine || filterSystem) && totalFiltered !== totalGaps && (
            <span className="text-xs text-ink-lo">
              showing {totalFiltered} of {totalGaps}
            </span>
          )}
        </div>

        {/* grouped sections */}
        <div className="space-y-3">
          {STATUS_ORDER.map(key => {
            const items = grouped[key]
            if (!items?.length) return null
            const m    = STATUS_META[key]
            const open = !collapsed[key]
            return (
              <div key={key} className="bg-panel-surface border border-panel-line rounded-lg overflow-hidden shadow-sm">

                {/* section header */}
                <button
                  onClick={() => toggleGroup(key)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-panel-hover transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${m.dot}`} />
                    <span className={`text-sm font-semibold ${m.hdr}`}>{key}</span>
                    <span className="text-xs text-ink-lo font-mono">
                      {items.length} component{items.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="text-ink-lo text-xs">{open ? '▾' : '▸'}</span>
                </button>

                {/* rows */}
                {open && (
                  <div className="border-t border-panel-line">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] text-ink-lo uppercase tracking-widest border-b border-panel-line">
                          <th className="text-left px-4 py-2 font-medium">Equipment</th>
                          <th className="text-left px-4 py-2 font-medium">Component</th>
                          <th className="text-left px-4 py-2 font-medium">System</th>
                          <th className="text-left px-4 py-2 font-medium">Location</th>
                          <th className="text-left px-4 py-2 font-medium">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((g, i) => {
                          const isSel = selected?.line           === g.line
                                     && selected?.equipment      === g.equipment
                                     && selected?.component_type === g.component_type
                          return (
                            <tr
                              key={`${g.line}|${g.equipment}|${g.component_type}`}
                              onClick={() => openDetail(g)}
                              className={`border-b border-panel-line cursor-pointer transition-colors border-l-2
                                ${isSel
                                  ? `bg-blue-50 ${m.sel}`
                                  : `border-l-transparent ${i % 2 === 0 ? 'hover:bg-panel-hover' : 'bg-panel-raised hover:bg-panel-hover'}`
                                }`}
                            >
                              <td className="px-4 py-2.5">
                                <div className="text-ink-hi font-medium text-sm leading-tight">{g.equipment}</div>
                                <div className="text-ink-lo text-[10px] font-mono mt-0.5">{g.line}</div>
                              </td>
                              <td className="px-4 py-2.5 text-ink-mid text-sm">{g.component_type}</td>
                              <td className="px-4 py-2.5 text-ink-lo text-xs">{g.system}</td>
                              <td className="px-4 py-2.5 text-ink-lo text-xs">{g.location || '—'}</td>
                              <td className="px-4 py-2.5 text-ink-lo text-xs max-w-[200px] truncate" title={g.remarks}>
                                {g.remarks || <span className="text-ink-lo italic">—</span>}
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

          {totalGaps === 0 && (
            <div className="text-center py-20">
              <div className="text-emerald-700 text-4xl mb-3">✓</div>
              <div className="text-ink-hi font-semibold text-lg">All gaps cleared</div>
              <div className="text-ink-lo text-sm mt-1">Every component has been confirmed.</div>
            </div>
          )}

          {totalGaps > 0 && filtered.length === 0 && (
            <div className="text-center py-16 text-ink-lo text-sm">
              No components match your filters.
            </div>
          )}
        </div>
      </div>

      {/* ── DETAIL PANEL ─────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed right-0 top-0 h-full w-[26rem] bg-panel-surface border-l border-panel-line flex flex-col z-20 shadow-2xl">

          {/* header */}
          <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-panel-line sticky top-0 bg-panel-surface">
            <div className="flex-1 min-w-0 pr-3">
              <div className="text-[10px] text-ink-lo font-mono uppercase tracking-widest mb-1">{selected.line}</div>
              <div className="text-ink-hi font-semibold text-lg leading-tight">{selected.equipment}</div>
              <div className="text-ink-mid text-sm mt-0.5">{selected.component_type}</div>
            </div>
            <button onClick={() => setSelected(null)}
              className="text-ink-lo hover:text-ink-hi text-2xl leading-none mt-0.5 flex-shrink-0">
              ×
            </button>
          </div>

          {/* body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* current status */}
            <div>
              <div className="text-[10px] text-ink-lo uppercase tracking-widest mb-2">Current Status</div>
              <StatusBadge status={selected.data_status} />
              {STATUS_META[selected.data_status] && (
                <div className="mt-1.5 text-xs text-ink-lo leading-relaxed">
                  {STATUS_META[selected.data_status].desc}
                </div>
              )}
            </div>

            <div className="border-t border-panel-line" />

            {/* fields */}
            {[
              { label: 'System',      value: selected.system },
              { label: 'Description', value: selected.description },
              { label: 'Location',    value: selected.location },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-[10px] text-ink-lo uppercase tracking-widest mb-1">{label}</div>
                <div className="text-ink-hi text-sm">
                  {value || <span className="text-ink-lo italic">—</span>}
                </div>
              </div>
            ))}

            <div className="border-t border-panel-line" />

            {/* editable fields */}
            <div>
              <div className="text-[10px] text-ink-lo uppercase tracking-widest mb-2">Update Status</div>
              <select
                value={editStatus}
                onChange={e => setEditStatus(e.target.value)}
                className="w-full bg-panel-bg border border-panel-line text-ink-hi rounded
                           px-3 py-2 text-sm focus:outline-none focus:border-blue-500/70"
              >
                <option value="GAP">GAP</option>
                <option value="Partial-GAP">Partial-GAP</option>
                <option value="Field-verify">Field-verify</option>
                <option value="Confirmed">Confirmed ✓</option>
              </select>
            </div>

            <div>
              <div className="text-[10px] text-ink-lo uppercase tracking-widest mb-2">Remarks</div>
              <textarea
                value={editRemarks}
                onChange={e => setEditRemarks(e.target.value)}
                rows={4}
                placeholder="Add notes about the gap or what was found in the field…"
                className="w-full bg-panel-bg border border-panel-line text-ink-hi rounded
                           px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500/70"
              />
            </div>

            {saveError && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2.5">
                {saveError}
              </div>
            )}
          </div>

          {/* footer */}
          <div className="px-5 py-4 border-t border-panel-line sticky bottom-0 bg-panel-surface space-y-2">

            {/* quick confirm */}
            <button
              onClick={() => handleSave('Confirmed')}
              disabled={saving}
              className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40
                         text-white text-sm font-medium py-2.5 rounded transition-colors">
              {saving ? 'Saving…' : '✓ Mark as Confirmed'}
            </button>

            {/* save status change */}
            {editStatus !== selected.data_status && editStatus !== 'Confirmed' && (
              <button
                onClick={() => handleSave()}
                disabled={saving}
                className="w-full border border-panel-line hover:border-blue-500/60
                           text-ink-mid hover:text-ink-hi text-sm py-2 rounded transition-colors">
                {saving ? 'Saving…' : `Change to ${editStatus}`}
              </button>
            )}

            {/* save remarks only */}
            {editStatus === selected.data_status && editRemarks !== (selected.remarks || '') && (
              <button
                onClick={() => handleSave()}
                disabled={saving}
                className="w-full border border-panel-line hover:border-blue-500/60
                           text-ink-mid hover:text-ink-hi text-sm py-2 rounded transition-colors">
                {saving ? 'Saving…' : 'Save Remarks'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
