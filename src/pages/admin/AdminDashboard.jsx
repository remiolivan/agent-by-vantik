import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import AdminSectionNav from '../../components/admin/AdminSectionNav'
import { callAdminApi } from '../../lib/adminApi'

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    callAdminApi('metrics').then(setMetrics).catch((e) => console.error('metrics failed:', e.message))
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
    <div className="bg-white border border-border rounded-md p-5 sm:p-6 mb-8">
      <h3 className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted mb-1">Système</h3>
      <p className="text-xs text-muted mb-4">
        Déclenche manuellement les jobs de rappel (normalement gérés par pg_cron). "0 envoyés" est le résultat normal s'il n'y avait rien à envoyer au moment du clic — ce n'est pas une erreur.
      </p>
      <div className="flex flex-wrap gap-3 mb-3">
        <button
          disabled={busyTarget !== null}
          onClick={() => run('send-reminders', 'Reminders (email)')}
          className="bg-mid text-white text-sm font-medium rounded-md px-3.5 py-2 disabled:opacity-50"
        >
          {busyTarget === 'send-reminders' ? 'En cours…' : 'Lancer send-reminders (email)'}
        </button>
        <button
          disabled={busyTarget !== null}
          onClick={() => run('send-due-reminders', 'Due reminders (push)')}
          className="bg-mid text-white text-sm font-medium rounded-md px-3.5 py-2 disabled:opacity-50"
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
    <div className="bg-white border border-border rounded-md p-4">
      <div className="font-mono text-[10px] uppercase tracking-wide text-muted mb-1.5">{label}</div>
      <div className={`font-display text-2xl font-medium ${accentColor}`}>{value}</div>
    </div>
  )
}
