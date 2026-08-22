import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { callAdminApi } from './adminApi'

// Checks admin status via the edge function (which checks platform_admins
// with the service-role key) — never trust a client-side flag for this.
export function useAdmin() {
  const { user, loading: authLoading } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setIsAdmin(false)
      setLoading(false)
      return
    }
    let cancelled = false
    callAdminApi('whoami')
      .then(() => { if (!cancelled) setIsAdmin(true) })
      .catch(() => { if (!cancelled) setIsAdmin(false) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user, authLoading])

  return { isAdmin, loading: authLoading || loading }
}
