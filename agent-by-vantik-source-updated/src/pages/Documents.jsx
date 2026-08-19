import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Documents() {
  const [documents, setDocuments] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [type, setType] = useState('proposal')
  const [title, setTitle] = useState('')
  const [items, setItems] = useState([{ description: '', amount: '' }])
  const [notes, setNotes] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  async function load() {
    const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false })
    setDocuments(data ?? [])
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
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const { data, error } = await supabase.functions.invoke('generate-document', {
      body: { type, title, items, notes },
      headers: { Authorization: `Bearer ${token}` },
    })
    setGenerating(false)
    if (error || data?.error) return setError(data?.error || error.message)
    setShowNew(false)
    setTitle(''); setItems([{ description: '', amount: '' }]); setNotes('')
    load()
  }

  return (
    <Layout
      title="Documents"
      action={
        <button onClick={() => setShowNew(true)} className="bg-teal text-white text-sm font-medium rounded-lg px-4 py-2.5 lg:py-2 whitespace-nowrap">
          + New
        </button>
      }
    >
      {showNew && (
        <form onSubmit={generate} className="px-4 py-6 -mx-4 mb-6 bg-white border-y border-muted/20 sm:mx-0 sm:rounded-xl sm:border max-w-2xl">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <select value={type} onChange={(e) => setType(e.target.value)} className="border border-muted/30 rounded-lg px-3 py-2.5 text-sm">
              <option value="proposal">Proposal</option>
              <option value="invoice">Invoice</option>
            </select>
            <input
              value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Title" className="flex-1 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>

          {items.map((item, idx) => (
            <div key={idx} className="flex gap-3 mb-2">
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
          <button type="button" onClick={addItem} className="text-sm text-navyDeep underline mb-4">+ Add line item</button>

          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)" rows={2}
            className="w-full border border-muted/30 rounded-lg px-3 py-2.5 text-sm mb-4"
          />

          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={generating} className="bg-navyDeep text-white text-sm rounded-lg px-4 py-2.5 disabled:opacity-50 flex-1 sm:flex-none">
              {generating ? 'Generating…' : 'Generate PDF'}
            </button>
            <button type="button" onClick={() => setShowNew(false)} className="text-sm text-muted px-2">Cancel</button>
          </div>
        </form>
      )}

      <div className="max-w-2xl">
        {/* Mobile: card list */}
        <div className="space-y-2 sm:hidden">
          {documents.map((d) => (
            <div key={d.id} className="bg-white border border-muted/20 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-ink capitalize">{d.type}</div>
                <div className="text-xs text-muted font-mono">{new Date(d.generated_at || d.created_at).toLocaleString()}</div>
              </div>
              <a href={d.file_url} download={`${d.type}.pdf`} className="text-navyDeep underline text-xs shrink-0">Download</a>
            </div>
          ))}
        </div>

        {/* Desktop: table */}
        <div className="hidden sm:block bg-white border border-muted/20 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left font-mono text-xs uppercase tracking-wide text-muted border-b border-muted/20">
                <th className="py-3 px-4 font-normal">Type</th>
                <th className="py-3 px-4 font-normal">Generated</th>
                <th className="py-3 px-4 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} className="border-b border-muted/10 last:border-0">
                  <td className="py-3 px-4 text-ink capitalize">{d.type}</td>
                  <td className="py-3 px-4 text-muted font-mono text-xs">{new Date(d.generated_at || d.created_at).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right">
                    <a href={d.file_url} download={`${d.type}.pdf`} className="text-navyDeep underline text-xs">Download</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {documents.length === 0 && <p className="text-sm text-muted text-center py-8">No documents yet.</p>}
      </div>
    </Layout>
  )
}
