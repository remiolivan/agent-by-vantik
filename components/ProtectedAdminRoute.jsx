import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { useAdmin } from '../lib/useAdmin'

export default function ProtectedAdminRoute({ children }) {
  const { user, loading: authLoading } = useAuth()
  const { isAdmin, loading: adminLoading } = useAdmin()

  if (authLoading || adminLoading) return null
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}
