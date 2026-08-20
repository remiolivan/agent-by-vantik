import { Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const [onboardingStatus, setOnboardingStatus] = useState({ checked: false, needsOnboarding: false })

  useEffect(() => {
    async function checkOnboarding() {
      if (!user) return
      const { data: membership } = await supabase.from('memberships').select('org_id, role').eq('user_id', user.id).eq('status', 'active').maybeSingle()
      // Only the org owner ever sees the onboarding screen — invited agents
      // join an org that's already set up, so redirecting them here would
      // just be a pointless extra step in their way.
      if (!membership || membership.role !== 'owner') {
        setOnboardingStatus({ checked: true, needsOnboarding: false })
        return
      }
      const { data: org } = await supabase.from('organizations').select('onboarding_completed').eq('id', membership.org_id).single()
      setOnboardingStatus({ checked: true, needsOnboarding: org && org.onboarding_completed === false })
    }
    checkOnboarding()
  }, [user])

  if (loading || (user && !onboardingStatus.checked)) return null
  if (!user) return <Navigate to="/login" replace />
  if (onboardingStatus.needsOnboarding && window.location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }
  return children
}
