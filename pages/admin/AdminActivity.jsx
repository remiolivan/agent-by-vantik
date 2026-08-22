import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import AdminTabs from '../../components/admin/AdminTabs'
import { callAdminApi } from '../../lib/adminApi'

const PAGE_SIZE = 30

export default function AdminActivity() {
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    callAdminApi('list_activity', { page, pageSize: PAGE_SIZE })
      .then((data) => {
        if (cancelled) return
        setEntries(data.entries)
        setTotal(data.total)
      })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <Layout title="Admin">
      <AdminTabs active="activity" />

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="bg-white border border-muted/20 rounded-xl divide-y divide-muted/10">
        {entries.map((e) => (
          <div key={e.id} className="px-4 py-3 text-sm">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-ink font-medium">{e.action}</span>
              <span className="text-xs text-muted">{new Date(e.created_at).toLocaleString()}</span>
            </div>
            <div className="text-xs text-muted mt-0.5">
              {e.admin_email}
              {e.target_org_id && (
                <> · <Link to={`/admin/orgs/${e.target_org_id}`} className="text-navyDeep hover:underline">view org</Link></>
              )}
            </div>
          </div>
        ))}
        {!loading && entries.length === 0 && (
          <p className="text-sm text-muted text-center py-8">No admin actions logged yet.</p>
        )}
        {loading && <p className="text-sm text-muted text-center py-8">Loading…</p>}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="text-sm text-navyDeep disabled:text-muted/40">
            ← Previous
          </button>
          <span className="text-sm text-muted">Page {page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="text-sm text-navyDeep disabled:text-muted/40">
            Next →
          </button>
        </div>
      )}
    </Layout>
  )
}
