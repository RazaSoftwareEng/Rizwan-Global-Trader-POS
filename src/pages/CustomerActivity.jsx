// One customer, split in half.
// View: the customer's documents as rows on the left; on the right the clicked document,
// or the locked template under a shadow with a pulsing "Create" button.
// Create: form on the left, live preview on the right.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRightLeft, CheckCircle2, ChevronRight, ExternalLink, FileText, Lock, Plus, ReceiptText, RotateCcw, X } from 'lucide-react'
import { convertQuotation, getDefaultCompany, listCustomerDocuments, listCustomers, listProducts, setInvoiceStatus } from '../lib/api'
import { formatDate, initials, money } from '../lib/format'
import { inRange, usePeriodParams } from '../lib/periods'
import { useAuth } from '../auth/AuthProvider'
import { ErrorBanner, Loading, StatusBadge } from '../components/ui'
import PeriodFilter from '../components/PeriodFilter'
import DocumentPaper from '../components/DocumentPaper'
import ScaledPaper from '../components/ScaledPaper'
import QuickBuilder, { draftDoc, templateName, templateOf } from '../components/QuickBuilder'

const PATHS = { invoice: '/invoices', quotation: '/quotations' }
const LABELS = { invoice: 'Invoice', quotation: 'Quotation' }

export default function CustomerActivity() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const { period, range, setPeriod, setRange, query, valid } = usePeriodParams()
  const [base, setBase] = useState(null) // { customer, company, products }
  const [docs, setDocs] = useState({ invoice: null, quotation: null })
  const [type, setType] = useState('invoice')
  const [mode, setMode] = useState('view') // 'view' | 'create'
  const [error, setError] = useState('')
  const [justCreated, setJustCreated] = useState(null)
  const [selectedId, setSelectedId] = useState(null) // document shown on the left
  const [busy, setBusy] = useState(false)

  const loadDocs = useCallback(
    (kind) =>
      listCustomerDocuments(kind, id)
        .then((rows) => {
          setDocs((d) => ({ ...d, [kind]: rows }))
          return rows
        })
        .catch((e) => setError(e.message)),
    [id],
  )

  useEffect(() => {
    Promise.all([listCustomers(), getDefaultCompany(), listProducts()])
      .then(([customers, company, products]) => {
        const customer = customers.find((c) => c.id === id)
        if (!customer) throw new Error('Customer not found.')
        if (!company) throw new Error('Add your company details in Settings first.')
        setBase({ customer, company, products })
      })
      .catch((e) => setError(e.message))
    loadDocs('invoice')
    loadDocs('quotation')
  }, [id, loadDocs])

  const recent = useMemo(() => (docs[type] && valid ? docs[type].filter((d) => inRange(d.date, range)) : []), [docs, type, range, valid])
  const recentTotal = recent.reduce((s, d) => s + Number(d.total), 0)
  const c = base?.customer
  const template = base ? templateOf(base.customer, base.company) : null
  const selected = selectedId ? docs[type]?.find((d) => d.id === selectedId) : null

  const switchType = (t) => {
    setType(t)
    setSelectedId(null)
  }

  async function toggleStatus() {
    setBusy(true)
    setError('')
    try {
      const next = selected.status === 'paid' ? 'unpaid' : 'paid'
      await setInvoiceStatus(selected.id, next)
      setDocs((d) => ({ ...d, invoice: d.invoice.map((x) => (x.id === selected.id ? { ...x, status: next } : x)) }))
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  async function convert() {
    if (!window.confirm(`Create an invoice from ${selected.no}?`)) return
    setBusy(true)
    setError('')
    try {
      const invoiceId = await convertQuotation(selected.id)
      await Promise.all([loadDocs('quotation'), loadDocs('invoice')])
      setType('invoice')
      setSelectedId(invoiceId)
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  async function handleCreated(newId) {
    const rows = (await loadDocs(type)) ?? []
    const doc = rows.find((r) => r.id === newId)
    setJustCreated({ id: newId, type, no: doc?.no ?? '' })
    setSelectedId(newId)
    setMode('view')
    if (doc && !inRange(doc.date, range)) setPeriod('year') // keep the new one visible
  }

  return (
    <>
      <div className="page-header">
        <div>
          <Link to={`/${query ? `?${query}` : ''}`} className="back-link">
            <ArrowLeft size={15} /> Dashboard
          </Link>
          {c ? (
            <div className="title-row">
              <span className="avatar avatar-soft">{initials(c.name)}</span>
              <div>
                <h1>{c.name}</h1>
                <p className="text-secondary">{[c.contact_person, c.phone, c.city].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
          ) : (
            <h1>Customer</h1>
          )}
        </div>
        {base && mode === 'view' && (
          <div className="page-actions">
            <div className="segmented type-switch">
              <button className={type === 'invoice' ? 'active' : ''} onClick={() => switchType('invoice')}>
                <ReceiptText size={15} /> Invoices
              </button>
              <button className={type === 'quotation' ? 'active' : ''} onClick={() => switchType('quotation')}>
                <FileText size={15} /> Quotations
              </button>
            </div>
            <button className="btn btn-primary" onClick={() => (setJustCreated(null), setMode('create'))}>
              <Plus size={16} /> Create {LABELS[type].toLowerCase()}
            </button>
          </div>
        )}
      </div>

      <ErrorBanner message={error} />

      {justCreated && mode === 'view' && (
        <div className="notice notice-row">
          <span>
            <CheckCircle2 size={15} /> {LABELS[justCreated.type]} {justCreated.no} created.
          </span>
          <Link to={`${PATHS[justCreated.type]}/${justCreated.id}`} className="btn btn-secondary btn-sm">
            Open / Print
          </Link>
        </div>
      )}

      {!base && !error && <Loading />}

      {base && mode === 'create' && (
        <QuickBuilder
          type={type}
          customer={base.customer}
          company={base.company}
          products={base.products}
          onCancel={() => setMode('view')}
          onCreated={handleCreated}
          onProductCreated={(p) => setBase((b) => ({ ...b, products: [...b.products, p].sort((x, y) => x.name.localeCompare(y.name)) }))}
        />
      )}

      {base && mode === 'view' && (
        <div className="ws ws-view">
          {/* Left half: the customer's documents as rows */}
          <div className="ws-list">
            <PeriodFilter period={period} range={range} setPeriod={setPeriod} setRange={setRange} />
            <div className="card recent-card">
              <div className="recent-head">
                <h3>{type === 'invoice' ? 'Invoices' : 'Quotations'}</h3>
                <p className="text-secondary">
                  {recent.length} · {money(recentTotal)}
                </p>
              </div>
              {!docs[type] ? (
                <Loading />
              ) : !valid ? (
                <p className="text-muted recent-empty">Choose a valid date range.</p>
              ) : recent.length === 0 ? (
                <p className="text-muted recent-empty">Nothing in this period.</p>
              ) : (
                <div className="doc-rows">
                  {recent.map((d) => (
                    <button
                      key={d.id}
                      className={`doc-row ${selectedId === d.id ? 'is-selected' : ''} ${justCreated?.id === d.id ? 'is-new' : ''}`}
                      onClick={() => {
                        setSelectedId(d.id)
                        if (window.innerWidth <= 1000) document.querySelector('.ws-doc')?.scrollIntoView({ behavior: 'smooth' })
                      }}
                      onDoubleClick={() => navigate(`${PATHS[type]}/${d.id}`)}
                      title="Show (double-click to open)"
                    >
                      <span className="doc-row-main">
                        <span className="strong">{d.no}</span>
                        <span className="text-muted">
                          {formatDate(d.date)} · {d.items?.length ?? 0} item{d.items?.length === 1 ? '' : 's'}
                        </span>
                      </span>
                      <StatusBadge status={d.status} />
                      <span className="doc-row-amount">{money(d.total)}</span>
                      <ChevronRight size={16} className="doc-row-chevron" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right half: the clicked document, or the locked template with a Create button */}
          <div className="ws-doc">
            {selected ? (
              <>
                <div className="ws-bar ws-doc-bar">
                  <span className="strong">{selected.no}</span>
                  <StatusBadge status={selected.status} />
                  <span className="ws-doc-actions">
                    {type === 'invoice' && isAdmin && (
                      <button className="btn btn-secondary btn-sm" onClick={toggleStatus} disabled={busy}>
                        {selected.status === 'paid' ? <RotateCcw size={14} /> : <CheckCircle2 size={14} />}
                        {selected.status === 'paid' ? 'Mark unpaid' : 'Mark paid'}
                      </button>
                    )}
                    {type === 'quotation' && selected.status === 'open' && (
                      <button className="btn btn-secondary btn-sm" onClick={convert} disabled={busy}>
                        <ArrowRightLeft size={14} /> Convert to invoice
                      </button>
                    )}
                    <Link to={`${PATHS[type]}/${selected.id}`} className="btn btn-primary btn-sm">
                      <ExternalLink size={14} /> Open / Print
                    </Link>
                    <button className="icon-btn" onClick={() => setSelectedId(null)} title="Close" aria-label="Close">
                      <X size={17} />
                    </button>
                  </span>
                </div>
                <ScaledPaper className="tpl-page">
                  <DocumentPaper
                    type={type}
                    doc={{ ...selected, companies: base.company }}
                    template={selected.customers?.doc_template || base.company.doc_template}
                    accent={base.company.doc_accent}
                    fixed
                  />
                </ScaledPaper>
              </>
            ) : (
              <>
                <div className="ws-bar ws-bar-locked">
                  <span className="locked-pill">
                    <Lock size={13} /> Template locked
                  </span>
                  <span className="strong">{templateName(template)}</span>
                  <span className="text-muted"> · used for every {LABELS[type].toLowerCase()} of {c.name}</span>
                </div>
                <div className="locked-paper">
                  <ScaledPaper className="tpl-page">
                    <DocumentPaper
                      type={type}
                      doc={draftDoc({ type, company: base.company, customer: base.customer, preparedBy: user?.name })}
                      template={template}
                      accent={base.company.doc_accent}
                      fixed
                    />
                  </ScaledPaper>
                  <div className="locked-overlay">
                    <button className="btn btn-primary btn-lg create-pulse" onClick={() => (setJustCreated(null), setMode('create'))}>
                      <Plus size={18} /> Create {LABELS[type].toLowerCase()}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
