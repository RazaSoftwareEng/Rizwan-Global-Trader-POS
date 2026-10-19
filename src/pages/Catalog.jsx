import { useEffect, useMemo, useState } from 'react'
import { Package, Plus, Search, Upload } from 'lucide-react'
import { listProducts } from '../lib/api'
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

  useEffect(() => {
    listProducts().then(setRows).catch((e) => setError(e.message))
  }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (rows ?? []).filter(
      (p) => !needle || [p.name, p.sku, p.description, p.unit].some((v) => v?.toLowerCase().includes(needle)),
    )
  }, [rows, q])

  const upsert = (p) => setRows((prev) => [...prev.filter((r) => r.id !== p.id), p].sort(byName))

  return (
    <>
      <PageHeader
        title="Catalog"
        subtitle="Products, prices and stock used on quotations and invoices."
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
            <input className="input" placeholder="Search by name, SKU or description" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {rows && <span className="text-secondary">{rows.length} products</span>}
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
                <th>SKU</th>
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
                        {p.description && <span className="text-muted truncate">{p.description}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="text-secondary mono">{p.sku || '—'}</td>
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
