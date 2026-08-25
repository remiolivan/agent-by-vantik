// Agent by Vantik — brand mark (ascending bars + summit rings)
// Matches the provided brand asset pack (agent-lockup-horizontal / agent-icon-stacked)

// Bars use navy/mid/gold on light backgrounds, and paper/mid/gold on navy
// surfaces (matches the "aLight" / "aDark" symbols in Direction A).
function Mark({ size = 32, on = 'light' }) {
  const bar1 = on === 'dark' ? '#F7F5F0' : '#16213E'
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" aria-hidden="true">
      <rect x="8" y="52" width="15" height="14" rx="2" fill={bar1} />
      <rect x="27" y="38" width="15" height="28" rx="2" fill="#4C7BC9" />
      <rect x="46" y="21" width="15" height="45" rx="2" fill="#C9A868" />
      <circle cx="53.5" cy="14" r="10" fill="none" stroke="#E8963C" strokeOpacity="0.5" strokeWidth="1.6" />
      <circle cx="53.5" cy="14" r="4.2" fill="#E8963C" />
    </svg>
  )
}

// variant: 'icon' (mark only) | 'full' (mark + wordmark)
// on: 'light' background (navy text) | 'dark' background (white text)
export default function Logo({ variant = 'full', on = 'light', size = 32, className = '' }) {
  if (variant === 'icon') {
    return <Mark size={size} on={on} />
  }

  const titleColor = on === 'dark' ? 'text-white' : 'text-navy'
  const subColor = on === 'dark' ? 'text-navMuted' : 'text-muted'

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Mark size={size} on={on} />
      <div className="leading-none">
        <div className={`font-display font-bold tracking-tight ${titleColor}`} style={{ fontSize: size * 0.62 }}>
          Agent
        </div>
        <div
          className={`font-display font-medium uppercase ${subColor}`}
          style={{ fontSize: size * 0.24, marginTop: 2, letterSpacing: '0.18em' }}
        >
          by Vantik
        </div>
      </div>
    </div>
  )
}
