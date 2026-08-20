import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'

const REASONS = [
  'Too expensive',
  "Missing a feature I need",
  'Switching to another tool',
  'Not using it enough',
  'Other',
]

export default function CancelSubscriptionFlow({ onClose, onCancelled }) {
  const [step, setStep] = useState(0)
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function confirmCancel() {
    setError(null)
    setSaving(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const { data, error } = await supabase.functions.invoke('cancel-subscription', {
      body: { reason: reason || null },
      headers: { Authorization: `Bearer ${token}` },
    })
    setSaving(false)
    if (error || data?.error) return setError(data?.error || error.message)
    onCancelled()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-navyDeep/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl max-w-md w-full p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted" aria-label="Close">
          <X size={20} />
        </button>

        {step === 0 && (
          <div>
            <h2 className="font-display text-lg font-medium text-navyDeep mb-3">What you'll lose</h2>
            <ul className="text-sm text-ink space-y-2 mb-6 list-disc pl-5">
              <li>Access to your pipeline, contacts, and calendar sync at the end of the current billing period</li>
              <li>PDF generation for brochures, summaries, and invoices</li>
              <li>Team seats, if you have teammates invited</li>
            </ul>
            <p className="text-sm text-muted mb-6">Your data stays intact — you can resubscribe any time to pick up where you left off.</p>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="bg-navyDeep text-white text-sm rounded-lg px-4 py-2.5">Continue</button>
              <button onClick={onClose} className="text-sm text-muted px-2">Never mind, keep my plan</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="font-display text-lg font-medium text-navyDeep mb-1">Before you go</h2>
            <p className="text-sm text-muted mb-4">Optional — this helps us improve.</p>
            <div className="space-y-2 mb-6">
              {REASONS.map((r) => (
                <button
                  key={r} type="button" onClick={() => setReason(r)}
                  className={`w-full text-left text-sm rounded-lg px-3 py-2.5 border ${
                    reason === r ? 'bg-navyDeep text-white border-navyDeep' : 'border-muted/30 text-ink'
                  }`}
                >{r}</button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="bg-navyDeep text-white text-sm rounded-lg px-4 py-2.5">Continue</button>
              <button onClick={() => setStep(0)} className="text-sm text-muted px-2">Back</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-display text-lg font-medium text-navyDeep mb-3">Confirm cancellation</h2>
            <p className="text-sm text-ink mb-4">
              Your subscription will be cancelled at the end of the current billing period. You'll keep full access until then, and no refund is issued for the remaining time.
            </p>
            <label className="flex items-start gap-2 text-sm text-ink mb-6">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
              I understand my subscription will be cancelled at the end of the billing period.
            </label>
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={confirmCancel} disabled={!confirmed || saving}
                className="bg-red-600 text-white text-sm rounded-lg px-4 py-2.5 disabled:opacity-50"
              >
                {saving ? 'Cancelling…' : 'Cancel subscription'}
              </button>
              <button onClick={() => setStep(1)} className="text-sm text-muted px-2">Back</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
