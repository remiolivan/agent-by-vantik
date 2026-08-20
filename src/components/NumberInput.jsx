import { useEffect, useState } from 'react'

// Formats a raw numeric string into "1,234,567" or "1,234,567.5" while
// typing, keeping a trailing decimal point intact so the user can keep
// typing digits after it (e.g. "1200000." shouldn't collapse to
// "1,200,000" and eat the dot the user just typed).
function formatLive(raw) {
  let cleaned = raw.replace(/[^0-9.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '')
  }
  if (cleaned === '') return { display: '', numeric: '' }
  const [intPart, decPart] = cleaned.split('.')
  const formattedInt = intPart === '' ? '' : Number(intPart).toLocaleString('en-US')
  const display = decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt
  return { display, numeric: cleaned }
}

// A text input for money/quantity fields (price, budget, invoice amount)
// that shows thousands separators live as the user types, e.g. typing
// "1200000" renders as "1,200,000". The plain, comma-free numeric string is
// what gets passed to onChange, so callers keep storing/submitting plain
// numbers exactly as before — only the display changes.
export default function NumberInput({ value, onChange, className = '', placeholder, ...rest }) {
  const [display, setDisplay] = useState(() => formatLive(String(value ?? '')).display)

  // Re-sync the displayed text when the value changes from outside this
  // field (e.g. switching between records being edited), but don't fight
  // the user while they're actively typing in it.
  useEffect(() => {
    setDisplay(formatLive(String(value ?? '')).display)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function handleChange(e) {
    const { display: nextDisplay, numeric } = formatLive(e.target.value)
    setDisplay(nextDisplay)
    onChange(numeric)
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      {...rest}
    />
  )
}
