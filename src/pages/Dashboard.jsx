import { useKpis, useEquipmentStatus, useOverdueMaintenance } from '../lib/hooks'
import { StatusDot, DueBadge, MetricTile, Spinner } from '../components/ui'

function fmtHours(h) {
  if (h === null || h === undefined) return '—'
  return Number(h).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function KpiStrip() {
  const { data, loading } = useKpis()
  if (loading || !data) return <div className="h-[76px]"><Spinner /></div>
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <MetricTile label="Equipment" value={data.totalEquipment} />
      <MetricTile label="Running" value={data.running} accent="text-st-run" />
      <MetricTile label="Standby" value={data.standby} accent="text-st-standby" />
      <MetricTile label="Overdue" value={data.overdue} accent="text-st-over" sub="maintenance tasks" />
      <MetricTile label="Due Soon" value={data.dueSoon} accent="text-st-warn" />
      <MetricTile label="Data Gaps" value={data.dataGaps} accent="text-ink-mid" />
    </div>
  )
}

function GensetGrid() {
  const { data, loading } = useEquipmentStatus()
  if (loading || !data) return <Spinner label="Reading meters" />

  // engines first, then other hours-tracked items
  const engines = data.filter(d => d.component_type === 'Engine')
  const others = data.filter(d => d.component_type !== 'Engine')

  const Card = ({ item }) => {
    const over = item.overdue_count > 0
    const accent = over ? 'border-st-over/40' : item.due_soon_count > 0 ? 'border-st-warn/30' : 'border-panel-line'
    const label = item.component_type === 'Engine'
      ? item.equipment
      : `${item.equipment === 'Fuel Treatment' ? item.component_type : item.equipment}`
    return (
      <div className={`rounded-lg border bg-panel-surface p-3.5 ${accent}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-sm font-medium text-ink-hi">{label}</div>
            <div className="text-[11px] text-ink-lo">{item.line}</div>
          </div>
          <StatusDot status={item.current_status} />
        </div>
        <div className="mt-3 font-mono text-xl font-medium tnum text-ink-hi">
          {fmtHours(item.current_hours)}
          <span className="ml-1 text-xs font-normal text-ink-lo">hrs</span>
        </div>
        <div className="mt-2.5 flex items-center gap-3 text-[11px]">
          {over ? (
            <span className="text-st-over">{item.overdue_count} overdue</span>
          ) : (
            <span className="text-ink-lo">on schedule</span>
          )}
          {item.due_soon_count > 0 && <span className="text-st-warn">{item.due_soon_count} due soon</span>}
          <span className="ml-auto text-ink-lo">{item.maintenance_task_count} tasks</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <SectionLabel>Generating Units</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {engines.map((e, i) => <Card key={i} item={e} />)}
        </div>
      </div>
      {others.length > 0 && (
        <div>
          <SectionLabel>Auxiliaries</SectionLabel>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {others.map((e, i) => <Card key={i} item={e} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function OverduePanel() {
  const { data, loading } = useOverdueMaintenance()
  if (loading || !data) return <Spinner />
  const hoursTasks = data.filter(d => d.interval_basis === 'Hours').slice(0, 12)

  return (
    <div className="rounded-lg border border-panel-line bg-panel-surface">
      <div className="flex items-center justify-between border-b border-panel-line px-4 py-3">
        <SectionLabel className="mb-0">Overdue — by hours past due</SectionLabel>
        <span className="font-mono text-xs text-st-over">{data.length} total</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-ink-lo">
            <th className="px-4 py-2 text-left font-medium">Unit</th>
            <th className="px-4 py-2 text-left font-medium">Task</th>
            <th className="px-4 py-2 text-right font-medium">Current</th>
            <th className="px-4 py-2 text-right font-medium">Due at</th>
            <th className="px-4 py-2 text-right font-medium">Overdue</th>
          </tr>
        </thead>
        <tbody>
          {hoursTasks.map((t, i) => (
            <tr key={i} className="border-t border-panel-line/60">
              <td className="px-4 py-2 font-mono text-ink-hi">{t.equipment}</td>
              <td className="px-4 py-2 text-ink-mid">{t.task_name}</td>
              <td className="px-4 py-2 text-right font-mono tnum text-ink-mid">{fmtHours(t.current_hours)}</td>
              <td className="px-4 py-2 text-right font-mono tnum text-ink-lo">{fmtHours(t.next_due_hours)}</td>
              <td className="px-4 py-2 text-right font-mono tnum font-medium text-st-over">
                {fmtHours(Math.abs(t.hours_remaining))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SectionLabel({ children, className = '' }) {
  return (
    <div className={`mb-2.5 text-[11px] font-medium uppercase tracking-wider text-ink-lo ${className}`}>
      {children}
    </div>
  )
}

export default function Dashboard() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-hi">Plant Status</h1>
          <p className="text-sm text-ink-lo">Equipment, running hours, and maintenance due</p>
        </div>
        <div className="font-mono text-xs text-ink-lo">readings as of 29 Jun 2026</div>
      </header>

      <div className="mb-6"><KpiStrip /></div>
      <div className="mb-6"><GensetGrid /></div>
      <OverduePanel />
    </div>
  )
}
