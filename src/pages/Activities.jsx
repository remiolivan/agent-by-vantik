import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const TYPES = ['note', 'call', 'email', 'meeting']

export default function Activities() {
  const [activities, setActivities] = useState([])
  const [type, setType] = useState('note')
  const [content, setContent] = useState('')

  async function load() {
    const { data } = await supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(50)
    setActivities(data ?? [])
  }

  useEffect(() => { load() }, [])

  async function createActivity(e) {
    e.preventDefault()
    const { data: membership } = await supabase.from('memberships').select('org_id, id').single()
    await supabase.from('activities').insert({
      org_id: membership.org_id, actor_id: membership.id, type, content,
    })
    setContent('')
    load()
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-muted/20 px-8 py-5">
        <div className="font-display text-lg font-medium text-navyDeep">Activity</div>
      </header>

      <main className="max-w-2xl mx-auto px-8 py-8">
        <form onSubmit={createActivity} className="flex gap-3 items-start mb-8">
          <select value={type} onChange={(e) => setType(e.target.value)} className="border border-muted/30 rounded px-3 py-2 text-sm">
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <textarea
            value={content} onChange={(e) => setContent(e.target.value)}
            placeholder="Log a call, note, meeting…" required rows={2}
            className="flex-1 border border-muted/30 rounded px-3 py-2 text-sm"
          />
          <button type="submit" className="bg-navyDeep text-white text-sm rounded px-4 py-2">Log</button>
        </form>

        <div className="space-y-4">
          {activities.map((a) => (
            <div key={a.id} className="bg-white border border-muted/20 rounded p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs uppercase tracking-wide text-teal">{a.type}</span>
                <span className="text-xs text-muted font-mono">{new Date(a.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-ink">{a.content}</p>
            </div>
          ))}
          {activities.length === 0 && <p className="text-sm text-muted text-center py-8">No activity logged yet.</p>}
        </div>
      </main>
    </div>
  )
}
