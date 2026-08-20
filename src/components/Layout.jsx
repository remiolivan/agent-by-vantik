import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutGrid, Users, Building2, CheckSquare, FileText,
  UsersRound, CreditCard, LogOut, X, MoreHorizontal, CalendarDays,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import Logo from './Logo'

const TEAM_PLANS = ['team', 'brokerage']

function navLinkClasses(isActive, dense = false) {
  const base = `flex items-center gap-3 rounded-lg text-sm transition-colors ${dense ? 'px-3 py-2' : 'px-3.5 py-2.5'}`
  return isActive
    ? `${base} bg-navyDeep text-white font-medium`
    : `${base} text-muted hover:bg-tintBlue hover:text-navyDeep`
}

export default function Layout({ title, action, children }) {
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)
  const [plan, setPlan] = useState(null)

  useEffect(() => {
    async function loadPlan() {
      const { data: membership } = await supabase.from('memberships').select('org_id').single()
      if (!membership) return
      const { data: org } = await supabase.from('organizations').select('plan').eq('id', membership.org_id).single()
      setPlan(org?.plan ?? null)
    }
    loadPlan()
  }, [])

  const showTeam = TEAM_PLANS.includes(plan)

  const PRIMARY_NAV = [
    { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
    { to: '/prospects', label: 'Prospects', icon: Users },
    { to: '/properties', label: 'Properties', icon: Building2 },
    { to: '/tasks', label: 'Tasks', icon: CheckSquare },
    { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  ]

  const MORE_NAV = [
    ...(showTeam ? [{ to: '/team', label: 'Team', icon: UsersRound }] : []),
    { to: '/documents', label: 'Invoices', icon: FileText },
    { to: '/billing', label: 'Billing', icon: CreditCard },
  ]

  const ALL_NAV = [...PRIMARY_NAV, ...MORE_NAV]

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-paper lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:border-r lg:border-muted/15 lg:bg-white lg:sticky lg:top-0 lg:h-screen">
        <div className="px-5 py-6">
          <Logo size={30} />
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {ALL_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => navLinkClasses(isActive)}
            >
              <item.icon size={18} strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 pb-5 pt-3 border-t border-muted/15">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm text-muted hover:bg-tintBlue hover:text-navyDeep w-full"
          >
            <LogOut size={18} strokeWidth={2} />
            Log out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-muted/15 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between">
        <Logo size={26} />
        <button
          onClick={handleLogout}
          aria-label="Log out"
          className="text-muted p-2 -mr-2"
        >
          <LogOut size={19} strokeWidth={2} />
        </button>
      </header>

      {/* Main content */}
      <div className="flex-1 min-w-0 pb-20 lg:pb-0">
        <div className="px-4 py-5 lg:px-10 lg:py-8 flex items-center justify-between gap-3">
          <h1 className="font-display text-xl lg:text-2xl font-medium text-navyDeep">{title}</h1>
          {action && <div className="shrink-0">{action}</div>}
        </div>
        <main className="px-4 lg:px-10 pb-8">{children}</main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-muted/15 flex items-stretch pb-[env(safe-area-inset-bottom)]">
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] ${
                isActive ? 'text-navyDeep font-medium' : 'text-faint'
              }`
            }
          >
            <item.icon size={20} strokeWidth={2} />
            {item.label}
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] text-faint"
        >
          <MoreHorizontal size={20} strokeWidth={2} />
          More
        </button>
      </nav>

      {/* Mobile "More" sheet */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-navyDeep/40" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between mb-3">
              <span className="font-display text-base font-medium text-navyDeep">More</span>
              <button onClick={() => setMoreOpen(false)} className="text-muted p-1" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-1 mb-2">
              {MORE_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) => navLinkClasses(isActive, true)}
                >
                  <item.icon size={18} strokeWidth={2} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
