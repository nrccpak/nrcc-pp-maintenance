import { useRef, useState } from 'react'
import { useKpis, useEquipmentStatus, useOverdueMaintenance, useEquipmentTasks } from '../lib/hooks'
import { StatusDot, MetricTile, Spinner } from '../components/ui'

function fmtHours(h) {
  if (h === null || h === undefined) return '—'
  return Number(h).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function fmtReadingDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function latestReadingIso(rows) {
  const dates = (rows || []).map(r => r.status_as_of).filter(Boolean)
  if (dates.length === 0) return null
  return dates.reduce((max, d) => (d > max ? d : max))
}

function currentDisplay(t) {
  return t.interval_basis === 'Hours' && t.current_hours != null ? `${fmtHours(t.current_hours)} hrs` : '—'
}

function dueAtDisplay(t) {
  if (t.interval_basis === 'Hours') return t.next_due_hours != null ? `${fmtHours(t.next_due_hours)} hrs` : '—'
  return t.next_due_date || '—'
}

function overdueDisplay(t) {
  if (t.hours_remaining != null) return `${fmtHours(Math.abs(t.hours_remaining))} hrs`
  if (t.days_remaining != null) return `${Math.abs(t.days_remaining)} days`
  return '—'
}

function KpiStrip({ onOverdueClick }) {
  const { data, loading } = useKpis()
  if (loading || !data) return <div className="h-[76px]"><Spinner /></div>
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <MetricTile label="Equipment" value={data.totalEquipment} />
      <MetricTile label="Running" value={data.running} accent="text-st-run" />
      <MetricTile label="Standby" value={data.standby} accent="text-st-standby" />
      <MetricTile
        label="Overdue"
        value={data.overdue}
        accent="text-st-over"
        sub="maintenance tasks — click to view"
        onClick={onOverdueClick}
      />
      <MetricTile label="Due Soon" value={data.dueSoon} accent="text-st-warn" />
      <MetricTile label="Data Gaps" value={data.dataGaps} accent="text-ink-mid" />
    </div>
  )
}

function GensetGrid({ data, loading, onSelectTasks }) {
  if (loading || !data) return <Spinner label="Reading meters" />

  // engines first, then other hours-tracked items
  const engines = data.filter(d => d.component_type === 'Engine')
  const others = data.filter(d => d.component_type !== 'Engine')

  const Card = ({ item }) => {
    const over = item.overdue_count > 0
    const dueSoon = item.due_soon_count > 0
    const accent = over ? 'border-st-over/40' : dueSoon ? 'border-st-warn/30' : 'border-panel-line'
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
            <button
              onClick={() => onSelectTasks(item, 'Overdue')}
              className="text-st-over underline underline-offset-2 hover:text-st-over/80"
            >
              {item.overdue_count} overdue
            </button>
          ) : (
            <span className="text-ink-lo">on schedule</span>
          )}
          {dueSoon && (
            <button
              onClick={() => onSelectTasks(item, 'Due Soon')}
              className="text-st-warn underline underline-offset-2 hover:text-st-warn/80"
            >
              {item.due_soon_count} due soon
            </button>
          )}
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

