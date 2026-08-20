import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Mobile browsers suspend the tab in the background, which can leave the
// stored session token stale by the time the user comes back and taps an
// action. This refreshes the session before invoking, and retries once on
// a 401 so a single stale token doesn't surface as a hard error.
export async function invokeWithRetry(functionName, options) {
  await supabase.auth.getSession() // triggers a refresh if the token is near/past expiry
  let result = await supabase.functions.invoke(functionName, options)
  if (result.error && result.error.context?.status === 401) {
    await supabase.auth.refreshSession()
    result = await supabase.functions.invoke(functionName, options)
  }
  return result
}
