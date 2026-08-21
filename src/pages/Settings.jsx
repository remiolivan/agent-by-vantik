import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import OrgSettings from '../components/OrgSettings'
import PushNotificationToggle from '../components/PushNotificationToggle'

export default function Settings() {
  const [orgId, setOrgId] = useState(null)
  const [membershipId, setMembershipId] = useState(null)
  const [digestEnabled, setDigestEnabled] = useState(false)
  const [savingDigest, setSavingDigest] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: membership } = await supabase.from('memberships').select('id, org_id, morning_digest_enabled').single()
      if (membership) {
        setOrgId(membership.org_id)
        setMembershipId(membership.id)
        setDigestEnabled(!!membership.morning_digest_enabled)
      }
    }
    load()
  }, [])

  async function toggleDigest() {
    const next = !digestEnabled
    setDigestEnabled(next) // optimistic — this is just a preference toggle, not worth a loading spinner
    setSavingDigest(true)
    await supabase.from('memberships').update({ morning_digest_enabled: next }).eq('id', membershipId)
    setSavingDigest(false)
  }

  return (
    <Layout title="Settings">
      <div className="max-w-3xl space-y-6">
        <div className="bg-white border border-muted/20 rounded-xl p-5 sm:p-6">
          <div className="font-mono text-xs uppercase tracking-wide text-muted mb-4">Reminders</div>
          <div className="space-y-5">
            <PushNotificationToggle />
            <div className="pt-5 border-t border-muted/15 flex items-center justify-between">
              <div>
                <div className="text-sm text-ink font-medium">Morning digest</div>
                <div className="text-xs text-muted mt-0.5">
                  A push notification each morning (~7am) summarizing today's tasks and appointments.
                </div>
              </div>
              <button
                onClick={toggleDigest} disabled={savingDigest || !membershipId}
                className={`text-xs rounded-full px-3.5 py-1.5 border disabled:opacity-50 ${
                  digestEnabled ? 'bg-navyDeep text-white border-navyDeep' : 'border-muted/30 text-muted'
                }`}
              >
                {digestEnabled ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        </div>

        {orgId && <OrgSettings orgId={orgId} defaultExpanded />}
      </div>
    </Layout>
  )
}
