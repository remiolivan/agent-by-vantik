import { supabase } from './supabase'

// Thin wrapper around the `admin-api` edge function. Every admin screen
// goes through this — never queries organizations/memberships directly
// with the client's own session, since that session isn't scoped for
// cross-org reads (RLS would just return nothing / the caller's own org).
export async function callAdminApi(action, payload = {}) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Not authenticated')

  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: { action, ...payload },
    headers: { Authorization: `Bearer ${token}` },
  })

  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data
}
