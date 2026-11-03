// The printable invoice / quotation, in the chosen template and accent colour.
// Used by the document page and by the Templates page previews.
import { formatDate, initials, money } from '../lib/format'
import { DEFAULT_ACCENT, DEFAULT_TEMPLATE, TEMPLATES, amountInWords } from '../lib/templates'
import '../documents.css'

const join = (parts, sep = ' · ') => parts.filter(Boolean).join(sep)

function Logo({ co, height }) {
  if (co.logo) return <img className="d-logo-img" src={co.logo} alt={`${co.name} logo`} style={{ height }} />
  return <div className="d-logo">{initials(co.name)}</div>
}

function CompanyLines({ co }) {
  return (
    <>
      {co.address && <div>{co.address}</div>}
      {join([co.phone, co.email]) && <div>{join([co.phone, co.email])}</div>}
      {join([co.ntn && `NTN: ${co.ntn}`, co.strn && `STRN: ${co.strn}`]) && (
        <div>{join([co.ntn && `NTN: ${co.ntn}`, co.strn && `STRN: ${co.strn}`])}</div>
      )}
    </>
  )
}

function CustomerLines({ cu, showName = true }) {
  return (
    <>
      {showName && <div className="d-party-name">{cu.name}</div>}
      {cu.contact_person && <div>Attn: {cu.contact_person}</div>}
      {join([cu.address, cu.city], ', ') && <div>{join([cu.address, cu.city], ', ')}</div>}
      {join([cu.phone, cu.email]) && <div>{join([cu.phone, cu.email])}</div>}
      {join([cu.ntn && `NTN: ${cu.ntn}`, cu.strn && `STRN: ${cu.strn}`]) && (
        <div>{join([cu.ntn && `NTN: ${cu.ntn}`, cu.strn && `STRN: ${cu.strn}`])}</div>
      )}
    </>
  )
}

function metaRows(type, doc, withNumber) {
  return [
    withNumber && [`${type === 'invoice' ? 'Invoice' : 'Quotation'} no.`, doc.no],
    ['Date', formatDate(doc.date)],
    doc.valid_until && ['Valid until', formatDate(doc.valid_until)],
    type === 'invoice' && ['Status', doc.status === 'paid' ? 'Paid' : 'Unpaid'],
    type === 'invoice' && doc.status !== 'paid' && doc.due_date && ['Due date', formatDate(doc.due_date)],
    type === 'invoice' && doc.status === 'paid' && doc.payment_method && ['Paid by', doc.payment_method],
    type === 'invoice' && doc.status === 'paid' && doc.payment_ref && ['Reference', doc.payment_ref],
  ].filter(Boolean)
}

