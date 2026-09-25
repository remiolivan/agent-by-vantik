// supabase.functions.invoke() hides the response body of non-2xx replies
// behind a generic "Edge Function returned a non-2xx status code" message.
// This digs out the { error } our functions send back so users see it.
export async function functionErrorMessage(error, data) {
  if (data?.error) return data.error
  if (!error) return null
  try {
    const body = await error.context?.json?.()
    if (body?.error) return body.error
  } catch {
    // body wasn't JSON — fall through
  }
  return 'Something went wrong. Please try again, or contact remi.olivan@getvantik.com.'
}
