import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Signup() {
  const [orgName, setOrgName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const referralCode = searchParams.get('ref')

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { org_name: orgName, referral_code: referralCode || undefined } },
    })
    setLoading(false)
    if (error) return setError(error.message)
    navigate('/check-email')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-medium text-nightfall mb-2">
          Start your {referralCode ? '30' : '14'}-day trial
        </h1>
        {referralCode && (
          <p className="text-sm text-horizon bg-horizon/10 rounded px-3 py-2 mb-6">
            Referral code <span className="font-mono">{referralCode}</span> applied — you get 30 days instead of 14.
          </p>
        )}
        {!referralCode && <div className="mb-6" />}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text" placeholder="Business name" value={orgName}
            onChange={(e) => setOrgName(e.target.value)} required
            className="w-full border border-fog/30 rounded px-4 py-3 text-sm focus:outline-none focus:border-nightfall"
          />
          <input
            type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required
            className="w-full border border-fog/30 rounded px-4 py-3 text-sm focus:outline-none focus:border-nightfall"
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)} required minLength={8}
            className="w-full border border-fog/30 rounded px-4 py-3 text-sm focus:outline-none focus:border-nightfall"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full bg-nightfall text-paper rounded px-4 py-3 text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="text-sm text-fog mt-6">
          Already have an account? <Link to="/login" className="text-nightfall underline">Log in</Link>
        </p>
      </div>
    </div>
  )
}
