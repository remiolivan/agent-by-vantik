import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import StatusBadge from '../../components/admin/StatusBadge'
import { callAdminApi } from '../../lib/adminApi'

const PLAN_OPTIONS = ['trial', 'solo', 'team', 'brokerage']

function deriveStatus(org) {
  if (org.suspended_at) return 'suspended'
  if (org.is_comped) return 'comped'
  const sub = org.subscriptions?.[0]
  if (sub?.status === 'active') return 'active'
  if (sub?.status) return sub.status
  if (org.trial_ends_at && new Date(org.trial_ends_at) > new Date()) return 'trialing'
  return 'trial_expired'
}

export default function AdminOrgDetail() {
  const { orgId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  const [extendDays, setExtendDays] = useState(14)
  const [newPlan, setNewPlan] = useState('')
  const [suspendReason, setSuspendReason] = useState('')
  const [inviteLinks, setInviteLinks] = useState({})
  const [exportingEntity, setExportingEntity] = useState(null)
  const [aiProblem, setAiProblem] = useState('')
  const [aiDiagnosis, setAiDiagnosis] = useState(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [orgErrors, setOrgErrors] = useState([])
  const [errorsLoading, setErrorsLoading] = useState(true)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const d = await callAdminApi('get_org', { orgId })
      setData(d)
      setNewPlan(d.org.plan)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    setErrorsLoading(true)
    callAdminApi('list_org_errors', { orgId, pageSize: 20 })
      .then((data) => setOrgErrors(data.errors))
      .catch((e) => console.error('list_org_errors failed:', e.message))
      .finally(() => setErrorsLoading(false))
  }, [orgId])

  async function runAction(action, payload, successMessage) {
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      await callAdminApi(action, { orgId, ...payload })
      setNotice(successMessage)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleResendInvite(membershipId) {
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      await callAdminApi('resend_invite', { membershipId })
      setNotice('Invite resent.')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleGetInviteLink(membershipId) {
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      const data = await callAdminApi('get_invite_link', { membershipId })
      if (data.link) {
        setInviteLinks((prev) => ({ ...prev, [membershipId]: data.link }))
        try {
          await navigator.clipboard.writeText(data.link)
          setNotice('Lien copié dans le presse-papier — colle-le où tu veux (WhatsApp, SMS…).')
        } catch {
          setNotice('Lien généré (affiché ci-dessous) — copie-le manuellement.')
        }
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleExportCsv(entity) {
    setExportingEntity(entity)
    setError(null)
    try {
      const data = await callAdminApi('export_org_csv', { orgId, entity })
      const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setNotice(`Export ${entity} : ${data.rowCount} ligne${data.rowCount === 1 ? '' : 's'}.`)
    } catch (e) {
      setError(e.message)
    } finally {
      setExportingEntity(null)
    }
  }

  async function handleAiDiagnose(e) {
    e.preventDefault()
    if (!aiProblem.trim()) return
    setAiBusy(true)
    setAiDiagnosis(null)
    setAiError(null)
    try {
      const data = await callAdminApi('ai_diagnose', { orgId, problem: aiProblem.trim() })
      setAiDiagnosis(data.diagnosis)
    } catch (err) {
      setAiError(err.message)
    } finally {
      setAiBusy(false)
    }
  }

  async function handleResetPassword(email) {
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      await callAdminApi('reset_password', { email })
      setNotice(`Password reset email sent to ${email}.`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <Layout title="Admin"><p className="text-sm text-muted">Loading…</p></Layout>
  }
  if (error && !data) {
    return (
      <Layout title="Admin">
        <Link to="/admin/support" className="text-sm text-muted hover:text-navyDeep mb-6 inline-block">← Toutes les organisations</Link>
        <p className="text-sm text-red-600">{error}</p>
      </Layout>
    )
  }
  if (!data) return null

  const { org, members, counts, recentActivity } = data
  const status = deriveStatus(org)

  return (
    <Layout title={org.name}>
      <Link to="/admin" className="text-sm text-muted hover:text-navyDeep mb-6 inline-block">← All organizations</Link>

      {notice && <p className="text-sm text-tealDark mb-4">{notice}</p>}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white border border-border rounded-md p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <h2 className="font-display text-lg font-medium text-navyDeep">{org.name}</h2>
            <StatusBadge status={status} />
          </div>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-muted text-xs mb-0.5">Plan</dt><dd className="text-ink capitalize">{org.plan}</dd></div>
            <div><dt className="text-muted text-xs mb-0.5">Created</dt><dd className="text-ink">{new Date(org.created_at).toLocaleDateString()}</dd></div>
            <div><dt className="text-muted text-xs mb-0.5">Trial ends</dt><dd className="text-ink">{org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString() : '—'}</dd></div>
            <div><dt className="text-muted text-xs mb-0.5">Stripe customer</dt><dd className="text-ink">{org.stripe_customer_id ?? '—'}</dd></div>
          </dl>
          {org.suspended_at && (
            <p className="text-sm text-coral mt-4">Suspended: {org.suspended_reason}</p>
          )}
        </div>

        <div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <CountCard label="Contacts" value={counts.contacts} />
            <CountCard label="Properties" value={counts.properties} />
            <CountCard label="Documents" value={counts.documents} />
            <CountCard label="Tasks" value={counts.tasks} />
          </div>
          <div className="bg-white border border-border rounded-md p-4">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted mb-2">Export CSV</div>
            <div className="flex flex-wrap gap-2">
              {['contacts', 'properties', 'documents', 'tasks'].map((entity) => (
                <button
                  key={entity}
                  disabled={exportingEntity !== null}
                  onClick={() => handleExportCsv(entity)}
                  className="text-xs text-navyDeep border border-navyDeep/30 rounded-md px-2.5 py-1.5 disabled:opacity-50 capitalize"
                >
                  {exportingEntity === entity ? '…' : entity}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-border rounded-md p-5 sm:p-6">
          <h3 className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted mb-4">Trial &amp; plan</h3>

          <div className="flex items-center gap-2 mb-4">
            <input
              type="number" min="1" value={extendDays}
              onChange={(e) => setExtendDays(e.target.value)}
              className="w-20 border border-border rounded-md px-3 py-2 text-sm"
            />
            <span className="text-sm text-muted">days</span>
            <button
              disabled={busy || !extendDays || Number(extendDays) <= 0}
              onClick={() => runAction('extend_trial', { days: Number(extendDays) }, `Trial extended by ${extendDays} days.`)}
              className="bg-mid text-white text-sm font-medium rounded-md px-3.5 py-2 disabled:opacity-50 ml-auto"
            >
              Extend trial
            </button>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <select
              value={newPlan} onChange={(e) => setNewPlan(e.target.value)}
              className="border border-border rounded-md px-3 py-2 text-sm"
            >
              {PLAN_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <button
              disabled={busy || newPlan === org.plan}
              onClick={() => runAction('set_plan', { plan: newPlan }, `Plan label set to "${newPlan}". This does not touch Stripe.`)}
              className="bg-mid text-white text-sm font-medium rounded-md px-3.5 py-2 disabled:opacity-50 ml-auto"
            >
              Set plan
            </button>
          </div>

          <button
            disabled={busy}
            onClick={() => runAction('set_comped', { isComped: !org.is_comped }, org.is_comped ? 'Comp removed.' : 'Marked as comped.')}
            className="text-sm text-navyDeep underline disabled:opacity-50"
          >
            {org.is_comped ? 'Remove comped status' : 'Mark as comped (free account)'}
          </button>
        </div>

        <div className="bg-white border border-border rounded-md p-5 sm:p-6">
          <h3 className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted mb-4">Access</h3>
          {org.suspended_at ? (
            <button
              disabled={busy}
              onClick={() => runAction('unsuspend_org', {}, 'Organization reactivated.')}
              className="bg-amber text-ink font-bold rounded-md px-3.5 py-2 disabled:opacity-50"
            >
              Reactivate organization
            </button>
          ) : (
            <>
              <textarea
                placeholder="Reason for suspension (required, shown in audit log)"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm mb-3"
                rows={2}
              />
              <button
                disabled={busy || !suspendReason.trim()}
                onClick={() => runAction('suspend_org', { reason: suspendReason }, 'Organization suspended.')}
                className="bg-coral text-white text-sm rounded-md px-3.5 py-2 disabled:opacity-50"
              >
                Suspend organization
              </button>
              <p className="text-xs text-muted mt-2">
                This flags <code>suspended_at</code> in the database. Confirm the login flow actually checks it before relying on this to block access.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="bg-white border border-border rounded-md p-5 sm:p-6 mb-8">
        <h3 className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted mb-4">Members ({members.length})</h3>
        <div className="divide-y divide-muted/10">
          {members.map((m) => (
            <div key={m.membership_id} className="py-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm text-ink">{m.email}</div>
                <div className="text-xs text-muted capitalize">{m.role} · {m.status}</div>
              </div>
              <div className="flex gap-2">
                {m.status === 'invited' && (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => handleResendInvite(m.membership_id)}
                      className="text-xs text-navyDeep border border-navyDeep/30 rounded-md px-2.5 py-1.5 disabled:opacity-50"
                    >
                      Renvoyer l'email
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => handleGetInviteLink(m.membership_id)}
                      className="text-xs text-navyDeep border border-navyDeep/30 rounded-md px-2.5 py-1.5 disabled:opacity-50"
                    >
                      Copier le lien
                    </button>
                  </>
                )}
                {m.status === 'active' && m.email && (
                  <button
                    disabled={busy}
                    onClick={() => handleResetPassword(m.email)}
                    className="text-xs text-navyDeep border border-navyDeep/30 rounded-md px-2.5 py-1.5 disabled:opacity-50"
                  >
                    Reset password
                  </button>
                )}
              </div>
              {inviteLinks[m.membership_id] && (
                <div className="w-full mt-2 text-xs text-muted break-all bg-mid/10 rounded-md px-3 py-2">
                  {inviteLinks[m.membership_id]}
                </div>
              )}
            </div>
          ))}
          {members.length === 0 && <p className="text-sm text-muted py-4">No members.</p>}
        </div>
      </div>

      <div className="bg-white border border-border rounded-md p-5 sm:p-6 mb-8">
        <h3 className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted mb-1">Assistant IA</h3>
        <p className="text-xs text-muted mb-4">
          Décris le problème du client, l'IA regarde les données de cette org (plan, statut, membres, actions récentes) et te propose un diagnostic.
        </p>
        <form onSubmit={handleAiDiagnose} className="mb-3">
          <textarea
            value={aiProblem}
            onChange={(e) => setAiProblem(e.target.value)}
            placeholder="Ex : le client dit qu'il ne reçoit plus les rappels par email depuis 3 jours"
            className="w-full border border-border rounded-md px-3 py-2 text-sm mb-3"
            rows={2}
          />
          <button
            type="submit"
            disabled={aiBusy || !aiProblem.trim()}
            className="bg-mid text-white text-sm font-medium rounded-md px-3.5 py-2 disabled:opacity-50"
          >
            {aiBusy ? 'Diagnostic en cours…' : 'Diagnostiquer'}
          </button>
        </form>
        {aiError && <p className="text-sm text-red-600">{aiError}</p>}
        {aiDiagnosis && (
          <div className="bg-mid/10 rounded-md px-4 py-3 text-sm text-ink whitespace-pre-wrap">
            {aiDiagnosis}
          </div>
        )}
      </div>

      <div className="bg-white border border-border rounded-md p-5 sm:p-6 mb-8">
        <h3 className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted mb-1">Erreurs récentes</h3>
        <p className="text-xs text-muted mb-4">
          Erreurs réellement survenues côté backend pour cette org (email/push non envoyé, etc.). Un problème "ça ne marche pas / c'est vide" sans message d'erreur ne remontera pas ici — c'est le rôle de l'assistant IA ci-dessus.
        </p>
        <div className="divide-y divide-muted/10">
          {orgErrors.map((e) => (
            <div key={e.id} className="py-2.5 text-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-coral font-medium">{e.edge_function}</span>
                <span className="text-xs text-muted">{new Date(e.created_at).toLocaleString()}</span>
              </div>
              <div className="text-ink mt-0.5">{e.message}</div>
            </div>
          ))}
          {!errorsLoading && orgErrors.length === 0 && (
            <p className="text-sm text-muted py-4">Aucune erreur enregistrée pour cette org.</p>
          )}
        </div>
      </div>

      <div className="bg-white border border-border rounded-md p-5 sm:p-6">
        <h3 className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted mb-4">Recent admin activity</h3>
        <div className="divide-y divide-muted/10">
          {recentActivity.map((a) => (
            <div key={a.id} className="py-2.5 text-sm">
              <span className="text-ink">{a.action}</span>
              <span className="text-muted"> — {a.admin_email} — {new Date(a.created_at).toLocaleString()}</span>
            </div>
          ))}
          {recentActivity.length === 0 && <p className="text-sm text-muted py-4">No actions logged yet for this organization.</p>}
        </div>
      </div>
    </Layout>
  )
}

function CountCard({ label, value }) {
  return (
    <div className="bg-white border border-border rounded-md p-4">
      <div className="font-mono text-[10px] uppercase tracking-wide text-muted mb-1">{label}</div>
      <div className="font-display text-xl font-medium text-navyDeep">{value}</div>
    </div>
  )
}
