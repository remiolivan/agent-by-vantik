import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { formatNumber } from '../lib/format'
import { BEDROOM_OPTIONS } from '../lib/constants'
import ProspectDetail from '../components/ProspectDetail'
import NumberInput from '../components/NumberInput'

const NEW_PROSPECT_DEFAULTS = {
  name: '', email: '', phone: '', type: 'lead',
  intent: '', budget_min: '', budget_max: '', bedrooms_wanted_list: [], locations_wanted: '',
}

export default function Prospects() {
  const [contacts, setContacts] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(NEW_PROSPECT_DEFAULTS)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState(null)
  const [selected, setSelected] = useState(null)
  const fileRef = useRef(null)

  async function load() {
    const { data } = await supabase.from('contacts').select('*, pipeline_stages(name)').order('created_at', { ascending: false })
    setContacts(data ?? [])
  }

  useEffect(() => { load() }, [])

  async function createContact(e) {
    e.preventDefault()
    const { data: membership } = await supabase.from('memberships').select('org_id').single()
    const { data: firstStage } = await supabase.from('pipeline_stages')
      .select('id').eq('org_id', membership.org_id).eq('pipeline_type', 'prospect').order('position').limit(1).single()
    await supabase.from('contacts').insert({
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      type: form.type,
      intent: form.intent || null,
      budget_min: form.budget_min === '' ? null : Number(form.budget_min),
      budget_max: form.budget_max === '' ? null : Number(form.budget_max),
      bedrooms_wanted_list: form.bedrooms_wanted_list.length > 0 ? form.bedrooms_wanted_list : null,
      locations_wanted: form.locations_wanted || null,
      org_id: membership.org_id,
      stage_id: firstStage?.id || null,
    })
    setForm(NEW_PROSPECT_DEFAULTS)
    setShowNew(false)
    load()
  }

  function toggleNewBedroom(opt) {
    setForm((f) => ({
      ...f,
      bedrooms_wanted_list: f.bedrooms_wanted_list.includes(opt)
        ? f.bedrooms_wanted_list.filter((b) => b !== opt)
        : [...f.bedrooms_wanted_list, opt],
    }))
  }

  // Expects a CSV with header row: name,email,phone,type
  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportMsg(null)
    try {
      const text = await file.text()
      const lines = text.trim().split('\n').filter(Boolean)
      const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
      const rows = lines.slice(1).map((line) => {
        const cells = line.split(',').map((c) => c.trim())
        const row = {}
        header.forEach((h, i) => { row[h] = cells[i] })
        return row
      })

      const { data: membership } = await supabase.from('memberships').select('org_id').single()
      const validTypes = ['lead', 'client', 'past_client']
      const payload = rows
        .filter((r) => r.name)
        .map((r) => ({
          org_id: membership.org_id,
          name: r.name,
          email: r.email || null,
          phone: r.phone || null,
          type: validTypes.includes(r.type) ? r.type : 'lead',
        }))

      if (payload.length === 0) {
        setImportMsg('No valid rows found. Expected header: name,email,phone,type')
      } else {
        const { error } = await supabase.from('contacts').insert(payload)
        setImportMsg(error ? `Import failed: ${error.message}` : `Imported ${payload.length} contacts.`)
        if (!error) load()
      }
    } catch (err) {
      setImportMsg(`Import failed: ${err.message}`)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Layout
      title="Prospects"
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="text-sm text-navyDeep border border-navyDeep/30 rounded-lg px-3.5 py-2.5 lg:py-2 disabled:opacity-50 whitespace-nowrap"
          >
            {importing ? 'Importing…' : 'Import CSV'}
          </button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleImport} className="hidden" />
          <button onClick={() => setShowNew(true)} className="bg-teal text-white text-sm font-medium rounded-lg px-4 py-2.5 lg:py-2 whitespace-nowrap">
            + New
          </button>
        </div>
      }
    >
      {importMsg && (
        <div className="mb-4 px-4 py-3 bg-white border border-muted/20 rounded-xl text-sm text-muted">{importMsg}</div>
      )}

      {showNew && (
        <form onSubmit={createContact} className="px-4 py-5 -mx-4 mb-6 bg-white border-y border-muted/20 sm:mx-0 sm:rounded-xl sm:border space-y-3 max-w-2xl">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Name" required className="border border-muted/30 rounded-lg px-3 py-2.5 text-sm flex-1"
            />
            <input
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email" type="email" className="border border-muted/30 rounded-lg px-3 py-2.5 text-sm flex-1"
            />
            <input
              value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Phone" className="border border-muted/30 rounded-lg px-3 py-2.5 text-sm flex-1"
            />
            <select
              value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full sm:w-auto max-w-full box-border appearance-none bg-white border border-muted/30 rounded-lg px-3 py-2.5 text-sm bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%235A6B84%22><path d=%22M5.5 7.5l4.5 4.5 4.5-4.5%22 stroke=%22%235A6B84%22 stroke-width=%221.5%22 fill=%22none%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/></svg>')] bg-no-repeat bg-[right_0.75rem_center] pr-8"
            >
              <option value="lead">Lead</option>
              <option value="client">Client</option>
              <option value="past_client">Past client</option>
            </select>
          </div>

          <div className="flex gap-2">
            {[{ value: 'buy', label: 'Buying' }, { value: 'rent', label: 'Renting' }].map((opt) => (
              <button
                key={opt.value} type="button"
                onClick={() => setForm({ ...form, intent: form.intent === opt.value ? '' : opt.value })}
                className={`flex-1 text-sm rounded-lg px-3 py-2.5 border ${
                  form.intent === opt.value ? 'bg-navyDeep text-white border-navyDeep' : 'border-muted/30 text-muted'
                }`}
              >{opt.label}</button>
            ))}
          </div>

          <div className="flex gap-3">
            <NumberInput
              value={form.budget_min} onChange={(v) => setForm({ ...form, budget_min: v })}
              placeholder="Budget min (AED)" className="flex-1 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
            />
            <NumberInput
              value={form.budget_max} onChange={(v) => setForm({ ...form, budget_max: v })}
              placeholder="Budget max (AED)" className="flex-1 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <div className="text-xs text-muted mb-1.5">Bedrooms wanted</div>
            <div className="flex flex-wrap gap-1.5">
              {BEDROOM_OPTIONS.map((opt) => (
                <button
                  key={opt} type="button" onClick={() => toggleNewBedroom(opt)}
                  className={`text-xs rounded-full px-3 py-1.5 border ${
                    form.bedrooms_wanted_list.includes(opt) ? 'bg-navyDeep text-white border-navyDeep' : 'border-muted/30 text-muted'
                  }`}
                >{opt}</button>
              ))}
            </div>
          </div>

          <input
            value={form.locations_wanted} onChange={(e) => setForm({ ...form, locations_wanted: e.target.value })}
            placeholder="Locations (e.g. Marina, JBR, Downtown)"
            className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
          />

          <div className="flex gap-3">
            <button type="submit" className="bg-navyDeep text-white text-sm rounded-lg px-4 py-2.5 flex-1 sm:flex-none">Add prospect</button>
            <button type="button" onClick={() => setShowNew(false)} className="text-sm text-muted px-2">Cancel</button>
          </div>
        </form>
      )}

      {/* Mobile: card list */}
      <div className="space-y-2 sm:hidden">
        {contacts.map((c) => (
          <button
            key={c.id} onClick={() => setSelected(c)}
            className="w-full text-left bg-white border border-muted/20 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-ink">{c.name}</span>
              <span className="text-xs text-muted capitalize bg-tintBlue rounded px-2 py-0.5">{c.type.replace('_', ' ')}</span>
            </div>
            {c.pipeline_stages?.name && (
              <div className="text-xs text-teal-700 mb-1">{c.pipeline_stages.name}</div>
            )}
            {c.email && <div className="text-xs text-muted">{c.email}</div>}
            {c.phone && <div className="text-xs text-muted">{c.phone}</div>}
            {(c.intent || c.budget_min || c.budget_max) && (
              <div className="text-xs text-teal-700 font-mono mt-1">
                {c.intent && <span className="capitalize">{c.intent}</span>}
                {(c.budget_min || c.budget_max) && (
                  <span> · {formatNumber(c.budget_min, { fallback: '' })}{c.budget_min && c.budget_max ? '–' : ''}{formatNumber(c.budget_max, { fallback: '' })}</span>
                )}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block bg-white border border-muted/20 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left font-mono text-xs uppercase tracking-wide text-muted border-b border-muted/20">
              <th className="py-3 px-4 font-normal">Name</th>
              <th className="py-3 px-4 font-normal">Email</th>
              <th className="py-3 px-4 font-normal">Phone</th>
              <th className="py-3 px-4 font-normal">Looking for</th>
              <th className="py-3 px-4 font-normal">Stage</th>
              <th className="py-3 px-4 font-normal">Type</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr
                key={c.id} onClick={() => setSelected(c)}
                className="border-b border-muted/10 last:border-0 cursor-pointer hover:bg-tintBlue/40"
              >
                <td className="py-3 px-4 text-ink">{c.name}</td>
                <td className="py-3 px-4 text-muted">{c.email || '—'}</td>
                <td className="py-3 px-4 text-muted">{c.phone || '—'}</td>
                <td className="py-3 px-4 text-muted font-mono text-xs">
                  {c.intent ? (
                    <>
                      <span className="capitalize">{c.intent}</span>
                      {(c.budget_min || c.budget_max) && (
                        <span> · {formatNumber(c.budget_min, { fallback: '' })}{c.budget_min && c.budget_max ? '–' : ''}{formatNumber(c.budget_max, { fallback: '' })}</span>
                      )}
                    </>
                  ) : '—'}
                </td>
                <td className="py-3 px-4 text-muted">{c.pipeline_stages?.name || '—'}</td>
                <td className="py-3 px-4 text-muted capitalize">{c.type.replace('_', ' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {contacts.length === 0 && (
        <p className="text-sm text-muted py-8 text-center">No prospects yet. Add one or import a CSV.</p>
      )}

      {selected && (
        <ProspectDetail
          key={selected.id}
          prospect={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { load() }}
        />
      )}
    </Layout>
  )
}
