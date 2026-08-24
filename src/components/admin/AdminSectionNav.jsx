import { NavLink } from 'react-router-dom'

export default function AdminSectionNav({ active }) {
  const base = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors'
  return (
    <div className="flex gap-2 mb-6">
      <NavLink
        to="/admin"
        end
        className={() => `${base} ${active === 'kpis' ? 'bg-navyDeep text-white' : 'bg-white border border-muted/20 text-muted hover:text-navyDeep'}`}
      >
        KPIs
      </NavLink>
      <NavLink
        to="/admin/support"
        className={() => `${base} ${active === 'support' ? 'bg-navyDeep text-white' : 'bg-white border border-muted/20 text-muted hover:text-navyDeep'}`}
      >
        Support
      </NavLink>
    </div>
  )
}
