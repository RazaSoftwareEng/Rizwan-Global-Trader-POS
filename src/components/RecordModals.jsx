import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteCustomer, deleteProduct, saveCustomer, saveProduct } from '../lib/api'
import { CUSTOMER_FIELDS, EMPTY_CUSTOMER } from '../lib/customerFields'
import { EMPTY_PRODUCT, PRODUCT_FIELDS, validateProduct } from '../lib/productFields'
import { ErrorBanner, Field, Modal } from './ui'

const filled = (v) => String(v ?? '').trim() !== ''

// Shared create/edit/delete modal. `onSaved(record)` after save, `onDeleted(id)` after delete.
function RecordModal({ title, initial, fields, save, remove, validate, onClose, onSaved, onDeleted }) {
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


export function CustomerModal({ customer, ...props }) {
  return (
    <RecordModal
      title="customer"
      initial={customer ?? EMPTY_CUSTOMER}
      fields={CUSTOMER_FIELDS}
      save={saveCustomer}
      remove={deleteCustomer}
      {...props}
    />
  )
}

// `existing` = current catalog, used to block duplicate names / SKUs before saving
export function ProductModal({ product, existing = [], ...props }) {
  return (
    <RecordModal
      title="product"
      initial={product ? { ...product, sku: product.sku ?? '', description: product.description ?? '' } : EMPTY_PRODUCT}
      fields={PRODUCT_FIELDS}
      validate={(f) => validateProduct(f, existing)}
      save={saveProduct}
      remove={deleteProduct}
      {...props}
    />
  )
}
