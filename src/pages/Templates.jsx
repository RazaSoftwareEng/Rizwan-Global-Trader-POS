import { useEffect, useMemo, useState } from 'react'
import { Check, CheckCircle2 } from 'lucide-react'
import { getDefaultCompany, saveDocumentStyle } from '../lib/api'
import { ACCENTS, DEFAULT_ACCENT, DEFAULT_TEMPLATE, TEMPLATES } from '../lib/templates'
import { GST_PERCENT, addDays, today } from '../lib/format'
import { useAuth } from '../auth/AuthProvider'
import { ErrorBanner, Loading, PageHeader } from '../components/ui'
import DocumentPaper from '../components/DocumentPaper'
import ScaledPaper from '../components/ScaledPaper'

const round2 = (n) => Math.round(n * 100) / 100
const HEX = /^#[0-9a-f]{6}$/i

// Example document for previews, using the real company details
function sampleDoc(type, company, preparedBy) {
  const items = [
    ['Basmati Rice 5kg', 'bag', 20, 2450],
    ['Cooking Oil 5L', 'can', 10, 2950],
    ['Sugar 1kg', 'kg', 50, 155],
    ['Tea 950g', 'pack', 12, 1650],
  ].map(([product_name, unit, qty, unit_price], i) => ({ id: i, product_name, unit, qty, unit_price, line_total: qty * unit_price }))
  const subtotal = items.reduce((s, i) => s + i.line_total, 0)
  const discount = 1000
  const tax_amount = round2(((subtotal - discount) * GST_PERCENT) / 100)
  const month = today().slice(2, 4) + today().slice(5, 7)
  return {
    companies: company,
    customers: {
      name: 'Ahmed Traders',
      contact_person: 'Ahmed Raza',
      address: 'Shop 12, Anarkali Bazaar',
      city: 'Lahore',
      phone: '+92 301 1111111',
      ntn: '1234567-1',
    },
    items,
    no: type === 'invoice' ? `RGT-INV-${month}-0001` : `RGT-QT-${month}-0001`,
    date: today(),
    valid_until: type === 'quotation' ? addDays(15) : null,
    status: type === 'invoice' ? 'unpaid' : 'open',
    subtotal,
    discount,
    tax_percent: GST_PERCENT,
    tax_amount,
    total: round2(subtotal - discount + tax_amount),
    notes: 'Payment due within 15 days. Goods once sold will not be taken back.',
    created_by_name: preparedBy,
  }
}

export default function Templates() {
  const { user } = useAuth()
  const [company, setCompany] = useState(null)
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [accent, setAccent] = useState(DEFAULT_ACCENT)
  const [hexDraft, setHexDraft] = useState(DEFAULT_ACCENT)
  const [kind, setKind] = useState('invoice')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getDefaultCompany()
      .then((co) => {
        if (!co) throw new Error('Add your company details in Settings first.')
        setCompany(co)
        setTemplate(co.doc_template || DEFAULT_TEMPLATE)
        setAccent(co.doc_accent || DEFAULT_ACCENT)
        setHexDraft(co.doc_accent || DEFAULT_ACCENT)
      })
      .catch((e) => setError(e.message))
  }, [])

  const sample = useMemo(() => (company ? sampleDoc(kind, company, user?.name) : null), [kind, company, user?.name])

  const current = company ? { template: company.doc_template || DEFAULT_TEMPLATE, accent: company.doc_accent || DEFAULT_ACCENT } : null
  const dirty = current && (template !== current.template || accent.toLowerCase() !== current.accent.toLowerCase())

  const pickAccent = (value) => {
    setAccent(value)
    setHexDraft(value)
  }

  async function handleSave() {
    setBusy(true)
    setError('')
    try {
      setCompany(await saveDocumentStyle(company.id, { doc_template: template, doc_accent: accent.toLowerCase() }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  const preset = ACCENTS.find((a) => a.value.toLowerCase() === accent.toLowerCase())

  return (
    <>
      <PageHeader
        title="Templates"
        subtitle="Choose how invoices and quotations look. The selected design is used for everyone."
        actions={
          <>
            {saved && (
              <span className="saved-note">
                <CheckCircle2 size={15} /> Saved
              </span>
            )}
            {dirty && (
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setTemplate(current.template)
                  pickAccent(current.accent)
                }}
                disabled={busy}
              >
                Reset
              </button>
            )}
            <button className="btn btn-primary" onClick={handleSave} disabled={!dirty || busy}>
              <Check size={16} /> {busy ? 'Saving…' : 'Use this template'}
            </button>
          </>
        }
      />

      <ErrorBanner message={error} />
      {!company && !error && <Loading />}

      {company && (
        <div className="tpl-layout">
          <aside className="card tpl-side">
            <section>
              <h3 className="tpl-heading">Template</h3>
              <div className="tpl-grid">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    className={`tpl-card ${template === t.id ? 'selected' : ''}`}
                    onClick={() => setTemplate(t.id)}
                    aria-pressed={template === t.id}
                  >
                    <ScaledPaper crop className="tpl-thumb">
                      <DocumentPaper type={kind} doc={sample} template={t.id} accent={accent} fixed />
                    </ScaledPaper>
                    <span className="tpl-card-name">
                      {t.name}
                      {current.template === t.id && <Check size={14} strokeWidth={3} className="tpl-in-use" aria-label="In use" />}
                    </span>
                    <span className="tpl-card-text">{t.text}</span>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="tpl-heading">Colour</h3>
              <div className="swatches">
                {ACCENTS.map((a) => (
                  <button
                    key={a.value}
                    className={`swatch-item ${preset?.value === a.value ? 'selected' : ''}`}
                    onClick={() => pickAccent(a.value)}
                    aria-pressed={preset?.value === a.value}
                  >
                    <span className="swatch-dot" style={{ '--swatch': a.value }}>
                      {preset?.value === a.value && <Check size={14} strokeWidth={3} />}
                    </span>
                    <span>{a.name}</span>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="tpl-heading">Custom colour</h3>
              <div className="custom-color">
                <input type="color" value={accent} onChange={(e) => pickAccent(e.target.value)} aria-label="Pick a colour" />
                <input
                  className={`input ${HEX.test(hexDraft) ? '' : 'invalid'}`}
                  value={hexDraft}
                  maxLength={7}
                  onChange={(e) => {
                    const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
                    setHexDraft(v)
                    if (HEX.test(v)) setAccent(v)
                  }}
                  aria-label="Hex colour"
                />
              </div>
              <p className="tpl-help">
                The colour is used for the title, headings, table header and highlights. Existing invoices also switch to the saved design.
              </p>
            </section>
          </aside>

          <section className="tpl-preview">
            <div className="tpl-preview-bar">
              <div>
                <span className="strong">{TEMPLATES.find((t) => t.id === template)?.name}</span>
                <span className="text-muted"> · Live preview, sample data</span>
              </div>
              <div className="segmented">
                <button className={kind === 'invoice' ? 'active' : ''} onClick={() => setKind('invoice')}>
                  Invoice
                </button>
                <button className={kind === 'quotation' ? 'active' : ''} onClick={() => setKind('quotation')}>
                  Quotation
                </button>
              </div>
            </div>
            <ScaledPaper className="tpl-page">
              <DocumentPaper type={kind} doc={sample} template={template} accent={accent} fixed />
            </ScaledPaper>
          </section>
        </div>
      )}
    </>
  )
}
