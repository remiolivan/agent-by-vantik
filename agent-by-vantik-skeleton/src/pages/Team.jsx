import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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
        .select('name, referral_code, trial_ends_at')
        .eq('id', membership.org_id)
        .single()
      setOrg(orgData)
    }
  }

  useEffect(() => { load() }, [])

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
    <div className="min-h-screen bg-paper">
      <header className="border-b border-fog/20 px-8 py-5">
        <div className="font-display text-lg font-medium text-nightfall">Team</div>
      </header>

      <main className="max-w-2xl mx-auto px-8 py-8">
        {org && (
          <div className="bg-nightfall text-paper rounded p-6 mb-8">
            <div className="font-mono text-xs uppercase tracking-wide text-dune mb-2">Your referral code</div>
            <div className="font-display text-2xl font-medium mb-3">{org.referral_code}</div>
            <p className="text-sm text-paper/70 mb-4">
              Share your link — anyone who signs up with it gets 30 days instead of 14, and you get +14 days added to your own trial.
            </p>
            <div className="flex gap-2">
              <input
                readOnly value={referralLink()}
                className="flex-1 bg-white/10 border border-white/20 rounded px-3 py-2 text-xs font-mono text-paper"
              />
              <button
                onClick={copyLink}
                className="bg-horizon text-white text-sm rounded px-4 py-2 whitespace-nowrap"
              >
                {copied ? 'Copied!' : 'Copy link'}
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleInvite} className="flex gap-3 items-center mb-8">
          <input
            type="email" required placeholder="agent@email.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="flex-1 border border-fog/30 rounded px-3 py-2 text-sm"
          />
          <select
            value={role} onChange={(e) => setRole(e.target.value)}
            className="border border-fog/30 rounded px-3 py-2 text-sm"
          >
            <option value="agent">Agent</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit" disabled={sending}
            className="bg-nightfall text-white text-sm rounded px-4 py-2 disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Invite'}
          </button>
        </form>

        {message && <p className="text-sm text-fog mb-6">{message}</p>}

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left font-mono text-xs uppercase tracking-wide text-fog border-b border-fog/20">
              <th className="py-2 font-normal">Email</th>
              <th className="py-2 font-normal">Role</th>
              <th className="py-2 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-fog/10">
                <td className="py-3 text-ink">{m.invited_email || '—'}</td>
                <td className="py-3 text-fog capitalize">{m.role}</td>
                <td className="py-3">
                  <span className={
                    m.status === 'active'
                      ? 'text-teal-700 bg-teal-50 px-2 py-0.5 rounded text-xs'
                      : 'text-horizon bg-horizon/10 px-2 py-0.5 rounded text-xs'
                  }>
                    {m.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  )
}
