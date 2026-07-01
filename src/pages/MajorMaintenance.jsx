import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/* ── helpers ──────────────────────────────────────────────────────────── */
function fmtHours(n) {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString() + ' hrs'
}

function dgNumber(equipment) {
  const m = /\d+/.exec(equipment || '')
  return m ? parseInt(m[0], 10) : 0
}

function byDgNumber(a, b) {
  return dgNumber(a.equipment) - dgNumber(b.equipment)
}

function isOverdue(row) {
  return row.workflow_status !== 'In Progress' && Number(row.overdue_hours) > 0
}

/* ── sub-components ──────────────────────────────────────────────────── */
function KpiTile({ label, value, accent }) {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-3">
      <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">{label}</div>
      <div className={`font-mono text-2xl font-bold ${accent}`}>{value}</div>
    </div>
  )
}

function OverdueCell({ row }) {
  if (row.workflow_status === 'In Progress') {
    return (
      <span
        title={row.remarks || 'Currently under maintenance'}
        className="inline-block px-2 py-0.5 rounded text-xs font-mono whitespace-nowrap
                   bg-amber-900/30 text-amber-400 border border-amber-800/60 cursor-help"
      >
        Under Maintenance
      </span>
    )
  }
  const overdue = Number(row.overdue_hours)
  if (overdue > 0) {
    return <span className="font-mono font-bold text-red-400">{overdue.toLocaleString()} hrs</span>
  }
  return <span className="font-mono text-gray-600">—</span>
}

function OverhaulTable({ title, rows }) {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[#30363d]">
        <span className="text-sm font-semibold text-gray-200">{title}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] text-gray-600 uppercase tracking-widest border-b border-[#21262d]">
            <th className="text-left px-4 py-2 font-medium">DG No.</th>
            <th className="text-left px-4 py-2 font-medium">Current Running Hrs</th>
            <th className="text-left px-4 py-2 font-medium">Last Major O/H Hrs</th>
            <th className="text-left px-4 py-2 font-medium">Overdue Hrs</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const overdue = isOverdue(row)
            return (
              <tr
                key={`${row.line}|${row.equipment}|${row.component_type}`}
                title={row.remarks || undefined}
                className={`border-b border-[#1c2128] border-l-2 transition-colors
                  ${overdue ? 'border-l-red-700' : 'border-l-transparent'}
                  ${i % 2 === 0 ? 'hover:bg-[#1c2128]' : 'bg-[#0d1117]/20 hover:bg-[#1c2128]'}`}
              >
                <td className="px-4 py-2.5">
                  <div className="text-gray-100 font-medium text-sm leading-tight">{row.equipment}</div>
                  <div className="text-gray-500 text-[10px] font-mono mt-0.5">{row.line}</div>
                </td>
                <td className="px-4 py-2.5 text-gray-300 text-sm font-mono">
                  {fmtHours(row.current_running_hours)}
                </td>
                <td className="px-4 py-2.5 text-gray-400 text-sm font-mono">
                  {fmtHours(row.last_done_hours)}
                </td>
                <td className="px-4 py-2.5">
                  <OverdueCell row={row} />
                </td>
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center py-10 text-gray-600 text-sm">
                No rows found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ── main component ───────────────────────────────────────────────────── */
export default function MajorMaintenance() {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('v_major_overhaul_status')
        .select('*')
      setRows(data || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-500">
      <div className="text-center">
        <div className="w-6 h-6 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
        <div className="text-sm">Loading major overhaul status…</div>
      </div>
    </div>
  )

  const engines = rows.filter(r => r.component_type === 'Engine').sort(byDgNumber)
  const turbos  = rows.filter(r => r.component_type === 'Turbocharger').sort(byDgNumber)

  const enginesOverdueCount    = engines.filter(isOverdue).length
  const turbosOverdueCount     = turbos.filter(isOverdue).length
  const underMaintenanceCount  = rows.filter(r => r.workflow_status === 'In Progress').length

  return (
    <div className="max-w-5xl">

      {/* header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white tracking-tight">Major Maintenance</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          12,000-hour major overhaul tracking — engines and turbochargers
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3 mb-6 max-w-2xl">
        <KpiTile label="Engines Overdue"        value={enginesOverdueCount}   accent={enginesOverdueCount > 0 ? 'text-red-400' : 'text-gray-300'} />
        <KpiTile label="Turbochargers Overdue"   value={turbosOverdueCount}    accent={turbosOverdueCount > 0 ? 'text-red-400' : 'text-gray-300'} />
        <KpiTile label="Under Maintenance"       value={underMaintenanceCount} accent={underMaintenanceCount > 0 ? 'text-amber-400' : 'text-gray-300'} />
      </div>

      {/* tables */}
      <div className="space-y-5">
        <OverhaulTable title="Engines — Major Overhaul (12K Hrs)"        rows={engines} />
        <OverhaulTable title="Turbochargers — Major Overhaul (12K Hrs)"  rows={turbos} />
      </div>
    </div>
  )
}
