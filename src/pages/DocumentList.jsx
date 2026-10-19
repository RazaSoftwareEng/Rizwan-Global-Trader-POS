import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileText, Plus, ReceiptText, Search } from 'lucide-react'
import { DOC_TYPES, listDocuments } from '../lib/api'
import { formatDate, money } from '../lib/format'
import { EmptyState, ErrorBanner, Loading, PageHeader, StatusBadge } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'

const FILTERS = {
  invoice: [
    { value: 'all', label: 'All' },
    { value: 'unpaid', label: 'Unpaid' },
    { value: 'paid', label: 'Paid' },
  ],
  quotation: [
    { value: 'all', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'converted', label: 'Converted' },
  ],
}

export default function DocumentList({ type }) {
  const t = DOC_TYPES[type]
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')

  useEffect(() => {
    listDocuments(type).then(setRows).catch((e) => setError(e.message))
  }, [type])

  const filtered = useMemo(() => {
    if (!rows) return []
    const needle = q.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (status === 'all' || r.status === status) &&
        (!needle || r.no.toLowerCase().includes(needle) || r.customers?.name?.toLowerCase().includes(needle)),
    )
  }, [rows, q, status])

  const filteredTotal = filtered.reduce((s, r) => s + Number(r.total), 0)
  const Icon = type === 'invoice' ? ReceiptText : FileText

  return (
    <>
      <PageHeader
        title={t.plural}
        subtitle={
          type === 'invoice' ? 'Bills issued to your customers.' : 'Price offers you can convert into invoices.'
        }
        actions={
          <Link to={`${t.path}/new`} className="btn btn-primary">
            <Plus size={16} /> New {t.label.toLowerCase()}
          </Link>
        }
      />

      <ErrorBanner message={error} />

      <div className="card card-flush">
        <div className="toolbar">
          <div className="input-icon toolbar-search">
            <Search size={16} />
            <input
              className="input"
              placeholder={`Search by ${t.label.toLowerCase()} # or customer`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="segmented">
            {FILTERS[type].map((f) => (
              <button key={f.value} className={status === f.value ? 'active' : ''} onClick={() => setStatus(f.value)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {!rows && !error && <Loading />}

        {rows && rows.length === 0 && (
          <EmptyState
            icon={Icon}
            title={`No ${t.plural.toLowerCase()} yet`}
            text={`Create your first ${t.label.toLowerCase()} to see it here.`}
            action={
              <Link to={`${t.path}/new`} className="btn btn-primary btn-sm">
                <Plus size={15} /> New {t.label.toLowerCase()}
              </Link>
            }
          />
        )}

        {rows && rows.length > 0 && filtered.length === 0 && (
          <EmptyState icon={Search} title="No matches" text="Try a different search or filter." />
        )}

        {filtered.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>{t.label} #</th>
                <th>Customer</th>
                <th>Date</th>
                {isAdmin && <th>Created by</th>}
                <th>Status</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="row-link" onClick={() => navigate(`${t.path}/${r.id}`)}>
                  <td className="strong">{r.no}</td>
                  <td>{r.customers?.name}</td>
                  <td className="text-secondary">{formatDate(r.date)}</td>
                  {isAdmin && <td className="text-secondary">{r.created_by_name ?? '—'}</td>}
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="num strong">{money(r.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={isAdmin ? 5 : 4} className="text-secondary">
                  {filtered.length} {filtered.length === 1 ? t.label.toLowerCase() : t.plural.toLowerCase()}
                </td>
                <td className="num strong">{money(filteredTotal)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </>
  )
}
