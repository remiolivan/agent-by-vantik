import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Deals() {
  const [stages, setStages] = useState([])
  const [deals, setDeals] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newValue, setNewValue] = useState('')

  async function load() {
    const [{ data: stagesData }, { data: dealsData }] = await Promise.all([
      supabase.from('pipeline_stages').select('*').order('position'),
      supabase.from('deals').select('*').order('created_at', { ascending: false }),
    ])
    setStages(stagesData ?? [])
    setDeals(dealsData ?? [])
  }

  useEffect(() => { load() }, [])

  async function createDeal(e) {
    e.preventDefault()
    const firstStage = stages[0]
    if (!firstStage) return
    await supabase.from('deals').insert({
      title: newTitle,
      value: newValue ? Number(newValue) : null,
      stage_id: firstStage.id,
      org_id: firstStage.org_id,
    })
    setNewTitle(''); setNewValue(''); setShowNew(false)
    load()
  }

  async function moveDeal(dealId, direction) {
    const deal = deals.find((d) => d.id === dealId)
    const idx = stages.findIndex((s) => s.id === deal.stage_id)
    const nextIdx = idx + direction
    if (nextIdx < 0 || nextIdx >= stages.length) return
    const nextStage = stages[nextIdx]
    await supabase.from('deals').update({
      stage_id: nextStage.id,
      closed_at: nextStage.is_won || nextStage.is_lost ? new Date().toISOString() : null,
    }).eq('id', dealId)
    load()
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-muted/20 px-8 py-5 flex items-center justify-between">
        <div className="font-display text-lg font-medium text-navyDeep">Pipeline</div>
        <button
          onClick={() => setShowNew(true)}
          className="bg-teal text-white text-sm font-medium rounded px-4 py-2"
        >
          + New deal
        </button>
      </header>

      {showNew && (
        <form onSubmit={createDeal} className="flex gap-3 items-center px-8 py-4 bg-white border-b border-muted/20">
          <input
            value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Deal title" required
            className="border border-muted/30 rounded px-3 py-2 text-sm flex-1"
          />
          <input
            value={newValue} onChange={(e) => setNewValue(e.target.value)}
            placeholder="Value" type="number"
            className="border border-muted/30 rounded px-3 py-2 text-sm w-32"
          />
          <button type="submit" className="bg-navyDeep text-white text-sm rounded px-4 py-2">Add</button>
          <button type="button" onClick={() => setShowNew(false)} className="text-sm text-muted">Cancel</button>
        </form>
      )}

      <main className="px-8 py-8 overflow-x-auto">
        <div className="flex gap-4 min-w-max">
          {stages.map((stage) => (
            <div key={stage.id} className="w-64 flex-shrink-0">
              <div className="font-mono text-xs uppercase tracking-wide text-muted mb-3 flex items-center justify-between">
                <span>{stage.name}</span>
                <span>{deals.filter((d) => d.stage_id === stage.id).length}</span>
              </div>
              <div className="space-y-3">
                {deals.filter((d) => d.stage_id === stage.id).map((deal) => (
                  <div key={deal.id} className="bg-white border border-muted/20 rounded p-4">
                    <div className="text-sm font-medium text-ink mb-1">{deal.title}</div>
                    {deal.value && (
                      <div className="font-mono text-xs text-muted mb-3">
                        {deal.currency} {Number(deal.value).toLocaleString()}
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <button onClick={() => moveDeal(deal.id, -1)} className="text-muted hover:text-ink">← back</button>
                      <button onClick={() => moveDeal(deal.id, 1)} className="text-navyDeep hover:text-teal">forward →</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