function MetaList({ rows }) {
  return (
    <dl className="d-meta-list">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function ItemsTable({ items }) {
  return (
    <table className="d-items">
      <thead>
        <tr>
          <th className="d-idx">#</th>
          <th>Description</th>
          <th className="d-num">Qty</th>
          <th className="d-num">Rate</th>
          <th className="d-num">Amount</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, i) => (
          <tr key={it.id ?? i}>
            <td className="d-idx">{i + 1}</td>
            <td className="d-desc">{it.product_name}</td>
            <td className="d-num">
              {Number(it.qty)} {it.unit}
            </td>
            <td className="d-num">{money(it.unit_price)}</td>
            <td className="d-num">{money(it.line_total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Totals({ doc }) {
  return (
    <div className="d-totals">
      <div>
        <span>Subtotal</span>
        <span>{money(doc.subtotal)}</span>
      </div>
      {Number(doc.discount) > 0 && (
        <div>
          <span>Discount</span>
          <span>− {money(doc.discount)}</span>
        </div>
      )}
      {Number(doc.tax_percent) > 0 && (
        <div>
          <span>GST ({Number(doc.tax_percent)}%)</span>
          <span>{money(doc.tax_amount)}</span>
        </div>
      )}
      <div className="d-grand">
        <span>Total</span>
        <span>{money(doc.total)}</span>
      </div>
    </div>
  )
}

function Notes({ notes }) {
  if (!notes) return <div />
  return (
    <div className="d-notes">
      <div className="d-label">Notes</div>
      <p>{notes}</p>
    </div>
  )
}

// ---------- Templates ----------

function Classic({ type, doc, co, cu, label }) {
  return (
    <>
      <header className="d-head">
        <div>
          <Logo co={co} height={96} />
          <h2 className="d-company">{co.name}</h2>
          <div className="d-muted">
            <CompanyLines co={co} />
          </div>
        </div>
        <div className="d-title">
          <div className="d-kind">{label}</div>
          <div className="d-no">{doc.no}</div>
        </div>
      </header>
      <section className="d-meta">
        <div className="d-muted">
          <div className="d-label">Bill to</div>
          <CustomerLines cu={cu} />
        </div>
        <MetaList rows={metaRows(type, doc)} />
      </section>
      <ItemsTable items={doc.items} />
      <section className="d-bottom">
        <Notes notes={doc.notes} />
        <Totals doc={doc} />
      </section>
      <footer className="d-foot">Thank you for your business.</footer>
    </>
  )
}

function Modern({ type, doc, co, cu, label }) {
  return (
    <>
      <header className="d-band">
        <div className="d-band-left">
          <div className={co.logo ? 'd-logo-frame' : ''}>
            <Logo co={co} height={72} />
          </div>
          <div>
            <h2 className="d-company">{co.name}</h2>
            <div className="d-band-lines">
              <CompanyLines co={co} />
            </div>
          </div>
        </div>
        <div className="d-title">
          <div className="d-kind">{label}</div>
          <div className="d-no">{doc.no}</div>
        </div>
      </header>
      <div className="d-body">
        <section className="d-cards">
          <div className="d-card d-muted">
            <div className="d-label">Bill to</div>
            <CustomerLines cu={cu} />
          </div>
          <div className="d-card">
            <div className="d-label">Details</div>
            <MetaList rows={metaRows(type, doc)} />
          </div>
        </section>
        <ItemsTable items={doc.items} />
        <section className="d-bottom">
          <Notes notes={doc.notes} />
          <Totals doc={doc} />
        </section>
        <footer className="d-foot">Thank you for your business.</footer>
      </div>
    </>
  )
}

function Minimal({ type, doc, co, cu, label }) {
  return (
    <>
      <header className="d-head">
        <div className="d-brand">
          {co.logo && <Logo co={co} height={64} />}
          <h2 className="d-company">{co.name}</h2>
        </div>
        <div className="d-kind">{label}</div>
      </header>
      <section className="d-cols">
        <div className="d-muted">
          <div className="d-label">From</div>
          <CompanyLines co={co} />
        </div>
        <div className="d-muted">
          <div className="d-label">Bill to</div>
          <CustomerLines cu={cu} />
        </div>
        <div>
          <div className="d-label">Details</div>
          <MetaList rows={metaRows(type, doc, true)} />
        </div>
      </section>
      <ItemsTable items={doc.items} />
      <section className="d-bottom">
        <Notes notes={doc.notes} />
        <Totals doc={doc} />
      </section>
      <footer className="d-foot">Thank you for your business.</footer>
    </>
  )
}

function Corporate({ type, doc, co, cu, label }) {
  return (
    <>
      <header className="d-head">
        <div className="d-brand">
          <Logo co={co} height={84} />
          <div>
            <h2 className="d-company">{co.name}</h2>
            <div className="d-muted">
              <CompanyLines co={co} />
            </div>
          </div>
        </div>
        <div className="d-kind">{label}</div>
      </header>
      <section className="d-boxes">
        <div className="d-box">
          <div className="d-box-title">Bill to</div>
          <div className="d-box-body d-muted">
            <CustomerLines cu={cu} />
          </div>
        </div>
        <div className="d-box">
          <div className="d-box-title">{label} details</div>
          <div className="d-box-body">
            <MetaList rows={metaRows(type, doc, true)} />
          </div>
        </div>
      </section>
      <ItemsTable items={doc.items} />
      <section className="d-bottom">
        <div>
          <div className="d-words">
            <div className="d-label">Amount in words</div>
            <div className="d-words-text">{amountInWords(doc.total)}</div>
          </div>
          <Notes notes={doc.notes} />
        </div>
        <Totals doc={doc} />
      </section>
      <section className="d-signs">
        <div>
          <span className="d-sign-line" />
          Prepared by{doc.created_by_name ? `: ${doc.created_by_name}` : ''}
        </div>
        <div>
          <span className="d-sign-line" />
          Authorized signature
        </div>
        <div>
          <span className="d-sign-line" />
          Customer signature
        </div>
      </section>
    </>
  )
}

function Executive({ type, doc, co, cu, label }) {
  return (
    <>
      <aside className="d-side">
        <div className="d-logo-frame d-side-logo">
          <Logo co={co} height={60} />
        </div>
        <h2 className="d-company">{co.name}</h2>
        <div className="d-side-lines">
          <CompanyLines co={co} />
        </div>
        <div className="d-side-block">
          <div className="d-label">Bill to</div>
          <CustomerLines cu={cu} />
        </div>
        <div className="d-side-block">
          <div className="d-label">Details</div>
          <MetaList rows={metaRows(type, doc)} />
        </div>
      </aside>
      <div className="d-main">
        <header className="d-main-head">
          <div className="d-kind">{label}</div>
          <div className="d-no">{doc.no}</div>
        </header>
        <ItemsTable items={doc.items} />
        <section className="d-bottom">
          <Totals doc={doc} />
          <div className="d-words">
            <div className="d-label">Amount in words</div>
            <div className="d-words-text">{amountInWords(doc.total)}</div>
          </div>
          <Notes notes={doc.notes} />
        </section>
        <footer className="d-foot">Thank you for your business.</footer>
      </div>
    </>
  )
}

function Elegant({ type, doc, co, cu, label }) {
  const tax = join([co.ntn && `NTN: ${co.ntn}`, co.strn && `STRN: ${co.strn}`])
  const strip = [
    [`${label} no.`, doc.no],
    ['Date', formatDate(doc.date)],
    type === 'invoice'
      ? ['Status', doc.status === 'paid' ? 'Paid' : 'Unpaid']
      : ['Valid until', doc.valid_until ? formatDate(doc.valid_until) : '—'],
    [type === 'invoice' ? 'Amount due' : 'Quoted total', money(doc.total)],
  ]
  return (
    <>
      <header className="d-letterhead">
        <Logo co={co} height={78} />
        <h2 className="d-company">{co.name}</h2>
        <div className="d-muted">{join([co.address, co.phone, co.email])}</div>
        {tax && <div className="d-muted">{tax}</div>}
      </header>
      <div className="d-title-rule">
        <span>{label}</span>
      </div>
      <section className="d-strip">
        {strip.map(([k, v], i) => (
          <div key={k} className={i === strip.length - 1 ? 'd-strip-due' : ''}>
            <div className="d-label">{k}</div>
            <div className="d-strip-value">{v}</div>
          </div>
        ))}
      </section>
      <section className="d-billto d-muted">
        <div className="d-label">Billed to</div>
        <CustomerLines cu={cu} />
      </section>
      <ItemsTable items={doc.items} />
      <section className="d-bottom">
        <div>
          <div className="d-words">
            <div className="d-label">Amount in words</div>
            <div className="d-words-text">{amountInWords(doc.total)}</div>
          </div>
          <Notes notes={doc.notes} />
        </div>
        <Totals doc={doc} />
      </section>
      <section className="d-sign">
        <span className="d-sign-line" />
        Authorized signature
      </section>
      <footer className="d-foot">Thank you for your business.</footer>
    </>
  )
}

function Bold({ type, doc, co, cu, label }) {
  return (
    <>
      <header className="d-head">
        <div className="d-brand">
          <Logo co={co} height={56} />
          <div>
            <h2 className="d-company">{co.name}</h2>
            <div className="d-muted">
              <CompanyLines co={co} />
            </div>
          </div>
        </div>
      </header>
      <section className="d-hero">
        <div>
          <div className="d-kind">{label}</div>
          <div className="d-no">{doc.no}</div>
        </div>
        <div className="d-hero-total">
          <div className="d-label">{type === 'invoice' ? 'Total due' : 'Quoted total'}</div>
          <div className="d-hero-amount">{money(doc.total)}</div>
        </div>
      </section>
      <section className="d-cols">
        <div className="d-muted">
          <div className="d-label">Bill to</div>
          <CustomerLines cu={cu} />
        </div>
        <div>
          <div className="d-label">Details</div>
          <MetaList rows={metaRows(type, doc)} />
        </div>
      </section>
      <ItemsTable items={doc.items} />
      <section className="d-bottom">
        <Notes notes={doc.notes} />
        <Totals doc={doc} />
      </section>
      <footer className="d-foot">Thank you for your business.</footer>
    </>
  )
}

function Ledger({ type, doc, co, cu, label }) {
  const third =
    type === 'invoice'
      ? ['Status', doc.status === 'paid' ? 'Paid' : 'Unpaid']
      : ['Valid until', doc.valid_until ? formatDate(doc.valid_until) : '—']
  return (
    <>
      <header className="d-ledger-head">
        <div className="d-brand">
          <Logo co={co} height={60} />
          <div>
            <h2 className="d-company">{co.name}</h2>
            <div className="d-muted">
              <CompanyLines co={co} />
            </div>
          </div>
        </div>
        <div className="d-ledger-kind">{type === 'invoice' ? 'Sales Tax Invoice' : 'Quotation'}</div>
      </header>
      <table className="d-grid-info">
        <tbody>
          <tr>
            <th>Customer</th>
            <td className="d-strong">{cu.name}</td>
            <th>{label} no.</th>
            <td className="d-strong">{doc.no}</td>
          </tr>
          <tr>
            <th>Attn</th>
            <td>{cu.contact_person || '—'}</td>
            <th>Date</th>
            <td>{formatDate(doc.date)}</td>
          </tr>
          <tr>
            <th>Address</th>
            <td>{join([cu.address, cu.city], ', ') || '—'}</td>
            <th>{third[0]}</th>
            <td>{third[1]}</td>
          </tr>
          <tr>
            <th>NTN / STRN</th>
            <td>{join([cu.ntn, cu.strn], ' / ') || '—'}</td>
            <th>Phone</th>
            <td>{cu.phone || '—'}</td>
          </tr>
        </tbody>
      </table>
      <ItemsTable items={doc.items} />
      <section className="d-bottom">
        <div>
          <div className="d-words">
            <div className="d-label">Amount in words</div>
            <div className="d-words-text">{amountInWords(doc.total)}</div>
          </div>
          <Notes notes={doc.notes} />
        </div>
        <Totals doc={doc} />
      </section>
      <section className="d-ledger-sign">
        <div>Prepared by{doc.created_by_name ? `: ${doc.created_by_name}` : ''}</div>
        <div>Checked by</div>
        <div>Receiver’s signature &amp; stamp</div>
      </section>
      <footer className="d-ledger-foot">E.&amp;O.E. · This is a computer-generated document.</footer>
    </>
  )
}

function Compact({ type, doc, co, cu, label }) {
  return (
    <>
      <header className="d-head">
        <div className="d-brand">
          <Logo co={co} height={44} />
          <div>
            <h2 className="d-company">{co.name}</h2>
            <div className="d-muted">
              {join([co.address, co.phone, co.email, co.ntn && `NTN ${co.ntn}`, co.strn && `STRN ${co.strn}`])}
            </div>
          </div>
        </div>
        <div className="d-title">
          <div className="d-kind">{label}</div>
          <div className="d-no">{doc.no}</div>
        </div>
      </header>
      <section className="d-info-bar">
        <div>
          <div className="d-label">Bill to</div>
          <div className="d-party-name">{cu.name}</div>
          <div className="d-muted">{join([cu.contact_person, cu.phone])}</div>
          <div className="d-muted">{join([cu.address, cu.city], ', ')}</div>
        </div>
        {metaRows(type, doc).map(([k, v]) => (
          <div key={k}>
            <div className="d-label">{k}</div>
            <div className="d-strong">{v}</div>
          </div>
        ))}
      </section>
      <ItemsTable items={doc.items} />
      <section className="d-bottom">
        <Notes notes={doc.notes} />
        <Totals doc={doc} />
      </section>
    </>
  )
}

function Premium({ type, doc, co, cu, label }) {
  return (
    <>
      <header className="d-dark">
        <div className="d-brand">
          <div className="d-logo-frame">
            <Logo co={co} height={56} />
          </div>
          <div>
            <h2 className="d-company">{co.name}</h2>
            <div className="d-dark-lines">
              <CompanyLines co={co} />
            </div>
          </div>
        </div>
        <div className="d-title">
          <div className="d-kind">{label}</div>
          <div className="d-no">{doc.no}</div>
        </div>
      </header>
      <div className="d-accent-bar" />
      <div className="d-body">
        <section className="d-meta">
          <div className="d-muted">
            <div className="d-label">Bill to</div>
            <CustomerLines cu={cu} />
          </div>
          <MetaList rows={metaRows(type, doc)} />
        </section>
        <ItemsTable items={doc.items} />
        <section className="d-bottom">
          <div>
            <div className="d-words">
              <div className="d-label">Amount in words</div>
              <div className="d-words-text">{amountInWords(doc.total)}</div>
            </div>
            <Notes notes={doc.notes} />
          </div>
          <Totals doc={doc} />
        </section>
      </div>
      <footer className="d-dark-foot">{join([co.phone, co.email, 'Thank you for your business'])}</footer>
    </>
  )
}

const LAYOUTS = {
  classic: Classic,
  modern: Modern,
  minimal: Minimal,
  corporate: Corporate,
  executive: Executive,
  elegant: Elegant,
  bold: Bold,
  ledger: Ledger,
  compact: Compact,
  premium: Premium,
}

// fixed = render at A4 width (for scaled thumbnails)
export default function DocumentPaper({ type, doc, template, accent, fixed = false }) {
  const id = TEMPLATES.some((t) => t.id === template) ? template : DEFAULT_TEMPLATE
  const Layout = LAYOUTS[id]
  return (
    <article className={`doc doc-${id} ${fixed ? 'doc-fixed' : ''}`} style={{ '--accent': accent || DEFAULT_ACCENT }}>
      <Layout
        type={type}
        doc={doc}
        co={doc.companies ?? {}}
        cu={doc.customers ?? {}}
        label={type === 'invoice' ? 'Invoice' : 'Quotation'}
      />
    </article>
  )
}
