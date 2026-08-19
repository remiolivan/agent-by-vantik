import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Contacts() {
  const [contacts, setContacts] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', type: 'lead' })
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState(null)
  const fileRef = useRef(null)

  async function load() {
    const { data } = await supabase.from('contacts').select('*').order('created_at', { ascending: false })
    setContacts(data ?? [])
  }

  useEffect(() => { load() }, [])

  async function createContact(e) {
    e.preventDefault()
    const { data: membership } = await supabase.from('memberships').select('org_id').single()
    await supabase.from('contacts').insert({ ...form, org_id: membership.org_id })
    setForm({ name: '', email: '', phone: '', type: 'lead' })
    setShowNew(false)
    load()
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
    <div className="min-h-screen bg-paper">
      <header className="border-b border-fog/20 px-8 py-5 flex items-center justify-between">
        <div className="font-display text-lg font-medium text-nightfall">Contacts</div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="text-sm text-nightfall border border-nightfall/30 rounded px-4 py-2 disabled:opacity-50"
          >
            {importing ? 'Importing…' : 'Import CSV'}
          </button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleImport} className="hidden" />
          <button onClick={() => setShowNew(true)} className="bg-teal text-white text-sm font-medium rounded px-4 py-2">
            + New contact
          </button>
        </div>
      </header>

      {importMsg && (
        <div className="px-8 py-3 bg-white border-b border-fog/20 text-sm text-fog">{importMsg}</div>
      )}

      {showNew && (
        <form onSubmit={createContact} className="flex gap-3 items-center px-8 py-4 bg-white border-b border-fog/20 flex-wrap">
          <input
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Name" required className="border border-fog/30 rounded px-3 py-2 text-sm"
          />
          <input
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Email" type="email" className="border border-fog/30 rounded px-3 py-2 text-sm"
          />
          <input
            value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Phone" className="border border-fog/30 rounded px-3 py-2 text-sm"
          />
          <select
            value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="border border-fog/30 rounded px-3 py-2 text-sm"
          >
            <option value="lead">Lead</option>
            <option value="client">Client</option>
            <option value="past_client">Past client</option>
          </select>
          <button type="submit" className="bg-nightfall text-white text-sm rounded px-4 py-2">Add</button>
          <button type="button" onClick={() => setShowNew(false)} className="text-sm text-fog">Cancel</button>
        </form>
      )}

      <main className="max-w-5xl mx-auto px-8 py-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left font-mono text-xs uppercase tracking-wide text-fog border-b border-fog/20">
              <th className="py-2 font-normal">Name</th>
              <th className="py-2 font-normal">Email</th>
              <th className="py-2 font-normal">Phone</th>
              <th className="py-2 font-normal">Type</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} className="border-b border-fog/10">
                <td className="py-3 text-ink">{c.name}</td>
                <td className="py-3 text-fog">{c.email || '—'}</td>
                <td className="py-3 text-fog">{c.phone || '—'}</td>
                <td className="py-3 text-fog capitalize">{c.type.replace('_', ' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {contacts.length === 0 && (
          <p className="text-sm text-fog py-8 text-center">No contacts yet. Add one or import a CSV.</p>
        )}
      </main>
    </div>
  )
}
