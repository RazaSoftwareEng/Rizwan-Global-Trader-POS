import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRightLeft, CheckCircle2, ExternalLink, Printer, RotateCcw } from 'lucide-react'
import { DOC_TYPES, convertQuotation, getDocument, setInvoiceStatus } from '../lib/api'
import { formatDate, initials, money } from '../lib/format'
import { ErrorBanner, Loading, StatusBadge } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'

export default function DocumentDetail({ type }) {
  const t = DOC_TYPES[type]
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setDoc(null)
    getDocument(type, id).then(setDoc).catch((e) => setError(e.message))
  }, [type, id])

  async function toggleStatus() {
    const next = doc.status === 'paid' ? 'unpaid' : 'paid'
    setBusy(true)
    setError('')
    try {
      await setInvoiceStatus(doc.id, next)
      setDoc((d) => ({ ...d, status: next }))
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  async function convert() {
    if (!window.confirm(`Create an invoice from ${doc.no}?`)) return
    setBusy(true)
    setError('')
    try {
      const invoiceId = await convertQuotation(doc.id)
      navigate(`/invoices/${invoiceId}`)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  if (!doc) return error ? <ErrorBanner message={error} /> : <Loading />

  const co = doc.companies
  const cu = doc.customers

  return (
    <>
      <div className="page-header no-print">
        <div>
          <Link to={t.path} className="back-link">
            <ArrowLeft size={15} /> {t.plural}
          </Link>
          <div className="title-row">
            <h1>{doc.no}</h1>
            <StatusBadge status={doc.status} />
          </div>
          {doc.created_by_name && <p className="text-secondary created-by">Created by {doc.created_by_name}</p>}
        </div>
        <div className="page-actions">
          {type === 'invoice' && isAdmin && (
            <button className="btn btn-secondary" onClick={toggleStatus} disabled={busy}>
              {doc.status === 'paid' ? (
                <>
                  <RotateCcw size={16} /> Mark as unpaid
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Mark as paid
                </>
              )}
            </button>
          )}
          {type === 'quotation' && doc.status === 'open' && (
            <button className="btn btn-secondary" onClick={convert} disabled={busy}>
              <ArrowRightLeft size={16} /> Convert to invoice
            </button>
          )}
          {type === 'quotation' && doc.invoice_id && (
            <Link to={`/invoices/${doc.invoice_id}`} className="btn btn-secondary">
              <ExternalLink size={16} /> View invoice
            </Link>
          )}
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={16} /> Print / PDF
          </button>
        </div>
      </div>

      <div className="no-print">
        <ErrorBanner message={error} />
      </div>

      <article className="paper">
        <header className="paper-head">
          <div>
            <div className="paper-logo">{initials(co.name)}</div>
            <h2>{co.name}</h2>
            {co.address && <div className="text-secondary">{co.address}</div>}
            <div className="text-secondary">{[co.phone, co.email].filter(Boolean).join(' · ')}</div>
            <div className="text-secondary">{[co.ntn && `NTN: ${co.ntn}`, co.strn && `STRN: ${co.strn}`].filter(Boolean).join(' · ')}</div>
          </div>
          <div className="paper-title">
            <div className="paper-kind">{t.label}</div>
            <div className="paper-no">{doc.no}</div>
          </div>
        </header>

        <section className="paper-meta">
          <div>
            <div className="meta-label">Bill to</div>
            <div className="strong">{cu.name}</div>
            {cu.contact_person && <div className="text-secondary">Attn: {cu.contact_person}</div>}
            <div className="text-secondary">{[cu.address, cu.city].filter(Boolean).join(', ')}</div>
            <div className="text-secondary">{[cu.phone, cu.email].filter(Boolean).join(' · ')}</div>
            <div className="text-secondary">{[cu.ntn && `NTN: ${cu.ntn}`, cu.strn && `STRN: ${cu.strn}`].filter(Boolean).join(' · ')}</div>
          </div>
          <dl className="meta-list">
            <div>
              <dt>Date</dt>
              <dd>{formatDate(doc.date)}</dd>
            </div>
            {doc.valid_until && (
              <div>
                <dt>Valid until</dt>
                <dd>{formatDate(doc.valid_until)}</dd>
              </div>
            )}
            {type === 'invoice' && (
              <div>
                <dt>Status</dt>
                <dd>{doc.status === 'paid' ? 'Paid' : 'Unpaid'}</dd>
              </div>
            )}
          </dl>
        </section>

        <table className="table paper-table">
          <thead>
            <tr>
              <th className="col-idx">#</th>
              <th>Description</th>
              <th className="num">Qty</th>
              <th className="num">Rate</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((it, idx) => (
              <tr key={it.id}>
                <td className="col-idx text-muted">{idx + 1}</td>
                <td className="strong">{it.product_name}</td>
                <td className="num">
                  {Number(it.qty)} {it.unit}
                </td>
                <td className="num">{money(it.unit_price)}</td>
                <td className="num">{money(it.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="paper-bottom">
          <div className="paper-notes">
            {doc.notes && (
              <>
                <div className="meta-label">Notes</div>
                <p>{doc.notes}</p>
              </>
            )}
          </div>
          <div className="paper-totals">
            <div className="sum-row">
              <span>Subtotal</span>
              <span>{money(doc.subtotal)}</span>
            </div>
            {Number(doc.discount) > 0 && (
              <div className="sum-row">
                <span>Discount</span>
                <span>− {money(doc.discount)}</span>
              </div>
            )}
            {Number(doc.tax_percent) > 0 && (
              <div className="sum-row">
                <span>GST ({Number(doc.tax_percent)}%)</span>
                <span>{money(doc.tax_amount)}</span>
              </div>
            )}
            <div className="sum-row sum-total">
              <span>Total</span>
              <span>{money(doc.total)}</span>
            </div>
          </div>
        </section>

        <footer className="paper-foot">Thank you for your business.</footer>
      </article>
    </>
  )
}
