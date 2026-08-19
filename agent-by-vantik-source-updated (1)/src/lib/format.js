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
