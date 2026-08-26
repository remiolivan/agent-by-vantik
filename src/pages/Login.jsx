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
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel — navy, brand + pitch. Hidden on small screens. */}
      <div className="hidden lg:flex lg:w-[380px] lg:shrink-0 bg-navy px-8 py-10 flex-col justify-between">
        <Logo size={30} on="dark" />
        <div className="flex flex-col gap-3.5">
          <div className="w-12 h-px bg-gold" />
          <p className="text-[15px] text-navLight leading-relaxed text-pretty">
            Built for agents in the UAE. Leads, viewings, invoices and follow-ups, without the spreadsheet.
          </p>
        </div>
        <span className="font-mono text-[11px] text-navFaint">agent.getvantik.com</span>
      </div>

      {/* Mobile-only compact brand header */}
      <div className="lg:hidden bg-navy px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-8">
        <Logo size={28} on="dark" />
      </div>

      {/* Right panel — form, on paper background */}
      <div className="flex-1 bg-paper flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[340px] flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-[22px] font-semibold text-navy tracking-tight">Log in</h1>
            <p className="text-[13px] text-muted">Welcome back.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-muted">Email</span>
              <input
                type="email" placeholder="you@agency.ae" value={email}
                onChange={(e) => setEmail(e.target.value)} required
                className="w-full bg-white border border-inputBorder rounded-[5px] px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-mid focus:ring-1 focus:ring-mid"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-muted">Password</span>
                <Link to="/forgot-password" className="text-xs font-semibold text-mid">Forgot?</Link>
              </div>
              <input
                type="password" placeholder="••••••••••" value={password}
                onChange={(e) => setPassword(e.target.value)} required
                className="w-full bg-white border border-inputBorder rounded-[5px] px-3 py-2.5 text-sm font-mono text-ink focus:outline-none focus:border-mid focus:ring-1 focus:ring-mid"
              />
            </label>

            {error && <p className="text-sm text-warn">{error}</p>}

            <button
              type="submit" disabled={loading}
              className="w-full bg-amber text-ink rounded-[5px] px-4 py-3 text-sm font-bold disabled:opacity-50"
            >
              {loading ? 'Logging in…' : 'Log in'}
            </button>
          </form>

          <div className="flex items-center gap-2.5">
            <div className="flex-1 h-px bg-border" />
            <span className="font-mono text-[10px] text-muted">OR</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <OAuthButtons />

          <p className="text-xs text-muted text-center">
            No account yet?{' '}
            <Link to="/signup" className="text-mid font-semibold">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
