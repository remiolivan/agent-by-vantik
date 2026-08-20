import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import Layout from '../components/Layout'

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ properties: 0, tasks: 0, prospects: 0 })
  const [todayEvents, setTodayEvents] = useState([])
  const [todayTasks, setTodayTasks] = useState([])

  async function load() {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999)

    const [{ count: properties }, { count: tasks }, { count: prospects }, { data: events }, { data: dueTasks }] = await Promise.all([
      supabase.from('properties').select('*', { count: 'exact', head: true }),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).is('completed_at', null),
      supabase.from('contacts').select('*', { count: 'exact', head: true }),
      supabase.from('calendar_events')
        .select('*, contacts(name), properties(title)')
        .gte('start_at', startOfDay.toISOString())
        .lte('start_at', endOfDay.toISOString())
        .order('start_at', { ascending: true }),
      // "Today's tasks" = due today, or overdue and still open — both need attention today.
      supabase.from('tasks')
        .select('*, contacts(name), properties(title)')
        .is('completed_at', null)
        .lte('due_at', endOfDay.toISOString())
        .order('due_at', { ascending: true, nullsFirst: false }),
    ])
    setStats({ properties: properties ?? 0, tasks: tasks ?? 0, prospects: prospects ?? 0 })
    setTodayEvents(events ?? [])
    setTodayTasks(dueTasks ?? [])
  }

  useEffect(() => { if (user) load() }, [user])

  async function toggleTask(task) {
    await supabase.from('tasks').update({ completed_at: task.completed_at ? null : new Date().toISOString() }).eq('id', task.id)
    load()
  }

  return (
    <Layout title="Dashboard">
      <div className="flex flex-col gap-6">
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
            {todayTasks.map((t) => (
              <div key={t.id} className="flex items-start gap-3 px-4 py-3">
                <input
                  type="checkbox" checked={!!t.completed_at} onChange={() => toggleTask(t)}
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
              </div>
            ))}
            {todayTasks.length === 0 && (
              <p className="text-sm text-muted text-center py-6">No tasks due today.</p>
            )}
          </div>
        </div>
      </div>
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
