import { ErrorBanner, PageLoader, FilterBar, SearchInput, FilterSelect } from '../../components/ui'
import { HIST_PAGE_SIZE } from './constants'

export default function HistoryTab({
  histFiltered, histPageItems, histTotalPages, histPageClamped, setHistPage,
  histSearch, setHistSearch, histFilterLine, setHistFilterLine, histFilterCategory, setHistFilterCategory,
  expandedHistId, setExpandedHistId, historyListLoading, histLoadError, loadAllHistory,
}) {
  return (
    <div>
      {/* history filter bar */}
      <FilterBar className="mb-5">
        <SearchInput
          placeholder="Search equipment, component, description…"
          value={histSearch}
          onChange={e => setHistSearch(e.target.value)}
          className="w-72"
        />
        <FilterSelect value={histFilterLine} onChange={e => setHistFilterLine(e.target.value)}>
          <option value="">All Lines</option>
          {['Line-1', 'Line-2', 'Common'].map(l => <option key={l}>{l}</option>)}
        </FilterSelect>
        <FilterSelect value={histFilterCategory} onChange={e => setHistFilterCategory(e.target.value)}>
          <option value="">All Categories</option>
          {['Routine Maintenance', 'Defect', 'PMS', 'CBM', 'Routine analysis', 'Weekly', 'Overhaul', 'Other'].map(c => <option key={c}>{c}</option>)}
        </FilterSelect>
        {(histSearch || histFilterLine || histFilterCategory) && (
          <button
            onClick={() => { setHistSearch(''); setHistFilterLine(''); setHistFilterCategory('') }}
            className="text-xs text-ink-lo hover:text-ink-hi underline underline-offset-2">
            Clear
          </button>
        )}
      </FilterBar>

      {/* history table */}
      {historyListLoading ? (
        <PageLoader label="Loading history" />
      ) : histLoadError ? (
        <ErrorBanner message={histLoadError} onRetry={loadAllHistory} />
      ) : histFiltered.length === 0 ? (
        <div className="text-center py-16 text-ink-lo text-sm">
          No history records match your filters.
        </div>
      ) : (
        <>
          <div className="bg-panel-surface border border-panel-line rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-ink-lo uppercase tracking-widest border-b border-panel-line">
                  <th className="text-left px-4 py-2 font-medium w-28">Date</th>
                  <th className="text-left px-4 py-2 font-medium">Equipment</th>
                  <th className="text-left px-4 py-2 font-medium w-24">Run Hrs</th>
                  <th className="text-left px-4 py-2 font-medium w-36">Category</th>
                  <th className="text-left px-4 py-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {histPageItems.map((h, i) => {
                  const isOpen = expandedHistId === h.id
                  return (
                    <tr
                      key={h.id}
                      onClick={() => setExpandedHistId(isOpen ? null : h.id)}
                      className={`border-b border-panel-line cursor-pointer transition-colors
                        ${isOpen ? 'bg-blue-50' : i % 2 === 0 ? 'hover:bg-panel-hover' : 'bg-panel-raised hover:bg-panel-hover'}`}
                    >
                      <td className="px-4 py-2.5 text-ink-lo text-xs font-mono whitespace-nowrap">
                        {h.work_date || h.work_date_text || '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-ink-hi font-medium text-sm leading-tight">{h.equipment || '—'}</div>
                        <div className="text-ink-lo text-[10px] font-mono mt-0.5">{h.line} · {h.component_type}</div>
                      </td>
                      <td className="px-4 py-2.5 text-ink-mid text-xs font-mono">
                        {h.run_hours ? Number(h.run_hours).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {h.work_category && (
                          <span className="text-[9px] bg-panel-raised text-ink-lo px-1.5 py-0.5 rounded font-mono">
                            {h.work_category}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-ink-mid text-xs leading-relaxed">
                        <div className={isOpen ? '' : 'truncate max-w-[420px]'} title={isOpen ? undefined : h.work_description}>
                          {h.work_description}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* pagination */}
          <div className="flex items-center justify-between mt-4 text-xs text-ink-lo">
            <div>
              Showing {(histPageClamped - 1) * HIST_PAGE_SIZE + 1}
              –{Math.min(histPageClamped * HIST_PAGE_SIZE, histFiltered.length)} of {histFiltered.length}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setHistPage(p => Math.max(1, p - 1))}
                disabled={histPageClamped <= 1}
                className="px-2.5 py-1 border border-panel-line rounded hover:border-panel-line2 hover:text-ink-hi disabled:opacity-30 disabled:cursor-not-allowed">
                ← Prev
              </button>
              <span className="font-mono">Page {histPageClamped} of {histTotalPages}</span>
              <button
                onClick={() => setHistPage(p => Math.min(histTotalPages, p + 1))}
                disabled={histPageClamped >= histTotalPages}
                className="px-2.5 py-1 border border-panel-line rounded hover:border-panel-line2 hover:text-ink-hi disabled:opacity-30 disabled:cursor-not-allowed">
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
