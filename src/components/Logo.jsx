// Agent by Vantik mark — official construction from Agent_Brand_Assets_dc.html.
//
// Below ~32px (every size this renders at in the app: sidebar ~26px, mobile
// header ~24-28px) the spec calls for "flat fills, solid beacon, no relief —
// the 16/32px rule": a single solid amber circle, no concentric rings (those
// only exist on the large hero/marketing version of the mark, where they're
// actually visible).
//
// Bar 1 (shortest) is Navy on light backgrounds, Paper on dark — the
// documented fix for Navy's near-invisible contrast against dark surfaces.
function Mark({ size = 32, on = 'light' }) {
  const bar1 = on === 'dark' ? '#F7F5F0' : '#16213E'
  return (
    <svg width={size} height={size * (354 / 253)} viewBox="0 0 253 354" fill="none" aria-hidden="true">
      <rect x="0" y="234" width="65" height="120" rx="12" fill={bar1} />
      <rect x="89" y="174" width="64" height="180" rx="12" fill="#4C7BC9" />
      <rect x="177" y="91" width="64" height="263" rx="12" fill="#C9A868" />
      <circle cx="207" cy="45" r="30" fill="#E8963C" />
    </svg>
  )
}

// variant: 'icon' (mark only) | 'full' (mark + wordmark)
// on: 'light' background (navy text) | 'dark' background (white text)
//
// Construction rules (from the brand doc): bars sit on the baseline of
// "Agent"; "by Vantik" sits on its own row below the whole lockup, left
// edge aligned to bar 1 — not indented under the wordmark.
export default function Logo({ variant = 'full', on = 'light', size = 32, className = '' }) {
  if (variant === 'icon') {
    return <Mark size={size} on={on} />
  }

  const titleColor = on === 'dark' ? 'text-white' : 'text-navy'
  const subColor = on === 'dark' ? 'text-navMuted' : 'text-muted'
  const markSize = size * 0.72

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-end gap-2">
        <Mark size={markSize} on={on} />
        <div className={`font-display font-bold tracking-tight leading-none ${titleColor}`} style={{ fontSize: size * 0.62 }}>
          Agent
        </div>
      </div>
      <div
        className={`font-display font-medium uppercase leading-none ${subColor}`}
        style={{ fontSize: size * 0.24, letterSpacing: '0.18em' }}
      >
        by Vantik
      </div>
    </div>
  )
}
