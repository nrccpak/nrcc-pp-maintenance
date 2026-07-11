import { ErrorBanner, FilterBar, SearchInput, FilterSelect } from '../../components/ui'
import { STATE_ORDER, COLORS, urgencyDisplay, normalizeState } from './constants'

export default function TaskBoardTab({
  filtered, counts, collapsed, toggleGroup,
  search, setSearch, filterLine, setFilterLine, filterBasis, setFilterBasis,
  selected, setSelected, loadError, loadTasks, loading,
}) {
  const grouped = {}
  filtered.forEach(t => {
    const key = normalizeState(t.due_state)
    ;(grouped[key] = grouped[key] || []).push(t)
  })
  // sort each group: most urgent first (most negative hours_remaining)
  Object.values(grouped).forEach(arr =>
    arr.sort((a, b) => (a.hours_remaining ?? 0) - (b.hours_remaining ?? 0))
  )

  return (
    <>
      {/* summary pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STATE_ORDER.map(key => counts[key] ? (
          <div key={key} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border ${COLORS[key].pill}`}>
            <span className="font-bold text-sm">{counts[key]}</span>
            {key}
          </div>
        ) : null)}
      </div>

      <FilterBar className="mb-5">
        <SearchInput
          placeholder="Search equipment, component, task…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-72"
        />
        <FilterSelect value={filterLine} onChange={e => setFilterLine(e.target.value)}>
          <option value="">All Lines</option>
          {['Line-1', 'Line-2', 'Common'].map(l => <option key={l}>{l}</option>)}
        </FilterSelect>
        <FilterSelect value={filterBasis} onChange={e => setFilterBasis(e.target.value)}>
          <option value="">All Intervals</option>
          <option value="Hours">Hours-based</option>
          <option value="Calendar">Calendar-based</option>
        </FilterSelect>
        {(search || filterLine || filterBasis) && (
          <button
            onClick={() => { setSearch(''); setFilterLine(''); setFilterBasis('') }}
            className="text-xs text-ink-lo hover:text-ink-hi underline underline-offset-2">
            Clear
          </button>
        )}
      </FilterBar>

      {/* grouped sections */}
      <div className="space-y-3">
        {STATE_ORDER.map(key => {
          const items = grouped[key]
          if (!items?.length) return null
          const c = COLORS[key]
          const open = !collapsed[key]
          return (
            <div key={key} className="bg-panel-surface border border-panel-line rounded-lg overflow-hidden shadow-sm">

              {/* section header */}
              <button
                onClick={() => toggleGroup(key)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-panel-hover transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                  <span className={`text-sm font-semibold ${c.hdr}`}>{key}</span>
                  <span className="text-xs text-ink-lo font-mono">
                    {items.length} task{items.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <span className="text-ink-lo text-xs">{open ? '▾' : '▸'}</span>
              </button>

              {/* section rows */}
              {open && (
                <div className="border-t border-panel-line">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] text-ink-lo uppercase tracking-widest border-b border-panel-line">
                        <th className="text-left px-4 py-2 font-medium">Equipment</th>
                        <th className="text-left px-4 py-2 font-medium">Task</th>
                        <th className="text-left px-4 py-2 font-medium w-24">Interval</th>
                        <th className="text-left px-4 py-2 font-medium w-40">Urgency</th>
                        <th className="text-left px-4 py-2 font-medium w-32">Next Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((t, i) => {
                        const isSel = selected?.id === t.id
                        return (
                          <tr
                            key={t.id}
                            onClick={() => setSelected(isSel ? null : t)}
                            className={`border-b border-panel-line cursor-pointer transition-colors border-l-2
                              ${isSel
                                ? `bg-st-standby/10 ${c.sel}`
                                : `border-l-transparent ${i % 2 === 0 ? 'hover:bg-panel-hover' : 'bg-panel-raised hover:bg-panel-hover'}`
                              }`}
                          >
                            <td className="px-4 py-2.5">
                              <div className="text-ink-hi font-medium text-sm leading-tight">{t.equipment}</div>
                              <div className="text-ink-lo text-[10px] font-mono mt-0.5">{t.line} · {t.component_type}</div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="text-ink-mid text-sm truncate max-w-[220px]" title={t.task_name}>{t.task_name}</div>
                            </td>
                            <td className="px-4 py-2.5 text-ink-lo text-xs">{t.interval_basis}</td>
                            <td className="px-4 py-2.5">
                              <span className={`text-xs font-mono ${c.urg}`}>{urgencyDisplay(t)}</span>
                            </td>
                            <td className="px-4 py-2.5 text-ink-mid text-xs font-mono whitespace-nowrap">
                              {t.next_due_hours
                                ? `${Number(t.next_due_hours).toLocaleString()} hrs`
                                : t.next_due_date || '—'}
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

        {loadError && !loading && (
          <ErrorBanner message={loadError} onRetry={loadTasks} />
        )}

        {!loadError && filtered.length === 0 && !loading && (
          <div className="text-center py-16 text-ink-lo text-sm">
            No tasks match your filters.
          </div>
        )}
      </div>
    </>
  )
}
