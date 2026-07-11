// Small shared presentational components for the control-room UI

// Standard page header — every page opens with one so titles, subtitles,
// and the optional right-hand slot (e.g. "readings as of …") stay aligned.
export function PageHeader({ title, subtitle, right }) {
  return (
    <header className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink-hi">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-lo">{subtitle}</p>}
      </div>
      {right && <div className="font-mono text-xs text-ink-lo">{right}</div>}
    </header>
  )
}

// Full-area centered loading state — replaces per-page copy-pasted spinners.
export function PageLoader({ label = 'Loading' }) {
  return (
    <div className="flex h-64 items-center justify-center text-ink-lo">
      <div className="text-center">
        <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-panel-line2 border-t-ink-mid" />
        <div className="text-sm">{label}…</div>
      </div>
    </div>
  )
}

// Equipment data-quality statuses — single source for badge/pill colors
// (previously duplicated with drifting values in Equipment and DataGaps).
export const DATA_STATUS_STYLES = {
  'Confirmed':    'bg-st-run/10 text-st-run border border-st-run/30',
  'Field-verify': 'bg-st-warn/10 text-st-warn border border-st-warn/30',
  'GAP':          'bg-st-over/10 text-st-over border border-st-over/30',
  'Partial-GAP':  'bg-st-partial/10 text-st-partial border border-st-partial/30',
}

export function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono whitespace-nowrap ${DATA_STATUS_STYLES[status] || 'bg-panel-raised text-ink-mid border border-panel-line'}`}>
      {status}
    </span>
  )
}

// Equipment operating statuses (v_equipment_current_status.current_status),
// distinct from the data-quality statuses above.
export const EQUIPMENT_STATUS_STYLES = {
  'Running':            'bg-st-run/10 text-st-run border border-st-run/30',
  'Standby':            'bg-st-standby/10 text-st-standby border border-st-standby/30',
  'Shutdown':           'bg-st-idle/10 text-st-idle border border-st-idle/30',
  'Tripped':            'bg-st-trip/10 text-st-trip border border-st-trip/30',
  'Under Maintenance':  'bg-st-warn/10 text-st-warn border border-st-warn/30',
}

export function EquipmentStatusBadge({ status }) {
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${EQUIPMENT_STATUS_STYLES[status] || 'bg-panel-raised text-ink-mid border border-panel-line'}`}>
      {status || 'Unknown'}
    </span>
  )
}

// Filter-bar primitives — shared styling for the search box + dropdowns
// that appear above every table.
export function FilterBar({ children, className = '' }) {
  return <div className={`mb-4 flex flex-wrap items-center gap-2 ${className}`}>{children}</div>
}

export function SearchInput({ className = 'w-80', ...props }) {
  return (
    <input
      type="text"
      className={`bg-panel-surface border border-panel-line text-ink-hi placeholder-ink-lo
                  rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500/70 ${className}`}
      {...props}
    />
  )
}

export function FilterSelect({ children, ...props }) {
  return (
    <select
      className="bg-panel-surface border border-panel-line text-ink-mid rounded px-3 py-1.5 text-sm
                 focus:outline-none focus:border-blue-500/70"
      {...props}
    >
      {children}
    </select>
  )
}

const DUE_STYLE = {
  Overdue: 'text-st-over border-st-over/40 bg-st-over/10',
  'Due Soon': 'text-st-warn border-st-warn/40 bg-st-warn/10',
  Scheduled: 'text-ink-mid border-panel-line2 bg-panel-raised',
  Completed: 'text-st-run border-st-run/40 bg-st-run/10',
  Cancelled: 'text-ink-lo border-panel-line bg-panel-surface',
}

export function DueBadge({ state }) {
  const base = DUE_STYLE[state] || 'text-ink-mid border-panel-line2 bg-panel-raised'
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium ${base}`}>
      {state || 'Unknown'}
    </span>
  )
}

export function MetricTile({ label, value, accent = 'text-ink-hi', barColor = 'border-l-panel-line2', dot, sub, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`w-full rounded-lg border border-l-4 ${barColor} px-4 py-3 text-left shadow-sm transition-all ${
        onClick
          ? 'border-panel-line2 bg-panel-surface cursor-pointer hover:border-ink-mid hover:shadow-md'
          : 'border-panel-line bg-panel-surface'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-lo">
          {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
          {label}
        </div>
        {onClick && <span className="text-ink-mid text-xs leading-none">›</span>}
      </div>
      <div className={`mt-1 font-sans text-3xl font-semibold ${accent}`}>{value}</div>
      {sub && (
        <div className={`mt-0.5 text-xs ${onClick ? 'text-ink-mid underline underline-offset-2' : 'text-ink-lo'}`}>
          {sub}
        </div>
      )}
    </Tag>
  )
}

export function ErrorBanner({ message, onRetry, className = '' }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border border-st-over/30 bg-st-over/10 px-4 py-3 text-sm text-st-over ${className}`}>
      <span>{message || 'Something went wrong loading this data.'}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 rounded border border-st-over/30 px-2.5 py-1 text-xs text-st-over hover:bg-st-over/20"
        >
          Retry
        </button>
      )}
    </div>
  )
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center gap-2 py-8 text-ink-lo text-sm">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-panel-line2 border-t-ink-mid" />
      {label}…
    </div>
  )
}
