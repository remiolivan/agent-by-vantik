import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { formatMoney } from '../lib/format'
import Layout from '../components/Layout'
import FollowUpDraft from '../components/FollowUpDraft'

// Local time, not UTC — someone in Dubai shouldn't get "good morning" from a
// server clock that thinks it's still the middle of the night.
function timeOfDayGreeting() {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 18) return 'Good afternoon'
  if (hour >= 18 && hour < 22) return 'Good evening'
  return 'Good night'
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ properties: 0, tasks: 0, prospects: 0 })
  const [kpis, setKpis] = useState({
    pipelineValue: 0, pipelineCurrency: 'AED', pipelineHasOtherCurrencies: false,
    closingCount: 0, closingValue: 0,
    dueCount: 0, overdueCount: 0,
    newLeadsThisWeek: 0,
  })
  const [todayEvents, setTodayEvents] = useState([])
  const [todayTasks, setTodayTasks] = useState([])
  const [greetingName, setGreetingName] = useState(null)
  const [followUpTarget, setFollowUpTarget] = useState(null) // { contactId, propertyId, contactPhone, contactEmail } | null

  async function load() {
    const now = new Date()
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    // Week starts Monday, not Sunday — matches the calendar's WEEKDAY_LABELS elsewhere in the app.
    const startOfWeek = new Date(startOfDay)
    const dayOffset = (startOfDay.getDay() + 6) % 7
    startOfWeek.setDate(startOfWeek.getDate() - dayOffset)

    const [
      { count: properties }, { count: tasks }, { count: prospects },
      { data: events }, { data: dueTasks }, { data: membership },
      { data: stages }, { data: allProperties }, { data: allTasks }, { count: newLeads },
    ] = await Promise.all([
      supabase.from('properties').select('*', { count: 'exact', head: true }),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).is('completed_at', null),
      supabase.from('contacts').select('*', { count: 'exact', head: true }),
      supabase.from('calendar_events')
        .select('*, contacts(name), properties(title)')
        .gte('start_at', startOfDay.toISOString())
        .lte('start_at', endOfDay.toISOString())
        .order('start_at', { ascending: true }),
      // "Today's tasks" = due today, or overdue and still open — both need
      // attention today. Also pulls the contact's phone/email so the
      // follow-up popup below can offer WhatsApp/email send buttons without
      // a second round trip.
      supabase.from('tasks')
        .select('*, contacts(name, phone, email), properties(title)')
        .is('completed_at', null)
        .lte('due_at', endOfDay.toISOString())
        .order('due_at', { ascending: true, nullsFirst: false }),
      supabase.from('memberships').select('org_id').single(),
      supabase.from('pipeline_stages').select('id, is_won, is_lost').eq('pipeline_type', 'property'),
      supabase.from('properties').select('value, currency, stage_id, expected_close_date'),
      // Separate from todayTasks above: this one needs every open task (no
      // due_at cutoff) so the overdue count isn't silently capped by "today".
      supabase.from('tasks').select('due_at').is('completed_at', null).not('due_at', 'is', null),
      supabase.from('contacts').select('*', { count: 'exact', head: true })
        .eq('type', 'lead').gte('created_at', startOfWeek.toISOString()),
    ])
    setStats({ properties: properties ?? 0, tasks: tasks ?? 0, prospects: prospects ?? 0 })
    setTodayEvents(events ?? [])
    setTodayTasks(dueTasks ?? [])

    // Needed for the pipeline currency fix below, and (if there's no
    // Google/Microsoft profile name) the dashboard greeting.
    const { data: org } = membership?.org_id
      ? await supabase.from('organizations').select('name, base_currency').eq('id', membership.org_id).single()
      : { data: null }
    const baseCurrency = org?.base_currency || 'AED'

    const openStageIds = new Set((stages ?? []).filter((s) => !s.is_won && !s.is_lost).map((s) => s.id))
    const lostStageIds = new Set((stages ?? []).filter((s) => s.is_lost).map((s) => s.id))
    const props = allProperties ?? []
    // Summing `value` across properties only makes sense when they're all in
    // the same currency — this app has no FX conversion. Rather than adding
    // AED and USD/EUR figures together and slapping one currency label on
    // the (wrong) total, the pipeline only counts deals in the org's base
    // currency, and flags when other-currency deals were excluded so the
    // number is at least honest about what it's showing.
    const openProps = props.filter((p) => openStageIds.has(p.stage_id))
    const pipelineValue = openProps
      .filter((p) => (p.currency || 'AED') === baseCurrency)
      .reduce((sum, p) => sum + (Number(p.value) || 0), 0)
    const pipelineHasOtherCurrencies = openProps.some((p) => (p.currency || 'AED') !== baseCurrency)
    const closing = props.filter((p) => {
      if (!p.expected_close_date || lostStageIds.has(p.stage_id)) return false
      const d = new Date(p.expected_close_date)
      return d >= startOfMonth && d <= endOfMonth
    })
    const closingValue = closing
      .filter((p) => (p.currency || 'AED') === baseCurrency)
      .reduce((sum, p) => sum + (Number(p.value) || 0), 0)

    const dueCount = (allTasks ?? []).filter((t) => new Date(t.due_at) <= endOfDay).length
    const overdueCount = (allTasks ?? []).filter((t) => new Date(t.due_at) < now).length

    setKpis({
      pipelineValue, pipelineCurrency: baseCurrency, pipelineHasOtherCurrencies,
      closingCount: closing.length, closingValue,
      dueCount, overdueCount,
      newLeadsThisWeek: newLeads ?? 0,
    })

    // Prefer the person's first name (from Google/Microsoft profile data, or
    // full_name if they ever set one) over the business name — "Welcome
    // back, Sarah" reads better than "Welcome back, My Real Estate Company"
    // — but fall back to the org name since email/password signups don't
    // collect a personal name anywhere today.
    const metaName = user?.user_metadata?.full_name || user?.user_metadata?.name
    if (metaName) {
      setGreetingName(metaName.split(' ')[0])
    } else if (org?.name) {
      setGreetingName(org.name)
    }
  }

  useEffect(() => { if (user) load() }, [user])

  async function toggleTask(task) {
    await supabase.from('tasks').update({ completed_at: task.completed_at ? null : new Date().toISOString() }).eq('id', task.id)
    load()
  }

  return (
    <Layout title={greetingName ? `${timeOfDayGreeting()}, ${greetingName}` : 'Dashboard'}>
      <div className="flex flex-col gap-6">
        {/* The numbers an agent checks first: what's the pipeline actually
            worth, what's closing soon, what's overdue, is the funnel being
            fed. Sits above the generic counts below since these are the
            ones with a decision attached. */}
        <div className="order-0 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard
            label="Pipeline value"
            value={formatMoney(kpis.pipelineValue, kpis.pipelineCurrency)}
            sub={kpis.pipelineHasOtherCurrencies ? `Other currencies not shown` : null}
          />
          <KpiCard
            label="Closing this month"
            value={kpis.closingCount}
            sub={kpis.closingCount > 0 ? formatMoney(kpis.closingValue, kpis.pipelineCurrency) : null}
          />
          <KpiCard
            label="Follow-ups due"
            value={kpis.dueCount}
            sub={kpis.overdueCount > 0 ? `${kpis.overdueCount} overdue` : null}
            subClassName={kpis.overdueCount > 0 ? 'text-red-600' : undefined}
          />
          <KpiCard label="New leads this week" value={kpis.newLeadsThisWeek} />
        </div>

        {/* On mobile: today's appointments + tasks come first (what to act on), stats below. */}
        <div className="order-3 sm:order-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Active properties" value={stats.properties} />
          <StatCard label="Pending tasks" value={stats.tasks} />
          <StatCard label="Prospects" value={stats.prospects} />
        </div>

        <div className="order-1 sm:order-2">
          <div className="font-mono text-xs uppercase tracking-wide text-muted mb-3">Today's appointments</div>
          <div className="bg-white border border-muted/20 rounded-xl divide-y divide-muted/10">
            {todayEvents.map((ev) => (
              <Link key={ev.id} to="/calendar" className="flex items-start gap-3 px-4 py-3 hover:bg-tintBlue/30">
                <div className="font-mono text-xs text-navyDeep w-14 shrink-0 pt-0.5">
                  {new Date(ev.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-ink truncate">{ev.title}</div>
                  {ev.location && (
                    <div className="text-xs text-muted flex items-center gap-1 mt-0.5 truncate"><MapPin size={11} /> {ev.location}</div>
                  )}
                  {(ev.contacts?.name || ev.properties?.title) && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {ev.contacts?.name && <span className="text-xs text-navyDeep bg-tintBlue rounded px-2 py-0.5">{ev.contacts.name}</span>}
                      {ev.properties?.title && <span className="text-xs text-teal-700 bg-teal/10 rounded px-2 py-0.5">{ev.properties.title}</span>}
                    </div>
                  )}
                </div>
              </Link>
            ))}
            {todayEvents.length === 0 && (
              <p className="text-sm text-muted text-center py-6">No appointments today.</p>
            )}
          </div>
        </div>

        <div className="order-2 sm:order-3">
          <div className="font-mono text-xs uppercase tracking-wide text-muted mb-3">Today's tasks</div>
          <div className="bg-white border border-muted/20 rounded-xl divide-y divide-muted/10">
            {todayTasks.map((t) => {
              // Only tasks tied to a prospect or property have anything for
              // the AI draft to work with — plain standalone tasks (e.g.
              // "renew license") stay checkbox-only, no dead click target.
              const canFollowUp = !!(t.prospect_id || t.property_id)
              return (
                <div
                  key={t.id}
                  className={`flex items-start gap-3 px-4 py-3 ${canFollowUp ? 'cursor-pointer hover:bg-tintBlue/30' : ''}`}
                  onClick={canFollowUp ? () => setFollowUpTarget({
                    contactId: t.prospect_id || null,
                    propertyId: t.property_id || null,
                    contactPhone: t.contacts?.phone || null,
                    contactEmail: t.contacts?.email || null,
                  }) : undefined}
                >
                  <input
                    type="checkbox" checked={!!t.completed_at}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleTask(t)}
                    className="w-5 h-5 accent-teal shrink-0 mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-ink truncate">{t.title}</div>
                    {t.description && <div className="text-xs text-muted mt-0.5">{t.description}</div>}
                    {(t.contacts?.name || t.properties?.title) && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {t.contacts?.name && <span className="text-xs text-navyDeep bg-tintBlue rounded px-2 py-0.5">{t.contacts.name}</span>}
                        {t.properties?.title && <span className="text-xs text-teal-700 bg-teal/10 rounded px-2 py-0.5">{t.properties.title}</span>}
                      </div>
                    )}
                  </div>
                  {canFollowUp && <Sparkles size={14} className="text-teal shrink-0 mt-1" aria-label="Draft a follow-up" />}
                </div>
              )
            })}
            {todayTasks.length === 0 && (
              <p className="text-sm text-muted text-center py-6">No tasks due today.</p>
            )}
          </div>
        </div>
      </div>

      {followUpTarget && (
        <FollowUpDraft
          contactId={followUpTarget.contactId}
          propertyId={followUpTarget.propertyId}
          contactPhone={followUpTarget.contactPhone}
          contactEmail={followUpTarget.contactEmail}
          onClose={() => setFollowUpTarget(null)}
          onLogged={() => load()}
        />
      )}
    </Layout>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white border border-muted/20 rounded-xl p-6">
      <div className="font-mono text-xs uppercase tracking-wide text-muted mb-2">{label}</div>
      <div className="font-display text-3xl font-medium text-navyDeep">{value}</div>
    </div>
  )
}

function KpiCard({ label, value, sub, subClassName }) {
  return (
    <div className="bg-white border border-muted/20 rounded-xl p-4 sm:p-5">
      <div className="font-mono text-[10px] sm:text-xs uppercase tracking-wide text-muted mb-1.5">{label}</div>
      <div className="font-display text-xl sm:text-2xl font-medium text-navyDeep">{value}</div>
      {sub && <div className={`text-xs mt-1 ${subClassName || 'text-muted'}`}>{sub}</div>}
    </div>
  )
}
