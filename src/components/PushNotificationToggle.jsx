import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Public key only — safe to embed in the client bundle by design (it's
// what identifies OUR server to the push service, not a secret). The
// matching private key lives only in the VAPID_PRIVATE_KEY edge function
// secret and must never appear here.
const VAPID_PUBLIC_KEY = 'BO1xeL6nGASUebhQp4plXkio78SOQnwb9KJGnllrQtsDUoZmc40W67a1XjjZVqyTp3Y7WhRFHMWr7gqTHLIizVc'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export default function PushNotificationToggle() {
  const [supported, setSupported] = useState(true)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function check() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setSupported(false)
        return
      }
      const reg = await navigator.serviceWorker.register('/sw.js')
      const existing = await reg.pushManager.getSubscription()
      setSubscribed(!!existing)
    }
    check()
  }, [])

  async function enable() {
    setError(null)
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError('Notifications were blocked. You can re-enable them in your browser/phone settings.')
        setLoading(false)
        return
      }
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      const json = subscription.toJSON()
      const { data: membership } = await supabase.from('memberships').select('id').single()
      const { error: dbErr } = await supabase.from('push_subscriptions').upsert({
        membership_id: membership.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth_key: json.keys.auth,
      }, { onConflict: 'endpoint' })
      if (dbErr) throw dbErr
      setSubscribed(true)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  async function disable() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.getSubscription()
      if (subscription) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
        await subscription.unsubscribe()
      }
      setSubscribed(false)
    } finally {
      setLoading(false)
    }
  }

  if (!supported) {
    return <p className="text-sm text-muted">Push notifications aren't supported in this browser.</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-ink font-medium">Push notifications</div>
          <div className="text-xs text-muted mt-0.5">
            {subscribed ? 'Enabled on this device.' : 'Get notified for reminders and follow-ups on this device.'}
          </div>
        </div>
        <button
          onClick={subscribed ? disable : enable} disabled={loading}
          className={`text-xs rounded-full px-3.5 py-1.5 border disabled:opacity-50 ${
            subscribed ? 'border-muted/30 text-muted' : 'bg-navyDeep text-white border-navyDeep'
          }`}
        >
          {loading ? '…' : subscribed ? 'Disable' : 'Enable'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      {/* iOS specifically requires the site to be added to the Home Screen
          before push works at all — Safari in a regular tab silently
          ignores the subscribe request. */}
      <p className="text-xs text-muted mt-2">
        On iPhone: add this app to your Home Screen first (Share → Add to Home Screen), then enable notifications from there.
      </p>
    </div>
  )
}
