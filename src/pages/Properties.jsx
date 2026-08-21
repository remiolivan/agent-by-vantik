import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { formatMoney } from '../lib/format'
import { DEVELOPERS } from '../lib/constants'
import PropertyDetail from '../components/PropertyDetail'
import NumberInput from '../components/NumberInput'

const TYPES = ['apartment', 'villa', 'townhouse', 'land', 'commercial', 'other']
const STATUSES = {
  available: { label: 'Available', className: 'text-teal-700 bg-teal/10' },
  under_offer: { label: 'Under offer', className: 'text-amber bg-amber/10' },
  sold: { label: 'Sold', className: 'text-navyDeep bg-tintBlue' },
  rented: { label: 'Rented', className: 'text-navyDeep bg-tintBlue' },
}
const LISTING_TYPES = {
  sale: { label: 'For sale', className: 'text-navyDeep bg-tintBlue' },
  rent: { label: 'For rent', className: 'text-teal-700 bg-teal/10' },
}
const AMENITIES = [
  { key: 'has_pool', label: 'Pool' },
  { key: 'has_balcony', label: 'Balcony' },
  { key: 'is_vacant', label: 'Vacant' },
  { key: 'has_gym', label: 'Gym' },
]
const NEW_PROPERTY_DEFAULTS = {
  title: '', address: '', value: '', bedrooms: '', bathrooms: '',
  property_type: 'apartment', contact_id: '', listing_type: '', developer: '',
  furnished: '', completion_status: '', has_pool: false, has_balcony: false,
  is_vacant: false, has_gym: false, description: '', listing_url: '',
}

