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
    pill:  'bg-st-over/10 text-st-over border border-st-over/30',
    hdr:   'text-st-over',
    dot:   'bg-st-over',
    sel:   'border-l-st-over',
    urg:   'text-st-over',
  },
  'Due Soon': {
    pill:  'bg-st-warn/10 text-st-warn border border-st-warn/30',
    hdr:   'text-st-warn',
    dot:   'bg-st-warn',
    sel:   'border-l-st-warn',
    urg:   'text-st-warn',
  },
  'Scheduled':{
    pill:  'bg-st-standby/10 text-st-standby border border-st-standby/30',
    hdr:   'text-st-standby',
    dot:   'bg-st-standby',
    sel:   'border-l-st-standby',
    urg:   'text-st-standby',
  },
  'Unknown':  {
    pill:  'bg-panel-raised text-ink-lo border border-panel-line2',
    hdr:   'text-ink-lo',
    dot:   'bg-st-idle',
    sel:   'border-l-panel-line2',
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
