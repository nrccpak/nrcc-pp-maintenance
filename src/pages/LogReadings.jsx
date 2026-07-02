import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ErrorBanner } from '../components/ui'

/* ── helpers ──────────────────────────────────────────────────────────── */
const STATUS_OPTIONS = ['Running', 'Standby', 'Shutdown', 'Tripped', 'Under Maintenance']

function todayStr() { return new Date().toISOString().slice(0, 10) }

function fmtHours(n) {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString()
}

function fmtDate(iso) {
  if (!iso) return 'never read'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function rowKey(item) {
  return `${item.line}|${item.equipment}|${item.component_type}`
}

/* ── main component ───────────────────────────────────────────────────── */
export default function LogReadings() {
  const [items,       setItems]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [loadError,    setLoadError]    = useState('')
  const [date,         setDate]         = useState(todayStr())
  const [entries,      setEntries]      = useState({}) // key -> { hours: '', status: '' }
  const [saving,        setSaving]        = useState(false)
  const [saveError,     setSaveError]     = useState('')
  const [saveSuccess,   setSaveSuccess]   = useState('')

  async function load() {
    setLoading(true)
    setLoadError('')
    const { data, error } = await supabase
      .from('v_equipment_current_status')
      .select('*')
      .eq('is_hours_tracked', true)
      .order('line').order('equipment').order('component_type')
    if (error) { setLoadError(error.message); setLoading(false); return }
    const rows = data || []
    setItems(rows)
    setEntries(prev => {
      const next = { ...prev }
      rows.forEach(r => {
        const key = rowKey(r)
        if (!next[key]) next[key] = { hours: '', status: r.current_status || 'Running' }
      })
      return next
    })
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function updateEntry(key, patch) {
    setSaveSuccess('')
    setEntries(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  const filled = items.filter(r => (entries[rowKey(r)]?.hours ?? '') !== '')
  const invalidRows = filled.filter(r => {
    const h = parseFloat(entries[rowKey(r)].hours)
    return isNaN(h) || h < 0
  })

  async function handleSubmit() {
    setSaving(true)
    setSaveError('')
    setSaveSuccess('')

    if (filled.length === 0) {
      setSaveError('Enter at least one reading before submitting.')
      setSaving(false)
      return
    }
    if (invalidRows.length > 0) {
      setSaveError('Some entered hours aren’t valid numbers — fix them before submitting.')
      setSaving(false)
      return
    }

    const payload = filled.map(r => {
      const e = entries[rowKey(r)]
      return {
        line: r.line,
        equipment: r.equipment,
        component_type: r.component_type,
        recorded_at: date,
        running_hours: parseFloat(e.hours),
        status: e.status,
      }
    })

    const { error } = await supabase.from('equipment_status_log').insert(payload)
    if (error) {
      setSaveError(error.code === '42501'
        ? 'Write access requires authentication.'
        : error.message)
      setSaving(false)
      return
    }

    setSaveSuccess(`Logged ${payload.length} reading${payload.length !== 1 ? 's' : ''}.`)
    setEntries(prev => {
      const next = { ...prev }
      payload.forEach(p => {
        next[`${p.line}|${p.equipment}|${p.component_type}`] = { hours: '', status: p.status }
      })
      return next
    })
    setSaving(false)
    load()
  }

  /* ── render ──────────────────────────────────────────────────────── */
  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-500">
      <div className="text-center">
        <div className="w-6 h-6 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
        <div className="text-sm">Loading equipment…</div>
      </div>
    </div>
  )

  if (loadError) return (
    <div className="max-w-2xl">
      <ErrorBanner message={loadError} onRetry={load} />
    </div>
  )

  const lines = [...new Set(items.map(r => r.line))]

  return (
    <div className="max-w-4xl">

      {/* header */}
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Log Readings</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Record hour-meter and status readings for all {items.length} hour-tracked items
          </p>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Reading Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-[#161b22] border border-[#30363d] text-gray-200 rounded px-3 py-1.5 text-sm
                       focus:outline-none focus:border-blue-500/70"
          />
        </div>
      </div>

      {/* per-line tables */}
      <div className="space-y-5">
        {lines.map(line => (
          <div key={line} className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[#30363d]">
              <span className="text-sm font-semibold text-gray-200">{line}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-gray-600 uppercase tracking-widest border-b border-[#21262d]">
                  <th className="text-left px-4 py-2 font-medium">Equipment</th>
                  <th className="text-left px-4 py-2 font-medium">Previous Reading</th>
                  <th className="text-left px-4 py-2 font-medium w-40">New Hours</th>
                  <th className="text-left px-4 py-2 font-medium w-44">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.filter(r => r.line === line).map((r, i) => {
                  const key = rowKey(r)
                  const entry = entries[key] || { hours: '', status: r.current_status || 'Running' }
                  const hoursNum = entry.hours !== '' ? parseFloat(entry.hours) : null
                  const isInvalid = entry.hours !== '' && (isNaN(hoursNum) || hoursNum < 0)
                  const isLower = !isInvalid && hoursNum !== null && r.current_hours !== null
                    && hoursNum < Number(r.current_hours)
                  return (
                    <tr key={key} className={`border-b border-[#1c2128] ${i % 2 === 0 ? '' : 'bg-[#0d1117]/20'}`}>
                      <td className="px-4 py-2.5">
                        <div className="text-gray-100 font-medium text-sm leading-tight">{r.equipment}</div>
                        <div className="text-gray-500 text-[10px] font-mono mt-0.5">{r.component_type}</div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-sm font-mono">
                        {fmtHours(r.current_hours)} hrs
                        <div className="text-gray-600 text-[10px] mt-0.5">{fmtDate(r.status_as_of)}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          value={entry.hours}
                          onChange={e => updateEntry(key, { hours: e.target.value })}
                          placeholder="Enter hours…"
                          className={`w-full bg-[#0e1116] border rounded px-2.5 py-1.5 text-sm font-mono
                                      placeholder-gray-600 focus:outline-none focus:border-blue-500/70
                                      ${isInvalid ? 'border-red-700 text-red-400' : 'border-[#30363d] text-gray-200'}`}
                        />
                        {isLower && (
                          <div className="text-amber-400 text-[10px] mt-1">lower than previous reading</div>
                        )}
                        {isInvalid && (
                          <div className="text-red-400 text-[10px] mt-1">not a valid number</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={entry.status}
                          onChange={e => updateEntry(key, { status: e.target.value })}
                          className="w-full bg-[#0e1116] border border-[#30363d] text-gray-200 rounded
                                     px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500/70"
                        >
                          {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* footer / submit */}
      <div className="sticky bottom-0 mt-5 bg-[#0e1116] border-t border-[#30363d] py-4 flex items-center gap-4">
        <span className="text-sm text-gray-400">
          {filled.length} of {items.length} readings entered
        </span>
        <button
          onClick={handleSubmit}
          disabled={saving || filled.length === 0}
          className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed
                     text-white text-sm font-medium px-5 py-2 rounded transition-colors"
        >
          {saving ? 'Saving…' : `Submit ${filled.length || ''} Reading${filled.length === 1 ? '' : 's'}`}
        </button>
        {saveSuccess && <span className="text-emerald-400 text-sm">✓ {saveSuccess}</span>}
        {saveError && <span className="text-red-400 text-sm">{saveError}</span>}
      </div>
    </div>
  )
}
