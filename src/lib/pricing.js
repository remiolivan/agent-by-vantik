// Agent by Vantik pricing — single source of truth for the landing page and
// the Billing page. AED, updated 24 Sep 2026.
// Annual is marketed as "2 months free": Solo 999 vs 12x99 = 1188 (-15.9%),
// Team 3499 vs 12x349 = 4188 (-16.5%).
// Must match the 4 Stripe Price objects (STRIPE_PRICE_{SOLO,TEAM}_{MONTHLY,ANNUAL}).
export const SELF_SERVE_PLANS = [
  { key: 'solo', name: 'Solo', monthly: 99, annual: 999, desc: '1 agent' },
  { key: 'team', name: 'Team', monthly: 349, annual: 3499, desc: 'Up to 5 agents' },
]

// Brokerage is quote-only; this is the "from" anchor shown publicly.
export const BROKERAGE_FROM = 899

export const TRIAL_DAYS = 14
export const TRIAL_DAYS_REFERRAL = 30

export function aed(n) {
  return `AED ${n.toLocaleString('en-US')}`
}
