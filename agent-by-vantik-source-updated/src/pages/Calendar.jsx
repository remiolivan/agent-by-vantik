import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import {
  googleAuthorizeUrl, outlookAuthorizeUrl,
  isGoogleConfigured, isOutlookConfigured,
} from '../lib/calendarAuth'
import { Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react'

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7) // 7am–9pm
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function startOfWeek(date) {
  const d = new Date(date)
  const day = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

const DEFAULT_FORM = (start, end) => ({
  title: '', location: '', start: toLocalInputValue(start), end: toLocalInputValue(end),
  prospect_id: '', property_id: '', connectionIds: [],
})

export default function Calendar() {
  const [events, setEvents] = useState([])
  const [connections, setConnections] = useState([])
  const [prospects, setProspects] = useState([])
  const [properties, setProperties] = useState([])
  const [addingCalendar, setAddingCalendar] = useState(false)

  const [view, setView] = useState('week') // 'day' | 'week' | 'month'
  const [cursor, setCursor] = useState(new Date())

  const [editingEvent, setEditingEvent] = useState(null) // null = closed, {} = new, {...event} = editing
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(() => {
    const start = new Date(); start.setMinutes(start.getMinutes() + 60, 0, 0)
    return DEFAULT_FORM(start, new Date(start.getTime() + 30 * 60 * 1000))
  })

  async function load() {
    const from = new Date()
    from.setDate(from.getDate() - 45)
    const to = new Date()
    to.setDate(to.getDate() + 90)
    const [{ data: eventsData }, { data: connectionsData }, { data: prospectsData }, { data: propertiesData }] = await Promise.all([
      supabase.from('calendar_events')
        .select('*, contacts(name), properties(title), calendar_event_syncs(connection_id, sync_status, calendar_connections(provider))')
        .gte('start_at', from.toISOString())
        .lte('start_at', to.toISOString())
        .order('start_at', { ascending: true }),
      supabase.from('calendar_connections').select('*').order('created_at'),
      supabase.from('contacts').select('id, name').order('name'),
      supabase.from('properties').select('id, title').order('title'),
    ])
    setEvents(eventsData ?? [])
    setConnections(connectionsData ?? [])
    setProspects(prospectsData ?? [])
    setProperties(propertiesData ?? [])
  }

  useEffect(() => { load() }, [])

  const googleConn = connections.find((c) => c.provider === 'google')
  const outlookConn = connections.find((c) => c.provider === 'outlook')
  const connectedList = [googleConn, outlookConn].filter(Boolean)
  const unconnectedList = [
    !googleConn && { key: 'google', label: 'Google Calendar', configured: isGoogleConfigured(), url: googleAuthorizeUrl },
    !outlookConn && { key: 'outlook', label: 'Outlook Calendar', configured: isOutlookConfigured(), url: outlookAuthorizeUrl },
  ].filter(Boolean)

  function openNewEvent(prefillStart) {
    const start = prefillStart ? new Date(prefillStart) : (() => { const d = new Date(); d.setMinutes(d.getMinutes() + 60, 0, 0); return d })()
    const end = new Date(start.getTime() + 30 * 60 * 1000) // #9 default duration = 30 min
    setForm({
      ...DEFAULT_FORM(start, end),
      connectionIds: connectedList.map((c) => c.id), // #10 all connected calendars checked by default
    })
    setError(null)
    setEditingEvent({})
  }

  function openEditEvent(ev) {
    setForm({
      title: ev.title,
      location: ev.location || '',
      start: toLocalInputValue(new Date(ev.start_at)),
      end: toLocalInputValue(new Date(ev.end_at)),
      prospect_id: ev.prospect_id || '',
      property_id: ev.property_id || '',
      connectionIds: (ev.calendar_event_syncs || []).map((s) => s.connection_id),
    })
    setError(null)
    setEditingEvent(ev)
  }

  async function saveEvent(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const startIso = new Date(form.start).toISOString()
      const endIso = new Date(form.end).toISOString()
      if (new Date(endIso) <= new Date(startIso)) {
        setError('End time must be after start time.')
        setSaving(false)
        return
      }

      const isNew = !editingEvent?.id
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (isNew) {
        const { data: membership } = await supabase.from('memberships').select('org_id, id').single()
        const { data: inserted, error: insertErr } = await supabase.from('calendar_events').insert({
          org_id: membership.org_id,
          title: form.title,
          location: form.location || null,
          start_at: startIso,
          end_at: endIso,
          prospect_id: form.prospect_id || null,
          property_id: form.property_id || null,
          created_by: membership.id,
          source: 'manual',
        }).select().single()
        if (insertErr) throw insertErr

        if (form.connectionIds.length > 0) {
          await supabase.functions.invoke('sync-calendar-event', {
            body: { eventId: inserted.id, action: 'create', connectionIds: form.connectionIds },
            headers: { Authorization: `Bearer ${token}` },
          })
        }
      } else {
        const { error: updateErr } = await supabase.from('calendar_events').update({
          title: form.title,
          location: form.location || null,
          start_at: startIso,
          end_at: endIso,
          prospect_id: form.prospect_id || null,
          property_id: form.property_id || null,
        }).eq('id', editingEvent.id)
        if (updateErr) throw updateErr

        // Push the update to whichever connections it's already synced to
        // (sync-calendar-event falls back to existing syncs when no
        // connectionIds are passed on update).
        await supabase.functions.invoke('sync-calendar-event', {
          body: { eventId: editingEvent.id, action: 'update' },
          headers: { Authorization: `Bearer ${token}` },
        })
      }

      setEditingEvent(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteEvent(ev) {
    if (!confirm(`Delete "${ev.title}"?`)) return
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    await supabase.functions.invoke('sync-calendar-event', {
      body: { eventId: ev.id, action: 'delete' },
      headers: { Authorization: `Bearer ${token}` },
    })
    setEditingEvent(null)
    load()
  }

  function disconnect(connectionId) {
    if (!confirm('Disconnect this calendar? Events already synced will stay linked until you delete them.')) return
    supabase.from('calendar_connections').delete().eq('id', connectionId).then(() => load())
  }

  function eventsOn(date) {
    return events.filter((ev) => sameDay(new Date(ev.start_at), date))
  }

  const weekStart = useMemo(() => startOfWeek(cursor), [cursor])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const monthGrid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const gridStart = startOfWeek(first)
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  }, [cursor])

  function navigate(dir) {
    if (view === 'day') setCursor((c) => addDays(c, dir))
    else if (view === 'week') setCursor((c) => addDays(c, dir * 7))
    else setCursor((c) => new Date(c.getFullYear(), c.getMonth() + dir, 1))
  }

  const headerLabel = view === 'day'
    ? cursor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
    : view === 'week'
    ? `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${addDays(weekStart, 6).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    : cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <Layout
      title="Calendar"
      action={
        <button onClick={() => openNewEvent()} className="flex items-center gap-1.5 bg-teal text-white text-sm font-medium rounded-lg px-4 py-2.5 lg:py-2 whitespace-nowrap">
          <Plus size={15} /> New event
        </button>
      }
    >
      {/* Connections: connected calendars listed first, "add another" control kept at the bottom (#7) */}
      <div className="bg-white border border-muted/20 rounded-xl p-4 mb-6">
        <div className="font-mono text-xs uppercase tracking-wide text-muted mb-3">Connected calendars</div>
        {connectedList.length === 0 && <p className="text-sm text-muted mb-3">No calendar connected yet.</p>}
        <div className="space-y-2 mb-3">
          {connectedList.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 py-1">
              <div className="min-w-0">
                <div className="text-sm text-ink capitalize">{c.provider === 'google' ? 'Google Calendar' : 'Outlook Calendar'}</div>
                <div className="text-xs text-teal-700 truncate">Connected · {c.provider_account_email}</div>
              </div>
              <button onClick={() => disconnect(c.id)} className="text-xs text-coral border border-coral/30 rounded-lg px-3 py-1.5 whitespace-nowrap shrink-0">
                Disconnect
              </button>
            </div>
          ))}
        </div>

        {unconnectedList.length > 0 && (
          addingCalendar ? (
            <div className="pt-3 border-t border-muted/15 space-y-2">
              {unconnectedList.map((opt) => (
                <div key={opt.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-ink">{opt.label}</span>
                  {opt.configured ? (
                    <a href={opt.url()} className="text-xs bg-navyDeep text-white rounded-lg px-3 py-1.5 whitespace-nowrap">Connect</a>
                  ) : (
                    <span className="text-xs text-faint">Not set up yet</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <button onClick={() => setAddingCalendar(true)} className="text-sm text-navyDeep underline pt-2 border-t border-muted/15 w-full text-left">
              + Add another calendar
            </button>
          )
        )}
      </div>

      {/* View selector + navigation */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 text-muted hover:text-ink" aria-label="Previous"><ChevronLeft size={18} /></button>
          <div className="font-display text-base font-medium text-navyDeep min-w-[180px]">{headerLabel}</div>
          <button onClick={() => navigate(1)} className="p-1.5 text-muted hover:text-ink" aria-label="Next"><ChevronRight size={18} /></button>
          <button onClick={() => setCursor(new Date())} className="text-xs text-navyDeep border border-navyDeep/30 rounded-lg px-2.5 py-1 ml-1">Today</button>
        </div>
        <div className="flex bg-white border border-muted/20 rounded-lg p-0.5">
          {['day', 'week', 'month'].map((v) => (
            <button
              key={v} onClick={() => setView(v)}
              className={`text-xs px-3 py-1.5 rounded-md capitalize ${view === v ? 'bg-navyDeep text-white' : 'text-muted'}`}
            >{v}</button>
          ))}
        </div>
      </div>

      {view === 'day' && (
        <DayView date={cursor} events={eventsOn(cursor)} onEventClick={openEditEvent} onSlotClick={openNewEvent} />
      )}
      {view === 'week' && (
        <WeekView days={weekDays} eventsOn={eventsOn} onEventClick={openEditEvent} onSlotClick={openNewEvent} />
      )}
      {view === 'month' && (
        <MonthView month={cursor} grid={monthGrid} eventsOn={eventsOn} onDayClick={(d) => { setCursor(d); setView('day') }} />
      )}

      {editingEvent && (
        <EventForm
          isNew={!editingEvent.id}
          form={form} setForm={setForm}
          connectedList={connectedList}
          prospects={prospects} properties={properties}
          error={error} saving={saving}
          onSubmit={saveEvent}
          onCancel={() => setEditingEvent(null)}
          onDelete={editingEvent.id ? () => deleteEvent(editingEvent) : null}
        />
      )}
    </Layout>
  )
}

function EventPill({ ev, onClick, compact }) {
  const syncedProviders = (ev.calendar_event_syncs || []).filter((s) => s.sync_status === 'synced').map((s) => s.calendar_connections?.provider)
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(ev) }}
      className={`w-full text-left bg-tintBlue hover:bg-tintBlue/70 border border-border-blue rounded px-2 py-1 ${compact ? 'text-[11px]' : 'text-xs'} truncate`}
      title={ev.title}
    >
      <span className="font-medium text-navyDeep">{new Date(ev.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      {' '}{ev.title}
      {syncedProviders.length > 0 && <span className="text-teal-700"> ·synced</span>}
    </button>
  )
}

function DayView({ date, events, onEventClick, onSlotClick }) {
  return (
    <div className="bg-white border border-muted/20 rounded-xl overflow-hidden">
      {HOURS.map((h) => {
        const slotEvents = events.filter((ev) => new Date(ev.start_at).getHours() === h)
        const slotDate = new Date(date); slotDate.setHours(h, 0, 0, 0)
        return (
          <div key={h} className="flex border-b border-muted/10 last:border-0 min-h-[52px]">
            <div className="w-14 shrink-0 py-2 px-2 text-[11px] font-mono text-muted text-right">{h}:00</div>
            <div
              onClick={() => onSlotClick(slotDate)}
              className="flex-1 py-1.5 px-2 space-y-1 cursor-pointer hover:bg-tintBlue/20"
            >
              {slotEvents.map((ev) => <EventPill key={ev.id} ev={ev} onClick={onEventClick} />)}
            </div>
          </div>
        )
      })}
      {events.length === 0 && <p className="text-sm text-muted text-center py-6">No events this day.</p>}
    </div>
  )
}

function WeekView({ days, eventsOn, onEventClick, onSlotClick }) {
  const today = new Date()
  return (
    <div className="bg-white border border-muted/20 rounded-xl overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="flex border-b border-muted/15">
          <div className="w-14 shrink-0" />
          {days.map((d, i) => (
            <div key={i} className={`flex-1 text-center py-2 border-l border-muted/10 ${sameDay(d, today) ? 'bg-tintBlue/40' : ''}`}>
              <div className="text-[10px] font-mono text-muted uppercase">{WEEKDAY_LABELS[i]}</div>
              <div className={`text-sm ${sameDay(d, today) ? 'text-navyDeep font-medium' : 'text-ink'}`}>{d.getDate()}</div>
            </div>
          ))}
        </div>
        {HOURS.map((h) => (
          <div key={h} className="flex border-b border-muted/10 last:border-0 min-h-[48px]">
            <div className="w-14 shrink-0 py-1.5 px-2 text-[11px] font-mono text-muted text-right">{h}:00</div>
            {days.map((d, i) => {
              const slotDate = new Date(d); slotDate.setHours(h, 0, 0, 0)
              const slotEvents = eventsOn(d).filter((ev) => new Date(ev.start_at).getHours() === h)
              return (
                <div
                  key={i} onClick={() => onSlotClick(slotDate)}
                  className="flex-1 border-l border-muted/10 py-1 px-1 space-y-1 cursor-pointer hover:bg-tintBlue/20"
                >
                  {slotEvents.map((ev) => <EventPill key={ev.id} ev={ev} onClick={onEventClick} compact />)}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function MonthView({ month, grid, eventsOn, onDayClick }) {
  const today = new Date()
  return (
    <div className="bg-white border border-muted/20 rounded-xl overflow-hidden">
      <div className="grid grid-cols-7 border-b border-muted/15">
        {WEEKDAY_LABELS.map((l) => (
          <div key={l} className="text-center py-2 text-[10px] font-mono text-muted uppercase">{l}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((d, i) => {
          const inMonth = d.getMonth() === month.getMonth()
          const dayEvents = eventsOn(d)
          return (
            <button
              key={i} onClick={() => onDayClick(d)}
              className={`text-left border-b border-r border-muted/10 min-h-[80px] p-1.5 ${inMonth ? '' : 'bg-paper/60'} ${sameDay(d, today) ? 'bg-tintBlue/30' : ''}`}
            >
              <div className={`text-xs mb-1 ${inMonth ? 'text-ink' : 'text-faint'} ${sameDay(d, today) ? 'font-medium text-navyDeep' : ''}`}>{d.getDate()}</div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 2).map((ev) => (
                  <div key={ev.id} className="text-[10px] truncate bg-tintBlue text-navyDeep rounded px-1 py-0.5">{ev.title}</div>
                ))}
                {dayEvents.length > 2 && <div className="text-[10px] text-muted">+{dayEvents.length - 2} more</div>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function EventForm({ isNew, form, setForm, connectedList, prospects, properties, error, saving, onSubmit, onCancel, onDelete }) {
  function toggleConnection(id) {
    setForm((f) => ({
      ...f,
      connectionIds: f.connectionIds.includes(id) ? f.connectionIds.filter((c) => c !== id) : [...f.connectionIds, id],
    }))
  }

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-navyDeep/40" onClick={onCancel} />
      <div className="absolute inset-x-0 bottom-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-none max-h-[90vh] sm:max-h-none overflow-y-auto">
        <div className="px-5 py-4 border-b border-muted/15 flex items-center justify-between">
          <span className="font-display text-lg font-medium text-navyDeep">{isNew ? 'New event' : 'Edit event'}</span>
          {onDelete && (
            <button onClick={onDelete} className="text-faint hover:text-coral p-1" aria-label="Delete event"><Trash2 size={17} /></button>
          )}
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-3">
          <input
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Event title (e.g. Viewing – 2BR Marina Tower)" required
            className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
          />
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted block mb-1">Start</label>
              <input
                type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} required
                className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted block mb-1">End</label>
              <input
                type="datetime-local" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} required
                className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
          </div>
          <input
            value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="Location / address" className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
          />
          <select value={form.prospect_id} onChange={(e) => setForm({ ...form, prospect_id: e.target.value })} className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm">
            <option value="">No linked prospect</option>
            {prospects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm">
            <option value="">No linked property</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>

          {isNew && connectedList.length > 0 && (
            <div className="border border-muted/20 rounded-lg p-3 space-y-2">
              <div className="text-xs text-muted mb-1">Sync to calendar</div>
              {connectedList.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={form.connectionIds.includes(c.id)}
                    onChange={() => toggleConnection(c.id)}
                    className="w-4 h-4 accent-teal"
                  />
                  {c.provider === 'google' ? 'Google Calendar' : 'Outlook Calendar'} ({c.provider_account_email})
                </label>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="bg-navyDeep text-white text-sm rounded-lg px-4 py-2.5 disabled:opacity-50">
              {saving ? 'Saving…' : isNew ? 'Add event' : 'Save changes'}
            </button>
            <button type="button" onClick={onCancel} className="text-sm text-muted px-2">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
