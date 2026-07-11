import DetailPanel from '../../components/DetailPanel'
import { fmtHoursUnit as fmtHours } from '../../lib/format'
import { COLORS, urgencyDisplay, normalizeState } from './constants'

function InfoTile({ label, value, mono = true }) {
  return (
    <div className="bg-panel-bg rounded-lg p-3 border border-panel-line">
      <div className="text-[9px] text-ink-lo uppercase tracking-widest mb-1">{label}</div>
      <div className={`text-ink-hi text-sm ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</div>
    </div>
  )
}

export default function TaskDetailPanel({ selected, taskDetail, history, historyLoading, onClose, onLogCompletion }) {
  return (
    <DetailPanel
      kicker={`${selected.line} · ${selected.component_type}`}
      title={selected.equipment}
      subtitle={selected.task_name}
      onClose={onClose}
      footer={
        <button
          onClick={onLogCompletion}
          className="w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200
                     hover:border-emerald-400 text-emerald-700 hover:text-emerald-800
                     text-sm font-medium py-2.5 rounded transition-colors">
          ✓ Log Completion
        </button>
      }
    >
      {/* urgency banner */}
      <div className={`rounded-lg px-4 py-3 border ${
        normalizeState(selected.due_state) === 'Overdue'  ? 'bg-red-50  border-red-200' :
        normalizeState(selected.due_state) === 'Due Soon' ? 'bg-amber-50 border-amber-200' :
        normalizeState(selected.due_state) === 'Scheduled'? 'bg-blue-50  border-blue-200' :
        'bg-panel-raised border-panel-line'
      }`}>
        <div className="text-[9px] text-ink-lo uppercase tracking-widest mb-1">Urgency</div>
        <div className={`font-mono font-bold text-base ${COLORS[normalizeState(selected.due_state)].urg}`}>
          {urgencyDisplay(selected)}
        </div>
      </div>

      {/* stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <InfoTile label="Current Hours"
          value={selected.current_hours ? fmtHours(selected.current_hours) : '—'} />
        <InfoTile label="Next Due"
          value={selected.next_due_hours
            ? fmtHours(selected.next_due_hours)
            : selected.next_due_date || '—'} />
        <InfoTile label="Interval"
          value={taskDetail
            ? (taskDetail.interval_hours ? fmtHours(taskDetail.interval_hours) : `${taskDetail.interval_days} days`)
            : '…'} />
        <InfoTile label="Basis"    value={selected.interval_basis} />
      </div>

      {/* last done */}
      {taskDetail && (taskDetail.last_done_hours || taskDetail.last_done_date) && (
        <div>
          <div className="text-[10px] text-ink-lo uppercase tracking-widest mb-1">Last Done</div>
          <div className="text-ink-mid text-sm font-mono">
            {taskDetail.last_done_hours ? fmtHours(taskDetail.last_done_hours) : ''}
            {taskDetail.last_done_date  ? ` · ${taskDetail.last_done_date}` : ''}
          </div>
        </div>
      )}

      {taskDetail?.remarks && (
        <div>
          <div className="text-[10px] text-ink-lo uppercase tracking-widest mb-1">Remarks</div>
          <div className="text-ink-mid text-sm">{taskDetail.remarks}</div>
        </div>
      )}

      <div className="border-t border-panel-line my-1" />

      {/* maintenance history */}
      <div>
        <div className="text-[10px] text-ink-lo uppercase tracking-widest mb-3">
          Maintenance History{history.length > 0 ? ` (${history.length})` : ''}
        </div>

        {historyLoading ? (
          <div className="text-xs text-ink-lo text-center py-6">Loading history…</div>
        ) : history.length === 0 ? (
          <div className="text-xs text-ink-lo italic text-center py-6">
            No history records for this component.
          </div>
        ) : (
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="bg-panel-bg rounded-lg p-3 border border-panel-line">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-ink-lo font-mono">
                    {h.work_date}
                    {h.run_hours ? ` · ${Number(h.run_hours).toLocaleString()} hrs` : ''}
                  </span>
                  {h.work_category && (
                    <span className="text-[9px] bg-panel-raised text-ink-lo px-1.5 py-0.5 rounded font-mono">
                      {h.work_category}
                    </span>
                  )}
                </div>
                <div className="text-ink-mid text-xs leading-relaxed">{h.work_description}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DetailPanel>
  )
}
