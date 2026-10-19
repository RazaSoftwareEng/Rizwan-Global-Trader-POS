import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Users } from 'lucide-react'
import { listCustomers } from '../lib/api'
import { initials } from '../lib/format'
import { EmptyState, ErrorBanner, Loading, PageHeader } from '../components/ui'
import { CustomerModal } from '../components/RecordModals'
import { useAuth } from '../auth/AuthProvider'

export default function Customers() {
  const { isAdmin } = useAuth()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null) // null | {} (new) | customer

  useEffect(() => {
    listCustomers().then(setRows).catch((e) => setError(e.message))
  }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (rows ?? []).filter(
      (c) => !needle || [c.name, c.contact_person, c.phone, c.email, c.city, c.ntn, c.address].some((v) => v?.toLowerCase().includes(needle)),
    )
  }, [rows, q])

  const upsert = (c) =>
    setRows((prev) => [...prev.filter((r) => r.id !== c.id), c].sort((a, b) => a.name.localeCompare(b.name)))

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={isAdmin ? 'Companies you sell to. Click a row to edit.' : 'Companies you sell to.'}
        actions={
          <button className="btn btn-primary" onClick={() => setEditing({})}>
            <Plus size={16} /> Add customer
          </button>
        }
      />

      <ErrorBanner message={error} />

      <div className="card card-flush">
        <div className="toolbar">
          <div className="input-icon toolbar-search">
            <Search size={16} />
            <input
              className="input"
              placeholder="Search by company, contact, phone, city or NTN"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {rows && <span className="text-secondary">{rows.length} customers</span>}
        </div>

        {!rows && !error && <Loading />}
        {rows && rows.length === 0 && (
          <EmptyState
            icon={Users}
            title="No customers yet"
            text="Add a customer to start creating quotations and invoices."
            action={
              <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>
                <Plus size={15} /> Add customer
              </button>
            }
          />
        )}
        {rows && rows.length > 0 && filtered.length === 0 && <EmptyState icon={Search} title="No matches" />}

        {filtered.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact person</th>
                <th>Phone</th>
                <th>City</th>
                <th>NTN</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className={isAdmin ? 'row-link' : ''} onClick={isAdmin ? () => setEditing(c) : undefined}>
                  <td>
                    <div className="cell-with-icon">
                      <span className="avatar avatar-sm avatar-soft">{initials(c.name)}</span>
                      <div className="cell-stack">
                        <span className="strong">{c.name}</span>
                        <span className="text-muted">{c.email || '—'}</span>
                      </div>
                    </div>
                  </td>
                  <td>{c.contact_person || '—'}</td>
                  <td className="text-secondary">{c.phone || '—'}</td>
                  <td className="text-secondary">{c.city || '—'}</td>
                  <td className="text-secondary mono">{c.ntn || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <CustomerModal
          customer={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={(c) => {
            upsert(c)
            setEditing(null)
          }}
          onDeleted={(id) => {
            setRows((prev) => prev.filter((r) => r.id !== id))
            setEditing(null)
          }}
        />
      )}
    </>
  )
}
