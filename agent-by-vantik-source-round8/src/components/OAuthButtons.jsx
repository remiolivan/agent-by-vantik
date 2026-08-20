import { useState } from 'react'
import { supabase } from '../lib/supabase'

// New accounts created via Google/Microsoft don't have a business name typed
// in beforehand (the OAuth screen has no form to collect it). The
// handle_new_user DB trigger already falls back to "My Organization" for a
// missing org_name, and onboarding_completed defaults to false — so these
// users land on /onboarding right after redirect and set their real
// business name there. Nothing extra needed here for that to work.
export default function OAuthButtons({ referralCode }) {
  const [loadingProvider, setLoadingProvider] = useState(null)
  const [error, setError] = useState(null)

  async function signInWith(provider) {
    setError(null)
    setLoadingProvider(provider)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/${referralCode ? `?ref=${encodeURIComponent(referralCode)}` : ''}`,
      },
    })
    if (error) {
      setError(error.message)
      setLoadingProvider(null)
    }
    // On success the browser redirects away to the provider, so there's no
    // further local state to set.
  }

  return (
    <div className="space-y-2.5">
      <button
        type="button" onClick={() => signInWith('google')} disabled={!!loadingProvider}
        className="w-full flex items-center justify-center gap-2.5 border border-muted/30 rounded px-4 py-3 text-sm font-medium text-ink hover:bg-tintBlue/40 disabled:opacity-50"
      >
        <GoogleIcon />
        {loadingProvider === 'google' ? 'Redirecting…' : 'Continue with Google'}
      </button>
      <button
        type="button" onClick={() => signInWith('azure')} disabled={!!loadingProvider}
        className="w-full flex items-center justify-center gap-2.5 border border-muted/30 rounded px-4 py-3 text-sm font-medium text-ink hover:bg-tintBlue/40 disabled:opacity-50"
      >
        <MicrosoftIcon />
        {loadingProvider === 'azure' ? 'Redirecting…' : 'Continue with Microsoft'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3c-7.5 0-14 4.1-17.7 10.2z"/>
      <path fill="#4CAF50" d="M24 45c5.5 0 10.4-2.1 14.1-5.6l-6.5-5.5C29.6 35.6 27 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.9 40.8 16.4 45 24 45z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.5 5.5C41.5 35.9 45 30.5 45 24c0-1.2-.1-2.4-.4-3.5z"/>
    </svg>
  )
}

function MicrosoftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 23 23" aria-hidden="true">
      <path fill="#F25022" d="M1 1h10v10H1z"/>
      <path fill="#7FBA00" d="M12 1h10v10H12z"/>
      <path fill="#00A4EF" d="M1 12h10v10H1z"/>
      <path fill="#FFB900" d="M12 12h10v10H12z"/>
    </svg>
  )
}
