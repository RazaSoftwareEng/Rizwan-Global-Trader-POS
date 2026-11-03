// Create an invoice / quotation for one customer: the form on the left half, live preview
// (customer's template) on the right half.
import { useMemo, useState } from 'react'
import { AlertCircle, Banknote, Check, Clock, Minus, Plus, Search, Trash2, X } from 'lucide-react'
import { DOC_TYPES, createDocument } from '../lib/api'
import { GST_PERCENT, addDays, computeTotals, money, today } from '../lib/format'
import { TEMPLATES } from '../lib/templates'
import { productsFor } from '../lib/productFields'
import { PAYMENT_METHODS } from '../lib/expenseFields'
import { useAuth } from '../auth/AuthProvider'
import { ErrorBanner, Field } from './ui'
import { ProductModal } from './RecordModals'
import DocumentPaper from './DocumentPaper'
import ScaledPaper from './ScaledPaper'

const round2 = (n) => Math.round(n * 100) / 100

// What to ask for when payment is not cash
const METHOD_FIELDS = {
  'Bank Transfer': { ref: 'Transaction / reference no.', refPh: 'e.g. FT2611039876', detail: 'Bank name', detailPh: 'e.g. HBL, Meezan' },
  Cheque: { ref: 'Cheque no.', refPh: 'e.g. 00123456', detail: 'Bank name', detailPh: 'e.g. UBL' },
  'JazzCash / Easypaisa': { ref: 'Transaction ID', refPh: 'e.g. 012345678901', detail: 'Sender mobile no.', detailPh: '03xx xxxxxxx' },
  Card: { ref: 'Approval / transaction no.', refPh: 'e.g. 482913', detail: 'Card last 4 digits', detailPh: '1234' },
}

// The document as it will look once saved (used for previews before saving)
export function draftDoc({ type, company, customer, items = [], date = today(), validUntil = null, discount = 0, notes = '', preparedBy, payment }) {
  const totals = computeTotals(items, discount, GST_PERCENT)
  return {
    companies: company,
    customers: customer,
    items: items.map((i, idx) => {
      const qty = Number(i.qty) || 0
      const unit_price = Number(i.unit_price) || 0
      return { id: idx, product_name: i.name, unit: i.unit, qty, unit_price, line_total: round2(qty * unit_price) }
    }),
    no: 'Draft · number on save',
    date,
    valid_until: type === 'quotation' ? validUntil : null,
    status: type === 'invoice' ? (payment?.status === 'paid' ? 'paid' : 'unpaid') : 'open',
    due_date: payment?.status === 'unpaid' ? payment.dueDate : null,
    payment_method: payment?.status === 'paid' ? payment.method : null,
    payment_ref: payment?.status === 'paid' && payment.method !== 'Cash' ? payment.reference : null,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax_percent: GST_PERCENT,
    tax_amount: totals.tax,
    total: totals.total,
    notes,
    created_by_name: preparedBy,
  }
}

export const templateOf = (customer, company) => customer.doc_template || company.doc_template
export const templateName = (id) => TEMPLATES.find((t) => t.id === id)?.name ?? 'Classic'

