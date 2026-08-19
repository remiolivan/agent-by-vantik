import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { formatMoney } from '../lib/format'
import PropertyDetail from '../components/PropertyDetail'

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

export default function Properties() {
  const [view, setView] = useState('board') // 'board' | 'list'
  const [stages, setStages] = useState([])
  const [properties, setProperties] = useState([])
  const [prospects, setProspects] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({
    title: '', address: '', value: '', bedrooms: '', bathrooms: '',
    property_type: 'apartment', contact_id: '',
  })

  async function load() {
    const [{ data: stagesData }, { data: propsData }, { data: prospectsData }] = await Promise.all([
      supabase.from('pipeline_stages').select('*').order('position'),
      supabase.from('properties').select('*, contacts(name)').order('created_at', { ascending: false }),
      supabase.from('contacts').select('id, name').order('name'),
    ])
    setStages(stagesData ?? [])
    setProperties(propsData ?? [])
    setProspects(prospectsData ?? [])
  }

  useEffect(() => { load() }, [])

  async function createProperty(e) {
    e.preventDefault()
    const firstStage = stages[0]
    if (!firstStage) return
    await supabase.from('properties').insert({
      title: form.title,
      address: form.address || null,
      value: form.value ? Number(form.value) : null,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
      bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
      property_type: form.property_type,
      contact_id: form.contact_id || null,
      stage_id: firstStage.id,
      org_id: firstStage.org_id,
    })
    setForm({ title: '', address: '', value: '', bedrooms: '', bathrooms: '', property_type: 'apartment', contact_id: '' })
    setShowNew(false)
    load()
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
      <input
        value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })}
        placeholder="Price" type="number" className="border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
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
        value={form.contact_id} onChange={(e) => setForm({ ...form, contact_id: e.target.value })}
        className="col-span-2 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
      >
        <option value="">No linked prospect</option>
        {prospects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div className="col-span-2 sm:col-span-3 flex gap-3 pt-1">
        <button type="submit" className="bg-navyDeep text-white text-sm rounded-lg px-4 py-2.5 flex-1 sm:flex-none">Add property</button>
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
      {showNew && newPropertyForm}

      {/* Mobile always shows board (scrollable); desktop respects the toggle */}
      <div className={`block ${view === 'list' ? 'sm:hidden' : 'sm:block'}`}>
        <div className="-mx-4 px-4 lg:mx-0 lg:px-0 overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-2">
            {stages.map((stage) => (
              <div key={stage.id} className="w-[78vw] max-w-[280px] sm:w-64 flex-shrink-0">
                <div className="font-mono text-xs uppercase tracking-wide text-muted mb-3 flex items-center justify-between">
                  <span>{stage.name}</span>
                  <span>{properties.filter((p) => p.stage_id === stage.id).length}</span>
                </div>
                <div className="space-y-3">
                  {properties.filter((p) => p.stage_id === stage.id).map((property) => (
                    <div
                      key={property.id} onClick={() => setSelected(property)}
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
                          {formatMoney(property.value, property.currency || 'USD')}
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
                        <button onClick={(e) => { e.stopPropagation(); moveProperty(property.id, -1) }} className="text-muted hover:text-ink py-1">← back</button>
                        <button onClick={(e) => { e.stopPropagation(); moveProperty(property.id, 1) }} className="text-navyDeep hover:text-teal py-1">forward →</button>
                      </div>
                    </div>
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
                    {formatMoney(p.value, p.currency || 'USD')}
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
          property={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { load() }}
        />
      )}
    </Layout>
  )
}
