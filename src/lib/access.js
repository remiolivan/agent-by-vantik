// Who may use the app. An org has access if ANY of these is true:
//  - it's comped (free account granted by Vantik)
//  - it's on a paid plan (solo / team / brokerage). This also covers a
//    subscription cancelled at period end (plan stays paid until Stripe sends
//    customer.subscription.deleted) and a failed payment while Stripe retries.
//  - its free trial hasn't ended yet
// Otherwise the org is locked: owners/admins are sent to /billing, other
// members see a "subscription expired" screen.
export const PAID_PLANS = ['solo', 'team', 'brokerage']

export function orgHasAccess(org) {
  if (!org) return false
  if (org.is_comped) return true
  if (PAID_PLANS.includes(org.plan)) return true
  if (org.trial_ends_at && new Date(org.trial_ends_at) > new Date()) return true
  return false
}

// Routes an owner/admin can still reach when the org is locked.
export const LOCKED_ALLOWED_PATHS = ['/billing', '/onboarding']
