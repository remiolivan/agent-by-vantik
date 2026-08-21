import { useState } from 'react'
import { X, Sparkles } from 'lucide-react'
import { supabase, invokeWithRetry } from '../lib/supabase'

// Drafts a follow-up message from recent activity + property + pipeline
// context, but never sends anything itself — the agent reviews, edits, and
// picks WhatsApp or email themselves. AI writes the first draft, the agent
// keeps the final call.
export default function FollowUpDraft({ contactId, propertyId, contactPhone, contactEmail, onClose }) {
  const [channel, setChannel] = useState('whatsapp')
  const [instructions, setInstructions] = useState('')
  const [showInstructions, setShowInstructions] = useState(false)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [resolvedPhone, setResolvedPhone] = useState(contactPhone || null)
  const [resolvedEmail, setResolvedEmail] = useState(contactEmail || null)
  const [resolvedContactId, setResolvedContactId] = useState(contactId || null)
  const [marking, setMarking] = useState(false)
  const [marked, setMarked] = useState(false)

  async function generate(nextChannel) {
    setChannel(nextChannel)
    setLoading(true)
    setError(null)
    setMarked(false)
    const { data, error: fnError } = await invokeWithRetry('draft-followup', {
      body: { contactId, propertyId, channel: nextChannel, instructions: instructions.trim() || undefined },
    })
    setLoading(false)
    if (fnError || data?.error) {
      setError(data?.error || fnError.message)
      return
    }
    setDraft(data.draft || '')
    // From a property page there's no contact on hand yet — the function
    // resolves the linked prospect server-side and hands back their contact
    // details so the send buttons below still work.
    if (!contactPhone && data.contactPhone) setResolvedPhone(data.contactPhone)
    if (!contactEmail && data.contactEmail) setResolvedEmail(data.contactEmail)
    if (!contactId && data.resolvedContactId) setResolvedContactId(data.resolvedContactId)
    setHasGenerated(true)
  }

  // Logs the sent (or not-sent) message to Activity so it shows up in the
  // same feed as calls, notes, and meetings — the point of asking is that a
  // "sent" follow-up should count as logged activity without the agent
  // having to type it out again by hand.
  async function markSent(wasSent) {
    setMarking(true)
    const { data: membership } = await supabase.from('memberships').select('org_id').single()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('activities').insert({
      org_id: membership.org_id,
      contact_id: resolvedContactId || null,
      property_id: propertyId || null,
      type: channel === 'email' ? 'email' : 'whatsapp',
      content: wasSent ? draft : `(Drafted but not sent) ${draft}`,
      created_by: user?.id || null,
    })
    setMarking(false)
    setMarked(true)
  }

  const whatsappUrl = resolvedPhone
    ? `https://wa.me/${resolvedPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(draft)}`
    : null
  const emailUrl = resolvedEmail
    ? `mailto:${resolvedEmail}?body=${encodeURIComponent(draft)}`
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-navyDeep/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl max-w-lg w-full p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted" aria-label="Close">
          <X size={20} />
        </button>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-teal" />
          <h2 className="font-display text-lg font-medium text-navyDeep">Draft follow-up</h2>
        </div>
        <p className="text-sm text-muted mb-4">Written from recent activity — review and edit before sending.</p>

        <div className="flex gap-2 mb-3">
          <button
            onClick={() => generate('whatsapp')} disabled={loading}
            className={`text-xs rounded-full px-3 py-1.5 border ${channel === 'whatsapp' && hasGenerated ? 'bg-navyDeep text-white border-navyDeep' : 'border-muted/30 text-muted'}`}
          >WhatsApp</button>
          <button
            onClick={() => generate('email')} disabled={loading}
            className={`text-xs rounded-full px-3 py-1.5 border ${channel === 'email' && hasGenerated ? 'bg-navyDeep text-white border-navyDeep' : 'border-muted/30 text-muted'}`}
          >Email</button>
        </div>

        <button
          type="button" onClick={() => setShowInstructions((s) => !s)}
          className="text-xs text-navyDeep underline mb-3"
        >
          {showInstructions ? 'Hide instructions' : '+ Add instructions (optional)'}
        </button>
        {showInstructions && (
          <textarea
            value={instructions} onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. mention the price just dropped, keep it very short, suggest a viewing this weekend…"
            rows={2}
            className="w-full border border-muted/30 rounded-lg px-3 py-2 text-sm resize-none mb-3"
          />
        )}

        {loading && <p className="text-sm text-muted py-6 text-center">Writing a draft…</p>}
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        {!loading && hasGenerated && (
          <>
            <textarea
              value={draft} onChange={(e) => setDraft(e.target.value)}
              rows={6}
              className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm resize-none mb-4"
            />
            <div className="flex gap-3 flex-wrap">
              {channel === 'whatsapp' && whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-sm bg-[#25D366] text-white rounded-lg px-4 py-2.5">
                  Send via WhatsApp
                </a>
              )}
              {channel === 'whatsapp' && !whatsappUrl && (
                <p className="text-xs text-muted">No phone number on file for this prospect.</p>
              )}
              {channel === 'email' && emailUrl && (
                <a href={emailUrl} className="text-sm text-navyDeep border border-navyDeep/30 rounded-lg px-4 py-2.5">
                  Send via email
                </a>
              )}
              {channel === 'email' && !emailUrl && (
                <p className="text-xs text-muted">No email on file for this prospect.</p>
              )}
              <button onClick={() => generate(channel)} disabled={loading} className="text-xs text-muted underline">
                Regenerate
              </button>
            </div>

            {/* Confirmation, so a sent follow-up lands in Activity without
                retyping it — shown once a draft exists, regardless of
                whether the agent used the Send button here or copied the
                text elsewhere. */}
            {!marked ? (
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-muted/15">
                <span className="text-xs text-muted">Did you send this?</span>
                <button
                  onClick={() => markSent(true)} disabled={marking}
                  className="text-xs bg-navyDeep text-white rounded-full px-3 py-1.5 disabled:opacity-50"
                >Yes, log it</button>
                <button
                  onClick={() => markSent(false)} disabled={marking}
                  className="text-xs text-muted underline disabled:opacity-50"
                >Not sent</button>
              </div>
            ) : (
              <p className="text-xs text-teal mt-4 pt-4 border-t border-muted/15">Logged to Activity.</p>
            )}
          </>
        )}

        {!loading && !hasGenerated && !error && (
          <button
            onClick={() => generate('whatsapp')}
            className="bg-navyDeep text-white text-sm rounded-lg px-4 py-2.5"
          >
            Generate draft
          </button>
        )}
      </div>
    </div>
  )
}
