import { useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import AdminSectionNav from '../../components/admin/AdminSectionNav'
import AdminTabs from '../../components/admin/AdminTabs'
import { callAdminApi } from '../../lib/adminApi'

export default function AdminUsers() {
  const [searchInput, setSearchInput] = useState('')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searched, setSearched] = useState(false)

  async function handleSearch(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const data = await callAdminApi('list_users', { search: searchInput.trim() })
      setUsers(data.users)
      setSearched(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout title="Admin — Support">
      <AdminSectionNav active="support" />
      <AdminTabs active="users" />

      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by email or organization name…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="flex-1 border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-navyDeep"
        />
        <button type="submit" disabled={loading} className="bg-mid text-white text-sm font-medium rounded-md px-4 py-2.5 disabled:opacity-50">
          Search
        </button>
      </form>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="bg-white border border-border rounded-md divide-y divide-muted/10">
        {users.map((u) => (
          <Link
            key={u.membership_id}
            to={`/admin/orgs/${u.org_id}`}
            className="block px-4 py-3 hover:bg-mid/10"
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm text-ink">{u.email ?? u.invited_email}</span>
              <span className="text-xs text-muted capitalize">{u.role} · {u.status}</span>
            </div>
            <div className="text-xs text-muted mt-0.5">{u.org_name}</div>
          </Link>
        ))}
        {searched && users.length === 0 && !loading && (
          <p className="text-sm text-muted text-center py-8">No matches.</p>
        )}
        {!searched && (
          <p className="text-sm text-muted text-center py-8">Search by email or organization name to get started.</p>
        )}
      </div>
    </Layout>
  )
}
