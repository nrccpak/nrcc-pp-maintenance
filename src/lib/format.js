// Shared formatting helpers — the single source for number/date display.
// Pages must not re-declare these locally.

// "96,200" — bare number, em-dash for missing readings.
export function fmtHours(n) {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

// "96,200 hrs" — for table cells and stat contexts that carry the unit inline.
export function fmtHoursUnit(n) {
  if (n === null || n === undefined) return '—'
  return `${fmtHours(n)} hrs`
}

// "07 Jul 2026" — unambiguous day-month-year for an ops audience.
export function fmtDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// "2026-07-11" — for <input type="date"> defaults and DB date columns.
export function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
