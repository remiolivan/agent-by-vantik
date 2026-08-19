import { useEffect, useRef, useState } from 'react'
import { Settings, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { formatMoney } from '../lib/format'

export default function Documents() {
  const [documents, setDocuments] = useState([])
  const [prospects, setProspects] = useState([])
  const [properties, setProperties] = useState([])
  const [org, setOrg] = useState(null)

  const [showNew, setShowNew] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const [title, setTitle] = useState('')
  const [prospectId, setProspectId] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [taxRate, setTaxRate] = useState('')
  const [currency, setCurrency] = useState('AED')
  const [items, setItems] = useState([{ description: '', amount: '' }])
  const [notes, setNotes] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  async function load() {
    const [{ data: docsData }, { data: prospectsData }, { data: propertiesData }, { data: membership }] = await Promise.all([
      supabase.from('documents').select('*, contacts(name), properties(title)').order('created_at', { ascending: false }),
      supabase.from('contacts').select('id, name').order('name'),
      supabase.from('properties').select('id, title').order('title'),
      supabase.from('memberships').select('org_id').single(),
    ])
    setDocuments(docsData ?? [])
    setProspects(prospectsData ?? [])
    setProperties(propertiesData ?? [])
    if (membership) {
      const { data: orgData } = await supabase.from('organizations').select('*').eq('id', membership.org_id).single()
      setOrg(orgData)
      if (orgData?.base_currency) setCurrency(orgData.base_currency)
    }
  }

  useEffect(() => { load() }, [])

  function updateItem(idx, field, value) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }

  function addItem() {
    setItems((prev) => [...prev, { description: '', amount: '' }])
  }

  async function generate(e) {
    e.preventDefault()
    setError(null)
    setGenerating(true)
    const { data, error } = await supabase.functions.invoke('generate-document', {
      body: {
        title, items, notes, currency,
        prospectId: prospectId || null,
        propertyId: propertyId || null,
        dueDate: dueDate || null,
        taxRate: taxRate || null,
      },
    })
    setGenerating(false)
    if (error || data?.error) return setError(data?.error || error.message)
    setShowNew(false)
    setTitle(''); setItems([{ description: '', amount: '' }]); setNotes('')
    setProspectId(''); setPropertyId(''); setDueDate(''); setTaxRate('')
    load()
  }

  async function downloadDoc(doc) {
    if (doc.file_url?.startsWith('data:')) {
      window.open(doc.file_url, '_blank')
      return
    }
    const { data } = await supabase.storage.from('property-documents').createSignedUrl(doc.file_url, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  return (
    <Layout
      title="Invoices"
      action={
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(true)} className="text-navyDeep border border-navyDeep/30 rounded-lg p-2.5" aria-label="Invoice settings">
            <Settings size={16} />
          </button>
          <button onClick={() => setShowNew(true)} className="bg-teal text-white text-sm font-medium rounded-lg px-4 py-2.5 lg:py-2 whitespace-nowrap">
            + New invoice
          </button>
        </div>
      }
    >
      {showNew && (
        <form onSubmit={generate} className="px-4 py-6 -mx-4 mb-6 bg-white border-y border-muted/20 sm:mx-0 sm:rounded-xl sm:border max-w-2xl space-y-3">
          <input
            value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g. Commission invoice)" className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
          />

          <div className="flex flex-col sm:flex-row gap-3">
            <select value={prospectId} onChange={(e) => setProspectId(e.target.value)} className="flex-1 border border-muted/30 rounded-lg px-3 py-2.5 text-sm">
              <option value="">No linked prospect</option>
              {prospects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="flex-1 border border-muted/30 rounded-lg px-3 py-2.5 text-sm">
              <option value="">No linked property</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>

          {items.map((item, idx) => (
            <div key={idx} className="flex gap-3">
              <input
                value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)}
                placeholder="Description" className="flex-1 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
              />
              <input
                value={item.amount} onChange={(e) => updateItem(idx, 'amount', e.target.value)}
                placeholder="Amount" type="number" className="w-24 sm:w-32 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
          ))}
          <button type="button" onClick={addItem} className="text-sm text-navyDeep underline">+ Add line item</button>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted block mb-1">Due date</label>
              <input
                type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
            <div className="w-28">
              <label className="text-xs text-muted block mb-1">Tax %</label>
              <input
                value={taxRate} onChange={(e) => setTaxRate(e.target.value)}
                placeholder="0" type="number" className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
            <div className="w-24">
              <label className="text-xs text-muted block mb-1">Currency</label>
              <input
                value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)" rows={2}
            className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={generating} className="bg-navyDeep text-white text-sm rounded-lg px-4 py-2.5 disabled:opacity-50 flex-1 sm:flex-none">
              {generating ? 'Generating…' : 'Generate invoice'}
            </button>
            <button type="button" onClick={() => setShowNew(false)} className="text-sm text-muted px-2">Cancel</button>
          </div>
        </form>
      )}

      <div className="max-w-2xl">
        {/* Mobile: card list */}
        <div className="space-y-2 sm:hidden">
          {documents.map((d) => (
            <button key={d.id} onClick={() => downloadDoc(d)} className="w-full text-left bg-white border border-muted/20 rounded-xl p-4 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm text-ink">{d.invoice_number || 'Invoice'}</div>
                <div className="text-xs text-muted font-mono">{formatMoney(d.total, d.currency || 'AED')}</div>
                {(d.contacts?.name || d.properties?.title) && (
                  <div className="text-xs text-muted truncate">{[d.contacts?.name, d.properties?.title].filter(Boolean).join(' · ')}</div>
                )}
              </div>
              <span className="text-navyDeep underline text-xs shrink-0">Download</span>
            </button>
          ))}
        </div>

        {/* Desktop: table */}
        <div className="hidden sm:block bg-white border border-muted/20 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left font-mono text-xs uppercase tracking-wide text-muted border-b border-muted/20">
                <th className="py-3 px-4 font-normal">Invoice</th>
                <th className="py-3 px-4 font-normal">Linked to</th>
                <th className="py-3 px-4 font-normal">Total</th>
                <th className="py-3 px-4 font-normal">Generated</th>
                <th className="py-3 px-4 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} className="border-b border-muted/10 last:border-0">
                  <td className="py-3 px-4 text-ink">{d.invoice_number || '—'}</td>
                  <td className="py-3 px-4 text-muted">{[d.contacts?.name, d.properties?.title].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="py-3 px-4 text-muted font-mono text-xs">{formatMoney(d.total, d.currency || 'AED')}</td>
                  <td className="py-3 px-4 text-muted font-mono text-xs">{new Date(d.generated_at || d.created_at).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => downloadDoc(d)} className="text-navyDeep underline text-xs">Download</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {documents.length === 0 && <p className="text-sm text-muted text-center py-8">No invoices yet.</p>}
      </div>

      {showSettings && org && (
        <InvoiceSettings org={org} onClose={() => setShowSettings(false)} onSaved={() => load()} />
      )}
    </Layout>
  )
}

