import { Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'
import { orgHasAccess, LOCKED_ALLOWED_PATHS } from '../lib/access'
const OPEN = { locked: false, canPay: false }

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [accessStatus, setAccessStatus] = useState({
    checked: false,
    needsOnboarding: false,
    suspended: false,
    suspendedReason: null,
    ...OPEN,
  })
  // Re-check on navigation while the org is locked, so a customer who just
  // paid gets in as soon as the Stripe webhook has updated their plan.
  const recheckKey = accessStatus.locked ? location.pathname : null
  useEffect(() => {
    async function checkAccess() {
      if (!user) return
      const { data: membership } = await supabase.from('memberships').select('org_id, role').eq('user_id', user.id).eq('status', 'active').maybeSingle()
      if (!membership) {
        setAccessStatus({ checked: true, needsOnboarding: false, suspended: false, suspendedReason: null, ...OPEN })
        return
      }
      const { data: org } = await supabase.from('organizations').select('onboarding_completed, suspended_at, suspended_reason, plan, trial_ends_at, is_comped').eq('id', membership.org_id).single()

      // Suspension blocks every member of the org (owner and invited agents
      // alike) — checked before the onboarding gate below, since a
      // suspended org shouldn't be able to walk through onboarding either.
      if (org?.suspended_at) {
        setAccessStatus({ checked: true, needsOnboarding: false, suspended: true, suspendedReason: org.suspended_reason ?? null, ...OPEN })
        return
      }

      // Trial over and no paid plan: lock the app. Owners/admins can still
      // reach /billing to subscribe; other members get a blocking screen.
      const canPay = ['owner', 'admin'].includes(membership.role)
      if (org && !orgHasAccess(org)) {
        setAccessStatus({ checked: true, needsOnboarding: false, suspended: false, suspendedReason: null, locked: true, canPay })
        return
      }

      // Only the org owner ever sees the onboarding screen — invited agents
      // join an org that's already set up, so redirecting them here would
      // just be a pointless extra step in their way.
      if (membership.role !== 'owner') {
        setAccessStatus({ checked: true, needsOnboarding: false, suspended: false, suspendedReason: null, ...OPEN })
        return
      }
      setAccessStatus({
        checked: true,
        needsOnboarding: org && org.onboarding_completed === false,
        suspended: false,
        suspendedReason: null,
        ...OPEN,
      })
    }
    checkAccess()
  }, [user, recheckKey])
  if (loading || (user && !accessStatus.checked)) return null
  if (!user) return <Navigate to="/login" replace />
  if (accessStatus.suspended) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-xl font-medium text-navyDeep mb-3">Account suspended</h1>
          <p className="text-sm text-muted mb-1">Access to this organization has been paused.</p>
          {accessStatus.suspendedReason && (
            <p className="text-sm text-muted mb-4">Reason: {accessStatus.suspendedReason}</p>
          )}
          <p className="text-sm text-muted">
            Contact <a href="mailto:remi.olivan@getvantik.com" className="text-navyDeep underline">remi.olivan@getvantik.com</a> for more information.
          </p>
        </div>
      </div>
    )
  }
  if (accessStatus.locked) {
    if (!accessStatus.canPay) {
      return (
        <div className="min-h-screen bg-paper flex items-center justify-center px-4">
          <div className="max-w-sm text-center">
            <h1 className="font-display text-xl font-medium text-navyDeep mb-3">Subscription expired</h1>
            <p className="text-sm text-muted mb-4">
              Your agency's free trial or subscription has ended. Ask the account owner to choose a plan to restore access.
            </p>
            <p className="text-sm text-muted">
              Questions? <a href="mailto:remi.olivan@getvantik.com" className="text-navyDeep underline">remi.olivan@getvantik.com</a>
            </p>
          </div>
        </div>
      )
    }
    if (!LOCKED_ALLOWED_PATHS.includes(location.pathname)) {
      return <Navigate to="/billing" replace />
    }
  }
  if (accessStatus.needsOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }
  return children
}
