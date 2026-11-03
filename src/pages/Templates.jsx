import { useEffect, useMemo, useState } from 'react'
import { Check, CheckCircle2 } from 'lucide-react'
import { getDefaultCompany, listCustomers, saveDocumentStyle } from '../lib/api'
import { ACCENTS, DEFAULT_ACCENT, DEFAULT_TEMPLATE, TEMPLATES } from '../lib/templates'
import { sampleDoc } from '../lib/sampleDoc'
import { useAuth } from '../auth/AuthProvider'
import { ErrorBanner, Loading, PageHeader } from '../components/ui'
import DocumentPaper from '../components/DocumentPaper'
import ScaledPaper from '../components/ScaledPaper'

const HEX = /^#[0-9a-f]{6}$/i

export default function Templates() {
  const { user } = useAuth()
  const [company, setCompany] = useState(null)
  const [customers, setCustomers] = useState([])
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
    listCustomers().then(setCustomers).catch(() => {})
  }, [])

  const usedBy = Object.fromEntries(customers.filter((c) => c.doc_template).map((c) => [c.doc_template, c.name]))
  const usedCount = Object.keys(usedBy).length

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
        subtitle={`Each customer has their own template (${usedCount} of ${TEMPLATES.length} assigned). Set it when adding or editing a customer. Here you choose the colour and the default for customers without one.`}
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
              <Check size={16} /> {busy ? 'Saving…' : 'Save colour & default'}
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
                      {current.template === t.id && <span className="tag">Default</span>}
                    </span>
                    <span className={`tpl-card-owner ${usedBy[t.id] ? 'is-taken' : ''}`}>
                      {usedBy[t.id] ? `Used by ${usedBy[t.id]}` : 'Available'}
                    </span>
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
