import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
    })

    // Org-scoped data relies entirely on an `organization_id` claim baked
    // into the JWT at issue time. If that claim changed after the token was
    // minted (e.g. switching between test accounts, or a slow trigger on
    // signup), the token can go stale — RLS then silently returns zero rows
    // everywhere, which looks exactly like "all my data disappeared" even
    // though nothing was deleted. Refreshing whenever the tab regains focus
    // keeps that window as short as possible without polling constantly.
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        supabase.auth.refreshSession()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      listener.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return { session, user: session?.user ?? null, loading }
}
