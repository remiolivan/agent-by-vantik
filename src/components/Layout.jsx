import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutGrid, Users, Building2, CheckSquare, FileText,
  UsersRound, CreditCard, LogOut, X, MoreHorizontal, CalendarDays, Settings2, Shield,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { useAdmin } from '../lib/useAdmin'
import Logo from './Logo'

const TEAM_PLANS = ['team', 'brokerage']

function todayLabel() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function initialsFromEmail(email) {
  if (!email) return '—'
  const name = email.split('@')[0].replace(/[._-]+/g, ' ').trim()
  const parts = name.split(' ').filter(Boolean)
  if (parts.length === 0) return email.slice(0, 2).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function sidebarLinkClasses(isActive) {
  return `block rounded-[5px] px-3 py-2 text-[13px] transition-colors ${
    isActive
      ? 'bg-mid text-white font-semibold'
      : 'text-navLight hover:text-white hover:bg-white/5'
  }`
}

// Section header shown at the top of every page: mono uppercase label,
// today's date, round navy avatar. 52px tall, matches the Direction A spec.
function TopBar({ title }) {
  const { user } = useAuth()
  return (
    <div className="h-[52px] shrink-0 bg-white border-b border-border flex items-center justify-between px-4 lg:px-5">
      <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-muted">{title}</span>
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline font-mono text-xs text-muted">{todayLabel()}</span>
        <div className="w-[27px] h-[27px] rounded-full bg-navy text-paper text-[11px] flex items-center justify-center font-medium">
          {initialsFromEmail(user?.email)}
        </div>
      </div>
    </div>
  )
}

export default function Layout({ title, action, children }) {
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)
  const [plan, setPlan] = useState(null)
  const { isAdmin } = useAdmin()

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
    { to: '/', label: 'Dashboard', shortLabel: 'Dash', icon: LayoutGrid, end: true },
    { to: '/prospects', label: 'Prospects', shortLabel: 'Prospects', icon: Users },
    { to: '/properties', label: 'Properties', shortLabel: 'Props', icon: Building2 },
    { to: '/tasks', label: 'Tasks', shortLabel: 'Tasks', icon: CheckSquare },
    { to: '/calendar', label: 'Calendar', shortLabel: 'Cal', icon: CalendarDays },
  ]

  const MORE_NAV = [
    ...(showTeam ? [{ to: '/team', label: 'Team', icon: UsersRound }] : []),
    { to: '/documents', label: 'Invoices', icon: FileText },
    { to: '/billing', label: 'Billing', icon: CreditCard },
    { to: '/settings', label: 'Settings', icon: Settings2 },
    ...(isAdmin ? [{ to: '/admin/support', label: 'Admin', icon: Shield }] : []),
  ]

  const ALL_NAV = [...PRIMARY_NAV, ...MORE_NAV]

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-paper lg:flex">
      {/* Desktop sidebar — navy, matches Direction A "01 — Dashboard" spec */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[172px] lg:shrink-0 lg:bg-navy lg:sticky lg:top-0 lg:h-screen lg:py-4 lg:px-2.5 lg:gap-5">
        <div className="flex flex-col gap-0.5 px-1.5">
          <Logo size={26} on="dark" />
        </div>
        <nav className="flex-1 flex flex-col gap-0.5">
          {ALL_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => sidebarLinkClasses(isActive)}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={handleLogout}
          className="mt-auto text-left font-mono text-[11px] text-navFaint hover:text-navLight px-2.5 pt-3 border-t border-white/10"
        >
          Log out
        </button>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-navy px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between">
        <Logo size={24} on="dark" />
        <button onClick={handleLogout} aria-label="Log out" className="text-navLight p-2 -mr-2">
          <LogOut size={19} strokeWidth={2} />
        </button>
      </header>

      {/* Main content */}
      <div className="flex-1 min-w-0 pb-20 lg:pb-0 flex flex-col">
        <TopBar title={title} />
        <div className="px-4 py-4 lg:px-5 lg:py-5 flex items-center justify-between gap-3">
          <h1 className="font-display text-lg lg:text-xl font-semibold tracking-tight text-navy">{title}</h1>
          {action && <div className="shrink-0">{action}</div>}
        </div>
        <main className="px-4 lg:px-5 pb-8 flex-1">{children}</main>
      </div>

      {/* Mobile bottom tab bar — navy, filled square icon on active tab */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-navy grid grid-cols-6 items-stretch pb-[env(safe-area-inset-bottom)] pt-2">
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className="flex flex-col items-center justify-center gap-1 py-1.5 text-[10px]"
          >
            {({ isActive }) => (
              <>
                <span
                  className={`w-6 h-6 rounded-[6px] flex items-center justify-center ${
                    isActive ? 'bg-mid' : 'border-[1.5px] border-navFaint'
                  }`}
                >
                  <item.icon size={14} strokeWidth={2} className={isActive ? 'text-white' : 'text-navMuted'} />
                </span>
                <span className={isActive ? 'text-white font-semibold' : 'text-navMuted'}>{item.shortLabel}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center justify-center gap-1 py-1.5 text-[10px] text-navMuted"
        >
          <span className="w-6 h-6 rounded-[6px] border-[1.5px] border-navFaint flex items-center justify-center">
            <MoreHorizontal size={14} strokeWidth={2} className="text-navMuted" />
          </span>
          More
        </button>
      </nav>

      {/* Mobile "More" sheet */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-navy/50" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-sheet">
            <div className="flex items-center justify-between mb-3">
              <span className="font-display text-base font-semibold text-navy">More</span>
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
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-[5px] px-3 py-2.5 text-sm ${
                      isActive ? 'bg-navy text-white font-medium' : 'text-ink hover:bg-paper'
                    }`
                  }
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
