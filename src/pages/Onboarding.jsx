import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import PushNotificationToggle from '../components/PushNotificationToggle'

const CURRENCIES = ['AED', 'USD', 'EUR', 'GBP']

export default function Onboarding() {
  const navigate = useNavigate()
  const [orgId, setOrgId] = useState(null)
  const [membershipId, setMembershipId] = useState(null)
  const [firstName, setFirstName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [currency, setCurrency] = useState('AED')
  const [showMore, setShowMore] = useState(false)
  const [address, setAddress] = useState('')
  const [trn, setTrn] = useState('')
  const [iban, setIban] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [logoFile, setLogoFile] = useState(null)
  const [stampFile, setStampFile] = useState(null)
  const [digestEnabled, setDigestEnabled] = useState(false)
  const [savingDigest, setSavingDigest] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const metaName = user?.user_metadata?.full_name || user?.user_metadata?.name
      if (metaName) setFirstName(metaName.split(' ')[0])
      const { data: membership } = await supabase.from('memberships').select('id, org_id, morning_digest_enabled').single()
      if (!membership) return
      setOrgId(membership.org_id)
      setMembershipId(membership.id)
      setDigestEnabled(!!membership.morning_digest_enabled)
      const { data: org } = await supabase.from('organizations')
        .select('name, base_currency, invoice_address, invoice_trn, invoice_iban, invoice_email, invoice_phone')
        .eq('id', membership.org_id).single()
      if (org) {
        setBusinessName(org.name || '')
        setCurrency(org.base_currency || 'AED')
        setAddress(org.invoice_address || '')
        setTrn(org.invoice_trn || '')
        setIban(org.invoice_iban || '')
        setEmail(org.invoice_email || '')
        setPhone(org.invoice_phone || '')
      }
    }
    load()
  }, [])

  async function toggleDigest() {
    if (!membershipId) return
    const next = !digestEnabled
    setDigestEnabled(next) // optimistic — same reasoning as Settings: just a preference toggle
    setSavingDigest(true)
    await supabase.from('memberships').update({ morning_digest_enabled: next }).eq('id', membershipId)
    setSavingDigest(false)
  }

  async function uploadAsset(file, kind) {
    if (!file || !orgId) return null
    const path = `${orgId}/${kind}-${Date.now()}-${file.name}`
    const { error: uploadErr } = await supabase.storage.from('org-assets').upload(path, file, { upsert: true })
    if (uploadErr) throw uploadErr
    const { data } = supabase.storage.from('org-assets').getPublicUrl(path)
    return data.publicUrl
  }

  async function complete(e) {
    e.preventDefault()
    if (!orgId) return
    setError(null)
    setSaving(true)
    try {
      const [logoUrl, stampUrl] = await Promise.all([
        uploadAsset(logoFile, 'logo'),
        uploadAsset(stampFile, 'invoice-stamp'),
      ])
      if (firstName.trim()) {
        // Best-effort — a failure here shouldn't block finishing onboarding,
        // it just means the dashboard greeting falls back to the business
        // name instead of the person's name.
        await supabase.auth.updateUser({ data: { full_name: firstName.trim() } })
      }
      const payload = {
        name: businessName,
        base_currency: currency,
        invoice_business_name: businessName,
        invoice_address: address || null,
        invoice_trn: trn || null,
        invoice_iban: iban || null,
        invoice_email: email || null,
        invoice_phone: phone || null,
        onboarding_completed: true,
      }
      if (logoUrl) payload.logo_url = logoUrl
      if (stampUrl) payload.invoice_stamp_url = stampUrl
      // Chaining .select().single() is deliberate: a plain .update() call
      // returns no error even when Row Level Security silently blocks the
      // write (0 rows affected looks identical to success). Forcing a
      // returned row means an RLS rejection surfaces as a real error
      // instead of the button appearing to do nothing.
      const { error: updateErr } = await supabase.from('organizations').update(payload).eq('id', orgId).select().single()
      if (updateErr) throw updateErr
      // A stale session token can still have the pre-signup JWT claims,
      // which would make the update above silently no-op under RLS. Refresh
      // before navigating so the dashboard's own org-scoped queries don't
      // hit the same stale-claim issue right after onboarding.
      await supabase.auth.refreshSession()
      navigate('/')
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  async function skip() {
    if (!orgId) return
    const { error: skipErr } = await supabase.from('organizations').update({ onboarding_completed: true }).eq('id', orgId).select().single()
    if (skipErr) { setError(skipErr.message); return }
    await supabase.auth.refreshSession()
    navigate('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-md">
        <Logo size={34} className="mb-8" />
        <h1 className="font-display text-2xl font-medium text-navyDeep mb-2">Set up your workspace</h1>
        <p className="text-sm text-muted mb-8">This takes a minute — you can always change it later, or skip for now.</p>

        <form onSubmit={complete} className="space-y-4">
          <input
            type="text" placeholder="Your first name (optional)" value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full border border-muted/30 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-navyDeep"
          />
          <input
            type="text" placeholder="Business name" value={businessName}
            onChange={(e) => setBusinessName(e.target.value)} required
            className="w-full border border-muted/30 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-navyDeep"
          />
          <select
            value={currency} onChange={(e) => setCurrency(e.target.value)}
            className="w-full border border-muted/30 rounded-lg px-4 py-3 text-sm bg-white"
          >
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Reminders — same toggles as Settings, surfaced here too so this
              isn't buried where most people never look after their first
              week. Still fully optional and editable later. */}
          <div className="border border-muted/20 rounded-lg p-4">
            <div className="font-mono text-xs uppercase tracking-wide text-muted mb-3">Reminders (optional)</div>
            <div className="space-y-4">
              <PushNotificationToggle />
              <div className="pt-3 border-t border-muted/15 flex items-center justify-between">
                <div>
                  <div className="text-sm text-ink font-medium">Morning digest</div>
                  <div className="text-xs text-muted mt-0.5">A push each morning (~7am) with today's tasks and appointments.</div>
                </div>
                <button
                  type="button" onClick={toggleDigest} disabled={savingDigest || !membershipId}
                  className={`text-xs rounded-full px-3.5 py-1.5 border disabled:opacity-50 ${
                    digestEnabled ? 'bg-navyDeep text-white border-navyDeep' : 'border-muted/30 text-muted'
                  }`}
                >
                  {digestEnabled ? 'On' : 'Off'}
                </button>
              </div>
            </div>
          </div>

          <button
            type="button" onClick={() => setShowMore((s) => !s)}
            className="flex items-center gap-1 text-sm text-navyDeep"
          >
            {showMore ? 'Hide extra details' : '+ Add address, TRN, IBAN, logo…'}
            {showMore ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showMore && (
            <div className="space-y-4 pt-1">
              <input
                type="text" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)}
                className="w-full border border-muted/30 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-navyDeep"
              />
              <input
                type="text" placeholder="TRN" value={trn} onChange={(e) => setTrn(e.target.value)}
                className="w-full border border-muted/30 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-navyDeep"
              />
              <input
                type="text" placeholder="IBAN" value={iban} onChange={(e) => setIban(e.target.value)}
                className="w-full border border-muted/30 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-navyDeep"
              />
              <input
                type="email" placeholder="Invoice email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-muted/30 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-navyDeep"
              />
              <input
                type="text" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-muted/30 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-navyDeep"
              />
              <div>
                <div className="text-xs text-muted mb-1.5">Logo</div>
                <input
                  type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  className="w-full text-sm"
                />
              </div>
              <div>
                <div className="text-xs text-muted mb-1.5">Invoice stamp</div>
                <input
                  type="file" accept="image/*" onChange={(e) => setStampFile(e.target.files?.[0] || null)}
                  className="w-full text-sm"
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit" disabled={saving}
              className="bg-navyDeep text-paper rounded-lg px-5 py-3 text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Finish setup'}
            </button>
            <button type="button" onClick={skip} className="text-sm text-muted underline">
              I'll complete this later
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
