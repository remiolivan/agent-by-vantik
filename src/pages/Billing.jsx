import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const PLANS = [
  { key: 'solo', name: 'Solo', price: '$35/mo', desc: '1 agent' },
  { key: 'team', name: 'Team', price: '$129/mo', desc: 'Up to 5 agents' },
  { key: 'brokerage', name: 'Brokerage', price: '$299/mo', desc: 'Up to 20 agents' },
]

export default function Billing() {
  const [org, setOrg] = useState(null)
  const [loadingPlan, setLoadingPlan] = useState(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState(null)

  async function load() {
    const { data: membership } = await supabase.from('memberships').select('org_id').single()
    if (membership) {
      const { data } = await supabase
        .from('organizations')
        .select('name, plan, trial_ends_at, stripe_customer_id')
        .eq('id', membership.org_id)
        .single()
      setOrg(data)
    }
  }

  useEffect(() => { load() }, [])

  async function subscribe(plan) {
    setError(null)
    setLoadingPlan(plan)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: { plan },
      headers: { Authorization: `Bearer ${token}` },
    })
    setLoadingPlan(null)
    if (error || data?.error) return setError(data?.error || error.message)
    window.location.href = data.url
  }

  async function manageBilling() {
    setError(null)
    setPortalLoading(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const { data, error } = await supabase.functions.invoke('create-portal-session', {
      headers: { Authorization: `Bearer ${token}` },
    })
    setPortalLoading(false)
    if (error || data?.error) return setError(data?.error || error.message)
    window.location.href = data.url
  }

  const daysLeft = org?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(org.trial_ends_at) - new Date()) / 86400000))
    : null

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-muted/20 px-8 py-5">
        <div className="font-display text-lg font-medium text-navyDeep">Billing</div>
      </header>

      <main className="max-w-3xl mx-auto px-8 py-8">
        {org && (
          <div className="bg-white border border-muted/20 rounded p-6 mb-8 flex items-center justify-between">
            <div>
              <div className="font-mono text-xs uppercase tracking-wide text-muted mb-1">Current plan</div>
              <div className="font-display text-xl font-medium text-navyDeep capitalize">{org.plan}</div>
              {org.plan === 'trial' && daysLeft !== null && (
                <div className="text-sm text-muted mt-1">{daysLeft} day{daysLeft === 1 ? '' : 's'} left in trial</div>
              )}
            </div>
            {org.stripe_customer_id && (
              <button
                onClick={manageBilling} disabled={portalLoading}
                className="text-sm text-navyDeep border border-navyDeep/30 rounded px-4 py-2 disabled:opacity-50"
              >
                {portalLoading ? 'Loading…' : 'Manage billing'}
              </button>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600 mb-6">{error}</p>}

        <div className="grid grid-cols-3 gap-4">
          {PLANS.map((p) => (
            <div key={p.key} className="bg-white border border-muted/20 rounded p-6 flex flex-col">
              <div className="font-display text-lg font-medium text-navyDeep mb-1">{p.name}</div>
              <div className="font-mono text-2xl text-navyDeep mb-1">{p.price}</div>
              <div className="text-sm text-muted mb-6">{p.desc}</div>
              <button
                onClick={() => subscribe(p.key)}
                disabled={loadingPlan === p.key || org?.plan === p.key}
                className="mt-auto bg-teal text-white text-sm font-medium rounded px-4 py-2 disabled:opacity-50"
              >
                {org?.plan === p.key ? 'Current plan' : loadingPlan === p.key ? 'Loading…' : 'Subscribe'}
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
