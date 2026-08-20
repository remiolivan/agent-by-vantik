import { useEffect, useRef, useState } from 'react'
import { X, Upload, Trash2, Share2, Pencil, MapPin, Receipt } from 'lucide-react'
import { supabase, invokeWithRetry } from '../lib/supabase'
import { formatMoney } from '../lib/format'
import { DEVELOPERS } from '../lib/constants'
import NumberInput from './NumberInput'

const TYPES = ['apartment', 'villa', 'townhouse', 'land', 'commercial', 'other']

const AMENITIES = [
  { key: 'has_pool', label: 'Pool' },
  { key: 'has_balcony', label: 'Balcony' },
  { key: 'is_vacant', label: 'Vacant' },
  { key: 'has_gym', label: 'Gym' },
]

function fieldsFrom(property) {
  return {
    title: property.title || '',
    address: property.address || '',
    value: property.value ?? '',
    bedrooms: property.bedrooms ?? '',
    bathrooms: property.bathrooms ?? '',
    property_type: property.property_type || 'apartment',
    listing_type: property.listing_type || '',
    listing_url: property.listing_url || '',
    description: property.description || '',
    developer: property.developer || '',
    furnished: property.furnished || '',
    completion_status: property.completion_status || '',
    has_pool: property.has_pool || false,
    has_balcony: property.has_balcony || false,
    is_vacant: property.is_vacant || false,
    has_gym: property.has_gym || false,
  }
}

