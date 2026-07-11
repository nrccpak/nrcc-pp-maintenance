import { urgencyDisplay } from './constants'

export default function LogCompletionModal({
  selected, logHours, setLogHours, logDate, setLogDate, logDesc, setLogDesc,
  nextDue, sweepLoading, sweepCandidates, sweepChecked, setSweepChecked,
  logError, logSaving, canSave, onSave, onClose,
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-panel-surface border border-panel-line rounded-xl w-full max-w-md mx-4 shadow-2xl">

        <div className="px-6 pt-6 pb-4 border-b border-panel-line">
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
                className="w-full bg-panel-bg border border-panel-line text-ink-hi rounded
                           px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500/70"
              />
              {nextDue && (
                <div className="mt-2 text-xs text-ink-lo">
                  Next due will be set to{' '}
                  <span className="text-st-standby font-mono">{nextDue.next_due_hours_fmt}</span>
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
                className="w-full bg-panel-bg border border-panel-line text-ink-hi rounded
                           px-3 py-2 text-sm focus:outline-none focus:border-blue-500/70"
              />
              {nextDue && (
                <div className="mt-2 text-xs text-ink-lo">
                  Next due will be set to{' '}
                  <span className="text-st-standby font-mono">{nextDue.next_due_date_fmt}</span>
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
                className="w-full bg-panel-bg border border-panel-line text-ink-hi rounded
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
              className="w-full bg-panel-bg border border-panel-line text-ink-hi rounded
                         px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500/70"
            />
          </div>

          {/* nested PM interval sweep-in */}
          {sweepLoading && (
            <div className="text-xs text-ink-lo">Checking for lower-tier tasks due on this equipment…</div>
          )}
          {!sweepLoading && sweepCandidates.length > 0 && (
            <div>
              <label className="block text-[10px] text-ink-lo uppercase tracking-widest mb-2">
                Will also be closed as part of this service
              </label>
              <div className="space-y-1.5">
                {sweepCandidates.map(c => (
                  <label
                    key={c.id}
                    className="flex items-start gap-2.5 bg-panel-bg border border-panel-line rounded px-3 py-2
                               cursor-pointer hover:border-panel-line transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={!!sweepChecked[c.id]}
                      onChange={e => setSweepChecked(prev => ({ ...prev, [c.id]: e.target.checked }))}
                      className="mt-0.5 accent-emerald-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-ink-hi text-xs font-medium leading-tight">
                        {c.component_type} · {c.task_name}
                      </div>
                      <div className="text-ink-lo text-[10px] font-mono mt-0.5">{urgencyDisplay(c)}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="text-[10px] text-ink-lo mt-2 leading-relaxed">
                Each confirmed task is marked complete on {logDate || 'this date'} with a history note
                referencing this {selected.task_name}.
              </div>
            </div>
          )}

          {logError && (
            <div className="text-xs text-st-over bg-st-over/10 border border-st-over/30 rounded px-3 py-2.5">
              {logError}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-panel-line flex gap-2">
          <button
            onClick={onSave}
            disabled={logSaving || !canSave()}
            className="flex-1 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40
                       disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded transition-colors">
            {logSaving ? 'Saving…' : 'Confirm Completion'}
          </button>
          <button
            onClick={onClose}
            className="px-4 text-sm text-ink-mid hover:text-ink-hi
                       border border-panel-line hover:border-panel-line2 rounded transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
