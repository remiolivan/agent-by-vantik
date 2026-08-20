import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import OAuthButtons from '../components/OAuthButtons'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // If a Google/Microsoft sign-in fails after the provider's own login
  // screen (e.g. no email scope granted, redirect URI mismatch), Supabase
  // sends the user back here with the error in the URL hash instead of
  // throwing anywhere in our own code. Without reading it, that failure is
  // completely silent — the user just lands back on this page with no clue
  // why.
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.slice(1))
    const oauthError = hashParams.get('error_description') || hashParams.get('error')
    if (oauthError) {
      setError(decodeURIComponent(oauthError.replace(/\+/g, ' ')))
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) return setError(error.message)
    navigate('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <Logo size={34} className="mb-8" />
        <h1 className="font-display text-2xl font-medium text-navyDeep mb-8">Log in</h1>

        <OAuthButtons />
        <div className="flex items-center gap-3 my-6">
          <div className="h-px bg-muted/20 flex-1" />
          <span className="text-xs text-muted">or</span>
          <div className="h-px bg-muted/20 flex-1" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required
            className="w-full border border-muted/30 rounded px-4 py-3 text-sm focus:outline-none focus:border-navyDeep"
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)} required
            className="w-full border border-muted/30 rounded px-4 py-3 text-sm focus:outline-none focus:border-navyDeep"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full bg-navyDeep text-paper rounded px-4 py-3 text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p className="text-sm text-muted mt-4">
          <Link to="/forgot-password" className="text-navyDeep underline">Forgot password?</Link>
        </p>
        <p className="text-sm text-muted mt-6">
          No account? <Link to="/signup" className="text-navyDeep underline">Start free trial</Link>
        </p>
      </div>
    </div>
  )
}
