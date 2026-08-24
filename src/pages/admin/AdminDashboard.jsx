import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import AdminSectionNav from '../../components/admin/AdminSectionNav'
import StatusBadge from '../../components/admin/StatusBadge'
import { callAdminApi } from '../../lib/adminApi'

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState(null)
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    callAdminApi('metrics').then(setMetrics).catch((e) => console.error('metrics failed:', e.message))
    callAdminApi('list_orgs', { page: 1, pageSize: 100 })
      .then((data) => setOrgs(data.orgs))
      .catch((e) => console.error('list_orgs failed:', e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Layout title="Admin — KPIs">
      <AdminSectionNav active="kpis" />

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

      <div className="bg-white border border-muted/20 rounded-xl overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-muted/10">
          <h3 className="font-mono text-xs uppercase tracking-wide text-muted">Billing</h3>
        </div>
        <table className="w-full text-sm hidden md:table">
          <thead className="bg-tintBlue text-left">
            <tr>
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">Organization</th>
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">Plan</th>
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">Subscription</th>
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">Renouvelle / se termine</th>
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">Stripe</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} className="border-t border-muted/10 hover:bg-tintBlue/40">
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
      </div>

      <SystemCard />
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
      setResult(
        `${label} : ${sent} envoyé${sent === 1 ? '' : 's'}${errCount ? `, ${errCount} erreur${errCount === 1 ? '' : 's'}` : ''}. ` +
        (sent === 0 && !errCount ? "0 est normal si rien n'était dû à ce moment précis." : '')
      )
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
        Déclenche manuellement les jobs de rappel (normalement gérés par pg_cron). "0 envoyés" est le résultat normal s'il n'y avait rien à envoyer au moment du clic — ce n'est pas une erreur.
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
