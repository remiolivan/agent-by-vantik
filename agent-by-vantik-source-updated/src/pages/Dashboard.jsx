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

  useEffect(() => {
    async function load() {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999)

      const [{ count: properties }, { count: tasks }, { count: prospects }, { data: events }] = await Promise.all([
        supabase.from('properties').select('*', { count: 'exact', head: true }),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).is('completed_at', null),
        supabase.from('contacts').select('*', { count: 'exact', head: true }),
        supabase.from('calendar_events')
          .select('*, contacts(name), properties(title)')
          .gte('start_at', startOfDay.toISOString())
          .lte('start_at', endOfDay.toISOString())
          .order('start_at', { ascending: true }),
      ])
      setStats({ properties: properties ?? 0, tasks: tasks ?? 0, prospects: prospects ?? 0 })
      setTodayEvents(events ?? [])
    }
    if (user) load()
  }, [user])

  return (
    <Layout title="Dashboard">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Active properties" value={stats.properties} />
        <StatCard label="Pending tasks" value={stats.tasks} />
        <StatCard label="Prospects" value={stats.prospects} />
      </div>

      <div>
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
