import { useEffect, useState } from 'react'
import { Phone, Mail, MessageCircle, Users, StickyNote } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const TYPE_META = {
  note: { icon: StickyNote, label: 'Note' },
  call: { icon: Phone, label: 'Call' },
  email: { icon: Mail, label: 'Email' },
  whatsapp: { icon: MessageCircle, label: 'WhatsApp' },
  meeting: { icon: Users, label: 'Meeting' },
}

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

// RLS already scopes activities to the org, so any member can see the whole
// team's activity — this just surfaces that (org-wide, not filtered to one
// prospect/property) with who logged each entry and what it's about.
export default function TeamActivity() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('all')

  async function load() {
    setLoading(true)
    const [{ data: acts }, { data: members }, { data: contacts }, { data: properties }] = await Promise.all([
      supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('memberships').select('id, user_id, invited_email'),
      supabase.from('contacts').select('id, name'),
      supabase.from('properties').select('id, title'),
    ])
    const memberByUserId = new Map((members ?? []).map((m) => [m.user_id, m]))
    const contactById = new Map((contacts ?? []).map((c) => [c.id, c]))
    const propertyById = new Map((properties ?? []).map((p) => [p.id, p]))
    const enriched = (acts ?? []).map((a) => ({
      ...a,
      memberEmail: memberByUserId.get(a.created_by)?.invited_email || null,
      contactName: a.contact_id ? contactById.get(a.contact_id)?.name : null,
      propertyTitle: a.property_id ? propertyById.get(a.property_id)?.title : null,
    }))
    setActivities(enriched)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = filterType === 'all' ? activities : activities.filter((a) => a.type === filterType)

  return (
    <Layout title="Team activity">
      <div className="max-w-3xl">
        <div className="flex gap-2 flex-wrap mb-6">
          <button
            onClick={() => setFilterType('all')}
            className={`text-xs rounded-full px-3 py-1.5 border ${filterType === 'all' ? 'bg-navyDeep text-white border-navyDeep' : 'border-muted/30 text-muted'}`}
          >All</button>
          {Object.entries(TYPE_META).map(([key, meta]) => (
            <button
              key={key} onClick={() => setFilterType(key)}
              className={`flex items-center gap-1 text-xs rounded-full px-3 py-1.5 border ${filterType === key ? 'bg-navyDeep text-white border-navyDeep' : 'border-muted/30 text-muted'}`}
            >
              <meta.icon size={12} />{meta.label}
            </button>
          ))}
        </div>

        {loading && <p className="text-sm text-muted">Loading…</p>}
        {!loading && filtered.length === 0 && <p className="text-sm text-muted">No activity logged yet.</p>}

        <div className="space-y-4">
          {filtered.map((a) => {
            const meta = TYPE_META[a.type] || TYPE_META.note
            return (
              <div key={a.id} className="bg-white border border-muted/20 rounded-xl p-4 flex gap-3">
                <div className="w-8 h-8 rounded-full bg-tintBlue flex items-center justify-center shrink-0">
                  <meta.icon size={14} className="text-navyDeep" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-xs text-muted mb-1">
                    <span className="font-medium text-navyDeep">{a.memberEmail || 'Team member'}</span>
                    {a.contactName && <span>· {a.contactName}</span>}
                    {a.propertyTitle && <span>· {a.propertyTitle}</span>}
                    <span>· {relativeTime(a.created_at)}</span>
                  </div>
                  <p className="text-sm text-ink whitespace-pre-wrap break-words">{a.content}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Layout>
  )
}
