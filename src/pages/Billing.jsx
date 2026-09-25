import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import CancelSubscriptionFlow from '../components/CancelSubscriptionFlow'
import BrokerageContactForm from '../components/BrokerageContactForm'
import LegalFooter from '../components/LegalFooter'
import { SELF_SERVE_PLANS, BROKERAGE_FROM, aed } from '../lib/pricing'
import { orgHasAccess, PAID_PLANS } from '../lib/access'
import { functionErrorMessage } from '../lib/functionError'


export default function Billing() {
  const [org, setOrg] = useState(null)
  const [orgId, setOrgId] = useState(null)
  const [interval, setInterval] = useState('monthly') // 'monthly' | 'annual'
  const [loadingPlan, setLoadingPlan] = useState(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showCancelFlow, setShowCancelFlow] = useState(false)
  const [showBrokerageForm, setShowBrokerageForm] = useState(false)
  const [searchParams] = useSearchParams()
  const justPaid = searchParams.get('success') === 'true'
  const checkoutCanceled = searchParams.get('canceled') === 'true'
  // After Stripe redirects back, the webhook may land a few seconds later.
  const [activation, setActivation] = useState(justPaid ? 'pending' : null) // 'pending' | 'done' | 'slow' | null

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
      return data
    }
    return null
  }

  useEffect(() => { load() }, [])

  // Poll until the webhook has switched the org to a paid plan.
  useEffect(() => {
    if (!justPaid) return
    let tries = 0
    let stopped = false
    async function poll() {
      if (stopped) return
      const data = await load()
      if (data && PAID_PLANS.includes(data.plan)) return setActivation('done')
      tries += 1
      if (tries >= 15) return setActivation('slow')
      setTimeout(poll, 2000)
    }
    poll()
    return () => { stopped = true }
  }, [justPaid])

  async function subscribe(plan) {
    setError(null)
    setLoadingPlan(plan)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: { plan, interval },
      headers: { Authorization: `Bearer ${token}` },
    })
    setLoadingPlan(null)
    if (error || data?.error) return setError(await functionErrorMessage(error, data))
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
    if (error || data?.error) return setError(await functionErrorMessage(error, data))
    window.location.href = data.url
  }

  const daysLeft = org?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(org.trial_ends_at) - new Date()) / 86400000))
    : null

  return (
    <Layout title="Billing">
      <div className="max-w-3xl">
        {activation === 'pending' && (
          <div className="bg-white border border-border rounded-md p-4 mb-6 text-sm text-ink">
            Payment received — activating your plan…
          </div>
        )}
        {activation === 'done' && (
          <div className="bg-white border border-border rounded-md p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-ink">You're all set — your plan is active. Thank you!</p>
            {/* Full reload so every page picks up the new plan */}
            <button onClick={() => { window.location.href = '/' }} className="bg-amber text-ink font-bold rounded-md px-4 py-2 text-sm whitespace-nowrap">
              Go to dashboard
            </button>
          </div>
        )}
        {activation === 'slow' && (
          <div className="bg-white border border-border rounded-md p-4 mb-6 text-sm text-ink">
            Your payment went through, but activation is taking longer than usual. Refresh this page in a minute — if your plan
            still isn't active, email <a href="mailto:remi.olivan@getvantik.com" className="text-navyDeep underline">remi.olivan@getvantik.com</a>.
          </div>
        )}
        {checkoutCanceled && !activation && (
          <p className="text-sm text-muted mb-6">Checkout canceled — you haven't been charged.</p>
        )}
        {org && !activation && !orgHasAccess(org) && (
          <div className="bg-amber/10 border border-amber/40 rounded-md p-4 mb-6">
            <p className="text-sm font-semibold text-navyDeep">Your free trial has ended.</p>
            <p className="text-sm text-ink mt-0.5">Choose a plan below to keep using Agent. Your data is safe and waiting for you.</p>
          </div>
        )}
        {org && (
          <div className="bg-white border border-border rounded-md p-5 sm:p-6 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted mb-1">Current plan</div>
              <div className="font-display text-xl font-medium text-navyDeep capitalize">{org.plan}</div>
              {org.plan === 'trial' && daysLeft !== null && (
                <div className="text-sm text-muted mt-1">{daysLeft} day{daysLeft === 1 ? '' : 's'} left in trial</div>
              )}
            </div>
            {org.stripe_customer_id && (
              <button
                onClick={manageBilling} disabled={portalLoading}
                className="text-sm text-navyDeep border border-navyDeep/30 rounded-md px-4 py-2.5 disabled:opacity-50 whitespace-nowrap"
              >
                {portalLoading ? 'Loading…' : 'Manage billing'}
              </button>
            )}
          </div>
        )}

        {error && <p className="text-sm text-warn mb-6">{error}</p>}

        {/* Monthly / annual toggle */}
        <div className="flex items-center gap-2 mb-5">
          <div className="inline-flex bg-white border border-border rounded-md p-1">
            <button
              onClick={() => setInterval('monthly')}
              className={`px-3.5 py-1.5 rounded-[4px] text-[13px] font-semibold ${interval === 'monthly' ? 'bg-navy text-white' : 'text-muted'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval('annual')}
              className={`px-3.5 py-1.5 rounded-[4px] text-[13px] font-semibold ${interval === 'annual' ? 'bg-navy text-white' : 'text-muted'}`}
            >
              Annual
            </button>
          </div>
          {interval === 'annual' && (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#9A5A16] bg-amber/10 rounded px-2 py-1">
              2 months free
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SELF_SERVE_PLANS.map((p) => {
            const displayPrice = interval === 'annual' ? p.annual : p.monthly
            const perMonthEquivalent = interval === 'annual' ? Math.round(p.annual / 12) : null
            return (
              <div key={p.key} className="bg-white border border-border rounded-md p-6 flex flex-col">
                <div className="font-display text-lg font-medium text-navyDeep mb-1">{p.name}</div>
                <div className="font-mono text-2xl text-navyDeep mb-0.5">
                  {aed(displayPrice)}
                  <span className="text-sm text-muted font-body">/{interval === 'annual' ? 'yr' : 'mo'}</span>
                </div>
                {perMonthEquivalent && (
                  <div className="font-mono text-xs text-muted mb-1">≈ {aed(perMonthEquivalent)}/mo</div>
                )}
                <div className="text-sm text-muted mb-6 mt-1">{p.desc}</div>
                <button
                  onClick={() => subscribe(p.key)}
                  disabled={loadingPlan === p.key || org?.plan === p.key}
                  className="mt-auto bg-amber text-ink font-bold rounded-md px-4 py-2.5 disabled:opacity-50"
                >
                  {org?.plan === p.key ? 'Current plan' : loadingPlan === p.key ? 'Loading…' : 'Subscribe'}
                </button>
              </div>
            )
          })}

          {/* Brokerage — quote only, no self-serve checkout */}
          <div className="bg-white border border-border rounded-md p-6 flex flex-col">
            <div className="font-display text-lg font-medium text-navyDeep mb-1">Brokerage</div>
            <div className="font-mono text-2xl text-navyDeep mb-0.5">
              {aed(BROKERAGE_FROM)}<span className="text-sm text-muted font-body">/mo</span>
            </div>
            <div className="text-xs text-muted mb-1">Starting from — custom quote</div>
            <div className="text-sm text-muted mb-6 mt-1">Portal integrations, API, dedicated support</div>
            <button
              onClick={() => setShowBrokerageForm(true)}
              className="mt-auto border border-navy text-navy font-semibold rounded-md px-4 py-2.5"
            >
              Contact us
            </button>
          </div>
        </div>

        <p className="text-xs text-muted mt-4 leading-relaxed">
          Prices in AED, billed in advance and renewed automatically until you cancel. No VAT charged. Subscribing means you
          agree to the <Link to="/legal/terms" className="text-navyDeep underline">Terms of Service</Link> and
          the <Link to="/legal/refunds" className="text-navyDeep underline">Refund Policy</Link>.
        </p>
      </div>

      {orgId && (
        <div className="mt-10 max-w-3xl">
          <p className="text-sm text-muted">
            Logo, invoice details, and reminder preferences moved to <Link to="/settings" className="text-navyDeep underline">Settings</Link>.
          </p>
        </div>
      )}

      {org && !org.is_comped && PAID_PLANS.includes(org.plan) && (
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

      <LegalFooter className="mt-12 max-w-3xl" />

      {showCancelFlow && (
        <CancelSubscriptionFlow
          onClose={() => setShowCancelFlow(false)}
          onCancelled={() => { setShowCancelFlow(false); load() }}
        />
      )}

      {showBrokerageForm && (
        <BrokerageContactForm onClose={() => setShowBrokerageForm(false)} />
      )}
    </Layout>
  )
}
