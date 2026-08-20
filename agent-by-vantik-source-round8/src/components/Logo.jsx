// Agent by Vantik — brand mark (ascending bars + summit rings)
// Matches the provided brand asset pack (agent-lockup-horizontal / agent-icon-stacked)

function Mark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" aria-hidden="true">
      <rect x="8" y="52" width="15" height="14" rx="2" fill="#3A5A8C" />
      <rect x="27" y="38" width="15" height="28" rx="2" fill="#4E7BC9" />
      <rect x="46" y="21" width="15" height="45" rx="2" fill="#D8B45C" />
      <circle cx="53.5" cy="14" r="10" fill="none" stroke="#D8B45C" strokeOpacity="0.4" strokeWidth="1.6" />
      <circle cx="53.5" cy="14" r="6.5" fill="none" stroke="#D8B45C" strokeOpacity="0.6" strokeWidth="1.6" />
      <circle cx="53.5" cy="14" r="2.6" fill="#D8B45C" />
    </svg>
  )
}

// variant: 'icon' (mark only) | 'full' (mark + wordmark)
// on: 'light' background (navy text) | 'dark' background (white text)
export default function Logo({ variant = 'full', on = 'light', size = 32, className = '' }) {
  if (variant === 'icon') {
    return <Mark size={size} />
  }

  const titleColor = on === 'dark' ? 'text-white' : 'text-navyDeep'
  const subColor = on === 'dark' ? 'text-blueLight' : 'text-muted'

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Mark size={size} />
      <div className="leading-none">
        <div className={`font-display font-semibold tracking-tight ${titleColor}`} style={{ fontSize: size * 0.62 }}>
          Agent
        </div>
        <div className={`font-body ${subColor}`} style={{ fontSize: size * 0.28, marginTop: 1 }}>
          by Vantik
        </div>
      </div>
    </div>
  )
}
