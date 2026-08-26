import { NavLink } from 'react-router-dom'

export default function AdminSectionNav({ active }) {
  const base = 'px-4 py-2 rounded-md text-sm font-medium transition-colors'
  return (
    <div className="flex gap-2 mb-6">
      <NavLink
        to="/admin/support"
        className={() => `${base} ${active === 'support' ? 'bg-navyDeep text-white' : 'bg-white border border-border text-muted hover:text-navyDeep'}`}
      >
        Support
      </NavLink>
      <NavLink
        to="/admin/kpis"
        className={() => `${base} ${active === 'kpis' ? 'bg-navyDeep text-white' : 'bg-white border border-border text-muted hover:text-navyDeep'}`}
      >
        KPIs
      </NavLink>
    </div>
  )
}
