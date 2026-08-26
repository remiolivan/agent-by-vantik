import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import AdminSectionNav from '../../components/admin/AdminSectionNav'
import AdminTabs from '../../components/admin/AdminTabs'
import StatusBadge from '../../components/admin/StatusBadge'
import { callAdminApi } from '../../lib/adminApi'

export default function AdminBilling() {
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    callAdminApi('list_orgs', { page: 1, pageSize: 100 })
      .then((data) => setOrgs(data.orgs))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Layout title="Admin — Support">
      <AdminSectionNav active="support" />
      <AdminTabs active="billing" />

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="bg-white border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm hidden md:table">
          <thead className="bg-mid/10 text-left">
            <tr>
              <th className="px-4 py-3 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">Organization</th>
              <th className="px-4 py-3 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">Plan</th>
              <th className="px-4 py-3 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">Subscription</th>
              <th className="px-4 py-3 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">Renouvelle / se termine</th>
              <th className="px-4 py-3 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">Stripe</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} className="border-t border-border hover:bg-mid/10">
                <td className="px-4 py-3">
                  <Link to={`/admin/orgs/${o.id}`} className="text-navyDeep font-medium hover:underline">{o.name}</Link>
                </td>
                <td className="px-4 py-3 text-ink capitalize">{o.plan}</td>
                <td className="px-4 py-3">
                  {o.subscription ? <StatusBadge status={o.subscription.status} /> : <span className="text-xs text-muted">Aucun abonnement</span>}
                  {o.subscription?.cancel_at_period_end && <span className="text-xs text-coral ml-2">Annule en fin de période</span>}
                </td>
                <td className="px-4 py-3 text-muted">{o.subscription?.current_period_end ? new Date(o.subscription.current_period_end).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3 text-muted">{o.hasStripeCustomer ? 'Lié' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="md:hidden divide-y divide-muted/10">
          {orgs.map((o) => (
            <Link key={o.id} to={`/admin/orgs/${o.id}`} className="block px-4 py-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-navyDeep font-medium text-sm">{o.name}</span>
                {o.subscription ? <StatusBadge status={o.subscription.status} /> : <span className="text-xs text-muted">Aucun abo</span>}
              </div>
              <div className="text-xs text-muted capitalize">
                {o.plan} · renouvelle {o.subscription?.current_period_end ? new Date(o.subscription.current_period_end).toLocaleDateString() : '—'}
              </div>
            </Link>
          ))}
        </div>

        {!loading && orgs.length === 0 && <p className="text-sm text-muted text-center py-8">Aucune organisation.</p>}
        {loading && <p className="text-sm text-muted text-center py-8">Chargement…</p>}
      </div>
    </Layout>
  )
}
