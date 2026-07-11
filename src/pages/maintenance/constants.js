// Shared constants and pure helpers for the Maintenance Board — split out of
// the main page component so the task board, history tab, detail panel, and
// log-completion modal can each import just what they need.

export const STATE_ORDER = ['Overdue', 'Due Soon', 'Scheduled', 'Unknown']
export const HIST_PAGE_SIZE = 25

// Nested PM interval chain (Engine, Hours-based) — lowest to highest tier.
// Completing a higher tier sweeps in any lower-tier task (any component on
// the same equipment) that is currently due, per the nested-closure rule.
export const SERVICE_TIER_CHAIN = ['500hr Schedule Service', '1K Service', '2K Service', '6K Service', '12K Major Overhaul']

export const COLORS = {
  'Overdue':  {
    pill:  'bg-red-50 text-red-700 border border-red-200',
    hdr:   'text-red-700',
    dot:   'bg-red-500',
    sel:   'border-l-red-700',
    urg:   'text-red-700',
  },
  'Due Soon': {
    pill:  'bg-amber-50 text-amber-700 border border-amber-200',
    hdr:   'text-amber-700',
    dot:   'bg-amber-500',
    sel:   'border-l-amber-600',
    urg:   'text-amber-700',
  },
  'Scheduled':{
    pill:  'bg-blue-50 text-blue-700 border border-blue-200',
    hdr:   'text-blue-700',
    dot:   'bg-blue-500',
    sel:   'border-l-blue-700',
    urg:   'text-blue-700',
  },
  'Unknown':  {
    pill:  'bg-gray-100 text-ink-lo border border-panel-line2',
    hdr:   'text-ink-lo',
    dot:   'bg-gray-400',
    sel:   'border-l-gray-600',
    urg:   'text-ink-lo',
  },
}

export function urgencyDisplay(task) {
  if (task.hours_remaining !== null) {
    const hrs = Math.abs(Math.round(task.hours_remaining))
    return task.hours_remaining < 0
      ? `${hrs.toLocaleString()} hrs overdue`
      : `${hrs.toLocaleString()} hrs remaining`
  }
  if (task.days_remaining !== null) {
    const days = Math.abs(task.days_remaining)
    return task.days_remaining < 0
      ? `${days} days overdue`
      : `${days} days remaining`
  }
  return 'No baseline'
}

export function normalizeState(s) {
  return s?.startsWith('Unknown') ? 'Unknown' : (s || 'Unknown')
}
