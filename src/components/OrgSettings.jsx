import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'

const CURRENCIES = ['AED', 'USD', 'EUR', 'GBP']

export default function OrgSettings({ orgId, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [businessName, setBusinessName] = useState('')
  const [currency, setCurrency] = useState('AED')
  const [address, setAddress] = useState('')
  const [trn, setTrn] = useState('')
  const [iban, setIban] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [logoUrl, setLogoUrl] = useState(null)
  const [stampUrl, setStampUrl] = useState(null)
  const [logoFile, setLogoFile] = useState(null)
  const [stampFile, setStampFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: org } = await supabase.from('organizations')
        .select('name, base_currency, invoice_address, invoice_trn, invoice_iban, invoice_email, invoice_phone, logo_url, invoice_stamp_url')
        .eq('id', orgId).single()
      if (org) {
        setBusinessName(org.name || '')
        setCurrency(org.base_currency || 'AED')
        setAddress(org.invoice_address || '')
        setTrn(org.invoice_trn || '')
        setIban(org.invoice_iban || '')
        setEmail(org.invoice_email || '')
        setPhone(org.invoice_phone || '')
        setLogoUrl(org.logo_url || null)
        setStampUrl(org.invoice_stamp_url || null)
      }
    }
    if (orgId) load()
  }, [orgId])

  async function uploadAsset(file, kind) {
    if (!file) return null
    const path = `${orgId}/${kind}-${Date.now()}-${file.name}`
    const { error: uploadErr } = await supabase.storage.from('org-assets').upload(path, file, { upsert: true })
    if (uploadErr) throw uploadErr
    const { data } = supabase.storage.from('org-assets').getPublicUrl(path)
    return data.publicUrl
  }

  async function save(e) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setSaving(true)
    try {
      const [newLogoUrl, newStampUrl] = await Promise.all([
        uploadAsset(logoFile, 'logo'),
        uploadAsset(stampFile, 'invoice-stamp'),
      ])
      const payload = {
        name: businessName,
        base_currency: currency,
        invoice_business_name: businessName,
        invoice_address: address || null,
        invoice_trn: trn || null,
        invoice_iban: iban || null,
        invoice_email: email || null,
        invoice_phone: phone || null,
      }
      if (newLogoUrl) { payload.logo_url = newLogoUrl; setLogoUrl(newLogoUrl) }
      if (newStampUrl) { payload.invoice_stamp_url = newStampUrl; setStampUrl(newStampUrl) }
      const { error: updateErr } = await supabase.from('organizations').update(payload).eq('id', orgId).select().single()
      if (updateErr) throw updateErr
      setLogoFile(null)
      setStampFile(null)
      setSaved(true)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-muted/20 rounded-xl p-5 sm:p-6">
      <button
        type="button" onClick={() => setExpanded((s) => !s)}
        className="flex items-center justify-between w-full"
      >
        <div className="text-left">
          <div className="font-mono text-xs uppercase tracking-wide text-muted mb-1">Business profile</div>
          <div className="font-display text-lg font-medium text-navyDeep">Logo, invoice details & branding</div>
        </div>
        {expanded ? <ChevronUp size={18} className="text-muted" /> : <ChevronDown size={18} className="text-muted" />}
      </button>

      {!expanded && (
        <p className="text-sm text-muted mt-2">
          {logoUrl ? 'Logo set — used on invoices and property brochures.' : 'No logo set yet — click to add one.'}
        </p>
      )}

      {expanded && (
        <form onSubmit={save} className="space-y-4 mt-5">
          <div className="flex items-center gap-4">
            {logoUrl && <img src={logoUrl} alt="Current logo" className="h-10 max-w-[120px] object-contain" />}
            <div className="flex-1">
              <div className="text-xs text-muted mb-1.5">Logo — shown on invoices and property brochure PDFs</div>
              <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} className="w-full text-sm" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {stampUrl && <img src={stampUrl} alt="Current stamp" className="h-10 max-w-[120px] object-contain" />}
            <div className="flex-1">
              <div className="text-xs text-muted mb-1.5">Invoice stamp</div>
              <input type="file" accept="image/*" onChange={(e) => setStampFile(e.target.files?.[0] || null)} className="w-full text-sm" />
            </div>
          </div>

          <input
            type="text" placeholder="Business name" value={businessName}
            onChange={(e) => setBusinessName(e.target.value)} required
            className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
          />
          <select
            value={currency} onChange={(e) => setCurrency(e.target.value)}
            className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm bg-white"
          >
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="text" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)}
            className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
          />
          <input
            type="text" placeholder="TRN" value={trn} onChange={(e) => setTrn(e.target.value)}
            className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
          />
          <input
            type="text" placeholder="IBAN" value={iban} onChange={(e) => setIban(e.target.value)}
            className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
          />
          <input
            type="email" placeholder="Invoice email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
          />
          <input
            type="text" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-teal">Saved.</p>}

          <button type="submit" disabled={saving} className="bg-navyDeep text-white text-sm rounded-lg px-4 py-2.5 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}
    </div>
  )
}
