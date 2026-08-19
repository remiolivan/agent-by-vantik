import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Tasks() {
  const [tasks, setTasks] = useState([])
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')

  async function load() {
    const { data } = await supabase.from('tasks').select('*').order('due_at', { ascending: true, nullsFirst: false })
    setTasks(data ?? [])
  }

  useEffect(() => { load() }, [])

  async function createTask(e) {
    e.preventDefault()
    const { data: membership } = await supabase.from('memberships').select('org_id, id').single()
    await supabase.from('tasks').insert({
      title, org_id: membership.org_id,
      assignee_id: membership.id,
      due_at: dueAt || null,
    })
    setTitle(''); setDueAt('')
    load()
  }

  async function toggleComplete(task) {
    await supabase.from('tasks').update({
      completed_at: task.completed_at ? null : new Date().toISOString(),
    }).eq('id', task.id)
    load()
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-muted/20 px-8 py-5">
        <div className="font-display text-lg font-medium text-navyDeep">Tasks</div>
      </header>

      <main className="max-w-2xl mx-auto px-8 py-8">
        <form onSubmit={createTask} className="flex gap-3 items-center mb-8">
          <input
            value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title" required
            className="flex-1 border border-muted/30 rounded px-3 py-2 text-sm"
          />
          <input
            type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)}
            className="border border-muted/30 rounded px-3 py-2 text-sm"
          />
          <button type="submit" className="bg-navyDeep text-white text-sm rounded px-4 py-2">Add</button>
        </form>

        <div className="space-y-2">
          {tasks.map((t) => (
            <div key={t.id} className="bg-white border border-muted/20 rounded px-4 py-3 flex items-center gap-3">
              <input
                type="checkbox" checked={!!t.completed_at}
                onChange={() => toggleComplete(t)}
                className="w-4 h-4"
              />
              <div className="flex-1">
                <div className={`text-sm ${t.completed_at ? 'line-through text-muted' : 'text-ink'}`}>{t.title}</div>
                {t.due_at && (
                  <div className="text-xs text-muted font-mono">{new Date(t.due_at).toLocaleString()}</div>
                )}
              </div>
            </div>
          ))}
          {tasks.length === 0 && <p className="text-sm text-muted text-center py-8">No tasks yet.</p>}
        </div>
      </main>
    </div>
  )
}
