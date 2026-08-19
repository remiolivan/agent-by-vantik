import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY once it has parsed the recovery
    // token from the URL hash and set a temporary session for this flow.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    // In case the event already fired before this component mounted,
    // also check for an existing session.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirmPassword) return setError('Passwords do not match.')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) return setError(error.message)
    setDone(true)
    setTimeout(() => navigate('/'), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <Logo size={34} className="mb-8" />
        <h1 className="font-display text-2xl font-medium text-navyDeep mb-8">Set a new password</h1>

        {done ? (
          <p className="text-sm text-muted">Password updated. Redirecting…</p>
        ) : !ready ? (
          <>
            <p className="text-sm text-muted mb-6">
              This link is invalid or has expired.
            </p>
            <Link to="/forgot-password" className="text-sm text-navyDeep underline">Request a new link</Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password" placeholder="New password" value={password}
              onChange={(e) => setPassword(e.target.value)} required
              className="w-full border border-muted/30 rounded px-4 py-3 text-sm focus:outline-none focus:border-navyDeep"
            />
            <input
              type="password" placeholder="Confirm new password" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} required
              className="w-full border border-muted/30 rounded px-4 py-3 text-sm focus:outline-none focus:border-navyDeep"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full bg-navyDeep text-paper rounded px-4 py-3 text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
