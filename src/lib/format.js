// Formats a number with thousands separators, e.g. 1234567 -> "1,234,567".
// Returns an empty string / dash-safe value for null/undefined/NaN so callers
// can drop it straight into JSX without extra guards for missing data.
export function formatNumber(value, { fallback = null } = {}) {
  if (value === null || value === undefined || value === '') return fallback
  const num = Number(value)
  if (Number.isNaN(num)) return fallback
  return num.toLocaleString('en-US')
}

// Same as formatNumber but prefixes a currency code, e.g. formatMoney(1200, 'USD') -> "USD 1,200".
export function formatMoney(value, currency = 'USD', { fallback = '—' } = {}) {
  const formatted = formatNumber(value, { fallback: null })
  if (formatted === null) return fallback
  return `${currency} ${formatted}`
}

// Returns a datetime-local input value (YYYY-MM-DDTHH:mm) rounded up to the
// next quarter hour, e.g. 14:03 -> 14:15. Used to default new task/event due
// times to a round slot instead of "now" (which is rarely a clean time).
export function nextQuarterHour(date = new Date()) {
  const d = new Date(date)
  d.setSeconds(0, 0)
  const remainder = d.getMinutes() % 15
  if (remainder !== 0) d.setMinutes(d.getMinutes() + (15 - remainder))
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
