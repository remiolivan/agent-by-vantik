import { useEffect, useState } from 'react'
import { Phone, Mail, MessageCircle, Users, StickyNote } from 'lucide-react'
import { supabase } from '../lib/supabase'

const TYPES = [
  { value: 'note', label: 'Note', icon: StickyNote },
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'meeting', label: 'Meeting', icon: Users },
]

function relativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

// contactId and/or propertyId scope the feed — pass both when logging
// something about a specific property discussed with a specific prospect.
export default function ActivityLog({ contactId, propertyId }) {
  const [activities, setActivities] = useState([])
  const [type, setType] = useState('note')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    let query = supabase.from('activities').select('*').order('created_at', { ascending: false })
    if (contactId) query = query.eq('contact_id', contactId)
    if (propertyId) query = query.eq('property_id', propertyId)
    const { data } = await query
    setActivities(data ?? [])
  }

  useEffect(() => { load() }, [contactId, propertyId])

  async function logActivity(e) {
    e.preventDefault()
    if (!content.trim()) return
    setSaving(true)
    const { data: membership } = await supabase.from('memberships').select('org_id').single()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('activities').insert({
      org_id: membership.org_id,
      contact_id: contactId || null,
      property_id: propertyId || null,
      type,
      content: content.trim(),
      created_by: user?.id || null,
    })
    setContent('')
    setSaving(false)
    load()
  }

  return (
    <div>
      <div className="font-mono text-xs uppercase tracking-wide text-muted mb-3">Activity</div>

      <form onSubmit={logActivity} className="space-y-2 mb-4">
        <div className="flex gap-1.5 flex-wrap">
          {TYPES.map((t) => (
            <button
              key={t.value} type="button" onClick={() => setType(t.value)}
              className={`flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border ${
                type === t.value ? 'bg-navyDeep text-white border-navyDeep' : 'border-muted/30 text-muted'
              }`}
            >
              <t.icon size={12} />{t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <textarea
            value={content} onChange={(e) => setContent(e.target.value)}
            placeholder="What was said or done…" rows={2}
            className="flex-1 border border-muted/30 rounded-lg px-3 py-2 text-sm resize-none"
          />
          <button
            type="submit" disabled={saving || !content.trim()}
            className="bg-navyDeep text-white text-sm rounded-lg px-3.5 self-end py-2 disabled:opacity-50 whitespace-nowrap"
          >
            Log
          </button>
        </div>
      </form>

      {activities.length === 0 ? (
        <p className="text-sm text-muted">No activity logged yet.</p>
      ) : (
        <div className="space-y-3">
          {activities.map((a) => {
            const meta = TYPES.find((t) => t.value === a.type) || TYPES[0]
            return (
              <div key={a.id} className="flex gap-2.5">
                <div className="w-6 h-6 rounded-full bg-tintBlue flex items-center justify-center shrink-0 mt-0.5">
                  <meta.icon size={12} className="text-navyDeep" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink whitespace-pre-wrap break-words">{a.content}</p>
                  <p className="text-[11px] text-muted font-mono mt-0.5">{relativeTime(a.created_at)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
