// Vantik mark — official geometry from the brand kit (v2.1, Aug 2026):
// three ascending bars (navy / mid blue / gold, viewBox 0 0 253 354) capped
// by an amber beacon of concentric rings. Flat single-tone fills — the kit
// itself calls for flat colors (no gradient/glow) below ~40px, which is
// every size this mark ever renders at in the app (sidebar, mobile header).
//
// Bar 1 (shortest) is Navy on light backgrounds, but switches to Paper on
// dark backgrounds — documented fix in the v2.1 kit: Navy against the dark
// lockup's Void background measures 1.15:1 contrast (barely visible),
// while Paper measures 18.3:1. Bars 2 and 3 (Mid Blue, Gold) never recolor.
function Mark({ size = 32, on = 'light' }) {
  const bar1 = on === 'dark' ? '#F7F5F0' : '#16213E'
  return (
    <svg width={size} height={size * (354 / 253)} viewBox="0 0 253 354" fill="none" aria-hidden="true">
      <rect x="0" y="234" width="65" height="120" rx="12" fill={bar1} />
      <rect x="89" y="174" width="64" height="180" rx="12" fill="#4C7BC9" />
      <rect x="177" y="91" width="64" height="263" rx="12" fill="#C9A868" />
      <circle cx="207" cy="45" r="22" stroke="#E8963C" strokeOpacity="0.55" strokeWidth="4" fill="none" />
      <circle cx="207" cy="45" r="10" fill="#E8963C" />
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
      <Mark size={size * 0.72} on={on} />
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
