import { useEffect, useMemo, useState } from 'react'
import { Package, Plus, Search, Upload } from 'lucide-react'
import { listCustomers, listProducts } from '../lib/api'
import { money } from '../lib/format'
import { EmptyState, ErrorBanner, Loading, PageHeader } from '../components/ui'
import { ProductModal } from '../components/RecordModals'
import ProductImport from '../components/ProductImport'

const byName = (a, b) => a.name.localeCompare(b.name)

export default function Catalog() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null) // null | {} (new) | product
  const [importing, setImporting] = useState(false)
  const [notice, setNotice] = useState('')
  const [customers, setCustomers] = useState([])
  const [owner, setOwner] = useState('all') // 'all' | 'shared' | customer id

  useEffect(() => {
    listProducts().then(setRows).catch((e) => setError(e.message))
    listCustomers().then(setCustomers).catch(() => {})
  }, [])

  const customerName = (id) => customers.find((c) => c.id === id)?.name ?? 'Unknown customer'
  // New products / imports go into the catalog picked in the filter
  const targetId = owner === 'all' || owner === 'shared' ? null : owner

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (rows ?? []).filter(
      (p) =>
        (owner === 'all' || (owner === 'shared' ? !p.customer_id : p.customer_id === owner)) &&
        (!needle || [p.name, p.sku, p.description, p.unit].some((v) => v?.toLowerCase().includes(needle))),
    )
  }, [rows, q, owner])

  const upsert = (p) => setRows((prev) => [...prev.filter((r) => r.id !== p.id), p].sort(byName))

  return (
    <>
      <PageHeader
        title="Catalog"
        subtitle="Each customer has their own catalog. Shared products are available to every customer."
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setImporting(true)} disabled={!rows}>
              <Upload size={16} /> Import
            </button>
            <button className="btn btn-primary" onClick={() => setEditing({})} disabled={!rows}>
              <Plus size={16} /> Add product
            </button>
          </>
        }
      />

      <ErrorBanner message={error} />
      {notice && <div className="notice">{notice}</div>}

      <div className="card card-flush">
        <div className="toolbar">
          <div className="input-icon toolbar-search">
            <Search size={16} />
            <input className="input" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input filter-select" value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="all">All catalogs</option>
            <option value="shared">Shared — all customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {rows && <span className="text-secondary">{filtered.length} product{filtered.length === 1 ? '' : 's'}</span>}
        </div>

        {!rows && !error && <Loading />}
        {rows && rows.length === 0 && (
          <EmptyState
            icon={Package}
            title="Your catalog is empty"
            text="Add products one by one, or import many at once from a CSV file."
            action={
              <div className="empty-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => setImporting(true)}>
                  <Upload size={15} /> Import CSV
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>
                  <Plus size={15} /> Add product
                </button>
              </div>
            }
          />
        )}
        {rows && rows.length > 0 && filtered.length === 0 && <EmptyState icon={Search} title="No matches" />}

        {filtered.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Customer</th>
                <th>Unit</th>
                <th className="num">Stock</th>
                <th className="num">Price</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="row-link" onClick={() => setEditing(p)}>
                  <td>
                    <div className="cell-with-icon">
                      <span className="cell-icon">
                        <Package size={15} />
                      </span>
                      <div className="cell-stack">
                        <span className="strong">{p.name}</span>
                      </div>
                    </div>
                  </td>
                  <td>{p.customer_id ? <span className="cat-pill">{customerName(p.customer_id)}</span> : <span className="text-muted">Shared</span>}</td>
                  <td className="text-secondary">{p.unit}</td>
                  <td className="num">
                    {Number(p.stock) > 0 ? (
                      Number(p.stock)
                    ) : (
                      <span className="status status-critical">Out of stock</span>
                    )}
                  </td>
                  <td className="num strong">{money(p.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <ProductModal
          product={editing.id ? editing : null}
          existing={rows}
          customers={customers}
          customerId={targetId}
          onClose={() => setEditing(null)}
          onSaved={(p) => {
            upsert(p)
            setEditing(null)
          }}
          onDeleted={(id) => {
            setRows((prev) => prev.filter((r) => r.id !== id))
            setEditing(null)
          }}
        />
      )}

      {importing && (
        <ProductImport
          existing={rows}
          customerId={targetId}
          customerName={targetId ? customerName(targetId) : 'Shared — all customers'}
          onClose={() => setImporting(false)}
          onImported={(added) => {
            setRows((prev) => [...prev, ...added].sort(byName))
            setImporting(false)
            setNotice(`${added.length} product${added.length === 1 ? '' : 's'} imported.`)
          }}
        />
      )}
    </>
  )
}
