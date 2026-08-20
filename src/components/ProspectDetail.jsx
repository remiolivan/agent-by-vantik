import { useEffect, useState } from 'react'
import { X, Pencil, Share2, Receipt, Sparkles } from 'lucide-react'
import { supabase, invokeWithRetry } from '../lib/supabase'
import { formatNumber, formatMoney, nextQuarterHour } from '../lib/format'
import { BEDROOM_OPTIONS } from '../lib/constants'
import NumberInput from './NumberInput'
import ActivityLog from './ActivityLog'
import FollowUpDraft from './FollowUpDraft'

function fieldsFrom(prospect) {
  return {
    name: prospect.name || '',
    email: prospect.email || '',
    phone: prospect.phone || '',
    intent: prospect.intent || '',
    budget_min: prospect.budget_min ?? '',
    budget_max: prospect.budget_max ?? '',
    bedrooms_wanted_list: prospect.bedrooms_wanted_list || [],
    locations_wanted: prospect.locations_wanted || '',
  }
}

export default function ProspectDetail({ prospect, onClose, onUpdated }) {
  const [editing, setEditing] = useState(false)
  const [current, setCurrent] = useState(prospect)
  const [form, setForm] = useState(() => fieldsFrom(prospect))
  const [saving, setSaving] = useState(false)

  const [stages, setStages] = useState([])
  const [stageId, setStageId] = useState(prospect.stage_id || '')
  const [savingStage, setSavingStage] = useState(false)

  const [tasks, setTasks] = useState([])
  const [newTask, setNewTask] = useState({ title: '', due: '', description: '' })
  const [addingTask, setAddingTask] = useState(false)
  const [expandedNewTask, setExpandedNewTask] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editTaskForm, setEditTaskForm] = useState({ title: '', due: '', description: '' })
  const [savingTask, setSavingTask] = useState(false)

  const [sharing, setSharing] = useState(false)
  const [showFollowUp, setShowFollowUp] = useState(false)
  const [shareUrl, setShareUrl] = useState(null)
  const [shareError, setShareError] = useState(null)
  const [invoices, setInvoices] = useState([])

  async function loadStages() {
    const { data } = await supabase.from('pipeline_stages').select('*').eq('pipeline_type', 'prospect').order('position')
    setStages(data ?? [])
  }

  async function loadTasks() {
    const { data } = await supabase.from('tasks').select('*').eq('prospect_id', prospect.id).order('due_at', { ascending: true, nullsFirst: false })
    setTasks(data ?? [])
  }

  async function loadInvoices() {
    const { data } = await supabase.from('documents').select('*').eq('contact_id', prospect.id).order('created_at', { ascending: false })
    setInvoices(data ?? [])
  }

  async function downloadInvoice(doc) {
    if (doc.file_url?.startsWith('data:')) { window.open(doc.file_url, '_blank'); return }
    const { data } = await supabase.storage.from('property-documents').createSignedUrl(doc.file_url, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  useEffect(() => { loadStages(); loadTasks(); loadInvoices() }, [prospect.id])

  // Only show stages that fit this prospect's intent: buyer-only stages
  // (F-form, Sold) hidden for renters, tenant-only (Rented) hidden for buyers.
  const visibleStages = stages.filter((s) => {
    if (s.buyer_only && current.intent !== 'buy') return false
    if (s.tenant_only && current.intent !== 'rent') return false
    return true
  })

  async function saveEdits(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      intent: form.intent || null,
      budget_min: form.budget_min === '' ? null : Number(form.budget_min),
      budget_max: form.budget_max === '' ? null : Number(form.budget_max),
      bedrooms_wanted_list: form.bedrooms_wanted_list.length > 0 ? form.bedrooms_wanted_list : null,
      locations_wanted: form.locations_wanted || null,
    }
    await supabase.from('contacts').update(payload).eq('id', prospect.id)
    setSaving(false)
    setCurrent({ ...current, ...payload })
    setEditing(false)
    onUpdated?.()
  }

  function cancelEdit() {
    setForm(fieldsFrom(current))
    setEditing(false)
  }

  function toggleBedroom(opt) {
    setForm((f) => ({
      ...f,
      bedrooms_wanted_list: f.bedrooms_wanted_list.includes(opt)
        ? f.bedrooms_wanted_list.filter((b) => b !== opt)
        : [...f.bedrooms_wanted_list, opt],
    }))
  }

  async function changeStage(newStageId) {
    setSavingStage(true)
    await supabase.from('contacts').update({ stage_id: newStageId }).eq('id', prospect.id)
    setStageId(newStageId)
    setSavingStage(false)
    onUpdated?.()
  }

  async function addTask(e) {
    e.preventDefault()
    if (!newTask.title.trim()) return
    setAddingTask(true)
    const { data: membership } = await supabase.from('memberships').select('org_id, id').single()
    await supabase.from('tasks').insert({
      title: newTask.title,
      description: newTask.description || null,
      org_id: membership.org_id,
      assignee_id: membership.id,
      prospect_id: prospect.id,
      due_at: newTask.due || null,
    })
    setNewTask({ title: '', due: '', description: '' })
    setExpandedNewTask(false)
    setAddingTask(false)
    loadTasks()
  }

  async function toggleTask(task) {
    await supabase.from('tasks').update({ completed_at: task.completed_at ? null : new Date().toISOString() }).eq('id', task.id)
    loadTasks()
  }

  function startEditTask(task) {
    setEditingTaskId(task.id)
    setEditTaskForm({
      title: task.title || '',
      due: task.due_at ? task.due_at.slice(0, 16) : '',
      description: task.description || '',
    })
  }

  async function saveTaskEdit(e) {
    e.preventDefault()
    if (!editTaskForm.title.trim()) return
    setSavingTask(true)
    await supabase.from('tasks').update({
      title: editTaskForm.title,
      due_at: editTaskForm.due || null,
      description: editTaskForm.description || null,
    }).eq('id', editingTaskId)
    setSavingTask(false)
    setEditingTaskId(null)
    loadTasks()
  }

  // Open tasks first (soonest due first), completed tasks pushed to the bottom.
  const sortedTasks = [...tasks].sort((a, b) => {
    if (!!a.completed_at !== !!b.completed_at) return a.completed_at ? 1 : -1
    return 0
  })

  async function generateShare() {
    setSharing(true)
    setShareError(null)
    setShareUrl(null)
    const { data, error } = await invokeWithRetry('generate-prospect-summary', { body: { prospectId: prospect.id } })
    setSharing(false)
    if (error || data?.error) {
      setShareError(data?.error || error.message)
      return
    }
    setShareUrl(data.url)
  }

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-navyDeep/40" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full sm:max-w-md bg-paper overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-muted/15 px-5 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between z-10">
          <div className="min-w-0">
            <div className="font-display text-lg font-medium text-navyDeep truncate">{current.name}</div>
            {current.email && <div className="text-xs text-muted truncate">{current.email}</div>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setShowFollowUp(true)} className="text-teal p-1.5" aria-label="Draft follow-up" title="Draft follow-up">
              <Sparkles size={17} />
            </button>
            {!editing && (
              <button onClick={() => setEditing(true)} className="text-navyDeep p-1.5" aria-label="Edit">
                <Pencil size={17} />
              </button>
            )}
            <button onClick={onClose} aria-label="Close" className="text-muted p-1.5">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="px-5 py-5 space-y-8">
          {/* Stage */}
          <div>
            <div className="font-mono text-xs uppercase tracking-wide text-muted mb-2">Stage</div>
            <select
              value={stageId} onChange={(e) => changeStage(e.target.value)} disabled={savingStage}
              className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm bg-white"
            >
              {visibleStages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* View / edit core info + search criteria */}
          {!editing ? (
            <div className="bg-white border border-muted/20 rounded-xl p-4 space-y-3">
              {current.phone && <div className="text-sm text-ink">{current.phone}</div>}
              <div className="flex flex-wrap gap-2 text-xs">
                {current.intent && <span className="rounded px-2 py-1 bg-tintBlue text-navyDeep capitalize">{current.intent === 'buy' ? 'Buying' : 'Renting'}</span>}
                {(current.budget_min || current.budget_max) && (
                  <span className="rounded px-2 py-1 bg-paper text-muted">
                    {formatNumber(current.budget_min, { fallback: '' })}{current.budget_min && current.budget_max ? '–' : ''}{formatNumber(current.budget_max, { fallback: '' })}
                  </span>
                )}
                {current.bedrooms_wanted_list?.length > 0 && (
                  <span className="rounded px-2 py-1 bg-paper text-muted">{current.bedrooms_wanted_list.join(', ')}</span>
                )}
              </div>
              {current.locations_wanted && <div className="text-sm text-ink">{current.locations_wanted}</div>}
              {!current.intent && !current.locations_wanted && !current.budget_min && !current.budget_max && (
                <p className="text-sm text-muted">No search criteria yet — tap Edit to fill them in.</p>
              )}
            </div>
          ) : (
            <form onSubmit={saveEdits} className="bg-white border border-muted/20 rounded-xl p-4 space-y-3">
              <input
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Name" required className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
              />
              <input
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Email" type="email" className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
              />
              <input
                value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Phone" className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
              />
              <div className="flex gap-2">
                {[{ value: 'buy', label: 'Buying' }, { value: 'rent', label: 'Renting' }].map((opt) => (
                  <button
                    key={opt.value} type="button"
                    onClick={() => setForm({ ...form, intent: form.intent === opt.value ? '' : opt.value })}
                    className={`flex-1 text-sm rounded-lg px-3 py-2.5 border ${
                      form.intent === opt.value ? 'bg-navyDeep text-white border-navyDeep' : 'border-muted/30 text-muted'
                    }`}
                  >{opt.label}</button>
                ))}
              </div>
              <div className="flex gap-3">
                <NumberInput
                  value={form.budget_min} onChange={(v) => setForm({ ...form, budget_min: v })}
                  placeholder="Budget min (AED)" className="flex-1 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
                />
                <NumberInput
                  value={form.budget_max} onChange={(v) => setForm({ ...form, budget_max: v })}
                  placeholder="Budget max (AED)" className="flex-1 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <div className="text-xs text-muted mb-1.5">Bedrooms wanted</div>
                <div className="flex flex-wrap gap-1.5">
                  {BEDROOM_OPTIONS.map((opt) => (
                    <button
                      key={opt} type="button" onClick={() => toggleBedroom(opt)}
                      className={`text-xs rounded-full px-3 py-1.5 border ${
                        form.bedrooms_wanted_list.includes(opt) ? 'bg-navyDeep text-white border-navyDeep' : 'border-muted/30 text-muted'
                      }`}
                    >{opt}</button>
                  ))}
                </div>
              </div>
              <input
                value={form.locations_wanted} onChange={(e) => setForm({ ...form, locations_wanted: e.target.value })}
                placeholder="Locations (e.g. Marina, JBR, Downtown)"
                className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
              />
              <div className="flex items-center gap-3 pt-1">
                <button type="submit" disabled={saving} className="bg-navyDeep text-white text-sm rounded-lg px-4 py-2.5 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={cancelEdit} className="text-sm text-muted px-2">Cancel</button>
              </div>
            </form>
          )}

          {/* Tasks */}
          <div>
            <div className="font-mono text-xs uppercase tracking-wide text-muted mb-3">Tasks</div>
            <form onSubmit={addTask} className="bg-white border border-muted/20 rounded-xl p-3 mb-3 space-y-3">
              <div className="flex gap-2">
                <input
                  value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="New task" className="flex-1 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
                />
                <input
                  type="datetime-local" step="900" value={newTask.due}
                  onFocus={() => !newTask.due && setNewTask((t) => ({ ...t, due: nextQuarterHour() }))}
                  onChange={(e) => setNewTask({ ...newTask, due: e.target.value })}
                  className="border border-muted/30 rounded-lg px-2 py-2.5 text-xs w-[9.5rem] shrink-0"
                />
              </div>
              {!expandedNewTask ? (
                <button type="button" onClick={() => setExpandedNewTask(true)} className="block text-xs text-navyDeep underline">+ Add description</button>
              ) : (
                <textarea
                  value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Description" rows={2} className="w-full border border-muted/30 rounded-lg px-3 py-2 text-sm"
                />
              )}
              <button type="submit" disabled={addingTask} className="bg-teal text-white text-sm rounded-lg px-4 py-2 disabled:opacity-50">
                {addingTask ? 'Adding…' : 'Add task'}
              </button>
            </form>
            <div className="space-y-2">
              {sortedTasks.map((t) => (
                editingTaskId === t.id ? (
                  <form key={t.id} onSubmit={saveTaskEdit} className="bg-white border border-navyDeep/30 rounded-xl p-3 space-y-2">
                    <input
                      value={editTaskForm.title} onChange={(e) => setEditTaskForm({ ...editTaskForm, title: e.target.value })}
                      placeholder="Task" className="w-full border border-muted/30 rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      type="datetime-local" step="900" value={editTaskForm.due}
                      onChange={(e) => setEditTaskForm({ ...editTaskForm, due: e.target.value })}
                      className="w-full border border-muted/30 rounded-lg px-3 py-2 text-xs"
                    />
                    <textarea
                      value={editTaskForm.description} onChange={(e) => setEditTaskForm({ ...editTaskForm, description: e.target.value })}
                      placeholder="Description" rows={2} className="w-full border border-muted/30 rounded-lg px-3 py-2 text-sm"
                    />
                    <div className="flex items-center gap-3">
                      <button type="submit" disabled={savingTask} className="bg-navyDeep text-white text-xs rounded-lg px-3 py-2 disabled:opacity-50">
                        {savingTask ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" onClick={() => setEditingTaskId(null)} className="text-xs text-muted px-1">Cancel</button>
                    </div>
                  </form>
                ) : (
                  <div key={t.id} className="bg-white border border-muted/20 rounded-xl px-4 py-3 flex items-start gap-3">
                    <input
                      type="checkbox" checked={!!t.completed_at} onChange={() => toggleTask(t)}
                      className="w-5 h-5 accent-teal shrink-0 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm ${t.completed_at ? 'line-through text-muted' : 'text-ink'}`}>{t.title}</div>
                      {t.description && <div className="text-xs text-muted mt-0.5">{t.description}</div>}
                      {t.due_at && <div className="text-xs text-muted font-mono mt-0.5">{new Date(t.due_at).toLocaleString()}</div>}
                    </div>
                    <button onClick={() => startEditTask(t)} className="text-muted shrink-0 p-1" aria-label="Edit task">
                      <Pencil size={14} />
                    </button>
                  </div>
                )
              ))}
              {tasks.length === 0 && <p className="text-sm text-muted text-center py-6">No tasks for this prospect yet.</p>}
            </div>
          </div>

          {/* Invoices linked to this prospect */}
          <div>
            <div className="font-mono text-xs uppercase tracking-wide text-muted mb-3">Invoices</div>
            <div className="space-y-2">
              {invoices.map((inv) => (
                <button key={inv.id} onClick={() => downloadInvoice(inv)} className="w-full text-left bg-white border border-muted/20 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm text-navyDeep"><Receipt size={14} className="text-muted" /> {inv.invoice_number || 'Invoice'}</span>
                  <span className="text-xs text-muted font-mono">{formatMoney(inv.total, inv.currency || 'AED')}</span>
                </button>
              ))}
              {invoices.length === 0 && <p className="text-xs text-muted">No invoices linked to this prospect yet.</p>}
            </div>
          </div>

          {/* Activity */}
          <div>
            <ActivityLog contactId={current.id} />
          </div>

          {/* Share */}
          <div>
            <div className="font-mono text-xs uppercase tracking-wide text-muted mb-3">Share prospect summary</div>
            <div className="bg-white border border-muted/20 rounded-xl p-4">
              {!shareUrl ? (
                <button
                  onClick={generateShare} disabled={sharing}
                  className="flex items-center gap-2 bg-teal text-white text-sm font-medium rounded-lg px-4 py-2.5 disabled:opacity-50"
                >
                  <Share2 size={15} />
                  {sharing ? 'Generating PDF…' : 'Generate summary to share'}
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted">Summary ready. Send it from WhatsApp or email:</p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`${current.name}\n${shareUrl}`)}`}
                      target="_blank" rel="noreferrer" className="text-sm bg-[#25D366] text-white rounded-lg px-4 py-2.5"
                    >Send via WhatsApp</a>
                    <a
                      href={`mailto:?subject=${encodeURIComponent(current.name)}&body=${encodeURIComponent(`Here's the summary: ${shareUrl}`)}`}
                      className="text-sm text-navyDeep border border-navyDeep/30 rounded-lg px-4 py-2.5"
                    >Send via email</a>
                  </div>
                  <button onClick={generateShare} disabled={sharing} className="text-xs text-muted underline">
                    {sharing ? 'Regenerating…' : 'Regenerate'}
                  </button>
                </div>
              )}
              {shareError && <p className="text-xs text-red-600 mt-2">{shareError}</p>}
            </div>
          </div>
        </div>
      </div>

      {showFollowUp && (
        <FollowUpDraft
          contactId={current.id}
          contactPhone={current.phone}
          contactEmail={current.email}
          onClose={() => setShowFollowUp(false)}
        />
      )}
    </div>
  )
}
