import { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { nextQuarterHour } from '../lib/format'

export default function Tasks() {
  const [tasks, setTasks] = useState([])
  const [prospects, setProspects] = useState([])
  const [properties, setProperties] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [expandedDescription, setExpandedDescription] = useState(false)
  const [dueAt, setDueAt] = useState('')
  const [prospectId, setProspectId] = useState('')
  const [propertyId, setPropertyId] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', due_at: '', description: '', prospect_id: '', property_id: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    const [{ data: tasksData }, { data: prospectsData }, { data: propertiesData }] = await Promise.all([
      supabase.from('tasks')
        .select('*, contacts(name), properties(title)')
        .order('due_at', { ascending: true, nullsFirst: false }),
      supabase.from('contacts').select('id, name').order('name'),
      supabase.from('properties').select('id, title').order('title'),
    ])
    setTasks(tasksData ?? [])
    setProspects(prospectsData ?? [])
    setProperties(propertiesData ?? [])
  }

  useEffect(() => { load() }, [])

  async function createTask(e) {
    e.preventDefault()
    const { data: membership } = await supabase.from('memberships').select('org_id, id').single()
    await supabase.from('tasks').insert({
      title, description: description || null, org_id: membership.org_id,
      assignee_id: membership.id,
      due_at: dueAt || null,
      prospect_id: prospectId || null,
      property_id: propertyId || null,
    })
    setTitle(''); setDescription(''); setExpandedDescription(false); setDueAt(''); setProspectId(''); setPropertyId('')
    load()
  }

  async function toggleComplete(task) {
    await supabase.from('tasks').update({
      completed_at: task.completed_at ? null : new Date().toISOString(),
    }).eq('id', task.id)
    load()
  }

  function startEdit(task) {
    setEditingId(task.id)
    setEditForm({
      title: task.title || '',
      due_at: task.due_at ? task.due_at.slice(0, 16) : '',
      description: task.description || '',
      prospect_id: task.prospect_id || '',
      property_id: task.property_id || '',
    })
  }

  async function saveEdit(e) {
    e.preventDefault()
    if (!editForm.title.trim()) return
    setSaving(true)
    await supabase.from('tasks').update({
      title: editForm.title,
      due_at: editForm.due_at || null,
      description: editForm.description || null,
      prospect_id: editForm.prospect_id || null,
      property_id: editForm.property_id || null,
    }).eq('id', editingId)
    setSaving(false)
    setEditingId(null)
    load()
  }

  // Open tasks first (already sorted by due date from the query), completed ones pushed to the bottom.
  const sortedTasks = [...tasks].sort((a, b) => {
    if (!!a.completed_at !== !!b.completed_at) return a.completed_at ? 1 : -1
    return 0
  })

  return (
    <Layout title="Tasks">
      <div className="max-w-2xl">
        <form onSubmit={createTask} className="bg-white border border-muted/20 rounded-xl p-4 mb-8 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title" required
              className="flex-1 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
            />
            <input
              type="datetime-local" step="900" value={dueAt}
              onFocus={() => !dueAt && setDueAt(nextQuarterHour())}
              onChange={(e) => setDueAt(e.target.value)}
              className="border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={prospectId} onChange={(e) => setProspectId(e.target.value)}
              className="flex-1 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
            >
              <option value="">No linked prospect</option>
              {prospects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select
              value={propertyId} onChange={(e) => setPropertyId(e.target.value)}
              className="flex-1 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
            >
              <option value="">No linked property</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          {!expandedDescription ? (
            <button type="button" onClick={() => setExpandedDescription(true)} className="block text-xs text-navyDeep underline">+ Add description</button>
          ) : (
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Description" rows={2} className="w-full border border-muted/30 rounded-lg px-3 py-2 text-sm"
            />
          )}
          <button type="submit" className="bg-navyDeep text-white text-sm rounded-lg px-4 py-2.5">Add task</button>
        </form>

        <div className="space-y-2">
          {sortedTasks.map((t) => (
            editingId === t.id ? (
              <form key={t.id} onSubmit={saveEdit} className="bg-white border border-navyDeep/30 rounded-xl p-4 space-y-2">
                <input
                  value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="Task title" className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
                />
                <input
                  type="datetime-local" step="900" value={editForm.due_at}
                  onChange={(e) => setEditForm({ ...editForm, due_at: e.target.value })}
                  className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={editForm.prospect_id} onChange={(e) => setEditForm({ ...editForm, prospect_id: e.target.value })}
                    className="flex-1 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
                  >
                    <option value="">No linked prospect</option>
                    {prospects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select
                    value={editForm.property_id} onChange={(e) => setEditForm({ ...editForm, property_id: e.target.value })}
                    className="flex-1 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
                  >
                    <option value="">No linked property</option>
                    {properties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
                <textarea
                  value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Description" rows={2} className="w-full border border-muted/30 rounded-lg px-3 py-2 text-sm"
                />
                <div className="flex items-center gap-3">
                  <button type="submit" disabled={saving} className="bg-navyDeep text-white text-sm rounded-lg px-4 py-2 disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-sm text-muted px-2">Cancel</button>
                </div>
              </form>
            ) : (
              <div key={t.id} className="bg-white border border-muted/20 rounded-xl px-4 py-3 flex items-start gap-3">
                <input
                  type="checkbox" checked={!!t.completed_at}
                  onChange={() => toggleComplete(t)}
                  className="w-5 h-5 accent-teal shrink-0 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm ${t.completed_at ? 'line-through text-muted' : 'text-ink'}`}>{t.title}</div>
                  {t.description && <div className="text-xs text-muted mt-0.5">{t.description}</div>}
                  {t.due_at && (
                    <div className="text-xs text-muted font-mono mt-0.5">{new Date(t.due_at).toLocaleString()}</div>
                  )}
                  {(t.contacts?.name || t.properties?.title) && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {t.contacts?.name && (
                        <span className="text-xs text-navyDeep bg-tintBlue rounded px-2 py-0.5">{t.contacts.name}</span>
                      )}
                      {t.properties?.title && (
                        <span className="text-xs text-teal-700 bg-teal/10 rounded px-2 py-0.5">{t.properties.title}</span>
                      )}
                    </div>
                  )}
                </div>
                <button onClick={() => startEdit(t)} className="text-muted shrink-0 p-1" aria-label="Edit task">
                  <Pencil size={14} />
                </button>
              </div>
            )
          ))}
          {tasks.length === 0 && <p className="text-sm text-muted text-center py-8">No tasks yet.</p>}
        </div>
      </div>
    </Layout>
  )
}
