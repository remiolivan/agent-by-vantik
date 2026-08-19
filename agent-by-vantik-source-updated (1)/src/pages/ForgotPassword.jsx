import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) return setError(error.message)
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <Logo size={34} className="mb-8" />
        <h1 className="font-display text-2xl font-medium text-navyDeep mb-2">Reset password</h1>

        {sent ? (
          <>
            <p className="text-sm text-muted mb-6">
              If an account exists for <span className="text-navyDeep">{email}</span>, we've sent a link to reset your password.
            </p>
            <Link to="/login" className="text-sm text-navyDeep underline">Back to log in</Link>
          </>
        ) : (
          <>
            <p className="text-sm text-muted mb-8">Enter your email and we'll send you a reset link.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email" placeholder="Email" value={email}
                onChange={(e) => setEmail(e.target.value)} required
                className="w-full border border-muted/30 rounded px-4 py-3 text-sm focus:outline-none focus:border-navyDeep"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit" disabled={loading}
                className="w-full bg-navyDeep text-paper rounded px-4 py-3 text-sm font-medium disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <p className="text-sm text-muted mt-6">
              <Link to="/login" className="text-navyDeep underline">Back to log in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
