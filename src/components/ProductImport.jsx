import { useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Download, FileUp, Upload } from 'lucide-react'
import { importProducts } from '../lib/api'
import { TEMPLATE_CSV, readImport } from '../lib/productFields'
import { money } from '../lib/format'
import { ErrorBanner, Modal } from './ui'

function downloadTemplate() {
  const blob = new Blob(['﻿' + TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'products-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function ProductImport({ existing, onClose, onImported }) {
  const inputRef = useRef(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  const valid = rows?.filter((r) => r.errors.length === 0) ?? []
  const invalid = rows?.filter((r) => r.errors.length > 0) ?? []

  async function readFile(file) {
    if (!file) return
    setError('')
    setRows(null)
    if (!/\.csv$/i.test(file.name)) {
      setError('Please choose a .csv file. In Excel: File → Save As → CSV (Comma delimited).')
      return
    }
    setFileName(file.name)
    const result = readImport(await file.text(), existing)
    if (result.error) setError(result.error)
    else if (!result.rows.length) setError('No product rows found under the header.')
    else setRows(result.rows)
  }

  async function handleImport() {
    setBusy(true)
    setError('')
    try {
      onImported(await importProducts(valid.map((r) => r.form)))
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Import products"
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost mr-auto" onClick={downloadTemplate}>
            <Download size={15} /> Download template
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleImport} disabled={busy || valid.length === 0}>
            <Upload size={15} />
            {busy ? 'Importing…' : `Import ${valid.length || ''} product${valid.length === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      <ErrorBanner message={error} />

      <div
        className={`dropzone ${dragging ? 'dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          readFile(e.dataTransfer.files[0])
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            readFile(e.target.files[0])
            e.target.value = ''
          }}
        />
        <div className="empty-icon">
          <FileUp size={22} strokeWidth={1.8} />
        </div>
        <div className="strong">{fileName || 'Drop a CSV file here, or click to choose'}</div>
        <div className="text-muted">
          Columns: <b>name</b>, <b>price</b> (required) · sku, unit, stock, description (optional)
        </div>
      </div>

      {rows && (
        <>
          <div className="import-summary">
            <span className="status status-good">
              <CheckCircle2 size={13} /> {valid.length} ready
            </span>
            {invalid.length > 0 && (
              <span className="status status-critical">
                <AlertCircle size={13} /> {invalid.length} with errors (will be skipped)
              </span>
            )}
          </div>
          <div className="import-table">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Name</th>
                  <th>SKU</th>
                  <th>Unit</th>
                  <th className="num">Price</th>
                  <th className="num">Stock</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line} className={r.errors.length ? 'row-error' : ''}>
                    <td className="text-muted">{r.line}</td>
                    <td className="strong">{r.form.name || '—'}</td>
                    <td className="mono">{r.form.sku || '—'}</td>
                    <td>{r.form.unit}</td>
                    <td className="num">{r.form.price === '' ? '—' : money(String(r.form.price).replace(/,/g, ''))}</td>
                    <td className="num">{r.form.stock || 0}</td>
                    <td>
                      {r.errors.length ? (
                        <span className="import-error">{r.errors.join(' · ')}</span>
                      ) : (
                        <span className="import-ok">
                          <CheckCircle2 size={14} /> OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  )
}
