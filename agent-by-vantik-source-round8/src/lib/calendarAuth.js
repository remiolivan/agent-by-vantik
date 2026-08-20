// Client IDs are public identifiers (not secrets) — safe to expose in the frontend build.
// Client secrets stay server-side only, as Supabase edge function secrets.

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const MS_CLIENT_ID = import.meta.env.VITE_MS_CLIENT_ID

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : ''

export const GOOGLE_REDIRECT_URI = `${ORIGIN}/calendar/callback/google`
export const OUTLOOK_REDIRECT_URI = `${ORIGIN}/calendar/callback/outlook`

export function isGoogleConfigured() {
  return Boolean(GOOGLE_CLIENT_ID)
}

export function isOutlookConfigured() {
  return Boolean(MS_CLIENT_ID)
}

export function googleAuthorizeUrl() {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar email',
    access_type: 'offline',
    prompt: 'consent', // forces a refresh_token to be returned every time
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export function outlookAuthorizeUrl() {
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    redirect_uri: OUTLOOK_REDIRECT_URI,
    response_type: 'code',
    response_mode: 'query',
    scope: 'offline_access Calendars.ReadWrite User.Read',
    prompt: 'consent',
  })
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
}

// Builds a Google Maps search link from a free-text address/location string.
export function mapsLinkFor(location) {
  if (!location) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
}
