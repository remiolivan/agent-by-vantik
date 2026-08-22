import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import AdminTabs from '../../components/admin/AdminTabs'
import StatusBadge from '../../components/admin/StatusBadge'
import { callAdminApi } from '../../lib/adminApi'

const PLAN_OPTIONS = [
  { value: '', label: 'All plans' },
  { value: 'trial', label: 'Trial' },
  { value: 'solo', label: 'Solo' },
  { value: 'team', label: 'Team' },
  { value: 'brokerage', label: 'Brokerage' },
]

const PAGE_SIZE = 25

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState(null)
  const [orgs, setOrgs] = useState([])
  const [total, setTotal] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [plan, setPlan] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    callAdminApi('metrics').then(setMetrics).catch((e) => console.error('metrics failed:', e.message))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    callAdminApi('list_orgs', { search, plan: plan || null, page, pageSize: PAGE_SIZE })
      .then((data) => {
        if (cancelled) return
        setOrgs(data.orgs)
        setTotal(data.total)
      })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [search, plan, page])

  function handleSearchSubmit(e) {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <Layout title="Admin">
      <AdminTabs active="dashboard" />

      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard label="MRR (est.)" value={`$${metrics.mrrUsd.toLocaleString()}`} />
          <MetricCard label="Active" value={metrics.active} accent="teal" />
          <MetricCard label="Trialing" value={metrics.trialing} />
          <MetricCard label="Trials expiring ≤3d" value={metrics.trialsExpiringSoon} accent={metrics.trialsExpiringSoon > 0 ? 'amber' : undefined} />
          <MetricCard label="Trial expired" value={metrics.trialExpired} />
          <MetricCard label="Suspended" value={metrics.suspended} accent={metrics.suspended > 0 ? 'coral' : undefined} />
          <MetricCard label="Comped" value={metrics.comped} />
          <MetricCard label="Signups (7d)" value={metrics.signups7d} />
        </div>
      )}

      <SystemCard />

      <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by organization name…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="flex-1 border border-muted/30 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-navyDeep"
        />
        <select
          value={plan}
          onChange={(e) => { setPlan(e.target.value); setPage(1) }}
          className="border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
        >
          {PLAN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button type="submit" className="bg-navyDeep text-white text-sm rounded-lg px-4 py-2.5 whitespace-nowrap">
          Search
        </button>
      </form>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="bg-white border border-muted/20 rounded-xl overflow-hidden">
        <table className="w-full text-sm hidden md:table">
          <thead className="bg-tintBlue text-left">
            <tr>
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">Organization</th>
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">Plan</th>
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">Status</th>
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">Members</th>
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">Created</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} className="border-t border-muted/10 hover:bg-tintBlue/40">
                <td className="px-4 py-3">
                  <Link to={`/admin/orgs/${o.id}`} className="text-navyDeep font-medium hover:underline">{o.name}</Link>
                </td>
                <td className="px-4 py-3 text-ink capitalize">{o.plan}</td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-3 text-ink">{o.memberCount}</td>
                <td className="px-4 py-3 text-muted">{new Date(o.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="md:hidden divide-y divide-muted/10">
          {orgs.map((o) => (
            <Link key={o.id} to={`/admin/orgs/${o.id}`} className="block px-4 py-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-navyDeep font-medium text-sm">{o.name}</span>
                <StatusBadge status={o.status} />
              </div>
              <div className="text-xs text-muted capitalize">{o.plan} · {o.memberCount} member{o.memberCount === 1 ? '' : 's'}</div>
            </Link>
          ))}
        </div>

        {!loading && orgs.length === 0 && (
          <p className="text-sm text-muted text-center py-8">No organizations match.</p>
        )}
        {loading && <p className="text-sm text-muted text-center py-8">Loading…</p>}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="text-sm text-navyDeep disabled:text-muted/40"
          >
            ← Previous
          </button>
          <span className="text-sm text-muted">Page {page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="text-sm text-navyDeep disabled:text-muted/40"
          >
            Next →
          </button>
        </div>
      )}
    </Layout>
  )
}

function SystemCard() {
  const [busyTarget, setBusyTarget] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function run(target, label) {
    setBusyTarget(target)
    setResult(null)
    setError(null)
    try {
      const data = await callAdminApi('trigger_reminders', { target })
      const sent = data.result?.sent ?? 0
      const errCount = Array.isArray(data.result?.errors) ? data.result.errors.length : 0
      setResult(`${label} : ${sent} envoyé${sent === 1 ? '' : 's'}${errCount ? `, ${errCount} erreur${errCount === 1 ? '' : 's'}` : ''}.`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyTarget(null)
    }
  }

  return (
    <div className="bg-white border border-muted/20 rounded-xl p-5 sm:p-6 mb-8">
      <h3 className="font-mono text-xs uppercase tracking-wide text-muted mb-1">Système</h3>
      <p className="text-xs text-muted mb-4">
        Déclenche manuellement les jobs de rappel (normalement gérés par pg_cron). Utile pour tester ou rattraper un envoi manqué.
      </p>
      <div className="flex flex-wrap gap-3 mb-3">
        <button
          disabled={busyTarget !== null}
          onClick={() => run('send-reminders', 'Reminders (email)')}
          className="bg-navyDeep text-white text-sm rounded-lg px-3.5 py-2 disabled:opacity-50"
        >
          {busyTarget === 'send-reminders' ? 'En cours…' : 'Lancer send-reminders (email)'}
        </button>
        <button
          disabled={busyTarget !== null}
          onClick={() => run('send-due-reminders', 'Due reminders (push)')}
          className="bg-navyDeep text-white text-sm rounded-lg px-3.5 py-2 disabled:opacity-50"
        >
          {busyTarget === 'send-due-reminders' ? 'En cours…' : 'Lancer send-due-reminders (push)'}
        </button>
      </div>
      {result && <p className="text-sm text-tealDark">{result}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

function MetricCard({ label, value, accent }) {
  const accentColor =
    accent === 'teal' ? 'text-tealDark' :
    accent === 'coral' ? 'text-coral' :
    accent === 'amber' ? 'text-amber' :
    'text-navyDeep'
  return (
    <div className="bg-white border border-muted/20 rounded-xl p-4">
      <div className="font-mono text-[10px] uppercase tracking-wide text-muted mb-1.5">{label}</div>
      <div className={`font-display text-2xl font-medium ${accentColor}`}>{value}</div>
    </div>
  )
}
