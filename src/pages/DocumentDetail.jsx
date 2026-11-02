import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRightLeft, CheckCircle2, ExternalLink, Printer, RotateCcw } from 'lucide-react'
import { DOC_TYPES, convertQuotation, getDocument, setInvoiceStatus } from '../lib/api'
import DocumentPaper from '../components/DocumentPaper'
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

  const co = doc.companies ?? {}

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

      <DocumentPaper type={type} doc={doc} template={co.doc_template} accent={co.doc_accent} />
    </>
  )
}