export default function QuickBuilder({ type, customer, company, products: allProducts, onCreated, onCancel, onProductCreated }) {
  const { user, isAdmin } = useAuth()
  const t = DOC_TYPES[type]
  const products = useMemo(() => productsFor(allProducts, customer.id), [allProducts, customer.id])
  const [items, setItems] = useState([]) // { product_id, name, unit, qty, unit_price }
  const [date, setDate] = useState(today())
  const [validUntil, setValidUntil] = useState(addDays(15))
  const [discount, setDiscount] = useState('0')
  const [notes, setNotes] = useState('')
  const [q, setQ] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Invoices only: pay later (credit) or paid now
  const [payment, setPayment] = useState({
    status: 'unpaid',
    dueDate: addDays(15),
    method: PAYMENT_METHODS[0],
    reference: '',
    details: '',
    receivedTotal: null, // total the cash tick was given for
  })
  const [payTouched, setPayTouched] = useState(false)
  const setPay = (k, v) => setPayment((p) => ({ ...p, [k]: v }))

  const totals = useMemo(() => computeTotals(items, discount, GST_PERCENT), [items, discount])
  const template = templateOf(customer, company)

  const needle = q.trim().toLowerCase()
  const matches = products.filter((p) => !needle || [p.name, p.sku].some((v) => v?.toLowerCase().includes(needle))).slice(0, 8)

  function addProduct(p) {
    setItems((prev) =>
      prev.some((i) => i.product_id === p.id)
        ? prev.map((i) => (i.product_id === p.id ? { ...i, qty: String((Number(i.qty) || 0) + 1) } : i))
        : [...prev, { product_id: p.id, name: p.name, unit: p.unit, qty: '1', unit_price: String(p.price) }],
    )
    setQ('')
    setPickerOpen(false)
  }
  const updateItem = (id, field, value) => setItems((prev) => prev.map((i) => (i.product_id === id ? { ...i, [field]: value } : i)))
  const stepQty = (id, d) =>
    setItems((prev) => prev.map((i) => (i.product_id === id ? { ...i, qty: String(Math.max(1, (Number(i.qty) || 0) + d)) } : i)))
  const removeItem = (id) => setItems((prev) => prev.filter((i) => i.product_id !== id))

  const itemsValid = items.length > 0 && items.every((i) => Number(i.qty) > 0 && i.unit_price !== '' && Number(i.unit_price) >= 0)
  const discountValid = totals.discount >= 0 && totals.discount <= totals.subtotal
  const dueValid = type !== 'invoice' || payment.status !== 'unpaid' || !payment.dueDate || payment.dueDate >= date
  // Paid now: cash needs a "received" tick (for the current total); other methods need a reference no.
  const methodInfo = METHOD_FIELDS[payment.method] ?? METHOD_FIELDS['Bank Transfer']
  const cashConfirmed = payment.receivedTotal === totals.total
  const payValid =
    type !== 'invoice' || payment.status !== 'paid' || (payment.method === 'Cash' ? cashConfirmed : payment.reference.trim() !== '')
  // Tell the user exactly what is missing instead of just disabling the button
  const blocker = !items.length
    ? 'Add at least one product.'
    : items.find((i) => !(Number(i.qty) > 0))
      ? `Enter a quantity for ${items.find((i) => !(Number(i.qty) > 0)).name}.`
      : items.find((i) => i.unit_price === '' || !(Number(i.unit_price) >= 0))
        ? `Enter a rate for ${items.find((i) => i.unit_price === '' || !(Number(i.unit_price) >= 0)).name}.`
        : !discountValid
          ? 'Discount cannot be more than the subtotal.'
          : !date
            ? 'Choose the date.'
            : !dueValid
              ? 'Due date cannot be before the invoice date.'
              : !payValid
                ? payment.method === 'Cash'
                  ? `Tick “I have received ${money(totals.total)} in cash” to continue.`
                  : `Enter the ${methodInfo.ref.toLowerCase()} for ${payment.method}.`
                : ''
  const canCreate = itemsValid && discountValid && date && dueValid && payValid

  const preview = draftDoc({ type, company, customer, items, date, validUntil, discount, notes, preparedBy: user?.name, payment: type === 'invoice' ? payment : null })

  async function handleCreate() {
    setSaving(true)
    setError('')
    try {
      const id = await createDocument(type, {
        companyId: company.id,
        customerId: customer.id,
        items,
        date,
        validUntil,
        discount,
        taxPercent: GST_PERCENT,
        notes,
        payment: type === 'invoice' ? payment : undefined,
      })
      onCreated(id)
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="ws">
      <div className="ws-left">
        <div className="ws-bar">
          <span className="strong">{templateName(template)} template</span>
          <span className="text-muted"> · Live preview</span>
        </div>
        <ScaledPaper className="tpl-page" fitViewport>
          <DocumentPaper type={type} doc={preview} template={template} accent={company.doc_accent} fixed />
        </ScaledPaper>
      </div>

      <div className="ws-right qb">
        <div className="card qb-form">
          <div className="card-head card-head-tight">
            <div>
              <h3>New {t.label.toLowerCase()}</h3>
              <p className="text-secondary">Add products. The preview on the right updates as you type.</p>
            </div>
            <button className="icon-btn" onClick={onCancel} title="Cancel" aria-label="Cancel" disabled={saving}>
              <X size={18} />
            </button>
          </div>

          <ErrorBanner message={error} />

          <div className="qb-picker">
            <div className="qb-picker-row">
              <div className="input-icon">
                <Search size={16} />
                <input
                  className="input"
                  autoFocus
                  placeholder="Search product to add…"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value)
                    setPickerOpen(true)
                  }}
                  onFocus={() => setPickerOpen(true)}
                  onBlur={() => setTimeout(() => setPickerOpen(false), 120)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && matches[0]) {
                      e.preventDefault()
                      addProduct(matches[0])
                    }
                  }}
                />
              </div>
              {isAdmin && (
                <button type="button" className="btn btn-secondary" onClick={() => setAdding(true)}>
                  <Plus size={16} /> Add product
                </button>
              )}
            </div>
            {pickerOpen && (
              <div className="qb-menu">
                {matches.length === 0 ? (
                  <div className="qb-menu-empty">
                    {products.length ? 'No products match.' : `No products in ${customer.name}'s catalog yet.`}
                    {isAdmin && ' Use “Add product”.'}
                  </div>
                ) : (
                  matches.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="qb-option"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        addProduct(p)
                      }}
                    >
                      <span className="cell-stack">
                        <span className="strong">{p.name}</span>
                        <span className="text-muted">Stock {Number(p.stock ?? 0)}</span>
                      </span>
                      <span className="qb-option-price">
                        {money(p.price)} <span className="text-muted">/ {p.unit}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <div className="items-empty">
              <span className="strong">No items yet</span>
              <span className="text-muted">Search a product above{isAdmin ? ' or use “Add product”' : ''}. Press Enter to add the first match.</span>
            </div>
          ) : (
            <div className="items">
              <div className="items-head" aria-hidden="true">
                <span>Item</span>
                <span>Qty</span>
                <span>Rate</span>
                <span className="num">Amount</span>
                <span />
              </div>
              {items.map((i) => {
                const stock = Number(products.find((p) => p.id === i.product_id)?.stock ?? 0)
                const over = Number(i.qty) > stock
                const selectAll = (e) => e.target.select()
                return (
                  <div key={i.product_id} className="item">
                    <div className="item-name">
                      <span className="strong">{i.name}</span>
                      <span className={`item-sub ${over ? 'is-warn' : ''}`}>
                        {i.unit} · {over ? `Only ${stock} in stock` : `Stock ${stock}`}
                      </span>
                    </div>
                    <label className="item-field">
                      <span className="item-label">Qty</span>
                      <span className="qty">
                        <button type="button" onClick={() => stepQty(i.product_id, -1)} aria-label="Decrease">
                          <Minus size={13} />
                        </button>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          inputMode="decimal"
                          value={i.qty}
                          className={Number(i.qty) > 0 ? '' : 'invalid'}
                          onFocus={selectAll}
                          onChange={(e) => updateItem(i.product_id, 'qty', e.target.value)}
                          aria-label={`Quantity of ${i.name}`}
                        />
                        <button type="button" onClick={() => stepQty(i.product_id, 1)} aria-label="Increase">
                          <Plus size={13} />
                        </button>
                      </span>
                    </label>
                    <label className="item-field">
                      <span className="item-label">Rate</span>
                      <span className="rate">
                        <span className="rate-prefix">Rs</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          className={i.unit_price !== '' && Number(i.unit_price) >= 0 ? '' : 'invalid'}
                          value={i.unit_price}
                          onFocus={selectAll}
                          onChange={(e) => updateItem(i.product_id, 'unit_price', e.target.value)}
                          aria-label={`Rate of ${i.name}`}
                        />
                      </span>
                    </label>
                    <span className="item-amount">{money((Number(i.qty) || 0) * (Number(i.unit_price) || 0))}</span>
                    <button className="icon-btn danger item-remove" onClick={() => removeItem(i.product_id)} aria-label={`Remove ${i.name}`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                )
              })}
              <div className="items-foot">
                <span className="text-muted">
                  {items.length} item{items.length === 1 ? '' : 's'}
                </span>
                <span>
                  Subtotal <b>{money(totals.subtotal)}</b>
                </span>
              </div>
            </div>
          )}

          <div className="qb-fields">
            <Field label={`${t.label} date`}>
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            {type === 'quotation' && (
              <Field label="Valid until">
                <input type="date" className="input" value={validUntil} min={date} onChange={(e) => setValidUntil(e.target.value)} />
              </Field>
            )}
            <Field label="Discount (Rs)" hint={discountValid ? null : 'Cannot be more than the subtotal'}>
              <input
                type="number"
                min="0"
                step="any"
                className={`input ${discountValid ? '' : 'invalid'}`}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </Field>
            <Field label="GST">
              <div className="input input-locked">
                <span>{GST_PERCENT}%</span>
                <span className="text-muted">{money(totals.tax)}</span>
              </div>
            </Field>
            <div className="qb-notes">
              <Field label="Notes">
                <input className="input" placeholder="Payment terms, delivery… (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
          </div>

          {type === 'invoice' && (
            <div className="pay">
              <span className="field-label">Payment</span>
              <div className="pay-cards" role="radiogroup" aria-label="Payment">
                <button
                  type="button"
                  role="radio"
                  aria-checked={payment.status === 'unpaid'}
                  className={`pay-card ${payment.status === 'unpaid' ? 'selected' : ''}`}
                  onClick={() => setPay('status', 'unpaid')}
                >
                  <span className="pay-icon pay-icon-later">
                    <Clock size={18} />
                  </span>
                  <span className="cell-stack">
                    <span className="strong">Pay later</span>
                    <span className="text-muted">On credit · invoice stays Unpaid</span>
                  </span>
                  <span className="pay-radio" />
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={payment.status === 'paid'}
                  className={`pay-card ${payment.status === 'paid' ? 'selected' : ''}`}
                  onClick={() => setPay('status', 'paid')}
                >
                  <span className="pay-icon pay-icon-now">
                    <Banknote size={18} />
                  </span>
                  <span className="cell-stack">
                    <span className="strong">Paid now</span>
                    <span className="text-muted">Payment received · marked Paid</span>
                  </span>
                  <span className="pay-radio" />
                </button>
              </div>

              {payment.status === 'unpaid' ? (
                <div className="pay-fields">
                  <Field label="Due date" hint={dueValid ? null : 'Cannot be before the invoice date'}>
                    <input
                      type="date"
                      className={`input ${dueValid ? '' : 'invalid'}`}
                      value={payment.dueDate}
                      min={date}
                      onChange={(e) => setPay('dueDate', e.target.value)}
                    />
                  </Field>
                  <div className="pay-quick">
                    {[7, 15, 30].map((d) => (
                      <button key={d} type="button" className="chip" onClick={() => setPay('dueDate', addDays(d))}>
                        {d} days
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="pay-fields pay-fields-now">
                  <div className="pay-methods" role="radiogroup" aria-label="Payment method">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={payment.method === m}
                        className={`chip ${payment.method === m ? 'selected' : ''}`}
                        onClick={() => setPay('method', m)}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  {payment.method === 'Cash' ? (
                    <label className={`cash-confirm ${cashConfirmed ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={cashConfirmed}
                        onChange={(e) => setPay('receivedTotal', e.target.checked ? totals.total : null)}
                      />
                      <span className="cash-box" aria-hidden="true">
                        <Check size={14} strokeWidth={3} />
                      </span>
                      <span className="cell-stack">
                        <span className="strong">I have received {money(totals.total)} in cash</span>
                        <span className="text-muted">Tick to confirm the cash is in hand.</span>
                      </span>
                    </label>
                  ) : (
                    <div className="pay-online">
                      <Field label={<>{methodInfo.ref} <span className="req">*</span></>}>
                        <input
                          className={`input ${payTouched && !payment.reference.trim() ? 'invalid' : ''}`}
                          placeholder={methodInfo.refPh}
                          value={payment.reference}
                          onChange={(e) => setPay('reference', e.target.value)}
                          onBlur={() => setPayTouched(true)}
                        />
                      </Field>
                      <Field label={<>{methodInfo.detail} <span className="optional">(optional)</span></>}>
                        <input
                          className="input"
                          placeholder={methodInfo.detailPh}
                          value={payment.details}
                          onChange={(e) => setPay('details', e.target.value)}
                        />
                      </Field>
                    </div>
                  )}
                  <div className="pay-received">
                    <span className="text-muted">Amount received</span>
                    <span className="strong">{money(totals.total)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {blocker && items.length > 0 && (
            <div className="qb-blocker">
              <AlertCircle size={15} /> {blocker}
            </div>
          )}

          <div className="card-actions qb-actions">
            <div className="qb-total">
              <span className="text-muted">Total</span>
              <span className="qb-total-value">{money(totals.total)}</span>
            </div>
            <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={!canCreate || saving}>
              {saving ? 'Creating…' : `Create ${t.label.toLowerCase()}`}
            </button>
          </div>
        </div>
      </div>

      {adding && (
        <ProductModal
          existing={allProducts}
          customerId={customer.id}
          onClose={() => setAdding(false)}
          onSaved={(p) => {
            onProductCreated?.(p)
            addProduct(p) // straight onto this invoice
            setAdding(false)
          }}
        />
      )}
    </div>
  )
}
