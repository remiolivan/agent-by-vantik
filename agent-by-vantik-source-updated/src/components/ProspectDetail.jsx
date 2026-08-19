import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'

const INTENTS = [
  { value: '', label: 'Not set' },
  { value: 'buy', label: 'Buying' },
  { value: 'rent', label: 'Renting' },
]

export default function ProspectDetail({ prospect, onClose, onUpdated }) {
  const [criteria, setCriteria] = useState({
    intent: prospect.intent || '',
    budget_min: prospect.budget_min ?? '',
    budget_max: prospect.budget_max ?? '',
    bedrooms_wanted: prospect.bedrooms_wanted ?? '',
    locations_wanted: prospect.locations_wanted || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [tasks, setTasks] = useState([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDue, setNewTaskDue] = useState('')
  const [addingTask, setAddingTask] = useState(false)

  async function loadTasks() {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('prospect_id', prospect.id)
      .order('due_at', { ascending: true, nullsFirst: false })
    setTasks(data ?? [])
  }

  useEffect(() => { loadTasks() }, [prospect.id])

  async function saveCriteria(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    await supabase.from('contacts').update({
      intent: criteria.intent || null,
      budget_min: criteria.budget_min === '' ? null : Number(criteria.budget_min),
      budget_max: criteria.budget_max === '' ? null : Number(criteria.budget_max),
      bedrooms_wanted: criteria.bedrooms_wanted === '' ? null : Number(criteria.bedrooms_wanted),
      locations_wanted: criteria.locations_wanted || null,
    }).eq('id', prospect.id)
    setSaving(false)
    setSaved(true)
    onUpdated?.()
  }

  async function addTask(e) {
    e.preventDefault()
    if (!newTaskTitle.trim()) return
    setAddingTask(true)
    const { data: membership } = await supabase.from('memberships').select('org_id, id').single()
    await supabase.from('tasks').insert({
      title: newTaskTitle,
      org_id: membership.org_id,
      assignee_id: membership.id,
      prospect_id: prospect.id,
      due_at: newTaskDue || null,
    })
    setNewTaskTitle('')
    setNewTaskDue('')
    setAddingTask(false)
    loadTasks()
  }

  async function toggleTask(task) {
    await supabase.from('tasks').update({
      completed_at: task.completed_at ? null : new Date().toISOString(),
    }).eq('id', task.id)
    loadTasks()
  }

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-navyDeep/40" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full sm:max-w-md bg-paper overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-muted/15 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <div className="font-display text-lg font-medium text-navyDeep">{prospect.name}</div>
            {prospect.email && <div className="text-xs text-muted">{prospect.email}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted p-1">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-8">
          {/* Search criteria */}
          <div>
            <div className="font-mono text-xs uppercase tracking-wide text-muted mb-3">Looking for</div>
            <form onSubmit={saveCriteria} className="bg-white border border-muted/20 rounded-xl p-4 space-y-3">
              <select
                value={criteria.intent}
                onChange={(e) => setCriteria({ ...criteria, intent: e.target.value })}
                className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
              >
                {INTENTS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
              <div className="flex gap-3">
                <input
                  value={criteria.budget_min} onChange={(e) => setCriteria({ ...criteria, budget_min: e.target.value })}
                  placeholder="Budget min" type="number"
                  className="flex-1 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
                />
                <input
                  value={criteria.budget_max} onChange={(e) => setCriteria({ ...criteria, budget_max: e.target.value })}
                  placeholder="Budget max" type="number"
                  className="flex-1 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
                />
              </div>
              <input
                value={criteria.bedrooms_wanted} onChange={(e) => setCriteria({ ...criteria, bedrooms_wanted: e.target.value })}
                placeholder="Bedrooms wanted" type="number"
                className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
              />
              <input
                value={criteria.locations_wanted} onChange={(e) => setCriteria({ ...criteria, locations_wanted: e.target.value })}
                placeholder="Locations (e.g. Marina, JBR, Downtown)"
                className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
              />
              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving} className="bg-navyDeep text-white text-sm rounded-lg px-4 py-2.5 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
                {saved && <span className="text-xs text-teal-700">Saved.</span>}
              </div>
            </form>
          </div>

          {/* Tasks */}
          <div>
            <div className="font-mono text-xs uppercase tracking-wide text-muted mb-3">Tasks</div>
            <form onSubmit={addTask} className="flex gap-2 mb-3">
              <input
                value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="New task" className="flex-1 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
              />
              <input
                type="datetime-local" value={newTaskDue} onChange={(e) => setNewTaskDue(e.target.value)}
                className="border border-muted/30 rounded-lg px-2 py-2.5 text-xs w-[9.5rem] shrink-0"
              />
              <button
                type="submit" disabled={addingTask}
                className="bg-teal text-white text-sm rounded-lg px-3.5 py-2.5 shrink-0 disabled:opacity-50"
              >Add</button>
            </form>
            <div className="space-y-2">
              {tasks.map((t) => (
                <div key={t.id} className="bg-white border border-muted/20 rounded-xl px-4 py-3 flex items-start gap-3">
                  <input
                    type="checkbox" checked={!!t.completed_at}
                    onChange={() => toggleTask(t)}
                    className="w-5 h-5 accent-teal shrink-0 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${t.completed_at ? 'line-through text-muted' : 'text-ink'}`}>{t.title}</div>
                    {t.due_at && <div className="text-xs text-muted font-mono mt-0.5">{new Date(t.due_at).toLocaleString()}</div>}
                  </div>
                </div>
              ))}
              {tasks.length === 0 && <p className="text-sm text-muted text-center py-6">No tasks for this prospect yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
