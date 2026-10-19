import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, Check, Minus, Plus, Search, Trash2, UserRound } from 'lucide-react'
import { DOC_TYPES, createDocument, getDefaultCompany, listCustomers, listProducts } from '../lib/api'
import { GST_PERCENT, addDays, computeTotals, initials, money, today } from '../lib/format'
import { EmptyState, ErrorBanner, Field, Loading } from '../components/ui'
import { CustomerModal, ProductModal } from '../components/RecordModals'
import { useAuth } from '../auth/AuthProvider'

const STEPS = ['Customer', 'Products', 'Details']

export default function DocumentForm({ type }) {
  const t = DOC_TYPES[type]
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const [company, setCompany] = useState(null)
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [step, setStep] = useState(0)
  const [customer, setCustomer] = useState(null)
  const [items, setItems] = useState([]) // { product_id, name, unit, qty, unit_price }
  const [date, setDate] = useState(today())
  const [validUntil, setValidUntil] = useState(addDays(15))
  const [discount, setDiscount] = useState('0')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState(null) // 'customer' | 'product'

  useEffect(() => {
    Promise.all([getDefaultCompany(), listCustomers(), listProducts()])
      .then(([co, cu, pr]) => {
        setCompany(co)
        setCustomers(cu)
        setProducts(pr)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const totals = useMemo(() => computeTotals(items, discount, GST_PERCENT), [items, discount])

  if (loading) return <Loading />
  if (!company) {
    return (
      <EmptyState
        icon={Building2}
        title="Company details missing"
        text={error || 'Add your company details first. They appear on every document.'}
        action={
          <Link to="/settings" className="btn btn-primary btn-sm">
            Open settings
          </Link>
        }
      />
    )
  }

  function addProduct(p) {
    setItems((prev) => {
      if (prev.some((i) => i.product_id === p.id)) {
        return prev.map((i) => (i.product_id === p.id ? { ...i, qty: String((Number(i.qty) || 0) + 1) } : i))
      }
      return [...prev, { product_id: p.id, name: p.name, unit: p.unit, qty: '1', unit_price: String(p.price) }]
    })
  }

  const updateItem = (id, field, value) =>
    setItems((prev) => prev.map((i) => (i.product_id === id ? { ...i, [field]: value } : i)))
  const stepQty = (id, delta) =>
    setItems((prev) =>
      prev.map((i) => (i.product_id === id ? { ...i, qty: String(Math.max(1, (Number(i.qty) || 0) + delta)) } : i)),
    )
  const removeItem = (id) => setItems((prev) => prev.filter((i) => i.product_id !== id))

  const itemsValid = items.length > 0 && items.every((i) => Number(i.qty) > 0 && Number(i.unit_price) >= 0)
  const discountValid = totals.discount >= 0 && totals.discount <= totals.subtotal
  const canCreate = customer && itemsValid && discountValid && date

  const canOpen = (i) => i === 0 || (i === 1 && customer) || (i === 2 && customer && itemsValid)

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
      })
      navigate(`${t.path}/${id}`, { replace: true })
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <Link to={t.path} className="back-link">
            <ArrowLeft size={15} /> {t.plural}
          </Link>
          <h1>New {t.label.toLowerCase()}</h1>
        </div>
      </div>

      <div className="builder">
        <div className="builder-main">
          <ol className="stepper">
            {STEPS.map((s, i) => (
              <li key={s}>
                <button
                  className={i === step ? 'current' : i < step ? 'done' : ''}
                  disabled={!canOpen(i)}
                  onClick={() => setStep(i)}
                >
                  <span className="step-dot">{i < step ? <Check size={13} strokeWidth={3} /> : i + 1}</span>
                  {s}
                </button>
              </li>
            ))}
          </ol>

          <ErrorBanner message={error} />

          {step === 0 && (
            <CustomerStep
              customers={customers}
              selected={customer}
              onSelect={(c) => {
                setCustomer(c)
                setStep(1)
              }}
              onNew={() => setModal('customer')}
            />
          )}

          {step === 1 && (
            <div className="card">
              <div className="card-head card-head-tight">
                <div>
                  <h3>Add products</h3>
                  <p className="text-secondary">Click a product to add it. Click again to increase quantity.</p>
                </div>
                {isAdmin && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setModal('product')}>
                    <Plus size={15} /> New product
                  </button>
                )}
              </div>

              <ProductPicker products={products} items={items} onAdd={addProduct} />

              {items.length > 0 && (
                <div className="lines">
                  <div className="lines-head">
                    <span>Item</span>
                    <span>Qty</span>
                    <span>Price</span>
                    <span className="num">Amount</span>
                    <span />
                  </div>
                  {items.map((i) => (
                    <div key={i.product_id} className="line">
                      <div className="line-name">
                        <span className="strong">{i.name}</span>
                        <span className="text-muted">per {i.unit}</span>
                      </div>
                      <div className="qty">
                        <button type="button" onClick={() => stepQty(i.product_id, -1)} aria-label="Decrease">
                          <Minus size={13} />
                        </button>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={i.qty}
                          className={Number(i.qty) > 0 ? '' : 'invalid'}
                          onChange={(e) => updateItem(i.product_id, 'qty', e.target.value)}
                        />
                        <button type="button" onClick={() => stepQty(i.product_id, 1)} aria-label="Increase">
                          <Plus size={13} />
                        </button>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className={`input input-num ${Number(i.unit_price) >= 0 && i.unit_price !== '' ? '' : 'invalid'}`}
                        value={i.unit_price}
                        onChange={(e) => updateItem(i.product_id, 'unit_price', e.target.value)}
                      />
                      <span className="num strong">{money((Number(i.qty) || 0) * (Number(i.unit_price) || 0))}</span>
                      <button className="icon-btn danger" onClick={() => removeItem(i.product_id)} aria-label="Remove">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="card-actions">
                <button className="btn btn-secondary" onClick={() => setStep(0)}>
                  Back
                </button>
                <button className="btn btn-primary" disabled={!itemsValid} onClick={() => setStep(2)}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="card">
              <div className="card-head card-head-tight">
                <div>
                  <h3>Details</h3>
                  <p className="text-secondary">Dates, discount, tax and notes.</p>
                </div>
              </div>
              <div className="form-grid">
                <Field label={`${t.label} date`}>
                  <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
                {type === 'quotation' ? (
                  <Field label="Valid until">
                    <input
                      type="date"
                      className="input"
                      value={validUntil}
                      min={date}
                      onChange={(e) => setValidUntil(e.target.value)}
                    />
                  </Field>
                ) : (
                  <div />
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
                <div className="span-2">
                  <Field label="Notes">
                    <textarea
                      rows={3}
                      className="input"
                      placeholder="Payment terms, delivery details… (optional)"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
              <div className="card-actions">
                <button className="btn btn-secondary" onClick={() => setStep(1)} disabled={saving}>
                  Back
                </button>
                <button className="btn btn-primary" onClick={handleCreate} disabled={!canCreate || saving}>
                  {saving ? 'Creating…' : `Create ${t.label.toLowerCase()}`}
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="builder-aside">
          <div className="card summary">
            <div className="summary-block">
              <div className="summary-label">
                From <span className="tag">Auto-selected</span>
              </div>
              <div className="party">
                <div className="party-icon">
                  <Building2 size={16} />
                </div>
                <div>
                  <div className="strong">{company.name}</div>
                  <div className="text-muted">{company.phone || company.address}</div>
                </div>
              </div>
            </div>

            <div className="summary-block">
              <div className="summary-label">Bill to</div>
              {customer ? (
                <div className="party">
                  <div className="avatar avatar-sm avatar-soft">{initials(customer.name)}</div>
                  <div>
                    <div className="strong">{customer.name}</div>
                    <div className="text-muted">{[customer.contact_person, customer.city].filter(Boolean).join(' · ')}</div>
                    {customer.ntn && <div className="text-muted">NTN {customer.ntn}</div>}
                  </div>
                </div>
              ) : (
                <div className="party text-muted">
                  <div className="party-icon">
                    <UserRound size={16} />
                  </div>
                  No customer selected
                </div>
              )}
            </div>

            <div className="summary-block">
              <div className="summary-label">
                Summary · {items.length} item{items.length === 1 ? '' : 's'}
              </div>
              <div className="sum-row">
                <span>Subtotal</span>
                <span>{money(totals.subtotal)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="sum-row">
                  <span>Discount</span>
                  <span>− {money(totals.discount)}</span>
                </div>
              )}
              {GST_PERCENT > 0 && (
                <div className="sum-row">
                  <span>GST ({GST_PERCENT}%)</span>
                  <span>{money(totals.tax)}</span>
                </div>
              )}
              <div className="sum-row sum-total">
                <span>Total</span>
                <span>{money(totals.total)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {modal === 'customer' && (
        <CustomerModal
          onClose={() => setModal(null)}
          onSaved={(c) => {
            setCustomers((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))
            setCustomer(c)
            setModal(null)
            setStep(1)
          }}
        />
      )}
      {modal === 'product' && (
        <ProductModal
          existing={products}
          onClose={() => setModal(null)}
          onSaved={(p) => {
            setProducts((prev) => [...prev, p].sort((a, b) => a.name.localeCompare(b.name)))
            addProduct(p)
            setModal(null)
          }}
        />
      )}
    </>
  )
}

function CustomerStep({ customers, selected, onSelect, onNew }) {
  const [q, setQ] = useState('')
  const needle = q.toLowerCase()
  const filtered = customers.filter((c) => [c.name, c.contact_person, c.phone, c.city, c.ntn].some((v) => v?.toLowerCase().includes(needle)))

  return (
    <div className="card">
      <div className="card-head card-head-tight">
        <div>
          <h3>Select customer</h3>
          <p className="text-secondary">Who is this for?</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onNew}>
          <Plus size={15} /> New customer
        </button>
      </div>

      <div className="input-icon">
        <Search size={16} />
        <input
          autoFocus
          className="input"
          placeholder="Search by company, contact, phone or city"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {customers.length === 0 ? (
        <EmptyState icon={UserRound} title="No customers yet" text="Add your first customer to continue." />
      ) : (
        <div className="choice-grid">
          {filtered.map((c) => (
            <button key={c.id} className={`choice ${selected?.id === c.id ? 'selected' : ''}`} onClick={() => onSelect(c)}>
              <div className="avatar avatar-sm avatar-soft">{initials(c.name)}</div>
              <div className="choice-text">
                <span className="strong">{c.name}</span>
                <span className="text-muted">{[c.contact_person, c.city].filter(Boolean).join(' · ') || '—'}</span>
              </div>
              {selected?.id === c.id && <Check size={16} className="choice-check" />}
            </button>
          ))}
          {filtered.length === 0 && <p className="text-muted">No customers match “{q}”.</p>}
        </div>
      )}
    </div>
  )
}

function ProductPicker({ products, items, onAdd }) {
  const [q, setQ] = useState('')
  const needle = q.toLowerCase()
  const filtered = products.filter((p) => [p.name, p.sku].some((v) => v?.toLowerCase().includes(needle)))
  const qtyOf = (id) => items.find((i) => i.product_id === id)?.qty

  return (
    <>
      <div className="input-icon">
        <Search size={16} />
        <input className="input" placeholder="Search product or SKU" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {products.length === 0 ? (
        <p className="text-muted picker-empty">No products in the catalog yet.</p>
      ) : (
        <div className="product-grid">
          {filtered.map((p) => {
            const qty = qtyOf(p.id)
            return (
              <button key={p.id} className={`product-tile ${qty ? 'selected' : ''}`} onClick={() => onAdd(p)}>
                <span className="strong">{p.name}</span>
                <span className="text-muted">
                  {p.sku || '—'} · Stock {Number(p.stock ?? 0)}
                </span>
                <span className="product-price">
                  {money(p.price)} <span className="text-muted">/ {p.unit}</span>
                </span>
                {qty && <span className="product-qty">{qty}</span>}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
