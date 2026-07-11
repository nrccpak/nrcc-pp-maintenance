// Shared right-hand slide-in detail panel — the shell used by Equipment,
// Maintenance, and Data Gaps. Pages supply the header text, scrollable body
// (children), and an optional sticky footer.
export default function DetailPanel({ kicker, title, subtitle, onClose, footer, children, bodyClass = 'space-y-4' }) {
  return (
    <div className="fixed right-0 top-0 z-20 flex h-full w-[26rem] flex-col border-l border-panel-line bg-panel-surface shadow-2xl">

      {/* header */}
      <div className="sticky top-0 z-10 flex items-start justify-between border-b border-panel-line bg-panel-surface px-5 pt-5 pb-4">
        <div className="min-w-0 flex-1 pr-3">
          {kicker && (
            <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-ink-lo">{kicker}</div>
          )}
          <div className="truncate text-lg font-semibold leading-tight text-ink-hi">{title}</div>
          {subtitle && <div className="mt-0.5 text-sm leading-snug text-ink-mid">{subtitle}</div>}
        </div>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="mt-0.5 flex-shrink-0 text-2xl leading-none text-ink-lo hover:text-ink-hi"
        >
          ×
        </button>
      </div>

      {/* scrollable body */}
      <div className={`flex-1 overflow-y-auto px-5 py-4 ${bodyClass}`}>{children}</div>

      {/* sticky footer */}
      {footer && (
        <div className="sticky bottom-0 space-y-2 border-t border-panel-line bg-panel-surface px-5 py-4">
          {footer}
        </div>
      )}
    </div>
  )
}
