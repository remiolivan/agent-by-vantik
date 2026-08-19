import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Team() {
  const [members, setMembers] = useState([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('agent')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState(null)
  const [org, setOrg] = useState(null)
  const [copied, setCopied] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('memberships')
      .select('id, invited_email, role, status, created_at, user_id')
      .order('created_at', { ascending: false })
    setMembers(data ?? [])

    const { data: membership } = await supabase.from('memberships').select('org_id').single()
    if (membership) {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name, plan, referral_code, trial_ends_at')
        .eq('id', membership.org_id)
        .single()
      setOrg(orgData)
    }
  }

  useEffect(() => { load() }, [])

  const teamLocked = org && !['team', 'brokerage'].includes(org.plan)

  function referralLink() {
    if (!org) return ''
    return `${window.location.origin}/signup?ref=${org.referral_code}`
  }

  function copyLink() {
    navigator.clipboard.writeText(referralLink())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleInvite(e) {
    e.preventDefault()
    setSending(true)
    setMessage(null)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    const { data, error } = await supabase.functions.invoke('invite-agent', {
      body: { email, role },
      headers: { Authorization: `Bearer ${token}` },
    })

    setSending(false)
    if (error) {
      setMessage(`Failed: ${error.message}`)
    } else if (data?.error) {
      setMessage(`Failed: ${data.error}`)
    } else {
      setMessage(`Invite sent to ${email}.`)
      setEmail('')
      load()
    }
  }

  return (
    <Layout title="Team">
      <div className="max-w-2xl space-y-10">
        {/* Section 1: Team management */}
        <section>
          <h2 className="font-mono text-xs uppercase tracking-wide text-muted mb-4">Manage your team</h2>

          {teamLocked ? (
            <div className="bg-white border border-muted/20 rounded-xl p-6">
              <p className="text-sm text-ink mb-1">Team management is part of the Team and Brokerage plans.</p>
              <p className="text-sm text-muted mb-4">Upgrade to invite agents and manage roles.</p>
              <a href="/billing" className="inline-block bg-navyDeep text-white text-sm rounded-lg px-4 py-2.5">
                View plans
              </a>
            </div>
          ) : (
          <>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3 sm:items-center mb-6">
            <input
              type="email" required placeholder="agent@email.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="flex-1 border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
            />
            <select
              value={role} onChange={(e) => setRole(e.target.value)}
              className="border border-muted/30 rounded-lg px-3 py-2.5 text-sm"
            >
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit" disabled={sending}
              className="bg-navyDeep text-white text-sm rounded-lg px-4 py-2.5 disabled:opacity-50 whitespace-nowrap"
            >
              {sending ? 'Sending…' : 'Invite'}
            </button>
          </form>

          {message && <p className="text-sm text-muted mb-4">{message}</p>}

          {/* Mobile: card list */}
          <div className="space-y-2 sm:hidden">
            {members.map((m) => (
              <div key={m.id} className="bg-white border border-muted/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-ink">{m.invited_email || '—'}</span>
                  <span className={
                    m.status === 'active'
                      ? 'text-teal-700 bg-teal-50 px-2 py-0.5 rounded text-xs'
                      : 'text-teal bg-teal/10 px-2 py-0.5 rounded text-xs'
                  }>
                    {m.status}
                  </span>
                </div>
                <div className="text-xs text-muted capitalize">{m.role}</div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block bg-white border border-muted/20 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-xs uppercase tracking-wide text-muted border-b border-muted/20">
                  <th className="py-3 px-4 font-normal">Email</th>
                  <th className="py-3 px-4 font-normal">Role</th>
                  <th className="py-3 px-4 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-muted/10 last:border-0">
                    <td className="py-3 px-4 text-ink">{m.invited_email || '—'}</td>
                    <td className="py-3 px-4 text-muted capitalize">{m.role}</td>
                    <td className="py-3 px-4">
                      <span className={
                        m.status === 'active'
                          ? 'text-teal-700 bg-teal-50 px-2 py-0.5 rounded text-xs'
                          : 'text-teal bg-teal/10 px-2 py-0.5 rounded text-xs'
                      }>
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
          )}
        </section>

        {/* Section 2: Referral */}
        <section>
          <h2 className="font-mono text-xs uppercase tracking-wide text-muted mb-4">Refer another agency</h2>
          {org && (
            <div className="bg-navyDeep text-paper rounded-xl p-5 sm:p-6">
              <div className="font-mono text-xs uppercase tracking-wide text-amber mb-2">Your referral code</div>
              <div className="font-display text-2xl font-medium mb-3">{org.referral_code}</div>
              <p className="text-sm text-paper/70 mb-4">
                Share your link — anyone who signs up with it gets 30 days instead of 14, and you get +14 days added to your own trial.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  readOnly value={referralLink()}
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-xs font-mono text-paper truncate"
                />
                <button
                  onClick={copyLink}
                  className="bg-teal text-white text-sm rounded-lg px-4 py-2.5 whitespace-nowrap"
                >
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </Layout>
  )
}