export default function PropertyDetail({ property, onClose, onUpdated }) {
  const [editing, setEditing] = useState(false)
  const [current, setCurrent] = useState(property) // local copy so the view reflects saves immediately
  const [form, setForm] = useState(() => fieldsFrom(property))
  const [saving, setSaving] = useState(false)

  const [photos, setPhotos] = useState([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [viewerPhoto, setViewerPhoto] = useState(null)
  const photoInputRef = useRef(null)

  const [documents, setDocuments] = useState([])
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const docInputRef = useRef(null)

  const [orgId, setOrgId] = useState(null)

  const [sharing, setSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState(null)
  const [shareError, setShareError] = useState(null)

  const [invoices, setInvoices] = useState([])

  useEffect(() => {
    async function init() {
      const { data: membership } = await supabase.from('memberships').select('org_id').single()
      if (membership) setOrgId(membership.org_id)
    }
    init()
  }, [])

  useEffect(() => {
    if (orgId) { loadPhotos(); loadDocuments(); loadInvoices() }
  }, [orgId])

  async function loadInvoices() {
    const { data } = await supabase.from('documents').select('*').eq('property_id', property.id).order('created_at', { ascending: false })
    setInvoices(data ?? [])
  }

  async function downloadInvoice(doc) {
    if (doc.file_url?.startsWith('data:')) { window.open(doc.file_url, '_blank'); return }
    const { data } = await supabase.storage.from('property-documents').createSignedUrl(doc.file_url, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function loadPhotos() {
    const { data } = await supabase.storage.from('property-photos').list(`${orgId}/${property.id}`, {
      sortBy: { column: 'created_at', order: 'asc' },
    })
    const withUrls = (data ?? []).map((f) => ({
      name: f.name,
      url: supabase.storage.from('property-photos').getPublicUrl(`${orgId}/${property.id}/${f.name}`).data.publicUrl,
    }))
    setPhotos(withUrls)
  }

  async function loadDocuments() {
    const { data } = await supabase.storage.from('property-documents').list(`${orgId}/${property.id}`, {
      sortBy: { column: 'created_at', order: 'desc' },
    })
    setDocuments((data ?? []).filter((f) => !f.name.startsWith('brochure-')))
  }

  async function saveEdits(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      title: form.title,
      address: form.address || null,
      value: form.value === '' ? null : Number(form.value),
      bedrooms: form.bedrooms === '' ? null : Number(form.bedrooms),
      bathrooms: form.bathrooms === '' ? null : Number(form.bathrooms),
      property_type: form.property_type,
      listing_type: form.listing_type || null,
      listing_url: form.listing_url || null,
      description: form.description || null,
      developer: form.developer || null,
      furnished: form.furnished || null,
      completion_status: form.completion_status || null,
      has_pool: form.has_pool,
      has_balcony: form.has_balcony,
      is_vacant: form.is_vacant,
      has_gym: form.has_gym,
    }
    await supabase.from('properties').update(payload).eq('id', property.id)
    setSaving(false)
    setCurrent({ ...current, ...payload })
    setEditing(false)
    onUpdated?.()
  }

  function cancelEdit() {
    setForm(fieldsFrom(current))
    setEditing(false)
  }

  async function uploadPhoto(e) {
    const file = e.target.files?.[0]
    if (!file || !orgId) return
    setUploadingPhoto(true)
    const path = `${orgId}/${property.id}/${Date.now()}-${file.name}`
    await supabase.storage.from('property-photos').upload(path, file)
    setUploadingPhoto(false)
    if (photoInputRef.current) photoInputRef.current.value = ''
    loadPhotos()
  }

  async function deletePhoto(name) {
    await supabase.storage.from('property-photos').remove([`${orgId}/${property.id}/${name}`])
    loadPhotos()
  }

  async function uploadDoc(e) {
    const file = e.target.files?.[0]
    if (!file || !orgId) return
    setUploadingDoc(true)
    const path = `${orgId}/${property.id}/${Date.now()}-${file.name}`
    await supabase.storage.from('property-documents').upload(path, file)
    setUploadingDoc(false)
    if (docInputRef.current) docInputRef.current.value = ''
    loadDocuments()
  }

  async function deleteDoc(name) {
    await supabase.storage.from('property-documents').remove([`${orgId}/${property.id}/${name}`])
    loadDocuments()
  }

  async function downloadDoc(name) {
    const { data } = await supabase.storage.from('property-documents')
      .createSignedUrl(`${orgId}/${property.id}/${name}`, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function generateShare() {
    setSharing(true)
    setShareError(null)
    setShareUrl(null)
    const { data, error } = await invokeWithRetry('generate-property-brochure', {
      body: { propertyId: property.id },
    })
    setSharing(false)
    if (error || data?.error) {
      setShareError(data?.error || error.message)
      return
    }
    setShareUrl(data.url)
  }

  const displayName = (fullName) => fullName.replace(/^\d+-/, '')

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-navyDeep/40" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full sm:max-w-lg bg-paper overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-muted/15 px-5 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between z-10">
          <div className="min-w-0">
            <div className="font-display text-lg font-medium text-navyDeep truncate">{current.title}</div>
            {current.value && (
              <div className="text-xs text-muted font-mono">{formatMoney(current.value, current.currency || 'AED')}</div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!editing && (
              <button onClick={() => setEditing(true)} className="text-navyDeep p-1.5" aria-label="Edit">
                <Pencil size={17} />
              </button>
            )}
            <button onClick={onClose} aria-label="Close" className="text-muted p-1.5">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="px-5 py-5 space-y-8">
          {!editing ? (
            <div className="bg-white border border-muted/20 rounded-xl p-4 space-y-3">
              {current.address && (
                <div className="flex items-start gap-1.5 text-sm text-ink"><MapPin size={14} className="mt-0.5 shrink-0 text-muted" /> {current.address}</div>
              )}
              <div className="flex flex-wrap gap-2 text-xs">
                {current.listing_type && (
                  <span className="rounded px-2 py-1 bg-tintBlue text-navyDeep font-mono uppercase">{current.listing_type === 'sale' ? 'For sale' : 'For rent'}</span>
                )}
                <span className="rounded px-2 py-1 bg-paper text-muted capitalize">{current.property_type}</span>
                {(current.bedrooms || current.bathrooms) && (
                  <span className="rounded px-2 py-1 bg-paper text-muted">{current.bedrooms ?? '–'} bd · {current.bathrooms ?? '–'} ba</span>
                )}
                {current.developer && <span className="rounded px-2 py-1 bg-paper text-muted">{current.developer}</span>}
              </div>
              {(current.completion_status || current.furnished || current.has_pool || current.has_balcony || current.is_vacant || current.has_gym) && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {current.completion_status && <span className="rounded px-2 py-1 bg-teal/10 text-teal-700">{current.completion_status === 'ready' ? 'Ready' : 'Off-plan'}</span>}
                  {current.furnished && <span className="rounded px-2 py-1 bg-teal/10 text-teal-700 capitalize">{current.furnished}</span>}
                  {current.has_pool && <span className="rounded px-2 py-1 bg-teal/10 text-teal-700">Pool</span>}
                  {current.has_balcony && <span className="rounded px-2 py-1 bg-teal/10 text-teal-700">Balcony</span>}
                  {current.is_vacant && <span className="rounded px-2 py-1 bg-teal/10 text-teal-700">Vacant</span>}
                  {current.has_gym && <span className="rounded px-2 py-1 bg-teal/10 text-teal-700">Gym</span>}
                </div>
              )}
              {current.listing_url && (
                <a href={current.listing_url} target="_blank" rel="noreferrer" className="text-xs text-teal-700 underline block">Open listing ↗</a>
              )}
              {current.description && <p className="text-sm text-ink whitespace-pre-wrap">{current.description}</p>}
              {!current.address && !current.description && !current.listing_type && (
                <p className="text-sm text-muted">No details yet — tap Edit to fill them in.</p>
              )}
            </div>
          ) : (
            <form onSubmit={saveEdits} className="bg-white border border-muted/20 rounded-xl p-4 space-y-3">
              <input
                value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Title" required
                className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
              />
              <input
                value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Address" className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
              />
              <div className="flex gap-2">
                <NumberInput
                  value={form.value} onChange={(v) => setForm({ ...form, value: v })}
                  placeholder="Price (AED)" className="flex-1 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
                />
                <input
                  value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })}
                  placeholder="Beds" type="number" className="w-20 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
                />
                <input
                  value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })}
                  placeholder="Baths" type="number" className="w-20 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
                />
              </div>
              <select
                value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value })}
                className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm capitalize"
              >
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>

              <select
                value={form.developer} onChange={(e) => setForm({ ...form, developer: e.target.value })}
                className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
              >
                <option value="">Developer (optional)</option>
                {DEVELOPERS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>

              <div className="flex gap-2 pt-1">
                {[{ value: 'sale', label: 'For sale' }, { value: 'rent', label: 'For rent' }].map((opt) => (
                  <button
                    key={opt.value} type="button"
                    onClick={() => setForm({ ...form, listing_type: form.listing_type === opt.value ? '' : opt.value })}
                    className={`flex-1 text-sm rounded-lg px-3 py-2.5 border ${
                      form.listing_type === opt.value ? 'bg-navyDeep text-white border-navyDeep' : 'border-muted/30 text-muted'
                    }`}
                  >{opt.label}</button>
                ))}
              </div>

              <div className="flex gap-2">
                {[{ value: 'furnished', label: 'Furnished' }, { value: 'unfurnished', label: 'Unfurnished' }].map((opt) => (
                  <button
                    key={opt.value} type="button"
                    onClick={() => setForm({ ...form, furnished: form.furnished === opt.value ? '' : opt.value })}
                    className={`flex-1 text-sm rounded-lg px-3 py-2.5 border ${
                      form.furnished === opt.value ? 'bg-navyDeep text-white border-navyDeep' : 'border-muted/30 text-muted'
                    }`}
                  >{opt.label}</button>
                ))}
              </div>

              <div className="flex gap-2">
                {[{ value: 'ready', label: 'Ready' }, { value: 'offplan', label: 'Off-plan' }].map((opt) => (
                  <button
                    key={opt.value} type="button"
                    onClick={() => setForm({ ...form, completion_status: form.completion_status === opt.value ? '' : opt.value })}
                    className={`flex-1 text-sm rounded-lg px-3 py-2.5 border ${
                      form.completion_status === opt.value ? 'bg-navyDeep text-white border-navyDeep' : 'border-muted/30 text-muted'
                    }`}
                  >{opt.label}</button>
                ))}
              </div>

              <div>
                <div className="text-xs text-muted mb-1.5">Amenities</div>
                <div className="flex flex-wrap gap-1.5">
                  {AMENITIES.map((a) => (
                    <button
                      key={a.key} type="button"
                      onClick={() => setForm({ ...form, [a.key]: !form[a.key] })}
                      className={`text-xs rounded-full px-3 py-1.5 border ${
                        form[a.key] ? 'bg-navyDeep text-white border-navyDeep' : 'border-muted/30 text-muted'
                      }`}
                    >{a.label}</button>
                  ))}
                </div>
              </div>

              <input
                value={form.listing_url} onChange={(e) => setForm({ ...form, listing_url: e.target.value })}
                placeholder="Link to the listing (Property Finder, Bayut, etc.)"
                className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
              />
              <textarea
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Description (used in the shared brochure)" rows={3}
                className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
              />
              <div className="flex items-center gap-3 pt-1">
                <button type="submit" disabled={saving} className="bg-navyDeep text-white text-sm rounded-lg px-4 py-2.5 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={cancelEdit} className="text-sm text-muted px-2">Cancel</button>
              </div>
            </form>
          )}

          {/* Photos */}
          <div>
            <div className="font-mono text-xs uppercase tracking-wide text-muted mb-3">Photos</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {photos.map((p) => (
                <div key={p.name} className="relative aspect-square rounded-lg overflow-hidden border border-muted/20 group">
                  {/* The square crop below is only for the thumbnail grid —
                      clicking opens the full photo uncropped (object-contain)
                      so a portrait photo actually looks like a portrait
                      photo, not just the cropped square. */}
                  <button type="button" onClick={() => setViewerPhoto(p)} className="block w-full h-full">
                    <img src={p.url} alt="" className="w-full h-full object-cover" />
                  </button>
                  <button
                    onClick={() => deletePhoto(p.name)}
                    className="absolute top-1 right-1 bg-navyDeep/70 text-white rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Delete photo"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="aspect-square rounded-lg border border-dashed border-muted/40 flex flex-col items-center justify-center text-muted text-xs gap-1 disabled:opacity-50"
              >
                <Upload size={16} />
                {uploadingPhoto ? '…' : 'Add'}
              </button>
              <input ref={photoInputRef} type="file" accept="image/*" onChange={uploadPhoto} className="hidden" />
            </div>
          </div>

          {/* Documents (title deed, etc.) */}
          <div>
            <div className="font-mono text-xs uppercase tracking-wide text-muted mb-3">Documents (title deed, etc.)</div>
            <div className="space-y-2 mb-3">
              {documents.map((d) => (
                <div key={d.name} className="bg-white border border-muted/20 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                  <button onClick={() => downloadDoc(d.name)} className="text-sm text-navyDeep underline text-left truncate flex-1">
                    {displayName(d.name)}
                  </button>
                  <button onClick={() => deleteDoc(d.name)} className="text-muted shrink-0" aria-label="Delete document">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {documents.length === 0 && <p className="text-xs text-muted">No documents uploaded yet.</p>}
            </div>
            <button
              onClick={() => docInputRef.current?.click()}
              disabled={uploadingDoc}
              className="text-sm text-navyDeep border border-navyDeep/30 rounded-lg px-3.5 py-2 disabled:opacity-50"
            >
              {uploadingDoc ? 'Uploading…' : '+ Upload document'}
            </button>
            <input ref={docInputRef} type="file" onChange={uploadDoc} className="hidden" />
          </div>

          {/* Invoices linked to this property */}
          <div>
            <div className="font-mono text-xs uppercase tracking-wide text-muted mb-3">Invoices</div>
            <div className="space-y-2">
              {invoices.map((inv) => (
                <button key={inv.id} onClick={() => downloadInvoice(inv)} className="w-full text-left bg-white border border-muted/20 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm text-navyDeep"><Receipt size={14} className="text-muted" /> {inv.invoice_number || 'Invoice'}</span>
                  <span className="text-xs text-muted font-mono">{formatMoney(inv.total, inv.currency || 'AED')}</span>
                </button>
              ))}
              {invoices.length === 0 && <p className="text-xs text-muted">No invoices linked to this property yet.</p>}
            </div>
          </div>

          {/* Share to prospect */}
          <div>
            <div className="font-mono text-xs uppercase tracking-wide text-muted mb-3">Share with a prospect</div>
            <div className="bg-white border border-muted/20 rounded-xl p-4">
              {!shareUrl ? (
                <button
                  onClick={generateShare}
                  disabled={sharing}
                  className="flex items-center gap-2 bg-teal text-white text-sm font-medium rounded-lg px-4 py-2.5 disabled:opacity-50"
                >
                  <Share2 size={15} />
                  {sharing ? 'Generating PDF…' : 'Generate brochure to share'}
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted">Brochure ready. Send it from WhatsApp or email:</p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`${current.title}\n${shareUrl}`)}`}
                      target="_blank" rel="noreferrer"
                      className="text-sm bg-[#25D366] text-white rounded-lg px-4 py-2.5"
                    >Send via WhatsApp</a>
                    <a
                      href={`mailto:?subject=${encodeURIComponent(current.title)}&body=${encodeURIComponent(`Here's the brochure: ${shareUrl}`)}`}
                      className="text-sm text-navyDeep border border-navyDeep/30 rounded-lg px-4 py-2.5"
                    >Send via email</a>
                  </div>
                  <button onClick={generateShare} disabled={sharing} className="text-xs text-muted underline">
                    {sharing ? 'Regenerating…' : 'Regenerate'}
                  </button>
                </div>
              )}
              {shareError && <p className="text-xs text-red-600 mt-2">{shareError}</p>}
            </div>
          </div>
        </div>
      </div>

      {viewerPhoto && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setViewerPhoto(null)}
        >
          <button
            onClick={() => setViewerPhoto(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            aria-label="Close"
          >
            <X size={28} />
          </button>
          {/* object-contain (not cover) — shows the whole photo at its
              actual aspect ratio, portrait or landscape, instead of
              cropping it to fit a box. */}
          <img src={viewerPhoto.url} alt="" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
