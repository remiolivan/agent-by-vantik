import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'

export default function Overview() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ deals: 0, tasks: 0, contacts: 0 })

  useEffect(() => {
    async function load() {
      const [{ count: deals }, { count: tasks }, { count: contacts }] = await Promise.all([
        supabase.from('deals').select('*', { count: 'exact', head: true }),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).is('completed_at', null),
        supabase.from('contacts').select('*', { count: 'exact', head: true }),
      ])
      setStats({ deals: deals ?? 0, tasks: tasks ?? 0, contacts: contacts ?? 0 })
    }
    if (user) load()
  }, [user])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-fog/20 px-8 py-5 flex items-center justify-between">
        <div className="font-display text-lg font-medium text-nightfall">Agent by Vantik</div>
        <div className="flex items-center gap-6">
          <Link to="/deals" className="text-sm text-fog hover:text-ink">Pipeline</Link>
          <Link to="/contacts" className="text-sm text-fog hover:text-ink">Contacts</Link>
          <Link to="/tasks" className="text-sm text-fog hover:text-ink">Tasks</Link>
          <Link to="/documents" className="text-sm text-fog hover:text-ink">Documents</Link>
          <Link to="/activity" className="text-sm text-fog hover:text-ink">Activity</Link>
          <Link to="/team" className="text-sm text-fog hover:text-ink">Team</Link>
          <Link to="/billing" className="text-sm text-fog hover:text-ink">Billing</Link>
          <button onClick={handleLogout} className="text-sm text-fog hover:text-ink">Log out</button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-8 py-12">
        <h1 className="font-display text-2xl font-medium text-nightfall mb-8">Overview</h1>
        <div className="grid grid-cols-3 gap-6">
          <StatCard label="Open deals" value={stats.deals} />
          <StatCard label="Pending tasks" value={stats.tasks} />
          <StatCard label="Contacts" value={stats.contacts} />
        </div>
      </main>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white border border-fog/20 rounded p-6">
      <div className="font-mono text-xs uppercase tracking-wide text-fog mb-2">{label}</div>
      <div className="font-display text-3xl font-medium text-nightfall">{value}</div>
    </div>
  )
}
