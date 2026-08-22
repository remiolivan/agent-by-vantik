import { Link } from 'react-router-dom'

const TABS = [
  { key: 'dashboard', to: '/admin', label: 'Organizations' },
  { key: 'users', to: '/admin/users', label: 'Users' },
  { key: 'activity', to: '/admin/activity', label: 'Activity log' },
]

export default function AdminTabs({ active }) {
  return (
    <div className="flex gap-1 border-b border-muted/15 mb-6 overflow-x-auto">
      {TABS.map((t) => (
        <Link
          key={t.key}
          to={t.to}
          className={`px-3.5 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
            active === t.key
              ? 'border-navyDeep text-navyDeep font-medium'
              : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}
