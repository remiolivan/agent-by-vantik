import { Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const [accessStatus, setAccessStatus] = useState({
    checked: false,
    needsOnboarding: false,
    suspended: false,
    suspendedReason: null,
  })
  useEffect(() => {
    async function checkAccess() {
      if (!user) return
      const { data: membership } = await supabase.from('memberships').select('org_id, role').eq('user_id', user.id).eq('status', 'active').maybeSingle()
      if (!membership) {
        setAccessStatus({ checked: true, needsOnboarding: false, suspended: false, suspendedReason: null })
        return
      }
      const { data: org } = await supabase.from('organizations').select('onboarding_completed, suspended_at, suspended_reason').eq('id', membership.org_id).single()

      // Suspension blocks every member of the org (owner and invited agents
      // alike) — checked before the onboarding gate below, since a
      // suspended org shouldn't be able to walk through onboarding either.
      if (org?.suspended_at) {
        setAccessStatus({ checked: true, needsOnboarding: false, suspended: true, suspendedReason: org.suspended_reason ?? null })
        return
      }

      // Only the org owner ever sees the onboarding screen — invited agents
      // join an org that's already set up, so redirecting them here would
      // just be a pointless extra step in their way.
      if (membership.role !== 'owner') {
        setAccessStatus({ checked: true, needsOnboarding: false, suspended: false, suspendedReason: null })
        return
      }
      setAccessStatus({
        checked: true,
        needsOnboarding: org && org.onboarding_completed === false,
        suspended: false,
        suspendedReason: null,
      })
    }
    checkAccess()
  }, [user])
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
  if (accessStatus.needsOnboarding && window.location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }
  return children
}
