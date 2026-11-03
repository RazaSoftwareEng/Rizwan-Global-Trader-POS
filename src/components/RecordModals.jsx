import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteCustomer, deleteExpense, deleteProduct, saveCustomer, saveExpense, saveProduct } from '../lib/api'
import { CUSTOMER_FIELDS, EMPTY_CUSTOMER } from '../lib/customerFields'
import { EMPTY_PRODUCT, PRODUCT_FIELDS, validateProduct } from '../lib/productFields'
import { EXPENSE_FIELDS, emptyExpense, validateExpense } from '../lib/expenseFields'
import { ErrorBanner, Field, Modal } from './ui'
import TemplatePicker from './TemplatePicker'
import SearchSelect from './SearchSelect'
import { TEMPLATES } from '../lib/templates'

const filled = (v) => String(v ?? '').trim() !== ''

// Shared create/edit/delete modal. `onSaved(record)` after save, `onDeleted(id)` after delete.
function RecordModal({ title, initial, fields, save, remove, validate, wide, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)
  const isEdit = Boolean(initial.id)

  const missing = fields.filter((f) => f.required && !filled(form[f.key]))
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function run(fn) {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const handleSave = (e) => {
    e.preventDefault()
    setTouched(true)
    if (missing.length) {
      setError(`Please fill in: ${missing.map((f) => f.label).join(', ')}`)
      return
    }
    const problem = validate?.(form)
    if (problem) {
      setError(problem)
      return
    }
    run(async () => onSaved(await save(form)))
  }

  const handleDelete = () => {
    if (!window.confirm('Delete this record? This cannot be undone.')) return
    run(async () => {
      await remove(initial.id)
      onDeleted?.(initial.id)
    })
  }

  return (
    <Modal
      title={`${isEdit ? 'Edit' : 'New'} ${title}`}
      wide={wide}
      onClose={onClose}
      footer={
        <>
          {isEdit && remove && (
            <button type="button" className="btn btn-danger-ghost mr-auto" onClick={handleDelete} disabled={busy}>
              <Trash2 size={15} /> Delete
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="record-form" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <ErrorBanner message={error} />
      <form id="record-form" className="form-grid" onSubmit={handleSave} noValidate>
        {fields.map((f) => {
          const invalid = touched && f.required && !filled(form[f.key])
          const props = {
            className: `input ${invalid ? 'invalid' : ''}`,
            required: f.required,
            autoFocus: f.autoFocus,
            placeholder: f.placeholder,
            value: form[f.key] ?? '',
            onChange: set(f.key),
          }
          // Custom pickers live in a <div>, not a <label>, so clicks don't jump to the first button
          if (f.render) {
            return (
              <div key={f.key} className={`field ${f.full ? 'span-2' : ''}`}>
                <span className="field-label">
                  {f.label}
                  {f.required && <span className="req"> *</span>}
                </span>
                {f.render(form[f.key], (v) => setForm((prev) => ({ ...prev, [f.key]: v })), invalid)}
                {invalid && <span className="field-hint">Required</span>}
              </div>
            )
          }
          return (
            <div key={f.key} className={f.full ? 'span-2' : ''}>
              <Field
                label={
                  <>
                    {f.label}
                    {f.required ? <span className="req"> *</span> : <span className="optional"> (optional)</span>}
                  </>
                }
                hint={invalid ? 'Required' : null}
              >
                {f.textarea ? (
                  <textarea rows={3} {...props} />
                ) : f.options && f.searchable ? (
                  <SearchSelect
                    value={form[f.key]}
                    options={f.options}
                    invalid={invalid}
                    placeholder={`Search ${f.label.toLowerCase()}…`}
                    onChange={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                  />
                ) : f.options ? (
                  <select {...props}>
                    {/* keep an older value that is no longer in the list */}
                    {[...new Set([...(form[f.key] ? [form[f.key]] : []), ...f.options])].map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type ?? 'text'}
                    min={f.type === 'number' ? 0 : undefined}
                    step={f.type === 'number' ? 'any' : undefined}
                    {...props}
                  />
                )}
              </Field>
            </div>
          )
        })}
      </form>
    </Modal>
  )
}


// `customers` = the current list, used to show which templates are already taken
export function CustomerModal({ customer, customers = [], ...props }) {
  const fields = CUSTOMER_FIELDS.map((f) =>
    f.key === 'doc_template'
      ? {
          ...f,
          render: (value, onChange, invalid) => (
            <TemplatePicker value={value} onChange={onChange} customers={customers} selfId={customer?.id} invalid={invalid} />
          ),
        }
      : f,
  )
  const validate = (form) => {
    const owner = customers.find((c) => c.id !== customer?.id && c.doc_template && c.doc_template === form.doc_template)
    const name = TEMPLATES.find((t) => t.id === form.doc_template)?.name
    return owner ? `The ${name} template is already used by ${owner.name}. Choose another one.` : ''
  }
  return (
    <RecordModal
      title="customer"
      wide
      initial={customer ? { ...customer, doc_template: customer.doc_template ?? '' } : EMPTY_CUSTOMER}
      fields={fields}
      validate={validate}
      save={saveCustomer}
      remove={deleteCustomer}
      {...props}
    />
  )
}

// `existing` = current catalog, used to block duplicate names / SKUs before saving.
// `customers` shows a customer picker; `customerId` locks the product to one customer instead.
export function ProductModal({ product, existing = [], customers, customerId, ...props }) {
  const fields = customers
    ? [
        {
          key: 'customer_id',
          label: 'Customer catalog',
          full: true,
          render: (value, onChange) => (
            <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
              <option value="">Shared — all customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ),
        },
        ...PRODUCT_FIELDS,
      ]
    : PRODUCT_FIELDS
  return (
    <RecordModal
      title="product"
      initial={
        product
          ? { ...product, sku: product.sku ?? '', description: product.description ?? '' }
          : { ...EMPTY_PRODUCT, customer_id: customerId ?? null }
      }
      fields={fields}
      validate={(f) => validateProduct(f, existing)}
      save={saveProduct}
      remove={deleteProduct}
      {...props}
    />
  )
}

export function ExpenseModal({ expense, canDelete, ...props }) {
  return (
    <RecordModal
      title="expense"
      initial={
        expense
          ? { ...expense, amount: String(expense.amount), paid_to: expense.paid_to ?? '', reference: expense.reference ?? '' }
          : emptyExpense()
      }
      fields={EXPENSE_FIELDS}
      validate={validateExpense}
      save={saveExpense}
      remove={canDelete ? deleteExpense : undefined}
      {...props}
    />
  )
}
