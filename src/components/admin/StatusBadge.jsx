const STYLES = {
  active: 'bg-teal/15 text-tealDark',
  trialing: 'bg-blue/15 text-navyMid',
  trial_expired: 'bg-muted/15 text-muted',
  suspended: 'bg-coral/15 text-coral',
  comped: 'bg-amber/15 text-amber',
  canceled: 'bg-muted/15 text-muted',
  past_due: 'bg-coral/15 text-coral',
}

const LABELS = {
  active: 'Active',
  trialing: 'Trialing',
  trial_expired: 'Trial expired',
  suspended: 'Suspended',
  comped: 'Comped',
  canceled: 'Canceled',
  past_due: 'Past due',
}

export default function StatusBadge({ status }) {
  const style = STYLES[status] ?? 'bg-muted/15 text-muted'
  const label = LABELS[status] ?? status
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${style}`}>
      {label}
    </span>
  )
}
