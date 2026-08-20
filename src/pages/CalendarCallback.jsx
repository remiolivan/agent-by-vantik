import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

const FUNCTION_BY_PROVIDER = {
  google: 'google-calendar-callback',
  outlook: 'outlook-calendar-callback',
}

export default function CalendarCallback() {
  const { provider } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('working') // working | success | error
  const [message, setMessage] = useState('Connecting your calendar…')

  useEffect(() => {
    async function run() {
      const code = searchParams.get('code')
      const oauthError = searchParams.get('error')
      const functionName = FUNCTION_BY_PROVIDER[provider]

      if (oauthError) {
        setStatus('error')
        setMessage(`The connection was cancelled or denied (${oauthError}).`)
        return
      }
      if (!code || !functionName) {
        setStatus('error')
        setMessage('Missing authorization code. Please try connecting again.')
        return
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        setStatus('error')
        setMessage('You need to be logged in to connect a calendar.')
        return
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { code },
        headers: { Authorization: `Bearer ${token}` },
      })

      if (error || data?.error) {
        setStatus('error')
        setMessage(data?.error || error.message)
        return
      }

      setStatus('success')
      setMessage(`Connected as ${data.email || 'your account'}. Redirecting…`)
      setTimeout(() => navigate('/calendar'), 1500)
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4 text-center">
      <div className="max-w-sm">
        <Logo size={34} className="mb-8 justify-center" />
        {status === 'working' && <p className="text-sm text-muted">{message}</p>}
        {status === 'success' && <p className="text-sm text-teal-700">{message}</p>}
        {status === 'error' && (
          <>
            <p className="text-sm text-red-600 mb-4">{message}</p>
            <Link to="/calendar" className="text-sm text-navyDeep underline">Back to Calendar</Link>
          </>
        )}
      </div>
    </div>
  )
}
