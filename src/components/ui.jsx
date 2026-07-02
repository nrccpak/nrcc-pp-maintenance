// Small shared presentational components for the control-room UI

const STATUS_COLORS = {
  Running: 'bg-st-run',
  Standby: 'bg-st-standby',
  Shutdown: 'bg-st-idle',
  Tripped: 'bg-st-trip',
  'Under Maintenance': 'bg-st-warn',
}

export function StatusDot({ status }) {
  const c = STATUS_COLORS[status] || 'bg-st-idle'
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${c}`} />
      <span className="text-ink-mid text-xs">{status || '—'}</span>
    </span>
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

export function MetricTile({ label, value, accent = 'text-ink-hi', sub, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
        onClick
          ? 'border-panel-line2 bg-panel-surface cursor-pointer hover:border-ink-mid hover:bg-panel-raised'
          : 'border-panel-line bg-panel-surface'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-ink-lo">{label}</div>
        {onClick && <span className="text-ink-mid text-xs leading-none">›</span>}
      </div>
      <div className={`mt-1 font-mono text-2xl font-medium tnum ${accent}`}>{value}</div>
      {sub && (
        <div className={`mt-0.5 text-xs ${onClick ? 'text-ink-mid underline underline-offset-2' : 'text-ink-lo'}`}>
          {sub}
        </div>
      )}
    </Tag>
  )
}

// Uses plain red-* utilities (not the panel-*/ink-* tokens) so it renders
// correctly on both the token-based pages and the hex-based ones.
export function ErrorBanner({ message, onRetry, className = '' }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border border-red-800/60 bg-red-900/20 px-4 py-3 text-sm text-red-400 ${className}`}>
      <span>{message || 'Something went wrong loading this data.'}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 rounded border border-red-800/60 px-2.5 py-1 text-xs text-red-300 hover:bg-red-900/40"
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
