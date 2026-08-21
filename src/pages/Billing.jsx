import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import CancelSubscriptionFlow from '../components/CancelSubscriptionFlow'

const PLANS = [
  { key: 'solo', name: 'Solo', price: '$35/mo', desc: '1 agent' },
  { key: 'team', name: 'Team', price: '$129/mo', desc: 'Up to 5 agents' },
  { key: 'brokerage', name: 'Brokerage', price: '$299/mo', desc: 'Up to 20 agents' },
]

export default function Billing() {
  const [org, setOrg] = useState(null)
  const [orgId, setOrgId] = useState(null)
  const [loadingPlan, setLoadingPlan] = useState(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showCancelFlow, setShowCancelFlow] = useState(false)

  async function load() {
    const { data: membership } = await supabase.from('memberships').select('org_id').single()
    if (membership) {
      setOrgId(membership.org_id)
      const { data } = await supabase
        .from('organizations')
        .select('name, plan, trial_ends_at, stripe_customer_id, is_comped, cancel_requested_at')
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
    <Layout title="Billing">
      <div className="max-w-3xl">
        {org && (
          <div className="bg-white border border-muted/20 rounded-xl p-5 sm:p-6 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                className="text-sm text-navyDeep border border-navyDeep/30 rounded-lg px-4 py-2.5 disabled:opacity-50 whitespace-nowrap"
              >
                {portalLoading ? 'Loading…' : 'Manage billing'}
              </button>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600 mb-6">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PLANS.map((p) => (
            <div key={p.key} className="bg-white border border-muted/20 rounded-xl p-6 flex flex-col">
              <div className="font-display text-lg font-medium text-navyDeep mb-1">{p.name}</div>
              <div className="font-mono text-2xl text-navyDeep mb-1">{p.price}</div>
              <div className="text-sm text-muted mb-6">{p.desc}</div>
              <button
                onClick={() => subscribe(p.key)}
                disabled={loadingPlan === p.key || org?.plan === p.key}
                className="mt-auto bg-teal text-white text-sm font-medium rounded-lg px-4 py-2.5 disabled:opacity-50"
              >
                {org?.plan === p.key ? 'Current plan' : loadingPlan === p.key ? 'Loading…' : 'Subscribe'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {orgId && (
        <div className="mt-10 max-w-3xl">
          <p className="text-sm text-muted">
            Logo, invoice details, and reminder preferences moved to <Link to="/settings" className="text-navyDeep underline">Settings</Link>.
          </p>
        </div>
      )}

      {!org?.is_comped && (
        <div className="mt-10 max-w-3xl">
          {org?.cancel_requested_at ? (
            <p className="text-sm text-muted">
              Cancellation requested — your access continues until the end of the current billing period.
            </p>
          ) : (
            <button onClick={() => setShowCancelFlow(true)} className="text-sm text-muted underline">
              Cancel my subscription
            </button>
          )}
        </div>
      )}

      {showCancelFlow && (
        <CancelSubscriptionFlow
          onClose={() => setShowCancelFlow(false)}
          onCancelled={() => { setShowCancelFlow(false); load() }}
        />
      )}
    </Layout>
  )
}