function InvoiceSettings({ org, onClose, onSaved }) {
  const [form, setForm] = useState({
    invoice_business_name: org.invoice_business_name || '',
    invoice_address: org.invoice_address || '',
    invoice_email: org.invoice_email || '',
    invoice_phone: org.invoice_phone || '',
    invoice_iban: org.invoice_iban || '',
    invoice_trn: org.invoice_trn || '',
    base_currency: org.base_currency || 'AED',
  })
  const [stampUrl, setStampUrl] = useState(org.invoice_stamp_url || '')
  const [uploadingStamp, setUploadingStamp] = useState(false)
  const stampInputRef = useRef(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function uploadStamp(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingStamp(true)
    const path = `${org.id}/invoice-stamp-${Date.now()}-${file.name}`
    await supabase.storage.from('org-assets').upload(path, file, { upsert: true })
    const { data } = supabase.storage.from('org-assets').getPublicUrl(path)
    setStampUrl(data.publicUrl)
    setUploadingStamp(false)
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('organizations').update({ ...form, invoice_stamp_url: stampUrl || null }).eq('id', org.id)
    setSaving(false)
    setSaved(true)
    onSaved?.()
  }

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-navyDeep/40" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full sm:max-w-md bg-paper overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-muted/15 px-5 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between z-10">
          <span className="font-display text-lg font-medium text-navyDeep">Invoice details</span>
          <button onClick={onClose} className="text-muted p-1.5" aria-label="Close">✕</button>
        </div>
        <form onSubmit={save} className="px-5 py-5 space-y-3">
          <p className="text-xs text-muted mb-1">These details appear on every invoice you generate.</p>
          <input
            value={form.invoice_business_name} onChange={(e) => setForm({ ...form, invoice_business_name: e.target.value })}
            placeholder="Business name" className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
          />
          <textarea
            value={form.invoice_address} onChange={(e) => setForm({ ...form, invoice_address: e.target.value })}
            placeholder="Address" rows={2} className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
          />
          <input
            value={form.invoice_email} onChange={(e) => setForm({ ...form, invoice_email: e.target.value })}
            placeholder="Email" className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
          />
          <input
            value={form.invoice_phone} onChange={(e) => setForm({ ...form, invoice_phone: e.target.value })}
            placeholder="Phone" className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
          />
          <input
            value={form.invoice_iban} onChange={(e) => setForm({ ...form, invoice_iban: e.target.value })}
            placeholder="IBAN" className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
          />
          <input
            value={form.invoice_trn} onChange={(e) => setForm({ ...form, invoice_trn: e.target.value })}
            placeholder="TRN (tax registration number)" className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
          />
          <div>
            <label className="text-xs text-muted block mb-1">Base currency</label>
            <input
              value={form.base_currency} onChange={(e) => setForm({ ...form, base_currency: e.target.value.toUpperCase() })}
              className="w-32 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-muted block mb-1.5">Stamp / seal</label>
            {stampUrl && <img src={stampUrl} alt="Stamp" className="h-16 mb-2" />}
            <button
              type="button" onClick={() => stampInputRef.current?.click()} disabled={uploadingStamp}
              className="flex items-center gap-1.5 text-sm text-navyDeep border border-navyDeep/30 rounded-lg px-3.5 py-2 disabled:opacity-50"
            >
              <Upload size={14} /> {uploadingStamp ? 'Uploading…' : stampUrl ? 'Replace stamp' : 'Upload stamp'}
            </button>
            <input ref={stampInputRef} type="file" accept="image/*" onChange={uploadStamp} className="hidden" />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className="bg-navyDeep text-white text-sm rounded-lg px-4 py-2.5 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            {saved && <span className="text-xs text-teal-700">Saved.</span>}
          </div>
        </form>
      </div>
    </div>
  )
}