function EquipmentTasksPanel({ selection, onClose }) {
  const criteria = selection
    ? {
        line: selection.item.line,
        equipment: selection.item.equipment,
        component_type: selection.item.component_type,
        dueState: selection.dueState,
      }
    : null
  const { data, loading } = useEquipmentTasks(criteria)
  if (!selection) return null

  const accent = selection.dueState === 'Overdue' ? 'text-st-over' : 'text-st-warn'

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-panel-line bg-panel-surface shadow-2xl">
        <div className="flex items-start justify-between border-b border-panel-line px-5 pt-5 pb-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink-lo">
              {selection.item.line} · {selection.item.component_type}
            </div>
            <div className="text-lg font-semibold text-ink-hi">{selection.item.equipment}</div>
            <div className={`mt-1 text-sm font-medium ${accent}`}>{selection.dueState} tasks</div>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-ink-lo hover:text-ink-hi">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading || !data ? (
            <Spinner />
          ) : data.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-lo">No matching tasks.</div>
          ) : (
            <div className="space-y-2">
              {data.map((t, i) => (
                <div key={t.id ?? i} className="rounded-lg border border-panel-line bg-panel-bg p-3">
                  <div className="text-sm font-medium text-ink-hi">{t.task_name}</div>
                  <div className="mt-1.5 flex items-center justify-between text-xs font-mono tnum text-ink-lo">
                    <span>{currentDisplay(t)} → due {dueAtDisplay(t)}</span>
                    <span className={`font-medium ${accent}`}>{overdueDisplay(t)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function OverduePanel({ expanded, onExpand, onCollapse, panelRef }) {
  const { data, loading } = useOverdueMaintenance()
  if (loading || !data) return <Spinner />

  const PREVIEW_SIZE = 12
  const preview = data.filter(d => d.interval_basis === 'Hours').slice(0, PREVIEW_SIZE)
  const shown = expanded ? data : preview
  const hasMore = !expanded && data.length > preview.length

  return (
    <div ref={panelRef} className="rounded-lg border border-panel-line bg-panel-surface">
      <div className="flex items-center justify-between border-b border-panel-line px-4 py-3">
        <SectionLabel className="mb-0">
          {expanded ? 'All overdue maintenance tasks' : 'Overdue — by hours past due'}
        </SectionLabel>
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
          {shown.map((t, i) => (
            <tr key={t.id ?? i} className="border-t border-panel-line/60">
              <td className="px-4 py-2 font-mono text-ink-hi">{t.equipment}</td>
              <td className="px-4 py-2 text-ink-mid">{t.task_name}</td>
              <td className="px-4 py-2 text-right font-mono tnum text-ink-mid">{currentDisplay(t)}</td>
              <td className="px-4 py-2 text-right font-mono tnum text-ink-lo">{dueAtDisplay(t)}</td>
              <td className="px-4 py-2 text-right font-mono tnum font-medium text-st-over">{overdueDisplay(t)}</td>
            </tr>
          ))}
          {shown.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-sm text-ink-lo">No overdue tasks.</td>
            </tr>
          )}
        </tbody>
      </table>
      {(hasMore || expanded) && (
        <div className="border-t border-panel-line px-4 py-2.5 text-center">
          <button
            onClick={hasMore ? onExpand : onCollapse}
            className="text-xs text-ink-mid underline underline-offset-2 hover:text-ink-hi"
          >
            {hasMore ? `Show all ${data.length} overdue tasks` : 'Show less'}
          </button>
        </div>
      )}
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
  const [overdueExpanded, setOverdueExpanded] = useState(false)
  const overdueRef = useRef(null)
  const [equipmentSelection, setEquipmentSelection] = useState(null)
  const { data: equipmentData, loading: equipmentLoading } = useEquipmentStatus()

  const expandOverdue = () => {
    setOverdueExpanded(true)
    overdueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const readingsAsOf = fmtReadingDate(latestReadingIso(equipmentData))

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-hi">Plant Status</h1>
          <p className="text-sm text-ink-lo">Equipment, running hours, and maintenance due</p>
        </div>
        <div className="font-mono text-xs text-ink-lo">
          {readingsAsOf ? `readings as of ${readingsAsOf}` : equipmentLoading ? 'reading meters…' : ''}
        </div>
      </header>

      <div className="mb-6"><KpiStrip onOverdueClick={expandOverdue} /></div>
      <div className="mb-6">
        <GensetGrid
          data={equipmentData}
          loading={equipmentLoading}
          onSelectTasks={(item, dueState) => setEquipmentSelection({ item, dueState })}
        />
      </div>
      <OverduePanel
        expanded={overdueExpanded}
        onExpand={() => setOverdueExpanded(true)}
        onCollapse={() => setOverdueExpanded(false)}
        panelRef={overdueRef}
      />
      <EquipmentTasksPanel selection={equipmentSelection} onClose={() => setEquipmentSelection(null)} />
    </div>
  )
}
