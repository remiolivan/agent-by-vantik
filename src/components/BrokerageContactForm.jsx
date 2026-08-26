import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function BrokerageContactForm({ onClose }) {
  const [form, setForm] = useState({ contactName: '', companyName: '', email: '', phone: '', agentCount: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const { data, error: fnError } = await supabase.functions.invoke('submit-brokerage-lead', {
      body: form,
      headers: { Authorization: `Bearer ${token}` },
    })
    setSubmitting(false)
    if (fnError || data?.error) return setError(data?.error || fnError.message)
    setSent(true)
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-navy/50" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 sm:inset-0 sm:m-auto sm:max-w-md sm:h-fit bg-white rounded-t-2xl sm:rounded-md shadow-sheet max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-navy px-5 py-4 flex items-center justify-between">
          <span className="font-display text-lg font-semibold text-white">Talk to us about Brokerage</span>
          <button onClick={onClose} className="text-navLight hover:text-white p-1" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {sent ? (
          <div className="p-6 flex flex-col items-center text-center gap-2">
            <div className="font-display text-lg font-semibold text-navy">Thanks — request sent.</div>
            <p className="text-sm text-muted">We'll get back to you shortly to set up your Brokerage plan.</p>
            <button onClick={onClose} className="mt-4 bg-amber text-ink font-bold rounded-md px-5 py-2.5 text-sm">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
            <p className="text-sm text-muted">
              Brokerage is tailored per agency — portal integrations, API access, dedicated support. Tell us a bit about your team and we'll follow up with pricing.
            </p>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">Your name</span>
              <input
                required value={form.contactName} onChange={(e) => update('contactName', e.target.value)}
                className="w-full bg-white border border-inputBorder rounded-[5px] px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-mid focus:ring-1 focus:ring-mid"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">Company / brokerage name</span>
              <input
                required value={form.companyName} onChange={(e) => update('companyName', e.target.value)}
                className="w-full bg-white border border-inputBorder rounded-[5px] px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-mid focus:ring-1 focus:ring-mid"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">Email</span>
              <input
                type="email" required value={form.email} onChange={(e) => update('email', e.target.value)}
                className="w-full bg-white border border-inputBorder rounded-[5px] px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-mid focus:ring-1 focus:ring-mid"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">Phone (optional)</span>
              <input
                value={form.phone} onChange={(e) => update('phone', e.target.value)}
                className="w-full bg-white border border-inputBorder rounded-[5px] px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-mid focus:ring-1 focus:ring-mid"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">Number of agents</span>
              <input
                value={form.agentCount} onChange={(e) => update('agentCount', e.target.value)}
                placeholder="e.g. 12"
                className="w-full bg-white border border-inputBorder rounded-[5px] px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-mid focus:ring-1 focus:ring-mid"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">Anything else? (optional)</span>
              <textarea
                rows={3} value={form.message} onChange={(e) => update('message', e.target.value)}
                className="w-full bg-white border border-inputBorder rounded-[5px] px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-mid focus:ring-1 focus:ring-mid resize-none"
              />
            </label>

            {error && <p className="text-sm text-warn">{error}</p>}

            <button
              type="submit" disabled={submitting}
              className="bg-amber text-ink font-bold rounded-md px-4 py-3 text-sm disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Send request'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