export default function Properties() {
  const [view, setView] = useState('board') // 'board' | 'list'
  const [mobileStageIdx, setMobileStageIdx] = useState(0)
  const [stages, setStages] = useState([])
  const [properties, setProperties] = useState([])
  const [prospects, setProspects] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(NEW_PROPERTY_DEFAULTS)
  const [loadError, setLoadError] = useState(null)
  const [creating, setCreating] = useState(false)

  async function load() {
    setLoadError(null)
    const [{ data: stagesData, error: stagesErr }, { data: propsData, error: propsErr }, { data: prospectsData }] = await Promise.all([
      supabase.from('pipeline_stages').select('*').eq('pipeline_type', 'property').order('position'),
      // contacts!contact_id disambiguates: `properties` now has two FKs to
      // `contacts` (contact_id, and owner_contact_id added for the property
      // owner field) — without the hint PostgREST can't pick one and the
      // whole query 500s with "more than one relationship was found".
      supabase.from('properties').select('*, contacts!contact_id(name)').order('created_at', { ascending: false }),
      supabase.from('contacts').select('id, name').order('name'),
    ])
    // Supabase doesn't throw on failure — it returns { data: null, error }.
    // Ignoring `error` here meant a transient network/auth hiccup silently
    // left the board empty with zero indication anything went wrong, which
    // looked exactly like "all my properties disappeared".
    if (stagesErr || propsErr) {
      setLoadError((propsErr || stagesErr).message)
      return
    }
    setStages(stagesData ?? [])
    setProperties(propsData ?? [])
    setProspects(prospectsData ?? [])
  }

  useEffect(() => { load() }, [])

  async function createProperty(e) {
    e.preventDefault()
    if (creating) return
    const firstStage = stages[0]
    if (!firstStage) return
    setCreating(true)
    const { data: inserted } = await supabase.from('properties').insert({
      title: form.title,
      address: form.address || null,
      value: form.value ? Number(form.value) : null,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
      bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
      property_type: form.property_type,
      contact_id: form.contact_id || null,
      listing_type: form.listing_type || null,
      developer: form.developer || null,
      furnished: form.furnished || null,
      completion_status: form.completion_status || null,
      has_pool: form.has_pool,
      has_balcony: form.has_balcony,
      is_vacant: form.is_vacant,
      has_gym: form.has_gym,
      description: form.description || null,
      listing_url: form.listing_url || null,
      stage_id: firstStage.id,
      org_id: firstStage.org_id,
    }).select().single()
    setForm(NEW_PROPERTY_DEFAULTS)
    setShowNew(false)
    setCreating(false)
    await load()
    // Open it straight away so photos/documents (e.g. title deed) can be
    // added as part of setup, rather than requiring a separate visit later.
    if (inserted) setSelected(inserted)
  }

  async function moveProperty(propertyId, direction) {
    const property = properties.find((p) => p.id === propertyId)
    const idx = stages.findIndex((s) => s.id === property.stage_id)
    const nextIdx = idx + direction
    if (nextIdx < 0 || nextIdx >= stages.length) return
    const nextStage = stages[nextIdx]
    await supabase.from('properties').update({
      stage_id: nextStage.id,
      closed_at: nextStage.is_won || nextStage.is_lost ? new Date().toISOString() : null,
    }).eq('id', propertyId)
    load()
  }

  async function setStatus(propertyId, status) {
    await supabase.from('properties').update({ status }).eq('id', propertyId)
    load()
  }

  const newPropertyForm = (
    <form onSubmit={createProperty} className="px-4 py-5 -mx-4 mb-6 bg-white border-y border-muted/20 sm:mx-0 sm:rounded-xl sm:border grid grid-cols-2 sm:grid-cols-3 gap-3">
      <input
        value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder="Title (e.g. 2BR Marina)" required
        className="col-span-2 sm:col-span-3 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
      />
      <input
        value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
        placeholder="Address" className="col-span-2 sm:col-span-3 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
      />
      <NumberInput
        value={form.value} onChange={(v) => setForm({ ...form, value: v })}
        placeholder="Price" className="border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
      />
      <input
        value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })}
        placeholder="Beds" type="number" className="border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
      />
      <input
        value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })}
        placeholder="Baths" type="number" className="border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
      />
      <select
        value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value })}
        className="border border-muted/30 rounded-lg px-3 py-2.5 text-sm capitalize"
      >
        {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <select
        value={form.developer} onChange={(e) => setForm({ ...form, developer: e.target.value })}
        className="border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
      >
        <option value="">Developer</option>
        {DEVELOPERS.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <select
        value={form.contact_id} onChange={(e) => setForm({ ...form, contact_id: e.target.value })}
        className="col-span-2 sm:col-span-1 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
      >
        <option value="">No linked prospect</option>
        {prospects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <div className="col-span-2 sm:col-span-3 flex gap-2">
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
      <div className="col-span-2 sm:col-span-3 flex gap-2">
        {[{ value: 'furnished', label: 'Furnished' }, { value: 'unfurnished', label: 'Unfurnished' }].map((opt) => (
          <button
            key={opt.value} type="button"
            onClick={() => setForm({ ...form, furnished: form.furnished === opt.value ? '' : opt.value })}
            className={`flex-1 text-sm rounded-lg px-3 py-2.5 border ${
              form.furnished === opt.value ? 'bg-navyDeep text-white border-navyDeep' : 'border-muted/30 text-muted'
            }`}
          >{opt.label}</button>
        ))}
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
      <div className="col-span-2 sm:col-span-3 flex flex-wrap gap-1.5">
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
      <input
        value={form.listing_url} onChange={(e) => setForm({ ...form, listing_url: e.target.value })}
        placeholder="Link to the listing (Property Finder, Bayut, etc.)"
        className="col-span-2 sm:col-span-3 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
      />
      <textarea
        value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
        placeholder="Description (used in the shared brochure)" rows={2}
        className="col-span-2 sm:col-span-3 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
      />
      <div className="col-span-2 sm:col-span-3 flex gap-3 pt-1">
        <button type="submit" disabled={creating} className="bg-navyDeep text-white text-sm rounded-lg px-4 py-2.5 flex-1 sm:flex-none disabled:opacity-50">
          {creating ? 'Adding…' : 'Add property'}
        </button>
        <button type="button" onClick={() => setShowNew(false)} className="text-sm text-muted px-2">Cancel</button>
      </div>
    </form>
  )

  return (
    <Layout
      title="Properties"
      action={
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex bg-white border border-muted/20 rounded-lg p-0.5">
            <button
              onClick={() => setView('board')}
              className={`text-xs px-3 py-1.5 rounded-md ${view === 'board' ? 'bg-navyDeep text-white' : 'text-muted'}`}
            >Board</button>
            <button
              onClick={() => setView('list')}
              className={`text-xs px-3 py-1.5 rounded-md ${view === 'list' ? 'bg-navyDeep text-white' : 'text-muted'}`}
            >List</button>
          </div>
          <button onClick={() => setShowNew(true)} className="bg-teal text-white text-sm font-medium rounded-lg px-4 py-2.5 lg:py-2 whitespace-nowrap">
            + New property
          </button>
        </div>
      }
    >
      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4 flex items-center justify-between gap-3">
          <span>Couldn't load your properties: {loadError}</span>
          <button onClick={load} className="underline whitespace-nowrap shrink-0">Retry</button>
        </div>
      )}

      {showNew && newPropertyForm}

      {/* Mobile: stage tabs + vertical card list (no horizontal scrolling funnel) */}
      <div className="sm:hidden">
        <div className="-mx-4 px-4 overflow-x-auto mb-4">
          <div className="flex gap-2 min-w-max pb-1">
            {stages.map((stage, idx) => (
              <button
                key={stage.id}
                onClick={() => setMobileStageIdx(idx)}
                className={`text-xs rounded-full px-3 py-1.5 whitespace-nowrap border ${
                  idx === mobileStageIdx ? 'bg-navyDeep text-white border-navyDeep' : 'border-muted/30 text-muted'
                }`}
              >
                {stage.name} · {properties.filter((p) => p.stage_id === stage.id).length}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {stages[mobileStageIdx] && properties.filter((p) => p.stage_id === stages[mobileStageIdx].id).map((property) => (
            <PropertyCard key={property.id} property={property} onSelect={setSelected} onMove={moveProperty} />
          ))}
          {stages[mobileStageIdx] && properties.filter((p) => p.stage_id === stages[mobileStageIdx].id).length === 0 && (
            <p className="text-sm text-muted text-center py-8">No properties in this stage.</p>
          )}
        </div>
      </div>

      {/* Desktop board (horizontal funnel) */}
      <div className={`hidden ${view === 'list' ? 'sm:hidden' : 'sm:block'}`}>
        <div className="lg:mx-0 lg:px-0 overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-2">
            {stages.map((stage) => (
              <div key={stage.id} className="w-64 flex-shrink-0">
                <div className="font-mono text-xs uppercase tracking-wide text-muted mb-3 flex items-center justify-between">
                  <span>{stage.name}</span>
                  <span>{properties.filter((p) => p.stage_id === stage.id).length}</span>
                </div>
                <div className="space-y-3">
                  {properties.filter((p) => p.stage_id === stage.id).map((property) => (
                    <PropertyCard key={property.id} property={property} onSelect={setSelected} onMove={moveProperty} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop list view */}
      <div className={`hidden ${view === 'list' ? 'sm:block' : 'sm:hidden'}`}>
        <div className="bg-white border border-muted/20 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left font-mono text-xs uppercase tracking-wide text-muted border-b border-muted/20">
                <th className="py-3 px-4 font-normal">Property</th>
                <th className="py-3 px-4 font-normal">Type</th>
                <th className="py-3 px-4 font-normal">Listing</th>
                <th className="py-3 px-4 font-normal">Price</th>
                <th className="py-3 px-4 font-normal">Prospect</th>
                <th className="py-3 px-4 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr
                  key={p.id} onClick={() => setSelected(p)}
                  className="border-b border-muted/10 last:border-0 cursor-pointer hover:bg-tintBlue/40"
                >
                  <td className="py-3 px-4 text-ink">
                    <div>{p.title}</div>
                    {p.address && <div className="text-xs text-muted">{p.address}</div>}
                  </td>
                  <td className="py-3 px-4 text-muted capitalize">{p.property_type}</td>
                  <td className="py-3 px-4">
                    {p.listing_type ? (
                      <span className={`text-[10px] rounded px-1.5 py-0.5 font-mono uppercase ${LISTING_TYPES[p.listing_type].className}`}>
                        {LISTING_TYPES[p.listing_type].label}
                      </span>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="py-3 px-4 text-muted font-mono text-xs">
                    {formatMoney(p.value, p.currency || 'AED')}
                  </td>
                  <td className="py-3 px-4 text-muted">{p.contacts?.name || '—'}</td>
                  <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={p.status || 'available'}
                      onChange={(e) => setStatus(p.id, e.target.value)}
                      className={`text-xs rounded px-2 py-1 border-0 ${STATUSES[p.status || 'available']?.className}`}
                    >
                      {Object.entries(STATUSES).map(([key, s]) => (
                        <option key={key} value={key}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {properties.length === 0 && <p className="text-sm text-muted py-8 text-center">No properties yet.</p>}
      </div>

      {selected && (
        <PropertyDetail
          key={selected.id}
          property={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { load() }}
        />
      )}
    </Layout>
  )
}

function PropertyCard({ property, onSelect, onMove }) {
  return (
    <div
      onClick={() => onSelect(property)}
      className="bg-white border border-muted/20 rounded-xl p-4 cursor-pointer hover:border-navyDeep/30"
    >
      <div className="flex items-start justify-between gap-2 mb-0.5">
        <div className="text-sm font-medium text-ink">{property.title}</div>
        {property.listing_type && (
          <span className={`text-[10px] shrink-0 rounded px-1.5 py-0.5 font-mono uppercase ${LISTING_TYPES[property.listing_type].className}`}>
            {LISTING_TYPES[property.listing_type].label}
          </span>
        )}
      </div>
      {property.address && <div className="text-xs text-muted mb-1">{property.address}</div>}
      {property.value && (
        <div className="font-mono text-xs text-muted mb-1">
          {formatMoney(property.value, property.currency || 'AED')}
        </div>
      )}
      <div className="flex items-center gap-2 text-xs text-muted mb-3">
        {(property.bedrooms || property.bathrooms) && (
          <span>{property.bedrooms ?? '–'} bd · {property.bathrooms ?? '–'} ba</span>
        )}
        <span className="capitalize">{property.property_type}</span>
      </div>
      {property.contacts?.name && (
        <div className="text-xs text-navyDeep bg-tintBlue rounded px-2 py-1 mb-3 inline-block">
          {property.contacts.name}
        </div>
      )}
      {property.listing_url && (
        <a
          href={property.listing_url} target="_blank" rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="block text-xs text-teal-700 underline mb-3"
        >View listing ↗</a>
      )}
      <div className="flex justify-between text-xs">
        <button onClick={(e) => { e.stopPropagation(); onMove(property.id, -1) }} className="text-muted hover:text-ink py-1">← back</button>
        <button onClick={(e) => { e.stopPropagation(); onMove(property.id, 1) }} className="text-navyDeep hover:text-teal py-1">forward →</button>
      </div>
    </div>
  )
}
