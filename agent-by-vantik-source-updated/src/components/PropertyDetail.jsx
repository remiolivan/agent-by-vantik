import { useEffect, useRef, useState } from 'react'
import { X, Upload, Trash2, Share2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatMoney } from '../lib/format'

export default function PropertyDetail({ property, onClose, onUpdated }) {
  const [listing, setListing] = useState({
    listing_type: property.listing_type || '',
    listing_url: property.listing_url || '',
    description: property.description || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [photos, setPhotos] = useState([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoInputRef = useRef(null)

  const [documents, setDocuments] = useState([])
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const docInputRef = useRef(null)

  const [orgId, setOrgId] = useState(null)

  const [sharing, setSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState(null)
  const [shareError, setShareError] = useState(null)

  useEffect(() => {
    async function init() {
      const { data: membership } = await supabase.from('memberships').select('org_id').single()
      if (membership) setOrgId(membership.org_id)
    }
    init()
  }, [])

  useEffect(() => {
    if (orgId) { loadPhotos(); loadDocuments() }
  }, [orgId])

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
    // Skip auto-generated brochures from the manual documents list — those are share artifacts, not uploads.
    setDocuments((data ?? []).filter((f) => !f.name.startsWith('brochure-')))
  }

  async function saveListing(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    await supabase.from('properties').update({
      listing_type: listing.listing_type || null,
      listing_url: listing.listing_url || null,
      description: listing.description || null,
    }).eq('id', property.id)
    setSaving(false)
    setSaved(true)
    onUpdated?.()
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
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const { data, error } = await supabase.functions.invoke('generate-property-brochure', {
      body: { propertyId: property.id },
      headers: { Authorization: `Bearer ${token}` },
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
        <div className="sticky top-0 bg-white border-b border-muted/15 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <div className="font-display text-lg font-medium text-navyDeep">{property.title}</div>
            {property.value && (
              <div className="text-xs text-muted font-mono">{formatMoney(property.value, property.currency || 'USD')}</div>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted p-1">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-8">
          {/* Listing type / URL / description */}
          <div>
            <div className="font-mono text-xs uppercase tracking-wide text-muted mb-3">Listing</div>
            <form onSubmit={saveListing} className="bg-white border border-muted/20 rounded-xl p-4 space-y-3">
              <div className="flex gap-2">
                {[
                  { value: 'sale', label: 'For sale' },
                  { value: 'rent', label: 'For rent' },
                ].map((opt) => (
                  <button
                    key={opt.value} type="button"
                    onClick={() => setListing({ ...listing, listing_type: listing.listing_type === opt.value ? '' : opt.value })}
                    className={`flex-1 text-sm rounded-lg px-3 py-2.5 border ${
                      listing.listing_type === opt.value
                        ? 'bg-navyDeep text-white border-navyDeep'
                        : 'border-muted/30 text-muted'
                    }`}
                  >{opt.label}</button>
                ))}
              </div>
              <input
                value={listing.listing_url} onChange={(e) => setListing({ ...listing, listing_url: e.target.value })}
                placeholder="Link to the listing (Property Finder, Bayut, etc.)"
                className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
              />
              {listing.listing_url && (
                <a href={listing.listing_url} target="_blank" rel="noreferrer" className="text-xs text-teal-700 underline block -mt-2">
                  Open listing ↗
                </a>
              )}
              <textarea
                value={listing.description} onChange={(e) => setListing({ ...listing, description: e.target.value })}
                placeholder="Description (used in the shared brochure)" rows={3}
                className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
              />
              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving} className="bg-navyDeep text-white text-sm rounded-lg px-4 py-2.5 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
                {saved && <span className="text-xs text-teal-700">Saved.</span>}
              </div>
            </form>
          </div>

          {/* Photos */}
          <div>
            <div className="font-mono text-xs uppercase tracking-wide text-muted mb-3">Photos</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {photos.map((p) => (
                <div key={p.name} className="relative aspect-square rounded-lg overflow-hidden border border-muted/20 group">
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
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
                      href={`https://wa.me/?text=${encodeURIComponent(`${property.title}\n${shareUrl}`)}`}
                      target="_blank" rel="noreferrer"
                      className="text-sm bg-[#25D366] text-white rounded-lg px-4 py-2.5"
                    >Send via WhatsApp</a>
                    <a
                      href={`mailto:?subject=${encodeURIComponent(property.title)}&body=${encodeURIComponent(`Here's the brochure: ${shareUrl}`)}`}
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
    </div>
  )
}
