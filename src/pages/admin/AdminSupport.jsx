import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import AdminSectionNav from '../../components/admin/AdminSectionNav'
import AdminTabs from '../../components/admin/AdminTabs'
import StatusBadge from '../../components/admin/StatusBadge'
import { callAdminApi } from '../../lib/adminApi'

const PLAN_OPTIONS = [
  { value: '', label: 'Tous les plans' },
  { value: 'trial', label: 'Trial' },
  { value: 'solo', label: 'Solo' },
  { value: 'team', label: 'Team' },
  { value: 'brokerage', label: 'Brokerage' },
]

const PAGE_SIZE = 25

export default function AdminSupport() {
  const [orgs, setOrgs] = useState([])
  const [total, setTotal] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [plan, setPlan] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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
    <Layout title="Admin — Support">
      <AdminSectionNav active="support" />
      <AdminTabs active="orgs" />

      <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Rechercher une organisation…"
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
          Rechercher
        </button>
      </form>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="bg-white border border-muted/20 rounded-xl overflow-hidden">
        <table className="w-full text-sm hidden md:table">
          <thead className="bg-tintBlue text-left">
            <tr>
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">Organization</th>
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">Plan</th>
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">Statut</th>
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">Membres</th>
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">Créée le</th>
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
              <div className="text-xs text-muted capitalize">{o.plan} · {o.memberCount} membre{o.memberCount === 1 ? '' : 's'}</div>
            </Link>
          ))}
        </div>

        {!loading && orgs.length === 0 && (
          <p className="text-sm text-muted text-center py-8">Aucune organisation ne correspond.</p>
        )}
        {loading && <p className="text-sm text-muted text-center py-8">Chargement…</p>}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="text-sm text-navyDeep disabled:text-muted/40">
            ← Précédent
          </button>
          <span className="text-sm text-muted">Page {page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="text-sm text-navyDeep disabled:text-muted/40">
            Suivant →
          </button>
        </div>
      )}
    </Layout>
  )
}
